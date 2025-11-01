import React, { useState, useEffect } from 'react';
import { Workspace } from '../types';
import AlertTriangleIcon from './icons/AlertTriangleIcon';

interface DeleteWorkspaceModalProps {
    workspace: Workspace | null;
    onConfirm: () => void;
    onCancel: () => void;
}

const DeleteWorkspaceModal: React.FC<DeleteWorkspaceModalProps> = ({ workspace, onConfirm, onCancel }) => {
    const [confirmationText, setConfirmationText] = useState('');

    useEffect(() => {
        // Reset input when modal is opened for a new workspace
        if (workspace) {
            setConfirmationText('');
        }
    }, [workspace]);

    if (!workspace) {
        return null;
    }

    const isConfirmed = confirmationText === workspace.name;

    return (
        <div 
            className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in"
            onClick={onCancel}
            aria-modal="true"
            role="dialog"
            aria-labelledby="delete-modal-title"
        >
            <div 
                className="bg-[#1c1c1c] w-full max-w-md rounded-xl border border-red-500/30 shadow-2xl"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex flex-col p-8">
                    <div className="flex items-center gap-4">
                         <div className="w-12 h-12 rounded-full bg-red-500/10 border-4 border-red-500/20 flex items-center justify-center flex-shrink-0">
                             <AlertTriangleIcon className="w-6 h-6 text-red-400" />
                        </div>
                        <div>
                            <h2 id="delete-modal-title" className="text-xl font-bold text-gray-100">Delete Workspace</h2>
                             <p className="mt-1 text-gray-400">
                                This action is irreversible and will permanently delete the project.
                            </p>
                        </div>
                    </div>
                   

                    <div className="w-full mt-6 text-left">
                        <label htmlFor="delete-confirmation" className="text-sm font-medium text-gray-300">
                            To confirm, please type <strong className="text-red-300">{workspace.name}</strong>
                        </label>
                         <input
                            id="delete-confirmation"
                            type="text"
                            value={confirmationText}
                            onChange={(e) => setConfirmationText(e.target.value)}
                            className="mt-2 w-full bg-black/50 border border-gray-700/60 rounded-md px-3 py-2 text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500"
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
                        onClick={onConfirm}
                        disabled={!isConfirmed}
                        className="w-full sm:w-auto inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 focus:ring-offset-gray-800 transition-colors disabled:bg-red-600/40 disabled:cursor-not-allowed"
                    >
                        Delete Project
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DeleteWorkspaceModal;
