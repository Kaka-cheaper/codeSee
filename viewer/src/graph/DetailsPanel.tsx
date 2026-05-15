import { useMemo } from 'react'
import { Bot, FileCode, Lock, X } from 'lucide-react'
import type { FeaturesFile } from '@/fcg/types'
import type { FcgViewNode } from './fcgView'
import { ROLE_META } from './roleMeta'
import { cn } from '@/lib/cn'

interface Props {
  view: FcgViewNode | null
  file: FeaturesFile
  onClose: () => void
}

export function DetailsPanel({ view, file, onClose }: Props) {
  return (
    <aside
      className={cn(
        'pointer-events-none absolute top-4 right-4 bottom-4 z-10 w-[348px]',
        'transition-[opacity,transform] duration-150',
        view ? 'translate-x-0 opacity-100' : 'translate-x-3 opacity-0',
      )}
    >
      {view && (
        <div
          className={cn(
            'pointer-events-auto flex h-full flex-col overflow-hidden rounded-2xl border border-[var(--color-border)]',
            'bg-[var(--color-bg-1)]',
            'shadow-[0_1px_2px_oklch(0_0_0/0.04),0_24px_48px_-24px_oklch(0_0_0/0.18)]',
          )}
        >
          <PanelHeader view={view} onClose={onClose} />
          <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
            {view.kind === 'epic' && <EpicBody view={view} file={file} />}
            {view.kind === 'feature' && <FeatureBody view={view} file={file} />}
            {view.kind === 'step' && <StepBody view={view} file={file} />}
          </div>
        </div>
      )}
    </aside>
  )
}

function PanelHeader({ view, onClose }: { view: FcgViewNode; onClose: () => void }) {
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

  return (
    <header className="flex items-start justify-between gap-3 border-b border-[var(--color-border)] px-4 py-3.5">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-[var(--color-bg-2)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-fg-muted)]">
            {label}
          </span>
          {badge}
        </div>
        <h2 className="mt-2 truncate text-[14px] font-medium tracking-tight text-[var(--color-fg)]">
          {title}
        </h2>
      </div>
      <button
        onClick={onClose}
        className="-mr-1 rounded-md p-1.5 text-[var(--color-fg-subtle)] transition-colors hover:bg-[var(--color-bg-2)] hover:text-[var(--color-fg)]"
        aria-label="关闭"
      >
        <X size={15} />
      </button>
    </header>
  )
}

function EpicBody({
  view,
  file,
}: {
  view: Extract<FcgViewNode, { kind: 'epic' }>
  file: FeaturesFile
}) {
  const features = useMemo(
    () => file.features.filter((f) => (f.epicId ?? '__none__') === view.epic.id),
    [file.features, view.epic.id],
  )
  return (
    <>
      {view.epic.summary && (
        <Section title="说明">
          <p className="text-[12px] leading-relaxed text-[var(--color-fg-muted)]">
            {view.epic.summary}
          </p>
        </Section>
      )}
      <Section title={`包含的功能 (${features.length})`}>
        <ul className="space-y-1.5">
          {features.map((f) => (
            <li
              key={f.id}
              className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-1)] px-2.5 py-1.5"
            >
              <span className="min-w-0 flex-1 truncate text-[12px] text-[var(--color-fg)]">
                {f.name}
              </span>
              <span className="font-mono text-[10px] text-[var(--color-fg-subtle)]">
                {f.steps.length}步
              </span>
            </li>
          ))}
        </ul>
      </Section>
    </>
  )
}

function FeatureBody({
  view,
  file,
}: {
  view: Extract<FcgViewNode, { kind: 'feature' }>
  file: FeaturesFile
}) {
  const f = view.feature
  const links = useMemo(
    () =>
      (file.cross_feature ?? []).filter((l) => l.from === f.id || l.to === f.id),
    [file.cross_feature, f.id],
  )
  return (
    <>
      {f.summary && (
        <Section title="说明">
          <p className="text-[12px] leading-relaxed text-[var(--color-fg-muted)]">
            {f.summary}
          </p>
        </Section>
      )}
      {f.triggers && f.triggers.length > 0 && (
        <Section title="触发">
          <ul className="space-y-1">
            {f.triggers.map((t, i) => (
              <li
                key={i}
                className="flex items-center gap-2 text-[11.5px] text-[var(--color-fg-muted)]"
              >
                <span className="font-mono uppercase text-[var(--color-fg-subtle)]">
                  {t.kind}
                </span>
                <span className="font-mono">{t.detail}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}
      <Section title={`步骤 (${f.steps.length})`}>
        <ol className="space-y-1">
          {f.steps.map((s, idx) => {
            const meta = ROLE_META[s.role] ?? ROLE_META.other
            return (
              <li
                key={s.id}
                className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-1)] px-2.5 py-1.5"
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
              </li>
            )
          })}
        </ol>
      </Section>
      {links.length > 0 && (
        <Section title="关联功能">
          <ul className="space-y-1">
            {links.map((l, i) => {
              const isFrom = l.from === f.id
              const otherId = isFrom ? l.to : l.from
              const other = file.features.find((x) => x.id === otherId)
              return (
                <li
                  key={i}
                  className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-1)] px-2.5 py-1.5 text-[11.5px]"
                >
                  <span className="font-mono text-[9.5px] text-[var(--color-fg-subtle)]">
                    {isFrom ? '→' : '←'} {l.kind}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[var(--color-fg)]">
                    {other?.name ?? otherId}
                  </span>
                </li>
              )
            })}
          </ul>
        </Section>
      )}
      {f.tags && f.tags.length > 0 && (
        <Section title="标签">
          <div className="flex flex-wrap gap-1">
            {f.tags.map((t) => (
              <span
                key={t}
                className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-2)] px-1.5 py-0.5 font-mono text-[9.5px] text-[var(--color-fg-muted)]"
              >
                #{t}
              </span>
            ))}
          </div>
        </Section>
      )}
    </>
  )
}

function StepBody({
  view,
  file,
}: {
  view: Extract<FcgViewNode, { kind: 'step' }>
  file: FeaturesFile
}) {
  const s = view.step
  const owner = useMemo(
    () => file.features.find((f) => f.id === view.featureId),
    [file.features, view.featureId],
  )
  return (
    <>
      <Section title="所属功能">
        <p className="text-[12.5px] text-[var(--color-fg)]">{owner?.name ?? view.featureId}</p>
      </Section>
      {s.note && (
        <Section title="说明">
          <p className="text-[12px] leading-relaxed text-[var(--color-fg-muted)]">{s.note}</p>
        </Section>
      )}
      {s.refs && s.refs.length > 0 && (
        <Section title="源码位置">
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
