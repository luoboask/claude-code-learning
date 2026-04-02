# Claude Code CLI 架构全景图

> 📊 项目规模：**1884 个 TypeScript 文件** | 技术栈：TypeScript + Bun + React + Ink

---

## 🏗️ 整体架构分层

```
┌─────────────────────────────────────────────────────────────────┐
│                      用户交互层 (User Layer)                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │  CLI Commands │  │  Slash Cmds  │  │  Keyboard Shortcuts   │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│                      表现层 (Presentation Layer)                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  Ink (React for Terminal) - 146 组件 / 50 核心模块           ││
│  │  App.tsx, Console, Dialogs, Progress, ContextViz...         ││
│  └─────────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────────┤
│                      状态管理层 (State Layer)                    │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  AppState.tsx / AppStateStore.ts - 统一状态管理             ││
│  │  87 Hooks - 业务逻辑封装                                     ││
│  └─────────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────────┤
│                      核心引擎层 (Core Engine)                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │  main.tsx   │  │  query.ts   │  │  QueryEngine.ts         │  │
│  │  (入口)     │  │  (编排)     │  │  (模型循环 + 工具调度)    │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│                      工具层 (Tool Layer)                         │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  Tool.ts (抽象) + tools/ (45 个具体工具实现)                 ││
│  │  Bash, File, Web, MCP, LSP, Agent, Skill, Task...          ││
│  └─────────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────────┤
│                      服务层 (Service Layer)                      │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  38 服务模块：MCP, LSP, OAuth, Analytics, Remote, Voice...  ││
│  └─────────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────────┤
│                      扩展层 (Extension Layer)                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │  Skills     │  │  Plugins    │  │  Bridge (IDE)           │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│                      基础设施层 (Infrastructure)                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │  Utils      │  │  Types      │  │  Constants / Schemas    │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📁 目录结构与模块清单

### 1️⃣ 核心入口与引擎 (Core)

| 文件 | 大小 | 职责 |
|------|------|------|
| `main.tsx` | 804KB | CLI 主入口，初始化，事件循环 |
| `query.ts` | 69KB | 用户查询编排，回合管理 |
| `QueryEngine.ts` | 47KB | **核心引擎**：模型调用→工具循环→结果回灌 |
| `Tool.ts` | 30KB | 工具抽象基类，类型定义 |
| `tools.ts` | 17KB | 工具注册总表 |
| `commands.ts` | 25KB | 命令注册总表 |
| `context.ts` | 6KB | 上下文收集与注入 |
| `history.ts` | 14KB | 会话历史管理 |
| `cost-tracker.ts` | 11KB | Token 成本统计 |

**拆解顺序建议**: `main.tsx` → `query.ts` → `QueryEngine.ts` → `Tool.ts`

---

### 2️⃣ 工具系统 (Tools) - 45 个工具

```
tools/
├── AgentTool/          (17 文件) - 子代理调用
├── BashTool/           (20 文件) - Shell 执行
├── PowerShellTool/     (16 文件) - PowerShell 执行
├── FileReadTool/       (7 文件)  - 文件读取
├── FileWriteTool/      (5 文件)  - 文件写入
├── FileEditTool/       (8 文件)  - 文件编辑 (diff/patch)
├── GlobTool/           (5 文件)  - 文件匹配
├── GrepTool/           (5 文件)  - 代码搜索
├── LSPTool/            (8 文件)  - 语言服务器协议
├── MCPTool/            (6 文件)  - MCP 工具调用
├── WebFetchTool/       (7 文件)  - 网页抓取
├── WebSearchTool/      (5 文件)  - 网络搜索
├── SkillTool/          (7 文件)  - 技能调用
├── TaskCreateTool/     (5 文件)  - 任务创建
├── TaskUpdateTool/     (5 文件)  - 任务更新
├── TaskListTool/       (5 文件)  - 任务列表
├── TaskStopTool/       (5 文件)  - 任务停止
├── TodoWriteTool/      (5 文件)  - Todo 管理
├── ConfigTool/         (7 文件)  - 配置管理
├── AskUserQuestionTool/(4 文件)  - 用户问答
├── SendMessageTool/    (6 文件)  - 消息发送
├── RemoteTriggerTool/  (5 文件)  - 远程触发
├── ScheduleCronTool/   (7 文件)  - 定时任务
├── TeamCreateTool/     (6 文件)  - 团队创建
├── TeamDeleteTool/     (6 文件)  - 团队删除
├── NotebookEditTool/   (6 文件)  - Notebook 编辑
├── REPLTool/           (4 文件)  - REPL 执行
├── McpAuthTool/        (3 文件)  - MCP 认证
├── ListMcpResourcesTool/(5 文件) - MCP 资源列表
├── ReadMcpResourceTool/(5 文件)  - MCP 资源读取
├── BriefTool/          (7 文件)  - 简报工具
├── EnterPlanModeTool/  (6 文件)  - 进入计划模式
├── ExitPlanModeTool/   (6 文件)  - 退出计划模式
├── EnterWorktreeTool/  (6 文件)  - 进入工作树
├── ExitWorktreeTool/   (6 文件)  - 退出工作树
├── TaskGetTool/        (5 文件)  - 任务获取
├── TaskOutputTool/     (4 文件)  - 任务输出
├── ToolSearchTool/     (5 文件)  - 工具搜索
├── SleepTool/          (3 文件)  - 休眠
├── SyntheticOutputTool/(3 文件)  - 合成输出
└── shared/             - 共享工具逻辑
```

**拆解顺序建议**: 
1. `Tool.ts` (抽象基类)
2. `BashTool/` (最复杂的工具)
3. `FileReadTool/` + `FileWriteTool/` + `FileEditTool/` (文件操作 trio)
4. `AgentTool/` (子代理)
5. `MCPTool/` + `LSPTool/` (外部集成)

---

### 3️⃣ 命令系统 (Commands) - 103 个命令

```
commands/
├── config/             - 配置命令 (/config)
├── compact/            - 上下文压缩 (/compact)
├── context/            - 上下文管理 (/context)
├── doctor/             - 诊断命令 (/doctor)
├── diff/               - 差异查看 (/diff)
├── export/             - 导出会话 (/export)
├── feedback/           - 反馈 (/feedback)
├── files/              - 文件操作 (/files)
├── help/               - 帮助 (/help)
├── init/               - 初始化 (/init)
├── login/              - 登录 (/login)
├── logout/             - 登出 (/logout)
├── mcp/                - MCP 管理 (/mcp)
├── memory/             - 记忆系统 (/memory)
├── plan/               - 计划模式 (/plan)
├── plugins/            - 插件管理 (/plugins)
├── review/             - 代码审查 (/review)
├── skills/             - 技能管理 (/skills)
├── tasks/              - 任务管理 (/tasks)
├── team/               - 团队管理 (/team)
├── todo/               - Todo 管理 (/todo)
├── vim/                - Vim 模式 (/vim)
├── voice/              - 语音控制 (/voice)
├── worktree/           - 工作树 (/worktree)
├── agents/             - 代理管理 (/agents)
├── bridge/             - IDE 桥接 (/bridge)
├── chrome/             - Chrome 集成 (/chrome)
├── desktop/            - 桌面应用 (/desktop)
├── extra-usage/        - 额外用量 (/extra-usage)
├── fast/               - 快速模式 (/fast)
├── color/              - 主题颜色 (/color)
├── effort/             - 工作量评估 (/effort)
├── env/                - 环境变量 (/env)
├── exit/               - 退出 (/exit)
├── copy/               - 复制 (/copy)
├── commit/             - Git 提交 (/commit)
├── branch/             - 分支管理 (/branch)
├── clear/              - 清屏 (/clear)
├── cost/               - 成本查看 (/cost)
├── debug-tool-call/    - 调试工具调用
├── ant-trace/          - 追踪
├── autofix-pr/         - 自动修复 PR
├── bughunter/          - Bug 猎手
├── ctx_viz/            - 上下文可视化
├── advisor/            - 顾问模式
└── ... (更多专业命令)
```

**核心命令文件**:
- `commands.ts` - 命令注册总表
- `brief.ts` - 简报命令
- `commit.ts` - Git 提交
- `commit-push-pr.ts` - 提交 + 推送 + PR

---

### 4️⃣ 组件系统 (Components) - 146 个 Ink 组件

```
components/
├── App.tsx                      - 主应用组件
├── BaseTextInput.tsx            - 基础文本输入 (80KB)
├── ConsoleOAuthFlow.tsx         - OAuth 流程 (80KB)
├── ContextVisualization.tsx     - 上下文可视化 (76KB)
├── AutoUpdater.tsx              - 自动更新 (31KB)
├── BridgeDialog.tsx             - IDE 桥接对话框 (36KB)
├── CoordinatorAgentStatus.tsx   - 多代理状态 (36KB)
├── EffortCallout.tsx            - 工作量提示 (25KB)
├── FallbackToolUseErrorMessage.tsx - 错误消息
├── CompactSummary.tsx           - 压缩摘要
├── DiagnosticsDisplay.tsx       - 诊断显示
├── ExportDialog.tsx             - 导出对话框
├── AutoModeOptInDialog.tsx      - 自动模式对话框
├── BypassPermissionsModeDialog.tsx - 权限绕过对话框
├── CostThresholdDialog.tsx      - 成本阈值对话框
├── ConfigurableShortcutHint.tsx - 快捷键提示
├── ClaudeCodeHint/              - Claude 提示
├── CustomSelect/                - 自定义选择器
├── DesktopUpsell/               - 桌面应用推广
├── AgentProgressLine.tsx        - 代理进度
├── BashModeProgress.tsx         - Bash 模式进度
├── ContextSuggestions.tsx       - 上下文建议
├── ExitFlow.tsx                 - 退出流程
├── FastIcon.tsx                 - 快速模式图标
├── ... (120+ 更多组件)
```

**拆解顺序建议**:
1. `App.tsx` - 主组件树
2. `BaseTextInput.tsx` - 输入处理
3. `ConsoleOAuthFlow.tsx` - 认证流程
4. `ContextVisualization.tsx` - 上下文可视化

---

### 5️⃣ Hooks 系统 - 87 个 React Hooks

```
hooks/
├── toolPermission/              - 工具权限钩子
├── notifs/                      - 通知系统
├── useCanUseTool.tsx            - 工具可用性检查 (40KB)
├── useArrowKeyHistory.tsx       - 箭头键历史 (40KB)
├── useClaudeCodeHintRecommendation.tsx - 提示推荐 (15KB)
├── useCommandKeybindings.tsx    - 命令快捷键 (11KB)
├── useDiffInIDE.tsx             - IDE 差异 (10KB)
├── useCancelRequest.ts          - 取消请求 (10KB)
├── useBackgroundTaskNavigation.ts - 后台任务导航
├── useAssistantHistory.ts       - 助手历史
├── useAwaySummary.ts            - 离开摘要
├── useChromeExtensionNotification.tsx - Chrome 扩展通知
├── useClipboardImageHint.ts     - 剪贴板图片提示
├── useCommandQueue.ts           - 命令队列
├── useCopyOnSelect.ts           - 选择复制
├── useDirectConnect.ts          - 直接连接
├── useDynamicConfig.ts          - 动态配置
├── useElapsedTime.ts            - 经过时间
├── useApiKeyVerification.ts     - API 密钥验证
├── useBlink.ts                  - 闪烁效果
├── useDoublePress.ts            - 双击检测
├── useDeferredHookMessages.ts   - 延迟消息
├── useDiffData.ts               - 差异数据
├── fileSuggestions.ts           - 文件建议 (27KB)
├── unifiedSuggestions.ts        - 统一建议 (6KB)
├── renderPlaceholder.ts         - 占位符渲染
├── useAfterFirstRender.ts       - 首次渲染后
└── ... (60+ 更多 Hooks)
```

**核心 Hook**: `useCanUseTool.tsx` - 工具权限与可用性判断

---

### 6️⃣ 服务层 (Services) - 38 个服务模块

```
services/
├── mcp/                         (25 文件) - MCP 协议集成
├── lsp/                         (7 文件)  - 语言服务器协议
├── api/                         (22 文件) - API 客户端
├── analytics/                   (11 文件) - 分析追踪
├── oauth/                       (7 文件)  - OAuth 认证
├── compact/                     (13 文件) - 上下文压缩
├── autoDream/                   (6 文件)  - 自动梦境
├── plugins/                     (5 文件)  - 插件服务
├── tools/                       (6 文件)  - 工具服务
├── remoteManagedSettings/       (7 文件) - 远程设置
├── teamMemorySync/              (7 文件) - 团队记忆同步
├── settingsSync/                (4 文件) - 设置同步
├── policyLimits/                (4 文件) - 策略限制
├── toolUseSummary/              (3 文件) - 工具使用摘要
├── tips/                        (5 文件)  - 提示服务
├── extractMemories/             (4 文件) - 记忆提取
├── SessionMemory/               (5 文件) - 会话记忆
├── PromptSuggestion/            (4 文件) - 提示建议
├── MagicDocs/                   (4 文件)  - 魔法文档
├── AgentSummary/                (3 文件)  - 代理摘要
├── claudeAiLimits.ts            - Claude AI 限制 (17KB)
├── vcr.ts                       - VCR 录制 (12KB)
├── voice.ts                     - 语音服务 (17KB)
├── voiceStreamSTT.ts            - 语音流 STT (21KB)
├── tokenEstimation.ts           - Token 估算 (17KB)
├── rateLimitMessages.ts         - 速率限制消息 (11KB)
├── mockRateLimits.ts            - 速率限制模拟 (30KB)
├── diagnosticTracking.ts        - 诊断追踪 (12KB)
├── notifier.ts                  - 通知服务 (4KB)
├── preventSleep.ts              - 防止休眠 (5KB)
├── internalLogging.ts           - 内部日志 (3KB)
├── awaySummary.ts               - 离开摘要 (3KB)
├── mcpServerApproval.tsx        - MCP 服务器审批 (6KB)
├── rateLimitMocking.ts          - 速率限制模拟 (4KB)
└── voiceKeyterms.ts             - 语音关键词 (3KB)
```

**核心服务**: `mcp/`, `lsp/`, `api/`, `oauth/`

---

### 7️⃣ 扩展系统 (Extensions)

#### Skills (6 文件)
```
skills/
├── loadSkillsDir.ts             (34KB) - 技能加载核心
├── bundledSkills.ts             (7KB)  - 内置技能
├── mcpSkillBuilders.ts          (2KB)  - MCP 技能构建
└── bundled/                     (19 技能) - 内置技能目录
```

#### Plugins (5 文件)
```
plugins/
├── discoverPlugins.ts           - 插件发现
├── installPlugin.ts             - 插件安装
├── loadPlugin.ts                - 插件加载
├── PluginManager.ts             - 插件管理器
└── types.ts                     - 插件类型
```

#### Bridge (IDE 桥接) - 33 文件
```
bridge/
├── protocol/                    - 桥接协议
├── handlers/                    - 请求处理
├── clients/                     - 客户端实现
└── types.ts                     - 类型定义
```

---

### 8️⃣ 状态管理 (State)

```
state/
├── AppState.tsx                 (23KB) - 状态组件
├── AppStateStore.ts             (22KB) - 状态存储
├── onChangeAppState.ts          (6KB)  - 状态变更
├── selectors.ts                 (2KB)  - 状态选择器
├── store.ts                     (836B) - 存储核心
├── teammateViewHelpers.ts       (4KB)  - 队友视图助手
```

---

### 9️⃣ 基础设施 (Infrastructure)

#### Utils - 331 文件 (10KB 目录)
```
utils/
├── fs/                          - 文件系统工具
├── git/                         - Git 工具
├── http/                        - HTTP 工具
├── path/                        - 路径工具
├── string/                      - 字符串工具
├── array/                       - 数组工具
├── object/                      - 对象工具
├── date/                        - 日期工具
├── encoding/                    - 编码工具
├── crypto/                      - 加密工具
└── ... (更多工具函数)
```

#### Types - 10 文件
```
types/
├── index.ts                     - 类型导出
├── tool.ts                      - 工具类型
├── command.ts                   - 命令类型
├── state.ts                     - 状态类型
├── hook.ts                      - Hook 类型
├── component.ts                 - 组件类型
├── service.ts                   - 服务类型
├── bridge.ts                    - 桥接类型
├── skill.ts                     - 技能类型
└── plugin.ts                    - 插件类型
```

#### Constants - 23 文件
```
constants/
├── toolNames.ts                 - 工具名称常量
├── commandNames.ts              - 命令名称常量
├── colors.ts                    - 颜色常量
├── keybindings.ts               - 快捷键常量
├── limits.ts                    - 限制常量
└── ... (更多常量)
```

#### Schemas - 3 文件
```
schemas/
├── zod schemas                  - Zod 验证模式
```

---

### 🔟 其他核心模块

#### Ink (终端渲染引擎) - 50 文件
```
ink/
├── render-to-screen.ts          - 屏幕渲染
├── render-node-to-output.ts     - 节点渲染
├── render-border.ts             - 边框渲染
├── layout/engine.ts             - 布局引擎
├── layout/yoga.ts               - Yoga 布局
├── layout/node.ts               - 布局节点
├── layout/geometry.ts           - 几何计算
├── optimizer.ts                 - 渲染优化
├── selection.ts                 - 选择处理
├── searchHighlight.ts           - 搜索高亮
├── colorize.ts                  - 语法高亮
├── parse-keypress.ts            - 按键解析
├── dom.ts                       - DOM 模拟
├── root.ts                      - 根组件
├── styles.ts                    - 样式系统
├── squash-text-nodes.ts         - 文本压缩
├── wrapAnsi.ts                  - ANSI 换行
├── output.ts                    - 输出处理
├── focus.ts                     - 焦点管理
├── frame.ts                     - 帧管理
└── ... (30+ 更多)
```

#### Context (上下文系统) - 11 文件
```
context/
├── collectors/                  - 上下文收集器
├── injectors/                   - 上下文注入器
├── managers/                    - 上下文管理器
└── types.ts                     - 上下文类型
```

#### Tasks (任务系统) - 11 文件
```
tasks/
├── TaskManager.ts               - 任务管理器
├── TaskRunner.ts                - 任务执行器
├── TaskQueue.ts                 - 任务队列
└── types.ts                     - 任务类型
```

#### Remote (远程会话) - 6 文件
```
remote/
├── RemoteSession.ts             - 远程会话
├── RemoteBridge.ts              - 远程桥接
└── types.ts                     - 远程类型
```

#### Coordinator (多代理协调) - 3 文件
```
coordinator/
├── Coordinator.ts               - 协调器
├── AgentPool.ts                 - 代理池
└── types.ts                     - 协调类型
```

#### Memdir (持久记忆) - 10 文件
```
memdir/
├── MemoryDirectory.ts           - 记忆目录
├── MemoryStore.ts               - 记忆存储
└── types.ts                     - 记忆类型
```

#### Server (服务端模式) - 5 文件
```
server/
├── Server.ts                    - 服务器
├── Routes.ts                    - 路由
└── types.ts                     - 服务器类型
```

#### Vim (Vim 模式) - 7 文件
```
vim/
├── motions.ts                   - 移动命令
├── operators.ts                 - 操作符
├── transitions.ts               - 转换
├── textObjects.ts               - 文本对象
├── types.ts                     - Vim 类型
```

#### Voice (语音控制) - 3 文件
```
voice/
├── VoiceController.ts           - 语音控制器
├── STTEngine.ts                 - 语音识别引擎
└── types.ts                     - 语音类型
```

#### Keybindings (快捷键) - 16 文件
```
keybindings/
├── global.ts                    - 全局快捷键
├── context.ts                   - 上下文快捷键
├── vim.ts                       - Vim 快捷键
└── ... (更多)
```

#### Migrations (配置迁移) - 13 文件
```
migrations/
├── config/                      - 配置迁移
├── schema/                      - Schema 迁移
└── ... (更多)
```

#### Entry Points (入口点) - 8 文件
```
entrypoints/
├── cli.ts                       - CLI 入口
├── server.ts                    - 服务器入口
├── bridge.ts                    - 桥接入入口
└── ... (更多)
```

#### Assistant (助手) - 3 文件
```
assistant/
├── sessionHistory.ts            - 会话历史
├── ... (更多)
```

#### Bootstrap (引导) - 3 文件
```
bootstrap/
├── bootstrap.ts                 - 引导程序
└── ... (更多)
```

#### Output Styles (输出样式) - 4 文件
```
outputStyles/
├── styles.ts                    - 输出样式
└── ... (更多)
```

#### Native-ts (原生 TypeScript) - 5 文件
```
native-ts/
├── native.ts                    - 原生模块
└── ... (更多)
```

#### Upstream Proxy (上游代理) - 4 文件
```
upstreamproxy/
├── upstreamproxy.ts             - 上游代理
├── relay.ts                     - 中继
└── ... (更多)
```

#### Buddy (伙伴系统) - 8 文件
```
buddy/
├── BuddyManager.ts              - 伙伴管理器
└── ... (更多)
```

#### CLI (CLI 工具) - 10 文件
```
cli/
├── cli.ts                       - CLI 核心
└── ... (更多)
```

#### MoreRight (更多权限) - 3 文件
```
moreright/
├── permissions.ts               - 权限扩展
└── ... (更多)
```

#### Screens (全屏界面) - 5 文件
```
screens/
├── ScreenManager.ts             - 屏幕管理器
└── ... (更多)
```

---

## 🔀 数据流与调用链

### 主循环流程
```
用户输入
    ↓
main.tsx (事件捕获)
    ↓
query.ts (查询编排)
    ↓
QueryEngine.ts (模型调用)
    ↓
[模型返回工具调用]
    ↓
Tool.ts (工具分发)
    ↓
具体工具执行 (BashTool/FileTool/...)
    ↓
[权限检查 useCanUseTool]
    ↓
[用户确认 (如需)]
    ↓
工具执行结果
    ↓
QueryEngine.ts (结果回灌)
    ↓
模型继续处理
    ↓
[循环直到完成]
    ↓
Ink 组件渲染输出
```

### 工具调用流程
```
QueryEngine.ts
    ↓
tools.ts (查找工具)
    ↓
Tool.ts (基类方法)
    ↓
具体工具 (如 BashTool.ts)
    ↓
hooks/toolPermission/ (权限检查)
    ↓
components/ (UI 确认对话框)
    ↓
执行工具逻辑
    ↓
返回结果给 QueryEngine
```

### 状态更新流程
```
工具执行/用户操作
    ↓
AppStateStore.ts (状态变更)
    ↓
onChangeAppState.ts (变更处理)
    ↓
selectors.ts (状态选择)
    ↓
Ink 组件重新渲染
```

---

## 📋 拆解检查清单

### Phase 1: 核心引擎 (优先级 ⭐⭐⭐)
- [ ] `main.tsx` - CLI 入口与初始化
- [ ] `query.ts` - 查询编排逻辑
- [ ] `QueryEngine.ts` - 模型循环核心
- [ ] `Tool.ts` - 工具抽象基类
- [ ] `tools.ts` - 工具注册表

### Phase 2: 基础工具 (优先级 ⭐⭐⭐)
- [ ] `BashTool/` - Shell 执行 (最复杂)
- [ ] `FileReadTool/` - 文件读取
- [ ] `FileWriteTool/` - 文件写入
- [ ] `FileEditTool/` - 文件编辑
- [ ] `GlobTool/` + `GrepTool/` - 文件搜索

### Phase 3: 状态与 UI (优先级 ⭐⭐)
- [ ] `state/AppState.tsx` - 状态组件
- [ ] `state/AppStateStore.ts` - 状态存储
- [ ] `components/App.tsx` - 主应用
- [ ] `components/BaseTextInput.tsx` - 输入处理
- [ ] `hooks/useCanUseTool.tsx` - 工具权限

### Phase 4: 扩展系统 (优先级 ⭐⭐)
- [ ] `skills/loadSkillsDir.ts` - 技能加载
- [ ] `plugins/` - 插件系统
- [ ] `services/mcp/` - MCP 集成
- [ ] `bridge/` - IDE 桥接
- [ ] `services/lsp/` - LSP 集成

### Phase 5: 高级功能 (优先级 ⭐)
- [ ] `coordinator/` - 多代理协调
- [ ] `remote/` - 远程会话
- [ ] `tasks/` - 任务系统
- [ ] `memdir/` - 持久记忆
- [ ] `voice/` - 语音控制

### Phase 6: 基础设施 (优先级 ⭐)
- [ ] `ink/` - 终端渲染引擎
- [ ] `utils/` - 工具函数库
- [ ] `types/` - 类型定义
- [ ] `constants/` - 常量定义
- [ ] `commands/` - 命令系统

---

## 🎯 学习建议

1. **先跑起来**: 先理解整体架构，再深入细节
2. **跟数据流**: 从 `main.tsx` 开始，跟踪一次完整的用户请求
3. **对比设计**: 思考每个模块为什么这样设计，有没有更好的方式
4. **动手实验**: 修改一些代码，看看会发生什么
5. **画架构图**: 边学边画，帮助理解模块关系

---

_生成时间：2026-04-02 | 基于 claudecode-cli-source 源码快照_
