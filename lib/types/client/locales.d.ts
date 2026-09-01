/** Locale namespace owned by the chat-segment share browser dialog. */
export declare const NS = "session-chat-share";
/** Simplified-Chinese chat-share strings. */
export declare const zh: {
    readonly 'header.label': "分享";
    readonly 'menu.share': "分享";
    readonly 'menu.saveTxt': "保存 TXT";
    readonly 'dialog.title': "分享聊天片段";
    readonly 'dialog.description': "选择消息范围，以 Markdown、HTML 或 TXT 复制或下载。";
    readonly 'dialog.loading': "正在加载消息…";
    readonly 'dialog.empty': "此会话没有可分享的消息。";
    readonly 'dialog.historyFailed': "无法加载消息。";
    readonly 'dialog.copyFailed': "复制失败。";
    readonly 'dialog.downloadFailed': "下载失败。";
    readonly 'dialog.rangeFrom': "从";
    readonly 'dialog.rangeTo': "到";
    readonly 'dialog.format': "格式";
    readonly 'dialog.format.markdown': "Markdown";
    readonly 'dialog.format.html': "HTML";
    readonly 'dialog.format.txt': "TXT";
    readonly 'dialog.format.png': "PNG";
    readonly 'dialog.capNotice': "仅显示最新 300 条消息；保存 TXT 与 /share txt 会导出完整对话。";
    readonly 'dialog.messages': "消息";
    readonly 'dialog.preview': "预览";
    readonly 'dialog.copy': "复制";
    readonly 'dialog.copied': "已复制";
    readonly 'dialog.download': "下载";
    readonly 'dialog.close': "关闭";
    readonly options: "选项";
    readonly 'options.redact': "脱敏敏感信息";
    readonly 'options.tools': "包含工具调用";
    readonly 'options.subagents': "包含子代理对话";
    readonly 'options.multiselect': "多选模式";
    readonly 'role.user': "用户";
    readonly 'role.assistant': "助手";
    readonly 'role.tool': "工具";
    readonly 'role.subagent': "子代理";
    readonly 'artifact.sharedFrom': "分享自 DeepSeek Harness";
};
/** English chat-share strings. */
export declare const en: Record<keyof typeof zh, string>;
/** Stable locale keys consumed by the shared modal. */
export type SessionChatShareKey = keyof typeof zh;
//# sourceMappingURL=locales.d.ts.map