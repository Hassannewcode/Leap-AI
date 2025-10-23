
import React, { useRef, useEffect } from 'react';
import { FileEntry, LocalAsset, DebuggerIncident } from '../types';

interface GamePreviewProps {
    files: FileEntry[];
    isVisualEditMode: boolean;
    localAssets: LocalAsset[];
    quarantineRequest: DebuggerIncident | null;
    onQuarantineComplete: () => void;
}

const mimeTypeMap: { [key: string]: string } = {
    js: 'text/javascript',
    css: 'text/css',
    json: 'application/json',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    webp: 'image/webp',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    mp4: 'video/mp4',
    webm: 'video/webm',
    ttf: 'font/ttf',
    otf: 'font/otf',
    woff: 'font/woff',
    woff2: 'font/woff2',
};

const dataURLtoBlob = (dataurl: string): Blob | null => {
    const arr = dataurl.split(',');
    if (arr.length < 2) return null;
    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch) return null;
    const mime = mimeMatch[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
}

const GamePreview: React.FC<GamePreviewProps> = ({ files, isVisualEditMode, localAssets, quarantineRequest, onQuarantineComplete }) => {
    const iframeRef = useRef<HTMLIFrameElement | null>(null);
    
    useEffect(() => {
        const iframe = iframeRef.current;
        if (iframe && iframe.contentWindow) {
            iframe.contentWindow.postMessage({
                type: 'visual-editor-toggle',
                payload: { enabled: isVisualEditMode }
            }, '*');
        }
    }, [isVisualEditMode]);

    useEffect(() => {
        if (quarantineRequest && iframeRef.current?.contentWindow) {
            iframeRef.current.contentWindow.postMessage({
                type: 'quarantine-incident',
                payload: quarantineRequest
            }, '*');
            onQuarantineComplete();
        }
    }, [quarantineRequest, onQuarantineComplete]);


    useEffect(() => {
        const iframe = iframeRef.current;
        if (!iframe || files.length === 0) return;

        const indexHtmlFile = files.find(f => f.path === 'index.html');
        if (!indexHtmlFile) {
            iframe.srcdoc = '<h1>Error: index.html not found.</h1>';
            return;
        }

        const createdUrls: string[] = [];

        try {
            const resolvedAssetUrlMap = new Map<string, string>();

            // 1. Process project files to create a map of final URLs (either blob or remote)
            files.forEach(file => {
                const normalizedPath = file.path.replace(/^\.?\//, '');
                const content = file.content.trim();

                let isRemoteUrl = false;
                if (content.startsWith('http://') || content.startsWith('https://')) {
                    try {
                        new URL(content); // Validate if the content is a URL
                        isRemoteUrl = true;
                    } catch (e) {
                        // Not a valid URL, treat as regular content
                    }
                }
                
                if (isRemoteUrl) {
                    resolvedAssetUrlMap.set(normalizedPath, content);
                } else {
                    const extension = file.path.split('.').pop()?.toLowerCase() || '';
                    const mimeType = mimeTypeMap[extension] || 'application/octet-stream';
                    const blob = new Blob([file.content], { type: mimeType });
                    const url = URL.createObjectURL(blob);
                    createdUrls.push(url);
                    resolvedAssetUrlMap.set(normalizedPath, url);
                }
            });

            // 2. Create blob URLs for local, user-uploaded assets
            localAssets.forEach(asset => {
                const blob = dataURLtoBlob(asset.dataUrl);
                if (blob) {
                    const url = URL.createObjectURL(blob);
                    createdUrls.push(url);
                    const localPath = `local://${asset.name}`;
                    resolvedAssetUrlMap.set(localPath, url);
                }
            });

            const parser = new DOMParser();
            const doc = parser.parseFromString(indexHtmlFile.content, 'text/html');

            // 3. Find and replace all relative paths with their resolved URLs.
            doc.querySelectorAll('[src], [href]').forEach(el => {
                const src = el.getAttribute('src');
                const href = el.getAttribute('href');
                const attributeName = src !== null ? 'src' : 'href';
                const pathValue = src || href;

                if (pathValue && !pathValue.startsWith('http') && !pathValue.startsWith('data:') && !pathValue.startsWith('blob:')) {
                    const normalizedPath = pathValue.startsWith('local://') ? pathValue : pathValue.replace(/^\.?\//, '');
                    const resolvedUrl = resolvedAssetUrlMap.get(normalizedPath);

                    if (resolvedUrl) {
                        el.setAttribute(attributeName, resolvedUrl);
                    } else {
                        console.warn(`Could not find a resolved URL for path: ${pathValue}`);
                    }
                }
            });
            
            const handleLoad = () => {
                if (iframe.contentWindow) {
                    iframe.contentWindow.postMessage({
                        type: 'visual-editor-toggle',
                        payload: { enabled: isVisualEditMode }
                    }, '*');
                }
            };
            
            iframe.addEventListener('load', handleLoad, { once: true });

            iframe.srcdoc = doc.documentElement.outerHTML;

        } catch (error) {
            console.error("Error creating game preview:", error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            iframe.srcdoc = `<h1>Error Creating Preview</h1><pre>${errorMessage}</pre>`;
        }
        
        return () => {
            createdUrls.forEach(url => URL.revokeObjectURL(url));
        };
    }, [files, localAssets]);

    return (
        <iframe
            ref={iframeRef}
            title="Game Preview"
            sandbox="allow-scripts allow-same-origin"
            className="w-full h-full border-0"
            allow="fullscreen"
        />
    );
};

export default GamePreview;
