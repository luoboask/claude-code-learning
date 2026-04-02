# evo-agents vs Claude Code CLI 记忆系统对比分析

> 📅 分析时间：2026-04-02  
> 🎯 目标：找出 Claude Code 中可借鉴到 evo-agents 的记忆/知识管理设计

---

## 📊 系统架构对比

### evo-agents 记忆系统

```
evo-agents/memory/
├── MEMORY.md              # 主记忆文件（Markdown）
├── 2026-04-02.md          # 每日记忆
├── archive/               # 归档记忆
├── weekly/                # 周度总结
├── monthly/               # 月度总结
└── working_memory_*.jsonl # 工作记忆（JSONL）

特点:
- ✅ 双层架构：Markdown + SQLite
- ✅ 时间维度：日/周/月归档
- ✅ 重要性评分：≥5.0 才记录
- ✅ 手动记录：session_recorder.py
- ✅ 语义搜索：Ollama 向量嵌入
```

### Claude Code CLI 记忆系统

```
~/.claude/projects/<slug>/memory/
├── MEMORY.md              # 主记忆文件（带类型系统）
└── *.md                   # 主题记忆文件

~/.claude/session-memory/
└── <session-id>.md        # 会话记忆（临时）

特点:
- ✅ 四层记忆：memdir + session + team + project
- ✅ 类型系统：user/feedback/project/reference
- ✅ 自动提取：后台代理定期运行
- ✅ 质量管控：200 行/25KB 限制
- ✅ 验证机制：读取时必须验证存在性
```

---

## 🔍 核心差异对比

| 维度 | evo-agents | Claude Code CLI | 差距分析 |
|------|------------|-----------------|----------|
| **记忆类型** | 无分类 | 4 种类型 | ⭐⭐ Claude Code 更结构化 |
| **记录方式** | 手动 + 自动 | 自动提取 | ⭐⭐ Claude Code 更智能 |
| **质量管控** | 重要性评分 | 行数 + 字节限制 | ⭐⭐ 各有优势 |
| **验证机制** | 无 | 强制验证 | ⭐⭐⭐ Claude Code 显著领先 |
| **类型定义** | 无 | 详细定义 + 示例 | ⭐⭐⭐ Claude Code 更完善 |
| **会话记忆** | 有（模板化） | 有（后台代理） | ⭐ 相当 |
| **团队记忆** | 无 | 有（teamMem） | ⭐⭐ Claude Code 更完整 |
| **语义搜索** | 有（Ollama） | 无（待实现） | ⭐⭐⭐ evo-agents 领先 |
| **SQLite 存储** | 有 | 无 | ⭐⭐⭐ evo-agents 领先 |

---

## 💡 Claude Code 可借鉴的设计（10 个核心点）

### ⭐⭐⭐ 优先级 1：立即实施

#### 1. 四层记忆类型系统

**Claude Code 实现**:
```typescript
// source/src/memdir/memoryTypes.ts
export const MEMORY_TYPES = ['user', 'feedback', 'project', 'reference']

// 每种类型有详细定义
<type>
    <name>feedback</name>
    <description>Guidance the user has given you about how to approach work</description>
    <when_to_save>Any time the user corrects your approach...</when_to_save>
    <how_to_use>Let these memories guide your behavior...</how_to_use>
    <body_structure>Lead with the rule, then **Why:** and **How to apply:**</body_structure>
    <examples>...</examples>
</type>
```

**evo-agents 可借鉴**:
```markdown
# 建议添加到 evo-agents/MEMORY.md

## 记忆类型

### 1. User Memory（用户记忆）
- **内容**: 用户角色、偏好、职责、知识
- **何时保存**: 了解用户的任何细节时
- **如何使用**: 调整行为适应用户背景
- **示例**: "用户是数据科学家，专注于可观测性"

### 2. Feedback Memory（反馈记忆）
- **内容**: 用户的工作方式指导
- **何时保存**: 用户纠正或确认时
- **结构**: 规则 + **Why:** + **How to apply:**
- **示例**: "测试必须用真实数据库（去年 mock 导致生产事故）"

### 3. Project Memory（项目记忆）
- **内容**: 正在进行的工作、目标、事件
- **何时保存**: 了解谁在做什么、为什么、何时
- **结构**: 事实 + **Why:** + **How to apply:**
- **示例**: "2026-03-05 后冻结合并（移动端发布）"

### 4. Reference Memory（参考记忆）
- **内容**: 外部系统资源位置
- **何时保存**: 了解外部资源时
- **示例**: "Linear 项目'INGEST'追踪管道 bug"
```

**价值**: 
- ✅ 结构化记忆，易于检索
- ✅ 明确保存/使用指南
- ✅ 减少 AI 胡乱记录

---

#### 2. 质量管控机制

**Claude Code 实现**:
```typescript
// source/src/memdir/memdir.ts
export const MAX_ENTRYPOINT_LINES = 200
export const MAX_ENTRYPOINT_BYTES = 25_000  // ~25KB

export function truncateEntrypointContent(raw: string): EntrypointTruncation {
  const contentLines = raw.split('\n')
  const wasLineTruncated = contentLines.length > MAX_ENTRYPOINT_LINES
  const wasByteTruncated = raw.length > MAX_ENTRYPOINT_BYTES
  
  // 双重限制 + 警告信息
  return {
    content: truncated + 
      `\n\n> WARNING: MEMORY.md is ${reason}. Only part was loaded.`,
    wasLineTruncated,
    wasByteTruncated,
  }
}
```

**evo-agents 可借鉴**:
```python
# 添加到 evo-agents/scripts/core/memory_validator.py

MAX_MEMORY_LINES = 200
MAX_MEMORY_BYTES = 25000

def validate_memory_file(path: str) -> dict:
    """验证记忆文件质量"""
    with open(path, 'r') as f:
        content = f.read()
    
    lines = content.split('\n')
    result = {
        'valid': True,
        'line_count': len(lines),
        'byte_count': len(content),
        'warnings': []
    }
    
    if len(lines) > MAX_MEMORY_LINES:
        result['valid'] = False
        result['warnings'].append(
            f"行数超限：{len(lines)} > {MAX_MEMORY_LINES}"
        )
    
    if len(content) > MAX_MEMORY_BYTES:
        result['valid'] = False
        result['warnings'].append(
            f"大小超限：{len(content)} > {MAX_MEMORY_BYTES} bytes"
        )
    
    return result
```

**价值**:
- ✅ 防止记忆文件无限膨胀
- ✅ 强制 AI 写精简内容
- ✅ 保持检索效率

---

#### 3. 读取时验证机制

**Claude Code 实现**:
```typescript
// source/src/memdir/memoryTypes.ts - TRUSTING_RECALL_SECTION
export const TRUSTING_RECALL_SECTION = [
  '## Before recommending from memory',
  '',
  'A memory that names a specific function, file, or flag is a claim',
  'that it existed *when the memory was written*. It may have been',
  'renamed, removed, or never merged. Before recommending it:',
  '',
  '- If the memory names a file path: check the file exists.',
  '- If the memory names a function or flag: grep for it.',
  '- If the user is about to act on your recommendation, verify first.',
  '',
  '"The memory says X exists" is not the same as "X exists now."',
]
```

**evo-agents 可借鉴**:
```markdown
# 添加到 evo-agents/docs/MEMORY_USAGE.md

## 读取记忆时的验证规则

AI 在读取记忆后，必须遵循以下验证规则：

### 1. 文件路径验证
如果记忆提到具体文件：
```bash
# 验证文件存在
test -f /path/to/file && echo "存在" || echo "不存在"
```

### 2. 函数/标志验证
如果记忆提到函数或配置：
```bash
# 搜索函数定义
grep -r "function_name" src/

# 搜索配置标志
grep -r "FEATURE_FLAG" config/
```

### 3. 时间敏感性验证
如果记忆包含时间相关信息：
- 检查记忆创建时间
- 验证是否仍然适用
- 如过时，标记为 `[STALE]`

### 4. 冲突处理
如果记忆与当前状态冲突：
1. 优先相信当前观察
2. 更新或删除过时记忆
3. 记录冲突原因
```

**价值**:
- ✅ 防止 AI 基于过时记忆给出错误建议
- ✅ 建立"验证优先"的行为模式
- ✅ 减少用户被误导的情况

---

### ⭐⭐ 优先级 2：近期实施

#### 4. 后台自动提取代理

**Claude Code 实现**:
```typescript
// source/src/services/SessionMemory/sessionMemory.ts

export function shouldExtractMemory(messages: Message[]): boolean {
  // 触发条件：
  // 1. Token 阈值 + 工具调用阈值 都满足
  // 2. 或者 Token 阈值满足 + 最后无工具调用（自然断点）
  
  const hasMetTokenThreshold = hasMetUpdateThreshold(currentTokenCount)
  const hasMetToolCallThreshold = toolCallsSinceLastUpdate >= threshold
  const hasToolCallsInLastTurn = hasToolCallsInLastAssistantTurn(messages)
  
  return (hasMetTokenThreshold && hasMetToolCallThreshold) ||
         (hasMetTokenThreshold && !hasToolCallsInLastTurn)
}

// 后台代理定期运行
async function runForkedAgent() {
  const memory = await extractSessionMemory(messages)
  await writeFile(memoryPath, memory)
}
```

**evo-agents 可借鉴**:
```python
# 添加到 evo-agents/scripts/core/auto_extractor.py

import asyncio
from openai import AsyncOpenAI

class MemoryExtractor:
    """后台记忆提取代理"""
    
    def __init__(self):
        self.client = AsyncOpenAI(base_url="http://localhost:11434/v1")
        self.last_extract_uuid = None
        self.token_threshold = 5000
        self.tool_call_threshold = 5
    
    def should_extract(self, messages: list) -> bool:
        """判断是否应该提取记忆"""
        # 计算自上次提取后的 token 增长
        current_tokens = self.count_tokens(messages)
        token_growth = current_tokens - self.last_token_count
        
        # 计算工具调用次数
        tool_calls = self.count_tool_calls(messages, self.last_extract_uuid)
        
        # 检查最后是否有工具调用（自然断点）
        has_tool_in_last_turn = self.has_tool_calls_in_last_turn(messages)
        
        # 触发条件
        return (token_growth >= self.token_threshold and 
                tool_calls >= self.tool_call_threshold) or \
               (token_growth >= self.token_threshold and 
                not has_tool_in_last_turn)
    
    async def extract(self, messages: list) -> str:
        """提取记忆"""
        prompt = self.build_extraction_prompt(messages)
        response = await self.client.chat.completions.create(
            model="qwen2.5:7b",
            messages=[{"role": "user", "content": prompt}]
        )
        return response.choices[0].message.content
```

**价值**:
- ✅ 无需手动记录
- ✅ 不会打断对话流
- ✅ 持续维护记忆

---

#### 5. 记忆漂移警告

**Claude Code 实现**:
```typescript
// source/src/memdir/memoryTypes.ts
export const MEMORY_DRIFT_CAVEAT = 
  'Memory records can become stale over time. Use memory as context for ' +
  'what was true at a given point in time. Before answering the user or ' +
  'building assumptions based solely on information in memory records, ' +
  'verify that the memory is still correct and up-to-date by reading the ' +
  'current state of the files or resources. If a recalled memory conflicts ' +
  'with current information, trust what you observe now — and update or ' +
  'remove the stale memory rather than acting on it.'
```

**evo-agents 可借鉴**:
```markdown
# 添加到 evo-agents/MEMORY.md 顶部

> ⚠️ **记忆漂移警告**
> 
> 记忆记录会随时间过时。使用记忆时请遵循：
> 
> 1. **验证优先**: 基于记忆做推荐前，验证文件/函数仍存在
> 2. **时间戳**: 注意记忆创建时间，评估是否仍适用
> 3. **冲突处理**: 记忆与当前状态冲突时，优先相信当前观察
> 4. **更新义务**: 发现过时记忆，立即更新或删除
> 
> "记忆说 X 存在" ≠ "X 现在存在"
```

**价值**:
- ✅ 提醒 AI 记忆可能过时
- ✅ 建立验证习惯
- ✅ 减少错误推荐

---

#### 6. 记忆结构模板

**Claude Code 实现**:
```typescript
// source/src/services/SessionMemory/prompts.ts
export const DEFAULT_SESSION_MEMORY_TEMPLATE = `
# Session Title
_A short and distinctive 5-10 word descriptive title_

# Current State
_What is actively being worked on right now?_

# Task specification
_What did the user ask to build?_

# Files and Functions
_What are the important files? Why relevant?_

# Workflow
_What bash commands are usually run and in what order?_

# Errors & Corrections
_Errors encountered and how they were fixed._

# Codebase and System Documentation
_How do components work/fit together?_

# Learnings
_What has worked well? What has not?_

# Key results
_Exact output the user requested_

# Worklog
_Terse step by step summary_
`
```

**evo-agents 可借鉴**:
```markdown
# 添加到 evo-agents/docs/SESSION_MEMORY_TEMPLATE.md

## 会话记忆模板

```markdown
# {{会话标题}}

## 当前状态
{{正在进行的工作、待完成任务}}

## 任务规格
{{用户要求构建什么、设计决策}}

## 关键文件
{{文件路径、作用、重要性}}

## 工作流
{{常用命令、执行顺序、输出解读}}

## 错误与修复
{{遇到的错误、解决方案、避免的方法}}

## 系统理解
{{组件如何协作、架构决策}}

## 经验教训
{{有效的方法、避免的陷阱}}

## 关键结果
{{用户请求的确切输出}}

## 工作日志
{{逐步执行摘要}}
```

### 使用规则

1. **保持结构**: 不要修改/删除章节标题和斜体说明
2. **详细具体**: 包含文件路径、函数名、错误消息
3. **限制长度**: 每节 <2000 tokens，总计 <12000 tokens
4. **及时更新**: 每次会话后更新"当前状态"
5. **避免重复**: 不要记录 CLAUDE.md 已有的内容
```

**价值**:
- ✅ 标准化记忆格式
- ✅ 便于后续检索
- ✅ 提高记忆质量

---

### ⭐ 优先级 3：长期优化

#### 7. 团队记忆系统

**Claude Code 实现**:
```typescript
// source/src/memdir/teamMemPaths.ts
export function getTeamMemoryDir(): string {
  // 团队记忆路径
  // ~/.claude/team/<team-id>/memory/
  return join(getMemoryBaseDir(), 'team', teamId, 'memory')
}

// 团队记忆支持：
// - private/team 作用域标记
// - 团队同步机制
// - 冲突解决策略
```

**evo-agents 可借鉴**:
```markdown
# 未来功能：团队记忆

## 设计思路

### 作用域分类
- **Private**: 仅当前用户可见
- **Team**: 团队成员共享

### 同步机制
- Git 版本控制
- 冲突检测与解决
- 变更通知

### 使用场景
- 团队规范
- 项目决策
- 共享资源
```

---

#### 8. 记忆年龄与归档

**Claude Code 实现**:
```typescript
// source/src/memdir/memoryAge.ts
export function calculateMemoryAge(memory: Memory): number {
  const now = Date.now()
  const createdAt = memory.timestamp
  return now - createdAt
}

export function shouldArchive(memory: Memory): boolean {
  const age = calculateMemoryAge(memory)
  const days = age / (1000 * 60 * 60 * 24)
  return days > 90  // 90 天后归档
}
```

**evo-agents 可借鉴**:
```python
# 添加到 evo-agents/scripts/core/memory_archive.py

import os
import shutil
from datetime import datetime, timedelta

def archive_old_memories(memory_dir: str, days_threshold: int = 90):
    """归档旧记忆"""
    archive_dir = os.path.join(memory_dir, 'archive')
    os.makedirs(archive_dir, exist_ok=True)
    
    cutoff = datetime.now() - timedelta(days=days_threshold)
    
    for filename in os.listdir(memory_dir):
        if not filename.endswith('.md'):
            continue
        
        filepath = os.path.join(memory_dir, filename)
        mtime = datetime.fromtimestamp(os.path.getmtime(filepath))
        
        if mtime < cutoff:
            # 移动到归档目录
            archive_path = os.path.join(archive_dir, filename)
            shutil.move(filepath, archive_path)
            print(f"Archived: {filename}")
```

**价值**:
- ✅ 保持主目录整洁
- ✅ 历史记忆可追溯
- ✅ 提高检索性能

---

#### 9. 记忆扫描与索引

**Claude Code 实现**:
```typescript
// source/src/memdir/memoryScan.ts
export async function scanMemoryDirectory(memoryDir: string): Promise<MemoryIndex> {
  const files = await fs.readdir(memoryDir)
  const index: MemoryIndex = []
  
  for (const file of files) {
    const content = await fs.readFile(join(memoryDir, file), 'utf-8')
    const frontmatter = parseFrontmatter(content)
    
    index.push({
      path: join(memoryDir, file),
      name: frontmatter.name,
      type: frontmatter.type,
      description: frontmatter.description,
      createdAt: frontmatter.createdAt,
    })
  }
  
  return index
}
```

**evo-agents 可借鉴**:
```python
# 增强 evo-agents/skills/memory-search/search.py

class MemoryIndexer:
    """记忆索引构建器"""
    
    def __init__(self, memory_dir: str):
        self.memory_dir = memory_dir
        self.index = []
    
    def scan(self) -> list:
        """扫描记忆目录"""
        for root, dirs, files in os.walk(self.memory_dir):
            for file in files:
                if file.endswith('.md'):
                    filepath = os.path.join(root, file)
                    metadata = self.extract_metadata(filepath)
                    self.index.append(metadata)
        return self.index
    
    def extract_metadata(self, filepath: str) -> dict:
        """提取文件元数据"""
        with open(filepath, 'r') as f:
            content = f.read()
        
        # 解析 frontmatter
        frontmatter = self.parse_frontmatter(content)
        
        return {
            'path': filepath,
            'name': frontmatter.get('name', ''),
            'type': frontmatter.get('type', ''),
            'description': frontmatter.get('description', ''),
            'created_at': frontmatter.get('created_at', ''),
            'tags': frontmatter.get('tags', []),
        }
```

**价值**:
- ✅ 快速检索记忆
- ✅ 支持元数据过滤
- ✅ 便于管理维护

---

#### 10. 记忆写入指导

**Claude Code 实现**:
```typescript
// source/src/memdir/memdir.ts
export const DIR_EXISTS_GUIDANCE = 
  'This directory already exists — write to it directly with the Write ' +
  'tool (do not run mkdir or check for its existence).'

// 系统提示中包含：
// - 何时保存记忆
// - 如何格式化
// - 避免的内容
// - 写入工具使用
```

**evo-agents 可借鉴**:
```markdown
# 添加到 evo-agents/docs/MEMORY_WRITING_GUIDE.md

## 记忆写入指南

### 何时写入记忆

✅ **应该保存**:
- 用户明确说"记住这个"
- 重要的用户偏好
- 项目关键决策
- 外部资源位置
- 失败教训和成功经验

❌ **不应该保存**:
- 代码模式（可通过阅读代码获得）
- Git 历史（`git log` 更权威）
- 调试解决方案（修复已在代码中）
- CLAUDE.md 已有的内容
- 临时任务详情

### 如何格式化

1. **使用模板**: 遵循 SESSION_MEMORY_TEMPLATE.md
2. **具体详细**: 包含文件路径、函数名、错误消息
3. **限制长度**: 每节 <2000 tokens
4. **添加时间戳**: 相对日期转为绝对日期

### 写入工具

```bash
# 使用 FileEdit 工具追加
# 不要运行 mkdir 或检查存在性
# 直接写入即可
```

### 质量检查

- [ ] 信息是否具体可检索？
- [ ] 是否包含 Why 和 How？
- [ ] 是否避免记录可推导内容？
- [ ] 长度是否在限制内？
```

**价值**:
- ✅ 提高记忆质量
- ✅ 减少无效记录
- ✅ 标准化格式

---

## 📋 实施路线图

### 阶段 1：立即实施（1-2 天）

| 功能 | 文件 | 优先级 |
|------|------|--------|
| 四层记忆类型 | `MEMORY.md` | ⭐⭐⭐ |
| 质量管控机制 | `memory_validator.py` | ⭐⭐⭐ |
| 读取验证规则 | `MEMORY_USAGE.md` | ⭐⭐⭐ |
| 记忆漂移警告 | `MEMORY.md` 顶部 | ⭐⭐⭐ |

### 阶段 2：近期实施（1 周）

| 功能 | 文件 | 优先级 |
|------|------|--------|
| 后台自动提取 | `auto_extractor.py` | ⭐⭐ |
| 会话记忆模板 | `SESSION_MEMORY_TEMPLATE.md` | ⭐⭐ |
| 记忆写入指南 | `MEMORY_WRITING_GUIDE.md` | ⭐⭐ |

### 阶段 3：长期优化（1 月+）

| 功能 | 文件 | 优先级 |
|------|------|--------|
| 团队记忆系统 | `team_mem/` | ⭐ |
| 记忆年龄归档 | `memory_archive.py` | ⭐ |
| 记忆扫描索引 | `memory_index.py` | ⭐ |

---

## 🎯 总结

### evo-agents 现有优势

- ✅ **语义搜索**: Ollama 向量嵌入
- ✅ **SQLite 存储**: 结构化查询
- ✅ **重要性评分**: 质量过滤
- ✅ **双层架构**: Markdown + 数据库

### Claude Code 可借鉴的核心价值

1. **类型系统**: 4 层记忆分类 + 详细定义
2. **质量管控**: 行数 + 字节双重限制
3. **验证机制**: 读取时必须验证存在性
4. **自动提取**: 后台代理定期运行
5. **漂移警告**: 提醒 AI 记忆可能过时
6. **结构模板**: 标准化会话记忆格式

### 最佳实践融合建议

```
evo-agents 2.0 = 
  evo-agents 现有 (语义搜索 + SQLite) +
  Claude Code 类型系统 +
  Claude Code 质量管控 +
  Claude Code 验证机制 +
  Claude Code 自动提取
```

---

_分析完成时间：2026-04-02 14:35 GMT+8_
