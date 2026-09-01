# dsh-chat-share

[English](README.md) | 中文

将选中的聊天片段分享为 Markdown、HTML 或纯文本——面向 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的社区插件（已标记 [`dsh-plugin`](https://github.com/topics/dsh-plugin)，并收录于 [awesome-dsh-plugin](https://awesome-dsh-plugin.com) 市场目录）。

本仓库是该插件的**独立分发版**：host 与 browser 两个半区均以预构建产物（`lib/`）随包发布，可通过 `dsh plugin add` 或插件市场安装。参考实现位于 harness 仓库的 `packages/session-query/session-chat-share`（上游 fork 的 `feat/session-chat-share` 分支），两个半区在那里构建并通过测试。

## 功能

- 注册 Web `/share` 斜杠命令：在会话中输入 `/share` 记录命令生命周期，并打开聊天片段分享对话框。
- **浏览器半区**在 Session Header 添加 **Share** 按钮，并在每个会话的侧边栏 `...` 菜单中添加 **Share** 与 **保存 TXT** 两项（通过 ui-workspace 提供的 `sessionRowMenu` 注册表）。对话框按最新在前列出会话中可分享的消息（追加来源的 `user/message` 与 `assistant/message` 文本），可通过 From/To 下拉框或点击消息行选择闭区间范围，选择 Markdown、HTML 或 TXT，预览渲染结果，然后复制到剪贴板或下载为文件（`.md` / `.html` / `.txt`）。**保存 TXT** 不打开对话框，直接将整个聊天下载为一个 `.txt` 文件。不会上传任何内容：接收方直接打开产物即可。
- 历史记录通过现有的 `session.history` RPC 读取——不新增 Host 端点、不改动持久化，也不涉及模型。命令停留在人工命令平面，Token 影响为零。

## 安装

在 harness checkout（或任何装有 `dsh` CLI 的机器）中安装到 profile：

```sh
dsh plugin --profile demo add github:chrisx9z/dsh-chat-share
```

包内已带**预构建产物**（`lib/`——host 与 browser 两个半区），git 安装无需构建权限，也不需要 `prepare` 脚本。发布版本以 `v1.x.y` 标记；如需可复现安装，可固定 tag 或 commit：

```sh
dsh plugin --profile demo add github:chrisx9z/dsh-chat-share#v1.1.1
```

然后在该 profile 的任意会话中使用：

```
/share
```

### 插件市场

插件已收录于 [awesome-dsh-plugin](https://awesome-dsh-plugin.com) 目录（通过 PR 提交），因此会出现在 **设置 → 插件市场** 中——可浏览、一键安装，目录刷新后即可获得更新（通常目录 PR 合并后一天内生效）。

## 浏览器半区要求

安装后的浏览器半区会被 host 的 `dsh.client` 扫描识别，因此在包含该插件的组合中，Header 按钮、对话框和侧边栏菜单项均可使用。侧边栏 `...` 菜单需要 ui-workspace 的 `sessionRowMenu` 服务——该服务存在于 2026-08-18 之后的 dsh web 构建（以及 harness 源码 checkout）中。在较旧的发布版本上，只有 `/share` 命令可用，直到 host 升级。

若走官方分发路径（harness 仓库自身的 web bundle），请将包集成为 `packages/session-query/session-chat-share`，并在 `packages/bundle/web-app/cordis.patch.yml` 中组合 `chat-share` 行。

## 工作原理

- Host 半区（`src/index.ts`）：在人工命令平面注册 `/share`。不接受参数；范围选择由对话框负责。
- 浏览器半区（`src/client/`）：控制器从日志尾部翻页读取 `session.history`（最多 300 条可分享消息），维护按会话的对话框状态，用纯渲染器（`render.ts`）将范围渲染为 Markdown（角色标题下原样保留文本）、自包含 HTML 页面（段落与围栏代码块）或纯文本（TXT），然后复制/下载产物。
- 不变式伴生模块（`src/invariant.ts`）按 harness 约定注册包的空操作运行时不变式。

## 开发与测试

41 个包测试（命令、控制器、渲染器、对话框、Header 操作、菜单操作、不变式以及真实 Loader 组合）在 deepseek-harness checkout 中运行，`@deepseek-ai/*` 工作区依赖在那里可解析：

```sh
pnpm exec vitest run packages/session-query/session-chat-share
```

## 限制

- 对话框从日志尾部最多读取 300 条可分享消息；更早的消息不在单次片段范围内。
- 分享是复制/下载产物，而非托管链接：不会上传任何内容到服务器。
- HTML 输出刻意保持基础（段落和围栏代码块）；强调、链接等行内 Markdown 在 HTML 产物中保留为字面文本，而 Markdown 产物则原样保留。
- 图片以 `[image]` 标记表示；工具调用、工具结果、边界标记和压缩替换副本均被排除。

## 许可证

MIT
