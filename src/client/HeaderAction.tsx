import type { ReactNode } from 'react'
import { IconShareOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import { ChatShareDialog, type ChatShareDialogProps } from './Dialog.tsx'
import css from './HeaderAction.module.css'

/**
 * Render the Session Header share capsule and its shared range dialog.
 * @param props - Session runtime, share controller, and localized dialog copy.
 * @returns the persistent Header action and Session-scoped dialog.
 */
export function ChatShareHeaderAction(props: ChatShareDialogProps): ReactNode {
  const { sessionId, useChatShare, open, t } = props
  const entry = useChatShare(state => state.bySession[String(sessionId)])
  const loading = entry?.loading === true

  return (
    <>
      <button
        type="button"
        className={css.shareButton}
        disabled={loading}
        aria-busy={loading}
        onClick={() => { void open(sessionId) }}
      >
        <span>{t('header.label')}</span>
        <IconShareOutline16 size={12} />
      </button>
      <ChatShareDialog {...props} />
    </>
  )
}
