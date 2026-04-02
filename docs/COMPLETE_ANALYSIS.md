# Claude Code CLI 完整架构与实现深度分析

> 📅 分析时间：2026-04-02 13:30  
> 📊 项目规模：1884 个 TypeScript 文件 | 512,664 行代码  
> 🏗️ 技术栈：TypeScript + Bun + React + Ink + Anthropic API  
> 📂 源码位置：`/tmp/claudecode-cli-source/`

---

## 📑 目录

1. [整体架构概览](#1-整体架构概览)
2. [核心模块深度解析](#2-核心模块深度解析)
3. [数据结构与类型系统](#3-数据结构与类型系统)
4. [调用关系与执行流程](#4-调用关系与执行流程)
5. [设计模式与工程实践](#5-设计模式与工程实践)
6. [安全与权限系统](#6-安全与权限系统)
7. [工具系统详解](#7-工具系统详解)
8. [状态管理与 UI 架构](#8-状态管理与 UI 架构)
9. [扩展系统：Skills/Plugins/MCP](#9-扩展系统)
10. [对 OpenClaw 的借鉴意义](#10-对-openclaw 的借鉴意义)

---

# 1. 整体架构概览

## 1.1 系统分层架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              用户交互层                                      │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐  │
│  │ CLI 命令行参数    │  │ 交互式对话输入   │  │ Slash Commands (/config...) │  │
│  └────────┬────────┘  └────────┬────────┘  └─────────────┬───────────────┘  │
└───────────┼────────────────────┼──────────────────────────┼─────────────────┘
            │                    │                          │
            └────────────────────┼──────────────────────────┘
                                 │
                                 ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                              表现层 (Presentation Layer)                     │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  Ink (React for Terminal) - 146 个组件 / 50 个核心渲染模块               ││
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────────┐   ││
│  │  │ App.tsx     │ │ REPL.tsx    │ │ PromptInput │ │ ToolResultViews │   ││
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────────┘   ││
│  └─────────────────────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────────────────────┤
│                              状态管理层 (State Layer)                        │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  AppStateStore.ts (22KB) - 统一状态管理                                  ││
│  │  store.ts (836B) - 发布订阅原语                                         ││
│  │  87 个 React Hooks - 业务逻辑封装                                        ││
│  └─────────────────────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────────────────────┤
│                              核心引擎层 (Core Engine)                        │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐  │
│  │ main.tsx        │  │ query.ts        │  │ QueryEngine.ts              │  │
│  │ (804KB 入口)    │  │ (69KB 编排)     │  │ (47KB 模型循环 + 工具调度)   │  │
│  └────────┬────────┘  └────────┬────────┘  └─────────────┬───────────────┘  │
│           │                    │                          │                  │
│           └────────────────────┼──────────────────────────┘                  │
│                                │                                             │
│                    ┌───────────┴───────────┐                                │
│                    │                       │                                 │
│           ┌────────▼────────┐     ┌────────▼────────┐                       │
│           │ Tool.ts (30KB)  │     │ tools.ts (17KB) │                       │
│           │ (工具抽象)      │     │ (工具注册表)    │                       │
│           └─────────────────┘     └─────────────────┘                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                              工具层 (Tool Layer)                             │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  45 个工具实现目录                                                       ││
│  │  BashTool(160KB) FileEdit FileRead FileWrite Glob Grep Agent MCP ...   ││
│  └─────────────────────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────────────────────┤
│                              服务层 (Service Layer)                          │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  38 个服务模块：mcp(25) lsp(7) api(22) oauth(7) analytics(11) ...      ││
│  └─────────────────────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────────────────────┤
│                              扩展层 (Extension Layer)                        │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐  │
│  │ skills/         │  │ plugins/        │  │ bridge/ (IDE 桥接)          │  │
│  │ (6 文件 + 19 技能)│  │ (5 文件)        │  │ (33 文件)                   │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────────────────┤
│                              基础设施层 (Infrastructure)                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────────────────┐  │
│  │ utils/      │  │ types/      │  │ constants/ schemas/ migrations/     │  │
│  │ (331 文件)   │  │ (10 文件)    │  │ (23+3+13 文件)                     │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 1.2 核心文件清单

| 文件 | 大小 | 行数 | 职责 |
|------|------|------|------|
| `src/main.tsx` | 804KB | ~18,000 | CLI 入口、初始化、渲染启动 |
| `src/query.ts` | 69KB | ~1,700 | 查询编排、API 调用、流式处理 |
| `src/QueryEngine.ts` | 47KB | ~1,300 | 会话引擎、消息提交、工具调度 |
| `src/Tool.ts` | 30KB | ~800 | 工具抽象接口、类型定义 |
| `src/tools.ts` | 17KB | ~400 | 工具注册表、条件加载 |
| `src/tools/BashTool/BashTool.tsx` | 160KB | ~3,500 | Shell 执行、安全检查、权限管理 |
| `src/state/AppStateStore.ts` | 22KB | ~500 | 统一状态定义 |
| `src/hooks/useCanUseTool.tsx` | 40KB | ~900 | 工具权限检查核心 |
| `src/services/tools/toolOrchestration.ts` | ~5KB | ~150 | 工具并发/串行执行编排 |

## 1.3 启动流程时序图

```
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│  Shell  │    │ main.tsx│    │  init() │    │ render  │    │   App   │
└────┬────┘    └────┬────┘    └────┬────┘    └────┬────┘    └────┬────┘
     │              │              │              │              │
     │ 1. 执行 CLI   │              │              │              │
     │─────────────>│              │              │              │
     │              │              │              │              │
     │              │ 2. 并行预取   │              │              │
     │              │ - MDM 配置    │              │              │
     │              │ - Keychain   │              │              │
     │              │ (~135ms)     │              │              │
     │              │              │              │              │
     │              │ 3. 模块导入   │              │              │
     │              │ (所有依赖)   │              │              │
     │              │              │              │              │
     │              │ 4. init()    │              │              │
     │              │ - Telemetry  │              │              │
     │              │ - GrowthBook │              │              │
     │              │ - 用户认证    │              │              │
     │              │─────────────>│              │              │
     │              │              │              │              │
     │              │ 5. 加载配置   │              │              │
     │              │ - Settings   │              │              │
     │              │ - Plugins    │              │              │
     │              │ - Skills     │              │              │
     │              │ - MCP        │              │              │
     │              │              │              │              │
     │              │ 6. renderAndRun()           │              │
     │              │────────────────────────────>│              │
     │              │              │              │              │
     │              │              │              │ 7. <App />   │
     │              │              │              │─────────────>│
     │              │              │              │              │
     │              │              │              │ 8. Ink 渲染   │
     │              │              │              │ (终端 UI)    │
     │              │              │              │              │
     │ 9. 就绪     │              │              │              │
     │<────────────│              │              │              │
     │              │              │              │              │
```

---

# 2. 核心模块深度解析

## 2.1 main.tsx (804KB) - CLI 入口点

### 2.1.1 核心职责

1. **启动引导优化**
   - MDM (Mobile Device Management) 配置预读
   - macOS Keychain 凭证预取
   - 特性标志编译时检查 (Bun `feature()`)

2. **命令行解析**
   - 使用 `@commander-js/extra-typings` 解析 CLI 参数
   - 支持 100+ 命令行选项
   - 参数验证与默认值处理

3. **初始化流程**
   - Telemetry 初始化 (Statsig)
   - GrowthBook 特性标志加载
   - 用户认证 (OAuth/API Key)
   - Settings 加载与迁移
   - Plugins/Skills 发现与加载
   - MCP 服务器连接

4. **会话管理**
   - 创建新会话 / 恢复历史会话
   - Teleport 远程会话支持
   - Session 持久化配置

5. **渲染启动**
   - Ink 渲染引擎初始化
   - React 组件树挂载
   - 事件循环启动

### 2.1.2 启动代码结构

```typescript
// ═══════════════════════════════════════════════════════════════
// 1. 启动前预取（并行执行，减少启动延迟）
// ═══════════════════════════════════════════════════════════════
profileCheckpoint('main_tsx_entry')
startMdmRawRead()        // macOS MDM 配置查询 (plutil/reg query)
startKeychainPrefetch()  // Keychain 凭证预读 (OAuth + API Key)

// ═══════════════════════════════════════════════════════════════
// 2. 模块导入 (~135ms)
// ═══════════════════════════════════════════════════════════════
import { Command } from '@commander-js/extra-typings'
import chalk from 'chalk'
import React from 'react'
// ... 200+ 导入

// ═══════════════════════════════════════════════════════════════
// 3. 特性标志检查（Bun 编译时 DCE - 零运行时开销）
// ═══════════════════════════════════════════════════════════════
const coordinatorModeModule = feature('COORDINATOR_MODE')
  ? require('./coordinator/coordinatorMode.js')
  : null

const assistantModule = feature('KAIROS')
  ? require('./assistant/index.js')
  : null

// ═══════════════════════════════════════════════════════════════
// 4. 配置迁移（启动时自动执行）
// ═══════════════════════════════════════════════════════════════
migrateAutoUpdatesToSettings()
migrateBypassPermissionsAcceptedToSettings()
migrateFennecToOpus()
migrateLegacyOpusToCurrent()
migrateSonnet45ToSonnet46()
// ... 10+ 迁移函数

// ═══════════════════════════════════════════════════════════════
// 5. 核心初始化
// ═══════════════════════════════════════════════════════════════
await init()  // Telemetry + GrowthBook + 用户认证

// ═══════════════════════════════════════════════════════════════
// 6. 启动渲染
// ═══════════════════════════════════════════════════════════════
renderAndRun(<App />, options)
```

### 2.1.3 关键设计亮点

| 技术 | 实现 | 收益 |
|------|------|------|
| **并行预取** | MDM/Keychain 在导入阶段并行执行 | 减少启动延迟 ~65ms |
| **编译时 DCE** | `feature('XXX')` 在 Bun 编译时移除未启用代码 | 零运行时开销 |
| **懒加载** | `lazy require` 打破循环依赖，按需加载 | 减少初始内存占用 |
| **迁移系统** | 启动时自动执行配置迁移 | 保持向后兼容 |
| **调试检测** | 检测 Node.js/Bun 调试器，防止源码泄露 | 安全保护 |

### 2.1.4 调试检测机制

```typescript
function isBeingDebugged() {
  const isBun = isRunningWithBun()
  
  // 检查 inspect 标志
  const hasInspectArg = process.execArgv.some(arg => {
    if (isBun) {
      return /--inspect(-brk)?/.test(arg)
    } else {
      return /--inspect(-brk)?|--debug(-brk)?/.test(arg)
    }
  })
  
  // 检查 NODE_OPTIONS
  const hasInspectEnv = process.env.NODE_OPTIONS && 
    /--inspect(-brk)?|--debug(-brk)?/.test(process.env.NODE_OPTIONS)
  
  // 检查 inspector 是否可用
  try {
    const inspector = require('inspector')
    const hasInspectorUrl = !!inspector.url()
    return hasInspectorUrl || hasInspectArg || hasInspectEnv
  } catch {
    return hasInspectArg || hasInspectEnv
  }
}

// 检测到调试时立即退出
if (isBeingDebugged()) {
  process.exit(1)
}
```

---

## 2.2 QueryEngine.ts (47KB) - 查询引擎核心

### 2.2.1 核心职责

1. **会话生命周期管理** - 一个 `QueryEngine` 实例 = 一次会话
2. **消息提交处理** - `submitMessage()` 处理用户输入
3. **SDK 兼容** - 支持 Headless/SDK 模式和 REPL 模式

### 2.2.2 类结构

```typescript
export class QueryEngine {
  // 配置（不可变）
  private config: QueryEngineConfig
  
  // 会话状态（可变，跨轮次持久化）
  private mutableMessages: Message[]           // 消息历史
  private abortController: AbortController     // 取消控制
  private permissionDenials: SDKPermissionDenial[]  // 权限拒绝追踪
  private totalUsage: NonNullableUsage         // Token 使用统计
  private readFileState: FileStateCache        // 文件读取缓存 (LRU)
  private discoveredSkillNames: Set<string>    // 技能发现追踪
  
  constructor(config: QueryEngineConfig) { ... }
  
  async *submitMessage(
    prompt: string | ContentBlockParam[],
    options?: { uuid?: string; isMeta?: boolean }
  ): AsyncGenerator<SDKMessage, void, unknown> {
    // 核心流程见下方
  }
}
```

### 2.2.3 submitMessage 流程

```
submitMessage(prompt)
    │
    ├─→ 1. 解构配置 & 清空技能追踪
    │
    ├─→ 2. 包装 canUseTool (追踪权限拒绝)
    │     wrappedCanUseTool = async (...) => {
    │       result = await canUseTool(...)
    │       if (result.behavior !== 'allow') {
    │         permissionDenials.push({...})
    │       }
    │       return result
    │     }
    │
    ├─→ 3. 构建系统提示
    │     fetchSystemPromptParts() → systemPrompt
    │
    ├─→ 4. 处理用户输入
    │     processUserInput() → { messages, shouldQuery, allowedTools }
    │
    ├─→ 5. 持久化消息到 transcript
    │     recordTranscript(messages)
    │
    ├─→ 6. 加载 Skills/Plugins (仅缓存)
    │
    ├─→ 7. Yield 系统初始化消息
    │     buildSystemInitMessage({...})
    │
    └─→ 8. 进入查询循环
          for await (message of query({...})) {
            yield formatForSDK(message)
          }
```

---

## 2.3 query.ts (69KB) - 查询编排器

### 2.3.1 查询循环状态机

```typescript
type State = {
  messages: Message[]
  toolUseContext: ToolUseContext
  autoCompactTracking: AutoCompactTrackingState | undefined
  maxOutputTokensRecoveryCount: number
  hasAttemptedReactiveCompact: boolean
  turnCount: number
  transition: Continue | undefined
}
```

### 2.3.2 主循环逻辑

```typescript
async function* queryLoop(params: QueryParams): AsyncGenerator<..., Terminal> {
  let state: State = { ... }
  
  while (true) {
    // 1. 应用压缩 (Snip → Microcompact → ContextCollapse → AutoCompact)
    messagesForQuery = applyCompactions(messages)
    
    // 2. 检查 Token 阻塞限制
    if (isAtBlockingLimit) {
      yield error('Prompt too long')
      return { reason: 'blocking_limit' }
    }
    
    // 3. 调用 Claude API (流式)
    for await (const message of callModel({...})) {
      if (message.type === 'tool_use') {
        toolUseBlocks.push(message)
      }
      yield message
    }
    
    // 4. 执行工具
    if (toolUseBlocks.length > 0) {
      for await (const update of runTools(toolUseBlocks, ...)) {
        yield update.message
      }
      state.messages.push(...toolResults)
      continue
    }
    
    // 5. 完成
    return { type: 'complete' }
  }
}
```

---

## 2.4 Tool.ts (30KB) - 工具抽象层

### 2.4.1 工具接口

```typescript
export type Tool<Input, Output, Progress> = {
  // 基础
  readonly name: string
  aliases?: string[]
  searchHint?: string
  
  // Schema
  readonly inputSchema: Input  // Zod
  readonly inputJSONSchema?: ToolInputJSONSchema  // MCP
  outputSchema?: z.ZodType<unknown>
  
  // 核心方法
  call(args, context, canUseTool, parentMessage, onProgress): Promise<ToolResult<Output>>
  
  // 权限
  validateInput?(input, context): Promise<ValidationResult>
  checkPermissions(input, context): Promise<PermissionResult>
  
  // 特性
  isEnabled(): boolean
  isConcurrencySafe(input): boolean
  isReadOnly(input): boolean
  isDestructive?(input): boolean
  
  // UI
  prompt(options): Promise<string>
  userFacingName(input): string
  renderToolResultMessage?(...): React.ReactNode
  
  // 行为
  interruptBehavior?(): 'cancel' | 'block'
  isSearchOrReadCommand?(input): { isSearch, isRead, isList }
  
  // MCP
  isMcp?: boolean
  mcpInfo?: { serverName: string; toolName: string }
  
  // 限制
  maxResultSizeChars: number
}
```

---

## 2.5 BashTool.tsx (160KB) - Shell 执行工具

### 2.5.1 安全层架构

```
BashTool.execute(command)
    │
    ├─→ 1. 命令解析 (splitCommandWithOperators, parseForSecurity)
    │
    ├─→ 2. 安全验证 (bashSecurity.ts - 24 项检查)
    │     ├── INCOMPLETE_COMMANDS
    │     ├── JQ_SYSTEM_FUNCTION
    │     ├── SHELL_METACHARACTERS
    │     ├── DANGEROUS_VARIABLES
    │     ├── COMMAND_SUBSTITUTION
    │     ├── IFS_INJECTION
    │     ├── ZSH_DANGEROUS_COMMANDS
    │     └── ... (共 24 项)
    │
    ├─→ 3. 只读约束检查 (readOnlyValidation.ts)
    │
    ├─→ 4. 路径验证 (pathValidation.ts)
    │
    ├─→ 5. Sed 命令验证 (sedValidation.ts)
    │
    ├─→ 6. 权限检查 (bashPermissions.ts)
    │
    ├─→ 7. 执行命令 (spawnShellTask, SandboxManager)
    │
    └─→ 8. 结果处理 (截断/图像/Git 追踪/文件历史)
```

### 2.5.2 24 项安全检查

```typescript
const BASH_SECURITY_CHECK_IDS = {
  INCOMPLETE_COMMANDS: 1,
  JQ_SYSTEM_FUNCTION: 2,
  JQ_FILE_ARGUMENTS: 3,
  OBFUSCATED_FLAGS: 4,
  SHELL_METACHARACTERS: 5,
  DANGEROUS_VARIABLES: 6,
  NEWLINES: 7,
  DANGEROUS_PATTERNS_COMMAND_SUBSTITUTION: 8,
  DANGEROUS_PATTERNS_INPUT_REDIRECTION: 9,
  DANGEROUS_PATTERNS_OUTPUT_REDIRECTION: 10,
  IFS_INJECTION: 11,
  GIT_COMMIT_SUBSTITUTION: 12,
  PROC_ENVIRON_ACCESS: 13,
  MALFORMED_TOKEN_INJECTION: 14,
  BACKSLASH_ESCAPED_WHITESPACE: 15,
  BRACE_EXPANSION: 16,
  CONTROL_CHARACTERS: 17,
  UNICODE_WHITESPACE: 18,
  MID_WORD_HASH: 19,
  ZSH_DANGEROUS_COMMANDS: 20,
  BACKSLASH_ESCAPED_OPERATORS: 21,
  COMMENT_QUOTE_DESYNC: 22,
  QUOTED_NEWLINE: 23,
}
```

### 2.5.3 危险模式检测

```typescript
const COMMAND_SUBSTITUTION_PATTERNS = [
  { pattern: /<\(/, message: 'process substitution <()' },
  { pattern: />\(/, message: 'process substitution >()' },
  { pattern: /\$\(/, message: '$() command substitution' },
  { pattern: /\$\{/, message: '${} parameter substitution' },
  // Zsh 等于展开（绕过安全检查）
  { pattern: /(?:^|[\s;&|])=[a-zA-Z_]/, message: 'Zsh equals expansion (=cmd)' },
]

const ZSH_DANGEROUS_COMMANDS = new Set([
  'zmodload', 'emulate', 'sysopen', 'sysread', 'syswrite',
  'zpty', 'ztcp', 'zsocket', 'zf_rm', 'zf_mv', 'zf_ln', ...
])
```

### 2.5.4 命令语义分类

```typescript
const BASH_SEARCH_COMMANDS = new Set(['find', 'grep', 'rg', 'ag', 'ack', 'locate', 'which', 'whereis'])
const BASH_READ_COMMANDS = new Set(['cat', 'head', 'tail', 'less', 'more', 'wc', 'stat', 'jq', 'awk', 'cut', 'sort', 'uniq', 'tr'])
const BASH_LIST_COMMANDS = new Set(['ls', 'tree', 'du'])
const BASH_SILENT_COMMANDS = new Set(['mv', 'cp', 'rm', 'mkdir', 'chmod', 'chown', 'touch', 'ln', 'cd'])
```

---

## 2.6 useCanUseTool.tsx (40KB) - 工具权限检查

### 2.6.1 权限检查流程

```
canUseTool(tool, input, context, ...)
    │
    ├─→ 1. 创建权限上下文 createPermissionContext()
    │
    ├─→ 2. 检查是否已中止
    │
    ├─→ 3. 获取权限决策 hasPermissionsToUseTool()
    │     ├── 检查 alwaysAllowRules → allow
    │     ├── 检查 alwaysDenyRules → deny
    │     ├── 检查 alwaysAskRules → ask
    │     └── 检查权限模式 (bypass/auto/default)
    │
    ├─→ 4. 处理决策
    │     ├── allow → 记录日志，resolve
    │     ├── deny → 记录日志，通知 (自动模式), resolve
    │     └── ask → 
    │           ├── 协调器模式处理 handleCoordinatorPermission()
    │           ├── 集群工作节点处理 handleSwarmWorkerPermission()
    │           ├── Bash 分类器推测检查
    │           └── 交互式权限对话框 handleInteractivePermission()
    │
    └─→ 5. 错误处理 & 清理
```

---

## 2.7 AppStateStore.ts (22KB) - 统一状态管理

### 2.7.1 状态结构

```typescript
export type AppState = DeepImmutable<{
  // 配置
  settings: SettingsJson
  verbose: boolean
  mainLoopModel: ModelSetting
  
  // UI
  statusLineText: string | undefined
  expandedView: 'none' | 'tasks' | 'teammates'
  footerSelection: FooterItem | null
  
  // 权限
  toolPermissionContext: ToolPermissionContext
  
  // 特性
  kairosEnabled: boolean
  agent: string | undefined
  
  // 远程
  remoteSessionUrl: string | undefined
  remoteConnectionStatus: 'connecting' | 'connected' | 'reconnecting' | 'disconnected'
  
  // Bridge
  replBridgeEnabled: boolean
  replBridgeConnected: boolean
  replBridgeSessionActive: boolean
  
  // 任务
  tasks: { [taskId: string]: TaskState }
  
  // MCP
  mcp: { clients, tools, commands, resources, pluginReconnectKey }
  
  // 插件
  plugins: { enabled, disabled, commands, errors }
  
  // ... 更多
}>
```

### 2.7.2 状态更新

```typescript
// 创建
const store = createStore<AppState>(getDefaultAppState(), onChangeAppState)

// 更新（不可变）
store.setState(prev => ({
  ...prev,
  mcp: { ...prev.mcp, clients: newClients }
}))

// 订阅
store.subscribe(() => { /* UI 重渲染 */ })

// 变更处理
function onChangeAppState({ newState, oldState }) {
  if (newState.settings !== oldState.settings) {
    saveGlobalConfig(newState.settings)
  }
  if (newState.mcp.clients !== oldState.mcp.clients) {
    logEvent('mcp_clients_changed', { count: newState.mcp.clients.length })
  }
}
```

---

## 2.8 store.ts (836B) - 最小状态管理原语

```typescript
type Listener = () => void
type OnChange<T> = (args: { newState: T; oldState: T }) => void

export type Store<T> = {
  getState: () => T
  setState: (updater: (prev: T) => T) => void
  subscribe: (listener: Listener) => () => void
}

export function createStore<T>(initialState: T, onChange?: OnChange<T>): Store<T> {
  let state = initialState
  const listeners = new Set<Listener>()

  return {
    getState: () => state,
    setState: (updater: (prev: T) => T) => {
      const prev = state
      const next = updater(prev)
      if (Object.is(next, prev)) return
      state = next
      onChange?.({ newState: next, oldState: prev })
      for (const listener of listeners) listener()
    },
    subscribe: (listener: Listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
```

---

## 2.9 toolOrchestration.ts - 工具执行编排

### 2.9.1 并发/串行策略

```typescript
async function* runTools(toolUseMessages, assistantMessages, canUseTool, toolUseContext) {
  // 1. 分区：并发安全批 vs 串行批
  for (const { isConcurrencySafe, blocks } of partitionToolCalls(...)) {
    if (isConcurrencySafe) {
      // 2. 并发执行读操作
      for await (const update of runToolsConcurrently(...)) {
        yield update
      }
    } else {
      // 3. 串行执行非读操作
      for await (const update of runToolsSerially(...)) {
        yield update
      }
    }
  }
}

function partitionToolCalls(toolUseMessages, toolUseContext): Batch[] {
  return toolUseMessages.reduce((acc: Batch[], toolUse) => {
    const tool = findToolByName(tools, toolUse.name)
    const parsedInput = tool?.inputSchema.safeParse(toolUse.input)
    const isConcurrencySafe = parsedInput?.success 
      ? tool?.isConcurrencySafe(parsedInput.data) 
      : false
    
    if (isConcurrencySafe && acc[acc.length - 1]?.isConcurrencySafe) {
      acc[acc.length - 1].blocks.push(toolUse)
    } else {
      acc.push({ isConcurrencySafe, blocks: [toolUse] })
    }
    return acc
  }, [])
}
```

---

# 3. 数据结构与类型系统

## 3.1 消息类型

```typescript
type Message =
  | UserMessage
  | AssistantMessage
  | SystemMessage
  | AttachmentMessage
  | ProgressMessage
  | ToolUseSummaryMessage
  | TombstoneMessage

type UserMessage = {
  type: 'user'
  uuid: UUID
  createdAt: number
  message: { role: 'user'; content: string | ContentBlockParam[] }
  toolUseResult?: string
  sourceToolAssistantUUID?: string
  isMeta?: boolean
  isCompactSummary?: boolean
}

type AssistantMessage = {
  type: 'assistant'
  uuid: UUID
  createdAt: number
  message: { role: 'assistant'; content: ContentBlockParam[] }
  apiError?: 'max_output_tokens' | 'invalid_request' | ...
  usage?: Usage
}

type SystemMessage = {
  type: 'system'
  subtype: 'compact_boundary' | 'local_command' | ...
  uuid: UUID
  content: string
  compactMetadata?: CompactMetadata
}
```

## 3.2 工具结果类型

```typescript
type ToolResult<T> = {
  data: T
  newMessages?: (UserMessage | AssistantMessage | AttachmentMessage | SystemMessage)[]
  contextModifier?: (context: ToolUseContext) => ToolUseContext
  mcpMeta?: { _meta?: Record<string, unknown>; structuredContent?: Record<string, unknown> }
}

type PermissionResult =
  | { behavior: 'allow'; updatedInput?: Record<string, unknown>; decisionReason?: DecisionReason }
  | { behavior: 'deny'; decisionReason?: DecisionReason }
  | { behavior: 'ask'; pendingClassifierCheck?: Promise<ClassificationResult>; updatedInput?: Record<string, unknown>; suggestions?: Suggestion[] }
```

## 3.3 权限上下文

```typescript
type ToolPermissionContext = {
  mode: PermissionMode  // 'default' | 'bypass' | 'auto' | 'plan'
  
  additionalWorkingDirectories: Map<string, AdditionalWorkingDirectory>
  
  alwaysAllowRules: ToolPermissionRulesBySource
  alwaysDenyRules: ToolPermissionRulesBySource
  alwaysAskRules: ToolPermissionRulesBySource
  
  isBypassPermissionsModeAvailable: boolean
  isAutoModeAvailable?: boolean
  strippedDangerousRules?: ToolPermissionRulesBySource
  shouldAvoidPermissionPrompts?: boolean
  awaitAutomatedChecksBeforeDialog?: boolean
  prePlanMode?: PermissionMode
}

type ToolPermissionRulesBySource = {
  command?: Record<string, string[]>  // Bash 命令模式
  file?: Record<string, string[]>     // 文件路径模式
  // ... 其他工具
}
```

---

# 4. 调用关系与执行流程

## 4.1 完整调用链（用户输入 → 工具执行）

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. 用户输入 (命令行 / 对话消息)                                              │
└─────────────────────────────┬───────────────────────────────────────────────┘
                              │
                              ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│ 2. main.tsx                                                                 │
│    - parse CLI args                                                         │
│    - init()                                                                 │
│    - renderAndRun(<App />)                                                  │
└─────────────────────────────┬───────────────────────────────────────────────┘
                              │
                              ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3. App.tsx → REPL.tsx → PromptInput.tsx                                     │
│    - 捕获用户输入                                                            │
│    - 添加到消息队列                                                          │
└─────────────────────────────┬───────────────────────────────────────────────┘
                              │
                              ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│ 4. QueryEngine.submitMessage()                                              │
│    - wrappedCanUseTool (权限追踪)                                            │
│    - fetchSystemPromptParts()                                               │
│    - processUserInput()                                                     │
│    - recordTranscript()                                                     │
└─────────────────────────────┬───────────────────────────────────────────────┘
                              │
                              ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│ 5. query() 生成器                                                           │
│    - applyCompactions (Snip/Microcompact/Collapse/Auto)                     │
│    - checkTokenLimit()                                                      │
│    - callModel() [流式 API 调用]                                             │
└─────────────────────────────┬───────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              │                               │
              ↓                               ↓
    [流式响应事件]                    [检测到 tool_use]
              │                               │
              │                               ↓
              │                    ┌─────────────────────────────────────────┐
              │                    │ 6. runTools()                           │
              │                    │    - partitionToolCalls()               │
              │                    │    - runToolsConcurrently() / Serially()│
              │                    └───────────────┬─────────────────────────┘
              │                                    │
              │                                    ↓
              │                    ┌─────────────────────────────────────────┐
              │                    │ 7. runToolUse()                         │
              │                    │    - canUseTool() ← 权限检查            │
              │                    └───────────────┬─────────────────────────┘
              │                                    │
              │                          ┌─────────┴─────────┐
              │                          │                   │
              │                    [允许]               [拒绝]
              │                          │                   │
              │                          ↓                   ↓
              │              ┌───────────────────┐  ┌─────────────────┐
              │              │ 8. Tool.call()    │  │ 返回错误结果    │
              │              │    - BashTool     │  │                 │
              │              │    - 安全检查      │  │                 │
              │              │    - spawnShell   │  │                 │
              │              └─────────┬─────────┘  │                 │
              │                        │            │                 │
              │                        ↓            │                 │
              │              ┌───────────────────┐  │                 │
              │              │ 9. 结果格式化     │  │                 │
              │              └─────────┬─────────┘  │                 │
              │                        │            │                 │
              └────────────────────────┴────────────┴─────────────────┘
                                       │
                                       ↓
                          ┌─────────────────────────┐
                          │ 10. 结果回灌到 query     │
                          │     - 构建 tool_result  │
                          │     - 继续循环或完成    │
                          └───────────┬─────────────┘
                                      │
                                      ↓
                          ┌─────────────────────────┐
                          │ 11. Ink 组件渲染输出     │
                          └─────────────────────────┘
```

## 4.2 状态变更流程

```
工具执行/用户操作
    │
    ↓
AppStateStore.setState(prev => ({ ...prev, ...changes }))
    │
    ↓
onChangeAppState({ newState, oldState })
    ├─→ 持久化 Settings (saveGlobalConfig)
    ├─→ 发送遥测 (logEvent)
    └─→ 触发副作用 (MCP 重连等)
    │
    ↓
Store 通知所有订阅者 (listeners.forEach(fn => fn()))
    │
    ↓
Ink 组件重新渲染 (React 检测到状态变更)
```

## 4.3 工具权限检查流程

```
QueryEngine.submitMessage() 检测到 tool_use
    │
    ↓
wrappedCanUseTool() (QueryEngine 内包装)
    ├─→ 调用 canUseTool()
    └─→ 追踪 permission denials
    │
    ↓
useCanUseTool.tsx (Hook)
    │
    ├─→ 检查 alwaysAllowRules → allow
    ├─→ 检查 alwaysDenyRules → deny
    ├─→ 检查 alwaysAskRules → ask
    └─→ 检查权限模式 (bypass/auto/default)
    │
    └─→ ask 分支:
          ├─→ handleCoordinatorPermission() (协调器模式)
          ├─→ handleSwarmWorkerPermission() (集群工作节点)
          ├─→ Bash 分类器推测检查 (2s 超时)
          └─→ handleInteractivePermission() (交互式对话框)
                ├─→ Bridge 回调 (如启用)
                ├─→ Channel 回调 (如启用)
                └─→ 显示权限确认对话框
                      ├─→ 用户 Allow → resolve(allow)
                      └─→ 用户 Deny → resolve(deny)
```

---

# 5. 设计模式与工程实践

## 5.1 核心设计模式

### 5.1.1 生成器模式 (Generator Pattern)

**用途**: 流式处理、查询循环、工具执行

```typescript
async function* query(params: QueryParams): AsyncGenerator<StreamEvent | Message, Terminal> {
  while (true) {
    const stream = callClaudeAPI(...)
    for await (const event of stream) {
      yield event  // 推送给 UI
    }
    if (hasToolUse) {
      const results = yield* runTools(...)  // 嵌套生成器
      continue
    }
    return { type: 'complete' }
  }
}
```

**优点**: 自然表达异步流、支持嵌套生成器、可随时暂停/恢复

---

### 5.1.2 建造者模式 (Builder Pattern)

**用途**: 工具构建、消息构建

```typescript
export function buildTool(def: ToolDef): Tool {
  return {
    name: def.name,
    inputSchema: def.inputSchema,
    async execute(input, context) {
      const validation = def.validate?.(input, context)
      if (!validation.result) return errorResult(validation.message)
      const result = await def.run(input, context)
      return formatResult(result)
    },
    render: def.render,
    isEnabled: def.isEnabled,
  }
}
```

**优点**: 统一接口、复用执行逻辑、易于测试

---

### 5.1.3 策略模式 (Strategy Pattern)

**用途**: 权限模式、压缩策略

```typescript
type PermissionMode = 'default' | 'bypass' | 'auto'

const permissionStrategies: Record<PermissionMode, PermissionStrategy> = {
  default: { checkPermission: (...) => { /* 正常检查 */ } },
  bypass: { checkPermission: (...) => { /* 自动允许 */ } },
  auto: { checkPermission: (...) => { /* 自动模式 */ } },
}

const strategy = permissionStrategies[mode]
const result = strategy.checkPermission(tool, input)
```

**优点**: 运行时切换策略、新增策略无需修改调用方

---

### 5.1.4 观察者模式 (Observer Pattern)

**用途**: 状态管理、事件通知

```typescript
export function createStore<T>(initialState: T, onChange?: OnChange<T>): Store<T> {
  let state = initialState
  const listeners = new Set<Listener>()

  return {
    getState: () => state,
    setState: (updater: (prev: T) => T) => {
      const next = updater(prev)
      if (Object.is(next, prev)) return
      state = next
      onChange?.({ newState: next, oldState: prev })
      for (const listener of listeners) listener()
    },
    subscribe: (listener: Listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
```

**优点**: 松耦合、支持多订阅者、自动通知

---

### 5.1.5 责任链模式 (Chain of Responsibility)

**用途**: 安全检查、中间件

```typescript
const securityChecks: SecurityCheck[] = [
  checkIncompleteCommands,
  checkJqSystemFunction,
  checkShellMetacharacters,
  checkDangerousVariables,
  // ... 24 项检查
]

async function validateCommand(command: string): Promise<ValidationResult> {
  for (const check of securityChecks) {
    const result = await check(command)
    if (!result.passed) {
      return { valid: false, errorCode: result.code, message: result.message }
    }
  }
  return { valid: true }
}
```

**优点**: 每个检查独立、易于增删检查、短路优化

---

### 5.1.6 装饰器模式 (Decorator Pattern)

**用途**: 权限包装、重试包装

```typescript
// QueryEngine.ts - 权限拒绝追踪装饰器
const wrappedCanUseTool: CanUseToolFn = async (...) => {
  const result = await canUseTool(...)
  if (result.behavior !== 'allow') {
    this.permissionDenials.push({ tool_name, tool_use_id, tool_input })
  }
  return result
}
```

**优点**: 动态添加职责、无需修改原函数、可组合

---

### 5.1.7 工厂模式 (Factory Pattern)

**用途**: 工具创建、消息创建

```typescript
export function getTools(): Tools {
  return [
    AgentTool, BashTool, FileEditTool, FileReadTool, FileWriteTool,
    GlobTool, GrepTool, WebFetchTool, WebSearchTool,
    ...(feature('KAIROS') ? [SleepTool] : []),
    ...(process.env.USER_TYPE === 'ant' ? [REPLTool] : []),
  ].filter(tool => tool.isEnabled?.() ?? true)
}

export function createUserMessage(options: { content: string | ContentBlockParam[] }): UserMessage {
  return { type: 'user', uuid: randomUUID(), createdAt: Date.now(), ...options }
}
```

**优点**: 集中创建逻辑、隐藏实现细节、易于替换

---

## 5.2 工程实践

### 5.2.1 编译时特性标志

```typescript
const coordinatorModeModule = feature('COORDINATOR_MODE')
  ? require('./coordinator/coordinatorMode.js')
  : null

// Bun 编译时 DCE - 未启用代码被完全移除，零运行时开销
```

### 5.2.2 懒加载打破循环依赖

```typescript
const getTeammateUtils = () => require('./utils/teammate.js')
const teammate = getTeammateUtils()
```

### 5.2.3 不可变状态更新

```typescript
// 正确做法
store.setState(prev => ({
  ...prev,
  tasks: { ...prev.tasks, [taskId]: newTask }
}))

// 错误做法（可变）
state.tasks[taskId] = newTask
```

### 5.2.4 类型安全的事件系统

```typescript
type StreamEvent =
  | { type: 'message'; message: Message }
  | { type: 'tool_use'; toolUse: ToolUseBlock }
  | { type: 'error'; error: Error }
  | { type: 'complete' }

function isToolUseEvent(event: StreamEvent): event is { type: 'tool_use' } {
  return event.type === 'tool_use'
}

if (isToolUseEvent(event)) {
  // TypeScript 知道 event.toolUse 存在
  executeTool(event.toolUse)
}
```

---

# 6. 安全与权限系统

## 6.1 权限规则系统

```typescript
type ToolPermissionContext = {
  mode: PermissionMode  // 'default' | 'bypass' | 'auto' | 'plan'
  
  alwaysAllowRules: ToolPermissionRulesBySource
  alwaysDenyRules: ToolPermissionRulesBySource
  alwaysAskRules: ToolPermissionRulesBySource
}

type ToolPermissionRulesBySource = {
  command?: Record<string, string[]>  // Bash(git *) → ['add', 'status']
  file?: Record<string, string[]>     // FileRead(/src/*) → ['/src/utils.ts']
}
```

## 6.2 权限决策流程

```
hasPermissionsToUseTool(tool, input, context)
    │
    ├─→ 1. 检查 alwaysAllowRules → allow
    ├─→ 2. 检查 alwaysDenyRules → deny
    ├─→ 3. 检查 alwaysAskRules → ask
    ├─→ 4. 检查权限模式
    │     ├── bypass → allow (危险工具除外)
    │     └── auto → allow (需用户事先同意)
    └─→ 5. 默认 → ask
```

## 6.3 Bash 安全检查链

| ID | 检查项 | 检测内容 |
|----|--------|----------|
| 1 | INCOMPLETE_COMMANDS | 不完整命令 |
| 2 | JQ_SYSTEM_FUNCTION | jq system() 函数 |
| 3 | JQ_FILE_ARGUMENTS | jq 文件参数 |
| 4 | OBFUSCATED_FLAGS | 混淆标志 |
| 5 | SHELL_METACHARACTERS | Shell 元字符 |
| 6 | DANGEROUS_VARIABLES | 危险变量 ($PATH 等) |
| 7 | NEWLINES | 换行注入 |
| 8 | COMMAND_SUBSTITUTION | $() 替换 |
| 9 | INPUT_REDIRECTION | < 重定向 |
| 10 | OUTPUT_REDIRECTION | > 重定向 |
| 11 | IFS_INJECTION | IFS 注入 |
| 12 | GIT_COMMIT_SUBSTITUTION | Git commit 替换 |
| 13 | PROC_ENVIRON_ACCESS | /proc 访问 |
| 14 | TOKEN_INJECTION | Token 注入 |
| 15 | BACKSLASH_WHITESPACE | 反斜杠转义 |
| 16 | BRACE_EXPANSION | 大括号展开 |
| 17 | CONTROL_CHARACTERS | 控制字符 |
| 18 | UNICODE_WHITESPACE | Unicode 空白 |
| 19 | MID_WORD_HASH | 词中# |
| 20 | ZSH_DANGEROUS_COMMANDS | Zsh 危险命令 |
| 21 | ESCAPED_OPERATORS | 转义操作符 |
| 22 | COMMENT_QUOTE_DESYNC | 注释引号失配 |
| 23 | QUOTED_NEWLINE | 引号内换行 |

---

# 7. 工具系统详解

## 7.1 工具分类

| 类别 | 工具 | 数量 |
|------|------|------|
| **核心工具** | Bash, FileRead, FileWrite, FileEdit, Glob, Grep | 6 |
| **Web 工具** | WebFetch, WebSearch | 2 |
| **代理工具** | AgentTool, SkillTool | 2 |
| **任务工具** | TaskCreate, TaskUpdate, TaskList, TaskStop, TaskGet, TaskOutput, TodoWrite | 7 |
| **集成工具** | MCPTool, LSPTool, ListMcpResources, ReadMcpResource | 4 |
| **配置工具** | ConfigTool, EnterPlanMode, ExitPlanMode, EnterWorktree, ExitWorktree | 5 |
| **通信工具** | AskUserQuestion, SendMessage, BriefTool | 3 |
| **条件工具** | Sleep, CronCreate/Delete/List, RemoteTrigger, PowerShell, REPL | 可变 |

## 7.2 工具执行流程

```
Tool.call(input, context, canUseTool, parentMessage, onProgress)
    │
    ├─→ 1. validateInput(input, context)
    │
    ├─→ 2. canUseTool(tool, input, context, parentMessage, toolUseID)
    │     └─→ 权限检查 → allow/deny/ask
    │
    ├─→ 3. checkPermissions(input, context)
    │
    ├─→ 4. 执行工具逻辑
    │     ├── BashTool → spawnShellTask()
    │     ├── FileRead → readFile()
    │     ├── FileEdit → applyDiff()
    │     └── ...
    │
    ├─→ 5. 格式化结果
    │     └─→ ToolResult { data, newMessages, contextModifier }
    │
    └─→ 6. 返回
```

---

# 8. 状态管理与 UI 架构

## 8.1 Ink 渲染架构

```
Ink (React for Terminal)
    │
    ├─→ 组件系统 (146 个组件)
    │     ├── App.tsx
    │     ├── REPL.tsx
    │     ├── PromptInput.tsx
    │     ├── ToolResultViews/*
    │     ├── Dialogs/*
    │     └── ...
    │
    ├─→ 渲染引擎 (50 个模块)
    │     ├── render-to-screen.ts
    │     ├── layout/engine.ts
    │     ├── layout/yoga.ts
    │     ├── colorize.ts
    │     └── ...
    │
    └─→ Hooks (87 个)
          ├── useCanUseTool.tsx
          ├── useArrowKeyHistory.tsx
          ├── useCommandKeybindings.tsx
          └── ...
```

## 8.2 状态流

```
用户操作/工具执行
    │
    ↓
store.setState(prev => ({ ...prev, ...changes }))
    │
    ├─→ onChangeAppState() (持久化/遥测/副作用)
    │
    └─→ listeners.forEach(fn => fn())
          │
          ↓
    Ink 组件重新渲染
```

---

# 9. 扩展系统

## 9.1 Skills 系统

```
skills/
├── loadSkillsDir.ts (34KB) - 技能加载核心
├── bundledSkills.ts (7KB) - 内置技能
├── mcpSkillBuilders.ts (2KB) - MCP 技能构建
└── bundled/ (19 技能) - 内置技能目录
```

## 9.2 Plugins 系统

```
plugins/
├── discoverPlugins.ts - 插件发现
├── installPlugin.ts - 插件安装
├── loadPlugin.ts - 插件加载
├── PluginManager.ts - 插件管理器
└── types.ts - 插件类型
```

## 9.3 MCP 集成

```
services/mcp/ (25 文件)
├── client.ts - MCP 客户端
├── config.ts - 配置解析
├── officialRegistry.ts - 官方注册表
├── channelPermissions.ts - 渠道权限
├── elicitationHandler.ts - 批准处理
└── ... (20 更多文件)
```

---

# 10. 对 OpenClaw 的借鉴意义

## 10.1 工具系统设计

| Claude Code | OpenClaw 可采纳 |
|-------------|-----------------|
| 统一 `Tool` 接口 | 统一技能/工具接口 |
| `buildTool()` 工厂 | 添加工具构建器 |
| `validateInput()` 预检 | 添加输入验证 |
| `renderToolResultMessage()` | 添加 UI 渲染支持 |

## 10.2 权限系统

| Claude Code | OpenClaw 可采纳 |
|-------------|-----------------|
| 三层规则 (Allow/Deny/Ask) | 增强 exec 权限控制 |
| 权限模式切换 | 添加模式支持 |
| 拒绝次数追踪 | 添加阈值自动拒绝 |

## 10.3 安全检查

| Claude Code | OpenClaw 可采纳 |
|-------------|-----------------|
| 24 项 Bash 检查链 | 为 exec 添加危险命令检测 |
| 责任链模式 | 模块化安全检查 |
| Zsh 危险命令检测 | 添加 Shell 特定检测 |

## 10.4 状态管理

| Claude Code | OpenClaw 可采纳 |
|-------------|-----------------|
| 最小 `createStore()` | 简化当前状态管理 |
| 不可变更新模式 | 采用不可变更新 |
| 变更通知机制 | 添加订阅者模式 |

## 10.5 流式处理

| Claude Code | OpenClaw 可采纳 |
|-------------|-----------------|
| 生成器驱动查询循环 | 改进流式响应处理 |
| 嵌套生成器 (`yield*`) | 支持工具执行嵌套 |
| 清晰的终止条件 | 明确循环退出条件 |

## 10.6 编译优化

| Claude Code | OpenClaw 可采纳 |
|-------------|-----------------|
| `feature()` 编译时 DCE | 使用 Bun 特性标志 |
| 条件加载模块 | 按需加载 |
| 零运行时开销 | 减少运行时判断 |

---

_文档生成时间：2026-04-02 13:30 GMT+8_  
_源码版本：claudecode-cli-source (2026-03-31 快照)_  
_分析工具：人工审查 + 代码结构分析_
