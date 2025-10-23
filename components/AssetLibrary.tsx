
import React, { useRef, useState, useMemo } from 'react';
import { AssetInfo, LocalAsset, WorkspaceType } from '../types';
import UploadCloudIcon from './icons/UploadCloudIcon';
import XIcon from './icons/XIcon';
import WandIcon from './icons/WandIcon';
import SpinnerIcon from './icons/SpinnerIcon';
import CubeIcon from './icons/CubeIcon';
import AudioIcon from './icons/AudioIcon';
import FileIcon from './icons/FileIcon';
// FIX: Import the missing ImagesIcon component.
import ImagesIcon from './icons/ImagesIcon';

interface AssetLibraryProps {
    activeWorkspaceType: WorkspaceType;
    usedAssets: AssetInfo[];
    localAssets: LocalAsset[];
    onUpload: (file: File) => void;
    onCreate: (prompt: string) => void;
    isCreating: boolean;
    onClose: () => void;
}

type AssetType = 'image' | 'audio' | 'model' | 'unknown';

interface ViewingAsset {
    name: string;
    url: string;
    source: string;
    type: AssetType;
}

const getAssetType = (nameOrMime: string): AssetType => {
    const lower = nameOrMime.toLowerCase();
    if (lower.startsWith('image/')) return 'image';
    if (/\.(png|jpg|jpeg|gif|svg|webp)$/.test(lower)) return 'image';
    
    if (lower.startsWith('audio/')) return 'audio';
    if (/\.(mp3|wav|ogg|m4a)$/.test(lower)) return 'audio';

    if (/\.(glb|gltf)$/.test(lower)) return 'model';
    
    return 'unknown';
};


const AssetViewerModal: React.FC<{ asset: ViewingAsset; onClose: () => void; }> = ({ asset, onClose }) => {
    return (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-[#1c1c1c] w-full max-w-2xl max-h-[80vh] rounded-lg border border-gray-700/80 flex flex-col" onClick={e => e.stopPropagation()}>
                <header className="flex items-center justify-between p-3 border-b border-gray-700/80 flex-shrink-0">
                    <div className="flex items-center gap-2">
                         {asset.type === 'image' && <ImagesIcon className="w-5 h-5 text-gray-400" />}
                         {asset.type === 'audio' && <AudioIcon className="w-5 h-5 text-gray-400" />}
                         {asset.type === 'model' && <CubeIcon className="w-5 h-5 text-gray-400" />}
                         {asset.type === 'unknown' && <FileIcon className="w-5 h-5 text-gray-400" />}
                        <h3 className="font-semibold text-gray-200 truncate">{asset.name}</h3>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/10 text-gray-400 hover:text-white">
                        <XIcon className="w-5 h-5" />
                    </button>
                </header>
                <main className="flex-grow p-4 flex items-center justify-center overflow-hidden">
                    {asset.type === 'image' && <img src={asset.url} alt={asset.name} className="max-w-full max-h-full object-contain" />}
                    {asset.type === 'audio' && <audio src={asset.url} controls autoPlay className="w-full" />}
                    {asset.type === 'model' && <div className="text-center text-gray-500"><CubeIcon className="w-24 h-24 mx-auto mb-4" /><p>3D Model Asset</p><p className="text-xs">Preview not available.</p></div>}
                    {asset.type === 'unknown' && <div className="text-center text-gray-500"><FileIcon className="w-24 h-24 mx-auto mb-4" /><p>Unknown Asset Type</p></div>}
                </main>
                <footer className="p-3 border-t border-gray-700/80 flex-shrink-0 text-xs text-gray-400">
                    <p><strong>Source:</strong> {asset.source}</p>
                    <p className="truncate"><strong>URL:</strong> <a href={asset.url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">{asset.url}</a></p>
                </footer>
            </div>
        </div>
    );
};


const AssetCard: React.FC<{ asset: LocalAsset | AssetInfo; onClick: () => void; }> = ({ asset, onClick }) => {
    const assetType = 'mimeType' in asset ? getAssetType(asset.mimeType) : getAssetType(asset.url);
    const imageUrl = assetType === 'image' ? ('dataUrl' in asset ? asset.dataUrl : asset.url) : '';
    const name = 'name' in asset ? asset.name : asset.url.split('/').pop() || 'asset';
    const source = 'source' in asset ? asset.source : 'Local Upload';

    return (
        <button onClick={onClick} className="group relative aspect-square bg-gray-900/50 rounded-lg overflow-hidden border border-transparent hover:border-blue-500/50 focus:outline-none focus:ring-2 focus:ring-blue-500">
            {assetType === 'image' ? (
                <img src={imageUrl} alt={name} className="w-full h-full object-contain p-1" />
            ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-600">
                    {assetType === 'audio' && <AudioIcon className="w-1/2 h-1/2" />}
                    {assetType === 'model' && <CubeIcon className="w-1/2 h-1/2" />}
                    {assetType === 'unknown' && <FileIcon className="w-1/2 h-1/2" />}
                </div>
            )}
            <div className="absolute bottom-0 left-0 w-full bg-black/70 p-2 text-xs text-left text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm">
                <p className="font-bold truncate" title={name}>{name}</p>
                <p className="text-gray-400 truncate" title={source}>{source}</p>
            </div>
        </button>
    );
};


const AssetLibrary: React.FC<AssetLibraryProps> = ({ activeWorkspaceType, usedAssets, localAssets, onUpload, onCreate, isCreating, onClose }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [activeTab, setActiveTab] = useState<'library' | 'create'>('library');
    const [assetPrompt, setAssetPrompt] = useState('');
    const [viewingAsset, setViewingAsset] = useState<ViewingAsset | null>(null);

    const handleUploadClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            onUpload(file);
        }
        event.target.value = ''; // Reset input to allow re-uploading the same file
    };

    const handleCreate = () => {
        if (assetPrompt.trim() && !isCreating) {
            onCreate(assetPrompt);
            setAssetPrompt('');
        }
    };
    
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleCreate();
        }
    };

    const openAssetViewer = (asset: LocalAsset | AssetInfo) => {
        if ('dataUrl' in asset) { // It's a LocalAsset
            setViewingAsset({
                name: asset.name,
                url: asset.dataUrl,
                source: 'Local Upload',
                type: getAssetType(asset.mimeType)
            });
        } else { // It's an AssetInfo
             setViewingAsset({
                name: asset.url.split('/').pop() || 'asset',
                url: asset.url,
                source: asset.source,
                type: getAssetType(asset.url)
            });
        }
    };

    const LibraryTabContent = (
        <>
            <section className="mb-8">
                <h3 className="text-lg font-medium text-gray-300 mb-3 px-1">Your Uploaded Assets</h3>
                <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-4">
                    {localAssets.map(asset => (
                        <AssetCard key={asset.id} asset={asset} onClick={() => openAssetViewer(asset)} />
                    ))}
                    <button onClick={handleUploadClick} className="aspect-square flex flex-col items-center justify-center bg-gray-900/50 rounded-lg border-2 border-dashed border-gray-700 hover:border-blue-500/80 hover:bg-blue-900/20 text-gray-500 hover:text-blue-400 transition-all">
                        <UploadCloudIcon className="w-8 h-8 mb-2" />
                        <span className="text-xs font-semibold">Upload</span>
                    </button>
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*,audio/*" className="hidden" />
                </div>
            </section>
            <section>
                <h3 className="text-lg font-medium text-gray-300 mb-3 px-1">Current Project Assets</h3>
                {usedAssets.length > 0 ? (
                    <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-4">
                        {usedAssets.map(asset => (
                           <AssetCard key={asset.url} asset={asset} onClick={() => openAssetViewer(asset)} />
                        ))}
                    </div>
                ) : (
                    <p className="text-gray-500 italic px-1">No assets have been added to the project yet by the AI.</p>
                )}
            </section>
        </>
    );

    const CreateTabContent = (
        <div className="flex flex-col h-full">
            {activeWorkspaceType === '2D' ? (
                <div className="flex-grow flex flex-col items-center justify-center text-center p-4">
                     <WandIcon className="w-16 h-16 mb-4 text-gray-600" />
                     <h3 className="text-2xl font-bold text-gray-400">AI Asset Generation</h3>
                     <p className="mt-2 text-gray-500 max-w-md">Describe the game asset you want to create. The AI will generate a background-free PNG sprite for you.</p>
                     <div className="flex items-center gap-2 mt-8 w-full max-w-lg">
                        <input 
                            type="text"
                            value={assetPrompt}
                            onChange={(e) => setAssetPrompt(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="e.g., a cartoon treasure chest, pixel art spaceship"
                            className="flex-grow bg-gray-900 border border-gray-700 rounded-md px-4 py-2 text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            disabled={isCreating}
                        />
                        <button 
                            onClick={handleCreate}
                            disabled={!assetPrompt.trim() || isCreating}
                            className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2 px-4 rounded-md transition-colors disabled:bg-blue-600/50 disabled:cursor-not-allowed w-32"
                        >
                            {isCreating ? <SpinnerIcon className="w-5 h-5" /> : 'Generate'}
                        </button>
                     </div>
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center h-full text-gray-600">
                    <CubeIcon className="w-16 h-16 mb-4" />
                    <h3 className="text-2xl font-bold text-gray-400">Procedural 3D Asset Generation</h3>
                    <p className="mt-2 text-lg">Coming Soon!</p>
                </div>
            )}
        </div>
    );

    return (
        <>
            <div className="fixed inset-0 bg-black/80 z-40 flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
                <div className="bg-[#121212] w-full max-w-4xl h-[80vh] rounded-lg border border-gray-800/70 flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
                    <header className="flex-shrink-0 flex items-center justify-between p-4 border-b border-gray-800/70">
                         <div className="flex items-end gap-6">
                            <h2 className="text-xl font-semibold text-gray-200">Asset Library</h2>
                            <nav className="flex items-center gap-4">
                                {(['library', 'create'] as const).map(tab => (
                                    <button 
                                        key={tab} 
                                        onClick={() => setActiveTab(tab)}
                                        className={`capitalize pb-1 border-b-2 text-sm font-medium transition-colors ${
                                            activeTab === tab 
                                            ? 'border-blue-500 text-white' 
                                            : 'border-transparent text-gray-500 hover:text-gray-300'
                                        }`}
                                    >
                                        {tab}
                                    </button>
                                ))}
                            </nav>
                        </div>
                        <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/10 text-gray-400 hover:text-white">
                            <XIcon className="w-5 h-5" />
                        </button>
                    </header>
                    <main className="flex-grow p-4 overflow-y-auto">
                        {activeTab === 'library' && LibraryTabContent}
                        {activeTab === 'create' && CreateTabContent}
                    </main>
                </div>
            </div>
            {viewingAsset && <AssetViewerModal asset={viewingAsset} onClose={() => setViewingAsset(null)} />}
        </>
    );
};

export default AssetLibrary;