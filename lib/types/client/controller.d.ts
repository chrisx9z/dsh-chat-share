/** Browser state and actions for sharing a selected range of chat messages. */
import { type SessionId, type SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client';
import type { HistoryEntry } from '@deepseek-ai/dsh-api-remotes/client';
/** Output formats the shared artifact can take. */
export type ShareFormat = 'markdown' | 'html' | 'txt';
/** One shareable message on the ordered chat surface. */
export interface ShareMessage {
    /** Durable event seq the message came from. */
    readonly seq: number;
    readonly role: 'user' | 'assistant';
    /** Text blocks joined verbatim; `[image]` when the message carried only images. */
    readonly text: string;
    /** Unix epoch milliseconds of the durable event. */
    readonly time: number;
}
/** One Session's share-dialog state. */
export interface ChatShareEntry {
    readonly open: boolean;
    /** History pages are still being read. */
    readonly loading: boolean;
    /** Shareable messages in chronological order (newest last). */
    readonly messages: readonly ShareMessage[];
    /** Inclusive range start index into `messages`. */
    readonly from: number;
    /** Inclusive range end index into `messages`. */
    readonly to: number;
    readonly format: ShareFormat;
    /** Which output action is in flight, if any. */
    readonly busy: 'copy' | 'download' | null;
    /** Whether the last copy succeeded (the dialog shows a brief check). */
    readonly copied: boolean;
    /** Raw error detail; the dialog maps known codes to localized copy. */
    readonly error: string | null;
}
/** Share-dialog states keyed by the Session whose Header owns the dialog. */
export interface ChatShareState {
    bySession: Record<string, ChatShareEntry | undefined>;
}
/** One `session.history` page as the controller reads it. */
export interface HistoryPage {
    readonly events: readonly HistoryEntry[];
    readonly hasMore: boolean;
}
/** Pages the controller reads; wired to `session.history` by the client plugin. */
export type HistoryReader = (sessionId: SessionId, beforeSeq: number | undefined, maxMessages: number) => Promise<HistoryPage>;
/** The narrow content-block view the share builder reads (type-only, no cross-package value import). */
export interface ShareContentBlock {
    readonly type: string;
    readonly text?: string;
}
/** Cap on collected share messages, so a huge session cannot stall the dialog. */
export declare const SHARE_MAX_MESSAGES = 300;
/** Known controller error codes the dialog localizes; anything else is shown raw. */
export declare const CHAT_SHARE_ERROR: {
    readonly copyFailed: "copy-failed";
    readonly downloadFailed: "download-failed";
};
/**
 * Join a message's content into one share text: text blocks verbatim, and a
 * `[image]` marker for image-only messages.
 * @param content - the message's model-facing blocks.
 * @returns the share text, or '' when the message carries nothing shareable.
 */
export declare function shareMessageText(content: readonly ShareContentBlock[]): string;
/**
 * Fold history entries (chronological) into shareable user/assistant messages.
 * Tool results, boundary markers, and surface-replacing compaction copies are
 * excluded; messages with no shareable text are dropped.
 * @param events - history entries in log order.
 * @returns share messages in the same order.
 */
export declare function buildShareMessages(events: readonly HistoryEntry[]): ShareMessage[];
/** Hand a Blob to the browser download manager through an object URL. */
export declare function saveBlob(blob: Blob, filename: string): void;
/**
 * Owns one in-flight history load per Session and publishes share-dialog state.
 */
export declare class ChatShareController {
    private readonly reader;
    private readonly clipboard;
    private readonly save;
    /** uSES-safe state source shared by every Session-scoped dialog contribution. */
    readonly store: SnapshotStore<ChatShareState>;
    private readonly active;
    private disposed;
    /**
     * @param reader - paged `session.history` reader (tail page when `beforeSeq` is absent).
     * @param clipboard - clipboard writer returning whether the write landed.
     * @param save - browser save operation for the generated artifact Blob.
     */
    constructor(reader: HistoryReader, clipboard?: (text: string) => Promise<boolean>, save?: (blob: Blob, filename: string) => void);
    /**
     * Open (or reopen) one Session's share dialog; concurrent gestures share one load.
     * @param sessionId - Session whose chat segment is shared.
     * @returns after the dialog state settles (open, loaded, or failed).
     */
    open(sessionId: SessionId): Promise<void>;
    /**
     * Close one Session's dialog, keeping its loaded messages for the next open.
     * @param sessionId - Session whose modal closes.
     */
    dismiss(sessionId: SessionId): void;
    /**
     * Download the Session's whole shareable chat as plain text without opening
     * the dialog (the sidebar `...` menu action). Joins an in-flight history
     * load instead of starting a second one.
     * @param sessionId - Session whose chat is saved.
     * @returns after the browser save starts; load failures publish the error.
     */
    saveTxt(sessionId: SessionId): Promise<void>;
    /**
     * Select the inclusive message range, clamping and normalizing the bounds.
     * @param sessionId - Session owning the dialog.
     * @param from - range start index.
     * @param to - range end index.
     */
    setRange(sessionId: SessionId, from: number, to: number): void;
    /**
     * Switch the output format.
     * @param sessionId - Session owning the dialog.
     * @param format - Markdown or HTML.
     */
    setFormat(sessionId: SessionId, format: ShareFormat): void;
    /**
     * Render the selected range as Markdown and write it to the clipboard.
     * @param sessionId - Session owning the dialog.
     * @returns after the write settles; the dialog shows a check on success.
     */
    copy(sessionId: SessionId): Promise<void>;
    /**
     * Render the selected range in the chosen format and download it as a file.
     * @param sessionId - Session owning the dialog.
     * @returns after the browser save starts.
     */
    download(sessionId: SessionId): Promise<void>;
    /**
     * Abort active loads and reach quiescence.
     * @returns after every active operation settles.
     */
    dispose(): Promise<void>;
    private entry;
    private range;
    private run;
    private loadMessages;
    private readPage;
    /** Load the whole shareable chat and hand it to the browser save operation. */
    private loadAllTxt;
    /** Save the already-loaded shareable chat as one plain-text file. */
    private downloadAllTxt;
    private saveTxtBlob;
    private publish;
}
//# sourceMappingURL=controller.d.ts.map