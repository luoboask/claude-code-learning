# Claude Code 记忆系统完整文档

> 📅 分析时间：2026-04-02  
> 📂 源码位置：`source/src/memdir/`  
> 📄 核心文件：`memdir.ts`, `memoryTypes.ts`, `paths.ts`

---

## 📑 目录

1. [系统架构](#1-系统架构)
2. [记忆类型系统](#2-记忆类型系统)
3. [文件结构与路径](#3-文件结构与路径)
4. [质量管控机制](#4-质量管控机制)
5. [记忆写入指南](#5-记忆写入指南)
6. [记忆读取与验证](#6-记忆读取与验证)
7. [后台自动提取](#7-后台自动提取)
8. [API 参考](#8-api-参考)
9. [最佳实践](#9-最佳实践)

---

## 1. 系统架构

### 1.1 核心组件

```
memdir/
├── memdir.ts              # 核心逻辑 (21KB)
├── memoryTypes.ts         # 类型定义 (23KB)
├── paths.ts               # 路径管理 (11KB)
├── memoryAge.ts           # 记忆年龄
├── memoryScan.ts          # 记忆扫描
├── teamMemPaths.ts        # 团队记忆路径
└── teamMemPrompts.ts      # 团队记忆提示
```

### 1.2 系统分层

```
┌─────────────────────────────────────────┐
│  应用层                                  │
│  - buildMemoryPrompt()                  │
│  - loadMemoryPrompt()                   │
│  - ensureMemoryDirExists()              │
├─────────────────────────────────────────┤
│  核心层                                  │
│  - buildMemoryLines()                   │
│  - truncateEntrypointContent()          │
│  - buildSearchingPastContextSection()   │
├─────────────────────────────────────────┤
│  类型层                                  │
│  - MEMORY_TYPES (4 种类型)               │
│  - TYPES_SECTION_INDIVIDUAL             │
│  - WHAT_NOT_TO_SAVE_SECTION             │
├─────────────────────────────────────────┤
│  路径层                                  │
│  - getMemoryBaseDir()                   │
│  - getAutoMemPath()                     │
│  - validateMemoryPath()                 │
└─────────────────────────────────────────┘
```

### 1.3 记忆系统定位

```
Claude Code 持久化系统对比:

┌─────────────────┬──────────────┬──────────────┬──────────────┐
│ 系统            │ 用途         │ 生命周期     │ 访问方式     │
├─────────────────┼──────────────┼──────────────┼──────────────┤
│ MEMORY.md       │ 长期记忆     │ 永久         │ 自动加载     │
│ Session Memory  │ 会话笔记     │ 会话期间     │ 后台提取     │
│ CLAUDE.md       │ 项目指令     │ 项目周期     │ 自动发现     │
│ Plan            │ 当前任务计划 │ 任务周期     │ 手动创建     │
│ Tasks           │ 当前任务列表 │ 会话期间     │ 手动管理     │
└─────────────────┴──────────────┴──────────────┴──────────────┘
```

---

## 2. 记忆类型系统

### 2.1 四层记忆类型

```typescript
// source/src/memdir/memoryTypes.ts
export const MEMORY_TYPES = [
  'user',       // 用户记忆
  'feedback',   // 反馈记忆
  'project',    // 项目记忆
  'reference',  // 参考记忆
] as const
```

### 2.2 User Memory（用户记忆）

**定义**: 关于用户角色、目标、职责和知识的信息

**作用域**: 始终私有 (always private)

**何时保存**:
- 了解用户的角色、偏好、职责或知识时
- 学习用户的工作方式时
- 发现用户的专业领域时

**如何使用**:
- 当工作需要基于用户的背景或视角时
- 调整解释方式适应用户的知识水平
- 定制沟通风格

**示例**:
```markdown
---
name: 数据科学家角色
description: 用户是数据科学家，专注于可观测性和日志分析
type: user
---

用户是数据科学家，目前专注于可观测性/logging 领域。
解释问题时应该：
- 使用数据分析相关的类比
- 强调日志和监控的最佳实践
- 提供可量化的结果
```

**保存示例**:
```
用户：我在调查我们有哪些日志记录
助手：[保存私有用户记忆：用户是数据科学家，目前专注于可观测性/logging]
```

---

### 2.3 Feedback Memory（反馈记忆）

**定义**: 用户给出的工作方式指导——既要避免什么，也要保持什么

**作用域**: 默认私有。仅当指导是项目级约定时才保存为团队

**何时保存**:
- 用户纠正你的方法时 ("不，不是那样"、"不要"、"停止做 X")
- 用户确认非显而易见的方法有效时 ("对，正是这样"、"完美，继续保持")
- 纠正和确认都要记录
- 包含*为什么*以便判断边界情况

**结构**:
```markdown
规则本身
**Why:** 用户给出的原因（通常是过去的事件或强烈偏好）
**How to apply:** 这个指导何时/何地适用
```

**示例**:
```markdown
---
name: 测试必须用真实数据库
description: 集成测试禁止 mock 数据库，必须使用真实连接
type: feedback
---

集成测试必须 hit 真实数据库，不能使用 mock。

**Why:** 去年 mock 测试通过但生产迁移失败，mock/生产差异掩盖了损坏的迁移

**How to apply:** 
- 所有集成测试必须配置真实数据库连接
- 单元测试可以 mock
- 端到端测试必须真实环境
```

**保存示例**:
```
用户：不要在这些测试中 mock 数据库——去年我们因此吃亏，mock 测试通过但生产迁移失败
助手：[保存团队反馈记忆：集成测试必须用真实数据库。原因：mock/生产差异掩盖了损坏的迁移]
```

---

### 2.4 Project Memory（项目记忆）

**定义**: 关于项目中正在进行的工作、目标、计划、bug 或事件的信息

**作用域**: 私有或团队，但强烈偏向团队

**何时保存**:
- 了解谁在做什么、为什么、何时完成
- 项目状态变化相对较快，需要保持理解最新
- 将相对日期转为绝对日期（如"周四"→"2026-03-05"）

**结构**:
```markdown
事实或决策
**Why:** 动机（通常是约束、截止日期或利益相关者要求）
**How to apply:** 这应该如何塑造你的建议
```

**示例**:
```markdown
---
name: 移动端发布冻结合并
description: 2026-03-05 后冻结合并，移动端发布分支
type: project
---

2026-03-05 后冻结合并（移动端发布分支切割）

**Why:** 移动端团队要切割发布分支，需要稳定代码

**How to apply:**
- 标记所有计划在此日期后的非关键 PR 工作
- 关键 bug 修复仍需立即合并
- 提前通知用户可能的延迟
```

**保存示例**:
```
用户：周四后我们要冻结所有非关键合并——移动端团队要切割发布分支
助手：[保存项目记忆：2026-03-05 后冻结合并。标记该日期后的非关键 PR 工作]
```

---

### 2.5 Reference Memory（参考记忆）

**定义**: 指向外部系统中信息位置的指针

**作用域**: 通常是团队

**何时保存**:
- 了解外部系统中的资源及其用途时
- 例如：bug 在哪个 Linear 项目追踪、反馈在哪个 Slack 频道

**如何使用**:
- 当用户引用外部系统或可能在外部系统中的信息时

**示例**:
```markdown
---
name: Linear 管道 bug 追踪
description: 管道 bug 在 Linear 项目"INGEST"中追踪
type: reference
---

管道 bug 在 Linear 项目"INGEST"中追踪

URL: https://linear.app/company/project/INGEST
```

**保存示例**:
```
用户：如果你想了解这些 ticket 的背景，查看 Linear 项目"INGEST"，我们在那里追踪所有管道 bug
助手：[保存参考记忆：管道 bug 在 Linear 项目"INGEST"中追踪]
```

---

### 2.6 禁止保存的内容

```markdown
## What NOT to save in memory

❌ 代码模式、约定、架构、文件路径或项目结构
   → 这些可以通过阅读当前项目状态获得

❌ Git 历史、最近的更改、谁改了什么
   → `git log` / `git blame` 是权威来源

❌ 调试解决方案或修复方案
   → 修复已在代码中；提交消息有上下文

❌ CLAUDE.md 文件中已记录的内容
   → 避免重复

❌ 临时任务详情：进行中的工作、临时状态、当前对话上下文
   → 这些仅在当前会话有用

⚠️ 即使用户明确要求保存这些内容，也适用上述排除规则。
   如果用户要求保存 PR 列表或活动摘要，询问其中什么是*令人惊讶*或*非显而易见*的——那才是值得保存的部分。
```

---

## 3. 文件结构与路径

### 3.1 记忆目录结构

```
~/.claude/projects/<project-slug>/memory/
├── MEMORY.md              # 索引文件（入口点）
├── user_role.md           # 用户记忆文件
├── feedback_testing.md    # 反馈记忆文件
├── project_deadline.md    # 项目记忆文件
└── reference_linear.md    # 参考记忆文件
```

### 3.2 路径解析顺序

```typescript
// source/src/memdir/paths.ts

/**
 * 记忆基础目录解析顺序:
 * 1. CLAUDE_CODE_REMOTE_MEMORY_DIR 环境变量 (CCR 中设置的显式覆盖)
 * 2. ~/.claude (默认配置主目录)
 */
export function getMemoryBaseDir(): string {
  if (process.env.CLAUDE_CODE_REMOTE_MEMORY_DIR) {
    return process.env.CLAUDE_CODE_REMOTE_MEMORY_DIR
  }
  return getClaudeConfigHomeDir()
}
```

### 3.3 自动记忆路径

```typescript
/**
 * 自动记忆目录路径
 * 解析顺序 (第一个定义的获胜):
 * 1. CLAUDE_COWORK_MEMORY_PATH_OVERRIDE 环境变量
 * 2. settings.json 中的 autoMemoryDirectory 设置
 * 3. 默认：~/.claude/projects/<project>/memory/
 */
export function getAutoMemPath(): string {
  // 1. 环境变量覆盖
  const override = getAutoMemPathOverride()
  if (override) return override
  
  // 2. 设置覆盖
  const setting = getAutoMemPathSetting()
  if (setting) return setting
  
  // 3. 默认路径
  return join(getProjectRoot(), 'memory') + sep
}
```

### 3.4 路径验证规则

```typescript
// source/src/memdir/paths.ts - validateMemoryPath()

/**
 * SECURITY: 拒绝危险路径
 * - 相对路径 (!isAbsolute): "../foo"
 * - 根目录/近根目录 (长度 < 3): "/" → "" after strip
 * - Windows 盘符根 (C:): "C:\" → "C:" after strip
 * - UNC 路径 (\\server\share): 网络路径
 * - null 字节：可在 syscalls 中截断
 */
function validateMemoryPath(raw: string | undefined, expandTilde: boolean): string | undefined {
  if (!raw) return undefined
  
  // ~/ 展开 (仅设置支持，环境变量不支持)
  if (expandTilde && (candidate.startsWith('~/') || candidate.startsWith('~\\'))) {
    const rest = candidate.slice(2)
    // 拒绝平凡剩余（会使 isAutoMemPath() 匹配所有 $HOME）
    const restNorm = normalize(rest || '.')
    if (restNorm === '.' || restNorm === '..') {
      return undefined
    }
    candidate = join(homedir(), rest)
  }
  
  // 标准化并添加 trailing separator
  const normalized = normalize(candidate).replace(/[/\\]+$/, '')
  
  // 安全检查
  if (
    !isAbsolute(normalized) ||
    normalized.length < 3 ||
    /^[A-Za-z]:$/.test(normalized) ||
    normalized.startsWith('\\\\') ||
    normalized.startsWith('//') ||
    normalized.includes('\0')
  ) {
    return undefined
  }
  
  return (normalized + sep).normalize('NFC')
}
```

---

## 4. 质量管控机制

### 4.1 双重限制

```typescript
// source/src/memdir/memdir.ts

export const ENTRYPOINT_NAME = 'MEMORY.md'
export const MAX_ENTRYPOINT_LINES = 200
export const MAX_ENTRYPOINT_BYTES = 25_000  // ~25KB

/**
 * 截断 MEMORY.md 内容到行和字节上限
 * 先按行截断（自然边界），再按字节截断（在最后一个换行处）
 */
export function truncateEntrypointContent(raw: string): EntrypointTruncation {
  const trimmed = raw.trim()
  const contentLines = trimmed.split('\n')
  const lineCount = contentLines.length
  const byteCount = trimmed.length

  const wasLineTruncated = lineCount > MAX_ENTRYPOINT_LINES
  const wasByteTruncated = byteCount > MAX_ENTRYPOINT_BYTES

  if (!wasLineTruncated && !wasByteTruncated) {
    return { content: trimmed, lineCount, byteCount, wasLineTruncated, wasByteTruncated }
  }

  // 先按行截断
  let truncated = wasLineTruncated
    ? contentLines.slice(0, MAX_ENTRYPOINT_LINES).join('\n')
    : trimmed

  // 再按字节截断（在最后一个换行处）
  if (truncated.length > MAX_ENTRYPOINT_BYTES) {
    const cutAt = truncated.lastIndexOf('\n', MAX_ENTRYPOINT_BYTES)
    truncated = truncated.slice(0, cutAt > 0 ? cutAt : MAX_ENTRYPOINT_BYTES)
  }

  // 生成警告信息
  const reason =
    wasByteTruncated && !wasLineTruncated
      ? `${formatFileSize(byteCount)} (limit: ${formatFileSize(MAX_ENTRYPOINT_BYTES)}) — index entries are too long`
      : wasLineTruncated && !wasByteTruncated
        ? `${lineCount} lines (limit: ${MAX_ENTRYPOINT_LINES})`
        : `${lineCount} lines and ${formatFileSize(byteCount)}`

  return {
    content: truncated +
      `\n\n> WARNING: ${ENTRYPOINT_NAME} is ${reason}. Only part of it was loaded.`,
    lineCount,
    byteCount,
    wasLineTruncated,
    wasByteTruncated,
  }
}
```

### 4.2 截断警告示例

```markdown
## MEMORY.md

- [用户角色](user_role.md) — 数据科学家，专注于可观测性
- [反馈测试](feedback_testing.md) — 集成测试必须用真实数据库
- [项目截止](project_deadline.md) — 2026-03-05 冻结合并
- [参考 Linear](reference_linear.md) — 管道 bug 在 Linear "INGEST" 追踪
... (共 195 行)

> WARNING: MEMORY.md is 200 lines (limit: 200). Only part of it was loaded. 
> Keep index entries to one line under ~150 characters; move detail into topic files.
```

### 4.3 日志记录

```typescript
// 异步记录记忆目录文件/子目录计数
function logMemoryDirCounts(memoryDir: string, baseMetadata: Record<string, any>): void {
  const fs = getFsImplementation()
  void fs.readdir(memoryDir).then(
    dirents => {
      let fileCount = 0
      let subdirCount = 0
      for (const d of dirents) {
        if (d.isFile()) fileCount++
        else if (d.isDirectory()) subdirCount++
      }
      logEvent('tengu_memdir_loaded', {
        ...baseMetadata,
        total_file_count: fileCount,
        total_subdir_count: subdirCount,
      })
    },
    () => {
      // 目录不可读，记录不含计数的日志
      logEvent('tengu_memdir_loaded', baseMetadata)
    },
  )
}
```

---

## 5. 记忆写入指南

### 5.1 写入流程

```
保存记忆 = 两步过程

Step 1 — 将记忆写入独立文件
  例如：user_role.md, feedback_testing.md
  使用 frontmatter 格式：
  ---
  name: {{记忆名称}}
  description: {{一行描述}}
  type: {{user|feedback|project|reference}}
  ---
  
  {{记忆内容}}

Step 2 — 在 MEMORY.md 中添加指针
  MEMORY.md 是索引，不是记忆本身
  每条目一行，<150 字符：- [Title](file.md) — 一行钩子
  没有 frontmatter
  永远不要直接在 MEMORY.md 中写记忆内容
```

### 5.2 Frontmatter 格式

```markdown
---
name: {{记忆名称}}
description: {{一行描述 — 用于决定未来会话中的相关性，要具体}}
type: {{user, feedback, project, reference}}
---

{{记忆内容 — 对于 feedback/project 类型，结构为：规则/事实，然后 **Why:** 和 **How to apply:** 行}}
```

### 5.3 写入规则

```markdown
## How to save memories

✅ 应该做:
- 为每个记忆创建独立文件
- 使用 frontmatter 格式
- 保持名称、描述、类型字段与内容同步
- 按主题组织记忆，而非按时间顺序
- 更新或删除错误/过时的记忆
- 写入前检查是否有重复记忆可更新

❌ 不应该做:
- 直接在 MEMORY.md 中写记忆内容
- 索引条目超过 150 字符
- 写入可推导的内容（代码模式、Git 历史等）
- 写入临时任务详情
```

### 5.4 目录存在保证

```typescript
// source/src/memdir/memdir.ts

/**
 * 确保记忆目录存在
 * 幂等 — 从 loadMemoryPrompt 调用（通过 systemPromptSection 缓存每会话一次）
 * 所以模型总是可以直接写入而无需检查存在性
 */
export async function ensureMemoryDirExists(memoryDir: string): Promise<void> {
  const fs = getFsImplementation()
  try {
    await fs.mkdir(memoryDir)  // 递归创建，自动处理 EEXIST
  } catch (e) {
    // fs.mkdir 已在内部处理 EEXIST
    // 到达这里的都是真实问题 (EACCES/EPERM/EROFS)
    const code = e instanceof Error && 'code' in e && typeof e.code === 'string'
      ? e.code
      : undefined
    logForDebugging(
      `ensureMemoryDirExists failed for ${memoryDir}: ${code ?? String(e)}`,
      { level: 'debug' },
    )
  }
}

/**
 * 附加到每个记忆目录提示行的共享指导文本
 * 因为 Claude 在写入前会浪费轮次运行 `ls`/`mkdir -p`
 * Harness 保证目录通过 ensureMemoryDirExists() 存在
 */
export const DIR_EXISTS_GUIDANCE = 
  'This directory already exists — write to it directly with the Write tool ' +
  '(do not run mkdir or check for its existence).'
```

---

## 6. 记忆读取与验证

### 6.1 何时访问记忆

```markdown
## When to access memories

✅ 应该访问:
- 当记忆看起来相关时
- 当用户引用 prior-conversation 工作时
- 当用户明确要求检查、回忆或记住时

❌ 不应该访问:
- 如果用户说"忽略"或"不使用"记忆：
  像 MEMORY.md 为空一样处理
  不要应用记忆事实、引用、对比或提及记忆内容

⚠️ 记忆漂移警告:
Memory records can become stale over time. Use memory as context for what was 
true at a given point in time. Before answering the user or building assumptions 
based solely on information in memory records, verify that the memory is still 
correct and up-to-date by reading the current state of the files or resources. 
If a recalled memory conflicts with current information, trust what you observe 
now — and update or remove the stale memory rather than acting on it.
```

### 6.2 读取时验证

```markdown
## Before recommending from memory

A memory that names a specific function, file, or flag is a claim that it 
existed *when the memory was written*. It may have been renamed, removed, or 
never merged. Before recommending it:

1. **如果记忆命名文件路径**: 检查文件存在
   ```bash
   test -f /path/to/file && echo "存在" || echo "不存在"
   ```

2. **如果记忆命名函数或标志**: grep 搜索
   ```bash
   grep -r "function_name" src/
   ```

3. **如果用户即将基于推荐行动**: 先验证
   ```bash
   # 验证后再推荐
   ```

"The memory says X exists" is not the same as "X exists now."

A memory that summarizes repo state (activity logs, architecture snapshots) is 
frozen in time. If the user asks about *recent* or *current* state, prefer 
`git log` or reading the code over recalling the snapshot.
```

### 6.3 搜索过去上下文

```markdown
## Searching past context

当寻找过去上下文时：

1. 搜索记忆目录中的主题文件:
   ```bash
   # 使用 GrepTool 或 shell grep
   grep -rn "<search term>" ~/.claude/projects/<slug>/memory/ --include="*.md"
   ```

2. 会话转录日志（最后手段 — 大文件，慢）:
   ```bash
   grep -rn "<search term>" <project-dir>/ --include="*.jsonl"
   ```
```

---

## 7. 后台自动提取

### 7.1 提取模式激活

```typescript
// source/src/memdir/paths.ts

/**
 * 是否运行 extract-memories 后台代理
 * 
 * 主代理的提示始终有完整保存指令，无论此 gate 如何
 * - 当主代理写入记忆时，后台代理跳过该范围
 * - 当主代理不写入时，后台代理捕获遗漏的内容
 */
export function isExtractModeActive(): boolean {
  // 特性标志检查
  if (!getFeatureValue_CACHED_MAY_BE_STALE('tengu_passport_quail', false)) {
    return false
  }
  
  // 非交互式会话或特殊标志
  return (
    !getIsNonInteractiveSession() ||
    getFeatureValue_CACHED_MAY_BE_STALE('tengu_slate_thimble', false)
  )
}
```

### 7.2 自动记忆启用检查

```typescript
// source/src/memdir/paths.ts

/**
 * 是否启用自动记忆功能 (memdir, agent memory, past session search)
 * 默认启用。优先级链 (第一个定义的获胜):
 *   1. CLAUDE_CODE_DISABLE_AUTO_MEMORY 环境变量 (1/true → OFF, 0/false → ON)
 *   2. CLAUDE_CODE_SIMPLE (--bare) → OFF
 *   3. CCR 无持久存储 → OFF (无 CLAUDE_CODE_REMOTE_MEMORY_DIR)
 *   4. settings.json 中的 autoMemoryEnabled → 支持项目级 opt-out
 *   5. 默认：启用
 */
export function isAutoMemoryEnabled(): boolean {
  const envVal = process.env.CLAUDE_CODE_DISABLE_AUTO_MEMORY
  if (isEnvTruthy(envVal)) return false
  if (isEnvDefinedFalsy(envVal)) return true
  
  // --bare / SIMPLE: prompts.ts 已从系统提示中删除记忆部分
  if (isEnvTruthy(process.env.CLAUDE_CODE_SIMPLE)) return false
  
  // CCR 无持久存储
  if (
    isEnvTruthy(process.env.CLAUDE_CODE_REMOTE) &&
    !process.env.CLAUDE_CODE_REMOTE_MEMORY_DIR
  ) {
    return false
  }
  
  // settings.json 检查
  const settings = getInitialSettings()
  if (settings.autoMemoryEnabled !== undefined) {
    return settings.autoMemoryEnabled
  }
  
  return true
}
```

### 7.3 会话记忆提取

```typescript
// source/src/services/SessionMemory/sessionMemory.ts

/**
 * 判断是否应该提取记忆
 * 
 * 触发条件:
 * 1. Token 阈值 + 工具调用阈值 都满足
 * 2. 或者 Token 阈值满足 + 最后无工具调用（自然断点）
 */
export function shouldExtractMemory(messages: Message[]): boolean {
  // 检查是否满足初始化阈值
  const currentTokenCount = tokenCountWithEstimation(messages)
  if (!isSessionMemoryInitialized()) {
    if (!hasMetInitializationThreshold(currentTokenCount)) {
      return false
    }
    markSessionMemoryInitialized()
  }

  // 检查是否满足更新间最小 token 阈值
  const hasMetTokenThreshold = hasMetUpdateThreshold(currentTokenCount)

  // 检查是否满足工具调用阈值
  const toolCallsSinceLastUpdate = countToolCallsSince(messages, lastMemoryMessageUuid)
  const hasMetToolCallThreshold = toolCallsSinceLastUpdate >= getToolCallsBetweenUpdates()

  // 检查最后助手轮次是否有工具调用（安全提取）
  const hasToolCallsInLastTurn = hasToolCallsInLastAssistantTurn(messages)

  // 触发提取当:
  // 1. 两个阈值都满足 (tokens AND tool calls), 或
  // 2. 最后轮次无工具调用 AND token 阈值满足 (自然对话断点)
  const shouldExtract =
    (hasMetTokenThreshold && hasMetToolCallThreshold) ||
    (hasMetTokenThreshold && !hasToolCallsInLastTurn)

  if (shouldExtract) {
    const lastMessage = messages[messages.length - 1]
    if (lastMessage?.uuid) {
      lastMemoryMessageUuid = lastMessage.uuid
    }
    return true
  }

  return false
}
```

---

## 8. API 参考

### 8.1 核心函数

#### buildMemoryPrompt()

```typescript
/**
 * 构建带 MEMORY.md 内容的类型化记忆提示
 * 用于代理记忆（没有 getClaudeMds() 等价物）
 */
export function buildMemoryPrompt(params: {
  displayName: string
  memoryDir: string
  extraGuidelines?: string[]
}): string

// 返回: 完整的记忆系统提示字符串
```

#### buildMemoryLines()

```typescript
/**
 * 构建类型化记忆行为指令（不含 MEMORY.md 内容）
 * 将记忆限制为四层分类 (user/feedback/project/reference)
 */
export function buildMemoryLines(
  displayName: string,
  memoryDir: string,
  extraGuidelines?: string[],
  skipIndex?: boolean,
): string[]

// 返回: 提示行数组
```

#### truncateEntrypointContent()

```typescript
/**
 * 截断 MEMORY.md 内容到行和字节上限
 */
export function truncateEntrypointContent(raw: string): EntrypointTruncation {
  // 返回: { content, lineCount, byteCount, wasLineTruncated, wasByteTruncated }
}
```

#### ensureMemoryDirExists()

```typescript
/**
 * 确保记忆目录存在（幂等）
 */
export async function ensureMemoryDirExists(memoryDir: string): Promise<void>
```

### 8.2 路径函数

#### getMemoryBaseDir()

```typescript
/**
 * 返回持久化记忆存储的基础目录
 */
export function getMemoryBaseDir(): string
```

#### getAutoMemPath()

```typescript
/**
 * 返回自动记忆目录的规范路径
 */
export function getAutoMemPath(): string
```

#### hasAutoMemPathOverride()

```typescript
/**
 * 检查 CLAUDE_COWORK_MEMORY_PATH_OVERRIDE 是否设置为有效覆盖
 */
export function hasAutoMemPathOverride(): boolean
```

### 8.3 类型函数

#### parseMemoryType()

```typescript
/**
 * 将 raw frontmatter 值解析为 MemoryType
 * 无效或缺失值返回 undefined
 */
export function parseMemoryType(raw: unknown): MemoryType | undefined
```

---

## 9. 最佳实践

### 9.1 写入最佳实践

```markdown
✅ 应该做:
1. 立即保存用户明确要求记住的内容
2. 为每个记忆创建独立文件
3. 使用 frontmatter 格式
4. 包含 Why 和 How to apply
5. 保持索引条目 <150 字符
6. 按主题组织，非按时间顺序
7. 更新或删除过时记忆
8. 写入前检查重复

❌ 不应该做:
1. 直接在 MEMORY.md 中写内容
2. 记录可推导的内容
3. 记录临时任务详情
4. 写入超过 200 行或 25KB
5. 记录 Git 历史或代码模式
6. 记录 CLAUDE.md 已有内容
```

### 9.2 读取最佳实践

```markdown
✅ 应该做:
1. 访问记忆前验证文件/函数仍存在
2. 注意记忆创建时间
3. 冲突时优先相信当前观察
4. 发现过时记忆立即更新或删除
5. 用户说"忽略"时像空记忆一样处理

❌ 不应该做:
1. 基于过时记忆给出推荐
2. 不验证就推荐具体文件/函数
3. 忽视记忆漂移警告
4. 在用户要求忽略时仍引用记忆
```

### 9.3 组织最佳实践

```markdown
文件命名:
- user_<topic>.md      # 用户记忆
- feedback_<topic>.md  # 反馈记忆
- project_<topic>.md   # 项目记忆
- reference_<topic>.md # 参考记忆

索引格式:
- [用户角色](user_role.md) — 数据科学家，专注于可观测性
- [测试反馈](feedback_testing.md) — 集成测试必须用真实数据库
- [发布冻结](project_freeze.md) — 2026-03-05 后冻结合并
- [Linear 追踪](reference_linear.md) — 管道 bug 在 "INGEST" 项目
```

---

## 📚 相关文档

- [CLAUDE_CODE_TOOL_SYSTEM.md](./CLAUDE_CODE_TOOL_SYSTEM.md) - 工具系统文档
- [COMPARISON_MEMORY_SYSTEMS.md](./COMPARISON_MEMORY_SYSTEMS.md) - 记忆系统对比分析
- [LEARNING_GUIDE.md](./LEARNING_GUIDE.md) - 学习指南

---

_文档生成时间：2026-04-02 14:56 GMT+8_  
_源码版本：claudecode-cli-source (2026-03-31 快照)_  
_分析基于：source/src/memdir/ 目录源码_
