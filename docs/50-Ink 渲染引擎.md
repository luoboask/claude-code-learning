# Ink 渲染引擎

> 🎨 Terminal UI Rendering | 终端 UI 渲染原理

---

## 🎯 学习目标

完成本节后，你将理解：
- ✅ Ink 渲染引擎的工作原理
- ✅ 终端渲染的特殊性
- ✅ 布局引擎的实现
- ✅ 性能优化策略

---

## 1. Ink 概述

### 1.1 什么是 Ink？

**Ink** 是一个 React 渲染器，用于在终端中构建用户界面。

**核心价值**:
- ✅ React 语法 - 使用熟悉的 React 语法
- ✅ 终端渲染 - 专为终端环境优化
- ✅ 组件化 - 可复用的 UI 组件
- ✅ 响应式 - 支持状态更新和重新渲染

### 1.2 核心组件

| 组件 | 用途 |
|------|------|
| `<Box>` | 布局容器，支持 flexbox |
| `<Text>` | 文本组件，支持颜色和样式 |
| `<Newline>` | 换行组件 |
| `useInput()` | 输入处理 Hook |
| `useApp()` | 应用上下文 Hook |

---

## 2. 渲染流程

### 2.1 渲染生命周期

```
React 组件树
    │
    ↓
┌─────────────────────────────────┐
│ 1. React 协调                    │
│ - 计算虚拟 DOM 差异              │
└───────────────┬─────────────────┘
                │
                ↓
┌─────────────────────────────────┐
│ 2. Ink 布局引擎                  │
│ - Yoga 布局计算                 │
│ - 节点尺寸和位置                │
└───────────────┬─────────────────┘
                │
                ↓
┌─────────────────────────────────┐
│ 3. 终端渲染                      │
│ - ANSI 转义序列生成             │
│ - 屏幕缓冲区更新                │
└───────────────┬─────────────────┘
                │
                ↓
┌─────────────────────────────────┐
│ 4. 屏幕输出                      │
│ - 写入 stdout                   │
│ - 清屏/重绘                     │
└─────────────────────────────────┘
```

### 2.2 渲染示例

```typescript
// source/src/ink/ink.tsx

import { render } from 'ink'
import App from './components/App'

// 渲染应用
const { unmount } = render(<App />)

// 卸载应用
unmount()
```

---

## 3. 布局引擎

### 3.1 Yoga 布局

```typescript
// source/src/ink/layout/yoga.ts

import yoga from 'yoga-layout'

export function createLayoutNode(): LayoutNode {
  const node = yoga.Node.create()
  
  // 设置 flexbox 属性
  node.setFlexDirection(yoga.FLEX_DIRECTION_ROW)
  node.setFlexWrap(yoga.WRAP_WRAP)
  node.setJustifyContent(yoga.JUSTIFY_SPACE_BETWEEN)
  node.setAlignItems(yoga.ALIGN_CENTER)
  
  return node
}
```

### 3.2 布局计算

```typescript
// source/src/ink/layout/engine.ts

export function calculateLayout(root: LayoutNode, width: number, height: number): void {
  // 设置容器尺寸
  root.setWidth(width)
  root.setHeight(height)
  
  // 计算布局
  root.calculateLayout(undefined, undefined, yoga.DIRECTION_LTR)
  
  // 获取计算结果
  const result = {
    left: root.getComputedLeft(),
    top: root.getComputedTop(),
    width: root.getComputedWidth(),
    height: root.getComputedHeight(),
  }
  
  // 递归计算子节点
  for (let i = 0; i < root.getChildCount(); i++) {
    const child = root.getChild(i)
    calculateLayout(child, width, height)
  }
}
```

### 3.3 Box 组件实现

```typescript
// source/src/ink/components/Box.tsx

export function Box(props: BoxProps): React.ReactNode {
  const {
    flexDirection = 'row',
    flexWrap = 'nowrap',
    justifyContent = 'flex-start',
    alignItems = 'stretch',
    children,
    ...rest
  } = props
  
  return (
    <ink-box
      flexDirection={flexDirection}
      flexWrap={flexWrap}
      justifyContent={justifyContent}
      alignItems={alignItems}
      {...rest}
    >
      {children}
    </ink-box>
  )
}
```

---

## 4. 终端渲染

### 4.1 ANSI 转义序列

```typescript
// source/src/ink/termio/ansi.ts

// 颜色代码
const COLORS = {
  black: 30,
  red: 31,
  green: 32,
  yellow: 33,
  blue: 34,
  magenta: 35,
  cyan: 36,
  white: 37,
}

// 生成 ANSI 序列
export function ansiColor(color: string): string {
  return `\u001B[${COLORS[color]}m`
}

export function ansiReset(): string {
  return '\u001B[0m'
}

// 光标控制
export function ansiCursorTo(x: number, y: number): string {
  return `\u001B[${y + 1};${x + 1}H`
}

export function ansiEraseDown(): string {
  return '\u001B[J'
}
```

### 4.2 屏幕缓冲区

```typescript
// source/src/ink/screen.ts

export class Screen {
  private width: number
  private height: number
  private buffer: string[][]
  
  constructor(width: number, height: number) {
    this.width = width
    this.height = height
    this.buffer = Array(height).fill(null).map(() => Array(width).fill(' '))
  }
  
  write(x: number, y: number, char: string, style: Style): void {
    if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
      this.buffer[y][x] = this.applyStyle(char, style)
    }
  }
  
  applyStyle(char: string, style: Style): string {
    let result = ''
    if (style.color) result += ansiColor(style.color)
    if (style.bgColor) result += ansiBgColor(style.bgColor)
    if (style.bold) result += ansiBold()
    result += char
    result += ansiReset()
    return result
  }
  
  toString(): string {
    return this.buffer.map(row => row.join('')).join('\n')
  }
}
```

### 4.3 渲染到屏幕

```typescript
// source/src/ink/render-to-screen.ts

export function renderToScreen(root: React.ReactNode, options: RenderOptions): void {
  // 1. 计算布局
  const layout = calculateLayout(root, options.width, options.height)
  
  // 2. 创建屏幕缓冲区
  const screen = new Screen(options.width, options.height)
  
  // 3. 渲染节点
  renderNodeToScreen(layout, screen, 0, 0)
  
  // 4. 输出到终端
  const output = screen.toString()
  process.stdout.write(ansiCursorTo(0, 0) + ansiEraseDown() + output)
}
```

---

## 5. 输入处理

### 5.1 useInput Hook

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

### 5.2 按键解析

```typescript
// source/src/ink/parse-keypress.ts

export function parseKey(data: Buffer): Key {
  const s = String(data)
  
  // 功能键
  if (s === '\u0003') return { name: 'c', ctrl: true }  // Ctrl+C
  if (s === '\u0004') return { name: 'd', ctrl: true }  // Ctrl+D
  if (s === '\r') return { name: 'return' }
  if (s === '\t') return { name: 'tab' }
  
  // 方向键
  if (s === '\u001B[A') return { name: 'up' }
  if (s === '\u001B[B') return { name: 'down' }
  if (s === '\u001B[C') return { name: 'right' }
  if (s === '\u001B[D') return { name: 'left' }
  
  // ESC
  if (s === '\u001B') return { name: 'escape' }
  
  // 普通字符
  return { name: s }
}
```

---

## 6. 性能优化

### 6.1 增量渲染

```typescript
// source/src/ink/optimizer.ts

export function optimizeRender(oldTree: ReactNode, newTree: ReactNode): ReactNode {
  // 比较虚拟 DOM 树
  if (isSameType(oldTree, newTree)) {
    // 类型相同，只更新变化的部分
    return {
      ...newTree,
      children: optimizeRender(oldTree.children, newTree.children),
    }
  }
  
  // 类型不同，完全重新渲染
  return newTree
}
```

### 6.2 文本压缩

```typescript
// source/src/ink/squash-text-nodes.ts

export function squashTextNodes(nodes: ReactNode[]): ReactNode[] {
  const result: ReactNode[] = []
  let currentText = ''
  
  for (const node of nodes) {
    if (typeof node === 'string') {
      currentText += node
    } else {
      if (currentText) {
        result.push(currentText)
        currentText = ''
      }
      result.push(node)
    }
  }
  
  if (currentText) {
    result.push(currentText)
  }
  
  return result
}
```

### 6.3 布局缓存

```typescript
// source/src/ink/layout/node.ts

export class LayoutNode {
  private cachedLayout: LayoutResult | null = null
  
  calculateLayout(force: boolean = false): LayoutResult {
    // 使用缓存的布局（如果可用）
    if (!force && this.cachedLayout) {
      return this.cachedLayout
    }
    
    // 计算新布局
    const layout = this.doCalculateLayout()
    this.cachedLayout = layout
    return layout
  }
  
  invalidateLayout(): void {
    this.cachedLayout = null
  }
}
```

---

## 7. 最佳实践

### 7.1 组件设计

```typescript
// ✅ 好的组件设计
function Message({ message }: { message: Message }) {
  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>{message.sender}</Text>
      <Text>{message.content}</Text>
    </Box>
  )
}

// ❌ 不好的组件设计
function Message({ message }) {
  // 没有类型定义
  // 没有错误处理
  return <div>{message.content}</div>  // 使用 HTML 标签而非 Ink 组件
}
```

### 7.2 状态管理

```typescript
// ✅ 使用 React 状态
function Counter() {
  const [count, setCount] = useState(0)
  
  useInput((input, key) => {
    if (key.name === 'up') {
      setCount(count + 1)
    } else if (key.name === 'down') {
      setCount(count - 1)
    }
  })
  
  return <Text>Count: {count}</Text>
}

// ❌ 直接修改状态
let count = 0
function Counter() {
  useInput((input, key) => {
    count++  // 不会触发重新渲染
  })
  return <Text>Count: {count}</Text>
}
```

---

## 📚 相关文档

| 文档 | 说明 |
|------|------|
| [51-组件系统.md](./51-组件系统.md) | 146 个组件详解 |
| [52-Hooks 系统.md](./52-Hooks 系统.md) | 87 个 React Hooks |
| [03-核心概念.md](./03-核心概念.md) | 基础术语和概念 |

---

_最后更新：2026-04-02_  
_预计阅读时间：35 分钟_
