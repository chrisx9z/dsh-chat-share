/** Sidebar session-row `...` menu action that opens the share dialog. */

import { createElement } from 'react'
import { IconShareOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
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
