# MCP 集成

> 🔌 Model Context Protocol | MCP 协议和客户端详解

---

## 🎯 学习目标

完成本节后，你将理解：
- ✅ MCP 协议的核心概念
- ✅ 4 种传输方式
- ✅ MCP 客户端实现
- ✅ MCP 服务器配置

---

## 1. MCP 协议概述

### 1.1 什么是 MCP？

**Model Context Protocol (MCP)** 是一种开放协议，允许 AI 模型与外部系统和工具交互。

**核心价值**:
- ✅ 标准化接口 - 统一的工具调用协议
- ✅ 外部集成 - 连接第三方服务
- ✅ 动态发现 - 自动发现可用工具
- ✅ 安全控制 - 权限和认证机制

### 1.2 核心概念

| 概念 | 说明 |
|------|------|
| **Server** | 提供工具和服务的外部系统 |
| **Client** | Claude Code 中的 MCP 客户端 |
| **Transport** | 通信方式 (stdio/sse/websocket/streamable-http) |
| **Resource** | 服务器提供的资源 |
| **Tool** | 服务器提供的可调用工具 |
| **Prompt** | 服务器提供的预定义提示 |

---

## 2. 传输方式

### 2.1 4 种传输类型

| 类型 | 用途 | 示例 |
|------|------|------|
| **stdio** | 本地进程 | `npx -y @mcp/server-filesystem` |
| **sse** | HTTP SSE | `https://example.com/sse` |
| **websocket** | WebSocket | `ws://localhost:8080` |
| **streamable-http** | HTTP 流 | `https://example.com/mcp` |

### 2.2 stdio 传输

```typescript
// source/src/services/mcp/client.ts

if (config.type === 'stdio') {
  this.transport = new StdioClientTransport({
    command: config.command,
    args: config.args,
    env: { ...subprocessEnv(), ...config.env },
  })
}
```

**使用场景**:
- 本地 MCP 服务器
- 需要访问本地文件系统
- 无需网络连接

### 2.3 SSE 传输

```typescript
if (config.type === 'sse') {
  this.transport = new SSEClientTransport(
    new URL(config.url),
    { requestInit: { headers: getMcpServerHeaders(config) } }
  )
}
```

**使用场景**:
- 远程 MCP 服务器
- 需要持久连接
- 服务器推送通知

### 2.4 WebSocket 传输

```typescript
if (config.type === 'websocket') {
  this.transport = new WebSocketTransport(
    config.url,
    { tlsOptions: getWebSocketTLSOptions(config) }
  )
}
```

**使用场景**:
- 双向实时通信
- 需要低延迟
- 内部服务集成

### 2.5 Streamable HTTP 传输

```typescript
if (config.type === 'streamable-http') {
  this.transport = new StreamableHTTPClientTransport(
    new URL(config.url),
    { requestInit: { headers: getMcpServerHeaders(config) } }
  )
}
```

**使用场景**:
- HTTP 流式响应
- 无需持久连接
- 简单集成

---

## 3. MCP 客户端实现

### 3.1 客户端类

```typescript
// source/src/services/mcp/client.ts

export class McpClient {
  private client: Client
  private transport: Transport
  private serverName: string
  
  constructor(serverName: string, config: McpServerConfig) {
    // 根据配置选择传输方式
    if (config.type === 'stdio') {
      this.transport = new StdioClientTransport({
        command: config.command,
        args: config.args,
      })
    } else if (config.type === 'sse') {
      this.transport = new SSEClientTransport(new URL(config.url))
    } else if (config.type === 'websocket') {
      this.transport = new WebSocketTransport(config.url)
    } else if (config.type === 'streamable-http') {
      this.transport = new StreamableHTTPClientTransport(new URL(config.url))
    }
    
    this.client = new Client({
      name: 'claude-code',
      version: pkg.version,
    })
    
    this.serverName = serverName
  }
  
  async connect(): Promise<void> {
    await this.client.connect(this.transport)
  }
  
  async listTools(): Promise<ListToolsResult> {
    return this.client.request(
      { method: 'tools/list' },
      ListToolsResultSchema
    )
  }
  
  async callTool(name: string, args: Record<string, unknown>): Promise<MCPToolResult> {
    const result = await this.client.request(
      { method: 'tools/call', params: { name, arguments: args } },
      CallToolResultSchema,
    )
    
    if (result.isError) {
      throw new McpToolCallError(result.content?.[0]?.text ?? 'Unknown error')
    }
    
    return {
      content: result.content,
      _meta: result._meta,
    }
  }
}
```

### 3.2 错误处理

```typescript
// MCP 错误类
export class McpToolCallError extends Error {
  constructor(
    message: string,
    telemetryMessage: string,
    readonly mcpMeta?: { _meta?: Record<string, unknown> },
  ) {
    super(message, telemetryMessage)
    this.name = 'McpToolCallError'
  }
}

// 使用示例
try {
  const result = await client.callTool('read_file', { path: '/tmp/x.txt' })
} catch (error) {
  if (error instanceof McpToolCallError) {
    // MCP 特定错误
    console.log('MCP error:', error.message)
    console.log('Meta:', error.mcpMeta)
  } else {
    // 通用错误
    console.log('Unknown error:', error)
  }
}
```

---

## 4. MCP 配置

### 4.1 配置文件格式

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"],
      "env": {}
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_TOKEN": "${GITHUB_TOKEN}"
      }
    },
    "postgres": {
      "type": "stdio",
      "command": "mcp-server-postgres",
      "args": ["--connection-string", "postgresql://localhost/mydb"]
    },
    "remote-server": {
      "type": "sse",
      "url": "https://example.com/mcp/sse"
    }
  }
}
```

### 4.2 环境变量

```bash
# 使用环境变量
export MCP_SERVER_TOKEN=xxx

# 配置文件中引用
{
  "mcpServers": {
    "my-server": {
      "command": "my-server",
      "env": {
        "TOKEN": "${MCP_SERVER_TOKEN}"
      }
    }
  }
}
```

---

## 5. 官方 MCP 服务器

### 5.1 文件系统服务器

```bash
# 安装
npx -y @modelcontextprotocol/server-filesystem /path/to/dir

# 配置
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
    }
  }
}

# 可用工具
- read_file
- write_file
- list_directory
- search_files
```

### 5.2 GitHub 服务器

```bash
# 安装
npx -y @modelcontextprotocol/server-github

# 配置
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_TOKEN": "${GITHUB_TOKEN}"
      }
    }
  }
}

# 可用工具
- create_issue
- create_pull_request
- search_repositories
- get_file_contents
```

### 5.3 数据库服务器

```bash
# PostgreSQL
npx -y mcp-server-postgres --connection-string "postgresql://localhost/mydb"

# 配置
{
  "mcpServers": {
    "postgres": {
      "command": "mcp-server-postgres",
      "args": ["--connection-string", "postgresql://localhost/mydb"]
    }
  }
}

# 可用工具
- query
- list_tables
- describe_table
```

---

## 6. 最佳实践

### 6.1 安全配置

```markdown
✅ 应该做:

1. 使用官方服务器
   - @modelcontextprotocol/server-*
   - 验证服务器来源

2. 配置适当的权限
   - 文件系统限制访问目录
   - 数据库使用只读账户

3. 使用环境变量存储密钥
   - 不要硬编码 token
   - 使用 .env 文件

4. 监控日志
   - 启用 MCP 日志
   - 审计工具调用

❌ 不应该做:

1. 连接不可信服务器
2. 授予过多权限
3. 忽视安全警告
```

### 6.2 性能优化

```markdown
✅ 应该做:

1. 复用连接
   - 启动时连接
   - 会话期间保持连接

2. 批量调用
   - 合并多个工具调用
   - 减少网络往返

3. 缓存结果
   - 缓存只读操作结果
   - 设置合理的缓存过期时间

❌ 不应该做:

1. 频繁重连
2. 每次调用都新建连接
3. 不缓存重复查询
```

---

## 📚 相关文档

| 文档 | 说明 |
|------|------|
| [13-插件系统.md](./13-插件系统.md) | Skills + Plugins + MCP 集成 |
| [30-工具系统概述.md](./30-工具系统概述.md) | 工具系统架构 |
| [37-核心工具实现.md](./37-核心工具实现.md) | MCPTool 实现详解 |

---

_最后更新：2026-04-02_  
_预计阅读时间：35 分钟_
