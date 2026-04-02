# Claude Code 工具系统完整文档

> 📅 分析时间：2026-04-02  
> 📂 源码位置：`source/src/tools/`, `source/src/Tool.ts`, `source/src/tools.ts`  
> 📄 核心文件：`Tool.ts` (30KB), `tools.ts` (17KB)

---

## 📑 目录

1. [系统架构](#1-系统架构)
2. [工具接口定义](#2-工具接口定义)
3. [工具构建器](#3-工具构建器)
4. [工具注册与发现](#4-工具注册与发现)
5. [工具分类](#5-工具分类)
6. [权限系统](#6-权限系统)
7. [执行编排](#7-执行编排)
8. [核心工具详解](#8-核心工具详解)
9. [API 参考](#9-api-参考)
10. [最佳实践](#10-最佳实践)

---

## 1. 系统架构

### 1.1 核心组件

```
tools/
├── Tool.ts                    # 工具抽象接口 (30KB)
├── tools.ts                   # 工具注册表 (17KB)
├── AgentTool/                 # 代理工具 (17 文件)
├── BashTool/                  # Bash 工具 (20 文件，160KB)
├── FileEditTool/              # 文件编辑 (8 文件)
├── FileReadTool/              # 文件读取 (7 文件)
├── FileWriteTool/             # 文件写入 (5 文件)
├── GlobTool/                  # 文件匹配 (5 文件)
├── GrepTool/                  # 代码搜索 (5 文件)
├── MCPTool/                   # MCP 工具 (6 文件)
├── LSPTool/                   # LSP 工具 (8 文件)
├── WebFetchTool/              # 网页抓取 (7 文件)
├── WebSearchTool/             # 网络搜索 (5 文件)
├── SkillTool/                 # 技能工具 (7 文件)
├── Task*/                     # 任务工具 (6 个目录)
├── ConfigTool/                # 配置工具 (7 文件)
├── ScheduleCronTool/          # 定时任务 (7 文件)
└── ... (共 45 个工具目录)
```

### 1.2 系统分层

```
┌─────────────────────────────────────────┐
│  工具注册层                              │
│  - getAllBaseTools()                    │
│  - getTools()                           │
│  - filterToolsByDenyRules()             │
├─────────────────────────────────────────┤
│  工具抽象层                              │
│  - Tool 接口定义                         │
│  - buildTool() 构建器                   │
│  - toolMatchesName() 匹配               │
├─────────────────────────────────────────┤
│  权限控制层                              │
│  - canUseTool() 权限检查                │
│  - checkPermissions() 权限验证          │
│  - validateInput() 输入验证             │
├─────────────────────────────────────────┤
│  执行编排层                              │
│  - runTools() 工具执行                  │
│  - partitionToolCalls() 分区            │
│  - runToolsConcurrently() 并发执行      │
├─────────────────────────────────────────┤
│  具体工具层                              │
│  - BashTool.call()                      │
│  - FileReadTool.call()                  │
│  - ... (45 个工具实现)                  │
└─────────────────────────────────────────┘
```

### 1.3 工具调用流程

```
用户请求
    │
    ↓
模型生成 tool_use
    │
    ↓
QueryEngine 检测到 tool_use
    │
    ↓
runTools() 执行编排
    │
    ├─→ partitionToolCalls() 分区
    │     ├─→ 并发安全批
    │     └─→ 串行批
    │
    ├─→ runToolsConcurrently() 并发执行
    │     └─→ canUseTool() 权限检查
    │           ├─→ 检查 alwaysAllowRules
    │           ├─→ 检查 alwaysDenyRules
    │           ├─→ 检查 alwaysAskRules
    │           └─→ 弹出确认对话框 (如需)
    │
    ├─→ Tool.call() 执行工具
    │     ├─→ validateInput() 验证
    │     ├─→ 执行核心逻辑
    │     └─→ 返回 ToolResult
    │
    └─→ 结果回灌到对话
```

---

## 2. 工具接口定义

### 2.1 完整接口

```typescript
// source/src/Tool.ts

export type Tool<
  Input extends AnyObject = AnyObject,
  Output = unknown,
  P extends ToolProgressData = ToolProgressData,
> = {
  // ─────────────────────────────────────────────────────────────────────────
  // 基础属性 (5)
  // ─────────────────────────────────────────────────────────────────────────
  
  /** 工具名称 (必填) */
  readonly name: string
  
  /** 向后兼容别名 */
  aliases?: string[]
  
  /** 搜索提示 - 用于 ToolSearch 关键词匹配 (3-10 词) */
  searchHint?: string
  
  // ─────────────────────────────────────────────────────────────────────────
  // Schema (3)
  // ─────────────────────────────────────────────────────────────────────────
  
  /** 输入 Schema (Zod) */
  readonly inputSchema: Input
  
  /** MCP 工具 JSON Schema */
  readonly inputJSONSchema?: ToolInputJSONSchema
  
  /** 输出 Schema */
  outputSchema?: z.ZodType<unknown>
  
  // ─────────────────────────────────────────────────────────────────────────
  // 核心方法 (1)
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * 工具调用方法
   * @param args 解析后的输入参数
   * @param context 工具使用上下文
   * @param canUseTool 权限检查函数
   * @param parentMessage 父消息 (AI 消息)
   * @param onProgress 进度回调
   */
  call(
    args: z.infer<Input>,
    context: ToolUseContext,
    canUseTool: CanUseToolFn,
    parentMessage: AssistantMessage,
    onProgress?: ToolCallProgress<P>,
  ): Promise<ToolResult<Output>>
  
  // ─────────────────────────────────────────────────────────────────────────
  // 描述生成 (1)
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * 生成工具描述（显示给用户）
   */
  description(
    input: z.infer<Input>,
    options: {
      isNonInteractiveSession: boolean
      toolPermissionContext: ToolPermissionContext
      tools: Tools
    },
  ): Promise<string>
  
  // ─────────────────────────────────────────────────────────────────────────
  // 等价判断 (1)
  // ─────────────────────────────────────────────────────────────────────────
  
  /** 判断两个输入是否等价 */
  inputsEquivalent?(a: z.infer<Input>, b: z.infer<Input>): boolean
  
  // ─────────────────────────────────────────────────────────────────────────
  // 特性检查 (5)
  // ─────────────────────────────────────────────────────────────────────────
  
  /** 是否启用 */
  isEnabled(): boolean
  
  /** 是否可并发执行 */
  isConcurrencySafe(input: z.infer<Input>): boolean
  
  /** 是否是只读操作 */
  isReadOnly(input: z.infer<Input>): boolean
  
  /** 是否是破坏性操作 */
  isDestructive?(input: z.infer<Input>): boolean
  
  /**
   * 中断行为
   * - 'cancel': 停止工具并丢弃结果
   * - 'block': 继续运行，新消息等待
   */
  interruptBehavior?(): 'cancel' | 'block'
  
  // ─────────────────────────────────────────────────────────────────────────
  // UI 分类 (2)
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * 是否是搜索/读取操作（用于 UI 折叠）
   */
  isSearchOrReadCommand?(input: z.infer<Input>): {
    isSearch: boolean
    isRead: boolean
    isList?: boolean
  }
  
  /** 是否是开放世界操作 */
  isOpenWorld?(input: z.infer<Input>): boolean
  
  // ─────────────────────────────────────────────────────────────────────────
  // 交互 (1)
  // ─────────────────────────────────────────────────────────────────────────
  
  /** 是否需要用户交互 */
  requiresUserInteraction?(): boolean
  
  // ─────────────────────────────────────────────────────────────────────────
  // MCP/LSP 标记 (3)
  // ─────────────────────────────────────────────────────────────────────────
  
  /** 是否是 MCP 工具 */
  isMcp?: boolean
  
  /** 是否是 LSP 工具 */
  isLsp?: boolean
  
  /** MCP 服务器和工具名称 */
  mcpInfo?: { serverName: string; toolName: string }
  
  // ─────────────────────────────────────────────────────────────────────────
  // 加载控制 (3)
  // ─────────────────────────────────────────────────────────────────────────
  
  /** 是否延迟加载（需要 ToolSearch） */
  readonly shouldDefer?: boolean
  
  /** 是否总是加载（不延迟） */
  readonly alwaysLoad?: boolean
  
  /** 是否严格模式 */
  readonly strict?: boolean
  
  // ─────────────────────────────────────────────────────────────────────────
  // 限制 (1)
  // ─────────────────────────────────────────────────────────────────────────
  
  /** 工具结果最大字符数（超过则持久化到文件） */
  maxResultSizeChars: number
  
  // ─────────────────────────────────────────────────────────────────────────
  // 输入处理 (1)
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * 在观察者看到之前回填输入
   * 原地突变添加遗留/派生字段
   * 必须是幂等的
   */
  backfillObservableInput?(input: Record<string, unknown>): void
  
  // ─────────────────────────────────────────────────────────────────────────
  // 验证与权限 (3)
  // ─────────────────────────────────────────────────────────────────────────
  
  /** 验证输入 */
  validateInput?(
    input: z.infer<Input>,
    context: ToolUseContext,
  ): Promise<ValidationResult>
  
  /** 检查权限（工具特定逻辑） */
  checkPermissions(
    input: z.infer<Input>,
    context: ToolUseContext,
  ): Promise<PermissionResult>
  
  /** 准备权限匹配器 */
  preparePermissionMatcher?(
    input: z.infer<Input>,
  ): Promise<(pattern: string) => boolean>
  
  // ─────────────────────────────────────────────────────────────────────────
  // 路径 (1)
  // ─────────────────────────────────────────────────────────────────────────
  
  /** 获取文件路径（针对文件操作工具） */
  getPath?(input: z.infer<Input>): string
  
  // ─────────────────────────────────────────────────────────────────────────
  // 提示与名称 (4)
  // ─────────────────────────────────────────────────────────────────────────
  
  /** 生成工具提示 */
  prompt(options: {
    getToolPermissionContext: () => Promise<ToolPermissionContext>
    tools: Tools
    agents: AgentDefinition[]
    allowedAgentTypes?: string[]
  }): Promise<string>
  
  /** 用户友好名称 */
  userFacingName(input: Partial<z.infer<Input>> | undefined): string
  
  /** 用户友好名称背景色 */
  userFacingNameBackgroundColor?(
    input: Partial<z.infer<Input>> | undefined,
  ): keyof Theme | undefined
  
  /** 活动描述（用于 spinner） */
  getActivityDescription?(
    input: Partial<z.infer<Input>> | undefined,
  ): string | null
  
  // ─────────────────────────────────────────────────────────────────────────
  // 摘要与分类 (2)
  // ─────────────────────────────────────────────────────────────────────────
  
  /** 工具使用摘要（用于紧凑视图） */
  getToolUseSummary?(input: Partial<z.infer<Input>> | undefined): string | null
  
  /**
   * 为自动模式分类器返回紧凑表示
   * 示例：Bash 返回 `ls -la`，Edit 返回 `/tmp/x: new content`
   */
  toAutoClassifierInput(input: z.infer<Input>): unknown
  
  // ─────────────────────────────────────────────────────────────────────────
  // 结果映射 (1)
  // ─────────────────────────────────────────────────────────────────────────
  
  /** 将工具结果映射到 ToolResultBlockParam */
  mapToolResultToToolResultBlockParam(
    content: Output,
    toolUseID: string,
  ): ToolResultBlockParam
  
  // ─────────────────────────────────────────────────────────────────────────
  // UI 渲染 (10)
  // ─────────────────────────────────────────────────────────────────────────
  
  /** 渲染工具使用消息 */
  renderToolUseMessage(
    input: Partial<z.infer<Input>>,
    options: { theme: ThemeName; verbose: boolean; commands?: Command[] },
  ): React.ReactNode
  
  /** 渲染工具结果消息 */
  renderToolResultMessage?(
    content: Output,
    progressMessagesForMessage: ProgressMessage<P>[],
    options: {
      style?: 'condensed'
      theme: ThemeName
      tools: Tools
      verbose: boolean
      isTranscriptMode?: boolean
      isBriefOnly?: boolean
      input?: unknown
    },
  ): React.ReactNode
  
  /** 提取搜索文本（用于转录搜索索引） */
  extractSearchText?(out: Output): string
  
  /** 结果是否被截断（点击展开标志） */
  isResultTruncated?(output: Output): boolean
  
  /** 渲染工具使用标签 */
  renderToolUseTag?(input: Partial<z.infer<Input>>): React.ReactNode
  
  /** 渲染进度消息 */
  renderToolUseProgressMessage?(
    progressMessagesForMessage: ProgressMessage<P>[],
    options: {
      tools: Tools
      verbose: boolean
      terminalSize?: { columns: number; rows: number }
      inProgressToolCallCount?: number
      isTranscriptMode?: boolean
    },
  ): React.ReactNode
  
  /** 渲染排队消息 */
  renderToolUseQueuedMessage?(): React.ReactNode
  
  /** 渲染拒绝消息 */
  renderToolUseRejectedMessage?(
    input: z.infer<Input>,
    options: {
      columns: number
      messages: Message[]
      style?: 'condensed'
      theme: ThemeName
      tools: Tools
      verbose: boolean
      progressMessagesForMessage: ProgressMessage<P>[]
      isTranscriptMode?: boolean
    },
  ): React.ReactNode
  
  /** 渲染错误消息 */
  renderToolUseErrorMessage?(
    result: ToolResultBlockParam['content'],
    options: {
      progressMessagesForMessage: ProgressMessage<P>[]
      tools: Tools
      verbose: boolean
      isTranscriptMode?: boolean
    },
  ): React.ReactNode
  
  /** 渲染分组工具使用（非 verbose 模式） */
  renderGroupedToolUse?(
    toolUses: Array<{
      param: ToolUseBlockParam
      isResolved: boolean
      isError: boolean
      isInProgress: boolean
      progressMessages: ProgressMessage<P>[]
      result?: {
        param: ToolResultBlockParam
        output: unknown
      }
    }>,
    options: {
      shouldAnimate: boolean
      tools: Tools
    },
  ): React.ReactNode | null
  
  // ─────────────────────────────────────────────────────────────────────────
  // 透明包装 (1)
  // ─────────────────────────────────────────────────────────────────────────
  
  /** 是否是透明包装器（如 REPL） */
  isTransparentWrapper?(): boolean
}
```

### 2.2 工具结果类型

```typescript
export type ToolResult<T> = {
  /** 工具执行结果数据 */
  data: T
  
  /** 新消息（可选） */
  newMessages?: (
    | UserMessage
    | AssistantMessage
    | AttachmentMessage
    | SystemMessage
  )[]
  
  /** 上下文修改器（仅针对非并发安全工具） */
  contextModifier?: (context: ToolUseContext) => ToolUseContext
  
  /** MCP 协议元数据 */
  mcpMeta?: {
    _meta?: Record<string, unknown>
    structuredContent?: Record<string, unknown>
  }
}
```

### 2.3 验证结果类型

```typescript
export type ValidationResult =
  | { result: true }
  | {
      result: false
      message: string
      errorCode: number
    }

export type PermissionResult =
  | { behavior: 'allow'; updatedInput?: Record<string, unknown> }
  | { behavior: 'deny' }
  | { behavior: 'ask' }
```

---

## 3. 工具构建器

### 3.1 默认值定义

```typescript
// source/src/Tool.ts

/**
 * 可默认化的工具方法键
 */
type DefaultableToolKeys =
  | 'isEnabled'
  | 'isConcurrencySafe'
  | 'isReadOnly'
  | 'isDestructive'
  | 'checkPermissions'
  | 'toAutoClassifierInput'
  | 'userFacingName'

/**
 * 默认值定义
 * 
 * 默认值（在关键处 fail-closed）:
 * - isEnabled → true (默认启用)
 * - isConcurrencySafe → false (假设不安全)
 * - isReadOnly → false (假设写入)
 * - isDestructive → false
 * - checkPermissions → { behavior: 'allow', updatedInput } (交给全局权限系统)
 * - toAutoClassifierInput → '' (跳过分类器)
 * - userFacingName → name
 */
const TOOL_DEFAULTS = {
  isEnabled: () => true,
  isConcurrencySafe: (_input?: unknown) => false,
  isReadOnly: (_input?: unknown) => false,
  isDestructive: (_input?: unknown) => false,
  checkPermissions: (
    input: { [key: string]: unknown },
    _ctx?: ToolUseContext,
  ): Promise<PermissionResult> =>
    Promise.resolve({ behavior: 'allow', updatedInput: input }),
  toAutoClassifierInput: (_input?: unknown) => '',
  userFacingName: (_input?: unknown) => '',
}

type ToolDefaults = typeof TOOL_DEFAULTS
```

### 3.2 构建器函数

```typescript
/**
 * 从部分定义构建完整工具，填充常用方法的默认值
 * 
 * 所有工具导出都应该通过此函数，这样默认值集中在一个地方，
 * 调用者永远不需要 `?.() ?? default`
 */
export function buildTool<D extends AnyToolDef>(def: D): BuiltTool<D> {
  return {
    ...TOOL_DEFAULTS,
    userFacingName: () => def.name,
    ...def,
  } as BuiltTool<D>
}
```

### 3.3 使用示例

```typescript
// 示例：WeatherTool 实现

import { buildTool } from './Tool'
import { z } from 'zod/v4'

export const WeatherTool = buildTool({
  // 必填属性
  name: 'Weather',
  description: 'Get weather forecast for a location',
  searchHint: 'weather forecast temperature',
  
  // 输入 Schema
  inputSchema: z.object({
    location: z.string().describe('City name or coordinates'),
    days: z.number().optional().default(3),
  }),
  
  // 核心方法
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
    }
  },
  
  // 可选方法（有默认值，可省略）
  isReadOnly: () => true,
  isConcurrencySafe: () => true,
  
  // UI 渲染
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

---

## 4. 工具注册与发现

### 4.1 工具注册表

```typescript
// source/src/tools.ts

/**
 * 获取所有基础工具的完整列表
 * 
 * 注意：这必须与 Statsig 动态配置保持同步，以便跨用户缓存系统提示
 */
export function getAllBaseTools(): Tools {
  return [
    // ─────────────────────────────────────────────────────────────────────
    // 核心工具（总是可用）
    // ─────────────────────────────────────────────────────────────────────
    AgentTool,
    TaskOutputTool,
    BashTool,
    
    // 如果没有嵌入式搜索工具，添加 Glob/Grep
    ...(hasEmbeddedSearchTools() ? [] : [GlobTool, GrepTool]),
    
    ExitPlanModeV2Tool,
    FileReadTool,
    FileEditTool,
    FileWriteTool,
    NotebookEditTool,
    WebFetchTool,
    TodoWriteTool,
    WebSearchTool,
    TaskStopTool,
    AskUserQuestionTool,
    SkillTool,
    EnterPlanModeTool,
    
    // ─────────────────────────────────────────────────────────────────────
    // 条件工具（环境变量）
    // ─────────────────────────────────────────────────────────────────────
    ...(process.env.USER_TYPE === 'ant' ? [ConfigTool] : []),
    ...(process.env.USER_TYPE === 'ant' ? [TungstenTool] : []),
    ...(SuggestBackgroundPRTool ? [SuggestBackgroundPRTool] : []),
    ...(WebBrowserTool ? [WebBrowserTool] : []),
    
    // ─────────────────────────────────────────────────────────────────────
    // 条件工具（特性标志）
    // ─────────────────────────────────────────────────────────────────────
    ...(isTodoV2Enabled()
      ? [TaskCreateTool, TaskGetTool, TaskUpdateTool, TaskListTool]
      : []),
    ...(OverflowTestTool ? [OverflowTestTool] : []),
    ...(CtxInspectTool ? [CtxInspectTool] : []),
    ...(TerminalCaptureTool ? [TerminalCaptureTool] : []),
    ...(isEnvTruthy(process.env.ENABLE_LSP_TOOL) ? [LSPTool] : []),
    ...(isWorktreeModeEnabled() ? [EnterWorktreeTool, ExitWorktreeTool] : []),
    
    // ─────────────────────────────────────────────────────────────────────
    // 懒加载工具（打破循环依赖）
    // ─────────────────────────────────────────────────────────────────────
    getSendMessageTool(),
    ...(ListPeersTool ? [ListPeersTool] : []),
    ...(isAgentSwarmsEnabled()
      ? [getTeamCreateTool(), getTeamDeleteTool()]
      : []),
    
    // ─────────────────────────────────────────────────────────────────────
    // 更多条件工具
    // ─────────────────────────────────────────────────────────────────────
    ...(VerifyPlanExecutionTool ? [VerifyPlanExecutionTool] : []),
    ...(process.env.USER_TYPE === 'ant' && REPLTool ? [REPLTool] : []),
    ...(WorkflowTool ? [WorkflowTool] : []),
    ...(SleepTool ? [SleepTool] : []),
    ...cronTools,  // CronCreate/Delete/List
    ...(RemoteTriggerTool ? [RemoteTriggerTool] : []),
    ...(MonitorTool ? [MonitorTool] : []),
    BriefTool,
    ...(SendUserFileTool ? [SendUserFileTool] : []),
    ...(PushNotificationTool ? [PushNotificationTool] : []),
    ...(SubscribePRTool ? [SubscribePRTool] : []),
    ...(getPowerShellTool() ? [getPowerShellTool()] : []),
    ...(SnipTool ? [SnipTool] : []),
    ...(process.env.NODE_ENV === 'test' ? [TestingPermissionTool] : []),
    ListMcpResourcesTool,
    ReadMcpResourceTool,
    ...(isToolSearchEnabledOptimistic() ? [ToolSearchTool] : []),
  ]
}
```

### 4.2 工具预设

```typescript
/**
 * 预定义的工具预设，可与 --tools 标志一起使用
 */
export const TOOL_PRESETS = ['default'] as const

export type ToolPreset = (typeof TOOL_PRESETS)[number]

export function parseToolPreset(preset: string): ToolPreset | null {
  const presetString = preset.toLowerCase()
  if (!TOOL_PRESETS.includes(presetString as ToolPreset)) {
    return null
  }
  return presetString as ToolPreset
}

/**
 * 获取默认预设的工具名称列表
 */
export function getToolsForDefaultPreset(): string[] {
  const tools = getAllBaseTools()
  const isEnabled = tools.map(tool => tool.isEnabled())
  return tools
    .filter((_, i) => isEnabled[i])
    .map(tool => tool.name)
}
```

### 4.3 工具过滤

```typescript
/**
 * 根据拒绝规则过滤工具
 * 
 * 如果工具有 blanket-denied 规则（匹配名称且无 ruleContent），则被过滤
 * 使用与运行时权限检查相同的匹配器（步骤 1a）
 * MCP 服务器前缀规则如 `mcp__server` 会在模型看到之前删除该服务器的所有工具
 */
export function filterToolsByDenyRules<
  T extends {
    name: string
    mcpInfo?: { serverName: string; toolName: string }
  },
>(tools: readonly T[], permissionContext: ToolPermissionContext): T[] {
  return tools.filter(tool => !getDenyRuleForTool(permissionContext, tool))
}

/**
 * 获取工具（带权限过滤）
 */
export const getTools = (permissionContext: ToolPermissionContext): Tools => {
  // 简单模式：仅 Bash, Read, Edit
  if (isEnvTruthy(process.env.CLAUDE_CODE_SIMPLE)) {
    if (isReplModeEnabled() && REPLTool) {
      const replSimple: Tool[] = [REPLTool]
      return filterToolsByDenyRules(replSimple, permissionContext)
    }
    const simpleTools: Tool[] = [BashTool, FileReadTool, FileEditTool]
    return filterToolsByDenyRules(simpleTools, permissionContext)
  }

  // 获取所有基础工具并过滤
  const allTools = getAllBaseTools()
  return filterToolsByDenyRules(allTools, permissionContext)
}
```

### 4.4 工具匹配

```typescript
/**
 * 检查工具是否匹配给定名称（主名称或别名）
 */
export function toolMatchesName(
  tool: { name: string; aliases?: string[] },
  name: string,
): boolean {
  return tool.name === name || (tool.aliases?.includes(name) ?? false)
}

/**
 * 从工具列表中按名称或别名查找工具
 */
export function findToolByName(tools: Tools, name: string): Tool | undefined {
  return tools.find(t => toolMatchesName(t, name))
}
```

---

## 5. 工具分类

### 5.1 核心工具 (6 个)

| 工具 | 文件数 | 大小 | 用途 |
|------|--------|------|------|
| **BashTool** | 20 | 160KB | Shell 命令执行 |
| **FileReadTool** | 7 | - | 文件读取 |
| **FileWriteTool** | 5 | - | 文件写入 |
| **FileEditTool** | 8 | - | 文件编辑 (diff/patch) |
| **GlobTool** | 5 | - | 文件匹配 |
| **GrepTool** | 5 | - | 代码搜索 |

### 5.2 Web 工具 (2 个)

| 工具 | 文件数 | 用途 |
|------|--------|------|
| **WebFetchTool** | 7 | 网页抓取 |
| **WebSearchTool** | 5 | 网络搜索 |

### 5.3 代理工具 (2 个)

| 工具 | 文件数 | 用途 |
|------|--------|------|
| **AgentTool** | 17 | 子代理调用 |
| **SkillTool** | 7 | 技能调用 |

### 5.4 任务工具 (7 个)

| 工具 | 文件数 | 用途 |
|------|--------|------|
| **TaskCreateTool** | 5 | 任务创建 |
| **TaskGetTool** | 5 | 任务获取 |
| **TaskUpdateTool** | 5 | 任务更新 |
| **TaskListTool** | 5 | 任务列表 |
| **TaskStopTool** | 5 | 任务停止 |
| **TaskOutputTool** | 4 | 任务输出 |
| **TodoWriteTool** | 5 | Todo 管理 |

### 5.5 集成工具 (4 个)

| 工具 | 文件数 | 用途 |
|------|--------|------|
| **MCPTool** | 6 | MCP 工具调用 |
| **LSPTool** | 8 | 语言服务器协议 |
| **ListMcpResourcesTool** | 5 | MCP 资源列表 |
| **ReadMcpResourceTool** | 5 | MCP 资源读取 |

### 5.6 配置工具 (5 个)

| 工具 | 文件数 | 用途 |
|------|--------|------|
| **ConfigTool** | 7 | 配置管理 |
| **EnterPlanModeTool** | 6 | 进入计划模式 |
| **ExitPlanModeTool** | 6 | 退出计划模式 |
| **EnterWorktreeTool** | 6 | 进入工作树 |
| **ExitWorktreeTool** | 6 | 退出工作树 |

### 5.7 通信工具 (3 个)

| 工具 | 文件数 | 用途 |
|------|--------|------|
| **AskUserQuestionTool** | 4 | 用户问答 |
| **SendMessageTool** | 6 | 消息发送 |
| **BriefTool** | 7 | 简报工具 |

### 5.8 条件工具 (可变)

| 工具 | 触发条件 | 用途 |
|------|----------|------|
| **SleepTool** | feature('KAIROS') | 休眠 |
| **CronCreate/Delete/List** | feature('AGENT_TRIGGERS') | 定时任务 |
| **RemoteTriggerTool** | feature('AGENT_TRIGGERS_REMOTE') | 远程触发 |
| **PowerShellTool** | isPowerShellToolEnabled() | PowerShell 执行 |
| **REPLTool** | process.env.USER_TYPE === 'ant' | REPL 执行 |

---

## 6. 权限系统

### 6.1 权限检查流程

```typescript
// source/src/hooks/useCanUseTool.tsx

export type CanUseToolFn<Input extends Record<string, unknown> = Record<string, unknown>> = (
  tool: Tool,
  input: Input,
  toolUseContext: ToolUseContext,
  assistantMessage: AssistantMessage,
  toolUseID: string,
  forceDecision?: PermissionDecision<Input>,
) => Promise<PermissionDecision<Input>>

function useCanUseTool(setToolUseConfirmQueue, setToolPermissionContext) {
  return async (tool, input, toolUseContext, assistantMessage, toolUseID, forceDecision) => 
    new Promise(resolve => {
      // 1. 创建权限上下文
      const ctx = createPermissionContext(tool, input, toolUseContext, ...)
      
      // 2. 检查是否已中止
      if (ctx.resolveIfAborted(resolve)) return
      
      // 3. 获取权限决策
      const decisionPromise = forceDecision !== undefined
        ? Promise.resolve(forceDecision)
        : hasPermissionsToUseTool(tool, input, toolUseContext, assistantMessage, toolUseID)
      
      decisionPromise.then(async result => {
        // 4. 处理决策
        if (result.behavior === 'allow') {
          // 允许
          ctx.logDecision({ decision: 'accept', source: 'config' })
          resolve(ctx.buildAllow(result.updatedInput ?? input))
          return
        }
        
        if (result.behavior === 'deny') {
          // 拒绝
          logPermissionDecision({...}, { decision: 'reject', source: 'config' })
          resolve(result)
          return
        }
        
        if (result.behavior === 'ask') {
          // 询问用户
          
          // 4.1 协调器模式处理
          if (appState.toolPermissionContext.awaitAutomatedChecksBeforeDialog) {
            const coordinatorDecision = await handleCoordinatorPermission({...})
            if (coordinatorDecision) {
              resolve(coordinatorDecision)
              return
            }
          }
          
          // 4.2 集群工作节点处理
          const swarmDecision = await handleSwarmWorkerPermission({...})
          if (swarmDecision) {
            resolve(swarmDecision)
            return
          }
          
          // 4.3 Bash 分类器推测检查
          if (feature('BASH_CLASSIFIER') && result.pendingClassifierCheck) {
            const speculativePromise = peekSpeculativeClassifierCheck(command)
            if (speculativePromise) {
              const raceResult = await Promise.race([
                speculativePromise.then(r => ({ type: 'result', result: r })),
                new Promise(r => setTimeout(r, 2000, { type: 'timeout' }))
              ])
              
              if (raceResult.type === 'result' && raceResult.result.matches) {
                // 分类器批准
                resolve(ctx.buildAllow(...))
                return
              }
            }
          }
          
          // 4.4 交互式权限对话框
          handleInteractivePermission({...}, resolve)
          return
        }
      })
    })
}
```

### 6.2 权限规则匹配

```typescript
// source/src/utils/permissions/permissions.ts

export async function hasPermissionsToUseTool(
  tool: Tool,
  input: Record<string, unknown>,
  toolUseContext: ToolUseContext,
  assistantMessage: AssistantMessage,
  toolUseID: string,
): Promise<PermissionResult> {
  const { toolPermissionContext } = toolUseContext.getAppState()
  
  // 1. 检查 alwaysAllowRules
  const allowRule = matchRule(toolPermissionContext.alwaysAllowRules, tool, input)
  if (allowRule) {
    return { behavior: 'allow', decisionReason: { type: 'rule', rule: allowRule } }
  }
  
  // 2. 检查 alwaysDenyRules
  const denyRule = matchRule(toolPermissionContext.alwaysDenyRules, tool, input)
  if (denyRule) {
    return { behavior: 'deny', decisionReason: { type: 'rule', rule: denyRule } }
  }
  
  // 3. 检查 alwaysAskRules
  const askRule = matchRule(toolPermissionContext.alwaysAskRules, tool, input)
  if (askRule) {
    return { behavior: 'ask', decisionReason: { type: 'rule', rule: askRule } }
  }
  
  // 4. 检查权限模式
  switch (toolPermissionContext.mode) {
    case 'bypass':
      if (!isDangerousTool(tool, input)) {
        return { behavior: 'allow', decisionReason: { type: 'mode', mode: 'bypass' } }
      }
      break
    
    case 'auto':
      if (isAutoModeAllowed(tool, input)) {
        return { behavior: 'allow', decisionReason: { type: 'mode', mode: 'auto' } }
      }
      break
  }
  
  // 5. 默认：询问用户
  return { behavior: 'ask' }
}

function matchRule(
  rules: ToolPermissionRulesBySource,
  tool: Tool,
  input: Record<string, unknown>,
): PermissionRule | null {
  for (const source of PERMISSION_RULE_SOURCES) {
    const sourceRules = rules[source] || {}
    const toolRules = sourceRules[tool.name] || []
    
    for (const ruleString of toolRules) {
      const ruleValue = permissionRuleValueFromString(ruleString)
      if (ruleMatches(ruleValue, input)) {
        return {
          source,
          ruleBehavior: 'allow',  // 或 'deny' / 'ask'
          ruleValue,
        }
      }
    }
  }
  
  return null
}
```

### 6.3 权限上下文

```typescript
// source/src/Tool.ts

export type ToolPermissionContext = DeepImmutable<{
  // 权限模式
  mode: PermissionMode  // 'default' | 'bypass' | 'auto' | 'plan'
  
  // 额外工作目录
  additionalWorkingDirectories: Map<string, AdditionalWorkingDirectory>
  
  // 三层权限规则
  alwaysAllowRules: ToolPermissionRulesBySource
  alwaysDenyRules: ToolPermissionRulesBySource
  alwaysAskRules: ToolPermissionRulesBySource
  
  // 功能标志
  isBypassPermissionsModeAvailable: boolean
  isAutoModeAvailable?: boolean
  strippedDangerousRules?: ToolPermissionRulesBySource
  
  // 特殊标志
  shouldAvoidPermissionPrompts?: boolean  // 后台代理自动拒绝
  awaitAutomatedChecksBeforeDialog?: boolean  // 协调器等待自动检查
  prePlanMode?: PermissionMode  // 计划模式前备份
}>
```

---

## 7. 执行编排

### 7.1 工具执行流程

```typescript
// source/src/services/tools/toolOrchestration.ts

export async function* runTools(
  toolUseMessages: ToolUseBlock[],
  assistantMessages: AssistantMessage[],
  canUseTool: CanUseToolFn,
  toolUseContext: ToolUseContext,
): AsyncGenerator<MessageUpdate, void> {
  let currentContext = toolUseContext
  
  // 1. 分区：并发安全批 vs 串行批
  for (const { isConcurrencySafe, blocks } of partitionToolCalls(
    toolUseMessages,
    currentContext,
  )) {
    if (isConcurrencySafe) {
      // 2. 并发执行读操作
      const queuedContextModifiers: Record<string, ((context: ToolUseContext) => ToolUseContext)[]> = {}
      
      for await (const update of runToolsConcurrently(
        blocks,
        assistantMessages,
        canUseTool,
        currentContext,
      )) {
        if (update.contextModifier) {
          const { toolUseID, modifyContext } = update.contextModifier
          if (!queuedContextModifiers[toolUseID]) {
            queuedContextModifiers[toolUseID] = []
          }
          queuedContextModifiers[toolUseID].push(modifyContext)
        }
        yield { message: update.message, newContext: currentContext }
      }
      
      // 应用上下文修改器
      for (const block of blocks) {
        const modifiers = queuedContextModifiers[block.id]
        if (!modifiers) continue
        for (const modifier of modifiers) {
          currentContext = modifier(currentContext)
        }
      }
      
      yield { newContext: currentContext }
    } else {
      // 3. 串行执行非读操作
      for await (const update of runToolsSerially(
        blocks,
        assistantMessages,
        canUseTool,
        currentContext,
      )) {
        if (update.newContext) {
          currentContext = update.newContext
        }
        yield { message: update.message, newContext: currentContext }
      }
    }
  }
}

/**
 * 分区逻辑
 */
function partitionToolCalls(
  toolUseMessages: ToolUseBlock[],
  toolUseContext: ToolUseContext,
): Batch[] {
  return toolUseMessages.reduce((acc: Batch[], toolUse) => {
    const tool = findToolByName(toolUseContext.options.tools, toolUse.name)
    const parsedInput = tool?.inputSchema.safeParse(toolUse.input)
    
    const isConcurrencySafe = parsedInput?.success
      ? (() => {
          try {
            return Boolean(tool?.isConcurrencySafe(parsedInput.data))
          } catch {
            return false  // 保守：失败视为不安全
          }
        })()
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

### 7.2 并发执行

```typescript
/**
 * 并发执行工具
 */
async function* runToolsConcurrently(
  toolUseMessages: ToolUseBlock[],
  assistantMessages: AssistantMessage[],
  canUseTool: CanUseToolFn,
  toolUseContext: ToolUseContext,
): AsyncGenerator<MessageUpdateLazy, void> {
  yield* all(
    toolUseMessages.map(async function* (toolUse) {
      toolUseContext.setInProgressToolUseIDs(prev =>
        new Set(prev).add(toolUse.id),
      )
      yield* runToolUse(
        toolUse,
        assistantMessages.find(_ =>
          _.message.content.some(
            _ => _.type === 'tool_use' && _.id === toolUse.id,
          ),
        )!,
        canUseTool,
        toolUseContext,
      )
      markToolUseAsComplete(toolUseContext, toolUse.id)
    }),
    getMaxToolUseConcurrency(),  // 默认 10
  )
}

/**
 * 串行执行工具
 */
async function* runToolsSerially(
  toolUseMessages: ToolUseBlock[],
  assistantMessages: AssistantMessage[],
  canUseTool: CanUseToolFn,
  toolUseContext: ToolUseContext,
): AsyncGenerator<MessageUpdate, void> {
  let currentContext = toolUseContext

  for (const toolUse of toolUseMessages) {
    toolUseContext.setInProgressToolUseIDs(prev =>
      new Set(prev).add(toolUse.id),
    )
    for await (const update of runToolUse(
      toolUse,
      assistantMessages.find(_ =>
        _.message.content.some(
          _ => _.type === 'tool_use' && _.id === toolUse.id,
        ),
      )!,
      canUseTool,
      currentContext,
    )) {
      if (update.contextModifier) {
        currentContext = update.contextModifier.modifyContext(currentContext)
      }
      yield {
        message: update.message,
        newContext: currentContext,
      }
    }
    markToolUseAsComplete(toolUseContext, toolUse.id)
  }
}
```

---

## 8. 核心工具详解

### 8.1 BashTool

**文件**: `source/src/tools/BashTool/BashTool.tsx` (160KB)

**职责**:
- Shell 命令执行
- 安全检查 (24 项)
- 权限管理
- 输出处理

**核心方法**:
```typescript
export const BashTool = buildTool({
  name: 'Bash',
  description: 'Execute shell commands',
  inputSchema: z.object({
    command: z.string().describe('The command to execute'),
    timeout: z.number().optional(),
  }),
  
  async call(args, context) {
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

**安全检查**:
- 24 项安全检查 (见 bashSecurity.ts)
- 命令替换检测
- Zsh 危险命令检测
- Heredoc 安全检测
- Git Commit 注入检测
- Jq 命令安全检测

---

### 8.2 FileReadTool

**文件**: `source/src/tools/FileReadTool/FileReadTool.ts`

**职责**:
- 文件读取
- 图像处理器
- 限制管理

**核心方法**:
```typescript
export const FileReadTool = buildTool({
  name: 'FileRead',
  description: 'Read file content',
  inputSchema: z.object({
    path: z.string().describe('File path to read'),
  }),
  
  async call(args, context) {
    const fs = getFsImplementation()
    const content = await fs.readFile(args.path, 'utf-8')
    
    return {
      data: { content },
    }
  },
  
  isReadOnly: () => true,
  isConcurrencySafe: () => true,
})
```

---

### 8.3 FileEditTool

**文件**: `source/src/tools/FileEditTool/FileEditTool.ts`

**职责**:
- 文件编辑 (diff/patch)
- 差异显示
- 常量定义

**核心方法**:
```typescript
export const FileEditTool = buildTool({
  name: 'FileEdit',
  description: 'Edit file using diff/patch',
  inputSchema: z.object({
    path: z.string().describe('File path'),
    old_string: z.string().describe('String to replace'),
    new_string: z.string().describe('Replacement string'),
  }),
  
  async call(args, context) {
    // 应用 diff
    const newContent = applyDiff(args.old_string, args.new_string, currentContent)
    
    // 写入文件
    await fs.writeFile(args.path, newContent)
    
    return {
      data: { success: true },
    }
  },
  
  isReadOnly: () => false,
  isConcurrencySafe: () => false,
  isDestructive: () => true,
})
```

---

### 8.4 AgentTool

**文件**: `source/src/tools/AgentTool/AgentTool.tsx`

**职责**:
- 子代理调用
- 代理颜色管理
- 代理显示
- 代理内存
- 内置代理

**内置代理**:
- claudeCodeGuideAgent
- exploreAgent
- generalPurposeAgent
- planAgent
- statuslineSetup
- verificationAgent

---

### 8.5 MCPTool

**文件**: `source/src/tools/MCPTool/MCPTool.ts`

**职责**:
- MCP 工具调用
- 折叠分类
- UI 渲染

**核心方法**:
```typescript
export const MCPTool = buildTool({
  name: 'mcp__server__tool',
  description: 'Call MCP tool',
  isMcp: true,
  mcpInfo: { serverName: 'server', toolName: 'tool' },
  
  async call(args, context) {
    // 调用 MCP 服务器
    const result = await callMcpTool(args.server, args.tool, args.input)
    
    return {
      data: result,
      mcpMeta: result._meta,
    }
  },
})
```

---

## 9. API 参考

### 9.1 核心函数

#### buildTool()

```typescript
/**
 * 从部分定义构建完整工具
 */
export function buildTool<D extends AnyToolDef>(def: D): BuiltTool<D>
```

#### toolMatchesName()

```typescript
/**
 * 检查工具是否匹配给定名称
 */
export function toolMatchesName(
  tool: { name: string; aliases?: string[] },
  name: string,
): boolean
```

#### findToolByName()

```typescript
/**
 * 从工具列表中查找工具
 */
export function findToolByName(tools: Tools, name: string): Tool | undefined
```

### 9.2 注册函数

#### getAllBaseTools()

```typescript
/**
 * 获取所有基础工具
 */
export function getAllBaseTools(): Tools
```

#### getTools()

```typescript
/**
 * 获取工具（带权限过滤）
 */
export const getTools = (permissionContext: ToolPermissionContext): Tools
```

#### filterToolsByDenyRules()

```typescript
/**
 * 根据拒绝规则过滤工具
 */
export function filterToolsByDenyRules<T>(
  tools: readonly T[],
  permissionContext: ToolPermissionContext,
): T[]
```

### 9.3 权限函数

#### hasPermissionsToUseTool()

```typescript
/**
 * 检查是否有权使用工具
 */
export async function hasPermissionsToUseTool(
  tool: Tool,
  input: Record<string, unknown>,
  toolUseContext: ToolUseContext,
  assistantMessage: AssistantMessage,
  toolUseID: string,
): Promise<PermissionResult>
```

---

## 10. 最佳实践

### 10.1 实现工具

```markdown
✅ 应该做:
1. 使用 buildTool() 构建器
2. 定义清晰的 inputSchema
3. 实现 call() 方法
4. 实现 isReadOnly() 和 isConcurrencySafe()
5. 添加 searchHint 便于搜索
6. 实现 renderToolResultMessage() 用于 UI
7. 添加详细的 description

❌ 不应该做:
1. 直接实现 Tool 接口（使用 buildTool）
2. 省略 inputSchema
3. 不实现权限检查
4. 不处理错误情况
```

### 10.2 权限设计

```markdown
✅ 应该做:
1. 实现 checkPermissions() 用于工具特定逻辑
2. 使用 validateInput() 验证输入
3. 标记 isDestructive() 用于破坏性操作
4. 实现 preparePermissionMatcher() 用于规则匹配

❌ 不应该做:
1. 跳过权限检查
2. 不验证输入
3. 不标记破坏性操作
```

### 10.3 并发安全

```markdown
并发安全判断:
- 读操作 (FileRead, Glob, Grep) → true
- 写操作 (FileWrite, FileEdit) → false
- Bash 命令 → 根据命令判断

最佳实践:
1. 保守判断（不确定时返回 false）
2. 读操作可并发
3. 写操作串行
4. 混合操作按最保守判断
```

---

## 📚 相关文档

- [CLAUDE_CODE_MEMORY_SYSTEM.md](./CLAUDE_CODE_MEMORY_SYSTEM.md) - 记忆系统文档
- [COMPARISON_MEMORY_SYSTEMS.md](./COMPARISON_MEMORY_SYSTEMS.md) - 记忆系统对比
- [LEARNING_GUIDE.md](./LEARNING_GUIDE.md) - 学习指南

---

_文档生成时间：2026-04-02 14:56 GMT+8_  
_源码版本：claudecode-cli-source (2026-03-31 快照)_  
_分析基于：source/src/tools/, source/src/Tool.ts, source/src/tools.ts 源码_
