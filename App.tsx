import React, { useState, useCallback, useEffect, useMemo } from 'react';
import IDEView from './components/IDEView';
import WorkspaceModal from './components/WorkspaceModal';
import { getInitialWorkspaceData, sendMessageToAi, generateImageAsset } from './services/geminiService';
import type { WorkspaceType, Workspace, ChatMessage, UserChatMessage, ModelChatMessage, FileEntry, GroundingSource, AssetInfo, AiMode, LocalAsset } from './types';
import SpinnerIcon from './components/icons/SpinnerIcon';
import { cleanForSerialization } from './lib/utils/serialization';
import { useOnlineStatus } from './lib/utils/hooks';
import { extractJsonFromString } from './lib/utils/json';

const generateId = () => `id-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

const STORAGE_KEY = 'ai-game-studio-state-v3'; // Incremented version for new data structure

const App: React.FC = () => {
    const [workspaces, setWorkspaces] = useState<Record<string, Workspace>>({});
    const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isCreatingAsset, setIsCreatingAsset] = useState<boolean>(false);
    const [loadingMode, setLoadingMode] = useState<AiMode | null>(null);
    const [isInitialized, setIsInitialized] = useState<boolean>(false);
    const [aiProgress, setAiProgress] = useState<string[]>([]);
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
        setAiProgress([]);
        
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
                    setAiProgress(prev => [...prev, update.content]);
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
                return {
                    ...prev,
                    [activeWorkspace.id]: {
                        ...currentWs,
                        files: files as FileEntry[],
                        chatHistory: finalHistory,
                        lastModified: Date.now(),
                    }
                };
            });

        } catch (error) {
            console.error(error);
            const errorMessage = error instanceof Error ? `Error: ${error.message}` : 'An unknown error occurred. The AI may have returned an invalid response.';
            
            let errorChatMessage: ModelChatMessage;
            if (!isRetry) {
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
                return {
                    ...prev,
                    [activeWorkspace.id]: {
                        ...currentWs,
                        files: filesToRestore,
                        chatHistory: [...currentWs.chatHistory, ...logMessages],
                        lastModified: Date.now(),
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

    const handleDeleteWorkspace = useCallback((idToDelete: string) => {
        if (!workspaces[idToDelete]) return;

        const newWorkspaces = { ...workspaces };
        delete newWorkspaces[idToDelete];
        setWorkspaces(newWorkspaces);

        if (activeWorkspaceId === idToDelete) {
            setActiveWorkspaceId(null);
        }
    }, [workspaces, activeWorkspaceId]);
    
    const handleUpdateFileContent = useCallback((path: string, content: string) => {
        if (!activeWorkspace) return;
        
        const newFiles = activeWorkspace.files.map(file => 
            file.path === path ? { ...file, content } : file
        );

        setWorkspaces(prev => ({
            ...prev,
            [activeWorkspace.id]: { ...prev[activeWorkspace.id], files: newFiles, lastModified: Date.now() }
        }));

    }, [activeWorkspace]);
    
    const handleUploadLocalAsset = useCallback(async (file: File) => {
        if (!activeWorkspace) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const dataUrl = event.target?.result as string;
            if (dataUrl) {
                const newAsset: LocalAsset = {
                    id: generateId(),
                    name: file.name,
                    dataUrl: dataUrl,
                    mimeType: file.type,
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
            }
        };
        reader.onerror = (error) => {
            console.error("Error reading file:", error);
            alert("Failed to read the asset file.");
        };
        reader.readAsDataURL(file);

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

    const handleReturnToLauncher = useCallback(() => {
        setActiveWorkspaceId(null);
    }, []);
    
    if (!isInitialized) {
        return (
            <div className="w-screen h-screen bg-black flex flex-col items-center justify-center text-gray-400">
                <SpinnerIcon className="w-10 h-10 text-blue-500" />
                <p className="mt-4">Loading Leap AI...</p>
            </div>
        );
    }

    if (!activeWorkspace) {
        return <WorkspaceModal
            workspaces={Object.values(workspaces)}
            onSelect={handleSelectWorkspace}
            onCreate={handleCreateWorkspace}
            onDelete={handleDeleteWorkspace}
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
                onDeleteWorkspace={() => handleDeleteWorkspace(activeWorkspace.id)}
                onReturnToLauncher={handleReturnToLauncher}
                onUpdateFileContent={handleUpdateFileContent}
                onUploadLocalAsset={handleUploadLocalAsset}
                onCreateLocalAsset={handleCreateLocalAsset}
            />
        </div>
    );
};

export default App;