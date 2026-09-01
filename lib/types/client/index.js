/** Browser plugin owning the chat-segment share dialog, its controller, and the Header entry. */
import { ChatShareController, } from "./controller.js";
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
/** Wire `session.attachment` for HTML image embedding. */
function attachmentReader(connection) {
    return async (sessionId, attachmentId) => {
        const response = await connection.api.sessions.attachment({
            sessionId,
            attachmentId: attachmentId,
        });
        const result = response.result;
        if (!result.ok)
            throw new Error(`Attachment read failed: ${result.error.message}`);
        return { data: result.value.data, mediaType: result.value.attachment.mediaType };
    };
}
/**
 * Wire the artifact header facts: session title from the list projection and
 * the last logged model route from the history tail's request headers.
 * @param connection - the shared wire handle.
 * @param readHistory - the same paged reader the controller uses.
 * @returns one meta reader (never throws).
 */
function metaReader(connection, readHistory) {
    return async (sessionId) => {
        const title = await connection.api.sessions.list({}).then((response) => {
            const result = response.result;
            if (!result.ok)
                return undefined;
            const row = result.value.items.find(item => String(item.sessionId) === String(sessionId));
            const values = row?.projections?.values;
            const candidate = values?.['title'];
            return typeof candidate === 'string' && candidate !== '' ? candidate : undefined;
        }).catch(() => undefined);
        let model;
        const tail = await readHistory(sessionId, undefined, 50).catch(() => ({ events: [], hasMore: false }));
        for (let index = tail.events.length - 1; index >= 0; index -= 1) {
            const event = tail.events[index]?.event;
            if (event?.type === 'request/header') {
                const config = event.data.header.config;
                model = `${config.provider}/${config.model}`;
                break;
            }
        }
        return {
            ...(title !== undefined ? { title } : {}),
            ...(model !== undefined ? { model } : {}),
        };
    };
}
/** The artifact vocabulary follows the active UI locale at render time. */
function labelsOf(translate) {
    return () => ({
        user: translate('role.user'),
        assistant: translate('role.assistant'),
        tool: translate('role.tool'),
        sharedFrom: translate('artifact.sharedFrom'),
    });
}
/** Run a `/share` command intent produced by the host command handler. */
function runShareIntent(controller, sessionId, resultText) {
    const [verb, flag, count] = resultText.split(':');
    if (verb !== 'share')
        return;
    if (flag === 'txt') {
        const lastN = count === undefined || count === '' ? undefined : Number(count);
        void controller.saveTxt(sessionId, Number.isFinite(lastN) ? lastN : undefined);
    }
    else {
        void controller.open(sessionId);
    }
}
/**
 * Provide the share controller and mount its dialog into the Session Header.
 * @param ctx - browser context carrying slots, locale, and connection services.
 */
export function apply(ctx) {
    const connection = ctx.get('connection');
    const readHistory = historyReader(connection);
    const controller = new ChatShareController(readHistory, undefined, undefined, attachmentReader(connection), metaReader(connection, readHistory), labelsOf(ctx.locale.bind(NS)));
    ctx.provide('chatShare', controller);
    ctx.effect(() => async () => { await controller.dispose(); }, 'session-chat-share: browser lifecycle');
    ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'session-chat-share: browser dictionaries');
    const menuT = ctx.locale.bind(NS);
    ctx.effect(() => ctx.sessionRowMenu.register(chatShareRowMenuAction(sessionId => controller.open(sessionId), () => menuT('menu.share'))), 'session-chat-share: row menu action');
    ctx.effect(() => ctx.sessionRowMenu.register(chatShareSaveTxtMenuAction(sessionId => controller.saveTxt(sessionId), () => menuT('menu.saveTxt'))), 'session-chat-share: row menu save-txt action');
    ctx.on('command/executed', (sessionId, commandName, result) => {
        if (commandName === 'share' && result.kind === 'success')
            runShareIntent(controller, sessionId, result.text ?? 'share');
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
            setRedact: (sessionId, redact) => { controller.setRedact(sessionId, redact); },
            setIncludeTools: (sessionId, includeTools) => { controller.setIncludeTools(sessionId, includeTools); },
            copy: (sessionId) => controller.copy(sessionId),
            download: (sessionId) => controller.download(sessionId),
            dismiss: (sessionId) => { controller.dismiss(sessionId); },
        }),
    }, ChatShareHeaderAction));
}
//# sourceMappingURL=index.js.map