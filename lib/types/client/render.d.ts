/** Pure renderers that turn a message range into shareable Markdown, plain text, or a self-contained HTML page. */
import type { ShareFormat, ShareMessage } from './controller.ts';
/** One fixed timestamp format so shared artifacts read identically on every machine. */
export declare function formatShareTime(time: number): string;
/**
 * Render the selected range as Markdown with role headers and timestamps.
 * @param messages - chronological share messages (already range-sliced).
 * @returns one Markdown document.
 */
export declare function renderShareMarkdown(messages: readonly ShareMessage[]): string;
/**
 * Render the selected range as plain text with role headers and timestamps.
 * @param messages - chronological share messages (already range-sliced).
 * @returns one plain-text document (no markup).
 */
export declare function renderShareTxt(messages: readonly ShareMessage[]): string;
/** Escape text for safe inclusion in the generated HTML page. */
export declare function escapeHtml(text: string): string;
/**
 * Convert message text to basic HTML: fenced code blocks become `<pre><code>`
 * (the first fence line is treated as a language hint and dropped), everything
 * else is escaped and split into paragraphs.
 * @param text - message markdown-ish text.
 * @returns escaped HTML fragment.
 */
export declare function renderRichText(text: string): string;
/**
 * Render the selected range as a self-contained HTML page.
 * @param messages - chronological share messages (already range-sliced).
 * @returns a complete HTML document the recipient can open in any browser.
 */
export declare function renderShareHtml(messages: readonly ShareMessage[]): string;
/** One safe browser download filename for the shared artifact. */
export declare function shareFileName(sessionId: string, from: number, to: number, format: ShareFormat): string;
//# sourceMappingURL=render.d.ts.map