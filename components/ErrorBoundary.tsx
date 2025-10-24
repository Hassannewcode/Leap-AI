// FIX: Add LeapGuard to the global Window interface to fix TypeScript errors.
declare global {
  interface Window {
    LeapGuard?: {
      reportIncident: (
        threatLevel: 'trusted' | 'untrusted',
        suspect: string,
        message: string,
        context?: any
      ) => void;
    };
    // FIX: Made LeapActivityLog non-optional and added the 'init' method to match the actual implementation in activityLogger.ts.
    // This resolves the global type conflict that caused errors in multiple files.
    LeapActivityLog: {
        init: () => void;
        getLogs: () => any[];
    };
  }
}

import React, { Component, ErrorInfo, ReactNode } from 'react';
import ShieldIcon from './icons/ShieldIcon';
import { sendMessageToAi } from '../services/geminiService';
import { extractJsonFromString } from '../lib/utils/json';
import WandIcon from './icons/WandIcon';
import SpinnerIcon from './icons/SpinnerIcon';
import { Workspace, ModelChatMessage, FileEntry, AccessibilityIssue, MetaIssue } from '../types';
import RefreshIcon from './icons/RefreshIcon';
import XIcon from './icons/XIcon';
import { PerformanceMonitor } from '../lib/utils/performanceObserver';
import { runAccessibilityAudit } from '../lib/utils/accessibilityAuditor';
import { runMetaAudit } from '../lib/utils/metaAuditor';

// New Icons
import LogsIcon from './icons/LogsIcon';
import TracingIcon from './icons/TracingIcon';
import LayoutShiftsIcon from './icons/LayoutShiftsIcon';
import InteractionTimingIcon from './icons/InteractionTimingIcon';
import AccessibilityIcon from './icons/AccessibilityIcon';
import OpenGraphIcon from './icons/OpenGraphIcon';


type LogLevel = 'INFO' | 'SUCCESS' | 'WARN' | 'ERROR' | 'AI';
type AnalysisStatus = 'idle' | 'running' | 'cancelled' | 'failed_retryable' | 'failed_final' | 'success_fix' | 'success_revert';
type ErrorType = 'game' | 'ide' | 'unknown';

interface AnalysisLogEntry {
    id: number;
    level: LogLevel;
    message: string;
    timestamp: string;
}

interface DiagnosticData {
    layoutShifts: PerformanceEntry[];
    longInteractions: PerformanceEventTiming[];
    accessibilityIssues: AccessibilityIssue[];
    metaIssues: MetaIssue[];
    userActivityLogs: any[];
}

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorType: ErrorType;
  
  // Recovery Console State
  logs: AnalysisLogEntry[];
  status: AnalysisStatus;
  failureCount: number;
  isAnalyzing: boolean;
  elapsedTime: number;

  // Diagnostic Data
  diagnosticData: DiagnosticData | null;
}

const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

const DiagnosticItem: React.FC<{
    icon: React.ReactNode;
    label: string;
    value: string | number;
    colorClass: string;
    tooltip: string;
}> = ({ icon, label, value, colorClass, tooltip }) => (
    <div className="flex items-center justify-between p-2 rounded-md hover:bg-white/5" title={tooltip}>
        <div className="flex items-center gap-3">
            {icon}
            <span className="text-sm text-gray-300">{label}</span>
        </div>
        <span className={`text-sm font-semibold px-2 py-0.5 rounded-full ${colorClass}`}>
            {value}
        </span>
    </div>
);

class ErrorBoundary extends Component<Props, State> {
  private analysisTimer: number | undefined;
  private analysisAbortController: AbortController | null = null;

  constructor(props: Props) {
    super(props);
    // FIX: Moved state initialization into the constructor to resolve issues with 'this.setState' and 'this.props' not being found on the component type.
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorType: 'unknown',
      logs: [],
      status: 'idle',
      failureCount: 0,
      isAnalyzing: false,
      elapsedTime: 0,
      diagnosticData: null,
    };
  }

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    
    const errorType = errorInfo.componentStack?.includes('GamePreview') ? 'game' : 'ide';

    const diagnosticData: DiagnosticData = {
        accessibilityIssues: runAccessibilityAudit(),
        metaIssues: runMetaAudit(),
        layoutShifts: PerformanceMonitor.getLayoutShifts(),
        longInteractions: PerformanceMonitor.getLongInteractions(),
        userActivityLogs: window.LeapActivityLog ? window.LeapActivityLog.getLogs() : [],
    };
    
    this.setState({
        errorInfo,
        errorType,
        diagnosticData,
    });

    if (window.LeapGuard && typeof window.LeapGuard.reportIncident === 'function') {
        window.LeapGuard.reportIncident(
            'untrusted',
            'React Render Exception',
            error.message,
            { error, componentStack: errorInfo.componentStack }
        );
    }
  }

  componentWillUnmount() {
    if (this.analysisTimer) {
        clearInterval(this.analysisTimer);
    }
  }

  addLog = (level: LogLevel, message: string) => {
    this.setState(prevState => ({
      logs: [...prevState.logs, {
        id: prevState.logs.length,
        level,
        message,
        timestamp: new Date().toLocaleTimeString()
      }]
    }));
  };

  startTimer = () => {
    this.stopTimer();
    this.setState({ elapsedTime: 0 });
    this.analysisTimer = window.setInterval(() => {
        this.setState(prev => ({ elapsedTime: prev.elapsedTime + 1 }));
    }, 1000);
  };
  
  stopTimer = () => {
      if (this.analysisTimer) {
        clearInterval(this.analysisTimer);
        this.analysisTimer = undefined;
      }
  };

  handleCancelAnalysis = () => {
    if (this.analysisAbortController) {
        this.analysisAbortController.abort();
    }
    this.setState({ isAnalyzing: false, status: 'cancelled' });
    this.stopTimer();
    this.addLog('WARN', 'Analysis cancelled by user.');
  };

  handleQuickFix = async () => {
    this.setState({ logs: [], isAnalyzing: true, status: 'running', failureCount: 0 });
    this.startTimer();
    this.addLog('INFO', 'Attempting Quick Fix: Revert to Last Checkpoint...');

    try {
        await sleep(500);
        this.addLog('INFO', 'Accessing project state from localStorage...');
        const savedStateJSON = localStorage.getItem('ai-game-studio-state-v3');
        if (!savedStateJSON) throw new Error("No saved project state found.");

        const savedState = JSON.parse(savedStateJSON);
        const activeId = savedState.activeWorkspaceId;
        const activeWs: Workspace | undefined = savedState.workspaces?.[activeId];
        if (!activeWs) throw new Error("Could not find active workspace in saved state.");
        
        this.addLog('INFO', 'Searching for the latest valid checkpoint...');
        await sleep(500);

        let lastCheckpoint = null;
        for (let i = activeWs.chatHistory.length - 1; i >= 0; i--) {
            const msg = activeWs.chatHistory[i] as ModelChatMessage;
            if (msg.role === 'model' && msg.checkpoint && msg.checkpoint.length > 0) {
                lastCheckpoint = msg.checkpoint;
                break;
            }
        }

        if (!lastCheckpoint) {
            throw new Error("No valid checkpoint found in project history.");
        }
        
        this.addLog('SUCCESS', 'Valid checkpoint found. Applying revert...');
        await sleep(500);

        const revertedWorkspace = { ...activeWs, files: lastCheckpoint, lastModified: Date.now() };
        const newWorkspaces = { ...savedState.workspaces, [activeId]: revertedWorkspace };
        localStorage.setItem('ai-game-studio-state-v3', JSON.stringify({ ...savedState, workspaces: newWorkspaces }));
        
        this.addLog('SUCCESS', 'Project successfully reverted. Please reload the application.');
        this.setState({ status: 'success_revert' });

    } catch (error) {
        const message = error instanceof Error ? error.message : "An unknown error occurred.";
        this.addLog('ERROR', `Quick Fix Failed: ${message}`);
        this.setState({ status: 'failed_final' });
    } finally {
        this.setState({ isAnalyzing: false });
        this.stopTimer();
    }
  };


  runFullAnalysis = async () => {
    this.analysisAbortController = new AbortController();
    const { signal } = this.analysisAbortController;
    
    this.setState(prev => ({ 
        logs: [], 
        isAnalyzing: true, 
        status: 'running', 
        failureCount: prev.status.startsWith('failed') ? prev.failureCount : 0 
    }));
    this.startTimer();

    const checkCancellation = () => {
        if (signal.aborted) throw new Error('Analysis was cancelled.');
    };

    try {
        this.addLog('INFO', `Starting full analysis (Attempt ${this.state.failureCount + 1} of 3)...`);
        await sleep(500); checkCancellation();

        this.addLog('INFO', 'Accessing last known project state from local storage...');
        const savedStateJSON = localStorage.getItem('ai-game-studio-state-v3');
        if (!savedStateJSON) throw new Error("No saved project state found in localStorage.");
        
        const savedState = JSON.parse(savedStateJSON);
        const activeWorkspaceId = savedState.activeWorkspaceId;
        const activeWorkspace: Workspace | undefined = savedState.workspaces?.[activeWorkspaceId];
        if (!activeWorkspace) throw new Error("No active workspace found.");
        this.addLog('SUCCESS', `Loaded project: ${activeWorkspace.name}`);
        await sleep(500); checkCancellation();

        this.addLog('AI', 'Compiling diagnostic report for AI...');
        
        const diagnosticReport = `
Diagnostic Report:
- Error: ${this.state.error?.message}
- Error Type: ${this.state.errorType} (either 'game' or 'ide')
- Component Stack:
${this.state.errorInfo?.componentStack}

--- Additional Telemetry ---
- User Activity Trace (last 15 actions):
${JSON.stringify(this.state.diagnosticData?.userActivityLogs.slice(-15), null, 2)}

- Layout Shift Events (CLS): ${this.state.diagnosticData?.layoutShifts.length || 0} shifts detected.
- Long Interaction Events (INP): ${this.state.diagnosticData?.longInteractions.length || 0} slow interactions detected.

- Accessibility Audit Violations:
${JSON.stringify(this.state.diagnosticData?.accessibilityIssues, null, 2)}

- Meta & SEO Tag Audit:
${JSON.stringify(this.state.diagnosticData?.metaIssues, null, 2)}
`;
        this.addLog('INFO', 'Diagnostic report compiled.');
        this.addLog('AI', "Escalating to 'gemini-2.5-pro' for deep analysis...");
        
        const fixPrompt = `[LEAP_AI_FIX_REQUEST] My application crashed with a React rendering error. This is a fatal flaw. Please analyze the entire project's code and the comprehensive diagnostic report below to fix the root cause. The "Error Type" field will tell you if the crash was in the user's 'game' code or the IDE's internal 'ide' code. Focus your fix on the correct area.
        ${diagnosticReport}
Please provide a complete and robust fix.`;
        
        const response = await sendMessageToAi(activeWorkspace, fixPrompt, null, 'team');
        checkCancellation();

        this.addLog('AI', 'AI response received. Validating patch...');
        const jsonResponse = extractJsonFromString(response.text);

        if (!jsonResponse || !Array.isArray(jsonResponse.files) || jsonResponse.files.length === 0) {
            throw new Error("AI returned an invalid response or did not provide file updates.");
        }
        
        this.addLog('SUCCESS', 'AI patch is valid. Applying changes...');
        await sleep(500);

        const updatedWorkspace = { ...activeWorkspace, files: jsonResponse.files, lastModified: Date.now() };
        const newWorkspaces = { ...savedState.workspaces, [activeWorkspaceId]: updatedWorkspace };
        localStorage.setItem('ai-game-studio-state-v3', JSON.stringify({ ...savedState, workspaces: newWorkspaces }));

        this.addLog('SUCCESS', 'Fix applied successfully! Please reload the application.');
        this.setState({ status: 'success_fix' });

    } catch (error) {
        if (signal.aborted) return;
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        this.addLog('ERROR', `Analysis Failed: ${errorMessage}`);
        
        const newFailureCount = this.state.failureCount + 1;
        this.setState({ failureCount: newFailureCount });

        if (newFailureCount >= 3) {
            this.addLog('ERROR', 'Maximum retry attempts reached. Automated analysis failed.');
            this.setState({ status: 'failed_final' });
        } else {
            this.setState({ status: 'failed_retryable' });
        }
    } finally {
        this.setState({ isAnalyzing: false });
        this.stopTimer();
    }
  };

  public render() {
    if (this.state.hasError) {
        const { status, isAnalyzing, logs, failureCount, elapsedTime, error, errorType, diagnosticData } = this.state;
        
        const isGameError = errorType === 'game';

        const logColorMap: Record<LogLevel, string> = {
            INFO: 'text-gray-400',
            SUCCESS: 'text-green-400',
            WARN: 'text-yellow-400',
            ERROR: 'text-red-400',
            AI: 'text-blue-400',
        };
        
        const ds = diagnosticData;
        const longestInteraction = ds ? Math.max(0, ...ds.longInteractions.map(i => i.duration)) : 0;

      return (
        <div className="w-screen h-screen bg-black flex flex-col items-center justify-center p-4 sm:p-8 text-gray-300 font-sans">
            <div className="w-full max-w-5xl h-full flex flex-col">
                <header className="flex-shrink-0 flex flex-col sm:flex-row items-center justify-between gap-4 pb-4 border-b border-gray-800">
                     <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-red-900/50 border-2 border-red-500/30 flex items-center justify-center">
                            <ShieldIcon className="w-6 h-6 text-red-400" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-red-400">{isGameError ? 'Game Engine Failure' : 'LeapGuard Recovery Console'}</h1>
                            <p className="text-sm text-gray-500">{isGameError ? "An unrecoverable error in your game's code was caught." : 'A critical application error was caught.'}</p>
                        </div>
                    </div>
                </header>
                
                <main className="flex-grow flex flex-col md:flex-row gap-4 py-4 overflow-hidden">
                    <div className="flex-shrink-0 md:w-1/3 h-auto md:h-full flex flex-col bg-gray-900/50 rounded-lg border border-gray-800 p-3">
                        <h2 className="text-base font-semibold text-gray-400 mb-2 px-2">System Diagnostics</h2>
                        <div className="space-y-1">
                            {ds && <>
                                <DiagnosticItem icon={<LogsIcon className="w-5 h-5 text-gray-400"/>} label="My Logs" value={ds.userActivityLogs.length} colorClass="bg-gray-700 text-gray-300" tooltip="Total user actions logged before crash." />
                                <DiagnosticItem icon={<TracingIcon className="w-5 h-5 text-gray-400"/>} label="Tracing..." value="Active" colorClass="bg-green-800 text-green-300" tooltip="User activity tracing is active." />
                                <DiagnosticItem icon={<LayoutShiftsIcon className="w-5 h-5 text-gray-400"/>} label="Layout Shifts" value={ds.layoutShifts.length} colorClass={ds.layoutShifts.length > 0 ? "bg-red-800 text-red-300" : "bg-gray-700 text-gray-300"} tooltip="Cumulative Layout Shift events detected." />
                                <DiagnosticItem icon={<InteractionTimingIcon className="w-5 h-5 text-gray-400"/>} label="Interaction Timing" value={`${longestInteraction.toFixed(0)}ms`} colorClass={longestInteraction > 100 ? "bg-yellow-800 text-yellow-300" : "bg-gray-700 text-gray-300"} tooltip="Longest interaction time before next paint." />
                                <DiagnosticItem icon={<AccessibilityIcon className="w-5 h-5 text-gray-400"/>} label="Accessibility Audit" value={ds.accessibilityIssues.length} colorClass={ds.accessibilityIssues.length > 0 ? "bg-red-800 text-red-300" : "bg-gray-700 text-gray-300"} tooltip="Accessibility violations found." />
                                <DiagnosticItem icon={<OpenGraphIcon className="w-5 h-5 text-gray-400"/>} label="Open Graph" value={ds.metaIssues.length} colorClass={ds.metaIssues.length > 0 ? "bg-yellow-800 text-yellow-300" : "bg-gray-700 text-gray-300"} tooltip="Missing or empty SEO/Meta tags." />
                            </>}
                        </div>
                        <div className="mt-4 pt-3 border-t border-gray-700">
                             <h3 className="font-semibold text-gray-400 mb-2 px-2">Raw Error</h3>
                             <div className="bg-black p-2 rounded-md text-xs font-mono max-h-48 overflow-y-auto">
                                <p className="text-red-400 break-words mb-2">{error?.message || 'No error message available.'}</p>
                                <p className="text-gray-500 whitespace-pre-wrap break-all">{this.state.errorInfo?.componentStack || 'No component stack available.'}</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex-grow h-full flex flex-col bg-gray-900/50 p-4 rounded-lg border border-gray-800">
                        <div className="flex items-center justify-between mb-2 flex-shrink-0">
                             <h2 className="font-semibold text-gray-200">Live Analysis Log</h2>
                             <div className="text-sm text-gray-400 font-mono bg-black px-3 py-1 rounded-md border border-gray-700">
                                Status: <span className="font-semibold text-yellow-300">{status}</span> {isAnalyzing && `(${elapsedTime}s)`}
                            </div>
                        </div>
                        <div className="flex-grow bg-black p-3 rounded-md overflow-y-auto font-mono text-xs">
                           {logs.length === 0 && <p className="text-gray-600">Awaiting analysis...</p>}
                           {logs.map(log => (
                               <p key={log.id} className={`${logColorMap[log.level]} whitespace-pre-wrap break-words`}>
                                   <span className="text-gray-600 select-none">{log.timestamp} [{log.level}] </span>
                                   {log.message}
                               </p>
                           ))}
                        </div>
                    </div>
                </main>

                <footer className="flex-shrink-0 flex items-center justify-center sm:justify-end gap-2 md:gap-4 pt-4 border-t border-gray-800 flex-wrap">
                     {isAnalyzing && (
                        <button
                            onClick={this.handleCancelAnalysis}
                            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-md transition-colors flex items-center gap-2"
                        >
                            <XIcon className="w-5 h-5" />
                            Cancel
                        </button>
                    )}
                     <button
                        onClick={this.handleQuickFix}
                        disabled={isAnalyzing || status === 'success_fix' || status === 'success_revert' || status === 'failed_final'}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-md transition-colors flex items-center justify-center gap-2 disabled:bg-gray-600/50 disabled:cursor-not-allowed"
                    >
                        <RefreshIcon className="w-5 h-5" />
                        Quick Fix (Revert)
                    </button>
                     <button
                        onClick={this.runFullAnalysis}
                        disabled={isAnalyzing || status === 'success_fix' || status === 'success_revert' || status === 'failed_final'}
                        className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 text-white font-semibold rounded-md transition-colors flex items-center justify-center gap-2 disabled:bg-gray-600/50 disabled:cursor-not-allowed"
                    >
                        <WandIcon className="w-5 h-5" />
                        {status.startsWith('failed') ? `Retry Analysis (${failureCount}/3)` : 'Full Analysis (AI)'}
                    </button>
                    <button
                        onClick={() => window.location.reload()}
                        className={`px-6 py-2 text-white font-semibold rounded-md transition-colors ${status.startsWith('success') ? 'bg-green-600 hover:bg-green-500' : 'bg-red-600 hover:bg-red-500'}`}
                    >
                        {status.startsWith('success') ? 'Reload to Apply Fix' : 'Reload Application'}
                    </button>
                </footer>
            </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;