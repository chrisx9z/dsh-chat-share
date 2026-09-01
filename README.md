# dsh-chat-share

Share a selected range of chat messages as Markdown or HTML — a community plugin for
[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (tagged
[`dsh-plugin`](https://github.com/topics/dsh-plugin)).

This repository is the **standalone distribution** of the plugin. The reference implementation
lives in the harness repository as `packages/session-query/session-chat-share` (branch
`feat/session-chat-share` on the upstream fork), where both halves are built and tested.

## What it does

- Registers the Web `/share` slash command: typing `/share` in a session records the command
  lifecycle and (in a Web bundle that composes the browser half) opens the chat-segment share
  dialog.
- The **browser half** adds a **Share** action to the Session Header and a **Share** row to each
  session's sidebar `...` menu (through the `sessionRowMenu` registry provided by ui-workspace).
  Both open a range-selection dialog that lists the session's shareable messages (append-origin
  `user/message` and `assistant/message` text), lets you pick an inclusive range via From/To
  selects or by clicking message rows, choose Markdown, HTML, or TXT, preview the rendered
  artifact, then copy it to the clipboard or download it as a file (`.md` / `.html` / `.txt`).
  Nothing is uploaded: the recipient opens the artifact directly.
- History is read through the ordinary `session.history` RPC — no Host endpoint, no persistence
  changes, and no model involvement. The command stays on the human-command plane with zero token
  effect.

## Install

From a harness checkout (or any machine with the `dsh` CLI), install into a profile:

```sh
dsh plugin --profile demo add github:chrisx9z/dsh-chat-share
```

The package ships **prebuilt artifacts** (`lib/`), so a git install needs no build permission and
no `prepare` script runs. Releases are tagged `v1.x.y`; pin a tag or commit for reproducible
installs:

```sh
dsh plugin --profile demo add github:chrisx9z/dsh-chat-share#v1.0.0
```

Then use it in any session of that profile:

```
/share
```

## Browser-half integration (the Share button and dialog)

The browser half is compiled into the Web bundle at build time (the harness's `dsh.client` scan
covers packages inside the repository tree, not externally installed packages). To enable the full
UI, integrate the package into a harness checkout:

1. Copy this package under `packages/session-query/session-chat-share/`.
2. Compose the row in `packages/bundle/web-app/cordis.patch.yml`:

   ```yaml
   - id: chat-share
     name: '@deepseek-ai/dsh-session-chat-share'
   ```

3. Rebuild the Web artifacts and restart `dsh web`.

The browser half then mounts the `Share` capsule into `conversation.session.header.utilities` next
to the Session-log export action, registers a **Share** row in the sidebar session `...` menu
through ui-workspace's `sessionRowMenu` registry, and `/share` opens the same dialog.

## How it works

- Host half (`src/index.ts`): registers `/share` on the human-command plane. No arguments are
  accepted; the dialog owns range selection.
- Browser half (`src/client/`): a controller pages `session.history` from the tail (up to 300
  shareable messages), keeps per-session dialog state, renders the range with pure renderers
  (`render.ts`) into Markdown (verbatim text under role headers) or a self-contained HTML page
  (paragraphs + fenced code blocks), and copies/downloads the artifact.
- The invariant companion (`src/invariant.ts`) registers the package's no-op runtime invariant,
  matching the harness convention.

## Development and tests

The 32 package tests (command, controller, renderers, dialog, header action, invariant, and a real
Loader composition) run inside a deepseek-harness checkout where the `@deepseek-ai/*` workspace
dependencies resolve:

```sh
pnpm exec vitest run packages/session-query/session-chat-share
```

## Limitations

- The dialog reads up to 300 shareable messages from the log tail; older messages are out of scope
  for one snippet.
- Sharing is a copy/download artifact, not a hosted link: nothing is uploaded to a server.
- HTML output is deliberately basic (paragraphs and fenced code blocks); inline markdown such as
  emphasis and links stays as literal text in the HTML artifact, while the Markdown artifact keeps
  it verbatim.
- Images are represented by an `[image]` marker; tool calls, tool results, boundary markers, and
  compaction-replaced copies are excluded.

## License

MIT
