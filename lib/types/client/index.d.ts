/** Browser plugin owning the chat-segment share dialog, its controller, and the Header entry. */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client';
import { ChatShareController } from './controller.ts';
import { type SessionChatShareKey } from './locales.ts';
declare module '@deepseek-ai/cordis' {
    interface Context {
        chatShare: ChatShareController;
    }
}
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        'session-chat-share': SessionChatShareKey;
    }
}
export type { ChatShareEntry, ChatShareState, ShareFormat, ShareMessage } from './controller.ts';
export declare const inject: string[];
/**
 * Provide the share controller and mount its dialog into the Session Header.
 * @param ctx - browser context carrying slots, locale, and connection services.
 */
export declare function apply(ctx: ClientContext): void;
//# sourceMappingURL=index.d.ts.map