import React, { useState, useCallback, useRef, createContext, useContext, useEffect } from 'react';

// --- Context for panel group ---
interface ResizablePanelContextProps {
  registerPanel: (id: string, initialSize: number) => void;
  startDragging: (event: React.MouseEvent, leftPanelId: string, rightPanelId: string) => void;
  sizes: Record<string, number>;
  direction: 'horizontal' | 'vertical';
}

const ResizablePanelContext = createContext<ResizablePanelContextProps | null>(null);

const useResizablePanel = () => {
    const context = useContext(ResizablePanelContext);
    if (!context) {
        throw new Error('useResizablePanel must be used within a ResizablePanelGroup');
    }
    return context;
}

// --- Panel Group Component ---
interface ResizablePanelGroupProps {
    children: React.ReactNode;
    direction?: 'horizontal' | 'vertical';
    className?: string;
}

export const ResizablePanelGroup: React.FC<ResizablePanelGroupProps> = ({ children, direction = 'horizontal', className }) => {
    const [sizes, setSizes] = useState<Record<string, number>>({});
    const dragData = useRef<{ leftId: string; rightId: string; startPos: number; leftStartSize: number; rightStartSize: number; totalSize: number; } | null>(null);

    const registerPanel = useCallback((id: string, initialSize: number) => {
        setSizes(prev => {
            if (prev.hasOwnProperty(id)) return prev;
            return {...prev, [id]: initialSize };
        });
    }, []);
    
    const startDragging = useCallback((event: React.MouseEvent, leftPanelId: string, rightPanelId: string) => {
        event.preventDefault();
        const groupEl = (event.target as HTMLElement).parentElement;
        if (!groupEl) return;
        
        dragData.current = {
            leftId: leftPanelId,
            rightId: rightPanelId,
            startPos: direction === 'horizontal' ? event.clientX : event.clientY,
            leftStartSize: sizes[leftPanelId],
            rightStartSize: sizes[rightPanelId],
            totalSize: direction === 'horizontal' ? groupEl.offsetWidth : groupEl.offsetHeight
        };
        document.addEventListener('mousemove', handleDragging);
        document.addEventListener('mouseup', stopDragging);
    }, [sizes, direction]);

    const handleDragging = useCallback((event: MouseEvent) => {
        if (!dragData.current || dragData.current.totalSize === 0) return;
        
        const { leftId, rightId, startPos, leftStartSize, rightStartSize, totalSize } = dragData.current;
        
        const currentPos = direction === 'horizontal' ? event.clientX : event.clientY;
        const delta = currentPos - startPos;
        const deltaPercent = (delta / totalSize) * 100;

        let newLeftSize = leftStartSize + deltaPercent;
        let newRightSize = rightStartSize - deltaPercent;
        
        const minSize = 10; // Minimum size in percent
        const totalPairSize = leftStartSize + rightStartSize;

        if (newLeftSize < minSize) {
            newLeftSize = minSize;
            newRightSize = totalPairSize - minSize;
        }
        if (newRightSize < minSize) {
            newRightSize = minSize;
            newLeftSize = totalPairSize - minSize;
        }

        setSizes(prev => ({
            ...prev,
            [leftId]: newLeftSize,
            [rightId]: newRightSize
        }));
    }, [direction]);

    const stopDragging = useCallback(() => {
        dragData.current = null;
        document.removeEventListener('mousemove', handleDragging);
        document.removeEventListener('mouseup', stopDragging);
    }, [handleDragging]);

    const contextValue = { registerPanel, startDragging, sizes, direction };

    return (
        <ResizablePanelContext.Provider value={contextValue}>
            <div className={`flex ${direction === 'horizontal' ? 'flex-row' : 'flex-col'} w-full h-full ${className}`}>
                {children}
            </div>
        </ResizablePanelContext.Provider>
    );
};

// --- Panel Component ---
interface PanelProps {
  children: React.ReactNode;
  id: string;
  defaultSize?: number;
  className?: string;
}
export const Panel: React.FC<PanelProps> = ({ children, id, defaultSize = 50, className }) => {
    const { registerPanel, sizes } = useResizablePanel();

    useEffect(() => {
      registerPanel(id, defaultSize);
    }, [id, defaultSize, registerPanel]);
    
    const size = sizes[id] || defaultSize;

    const style: React.CSSProperties = {
        flex: `1 0 ${size}%`, // grow, shrink, basis
        overflow: 'hidden'
    };
    
    return (
        <div 
            id={`panel-${id}`}
            className={className}
            style={style}
        >
            {children}
        </div>
    );
};

// --- Resize Handle Component ---
export const ResizeHandle: React.FC<{leftPanelId: string, rightPanelId: string}> = ({ leftPanelId, rightPanelId }) => {
    const { startDragging, direction } = useResizablePanel();

    const onMouseDown = (e: React.MouseEvent) => {
        startDragging(e, leftPanelId, rightPanelId);
    };

    const classNames = direction === 'horizontal'
        ? "w-1.5 cursor-col-resize"
        : "h-1.5 cursor-row-resize";

    return (
        <div 
            onMouseDown={onMouseDown}
            className={`${classNames} bg-gray-800/70 hover:bg-blue-500/80 transition-colors duration-200 flex-shrink-0`}
            aria-label="Resize handle"
            role="separator"
        />
    );
};
