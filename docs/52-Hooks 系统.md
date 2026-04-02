# Hooks 系统

> ⚛️ 87 个 React Hooks | 终端 UI 状态管理

---

## 🎯 学习目标

完成本节后，你将理解：
- ✅ Hooks 系统的架构
- ✅ 核心 Hooks 的用途
- ✅ 自定义 Hooks 开发
- ✅ Hooks 最佳实践

---

## 1. Hooks 架构

### 1.1 Hooks 分类

```
hooks/ (87 个 Hooks)
├── 输入处理
│   ├── useInput.ts              # 输入监听
│   ├── useArrowKeyHistory.tsx   # 箭头键历史
│   └── useCommandKeybindings.tsx # 命令快捷键
│
├── 状态管理
│   ├── useSettings.ts           # 设置管理
│   ├── useMainLoopModel.ts      # 主循环模型
│   └── useTaskListWatcher.ts    # 任务列表监听
│
├── 工具相关
│   ├── useCanUseTool.tsx        # 工具权限检查
│   ├── useMergedTools.ts        # 合并工具列表
│   └── useMergedCommands.ts     # 合并命令列表
│
├── MCP 相关
│   ├── useMergedClients.ts      # 合并 MCP 客户端
│   └── useMcpConnectionStatus.ts # MCP 连接状态
│
├── UI 相关
│   ├── useTerminalSize.ts       # 终端尺寸
│   ├── useFocus.ts              # 焦点管理
│   └── useColor.ts              # 颜色主题
│
└── 工具函数
    ├── useState.ts              # 状态管理
    ├── useEffect.ts             # 副作用
    └── useMemo.ts               # 记忆化
```

---

## 2. 核心 Hooks

### 2.1 useInput

```typescript
// source/src/ink/hooks/use-input.ts

export function useInput(
  handler: (input: string, key: Key) => void,
  options?: UseInputOptions
): void {
  const { isActive = true } = options || {}
  
  useEffect(() => {
    if (!isActive) return
    
    const stdin = process.stdin
    
    // 启用原始模式
    stdin.setRawMode(true)
    stdin.resume()
    
    // 监听输入
    const onInput = (data: Buffer) => {
      const input = String(data)
      const key = parseKey(data)
      handler(input, key)
    }
    
    stdin.on('data', onInput)
    
    return () => {
      stdin.off('data', onInput)
      stdin.setRawMode(false)
    }
  }, [handler, isActive])
}
```

**用途**: 监听终端输入，处理按键事件

**使用示例**:
```typescript
function Counter() {
  const [count, setCount] = useState(0)
  
  useInput((input, key) => {
    if (key.name === 'up') {
      setCount(count + 1)
    } else if (key.name === 'down') {
      setCount(count - 1)
    } else if (key.name === 'q') {
      process.exit()
    }
  })
  
  return <Text>Count: {count}</Text>
}
```

---

### 2.2 useCanUseTool

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

function useCanUseTool(
  setToolUseConfirmQueue: (item: ToolUseConfirm) => void,
  setToolPermissionContext: (context: ToolPermissionContext) => void,
): CanUseToolFn {
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
          ctx.logDecision({ decision: 'accept', source: 'config' })
          resolve(ctx.buildAllow(result.updatedInput ?? input))
          return
        }
        
        if (result.behavior === 'deny') {
          logPermissionDecision({...}, { decision: 'reject', source: 'config' })
          resolve(result)
          return
        }
        
        if (result.behavior === 'ask') {
          // 交互式权限对话框
          handleInteractivePermission({...}, resolve)
          return
        }
      })
    })
}
```

**用途**: 检查工具调用权限

---

### 2.3 useSettings

```typescript
// source/src/hooks/useSettings.ts

export function useSettings(): {
  settings: SettingsJson
  updateSetting: (key: string, value: unknown) => void
} {
  const [settings, setSettings] = useState<AppState['settings']>()
  
  useEffect(() => {
    // 订阅状态变更
    const unsubscribe = store.subscribe(() => {
      setSettings(store.getState().settings)
    })
    
    // 初始读取
    setSettings(store.getState().settings)
    
    return unsubscribe
  }, [])
  
  const updateSetting = useCallback((key: string, value: unknown) => {
    store.setState(prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        [key]: value,
      }
    }))
  }, [])
  
  return { settings, updateSetting }
}
```

**用途**: 管理应用设置

---

### 2.4 useTerminalSize

```typescript
// source/src/hooks/useTerminalSize.ts

export function useTerminalSize(): { columns: number; rows: number } {
  const [size, setSize] = useState({
    columns: process.stdout.columns || 80,
    rows: process.stdout.rows || 24,
  })
  
  useEffect(() => {
    const onResize = () => {
      setSize({
        columns: process.stdout.columns,
        rows: process.stdout.rows,
      })
    }
    
    process.stdout.on('resize', onResize)
    
    return () => {
      process.stdout.off('resize', onResize)
    }
  }, [])
  
  return size
}
```

**用途**: 获取终端尺寸，响应窗口变化

---

### 2.5 useArrowKeyHistory

```typescript
// source/src/hooks/useArrowKeyHistory.tsx

export function useArrowKeyHistory(
  history: string[],
  onSubmit: (value: string) => void
): {
  currentValue: string
  setCurrentValue: (value: string) => void
} {
  const [currentValue, setCurrentValue] = useState('')
  const [historyIndex, setHistoryIndex] = useState(-1)
  
  useInput((input, key) => {
    if (key.upArrow) {
      // 上一条历史
      if (historyIndex < history.length - 1) {
        const newIndex = historyIndex + 1
        setHistoryIndex(newIndex)
        setCurrentValue(history[history.length - 1 - newIndex])
      }
    } else if (key.downArrow) {
      // 下一条历史
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1
        setHistoryIndex(newIndex)
        setCurrentValue(history[history.length - 1 - newIndex])
      } else {
        setHistoryIndex(-1)
        setCurrentValue('')
      }
    }
  })
  
  return { currentValue, setCurrentValue }
}
```

**用途**: 命令历史导航

---

## 3. 自定义 Hooks 开发

### 3.1 状态管理 Hook

```typescript
// 示例：useCounter

export function useCounter(initialValue: number = 0) {
  const [count, setCount] = useState(initialValue)
  
  const increment = useCallback(() => {
    setCount(prev => prev + 1)
  }, [])
  
  const decrement = useCallback(() => {
    setCount(prev => prev - 1)
  }, [])
  
  const reset = useCallback(() => {
    setCount(initialValue)
  }, [initialValue])
  
  return { count, increment, decrement, reset }
}

// 使用
function Counter() {
  const { count, increment, decrement, reset } = useCounter(0)
  
  useInput((input, key) => {
    if (key.name === 'up') increment()
    if (key.name === 'down') decrement()
    if (key.name === 'r') reset()
  })
  
  return <Text>Count: {count}</Text>
}
```

---

### 3.2 异步数据 Hook

```typescript
// 示例：useFetch

export function useFetch<T>(url: string): {
  data: T | null
  loading: boolean
  error: Error | null
} {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  
  useEffect(() => {
    let cancelled = false
    
    async function fetchData() {
      try {
        const response = await fetch(url)
        if (!response.ok) throw new Error('Network error')
        const result = await response.json()
        
        if (!cancelled) {
          setData(result)
          setLoading(false)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err as Error)
          setLoading(false)
        }
      }
    }
    
    fetchData()
    
    return () => {
      cancelled = true
    }
  }, [url])
  
  return { data, loading, error }
}

// 使用
function UserProfile() {
  const { data: user, loading, error } = useFetch<User>('/api/user')
  
  if (loading) return <Text>Loading...</Text>
  if (error) return <Text>Error: {error.message}</Text>
  
  return <Text>Welcome, {user.name}!</Text>
}
```

---

### 3.3 复合 Hook

```typescript
// 示例：useToolbox (组合多个 Hooks)

export function useToolbox() {
  const settings = useSettings()
  const terminalSize = useTerminalSize()
  const canUseTool = useCanUseTool(...)
  const tools = useMergedTools(settings.settings)
  
  return {
    settings,
    terminalSize,
    canUseTool,
    tools,
  }
}

// 使用
function App() {
  const toolbox = useToolbox()
  
  // 使用 toolbox 中的所有内容
  return <MainView {...toolbox} />
}
```

---

## 4. Hooks 最佳实践

### 4.1 命名规范

```typescript
// ✅ 正确的命名
function useInput() { }           // 以 use 开头
function useCanUseTool() { }      // 描述用途
function useTerminalSize() { }    // 描述返回值

// ❌ 错误的命名
function input() { }              // 没有 use 前缀
function toolPermission() { }     // 不清晰
function getSize() { }            // 像普通函数
```

---

### 4.2 依赖数组

```typescript
// ✅ 正确的依赖数组
useEffect(() => {
  const subscription = store.subscribe(handler)
  return () => subscription.unsubscribe()
}, [handler])  // 包含所有外部依赖

// ❌ 错误的依赖数组
useEffect(() => {
  // handler 变化但不在依赖数组中
  const subscription = store.subscribe(handler)
  return () => subscription.unsubscribe()
}, [])  // 空数组可能导致 stale closure
```

---

### 4.3 清理副作用

```typescript
// ✅ 正确的清理
useEffect(() => {
  const stdin = process.stdin
  stdin.setRawMode(true)
  
  return () => {
    stdin.setRawMode(false)  // 清理副作用
  }
}, [])

// ❌ 没有清理
useEffect(() => {
  const stdin = process.stdin
  stdin.setRawMode(true)
  // 没有返回清理函数
}, [])
```

---

### 4.4 条件 Hooks

```typescript
// ❌ 错误的条件 Hook
if (condition) {
  useEffect(() => { })  // Hook 不能在条件语句中调用
}

// ✅ 正确的条件 Hook
useEffect(() => {
  if (condition) {
    // Hook 内部的条件逻辑
  }
}, [condition])
```

---

## 5. 常见 Hooks 模式

### 5.1 订阅模式

```typescript
export function useSubscription<T>(
  subscribe: (handler: (data: T) => void) => () => void,
  initialValue: T
): T {
  const [data, setData] = useState(initialValue)
  
  useEffect(() => {
    const unsubscribe = subscribe(setData)
    return unsubscribe
  }, [subscribe])
  
  return data
}

// 使用
function MessageList() {
  const messages = useSubscription<Message[]>(
    handler => store.subscribe('messages', handler),
    []
  )
  
  return messages.map(m => <Message key={m.id} message={m} />)
}
```

---

### 5.2 防抖模式

```typescript
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value)
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)
    
    return () => clearTimeout(timer)
  }, [value, delay])
  
  return debouncedValue
}

// 使用
function SearchInput() {
  const [input, setInput] = useState('')
  const debouncedInput = useDebounce(input, 300)
  
  useEffect(() => {
    // 只在输入停止 300ms 后搜索
    search(debouncedInput)
  }, [debouncedInput])
  
  return <Input value={input} onChange={setInput} />
}
```

---

### 5.3 本地存储模式

```typescript
export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = localStorage.getItem(key)
      return item ? JSON.parse(item) : initialValue
    } catch {
      return initialValue
    }
  })
  
  const setValue = (value: T) => {
    try {
      setStoredValue(value)
      localStorage.setItem(key, JSON.stringify(value))
    } catch (error) {
      console.error('Failed to save to localStorage', error)
    }
  }
  
  return [storedValue, setValue]
}

// 使用
function ThemeSelector() {
  const [theme, setTheme] = useLocalStorage<Theme>('theme', 'light')
  
  return (
    <Select value={theme} onChange={setTheme}>
      <option value="light">Light</option>
      <option value="dark">Dark</option>
    </Select>
  )
}
```

---

## 6. 性能优化

### 6.1 useMemo

```typescript
// ✅ 使用 useMemo 缓存计算结果
function MessageList({ messages }) {
  const sortedMessages = useMemo(() => {
    return [...messages].sort((a, b) => b.timestamp - a.timestamp)
  }, [messages])
  
  return sortedMessages.map(m => <Message key={m.id} message={m} />)
}

// ❌ 每次渲染都重新排序
function MessageList({ messages }) {
  const sortedMessages = [...messages].sort((a, b) => b.timestamp - a.timestamp)
  return sortedMessages.map(m => <Message key={m.id} message={m} />)
}
```

---

### 6.2 useCallback

```typescript
// ✅ 使用 useCallback 缓存函数
function Counter() {
  const [count, setCount] = useState(0)
  
  const increment = useCallback(() => {
    setCount(prev => prev + 1)
  }, [])
  
  return <Button onClick={increment}>+</Button>
}

// ❌ 每次渲染都创建新函数
function Counter() {
  const [count, setCount] = useState(0)
  
  const increment = () => {
    setCount(prev => prev + 1)
  }
  
  return <Button onClick={increment}>+</Button>
}
```

---

## 📚 相关文档

| 文档 | 说明 |
|------|------|
| [50-Ink 渲染引擎.md](./50-Ink 渲染引擎.md) | 终端 UI 渲染原理 |
| [51-组件系统.md](./51-组件系统.md) | 146 个 Ink 组件详解 |
| [12-状态管理.md](./12-状态管理.md) | createStore + AppState |

---

_最后更新：2026-04-02_  
_预计阅读时间：35 分钟_
