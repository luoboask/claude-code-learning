# Claude Code CLI 架构学习指南

> 📚 基于 Claude Code CLI 源码的系统化学习资料  
> 🔍 深度分析现代 Agent CLI 的完整架构设计  
> ⚠️ 本仓库仅用于学习和研究目的

---

## 📖 关于本仓库

本仓库整理了 [Claude Code CLI](https://claude.ai/code) 源码的深度分析资料，帮助开发者学习现代 Agent CLI 的架构设计。

**注意**: 源码是通过 npm 分发产物中的 source map 暴露的研究样本，本仓库仅用于学习和安全研究。

---

## 🎯 学习内容

### 核心主题
- ✅ Agent CLI 架构设计
- ✅ 工具系统实现
- ✅ 权限与安全机制
- ✅ 状态管理与流式处理
- ✅ MCP 集成方案
- ✅ 终端 UI 渲染 (Ink/React)

### 预计学习时间
- 🐣 快速入门：4 小时
- 📚 系统学习：20 小时
- 🎓 深度掌握：40 小时

---

## 📁 目录结构

```
claude-code-learning/
├── README.md                    # 本文件
├── docs/
│   ├── ARCHITECTURE.md          # 架构全景图
│   ├── COMPLETE_ANALYSIS.md     # 完整分析 (42KB)
│   ├── ULTRA_DETAILED_ANALYSIS.md # 超详细实现 (48KB)
│   └── LEARNING_GUIDE.md        # 学习指南 (25KB)
├── learning-path/
│   ├── phase-1-basics.md        # 第 1 阶段：基础认知
│   ├── phase-2-core-loop.md     # 第 2 阶段：核心循环
│   ├── phase-3-tool-system.md   # 第 3 阶段：工具系统
│   ├── phase-4-state-ui.md      # 第 4 阶段：状态与 UI
│   ├── phase-5-extensions.md    # 第 5 阶段：扩展系统
│   └── phase-6-practice.md      # 第 6 阶段：实战演练
├── code-examples/
│   ├── tool-template.ts         # 工具实现模板
│   ├── skill-template.yaml      # Skill 模板
│   └── security-check-template.ts # 安全检查模板
├── security-checks/
│   ├── bash-security-24.md      # 24 项 Bash 安全检查
│   └── validation-examples.ts   # 验证代码示例
└── resources/
    ├── glossary.md              # 术语表
    └── links.md                 # 相关链接
```

---

## 🚀 快速开始

### 1. 克隆仓库
```bash
git clone https://github.com/luoboask/claude-code-learning.git
cd claude-code-learning
```

### 2. 开始学习
```bash
# 从学习指南开始
cat docs/LEARNING_GUIDE.md

# 或查看架构全景
cat docs/ARCHITECTURE.md
```

### 3. 实践项目
```bash
# 实现第一个工具
cat code-examples/tool-template.ts

# 实现安全检查
cat security-checks/validation-examples.ts
```

---

## 📚 学习路线

```
第 1 阶段：基础认知 (2-4 小时)
    │
    ├─→ 什么是 Agent CLI？
    ├─→ 核心组件概览
    └─→ 技术栈解析
    │
    ↓
第 2 阶段：核心循环 (6-8 小时)
    │
    ├─→ 用户输入处理
    ├─→ 模型调用流程
    ├─→ 工具调用机制
    └─→ 结果回灌与迭代
    │
    ↓
第 3 阶段：工具系统 (6-8 小时)
    │
    ├─→ 工具抽象接口
    ├─→ 工具注册与发现
    ├─→ 工具执行编排
    └─→ 权限与安全
    │
    ↓
第 4 阶段：状态与 UI (4-6 小时)
    │
    ├─→ 状态管理原语
    ├─→ 终端 UI 渲染
    └─→ 流式处理
    │
    ↓
第 5 阶段：扩展系统 (4-6 小时)
    │
    ├─→ Skills 系统
    ├─→ Plugins 系统
    └─→ MCP 集成
    │
    ↓
第 6 阶段：实战演练 (4-8 小时)
    │
    ├─→ 实现一个新工具
    ├─→ 实现一个 Skill
    └─→ 实现安全检查
```

---

## 🔐 安全研究

### 24 项 Bash 安全检查

| ID | 检查项 | 检测内容 |
|----|--------|----------|
| 1 | INCOMPLETE_COMMANDS | 不完整命令 |
| 2 | JQ_SYSTEM_FUNCTION | jq system() 函数 |
| 3 | JQ_FILE_ARGUMENTS | jq 文件参数 |
| 4 | OBFUSCATED_FLAGS | 混淆标志 |
| 5 | SHELL_METACHARACTERS | Shell 元字符 |
| 6 | DANGEROUS_VARIABLES | 危险变量 |
| 7 | NEWLINES | 换行注入 |
| 8 | COMMAND_SUBSTITUTION | 命令替换 |
| 9 | INPUT_REDIRECTION | 输入重定向 |
| 10 | OUTPUT_REDIRECTION | 输出重定向 |
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

完整实现见：`security-checks/bash-security-24.md`

---

## 🛠️ 可复用代码

### 工具实现模板
```typescript
import { buildTool } from './Tool'
import { z } from 'zod/v4'

export const MyTool = buildTool({
  name: 'MyTool',
  description: 'Tool description',
  inputSchema: z.object({
    param: z.string().describe('Parameter description'),
  }),
  
  async call(args, context) {
    // 实现逻辑
    return { data: { result: 'success' } }
  },
  
  isReadOnly: () => true,
  isConcurrencySafe: () => true,
})
```

### 状态管理原语
```typescript
function createStore<T>(initialState: T, onChange?: OnChange<T>) {
  let state = initialState
  const listeners = new Set<Listener>()
  
  return {
    getState: () => state,
    setState: (updater) => {
      const next = updater(state)
      if (Object.is(next, state)) return
      state = next
      onChange?.({ newState: next, oldState: state })
      listeners.forEach(fn => fn())
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
```

---

## 📊 核心架构

### 6 层架构
```
┌─────────────────────────────────────────┐
│ 用户交互层                               │
│ CLI 参数 | 对话输入 | Slash Commands     │
├─────────────────────────────────────────┤
│ 表现层 (Ink/React)                       │
│ 146 个组件 | 终端渲染 | 流式输出         │
├─────────────────────────────────────────┤
│ 状态管理层                               │
│ createStore | AppState | 不可变更新     │
├─────────────────────────────────────────┤
│ 核心引擎层                               │
│ QueryEngine | query 循环 | 模型调用      │
├─────────────────────────────────────────┤
│ 工具层                                   │
│ 45 个工具 | 权限检查 | 并发/串行执行    │
├─────────────────────────────────────────┤
│ 服务层                                   │
│ MCP | LSP | OAuth | Analytics | Voice   │
└─────────────────────────────────────────┘
```

### 核心循环
```
用户输入 → 模型调用 → 工具检测 → 权限检查 → 执行 → 结果回灌 → 迭代
```

---

## ⚠️ 使用声明

### ✅ 允许的用途
- 学习 Agent CLI 架构
- 研究安全机制
- 参考设计模式
- 安全分析与防御

### ❌ 禁止的用途
- 直接商用
- 重新分发源码
- 用于攻击目的
- 绕过安全措施

---

## 🔗 相关链接

- [Claude Code 官方文档](https://docs.claude.ai/code)
- [Ink 终端 UI 框架](https://github.com/vadimdemedes/ink)
- [MCP 协议规范](https://modelcontextprotocol.io)
- [Bun 运行时](https://bun.sh)

---

## 📝 学习检查清单

### 第 1 阶段
- [ ] 理解 Agent CLI 的核心价值
- [ ] 能画出 6 层架构图
- [ ] 知道核心文件的作用

### 第 2 阶段
- [ ] 理解用户输入处理流程
- [ ] 理解模型调用的流式处理
- [ ] 理解工具调用的检测与执行
- [ ] 理解查询循环的迭代机制

### 第 3 阶段
- [ ] 理解 Tool 接口的 40+ 字段
- [ ] 能实现一个简单的工具
- [ ] 理解工具并发/串行分区
- [ ] 理解三层权限规则

### 第 4 阶段
- [ ] 理解 createStore 原语
- [ ] 理解不可变更新模式
- [ ] 理解 Ink 组件渲染
- [ ] 理解生成器流式处理

### 第 5 阶段
- [ ] 理解 Skills 加载机制
- [ ] 理解 Plugins 发现机制
- [ ] 理解 MCP 客户端连接

### 第 6 阶段
- [ ] 能独立实现一个新工具
- [ ] 能独立实现一个 Skill
- [ ] 能独立实现一个安全检查

---

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

### 可以贡献的内容
- 📚 学习笔记和心得
- 🛠️ 代码示例和模板
- 🔐 安全检查实现
- 📝 术语解释和翻译
- 🐛 文档错误修正

---

## 📄 许可证

本仓库文档采用 [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) 许可证。

- ✏️ 署名 (BY) - 必须注明原作者
- 🚫 非商业 (NC) - 不得用于商业目的
- 🔄 相同方式 (SA) - 衍生作品使用相同许可证

---

## 📧 联系方式

- GitHub: [@luoboask](https://github.com/luoboask)
- Issue: [提交问题](https://github.com/luoboask/claude-code-learning/issues)

---

_最后更新：2026-04-02_  
_版本：1.0.0_
