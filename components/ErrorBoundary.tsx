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
  }
}

import React, { ErrorInfo, ReactNode } from 'react';
import ShieldIcon from './icons/ShieldIcon';
import { sendMessageToAi } from '../services/geminiService';
import { extractJsonFromString } from '../lib/utils/json';
import WandIcon from './icons/WandIcon';
import SpinnerIcon from './icons/SpinnerIcon';
import { Workspace, ModelChatMessage } from '../types';
import RefreshIcon from './icons/RefreshIcon';
import XIcon from './icons/XIcon';

type LogLevel = 'INFO' | 'SUCCESS' | 'WARN' | 'ERROR' | 'AI';
type AnalysisStatus = 'idle' | 'running' | 'cancelled' | 'failed_retryable' | 'failed_final' | 'success_fix' | 'success_revert';

interface LogEntry {
    id: number;
    level: LogLevel;
    message: string;
    timestamp: string;
}

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  
  // Recovery Console State
  logs: LogEntry[];
  status: AnalysisStatus;
  failureCount: number;
  isAnalyzing: boolean;
  elapsedTime: number;
}

const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

class ErrorBoundary extends React.Component<Props, State> {
  private analysisTimer: number | undefined;
  private analysisAbortController: AbortController | null = null;

  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    logs: [],
    status: 'idle',
    failureCount: 0,
    isAnalyzing: false,
    elapsedTime: 0,
  };

  constructor(props: Props) {
    super(props);
  }

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    this.setState({ errorInfo });

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

        this.addLog('INFO', 'Parsing crash report...');
        this.addLog('INFO', `Error: ${this.state.error?.message}`);
        await sleep(500); checkCancellation();
        
        this.addLog('INFO', 'Accessing last known project state...');
        const savedStateJSON = localStorage.getItem('ai-game-studio-state-v3');
        if (!savedStateJSON) throw new Error("No saved project state found in localStorage.");
        
        let savedState;
        try {
            savedState = JSON.parse(savedStateJSON);
        } catch (e) {
            throw new Error("Could not parse project state from localStorage. Data may be corrupted.");
        }
        
        const activeWorkspaceId = savedState.activeWorkspaceId;
        const activeWorkspace: Workspace | undefined = savedState.workspaces?.[activeWorkspaceId];
        if (!activeWorkspace) throw new Error("No active workspace found. Please reload and select a project.");
        this.addLog('SUCCESS', `Loaded project: ${activeWorkspace.name}`);
        await sleep(1000); checkCancellation();
        
        this.addLog('INFO', '[SIMULATED] Running static code analysis...');
        await sleep(1500); checkCancellation();
        this.addLog('SUCCESS', '[SIMULATED] No major syntax errors found.');
        
        this.addLog('INFO', '[SIMULATED] Verifying asset integrity...');
        await sleep(1000); checkCancellation();
        this.addLog('WARN', '[SIMULATED] 1 asset could not be reached. Will recommend replacement.');

        this.addLog('AI', 'Compiling diagnostic report for AI...');
        await sleep(500); checkCancellation();

        const fixPrompt = `[LEAP_AI_FIX_REQUEST] My application crashed with a React rendering error. Please analyze the entire project's code and fix the root cause. This is a critical failure.\n\nError: ${this.state.error?.message}\n\nComponent Stack:\n${this.state.errorInfo?.componentStack}`;
        this.addLog('AI', "Escalating to 'gemini-2.5-pro' for deep analysis...");
        
        const response = await sendMessageToAi(activeWorkspace, fixPrompt, null, 'team'); // Use 'team' mode for critical fixes
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
        if (signal.aborted) return; // Don't process as failure if cancelled
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
        const { status, isAnalyzing, logs, failureCount, elapsedTime, error } = this.state;
        
        const logColorMap: Record<LogLevel, string> = {
            INFO: 'text-gray-400',
            SUCCESS: 'text-green-400',
            WARN: 'text-yellow-400',
            ERROR: 'text-red-400',
            AI: 'text-blue-400',
        };

      return (
        <div className="w-screen h-screen bg-black flex flex-col items-center justify-center p-4 sm:p-8 text-gray-300 font-sans">
            <div className="w-full max-w-4xl h-full flex flex-col">
                <header className="flex-shrink-0 flex flex-col sm:flex-row items-center justify-between gap-4 pb-4 border-b border-gray-800">
                     <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-red-900/50 border-2 border-red-500/30 flex items-center justify-center">
                            <ShieldIcon className="w-6 h-6 text-red-400" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-red-400">LeapGuard Recovery Console</h1>
                            <p className="text-sm text-gray-500">An application error was caught. Use these tools to attempt a recovery.</p>
                        </div>
                    </div>
                    <div className="text-sm text-gray-400 font-mono bg-gray-900/50 px-3 py-1.5 rounded-md border border-gray-700">
                        Status: <span className="font-semibold text-yellow-300">{status}</span> {isAnalyzing && `(${elapsedTime}s)`}
                    </div>
                </header>
                
                <main className="flex-grow flex flex-col md:flex-row gap-4 py-4 overflow-hidden">
                    <div className="flex-shrink-0 md:w-1/3 h-1/2 md:h-full flex flex-col bg-gray-900/50 p-4 rounded-lg border border-gray-800">
                        <h2 className="font-semibold text-gray-200 mb-2">Initial Crash Report</h2>
                        <div className="flex-grow bg-black p-3 rounded-md overflow-y-auto text-xs font-mono">
                            <p className="text-red-400 break-words mb-2">{error?.message || 'No error message available.'}</p>
                            <p className="text-gray-500 whitespace-pre-wrap break-all">{this.state.errorInfo?.componentStack || 'No component stack available.'}</p>
                        </div>
                         <div className="mt-4 flex-shrink-0 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-1 gap-2">
                            <button
                                onClick={this.handleQuickFix}
                                disabled={isAnalyzing || status === 'success_fix' || status === 'success_revert' || status === 'failed_final'}
                                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-md transition-colors flex items-center justify-center gap-2 disabled:bg-gray-600/50 disabled:cursor-not-allowed"
                            >
                                <RefreshIcon className="w-5 h-5" />
                                Quick Fix (Revert)
                            </button>
                             <button
                                onClick={this.runFullAnalysis}
                                disabled={isAnalyzing || status === 'success_fix' || status === 'success_revert' || status === 'failed_final'}
                                className="w-full px-4 py-2 bg-yellow-600 hover:bg-yellow-500 text-white font-semibold rounded-md transition-colors flex items-center justify-center gap-2 disabled:bg-gray-600/50 disabled:cursor-not-allowed"
                            >
                                <WandIcon className="w-5 h-5" />
                                {status.startsWith('failed') ? `Retry Analysis (${failureCount}/3)` : 'Full Analysis (AI)'}
                            </button>
                        </div>
                    </div>

                    <div className="flex-grow h-1/2 md:h-full flex flex-col bg-gray-900/50 p-4 rounded-lg border border-gray-800">
                        <h2 className="font-semibold text-gray-200 mb-2 flex-shrink-0">Live Analysis Log</h2>
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

                <footer className="flex-shrink-0 flex items-center justify-center sm:justify-end gap-4 pt-4 border-t border-gray-800">
                     {isAnalyzing && (
                        <button
                            onClick={this.handleCancelAnalysis}
                            className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-md transition-colors flex items-center gap-2"
                        >
                            <XIcon className="w-5 h-5" />
                            Cancel
                        </button>
                    )}
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
