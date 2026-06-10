/**
 * 导览模式的纯逻辑（与 UI 分离，TourMode.tsx 只放组件）。
 *
 * 核心模型：布局算满图、渲染做减法——
 * 节点位置自始至终稳定，导览只决定"哪些节点此刻点亮"。
 *
 * 视图档位：
 *   focus 全是 epic 的步（骨架步）→ 概览视图：Epic 是真节点，
 *     名字/摘要/epic_flow 主线边都可见，给"系统大形状"。
 *   含 feature 的步 → 功能视图：逐盏点亮 feature 与其容器。
 *   档位切换 = 镜头从高空降到街景，对应既有的双击下钻心智模型。
 */
import type { FeaturesFile, Tour, TourStep } from '@/fcg/types'

export interface TourPlay {
  tour: Tour
  stepIndex: number
  /** ask = 问题已抛出、节点未点亮；shown = 已揭晓、节点点亮 + 镜头移动 */
  phase: 'ask' | 'shown'
}

export type TourViewMode = 'overview' | 'features'

/** 一步该在哪个视图播放：focus 全是 epic → 概览；否则 → 功能 */
export function stepViewMode(file: FeaturesFile, step: TourStep): TourViewMode {
  const epicIds = new Set(file.epics.map((e) => e.id))
  return step.focus.length > 0 && step.focus.every((r) => epicIds.has(r))
    ? 'overview'
    : 'features'
}

/**
 * 把一个 focus 引用解析成指定视图下的节点 id。
 *   概览视图：feature → 其所属 epic:<id>；epic → epic:<id>
 *   功能视图：feature → feature:<id> + 容器 group:<epicId>；epic → group:<id>
 * 不认识的引用静默跳过（校验器会在脚本层报 error）。
 */
function resolveRef(file: FeaturesFile, ref: string, mode: TourViewMode): string[] {
  const feature = file.features.find((f) => f.id === ref)
  const isEpic = file.epics.some((e) => e.id === ref)
  if (mode === 'overview') {
    if (feature) return [`epic:${feature.epicId ?? '__none__'}`]
    if (isEpic) return [`epic:${ref}`]
    return []
  }
  if (feature) return [`feature:${feature.id}`, `group:${feature.epicId ?? '__none__'}`]
  if (isEpic) return [`group:${ref}`]
  return []
}

/**
 * 当前进度下的可见节点集合（按当前步的视图档位解析全部历史步骤）。
 *   mode    = 当前步所在视图
 *   visible = 所有已揭晓步骤的节点（phase=ask 时不含当前步）
 *   current = 当前步的节点（仅 phase=shown 时非空），用于"谁全亮谁变暗"
 */
export function tourVisibleNodeIds(
  file: FeaturesFile,
  play: TourPlay,
): { mode: TourViewMode; visible: Set<string>; current: Set<string> } {
  const step = play.tour.steps[play.stepIndex]
  const mode = stepViewMode(file, step)
  const visible = new Set<string>()
  const current = new Set<string>()
  const upto = play.phase === 'shown' ? play.stepIndex : play.stepIndex - 1
  for (let i = 0; i <= upto && i < play.tour.steps.length; i++) {
    for (const ref of play.tour.steps[i].focus) {
      for (const id of resolveRef(file, ref, mode)) {
        visible.add(id)
        if (i === play.stepIndex) current.add(id)
      }
    }
  }

  // 功能视图：滤掉"没有任何可见成员、又不是当前步直接点名"的空容器——
  // 大空盒子只有噪音价值（骨架步的 epic 在概览视图里另有完整呈现）
  if (mode === 'features') {
    const groupHasMember = new Set<string>()
    for (const f of file.features) {
      if (visible.has(`feature:${f.id}`)) {
        groupHasMember.add(`group:${f.epicId ?? '__none__'}`)
      }
    }
    for (const id of [...visible]) {
      if (id.startsWith('group:') && !groupHasMember.has(id) && !current.has(id)) {
        visible.delete(id)
      }
    }
  }

  return { mode, visible, current }
}
