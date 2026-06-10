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
  /** 用户旅程顺序：0 = 最先，数字越大越靠后；同 order 的横排 */
  order?: number
  /** 视觉重要度：core=核心居中突出 / auxiliary=辅助边角弱化 / normal=默认 */
  importance?: 'core' | 'normal' | 'auxiliary'
}

export interface CrossFeatureLink {
  from: string  // feature id
  to: string    // feature id
  /**
   * 三类语义：
   *   triggers    — 用户/外部动作触发：UI 点击、HTTP 请求、定时器、CLI 命令
   *   flow        — 数据/事件流转：A 产出 → B 消费（同步异步由可选 mode 区分）
   *   depends_on  — 静态依赖：B 必须先存在/可用，A 才能工作
   *
   * v0.1 历史值 publishes/subscribes 自动迁移到 flow（loader 兼容）。
   */
  kind: 'triggers' | 'flow' | 'depends_on'
  /** flow 关系的同步/异步性，可选；不写默认按 sync 渲染 */
  mode?: 'sync' | 'async'
  note?: string
}

export type EpicFlowKind = 'next' | 'depends_on'

export interface EpicFlow {
  from: string  // epic id
  to: string    // epic id
  /**
   * next       — 用户旅程下一步
   * depends_on — 架构依赖（A 依赖 B 先存在）
   *
   * v0.1 历史值 enables 自动迁移到 depends_on（方向反转：A enables B → B depends_on A）。
   */
  kind: EpicFlowKind
  note?: string
}

/* ------------------------------------------------------------------ Tour */

export interface TourQuiz {
  /** 2-3 个选项 */
  options: string[]
  /** 正确选项下标（0-based） */
  answer: number
  /** 答错时的一句话纠偏："你以为 X，实际 Y" */
  wrong_note?: string
}

export interface TourStep {
  /** 本步点亮的节点：epic id 或 feature id，1-3 个 */
  focus: string[]
  /** 开缺口的问题——必须是问句，在节点出现之前先制造好奇心 */
  gap: string
  /** 答案叙事，≤60 字，有因果方向 */
  reveal: string
  /** 预测点，可选；整条 tour 出现 1-2 次，放在用户凭直觉容易答错的岔路口 */
  quiz?: TourQuiz
}

/**
 * 引导式导览：把画布变成逐步点亮的舞台。
 * 认知依据：人通过"按顺序走一条路"理解系统，不是"看一张全图"。
 * 每步 gap（信息缺口）→ quiz（可选预测）→ reveal（叙事）→ 节点点亮 + 镜头移动。
 */
export interface Tour {
  id: string
  title: string
  /** 走完后用户应能回答什么 */
  goal: string
  /** 6-10 步；第一步是骨架步（2-3 个核心 epic + 三段论主线） */
  steps: TourStep[]
}

export interface FcgManifest {
  repo?: string
  commit?: string
  generated_at: string
  generator?: string  // 'ai@gpt-4o' / 'user'
  /** 语义文本的输出语言：'zh-CN' | 'en' | 'ja' 等，默认 'zh-CN' */
  lang?: string
}

export interface FeaturesFile {
  version: typeof FCG_VERSION
  manifest: FcgManifest
  epics: Epic[]
  features: Feature[]
  cross_feature?: CrossFeatureLink[]
  /** Epic 之间的主线关系：用户故事的宏观流向 */
  epic_flow?: EpicFlow[]
  /** 引导式导览（可选）：AI 生成或人工编写 */
  tours?: Tour[]
}

export function emptyFeatures(): FeaturesFile {
  return {
    version: FCG_VERSION,
    manifest: { generated_at: new Date().toISOString() },
    epics: [],
    features: [],
  }
}
