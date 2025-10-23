import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, ModelChatMessage, AssetInfo, GroundingSource, SelectedObject, AiMode, UserChatMessage } from '../types';
import AIIcon from './icons/AIIcon';
import SpinnerIcon from './icons/SpinnerIcon';
import ThumbsUpIcon from './icons/ThumbsUpIcon';
import RefreshIcon from './icons/RefreshIcon';
import ChevronDownIcon from './icons/ChevronDownIcon';
import SearchIcon from './icons/SearchIcon';
import ImageIcon from './icons/ImageIcon';
import XIcon from './icons/XIcon';
import PaperclipIcon from './icons/PaperclipIcon';
import CheckCircleIcon from './icons/CheckCircleIcon';
import FlagIcon from './icons/FlagIcon';


interface ChatPanelProps {
    history: ChatMessage[];
    isLoading: boolean;
    onSend: (prompt: string, context: { image: { data: string; mimeType: string; } | null, mode: AiMode }) => void;
    onDeleteWorkspace: () => void;
    onPositiveFeedback: (messageId: string) => void;
    onRetry: (prompt: string) => void;
    onRestoreCheckpoint: (messageId: string) => void;
    selectedObject: SelectedObject;
    onDeselectObject: () => void;
}

const UpdatedFilesBlock: React.FC<{ files: string[] }> = ({ files }) => {
    if (!files || files.length === 0) return null;
    
    return (
        <div className="mt-4">
            <h4 className="text-sm font-semibold text-gray-200 mb-2">Here are the updated files:</h4>
            <div className="bg-black/50 p-3 rounded-md border border-gray-700/60">
                <ul className="space-y-1.5">
                    {files.map((file, index) => (
                        <li key={index} className="flex items-center gap-2 text-sm text-gray-300">
                            <CheckCircleIcon className="w-4 h-4 text-green-400 flex-shrink-0" />
                            <span className="font-mono truncate">{file}</span>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
};

const CheckpointControls: React.FC<{ onRestore: () => void }> = ({ onRestore }) => (
    <div className="mt-4 pt-3 border-t border-gray-700/50 flex items-center gap-4 text-sm font-medium">
        <div className="flex items-center gap-2 text-gray-200">
            <FlagIcon className="w-4 h-4" />
            <span>Checkpoint</span>
        </div>
        <button 
            className="text-gray-500 hover:text-white hover:underline disabled:opacity-50 disabled:cursor-not-allowed disabled:no-underline"
            disabled={true} // For now
            title="Coming soon"
        >
            View diff
        </button>
        <button 
            onClick={onRestore}
            className="text-gray-400 hover:text-white hover:underline"
        >
            Restore checkpoint
        </button>
    </div>
);

const ThinkingBlock: React.FC<{ thinking: string }> = ({ thinking }) => (
    <details className="mt-3 text-xs text-gray-400 border-t border-gray-700/50 pt-2 group" open>
        <summary className="cursor-pointer font-medium list-none flex items-center justify-between hover:text-gray-200">
            <span>AI's Plan</span>
            <ChevronDownIcon className="w-4 h-4 transition-transform group-open:rotate-180" />
        </summary>
        <div className="pt-2 font-mono whitespace-pre-wrap leading-relaxed">
            {thinking}
        </div>
    </details>
);

const AssetInfoBlock: React.FC<{ assets: AssetInfo[]; sources: GroundingSource[] }> = ({ assets, sources }) => {
    if (assets.length === 0 && sources.length === 0) return null;

    return (
        <div className="mt-3 text-xs text-gray-400 border-t border-gray-700/50 pt-3 space-y-3">
            <h4 className="font-semibold text-gray-300">Intelligence Report</h4>
            {assets.length > 0 && (
                <div>
                    <div className="flex items-center gap-2 mb-1 text-gray-400">
                         <ImageIcon className="w-3.5 h-3.5" />
                         <span className="font-medium">Assets Integrated</span>
                    </div>
                    <ul className="list-disc list-inside space-y-1 pl-2 font-mono text-gray-500">
                        {assets.map((asset, index) => (
                           <li key={index} className="truncate">
                                <a href={asset.url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline" title={asset.url}>
                                    {asset.url.split('/').pop()}
                                </a>
                                <span> from {asset.source}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
             {sources.length > 0 && (
                <div>
                    <div className="flex items-center gap-2 mb-1 text-gray-400">
                         <SearchIcon className="w-3.5 h-3.5" />
                         <span className="font-medium">Web Sources Consulted</span>
                    </div>
                    <ul className="list-disc list-inside space-y-1 pl-2 font-mono text-gray-500">
                        {sources.map((source, index) => (
                            <li key={index} className="truncate">
                                <a href={source.uri} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline" title={source.uri}>
                                    {source.title || new URL(source.uri).hostname}
                                </a>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

const isModelMessage = (msg: ChatMessage): msg is ModelChatMessage => {
    return msg.role === 'model';
};

const isUserMessage = (msg: ChatMessage): msg is UserChatMessage => {
    return msg.role === 'user';
}


const ChatPanel: React.FC<ChatPanelProps> = ({ history, isLoading, onSend, onDeleteWorkspace, onPositiveFeedback, onRetry, onRestoreCheckpoint, selectedObject, onDeselectObject }) => {
    const [prompt, setPrompt] = useState('');
    const [aiMode, setAiMode] = useState<AiMode>('standard');
    const [uploadedImage, setUploadedImage] = useState<{ data: string; mimeType: string; name: string; } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const historyEndRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        historyEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [history]);
    
    const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            if (!file.type.startsWith('image/')) {
                alert('Please select a valid image file.');
                return;
            }
            const reader = new FileReader();
            reader.onload = (e) => {
                const base64String = (e.target?.result as string)?.split(',')[1];
                if (base64String) {
                    setUploadedImage({
                        data: base64String,
                        mimeType: file.type,
                        name: file.name
                    });
                }
            };
            reader.readAsDataURL(file);
        }
        event.target.value = ''; // Allow re-uploading the same file
    };

    const handleSend = () => {
        if ((prompt.trim() || uploadedImage) && !isLoading) {
            let fullPrompt = prompt.trim();
            // If there's an image but no prompt, use a default prompt.
            if (!fullPrompt && uploadedImage) {
                fullPrompt = "Analyze this image and describe how to build a game based on it.";
            }

            if (selectedObject) {
                fullPrompt = `With the object named "${selectedObject.name}" selected, ${fullPrompt}`;
            }
            onSend(fullPrompt, { image: uploadedImage, mode: aiMode });
            setPrompt('');
            setUploadedImage(null);
        }
    };
    
    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
        const pastedText = e.clipboardData.getData('text/plain');
        if (pastedText) {
            e.preventDefault();
            // Wrap pasted content in a markdown code block for the AI to easily identify it.
            const formattedText = `\n\n\`\`\`\n${pastedText}\n\`\`\`\n`;
            
            // Insert the formatted text at the cursor position
            const target = e.target as HTMLTextAreaElement;
            const start = target.selectionStart;
            const end = target.selectionEnd;
            const text = target.value;
            const newText = text.substring(0, start) + formattedText + text.substring(end);
            
            setPrompt(newText);

            // Move cursor to the end of the pasted content
            // Using a timeout to ensure the state update has rendered
            setTimeout(() => {
                const newCursorPos = start + formattedText.length;
                target.selectionStart = newCursorPos;
                target.selectionEnd = newCursorPos;
            }, 0);
        }
    };

    return (
        <div className="flex flex-col h-full p-4 bg-[#121212] min-w-[380px]">
            <header className="flex-shrink-0 mb-4 pb-4 border-b border-gray-800/70">
                <div className="flex items-center gap-3">
                    <AIIcon className="w-8 h-8 text-blue-500" />
                    <h1 className="text-xl font-medium text-gray-100">Leap AI</h1>
                </div>
                <p className="text-sm text-gray-500 mt-1">Your AI Game Dev Assistant</p>
            </header>

            <div className="flex-grow overflow-y-auto pr-2">
                <div className="space-y-6">
                    {history.map((msg) => (
                        <div key={msg.id} className={`flex gap-3 items-start ${msg.role === 'user' ? 'justify-end' : ''}`}>
                            {msg.role === 'model' && (
                                <div className="w-7 h-7 flex-shrink-0 bg-gray-800 rounded-full flex items-center justify-center">
                                    <AIIcon className="w-4 h-4 text-blue-400" />
                                </div>
                            )}
                            <div className="group relative">
                                <div className={`text-sm leading-relaxed rounded-lg px-4 py-2 max-w-sm ${msg.role === 'model' ? (msg.isFixable ? 'bg-red-900/50 border border-red-500/30 text-red-200' : 'bg-gray-800/50 text-gray-300') : 'bg-blue-600/80 text-white'}`}>
                                    {isUserMessage(msg) && msg.image && (
                                        <img src={`data:${msg.image.mimeType};base64,${msg.image.data}`} alt="User upload" className="mb-2 rounded-lg max-w-full h-auto border border-white/10" />
                                    )}
                                    <div className="whitespace-pre-wrap">{msg.text}</div>
                                    
                                    {isModelMessage(msg) && msg.filesUpdated && (
                                        <UpdatedFilesBlock files={msg.filesUpdated} />
                                    )}
                                    
                                    {isModelMessage(msg) && msg.checkpoint && !msg.isFixable && (
                                        <CheckpointControls onRestore={() => onRestoreCheckpoint(msg.id)} />
                                    )}

                                    {isModelMessage(msg) && msg.thinking && (
                                        <ThinkingBlock thinking={msg.thinking} />
                                    )}
                                    {isModelMessage(msg) && ((msg.assetsUsed && msg.assetsUsed.length > 0) || (msg.groundingSources && msg.groundingSources.length > 0)) && (
                                        <AssetInfoBlock assets={msg.assetsUsed || []} sources={msg.groundingSources || []} />
                                    )}
                                    {isModelMessage(msg) && msg.isFixable && msg.originalPrompt && (
                                        <button 
                                            onClick={() => onRetry(msg.originalPrompt!)}
                                            disabled={isLoading}
                                            className="mt-3 flex items-center gap-2 text-sm font-medium bg-yellow-500/20 text-yellow-300 px-3 py-1.5 rounded-md hover:bg-yellow-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <RefreshIcon className="w-4 h-4"/>
                                            Try Again
                                        </button>
                                    )}
                                </div>
                                {isModelMessage(msg) && !msg.rated && !msg.isFixable && (
                                     <button 
                                        onClick={() => onPositiveFeedback(msg.id)}
                                        className="absolute -bottom-4 right-2 p-1 rounded-full bg-gray-700/80 text-gray-400 hover:text-green-400 hover:bg-gray-600 transition-all opacity-0 group-hover:opacity-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                        aria-label="Good response"
                                        disabled={!!msg.rated || isLoading}
                                    >
                                        <ThumbsUpIcon className="w-3.5 h-3.5" />
                                     </button>
                                )}
                            </div>
                        </div>
                    ))}
                    {isLoading && history[history.length-1]?.role === 'user' && (
                         <div className="flex gap-3 items-start">
                            <div className="w-7 h-7 flex-shrink-0 bg-gray-800 rounded-full flex items-center justify-center">
                                <SpinnerIcon className="w-4 h-4 text-blue-400" />
                            </div>
                            <div className="text-sm leading-relaxed rounded-lg px-4 py-2 max-w-sm bg-gray-800/50 text-gray-400 italic">
                                Thinking...
                            </div>
                        </div>
                    )}
                </div>
                <div ref={historyEndRef} />
            </div>

            <footer className="flex-shrink-0 mt-4 pt-4 border-t border-gray-800/70">
                 <div className="flex items-center justify-between mb-2 px-1">
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">AI Mode</label>
                    <div className="flex items-center gap-1 p-0.5 bg-gray-900 rounded-md border border-gray-700/50">
                        {(['standard', 'team'] as AiMode[]).map(mode => (
                            <button
                                key={mode}
                                onClick={() => setAiMode(mode)}
                                className={`text-xs font-semibold capitalize px-2 py-0.5 rounded transition-colors ${aiMode === mode ? 'bg-blue-500/30 text-blue-300' : 'text-gray-400 hover:bg-white/5'}`}
                            >
                                {mode}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="relative">
                    {selectedObject && (
                        <div className="absolute -top-10 left-0 w-full flex justify-center">
                            <div className="bg-blue-900/80 backdrop-blur-sm border border-blue-500/50 text-blue-200 px-3 py-1 rounded-full flex items-center gap-2 text-xs shadow-lg">
                                <span>Currently selecting: <strong className="font-medium">{selectedObject.name}</strong></span>
                                <button onClick={onDeselectObject} className="p-0.5 rounded-full hover:bg-white/20">
                                    <XIcon className="w-3 h-3"/>
                                </button>
                            </div>
                        </div>
                    )}
                     {uploadedImage && (
                        <div className="absolute bottom-full left-0 w-full mb-2 p-1.5 bg-gray-900 rounded-t-lg border-b border-gray-700/80">
                             <div className="flex items-center gap-2 bg-gray-800/70 p-1 rounded-md">
                                <ImageIcon className="w-5 h-5 text-gray-400 flex-shrink-0 ml-1" />
                                <span className="text-xs text-gray-300 truncate flex-grow">{uploadedImage.name}</span>
                                <button onClick={() => setUploadedImage(null)} className="p-1 rounded-full hover:bg-white/20 flex-shrink-0">
                                    <XIcon className="w-3.5 h-3.5"/>
                                </button>
                             </div>
                        </div>
                    )}
                    <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onPaste={handlePaste}
                        placeholder={selectedObject ? `e.g., 'make it bigger'` : (uploadedImage ? 'Describe what to do with the image...' : `e.g., 'Add enemies that shoot back'`)}
                        className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-9 pr-20 py-2 text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all resize-none"
                        rows={3}
                        disabled={isLoading}
                        aria-label="AI instruction prompt"
                    />
                    <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="absolute left-2 top-2 p-1.5 text-gray-400 rounded-full hover:bg-white/10 hover:text-white transition-colors"
                        title="Attach image"
                        aria-label="Attach image"
                        disabled={isLoading}
                    >
                        <PaperclipIcon className="w-4 h-4" />
                    </button>
                    <button
                        onClick={handleSend}
                        className="absolute right-2 bottom-2 bg-blue-600 hover:bg-blue-500 text-white font-medium py-1.5 px-3 rounded-md flex items-center justify-center gap-2 transition-colors disabled:bg-blue-600/50 disabled:cursor-not-allowed"
                        disabled={isLoading || (!prompt.trim() && !uploadedImage)}
                        aria-label="Send prompt"
                    >
                        Send
                    </button>
                </div>
                <button 
                    onClick={() => {
                        if (window.confirm("Are you sure you want to delete this workspace? This action cannot be undone.")) {
                            onDeleteWorkspace();
                        }
                    }} 
                    className="text-xs mt-3 w-full text-center p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors"
                >
                    Delete Workspace
                </button>
            </footer>
        </div>
    );
};

export default ChatPanel;