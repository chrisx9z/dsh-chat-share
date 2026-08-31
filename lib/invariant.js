//#region lib/types/invariant.js
/** Package invariant companion for `@deepseek-ai/dsh-session-chat-share`. */
const PACKAGE_NAME = "@deepseek-ai/dsh-session-chat-share";
const name = "session-chat-share-invariant";
const inject = ["invariants"];
/** No runtime invariant: the command registry owns lifecycle pairing and the browser half owns range rendering. */
const install = () => {};
/**
* Register this package's invariant companion.
* @param ctx - Host context carrying the invariant registry.
* @returns the registration disposer after setup succeeds.
*/
const apply = (ctx) => Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install));
//#endregion
export { apply, inject, name };
