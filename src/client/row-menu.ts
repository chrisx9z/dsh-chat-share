/** Sidebar session-row `...` menu actions for the share feature. */

import { createElement } from 'react'
import { IconDownloadOutline16, IconShareOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import type { SessionRowMenuAction } from '@deepseek-ai/dsh-client-ui-workspace/client'

/**
 * Build the session-row menu contribution: one Share row after the built-in
 * Rename / Fork / Archive rows, opening this Session's share dialog.
 * @param open - controller open for one session (wired in the client apply).
 * @param menuLabel - localized menu label, re-evaluated at every render.
 * @returns the registry action descriptor.
 */
export function chatShareRowMenuAction(
  open: (sessionId: SessionId) => Promise<void>,
  menuLabel: () => string,
): SessionRowMenuAction {
  return {
    id: 'chat-share',
    label: menuLabel,
    icon: createElement(IconShareOutline16),
    order: 10,
    run: (sessionId: string) => {
      void open(sessionId as SessionId)
    },
  }
}

/**
 * Build the session-row menu contribution that saves the Session's whole
 * shareable chat as one plain-text file, without opening the dialog.
 * @param saveTxt - controller save for one session (wired in the client apply).
 * @param menuLabel - localized menu label, re-evaluated at every render.
 * @returns the registry action descriptor.
 */
export function chatShareSaveTxtMenuAction(
  saveTxt: (sessionId: SessionId) => Promise<void>,
  menuLabel: () => string,
): SessionRowMenuAction {
  return {
    id: 'chat-share-save-txt',
    label: menuLabel,
    icon: createElement(IconDownloadOutline16),
    order: 20,
    run: (sessionId: string) => {
      void saveTxt(sessionId as SessionId)
    },
  }
}
