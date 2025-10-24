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
}

export interface LogEntry {
    type: string;
    message: string;
}

export type SelectedObject = {
    id: string;
    name: string;
} | null;

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

// --- New Diagnostic Types ---
export interface AccessibilityIssue {
    severity: 'critical' | 'warning';
    message: string;
    element: string; // A selector for the element
}

export interface MetaIssue {
    severity: 'critical' | 'warning';
    message: string;
    tag: string;
}