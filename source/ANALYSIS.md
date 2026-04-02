# Claude Code CLI 深度分析

> 📅 分析时间：2026-04-02 | 基于源码快照

---

## 📖 第一部分：核心文件逐文件解读

### 1.1 `main.tsx` (804KB) - CLI 入口点

#### 职责
- **启动引导**：MDM 配置预读、Keychain 预取、特性标志检查
- **命令行解析**：使用 `@commander-js/extra-typings` 解析 CLI 参数
- **初始化流程**：Telemetry、Settings、Plugins、Skills、MCP
- **会话管理**：Session 创建/恢复、Teleport 远程会话
- **渲染入口**：调用 `renderAndRun()` 启动 Ink 渲染

#### 关键代码段

```typescript
// 1. 启动前预取（并行执行，减少启动延迟）
startMdmRawRead()        // macOS MDM 配置查询
startKeychainPrefetch()  // Keychain 凭证预读

// 2. 特性标志检查（Bun 编译时 DCE）
const coordinatorModeModule = feature('COORDINATOR_MODE') 
  ? require('./coordinator/coordinatorMode.js') 
  : null

// 3. 配置迁移（启动时自动执行）
migrateAutoUpdatesToSettings()
migrateBypassPermissionsAcceptedToSettings()
migrateSonnet45ToSonnet46()

// 4. 核心初始化
await init()  // Telemetry + GrowthBook + 用户认证

// 5. 启动渲染
renderAndRun(<App />, options)
```

#### 启动流程时序

```
┌──────────────┐
│ main.tsx     │
│ 入口         │
└──────┬───────┘
       │
       ├─→ startMdmRawRead()     [并行]
       ├─→ startKeychainPrefetch() [并行]
       │
       ↓ (等待 ~135ms)
┌──────────────┐
│ 导入所有模块  │
│ (~135ms)     │
└──────┬───────┘
       │
       ↓
┌──────────────┐
│ init()       │ ← Telemetry, GrowthBook, 用户认证
└──────┬───────┘
       │
       ↓
┌──────────────┐
│ 加载配置      │ ← Settings, Plugins, Skills, MCP
└──────┬───────┘
       │
       ↓
┌──────────────┐
│ renderAndRun │ ← Ink 渲染启动
└──────────────┘
```

#### 设计亮点

| 技术 | 说明 |
|------|------|
| **并行预取** | MDM/Keychain 在导入阶段并行执行，减少启动延迟 |
| **编译时 DCE** | `feature('XXX')` 在 Bun 编译时移除未启用代码 |
| **懒加载** | `lazy require` 打破循环依赖，按需加载 |
| **迁移系统** | 启动时自动执行配置迁移，保持向后兼容 |

---

### 1.2 `QueryEngine.ts` (47KB) - 查询引擎核心

#### 职责
- **会话生命周期管理**：一个 `QueryEngine` 实例 = 一次会话
- **消息提交**：`submitMessage()` 处理用户输入
- **状态持久化**：Messages、FileCache、Usage 跨轮次保持
- **SDK 兼容**：支持 Headless/SDK 模式和 REPL 模式

#### 核心类结构

```typescript
export class QueryEngine {
  private config: QueryEngineConfig
  private mutableMessages: Message[]      // 会话消息历史
  private abortController: AbortController
  private permissionDenials: SDKPermissionDenial[]
  private totalUsage: NonNullableUsage
  private readFileState: FileStateCache   // 文件读取缓存 (LRU)
  private discoveredSkillNames: Set<string>  // 技能发现追踪
  
  constructor(config: QueryEngineConfig) { ... }
  
  async *submitMessage(
    prompt: string | ContentBlockParam[],
    options?: { uuid?: string; isMeta?: boolean }
  ): AsyncGenerator<SDKMessage, void, unknown> {
    // 1. 构建系统提示
    // 2. 调用 query() 生成器
    // 3. 处理工具调用
    // 4. 权限检查
    // 5. 结果回灌
  }
}
```

#### 提交消息流程

```
submitMessage(prompt)
    │
    ↓
┌─────────────────────────────────┐
│ 1. fetchSystemPromptParts()     │ ← 收集工具/MCP/上下文
└───────────────┬─────────────────┘
                │
                ↓
┌─────────────────────────────────┐
│ 2. query() 生成器               │ ← 核心查询循环
│    - 调用 API                    │
│    - 处理流式响应               │
│    - 检测工具调用               │
└───────────────┬─────────────────┘
                │
                ↓
        [检测到 tool_use]
                │
                ↓
┌─────────────────────────────────┐
│ 3. canUseTool()                 │ ← 权限检查 (wrapped)
│    - 检查 alwaysAllow/Deny 规则  │
│    - 弹出权限对话框 (如需)       │
│    - 追踪拒绝次数               │
└───────────────┬─────────────────┘
                │
          ┌─────┴─────┐
          │           │
     [允许]        [拒绝]
          │           │
          ↓           ↓
┌──────────────┐  ┌──────────────────┐
│ 4. 执行工具   │  │ 记录 permission  │
│    - Bash    │  │    denial        │
│    - File    │  │  返回错误结果    │
│    - MCP     │  │                  │
└──────┬───────┘  └────────┬─────────┘
       │                   │
       └─────────┬─────────┘
                 │
                 ↓
┌─────────────────────────────────┐
│ 5. 结果回灌到模型               │
│    - 构建 tool_result          │
│    - 继续 query 循环            │
└─────────────────────────────────┘
```

#### 关键设计

```typescript
// 权限拒绝追踪（SDK 模式）
const wrappedCanUseTool: CanUseToolFn = async (...) => {
  const result = await canUseTool(...)
  
  if (result.behavior !== 'allow') {
    this.permissionDenials.push({
      tool_name: sdkCompatToolName(tool.name),
      tool_use_id: toolUseID,
      tool_input: input,
    })
  }
  return result
}

// 技能发现追踪（遥测用）
this.discoveredSkillNames.clear()  // 每轮清空
// ... 在 processUserInput 中添加发现的技能
```

---

### 1.3 `query.ts` (69KB) - 查询编排器

#### 职责
- **主查询循环**：`query()` 生成器驱动整个对话流程
- **Token 预算管理**：自动压缩、预算追踪、错误恢复
- **工具编排**：调用 `runTools()` 执行工具
- **流式处理**：处理 API 流式响应，yield 事件给 UI

#### 查询循环状态机

```typescript
type State = {
  messages: Message[]
  toolUseContext: ToolUseContext
  autoCompactTracking: AutoCompactTrackingState | undefined
  maxOutputTokensRecoveryCount: number
  hasAttemptedReactiveCompact: boolean
  turnCount: number
  transition: Continue | undefined  // 为什么继续迭代
}
```

#### 核心循环逻辑

```typescript
async function* queryLoop(params: QueryParams): AsyncGenerator<..., Terminal> {
  let state: State = { ... }
  
  while (true) {
    // 1. 构建 API 请求
    const request = buildAPIRequest(state.messages, systemPrompt)
    
    // 2. 调用 Claude API (流式)
    const stream = callClaudeAPI(request)
    
    // 3. 处理流式响应
    for await (const event of stream) {
      if (event.type === 'tool_use') {
        // 检测到工具调用
        state.toolUseContext.toolUses.push(event)
      }
      yield event  // 推送给 UI
    }
    
    // 4. 检查是否有工具需要执行
    if (state.toolUseContext.toolUses.length > 0) {
      // 执行工具
      const results = yield* runTools(state.toolUseContext)
      
      // 结果回灌
      state.messages.push(createToolResultMessage(results))
      continue  // 继续循环
    }
    
    // 5. 完成
    return { type: 'complete' }
  }
}
```

#### Token 预算与自动压缩

```typescript
// 预算追踪
const budgetTracker = feature('TOKEN_BUDGET') ? createBudgetTracker() : null

// 自动压缩触发
const tokenWarningState = calculateTokenWarningState(messages)
if (tokenWarningState.shouldCompact && isAutoCompactEnabled()) {
  // 触发压缩
  const compactedMessages = yield* compact(messages)
  state.messages = compactedMessages
  continue
}

// max_output_tokens 错误恢复
if (apiError === 'max_output_tokens') {
  if (recoveryCount < MAX_OUTPUT_TOKENS_RECOVERY_LIMIT) {
    state.maxOutputTokensOverride = calculateNewLimit()
    state.maxOutputTokensRecoveryCount++
    continue  // 重试
  }
}
```

---

### 1.4 `Tool.ts` (30KB) - 工具抽象层

#### 职责
- **工具接口定义**：统一的工具抽象
- **工具构建器**：`buildTool()` 创建工具实例
- **权限上下文**：`ToolPermissionContext` 定义权限规则
- **工具使用上下文**：`ToolUseContext` 传递执行环境

#### 工具接口

```typescript
export interface Tool {
  name: string
  description: string
  inputSchema: ToolInputJSONSchema
  
  // 执行方法
  execute(
    input: unknown,
    context: ToolUseContext,
  ): Promise<ToolResult>
  
  // 权限相关
  validate?(
    input: unknown,
    permissionContext: ToolPermissionContext,
  ): ValidationResult
  
  // UI 相关
  render?(
    input: unknown,
    status: 'pending' | 'running' | 'complete' | 'error',
  ): React.ReactNode
  
  // 生命周期
  isEnabled?(): boolean
  onRegister?(): void
}
```

#### 工具构建器模式

```typescript
export function buildTool(def: ToolDef): Tool {
  return {
    name: def.name,
    description: def.description,
    inputSchema: def.inputSchema,
    
    async execute(input, context) {
      // 1. 验证输入
      const validation = def.validate?.(input, context)
      if (!validation.result) {
        return { type: 'error', message: validation.message }
      }
      
      // 2. 执行工具逻辑
      const result = await def.run(input, context)
      
      // 3. 格式化结果
      return formatResult(result)
    },
    
    render: def.render,
    isEnabled: def.isEnabled,
  }
}
```

#### 权限上下文

```typescript
export type ToolPermissionContext = {
  mode: PermissionMode  // 'default' | 'bypass' | 'auto'
  
  additionalWorkingDirectories: Map<string, AdditionalWorkingDirectory>
  
  // 权限规则（按工具名分组）
  alwaysAllowRules: ToolPermissionRulesBySource
  alwaysDenyRules: ToolPermissionRulesBySource
  alwaysAskRules: ToolPermissionRulesBySource
  
  isBypassPermissionsModeAvailable: boolean
  isAutoModeAvailable?: boolean
  
  // 计划模式备份
  prePlanMode?: PermissionMode
}
```

---

### 1.5 `tools.ts` (17KB) - 工具注册表

#### 职责
- **工具导入**：导入所有可用工具
- **条件加载**：基于特性标志/环境变量过滤工具
- **工具预设**：定义工具组合预设（如 `default`）
- **工具过滤**：根据模式/场景过滤工具列表

#### 工具注册模式

```typescript
export function getAllBaseTools(): Tools {
  return [
    // 核心工具（总是可用）
    AgentTool,
    BashTool,
    FileEditTool,
    FileReadTool,
    FileWriteTool,
    GlobTool,
    GrepTool,
    WebFetchTool,
    WebSearchTool,
    
    // 条件工具（特性标志）
    ...(feature('KAIROS') ? [SleepTool] : []),
    ...(feature('AGENT_TRIGGERS') ? [
      CronCreateTool,
      CronDeleteTool,
      CronListTool,
    ] : []),
    
    // 条件工具（环境变量）
    ...(process.env.USER_TYPE === 'ant' ? [
      REPLTool,
      SuggestBackgroundPRTool,
    ] : []),
    
    // 懒加载工具（打破循环依赖）
    ...(getTeamCreateTool ? [getTeamCreateTool()] : []),
  ]
}
```

#### 工具预设

```typescript
export const TOOL_PRESETS = ['default'] as const

export function getToolsForDefaultPreset(): string[] {
  const tools = getAllBaseTools()
  const isEnabled = tools.map(tool => tool.isEnabled())
  return tools
    .filter((_, i) => isEnabled[i])
    .map(tool => tool.name)
}
```

---

### 1.6 `BashTool.tsx` (160KB) - Shell 执行工具

#### 职责
- **命令执行**：执行用户指定的 Shell 命令
- **安全检查**：危险命令检测、路径验证、注入防护
- **权限管理**：命令级别的权限控制
- **进度追踪**：长时间运行命令的进度显示
- **输出处理**：流式输出、截断、图像输出

#### 安全层架构

```
BashTool.execute()
    │
    ↓
┌─────────────────────────────────┐
│ 1. 命令解析                      │
│    - splitCommandWithOperators() │
│    - parseForSecurity() (AST)   │
│    - tryParseShellCommand()     │
└───────────────┬─────────────────┘
                │
                ↓
┌─────────────────────────────────┐
│ 2. 安全验证                      │
│    - bashSecurity.ts (24 项检查) │
│    - readOnlyValidation.ts      │
│    - pathValidation.ts          │
│    - sedValidation.ts           │
└───────────────┬─────────────────┘
                │
                ↓
┌─────────────────────────────────┐
│ 3. 权限检查                      │
│    - bashPermissions.ts         │
│    - 匹配 alwaysAllow/Deny 规则  │
│    - 弹出确认对话框 (如需)       │
└───────────────┬─────────────────┘
                │
                ↓
┌─────────────────────────────────┐
│ 4. 执行命令                      │
│    - spawnShellTask()           │
│    - SandboxManager (沙箱)      │
│    - 流式捕获 stdout/stderr     │
└───────────────┬─────────────────┘
                │
                ↓
┌─────────────────────────────────┐
│ 5. 结果处理                      │
│    - 输出截断/压缩              │
│    - 图像输出处理               │
│    - Git 操作追踪               │
│    - 文件历史追踪               │
└─────────────────────────────────┘
```

#### 安全检查清单 (bashSecurity.ts)

```typescript
const BASH_SECURITY_CHECK_IDS = {
  INCOMPLETE_COMMANDS: 1,           // 不完整命令
  JQ_SYSTEM_FUNCTION: 2,            // jq system() 函数
  JQ_FILE_ARGUMENTS: 3,             // jq 文件参数
  OBFUSCATED_FLAGS: 4,              // 混淆标志
  SHELL_METACHARACTERS: 5,          // Shell 元字符
  DANGEROUS_VARIABLES: 6,           // 危险变量 ($PATH 等)
  NEWLINES: 7,                      // 换行注入
  DANGEROUS_PATTERNS_COMMAND_SUBSTITUTION: 8,  // $() 替换
  DANGEROUS_PATTERNS_INPUT_REDIRECTION: 9,     // < 重定向
  DANGEROUS_PATTERNS_OUTPUT_REDIRECTION: 10,   // > 重定向
  IFS_INJECTION: 11,                // IFS 注入
  GIT_COMMIT_SUBSTITUTION: 12,      // Git commit 替换
  PROC_ENVIRON_ACCESS: 13,          // /proc 访问
  MALFORMED_TOKEN_INJECTION: 14,    // Token 注入
  BACKSLASH_ESCAPED_WHITESPACE: 15, // 反斜杠转义
  BRACE_EXPANSION: 16,              // 大括号展开
  CONTROL_CHARACTERS: 17,           // 控制字符
  UNICODE_WHITESPACE: 18,           // Unicode 空白
  MID_WORD_HASH: 19,                // 词中#
  ZSH_DANGEROUS_COMMANDS: 20,       // Zsh 危险命令
  BACKSLASH_ESCAPED_OPERATORS: 21,  // 转义操作符
  COMMENT_QUOTE_DESYNC: 22,         // 注释引号失配
  QUOTED_NEWLINE: 23,               // 引号内换行
}
```

#### 危险模式检测

```typescript
const COMMAND_SUBSTITUTION_PATTERNS = [
  { pattern: /<\(/, message: 'process substitution <()' },
  { pattern: />\(/, message: 'process substitution >()' },
  { pattern: /\$\(/, message: '$() command substitution' },
  { pattern: /\$\{/, message: '${} parameter substitution' },
  { pattern: /~\[/, message: 'Zsh parameter expansion' },
  { pattern: /\(e:/, message: 'Zsh glob qualifiers' },
  // Zsh 等于展开（绕过安全检查）
  { pattern: /(?:^|[\s;&|])=[a-zA-Z_]/, message: 'Zsh equals expansion (=cmd)' },
]

const ZSH_DANGEROUS_COMMANDS = new Set([
  'zmodload',    // 模块加载（危险网关）
  'emulate',     // 模拟模式（eval 等价）
  'sysopen',     // 文件描述符操作
  'zpty',        // 伪终端执行
  'ztcp',        // TCP 连接（数据外泄）
  'zf_rm',       // 内置 rm（绕过检查）
  // ... 更多
])
```

#### 命令语义分类

```typescript
// 搜索命令（可折叠显示）
const BASH_SEARCH_COMMANDS = new Set([
  'find', 'grep', 'rg', 'ag', 'ack', 'locate', 'which', 'whereis'
])

// 读取命令（可折叠显示）
const BASH_READ_COMMANDS = new Set([
  'cat', 'head', 'tail', 'less', 'more',
  'wc', 'stat', 'file', 'strings',
  'jq', 'awk', 'cut', 'sort', 'uniq', 'tr'
])

// 目录列表命令（单独分类）
const BASH_LIST_COMMANDS = new Set([
  'ls', 'tree', 'du'
])

// 静默命令（成功时无输出）
const BASH_SILENT_COMMANDS = new Set([
  'mv', 'cp', 'rm', 'mkdir', 'rmdir',
  'chmod', 'chown', 'touch', 'ln', 'cd'
])
```

---

### 1.7 `AppStateStore.ts` (22KB) - 状态存储

#### 职责
- **统一状态**：应用全局状态的单一事实来源
- **状态切片**：Settings、Tasks、MCP、Plugins、Bridge 等
- **变更通知**：订阅者模式通知 UI 更新

#### 状态结构

```typescript
export type AppState = {
  // 配置
  settings: SettingsJson
  verbose: boolean
  mainLoopModel: ModelSetting
  
  // UI 状态
  statusLineText: string | undefined
  expandedView: 'none' | 'tasks' | 'teammates'
  footerSelection: FooterItem | null
  
  // 权限上下文
  toolPermissionContext: ToolPermissionContext
  
  // 特性标志
  kairosEnabled: boolean  // Assistant 模式
  
  // 远程会话
  remoteSessionUrl: string | undefined
  remoteConnectionStatus: 'connecting' | 'connected' | 'reconnecting' | 'disconnected'
  
  // Bridge (IDE 集成)
  replBridgeEnabled: boolean
  replBridgeConnected: boolean
  replBridgeSessionActive: boolean
  
  // 任务系统
  tasks: { [taskId: string]: TaskState }
  
  // MCP
  mcp: {
    clients: MCPServerConnection[]
    tools: Tool[]
    commands: Command[]
    resources: Record<string, ServerResource[]>
  }
  
  // 插件
  plugins: {
    enabled: LoadedPlugin[]
    disabled: LoadedPlugin[]
    errors: PluginError[]
  }
  
  // 推测执行
  speculation: SpeculationState
  
  // ... 更多
}
```

#### 状态更新模式

```typescript
// 创建 store
const store = createStore<AppState>(getDefaultAppState(), onChangeAppState)

// 更新状态（不可变模式）
store.setState(prev => ({
  ...prev,
  mcp: {
    ...prev.mcp,
    clients: newClients,
  }
}))

// 订阅变更
store.subscribe(() => {
  // UI 重新渲染
})
```

---

### 1.8 `store.ts` (836B) - 最小状态管理

#### 职责
- **发布订阅**：简单的状态管理原语

#### 实现

```typescript
type Listener = () => void
type OnChange<T> = (args: { newState: T; oldState: T }) => void

export type Store<T> = {
  getState: () => T
  setState: (updater: (prev: T) => T) => void
  subscribe: (listener: Listener) => () => void
}

export function createStore<T>(
  initialState: T,
  onChange?: OnChange<T>,
): Store<T> {
  let state = initialState
  const listeners = new Set<Listener>()

  return {
    getState: () => state,

    setState: (updater: (prev: T) => T) => {
      const prev = state
      const next = updater(prev)
      if (Object.is(next, prev)) return  // 无变更不通知
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

## 🔀 第二部分：调用关系图

### 2.1 主调用链（用户输入 → 工具执行）

```
┌─────────────────────────────────────────────────────────────────────┐
│                           用户输入                                   │
│                    (命令行 / 对话消息)                                │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ main.tsx (入口)                                                      │
│  - parse CLI args                                                    │
│  - init()                                                            │
│  - renderAndRun(<App />)                                            │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ App.tsx (主组件)                                                     │
│  - REPL.tsx (交互式输入)                                            │
│  - PromptInput.tsx (用户输入框)                                      │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ query.ts (查询编排)                                                  │
│  - query() 生成器                                                    │
│  - queryLoop() 主循环                                                │
│  - buildAPIRequest()                                                │
│  - callClaudeAPI() (流式)                                           │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              │                               │
              ↓                               ↓
    [流式响应事件]                    [检测到 tool_use]
              │                               │
              │                               ↓
              │                    ┌─────────────────────────────────┐
              │                    │ QueryEngine.ts                  │
              │                    │  - submitMessage()              │
              │                    │  - wrappedCanUseTool()          │
              │                    └───────────────┬─────────────────┘
              │                                    │
              │                                    ↓
              │                    ┌─────────────────────────────────┐
              │                    │ useCanUseTool.tsx               │
              │                    │  - 检查权限规则                  │
              │                    │  - 弹出确认对话框                │
              │                    │  - 返回 allow/deny/ask          │
              │                    └───────────────┬─────────────────┘
              │                                    │
              │                          ┌─────────┴─────────┐
              │                          │                   │
              │                    [允许]               [拒绝]
              │                          │                   │
              │                          ↓                   ↓
              │              ┌───────────────────┐  ┌─────────────────┐
              │              │ tools/BashTool/   │  │ 返回错误结果    │
              │              │  - execute()      │  │                 │
              │              │  - 安全检查        │  │                 │
              │              │  - spawnShellTask │  │                 │
              │              └─────────┬─────────┘  │                 │
              │                        │            │                 │
              │                        ↓            │                 │
              │              ┌───────────────────┐  │                 │
              │              │ services/tools/   │  │                 │
              │              │ StreamingToolExecutor ││              │
              │              └─────────┬─────────┘  │                 │
              │                        │            │                 │
              │                        ↓            ↓                 │
              └────────────────────────┴────────────┴─────────────────┘
                                       │
                                       ↓
                          ┌─────────────────────────┐
                          │ 结果回灌到 query 循环     │
                          │ - 构建 tool_result     │
                          │ - 继续循环或完成        │
                          └───────────┬─────────────┘
                                      │
                                      ↓
                          ┌─────────────────────────┐
                          │ Ink 组件渲染输出         │
                          │ - 工具结果消息          │
                          │ - 进度显示              │
                          └─────────────────────────┘
```

---

### 2.2 状态变更流程

```
┌─────────────────────────────────────────────────────────────────────┐
│ 工具执行/用户操作                                                    │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ AppStateStore.setState()                                           │
│  (不可变更新：prev => ({ ...prev, ...changes }))                   │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ onChangeAppState() (变更处理器)                                      │
│  - 持久化到磁盘 (settings)                                          │
│  - 发送遥测事件                                                      │
│  - 触发副作用 (MCP 重连等)                                           │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ Store 通知所有订阅者                                                 │
│  listeners.forEach(fn => fn())                                      │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ Ink 组件重新渲染                                                      │
│  - React 检测到状态变更                                               │
│  - 重新渲染受影响的组件                                              │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 2.3 工具权限检查流程

```
┌─────────────────────────────────────────────────────────────────────┐
│ QueryEngine.submitMessage()                                         │
│  检测到 tool_use                                                    │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ wrappedCanUseTool() (QueryEngine 内包装)                            │
│  - 调用 canUseTool()                                                │
│  - 追踪 permission denials                                          │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ useCanUseTool.tsx (Hook)                                           │
│                                                                     │
│  1. 检查工具是否在 alwaysAllowRules                                 │
│     → 直接 allow                                                    │
│                                                                     │
│  2. 检查工具是否在 alwaysDenyRules                                  │
│     → 直接 deny                                                     │
│                                                                     │
│  3. 检查是否在 alwaysAskRules                                       │
│     → 弹出确认对话框                                                │
│                                                                     │
│  4. 检查拒绝次数阈值                                                │
│     → 超过阈值后自动 deny                                           │
│                                                                     │
│  5. 检查模式 (bypass/auto/default)                                 │
│     → bypass: 自动 allow (危险工具除外)                             │
│     → auto: 自动 allow (需用户事先同意)                             │
│     → default: 正常检查                                             │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
              ↓               ↓               ↓
         [allow]          [deny]          [ask]
              │               │               │
              │               │               ↓
              │               │    ┌─────────────────────┐
              │               │    │ 权限确认对话框       │
              │               │    │ - 显示命令详情       │
              │               │    │ - 用户选择 Allow/Deny│
              │               │    └──────────┬──────────┘
              │               │               │
              │               │      ┌────────┴────────┐
              │               │      │                 │
              │               │   [Allow]           [Deny]
              │               │      │                 │
              └───────────────┴──────┴─────────────────┘
                                  │
                                  ↓
                    返回 PermissionResult
```

---

### 2.4 MCP 工具调用流程

```
┌─────────────────────────────────────────────────────────────────────┐
│ 模型返回 MCP 工具调用                                                 │
│  { name: "mcp__server__resource", input: {...} }                    │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ MCPTool.execute()                                                   │
│  - 解析 server/resource/method                                      │
│  - 查找 MCPServerConnection                                         │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ services/mcp/client.ts                                              │
│  - callMCPTool(serverName, toolName, input)                         │
│  - 通过 stdio/WebSocket 发送请求                                     │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ MCP Server (外部进程)                                               │
│  - 执行工具逻辑                                                      │
│  - 返回结果                                                         │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 结果返回到 QueryEngine                                              │
│  - 格式化为 tool_result                                             │
│  - 回灌到模型                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🎨 第三部分：设计模式提取

### 3.1 核心设计模式

#### 1. 生成器模式 (Generator Pattern)

**用途**: 流式处理、查询循环、工具执行

```typescript
// query.ts - 查询生成器
async function* query(params: QueryParams): AsyncGenerator<StreamEvent | Message, Terminal> {
  while (true) {
    // 调用 API
    const stream = callClaudeAPI(...)
    
    // 流式处理
    for await (const event of stream) {
      yield event  // 推送给 UI
    }
    
    // 检查工具调用
    if (hasToolUse) {
      const results = yield* runTools(...)  // 嵌套生成器
      continue
    }
    
    return { type: 'complete' }
  }
}

// QueryEngine.ts - 消息提交生成器
async *submitMessage(prompt: string): AsyncGenerator<SDKMessage, void, unknown> {
  // 处理消息
  for await (const event of query(...)) {
    yield formatForSDK(event)
  }
}
```

**优点**:
- 自然表达异步流
- 支持嵌套生成器（`yield*`）
- 可随时暂停/恢复

---

#### 2. 建造者模式 (Builder Pattern)

**用途**: 工具构建、消息构建、请求构建

```typescript
// Tool.ts - 工具构建器
export function buildTool(def: ToolDef): Tool {
  return {
    name: def.name,
    description: def.description,
    inputSchema: def.inputSchema,
    
    async execute(input, context) {
      // 标准化执行流程
      const validation = def.validate?.(input, context)
      if (!validation.result) return errorResult(validation.message)
      
      const result = await def.run(input, context)
      return formatResult(result)
    },
    
    render: def.render,
    isEnabled: def.isEnabled,
  }
}

// messages.ts - 消息构建器
export function createUserMessage(options: {
  content: string | ContentBlockParam[]
  toolUseResult?: string
  sourceToolAssistantUUID?: string
}): UserMessage {
  return {
    type: 'user',
    uuid: randomUUID(),
    createdAt: Date.now(),
    ...options,
  }
}
```

**优点**:
- 统一接口
- 复用执行逻辑
- 易于测试

---

#### 3. 策略模式 (Strategy Pattern)

**用途**: 权限模式、工具执行策略、压缩策略

```typescript
// 权限模式策略
type PermissionMode = 'default' | 'bypass' | 'auto'

const permissionStrategies: Record<PermissionMode, PermissionStrategy> = {
  default: {
    checkPermission: (tool, input) => {
      // 正常检查规则
    }
  },
  bypass: {
    checkPermission: (tool, input) => {
      // 自动允许（危险工具除外）
    }
  },
  auto: {
    checkPermission: (tool, input) => {
      // 自动模式逻辑
    }
  }
}

// 使用
const strategy = permissionStrategies[mode]
const result = strategy.checkPermission(tool, input)
```

**优点**:
- 运行时切换策略
- 新增策略无需修改调用方
- 单一职责

---

#### 4. 观察者模式 (Observer Pattern)

**用途**: 状态管理、事件通知、UI 更新

```typescript
// store.ts - 发布订阅
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
      
      // 通知所有观察者
      onChange?.({ newState: next, oldState: prev })
      for (const listener of listeners) listener()
    },

    subscribe: (listener: Listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

// 使用
store.subscribe(() => {
  // UI 重新渲染
})

store.setState(prev => ({ ...prev, tasks: newTasks }))
```

**优点**:
- 松耦合
- 支持多订阅者
- 自动通知

---

#### 5. 装饰器模式 (Decorator Pattern)

**用途**: 权限包装、日志包装、重试包装

```typescript
// QueryEngine.ts - 权限拒绝追踪装饰器
const wrappedCanUseTool: CanUseToolFn = async (...) => {
  // 原始调用
  const result = await canUseTool(...)
  
  // 装饰：追踪拒绝
  if (result.behavior !== 'allow') {
    this.permissionDenials.push({
      tool_name: sdkCompatToolName(tool.name),
      tool_use_id: toolUseID,
      tool_input: input,
    })
  }
  return result
}

// services/api/withRetry.ts - 重试装饰器
export function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  return retryWrapper(fn, { maxRetries: 3, backoff: 'exponential' })
}
```

**优点**:
- 动态添加职责
- 无需修改原函数
- 可组合

---

#### 6. 责任链模式 (Chain of Responsibility)

**用途**: 安全检查、中间件、请求处理

```typescript
// bashSecurity.ts - 安全检查链
const securityChecks: SecurityCheck[] = [
  checkIncompleteCommands,
  checkJqSystemFunction,
  checkShellMetacharacters,
  checkDangerousVariables,
  checkCommandSubstitution,
  checkIfsInjection,
  // ... 24 项检查
]

async function validateCommand(command: string): Promise<ValidationResult> {
  for (const check of securityChecks) {
    const result = await check(command)
    if (!result.passed) {
      return { 
        valid: false, 
        errorCode: result.code,
        message: result.message 
      }
    }
  }
  return { valid: true }
}
```

**优点**:
- 每个检查独立
- 易于增删检查
- 短路优化

---

#### 7. 状态机模式 (State Machine)

**用途**: 查询循环、远程连接状态、推测执行状态

```typescript
// 远程连接状态机
type RemoteConnectionStatus = 
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'

// 推测执行状态机
type SpeculationState =
  | { status: 'idle' }
  | {
      status: 'active'
      id: string
      abort: () => void
      startTime: number
      isPipelined: boolean
      // ...
    }

// 查询循环终止状态
type Terminal = 
  | { type: 'complete' }
  | { type: 'error'; error: Error }
  | { type: 'cancelled' }
```

**优点**:
- 状态明确
- 转换可控
- 类型安全

---

#### 8. 工厂模式 (Factory Pattern)

**用途**: 工具创建、消息创建、会话创建

```typescript
// tools.ts - 工具工厂
export function getTools(): Tools {
  return [
    AgentTool,
    BashTool,
    FileEditTool,
    // ...
  ].filter(tool => tool.isEnabled?.() ?? true)
}

// messages.ts - 消息工厂
export function createSystemMessage(content: string): SystemMessage {
  return {
    type: 'system',
    uuid: randomUUID(),
    content,
    createdAt: Date.now(),
  }
}

// server/createDirectConnectSession.ts - 会话工厂
export function createDirectConnectSession(options: SessionOptions): Session {
  // 复杂创建逻辑
  return new Session(options)
}
```

**优点**:
- 集中创建逻辑
- 隐藏实现细节
- 易于替换

---

### 3.2 架构模式

#### 1. 分层架构 (Layered Architecture)

```
┌─────────────────────────────────────────┐
│ 表现层 (Presentation)                    │
│ - Ink 组件 (146 个)                      │
│ - React Hooks (87 个)                    │
├─────────────────────────────────────────┤
│ 状态层 (State)                           │
│ - AppStateStore                          │
│ - Store (发布订阅)                       │
├─────────────────────────────────────────┤
│ 业务逻辑层 (Business Logic)              │
│ - QueryEngine                            │
│ - query.ts (查询循环)                    │
│ - Tool.ts (工具抽象)                     │
├─────────────────────────────────────────┤
│ 服务层 (Services)                        │
│ - MCP/LSP/OAuth/Analytics                │
│ - 38 个服务模块                          │
├─────────────────────────────────────────┤
│ 数据访问层 (Data Access)                 │
│ - 文件系统                               │
│ - SQLite (记忆存储)                      │
│ - API 客户端                             │
└─────────────────────────────────────────┘
```

---

#### 2. 事件驱动架构 (Event-Driven Architecture)

```typescript
// 事件源
emit('tool_use', { toolName, input })
emit('tool_result', { toolName, result })
emit('permission_denied', { toolName, reason })

// 事件处理器
on('tool_use', async (event) => {
  const result = await executeTool(event)
  emit('tool_result', result)
})

// 状态变更事件
onChangeAppState({ newState, oldState }) {
  if (newState.mcp.clients !== oldState.mcp.clients) {
    // MCP 客户端变更 → 触发重连
  }
}
```

---

#### 3. CQRS 模式 (Command Query Responsibility Segregation)

```typescript
// 命令（改变状态）
store.setState(prev => ({ ...prev, tasks: newTasks }))
dispatch({ type: 'TASK_CREATE', payload: task })

// 查询（读取状态）
const tasks = store.getState().tasks
const mcpClients = getAppState().mcp.clients

// 分离读写
const commandBus = createCommandBus()
const queryBus = createQueryBus()
```

---

### 3.3 工程实践

#### 1. 编译时特性标志 (Compile-Time Feature Flags)

```typescript
// Bun 编译时 DCE
const coordinatorModeModule = feature('COORDINATOR_MODE')
  ? require('./coordinator/coordinatorMode.js')
  : null

// 编译后未启用代码被完全移除
// 零运行时开销
```

**优点**:
- 零运行时开销
- 类型安全
- 按需打包

---

#### 2. 懒加载打破循环依赖

```typescript
// 懒加载
const getTeammateUtils = () => require('./utils/teammate.js')

// 使用时
const teammate = getTeammateUtils()
teammate.someFunction()
```

**优点**:
- 打破循环依赖
- 按需加载
- 减少初始加载时间

---

#### 3. 不可变状态更新

```typescript
// 错误做法（可变）
state.tasks[taskId] = newTask

// 正确做法（不可变）
store.setState(prev => ({
  ...prev,
  tasks: {
    ...prev.tasks,
    [taskId]: newTask,
  }
}))
```

**优点**:
- 可预测
- 易于调试
- 支持时间旅行

---

#### 4. 类型安全的事件系统

```typescript
type StreamEvent =
  | { type: 'message'; message: Message }
  | { type: 'tool_use'; toolUse: ToolUseBlock }
  | { type: 'error'; error: Error }
  | { type: 'complete' }

// 类型守卫
function isToolUseEvent(event: StreamEvent): event is { type: 'tool_use' } {
  return event.type === 'tool_use'
}

// 使用
if (isToolUseEvent(event)) {
  // TypeScript 知道 event.toolUse 存在
  executeTool(event.toolUse)
}
```

---

## 📋 第四部分：可借鉴的设计

### 4.1 对 OpenClaw 的启示

#### 1. 工具系统设计

**Claude Code**:
```typescript
// 统一工具抽象
export interface Tool {
  name: string
  inputSchema: ToolInputJSONSchema
  execute(input, context): Promise<ToolResult>
  validate?(input, permissionContext): ValidationResult
  render?(input, status): React.ReactNode
}

// 工具构建器
buildTool(def: ToolDef)
```

**OpenClaw 可借鉴**:
- 统一工具接口
- 添加 `validate()` 方法进行权限预检
- 添加 `render()` 方法支持 UI 展示
- 使用 `buildTool()` 工厂函数

---

#### 2. 权限系统

**Claude Code**:
```typescript
// 三层权限规则
type ToolPermissionContext = {
  alwaysAllowRules: ToolPermissionRulesBySource
  alwaysDenyRules: ToolPermissionRulesBySource
  alwaysAskRules: ToolPermissionRulesBySource
}

// 权限模式
type PermissionMode = 'default' | 'bypass' | 'auto'
```

**OpenClaw 可借鉴**:
- 三层规则（Always Allow/Deny/Ask）
- 权限模式切换
- 拒绝次数追踪（超过阈值自动拒绝）

---

#### 3. 安全检查链

**Claude Code**:
```typescript
// 24 项 Bash 安全检查
const securityChecks = [
  checkIncompleteCommands,
  checkJqSystemFunction,
  checkShellMetacharacters,
  // ...
]

// 责任链模式
for (const check of securityChecks) {
  if (!check(command)) return deny()
}
```

**OpenClaw 可借鉴**:
- 为 exec 工具添加安全检查链
- 危险命令检测
- 注入防护

---

#### 4. 状态管理

**Claude Code**:
```typescript
// 最小状态管理原语
createStore(initialState, onChange)

// 不可变更新
setState(prev => ({ ...prev, ...changes }))
```

**OpenClaw 可借鉴**:
- 简化状态管理（无需 Redux 复杂度）
- 不可变更新模式
- 变更通知机制

---

#### 5. 生成器驱动查询循环

**Claude Code**:
```typescript
async function* query(): AsyncGenerator<StreamEvent, Terminal> {
  while (true) {
    const stream = callAPI()
    for await (const event of stream) {
      yield event
    }
    if (hasToolUse) {
      yield* runTools()
      continue
    }
    return { type: 'complete' }
  }
}
```

**OpenClaw 可借鉴**:
- 使用生成器处理流式响应
- 嵌套生成器处理工具调用
- 清晰的循环终止条件

---

#### 6. 编译时特性标志

**Claude Code**:
```typescript
const module = feature('FEATURE_NAME')
  ? require('./module.js')
  : null
```

**OpenClaw 可借鉴**:
- 使用 Bun 的 `feature()` 进行编译时 DCE
- 条件加载模块
- 零运行时开销

---

## 🎯 第五部分：下一步行动

### 建议深入分析的模块

1. **MCP 集成** (`services/mcp/`) - 25 文件
   - MCP 协议实现
   - 服务器管理
   - 资源发现

2. **技能系统** (`skills/`) - 6 文件
   - 技能加载
   - 技能发现
   - 与 OpenClaw Skills 对比

3. **插件系统** (`plugins/`) - 5 文件
   - 插件发现
   - 插件安装
   - 插件生命周期

4. **IDE 桥接** (`bridge/`) - 33 文件
   - 桥接协议
   - VSCode 集成
   - 远程会话

5. **多代理协调** (`coordinator/`) - 3 文件
   - 代理池管理
   - 任务分配
   - 结果聚合

---

_分析完成时间：2026-04-02 13:30_
