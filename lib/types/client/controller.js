/** Browser state and actions for sharing a selected range of chat messages. */
import { createSnapshotStore } from '@deepseek-ai/dsh-client-runtime/client';
import { writeClipboard } from '@deepseek-ai/dsh-client-ui-primitives';
import { redactSensitive, renderShareHtml, renderShareMarkdown, renderShareTxt, shareFileName, } from "./render.js";
/** Cap on collected share messages, so a huge session cannot stall the dialog. */
export const SHARE_MAX_MESSAGES = 300;
/** Cap on tool-call arguments carried into artifacts. */
const TOOL_ARGS_MAX_CHARS = 800;
/** Messages per `session.history` page. */
const PAGE_MESSAGES = 50;
/** Safety cap on history pages read per open. */
const MAX_PAGES = 100;
const INITIAL = { bySession: {} };
/** Known controller error codes the dialog localizes; anything else is shown raw. */
export const CHAT_SHARE_ERROR = {
    copyFailed: 'copy-failed',
    downloadFailed: 'download-failed',
};
/**
 * Split a message's content into share text and image references.
 * @param content - the message's model-facing blocks.
 * @returns the share text ('' when nothing shareable) and the image refs.
 */
export function shareMessageParts(content) {
    const parts = [];
    const images = [];
    for (const block of content) {
        if (block.type === 'text')
            parts.push(block.text ?? '');
        else if (block.type === 'image') {
            const attachmentId = block.attachment?.attachmentId;
            if (attachmentId !== undefined) {
                images.push({
                    attachmentId,
                    mediaType: block.attachment?.mediaType ?? 'image/png',
                    ...(block.attachment?.name !== undefined ? { name: block.attachment.name } : {}),
                });
            }
            else {
                parts.push('[image]');
            }
        }
    }
    const text = parts.join('\n');
    return { text: text !== '' ? text : images.length > 0 ? '[image]' : '', images };
}
/**
 * Fold history entries (chronological) into shareable rows: user/assistant
 * messages with their image refs, optional tool-call rows, newest last.
 * Tool results, boundary markers, and surface-replacing compaction copies are
 * excluded; messages with no shareable text are dropped.
 * @param events - history entries in log order.
 * @param options - include tool-call rows when enabled.
 * @returns share rows in the same order.
 */
export function buildShareMessages(events, options = {}) {
    const messages = [];
    for (const entry of events) {
        const event = entry.event;
        if (event.type === 'user/message') {
            if (event.surfaceOp !== 'append')
                continue;
            const { text, images } = shareMessageParts(event.data.content);
            if (text === '')
                continue;
            messages.push({
                seq: event.seq, role: 'user', text, time: event.time,
                ...(images.length > 0 ? { images } : {}),
            });
        }
        else if (event.type === 'assistant/message') {
            if (event.surfaceOp !== 'append')
                continue;
            const { text, images } = shareMessageParts(event.data.message.content);
            if (text === '')
                continue;
            messages.push({
                seq: event.seq, role: 'assistant', text, time: event.time,
                ...(images.length > 0 ? { images } : {}),
            });
        }
        else if (event.type === 'tool/call' && options.includeTools === true) {
            const args = event.data.arguments;
            const bounded = args.length > TOOL_ARGS_MAX_CHARS ? `${args.slice(0, TOOL_ARGS_MAX_CHARS)}\n…` : args;
            messages.push({
                seq: event.seq,
                role: 'tool',
                text: `\`${event.data.name}\`\n\n${bounded}`,
                time: event.time,
            });
        }
    }
    return messages;
}
function messageOf(error) {
    return error instanceof Error ? error.message : String(error);
}
/** Hand a Blob to the browser download manager through an object URL. */
export function saveBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    setTimeout(() => { URL.revokeObjectURL(url); }, 10_000);
}
/**
 * Owns one in-flight history load per Session and publishes share-dialog state.
 */
export class ChatShareController {
    reader;
    clipboard;
    save;
    attachments;
    meta;
    labels;
    subagents;
    childHistory;
    toPng;
    /** uSES-safe state source shared by every Session-scoped dialog contribution. */
    store = createSnapshotStore(INITIAL);
    active = new Map();
    disposed = false;
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
    constructor(reader, clipboard = writeClipboard, save = saveBlob, attachments, meta, labels, subagents, childHistory, toPng) {
        this.reader = reader;
        this.clipboard = clipboard;
        this.save = save;
        this.attachments = attachments;
        this.meta = meta;
        this.labels = labels;
        this.subagents = subagents;
        this.childHistory = childHistory;
        this.toPng = toPng;
    }
    /**
     * Open (or reopen) one Session's share dialog; concurrent gestures share one load.
     * @param sessionId - Session whose chat segment is shared.
     * @returns after the dialog state settles (open, loaded, or failed).
     */
    open(sessionId) {
        const existing = this.active.get(sessionId);
        if (existing !== undefined)
            return existing.done;
        if (this.disposed)
            return Promise.resolve();
        const abort = new AbortController();
        const done = this.run(sessionId, abort.signal).finally(() => {
            this.active.delete(sessionId);
        });
        this.active.set(sessionId, { abort, done });
        return done;
    }
    /**
     * Close one Session's dialog, keeping its loaded messages for the next open.
     * @param sessionId - Session whose modal closes.
     */
    dismiss(sessionId) {
        const current = this.store.getSnapshot().bySession[String(sessionId)];
        if (current === undefined || !current.open)
            return;
        this.publish(sessionId, { ...current, open: false, busy: null });
    }
    /**
     * Download the Session's whole shareable chat as plain text without opening
     * the dialog (the sidebar `...` menu action). Joins an in-flight history
     * load instead of starting a second one.
     * @param sessionId - Session whose chat is saved.
     * @param lastN - when given, save only the newest N messages.
     * @returns after the browser save starts; load failures publish the error.
     */
    saveTxt(sessionId, lastN) {
        const existing = this.active.get(sessionId);
        if (existing !== undefined) {
            return existing.done.then(() => this.downloadAllTxt(sessionId, lastN));
        }
        if (this.disposed)
            return Promise.resolve();
        const abort = new AbortController();
        const done = this.loadAllTxt(sessionId, lastN, abort.signal).finally(() => {
            this.active.delete(sessionId);
        });
        this.active.set(sessionId, { abort, done });
        return done;
    }
    /**
     * Select the inclusive message range, clamping and normalizing the bounds.
     * @param sessionId - Session owning the dialog.
     * @param from - range start index.
     * @param to - range end index.
     */
    setRange(sessionId, from, to) {
        const current = this.entry(sessionId);
        if (current === undefined || current.messages.length === 0)
            return;
        const clamp = (index) => Math.max(0, Math.min(current.messages.length - 1, Math.round(index)));
        const start = clamp(from);
        const end = clamp(to);
        this.publish(sessionId, { ...current, from: Math.min(start, end), to: Math.max(start, end), error: null });
    }
    /**
     * Switch the output format.
     * @param sessionId - Session owning the dialog.
     * @param format - Markdown, HTML, or TXT.
     */
    setFormat(sessionId, format) {
        const current = this.entry(sessionId);
        if (current === undefined)
            return;
        this.publish(sessionId, { ...current, format, error: null });
    }
    /**
     * Toggle best-effort redaction of the rendered artifacts.
     * @param sessionId - Session owning the dialog.
     * @param redact - mask credential shapes and local paths.
     */
    setRedact(sessionId, redact) {
        const current = this.entry(sessionId);
        if (current === undefined)
            return;
        this.publish(sessionId, { ...current, redact, error: null });
    }
    /**
     * Toggle tool-call rows in the list and artifacts (rebuilt from raw history).
     * @param sessionId - Session owning the dialog.
     * @param includeTools - show tool-call rows.
     */
    setIncludeTools(sessionId, includeTools) {
        const current = this.entry(sessionId);
        if (current === undefined)
            return;
        const messages = this.buildRows(current.raw, includeTools);
        const clamp = (index) => Math.max(0, Math.min(messages.length - 1, index));
        const from = clamp(current.from);
        const to = clamp(current.to);
        const selected = current.selected.filter(index => index < messages.length);
        this.publish(sessionId, { ...current, includeTools, messages, from, to, selected, error: null });
    }
    /**
     * Toggle multi-select mode: the export becomes the union of chosen rows
     * instead of the contiguous range. Entering the mode seeds the selection
     * with the current range; leaving it clears the selection.
     * @param sessionId - Session owning the dialog.
     * @param multiMode - export the selected rows.
     */
    setMultiMode(sessionId, multiMode) {
        const current = this.entry(sessionId);
        if (current === undefined)
            return;
        const selected = multiMode
            ? [...new Set(Array.from({ length: current.to - current.from + 1 }, (_, offset) => current.from + offset))]
            : [];
        this.publish(sessionId, { ...current, multiMode, selected, error: null });
    }
    /**
     * Replace the multi-select row set (indices into `messages`, deduplicated).
     * @param sessionId - Session owning the dialog.
     * @param indices - chosen row indices.
     */
    setSelected(sessionId, indices) {
        const current = this.entry(sessionId);
        if (current === undefined)
            return;
        const selected = [...new Set(indices)]
            .map(index => Math.max(0, Math.min(current.messages.length - 1, Math.round(index))))
            .sort((left, right) => left - right);
        this.publish(sessionId, { ...current, selected, error: null });
    }
    /**
     * Toggle subagent descendant conversations appended to the rows.
     * @param sessionId - Session owning the dialog.
     * @param includeSubagents - append child conversations.
     * @returns after the rebuild settles (children are fetched on demand).
     */
    async setIncludeSubagents(sessionId, includeSubagents) {
        const current = this.entry(sessionId);
        if (current === undefined)
            return;
        this.publish(sessionId, { ...current, includeSubagents, loading: includeSubagents, error: null });
        try {
            const messages = includeSubagents
                ? await this.buildRowsWithSubagents(sessionId, current.raw, current.includeTools)
                : this.buildRows(current.raw, current.includeTools);
            const next = this.entry(sessionId);
            if (next === undefined)
                return;
            const clamp = (index) => Math.max(0, Math.min(messages.length - 1, index));
            const from = clamp(next.from);
            const to = clamp(next.to);
            const selected = next.selected.filter(index => index < messages.length);
            this.publish(sessionId, {
                ...next, includeSubagents, loading: false, messages, from, to, selected, error: null,
            });
        }
        catch (error) {
            const next = this.entry(sessionId);
            if (next === undefined)
                return;
            this.publish(sessionId, { ...next, loading: false, error: messageOf(error) });
        }
    }
    /**
     * Render the selected rows as Markdown and write it to the clipboard.
     * @param sessionId - Session owning the dialog.
     * @returns after the write settles; the dialog shows a check on success.
     */
    async copy(sessionId) {
        const current = this.entry(sessionId);
        if (current === undefined || current.messages.length === 0 || current.busy !== null)
            return;
        this.publish(sessionId, { ...current, busy: 'copy', copied: false, error: null });
        const meta = await this.metaOf(sessionId);
        const text = renderShareMarkdown(this.applyOptions(current, this.selectedRows(current)), {
            meta,
            ...(this.labels !== undefined ? { labels: this.labels() } : {}),
        });
        const ok = await this.clipboard(text);
        const next = this.store.getSnapshot().bySession[String(sessionId)];
        if (next === undefined || !next.open)
            return;
        this.publish(sessionId, ok
            ? { ...next, busy: null, copied: true }
            : { ...next, busy: null, error: CHAT_SHARE_ERROR.copyFailed });
    }
    /**
     * Render the selected rows in the chosen format and download them as a file.
     * @param sessionId - Session owning the dialog.
     * @returns after the browser save starts.
     */
    async download(sessionId) {
        const current = this.entry(sessionId);
        if (current === undefined || current.messages.length === 0 || current.busy !== null)
            return;
        this.publish(sessionId, { ...current, busy: 'download', error: null });
        const selected = this.applyOptions(current, this.selectedRows(current));
        try {
            if (current.format === 'png') {
                await this.downloadPng(sessionId, selected, current);
                return;
            }
            const [meta, images] = await Promise.all([
                this.metaOf(sessionId),
                current.format === 'html' ? this.resolveImages(sessionId, selected) : Promise.resolve(undefined),
            ]);
            const options = {
                meta,
                ...(this.labels !== undefined ? { labels: this.labels() } : {}),
                ...(images !== undefined ? { images } : {}),
            };
            const blob = current.format === 'html'
                ? new Blob([renderShareHtml(selected, options)], { type: 'text/html;charset=utf-8' })
                : current.format === 'txt'
                    ? new Blob([renderShareTxt(selected, options)], { type: 'text/plain;charset=utf-8' })
                    : new Blob([renderShareMarkdown(selected, options)], { type: 'text/markdown;charset=utf-8' });
            this.save(blob, shareFileName(String(sessionId), current.from, current.to, current.format));
            const next = this.store.getSnapshot().bySession[String(sessionId)];
            if (next !== undefined && next.open)
                this.publish(sessionId, { ...next, busy: null });
        }
        catch (error) {
            const next = this.store.getSnapshot().bySession[String(sessionId)];
            if (next !== undefined && next.open) {
                this.publish(sessionId, { ...next, busy: null, error: messageOf(error) || CHAT_SHARE_ERROR.downloadFailed });
            }
        }
    }
    /** Rasterize the artifact HTML into a PNG download. */
    async downloadPng(sessionId, selected, current) {
        if (this.toPng === undefined) {
            throw new Error('PNG export is unavailable on this host.');
        }
        const meta = await this.metaOf(sessionId);
        const options = {
            meta,
            ...(this.labels !== undefined ? { labels: this.labels() } : {}),
        };
        const node = document.createElement('div');
        node.style.position = 'fixed';
        node.style.left = '-10000px';
        node.style.top = '0';
        node.style.width = '820px';
        node.innerHTML = renderShareHtml(selected, options);
        document.body.appendChild(node);
        try {
            const dataUrl = await this.toPng(node);
            const blob = new Blob([dataUrl], { type: 'image/png' });
            this.save(blob, shareFileName(String(sessionId), current.from, current.to, 'png'));
            const next = this.store.getSnapshot().bySession[String(sessionId)];
            if (next !== undefined && next.open)
                this.publish(sessionId, { ...next, busy: null });
        }
        finally {
            node.remove();
        }
    }
    /**
     * Abort active loads and reach quiescence.
     * @returns after every active operation settles.
     */
    async dispose() {
        this.disposed = true;
        const active = [...this.active.values()];
        for (const operation of active)
            operation.abort.abort();
        await Promise.allSettled(active.map(operation => operation.done));
    }
    entry(sessionId) {
        return this.store.getSnapshot().bySession[String(sessionId)];
    }
    /** Build the bounded row list from raw history (newest SHARE_MAX_MESSAGES). */
    buildRows(raw, includeTools) {
        return buildShareMessages(raw, { includeTools }).slice(-SHARE_MAX_MESSAGES);
    }
    /** Parent rows plus one section header and message tail per subagent child. */
    async buildRowsWithSubagents(parentSessionId, raw, includeTools) {
        const rows = buildShareMessages(raw, { includeTools }).slice(-SHARE_MAX_MESSAGES);
        if (this.subagents === undefined || this.childHistory === undefined)
            return rows;
        const children = await this.subagents(parentSessionId);
        const appended = [];
        for (const child of children) {
            appended.push({
                seq: Number.NEGATIVE_INFINITY,
                role: 'subagent',
                text: child.title ?? child.childSessionId,
                time: 0,
            });
            const events = await this.childHistory(parentSessionId, child.childSessionId);
            appended.push(...buildShareMessages(events, { includeTools }));
        }
        return appended.length === 0 ? rows : [...rows, ...appended];
    }
    /** The rows the current selection mode exports: range or multi-select union. */
    selectedRows(entry) {
        if (!entry.multiMode)
            return this.range(entry);
        const byIndex = new Map(entry.messages.map((message, index) => [index, message]));
        return entry.selected
            .filter(index => index >= 0 && index < entry.messages.length)
            .map(index => byIndex.get(index));
    }
    /** Apply the current options to a row list: tool rows filtered, redaction applied. */
    applyOptions(entry, rows) {
        const kept = entry.includeTools ? [...rows] : rows.filter(message => message.role !== 'tool');
        return entry.redact
            ? kept.map(message => ({ ...message, text: redactSensitive(message.text) }))
            : kept;
    }
    /** The selected inclusive range of the dialog's message list. */
    range(entry) {
        return entry.messages.slice(entry.from, entry.to + 1);
    }
    async metaOf(sessionId) {
        if (this.meta === undefined)
            return {};
        try {
            return await this.meta(sessionId);
        }
        catch {
            return {};
        }
    }
    async resolveImages(sessionId, messages) {
        if (this.attachments === undefined)
            return undefined;
        const resolved = new Map();
        for (const message of messages) {
            for (const image of message.images ?? []) {
                if (resolved.has(image.attachmentId))
                    continue;
                try {
                    const { data, mediaType } = await this.attachments(sessionId, image.attachmentId);
                    resolved.set(image.attachmentId, `data:${mediaType};base64,${data}`);
                }
                catch {
                    // Keep the placeholder marker for images that fail to resolve.
                }
            }
        }
        return resolved;
    }
    async run(sessionId, signal) {
        const current = this.entry(sessionId);
        if (current !== undefined && current.messages.length > 0) {
            this.publish(sessionId, { ...current, open: true, busy: null, copied: false, error: null });
            return;
        }
        this.publish(sessionId, {
            open: true,
            loading: true,
            raw: [],
            messages: [],
            from: 0,
            to: 0,
            multiMode: false,
            selected: [],
            format: current?.format ?? 'markdown',
            redact: current?.redact ?? true,
            includeTools: current?.includeTools ?? false,
            includeSubagents: current?.includeSubagents ?? false,
            busy: null,
            copied: false,
            error: null,
        });
        try {
            const raw = await this.loadRaw(sessionId, signal);
            const messages = this.buildRows(raw, false);
            this.publish(sessionId, {
                open: true,
                loading: false,
                raw,
                messages,
                from: 0,
                to: Math.max(0, messages.length - 1),
                multiMode: false,
                selected: [],
                format: 'markdown',
                redact: true,
                includeTools: false,
                includeSubagents: false,
                busy: null,
                copied: false,
                error: null,
            });
        }
        catch (error) {
            if (signal.aborted)
                return;
            const entry = this.entry(sessionId) ?? {
                open: true, loading: false, raw: [], messages: [], from: 0, to: 0,
                multiMode: false, selected: [], format: 'markdown',
                redact: true, includeTools: false, includeSubagents: false, busy: null, copied: false,
            };
            this.publish(sessionId, { ...entry, loading: false, error: messageOf(error) });
        }
    }
    /** Load the whole shareable chat and hand it to the browser save operation. */
    async loadAllTxt(sessionId, lastN, signal) {
        const current = this.entry(sessionId);
        if (current !== undefined && current.messages.length > 0) {
            await this.saveTxtBlob(sessionId, current, lastN);
            return;
        }
        try {
            const raw = await this.loadRaw(sessionId, signal);
            // Direct saves carry the WHOLE chat, not the dialog's 300-row cap.
            const messages = buildShareMessages(raw, { includeTools: false });
            const entry = {
                open: false, loading: false, raw, messages, from: 0, to: Math.max(0, messages.length - 1),
                multiMode: false, selected: [], format: 'markdown',
                redact: true, includeTools: false, includeSubagents: false, busy: null, copied: false, error: null,
            };
            await this.saveTxtBlob(sessionId, entry, lastN);
        }
        catch (error) {
            if (signal.aborted)
                return;
            const entry = this.entry(sessionId) ?? {
                open: false, loading: false, raw: [], messages: [], from: 0, to: 0,
                multiMode: false, selected: [], format: 'markdown',
                redact: true, includeTools: false, includeSubagents: false, busy: null, copied: false,
            };
            this.publish(sessionId, { ...entry, error: messageOf(error) });
        }
    }
    /** Save the already-loaded shareable chat as one plain-text file. */
    async downloadAllTxt(sessionId, lastN) {
        const entry = this.entry(sessionId);
        if (entry === undefined || entry.messages.length === 0)
            return;
        await this.saveTxtBlob(sessionId, entry, lastN);
    }
    async saveTxtBlob(sessionId, entry, lastN) {
        const rows = this.applyOptions(entry, entry.messages);
        const slice = lastN === undefined ? rows : rows.slice(-lastN);
        const meta = await this.metaOf(sessionId);
        const blob = new Blob([renderShareTxt(slice, {
                meta,
                ...(this.labels !== undefined ? { labels: this.labels() } : {}),
            })], { type: 'text/plain;charset=utf-8' });
        this.save(blob, shareFileName(String(sessionId), 0, Math.max(0, slice.length - 1), 'txt'));
    }
    async loadRaw(sessionId, signal) {
        const pages = [];
        let beforeSeq;
        let pagesRead = 0;
        for (;;) {
            if (signal.aborted)
                throw new DOMException('Aborted', 'AbortError');
            const page = await this.readPage(sessionId, beforeSeq, PAGE_MESSAGES, signal);
            if (page.events.length === 0)
                break;
            pages.push([...page.events]);
            if (!page.hasMore)
                break;
            beforeSeq = page.events[0]?.event.seq;
            if (beforeSeq === undefined || ++pagesRead >= MAX_PAGES)
                break;
        }
        // Pages arrive newest-first; reverse the page order only, keeping each
        // page's internal ascending order.
        return pages.reverse().flat();
    }
    readPage(sessionId, beforeSeq, maxMessages, signal) {
        const abort = new Promise((_resolve, reject) => {
            if (signal.aborted) {
                reject(new DOMException('Aborted', 'AbortError'));
            }
            else {
                signal.addEventListener('abort', () => {
                    reject(new DOMException('Aborted', 'AbortError'));
                }, { once: true });
            }
        });
        return Promise.race([this.reader(sessionId, beforeSeq, maxMessages), abort]);
    }
    publish(sessionId, entry) {
        this.store.update((state) => {
            state.bySession = { ...state.bySession, [String(sessionId)]: entry };
        });
    }
}
//# sourceMappingURL=controller.js.map