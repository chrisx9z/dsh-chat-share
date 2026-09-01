/** Browser state and actions for sharing a selected range of chat messages. */
import { type SessionId, type SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client';
import type { HistoryEntry } from '@deepseek-ai/dsh-api-remotes/client';
import { type ShareLabels, type ShareMeta } from './render.ts';
/** Output formats the shared artifact can take. */
export type ShareFormat = 'markdown' | 'html' | 'txt' | 'png';
/** One session image referenced by a message, resolved lazily for HTML exports. */
export interface ShareImage {
    readonly attachmentId: string;
    readonly mediaType: string;
    readonly name?: string;
}
/** One shareable row on the ordered chat surface. */
export interface ShareMessage {
    /** Durable event seq the row came from. */
    readonly seq: number;
    readonly role: 'user' | 'assistant' | 'tool' | 'subagent';
    /** Text blocks joined verbatim; `[image]` when the message carried only images. */
    readonly text: string;
    /** Unix epoch milliseconds of the durable event. */
    readonly time: number;
    /** Image blocks attached to this message (HTML exports embed them). */
    readonly images?: readonly ShareImage[];
}
/** One Session's share-dialog state. */
export interface ChatShareEntry {
    readonly open: boolean;
    /** History pages are still being read. */
    readonly loading: boolean;
    /** Raw chronological history entries the message list is rebuilt from. */
    readonly raw: readonly HistoryEntry[];
    /** Shareable rows in chronological order (newest last). */
    readonly messages: readonly ShareMessage[];
    /** Inclusive range start index into `messages` (single-select mode). */
    readonly from: number;
    /** Inclusive range end index into `messages` (single-select mode). */
    readonly to: number;
    /** Multi-select mode: exports the union of `selected` row indices instead of the range. */
    readonly multiMode: boolean;
    /** Row indices chosen in multi-select mode (sorted, no duplicates). */
    readonly selected: readonly number[];
    readonly format: ShareFormat;
    /** Best-effort redaction applied to every rendered artifact. */
    readonly redact: boolean;
    /** Tool-call rows included in the list and artifacts. */
    readonly includeTools: boolean;
    /** Subagent descendant conversations appended to the rows. */
    readonly includeSubagents: boolean;
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
/** Resolve one session image to its base64 payload; wired to `session.attachment`. */
export type AttachmentReader = (sessionId: SessionId, attachmentId: string) => Promise<{
    data: string;
    mediaType: string;
}>;
/** Read optional artifact header facts (title, model); wired by the client plugin. */
export type MetaReader = (sessionId: SessionId) => Promise<ShareMeta>;
/** One session-backed subagent child (from `subagents.list`). */
export interface SubagentChild {
    readonly childSessionId: string;
    readonly title?: string;
}
/** List a Session's direct subagent children; wired to `subagents.list`. */
export type SubagentReader = (parentSessionId: SessionId) => Promise<SubagentChild[]>;
/** Read one child's message tail; wired to `subagents.history`. */
export type ChildHistoryReader = (parentSessionId: SessionId, childSessionId: string) => Promise<readonly HistoryEntry[]>;
/** Rasterize a detached artifact node to a PNG data URL; wired to `html-to-image`. */
export type PngConverter = (node: HTMLElement) => Promise<string>;
/** The narrow content-block view the share builder reads (type-only, no cross-package value import). */
export interface ShareContentBlock {
    readonly type: string;
    readonly text?: string;
    readonly attachment?: {
        readonly attachmentId?: string;
        readonly mediaType?: string;
        readonly name?: string;
    };
}
/** Cap on collected share messages, so a huge session cannot stall the dialog. */
export declare const SHARE_MAX_MESSAGES = 300;
/** Known controller error codes the dialog localizes; anything else is shown raw. */
export declare const CHAT_SHARE_ERROR: {
    readonly copyFailed: "copy-failed";
    readonly downloadFailed: "download-failed";
};
/**
 * Split a message's content into share text and image references.
 * @param content - the message's model-facing blocks.
 * @returns the share text ('' when nothing shareable) and the image refs.
 */
export declare function shareMessageParts(content: readonly ShareContentBlock[]): {
    text: string;
    images: ShareImage[];
};
/**
 * Fold history entries (chronological) into shareable rows: user/assistant
 * messages with their image refs, optional tool-call rows, newest last.
 * Tool results, boundary markers, and surface-replacing compaction copies are
 * excluded; messages with no shareable text are dropped.
 * @param events - history entries in log order.
 * @param options - include tool-call rows when enabled.
 * @returns share rows in the same order.
 */
export declare function buildShareMessages(events: readonly HistoryEntry[], options?: {
    includeTools?: boolean;
}): ShareMessage[];
/** Hand a Blob to the browser download manager through an object URL. */
export declare function saveBlob(blob: Blob, filename: string): void;
/**
 * Owns one in-flight history load per Session and publishes share-dialog state.
 */
export declare class ChatShareController {
    private readonly reader;
    private readonly clipboard;
    private readonly save;
    private readonly attachments?;
    private readonly meta?;
    private readonly labels?;
    private readonly subagents?;
    private readonly childHistory?;
    private readonly toPng?;
    /** uSES-safe state source shared by every Session-scoped dialog contribution. */
    readonly store: SnapshotStore<ChatShareState>;
    private readonly active;
    private disposed;
    /**
     * @param reader - paged `session.history` reader (tail page when `beforeSeq` is absent).
     * @param clipboard - clipboard writer returning whether the write landed.
     * @param save - browser save operation for the generated artifact Blob.
     * @param attachments - optional `session.attachment` reader for HTML image embedding.
     * @param meta - optional artifact header facts reader (title, model).
     * @param labels - optional live artifact vocabulary (follows the UI locale).
     * @param subagents - optional `subagents.list` reader for child conversations.
     * @param childHistory - optional `subagents.history` reader (one message tail per child).
     * @param toPng - optional `html-to-image` rasterizer for PNG downloads.
     */
    constructor(reader: HistoryReader, clipboard?: (text: string) => Promise<boolean>, save?: (blob: Blob, filename: string) => void, attachments?: AttachmentReader | undefined, meta?: MetaReader | undefined, labels?: (() => ShareLabels) | undefined, subagents?: SubagentReader | undefined, childHistory?: ChildHistoryReader | undefined, toPng?: PngConverter | undefined);
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
     * @param lastN - when given, save only the newest N messages.
     * @returns after the browser save starts; load failures publish the error.
     */
    saveTxt(sessionId: SessionId, lastN?: number): Promise<void>;
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
     * @param format - Markdown, HTML, or TXT.
     */
    setFormat(sessionId: SessionId, format: ShareFormat): void;
    /**
     * Toggle best-effort redaction of the rendered artifacts.
     * @param sessionId - Session owning the dialog.
     * @param redact - mask credential shapes and local paths.
     */
    setRedact(sessionId: SessionId, redact: boolean): void;
    /**
     * Toggle tool-call rows in the list and artifacts (rebuilt from raw history).
     * @param sessionId - Session owning the dialog.
     * @param includeTools - show tool-call rows.
     */
    setIncludeTools(sessionId: SessionId, includeTools: boolean): void;
    /**
     * Toggle multi-select mode: the export becomes the union of chosen rows
     * instead of the contiguous range. Entering the mode seeds the selection
     * with the current range; leaving it clears the selection.
     * @param sessionId - Session owning the dialog.
     * @param multiMode - export the selected rows.
     */
    setMultiMode(sessionId: SessionId, multiMode: boolean): void;
    /**
     * Replace the multi-select row set (indices into `messages`, deduplicated).
     * @param sessionId - Session owning the dialog.
     * @param indices - chosen row indices.
     */
    setSelected(sessionId: SessionId, indices: readonly number[]): void;
    /**
     * Toggle subagent descendant conversations appended to the rows.
     * @param sessionId - Session owning the dialog.
     * @param includeSubagents - append child conversations.
     * @returns after the rebuild settles (children are fetched on demand).
     */
    setIncludeSubagents(sessionId: SessionId, includeSubagents: boolean): Promise<void>;
    /**
     * Render the selected rows as Markdown and write it to the clipboard.
     * @param sessionId - Session owning the dialog.
     * @returns after the write settles; the dialog shows a check on success.
     */
    copy(sessionId: SessionId): Promise<void>;
    /**
     * Render the selected rows in the chosen format and download them as a file.
     * @param sessionId - Session owning the dialog.
     * @returns after the browser save starts.
     */
    download(sessionId: SessionId): Promise<void>;
    /** Rasterize the artifact HTML into a PNG download. */
    private downloadPng;
    /**
     * Abort active loads and reach quiescence.
     * @returns after every active operation settles.
     */
    dispose(): Promise<void>;
    private entry;
    /** Build the bounded row list from raw history (newest SHARE_MAX_MESSAGES). */
    private buildRows;
    /** Parent rows plus one section header and message tail per subagent child. */
    private buildRowsWithSubagents;
    /** The rows the current selection mode exports: range or multi-select union. */
    private selectedRows;
    /** Apply the current options to a row list: tool rows filtered, redaction applied. */
    private applyOptions;
    /** The selected inclusive range of the dialog's message list. */
    private range;
    private metaOf;
    private resolveImages;
    private run;
    /** Load the whole shareable chat and hand it to the browser save operation. */
    private loadAllTxt;
    /** Save the already-loaded shareable chat as one plain-text file. */
    private downloadAllTxt;
    private saveTxtBlob;
    private loadRaw;
    private readPage;
    private publish;
}
//# sourceMappingURL=controller.d.ts.map