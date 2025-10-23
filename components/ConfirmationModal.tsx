import React, { useState, useEffect } from 'react';
import { DebuggerIncident } from '../types';
import AlertTriangleIcon from './icons/AlertTriangleIcon';
import WandIcon from './icons/WandIcon';

interface ConfirmationRequest {
    action: 'quarantine' | 'allow';
    incident: DebuggerIncident;
    onConfirm: () => void;
}

interface ConfirmationModalProps {
    request: ConfirmationRequest;
    onCancel: () => void;
}

const ACTION_DETAILS = {
    quarantine: {
        title: "Confirm Quarantine",
        verb: "Quarantine",
        description: "This will attempt an immediate, non-AI action to contain the issue (e.g., removing a faulty object). This is a blunt tool that may alter gameplay.",
        buttonClass: "bg-blue-600 hover:bg-blue-500",
    },
    allow: {
        title: "Confirm Allow",
        verb: "Allow",
        description: "This will dismiss the incident. The underlying issue will not be fixed, which could lead to further errors or unexpected game behavior.",
        buttonClass: "bg-gray-600 hover:bg-gray-500",
    },
};

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ request, onCancel }) => {
    const [countdown, setCountdown] = useState(5);
    const details = ACTION_DETAILS[request.action];

    useEffect(() => {
        setCountdown(5); // Reset countdown when request changes
        const timer = setInterval(() => {
            setCountdown(prev => (prev > 0 ? prev - 1 : 0));
        }, 1000);
        return () => clearInterval(timer);
    }, [request]);

    const handleConfirm = () => {
        request.onConfirm();
        onCancel();
    };

    return (
        <div 
            className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in"
            onClick={onCancel}
            aria-modal="true"
            role="dialog"
        >
            <div 
                className="bg-[#1c1c1c] w-full max-w-lg rounded-xl border border-yellow-500/30 shadow-2xl"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex flex-col items-center text-center p-8">
                    <div className="w-16 h-16 rounded-full bg-yellow-500/10 border-4 border-yellow-500/20 flex items-center justify-center mb-4">
                         <AlertTriangleIcon className="w-8 h-8 text-yellow-400" />
                    </div>
                   
                    <h2 className="text-2xl font-bold text-gray-100">{details.title}</h2>
                    <p className="mt-2 text-gray-400">
                        {details.description}
                    </p>

                    <div className="w-full bg-black/40 p-4 rounded-lg mt-6 text-left border border-gray-700/60">
                         <h3 className="font-semibold text-gray-200 flex items-center gap-2">
                            <WandIcon className="w-4 h-4 text-yellow-300" />
                            Recommended: Neutralize (AI)
                        </h3>
                        <p className="text-sm text-gray-400 mt-1">
                            For a more reliable solution, it is highly recommended to use the <strong className="text-yellow-300">"Neutralize (AI)"</strong> option. The AI will analyze the root cause and attempt a surgical fix without disrupting gameplay.
                        </p>
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
                        onClick={handleConfirm}
                        disabled={countdown > 0}
                        className={`w-full sm:w-auto inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 text-base font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 transition-colors ${details.buttonClass} disabled:bg-gray-500/50 disabled:cursor-not-allowed`}
                    >
                        {details.verb} {countdown > 0 ? `(${countdown})` : ''}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmationModal;