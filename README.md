# dsh-chat-share

English | [中文](README.zh.md)

Share a selected range of chat messages as Markdown, HTML, or plain text — a community plugin for
[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (tagged
[`dsh-plugin`](https://github.com/topics/dsh-plugin) and listed in the
[awesome-dsh-plugin](https://awesome-dsh-plugin.com) market registry).

This repository is the **standalone distribution** of the plugin: it ships both halves prebuilt
(`lib/`), installable with `dsh plugin add` and from the Plugin Market. The reference
implementation lives in the harness repository as `packages/session-query/session-chat-share`
(branch `feat/session-chat-share` on the upstream fork), where both halves are built and tested.

## What it does

- Registers the Web `/share` slash command — plain `/share` opens the dialog, `/share txt` saves
  the whole chat as one `.txt`, `/share last <n>` saves only the newest `n` messages (combine:
  `/share txt last 10`).
- The **browser half** adds a **Share** action to the Session Header, a **Share** row, and a
  **Save TXT** row to each session's sidebar `...` menu (through the `sessionRowMenu` registry
  provided by ui-workspace). The dialog lists the session's shareable messages (append-origin
  `user/message` and `assistant/message` text), lets you pick an inclusive range via From/To
  selects or by clicking message rows, choose Markdown, HTML, or TXT, preview the rendered
  artifact (GFM), then copy it to the clipboard or download it as a file (`.md` / `.html` /
  `.txt`). Options: **redact sensitive info** (credential shapes and local absolute/home paths,
  on by default) and **include tool calls** (bounded tool-call rows, off by default).
  **Save TXT** downloads the whole chat as one `.txt` file directly, without opening the dialog.
  Nothing is uploaded: the recipient opens the artifact directly.
- The HTML artifact is a self-contained page with **GFM-lite** rendering (headings, lists,
  tables, blockquotes, links, fenced code, inline code/emphasis) and **session images embedded
  as data URIs**; artifact headers carry the Session title and last model route when known, and
  follow the active UI locale.
- Optional host-side **auto-save**: with `autoSaveDir` configured on the plugin row, one TXT per
  Session is written after every completed turn.
- History is read through the ordinary `session.history` RPC and images through
  `session.attachment` — no Host endpoint, no persistence changes, and no model involvement. The
  command stays on the human-command plane with zero token effect.

## Install

**npm** (preferred — the Plugin Market prefers npm sources):

```sh
dsh plugin --profile demo add dsh-chat-share
```

**GitHub** (alternative; ships the same prebuilt artifacts):

```sh
dsh plugin --profile demo add github:chrisx9z/dsh-chat-share#v1.3.0
```

The package ships **prebuilt artifacts** (`lib/` — host and browser halves), so neither install
needs a build step. Releases are tagged `v1.x.y`; pin a tag or commit for reproducible installs.

Then use it in any session of that profile:

```
/share
```

### Plugin Market

The plugin is listed in the [awesome-dsh-plugin](https://awesome-dsh-plugin.com) registry (PR
submission), so it appears in **Settings → Plugin Market** — browse, one-click install, and
updates once the catalog refreshes (usually within a day of the registry PR merging). The npm
source above makes market installs resolve to the published package.

## Browser-half requirements

The installed package's browser half is picked up by the host's `dsh.client` scan, so the
Header button, dialog, and sidebar menu entries work on hosts whose composition includes it.
The sidebar `...` menu rows need ui-workspace's `sessionRowMenu` service — present in dsh web
builds after 2026-08-18 (and in source checkouts of the harness). On older releases only the
`/share` command is active until the host is updated.

For the official distribution path (the harness repository's own web bundle), integrate the
package as `packages/session-query/session-chat-share` and compose the `chat-share` row in
`packages/bundle/web-app/cordis.patch.yml`.

## How it works

- Host half (`src/index.ts`): registers `/share` on the human-command plane. No arguments are
  accepted; the dialog owns range selection.
- Browser half (`src/client/`): a controller pages `session.history` from the tail (up to 300
  shareable messages), keeps per-session dialog state, renders the range with pure renderers
  (`render.ts`) into Markdown (verbatim text under role headers), a self-contained HTML page
  (paragraphs + fenced code blocks), or plain text (TXT), and copies/downloads the artifact.
- The invariant companion (`src/invariant.ts`) registers the package's no-op runtime invariant,
  matching the harness convention.

## Development and tests

The 41 package tests (command, controller, renderers, dialog, header action, row-menu actions,
invariant, and a real Loader composition) run inside a deepseek-harness checkout where the
`@deepseek-ai/*` workspace dependencies resolve:

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
