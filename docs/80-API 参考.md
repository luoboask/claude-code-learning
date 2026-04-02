# API 参考

> 📖 核心 API 索引 | 快速查找关键函数和类型

---

## 🎯 使用说明

本文档提供 Claude Code CLI 核心 API 的快速索引，帮助开发者快速查找关键函数和类型。

---

## 1. 核心引擎 API

### 1.1 QueryEngine

```typescript
// source/src/QueryEngine.ts

class QueryEngine {
  constructor(config: QueryEngineConfig)
  
  async *submitMessage(
    prompt: string | ContentBlockParam[],
    options?: { uuid?: string; isMeta?: boolean }
  ): AsyncGenerator<SDKMessage, void, unknown>
}
```

**用途**: 提交消息到会话，处理工具调用

---

### 1.2 query 循环

```typescript
// source/src/query.ts

async function* query(params: QueryParams): AsyncGenerator<StreamEvent, Terminal>

async function* queryLoop(
  params: QueryParams,
  consumedCommandUuids: string[],
): AsyncGenerator<StreamEvent | RequestStartEvent | Message | TombstoneMessage | ToolUseSummaryMessage, Terminal>
```

**用途**: 核心查询循环，处理模型调用和工具执行

---

## 2. 工具系统 API

### 2.1 Tool 接口

```typescript
// source/src/Tool.ts

export type Tool<Input, Output, Progress> = {
  name: string
  inputSchema: Input
  call(args, context, canUseTool, parentMessage, onProgress): Promise<ToolResult<Output>>
  isEnabled(): boolean
  isConcurrencySafe(input): boolean
  isReadOnly(input): boolean
  isDestructive?(input): boolean
  // ... 40+ 字段
}
```

**用途**: 定义工具的标准接口

---

### 2.2 buildTool 构建器

```typescript
// source/src/Tool.ts

export function buildTool<D extends AnyToolDef>(def: D): BuiltTool<D>
```

**用途**: 从部分定义构建完整工具，填充默认值

---

### 2.3 工具注册

```typescript
// source/src/tools.ts

export function getAllBaseTools(): Tools

export const getTools = (permissionContext: ToolPermissionContext): Tools

export function filterToolsByDenyRules<T>(
  tools: readonly T[],
  permissionContext: ToolPermissionContext,
): T[]
```

**用途**: 获取和过滤工具列表

---

### 2.4 工具执行编排

```typescript
// source/src/services/tools/toolOrchestration.ts

export async function* runTools(
  toolUseMessages: ToolUseBlock[],
  assistantMessages: AssistantMessage[],
  canUseTool: CanUseToolFn,
  toolUseContext: ToolUseContext,
): AsyncGenerator<MessageUpdate, void>
```

**用途**: 执行工具调用，支持并发/串行分区

---

## 3. 状态管理 API

### 3.1 createStore

```typescript
// source/src/state/store.ts

export function createStore<T>(
  initialState: T,
  onChange?: OnChange<T>,
): Store<T>

type Store<T> = {
  getState: () => T
  setState: (updater: (prev: T) => T) => void
  subscribe: (listener: Listener) => () => void
}
```

**用途**: 创建状态存储，提供发布订阅模式

---

### 3.2 AppState

```typescript
// source/src/state/AppStateStore.ts

export type AppState = DeepImmutable<{
  settings: SettingsJson
  toolPermissionContext: ToolPermissionContext
  mcp: {
    clients: MCPServerConnection[]
    tools: Tool[]
    commands: Command[]
  }
  tasks: { [taskId: string]: TaskState }
  // ... 更多状态
}>
```

**用途**: 定义应用全局状态结构

---

## 4. 记忆系统 API

### 4.1 记忆加载

```typescript
// source/src/memdir/memdir.ts

export function buildMemoryPrompt(params: {
  displayName: string
  memoryDir: string
  extraGuidelines?: string[]
}): string

export function buildMemoryLines(
  displayName: string,
  memoryDir: string,
  extraGuidelines?: string[],
  skipIndex?: boolean,
): string[]
```

**用途**: 构建记忆系统提示

---

### 4.2 记忆路径

```typescript
// source/src/memdir/paths.ts

export function isAutoMemoryEnabled(): boolean

export function getMemoryBaseDir(): string

export function getAutoMemPath(): string

export function hasAutoMemPathOverride(): boolean
```

**用途**: 管理记忆目录路径

---

### 4.3 质量管控

```typescript
// source/src/memdir/memdir.ts

export const MAX_ENTRYPOINT_LINES = 200
export const MAX_ENTRYPOINT_BYTES = 25_000

export function truncateEntrypointContent(raw: string): EntrypointTruncation
```

**用途**: 截断记忆内容到限制内

---

## 5. 权限系统 API

### 5.1 权限检查

```typescript
// source/src/hooks/useCanUseTool.tsx

export type CanUseToolFn<Input> = (
  tool: Tool,
  input: Input,
  toolUseContext: ToolUseContext,
  assistantMessage: AssistantMessage,
  toolUseID: string,
  forceDecision?: PermissionDecision<Input>,
) => Promise<PermissionDecision<Input>>
```

**用途**: 检查工具调用权限

---

### 5.2 权限规则匹配

```typescript
// source/src/utils/permissions/permissions.ts

export async function hasPermissionsToUseTool(
  tool: Tool,
  input: Record<string, unknown>,
  toolUseContext: ToolUseContext,
  assistantMessage: AssistantMessage,
  toolUseID: string,
): Promise<PermissionResult>

export function getDenyRuleForTool(
  permissionContext: ToolPermissionContext,
  tool: { name: string; mcpInfo?: { serverName: string; toolName: string } },
): PermissionRule | null
```

**用途**: 匹配权限规则

---

## 6. MCP 集成 API

### 6.1 MCP 客户端

```typescript
// source/src/services/mcp/client.ts

export class McpClient {
  constructor(serverName: string, config: McpServerConfig)
  
  async connect(): Promise<void>
  
  async listTools(): Promise<ListToolsResult>
  
  async callTool(name: string, args: Record<string, unknown>): Promise<MCPToolResult>
}
```

**用途**: 连接和调用 MCP 服务器

---

### 6.2 MCP 错误

```typescript
export class McpToolCallError extends Error {
  constructor(
    message: string,
    telemetryMessage: string,
    readonly mcpMeta?: { _meta?: Record<string, unknown> },
  )
}
```

**用途**: MCP 工具调用错误

---

## 7. Bash 安全 API

### 7.1 安全检查

```typescript
// source/src/tools/BashTool/bashSecurity.ts

const BASH_SECURITY_CHECK_IDS = {
  INCOMPLETE_COMMANDS: 1,
  JQ_SYSTEM_FUNCTION: 2,
  SHELL_METACHARACTERS: 5,
  DANGEROUS_VARIABLES: 6,
  COMMAND_SUBSTITUTION: 8,
  ZSH_DANGEROUS_COMMANDS: 20,
  // ... 共 24 项
}
```

**用途**: Bash 安全检查 ID 定义

---

### 7.2 验证函数

```typescript
function validateEmpty(context): PermissionResult
function validateIncompleteCommands(context): PermissionResult
function validateJqCommand(context): PermissionResult
function validateShellMetacharacters(context): PermissionResult
function validateZshDangerousCommands(context): PermissionResult
```

**用途**: 执行具体安全检查

---

## 8. 类型定义

### 8.1 消息类型

```typescript
// source/src/types/message.ts

type Message =
  | UserMessage
  | AssistantMessage
  | SystemMessage
  | AttachmentMessage
  | ProgressMessage
  | ToolUseSummaryMessage
  | TombstoneMessage
```

---

### 8.2 工具结果

```typescript
// source/src/Tool.ts

export type ToolResult<T> = {
  data: T
  newMessages?: (UserMessage | AssistantMessage | AttachmentMessage | SystemMessage)[]
  contextModifier?: (context: ToolUseContext) => ToolUseContext
  mcpMeta?: { _meta?: Record<string, unknown>; structuredContent?: Record<string, unknown> }
}
```

---

### 8.3 权限结果

```typescript
// source/src/types/permissions.ts

export type PermissionResult =
  | { behavior: 'allow'; updatedInput?: Record<string, unknown>; decisionReason?: PermissionDecisionReason }
  | { behavior: 'deny'; decisionReason?: PermissionDecisionReason }
  | { behavior: 'ask'; pendingClassifierCheck?: PendingClassifierCheck; updatedInput?: Record<string, unknown>; suggestions?: Suggestion[] }
```

---

## 9. 工具函数

### 9.1 工具匹配

```typescript
// source/src/Tool.ts

export function toolMatchesName(
  tool: { name: string; aliases?: string[] },
  name: string,
): boolean

export function findToolByName(tools: Tools, name: string): Tool | undefined
```

---

### 9.2 生成器工具

```typescript
// source/src/utils/generators.ts

export async function* all<T>(
  generators: Array<Promise<AsyncGenerator<T>> | AsyncGenerator<T>>,
  concurrency: number = Infinity,
): AsyncGenerator<T>
```

**用途**: 并发执行多个生成器

---

## 10. 常量定义

### 10.1 记忆限制

```typescript
// source/src/memdir/memdir.ts

export const MAX_ENTRYPOINT_LINES = 200
export const MAX_ENTRYPOINT_BYTES = 25_000
```

### 10.2 工具预设

```typescript
// source/src/tools.ts

export const TOOL_PRESETS = ['default'] as const
```

---

_最后更新：2026-04-02_
