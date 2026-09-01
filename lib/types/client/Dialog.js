import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { Button, IconCheckOutline16, IconCopyOutline16, IconDownloadOutline16, Modal } from '@deepseek-ai/dsh-client-ui-primitives';
import { CHAT_SHARE_ERROR } from "./controller.js";
import { formatShareTime, renderShareHtml, renderShareMarkdown, renderShareTxt } from "./render.js";
import css from './Dialog.module.css';
/** Preview character ceiling inside the dialog; the shared artifact itself is never truncated. */
const PREVIEW_MAX_CHARS = 6000;
/** One line of the range selector and message list. */
function optionLabel(index, role, time, text) {
    const firstLine = text.split('\n')[0]?.trim() ?? '';
    const preview = firstLine.length > 48 ? `${firstLine.slice(0, 48)}…` : firstLine;
    return `#${index + 1} ${role} · ${formatShareTime(time)} · ${preview}`;
}
/** Map a controller error to localized copy; reader failures keep their raw detail. */
function errorMessage(error, t) {
    if (error === null)
        return null;
    if (error === CHAT_SHARE_ERROR.copyFailed)
        return t('dialog.copyFailed');
    if (error === CHAT_SHARE_ERROR.downloadFailed)
        return t('dialog.downloadFailed');
    if (error === '')
        return t('dialog.historyFailed');
    return `${t('dialog.historyFailed')} ${error}`;
}
/**
 * Modal shared by the Session Header button and this browser's `/share` command.
 * @param props - Session runtime, bound controller state, actions, and localized copy.
 * @returns the modal portal contribution.
 */
export function ChatShareDialog({ sessionId, useChatShare, setRange, setFormat, copy, download, dismiss, t, }) {
    const entry = useChatShare(state => state.bySession[String(sessionId)]);
    const open = entry?.open === true;
    const loading = entry?.loading === true;
    const messages = entry?.messages ?? [];
    const from = entry?.from ?? 0;
    const to = entry?.to ?? 0;
    const format = entry?.format ?? 'markdown';
    const busy = entry?.busy ?? null;
    const copied = entry?.copied === true;
    const error = entry?.error ?? null;
    const [flashCopied, setFlashCopied] = useState(false);
    useEffect(() => {
        if (!copied)
            return;
        setFlashCopied(true);
        const timer = window.setTimeout(() => { setFlashCopied(false); }, 1500);
        return () => { window.clearTimeout(timer); };
    }, [copied]);
    const roleLabel = (role) => t(role === 'user' ? 'role.user' : 'role.assistant');
    const errorText = errorMessage(error, t);
    const clickMessage = (index) => {
        if (index < from)
            setRange(sessionId, index, to);
        else if (index > to)
            setRange(sessionId, from, index);
        else
            setRange(sessionId, index, index);
    };
    const range = messages.slice(from, to + 1);
    const rendered = format === 'html'
        ? renderShareHtml(range)
        : format === 'txt' ? renderShareTxt(range) : renderShareMarkdown(range);
    const preview = rendered.length > PREVIEW_MAX_CHARS
        ? `${rendered.slice(0, PREVIEW_MAX_CHARS)}\n${t('dialog.previewTruncated')}`
        : rendered;
    const actionsDisabled = busy !== null || messages.length === 0;
    return (_jsxs(Modal, { open: open, onClose: () => { dismiss(sessionId); }, title: t('dialog.title'), description: t('dialog.description'), closeLabel: t('dialog.close'), contentClassName: css.content ?? '', footer: (_jsxs(_Fragment, { children: [_jsx(Button, { variant: "primary", icon: flashCopied ? _jsx(IconCheckOutline16, {}) : _jsx(IconCopyOutline16, {}), disabled: actionsDisabled, onClick: () => { void copy(sessionId); }, children: flashCopied ? t('dialog.copied') : t('dialog.copy') }), _jsx(Button, { variant: "ghost", icon: _jsx(IconDownloadOutline16, {}), disabled: actionsDisabled, onClick: () => { void download(sessionId); }, children: t('dialog.download') }), _jsx(Button, { variant: "ghost", onClick: () => { dismiss(sessionId); }, children: t('dialog.close') })] })), children: [loading && _jsx("p", { className: css.status, children: t('dialog.loading') }), !loading && errorText !== null && _jsx("p", { className: css.status, children: errorText }), !loading && errorText === null && messages.length === 0 && _jsx("p", { className: css.status, children: t('dialog.empty') }), !loading && errorText === null && messages.length > 0 && (_jsxs(_Fragment, { children: [_jsxs("div", { className: css.controls, children: [_jsxs("label", { className: css.rangeControl, children: [_jsx("span", { children: t('dialog.rangeFrom') }), _jsx("select", { value: from, disabled: busy !== null, onChange: (event) => { setRange(sessionId, Number(event.target.value), to); }, children: messages.map((message, index) => (_jsx("option", { value: index, children: optionLabel(index, roleLabel(message.role), message.time, message.text) }, message.seq))) })] }), _jsxs("label", { className: css.rangeControl, children: [_jsx("span", { children: t('dialog.rangeTo') }), _jsx("select", { value: to, disabled: busy !== null, onChange: (event) => { setRange(sessionId, from, Number(event.target.value)); }, children: messages.map((message, index) => (_jsx("option", { value: index, children: optionLabel(index, roleLabel(message.role), message.time, message.text) }, message.seq))) })] }), _jsxs("fieldset", { className: css.formatControl, disabled: busy !== null, children: [_jsx("legend", { children: t('dialog.format') }), _jsxs("label", { children: [_jsx("input", { type: "radio", name: `chat-share-format-${String(sessionId)}`, value: "markdown", checked: format === 'markdown', onChange: () => { setFormat(sessionId, 'markdown'); } }), t('dialog.format.markdown')] }), _jsxs("label", { children: [_jsx("input", { type: "radio", name: `chat-share-format-${String(sessionId)}`, value: "html", checked: format === 'html', onChange: () => { setFormat(sessionId, 'html'); } }), t('dialog.format.html')] }), _jsxs("label", { children: [_jsx("input", { type: "radio", name: `chat-share-format-${String(sessionId)}`, value: "txt", checked: format === 'txt', onChange: () => { setFormat(sessionId, 'txt'); } }), t('dialog.format.txt')] })] })] }), _jsx("p", { className: css.messagesHeading, children: t('dialog.messages') }), _jsx("ol", { className: css.list, children: messages.map((message, index) => {
                            const selected = index >= from && index <= to;
                            return (_jsx("li", { children: _jsxs("button", { type: "button", className: selected ? `${css.row} ${css.rowSelected}` : css.row, "aria-pressed": selected, onClick: () => { clickMessage(index); }, children: [_jsxs("span", { className: css.rowIndex, children: ["#", index + 1] }), _jsx("span", { className: css.rowRole, children: roleLabel(message.role) }), _jsx("span", { className: css.rowTime, children: formatShareTime(message.time) }), _jsx("span", { className: css.rowText, children: message.text.split('\n')[0] })] }) }, message.seq));
                        }) }), _jsxs("details", { className: css.preview, children: [_jsx("summary", { children: t('dialog.preview') }), _jsx("pre", { className: css.previewBody, children: preview })] })] }))] }));
}
//# sourceMappingURL=Dialog.js.map