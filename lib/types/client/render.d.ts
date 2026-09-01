/** Pure renderers: Markdown, plain text, GFM-lite HTML, and best-effort redaction. */
import type { ShareFormat, ShareMessage } from './controller.ts';
/** Localized artifact vocabulary; defaults to English when absent. */
export interface ShareLabels {
    user: string;
    assistant: string;
    tool: string;
    subagent: string;
    sharedFrom: string;
}
/** Optional artifact header facts. */
export interface ShareMeta {
    /** Session display title (from the title projection). */
    title?: string;
    /** Last logged model route (`provider/model`). */
    model?: string;
}
/** Renderer options shared by every format. */
export interface ShareRenderOptions {
    labels?: ShareLabels;
    meta?: ShareMeta;
    /** attachmentId → data URI for images embedded in the HTML output. */
    images?: ReadonlyMap<string, string>;
}
/** One fixed timestamp format so shared artifacts read identically on every machine. */
export declare function formatShareTime(time: number): string;
/**
 * Render the selected range as Markdown with role headers and timestamps.
 * @param messages - chronological share messages (already range-sliced).
 * @param options - labels, optional header meta.
 * @returns one Markdown document.
 */
export declare function renderShareMarkdown(messages: readonly ShareMessage[], options?: ShareRenderOptions): string;
/**
 * Render the selected range as plain text with role headers and timestamps.
 * @param messages - chronological share messages (already range-sliced).
 * @param options - labels, optional header meta.
 * @returns one plain-text document (no markup).
 */
export declare function renderShareTxt(messages: readonly ShareMessage[], options?: ShareRenderOptions): string;
/** Escape text for safe inclusion in the generated HTML page. */
export declare function escapeHtml(text: string): string;
/** Split raw text into blocks and render GFM-lite HTML. */
export declare function renderGfmHtml(text: string): string;
/**
 * Render the selected range as a self-contained HTML page with GFM-lite
 * body rendering; session images embed as data URIs when provided.
 * @param messages - chronological share messages (already range-sliced).
 * @param options - labels, optional header meta, optional resolved images.
 * @returns a complete HTML document the recipient can open in any browser.
 */
export declare function renderShareHtml(messages: readonly ShareMessage[], options?: ShareRenderOptions): string;
/** One safe browser download filename for the shared artifact. */
export declare function shareFileName(sessionId: string, from: number, to: number, format: ShareFormat): string;
/**
 * Best-effort redaction for shared artifacts: masks common credential shapes
 * and local absolute/home paths. Applied to message text before rendering.
 * @param text - raw message text.
 * @returns text with sensitive shapes replaced by `[key]` / `[path]`.
 */
export declare function redactSensitive(text: string): string;
//# sourceMappingURL=render.d.ts.map