/** Browser plugin owning the chat-segment share dialog, its controller, and the Header entry. */
import { ChatShareController } from "./controller.js";
import { ChatShareHeaderAction } from "./HeaderAction.js";
import { en, NS, zh } from "./locales.js";
import { chatShareRowMenuAction, chatShareSaveTxtMenuAction } from "./row-menu.js";
export const inject = ['slots', 'locale', 'connection', 'sessionRowMenu'];
/**
 * Wire the `session.history` reader onto the shared API client.
 * @param connection - the shared wire handle.
 * @returns one paged history reader over the sessions domain.
 */
function historyReader(connection) {
    return async (sessionId, beforeSeq, maxMessages) => {
        const response = await connection.api.sessions.history({
            sessionId,
            maxMessages,
            ...(beforeSeq === undefined ? {} : { beforeSeq }),
        });
        const result = response.result;
        if (!result.ok)
            throw new Error(`History read failed: ${result.error.message}`);
        return result.value;
    };
}
/**
 * Provide the share controller and mount its dialog into the Session Header.
 * @param ctx - browser context carrying slots, locale, and connection services.
 */
export function apply(ctx) {
    const controller = new ChatShareController(historyReader(ctx.get('connection')));
    ctx.provide('chatShare', controller);
    ctx.effect(() => async () => { await controller.dispose(); }, 'session-chat-share: browser lifecycle');
    ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'session-chat-share: browser dictionaries');
    const menuT = ctx.locale.bind(NS);
    ctx.effect(() => ctx.sessionRowMenu.register(chatShareRowMenuAction(sessionId => controller.open(sessionId), () => menuT('menu.share'))), 'session-chat-share: row menu action');
    ctx.effect(() => ctx.sessionRowMenu.register(chatShareSaveTxtMenuAction(sessionId => controller.saveTxt(sessionId), () => menuT('menu.saveTxt'))), 'session-chat-share: row menu save-txt action');
    ctx.on('command/executed', (sessionId, commandName, result) => {
        if (commandName === 'share' && result.kind === 'success')
            void controller.open(sessionId);
    });
    ctx.slots.inject('conversation.session.header.utilities', () => ctx.slots.register({
        name: 'conversation.session.header.utilities',
        id: 'session-chat-share',
        locale: NS,
        inject: () => ({
            hooks: { chatShare: controller.store },
            open: (sessionId) => controller.open(sessionId),
            setRange: (sessionId, from, to) => { controller.setRange(sessionId, from, to); },
            setFormat: (sessionId, format) => { controller.setFormat(sessionId, format); },
            copy: (sessionId) => controller.copy(sessionId),
            download: (sessionId) => controller.download(sessionId),
            dismiss: (sessionId) => { controller.dismiss(sessionId); },
        }),
    }, ChatShareHeaderAction));
}
//# sourceMappingURL=index.js.map