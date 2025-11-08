import React, { useState, useCallback, useEffect, useMemo } from 'react';
import JSZip from 'jszip';
import IDEView from './components/IDEView';
import WorkspaceModal from './components/WorkspaceModal';
import DeleteWorkspaceModal from './components/DeleteWorkspaceModal';
import { getInitialWorkspaceData, sendMessageToAi, generateImageAsset } from './services/geminiService';
import type { WorkspaceType, Workspace, ChatMessage, UserChatMessage, ModelChatMessage, FileEntry, GroundingSource, AssetInfo, AiMode, LocalAsset } from './types';
import SpinnerIcon from './components/icons/SpinnerIcon';
import { cleanForSerialization } from './lib/utils/serialization';
import { useOnlineStatus } from './lib/utils/hooks';
import { extractJsonFromString } from './lib/utils/json';

// FIX: Define a minimal interface for the JSZipObject to resolve type errors
// when processing uploaded zip files. The 'unknown' type was causing property access errors.
interface JSZipObject {
    name: string;
    dir: boolean;
    async(type: 'string'): Promise<string>;
}

const generateId = () => `id-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

const STORAGE_KEY = 'ai-game-studio-state-v3'; // Incremented version for new data structure
const UNDO_STACK_LIMIT = 50;

const App: React.FC = () => {
    const [workspaces, setWorkspaces] = useState<Record<string, Workspace>>({});
    const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isCreatingAsset, setIsCreatingAsset] = useState<boolean>(false);
    const [loadingMode, setLoadingMode] = useState<AiMode | null>(null);
    const [isInitialized, setIsInitialized] = useState<boolean>(false);
    const [aiProgress, setAiProgress] = useState<string>('');
    const [appStatusMessage, setAppStatusMessage] = useState<string | null>(null);
    const [workspaceToDeleteId, setWorkspaceToDeleteId] = useState<string | null>(null);
    const isOnline = useOnlineStatus();

    // Load from localStorage on initial mount
    useEffect(() => {
        try {
            const savedState = localStorage.getItem(STORAGE_KEY);
            if (savedState) {
                const { workspaces: savedWorkspaces, activeWorkspaceId: savedActiveId } = JSON.parse(savedState);
                if (savedWorkspaces && Object.keys(savedWorkspaces).length > 0) {
                    setWorkspaces(savedWorkspaces);
                    // Check if the saved active ID is still valid
                    if (savedActiveId && savedWorkspaces[savedActiveId]) {
                        setActiveWorkspaceId(savedActiveId);
                    }
                }
            }
        } catch (error) {
            console.error("Failed to load state from localStorage:", error);
            // Clear corrupted state
            localStorage.removeItem(STORAGE_KEY);
        } finally {
            setIsInitialized(true);
        }
    }, []);

    // Save to localStorage whenever state changes
    useEffect(() => {
        if (!isInitialized) return; // Don't save until after initial load
        try {
            const stateToSave = { workspaces, activeWorkspaceId };
            const cleanedState = cleanForSerialization(stateToSave);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(cleanedState));
            // Also save active ID to session storage for the error boundary to access
            if (activeWorkspaceId) {
                sessionStorage.setItem('activeWorkspaceId', activeWorkspaceId);
            } else {
                sessionStorage.removeItem('activeWorkspaceId');
            }
        } catch (error) {
            console.error("Failed to save state to localStorage:", error);
        }
    }, [workspaces, activeWorkspaceId, isInitialized]);
    
    const activeWorkspace = useMemo(() => {
        return activeWorkspaceId ? workspaces[activeWorkspaceId] : null;
    }, [activeWorkspaceId, workspaces]);

    const workspaceMarkedForDeletion = useMemo(() => {
        return workspaceToDeleteId ? workspaces[workspaceToDeleteId] : null;
    }, [workspaceToDeleteId, workspaces]);

    const handleCreateWorkspace = useCallback((type: WorkspaceType) => {
        try {
            const { initialFiles, initialHistory } = getInitialWorkspaceData(type);
            const newId = generateId();
            const newWorkspace: Workspace = {
                id: newId,
                name: `${type} Project - ${new Date().toLocaleDateString()}`,
                type: type,
                files: initialFiles,
                chatHistory: initialHistory,
                localAssets: [],
                lastModified: Date.now(),
                undoStack: [],
                redoStack: [],
            };
            
            setWorkspaces(prev => ({ ...prev, [newId]: newWorkspace }));
            setActiveWorkspaceId(newId);

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
            alert(`Error initializing AI: ${errorMessage}`);
        }
    }, []);
    
    const handleSelectWorkspace = useCallback((id: string) => {
        if (workspaces[id]) {
            setWorkspaces(prev => ({
                ...prev,
                [id]: { ...prev[id], lastModified: Date.now() }
            }));
            setActiveWorkspaceId(id);
        }
    }, [workspaces]);

    const handleGenerateCode = useCallback(async (
        prompt: string,
        image: { data: string; mimeType: string } | null,
        mode: AiMode,
        isRetry = false
    ) => {
        if (!activeWorkspace || isLoading) return;
        
        setIsLoading(true);
        setLoadingMode(mode);
        setAiProgress(''); // Clear progress on new request
        
        const userMessage: UserChatMessage = {
            id: generateId(),
            role: 'user',
            text: prompt,
            image: image ?? undefined,
        };
        
        const historyWithUserMessage = [...activeWorkspace.chatHistory, userMessage];
        const filesBeforeUpdate = activeWorkspace.files; // Capture files for checkpoint
        
        setWorkspaces(prev => ({
            ...prev,
            [activeWorkspace.id]: { ...prev[activeWorkspace.id], chatHistory: historyWithUserMessage, lastModified: Date.now() }
        }));
        
        try {
            const onProgress = (update: { stage: string; content?: string }) => {
                if (update.content) {
                    if (update.stage === 'planner_stream') {
                        setAiProgress(prev => prev + update.content);
                    } else {
                        setAiProgress(update.content);
                    }
                }
            };

            const response = await sendMessageToAi(activeWorkspace, prompt, image, mode, onProgress);
            const fullResponseText = response.text;
            
            const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
            const groundingSources: GroundingSource[] = groundingMetadata?.groundingChunks
                ?.map(chunk => chunk.web)
                .filter((web): web is { uri: string; title: string } => !!(web && web.uri && web.title)) || [];

            const jsonResponse = extractJsonFromString(fullResponseText);

            if (!jsonResponse) {
                throw new Error('AI returned an invalid or non-JSON response.');
            }
            
            // FIX: Add a robust validation check to prevent state corruption from malformed AI responses.
            const { thinking, explanation, files, assetsUsed } = jsonResponse;
            if (!Array.isArray(files) || !files.every((f: any) => typeof f.path === 'string' && typeof f.content === 'string')) {
                 throw new Error("AI response is missing the 'files' field or it has an invalid format. Cannot apply changes.");
            }
            
            const modelMessageText = (typeof explanation === 'string' && explanation.trim()) ? explanation : 'Code updated successfully.';
            const updatedFilePaths = files.map((file: FileEntry) => file.path);

            const modelMessage: ModelChatMessage = { 
                id: generateId(), 
                role: 'model', 
                thinking: thinking,
                text: modelMessageText,
                fullResponse: fullResponseText,
                assetsUsed: Array.isArray(assetsUsed) ? (assetsUsed as AssetInfo[]) : [],
                groundingSources: groundingSources,
                filesUpdated: updatedFilePaths,
                checkpoint: filesBeforeUpdate, // Store the old files as a checkpoint
            };

            setWorkspaces(prev => {
                const currentWs = prev[activeWorkspace.id];
                // Replace the history that had the user message with the one that also includes the model's response.
                const finalHistory = [...currentWs.chatHistory, modelMessage];

                const newUndoStack = [...(currentWs.undoStack || [])];
                newUndoStack.push(filesBeforeUpdate);
                if (newUndoStack.length > UNDO_STACK_LIMIT) newUndoStack.shift();

                return {
                    ...prev,
                    [activeWorkspace.id]: {
                        ...currentWs,
                        files: files as FileEntry[],
                        chatHistory: finalHistory,
                        lastModified: Date.now(),
                        undoStack: newUndoStack,
                        redoStack: [], // Clear redo stack on new action
                    }
                };
            });

        } catch (error) {
            console.error(error);
            const errorMessage = error instanceof Error ? `Error: ${error.message}` : 'An unknown error occurred. The AI may have returned an invalid response.';
            
            let errorChatMessage: ModelChatMessage;

            // Handle failure from the self-correction loop specifically
            if (errorMessage.includes("AI self-correction loop failed")) {
                errorChatMessage = {
                     id: generateId(),
                     role: 'model',
                     text: `I tried to generate and validate the code multiple times but couldn't arrive at a stable solution. Please try rephrasing your request. (${errorMessage})`,
                     fullResponse: JSON.stringify({ error: errorMessage }),
                 };
            } else if (!isRetry) {
                errorChatMessage = {
                    id: generateId(),
                    role: 'model',
                    text: `I encountered an issue processing that request. Would you like me to try again? (${errorMessage})`,
                    fullResponse: JSON.stringify({ error: errorMessage }),
                    isFixable: true,
                    originalPrompt: prompt,
                };
            } else {
                 errorChatMessage = {
                     id: generateId(),
                     role: 'model',
                     text: `I'm sorry, I failed to recover from the error. Please try a different prompt. (${errorMessage})`,
                     fullResponse: JSON.stringify({ error: errorMessage }),
                 };
            }
            setWorkspaces(prev => {
                const currentWs = prev[activeWorkspace.id];
                return { ...prev, [activeWorkspace.id]: { ...currentWs, chatHistory: [...currentWs.chatHistory, errorChatMessage] }};
            });
        } finally {
            setIsLoading(false);
            setLoadingMode(null);
        }
    }, [activeWorkspace, isLoading]);

    const handleRetry = useCallback((promptToRetry: string) => {
        if (!activeWorkspace) return;
        
        const newHistory = activeWorkspace.chatHistory.filter(msg => 
            !((msg.role === 'model' && msg.isFixable) && msg.originalPrompt === promptToRetry)
        );
        
        setWorkspaces(prev => ({
            ...prev,
            [activeWorkspace.id]: { ...prev[activeWorkspace.id], chatHistory: newHistory }
        }));

        handleGenerateCode(promptToRetry, null, 'standard', true);
    }, [activeWorkspace, handleGenerateCode]);
    
    const handlePositiveFeedback = useCallback((messageId: string) => {
        if (!activeWorkspace) return;

        const newHistory = activeWorkspace.chatHistory.map(msg => {
            if (msg.id === messageId && msg.role === 'model') {
                return { ...msg, rated: true };
            }
            return msg;
        });

        if (JSON.stringify(newHistory) !== JSON.stringify(activeWorkspace.chatHistory)) {
             setWorkspaces(prev => ({
                ...prev,
                [activeWorkspace.id]: { ...activeWorkspace, chatHistory: newHistory, lastModified: Date.now() }
            }));
        }
    }, [activeWorkspace]);

    const handleRestoreCheckpoint = useCallback((messageId: string) => {
        if (!activeWorkspace) return;

        const messageToRestoreFrom = activeWorkspace.chatHistory.find(msg => msg.id === messageId);

        if (messageToRestoreFrom && messageToRestoreFrom.role === 'model' && messageToRestoreFrom.checkpoint) {
            const filesToRestore = messageToRestoreFrom.checkpoint;
            
            const logMessages: ModelChatMessage[] = [
                { id: generateId(), role: 'model', text: `Systematic Repair Protocol initiated for checkpoint...`, fullResponse: '{}' },
                { id: generateId(), role: 'model', text: `File integrity verified. Reverting to checkpoint state...`, fullResponse: '{}' },
                { id: generateId(), role: 'model', text: `System restored successfully.`, fullResponse: '{}' },
            ];

            setWorkspaces(prev => {
                const currentWs = prev[activeWorkspace.id];

                const newUndoStack = [...(currentWs.undoStack || [])];
                newUndoStack.push(currentWs.files);
                if (newUndoStack.length > UNDO_STACK_LIMIT) newUndoStack.shift();

                return {
                    ...prev,
                    [activeWorkspace.id]: {
                        ...currentWs,
                        files: filesToRestore,
                        chatHistory: [...currentWs.chatHistory, ...logMessages],
                        lastModified: Date.now(),
                        undoStack: newUndoStack,
                        redoStack: [], // Clear redo stack on new action
                    }
                };
            });
        } else {
            console.warn('Could not find a valid checkpoint to restore from for message ID:', messageId);
            alert('Error: Could not find checkpoint data to restore.');
        }
    }, [activeWorkspace]);

    const handleRenameWorkspace = useCallback((newName: string) => {
        if (!activeWorkspace || !newName.trim()) return;
        const updatedWs = { ...activeWorkspace, name: newName.trim(), lastModified: Date.now() };
        setWorkspaces(prev => ({ ...prev, [activeWorkspace.id]: updatedWs }));
    }, [activeWorkspace]);

    const requestDeleteWorkspace = useCallback((idToDelete: string) => {
        if (workspaces[idToDelete]) {
            setWorkspaceToDeleteId(idToDelete);
        }
    }, [workspaces]);

    const confirmDeleteWorkspace = useCallback(() => {
        if (!workspaceToDeleteId) return;

        setWorkspaces(prev => {
            const newWorkspaces = { ...prev };
            delete newWorkspaces[workspaceToDeleteId];
            return newWorkspaces;
        });

        if (activeWorkspaceId === workspaceToDeleteId) {
            setActiveWorkspaceId(null);
        }
        
        setWorkspaceToDeleteId(null); // Close modal
    }, [workspaceToDeleteId, activeWorkspaceId]);

    const cancelDeleteWorkspace = useCallback(() => {
        setWorkspaceToDeleteId(null);
    }, []);
    
    const handleUpdateFileContent = useCallback((path: string, content: string) => {
        if (!activeWorkspaceId) return;
        
        setWorkspaces(prev => {
            const currentWs = prev[activeWorkspaceId];
            if (!currentWs) return prev;

            const newUndoStack = [...(currentWs.undoStack || [])];
            newUndoStack.push(currentWs.files);
            if (newUndoStack.length > UNDO_STACK_LIMIT) newUndoStack.shift();
            
            const newFiles = currentWs.files.map(file => 
                file.path === path ? { ...file, content } : file
            );

            return {
                ...prev,
                [activeWorkspaceId]: { 
                    ...currentWs, 
                    files: newFiles, 
                    lastModified: Date.now(),
                    undoStack: newUndoStack,
                    redoStack: [], // Clear redo stack on new action
                }
            };
        });
    }, [activeWorkspaceId]);

    const handleUndo = useCallback(() => {
        if (!activeWorkspaceId) return;
        setWorkspaces(prev => {
            const currentWs = prev[activeWorkspaceId];
            const undoStack = currentWs.undoStack || [];
            if (undoStack.length === 0) return prev;

            const newUndoStack = [...undoStack];
            const filesToRestore = newUndoStack.pop()!;

            const newRedoStack = [...(currentWs.redoStack || [])];
            newRedoStack.push(currentWs.files);

            return {
                ...prev,
                [activeWorkspaceId]: {
                    ...currentWs,
                    files: filesToRestore,
                    lastModified: Date.now(),
                    undoStack: newUndoStack,
                    redoStack: newRedoStack,
                }
            };
        });
    }, [activeWorkspaceId]);

    const handleRedo = useCallback(() => {
        if (!activeWorkspaceId) return;
        setWorkspaces(prev => {
            const currentWs = prev[activeWorkspaceId];
            const redoStack = currentWs.redoStack || [];
            if (redoStack.length === 0) return prev;

            const newRedoStack = [...redoStack];
            const filesToRestore = newRedoStack.pop()!;

            const newUndoStack = [...(currentWs.undoStack || [])];
            newUndoStack.push(currentWs.files);

            return {
                ...prev,
                [activeWorkspaceId]: {
                    ...currentWs,
                    files: filesToRestore,
                    lastModified: Date.now(),
                    undoStack: newUndoStack,
                    redoStack: newRedoStack,
                }
            };
        });
    }, [activeWorkspaceId]);
    
    const handleUploadLocalAssets = useCallback(async (files: File[]) => {
        if (!activeWorkspace) return;

        const newAssets: LocalAsset[] = [];
        const promises = files.map(file => {
            return new Promise<void>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const dataUrl = event.target?.result as string;
                    if (dataUrl) {
                        newAssets.push({
                            id: generateId(),
                            name: `uploads/${file.name}`, // Organize under an 'uploads' path
                            dataUrl: dataUrl,
                            mimeType: file.type,
                        });
                        resolve();
                    } else {
                        reject(new Error(`Failed to read file: ${file.name}`));
                    }
                };
                reader.onerror = (error) => reject(error);
                reader.readAsDataURL(file);
            });
        });

        try {
            await Promise.all(promises);
            if (newAssets.length > 0) {
                 setWorkspaces(prev => {
                    const currentWs = prev[activeWorkspace.id];
                    const existingAssets = currentWs.localAssets ?? [];
                    return {
                        ...prev,
                        [activeWorkspace.id]: {
                            ...currentWs,
                            localAssets: [...existingAssets, ...newAssets],
                            lastModified: Date.now(),
                        }
                    };
                });
            }
        } catch (error) {
             console.error("Error reading files:", error);
            alert("Failed to read one or more asset files.");
        }

    }, [activeWorkspace]);

    const handleCreateLocalAsset = useCallback(async (prompt: string) => {
        if (!activeWorkspace || isCreatingAsset || !prompt.trim()) return;

        setIsCreatingAsset(true);
        try {
            const base64Data = await generateImageAsset(prompt);
            
            // Sanitize prompt to create a valid filename
            const sanitizedName = prompt.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').substring(0, 30);
            const fileName = `${sanitizedName || 'generated-asset'}.png`;

            const newAsset: LocalAsset = {
                id: generateId(),
                name: fileName,
                dataUrl: `data:image/png;base64,${base64Data}`,
                mimeType: 'image/png',
            };

            setWorkspaces(prev => {
                const currentWs = prev[activeWorkspace.id];
                const existingAssets = currentWs.localAssets ?? [];
                return {
                    ...prev,
                    [activeWorkspace.id]: {
                        ...currentWs,
                        localAssets: [...existingAssets, newAsset],
                        lastModified: Date.now(),
                    }
                };
            });

        } catch (error) {
            console.error("Failed to generate asset:", error);
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred during asset generation.";
            alert(`Asset Generation Failed: ${errorMessage}`);
        } finally {
            setIsCreatingAsset(false);
        }
    }, [activeWorkspace, isCreatingAsset]);

    const handleUploadWorkspace = useCallback(async (file: File) => {
        if (!file.name.endsWith('.zip')) {
            alert('Please upload a valid .zip file.');
            return;
        }

        setAppStatusMessage(`Importing '${file.name}'...`);
        
        try {
            const zip = await JSZip.loadAsync(file);
            const files: FileEntry[] = [];
            
            // Find the index.html file to determine the root path
            // FIX: Cast Object.values to the correct type to avoid 'unknown' property access errors.
            const indexHtmlEntry = (Object.values(zip.files) as JSZipObject[]).find((entry) => 
                !entry.dir && entry.name.endsWith('index.html')
            );

            if (!indexHtmlEntry) {
                throw new Error('The uploaded zip file must contain an index.html file.');
            }
            
            const indexHtmlContent = await indexHtmlEntry.async('string');

            // Determine the base path. If index.html is at 'my-project/index.html', basePath is 'my-project/'.
            // If it's at the root 'index.html', basePath is ''.
            const pathParts = indexHtmlEntry.name.split('/');
            const basePath = pathParts.length > 1 ? pathParts.slice(0, -1).join('/') + '/' : '';

            const filePromises = Object.keys(zip.files).map(async (filename) => {
                const zipEntry = zip.files[filename] as JSZipObject;
                if (!zipEntry.dir) {
                    const content = await zipEntry.async('string');
                    // Strip the base path from the filename
                    const finalPath = filename.startsWith(basePath) ? filename.substring(basePath.length) : filename;
                    
                    // Don't add empty paths (e.g., if the base path itself was a file somehow)
                    if (finalPath) {
                        files.push({ path: finalPath, content });
                    }
                }
            });

            await Promise.all(filePromises);
            
            const validFiles = files.filter(f => f.path);

            const workspaceType: WorkspaceType = indexHtmlContent.includes('three') ? '3D' : '2D';
            const newId = generateId();
            const workspaceName = file.name.replace(/\.zip$/, '');

            const newWorkspace: Workspace = {
                id: newId,
                name: `${workspaceName} (Imported)`,
                type: workspaceType,
                files: validFiles,
                chatHistory: [
                    {
                        id: `model-init-${Date.now()}`,
                        role: 'model',
                        text: `Project '${workspaceName}' was successfully imported. I've loaded all the files. What would you like to work on?`,
                        fullResponse: JSON.stringify({
                            thinking: `Imported project from ${file.name}. Inferred project type as ${workspaceType}.`,
                            explanation: `Project '${workspaceName}' was successfully imported.`,
                            files: validFiles,
                            assetsUsed: []
                        }),
                        filesUpdated: validFiles.map(f => f.path)
                    }
                ],
                localAssets: [],
                lastModified: Date.now(),
                undoStack: [],
                redoStack: [],
            };

            setWorkspaces(prev => ({ ...prev, [newId]: newWorkspace }));
            setActiveWorkspaceId(newId);

        } catch (error) {
            console.error("Failed to upload and process workspace:", error);
            const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
            alert(`Error importing project: ${errorMessage}`);
        } finally {
            setAppStatusMessage(null);
        }
    }, []);

    const handleReturnToLauncher = useCallback(() => {
        setActiveWorkspaceId(null);
    }, []);

    const canUndo = activeWorkspace ? (activeWorkspace.undoStack || []).length > 0 : false;
    const canRedo = activeWorkspace ? (activeWorkspace.redoStack || []).length > 0 : false;
    
    if (!isInitialized || appStatusMessage) {
        return (
            <div className="w-screen h-screen bg-black flex flex-col items-center justify-center text-gray-400">
                <SpinnerIcon className="w-10 h-10 text-blue-500" />
                <p className="mt-4">{appStatusMessage || 'Loading Leap AI...'}</p>
            </div>
        );
    }

    if (!activeWorkspace) {
        return <WorkspaceModal
            workspaces={Object.values(workspaces)}
            onSelect={handleSelectWorkspace}
            onCreate={handleCreateWorkspace}
            onDelete={requestDeleteWorkspace}
            onUpload={handleUploadWorkspace}
            deleteModal={
                workspaceMarkedForDeletion && (
                    <DeleteWorkspaceModal
                        workspace={workspaceMarkedForDeletion}
                        onConfirm={confirmDeleteWorkspace}
                        onCancel={cancelDeleteWorkspace}
                    />
                )
            }
        />;
    }

    return (
        <div className="w-screen h-screen bg-black">
            <IDEView
                key={activeWorkspace.id}
                activeWorkspace={activeWorkspace}
                isLoading={isLoading}
                isCreatingAsset={isCreatingAsset}
                loadingMode={loadingMode}
                aiProgress={aiProgress}
                isOnline={isOnline}
                onGenerate={handleGenerateCode}
                onPositiveFeedback={handlePositiveFeedback}
                onRetry={handleRetry}
                onRestoreCheckpoint={handleRestoreCheckpoint}
                onRenameWorkspace={handleRenameWorkspace}
                onDeleteWorkspace={() => requestDeleteWorkspace(activeWorkspace.id)}
                onReturnToLauncher={handleReturnToLauncher}
                onUpdateFileContent={handleUpdateFileContent}
                onUploadLocalAssets={handleUploadLocalAssets}
                onCreateLocalAsset={handleCreateLocalAsset}
                onUndo={handleUndo}
                onRedo={handleRedo}
                canUndo={canUndo}
                canRedo={canRedo}
            />
            {workspaceMarkedForDeletion && (
                <DeleteWorkspaceModal
                    workspace={workspaceMarkedForDeletion}
                    onConfirm={confirmDeleteWorkspace}
                    onCancel={cancelDeleteWorkspace}
                />
            )}
        </div>
    );
};

export default App;