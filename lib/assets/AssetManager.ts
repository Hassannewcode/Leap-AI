
export const assetManager = `
const assetCache = {};
const loadingAssets = new Set();

function loadImage(url) {
    if (assetCache[url]) {
        return assetCache[url];
    }
    if (!loadingAssets.has(url)) {
        loadingAssets.add(url);
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => {
            assetCache[url] = img;
            loadingAssets.delete(url);
        };
        img.onerror = () => {
            console.error('Failed to load image: ' + url);
            loadingAssets.delete(url);
        }
        img.src = url;
    }
    return null;
}
`;