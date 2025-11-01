import React, { useState } from 'react';
import BotIcon from './icons/BotIcon';
import XIcon from './icons/XIcon';

interface ApiKeyModalProps {
    onSave: (apiKey: string) => void;
    onCancel: () => void;
}

const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ onSave, onCancel }) => {
    const [apiKey, setApiKey] = useState('');

    const handleSave = () => {
        if (apiKey.trim()) {
            onSave(apiKey.trim());
        }
    };

    return (
        <div 
            className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in"
            onClick={onCancel}
            aria-modal="true"
            role="dialog"
            aria-labelledby="api-key-modal-title"
        >
            <div 
                className="bg-[#1c1c1c] w-full max-w-lg rounded-xl border border-blue-500/30 shadow-2xl"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex flex-col p-8">
                    <div className="flex items-center gap-4">
                         <div className="w-12 h-12 rounded-full bg-blue-500/10 border-4 border-blue-500/20 flex items-center justify-center flex-shrink-0">
                             <BotIcon className="w-6 h-6 text-blue-400" />
                        </div>
                        <div>
                            <h2 id="api-key-modal-title" className="text-xl font-bold text-gray-100">Gemini API Key Required</h2>
                             <p className="mt-1 text-gray-400">
                                To use generative AI features inside your game, please provide your own API key.
                            </p>
                        </div>
                    </div>
                   
                    <div className="w-full mt-6 text-left">
                        <p className="text-sm text-gray-400 mb-2">
                            Your key is stored locally in your browser and is never sent to our servers.
                            <a 
                                href="https://aistudio.google.com/app/apikey" 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-blue-400 hover:underline ml-1"
                            >
                                Get your API key from Google AI Studio.
                            </a>
                        </p>
                         <input
                            id="api-key-input"
                            type="password"
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            className="mt-2 w-full bg-black/50 border border-gray-700/60 rounded-md px-3 py-2 text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Enter your Gemini API key"
                            autoComplete="off"
                        />
                    </div>
                </div>

                <div className="bg-black/30 px-6 py-4 flex flex-col-reverse sm:flex-row sm:justify-end sm:gap-3 rounded-b-xl">
                     <button
                        type="button"
                        onClick={onCancel}
                        className="w-full sm:w-auto inline-flex justify-center rounded-md border border-gray-600 px-4 py-2 bg-gray-700/50 text-base font-medium text-gray-300 hover:bg-gray-600/50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-gray-500 mt-3 sm:mt-0"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={!apiKey.trim()}
                        className="w-full sm:w-auto inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 focus:ring-offset-gray-800 transition-colors disabled:bg-blue-600/40 disabled:cursor-not-allowed"
                    >
                        Save and Continue
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ApiKeyModal;
