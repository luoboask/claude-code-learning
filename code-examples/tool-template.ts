/**
 * 工具实现模板
 * 
 * 使用方法:
 * 1. 复制此文件并修改工具名称
 * 2. 实现 call 方法
 * 3. 根据需要实现可选方法
 * 4. 在 tools.ts 中注册
 */

import { buildTool } from '../Tool'
import { z } from 'zod/v4'
import type { ToolUseContext } from '../Tool'

// ═══════════════════════════════════════════════════════════════════════════
// 1. 定义输入 Schema
// ═══════════════════════════════════════════════════════════════════════════

const inputSchema = z.object({
  // 必填参数
  param1: z.string().describe('参数 1 的描述'),
  
  // 可选参数
  param2: z.number().optional().default(10),
  
  // 带默认值的参数
  param3: z.boolean().default(true),
})

type Input = z.infer<typeof inputSchema>

// ═══════════════════════════════════════════════════════════════════════════
// 2. 定义输出类型
// ═══════════════════════════════════════════════════════════════════════════

type Output = {
  result: string
  data?: unknown
  error?: string
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. 实现工具
// ═══════════════════════════════════════════════════════════════════════════

export const MyTool = buildTool({
  // ─────────────────────────────────────────────────────────────────────────
  // 基础属性
  // ─────────────────────────────────────────────────────────────────────────
  
  /** 工具名称 (必填) */
  name: 'MyTool',
  
  /** 工具描述 (必填) - 会显示给模型 */
  description: '工具的详细描述，说明这个工具能做什么',
  
  /** 搜索提示 - 用于 ToolSearch 关键词匹配 */
  searchHint: 'keyword1 keyword2 keyword3',
  
  // ─────────────────────────────────────────────────────────────────────────
  // Schema
  // ─────────────────────────────────────────────────────────────────────────
  
  /** 输入 Schema (必填) */
  inputSchema,
  
  // ─────────────────────────────────────────────────────────────────────────
  // 核心方法
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * 工具调用方法 (必填)
   * 
   * @param args - 解析后的输入参数
   * @param context - 工具使用上下文
   * @param canUseTool - 权限检查函数
   * @param parentMessage - 父消息 (AI 消息)
   * @param onProgress - 进度回调
   */
  async call(
    args: Input,
    context: ToolUseContext,
    canUseTool: any,
    parentMessage: any,
    onProgress?: any,
  ): Promise<{ data: Output }> {
    // 1. 执行前验证
    if (!args.param1) {
      return {
        data: {
          result: 'error',
          error: 'param1 is required',
        },
      }
    }
    
    // 2. 执行工具逻辑
    try {
      // 示例：调用外部 API
      // const response = await fetch('https://api.example.com/...')
      // const data = await response.json()
      
      // 示例：执行文件操作
      // const content = await fs.readFile(args.param1, 'utf-8')
      
      // 示例：执行命令
      // const result = await exec(args.command)
      
      // 3. 返回结果
      return {
        data: {
          result: 'success',
          data: {
            // 返回数据
          },
        },
      }
    } catch (error) {
      return {
        data: {
          result: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      }
    }
  },
  
  // ─────────────────────────────────────────────────────────────────────────
  // 特性检查方法 (可选，有默认值)
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * 是否启用
   * 返回 false 时工具不会出现在工具列表中
   */
  isEnabled(): boolean {
    return true
  },
  
  /**
   * 是否可并发执行
   * 返回 true 的多个工具调用可以并行执行
   * 
   * 示例：读操作通常可并发，写操作通常不可并发
   */
  isConcurrencySafe(input: Input): boolean {
    // 示例：只读操作可并发
    return true
  },
  
  /**
   * 是否是只读操作
   * 只读操作通常可以自动允许 (在 bypass 模式下)
   */
  isReadOnly(input: Input): boolean {
    // 示例：不修改任何内容的操作
    return true
  },
  
  /**
   * 是否是破坏性操作
   * 破坏性操作需要额外确认
   */
  isDestructive(input: Input): boolean {
    // 示例：删除、覆盖等操作
    return false
  },
  
  // ─────────────────────────────────────────────────────────────────────────
  // UI 渲染方法 (可选)
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * 渲染工具使用消息
   * 在工具执行前显示，展示用户请求的内容
   */
  renderToolUseMessage(
    input: Partial<Input>,
    options: { theme: string; verbose: boolean },
  ) {
    return `正在执行 MyTool: ${input.param1 || '...'}`
  },
  
  /**
   * 渲染工具结果消息
   * 在工具执行后显示，展示执行结果
   */
  renderToolResultMessage(
    content: Output,
    options: { theme: string; verbose: boolean },
  ) {
    if (content.result === 'error') {
      return `❌ 错误：${content.error}`
    }
    return `✅ 执行成功`
  },
  
  /**
   * 获取工具使用摘要
   * 用于紧凑视图显示
   */
  getToolUseSummary(input: Partial<Input>): string | null {
    return `MyTool: ${input.param1}`
  },
  
  /**
   * 获取活动描述
   * 用于 spinner 显示
   */
  getActivityDescription(input: Partial<Input>): string | null {
    return `执行 ${input.param1}`
  },
  
  // ─────────────────────────────────────────────────────────────────────────
  // 权限与验证 (可选)
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * 验证输入
   * 在权限检查之前执行
   */
  async validateInput(
    input: Input,
    context: ToolUseContext,
  ): Promise<{ result: true } | { result: false; message: string; errorCode: number }> {
    if (!input.param1 || input.param1.length === 0) {
      return {
        result: false,
        message: 'param1 cannot be empty',
        errorCode: 1,
      }
    }
    return { result: true }
  },
  
  /**
   * 检查权限
   * 工具特定的权限逻辑
   */
  async checkPermissions(
    input: Input,
    context: ToolUseContext,
  ): Promise<{ behavior: 'allow' | 'deny' | 'ask'; updatedInput?: Input }> {
    // 默认交给全局权限系统处理
    return { behavior: 'allow', updatedInput: input }
  },
})

// ═══════════════════════════════════════════════════════════════════════════
// 4. 在 tools.ts 中注册
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 在 tools.ts 中添加:
 * 
 * import { MyTool } from './tools/MyTool/MyTool'
 * 
 * export function getAllBaseTools(): Tools {
 *   return [
 *     // ... 现有工具
 *     MyTool,  // 添加新工具
 *   ]
 * }
 */
