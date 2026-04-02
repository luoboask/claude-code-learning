# Agent CLI 架构学习指南

> 📚 基于 Claude Code CLI 源码的系統化学习路径  
> ⏱️ 预计学习时间：20-40 小时  
> 🎯 目标：掌握现代 Agent CLI 的完整架构设计

---

## 📖 学习路线图

```
第 1 阶段：基础认知 (2-4 小时)
    │
    ├─→ 1.1 什么是 Agent CLI？
    ├─→ 1.2 核心组件概览
    └─→ 1.3 技术栈解析
    │
    ↓
第 2 阶段：核心循环 (6-8 小时)
    │
    ├─→ 2.1 用户输入处理
    ├─→ 2.2 模型调用流程
    ├─→ 2.3 工具调用机制
    └─→ 2.4 结果回灌与迭代
    │
    ↓
第 3 阶段：工具系统 (6-8 小时)
    │
    ├─→ 3.1 工具抽象接口
    ├─→ 3.2 工具注册与发现
    ├─→ 3.3 工具执行编排
    └─→ 3.4 权限与安全
    │
    ↓
第 4 阶段：状态与 UI (4-6 小时)
    │
    ├─→ 4.1 状态管理原语
    ├─→ 4.2 终端 UI 渲染
    └─→ 4.3 流式处理
    │
    ↓
第 5 阶段：扩展系统 (4-6 小时)
    │
    ├─→ 5.1 Skills 系统
    ├─→ 5.2 Plugins 系统
    └─→ 5.3 MCP 集成
    │
    ↓
第 6 阶段：实战演练 (4-8 小时)
    │
    ├─→ 6.1 实现一个新工具
    ├─→ 6.2 实现一个 Skill
    └─→ 6.3 实现安全检查
    │
    ↓
完成！✅
```

---

# 第 1 阶段：基础认知 (2-4 小时)

## 1.1 什么是 Agent CLI？

### 定义
```
Agent CLI = 终端界面 + AI 模型 + 工具系统 + 权限控制

用户通过自然语言与 AI 交互，AI 通过工具执行实际任务。
```

### 核心价值
```
✅ 自然语言编程 - 用说话的方式写代码
✅ 自动化重复任务 - 让 AI 执行繁琐操作
✅ 知识辅助 - AI 知道最佳实践
✅ 安全执行 - 权限控制保护系统
```

### 典型工作流程
```
┌─────────────┐
│ 用户输入     │ "帮我修复这个 bug"
└──────┬──────┘
       │
       ↓
┌─────────────┐
│ AI 理解意图   │ 分析需求，规划步骤
└──────┬──────┘
       │
       ↓
┌─────────────┐
│ 工具调用     │ 读取文件 → 分析问题 → 修改代码
└──────┬──────┘
       │
       ↓
┌─────────────┐
│ 权限检查     │ 用户确认是否允许修改
└──────┬──────┘
       │
       ↓
┌─────────────┐
│ 执行并反馈   │ 显示修改结果
└─────────────┘
```

---

## 1.2 核心组件概览

### 6 层架构图
```
┌─────────────────────────────────────────────────────────────┐
│ 用户交互层                                                   │
│ CLI 参数 | 对话输入 | Slash Commands                         │
├─────────────────────────────────────────────────────────────┤
│ 表现层 (Ink/React)                                          │
│ 146 个组件 | 终端渲染 | 流式输出                            │
├─────────────────────────────────────────────────────────────┤
│ 状态管理层                                                   │
│ createStore | AppState | 不可变更新                         │
├─────────────────────────────────────────────────────────────┤
│ 核心引擎层                                                   │
│ QueryEngine | query 循环 | 模型调用                          │
├─────────────────────────────────────────────────────────────┤
│ 工具层                                                       │
│ 45 个工具 | 权限检查 | 并发/串行执行                        │
├─────────────────────────────────────────────────────────────┤
│ 服务层                                                       │
│ MCP | LSP | OAuth | Analytics | Voice                      │
└─────────────────────────────────────────────────────────────┘
```

### 核心文件清单
| 文件 | 作用 | 学习时间 |
|------|------|----------|
| `src/main.tsx` | CLI 入口 | 30 分钟 |
| `src/query.ts` | 查询编排 | 60 分钟 |
| `src/QueryEngine.ts` | 会话引擎 | 45 分钟 |
| `src/Tool.ts` | 工具抽象 | 30 分钟 |
| `src/tools.ts` | 工具注册表 | 15 分钟 |
| `src/state/store.ts` | 状态管理 | 15 分钟 |

---

## 1.3 技术栈解析

### 核心技术
```
TypeScript  → 类型安全
Bun         → 运行时 + 编译时 DCE
React       → 组件模型
Ink         → 终端 UI 渲染
Anthropic API → AI 模型调用
```

### 关键依赖
```json
{
  "@anthropic-ai/sdk": "AI API 客户端",
  "@modelcontextprotocol/sdk": "MCP 协议",
  "@commander-js/extra-typings": "CLI 参数解析",
  "ink": "终端 UI 框架",
  "react": "组件模型",
  "zod": "Schema 验证"
}
```

---

# 第 2 阶段：核心循环 (6-8 小时)

## 2.1 用户输入处理

### 输入类型
```typescript
// 1. 命令行参数
$ claude "fix the bug in src/index.ts"

// 2. 交互式对话
> 帮我写个测试
> 再添加一个功能

// 3. Slash Commands
> /config set model opus
> /review PR #123
```

### 处理流程
```
用户输入
    │
    ↓
┌─────────────────────────────────┐
│ processUserInput()              │
│ - 解析 Slash Commands          │
│ - 处理附件 (文件/图片)          │
│ - 提取上下文信息                │
└───────────────┬─────────────────┘
                │
                ↓
┌─────────────────────────────────┐
│ 构建消息数组                     │
│ messages.push(userMessage)      │
└───────────────┬─────────────────┘
                │
                ↓
┌─────────────────────────────────┐
│ 持久化到 transcript              │
│ recordTranscript(messages)      │
└─────────────────────────────────┘
```

### 代码示例
```typescript
// query.ts - 处理用户输入
const {
  messages: messagesFromUserInput,
  shouldQuery,
  allowedTools,
  resultText,
} = await processUserInput({
  input: prompt,
  mode: 'prompt',
  context: processUserInputContext,
  messages: this.mutableMessages,
})

// 推送到消息数组
this.mutableMessages.push(...messagesFromUserInput)

// 持久化
if (persistSession) {
  await recordTranscript(messages)
}
```

---

## 2.2 模型调用流程

### 流式 API 调用
```typescript
// query.ts - 模型调用
for await (const message of deps.callModel({
  messages: prependUserContext(messagesForQuery, userContext),
  systemPrompt: fullSystemPrompt,
  thinkingConfig: toolUseContext.options.thinkingConfig,
  tools: toolUseContext.options.tools,
  signal: toolUseContext.abortController.signal,
  model: currentModel,
})) {
  // 处理流式事件
  if (message.type === 'tool_use') {
    toolUseBlocks.push(message)
  }
  yield message  // 推送给 UI
}
```

### 消息类型
```typescript
type Message =
  | UserMessage         // 用户消息
  | AssistantMessage    // AI 回复
  | SystemMessage       // 系统消息
  | ToolUseMessage      // 工具调用
  | ToolResultMessage   // 工具结果
  | CompactBoundary     // 压缩边界
```

### 系统提示构建
```typescript
// query.ts - 构建系统提示
const {
  defaultSystemPrompt,
  userContext,
  systemContext,
} = await fetchSystemPromptParts({
  tools,
  mainLoopModel,
  mcpClients,
  customSystemPrompt,
})

const systemPrompt = asSystemPrompt([
  customPrompt ?? defaultSystemPrompt,
  appendSystemPrompt,
])
```

---

## 2.3 工具调用机制

### 工具调用检测
```typescript
// 检测 tool_use 块
if (message.type === 'tool_use') {
  toolUseBlocks.push(message)
}

// 执行工具
if (toolUseBlocks.length > 0) {
  for await (const update of runTools(
    toolUseBlocks,
    assistantMessages,
    canUseTool,
    toolUseContext,
  )) {
    yield update.message
  }
}
```

### 工具执行流程
```
┌─────────────────────────────────┐
│ 1. 查找工具                      │
│ findToolByName(tools, toolName) │
└───────────────┬─────────────────┘
                │
                ↓
┌─────────────────────────────────┐
│ 2. 权限检查                      │
│ canUseTool(tool, input, ...)   │
└───────────────┬─────────────────┘
                │
          ┌─────┴─────┐
          │           │
     [允许]       [拒绝]
          │           │
          ↓           ↓
┌──────────────┐  ┌──────────────┐
│ 3. 执行工具   │  │ 返回错误     │
│ tool.call()  │  │              │
└──────┬───────┘  └──────────────┘
       │
       ↓
┌─────────────────────────────────┐
│ 4. 格式化结果                    │
│ ToolResult { data, newMessages }│
└───────────────┬─────────────────┘
                │
                ↓
┌─────────────────────────────────┐
│ 5. 结果回灌                      │
│ messages.push(toolResult)       │
└─────────────────────────────────┘
```

---

## 2.4 结果回灌与迭代

### 查询循环
```typescript
// query.ts - 主循环
async function* queryLoop(params): AsyncGenerator<..., Terminal> {
  while (true) {
    // 1. 调用模型
    for await (const message of callModel({...})) {
      yield message
      if (message.type === 'tool_use') {
        toolUseBlocks.push(message)
      }
    }
    
    // 2. 执行工具
    if (toolUseBlocks.length > 0) {
      for await (const update of runTools(...)) {
        yield update.message
      }
      // 结果回灌
      state.messages.push(...toolResults)
      continue  // 继续循环
    }
    
    // 3. 完成
    return { type: 'complete' }
  }
}
```

### 迭代示例
```
用户："帮我修复这个 bug"
    │
    ↓
AI: [思考] 需要读取文件分析问题
    │
    ↓
AI: [调用 FileReadTool] 读取 src/index.ts
    │
    ↓
系统: [执行] 读取文件成功
    │
    ↓
AI: [分析] 发现第 10 行有空指针问题
    │
    ↓
AI: [调用 FileEditTool] 修复第 10 行
    │
    ↓
系统: [执行] 需要用户确认权限
    │
    ↓
用户: [确认] 允许修改
    │
    ↓
系统: [执行] 修改成功
    │
    ↓
AI: "已修复 bug，在第 10 行添加了空值检查"
    │
    ↓
完成 ✅
```

---

# 第 3 阶段：工具系统 (6-8 小时)

## 3.1 工具抽象接口

### 完整接口定义
```typescript
export type Tool<Input, Output, Progress> = {
  // 基础属性
  readonly name: string
  aliases?: string[]
  searchHint?: string
  
  // Schema
  readonly inputSchema: Input  // Zod Schema
  outputSchema?: z.ZodType<unknown>
  
  // 核心方法
  call(args, context, canUseTool, parentMessage, onProgress): Promise<ToolResult<Output>>
  
  // 权限与验证
  validateInput?(input, context): Promise<ValidationResult>
  checkPermissions(input, context): Promise<PermissionResult>
  
  // 特性检查
  isEnabled(): boolean
  isConcurrencySafe(input): boolean
  isReadOnly(input): boolean
  isDestructive?(input): boolean
  
  // UI 渲染
  renderToolUseMessage(input, options): React.ReactNode
  renderToolResultMessage(content, options): React.ReactNode
  
  // ... 共 40+ 字段
}
```

### 工具构建器
```typescript
const TOOL_DEFAULTS = {
  isEnabled: () => true,
  isConcurrencySafe: () => false,
  isReadOnly: () => false,
  isDestructive: () => false,
  checkPermissions: (input) => 
    Promise.resolve({ behavior: 'allow', updatedInput: input }),
  toAutoClassifierInput: () => '',
  userFacingName: () => '',
}

export function buildTool<D extends ToolDef>(def: D): BuiltTool<D> {
  return {
    ...TOOL_DEFAULTS,
    userFacingName: () => def.name,
    ...def,
  } as BuiltTool<D>
}
```

### 实现示例：BashTool
```typescript
export const BashTool = buildTool({
  name: 'Bash',
  description: 'Execute shell commands',
  inputSchema: z.object({
    command: z.string().describe('The command to execute'),
    timeout: z.number().optional(),
  }),
  
  async call(args, context, canUseTool, parentMessage, onProgress) {
    // 1. 安全检查
    const securityResult = validateBashCommand(args.command)
    if (securityResult.behavior === 'deny') {
      return { data: { error: securityResult.message } }
    }
    
    // 2. 执行命令
    const result = await exec(args.command, {
      timeout: args.timeout,
      cwd: context.options.cwd,
    })
    
    // 3. 返回结果
    return {
      data: {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
      },
    }
  },
  
  isConcurrencySafe(input) {
    // 读操作可并发
    return /^(ls|cat|head|tail|grep|find)\s/.test(input.command)
  },
  
  isReadOnly(input) {
    // 检查是否是只读命令
    return /^(ls|cat|head|tail|grep|find|wc)\s/.test(input.command)
  },
})
```

---

## 3.2 工具注册与发现

### 工具注册表
```typescript
// tools.ts - 工具注册
export function getAllBaseTools(): Tools {
  return [
    // 核心工具
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
    ...(process.env.USER_TYPE === 'ant' ? [REPLTool] : []),
  ].filter(tool => tool.isEnabled?.() ?? true)
}
```

### 工具查找
```typescript
export function findToolByName(tools: Tools, name: string): Tool | undefined {
  return tools.find(t => toolMatchesName(t, name))
}

export function toolMatchesName(
  tool: { name: string; aliases?: string[] },
  name: string,
): boolean {
  return tool.name === name || (tool.aliases?.includes(name) ?? false)
}
```

---

## 3.3 工具执行编排

### 并发/串行分区
```typescript
function partitionToolCalls(
  toolUseMessages: ToolUseBlock[],
  toolUseContext: ToolUseContext,
): Batch[] {
  return toolUseMessages.reduce((acc: Batch[], toolUse) => {
    const tool = findToolByName(tools, toolUse.name)
    const parsedInput = tool?.inputSchema.safeParse(toolUse.input)
    
    const isConcurrencySafe = parsedInput?.success
      ? tool?.isConcurrencySafe(parsedInput.data)
      : false
    
    if (isConcurrencySafe && acc[acc.length - 1]?.isConcurrencySafe) {
      // 合并到并发批
      acc[acc.length - 1].blocks.push(toolUse)
    } else {
      // 新建串行批
      acc.push({ isConcurrencySafe, blocks: [toolUse] })
    }
    return acc
  }, [])
}
```

### 并发执行
```typescript
async function* runToolsConcurrently(
  toolUseMessages: ToolUseBlock[],
  assistantMessages: AssistantMessage[],
  canUseTool: CanUseToolFn,
  toolUseContext: ToolUseContext,
): AsyncGenerator<MessageUpdate, void> {
  yield* all(
    toolUseMessages.map(async function* (toolUse) {
      yield* runToolUse(toolUse, assistantMessages, canUseTool, toolUseContext)
    }),
    getMaxToolUseConcurrency(),  // 默认 10
  )
}
```

### 串行执行
```typescript
async function* runToolsSerially(
  toolUseMessages: ToolUseBlock[],
  assistantMessages: AssistantMessage[],
  canUseTool: CanUseToolFn,
  toolUseContext: ToolUseContext,
): AsyncGenerator<MessageUpdate, void> {
  for (const toolUse of toolUseMessages) {
    for await (const update of runToolUse(...)) {
      yield update
    }
  }
}
```

---

## 3.4 权限与安全

### 三层权限规则
```typescript
type ToolPermissionContext = {
  mode: PermissionMode  // 'default' | 'bypass' | 'auto'
  
  alwaysAllowRules: ToolPermissionRulesBySource
  alwaysDenyRules: ToolPermissionRulesBySource
  alwaysAskRules: ToolPermissionRulesBySource
}

// 示例配置
{
  alwaysAllowRules: {
    command: { 'Bash': ['git *', 'ls *', 'cat *'] },
    file: { 'FileRead': ['/src/*'] },
  },
  alwaysDenyRules: {
    command: { 'Bash': ['rm *', 'curl *', 'wget *'] },
  },
  alwaysAskRules: {
    command: { 'Bash': ['*'] },  // 其他命令都询问
  },
}
```

### 权限检查流程
```typescript
export async function hasPermissionsToUseTool(
  tool: Tool,
  input: Record<string, unknown>,
  toolUseContext: ToolUseContext,
): Promise<PermissionResult> {
  const { toolPermissionContext } = toolUseContext.getAppState()
  
  // 1. 检查 alwaysAllow
  const allowRule = matchRule(toolPermissionContext.alwaysAllowRules, tool, input)
  if (allowRule) {
    return { behavior: 'allow', decisionReason: { type: 'rule', rule: allowRule } }
  }
  
  // 2. 检查 alwaysDeny
  const denyRule = matchRule(toolPermissionContext.alwaysDenyRules, tool, input)
  if (denyRule) {
    return { behavior: 'deny', decisionReason: { type: 'rule', rule: denyRule } }
  }
  
  // 3. 检查 alwaysAsk
  const askRule = matchRule(toolPermissionContext.alwaysAskRules, tool, input)
  if (askRule) {
    return { behavior: 'ask', decisionReason: { type: 'rule', rule: askRule } }
  }
  
  // 4. 检查模式
  if (toolPermissionContext.mode === 'bypass' && !isDangerousTool(tool)) {
    return { behavior: 'allow', decisionReason: { type: 'mode', mode: 'bypass' } }
  }
  
  // 5. 默认询问
  return { behavior: 'ask' }
}
```

### Bash 安全检查
```typescript
// 24 项安全检查示例
const BASH_SECURITY_CHECKS = [
  validateIncompleteCommands,
  validateJqSystemFunction,
  validateShellMetacharacters,
  validateDangerousVariables,
  validateCommandSubstitution,
  validateInputRedirection,
  validateOutputRedirection,
  validateIfsInjection,
  validateGitCommitSubstitution,
  validateProcEnvironAccess,
  validateZshDangerousCommands,
  // ... 共 24 项
]

async function validateBashCommand(command: string): Promise<PermissionResult> {
  const context = buildValidationContext(command)
  
  for (const check of BASH_SECURITY_CHECKS) {
    const result = await check(context)
    if (result.behavior !== 'passthrough') {
      return result  // 返回 allow/deny/ask
    }
  }
  
  return { behavior: 'allow' }
}
```

---

# 第 4 阶段：状态与 UI (4-6 小时)

## 4.1 状态管理原语

### createStore 实现
```typescript
type Listener = () => void
type OnChange<T> = (args: { newState: T; oldState: T }) => void

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
      
      // 无变更不通知
      if (Object.is(next, prev)) return
      
      state = next
      
      // 通知变更处理器
      onChange?.({ newState: next, oldState: prev })
      
      // 通知所有订阅者
      for (const listener of listeners) listener()
    },

    subscribe: (listener: Listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
```

### 不可变更新模式
```typescript
// ✅ 正确做法
store.setState(prev => ({
  ...prev,
  mcp: {
    ...prev.mcp,
    clients: newClients,
  }
}))

// ❌ 错误做法（可变）
state.mcp.clients = newClients
```

### 状态定义示例
```typescript
export type AppState = DeepImmutable<{
  // 配置
  settings: SettingsJson
  verbose: boolean
  mainLoopModel: ModelSetting
  
  // UI
  statusLineText: string | undefined
  expandedView: 'none' | 'tasks' | 'teammates'
  
  // 权限
  toolPermissionContext: ToolPermissionContext
  
  // MCP
  mcp: {
    clients: MCPServerConnection[]
    tools: Tool[]
    commands: Command[]
    resources: Record<string, ServerResource[]>
  }
  
  // 任务
  tasks: { [taskId: string]: TaskState }
  
  // ... 更多
}>
```

---

## 4.2 终端 UI 渲染

### Ink 基础
```typescript
import { Box, Text, useInput } from 'ink'
import React from 'react'

function MyComponent() {
  useInput((input, key) => {
    if (key.escape) {
      // 处理 ESC 键
    }
    if (input === 'q') {
      // 处理 q 键
    }
  })
  
  return (
    <Box flexDirection="column">
      <Text color="green">Hello World</Text>
      <Text dimColor>Press q to quit</Text>
    </Box>
  )
}
```

### 组件树结构
```
<App />
  ├── <Header />
  ├── <MessageList />
  │     ├── <UserMessage />
  │     ├── <AssistantMessage />
  │     └── <ToolResultMessage />
  ├── <PromptInput />
  └── <Footer />
```

### 流式输出
```typescript
function StreamingMessage({ stream }) {
  const [content, setContent] = useState('')
  
  useEffect(() => {
    const subscription = stream.subscribe(chunk => {
      setContent(prev => prev + chunk)
    })
    return () => subscription.unsubscribe()
  }, [stream])
  
  return <Text>{content}</Text>
}
```

---

## 4.3 流式处理

### 生成器模式
```typescript
async function* query(params): AsyncGenerator<StreamEvent, Terminal> {
  // 1. 流式 API 调用
  const stream = callClaudeAPI({...})
  
  for await (const event of stream) {
    // 2. 处理事件
    if (event.type === 'text_delta') {
      yield { type: 'message', content: event.text }
    }
    if (event.type === 'tool_use') {
      yield { type: 'tool_use', toolUse: event }
    }
  }
  
  // 3. 完成
  return { type: 'complete' }
}
```

### 嵌套生成器
```typescript
async function* queryLoop() {
  while (true) {
    // 调用模型
    for await (const message of callModel(...)) {
      yield message
    }
    
    // 执行工具（嵌套生成器）
    if (toolUseBlocks.length > 0) {
      yield* runTools(toolUseBlocks, ...)  // yield* 展开
      continue
    }
    
    return { type: 'complete' }
  }
}
```

---

# 第 5 阶段：扩展系统 (4-6 小时)

## 5.1 Skills 系统

### Skill 加载
```typescript
// skills/loadSkillsDir.ts
export async function loadSkillsDir(cwd: string): Promise<Skill[]> {
  const skillDirs = [
    path.join(cwd, '.claude/skills'),
    path.join(os.homedir(), '.claude/skills'),
    // ...
  ]
  
  const skills: Skill[] = []
  for (const dir of skillDirs) {
    const skillFiles = await findSkillFiles(dir)
    for (const file of skillFiles) {
      const skill = await loadSkill(file)
      skills.push(skill)
    }
  }
  
  return skills
}
```

### Skill 定义
```typescript
type Skill = {
  name: string
  description: string
  trigger: string | RegExp
  systemPrompt: string
  tools?: string[]
}
```

---

## 5.2 Plugins 系统

### 插件发现
```typescript
// plugins/discoverPlugins.ts
export async function discoverPlugins(): Promise<Plugin[]> {
  const pluginDirs = [
    './plugins',
    '~/.claude/plugins',
    // ...
  ]
  
  const plugins: Plugin[] = []
  for (const dir of pluginDirs) {
    const manifest = await readManifest(dir)
    if (manifest) {
      plugins.push({ ...manifest, path: dir })
    }
  }
  
  return plugins
}
```

### 插件清单
```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "My custom plugin",
  "mcpServers": {
    "my-server": {
      "command": "node",
      "args": ["server.js"]
    }
  }
}
```

---

## 5.3 MCP 集成

### MCP 客户端
```typescript
// services/mcp/client.ts
export class McpClient {
  private client: Client
  private transport: Transport
  
  constructor(serverName: string, config: McpServerConfig) {
    if (config.type === 'stdio') {
      this.transport = new StdioClientTransport({
        command: config.command,
        args: config.args,
      })
    } else if (config.type === 'sse') {
      this.transport = new SSEClientTransport(new URL(config.url))
    }
    
    this.client = new Client({ name: 'claude-code', version: pkg.version })
  }
  
  async connect(): Promise<void> {
    await this.client.connect(this.transport)
  }
  
  async listTools(): Promise<ListToolsResult> {
    return this.client.request({ method: 'tools/list' }, ListToolsResultSchema)
  }
  
  async callTool(name: string, args: Record<string, unknown>): Promise<MCPToolResult> {
    const result = await this.client.request(
      { method: 'tools/call', params: { name, arguments: args } },
      CallToolResultSchema,
    )
    
    if (result.isError) {
      throw new McpToolCallError(result.content?.[0]?.text ?? 'Unknown error')
    }
    
    return { content: result.content, _meta: result._meta }
  }
}
```

### MCP 配置
```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"]
    }
  }
}
```

---

# 第 6 阶段：实战演练 (4-8 小时)

## 6.1 实现一个新工具

### 示例：WeatherTool
```typescript
import { buildTool } from './Tool'
import { z } from 'zod/v4'

export const WeatherTool = buildTool({
  name: 'Weather',
  description: 'Get weather forecast for a location',
  searchHint: 'weather forecast temperature',
  
  inputSchema: z.object({
    location: z.string().describe('City name or coordinates'),
    days: z.number().optional().default(3),
  }),
  
  async call(args, context) {
    // 调用天气 API
    const response = await fetch(
      `https://wttr.in/${args.location}?format=j1`
    )
    const data = await response.json()
    
    return {
      data: {
        location: data.nearest_area[0].areaName[0].value,
        forecast: data.weather,
      },
      newMessages: [
        {
          type: 'system',
          subtype: 'weather_result',
          content: formatWeather(data),
        },
      ],
    }
  },
  
  isReadOnly() {
    return true
  },
  
  isConcurrencySafe() {
    return true
  },
  
  renderToolResultMessage(content, options) {
    return (
      <Box flexDirection="column">
        <Text bold>Weather for {content.location}:</Text>
        {content.forecast.map(day => (
          <Text key={day.date}>
            {day.date}: {day.avgTemp}°C
          </Text>
        ))}
      </Box>
    )
  },
})
```

### 注册工具
```typescript
// tools.ts
export function getAllBaseTools(): Tools {
  return [
    // ... 现有工具
    WeatherTool,  // 添加新工具
  ]
}
```

---

## 6.2 实现一个 Skill

### 示例：CodeReview Skill
```yaml
# .claude/skills/code-review.yaml
name: code-review
description: Review code changes and provide feedback
trigger: /review
systemPrompt: |
  You are a code review expert. When reviewing code:
  1. Check for bugs and edge cases
  2. Suggest improvements for readability
  3. Verify best practices are followed
  4. Consider security implications
  5. Provide constructive feedback

  Use the FileRead tool to examine the code,
  then provide a detailed review.
tools:
  - FileRead
  - Grep
  - Glob
```

---

## 6.3 实现安全检查

### 示例：添加新的 Bash 检查
```typescript
// bashSecurity.ts
const BASH_SECURITY_CHECK_IDS = {
  // ... 现有检查
  DANGEROUS_PYTHON_EXEC: 24,  // 新增
}

function validateDangerousPythonExec(context: ValidationContext): PermissionResult {
  const { originalCommand } = context
  
  // 检测 python -c 执行任意代码
  if (/python[23]?\s+-c\s+/.test(originalCommand)) {
    logEvent('tengu_bash_security_check_triggered', {
      checkId: BASH_SECURITY_CHECK_IDS.DANGEROUS_PYTHON_EXEC,
      subId: 1,
    })
    return {
      behavior: 'ask',
      message: 'Command executes arbitrary Python code',
    }
  }
  
  return { behavior: 'passthrough', message: 'No dangerous Python exec' }
}

// 添加到检查链
const BASH_SECURITY_CHECKS = [
  // ... 现有检查
  validateDangerousPythonExec,  // 新增
]
```

---

# 📚 学习资源

## 源码阅读顺序
```
1. src/main.tsx          (入口)
2. src/query.ts          (查询编排)
3. src/QueryEngine.ts    (引擎核心)
4. src/Tool.ts           (工具抽象)
5. src/tools/BashTool/   (工具示例)
6. src/state/store.ts    (状态管理)
7. src/hooks/            (Hooks)
8. src/components/       (组件)
```

## 文档
```
- /tmp/claudecode-cli-source/ARCHITECTURE.md       (架构全景)
- /tmp/claudecode-cli-source/COMPLETE_ANALYSIS.md  (完整分析)
- /tmp/claudecode-cli-source/ULTRA_DETAILED_ANALYSIS.md (超详细实现)
```

## 实践项目
```
1. 实现一个自定义工具 (如 WeatherTool)
2. 实现一个 Skill (如 CodeReview)
3. 实现一个安全检查 (如 Python 执行检测)
4. 实现一个 MCP 服务器集成
```

---

# ✅ 学习检查清单

## 第 1 阶段检查
- [ ] 理解 Agent CLI 的核心价值
- [ ] 能画出 6 层架构图
- [ ] 知道核心文件的作用

## 第 2 阶段检查
- [ ] 理解用户输入处理流程
- [ ] 理解模型调用的流式处理
- [ ] 理解工具调用的检测与执行
- [ ] 理解查询循环的迭代机制

## 第 3 阶段检查
- [ ] 理解 Tool 接口的 40+ 字段
- [ ] 能实现一个简单的工具
- [ ] 理解工具并发/串行分区
- [ ] 理解三层权限规则

## 第 4 阶段检查
- [ ] 理解 createStore 原语
- [ ] 理解不可变更新模式
- [ ] 理解 Ink 组件渲染
- [ ] 理解生成器流式处理

## 第 5 阶段检查
- [ ] 理解 Skills 加载机制
- [ ] 理解 Plugins 发现机制
- [ ] 理解 MCP 客户端连接

## 第 6 阶段检查
- [ ] 能独立实现一个新工具
- [ ] 能独立实现一个 Skill
- [ ] 能独立实现一个安全检查

---

_学习指南版本：1.0_  
_最后更新：2026-04-02_  
_预计完成时间：20-40 小时_
