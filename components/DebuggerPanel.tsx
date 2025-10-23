import React, { useRef, useEffect } from 'react';
import { DebuggerIncident } from '../types';
import TrashIcon from './icons/TrashIcon';
import AIIcon from './icons/AIIcon';
import WandIcon from './icons/WandIcon';
import ShieldIcon from './icons/ShieldIcon';
import ChevronDownIcon from './icons/ChevronDownIcon';

interface DebuggerPanelProps {
    incidents: DebuggerIncident[];
    onClear: () => void;
    onAutoFix: (incident: DebuggerIncident) => void;
}

const IncidentCard: React.FC<{ incident: DebuggerIncident; onAutoFix: (incident: DebuggerIncident) => void; }> = ({ incident, onAutoFix }) => {
    const { threatLevel, suspect, message, evidence, timestamp } = incident;

    const colors = threatLevel === 'untrusted' ? {
        text: 'text-red-400',
        bg: 'bg-red-900/40',
        border: 'border-red-500/30',
        accent: 'border-l-red-500'
    } : {
        text: 'text-yellow-300',
        bg: 'bg-yellow-900/30',
        border: 'border-yellow-500/20',
        accent: 'border-l-yellow-400'
    };

    return (
        <details className={`group relative mb-2 rounded-md border-l-4 transition-colors ${colors.accent} ${colors.bg}`} open>
            <summary className="flex items-center justify-between p-2 cursor-pointer list-none hover:bg-white/5">
                <div className="flex items-center gap-3">
                    <ShieldIcon className={`w-5 h-5 flex-shrink-0 ${colors.text}`} />
                    <div className="flex-1">
                        <div className="font-bold uppercase text-xs tracking-wider">
                            <span className={colors.text}>{threatLevel} THREAT DETECTED</span>
                        </div>
                        <p className="text-gray-300 text-sm mt-0.5">{message}</p>
                    </div>
                </div>
                 <button 
                    onClick={(e) => { e.preventDefault(); onAutoFix(incident); }}
                    className="ml-4 flex-shrink-0 bg-yellow-500/10 text-yellow-300 px-2 py-1 rounded text-xs font-semibold hover:bg-yellow-500/30 flex items-center gap-1.5 transition-all opacity-0 group-hover:opacity-100"
                    title="Ask AI to fix the root cause of this incident"
                >
                    <WandIcon className="w-3.5 h-3.5" />
                    Neutralize
                </button>
                <ChevronDownIcon className="w-4 h-4 text-gray-500 transition-transform group-open:rotate-180 flex-shrink-0 ml-2" />
            </summary>
            <div className="border-t border-white/10 p-3 text-xs">
                <div className="grid grid-cols-3 gap-x-4 gap-y-1">
                     <div className="text-gray-500">Timestamp</div>
                     <div className="col-span-2 text-gray-400">{new Date(timestamp).toLocaleTimeString()}</div>
                     <div className="text-gray-500">Suspect</div>
                     <div className="col-span-2 text-gray-400">{suspect}</div>
                </div>
                {evidence.stack && (
                    <div className="mt-3 pt-2 border-t border-white/5">
                        <h4 className="font-semibold text-gray-400 mb-1">Evidence: Stack Trace</h4>
                        <pre className="whitespace-pre-wrap break-all text-gray-500 bg-black/30 p-2 rounded-md max-h-40 overflow-y-auto">{evidence.stack}</pre>
                    </div>
                )}
                 {evidence.context && Object.keys(evidence.context).length > 0 && (
                    <div className="mt-3 pt-2 border-t border-white/5">
                        <h4 className="font-semibold text-gray-400 mb-1">Evidence: Context</h4>
                        <pre className="whitespace-pre-wrap break-all text-gray-500 bg-black/30 p-2 rounded-md max-h-40 overflow-y-auto">{JSON.stringify(evidence.context, null, 2)}</pre>
                    </div>
                )}
            </div>
        </details>
    );
};


const DebuggerPanel: React.FC<DebuggerPanelProps> = ({ incidents, onClear, onAutoFix }) => {
    const incidentsEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const el = incidentsEndRef.current;
        if (el) {
            const parent = el.parentElement;
            if (parent && parent.scrollHeight - parent.scrollTop < parent.clientHeight + 100) {
                 el.scrollIntoView({ behavior: 'smooth' });
            }
        }
    }, [incidents]);
    
    // Sort incidents to show untrusted threats first, then by most recent
    const sortedIncidents = [...incidents].sort((a, b) => {
        if (a.threatLevel === 'untrusted' && b.threatLevel !== 'untrusted') return -1;
        if (a.threatLevel !== 'untrusted' && b.threatLevel === 'untrusted') return 1;
        return b.timestamp - a.timestamp;
    });

    return (
        <div className="flex flex-col h-full bg-[#0d0d0d] font-mono text-xs text-gray-400">
             <header className="flex-shrink-0 bg-[#121212] border-b border-gray-800/70 flex justify-between items-center px-3 py-1 h-[33px]">
                <p className="text-gray-400 text-xs font-semibold tracking-wider">LeapGuard Security Console</p>
                <div className="flex items-center gap-2">
                    <button 
                        onClick={onClear} 
                        className="p-1 text-gray-400 rounded hover:bg-white/10 hover:text-white" 
                        aria-label="Clear incidents"
                        title="Clear incidents"
                    >
                        <TrashIcon className="w-4 h-4" />
                    </button>
                </div>
            </header>
            <div className="flex-grow p-2 overflow-y-auto">
                {sortedIncidents.length === 0 ? (
                    <div className="text-gray-500 italic p-2">No threats detected. LeapGuard is actively monitoring the runtime.</div>
                ) : (
                    sortedIncidents.map((incident) => (
                       <IncidentCard key={incident.id} incident={incident} onAutoFix={onAutoFix} />
                    ))
                )}
                <div ref={incidentsEndRef} />
            </div>
        </div>
    );
};

export default DebuggerPanel;