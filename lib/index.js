//#region lib/types/index.js
/** Web Chat-segment share command over the browser dialog owned by the client half. */
const name = "session-chat-share";
const inject = ["commands"];
const REQUESTED = {
	kind: "success",
	text: "Chat segment share dialog requested."
};
/**
* Register the Web-only `/share` command that the browser share dialog observes.
* @param ctx - Host context carrying the human-command registry.
*/
function apply(ctx) {
	ctx.effect(() => ctx.commands.register({
		name: "share",
		description: "Share a segment of this chat as Markdown or HTML",
		handler: (invocation) => Promise.resolve(invocation.rawInput.trim() === "" ? REQUESTED : {
			kind: "error",
			text: "The Web /share command opens the share dialog and does not accept arguments."
		})
	}), "session-chat-share: command");
}
//#endregion
export { apply, inject, name };
