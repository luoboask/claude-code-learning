# OAuth 认证

> 🔐 OAuth 2.0 Authentication | OAuth 认证流程详解

---

## 🎯 学习目标

完成本节后，你将理解：
- ✅ OAuth 2.0 的核心概念
- ✅ Claude Code 的 OAuth 流程
- ✅ Token 管理和刷新
- ✅ 安全最佳实践

---

## 1. OAuth 2.0 概述

### 1.1 什么是 OAuth 2.0？

**OAuth 2.0** 是一种开放授权标准，允许第三方应用安全地访问用户资源，而无需共享密码。

**核心角色**:
| 角色 | 说明 |
|------|------|
| **Resource Owner** | 资源所有者（用户） |
| **Client** | 客户端应用（Claude Code） |
| **Authorization Server** | 授权服务器 |
| **Resource Server** | 资源服务器 |

### 1.2 授权流程

```
┌─────────────┐
│   用户       │
└──────┬──────┘
       │
       ↓
┌─────────────────────────────────┐
│ 1. 客户端重定向到授权服务器      │
│    GET /authorize?client_id=... │
└───────────────┬─────────────────┘
                │
                ↓
┌─────────────────────────────────┐
│ 2. 用户登录并授权                │
│    [登录] [授权]                │
└───────────────┬─────────────────┘
                │
                ↓
┌─────────────────────────────────┐
│ 3. 授权服务器重定向回客户端       │
│    GET /callback?code=AUTH_CODE │
└───────────────┬─────────────────┘
                │
                ↓
┌─────────────────────────────────┐
│ 4. 客户端用 code 换取 token      │
│    POST /token                  │
│    { code, client_secret }      │
└───────────────┬─────────────────┘
                │
                ↓
┌─────────────────────────────────┐
│ 5. 返回 access_token             │
│    { access_token, refresh_token }│
└───────────────┬─────────────────┘
                │
                ↓
┌─────────────────────────────────┐
│ 6. 使用 token 访问资源            │
│    GET /resource                │
│    Authorization: Bearer token  │
└─────────────────────────────────┘
```

---

## 2. Claude Code OAuth 实现

### 2.1 OAuth 配置

```typescript
// source/src/constants/oauth.ts

export const OAUTH_CONFIG = {
  clientId: process.env.CLAUDE_CODE_OAUTH_CLIENT_ID,
  clientSecret: process.env.CLAUDE_CODE_OAUTH_CLIENT_SECRET,
  authorizationUrl: 'https://auth.anthropic.com/oauth2/auth',
  tokenUrl: 'https://auth.anthropic.com/oauth2/token',
  redirectUri: 'http://localhost:3000/oauth/callback',
  scopes: ['openid', 'email', 'profile'],
}
```

### 2.2 OAuth 客户端

```typescript
// source/src/services/oauth/client.ts

export class OAuthClient {
  private config: OAuthConfig
  private tokens: TokenStorage
  
  constructor(config: OAuthConfig) {
    this.config = config
    this.tokens = new TokenStorage()
  }
  
  async getAuthorizationUrl(): Promise<string> {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      scope: this.config.scopes.join(' '),
      state: generateState(),
    })
    
    return `${this.config.authorizationUrl}?${params.toString()}`
  }
  
  async exchangeCodeForToken(code: string): Promise<TokenResponse> {
    const response = await fetch(this.config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: this.config.redirectUri,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
      }),
    })
    
    if (!response.ok) {
      throw new OAuthError('Failed to exchange code for token')
    }
    
    const data = await response.json()
    await this.tokens.save(data)
    
    return data
  }
  
  async refreshAccessToken(): Promise<TokenResponse> {
    const refreshToken = await this.tokens.getRefreshToken()
    
    const response = await fetch(this.config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
      }),
    })
    
    if (!response.ok) {
      throw new OAuthError('Failed to refresh token')
    }
    
    const data = await response.json()
    await this.tokens.save(data)
    
    return data
  }
  
  async getAccessToken(): Promise<string> {
    let token = await this.tokens.getAccessToken()
    
    // 检查 token 是否过期
    if (await this.tokens.isTokenExpired(token)) {
      const newToken = await this.refreshAccessToken()
      token = newToken.access_token
    }
    
    return token
  }
}
```

---

### 2.3 Token 存储

```typescript
// source/src/utils/secureStorage/index.ts

export class TokenStorage {
  private storage: SecureStorage
  
  constructor() {
    this.storage = getSecureStorage()
  }
  
  async save(tokens: TokenResponse): Promise<void> {
    await this.storage.set('oauth_access_token', tokens.access_token)
    await this.storage.set('oauth_refresh_token', tokens.refresh_token)
    await this.storage.set('oauth_expires_at', String(Date.now() + tokens.expires_in * 1000))
  }
  
  async getAccessToken(): Promise<string | null> {
    return this.storage.get('oauth_access_token')
  }
  
  async getRefreshToken(): Promise<string | null> {
    return this.storage.get('oauth_refresh_token')
  }
  
  async isTokenExpired(token: string): Promise<boolean> {
    const expiresAt = await this.storage.get('oauth_expires_at')
    if (!expiresAt) return true
    
    return Date.now() >= parseInt(expiresAt)
  }
  
  async clear(): Promise<void> {
    await this.storage.delete('oauth_access_token')
    await this.storage.delete('oauth_refresh_token')
    await this.storage.delete('oauth_expires_at')
  }
}
```

---

## 3. OAuth 流程实现

### 3.1 启动授权

```typescript
// source/src/commands/login/login.tsx

export async function login(): Promise<void> {
  const oauthClient = new OAuthClient(OAUTH_CONFIG)
  
  // 1. 生成授权 URL
  const authUrl = await oauthClient.getAuthorizationUrl()
  
  // 2. 在浏览器中打开
  await open(authUrl)
  
  console.log('Please complete the authorization in your browser...')
  console.log('If your browser did not open automatically, visit:')
  console.log(authUrl)
  
  // 3. 启动本地服务器接收回调
  const server = await startCallbackServer(async (code: string) => {
    // 4. 用 code 换取 token
    const tokens = await oauthClient.exchangeCodeForToken(code)
    
    console.log('✅ Login successful!')
    console.log(`Token expires in: ${tokens.expires_in} seconds`)
    
    server.close()
  })
  
  console.log(`Waiting for callback on port ${server.port}...`)
}
```

### 3.2 回调服务器

```typescript
// source/src/services/oauth/auth-code-listener.ts

export async function startCallbackServer(
  onCodeReceived: (code: string) => Promise<void>
): Promise<http.Server> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      if (req.url?.startsWith('/oauth/callback')) {
        const url = new URL(req.url, `http://localhost:${PORT}`)
        const code = url.searchParams.get('code')
        const error = url.searchParams.get('error')
        
        if (error) {
          res.writeHead(400)
          res.end(`Authorization failed: ${error}`)
          reject(new Error(error))
          return
        }
        
        if (!code) {
          res.writeHead(400)
          res.end('Missing authorization code')
          reject(new Error('Missing code'))
          return
        }
        
        // 响应成功页面
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end(`
          <html>
            <body>
              <h1>Authorization Successful!</h1>
              <p>You can close this window and return to the terminal.</p>
            </body>
          </html>
        `)
        
        await onCodeReceived(code)
        server.close()
      } else {
        res.writeHead(404)
        res.end('Not found')
      }
    })
    
    server.listen(PORT, () => {
      console.log(`Callback server listening on port ${PORT}`)
      resolve(server)
    })
  })
}
```

---

## 4. Token 刷新

### 4.1 自动刷新

```typescript
// source/src/services/oauth/auth.ts

export async function checkAndRefreshOAuthTokenIfNeeded(): Promise<void> {
  const storage = new TokenStorage()
  const expiresAt = await storage.get('oauth_expires_at')
  
  if (!expiresAt) {
    // 没有 token，不需要刷新
    return
  }
  
  const now = Date.now()
  const expiryTime = parseInt(expiresAt)
  
  // 提前 5 分钟刷新
  const refreshThreshold = 5 * 60 * 1000
  
  if (now + refreshThreshold >= expiryTime) {
    console.log('Token expiring soon, refreshing...')
    await refreshOAuthToken()
  }
}

export async function refreshOAuthToken(): Promise<void> {
  const oauthClient = new OAuthClient(OAUTH_CONFIG)
  await oauthClient.refreshAccessToken()
  console.log('✅ Token refreshed successfully!')
}
```

### 4.2 401 错误处理

```typescript
// source/src/utils/auth.ts

export async function handleOAuth401Error(error: Error): Promise<boolean> {
  if (error.message.includes('401')) {
    console.log('Token expired or invalid, attempting to refresh...')
    
    try {
      await refreshOAuthToken()
      return true  // 刷新成功，可以重试
    } catch (refreshError) {
      console.error('Failed to refresh token, please login again')
      console.error('Run: claude login')
      return false  // 刷新失败，需要重新登录
    }
  }
  
  return false  // 不是 401 错误
}
```

---

## 5. 安全最佳实践

### 5.1 Token 存储

```markdown
✅ 应该做:

1. 使用安全存储
   - macOS: Keychain
   - Windows: Credential Manager
   - Linux: Secret Service

2. 加密存储
   - 不要明文存储 token
   - 使用系统提供的加密机制

3. 定期清理
   - 登出时清除 token
   - token 过期后清除

❌ 不应该做:

1. 明文存储 token
2. 提交 token 到版本控制
3. 共享 token
```

### 5.2 状态参数

```typescript
// 生成随机 state
function generateState(): string {
  return crypto.randomBytes(32).toString('hex')
}

// 验证 state
function validateState(received: string, expected: string): boolean {
  return crypto.timingSafeEqual(
    Buffer.from(received),
    Buffer.from(expected)
  )
}
```

**用途**: 防止 CSRF 攻击

---

### 5.3 PKCE 扩展

```typescript
// 生成 code verifier
function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString('base64url')
}

// 生成 code challenge
function generateCodeChallenge(verifier: string): string {
  const hash = crypto.createHash('sha256').update(verifier).digest('base64url')
  return hash
}
```

**用途**: 增强授权码流程的安全性

---

## 6. 常见问题

### Q1: Token 多久过期？

**A**: 通常 access_token 有效期为 1 小时，refresh_token 有效期为 30 天。

---

### Q2: 如何查看当前 token 状态？

**A**: 
```bash
claude status
# 显示登录状态和 token 过期时间
```

---

### Q3: Token 刷新失败怎么办？

**A**: 
```bash
# 重新登录
claude logout
claude login
```

---

### Q4: 如何在 CI/CD 中使用 OAuth？

**A**: 使用服务账户或 API 密钥，而非 OAuth：
```bash
export ANTHROPIC_API_KEY=sk-ant-xxx
claude --api-key $ANTHROPIC_API_KEY
```

---

## 📚 相关文档

| 文档 | 说明 |
|------|------|
| [13-插件系统.md](./13-插件系统.md) | Skills + Plugins + MCP 集成 |
| [40-MCP 集成.md](./40-MCP 集成.md) | MCP 协议和客户端 |
| [61-权限控制.md](./61-权限控制.md) | 权限决策流程 |

---

_最后更新：2026-04-02_  
_预计阅读时间：25 分钟_
