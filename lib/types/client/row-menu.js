/** Sidebar session-row `...` menu actions for the share feature. */
import { createElement } from 'react';
import { IconDownloadOutline16, IconShareOutline16 } from '@deepseek-ai/dsh-client-ui-primitives';
/**
 * Build the session-row menu contribution: one Share row after the built-in
 * Rename / Fork / Archive rows, opening this Session's share dialog.
 * @param open - controller open for one session (wired in the client apply).
 * @param menuLabel - localized menu label, re-evaluated at every render.
 * @returns the registry action descriptor.
 */
export function chatShareRowMenuAction(open, menuLabel) {
    return {
        id: 'chat-share',
        label: menuLabel,
        icon: createElement(IconShareOutline16),
        order: 10,
        run: (sessionId) => {
            void open(sessionId);
        },
    };
}
/**
 * Build the session-row menu contribution that saves the Session's whole
 * shareable chat as one plain-text file, without opening the dialog.
 * @param saveTxt - controller save for one session (wired in the client apply).
 * @param menuLabel - localized menu label, re-evaluated at every render.
 * @returns the registry action descriptor.
 */
export function chatShareSaveTxtMenuAction(saveTxt, menuLabel) {
    return {
        id: 'chat-share-save-txt',
        label: menuLabel,
        icon: createElement(IconDownloadOutline16),
        order: 20,
        run: (sessionId) => {
            void saveTxt(sessionId);
        },
    };
}
//# sourceMappingURL=row-menu.js.map