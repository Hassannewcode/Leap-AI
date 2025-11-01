
import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import JSZip from 'jszip';
import AIIcon from './icons/AIIcon';
import PlayIcon from './icons/PlayIcon';
import GamePreview from './GamePreview';
import ChatPanel from './ChatPanel';
import { Workspace, LogEntry, SelectedObject, AiMode, AssetInfo, DebuggerIncident } from '../types';
import RefreshIcon from './icons/RefreshIcon';
import FullscreenIcon from './icons/FullscreenIcon';
import DownloadIcon from './icons/DownloadIcon';
import SpinnerIcon from './icons/SpinnerIcon';
import PencilIcon from './icons/PencilIcon';
import ArrowLeftIcon from './icons/ArrowLeftIcon';
import FileExplorer from './FileExplorer';
import PanelLeftIcon from './icons/PanelLeftIcon';
import Console from './Console';
import TerminalIcon from './icons/TerminalIcon';
import MousePointerIcon from './icons/MousePointerIcon';
import { ResizablePanelGroup, Panel, ResizeHandle } from './ResizablePanels';
import ImagesIcon from './icons/ImagesIcon';
import AssetLibrary from './AssetLibrary';
import DebuggerPanel from './DebuggerPanel';
import BugIcon from './icons/BugIcon';
import { cleanForSerialization } from '../lib/utils/serialization';
import DebuggerWidget from './DebuggerWidget';
import ConfirmationModal from './ConfirmationModal';
import WifiIcon from './icons/WifiIcon';
import WifiOffIcon from './icons/WifiOffIcon';
import UndoIcon from './icons/UndoIcon';
import RedoIcon from './icons/RedoIcon';
import ApiKeyModal from './ApiKeyModal';
import { generateInGameText } from '../services/geminiService';


declare global {
    interface Window {
        CodeMirror: any;
    }
}

interface IDEViewProps {
    activeWorkspace: Workspace;
    isLoading: boolean;
    isCreatingAsset: boolean;
    loadingMode: AiMode | null;
    aiProgress: string[];
    isOnline: boolean;
    onGenerate: (prompt: string, image: { data: string; mimeType: string } | null, mode: AiMode) => void;
    onPositiveFeedback: (messageId: string) => void;
    onRetry: (prompt: string) => void;
    onRestoreCheckpoint: (messageId: string) => void;
    onRenameWorkspace: (newName: string) => void;
    onDeleteWorkspace: () => void;
    onReturnToLauncher: () => void;
    onUpdateFileContent: (path: string, content: string) => void;
    onUploadLocalAsset: (file: File) => void;
    onCreateLocalAsset: (prompt: string) => void;
    onUndo: () => void;
    onRedo: () => void;
    canUndo: boolean;
    canRedo: boolean;
}

interface ConfirmationRequest {
    action: 'quarantine' | 'allow';
    incident: DebuggerIncident;
    onConfirm: () => void;
}

interface PendingAiRequest {
    requestId: string;
    prompt: string;
}

const IDEView: React.FC<IDEViewProps> = ({ activeWorkspace, isLoading, isCreatingAsset, loadingMode, aiProgress, isOnline, onGenerate, onPositiveFeedback, onRetry, onRestoreCheckpoint, onRenameWorkspace, onDeleteWorkspace, onReturnToLauncher, onUpdateFileContent, onUploadLocalAsset, onCreateLocalAsset, onUndo, onRedo, canUndo, canRedo }) => {
    const [isChatVisible, setChatVisible] = useState(true);
    const [isCodePanelVisible, setCodePanelVisible] = useState(true);
    const [isBottomPanelVisible, setIsBottomPanelVisible] = useState(true);
    const [activeBottomTab, setActiveBottomTab] = useState<'console' | 'debugger'>('console');
    const [refreshKey, setRefreshKey] = useState(0);
    const previewContainerRef = useRef<HTMLDivElement>(null);
    
    const editorContainerRef = useRef<HTMLDivElement>(null);
    const editorRef = useRef<any>(null); // To hold the CodeMirror instance

    const [activePath, setActivePath] = useState('scripts/game.js');
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [incidents, setIncidents] = useState<DebuggerIncident[]>([]);
    const [quarantineRequest, setQuarantineRequest] = useState<DebuggerIncident | null>(null);
    const [confirmationRequest, setConfirmationRequest] = useState<ConfirmationRequest | null>(null);

    const [isEditingName, setIsEditingName] = useState(false);
    const [workspaceName, setWorkspaceName] = useState(activeWorkspace.name);
    const nameInputRef = useRef<HTMLInputElement>(null);
    
    const [isVisualEditMode, setIsVisualEditMode] = useState(false);
    const [selectedObject, setSelectedObject] = useState<SelectedObject>(null);
    const [isAssetLibraryOpen, setIsAssetLibraryOpen] = useState(false);
    
    // --- In-Game AI State ---
    const [userApiKey, setUserApiKey] = useState<string | null>(localStorage.getItem('user-gemini-api-key'));
    const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
    const [pendingAiRequest, setPendingAiRequest] = useState<PendingAiRequest | null>(null);

    const errorCount = useMemo(() => logs.filter(log => log.type === 'error').length, [logs]);
    const incidentStats = useMemo(() => {
        const count = incidents.length;
        let highestThreatLevel: 'trusted' | 'untrusted' | null = null;
        if (incidents.some(i => i.threatLevel === 'untrusted')) {
            highestThreatLevel = 'untrusted';
        } else if (count > 0) {
            highestThreatLevel = 'trusted';
        }
        return { count, highestThreatLevel };
    }, [incidents]);

    // --- Loading Indicator State ---
    const [elapsedTime, setElapsedTime] = useState(0);
    useEffect(() => {
        let timer: number;
        if (isLoading) {
            setElapsedTime(0);
            timer = window.setInterval(() => {
                setElapsedTime(prev => prev + 1);
            }, 1000);
        }
        return () => clearInterval(timer);
    }, [isLoading]);
    // --- End Loading Indicator Logic ---

    const activeFile = useMemo(() => {
        const file = activeWorkspace.files.find(f => f.path === activePath);
        // Fallback to a common default or the first file if the active one isn't found
        return file || activeWorkspace.files.find(f => f.path === 'scripts/game.js') || activeWorkspace.files.find(f => f.path === 'index.html') || activeWorkspace.files[0];
    }, [activePath, activeWorkspace.files]);
    
    const allUsedAssets = useMemo(() => {
        const assets: AssetInfo[] = [];
        const seenUrls = new Set<string>();
        activeWorkspace.chatHistory.forEach(msg => {
            if (msg.role === 'model' && msg.assetsUsed) {
                msg.assetsUsed.forEach(asset => {
                    if (!seenUrls.has(asset.url)) {
                        assets.push(asset);
                        seenUrls.add(asset.url);
                    }
                });
            }
        });
        return assets;
    }, [activeWorkspace.chatHistory]);

    useEffect(() => {
        // Ensure activePath is valid, reset if not
        if (!activeWorkspace.files.some(f => f.path === activePath)) {
            setActivePath(activeWorkspace.files.find(f => f.path === 'scripts/game.js')?.path || 'index.html');
        }
    }, [activeWorkspace.files, activePath]);
    
    // Main message bus listener for iframe communication
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            const { type, payload } = event.data;
            switch(type) {
                case 'console':
                    if (payload) {
                        const { type: logType, message } = payload;
                        if (typeof logType === 'string' && typeof message === 'string') {
                            setLogs(prevLogs => [...prevLogs.slice(-200), { type: logType, message }]);
                        }
                    }
                    break;
                case 'visual-editor-select':
                    if (payload) {
                        setSelectedObject(payload);
                    }
                    break;
                case 'debugger-incident':
                    if (payload) {
                        setIncidents(prev => [...prev.slice(-200), payload]);
                        // If debugger is closed, open it to show the new incident
                        if (!isBottomPanelVisible) {
                            setIsBottomPanelVisible(true);
                        }
                        setActiveBottomTab('debugger');
                    }
                    break;
                case 'ai-generate-text':
                    if (payload && payload.prompt && payload.requestId) {
                         handleInGameAiRequest(payload.prompt, payload.requestId);
                    }
                    break;
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [isBottomPanelVisible, userApiKey]); // Rerun if userApiKey changes

    // Keyboard shortcuts for undo/redo
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            const isEditingText = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable || target.classList.contains('CodeMirror-code');

            if (e.ctrlKey || e.metaKey) { // Handle Ctrl or Cmd key
                if (e.key.toLowerCase() === 'z' && !isEditingText) {
                    e.preventDefault();
                    if (e.shiftKey) { // Redo for Ctrl+Shift+Z
                        if (canRedo) onRedo();
                    } else { // Undo for Ctrl+Z
                        if (canUndo) onUndo();
                    }
                } else if (e.key.toLowerCase() === 'y' && !isEditingText) { // Standard redo
                    e.preventDefault();
                    if (canRedo) onRedo();
                } else if (e.key.toLowerCase() === 'x' && !isEditingText) { // Custom redo on Ctrl+X, only when not editing text
                    e.preventDefault();
                    if (canRedo) onRedo();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [canUndo, canRedo, onUndo, onRedo]);

    // --- CodeMirror Setup ---
    useEffect(() => {
        if (editorContainerRef.current && !editorRef.current) {
            const editor = window.CodeMirror(editorContainerRef.current, {
                value: activeFile?.content || '',
                lineNumbers: true,
                theme: 'darcula',
                mode: 'javascript', // Default mode
                lineWrapping: true,
                autoCloseBrackets: true,
                matchBrackets: true,
                styleActiveLine: true,
                extraKeys: {
                    "Ctrl-/": "toggleComment",
                    "Cmd-/": "toggleComment",
                },
            });
            editorRef.current = editor;

            editor.on('change', (instance: any) => {
                const currentValue = instance.getValue();
                if (currentValue !== activeFile?.content) {
                    onUpdateFileContent(activeFile!.path, currentValue);
                }
            });
        }
        
        return () => {
            if (editorRef.current && typeof editorRef.current.toTextArea === 'function') {
                // This is CodeMirror's internal cleanup method
                editorRef.current.toTextArea();
                editorRef.current = null;
            }
        };
    }, []); // Initialize only once

    // Effect to update editor content & mode when the active file changes
    useEffect(() => {
        if (editorRef.current && activeFile) {
            const editor = editorRef.current;
            const currentVal = editor.getValue();
            
            // Set language mode based on file extension
            const extension = activeFile.path.split('.').pop() || 'txt';
            // FIX: Corrected the type for the CodeMirror mode map to allow for 'typescript' and optional 'jsx' properties.
            const modeMap: { [key: string]: string | { name: string; jsx?: boolean; typescript?: boolean; } } = {
                js: 'javascript',
                jsx: { name: "javascript", jsx: true },
                ts: { name: "javascript", typescript: true },
                tsx: { name: "javascript", typescript: true, jsx: true },
                json: 'application/json',
                html: 'htmlmixed',
                css: 'css',
                svg: 'xml',
            };
            const newMode = modeMap[extension] || 'text/plain';
            editor.setOption('mode', newMode);
            
            // Only set value if it's different to prevent cursor jumps and change event loops
            if (currentVal !== activeFile.content) {
                editor.setValue(activeFile.content || '');
            }
        }
    }, [activeFile]);
    // --- End CodeMirror Setup ---

    const handleClearConsole = useCallback(() => {
        setLogs([]);
    }, []);
    
    const handleClearIncidents = useCallback(() => {
        setIncidents([]);
    }, []);

    const handleAutoFixRequest = useCallback((errorMessage: string) => {
        if (isLoading) return;
        const fixPrompt = `[LEAP_AI_FIX_REQUEST] My game crashed with the following error. Please analyze the code and fix it.\n\nError:\n${errorMessage}`;
        onGenerate(fixPrompt, null, 'standard');
    }, [onGenerate, isLoading]);
    
    const handleAutoFixAllErrors = useCallback((errors: string[]) => {
        if (isLoading || errors.length === 0) return;
        const formattedErrors = errors.map((e, i) => `Error ${i + 1}:\n${e}`).join('\n\n');
        const fixPrompt = `[LEAP_AI_FIX_REQUEST] My game has multiple errors. Please analyze the code and fix all of them.\n\nHere are the errors:\n${formattedErrors}`;
        onGenerate(fixPrompt, null, 'standard');
    }, [onGenerate, isLoading]);
    
     const handleAllowIncident = useCallback((incidentId: string) => {
        setIncidents(prev => prev.filter(i => i.id !== incidentId));
    }, []);

    const handleQuarantineIncident = useCallback((incident: DebuggerIncident) => {
        setQuarantineRequest(incident);
        // Also remove it from the list after quarantine is requested
        setTimeout(() => handleAllowIncident(incident.id), 300);
    }, [handleAllowIncident]);

    const handleRequestQuarantine = useCallback((incident: DebuggerIncident) => {
        setConfirmationRequest({
            action: 'quarantine',
            incident,
            onConfirm: () => handleQuarantineIncident(incident),
        });
    }, [handleQuarantineIncident]);

    const handleRequestAllow = useCallback((incident: DebuggerIncident) => {
        setConfirmationRequest({
            action: 'allow',
            incident,
            onConfirm: () => handleAllowIncident(incident.id),
        });
    }, [handleAllowIncident]);
    
     const handleAutoFixIncident = useCallback((incident: DebuggerIncident) => {
        if (isLoading) return;
        const cleanContext = cleanForSerialization(incident.evidence.context || {});
        const contextString = JSON.stringify(cleanContext, null, 2);
        const fixPrompt = `[LEAP_AI_FIX_REQUEST] The LeapGuard Autonomous Runtime Analysis System reported the following incident. Please analyze the code and fix the root cause.\n\nThreat Level: ${incident.threatLevel}\nSuspect: ${incident.suspect}\nMessage: ${incident.message}\nEvidence: ${contextString}\nStack Trace:\n${incident.evidence.stack}`;
        onGenerate(fixPrompt, null, 'standard');
        // Also remove it from the list after the fix is requested
        setTimeout(() => handleAllowIncident(incident.id), 300);
    }, [onGenerate, isLoading, handleAllowIncident]);

    const sendToIframe = useCallback((type: string, payload: any) => {
        const iframe = previewContainerRef.current?.querySelector('iframe');
        if (iframe && iframe.contentWindow) {
            iframe.contentWindow.postMessage({ type, payload }, '*');
        }
    }, []);

    const handleInGameAiRequest = useCallback(async (prompt: string, requestId: string) => {
        if (!userApiKey) {
            setPendingAiRequest({ prompt, requestId });
            setIsApiKeyModalOpen(true);
            return;
        }

        try {
            const result = await generateInGameText(prompt, userApiKey);
            sendToIframe('ai-text-response', { requestId, success: true, text: result });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
            console.error("In-game AI generation failed:", error);
            sendToIframe('ai-text-response', { requestId, success: false, error: errorMessage });
        }
    }, [userApiKey, sendToIframe]);

    const handleSaveApiKey = (key: string) => {
        setUserApiKey(key);
        localStorage.setItem('user-gemini-api-key', key);
        setIsApiKeyModalOpen(false);
        if (pendingAiRequest) {
            handleInGameAiRequest(pendingAiRequest.prompt, pendingAiRequest.requestId);
            setPendingAiRequest(null);
        }
    };
    
    const handleCancelApiKey = () => {
        if (pendingAiRequest) {
            sendToIframe('ai-text-response', { requestId: pendingAiRequest.requestId, success: false, error: "API key entry was cancelled." });
            setPendingAiRequest(null);
        }
        setIsApiKeyModalOpen(false);
    };

    useEffect(() => {
        if (isEditingName && nameInputRef.current) {
            nameInputRef.current.focus();
            nameInputRef.current.select();
        }
    }, [isEditingName]);
    
    useEffect(() => {
        // When visual edit mode is turned off, deselect any object
        if (!isVisualEditMode) {
            setSelectedObject(null);
        }
    }, [isVisualEditMode]);

    const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setWorkspaceName(e.target.value);
    }
    
    const handleNameBlur = () => {
        setIsEditingName(false);
        if (workspaceName.trim() && workspaceName !== activeWorkspace.name) {
            onRenameWorkspace(workspaceName);
        } else {
            setWorkspaceName(activeWorkspace.name);
        }
    }
    
    const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        else if (e.key === 'Escape') {
            setWorkspaceName(activeWorkspace.name);
            setIsEditingName(false);
        }
    }

    const handleRefresh = () => {
        setLogs([]);
        setIncidents([]);
        setRefreshKey(prevKey => prevKey + 1);
    }

    const handleToggleFullscreen = useCallback(() => {
        const previewElement = previewContainerRef.current;
    
        if (!document.fullscreenElement) {
            if (previewElement) {
                previewElement.requestFullscreen().catch(err => {
                    console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
                });
            }
        } else if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }, []);

    const handleDownload = async () => {
        const zip = new JSZip();
        activeWorkspace.files.forEach(file => {
            zip.file(file.path, file.content);
        });

        const packageJson = {
            name: activeWorkspace.name.toLowerCase().replace(/\s+/g, '-'),
            version: "1.0.0",
            description: `A ${activeWorkspace.type} game generated by Leap AI.`,
            scripts: { "start": "serve ." },
            devDependencies: { "serve": "^14.2.1" }
        };
        zip.file("package.json", JSON.stringify(packageJson, null, 2));
        
        const readmeContent = `# ${activeWorkspace.name}\n\nThis project was generated using Leap AI.\n\n## Local Development\n\n1. Ensure Node.js and npm are installed.\n2. Install dependencies: \`npm install\`\n3. Start the server: \`npm start\`\n`;
        zip.file("README.md", readmeContent);

        const blob = await zip.generateAsync({ type: "blob" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `${activeWorkspace.name.toLowerCase().replace(/\s+/g, '-')}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleWidgetClick = () => {
        setIsBottomPanelVisible(true);
        setActiveBottomTab('debugger');
    };

    return (
        <div className="flex h-screen w-screen bg-black text-gray-300 font-sans">
            {isChatVisible && (
                <div className={`bg-[#121212] flex flex-col flex-shrink-0 border-r border-gray-800/70`}>
                    <ChatPanel
                        history={activeWorkspace.chatHistory}
                        onSend={(prompt, context) => onGenerate(prompt, context.image, context.mode)}
                        isLoading={isLoading}
                        onDeleteWorkspace={onDeleteWorkspace}
                        onPositiveFeedback={onPositiveFeedback}
                        onRetry={onRetry}
                        onRestoreCheckpoint={onRestoreCheckpoint}
                        selectedObject={selectedObject}
                        onDeselectObject={() => setSelectedObject(null)}
                     />
                </div>
            )}
             <div className="flex-1 flex flex-col overflow-hidden">
                <header className="flex-shrink-0 bg-[#121212] border-b border-gray-800/70 flex justify-between items-center px-2 h-11">
                     <div className="flex items-center gap-1">
                        <button onClick={onReturnToLauncher} className="p-1.5 text-gray-400 rounded-md hover:text-white hover:bg-white/10" aria-label="Back to Launcher"><ArrowLeftIcon className="w-5 h-5" /></button>
                        <button onClick={() => setChatVisible(!isChatVisible)} className="p-1.5 text-gray-400 rounded-md hover:text-white hover:bg-white/10" aria-label={isChatVisible ? 'Hide Chat' : 'Show Chat'}><AIIcon className={`w-5 h-5 transition-colors ${isChatVisible ? 'text-blue-500' : 'text-gray-400'}`} /></button>
                        <button onClick={() => setCodePanelVisible(!isCodePanelVisible)} className="p-1.5 text-gray-400 rounded-md hover:text-white hover:bg-white/10" aria-label={isCodePanelVisible ? 'Hide Code Panel' : 'Show Code Panel'}><PanelLeftIcon className={`w-5 h-5 transition-colors ${isCodePanelVisible ? 'text-blue-500' : 'text-gray-400'}`} /></button>
                        <button onClick={() => setIsAssetLibraryOpen(true)} className="p-1.5 text-gray-400 rounded-md hover:text-white hover:bg-white/10" aria-label="Open Asset Library"><ImagesIcon className="w-5 h-5" /></button>
                        <div className="h-5 w-px bg-gray-800 mx-1"></div>
                        <button onClick={onUndo} disabled={!canUndo} className="p-1.5 text-gray-400 rounded-md hover:text-white hover:bg-white/10 disabled:text-gray-600 disabled:hover:bg-transparent disabled:cursor-not-allowed" aria-label="Undo" title="Undo (Ctrl+Z)"><UndoIcon className="w-5 h-5" /></button>
                        <button onClick={onRedo} disabled={!canRedo} className="p-1.5 text-gray-400 rounded-md hover:text-white hover:bg-white/10 disabled:text-gray-600 disabled:hover:bg-transparent disabled:cursor-not-allowed" aria-label="Redo" title="Redo (Ctrl+Y / Ctrl+X)"><RedoIcon className="w-5 h-5" /></button>
                        <div className="h-5 w-px bg-gray-800 mx-1"></div>
                        <div className="flex items-center gap-3">
                             {isEditingName ? (
                                <input ref={nameInputRef} type="text" value={workspaceName} onChange={handleNameChange} onBlur={handleNameBlur} onKeyDown={handleNameKeyDown} className="bg-black border border-blue-500 rounded-md px-2 py-0.5 text-sm font-medium text-gray-200 outline-none w-48"/>
                            ) : (
                                <div onDoubleClick={() => setIsEditingName(true)} className="group flex items-center gap-2 px-2 py-1.5 text-sm font-medium bg-black rounded-md border border-transparent hover:border-gray-700/80 cursor-pointer" title="Double-click to rename">
                                    <span className="text-gray-300">{activeWorkspace.name}</span>
                                    <PencilIcon className="w-3 h-3 text-gray-600 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                            )}
                            <span className="text-xs font-semibold uppercase text-blue-400 bg-blue-500/10 px-2 py-1 rounded-full">{activeWorkspace.type}</span>
                        </div>
                     </div>
                    <div className="flex items-center gap-1">
                        <div title={isOnline ? 'Network: Online' : 'Network: Offline'} className="p-1.5">
                            {isOnline ? <WifiIcon className="w-5 h-5 text-green-500" /> : <WifiOffIcon className="w-5 h-5 text-red-500" />}
                        </div>
                        <button onClick={() => setIsVisualEditMode(!isVisualEditMode)} className="p-1.5 text-gray-400 rounded-md hover:text-white hover:bg-white/10" aria-label="Toggle Visual Edit Mode"><MousePointerIcon className={`w-5 h-5 transition-colors ${isVisualEditMode ? 'text-blue-500' : 'text-gray-400'}`} /></button>
                        <button onClick={handleDownload} className="p-1.5 text-gray-400 rounded-md hover:text-white hover:bg-white/10" aria-label="Download Project"><DownloadIcon className="w-5 h-5" /></button>
                        <button onClick={handleRefresh} className="p-1.5 text-gray-400 rounded-md hover:text-white hover:bg-white/10" aria-label="Refresh Preview"><RefreshIcon className="w-5 h-5" /></button>
                        <button onClick={handleToggleFullscreen} className="p-1.5 text-gray-400 rounded-md hover:text-white hover:bg-white/10" aria-label="Toggle Fullscreen"><FullscreenIcon className="w-5 h-5" /></button>
                        <button 
                            onClick={() => setIsBottomPanelVisible(!isBottomPanelVisible)} 
                            className="p-1.5 text-gray-400 rounded-md hover:text-white hover:bg-white/10 relative" 
                            aria-label={isBottomPanelVisible ? 'Hide Bottom Panel' : 'Show Bottom Panel'}
                        >
                            <TerminalIcon className="w-5 h-5" />
                            {(errorCount > 0 || incidentStats.count > 0) && (
                                <div className="absolute top-0.5 right-0.5 w-2.5 h-2.5 rounded-full bg-red-500 border-2 border-[#121212]"></div>
                            )}
                        </button>
                    </div>
                </header>
                
                <main className="flex-1 bg-black flex flex-col overflow-hidden">
                    <ResizablePanelGroup direction="vertical">
                         <Panel id="top" defaultSize={isBottomPanelVisible ? 67 : 100} className="min-h-[100px]">
                            <ResizablePanelGroup direction="horizontal">
                                {isCodePanelVisible && (
                                    <Panel id="code" defaultSize={40} className="min-w-[300px] flex flex-row">
                                        <div className="w-60 bg-[#0d0d0d] border-r border-gray-800/70 h-full">
                                          <FileExplorer files={activeWorkspace.files} activePath={activeFile?.path || ''} onSelect={setActivePath} />
                                        </div>
                                        <div ref={editorContainerRef} className="flex-1 h-full overflow-hidden bg-[#2b2b2b]">
                                            {/* CodeMirror will attach here */}
                                        </div>
                                    </Panel>
                                )}
                                {isCodePanelVisible && <ResizeHandle leftPanelId="code" rightPanelId="preview" />}
                                <Panel id="preview" defaultSize={60} className="min-w-[300px]">
                                     <div ref={previewContainerRef} className="relative w-full h-full bg-black">
                                        <GamePreview 
                                            key={refreshKey} 
                                            files={activeWorkspace.files} 
                                            isVisualEditMode={isVisualEditMode}
                                            localAssets={activeWorkspace.localAssets ?? []}
                                            quarantineRequest={quarantineRequest}
                                            onQuarantineComplete={() => setQuarantineRequest(null)}
                                        />
                                    </div>
                                </Panel>
                            </ResizablePanelGroup>
                        </Panel>

                        {isBottomPanelVisible && <ResizeHandle leftPanelId="top" rightPanelId="bottom" />}
                        {isBottomPanelVisible && (
                             <Panel id="bottom" defaultSize={33} className="min-h-[80px]">
                                <div className="h-full flex flex-col">
                                    <div className="flex-shrink-0 bg-[#121212] border-b border-gray-800/70 flex items-center px-2">
                                        <button onClick={() => setActiveBottomTab('console')} className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium border-b-2 transition-colors ${activeBottomTab === 'console' ? 'border-blue-500 text-white' : 'border-transparent text-gray-500 hover:text-gray-200'}`}>
                                            <TerminalIcon className="w-4 h-4" />
                                            <span>Console</span>
                                            {errorCount > 0 && <span className="text-xs bg-red-500/20 text-red-300 rounded-full px-1.5 py-0.5">{errorCount}</span>}
                                        </button>
                                         <button onClick={() => setActiveBottomTab('debugger')} className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium border-b-2 transition-colors ${activeBottomTab === 'debugger' ? 'border-blue-500 text-white' : 'border-transparent text-gray-500 hover:text-gray-200'}`}>
                                            <BugIcon className="w-4 h-4" />
                                            <span>Debugger</span>
                                            {incidentStats.count > 0 && <span className="text-xs bg-yellow-500/20 text-yellow-300 rounded-full px-1.5 py-0.5">{incidentStats.count}</span>}
                                        </button>
                                    </div>
                                    <div className="flex-grow overflow-hidden">
                                        {activeBottomTab === 'console' && (
                                            <Console 
                                                logs={logs} 
                                                onClear={handleClearConsole} 
                                                onAutoFix={handleAutoFixRequest} 
                                                onAutoFixAll={handleAutoFixAllErrors}
                                            />
                                        )}
                                        {activeBottomTab === 'debugger' && (
                                            <DebuggerPanel 
                                                incidents={incidents}
                                                onClear={handleClearIncidents}
                                                onAutoFix={handleAutoFixIncident}
                                                onRequestQuarantine={handleRequestQuarantine}
                                                onRequestAllow={handleRequestAllow}
                                            />
                                        )}
                                    </div>
                                </div>
                            </Panel>
                        )}
                    </ResizablePanelGroup>
                </main>
            </div>

            {isApiKeyModalOpen && (
                <ApiKeyModal 
                    onSave={handleSaveApiKey}
                    onCancel={handleCancelApiKey}
                />
            )}

            {isAssetLibraryOpen && (
                <AssetLibrary
                    activeWorkspaceType={activeWorkspace.type}
                    usedAssets={allUsedAssets}
                    localAssets={activeWorkspace.localAssets ?? []}
                    onUpload={onUploadLocalAsset}
                    onCreate={onCreateLocalAsset}
                    isCreating={isCreatingAsset}
                    onClose={() => setIsAssetLibraryOpen(false)}
                />
            )}

            <DebuggerWidget 
                incidentCount={incidentStats.count}
                highestThreatLevel={incidentStats.highestThreatLevel}
                onClick={handleWidgetClick}
            />

            {confirmationRequest && (
                <ConfirmationModal
                    request={confirmationRequest}
                    onCancel={() => setConfirmationRequest(null)}
                />
            )}

            {isLoading && (
                <div className="absolute bottom-5 left-1/2 -translate-x-1/2 bg-gray-900/80 backdrop-blur-sm border border-white/10 text-gray-200 px-4 py-2.5 rounded-full flex items-center gap-4 shadow-lg z-50 transition-opacity duration-300 animate-fade-in min-w-[320px] max-w-xl">
                    <SpinnerIcon className="w-5 h-5 text-blue-400 flex-shrink-0" />
                    <div className="text-left overflow-hidden">
                        <p className="text-sm font-medium truncate">
                             {aiProgress.length > 0 ? aiProgress[aiProgress.length - 1] : "AI is thinking..."}
                        </p>
                        <p className="text-xs text-gray-400 font-mono tracking-tighter">Elapsed: {elapsedTime}s</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default IDEView;