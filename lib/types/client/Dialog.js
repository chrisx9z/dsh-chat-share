import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { Button, IconCheckOutline16, IconCopyOutline16, IconDownloadOutline16, MarkdownText, Modal, } from '@deepseek-ai/dsh-client-ui-primitives';
import { CHAT_SHARE_ERROR } from "./controller.js";
import { formatShareTime, redactSensitive } from "./render.js";
import css from './Dialog.module.css';
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
export function ChatShareDialog({ sessionId, useChatShare, setRange, setFormat, setRedact, setIncludeTools, setIncludeSubagents, setMultiMode, setSelected, copy, download, dismiss, t, }) {
    const entry = useChatShare(state => state.bySession[String(sessionId)]);
    const open = entry?.open === true;
    const loading = entry?.loading === true;
    const messages = entry?.messages ?? [];
    const from = entry?.from ?? 0;
    const to = entry?.to ?? 0;
    const multiMode = entry?.multiMode ?? false;
    const selected = entry?.selected ?? [];
    const format = entry?.format ?? 'markdown';
    const redact = entry?.redact ?? true;
    const includeTools = entry?.includeTools ?? false;
    const includeSubagents = entry?.includeSubagents ?? false;
    const busy = entry?.busy ?? null;
    const copied = entry?.copied === true;
    const error = entry?.error ?? null;
    const capped = messages.length >= 300;
    const [flashCopied, setFlashCopied] = useState(false);
    useEffect(() => {
        if (!copied)
            return;
        setFlashCopied(true);
        const timer = window.setTimeout(() => { setFlashCopied(false); }, 1500);
        return () => { window.clearTimeout(timer); };
    }, [copied]);
    const roleLabel = (role) => {
        if (role === 'user')
            return t('role.user');
        if (role === 'assistant')
            return t('role.assistant');
        if (role === 'tool')
            return t('role.tool');
        return t('role.subagent');
    };
    const errorText = errorMessage(error, t);
    const clickMessage = (index) => {
        if (multiMode) {
            const toggled = selected.includes(index)
                ? selected.filter(item => item !== index)
                : [...selected, index];
            setSelected(sessionId, toggled);
            return;
        }
        if (index < from)
            setRange(sessionId, index, to);
        else if (index > to)
            setRange(sessionId, from, index);
        else
            setRange(sessionId, index, index);
    };
    const range = multiMode
        ? selected
            .filter(index => index >= 0 && index < messages.length)
            .map(index => messages[index])
        : messages.slice(from, to + 1);
    const previewText = (text) => redact ? redactSensitive(text) : text;
    const actionsDisabled = busy !== null || messages.length === 0;
    return (_jsxs(Modal, { open: open, onClose: () => { dismiss(sessionId); }, title: t('dialog.title'), description: t('dialog.description'), closeLabel: t('dialog.close'), contentClassName: css.content ?? '', footer: (_jsxs(_Fragment, { children: [_jsx(Button, { variant: "primary", icon: flashCopied ? _jsx(IconCheckOutline16, {}) : _jsx(IconCopyOutline16, {}), disabled: actionsDisabled, onClick: () => { void copy(sessionId); }, children: flashCopied ? t('dialog.copied') : t('dialog.copy') }), _jsx(Button, { variant: "ghost", icon: _jsx(IconDownloadOutline16, {}), disabled: actionsDisabled, onClick: () => { void download(sessionId); }, children: t('dialog.download') }), _jsx(Button, { variant: "ghost", onClick: () => { dismiss(sessionId); }, children: t('dialog.close') })] })), children: [loading && _jsx("p", { className: css.status, children: t('dialog.loading') }), !loading && errorText !== null && _jsx("p", { className: css.status, children: errorText }), !loading && errorText === null && messages.length === 0 && _jsx("p", { className: css.status, children: t('dialog.empty') }), !loading && errorText === null && messages.length > 0 && (_jsxs(_Fragment, { children: [_jsxs("div", { className: css.controls, children: [!multiMode && (_jsxs(_Fragment, { children: [_jsxs("label", { className: css.rangeControl, children: [_jsx("span", { children: t('dialog.rangeFrom') }), _jsx("select", { value: from, disabled: busy !== null, onChange: (event) => { setRange(sessionId, Number(event.target.value), to); }, children: messages.map((message, index) => (_jsx("option", { value: index, children: optionLabel(index, roleLabel(message.role), message.time, message.text) }, message.seq))) })] }), _jsxs("label", { className: css.rangeControl, children: [_jsx("span", { children: t('dialog.rangeTo') }), _jsx("select", { value: to, disabled: busy !== null, onChange: (event) => { setRange(sessionId, from, Number(event.target.value)); }, children: messages.map((message, index) => (_jsx("option", { value: index, children: optionLabel(index, roleLabel(message.role), message.time, message.text) }, message.seq))) })] })] })), _jsxs("fieldset", { className: css.formatControl, disabled: busy !== null, children: [_jsx("legend", { children: t('dialog.format') }), _jsxs("label", { children: [_jsx("input", { type: "radio", name: `chat-share-format-${String(sessionId)}`, value: "markdown", checked: format === 'markdown', onChange: () => { setFormat(sessionId, 'markdown'); } }), t('dialog.format.markdown')] }), _jsxs("label", { children: [_jsx("input", { type: "radio", name: `chat-share-format-${String(sessionId)}`, value: "html", checked: format === 'html', onChange: () => { setFormat(sessionId, 'html'); } }), t('dialog.format.html')] }), _jsxs("label", { children: [_jsx("input", { type: "radio", name: `chat-share-format-${String(sessionId)}`, value: "txt", checked: format === 'txt', onChange: () => { setFormat(sessionId, 'txt'); } }), t('dialog.format.txt')] }), _jsxs("label", { children: [_jsx("input", { type: "radio", name: `chat-share-format-${String(sessionId)}`, value: "png", checked: format === 'png', onChange: () => { setFormat(sessionId, 'png'); } }), t('dialog.format.png')] })] }), _jsxs("fieldset", { className: css.optionControl, disabled: busy !== null, children: [_jsx("legend", { children: t('options') }), _jsxs("label", { children: [_jsx("input", { type: "checkbox", checked: redact, onChange: (event) => { setRedact(sessionId, event.target.checked); } }), t('options.redact')] }), _jsxs("label", { children: [_jsx("input", { type: "checkbox", checked: includeTools, onChange: (event) => { setIncludeTools(sessionId, event.target.checked); } }), t('options.tools')] }), _jsxs("label", { children: [_jsx("input", { type: "checkbox", checked: includeSubagents, disabled: loading, onChange: (event) => { void setIncludeSubagents(sessionId, event.target.checked); } }), t('options.subagents')] }), _jsxs("label", { children: [_jsx("input", { type: "checkbox", checked: multiMode, onChange: (event) => { setMultiMode(sessionId, event.target.checked); } }), t('options.multiselect')] })] })] }), capped && _jsx("p", { className: css.status, children: t('dialog.capNotice') }), _jsx("p", { className: css.messagesHeading, children: t('dialog.messages') }), _jsx("ol", { className: css.list, children: messages.map((message, index) => {
                            const selectedRow = multiMode ? selected.includes(index) : index >= from && index <= to;
                            const toolRow = message.role === 'tool';
                            const subagentRow = message.role === 'subagent';
                            return (_jsx("li", { children: _jsxs("button", { type: "button", className: selectedRow ? `${css.row} ${css.rowSelected}` : css.row, "aria-pressed": selectedRow, onClick: () => { clickMessage(index); }, children: [multiMode && (_jsx("span", { className: css.rowCheck, "aria-hidden": "true", children: selectedRow ? '✓' : '' })), _jsxs("span", { className: css.rowIndex, children: ["#", index + 1] }), _jsx("span", { className: toolRow || subagentRow ? `${css.rowRole} ${css.rowTool}` : css.rowRole, children: roleLabel(message.role) }), _jsx("span", { className: css.rowTime, children: formatShareTime(message.time) }), _jsx("span", { className: css.rowText, children: message.text.split('\n')[0] })] }) }, message.seq));
                        }) }), _jsxs("details", { className: css.preview, open: true, children: [_jsx("summary", { children: t('dialog.preview') }), _jsx("div", { className: css.previewBody, children: range.map(message => (_jsxs("div", { className: css.previewRow, children: [_jsxs("span", { className: css.previewRole, children: [roleLabel(message.role), " \u00B7 ", formatShareTime(message.time)] }), _jsx(MarkdownText, { text: previewText(message.text) })] }, message.seq))) })] })] }))] }));
}
//# sourceMappingURL=Dialog.js.map