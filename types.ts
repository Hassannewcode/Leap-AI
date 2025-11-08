// FIX: Add all type definitions that were missing.
export type WorkspaceType = '2D' | '3D';
export type AiMode = 'standard' | 'team';

export interface FileEntry {
    path: string;
    content: string;
}

export interface GroundingSource {
    uri: string;
    title: string;
}

export interface AssetInfo {
    url: string;
    source: string;
}

export interface LocalAsset {
    id: string;
    name: string;
    dataUrl: string;
    mimeType: string;
}

export interface BaseChatMessage {
    id: string;
    role: 'user' | 'model';
    text: string;
}

export interface UserChatMessage extends BaseChatMessage {
    role: 'user';
    image?: { data: string; mimeType: string };
}

export interface ModelChatMessage extends BaseChatMessage {
    role: 'model';
    thinking?: string;
    fullResponse: string;
    assetsUsed?: AssetInfo[];
    groundingSources?: GroundingSource[];
    filesUpdated?: string[];
    checkpoint?: FileEntry[];
    isFixable?: boolean;
    originalPrompt?: string;
    rated?: boolean;
}

export type ChatMessage = UserChatMessage | ModelChatMessage;

export interface Workspace {
    id: string;
    name: string;
    type: WorkspaceType;
    files: FileEntry[];
    chatHistory: ChatMessage[];
    localAssets: LocalAsset[];
    lastModified: number;
    undoStack?: FileEntry[][];
    redoStack?: FileEntry[][];
}

export interface LogEntry {
    type: string;
    message: string;
}

export interface SceneObject {
    id: string;
    name: string;
    type: string; // e.g. 'Sprite', 'UIText', 'Mesh'
}

export interface SelectedObject2D {
    id: string;
    name: string;
    type: '2D';
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number; // in radians
    alpha: number;
}

export interface SelectedObject3D {
    id: string;
    name: string;
    type: '3D';
    position: { x: number; y: number; z: number };
    scale: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number }; // Euler angles in radians
}

export type SelectedObject = SelectedObject2D | SelectedObject3D | null;


export interface DebuggerIncident {
    id: string;
    timestamp: number;
    threatLevel: 'trusted' | 'untrusted'; // 'trusted' for engine warnings, 'untrusted' for global errors
    suspect: string; // e.g., 'Engine.create.sprite', 'Global Exception', 'Promise Rejection'
    message: string; // The core error message
    evidence: {
        stack?: string;
        context?: any;
    };
}

// FIX: Add missing type definitions for DiagnosticData and UserActivityEvent to resolve compilation errors in ErrorBoundary.tsx.
export interface UserActivityEvent {
    type: 'click' | 'keydown';
    timestamp: number;
    details: {
        selector?: string;
        position?: { x: number; y: number };
        key?: string;
        code?: string;
        text?: string;
    };
}

export interface DiagnosticData {
    error: any;
    userActivity: UserActivityEvent[];
    layoutShifts: any[];
    interactionTimings: any[];
    accessibilityIssues: AccessibilityIssue[];
    metaIssues: MetaIssue[];
    componentStack: string;
    boundarySelector: string;
}

// --- New Types for Diagnostics ---

export interface AccessibilityIssue {
    selector: string;
    issue: string;
    element: string;
}

export interface MetaIssue {
    tag: string;
    issue: string;
}