# LSP 集成

> 🌐 Language Server Protocol | 语言服务器协议详解

---

## 🎯 学习目标

完成本节后，你将理解：
- ✅ LSP 协议的核心概念
- ✅ LSP 与 CLI 的集成方式
- ✅ LSP 工具的实现
- ✅ 常见 LSP 服务器配置

---

## 1. LSP 协议概述

### 1.1 什么是 LSP？

**Language Server Protocol (LSP)** 是一种开放协议，用于编辑器/IDE 与语言服务器之间的通信。

**核心价值**:
- ✅ 标准化接口 - 统一的语言服务协议
- ✅ 语言无关 - 支持多种编程语言
- ✅ 功能丰富 - 补全、跳转、诊断等
- ✅ 解耦设计 - 编辑器与语言服务分离

### 1.2 核心功能

| 功能 | 说明 | LSP 方法 |
|------|------|----------|
| **代码补全** | 智能提示 | `textDocument/completion` |
| **跳转定义** | 跳转到函数/类定义 | `textDocument/definition` |
| **查找引用** | 查找所有引用位置 | `textDocument/references` |
| **诊断** | 错误和警告 | `textDocument/publishDiagnostics` |
| **悬停提示** | 鼠标悬停显示信息 | `textDocument/hover` |
| **符号搜索** | 工作区符号搜索 | `workspace/symbol` |
| **重构** | 重命名、提取方法 | `textDocument/rename` |

---

## 2. LSP 工具实现

### 2.1 工具定义

```typescript
// source/src/tools/LSPTool/LSPTool.ts

export const LSPTool = buildTool({
  name: 'LSP',
  description: 'Language Server Protocol operations',
  
  inputSchema: z.object({
    operation: z.enum(['completion', 'definition', 'references', 'hover', 'diagnostics']),
    file: z.string().describe('File path'),
    position: z.object({
      line: z.number(),
      column: z.number(),
    }).optional().describe('Position in file'),
    query: z.string().optional().describe('Search query for workspace/symbol'),
  }),
  
  async call(args, context) {
    // 1. 获取 LSP 管理器
    const manager = context.options.lspManager
    
    if (!manager) {
      throw new Error('LSP manager not available')
    }
    
    // 2. 执行操作
    let result
    switch (args.operation) {
      case 'completion':
        result = await manager.getCompletion(args.file, args.position)
        break
      case 'definition':
        result = await manager.getDefinition(args.file, args.position)
        break
      case 'references':
        result = await manager.getReferences(args.file, args.position)
        break
      case 'hover':
        result = await manager.getHover(args.file, args.position)
        break
      case 'diagnostics':
        result = await manager.getDiagnostics(args.file)
        break
      default:
        throw new Error(`Unknown LSP operation: ${args.operation}`)
    }
    
    // 3. 返回结果
    return {
      data: result,
    }
  },
  
  isReadOnly: () => true,
  isConcurrencySafe: () => true,
})
```

---

### 2.2 LSP 管理器

```typescript
// source/src/services/lsp/manager.ts

export class LSPServerManager {
  private servers: Map<string, LSPServerInstance> = new Map()
  
  async startServer(config: LSPServerConfig): Promise<void> {
    const server = new LSPServerInstance(config)
    await server.start()
    this.servers.set(config.language, server)
  }
  
  async getCompletion(file: string, position: Position): Promise<CompletionList> {
    const server = this.getServerForFile(file)
    if (!server) {
      throw new Error('No LSP server for this file')
    }
    return server.sendRequest('textDocument/completion', {
      textDocument: { uri: pathToFileURL(file).toString() },
      position,
    })
  }
  
  async getDefinition(file: string, position: Position): Promise<Location[]> {
    const server = this.getServerForFile(file)
    return server.sendRequest('textDocument/definition', {
      textDocument: { uri: pathToFileURL(file).toString() },
      position,
    })
  }
  
  private getServerForFile(file: string): LSPServerInstance | null {
    // 根据文件扩展名选择服务器
    const ext = path.extname(file)
    for (const [language, server] of this.servers) {
      if (server.config.extensions.includes(ext)) {
        return server
      }
    }
    return null
  }
}
```

---

### 2.3 LSP 服务器实例

```typescript
// source/src/services/lsp/LSPServerInstance.ts

export class LSPServerInstance {
  private connection: LSPConnection
  public config: LSPServerConfig
  
  constructor(config: LSPServerConfig) {
    this.config = config
  }
  
  async start(): Promise<void> {
    // 启动语言服务器进程
    this.connection = await createLSPConnection({
      command: this.config.command,
      args: this.config.args,
    })
    
    // 初始化
    await this.connection.sendRequest('initialize', {
      processId: process.pid,
      rootUri: pathToFileURL(this.config.rootPath).toString(),
      capabilities: {
        textDocument: {
          completion: {},
          definition: {},
          references: {},
          hover: {},
        },
      },
    })
    
    // 发送 initialized 通知
    this.connection.sendNotification('initialized', {})
  }
  
  async sendRequest(method: string, params: any): Promise<any> {
    return this.connection.sendRequest(method, params)
  }
  
  async stop(): Promise<void> {
    // 发送 shutdown 请求
    await this.connection.sendRequest('shutdown', {})
    this.connection.sendNotification('exit', {})
  }
}
```

---

## 3. LSP 配置

### 3.1 配置文件格式

```json
{
  "lspServers": {
    "typescript": {
      "command": "npx",
      "args": ["-y", "typescript-language-server", "--stdio"],
      "extensions": [".ts", ".tsx", ".js", ".jsx"],
      "rootPath": "."
    },
    "python": {
      "command": "pylsp",
      "args": [],
      "extensions": [".py", ".pyi"],
      "rootPath": "."
    },
    "rust": {
      "command": "rust-analyzer",
      "args": [],
      "extensions": [".rs"],
      "rootPath": "."
    },
    "go": {
      "command": "gopls",
      "args": [],
      "extensions": [".go"],
      "rootPath": "."
    }
  }
}
```

### 3.2 环境变量

```bash
# 使用环境变量
export TYPESCRIPT_LANGUAGE_SERVER_PATH=/path/to/typescript-language-server

# 配置文件中引用
{
  "lspServers": {
    "typescript": {
      "command": "${TYPESCRIPT_LANGUAGE_SERVER_PATH}",
      "args": ["--stdio"]
    }
  }
}
```

---

## 4. 常见 LSP 服务器

### 4.1 TypeScript

```bash
# 安装
npm install -g typescript-language-server typescript

# 配置
{
  "lspServers": {
    "typescript": {
      "command": "npx",
      "args": ["-y", "typescript-language-server", "--stdio"]
    }
  }
}

# 可用功能
- 代码补全
- 跳转定义
- 查找引用
- 诊断
- 悬停提示
- 重命名
```

### 4.2 Python

```bash
# 安装
pip install python-lsp-server

# 配置
{
  "lspServers": {
    "python": {
      "command": "pylsp"
    }
  }
}

# 可用功能
- 代码补全
- 跳转定义
- 诊断
- 悬停提示
- 格式化
```

### 4.3 Rust

```bash
# 安装 (rustup 自带)
rustup component add rust-analyzer

# 配置
{
  "lspServers": {
    "rust": {
      "command": "rust-analyzer"
    }
  }
}

# 可用功能
- 代码补全
- 跳转定义
- 查找引用
- 诊断
- 悬停提示
- 重构
```

### 4.4 Go

```bash
# 安装
go install golang.org/x/tools/gopls@latest

# 配置
{
  "lspServers": {
    "go": {
      "command": "gopls"
    }
  }
}

# 可用功能
- 代码补全
- 跳转定义
- 查找引用
- 诊断
- 悬停提示
```

---

## 5. 最佳实践

### 5.1 性能优化

```markdown
✅ 应该做:

1. 按需启动服务器
   - 打开文件时启动对应语言的服务器
   - 关闭所有相关文件后停止服务器

2. 复用连接
   - 同一语言的多个文件复用连接
   - 会话期间保持连接

3. 缓存结果
   - 缓存补全结果
   - 设置合理的缓存过期时间

❌ 不应该做:

1. 频繁重启服务器
2. 每次操作都新建连接
3. 不缓存重复查询
```

### 5.2 错误处理

```typescript
// ✅ 完整的错误处理
async function callLSP(operation: string, file: string, position?: Position) {
  try {
    const server = getServerForFile(file)
    if (!server) {
      throw new Error(`No LSP server for file: ${file}`)
    }
    
    const result = await server.sendRequest(operation, {
      textDocument: { uri: pathToFileURL(file).toString() },
      position,
    })
    
    return result
  } catch (error) {
    if (error instanceof LSPError) {
      // LSP 特定错误
      console.log('LSP error:', error.message)
    } else {
      // 通用错误
      console.log('Unknown error:', error)
    }
    throw error
  }
}
```

---

## 📚 相关文档

| 文档 | 说明 |
|------|------|
| [13-插件系统.md](./13-插件系统.md) | Skills + Plugins + MCP 集成 |
| [30-工具系统概述.md](./30-工具系统概述.md) | 工具系统架构 |
| [37-核心工具实现.md](./37-核心工具实现.md) | LSPTool 实现详解 |
| [40-MCP 集成.md](./40-MCP 集成.md) | MCP 协议和客户端 |

---

_最后更新：2026-04-02_  
_预计阅读时间：30 分钟_
