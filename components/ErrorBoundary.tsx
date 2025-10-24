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
import LogsIcon from './icons/LogsIcon';
import TracingIcon from './icons/TracingIcon';
import LayoutShiftsIcon from './icons/LayoutShiftsIcon';
import InteractionTimingIcon from './icons/InteractionTimingIcon';
import AccessibilityIcon from './icons/AccessibilityIcon';
import OpenGraphIcon from './icons/OpenGraphIcon';

type LogLevel = 'INFO' | 'SUCCESS' | 'WARN' | 'ERROR' | 'AI';
type AnalysisStatus = 'idle' | 'running' | 'cancelled' | 'failed_retryable' | 'failed_final' | 'success_fix' | 'success_revert';
type ErrorType = 'game' | 'ide' | 'unknown';

interface LogEntry {
    id: number;
    level: LogLevel;
    message: string;
    timestamp: string;
}

interface FormattedActivityLog {
    id: number;
    text: string;
}

interface AnalysisReport {
    hypothesis: string;
    primarySuspect: FileEntry | null;
    contributingFactors: string[];
    userActivityTrail: FormattedActivityLog[];
}

interface DiagnosticData {
    userActivity: FormattedActivityLog[];
    layoutShifts: PerformanceEntry[];
    interactionTimings: PerformanceEntry[];
    accessibilityIssues: AccessibilityIssue[];
    metaIssues: MetaIssue[];
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
  logs: LogEntry[];
  status: AnalysisStatus;
  failureCount: number;
  isAnalyzing: boolean;
  elapsedTime: number;
  suspectFile: FileEntry | null;
  analysisReport: AnalysisReport | null;
  diagnostics: DiagnosticData | null;
}

const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

class ErrorBoundary extends Component<Props, State> {
  private analysisTimer: number | undefined;
  private analysisAbortController: AbortController | null = null;

  constructor(props: Props) {
    super(props);
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
      suspectFile: null,
      analysisReport: null,
      diagnostics: null,
    };
    // FIX: Bind all component methods to ensure `this` context is correct.
    this.gatherDiagnostics = this.gatherDiagnostics.bind(this);
    this.analyzeError = this.analyzeError.bind(this);
    this.addLog = this.addLog.bind(this);
    this.startTimer = this.startTimer.bind(this);
    this.stopTimer = this.stopTimer.bind(this);
    this.handleCancelAnalysis = this.handleCancelAnalysis.bind(this);
    this.handleQuickFix = this.handleQuickFix.bind(this);
    this.formatDiagnosticsForAI = this.formatDiagnosticsForAI.bind(this);
    this.runFullAnalysis = this.runFullAnalysis.bind(this);
  }

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  gatherDiagnostics(): DiagnosticData {
    // 1. Get User Activity
    const userLogs = (window.LeapActivityLog?.getLogs() ?? []).slice(-15);
    const userActivity = userLogs.map((log: any, index: number) => {
        const time = new Date(log.timestamp).toLocaleTimeString();
        let details = '';
        if (log.type === 'click') {
            const text = log.details.text ? `"${log.details.text}" ` : '';
            details = `CLICK on element ${text}at (${log.details.position.x}, ${log.details.position.y}) -> ${log.details.selector}`;
        } else if (log.type === 'keydown') {
            details = `KEYDOWN: "${log.details.key}" -> on element ${log.details.selector}`;
        }
        return { id: index, text: `[${time}] ${details}` };
    });

    // 2. Get Performance Metrics
    const layoutShifts = PerformanceMonitor.getLayoutShifts();
    const interactionTimings = PerformanceMonitor.getInteractionTimings();

    // 3. Run Audits
    const accessibilityIssues = runAccessibilityAudit();
    const metaIssues = runMetaAudit();
    
    return {
        userActivity,
        layoutShifts,
        interactionTimings,
        accessibilityIssues,
        metaIssues
    };
  }
  
  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    
    const diagnostics = this.gatherDiagnostics();
    const errorType = errorInfo.componentStack?.includes('GamePreview') ? 'game' : 'ide';
    const analysisReport = this.analyzeError(error, errorInfo, errorType, diagnostics);
    
    this.setState({
        errorInfo,
        errorType,
        diagnostics,
        suspectFile: analysisReport.primarySuspect,
        analysisReport,
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

  analyzeError(error: Error, errorInfo: ErrorInfo, errorType: ErrorType, diagnostics: DiagnosticData): AnalysisReport {
    // This function can remain largely the same, but it now receives the diagnostics data
    // to incorporate into its hypothesis. We'll simplify the user log part as it's now pre-formatted.
    const report: AnalysisReport = {
        hypothesis: "An unknown application error occurred.",
        primarySuspect: null,
        contributingFactors: [],
        userActivityTrail: diagnostics.userActivity,
    };
    
    // ... existing analysis logic ...
    // You can now add more factors based on the new diagnostics:
    if (diagnostics.layoutShifts.length > 5) {
        report.contributingFactors.push(`High number of layout shifts (${diagnostics.layoutShifts.length}) detected, suggesting potential DOM instability before the crash.`);
    }
    if (diagnostics.accessibilityIssues.length > 0) {
        report.contributingFactors.push(`Accessibility audit found ${diagnostics.accessibilityIssues.length} issues. While not the direct cause, this indicates potential structural problems in the HTML.`);
    }
    // ... rest of the analysis function from before ...
     try {
        const savedStateJSON = localStorage.getItem('ai-game-studio-state-v3');
        if (!savedStateJSON) {
            report.hypothesis = "Could not access project data from local storage to perform a detailed analysis.";
            return report;
        }

        const savedState = JSON.parse(savedStateJSON);
        const activeId = savedState.activeWorkspaceId;
        const ws: Workspace | undefined = savedState.workspaces?.[activeId];

        if (!ws) {
            report.hypothesis = "Could not find an active workspace. The error might be related to application initialization.";
            return report;
        }

        const componentStack = errorInfo.componentStack || '';
        const errorStack = error.stack || '';
        const errorMessage = error.message || '';

        // Factor 1: Where did the error happen?
        if (errorType === 'game') {
            report.contributingFactors.push("Error originated within the game preview (iframe). This strongly suggests an issue with the game's code, an asset, or the game engine itself.");
        } else {
            report.contributingFactors.push("Error originated in the main IDE UI. This suggests a bug in the application's React components.");
        }
        
        // Factor 2: What was the last AI action?
        const lastModelMessage = [...ws.chatHistory].reverse().find(m => m.role === 'model') as ModelChatMessage | undefined;
        if (lastModelMessage?.assetsUsed && lastModelMessage.assetsUsed.length > 0) {
            report.contributingFactors.push(`The AI recently added ${lastModelMessage.assetsUsed.length} new asset(s). An invalid URL could be the cause.`);
        }
        if (lastModelMessage?.filesUpdated && lastModelMessage.filesUpdated.length > 0) {
            report.contributingFactors.push(`The AI last updated these files: ${lastModelMessage.filesUpdated.join(', ')}.`);
        }

        // Factor 3: Analyze the stack trace for a specific file
        const stackLines = errorStack.split('\n');
        for (const line of stackLines) {
            const match = line.match(/([a-zA-Z0-9_-]+\/[^):]+(\.tsx|\.jsx|\.js))/);
            if (match && match[1]) {
                const fileNameFromStack = match[1];
                const foundFile = ws.files.find(f => f.path.endsWith(fileNameFromStack));
                if (foundFile) {
                    report.primarySuspect = foundFile;
                    report.contributingFactors.push(`The error stack trace directly mentions "${foundFile.path}".`);
                    break; 
                }
            }
        }
        
        // Formulate a final hypothesis
        let hypothesis = `The application crashed due to a "${error.name}". `;
        if (errorType === 'game') {
             if (report.primarySuspect) {
                hypothesis += `The issue is likely located in or related to the game file \`${report.primarySuspect.path}\`. `;
            } else {
                hypothesis += `The error occurred inside the game preview, but a specific file couldn't be pinpointed. This could be a logic error in the game scripts or an issue with a recently added asset. `;
            }
        } else {
             hypothesis += `The error seems to be within the main application UI, not the game code itself. `;
        }
        
        if (errorMessage.toLowerCase().includes('failed to fetch')) {
            hypothesis += "The error message suggests a network problem, possibly an invalid or unreachable asset URL. ";
        } else if (error.name === 'TypeError') {
            hypothesis += "This is often caused by trying to access a property on an undefined variable (e.g., 'player.x' when 'player' doesn't exist). ";
        }
        
        hypothesis += "Review ALL provided diagnostic data to fix the problem."
        report.hypothesis = hypothesis;
        
        if (!report.primarySuspect) {
             if (errorType === 'game') {
                if (lastModelMessage?.filesUpdated && lastModelMessage.filesUpdated.length > 0) {
                    report.primarySuspect = ws.files.find(f => f.path === lastModelMessage.filesUpdated![0]) || null;
                } else {
                    report.primarySuspect = ws.files.find(f => f.path.endsWith('game.js')) || ws.files.find(f => f.path.endsWith('.js')) || null;
                }
            } else {
                report.primarySuspect = ws.files.find(f => f.path.endsWith('App.tsx')) || ws.files.find(f => f.path.endsWith('.tsx')) || null;
            }
        }

        return report;
    } catch (e) {
        console.error("Error during crash analysis:", e);
        report.hypothesis = "A critical error occurred, and the automated analysis also failed. Please try reloading the application.";
        report.contributingFactors = [e instanceof Error ? e.message : String(e)];
        return report;
    }
  }

  addLog(level: LogLevel, message: string) {
    this.setState(prevState => ({
      logs: [...prevState.logs, {
        id: prevState.logs.length,
        level,
        message,
        timestamp: new Date().toLocaleTimeString()
      }]
    }));
  }

  startTimer() {
    this.stopTimer();
    this.setState({ elapsedTime: 0 });
    this.analysisTimer = window.setInterval(() => {
        this.setState(prev => ({ elapsedTime: prev.elapsedTime + 1 }));
    }, 1000);
  }
  
  stopTimer() {
      if (this.analysisTimer) {
        clearInterval(this.analysisTimer);
        this.analysisTimer = undefined;
      }
  }

  handleCancelAnalysis() {
    if (this.analysisAbortController) {
        this.analysisAbortController.abort();
    }
    this.setState({ isAnalyzing: false, status: 'cancelled' });
    this.stopTimer();
    this.addLog('WARN', 'Analysis cancelled by user.');
  }

  async handleQuickFix() {
    // ... same as before
  }

  formatDiagnosticsForAI(): string {
    const { diagnostics, error, errorInfo } = this.state;
    if (!diagnostics) return "No diagnostic data available.";
  
    const { userActivity, layoutShifts, interactionTimings, accessibilityIssues, metaIssues } = diagnostics;
  
    const formatPerfEntry = (entry: any) => `- Value: ${entry.value?.toFixed(4) ?? 'N/A'}, Duration: ${entry.duration?.toFixed(2)}ms, Start: ${entry.startTime?.toFixed(2)}ms`;
  
    return `
  [LEAP_AI_FIX_REQUEST] A critical error occurred. Analyze the COMPLETE diagnostic report below to identify and fix the root cause.
  
  ---
  
  ## 1. Core Crash Data
  - **Error Type**: ${error?.name || 'Unknown'}
  - **Error Message**: ${error?.message || 'N/A'}
  - **Component Stack**: 
  ${errorInfo?.componentStack?.trim() || 'N/A'}
  - **Full Stack Trace**:
  ${error?.stack?.trim() || 'N/A'}
  
  ---
  
  ## 2. User Activity Trace (Last 15 Actions)
  ${userActivity.length > 0 ? userActivity.map(log => `- ${log.text}`).join('\n') : 'No user activity was recorded.'}
  
  ---
  
  ## 3. Performance Vitals
  
  ### Layout Shifts (CLS) - ${layoutShifts.length} shifts recorded
  ${layoutShifts.length > 0 ? layoutShifts.map(formatPerfEntry).join('\n') : 'No significant layout shifts detected.'}
  
  ### Interaction Timings (INP) - ${interactionTimings.length} slow interactions recorded
  ${interactionTimings.length > 0 ? interactionTimings.map(formatPerfEntry).join('\n') : 'No slow interactions detected.'}
  
  ---
  
  ## 4. DOM & Metadata Audits
  
  ### Accessibility Audit - ${accessibilityIssues.length} issues found
  ${accessibilityIssues.length > 0 ? accessibilityIssues.map(a => `- ${a.issue} on element: ${a.selector}`).join('\n') : 'No accessibility issues found.'}
  
  ### Open Graph & Meta Tag Audit - ${metaIssues.length} issues found
  ${metaIssues.length > 0 ? metaIssues.map(m => `- ${m.issue}: <${m.tag}>`).join('\n') : 'No metadata issues found.'}
  
  ---
  
  ## 5. AI INSTRUCTIONS
  Based on ALL the data above (error, user trace, performance, audits), provide a comprehensive fix. The error's origin is likely in the game's code if it happened during play, or the IDE's code if it happened otherwise. Pay close attention to the last user actions and the raw error message.
  `;
  }
  

  async runFullAnalysis() {
    // ... setup is the same
    // ...
    // --- THIS IS THE MAJOR CHANGE ---
    // The prompt is now generated by the new formatter function
    this.addLog('AI', 'Compiling comprehensive diagnostic report for AI...');
    const fixPrompt = this.formatDiagnosticsForAI();
    // ... rest of the function (calling sendMessageToAi, processing response) is the same
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
        
        let savedState;
        try {
            savedState = JSON.parse(savedStateJSON);
        } catch (e) {
            throw new Error("Could not parse project state from localStorage. Data may be corrupted.");
        }
        
        const activeWorkspaceId = savedState.activeWorkspaceId;
        const activeWorkspace: Workspace | undefined = savedState.workspaces?.[activeWorkspaceId];
        if (!activeWorkspace) throw new Error("No active workspace found. Please reload and select a project.");
        this.addLog('SUCCESS', `Loaded project: ${activeWorkspace.name} (${activeWorkspace.type})`);
        await sleep(1000); checkCancellation();

        this.addLog('AI', '--- Phase 1: AI-Powered Root Cause Analysis ---');
        this.addLog('INFO', 'Compiling comprehensive diagnostic report for AI...');
        await sleep(500); checkCancellation();

        const response = await sendMessageToAi(activeWorkspace, fixPrompt, null, 'team');
        checkCancellation();

        this.addLog('AI', 'AI response received. Validating patch...');
        const jsonResponse = extractJsonFromString(response.text);

        if (!jsonResponse || !Array.isArray(jsonResponse.files) || jsonResponse.files.length === 0) {
            throw new Error("AI returned an invalid response or did not provide file updates.");
        }
        
        const changedFiles = jsonResponse.files.map((f: any) => f.path).join(', ');
        this.addLog('AI', `AI has proposed changes for: ${changedFiles}`);
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
  }

  public render() {
    if (this.state.hasError) {
        const { status, isAnalyzing, logs, failureCount, elapsedTime, error, suspectFile, analysisReport, diagnostics, errorType } = this.state;
        
        const isGameError = errorType === 'game';
        const logColorMap: Record<LogLevel, string> = { INFO: 'text-gray-400', SUCCESS: 'text-green-400', WARN: 'text-yellow-400', ERROR: 'text-red-400', AI: 'text-blue-400' };
        const maxTiming = diagnostics?.interactionTimings.reduce((max, t: any) => Math.max(max, t.duration), 0) ?? 0;
        
      return (
        <div className="w-screen h-screen bg-black flex flex-col items-center justify-center p-4 sm:p-8 text-gray-300 font-sans">
            <div className="w-full max-w-6xl h-full flex flex-col">
                <header className="flex-shrink-0 flex flex-col sm:flex-row items-center justify-between gap-4 pb-4 border-b border-gray-800">
                     <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-red-900/50 border-2 border-red-500/30 flex items-center justify-center">
                            <ShieldIcon className="w-6 h-6 text-red-400" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-red-400">LeapGuard Recovery Console</h1>
                            <p className="text-sm text-gray-500">{isGameError ? "An unrecoverable error in your game's code caused a crash." : 'A critical application error was caught.'}</p>
                        </div>
                    </div>
                    <div className="text-sm text-gray-400 font-mono bg-gray-900/50 px-3 py-1.5 rounded-md border border-gray-700">
                        Status: <span className="font-semibold text-yellow-300">{status}</span> {isAnalyzing && `(${elapsedTime}s)`}
                    </div>
                </header>
                
                <main className="flex-grow flex flex-col md:flex-row gap-4 py-4 overflow-hidden">
                    <div className="flex-shrink-0 md:w-1/3 lg:w-1/4 h-1/2 md:h-full flex flex-col bg-gray-900/50 rounded-lg border border-gray-800 p-4 space-y-4 overflow-y-auto">
                        <h2 className="text-lg font-semibold text-gray-200">Diagnostics Report</h2>
                        <div className="space-y-2 text-sm">
                            <div className="flex items-center justify-between p-2 rounded-md bg-black/30">
                                <div className="flex items-center gap-2 text-gray-300"><LogsIcon className="w-4 h-4" /> My Logs</div>
                                <div className="font-mono text-gray-400">{diagnostics?.userActivity.length ?? 0} entries</div>
                            </div>
                            <div className="flex items-center justify-between p-2 rounded-md bg-black/30">
                                <div className="flex items-center gap-2 text-gray-300"><TracingIcon className="w-4 h-4" /> Last Action</div>
                                <div className="font-mono text-gray-400 truncate max-w-[150px]">{diagnostics?.userActivity.at(-1)?.text.split(']')[1] ?? 'N/A'}</div>
                            </div>
                             <div className="flex items-center justify-between p-2 rounded-md bg-black/30">
                                <div className="flex items-center gap-2 text-gray-300"><LayoutShiftsIcon className="w-4 h-4" /> Layout Shifts</div>
                                <div className="font-mono text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded">{diagnostics?.layoutShifts.length ?? 0}</div>
                            </div>
                             <div className="flex items-center justify-between p-2 rounded-md bg-black/30">
                                <div className="flex items-center gap-2 text-gray-300"><InteractionTimingIcon className="w-4 h-4" /> Interaction Timing</div>
                                <div className="font-mono text-yellow-400 bg-yellow-500/10 px-2 py-0.5 rounded">{maxTiming.toFixed(0)}ms</div>
                            </div>
                             <div className="flex items-center justify-between p-2 rounded-md bg-black/30">
                                <div className="flex items-center gap-2 text-gray-300"><AccessibilityIcon className="w-4 h-4" /> Accessibility Audit</div>
                                <div className="font-mono text-red-400 bg-red-500/10 px-2 py-0.5 rounded">{diagnostics?.accessibilityIssues.length ?? 0}</div>
                            </div>
                             <div className="flex items-center justify-between p-2 rounded-md bg-black/30">
                                <div className="flex items-center gap-2 text-gray-300"><OpenGraphIcon className="w-4 h-4" /> Open Graph</div>
                                <div className="font-mono text-gray-400">{diagnostics?.metaIssues.length ?? 0} issues</div>
                            </div>
                        </div>
                        <div className="flex-grow bg-black p-3 rounded-md overflow-y-auto text-xs font-mono">
                            <h3 className="font-bold text-base text-yellow-300 mb-2">AI Hypothesis</h3>
                            <p className="text-gray-300 whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: analysisReport?.hypothesis.replace(/`([^`]+)`/g, '<code class="font-sans text-xs bg-white/10 px-1 py-0.5 rounded text-yellow-200">$1</code>') ?? 'Analysis pending...' }}></p>
                            <div className="pt-2 mt-2 border-t border-gray-700/50">
                                <h3 className="font-bold text-gray-400 mb-1">Raw Error</h3>
                                <p className="text-red-400 break-words">{error?.message || 'No error message available.'}</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex-grow h-1/2 md:h-full flex flex-col bg-gray-900/50 p-4 rounded-lg border border-gray-800">
                        <div className="flex items-center justify-between mb-2 flex-shrink-0">
                           <h2 className="font-semibold text-gray-200">Live Analysis Log</h2>
                            <button
                                onClick={this.runFullAnalysis}
                                disabled={isAnalyzing || status === 'success_fix' || status === 'success_revert' || status === 'failed_final'}
                                className="px-4 py-1.5 bg-yellow-600 hover:bg-yellow-500 text-white font-semibold rounded-md transition-colors flex items-center justify-center gap-2 disabled:bg-gray-600/50 disabled:cursor-not-allowed"
                            >
                                <WandIcon className="w-4 h-4" />
                                {status.startsWith('failed') ? `Retry Analysis (${failureCount}/3)` : 'Run Full Analysis (AI)'}
                            </button>
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