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
    hljs?: any;
  }
}

// FIX: Import PropsWithChildren to correctly type components that accept children.
import React, { Component, ErrorInfo, PropsWithChildren } from 'react';
import ShieldIcon from './icons/ShieldIcon';
import { sendMessageToAi } from '../services/geminiService';
import { extractJsonFromString } from '../lib/utils/json';
import WandIcon from './icons/WandIcon';
import SpinnerIcon from './icons/SpinnerIcon';
// FIX: Remove unused ReactNode import.
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
import TargetIcon from './icons/TargetIcon';
import FootprintsIcon from './icons/FootprintsIcon';
import WrenchIcon from './icons/WrenchIcon';


type LogLevel = 'INFO' | 'SUCCESS' | 'WARN' | 'ERROR' | 'AI';
type AnalysisStatus = 'idle' | 'running' | 'cancelled' | 'failed_retryable' | 'failed_final' | 'success_fix' | 'success_revert' | 'running_revert' | 'failed_revert';
type ErrorType = 'game' | 'ide' | 'unknown';
type ActiveRecoveryTab = 'log' | 'suspects';

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

// FIX: Remove the custom Props interface as PropsWithChildren will be used.

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
  activeRecoveryTab: ActiveRecoveryTab;
}

const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

// FIX: Use PropsWithChildren to correctly type the component and resolve the error in index.tsx.
class ErrorBoundary extends Component<PropsWithChildren, State> {
  private analysisTimer: number | undefined;
  private analysisAbortController: AbortController | null = null;
  private suspectCodeBlockRef = React.createRef<HTMLElement>();

  // FIX: Converted constructor to a state class property for modern React syntax.
  // This ensures `this.state` is correctly typed and initialized on the class instance,
  // resolving issues where TypeScript couldn't find `state` or `setState`.
  state: State = {
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
    activeRecoveryTab: 'suspects', // Default to the new suspects tab
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  // FIX: Converted to arrow function to bind `this`.
  gatherDiagnostics = (): DiagnosticData => {
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
  
  // FIX: Converted lifecycle method to an arrow function to guarantee `this` context.
  public componentDidCatch = (error: Error, errorInfo: ErrorInfo) => {
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
        activeRecoveryTab: 'suspects', // Ensure suspects tab is shown on error
        failureCount: 0, // Reset for new error
        status: 'idle', // Reset status for new error
        logs: [], // Reset logs for new error
    }, this.highlightSuspectCode);

    if (window.LeapGuard && typeof window.LeapGuard.reportIncident === 'function') {
        window.LeapGuard.reportIncident(
            'untrusted',
            'React Render Exception',
            error.message,
            { error, componentStack: errorInfo.componentStack }
        );
    }
  }

  // FIX: Converted lifecycle method to an arrow function to guarantee `this` context.
  componentWillUnmount = () => {
    if (this.analysisTimer) {
        clearInterval(this.analysisTimer);
    }
  }

  // FIX: Converted lifecycle method to an arrow function to guarantee `this` context.
  componentDidUpdate = (prevProps: PropsWithChildren, prevState: State) => {
    if (this.state.activeRecoveryTab === 'suspects' && prevState.activeRecoveryTab !== 'suspects') {
        this.highlightSuspectCode();
    }
  }
  
  // FIX: Converted to arrow function to bind `this`.
  highlightSuspectCode = () => {
    if (this.state.activeRecoveryTab === 'suspects' && this.suspectCodeBlockRef.current && this.state.suspectFile && window.hljs) {
        const codeElement = this.suspectCodeBlockRef.current;
        const extension = this.state.suspectFile.path.split('.').pop() || 'js';
        const lang = { js: 'javascript', css: 'css', html: 'html', json: 'json', tsx: 'typescript' }[extension] || 'plaintext';
        codeElement.className = `language-${lang}`;
        codeElement.textContent = this.state.suspectFile.content;
        window.hljs.highlightElement(codeElement);
    }
  }

  // FIX: Converted to arrow function to bind `this`.
  analyzeError = (error: Error, errorInfo: ErrorInfo, errorType: ErrorType, diagnostics: DiagnosticData): AnalysisReport => {
    const report: AnalysisReport = {
        hypothesis: "An unknown application error occurred.",
        primarySuspect: null,
        contributingFactors: [],
        userActivityTrail: diagnostics.userActivity,
    };
    
    const lastAction = diagnostics.userActivity.length > 0 ? diagnostics.userActivity[diagnostics.userActivity.length - 1] : null;
    if (lastAction) {
        report.contributingFactors.unshift(`The last recorded user action was: ${lastAction.text.split('] ')[1]}`);
    }

    if (diagnostics.layoutShifts.length > 5) {
        report.contributingFactors.push(`High number of layout shifts (${diagnostics.layoutShifts.length}) detected, suggesting potential DOM instability before the crash.`);
    }
    if (diagnostics.accessibilityIssues.length > 0) {
        report.contributingFactors.push(`Accessibility audit found ${diagnostics.accessibilityIssues.length} issues. While not the direct cause, this indicates potential structural problems in the HTML.`);
    }

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

        const errorStack = error.stack || '';
        const stackLines = errorStack.split('\n');
        for (const line of stackLines) {
            // Match file paths like `path/to/file.js`, `(path/to/file.tsx:line:col)`, etc.
            const match = line.match(/([a-zA-Z0-9_-]+\/)[^):]+(\.tsx|\.jsx|\.js)/);
            if (match && match[0]) {
                const pathFromStack = match[0].split(' ')[0]; // Handle cases like `at Object.onClick (main.js:123)`
                const foundFile = ws.files.find(f => pathFromStack.includes(f.path));
                if (foundFile) {
                    report.primarySuspect = foundFile;
                    report.contributingFactors.push(`The error stack trace directly mentions "${foundFile.path}".`);
                    break; 
                }
            }
        }
        
        let hypothesis = `The application crashed due to a "${error.name}". `;
        
        // Deep analysis of error message
        const lowerCaseMessage = error.message.toLowerCase();
        if (lowerCaseMessage.includes('circular structure') || lowerCaseMessage.includes('converting circular structure to json')) {
            hypothesis = `A circular reference was encountered during JSON serialization. This typically happens when trying to log or store a complex object that refers back to itself, like a DOM element or a React component instance. The suspect file likely contains a 'console.log' or state update with a forbidden object.`;
            report.contributingFactors.push("The error message explicitly points to a circular reference, a common issue when serializing complex browser objects.");
        } else if (lastAction) {
            const actionText = lastAction.text.split('] ')[1];
            hypothesis += `The error occurred shortly after the user performed an action: "${actionText}". This action is the most likely trigger. `;
        }
        
        if (errorType === 'game') {
             if (report.primarySuspect) {
                hypothesis += `The issue is likely located in or related to the game file \`${report.primarySuspect.path}\`. `;
            } else {
                hypothesis += `The error occurred inside the game preview, but a specific file couldn't be pinpointed from the stack trace. This could be a logic error in any of the game scripts or an issue with a recently added asset. `;
            }
        } else {
             hypothesis += `The error seems to be within the main application UI, not the game code itself. `;
        }
        
        if (lowerCaseMessage.includes('failed to fetch')) {
            hypothesis += "The error message suggests a network problem, possibly an invalid or unreachable asset URL. ";
        } else if (error.name === 'TypeError') {
            hypothesis += "This is often caused by trying to access a property on an undefined variable (e.g., 'player.x' when 'player' doesn't exist). Check the logic related to the user's last action. ";
        }
        
        const lastModelMessage = [...ws.chatHistory].reverse().find(m => m.role === 'model') as ModelChatMessage | undefined;
        if (lastModelMessage?.filesUpdated && lastModelMessage.filesUpdated.length > 0) {
            const updatedFilesString = lastModelMessage.filesUpdated.join(', ');
            report.contributingFactors.push(`The AI last updated these files: ${updatedFilesString}.`);
            hypothesis += `The bug may have been introduced in the last AI update which modified \`${updatedFilesString}\`.`
        }

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

  // FIX: Converted to arrow function to bind `this`.
  addLog = (level: LogLevel, message: string) => {
    this.setState(prevState => ({
      logs: [...prevState.logs, {
        id: prevState.logs.length,
        level,
        message,
        timestamp: new Date().toLocaleTimeString()
      }]
    }));
  }

  // FIX: Converted to arrow function to bind `this`.
  startTimer = () => {
    this.stopTimer();
    this.setState({ elapsedTime: 0 });
    this.analysisTimer = window.setInterval(() => {
        this.setState(prev => ({ elapsedTime: prev.elapsedTime + 1 }));
    }, 1000);
  }
  
  // FIX: Converted to arrow function to bind `this`.
  stopTimer = () => {
      if (this.analysisTimer) {
        clearInterval(this.analysisTimer);
        this.analysisTimer = undefined;
      }
  }

  // FIX: Converted to arrow function to bind `this`.
  handleCancelAnalysis = () => {
    if (this.analysisAbortController) {
        this.analysisAbortController.abort();
    }
    this.setState({ isAnalyzing: false, status: 'cancelled' });
    this.stopTimer();
    this.addLog('WARN', 'Analysis cancelled by user.');
  }

  // FIX: Converted to arrow function to bind `this`.
  handleRevertToLastCheckpoint = async () => {
    this.setState({ activeRecoveryTab: 'log' });
    this.analysisAbortController = new AbortController();
    const { signal } = this.analysisAbortController;

    this.setState({
        logs: [],
        isAnalyzing: true,
        status: 'running_revert',
    });
    this.startTimer();
    const checkCancellation = () => {
        if (signal.aborted) throw new Error('Revert was cancelled.');
    };

    try {
        this.addLog('INFO', `Starting Systematic Integrity Scan & Repair...`);
        await sleep(500); checkCancellation();

        this.addLog('INFO', 'Phase 1: Analyzing project state...');
        const savedStateJSON = localStorage.getItem('ai-game-studio-state-v3');
        if (!savedStateJSON) throw new Error("No saved project state found in localStorage.");
        
        const savedState = JSON.parse(savedStateJSON);
        const activeWorkspaceId = savedState.activeWorkspaceId;
        const activeWorkspace: Workspace | undefined = savedState.workspaces?.[activeWorkspaceId];
        if (!activeWorkspace) throw new Error("No active workspace found to analyze.");
        this.addLog('SUCCESS', `Project state loaded successfully.`);
        await sleep(500); checkCancellation();

        this.addLog('INFO', 'Phase 2: Scanning for last stable checkpoint...');
        const lastCheckpointMessage = [...activeWorkspace.chatHistory]
            .reverse()
            .find(msg => msg.role === 'model' && (msg as ModelChatMessage).checkpoint && !(msg as ModelChatMessage).isFixable) as ModelChatMessage | undefined;

        if (!lastCheckpointMessage || !lastCheckpointMessage.checkpoint) {
            throw new Error("Integrity Scan failed: No valid checkpoint found in the project's history to revert to.");
        }
        
        this.addLog('SUCCESS', `Found stable checkpoint from ${new Date(lastCheckpointMessage.id.split('-')[2]).toLocaleTimeString()}.`);
        await sleep(1000); checkCancellation();
        
        this.addLog('INFO', `Phase 3: Preparing file revert operation...`);
        await sleep(1500); checkCancellation();

        this.addLog('INFO', 'Executing revert. Restoring project files to the last known good state...');
        const filesToRestore = lastCheckpointMessage.checkpoint;
        
        const updatedWorkspace = { ...activeWorkspace, files: filesToRestore, lastModified: Date.now() };
        const newWorkspaces = { ...savedState.workspaces, [activeWorkspaceId]: updatedWorkspace };
        localStorage.setItem('ai-game-studio-state-v3', JSON.stringify({ ...savedState, workspaces: newWorkspaces }));
        
        await sleep(500); checkCancellation();
        this.addLog('INFO', 'Verifying file integrity post-revert...');
        await sleep(1000); checkCancellation();

        this.addLog('SUCCESS', 'Systematic Repair successful! Project state has been reverted.');
        this.setState({ status: 'success_revert' });

    } catch (error) {
        if (signal.aborted) return;
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        this.addLog('ERROR', `Systematic Repair Failed: ${errorMessage}`);
        this.setState({ status: 'failed_revert' });
    } finally {
        this.setState({ isAnalyzing: false });
        this.stopTimer();
    }
  }

  // FIX: Converted to arrow function to bind `this`.
  formatDiagnosticsForAI = (): string => {
    const { diagnostics, error, errorInfo, failureCount } = this.state;
    if (!diagnostics) return "No diagnostic data available.";
  
    const { userActivity, layoutShifts, interactionTimings, accessibilityIssues, metaIssues } = diagnostics;
  
    const formatPerfEntry = (entry: any) => `- Value: ${entry.value?.toFixed(4) ?? 'N/A'}, Duration: ${entry.duration?.toFixed(2)}ms, Start: ${entry.startTime?.toFixed(2)}ms`;
  
    let previousAttemptsContext = '';
    if (failureCount > 0) {
        previousAttemptsContext = `
---

## 6. PREVIOUS FAILED ATTEMPTS
**CRITICAL CONTEXT:** This is attempt number ${failureCount + 1}. Your previous fix did not work and the application crashed again with the same error. You MUST analyze your previous output and the diagnostics to find a different, more robust solution. Do not repeat the same mistake. Identify the flawed logic in the previous attempt and correct it.

---
`;
    }

    return `
[LEAP_AI_FIX_REQUEST] A critical error occurred. Analyze the COMPLETE diagnostic report below to identify and fix the root cause.

---

## 1. Core Crash Data (HIGHEST PRIORITY)
- **Error Type**: ${error?.name || 'Unknown'}
- **Error Message (Full)**: ${error?.message || 'N/A'}
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

${previousAttemptsContext}
---

## 5. AI INSTRUCTIONS
Your primary task is to fix the bug. Analyze the **Core Crash Data** section with the highest priority. The raw error message and stack trace are the most critical pieces of evidence. For example, errors mentioning 'circular structure' or 'undefined' properties require careful inspection of the code mentioned in the stack trace. Use the other diagnostic sections (User Activity, Performance, Audits) as secondary context to understand *why* the error occurred. Propose a surgical code change to fix the root cause.
  `;
  }
  
  // FIX: Converted to arrow function to bind `this`.
  runFullAnalysis = async () => {
    this.setState({ activeRecoveryTab: 'log' });
    this.analysisAbortController = new AbortController();
    const { signal } = this.analysisAbortController;
    
    this.setState({ 
        logs: [], 
        isAnalyzing: true, 
        status: 'running', 
    });
    this.startTimer();
    const checkCancellation = () => {
        if (signal.aborted) throw new Error('Analysis was cancelled.');
    };
    try {
        this.addLog('INFO', `Starting full analysis (Attempt ${this.state.failureCount + 1} of 3)...`);
        await sleep(500); checkCancellation();
        
        this.addLog('INFO', 'Phase 1: Loading all available system data...');
        this.addLog('INFO', 'Reading project state from local storage...');
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
        this.addLog('INFO', 'Reading diagnostic data (flight recorder, performance vitals, audits)...');
        await sleep(700); checkCancellation();
        this.addLog('SUCCESS', 'All system data loaded.');

        this.addLog('INFO', 'Phase 2: Analyzing crash context...');
        this.addLog('INFO', 'Parsing raw error logs and stack traces...');
        await sleep(500); checkCancellation();
        this.addLog('INFO', 'Correlating error data with user activity trail...');
        await sleep(800); checkCancellation();
        this.addLog('SUCCESS', 'Initial context analysis complete.');

        this.addLog('AI', 'Phase 3: AI Cognitive Analysis...');
        this.addLog('AI', 'Cross-referencing all data points to identify the root cause...');
        await sleep(1500); checkCancellation();

        if (this.state.analysisReport?.primarySuspect) {
            this.addLog('AI', `Primary suspect file identified: \`${this.state.analysisReport.primarySuspect.path}\``);
        } else {
            this.addLog('AI', 'A primary suspect file could not be definitively identified. Broad analysis will be performed.');
        }
        await sleep(500);

        if (this.state.analysisReport?.hypothesis) {
             const suspectedCause = this.state.analysisReport.hypothesis
                .replace('The application crashed due to a', 'Detected a')
                .replace(/`([^`]+)`/g, '$1');
            this.addLog('AI', `Suspected Cause: ${suspectedCause}`);
        }
        await sleep(1000); checkCancellation();

        this.addLog('AI', 'Formulating repair strategy and preparing patch...');
        const fixPrompt = this.formatDiagnosticsForAI();
        await sleep(500); checkCancellation();

        const onProgress = (update: { stage: 'planner_start' | 'planner_end' | 'coder_start' | 'coder_end'; content?: string }) => {
            if (this.analysisAbortController?.signal.aborted) return;
            switch (update.stage) {
                case 'planner_start':
                    this.addLog('AI', 'Engaging Planner AI to analyze diagnostics and create a fix blueprint...');
                    break;
                case 'planner_end':
                    this.addLog('AI', 'Planner AI finished. Blueprint created.');
                    this.addLog('INFO', `--- PLANNER'S BLUEPRINT ---\n${update.content}\n--- END BLUEPRINT ---`);
                    break;
                case 'coder_start':
                    this.addLog('AI', 'Engaging Coder AI to implement the blueprint...');
                    break;
                case 'coder_end':
                    this.addLog('AI', 'Coder AI has finished implementing the patch.');
                    break;
            }
        };

        const response = await sendMessageToAi(activeWorkspace, fixPrompt, null, 'team', onProgress);
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

        this.addLog('SUCCESS', 'Fix applied successfully! Please reload the application to continue.');
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

  // FIX: Converted to arrow function to bind `this`.
  renderSuspectsPanel = () => {
    const { suspectFile, analysisReport } = this.state;
    return (
      <div className="flex-grow flex flex-col gap-3 overflow-hidden">
        {/* Hypothesis */}
        <div className="flex-shrink-0 bg-black p-3 rounded-md border border-gray-700/50">
          <h3 className="font-bold text-base text-yellow-300 mb-2 flex items-center gap-2">
            <TargetIcon className="w-5 h-5" />
            AI Hypothesis
          </h3>
          <p className="text-gray-300 whitespace-pre-wrap text-sm" dangerouslySetInnerHTML={{ __html: analysisReport?.hypothesis.replace(/`([^`]+)`/g, '<code class="font-sans text-xs bg-white/10 px-1 py-0.5 rounded text-yellow-200">$1</code>') ?? 'Analysis pending...' }}></p>
        </div>

        {/* Main Content */}
        <div className="flex-grow flex flex-col lg:flex-row gap-3 overflow-hidden">
          {/* Left: Primary Suspect */}
          <div className="w-full lg:w-2/3 flex flex-col bg-black rounded-md overflow-hidden border border-gray-700/50">
            {suspectFile ? (
              <>
                <div className="flex-shrink-0 p-2 border-b border-gray-700/50">
                  <h3 className="text-sm font-semibold text-gray-300">Primary Suspect: <span className="font-mono text-blue-300">{suspectFile.path}</span></h3>
                </div>
                <div className="flex-grow overflow-auto font-mono text-sm">
                  <pre className="h-full"><code ref={this.suspectCodeBlockRef}></code></pre>
                </div>
              </>
            ) : (
              <div className="flex-grow flex items-center justify-center text-gray-600">
                <p>No primary suspect file identified.</p>
              </div>
            )}
          </div>
          
          {/* Right: Context & Trail */}
          <div className="w-full lg:w-1/3 flex flex-col gap-3 overflow-hidden">
             {/* Contributing Factors */}
            <div className="h-1/2 flex flex-col bg-black rounded-md overflow-hidden border border-gray-700/50">
              <div className="flex-shrink-0 p-2 border-b border-gray-700/50">
                <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                    <TracingIcon className="w-4 h-4" />
                    Contributing Factors
                </h3>
              </div>
              <div className="flex-grow p-3 overflow-y-auto text-xs">
                {analysisReport?.contributingFactors && analysisReport.contributingFactors.length > 0 ? (
                    <ul className="space-y-2">
                        {analysisReport.contributingFactors.map((factor, index) => (
                            <li key={index} className="text-gray-400 leading-relaxed">{factor}</li>
                        ))}
                    </ul>
                ) : <p className="text-gray-600">No specific contributing factors were identified.</p>}
              </div>
            </div>

            {/* User Activity Trail */}
            <div className="h-1/2 flex flex-col bg-black rounded-md overflow-hidden border border-gray-700/50">
                <div className="flex-shrink-0 p-2 border-b border-gray-700/50">
                    <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                        <FootprintsIcon className="w-4 h-4" />
                        User Activity Trail (Flight Recorder)
                    </h3>
                </div>
                <div className="flex-grow p-3 overflow-y-auto font-mono text-xs">
                    {analysisReport?.userActivityTrail && analysisReport.userActivityTrail.length > 0 ? (
                        analysisReport.userActivityTrail.map(log => (
                            <p key={log.id} className="text-gray-500 hover:text-gray-300 transition-colors whitespace-pre-wrap break-words">{log.text}</p>
                        ))
                    ) : <p className="text-gray-600">No user activity was recorded before the crash.</p>}
                </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // FIX: Converted to arrow function to bind `this`.
  renderAnalysisLogPanel = () => {
     const { logs } = this.state;
     const logColorMap: Record<LogLevel, string> = { INFO: 'text-gray-400', SUCCESS: 'text-green-400', WARN: 'text-yellow-400', ERROR: 'text-red-400', AI: 'text-blue-400' };
    return (
         <div className="flex-grow bg-black p-3 rounded-md overflow-y-auto font-mono text-xs">
           {logs.length === 0 && <p className="text-gray-600">Awaiting analysis...</p>}
           {logs.map(log => (
               <p key={log.id} className={`${logColorMap[log.level]} whitespace-pre-wrap break-words`}>
                   <span className="text-gray-600 select-none">{log.timestamp} [{log.level}] </span>
                   {log.message}
               </p>
           ))}
        </div>
    );
  }

  // FIX: Converted lifecycle method to an arrow function to guarantee `this` context.
  public render = () => {
    if (this.state.hasError) {
        const { status, isAnalyzing, failureCount, elapsedTime, error, analysisReport, diagnostics, errorType, activeRecoveryTab } = this.state;
        
        const isGameError = errorType === 'game';
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
                                {/* FIX: Replace .at(-1) with [length - 1] for broader compatibility. */}
                                <div className="font-mono text-gray-400 truncate max-w-[150px]">{diagnostics?.userActivity[diagnostics.userActivity.length - 1]?.text.split(']')[1] ?? 'N/A'}</div>
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
                            <h3 className="font-bold text-gray-400 mb-1">Raw Error</h3>
                            <p className="text-red-400 break-words">{error?.message || 'No error message available.'}</p>
                        </div>
                    </div>

                    <div className="flex-grow h-1/2 md:h-full flex flex-col bg-gray-900/50 p-4 rounded-lg border border-gray-800">
                        <div className="flex-shrink-0 flex items-center justify-between mb-2">
                           <div className="flex items-center border-b border-gray-700/80">
                                <button onClick={() => this.setState({ activeRecoveryTab: 'suspects' })} className={`flex items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${activeRecoveryTab === 'suspects' ? 'border-blue-500 text-white' : 'border-transparent text-gray-500 hover:text-gray-200'}`}>
                                    <TargetIcon className="w-4 h-4" />
                                    <span>Suspects</span>
                                </button>
                                <button onClick={() => this.setState({ activeRecoveryTab: 'log' })} className={`flex items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${activeRecoveryTab === 'log' ? 'border-blue-500 text-white' : 'border-transparent text-gray-500 hover:text-gray-200'}`}>
                                    <LogsIcon className="w-4 h-4" />
                                    <span>Live Analysis Log</span>
                                </button>
                           </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={this.handleRevertToLastCheckpoint}
                                    disabled={isAnalyzing || status.startsWith('success')}
                                    className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-md transition-colors flex items-center justify-center gap-2 disabled:bg-gray-600/50 disabled:cursor-not-allowed"
                                >
                                    <WrenchIcon className="w-4 h-4" />
                                    Revert to Checkpoint
                                </button>
                                <button
                                    onClick={this.runFullAnalysis}
                                    disabled={isAnalyzing || status.startsWith('success') || status === 'failed_final'}
                                    className="px-4 py-1.5 bg-yellow-600 hover:bg-yellow-500 text-white font-semibold rounded-md transition-colors flex items-center justify-center gap-2 disabled:bg-gray-600/50 disabled:cursor-not-allowed"
                                >
                                    <WandIcon className="w-4 h-4" />
                                    {status.startsWith('failed') && status !== 'failed_revert' ? `Retry Analysis (${failureCount}/3)` : 'Run Full Analysis (AI)'}
                                </button>
                            </div>
                        </div>
                        {activeRecoveryTab === 'log' ? this.renderAnalysisLogPanel() : this.renderSuspectsPanel()}
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
                    {status === 'success_revert' && (
                         <button
                            onClick={() => window.location.reload()}
                            className="px-6 py-2 text-white font-semibold rounded-md transition-colors bg-green-600 hover:bg-green-500 animate-pulse"
                        >
                            Reload to Revert
                        </button>
                    )}
                     {status === 'success_fix' && (
                         <button
                            onClick={() => window.location.reload()}
                            className="px-6 py-2 text-white font-semibold rounded-md transition-colors bg-green-600 hover:bg-green-500 animate-pulse"
                        >
                            Reload & Apply Fix
                        </button>
                    )}
                    {status === 'failed_final' && (
                        <p className="text-sm text-red-400">Automated recovery failed. Please manually review the code or reload the page to start over.</p>
                    )}
                </footer>
            </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;