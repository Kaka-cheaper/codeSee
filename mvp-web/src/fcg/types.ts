/**
 * Feature & Flow Graph (FCG) — 语义级功能流程图。
 *
 * 三层粒度：
 *   Epic     —— 用户故事 / 业务大块（"用户管理"、"支付"）
 *   Feature  —— 一个用户/接口可感知的功能（"添加用户"、"导出 CSV"）
 *   Step     —— 功能内的一步动作（"校验输入"、"写入数据库"）
 *
 * 关系：
 *   Epic 包含 Feature[]
 *   Feature 内 Step[] 通过 flow[] 串成有向图（不是调用链，是"然后呢"的语义链）
 *
 * 数据来源：AI 直接产出 features.json，人工修正/锁定。
 * 画布按缩放级别切换显示：远 → Epic 概览，中 → Feature 列表，近 → Step 流程。
 */

export const FCG_VERSION = '0' as const

export type TriggerKind =
  | 'http'        // HTTP 端点
  | 'cli'         // 命令行
  | 'cron'        // 定时
  | 'event'       // 事件订阅
  | 'ui'          // UI 操作
  | 'manual'      // 人工触发
  | 'startup'     // 启动时
  | 'unknown'

export interface Trigger {
  kind: TriggerKind
  /** 一句话描述：'POST /api/users'、'每日凌晨 2 点'、'用户点击保存按钮' */
  detail: string
}

export type StepRole =
  | 'input'        // 入参 / 接收请求
  | 'validation'   // 校验
  | 'auth'         // 鉴权
  | 'data-read'    // 读数据
  | 'data-write'   // 写数据
  | 'compute'      // 业务计算
  | 'transform'    // 转换 / 格式化
  | 'side-effect'  // 副作用（发邮件、推消息）
  | 'output'       // 出参 / 返回响应
  | 'error'        // 错误处理 / 兜底
  | 'other'

export interface SourceRef {
  /** 项目根的相对路径 */
  file: string
  /** 起止行号；可选 */
  lines?: [number, number]
}

export interface Step {
  id: string
  /** 动作短语，2~8 字：'校验邮箱'、'查询用户'、'签发 Token' */
  name: string
  role: StepRole
  /** 一句话补充说明，可选 */
  note?: string
  /** 指回源码位置，可选；多个表示这一步分布在多处 */
  refs?: SourceRef[]
}

export type FlowKind =
  | 'next'         // 顺序：A 完成后 B
  | 'async'        // 异步：A 触发 B 但不等待（如发消息、入队）
  | 'conditional'  // 条件：A 在某条件下走 B，否则走别处
  | 'loop'         // 循环：A 反复执行 B
  | 'error'        // 错误分支：A 出错走 B

export interface Flow {
  from: string
  to: string
  kind: FlowKind
  /** conditional/loop 的条件描述：'当密码错误'、'对每个订单' */
  condition?: string
}

export interface Feature {
  id: string
  name: string
  /** 一句话功能描述，<=30 字 */
  summary?: string
  /** 所属 Epic id（可选；不写表示"未分组"） */
  epicId?: string
  /** 触发方式（可多个，如同一接口同时被定时和 HTTP 触发） */
  triggers?: Trigger[]
  steps: Step[]
  flow: Flow[]
  /** 1.0 = 用户确认；<1.0 = AI 推测 */
  confidence: number
  /** AI 写的 / 人锁定的 */
  provenance: 'ai' | 'user'
  /** 锁定后下次同步不会被 AI 覆盖 */
  locked?: boolean
  /** 标签：['auth','login']，便于检索 */
  tags?: string[]
  updated_at: string
}

export interface Epic {
  id: string
  name: string
  summary?: string
  tags?: string[]
}

export interface CrossFeatureLink {
  from: string  // feature id
  to: string    // feature id
  kind: 'depends_on' | 'publishes' | 'subscribes' | 'triggers'
  note?: string
}

export interface FcgManifest {
  repo?: string
  commit?: string
  generated_at: string
  generator?: string  // 'ai@gpt-4o' / 'user'
}

export interface FeaturesFile {
  version: typeof FCG_VERSION
  manifest: FcgManifest
  epics: Epic[]
  features: Feature[]
  cross_feature?: CrossFeatureLink[]
}

export function emptyFeatures(): FeaturesFile {
  return {
    version: FCG_VERSION,
    manifest: { generated_at: new Date().toISOString() },
    epics: [],
    features: [],
  }
}
