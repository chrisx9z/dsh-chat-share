window.__ModuleLoader__.load({
	id: "dsh-chat-share",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let _deepseek_ai_dsh_client_runtime_client = require("@deepseek-ai/dsh-client-runtime/client");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/client/render.ts
		const DEFAULT_LABELS = {
			user: "User",
			assistant: "Assistant",
			tool: "Tool",
			sharedFrom: "Shared from DeepSeek Harness"
		};
		/** One fixed timestamp format so shared artifacts read identically on every machine. */
		function formatShareTime(time) {
			return new Date(time).toLocaleString(void 0, {
				dateStyle: "medium",
				timeStyle: "medium"
			});
		}
		function labelsOf$1(options) {
			return options.labels ?? DEFAULT_LABELS;
		}
		function roleLabel(role, labels) {
			if (role === "user") return labels.user;
			if (role === "assistant") return labels.assistant;
			return labels.tool;
		}
		/** The artifact header: title, model, and the shared-from line. */
		function headerLines(labels, meta) {
			const lines = [];
			if (meta?.title !== void 0 && meta.title !== "") lines.push(`# ${meta.title}`, "");
			if (meta?.model !== void 0 && meta.model !== "") lines.push(`Model: ${meta.model}`, "");
			lines.push(labels.sharedFrom, "");
			return lines;
		}
		/**
		* Render the selected range as Markdown with role headers and timestamps.
		* @param messages - chronological share messages (already range-sliced).
		* @param options - labels, optional header meta.
		* @returns one Markdown document.
		*/
		function renderShareMarkdown(messages, options = {}) {
			const labels = labelsOf$1(options);
			const lines = headerLines(labels, options.meta);
			for (const message of messages) lines.push(`**${roleLabel(message.role, labels)}** · ${formatShareTime(message.time)}`, "", message.text, "");
			return lines.join("\n").trimEnd() + "\n";
		}
		/**
		* Render the selected range as plain text with role headers and timestamps.
		* @param messages - chronological share messages (already range-sliced).
		* @param options - labels, optional header meta.
		* @returns one plain-text document (no markup).
		*/
		function renderShareTxt(messages, options = {}) {
			const labels = labelsOf$1(options);
			const lines = headerLines(labels, options.meta).map((line) => line.replace(/^# /, ""));
			for (const message of messages) lines.push(`${roleLabel(message.role, labels)} · ${formatShareTime(message.time)}`, "", message.text, "");
			return lines.join("\n").trimEnd() + "\n";
		}
		/** Escape text for safe inclusion in the generated HTML page. */
		function escapeHtml(text) {
			return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("\"", "&quot;").replaceAll("'", "&#39;");
		}
		/** Render inline markdown (code, bold, italic, links) on already-escaped text. */
		function inline(escaped) {
			const codes = [];
			return escaped.replace(/`([^`]+)`/g, (_match, code) => {
				codes.push(code);
				return `\u0000${codes.length - 1}\u0000`;
			}).replace(/!\[([^\]]*)\]\([^)]+\)/g, (_match, alt) => `[${alt}]`).replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (_match, label, href) => `<a href="${href}" rel="noreferrer">${label}</a>`).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>").replace(/\u0000(\d+)\u0000/g, (_match, index) => `<code>${codes[Number(index)] ?? ""}</code>`);
		}
		/** One `<li>` from a bullet/ordered line's content. */
		function listItem(content) {
			return `<li>${inline(escapeHtml(content.trim()))}</li>`;
		}
		/** Split raw text into blocks and render GFM-lite HTML. */
		function renderGfmHtml(text) {
			const lines = text.split("\n");
			const blocks = [];
			let plain = [];
			const flushPlain = () => {
				if (plain.length === 0) return;
				blocks.push(`<p>${plain.map((line) => inline(escapeHtml(line.trim()))).join("<br />")}</p>`);
				plain = [];
			};
			let index = 0;
			while (index < lines.length) {
				const line = lines[index];
				const trimmed = line.trim();
				if (trimmed === "") {
					flushPlain();
					index += 1;
					continue;
				}
				const fence = /^```([^\n]*)$/.exec(trimmed);
				if (fence !== null) {
					flushPlain();
					const code = [];
					index += 1;
					while (index < lines.length && !/^```\s*$/.test(lines[index].trim())) {
						code.push(lines[index]);
						index += 1;
					}
					index += 1;
					const lang = fence[1]?.trim() ?? "";
					const cls = lang === "" ? "" : ` class="language-${escapeHtml(lang)}"`;
					blocks.push(`<pre><code${cls}>${escapeHtml(code.join("\n").trimEnd())}</code></pre>`);
					continue;
				}
				const heading = /^(#{1,6})\s+(.+)$/.exec(trimmed);
				if (heading !== null) {
					flushPlain();
					const level = Math.min(6, heading[1]?.length ?? 6);
					blocks.push(`<h${level}>${inline(escapeHtml(heading[2].trim()))}</h${level}>`);
					index += 1;
					continue;
				}
				if (trimmed.startsWith(">")) {
					flushPlain();
					const quote = [];
					while (index < lines.length && lines[index].trim().startsWith(">")) {
						quote.push(lines[index].trim().replace(/^>\s?/, ""));
						index += 1;
					}
					blocks.push(`<blockquote><p>${quote.map((q) => inline(escapeHtml(q))).join("<br />")}</p></blockquote>`);
					continue;
				}
				const bullet = /^[-*+]\s+(.+)$/.exec(trimmed);
				if (bullet !== null) {
					flushPlain();
					const items = [listItem(bullet[1])];
					index += 1;
					while (index < lines.length) {
						const next = lines[index].trim();
						const nextBullet = /^[-*+]\s+(.+)$/.exec(next);
						if (nextBullet === null) break;
						items.push(listItem(nextBullet[1]));
						index += 1;
					}
					blocks.push(`<ul>${items.join("")}</ul>`);
					continue;
				}
				const ordered = /^\d+\.\s+(.+)$/.exec(trimmed);
				if (ordered !== null) {
					flushPlain();
					const items = [listItem(ordered[1])];
					index += 1;
					while (index < lines.length) {
						const next = lines[index].trim();
						const nextOrdered = /^\d+\.\s+(.+)$/.exec(next);
						if (nextOrdered === null) break;
						items.push(listItem(nextOrdered[1]));
						index += 1;
					}
					blocks.push(`<ol>${items.join("")}</ol>`);
					continue;
				}
				if (trimmed.includes("|") && index + 1 < lines.length && /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[index + 1].trim()) && lines[index + 1].includes("-")) {
					flushPlain();
					const splitRow = (row) => row.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
					const header = splitRow(trimmed);
					index += 2;
					const body = [];
					while (index < lines.length && lines[index].trim().includes("|")) {
						body.push(splitRow(lines[index].trim()));
						index += 1;
					}
					const cells = (row, tag) => row.map((cell) => `<${tag}>${inline(escapeHtml(cell))}</${tag}>`).join("");
					blocks.push(`<table><thead><tr>${cells(header, "th")}</tr></thead><tbody>${body.map((row) => `<tr>${cells(row, "td")}</tr>`).join("")}</tbody></table>`);
					continue;
				}
				plain.push(line);
				index += 1;
			}
			flushPlain();
			return blocks.join("\n");
		}
		/**
		* Render the selected range as a self-contained HTML page with GFM-lite
		* body rendering; session images embed as data URIs when provided.
		* @param messages - chronological share messages (already range-sliced).
		* @param options - labels, optional header meta, optional resolved images.
		* @returns a complete HTML document the recipient can open in any browser.
		*/
		function renderShareHtml(messages, options = {}) {
			const labels = labelsOf$1(options);
			const body = messages.map((message) => {
				const imageTags = (message.images ?? []).map((image) => {
					const dataUri = options.images?.get(image.attachmentId);
					return dataUri === void 0 ? `<p class="image-marker">[${escapeHtml(image.name ?? labels.sharedFrom)}]</p>` : `<p class="image"><img src="${dataUri}" alt="${escapeHtml(image.name ?? "")}" loading="lazy" /></p>`;
				}).join("\n");
				return [
					"<section class=\"message\">",
					`<p class="role">${escapeHtml(roleLabel(message.role, labels))} · ${escapeHtml(formatShareTime(message.time))}</p>`,
					message.text !== "" ? renderGfmHtml(message.text) : "",
					imageTags,
					"</section>"
				].join("\n");
			}).join("\n");
			const metaLines = [];
			if (options.meta?.title !== void 0 && options.meta.title !== "") metaLines.push(`<h1>${escapeHtml(options.meta.title)}</h1>`);
			if (options.meta?.model !== void 0 && options.meta.model !== "") metaLines.push(`<p class="meta">Model: ${escapeHtml(options.meta.model)}</p>`);
			metaLines.push(`<p class="meta">${escapeHtml(labels.sharedFrom)}</p>`);
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
				"h1 { font-size: 22px; }",
				"h2 { font-size: 19px; } h3 { font-size: 17px; } h4, h5, h6 { font-size: 15px; }",
				"pre { background: #f6f8fa; padding: 12px; border-radius: 8px; overflow-x: auto; }",
				"@media (prefers-color-scheme: dark) { pre { background: #161b22; } }",
				"code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 13px; }",
				"table { border-collapse: collapse; margin: 8px 0; }",
				"th, td { border: 1px solid #d0d7de; padding: 4px 10px; font-size: 14px; }",
				"blockquote { margin: 8px 0; padding-left: 12px; border-left: 3px solid #d0d7de; color: #57606a; }",
				"img { max-width: 100%; border-radius: 8px; }",
				"p { margin: 8px 0; }",
				"</style>",
				"</head>",
				"<body>",
				"<main>",
				...metaLines,
				body,
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
		/**
		* Best-effort redaction for shared artifacts: masks common credential shapes
		* and local absolute/home paths. Applied to message text before rendering.
		* @param text - raw message text.
		* @returns text with sensitive shapes replaced by `[key]` / `[path]`.
		*/
		function redactSensitive(text) {
			return text.replace(/\b(sk-[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{10,})\b/g, "[key]").replace(/(?:~(?=[/\\]|$)(?:[/\\][^\s"']*)?|(?:\/Users\/[^/\s]+|C:\\Users\\[^\\\s]+)(?:[/\\][^\s"']*)?)/g, "[path]");
		}
		//#endregion
		//#region src/client/controller.ts
		/** Browser state and actions for sharing a selected range of chat messages. */
		/** Cap on tool-call arguments carried into artifacts. */
		const TOOL_ARGS_MAX_CHARS = 800;
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
		* Split a message's content into share text and image references.
		* @param content - the message's model-facing blocks.
		* @returns the share text ('' when nothing shareable) and the image refs.
		*/
		function shareMessageParts(content) {
			const parts = [];
			const images = [];
			for (const block of content) if (block.type === "text") parts.push(block.text ?? "");
			else if (block.type === "image") {
				const attachmentId = block.attachment?.attachmentId;
				if (attachmentId !== void 0) images.push({
					attachmentId,
					mediaType: block.attachment?.mediaType ?? "image/png",
					...block.attachment?.name !== void 0 ? { name: block.attachment.name } : {}
				});
				else parts.push("[image]");
			}
			const text = parts.join("\n");
			return {
				text: text !== "" ? text : images.length > 0 ? "[image]" : "",
				images
			};
		}
		/**
		* Fold history entries (chronological) into shareable rows: user/assistant
		* messages with their image refs, optional tool-call rows, newest last.
		* Tool results, boundary markers, and surface-replacing compaction copies are
		* excluded; messages with no shareable text are dropped.
		* @param events - history entries in log order.
		* @param options - include tool-call rows when enabled.
		* @returns share rows in the same order.
		*/
		function buildShareMessages(events, options = {}) {
			const messages = [];
			for (const entry of events) {
				const event = entry.event;
				if (event.type === "user/message") {
					if (event.surfaceOp !== "append") continue;
					const { text, images } = shareMessageParts(event.data.content);
					if (text === "") continue;
					messages.push({
						seq: event.seq,
						role: "user",
						text,
						time: event.time,
						...images.length > 0 ? { images } : {}
					});
				} else if (event.type === "assistant/message") {
					if (event.surfaceOp !== "append") continue;
					const { text, images } = shareMessageParts(event.data.message.content);
					if (text === "") continue;
					messages.push({
						seq: event.seq,
						role: "assistant",
						text,
						time: event.time,
						...images.length > 0 ? { images } : {}
					});
				} else if (event.type === "tool/call" && options.includeTools === true) {
					const args = event.data.arguments;
					const bounded = args.length > TOOL_ARGS_MAX_CHARS ? `${args.slice(0, TOOL_ARGS_MAX_CHARS)}\n…` : args;
					messages.push({
						seq: event.seq,
						role: "tool",
						text: `\`${event.data.name}\`\n\n${bounded}`,
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
			attachments;
			meta;
			labels;
			/** uSES-safe state source shared by every Session-scoped dialog contribution. */
			store = (0, _deepseek_ai_dsh_client_runtime_client.createSnapshotStore)(INITIAL);
			active = /* @__PURE__ */ new Map();
			disposed = false;
			/**
			* @param reader - paged `session.history` reader (tail page when `beforeSeq` is absent).
			* @param clipboard - clipboard writer returning whether the write landed.
			* @param save - browser save operation for the generated artifact Blob.
			* @param attachments - optional `session.attachment` reader for HTML image embedding.
			* @param meta - optional artifact header facts reader (title, model).
			* @param labels - optional live artifact vocabulary (follows the UI locale).
			*/
			constructor(reader, clipboard = _deepseek_ai_dsh_client_ui_primitives.writeClipboard, save = saveBlob, attachments, meta, labels) {
				this.reader = reader;
				this.clipboard = clipboard;
				this.save = save;
				this.attachments = attachments;
				this.meta = meta;
				this.labels = labels;
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
			* @param lastN - when given, save only the newest N messages.
			* @returns after the browser save starts; load failures publish the error.
			*/
			saveTxt(sessionId, lastN) {
				const existing = this.active.get(sessionId);
				if (existing !== void 0) return existing.done.then(() => this.downloadAllTxt(sessionId, lastN));
				if (this.disposed) return Promise.resolve();
				const abort = new AbortController();
				const done = this.loadAllTxt(sessionId, lastN, abort.signal).finally(() => {
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
			* @param format - Markdown, HTML, or TXT.
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
			* Toggle best-effort redaction of the rendered artifacts.
			* @param sessionId - Session owning the dialog.
			* @param redact - mask credential shapes and local paths.
			*/
			setRedact(sessionId, redact) {
				const current = this.entry(sessionId);
				if (current === void 0) return;
				this.publish(sessionId, {
					...current,
					redact,
					error: null
				});
			}
			/**
			* Toggle tool-call rows in the list and artifacts (rebuilt from raw history).
			* @param sessionId - Session owning the dialog.
			* @param includeTools - show tool-call rows.
			*/
			setIncludeTools(sessionId, includeTools) {
				const current = this.entry(sessionId);
				if (current === void 0) return;
				const messages = this.buildRows(current.raw, includeTools);
				const clamp = (index) => Math.max(0, Math.min(messages.length - 1, index));
				const from = clamp(current.from);
				const to = clamp(current.to);
				this.publish(sessionId, {
					...current,
					includeTools,
					messages,
					from,
					to,
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
				const meta = await this.metaOf(sessionId);
				const text = renderShareMarkdown(this.applyOptions(current, this.range(current)), {
					meta,
					...this.labels !== void 0 ? { labels: this.labels() } : {}
				});
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
			async download(sessionId) {
				const current = this.entry(sessionId);
				if (current === void 0 || current.messages.length === 0 || current.busy !== null) return;
				this.publish(sessionId, {
					...current,
					busy: "download",
					error: null
				});
				const selected = this.applyOptions(current, this.range(current));
				try {
					const [meta, images] = await Promise.all([this.metaOf(sessionId), current.format === "html" ? this.resolveImages(sessionId, selected) : Promise.resolve(void 0)]);
					const options = {
						meta,
						...this.labels !== void 0 ? { labels: this.labels() } : {},
						...images !== void 0 ? { images } : {}
					};
					const blob = current.format === "html" ? new Blob([renderShareHtml(selected, options)], { type: "text/html;charset=utf-8" }) : current.format === "txt" ? new Blob([renderShareTxt(selected, options)], { type: "text/plain;charset=utf-8" }) : new Blob([renderShareMarkdown(selected, options)], { type: "text/markdown;charset=utf-8" });
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
			/** Build the bounded row list from raw history (newest SHARE_MAX_MESSAGES). */
			buildRows(raw, includeTools) {
				return buildShareMessages(raw, { includeTools }).slice(-300);
			}
			/** Apply the current options to a row list: tool rows filtered, redaction applied. */
			applyOptions(entry, rows) {
				const kept = entry.includeTools ? [...rows] : rows.filter((message) => message.role !== "tool");
				return entry.redact ? kept.map((message) => ({
					...message,
					text: redactSensitive(message.text)
				})) : kept;
			}
			/** The selected inclusive range of the dialog's message list. */
			range(entry) {
				return entry.messages.slice(entry.from, entry.to + 1);
			}
			async metaOf(sessionId) {
				if (this.meta === void 0) return {};
				try {
					return await this.meta(sessionId);
				} catch {
					return {};
				}
			}
			async resolveImages(sessionId, messages) {
				if (this.attachments === void 0) return void 0;
				const resolved = /* @__PURE__ */ new Map();
				for (const message of messages) for (const image of message.images ?? []) {
					if (resolved.has(image.attachmentId)) continue;
					try {
						const { data, mediaType } = await this.attachments(sessionId, image.attachmentId);
						resolved.set(image.attachmentId, `data:${mediaType};base64,${data}`);
					} catch {}
				}
				return resolved;
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
					raw: [],
					messages: [],
					from: 0,
					to: 0,
					format: current?.format ?? "markdown",
					redact: current?.redact ?? true,
					includeTools: current?.includeTools ?? false,
					busy: null,
					copied: false,
					error: null
				});
				try {
					const raw = await this.loadRaw(sessionId, signal);
					const messages = this.buildRows(raw, false);
					this.publish(sessionId, {
						open: true,
						loading: false,
						raw,
						messages,
						from: 0,
						to: Math.max(0, messages.length - 1),
						format: "markdown",
						redact: true,
						includeTools: false,
						busy: null,
						copied: false,
						error: null
					});
				} catch (error) {
					if (signal.aborted) return;
					const entry = this.entry(sessionId) ?? {
						open: true,
						loading: false,
						raw: [],
						messages: [],
						from: 0,
						to: 0,
						format: "markdown",
						redact: true,
						includeTools: false,
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
			/** Load the whole shareable chat and hand it to the browser save operation. */
			async loadAllTxt(sessionId, lastN, signal) {
				const current = this.entry(sessionId);
				if (current !== void 0 && current.messages.length > 0) {
					await this.saveTxtBlob(sessionId, current, lastN);
					return;
				}
				try {
					const raw = await this.loadRaw(sessionId, signal);
					const messages = this.buildRows(raw, false);
					const entry = {
						open: false,
						loading: false,
						raw,
						messages,
						from: 0,
						to: Math.max(0, messages.length - 1),
						format: "markdown",
						redact: true,
						includeTools: false,
						busy: null,
						copied: false,
						error: null
					};
					await this.saveTxtBlob(sessionId, entry, lastN);
				} catch (error) {
					if (signal.aborted) return;
					const entry = this.entry(sessionId) ?? {
						open: false,
						loading: false,
						raw: [],
						messages: [],
						from: 0,
						to: 0,
						format: "markdown",
						redact: true,
						includeTools: false,
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
			async downloadAllTxt(sessionId, lastN) {
				const entry = this.entry(sessionId);
				if (entry === void 0 || entry.messages.length === 0) return;
				await this.saveTxtBlob(sessionId, entry, lastN);
			}
			async saveTxtBlob(sessionId, entry, lastN) {
				const rows = this.applyOptions(entry, entry.messages);
				const slice = lastN === void 0 ? rows : rows.slice(-lastN);
				const meta = await this.metaOf(sessionId);
				const blob = new Blob([renderShareTxt(slice, {
					meta,
					...this.labels !== void 0 ? { labels: this.labels() } : {}
				})], { type: "text/plain;charset=utf-8" });
				this.save(blob, shareFileName(String(sessionId), 0, Math.max(0, slice.length - 1), "txt"));
			}
			async loadRaw(sessionId, signal) {
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
				return pages.reverse().flat();
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
		const css$1 = ".XfqGVG_content{flex-direction:column;gap:12px;min-height:0;display:flex}.XfqGVG_status{color:var(--dsw-alias-label-secondary);margin:0;font-size:13px;line-height:20px}.XfqGVG_controls{flex-wrap:wrap;align-items:flex-end;gap:12px;display:flex}.XfqGVG_rangeControl{color:var(--dsw-alias-label-secondary);flex-direction:column;gap:4px;font-size:13px;display:flex}.XfqGVG_rangeControl select{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-elevated);max-width:260px;height:28px;color:var(--dsw-alias-label-primary);font-family:var(--dsw-font-family);border-radius:6px;font-size:13px}.XfqGVG_formatControl{color:var(--dsw-alias-label-secondary);border:none;align-items:center;gap:12px;margin:0;padding:0;font-size:13px;display:flex}.XfqGVG_formatControl legend,.XfqGVG_optionControl legend{margin-bottom:4px;padding:0}.XfqGVG_formatControl label,.XfqGVG_optionControl label{cursor:pointer;align-items:center;gap:4px;display:inline-flex}.XfqGVG_optionControl{color:var(--dsw-alias-label-secondary);border:none;flex-direction:column;gap:6px;margin:0;padding:0;font-size:13px;display:flex}.XfqGVG_messagesHeading{color:var(--dsw-alias-label-secondary);margin:0;font-size:13px}.XfqGVG_list{border:1px solid var(--dsw-alias-border-l2);border-radius:8px;max-height:220px;margin:0;padding:0;list-style:none;overflow-y:auto}.XfqGVG_row{width:100%;color:var(--dsw-alias-label-primary);font-family:var(--dsw-font-family);text-align:left;cursor:pointer;background:0 0;border:none;align-items:center;gap:8px;padding:6px 10px;font-size:13px;line-height:20px;display:flex}.XfqGVG_row:hover{background:var(--dsw-alias-interactive-bg-hover)}.XfqGVG_rowSelected{background:var(--dsw-alias-interactive-bg-active)}.XfqGVG_rowIndex{color:var(--dsw-alias-label-dimmed);font-variant-numeric:tabular-nums;flex:none}.XfqGVG_rowRole{flex:none;font-weight:600}.XfqGVG_rowTool{color:var(--dsw-alias-label-dimmed);font-weight:400}.XfqGVG_rowTime{color:var(--dsw-alias-label-dimmed);flex:none;font-size:12px}.XfqGVG_rowText{text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-secondary);overflow:hidden}.XfqGVG_preview{color:var(--dsw-alias-label-secondary);font-size:13px}.XfqGVG_preview summary{cursor:pointer;user-select:none}.XfqGVG_previewBody{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-elevated);max-height:240px;color:var(--dsw-alias-label-primary);word-break:break-word;border-radius:8px;margin:8px 0 0;padding:10px 12px;font-size:13px;line-height:20px;overflow:auto}.XfqGVG_previewRow{margin:8px 0}.XfqGVG_previewRow:first-child{margin-top:0}.XfqGVG_previewRole{color:var(--dsw-alias-label-secondary);margin-bottom:2px;font-size:12px;font-weight:600;display:block}";
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
			"optionControl": "XfqGVG_optionControl",
			"preview": "XfqGVG_preview",
			"previewBody": "XfqGVG_previewBody",
			"previewRole": "XfqGVG_previewRole",
			"previewRow": "XfqGVG_previewRow",
			"rangeControl": "XfqGVG_rangeControl",
			"row": "XfqGVG_row",
			"rowIndex": "XfqGVG_rowIndex",
			"rowRole": "XfqGVG_rowRole",
			"rowSelected": "XfqGVG_rowSelected",
			"rowText": "XfqGVG_rowText",
			"rowTime": "XfqGVG_rowTime",
			"rowTool": "XfqGVG_rowTool",
			"status": "XfqGVG_status"
		};
		//#endregion
		//#region src/client/Dialog.tsx
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
		function ChatShareDialog({ sessionId, useChatShare, setRange, setFormat, setRedact, setIncludeTools, copy, download, dismiss, t }) {
			const entry = useChatShare((state) => state.bySession[String(sessionId)]);
			const open = entry?.open === true;
			const loading = entry?.loading === true;
			const messages = entry?.messages ?? [];
			const from = entry?.from ?? 0;
			const to = entry?.to ?? 0;
			const format = entry?.format ?? "markdown";
			const redact = entry?.redact ?? true;
			const includeTools = entry?.includeTools ?? false;
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
			const roleLabel = (role) => {
				if (role === "user") return t("role.user");
				if (role === "assistant") return t("role.assistant");
				return t("role.tool");
			};
			const errorText = errorMessage(error, t);
			const clickMessage = (index) => {
				if (index < from) setRange(sessionId, index, to);
				else if (index > to) setRange(sessionId, from, index);
				else setRange(sessionId, index, index);
			};
			const range = messages.slice(from, to + 1);
			const previewText = (text) => redact ? redactSensitive(text) : text;
			const actionsDisabled = busy !== null || messages.length === 0;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
				open,
				onClose: () => {
					dismiss(sessionId);
				},
				title: t("dialog.title"),
				description: t("dialog.description"),
				closeLabel: t("dialog.close"),
				contentClassName: Dialog_module_css_default.content ?? "",
				footer: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						variant: "primary",
						icon: flashCopied ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCheckOutline16, {}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCopyOutline16, {}),
						disabled: actionsDisabled,
						onClick: () => {
							copy(sessionId);
						},
						children: flashCopied ? t("dialog.copied") : t("dialog.copy")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						variant: "ghost",
						icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconDownloadOutline16, {}),
						disabled: actionsDisabled,
						onClick: () => {
							download(sessionId);
						},
						children: t("dialog.download")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						variant: "ghost",
						onClick: () => {
							dismiss(sessionId);
						},
						children: t("dialog.close")
					})
				] }),
				children: [
					loading && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: Dialog_module_css_default.status,
						children: t("dialog.loading")
					}),
					!loading && errorText !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: Dialog_module_css_default.status,
						children: errorText
					}),
					!loading && errorText === null && messages.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: Dialog_module_css_default.status,
						children: t("dialog.empty")
					}),
					!loading && errorText === null && messages.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: Dialog_module_css_default.controls,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
									className: Dialog_module_css_default.rangeControl,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("dialog.rangeFrom") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
										value: from,
										disabled: busy !== null,
										onChange: (event) => {
											setRange(sessionId, Number(event.target.value), to);
										},
										children: messages.map((message, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
											value: index,
											children: optionLabel(index, roleLabel(message.role), message.time, message.text)
										}, message.seq))
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
									className: Dialog_module_css_default.rangeControl,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("dialog.rangeTo") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
										value: to,
										disabled: busy !== null,
										onChange: (event) => {
											setRange(sessionId, from, Number(event.target.value));
										},
										children: messages.map((message, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
											value: index,
											children: optionLabel(index, roleLabel(message.role), message.time, message.text)
										}, message.seq))
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("fieldset", {
									className: Dialog_module_css_default.formatControl,
									disabled: busy !== null,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("legend", { children: t("dialog.format") }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											type: "radio",
											name: `chat-share-format-${String(sessionId)}`,
											value: "markdown",
											checked: format === "markdown",
											onChange: () => {
												setFormat(sessionId, "markdown");
											}
										}), t("dialog.format.markdown")] }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											type: "radio",
											name: `chat-share-format-${String(sessionId)}`,
											value: "html",
											checked: format === "html",
											onChange: () => {
												setFormat(sessionId, "html");
											}
										}), t("dialog.format.html")] }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											type: "radio",
											name: `chat-share-format-${String(sessionId)}`,
											value: "txt",
											checked: format === "txt",
											onChange: () => {
												setFormat(sessionId, "txt");
											}
										}), t("dialog.format.txt")] })
									]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("fieldset", {
									className: Dialog_module_css_default.optionControl,
									disabled: busy !== null,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("legend", { children: t("options") }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											type: "checkbox",
											checked: redact,
											onChange: (event) => {
												setRedact(sessionId, event.target.checked);
											}
										}), t("options.redact")] }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											type: "checkbox",
											checked: includeTools,
											onChange: (event) => {
												setIncludeTools(sessionId, event.target.checked);
											}
										}), t("options.tools")] })
									]
								})
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: Dialog_module_css_default.messagesHeading,
							children: t("dialog.messages")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("ol", {
							className: Dialog_module_css_default.list,
							children: messages.map((message, index) => {
								const selected = index >= from && index <= to;
								const toolRow = message.role === "tool";
								return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
									type: "button",
									className: selected ? `${Dialog_module_css_default.row} ${Dialog_module_css_default.rowSelected}` : Dialog_module_css_default.row,
									"aria-pressed": selected,
									onClick: () => {
										clickMessage(index);
									},
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
											className: Dialog_module_css_default.rowIndex,
											children: ["#", index + 1]
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: toolRow ? `${Dialog_module_css_default.rowRole} ${Dialog_module_css_default.rowTool}` : Dialog_module_css_default.rowRole,
											children: roleLabel(message.role)
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: Dialog_module_css_default.rowTime,
											children: formatShareTime(message.time)
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: Dialog_module_css_default.rowText,
											children: message.text.split("\n")[0]
										})
									]
								}) }, message.seq);
							})
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", {
							className: Dialog_module_css_default.preview,
							open: true,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("summary", { children: t("dialog.preview") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: Dialog_module_css_default.previewBody,
								children: range.map((message) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: Dialog_module_css_default.previewRow,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: Dialog_module_css_default.previewRole,
										children: [
											roleLabel(message.role),
											" · ",
											formatShareTime(message.time)
										]
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.MarkdownText, { text: previewText(message.text) })]
								}, message.seq))
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
		//#region src/client/HeaderAction.tsx
		/**
		* Render the Session Header share capsule and its shared range dialog.
		* @param props - Session runtime, share controller, and localized dialog copy.
		* @returns the persistent Header action and Session-scoped dialog.
		*/
		function ChatShareHeaderAction(props) {
			const { sessionId, useChatShare, open, t } = props;
			const loading = useChatShare((state) => state.bySession[String(sessionId)])?.loading === true;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
				type: "button",
				className: HeaderAction_module_css_default.shareButton,
				disabled: loading,
				"aria-busy": loading,
				onClick: () => {
					open(sessionId);
				},
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("header.label") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconShareOutline16, { size: 12 })]
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ChatShareDialog, { ...props })] });
		}
		//#endregion
		//#region src/client/locales.ts
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
			"dialog.copy": "复制",
			"dialog.copied": "已复制",
			"dialog.download": "下载",
			"dialog.close": "关闭",
			"options": "选项",
			"options.redact": "脱敏敏感信息",
			"options.tools": "包含工具调用",
			"role.user": "用户",
			"role.assistant": "助手",
			"role.tool": "工具",
			"artifact.sharedFrom": "分享自 DeepSeek Harness"
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
			"dialog.copy": "Copy",
			"dialog.copied": "Copied",
			"dialog.download": "Download",
			"dialog.close": "Close",
			"options": "Options",
			"options.redact": "Redact sensitive info",
			"options.tools": "Include tool calls",
			"role.user": "User",
			"role.assistant": "Assistant",
			"role.tool": "Tool",
			"artifact.sharedFrom": "Shared from DeepSeek Harness"
		};
		//#endregion
		//#region src/client/row-menu.ts
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
		//#region src/client/index.ts
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
		/** Wire `session.attachment` for HTML image embedding. */
		function attachmentReader(connection) {
			return async (sessionId, attachmentId) => {
				const result = (await connection.api.sessions.attachment({
					sessionId,
					attachmentId
				})).result;
				if (!result.ok) throw new Error(`Attachment read failed: ${result.error.message}`);
				return {
					data: result.value.data,
					mediaType: result.value.attachment.mediaType
				};
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
					if (!result.ok) return void 0;
					const candidate = (result.value.items.find((item) => String(item.sessionId) === String(sessionId))?.projections?.values)?.["title"];
					return typeof candidate === "string" && candidate !== "" ? candidate : void 0;
				}).catch(() => void 0);
				let model;
				const tail = await readHistory(sessionId, void 0, 50).catch(() => ({
					events: [],
					hasMore: false
				}));
				for (let index = tail.events.length - 1; index >= 0; index -= 1) {
					const event = tail.events[index]?.event;
					if (event?.type === "request/header") {
						const config = event.data.header.config;
						model = `${config.provider}/${config.model}`;
						break;
					}
				}
				return {
					...title !== void 0 ? { title } : {},
					...model !== void 0 ? { model } : {}
				};
			};
		}
		/** The artifact vocabulary follows the active UI locale at render time. */
		function labelsOf(translate) {
			return () => ({
				user: translate("role.user"),
				assistant: translate("role.assistant"),
				tool: translate("role.tool"),
				sharedFrom: translate("artifact.sharedFrom")
			});
		}
		/** Run a `/share` command intent produced by the host command handler. */
		function runShareIntent(controller, sessionId, resultText) {
			const [verb, flag, count] = resultText.split(":");
			if (verb !== "share") return;
			if (flag === "txt") {
				const lastN = count === void 0 || count === "" ? void 0 : Number(count);
				controller.saveTxt(sessionId, Number.isFinite(lastN) ? lastN : void 0);
			} else controller.open(sessionId);
		}
		/**
		* Provide the share controller and mount its dialog into the Session Header.
		* @param ctx - browser context carrying slots, locale, and connection services.
		*/
		function apply(ctx) {
			const connection = ctx.get("connection");
			const readHistory = historyReader(connection);
			const controller = new ChatShareController(readHistory, void 0, void 0, attachmentReader(connection), metaReader(connection, readHistory), labelsOf(ctx.locale.bind(NS)));
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
				if (commandName === "share" && result.kind === "success") runShareIntent(controller, sessionId, result.text ?? "share");
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
					setRedact: (sessionId, redact) => {
						controller.setRedact(sessionId, redact);
					},
					setIncludeTools: (sessionId, includeTools) => {
						controller.setIncludeTools(sessionId, includeTools);
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