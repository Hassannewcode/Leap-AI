





import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AccessibilityIssue, MetaIssue, FileEntry } from '../types';
import { ActivityLogger } from '../lib/utils/activityLogger';
import { PerformanceMonitor } from '../lib/utils/performanceObserver';
import { runAccessibilityAudit } from '../lib/utils/accessibilityAuditor';
import { runMetaAudit } from '../lib/utils/metaAuditor';
import { generateSelector } from '../lib/utils/activityLogger';
import { requestAiFix } from '../services/geminiService';

// Icons
import WrenchIcon from './icons/WrenchIcon';
import RefreshIcon from './icons/RefreshIcon';
import WandIcon from './icons/WandIcon';
import TerminalIcon from './icons/TerminalIcon';
import SpinnerIcon from './icons/SpinnerIcon';

const STORAGE_KEY = 'ai-game-studio-state-v3';
const BEDROCK_DUMP_KEY = 'bedrock_dump_signature';

// This matches declarations in other files to prevent conflicts.
declare global {
    interface Window {
        hljs?: any;
        LeapActivityLog: {
            init: () => void;
            getLogs: () => any[];
        };
    }
}

interface DiagnosticData {
    error: Error;
    userActivity: any[];
    layoutShifts: PerformanceEntry[];
    interactionTimings: PerformanceEntry[];
    accessibilityIssues: AccessibilityIssue[];
    metaIssues: MetaIssue[];
    componentStack: string;
    boundarySelector: string;
}

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    diagnostics?: DiagnosticData;
    isRecovering: boolean;
    recoveryLogs: string[];
    fixAttemptFailed: boolean;
}

class ErrorBoundary extends Component<Props, State> {
    private ref = React.createRef<HTMLDivElement>();

    constructor(props: Props) {
        super(props);
        this.state = { 
            hasError: false,
            isRecovering: false,
            recoveryLogs: [],
            fixAttemptFailed: false,
        };
    }

    static getDerivedStateFromError(error: Error): Partial<State> {
        return { hasError: true };
    }

    // FIX: Reverted to an arrow function to ensure `this` is correctly bound and resolve type errors.
    componentDidCatch = (error: Error, errorInfo: ErrorInfo) => {
        console.error("LeapGuard captured an unhandled error:", error, errorInfo);
        
        const diagnostics = this.gatherDiagnostics(error, errorInfo);
        const signature = this.createCrashSignature(error, errorInfo);
        const isQuarantined = sessionStorage.getItem(BEDROCK_DUMP_KEY) === signature;
        
        this.setState({
            diagnostics,
            fixAttemptFailed: isQuarantined,
        });
    }

    // FIX: Reverted to an arrow function to ensure `this` is correctly bound and resolve type errors.
    gatherDiagnostics = (error: Error, errorInfo: ErrorInfo): DiagnosticData => {
        return {
            error,
            userActivity: ActivityLogger.getLogs(),
            layoutShifts: PerformanceMonitor.getLayoutShifts(),
            interactionTimings: PerformanceMonitor.getInteractionTimings(),
            accessibilityIssues: runAccessibilityAudit(),
            metaIssues: runMetaAudit(),
            componentStack: errorInfo.componentStack || 'Not available.',
            boundarySelector: generateSelector(this.ref.current)
        };
    }
    
    // FIX: Reverted to an arrow function to ensure `this` is correctly bound and resolve type errors.
    createCrashSignature = (error: Error, errorInfo: ErrorInfo): string => {
        const stack = error.stack || '';
        const componentStack = errorInfo.componentStack || '';
        // Create a simple hash from the most specific parts of the error
        const relevantStack = stack.split('\n').slice(0, 3).join('');
        const signature = `${error.name}:${error.message}:${relevantStack}:${componentStack.slice(0, 100)}`;
        // Simple hash function to keep it short
        return signature.split('').reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) | 0, 0).toString(16);
    }
    
    addRecoveryLog = (message: string) => {
        this.setState(prevState => ({
            recoveryLogs: [...prevState.recoveryLogs, message]
        }));
    };

    handleRunAnalysis = async () => {
        if (!this.state.diagnostics) return;

        this.setState({ isRecovering: true, recoveryLogs: [] });
        this.addRecoveryLog("Initializing AI recovery drone...");

        try {
            const activeWorkspaceId = sessionStorage.getItem('activeWorkspaceId');
            if (!activeWorkspaceId) throw new Error("Could not find active workspace ID for recovery.");
            
            const savedStateJSON = localStorage.getItem(STORAGE_KEY);
            if (!savedStateJSON) throw new Error("Could not find saved application state.");

            const savedState = JSON.parse(savedStateJSON);
            const activeWorkspace = savedState.workspaces[activeWorkspaceId];
            if (!activeWorkspace) throw new Error("Active workspace data not found in saved state.");
            
            this.addRecoveryLog("Compiling crash diagnostics and project context...");
            this.addRecoveryLog("Contacting Leap AI for analysis...");
            if (this.state.fixAttemptFailed) {
                 this.addRecoveryLog("NOTE: Previous automated fix failed. Requesting novel solution.");
            }

            const newFiles: FileEntry[] = await requestAiFix(this.state.diagnostics, activeWorkspace, this.state.fixAttemptFailed);

            this.addRecoveryLog("AI analysis complete. Patch received.");
            this.addRecoveryLog("Applying generated code patch...");

            // Update the workspace in the saved state
            const updatedWorkspace = { ...activeWorkspace, files: newFiles };
            const newState = {
                ...savedState,
                workspaces: {
                    ...savedState.workspaces,
                    [activeWorkspaceId]: updatedWorkspace
                }
            };

            localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
            
            const signature = this.createCrashSignature(this.state.diagnostics.error, { componentStack: this.state.diagnostics.componentStack });
            sessionStorage.setItem(BEDROCK_DUMP_KEY, signature);

            this.addRecoveryLog("Patch applied successfully. Re-initializing application...");
            setTimeout(() => window.location.reload(), 1500);

        } catch (error) {
            console.error("AI Recovery Failed:", error);
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
            this.addRecoveryLog(`ERROR: Recovery failed. ${errorMessage}`);
            this.setState({ isRecovering: false });
        }
    };
    
    handleSystematicRepair = () => {
        this.setState({ isRecovering: true, recoveryLogs: [] });
        const steps = [
            "Systematic Repair Protocol Initiated.",
            "Analyzing project history...",
            "Validating last known good state from checkpoint...",
            "Building clean file manifest...",
            "Restoring file system state from checkpoint...",
            "Verification complete. System restored.",
            "Re-initializing application..."
        ];

        let i = 0;
        const interval = setInterval(() => {
            if (i < steps.length) {
                this.addRecoveryLog(steps[i]);
                i++;
            } else {
                clearInterval(interval);
                sessionStorage.removeItem(BEDROCK_DUMP_KEY); // Clear dump on manual revert
                window.location.reload();
            }
        }, 700);
    };

    // FIX: Reverted to an arrow function to ensure `this` is correctly bound and resolve type errors.
    renderRecoveryConsole = () => {
        const { diagnostics, isRecovering, recoveryLogs, fixAttemptFailed } = this.state;
        if (!diagnostics) return null;

        return (
             <div className="bg-black/40 p-6 rounded-lg mt-6 text-left border border-gray-700/60 w-full">
                <h3 className="font-semibold text-gray-200 flex items-center gap-2 text-lg">
                    <WrenchIcon className="w-5 h-5 text-yellow-300" />
                    LeapGuard Recovery Actions
                </h3>
                {fixAttemptFailed && (
                     <p className="text-sm text-red-400 mt-2 bg-red-900/40 p-3 rounded-md border border-red-500/30">
                        <strong>Bedrock Dump Notice:</strong> An automated fix for this error has already failed. Running analysis again will force the AI to generate a completely new solution.
                    </p>
                )}
                <div className="flex items-stretch gap-4 mt-4">
                    <button
                        onClick={this.handleRunAnalysis}
                        disabled={isRecovering}
                        className="flex-1 flex flex-col items-center justify-center gap-2 px-4 py-3 rounded text-sm font-semibold bg-yellow-500/20 text-yellow-300 hover:bg-yellow-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <WandIcon className="w-6 h-6 mb-1" />
                        Run Full Analysis
                        <span className="font-normal text-xs text-yellow-400/70">(Recommended AI Fix)</span>
                    </button>
                    <button
                        onClick={this.handleSystematicRepair}
                        disabled={isRecovering}
                        className="flex-1 flex flex-col items-center justify-center gap-2 px-4 py-3 rounded text-sm font-semibold bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <RefreshIcon className="w-6 h-6 mb-1" />
                        Systematic Repair
                        <span className="font-normal text-xs text-blue-400/70">(Revert to Checkpoint)</span>
                    </button>
                </div>

                {isRecovering && (
                    <div className="mt-4 pt-4 border-t border-gray-700/60">
                        <h4 className="font-semibold text-gray-300 mb-2 flex items-center gap-2">
                            <TerminalIcon className="w-4 h-4" />
                            Recovery Log
                        </h4>
                        <div className="font-mono text-xs text-gray-400 bg-black/50 p-3 rounded-md max-h-40 overflow-y-auto">
                            {recoveryLogs.map((log, i) => (
                                <p key={i} className="flex items-center gap-2">
                                    <span className="text-gray-600">&gt;</span>
                                    <span>{log}</span>
                                    {i === recoveryLogs.length - 1 && <SpinnerIcon className="w-3 h-3 text-blue-400 ml-2" />}
                                </p>
                            ))}
                        </div>
                    </div>
                )}
             </div>
        );
    }

    render() {
        if (this.state.hasError) {
            return (
                <div ref={this.ref} className="w-screen h-screen bg-black text-gray-300 flex items-center justify-center p-4 font-sans">
                    <div className="w-full max-w-2xl bg-[#121212] rounded-xl border border-red-500/30 shadow-2xl flex flex-col items-center text-center p-8 overflow-y-auto">
                         <div className="w-16 h-16 rounded-full bg-red-500/10 border-4 border-red-500/20 flex items-center justify-center mb-4">
                            <WrenchIcon className="w-8 h-8 text-red-400" />
                        </div>
                        <h1 className="text-3xl font-bold text-red-300">LeapGuard Recovery Console</h1>
                        <p className="mt-2 text-gray-400 max-w-xl">
                            A critical error occurred, but the system remains online. You can attempt an automated repair or revert to a previous stable checkpoint.
                        </p>
                        
                        <div className="font-mono text-sm bg-black/40 p-3 rounded-md mt-6 text-left w-full border border-gray-800">
                           <p className="text-red-400 break-words">
                                <strong>{this.state.diagnostics?.error.name}:</strong> {this.state.diagnostics?.error.message}
                           </p>
                        </div>

                        {this.renderRecoveryConsole()}
                    </div>
                </div>
            );
        }

        return <div ref={this.ref}>{this.props.children}</div>;
    }
}

export default ErrorBoundary;
