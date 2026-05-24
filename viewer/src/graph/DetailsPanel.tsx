import { useMemo } from 'react'
import { ArrowLeft, Bot, FileCode, Lock, Target, X } from 'lucide-react'
import type { CrossFeatureLink, FeaturesFile } from '@/fcg/types'
import type { FcgViewNode } from './fcgView'
import { CROSS_META, ROLE_META, type CrossKind } from './roleMeta'
import { cn } from '@/lib/cn'
import { useI18n } from '@/lib/i18n'

interface Props {
  view: FcgViewNode | null
  file: FeaturesFile
  onClose: () => void
  /** 当前焦点的相关节点数量（含焦点本身），>1 时显示"聚焦相关"按钮 */
  relatedCount?: number
  /** 当前视图实际渲染的节点 id 集合；列表项指向的节点不在集合里时禁用跳转 */
  viewNodeIds?: Set<string>
  /** 把焦点 + 相关节点 fitView 到视口 */
  onFocusRelated?: () => void
  /** 跳转到指定节点（fitView + 选中），nodeId 形如 'feature:f-login' / 'epic:auth' / 'step:f-login:input' */
  onNavigate?: (nodeId: string) => void
  /** 预览节点：在画布上临时高亮该节点（同 hover 行为），传 null 取消 */
  onPreviewNode?: (nodeId: string | null) => void
  /** 浏览器式 back 按钮：是否可点 */
  canGoBack?: boolean
  /** 浏览器式 back 按钮：执行回退 */
  onGoBack?: () => void
}

export function DetailsPanel({
  view,
  file,
  onClose,
  relatedCount = 0,
  viewNodeIds,
  onFocusRelated,
  onNavigate,
  onPreviewNode,
  canGoBack = false,
  onGoBack,
}: Props) {
  return (
    <aside
      className={cn(
        // 不再顶天立地: 顶部贴 16px, 高度按内容自然展开,
        // 上限用视口高度 (避开 TopBar ~52px + 上下留白) 让 inner 自己出滚动条,
        // 不让浏览器整页滚动
        // ⚠ aside 与 inner 都用 100vh 表达式 —— 不能用 max-h-full,
        //   因为 % max-height 引用的是父级的 height (不是 max-height),
        //   父级没定义 height 时 % 解析为 none → 限高失效 → 浏览器滚动条出现.
        'pointer-events-none absolute top-4 right-4 z-10 w-[348px]',
        'max-h-[calc(100vh-80px)]',
        'transition-[opacity,transform] duration-150',
        view ? 'translate-x-0 opacity-100' : 'translate-x-3 opacity-0',
      )}
    >
      {view && (
        <div
          className={cn(
            // 直接绑视口表达式, 不依赖父级 height 的传递, 是 max-h-full 的稳健替代
            'pointer-events-auto flex max-h-[calc(100vh-80px)] flex-col overflow-hidden rounded-2xl border border-[var(--color-border)]',
            'bg-[var(--color-bg-1)]',
            'shadow-[0_1px_2px_oklch(0_0_0/0.04),0_24px_48px_-24px_oklch(0_0_0/0.18)]',
          )}
        >
          <PanelHeader
            view={view}
            onClose={onClose}
            relatedCount={relatedCount}
            onFocusRelated={onFocusRelated}
            canGoBack={canGoBack}
            onGoBack={onGoBack}
          />
          <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
            {view.kind === 'epic' && (
              <EpicBody
                view={view}
                file={file}
                viewNodeIds={viewNodeIds}
                onNavigate={onNavigate}
                onPreviewNode={onPreviewNode}
              />
            )}
            {view.kind === 'feature' && (
              <FeatureBody
                view={view}
                file={file}
                viewNodeIds={viewNodeIds}
                onNavigate={onNavigate}
                onPreviewNode={onPreviewNode}
              />
            )}
            {view.kind === 'step' && <StepBody view={view} file={file} />}
          </div>
        </div>
      )}
    </aside>
  )
}

function PanelHeader({
  view,
  onClose,
  relatedCount,
  onFocusRelated,
  canGoBack,
  onGoBack,
}: {
  view: FcgViewNode
  onClose: () => void
  relatedCount: number
  onFocusRelated?: () => void
  canGoBack: boolean
  onGoBack?: () => void
}) {
  const { t } = useI18n()
  let label: string
  let title: string
  let badge: React.ReactNode = null

  if (view.kind === 'epic') {
    label = 'Epic'
    title = view.epic.name
  } else if (view.kind === 'feature') {
    label = 'Feature'
    title = view.feature.name
    if (view.feature.locked) {
      badge = (
        <span className="inline-flex items-center gap-1 rounded-md bg-[var(--color-bg-2)] px-1.5 py-0.5 text-[10px] text-[var(--color-fg-muted)]">
          <Lock size={10} /> locked
        </span>
      )
    } else if (view.feature.provenance === 'ai') {
      badge = (
        <span
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px]"
          style={{
            background: 'var(--color-accent-soft)',
            color: 'var(--color-accent-strong)',
          }}
        >
          <Bot size={10} /> AI
        </span>
      )
    }
  } else {
    label = (ROLE_META[view.step.role] ?? ROLE_META.other).label + ' · Step'
    title = view.step.name
  }

  // relatedCount 包含焦点自己，所以 >= 2 才有"相关节点"
  const hasRelated = relatedCount >= 2 && !!onFocusRelated
  const showBack = canGoBack && !!onGoBack

  return (
    <header className="flex items-start justify-between gap-2 border-b border-[var(--color-border)] px-4 py-3.5">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {showBack && (
            <button
              type="button"
              onClick={onGoBack}
              title={t('panel.backTitle')}
              className="-ml-1 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] text-[var(--color-fg-muted)] transition-colors hover:bg-[var(--color-bg-2)] hover:text-[var(--color-fg)]"
            >
              <ArrowLeft size={11} />
              {t('panel.back')}
            </button>
          )}
          <span className="rounded-md bg-[var(--color-bg-2)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-fg-muted)]">
            {label}
          </span>
          {badge}
        </div>
        <h2 className="mt-2 truncate text-[14px] font-medium tracking-tight text-[var(--color-fg)]">
          {title}
        </h2>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {hasRelated && (
          <button
            type="button"
            onClick={onFocusRelated}
            title={t('panel.focusRelatedTitle', { count: relatedCount - 1 })}
            className="inline-flex items-center gap-1 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-2)] px-2 py-1 text-[10.5px] text-[var(--color-fg-muted)] transition-colors hover:bg-[var(--color-bg-sunken)] hover:text-[var(--color-fg)]"
          >
            <Target size={11} />
            {t('panel.focusRelated', { count: relatedCount - 1 })}
          </button>
        )}
        <button
          onClick={onClose}
          className="-mr-1 rounded-md p-1.5 text-[var(--color-fg-subtle)] transition-colors hover:bg-[var(--color-bg-2)] hover:text-[var(--color-fg)]"
          aria-label={t('panel.close')}
        >
          <X size={15} />
        </button>
      </div>
    </header>
  )
}

function EpicBody({
  view,
  file,
  viewNodeIds,
  onNavigate,
  onPreviewNode,
}: {
  view: Extract<FcgViewNode, { kind: 'epic' }>
  file: FeaturesFile
  viewNodeIds?: Set<string>
  onNavigate?: (nodeId: string) => void
  onPreviewNode?: (nodeId: string | null) => void
}) {
  const { t } = useI18n()
  const features = useMemo(
    () => file.features.filter((f) => (f.epicId ?? '__none__') === view.epic.id),
    [file.features, view.epic.id],
  )
  return (
    <>
      {view.epic.summary && (
        <Section title={t('panel.summary')}>
          <p className="text-[12px] leading-relaxed text-[var(--color-fg-muted)]">
            {view.epic.summary}
          </p>
        </Section>
      )}
      <Section title={t('panel.containedFeatures', { count: features.length })}>
        <ul className="space-y-1.5">
          {features.map((f) => {
            const targetId = `feature:${f.id}`
            const navigable = !!onNavigate && (viewNodeIds?.has(targetId) ?? true)
            return (
              <NavListItem
                key={f.id}
                navigable={navigable}
                onClick={() => onNavigate?.(targetId)}
                onMouseEnter={() => onPreviewNode?.(targetId)}
                onMouseLeave={() => onPreviewNode?.(null)}
              >
                <span className="min-w-0 flex-1 truncate text-[12px] text-[var(--color-fg)]">
                  {f.name}
                </span>
                <span className="font-mono text-[10px] text-[var(--color-fg-subtle)]">
                  {t('panel.stepCount', { count: f.steps.length })}
                </span>
              </NavListItem>
            )
          })}
        </ul>
      </Section>
    </>
  )
}

function FeatureBody({
  view,
  file,
  viewNodeIds,
  onNavigate,
  onPreviewNode,
}: {
  view: Extract<FcgViewNode, { kind: 'feature' }>
  file: FeaturesFile
  viewNodeIds?: Set<string>
  onNavigate?: (nodeId: string) => void
  onPreviewNode?: (nodeId: string | null) => void
}) {
  const { t } = useI18n()
  const f = view.feature

  // 上下游分桶 + kind 内排序：让用户一眼看出"谁影响我 / 我影响谁"
  // 排序优先级: triggers > flow > depends_on (按强度)
  const { upstream, downstream } = useMemo(() => {
    const links = (file.cross_feature ?? []).filter(
      (l) => l.from === f.id || l.to === f.id,
    )
    const up: CrossFeatureLink[] = []
    const down: CrossFeatureLink[] = []
    for (const l of links) {
      if (l.to === f.id) up.push(l)
      else down.push(l)
    }
    const order: Record<CrossKind, number> = { triggers: 0, flow: 1, depends_on: 2 }
    const sortFn = (a: CrossFeatureLink, b: CrossFeatureLink) =>
      (order[a.kind as CrossKind] ?? 99) - (order[b.kind as CrossKind] ?? 99)
    up.sort(sortFn)
    down.sort(sortFn)
    return { upstream: up, downstream: down }
  }, [file.cross_feature, f.id])

  return (
    <>
      {f.summary && (
        <Section title={t('panel.summary')}>
          <p className="text-[12px] leading-relaxed text-[var(--color-fg-muted)]">
            {f.summary}
          </p>
        </Section>
      )}
      {f.triggers && f.triggers.length > 0 && (
        <Section title={t('panel.triggers')}>
          <ul className="space-y-1">
            {f.triggers.map((tt, i) => (
              <li
                key={i}
                className="flex items-center gap-2 text-[11.5px] text-[var(--color-fg-muted)]"
              >
                <span className="font-mono uppercase text-[var(--color-fg-subtle)]">
                  {tt.kind}
                </span>
                <span className="font-mono">{tt.detail}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}
      <Section title={t('panel.steps', { count: f.steps.length })}>
        <ol className="space-y-1">
          {f.steps.map((s, idx) => {
            const meta = ROLE_META[s.role] ?? ROLE_META.other
            const targetId = `step:${f.id}:${s.id}`
            const navigable = !!onNavigate && (viewNodeIds?.has(targetId) ?? false)
            return (
              <NavListItem
                key={s.id}
                navigable={navigable}
                onClick={() => onNavigate?.(targetId)}
                onMouseEnter={() => onPreviewNode?.(targetId)}
                onMouseLeave={() => onPreviewNode?.(null)}
              >
                <span className="font-mono text-[10px] text-[var(--color-fg-subtle)]">
                  {String(idx + 1).padStart(2, '0')}
                </span>
                <span
                  className="rounded px-1.5 py-0.5 text-[9.5px]"
                  style={{ background: meta.bg, color: meta.fg }}
                >
                  {meta.label}
                </span>
                <span className="min-w-0 flex-1 truncate text-[12px] text-[var(--color-fg)]">
                  {s.name}
                </span>
              </NavListItem>
            )
          })}
        </ol>
      </Section>
      {upstream.length > 0 && (
        <Section title={t('panel.relatedUpstream', { count: upstream.length })}>
          <CrossLinkList
            links={upstream}
            self={f.id}
            file={file}
            viewNodeIds={viewNodeIds}
            onNavigate={onNavigate}
            onPreviewNode={onPreviewNode}
          />
        </Section>
      )}
      {downstream.length > 0 && (
        <Section title={t('panel.relatedDownstream', { count: downstream.length })}>
          <CrossLinkList
            links={downstream}
            self={f.id}
            file={file}
            viewNodeIds={viewNodeIds}
            onNavigate={onNavigate}
            onPreviewNode={onPreviewNode}
          />
        </Section>
      )}
      {f.tags && f.tags.length > 0 && (
        <Section title={t('panel.tags')}>
          <div className="flex flex-wrap gap-1">
            {f.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-2)] px-1.5 py-0.5 font-mono text-[9.5px] text-[var(--color-fg-muted)]"
              >
                #{tag}
              </span>
            ))}
          </div>
        </Section>
      )}
    </>
  )
}

/**
 * cross_feature 关系列表项：上游 / 下游分桶后用同一个组件渲染。
 * - 左侧 kind 色块（triggers 暖橘 / flow 蓝 / depends_on 灰），与画布边色一致
 * - flow + mode='async' 标"异步"
 * - 主文本是对方功能名，可点跳转
 */
function CrossLinkList({
  links,
  self,
  file,
  viewNodeIds,
  onNavigate,
  onPreviewNode,
}: {
  links: CrossFeatureLink[]
  self: string
  file: FeaturesFile
  viewNodeIds?: Set<string>
  onNavigate?: (nodeId: string) => void
  onPreviewNode?: (nodeId: string | null) => void
}) {
  const { t } = useI18n()
  return (
    <ul className="space-y-1">
      {links.map((l, i) => {
        const otherId = l.to === self ? l.from : l.to
        const other = file.features.find((x) => x.id === otherId)
        const targetId = `feature:${otherId}`
        const navigable = !!onNavigate && (viewNodeIds?.has(targetId) ?? false)
        const meta = CROSS_META[l.kind as CrossKind]
        const isAsync = l.kind === 'flow' && l.mode === 'async'
        return (
          <NavListItem
            key={i}
            navigable={navigable}
            onClick={() => onNavigate?.(targetId)}
            onMouseEnter={() => onPreviewNode?.(targetId)}
            onMouseLeave={() => onPreviewNode?.(null)}
          >
            <span
              className="rounded px-1.5 py-0.5 font-mono text-[9.5px]"
              style={{
                // 用 kind 色做软底, 透明度 0.18 让卡片不喧宾夺主
                background: meta ? meta.stroke.replace(')', ' / 0.18)').replace('oklch(', 'oklch(') : 'var(--color-bg-2)',
                color: meta ? meta.stroke : 'var(--color-fg-muted)',
              }}
            >
              {t(`panel.crossKind.${l.kind}` as 'panel.crossKind.triggers')}
            </span>
            {isAsync && (
              <span className="rounded bg-[var(--color-bg-2)] px-1 py-0.5 font-mono text-[9px] text-[var(--color-fg-subtle)]">
                {t('panel.crossMode.async')}
              </span>
            )}
            <span className="min-w-0 flex-1 truncate text-[11.5px] text-[var(--color-fg)]">
              {other?.name ?? otherId}
            </span>
          </NavListItem>
        )
      })}
    </ul>
  )
}

function StepBody({
  view,
  file,
}: {
  view: Extract<FcgViewNode, { kind: 'step' }>
  file: FeaturesFile
}) {
  const { t } = useI18n()
  const s = view.step
  const owner = useMemo(
    () => file.features.find((f) => f.id === view.featureId),
    [file.features, view.featureId],
  )
  return (
    <>
      <Section title={t('panel.ownerFeature')}>
        <p className="text-[12.5px] text-[var(--color-fg)]">{owner?.name ?? view.featureId}</p>
      </Section>
      {s.note && (
        <Section title={t('panel.summary')}>
          <p className="text-[12px] leading-relaxed text-[var(--color-fg-muted)]">{s.note}</p>
        </Section>
      )}
      {s.refs && s.refs.length > 0 && (
        <Section title={t('panel.sourceRefs')}>
          <ul className="space-y-1">
            {s.refs.map((r, i) => (
              <li
                key={i}
                className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-1)] px-2.5 py-1.5 font-mono text-[11px] text-[var(--color-fg-muted)]"
              >
                <FileCode size={11} className="shrink-0 text-[var(--color-fg-subtle)]" />
                <span className="min-w-0 flex-1 truncate">
                  {r.file}
                  {r.lines && (
                    <span className="text-[var(--color-fg-subtle)]">
                      :{r.lines[0]}-{r.lines[1]}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </>
  )
}

/**
 * 列表项的统一壳子：
 * - navigable=true → 像按钮一样可点击 + hover 暖色高亮 + 鼠标变手型
 * - navigable=false → 静态展示项 (旧版 li 样式)
 * 点击/hover/leave 通过 props 上抛给画布做联动。
 */
function NavListItem({
  navigable,
  onClick,
  onMouseEnter,
  onMouseLeave,
  children,
}: {
  navigable: boolean
  onClick: () => void
  onMouseEnter: () => void
  onMouseLeave: () => void
  children: React.ReactNode
}) {
  if (!navigable) {
    return (
      <li className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-1)] px-2.5 py-1.5">
        {children}
      </li>
    )
  }
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        className={cn(
          'flex w-full items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-1)] px-2.5 py-1.5 text-left',
          'transition-colors hover:border-[var(--color-accent)] hover:bg-[var(--color-accent-soft)]',
        )}
      >
        {children}
      </button>
    </li>
  )
}

function Section({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-2 text-[10.5px] font-medium tracking-wide text-[var(--color-fg-subtle)]">
        {title}
      </div>
      {children}
    </section>
  )
}
