/** Web Chat-segment share command over the browser dialog owned by the client half. */
import type { Context } from '@deepseek-ai/cordis';
export declare const name = "session-chat-share";
export declare const inject: string[];
/**
 * Register the Web-only `/share` command that the browser share dialog observes.
 * @param ctx - Host context carrying the human-command registry.
 */
export declare function apply(ctx: Context): void;
//# sourceMappingURL=index.d.ts.map