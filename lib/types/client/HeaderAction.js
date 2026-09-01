import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { IconShareOutline16 } from '@deepseek-ai/dsh-client-ui-primitives';
import { ChatShareDialog } from "./Dialog.js";
import css from './HeaderAction.module.css';
/**
 * Render the Session Header share capsule and its shared range dialog.
 * @param props - Session runtime, share controller, and localized dialog copy.
 * @returns the persistent Header action and Session-scoped dialog.
 */
export function ChatShareHeaderAction(props) {
    const { sessionId, useChatShare, open, t } = props;
    const entry = useChatShare(state => state.bySession[String(sessionId)]);
    const loading = entry?.loading === true;
    return (_jsxs(_Fragment, { children: [_jsxs("button", { type: "button", className: css.shareButton, disabled: loading, "aria-busy": loading, onClick: () => { void open(sessionId); }, children: [_jsx("span", { children: t('header.label') }), _jsx(IconShareOutline16, { size: 12 })] }), _jsx(ChatShareDialog, { ...props })] }));
}
//# sourceMappingURL=HeaderAction.js.map