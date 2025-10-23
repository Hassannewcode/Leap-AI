import React from 'react';
import ShieldIcon from './icons/ShieldIcon';

interface DebuggerWidgetProps {
    incidentCount: number;
    highestThreatLevel: 'trusted' | 'untrusted' | null;
    onClick: () => void;
}

const DebuggerWidget: React.FC<DebuggerWidgetProps> = ({ incidentCount, highestThreatLevel, onClick }) => {
    
    const { bgColor, pulseClass, textColor, tooltip } = React.useMemo(() => {
        if (highestThreatLevel === 'untrusted') {
            return {
                bgColor: 'bg-red-600/90',
                pulseClass: 'animate-pulse',
                textColor: 'text-white',
                tooltip: 'Critical threats detected!'
            };
        }
        if (highestThreatLevel === 'trusted') {
            return {
                bgColor: 'bg-yellow-500/90',
                pulseClass: 'animate-pulse',
                textColor: 'text-black',
                tooltip: 'Potential threats detected.'
            };
        }
        return {
            bgColor: 'bg-green-600/90',
            pulseClass: '',
            textColor: 'text-white',
            tooltip: 'LeapGuard is active. System stable.'
        };
    }, [highestThreatLevel]);

    return (
        <button
            onClick={onClick}
            className={`group fixed bottom-4 right-4 z-50 flex items-center justify-center gap-2 h-12 w-12 rounded-full shadow-lg border-2 border-white/20 backdrop-blur-md transition-all duration-300 hover:w-44 ${bgColor} ${pulseClass}`}
            aria-label="Open LeapGuard Security Console"
            title={tooltip}
        >
            <ShieldIcon className={`w-6 h-6 transition-colors ${textColor}`} />
            
            <span className="text-sm font-semibold opacity-0 group-hover:opacity-100 transition-opacity delay-150 duration-200 whitespace-nowrap overflow-hidden text-ellipsis text-white">
                LeapGuard
            </span>

            {incidentCount > 0 && (
                <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center border-2 border-[#121212]">
                    {incidentCount}
                </div>
            )}
        </button>
    );
};

export default DebuggerWidget;