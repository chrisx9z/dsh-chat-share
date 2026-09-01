import type { ObservableSnapshot, SessionId } from '@deepseek-ai/dsh-client-runtime/client';
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import { type ChatShareState, type ShareFormat } from './controller.ts';
import { NS } from './locales.ts';
/** Browser operations and state injected into the Session Header contribution. */
export interface ChatShareDialogInjected {
    hooks: {
        chatShare: ObservableSnapshot<ChatShareState>;
    };
    open: (sessionId: SessionId) => Promise<void>;
    setRange: (sessionId: SessionId, from: number, to: number) => void;
    setFormat: (sessionId: SessionId, format: ShareFormat) => void;
    setRedact: (sessionId: SessionId, redact: boolean) => void;
    setIncludeTools: (sessionId: SessionId, includeTools: boolean) => void;
    setIncludeSubagents: (sessionId: SessionId, includeSubagents: boolean) => Promise<void>;
    setMultiMode: (sessionId: SessionId, multiMode: boolean) => void;
    setSelected: (sessionId: SessionId, indices: readonly number[]) => void;
    copy: (sessionId: SessionId) => Promise<void>;
    download: (sessionId: SessionId) => Promise<void>;
    dismiss: (sessionId: SessionId) => void;
}
export type ChatShareDialogProps = PropsRuntime<'conversation.session.header.utilities'> & PropsLocale<typeof NS> & InjectFace<ChatShareDialogInjected>;
/**
 * Modal shared by the Session Header button and this browser's `/share` command.
 * @param props - Session runtime, bound controller state, actions, and localized copy.
 * @returns the modal portal contribution.
 */
export declare function ChatShareDialog({ sessionId, useChatShare, setRange, setFormat, setRedact, setIncludeTools, setIncludeSubagents, setMultiMode, setSelected, copy, download, dismiss, t, }: ChatShareDialogProps): import("react").JSX.Element;
//# sourceMappingURL=Dialog.d.ts.map