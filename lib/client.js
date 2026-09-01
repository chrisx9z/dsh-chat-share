window.__ModuleLoader__.load({
	id: "dsh-chat-share",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let _deepseek_ai_dsh_client_runtime_client = require("@deepseek-ai/dsh-client-runtime/client");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		let react_jsx_runtime = require("react/jsx-runtime");
		let react = require("react");
		//#region lib/types/client/render.js
		/** Pure renderers that turn a message range into shareable Markdown, plain text, or a self-contained HTML page. */
		/** One fixed timestamp format so shared artifacts read identically on every machine. */
		function formatShareTime(time) {
			return new Date(time).toLocaleString(void 0, {
				dateStyle: "medium",
				timeStyle: "medium"
			});
		}
		/**
		* Render the selected range as Markdown with role headers and timestamps.
		* @param messages - chronological share messages (already range-sliced).
		* @returns one Markdown document.
		*/
		function renderShareMarkdown(messages) {
			const lines = ["> Shared from DeepSeek Harness", ""];
			for (const message of messages) lines.push(`**${roleLabel(message.role)}** · ${formatShareTime(message.time)}`, "", message.text, "");
			return lines.join("\n").trimEnd() + "\n";
		}
		/**
		* Render the selected range as plain text with role headers and timestamps.
		* @param messages - chronological share messages (already range-sliced).
		* @returns one plain-text document (no markup).
		*/
		function renderShareTxt(messages) {
			const lines = ["Shared from DeepSeek Harness", ""];
			for (const message of messages) lines.push(`${roleLabel(message.role)} · ${formatShareTime(message.time)}`, "", message.text, "");
			return lines.join("\n").trimEnd() + "\n";
		}
		function roleLabel(role) {
			return role === "user" ? "User" : "Assistant";
		}
		/** Escape text for safe inclusion in the generated HTML page. */
		function escapeHtml(text) {
			return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("\"", "&quot;").replaceAll("'", "&#39;");
		}
		/** Split plain text on blank lines into escaped paragraphs, dropping empty splits. */
		function paragraphs(plain) {
			return plain.split(/\n{2,}/).filter((paragraph) => paragraph.trim() !== "").map((paragraph) => `<p>${escapeHtml(paragraph.trim()).replaceAll("\n", "<br />")}</p>`);
		}
		/**
		* Convert message text to basic HTML: fenced code blocks become `<pre><code>`
		* (the first fence line is treated as a language hint and dropped), everything
		* else is escaped and split into paragraphs.
		* @param text - message markdown-ish text.
		* @returns escaped HTML fragment.
		*/
		function renderRichText(text) {
			const blocks = [];
			let plain = "";
			let index = 0;
			for (;;) {
				const fence = text.indexOf("```", index);
				if (fence === -1) {
					plain += text.slice(index);
					break;
				}
				plain += text.slice(index, fence);
				const close = text.indexOf("```", fence + 3);
				if (close === -1) {
					plain += text.slice(fence);
					break;
				}
				const code = text.slice(fence + 3, close).replace(/^[^\n]*\n/, "").trimEnd();
				if (plain.trim() !== "") {
					blocks.push(...paragraphs(plain));
					plain = "";
				}
				blocks.push(`<pre><code>${escapeHtml(code)}</code></pre>`);
				index = close + 3;
			}
			if (plain.trim() !== "") blocks.push(...paragraphs(plain));
			return blocks.join("\n");
		}
		/**
		* Render the selected range as a self-contained HTML page.
		* @param messages - chronological share messages (already range-sliced).
		* @returns a complete HTML document the recipient can open in any browser.
		*/
		function renderShareHtml(messages) {
			return [
				"<!doctype html>",
				"<html lang=\"en\">",
				"<head>",
				"<meta charset=\"utf-8\" />",
				"<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />",
				"<title>Chat segment</title>",
				"<style>",
				":root { color-scheme: light dark; }",
				"body { font-family: system-ui, -apple-system, \"Segoe UI\", sans-serif; max-width: 820px; margin: 0 auto; padding: 24px 20px 64px; color: #1f2328; line-height: 1.6; }",
				"@media (prefers-color-scheme: dark) { body { color: #e6e6e6; } }",
				".meta { color: #6b7280; font-size: 13px; }",
				".message { margin: 20px 0; }",
				".role { font-weight: 600; }",
				"pre { background: #f6f8fa; padding: 12px; border-radius: 8px; overflow-x: auto; }",
				"@media (prefers-color-scheme: dark) { pre { background: #161b22; } }",
				"code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 13px; }",
				"p { margin: 8px 0; }",
				"</style>",
				"</head>",
				"<body>",
				"<main>",
				"<p class=\"meta\">Shared from DeepSeek Harness</p>",
				messages.map((message) => [
					"<section class=\"message\">",
					`<p class="role">${escapeHtml(roleLabel(message.role))} · ${escapeHtml(formatShareTime(message.time))}</p>`,
					renderRichText(message.text),
					"</section>"
				].join("\n")).join("\n"),
				"</main>",
				"</body>",
				"</html>",
				""
			].join("\n");
		}
		/** One safe browser download filename for the shared artifact. */
		function shareFileName(sessionId, from, to, format) {
			const safe = sessionId.replace(/[^A-Za-z0-9_-]/g, "_");
			const extension = format === "html" ? "html" : format === "txt" ? "txt" : "md";
			return `dsh-chat-share-${safe}-${from + 1}-${to + 1}.${extension}`;
		}
		//#endregion
		//#region lib/types/client/controller.js
		/** Browser state and actions for sharing a selected range of chat messages. */
		/** Messages per `session.history` page. */
		const PAGE_MESSAGES = 50;
		/** Safety cap on history pages read per open. */
		const MAX_PAGES = 100;
		const INITIAL = { bySession: {} };
		/** Known controller error codes the dialog localizes; anything else is shown raw. */
		const CHAT_SHARE_ERROR = {
			copyFailed: "copy-failed",
			downloadFailed: "download-failed"
		};
		/**
		* Join a message's content into one share text: text blocks verbatim, and a
		* `[image]` marker for image-only messages.
		* @param content - the message's model-facing blocks.
		* @returns the share text, or '' when the message carries nothing shareable.
		*/
		function shareMessageText(content) {
			const parts = [];
			let images = 0;
			for (const block of content) if (block.type === "text") parts.push(block.text ?? "");
			else if (block.type === "image") images += 1;
			const text = parts.join("\n");
			return text !== "" ? text : images > 0 ? "[image]" : "";
		}
		/**
		* Fold history entries (chronological) into shareable user/assistant messages.
		* Tool results, boundary markers, and surface-replacing compaction copies are
		* excluded; messages with no shareable text are dropped.
		* @param events - history entries in log order.
		* @returns share messages in the same order.
		*/
		function buildShareMessages(events) {
			const messages = [];
			for (const entry of events) {
				const event = entry.event;
				if (event.type === "user/message") {
					if (event.surfaceOp !== "append") continue;
					const text = shareMessageText(event.data.content);
					if (text === "") continue;
					messages.push({
						seq: event.seq,
						role: "user",
						text,
						time: event.time
					});
				} else if (event.type === "assistant/message") {
					if (event.surfaceOp !== "append") continue;
					const text = shareMessageText(event.data.message.content);
					if (text === "") continue;
					messages.push({
						seq: event.seq,
						role: "assistant",
						text,
						time: event.time
					});
				}
			}
			return messages;
		}
		function messageOf(error) {
			return error instanceof Error ? error.message : String(error);
		}
		/** Hand a Blob to the browser download manager through an object URL. */
		function saveBlob(blob, filename) {
			const url = URL.createObjectURL(blob);
			const anchor = document.createElement("a");
			anchor.href = url;
			anchor.download = filename;
			anchor.click();
			setTimeout(() => {
				URL.revokeObjectURL(url);
			}, 1e4);
		}
		/**
		* Owns one in-flight history load per Session and publishes share-dialog state.
		*/
		var ChatShareController = class {
			reader;
			clipboard;
			save;
			/** uSES-safe state source shared by every Session-scoped dialog contribution. */
			store = (0, _deepseek_ai_dsh_client_runtime_client.createSnapshotStore)(INITIAL);
			active = /* @__PURE__ */ new Map();
			disposed = false;
			/**
			* @param reader - paged `session.history` reader (tail page when `beforeSeq` is absent).
			* @param clipboard - clipboard writer returning whether the write landed.
			* @param save - browser save operation for the generated artifact Blob.
			*/
			constructor(reader, clipboard = _deepseek_ai_dsh_client_ui_primitives.writeClipboard, save = saveBlob) {
				this.reader = reader;
				this.clipboard = clipboard;
				this.save = save;
			}
			/**
			* Open (or reopen) one Session's share dialog; concurrent gestures share one load.
			* @param sessionId - Session whose chat segment is shared.
			* @returns after the dialog state settles (open, loaded, or failed).
			*/
			open(sessionId) {
				const existing = this.active.get(sessionId);
				if (existing !== void 0) return existing.done;
				if (this.disposed) return Promise.resolve();
				const abort = new AbortController();
				const done = this.run(sessionId, abort.signal).finally(() => {
					this.active.delete(sessionId);
				});
				this.active.set(sessionId, {
					abort,
					done
				});
				return done;
			}
			/**
			* Close one Session's dialog, keeping its loaded messages for the next open.
			* @param sessionId - Session whose modal closes.
			*/
			dismiss(sessionId) {
				const current = this.store.getSnapshot().bySession[String(sessionId)];
				if (current === void 0 || !current.open) return;
				this.publish(sessionId, {
					...current,
					open: false,
					busy: null
				});
			}
			/**
			* Download the Session's whole shareable chat as plain text without opening
			* the dialog (the sidebar `...` menu action). Joins an in-flight history
			* load instead of starting a second one.
			* @param sessionId - Session whose chat is saved.
			* @returns after the browser save starts; load failures publish the error.
			*/
			saveTxt(sessionId) {
				const existing = this.active.get(sessionId);
				if (existing !== void 0) return existing.done.then(() => this.downloadAllTxt(sessionId));
				if (this.disposed) return Promise.resolve();
				const abort = new AbortController();
				const done = this.loadAllTxt(sessionId, abort.signal).finally(() => {
					this.active.delete(sessionId);
				});
				this.active.set(sessionId, {
					abort,
					done
				});
				return done;
			}
			/**
			* Select the inclusive message range, clamping and normalizing the bounds.
			* @param sessionId - Session owning the dialog.
			* @param from - range start index.
			* @param to - range end index.
			*/
			setRange(sessionId, from, to) {
				const current = this.entry(sessionId);
				if (current === void 0 || current.messages.length === 0) return;
				const clamp = (index) => Math.max(0, Math.min(current.messages.length - 1, Math.round(index)));
				const start = clamp(from);
				const end = clamp(to);
				this.publish(sessionId, {
					...current,
					from: Math.min(start, end),
					to: Math.max(start, end),
					error: null
				});
			}
			/**
			* Switch the output format.
			* @param sessionId - Session owning the dialog.
			* @param format - Markdown or HTML.
			*/
			setFormat(sessionId, format) {
				const current = this.entry(sessionId);
				if (current === void 0) return;
				this.publish(sessionId, {
					...current,
					format,
					error: null
				});
			}
			/**
			* Render the selected range as Markdown and write it to the clipboard.
			* @param sessionId - Session owning the dialog.
			* @returns after the write settles; the dialog shows a check on success.
			*/
			async copy(sessionId) {
				const current = this.entry(sessionId);
				if (current === void 0 || current.messages.length === 0 || current.busy !== null) return;
				this.publish(sessionId, {
					...current,
					busy: "copy",
					copied: false,
					error: null
				});
				const text = renderShareMarkdown(this.range(current));
				const ok = await this.clipboard(text);
				const next = this.store.getSnapshot().bySession[String(sessionId)];
				if (next === void 0 || !next.open) return;
				this.publish(sessionId, ok ? {
					...next,
					busy: null,
					copied: true
				} : {
					...next,
					busy: null,
					error: CHAT_SHARE_ERROR.copyFailed
				});
			}
			/**
			* Render the selected range in the chosen format and download it as a file.
			* @param sessionId - Session owning the dialog.
			* @returns after the browser save starts.
			*/
			download(sessionId) {
				const current = this.entry(sessionId);
				if (current === void 0 || current.messages.length === 0 || current.busy !== null) return Promise.resolve();
				this.publish(sessionId, {
					...current,
					busy: "download",
					error: null
				});
				const selected = this.range(current);
				try {
					const blob = current.format === "html" ? new Blob([renderShareHtml(selected)], { type: "text/html;charset=utf-8" }) : current.format === "txt" ? new Blob([renderShareTxt(selected)], { type: "text/plain;charset=utf-8" }) : new Blob([renderShareMarkdown(selected)], { type: "text/markdown;charset=utf-8" });
					this.save(blob, shareFileName(String(sessionId), current.from, current.to, current.format));
					const next = this.store.getSnapshot().bySession[String(sessionId)];
					if (next !== void 0 && next.open) this.publish(sessionId, {
						...next,
						busy: null
					});
				} catch (error) {
					const next = this.store.getSnapshot().bySession[String(sessionId)];
					if (next !== void 0 && next.open) this.publish(sessionId, {
						...next,
						busy: null,
						error: messageOf(error) || CHAT_SHARE_ERROR.downloadFailed
					});
				}
				return Promise.resolve();
			}
			/**
			* Abort active loads and reach quiescence.
			* @returns after every active operation settles.
			*/
			async dispose() {
				this.disposed = true;
				const active = [...this.active.values()];
				for (const operation of active) operation.abort.abort();
				await Promise.allSettled(active.map((operation) => operation.done));
			}
			entry(sessionId) {
				return this.store.getSnapshot().bySession[String(sessionId)];
			}
			range(entry) {
				return entry.messages.slice(entry.from, entry.to + 1);
			}
			async run(sessionId, signal) {
				const current = this.entry(sessionId);
				if (current !== void 0 && current.messages.length > 0) {
					this.publish(sessionId, {
						...current,
						open: true,
						busy: null,
						copied: false,
						error: null
					});
					return;
				}
				this.publish(sessionId, {
					open: true,
					loading: true,
					messages: [],
					from: 0,
					to: 0,
					format: current?.format ?? "markdown",
					busy: null,
					copied: false,
					error: null
				});
				try {
					const messages = await this.loadMessages(sessionId, signal);
					this.publish(sessionId, {
						open: true,
						loading: false,
						messages,
						from: 0,
						to: Math.max(0, messages.length - 1),
						format: "markdown",
						busy: null,
						copied: false,
						error: null
					});
				} catch (error) {
					if (signal.aborted) return;
					const entry = this.entry(sessionId) ?? {
						open: true,
						loading: false,
						messages: [],
						from: 0,
						to: 0,
						format: "markdown",
						busy: null,
						copied: false
					};
					this.publish(sessionId, {
						...entry,
						loading: false,
						error: messageOf(error)
					});
				}
			}
			async loadMessages(sessionId, signal) {
				const pages = [];
				let beforeSeq;
				let pagesRead = 0;
				for (;;) {
					if (signal.aborted) throw new DOMException("Aborted", "AbortError");
					const page = await this.readPage(sessionId, beforeSeq, PAGE_MESSAGES, signal);
					if (page.events.length === 0) break;
					pages.push([...page.events]);
					if (!page.hasMore) break;
					beforeSeq = page.events[0]?.event.seq;
					if (beforeSeq === void 0 || ++pagesRead >= MAX_PAGES) break;
				}
				return buildShareMessages(pages.reverse().flat()).slice(-300);
			}
			readPage(sessionId, beforeSeq, maxMessages, signal) {
				const abort = new Promise((_resolve, reject) => {
					if (signal.aborted) reject(new DOMException("Aborted", "AbortError"));
					else signal.addEventListener("abort", () => {
						reject(new DOMException("Aborted", "AbortError"));
					}, { once: true });
				});
				return Promise.race([this.reader(sessionId, beforeSeq, maxMessages), abort]);
			}
			/** Load the whole shareable chat and hand it to the browser save operation. */
			async loadAllTxt(sessionId, signal) {
				const current = this.entry(sessionId);
				if (current !== void 0 && current.messages.length > 0) {
					this.saveTxtBlob(sessionId, current.messages);
					return;
				}
				try {
					const messages = await this.loadMessages(sessionId, signal);
					this.saveTxtBlob(sessionId, messages);
				} catch (error) {
					if (signal.aborted) return;
					const entry = this.entry(sessionId) ?? {
						open: false,
						loading: false,
						messages: [],
						from: 0,
						to: 0,
						format: "markdown",
						busy: null,
						copied: false
					};
					this.publish(sessionId, {
						...entry,
						error: messageOf(error)
					});
				}
			}
			/** Save the already-loaded shareable chat as one plain-text file. */
			downloadAllTxt(sessionId) {
				const entry = this.entry(sessionId);
				if (entry === void 0 || entry.messages.length === 0) return Promise.resolve();
				this.saveTxtBlob(sessionId, entry.messages);
				return Promise.resolve();
			}
			saveTxtBlob(sessionId, messages) {
				const blob = new Blob([renderShareTxt(messages)], { type: "text/plain;charset=utf-8" });
				this.save(blob, shareFileName(String(sessionId), 0, messages.length - 1, "txt"));
			}
			publish(sessionId, entry) {
				this.store.update((state) => {
					state.bySession = {
						...state.bySession,
						[String(sessionId)]: entry
					};
				});
			}
		};
		//#endregion
		//#region \0dsh-css:D:\deepseek-harness\packages\session-query\session-chat-share\src\client\Dialog.module.css.mjs
		const css$1 = ".XfqGVG_content{flex-direction:column;gap:12px;min-height:0;display:flex}.XfqGVG_status{color:var(--dsw-alias-label-secondary);margin:0;font-size:13px;line-height:20px}.XfqGVG_controls{flex-wrap:wrap;align-items:flex-end;gap:12px;display:flex}.XfqGVG_rangeControl{color:var(--dsw-alias-label-secondary);flex-direction:column;gap:4px;font-size:13px;display:flex}.XfqGVG_rangeControl select{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-elevated);max-width:260px;height:28px;color:var(--dsw-alias-label-primary);font-family:var(--dsw-font-family);border-radius:6px;font-size:13px}.XfqGVG_formatControl{color:var(--dsw-alias-label-secondary);border:none;align-items:center;gap:12px;margin:0;padding:0;font-size:13px;display:flex}.XfqGVG_formatControl legend{margin-bottom:4px;padding:0}.XfqGVG_formatControl label{cursor:pointer;align-items:center;gap:4px;display:inline-flex}.XfqGVG_messagesHeading{color:var(--dsw-alias-label-secondary);margin:0;font-size:13px}.XfqGVG_list{border:1px solid var(--dsw-alias-border-l2);border-radius:8px;max-height:220px;margin:0;padding:0;list-style:none;overflow-y:auto}.XfqGVG_row{width:100%;color:var(--dsw-alias-label-primary);font-family:var(--dsw-font-family);text-align:left;cursor:pointer;background:0 0;border:none;align-items:center;gap:8px;padding:6px 10px;font-size:13px;line-height:20px;display:flex}.XfqGVG_row:hover{background:var(--dsw-alias-interactive-bg-hover)}.XfqGVG_rowSelected{background:var(--dsw-alias-interactive-bg-active)}.XfqGVG_rowIndex{color:var(--dsw-alias-label-dimmed);font-variant-numeric:tabular-nums;flex:none}.XfqGVG_rowRole{flex:none;font-weight:600}.XfqGVG_rowTime{color:var(--dsw-alias-label-dimmed);flex:none;font-size:12px}.XfqGVG_rowText{text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-secondary);overflow:hidden}.XfqGVG_preview{color:var(--dsw-alias-label-secondary);font-size:13px}.XfqGVG_preview summary{cursor:pointer;user-select:none}.XfqGVG_previewBody{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-elevated);max-height:200px;color:var(--dsw-alias-label-primary);font-family:var(--dsw-font-mono);white-space:pre-wrap;word-break:break-word;border-radius:8px;margin:8px 0 0;padding:10px 12px;font-size:12px;line-height:18px;overflow:auto}";
		const tagId$1 = "dsh-chat-share/Dialog.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$1) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-chat-share";
			tag.dataset.pluginCss = tagId$1;
			tag.textContent = css$1;
			document.head.appendChild(tag);
		}
		var Dialog_module_css_default = {
			"content": "XfqGVG_content",
			"controls": "XfqGVG_controls",
			"formatControl": "XfqGVG_formatControl",
			"list": "XfqGVG_list",
			"messagesHeading": "XfqGVG_messagesHeading",
			"preview": "XfqGVG_preview",
			"previewBody": "XfqGVG_previewBody",
			"rangeControl": "XfqGVG_rangeControl",
			"row": "XfqGVG_row",
			"rowIndex": "XfqGVG_rowIndex",
			"rowRole": "XfqGVG_rowRole",
			"rowSelected": "XfqGVG_rowSelected",
			"rowText": "XfqGVG_rowText",
			"rowTime": "XfqGVG_rowTime",
			"status": "XfqGVG_status"
		};
		//#endregion
		//#region lib/types/client/Dialog.js
		/** Preview character ceiling inside the dialog; the shared artifact itself is never truncated. */
		const PREVIEW_MAX_CHARS = 6e3;
		/** One line of the range selector and message list. */
		function optionLabel(index, role, time, text) {
			const firstLine = text.split("\n")[0]?.trim() ?? "";
			const preview = firstLine.length > 48 ? `${firstLine.slice(0, 48)}…` : firstLine;
			return `#${index + 1} ${role} · ${formatShareTime(time)} · ${preview}`;
		}
		/** Map a controller error to localized copy; reader failures keep their raw detail. */
		function errorMessage(error, t) {
			if (error === null) return null;
			if (error === CHAT_SHARE_ERROR.copyFailed) return t("dialog.copyFailed");
			if (error === CHAT_SHARE_ERROR.downloadFailed) return t("dialog.downloadFailed");
			if (error === "") return t("dialog.historyFailed");
			return `${t("dialog.historyFailed")} ${error}`;
		}
		/**
		* Modal shared by the Session Header button and this browser's `/share` command.
		* @param props - Session runtime, bound controller state, actions, and localized copy.
		* @returns the modal portal contribution.
		*/
		function ChatShareDialog({ sessionId, useChatShare, setRange, setFormat, copy, download, dismiss, t }) {
			const entry = useChatShare((state) => state.bySession[String(sessionId)]);
			const open = entry?.open === true;
			const loading = entry?.loading === true;
			const messages = entry?.messages ?? [];
			const from = entry?.from ?? 0;
			const to = entry?.to ?? 0;
			const format = entry?.format ?? "markdown";
			const busy = entry?.busy ?? null;
			const copied = entry?.copied === true;
			const error = entry?.error ?? null;
			const [flashCopied, setFlashCopied] = (0, react.useState)(false);
			(0, react.useEffect)(() => {
				if (!copied) return;
				setFlashCopied(true);
				const timer = window.setTimeout(() => {
					setFlashCopied(false);
				}, 1500);
				return () => {
					window.clearTimeout(timer);
				};
			}, [copied]);
			const roleLabel = (role) => t(role === "user" ? "role.user" : "role.assistant");
			const errorText = errorMessage(error, t);
			const clickMessage = (index) => {
				if (index < from) setRange(sessionId, index, to);
				else if (index > to) setRange(sessionId, from, index);
				else setRange(sessionId, index, index);
			};
			const range = messages.slice(from, to + 1);
			const rendered = format === "html" ? renderShareHtml(range) : format === "txt" ? renderShareTxt(range) : renderShareMarkdown(range);
			const preview = rendered.length > PREVIEW_MAX_CHARS ? `${rendered.slice(0, PREVIEW_MAX_CHARS)}\n${t("dialog.previewTruncated")}` : rendered;
			const actionsDisabled = busy !== null || messages.length === 0;
			return (0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
				open,
				onClose: () => {
					dismiss(sessionId);
				},
				title: t("dialog.title"),
				description: t("dialog.description"),
				closeLabel: t("dialog.close"),
				contentClassName: Dialog_module_css_default.content ?? "",
				footer: (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
					(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						variant: "primary",
						icon: flashCopied ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCheckOutline16, {}) : (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCopyOutline16, {}),
						disabled: actionsDisabled,
						onClick: () => {
							copy(sessionId);
						},
						children: flashCopied ? t("dialog.copied") : t("dialog.copy")
					}),
					(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						variant: "ghost",
						icon: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconDownloadOutline16, {}),
						disabled: actionsDisabled,
						onClick: () => {
							download(sessionId);
						},
						children: t("dialog.download")
					}),
					(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						variant: "ghost",
						onClick: () => {
							dismiss(sessionId);
						},
						children: t("dialog.close")
					})
				] }),
				children: [
					loading && (0, react_jsx_runtime.jsx)("p", {
						className: Dialog_module_css_default.status,
						children: t("dialog.loading")
					}),
					!loading && errorText !== null && (0, react_jsx_runtime.jsx)("p", {
						className: Dialog_module_css_default.status,
						children: errorText
					}),
					!loading && errorText === null && messages.length === 0 && (0, react_jsx_runtime.jsx)("p", {
						className: Dialog_module_css_default.status,
						children: t("dialog.empty")
					}),
					!loading && errorText === null && messages.length > 0 && (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
						(0, react_jsx_runtime.jsxs)("div", {
							className: Dialog_module_css_default.controls,
							children: [
								(0, react_jsx_runtime.jsxs)("label", {
									className: Dialog_module_css_default.rangeControl,
									children: [(0, react_jsx_runtime.jsx)("span", { children: t("dialog.rangeFrom") }), (0, react_jsx_runtime.jsx)("select", {
										value: from,
										disabled: busy !== null,
										onChange: (event) => {
											setRange(sessionId, Number(event.target.value), to);
										},
										children: messages.map((message, index) => (0, react_jsx_runtime.jsx)("option", {
											value: index,
											children: optionLabel(index, roleLabel(message.role), message.time, message.text)
										}, message.seq))
									})]
								}),
								(0, react_jsx_runtime.jsxs)("label", {
									className: Dialog_module_css_default.rangeControl,
									children: [(0, react_jsx_runtime.jsx)("span", { children: t("dialog.rangeTo") }), (0, react_jsx_runtime.jsx)("select", {
										value: to,
										disabled: busy !== null,
										onChange: (event) => {
											setRange(sessionId, from, Number(event.target.value));
										},
										children: messages.map((message, index) => (0, react_jsx_runtime.jsx)("option", {
											value: index,
											children: optionLabel(index, roleLabel(message.role), message.time, message.text)
										}, message.seq))
									})]
								}),
								(0, react_jsx_runtime.jsxs)("fieldset", {
									className: Dialog_module_css_default.formatControl,
									disabled: busy !== null,
									children: [
										(0, react_jsx_runtime.jsx)("legend", { children: t("dialog.format") }),
										(0, react_jsx_runtime.jsxs)("label", { children: [(0, react_jsx_runtime.jsx)("input", {
											type: "radio",
											name: `chat-share-format-${String(sessionId)}`,
											value: "markdown",
											checked: format === "markdown",
											onChange: () => {
												setFormat(sessionId, "markdown");
											}
										}), t("dialog.format.markdown")] }),
										(0, react_jsx_runtime.jsxs)("label", { children: [(0, react_jsx_runtime.jsx)("input", {
											type: "radio",
											name: `chat-share-format-${String(sessionId)}`,
											value: "html",
											checked: format === "html",
											onChange: () => {
												setFormat(sessionId, "html");
											}
										}), t("dialog.format.html")] }),
										(0, react_jsx_runtime.jsxs)("label", { children: [(0, react_jsx_runtime.jsx)("input", {
											type: "radio",
											name: `chat-share-format-${String(sessionId)}`,
											value: "txt",
											checked: format === "txt",
											onChange: () => {
												setFormat(sessionId, "txt");
											}
										}), t("dialog.format.txt")] })
									]
								})
							]
						}),
						(0, react_jsx_runtime.jsx)("p", {
							className: Dialog_module_css_default.messagesHeading,
							children: t("dialog.messages")
						}),
						(0, react_jsx_runtime.jsx)("ol", {
							className: Dialog_module_css_default.list,
							children: messages.map((message, index) => {
								const selected = index >= from && index <= to;
								return (0, react_jsx_runtime.jsx)("li", { children: (0, react_jsx_runtime.jsxs)("button", {
									type: "button",
									className: selected ? `${Dialog_module_css_default.row} ${Dialog_module_css_default.rowSelected}` : Dialog_module_css_default.row,
									"aria-pressed": selected,
									onClick: () => {
										clickMessage(index);
									},
									children: [
										(0, react_jsx_runtime.jsxs)("span", {
											className: Dialog_module_css_default.rowIndex,
											children: ["#", index + 1]
										}),
										(0, react_jsx_runtime.jsx)("span", {
											className: Dialog_module_css_default.rowRole,
											children: roleLabel(message.role)
										}),
										(0, react_jsx_runtime.jsx)("span", {
											className: Dialog_module_css_default.rowTime,
											children: formatShareTime(message.time)
										}),
										(0, react_jsx_runtime.jsx)("span", {
											className: Dialog_module_css_default.rowText,
											children: message.text.split("\n")[0]
										})
									]
								}) }, message.seq);
							})
						}),
						(0, react_jsx_runtime.jsxs)("details", {
							className: Dialog_module_css_default.preview,
							children: [(0, react_jsx_runtime.jsx)("summary", { children: t("dialog.preview") }), (0, react_jsx_runtime.jsx)("pre", {
								className: Dialog_module_css_default.previewBody,
								children: preview
							})]
						})
					] })
				]
			});
		}
		//#endregion
		//#region \0dsh-css:D:\deepseek-harness\packages\session-query\session-chat-share\src\client\HeaderAction.module.css.mjs
		const css = ".GUrF3q_shareButton{border:1px solid var(--dsw-alias-border-l2);min-width:96px;height:32px;color:var(--dsw-alias-label-primary);font-family:var(--dsw-font-family);cursor:pointer;background:0 0;border-radius:18px;justify-content:center;align-items:center;gap:4px;padding:6px 12px;font-size:13px;font-weight:400;line-height:20px;display:inline-flex}.GUrF3q_shareButton:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}.GUrF3q_shareButton:disabled{color:var(--dsw-alias-label-dimmed);cursor:wait}.GUrF3q_shareButton span,.GUrF3q_shareButton svg{flex:none}.GUrF3q_shareButton span{white-space:nowrap}";
		const tagId = "dsh-chat-share/HeaderAction.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-chat-share";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var HeaderAction_module_css_default = { "shareButton": "GUrF3q_shareButton" };
		//#endregion
		//#region lib/types/client/HeaderAction.js
		/**
		* Render the Session Header share capsule and its shared range dialog.
		* @param props - Session runtime, share controller, and localized dialog copy.
		* @returns the persistent Header action and Session-scoped dialog.
		*/
		function ChatShareHeaderAction(props) {
			const { sessionId, useChatShare, open, t } = props;
			const loading = useChatShare((state) => state.bySession[String(sessionId)])?.loading === true;
			return (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsxs)("button", {
				type: "button",
				className: HeaderAction_module_css_default.shareButton,
				disabled: loading,
				"aria-busy": loading,
				onClick: () => {
					open(sessionId);
				},
				children: [(0, react_jsx_runtime.jsx)("span", { children: t("header.label") }), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconShareOutline16, { size: 12 })]
			}), (0, react_jsx_runtime.jsx)(ChatShareDialog, { ...props })] });
		}
		//#endregion
		//#region lib/types/client/locales.js
		/** Locale namespace owned by the chat-segment share browser dialog. */
		const NS = "session-chat-share";
		/** Simplified-Chinese chat-share strings. */
		const zh = {
			"header.label": "分享",
			"menu.share": "分享",
			"menu.saveTxt": "保存 TXT",
			"dialog.title": "分享聊天片段",
			"dialog.description": "选择消息范围，以 Markdown、HTML 或 TXT 复制或下载。",
			"dialog.loading": "正在加载消息…",
			"dialog.empty": "此会话没有可分享的消息。",
			"dialog.historyFailed": "无法加载消息。",
			"dialog.copyFailed": "复制失败。",
			"dialog.downloadFailed": "下载失败。",
			"dialog.rangeFrom": "从",
			"dialog.rangeTo": "到",
			"dialog.format": "格式",
			"dialog.format.markdown": "Markdown",
			"dialog.format.html": "HTML",
			"dialog.format.txt": "TXT",
			"dialog.messages": "消息",
			"dialog.preview": "预览",
			"dialog.previewTruncated": "预览已截断。",
			"dialog.copy": "复制",
			"dialog.copied": "已复制",
			"dialog.download": "下载",
			"dialog.close": "关闭",
			"role.user": "用户",
			"role.assistant": "助手"
		};
		/** English chat-share strings. */
		const en = {
			"header.label": "Share",
			"menu.share": "Share",
			"menu.saveTxt": "Save TXT",
			"dialog.title": "Share chat segment",
			"dialog.description": "Select a message range and copy or download it as Markdown, HTML, or TXT.",
			"dialog.loading": "Loading messages…",
			"dialog.empty": "This session has no shareable messages.",
			"dialog.historyFailed": "Could not load messages.",
			"dialog.copyFailed": "Copy failed.",
			"dialog.downloadFailed": "Download failed.",
			"dialog.rangeFrom": "From",
			"dialog.rangeTo": "To",
			"dialog.format": "Format",
			"dialog.format.markdown": "Markdown",
			"dialog.format.html": "HTML",
			"dialog.format.txt": "TXT",
			"dialog.messages": "Messages",
			"dialog.preview": "Preview",
			"dialog.previewTruncated": "Preview truncated.",
			"dialog.copy": "Copy",
			"dialog.copied": "Copied",
			"dialog.download": "Download",
			"dialog.close": "Close",
			"role.user": "User",
			"role.assistant": "Assistant"
		};
		//#endregion
		//#region lib/types/client/row-menu.js
		/** Sidebar session-row `...` menu actions for the share feature. */
		/**
		* Build the session-row menu contribution: one Share row after the built-in
		* Rename / Fork / Archive rows, opening this Session's share dialog.
		* @param open - controller open for one session (wired in the client apply).
		* @param menuLabel - localized menu label, re-evaluated at every render.
		* @returns the registry action descriptor.
		*/
		function chatShareRowMenuAction(open, menuLabel) {
			return {
				id: "chat-share",
				label: menuLabel,
				icon: (0, react.createElement)(_deepseek_ai_dsh_client_ui_primitives.IconShareOutline16),
				order: 10,
				run: (sessionId) => {
					open(sessionId);
				}
			};
		}
		/**
		* Build the session-row menu contribution that saves the Session's whole
		* shareable chat as one plain-text file, without opening the dialog.
		* @param saveTxt - controller save for one session (wired in the client apply).
		* @param menuLabel - localized menu label, re-evaluated at every render.
		* @returns the registry action descriptor.
		*/
		function chatShareSaveTxtMenuAction(saveTxt, menuLabel) {
			return {
				id: "chat-share-save-txt",
				label: menuLabel,
				icon: (0, react.createElement)(_deepseek_ai_dsh_client_ui_primitives.IconDownloadOutline16),
				order: 20,
				run: (sessionId) => {
					saveTxt(sessionId);
				}
			};
		}
		//#endregion
		//#region lib/types/client/index.js
		/** Browser plugin owning the chat-segment share dialog, its controller, and the Header entry. */
		const inject = [
			"slots",
			"locale",
			"connection",
			"sessionRowMenu"
		];
		/**
		* Wire the `session.history` reader onto the shared API client.
		* @param connection - the shared wire handle.
		* @returns one paged history reader over the sessions domain.
		*/
		function historyReader(connection) {
			return async (sessionId, beforeSeq, maxMessages) => {
				const result = (await connection.api.sessions.history({
					sessionId,
					maxMessages,
					...beforeSeq === void 0 ? {} : { beforeSeq }
				})).result;
				if (!result.ok) throw new Error(`History read failed: ${result.error.message}`);
				return result.value;
			};
		}
		/**
		* Provide the share controller and mount its dialog into the Session Header.
		* @param ctx - browser context carrying slots, locale, and connection services.
		*/
		function apply(ctx) {
			const controller = new ChatShareController(historyReader(ctx.get("connection")));
			ctx.provide("chatShare", controller);
			ctx.effect(() => async () => {
				await controller.dispose();
			}, "session-chat-share: browser lifecycle");
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "session-chat-share: browser dictionaries");
			const menuT = ctx.locale.bind(NS);
			ctx.effect(() => ctx.sessionRowMenu.register(chatShareRowMenuAction((sessionId) => controller.open(sessionId), () => menuT("menu.share"))), "session-chat-share: row menu action");
			ctx.effect(() => ctx.sessionRowMenu.register(chatShareSaveTxtMenuAction((sessionId) => controller.saveTxt(sessionId), () => menuT("menu.saveTxt"))), "session-chat-share: row menu save-txt action");
			ctx.on("command/executed", (sessionId, commandName, result) => {
				if (commandName === "share" && result.kind === "success") controller.open(sessionId);
			});
			ctx.slots.inject("conversation.session.header.utilities", () => ctx.slots.register({
				name: "conversation.session.header.utilities",
				id: "session-chat-share",
				locale: NS,
				inject: () => ({
					hooks: { chatShare: controller.store },
					open: (sessionId) => controller.open(sessionId),
					setRange: (sessionId, from, to) => {
						controller.setRange(sessionId, from, to);
					},
					setFormat: (sessionId, format) => {
						controller.setFormat(sessionId, format);
					},
					copy: (sessionId) => controller.copy(sessionId),
					download: (sessionId) => controller.download(sessionId),
					dismiss: (sessionId) => {
						controller.dismiss(sessionId);
					}
				})
			}, ChatShareHeaderAction));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map