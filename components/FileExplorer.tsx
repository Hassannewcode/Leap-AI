import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { FileEntry } from '../types';
import FileIcon from './icons/FileIcon';
import FolderIcon from './icons/FolderIcon';
import FolderOpenIcon from './icons/FolderOpenIcon';

interface FileExplorerProps {
    files: FileEntry[];
    activePath: string;
    onSelect: (path: string) => void;
}

interface TreeNode {
  name: string;
  path: string;
  type: 'folder' | 'file';
  children?: TreeNode[];
}

const buildFileTree = (files: FileEntry[]): TreeNode[] => {
    const root: { children: TreeNode[] } = { children: [] };

    files.forEach(file => {
        const parts = file.path.split('/');
        let currentNode = root;

        parts.forEach((part, index) => {
            const isLastPart = index === parts.length - 1;
            let existingNode = currentNode.children.find(child => child.name === part);

            if (existingNode) {
                if (!isLastPart && existingNode.type === 'file') {
                    // This case is unlikely with well-formed paths, but handles conflicts.
                    console.warn(`Path conflict: ${part} exists as a file but is needed as a folder.`);
                }
                currentNode = existingNode as TreeNode & { children: TreeNode[] };
            } else {
                if (isLastPart) {
                    // It's a file
                    const fileNode: TreeNode = { name: part, path: file.path, type: 'file' };
                    currentNode.children.push(fileNode);
                } else {
                    // It's a folder
                    const folderPath = parts.slice(0, index + 1).join('/');
                    const folderNode: TreeNode = { name: part, path: folderPath, type: 'folder', children: [] };
                    currentNode.children.push(folderNode);
                    // FIX: The type of `folderNode` (TreeNode) is not assignable to the type of `currentNode` ({ children: TreeNode[] })
                    // because `children` is optional in `TreeNode`. We cast it to assert it's a folder-like structure.
                    currentNode = folderNode as unknown as { children: TreeNode[] };
                }
            }
        });
    });

    const sortNodes = (nodes: TreeNode[]) => {
        nodes.sort((a, b) => {
            if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
            return a.name.localeCompare(b.name);
        });
        nodes.forEach(node => {
            if (node.type === 'folder' && node.children) {
                sortNodes(node.children);
            }
        });
    };

    sortNodes(root.children);
    return root.children;
};

const Node: React.FC<{ node: TreeNode; level: number; activePath: string; onSelect: (path: string) => void; openFolders: Set<string>; toggleFolder: (path: string) => void; }> = ({ node, level, activePath, onSelect, openFolders, toggleFolder }) => {
    const isFolder = node.type === 'folder';
    const isOpen = isFolder && openFolders.has(node.path);
    const isActive = activePath === node.path;
    const indent = level * 16;

    const handleNodeClick = useCallback(() => {
        if (isFolder) {
            toggleFolder(node.path);
        } else {
            onSelect(node.path);
        }
    }, [isFolder, node.path, onSelect, toggleFolder]);

    return (
        <li>
            <button
                onClick={handleNodeClick}
                style={{ paddingLeft: `${indent + 8}px` }}
                className={`w-full text-left flex items-center py-1.5 text-sm rounded-md transition-colors ${
                    isActive ? 'bg-blue-500/20 text-blue-300' : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                }`}
            >
                <div className="w-4 h-4 mr-2 text-gray-500 flex-shrink-0">
                    {isFolder ? (isOpen ? <FolderOpenIcon /> : <FolderIcon />) : <FileIcon />}
                </div>
                <span className="truncate">{node.name}</span>
            </button>
            {isFolder && isOpen && node.children && (
                <ul>
                    {node.children.map(child => (
                        <Node key={child.path} node={child} level={level + 1} activePath={activePath} onSelect={onSelect} openFolders={openFolders} toggleFolder={toggleFolder} />
                    ))}
                </ul>
            )}
        </li>
    );
};

const FileExplorer: React.FC<FileExplorerProps> = ({ files, activePath, onSelect }) => {
    const fileTree = useMemo(() => buildFileTree(files), [files]);
    
    const [openFolders, setOpenFolders] = useState<Set<string>>(() => {
        const initialOpen = new Set<string>();
        if (activePath) {
            const parts = activePath.split('/');
            for (let i = 1; i < parts.length; i++) {
                initialOpen.add(parts.slice(0, i).join('/'));
            }
        }
        return initialOpen;
    });

    useEffect(() => {
        if (activePath) {
             setOpenFolders(prevOpen => {
                const newOpen = new Set(prevOpen);
                const parts = activePath.split('/');
                let shouldUpdate = false;
                for (let i = 1; i < parts.length; i++) {
                    const path = parts.slice(0, i).join('/');
                    if (!newOpen.has(path)) {
                        newOpen.add(path);
                        shouldUpdate = true;
                    }
                }
                return shouldUpdate ? newOpen : prevOpen;
             });
        }
    }, [activePath]);

    const toggleFolder = useCallback((path: string) => {
        setOpenFolders(prev => {
            const newSet = new Set(prev);
            if (newSet.has(path)) {
                newSet.delete(path);
            } else {
                newSet.add(path);
            }
            return newSet;
        });
    }, []);

    return (
        <div className="p-2 h-full overflow-y-auto">
            <h2 className="text-xs font-bold uppercase text-gray-500 px-2 mb-2 tracking-wider">Project Files</h2>
            <nav>
                <ul>
                    {fileTree.map(node => (
                        <Node key={node.path} node={node} level={0} activePath={activePath} onSelect={onSelect} openFolders={openFolders} toggleFolder={toggleFolder} />
                    ))}
                </ul>
            </nav>
        </div>
    );
};

export default FileExplorer;