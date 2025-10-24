
import React from 'react';
import type { Workspace, WorkspaceType } from '../types';
import GridIcon from './icons/GridIcon';
import CubeIcon from './icons/CubeIcon';
import AIIcon from './icons/AIIcon';
import TrashIcon from './icons/TrashIcon';
import { triggerHapticFeedback } from '../lib/utils/haptics';

interface WorkspaceModalProps {
  workspaces: Workspace[];
  onSelect: (id: string) => void;
  onCreate: (workspace: WorkspaceType) => void;
  onDelete: (id: string) => void;
}

const WorkspaceCard: React.FC<{workspace: Workspace, onSelect: (id: string) => void, onDelete: (id: string) => void}> = ({ workspace, onSelect, onDelete }) => {
    return (
        <div className="group relative bg-[#1c1c1c] p-4 rounded-lg border border-gray-800/70 flex justify-between items-center transition-all duration-200 hover:border-blue-500/50 hover:bg-gray-900/40">
            <button onClick={() => onSelect(workspace.id)} className="flex-grow text-left flex items-center gap-4 w-full h-full">
                {workspace.type === '2D' ? <GridIcon className="w-8 h-8 text-gray-500 flex-shrink-0" /> : <CubeIcon className="w-8 h-8 text-gray-500 flex-shrink-0" />}
                <div className="overflow-hidden">
                    <h3 className="font-semibold text-gray-100 truncate">{workspace.name}</h3>
                    <p className="text-xs text-gray-500">Last modified: {new Date(workspace.lastModified).toLocaleString()}</p>
                </div>
            </button>
            <button
                onClick={(e) => { 
                    e.stopPropagation(); 
                    if (window.confirm(`Are you sure you want to delete "${workspace.name}"? This action cannot be undone.`)) {
                        onDelete(workspace.id);
                    }
                }}
                className="p-2 ml-2 rounded-md text-gray-600 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="Delete workspace"
            >
                <TrashIcon className="w-4 h-4" />
            </button>
        </div>
    );
};


const WorkspaceModal: React.FC<WorkspaceModalProps> = ({ workspaces, onSelect, onCreate, onDelete }) => {
  const sortedWorkspaces = [...workspaces].sort((a, b) => b.lastModified - a.lastModified);

  const handleCreate = (type: WorkspaceType) => {
    triggerHapticFeedback();
    onCreate(type);
  }

  return (
    <div className="w-screen h-screen bg-black flex flex-col items-center justify-start p-8 text-center overflow-y-auto">
        <div className="flex items-center gap-4 mb-4 mt-8 md:mt-16">
             <AIIcon className="w-12 h-12 text-blue-500" />
            <h1 className="text-5xl font-bold text-gray-100 tracking-tighter">Leap AI</h1>
        </div>
        <p className="text-lg text-gray-400 mb-10 max-w-2xl">
            Create a new project or select a recent one to continue.
        </p>
        <div className="w-full max-w-2xl space-y-6">
            {/* Create New Buttons */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <button
                    onClick={() => handleCreate('2D')}
                    className="group bg-[#121212] p-8 rounded-lg border border-dashed border-gray-700 hover:border-blue-500/80 hover:bg-blue-900/10 transition-all duration-300 flex flex-col items-center justify-center"
                >
                    <GridIcon className="w-12 h-12 mb-4 text-gray-500 group-hover:text-blue-400 transition-colors" />
                    <h2 className="text-xl font-semibold text-gray-300 group-hover:text-white">New 2D Game</h2>
                </button>
                <button
                    onClick={() => handleCreate('3D')}
                    className="group bg-[#121212] p-8 rounded-lg border border-dashed border-gray-700 hover:border-blue-500/80 hover:bg-blue-900/10 transition-all duration-300 flex flex-col items-center justify-center"
                >
                    <CubeIcon className="w-12 h-12 mb-4 text-gray-500 group-hover:text-blue-400 transition-colors" />
                    <h2 className="text-xl font-semibold text-gray-300 group-hover:text-white">New 3D Game</h2>
                </button>
            </div>

            {/* Recent Projects List */}
            {sortedWorkspaces.length > 0 && (
                 <div className="text-left w-full pt-6">
                    <h3 className="text-lg font-semibold text-gray-400 mb-4 px-1">Recent Projects</h3>
                    <div className="space-y-3">
                        {sortedWorkspaces.map(ws => (
                            <WorkspaceCard key={ws.id} workspace={ws} onSelect={onSelect} onDelete={onDelete} />
                        ))}
                    </div>
                </div>
            )}
        </div>
    </div>
  );
};

export default WorkspaceModal;
