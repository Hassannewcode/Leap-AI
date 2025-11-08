import React from 'react';
import { SceneObject } from '../types';
import GridIcon from './icons/GridIcon';
import CubeIcon from './icons/CubeIcon';
import FileIcon from './icons/FileIcon';

interface SceneHierarchyProps {
    objects: SceneObject[];
    selectedId: string | null;
    onSelect: (id: string) => void;
}

const getIconForType = (type: string) => {
    const lowerType = type.toLowerCase();
    if (lowerType.includes('sprite')) return <GridIcon className="w-3 h-3" />;
    if (lowerType.includes('mesh') || lowerType.includes('object3d')) return <CubeIcon className="w-3 h-3" />;
    return <FileIcon className="w-3 h-3" />;
}

const SceneHierarchy: React.FC<SceneHierarchyProps> = ({ objects, selectedId, onSelect }) => {
    return (
        <div className="p-2 text-sm h-full">
            <nav className="h-full overflow-y-auto">
                {objects.length === 0 ? (
                    <div className="text-center text-gray-600 italic p-4 text-xs">
                        Scene is empty.
                    </div>
                ) : (
                    <ul>
                        {objects.map(obj => (
                            <li key={obj.id}>
                                <button
                                    onClick={() => onSelect(obj.id)}
                                    className={`w-full text-left flex items-center py-1.5 px-2 rounded-md transition-colors ${
                                        selectedId === obj.id ? 'bg-blue-500/20 text-blue-300' : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                                    }`}
                                >
                                    <div className="w-4 h-4 mr-2 text-gray-500 flex-shrink-0 flex items-center justify-center">
                                        {getIconForType(obj.type)}
                                    </div>
                                    <span className="truncate">{obj.name}</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </nav>
        </div>
    );
};

export default SceneHierarchy;
