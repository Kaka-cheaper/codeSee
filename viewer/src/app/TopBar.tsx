import { useEffect, useRef, useState } from 'react'
import {
  ChevronDown,
  FolderOpen,
  GitBranch,
  Globe,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Trash2,
  FolderPlus,
  Sparkle,
  Upload as UploadIcon,
} from 'lucide-react'
import type { FeaturesFile } from '@/fcg/types'
import type { ProjectEntry } from '@/fcg/fileSystem'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/cn'

interface Props {
  file: FeaturesFile | null
  status: 'pending' | 'ok' | 'missing'
  sourceLabel: string
  activeRepoId: string | null
  projects: ProjectEntry[]
  onSwitchProject: (repoId: string) => void
  onAddProject: () => void
  onRemoveProject: (repoId: string) => void
  onClear: () => void
  liveReload: boolean
  onToggleLiveReload: () => void
  reloadHint: 'idle' | 'updated'
  liveAvailable: boolean
}

export function TopBar({
  file, status, sourceLabel,
  activeRepoId, projects, onSwitchProject, onAddProject, onRemoveProject,
  onClear,
  liveReload, onToggleLiveReload, reloadHint, liveAvailable,
}: Props) {
  const { t, locale, setLocale } = useI18n()

  const activeProject = activeRepoId
    ? projects.find((p) => p.repoId === activeRepoId)
    : null

  return (
    <header className="flex h-12 items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg-1)] px-5">
      <div className="flex items-center gap-2.5">
        <span
          className="flex h-6 w-6 items-center justify-center rounded-md"
          style={{
            background: 'var(--color-accent-soft)',
            color: 'var(--color-accent-strong)',
          }}
        >
          <Sparkles size={13} strokeWidth={2} />
        </span>
        <span className="text-[13px] font-medium tracking-tight text-[var(--color-fg)]">
          CodeSee
        </span>
        <span className="ml-1 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-2)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--color-fg-subtle)]">
          MVP
        </span>
        {status === 'missing' && (
          <span className="ml-1 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-2)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--color-fg-muted)]">
            {t('topbar.noData')}
          </span>
        )}
        {sourceLabel && (
          <span
            className="ml-1 truncate rounded-md border border-[var(--color-border)] bg-[var(--color-bg-2)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--color-fg-muted)]"
            title={sourceLabel}
          >
            {sourceLabel}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3 text-[11px] text-[var(--color-fg-muted)]">
        {file && (
          <>
            {file.manifest.repo && (
              <span className="flex items-center gap-1.5 font-mono">
                <GitBranch size={12} className="text-[var(--color-fg-subtle)]" />
                {file.manifest.repo}
                {file.manifest.commit && (
                  <span className="text-[var(--color-fg-subtle)]">
                    @{file.manifest.commit}
                  </span>
                )}
              </span>
            )}
            <span className="h-3 w-px bg-[var(--color-border)]" />
            <span className="font-mono">
              <span className="text-[var(--color-fg)]">{file.epics.length}</span> epics ·{' '}
              <span className="text-[var(--color-fg)]">{file.features.length}</span> features
            </span>
            <span className="h-3 w-px bg-[var(--color-border)]" />
          </>
        )}
        <button
          onClick={() => setLocale(locale === 'zh-CN' ? 'en' : 'zh-CN')}
          title={t('lang.title')}
          className="inline-flex items-center gap-1 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-2)] px-1.5 py-1 text-[10.5px] text-[var(--color-fg-muted)] transition-colors hover:bg-[var(--color-bg-sunken)] hover:text-[var(--color-fg)]"
        >
          <Globe size={11} />
          {t('lang.switch')}
        </button>
        {liveAvailable && (
          <button
            onClick={onToggleLiveReload}
            title={liveReload ? t('live.onTitle') : t('live.offTitle')}
            className={
              'inline-flex items-center gap-1 rounded-md border px-1.5 py-1 text-[10.5px] transition-colors ' +
              (liveReload
                ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-accent-strong)]'
                : 'border-[var(--color-border)] bg-[var(--color-bg-2)] text-[var(--color-fg-muted)] hover:bg-[var(--color-bg-sunken)] hover:text-[var(--color-fg)]')
            }
          >
            <RefreshCw
              size={11}
              className={liveReload ? 'animate-spin' : ''}
              style={liveReload ? { animationDuration: '3s' } : undefined}
            />
            {liveReload ? t('live.on') : t('live.off')}
            {liveReload && reloadHint === 'updated' && (
              <span className="ml-0.5 text-[var(--color-accent-strong)]">·{t('live.updated')}</span>
            )}
          </button>
        )}

        <ProjectsDropdown
          activeRepoId={activeRepoId}
          projects={projects}
          onSwitchProject={onSwitchProject}
          onAddProject={onAddProject}
          onRemoveProject={onRemoveProject}
        />

        {status === 'ok' && activeProject && activeProject.kind !== 'bundled' && (
          <button
            onClick={onClear}
            title={t('topbar.clearTitle')}
            className="inline-flex h-[26px] w-[26px] items-center justify-center rounded-md border border-[var(--color-border)] bg-[var(--color-bg-2)] text-[var(--color-fg-subtle)] transition-colors hover:bg-[var(--color-bg-sunken)] hover:text-[var(--color-fg)]"
          >
            <RotateCcw size={12} />
          </button>
        )}
      </div>
    </header>
  )
}

/** 项目下拉菜单：当前项目 + 可切换的其他项目 + 添加按钮 */
function ProjectsDropdown({
  activeRepoId,
  projects,
  onSwitchProject,
  onAddProject,
  onRemoveProject,
}: {
  activeRepoId: string | null
  projects: ProjectEntry[]
  onSwitchProject: (repoId: string) => void
  onAddProject: () => void
  onRemoveProject: (repoId: string) => void
}) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // 点外部关闭
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!ref.current) return
      if (!ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open])

  const userProjects = projects.filter((p) => p.kind !== 'bundled')
  const bundledProjects = projects.filter((p) => p.kind === 'bundled')

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title={t('topbar.openTitle')}
        className={cn(
          'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] transition-colors',
          open
            ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-accent-strong)]'
            : 'border-[var(--color-border)] bg-[var(--color-bg-2)] text-[var(--color-fg-muted)] hover:bg-[var(--color-bg-sunken)] hover:text-[var(--color-fg)]',
        )}
      >
        <FolderOpen size={12} />
        {t('topbar.open')}
        <ChevronDown size={11} className={open ? 'rotate-180 transition-transform' : 'transition-transform'} />
      </button>

      {open && (
        <div
          className="absolute right-0 top-[calc(100%+6px)] z-30 w-[300px] overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-1)] shadow-[0_8px_24px_oklch(0_0_0/0.08)]"
        >
          {/* 用户项目 */}
          {userProjects.length > 0 && (
            <div className="px-2 pt-2">
              <div className="mb-1 px-1.5 text-[10px] font-medium uppercase tracking-wide text-[var(--color-fg-subtle)]">
                {t('projects.yours')}
              </div>
              <div className="flex flex-col gap-0.5">
                {userProjects.map((p) => (
                  <ProjectRow
                    key={p.repoId}
                    project={p}
                    active={p.repoId === activeRepoId}
                    onSwitch={() => {
                      setOpen(false)
                      onSwitchProject(p.repoId)
                    }}
                    onRemove={() => {
                      onRemoveProject(p.repoId)
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* 内置项目 */}
          {bundledProjects.length > 0 && (
            <div className="px-2 pt-2">
              <div className="mb-1 px-1.5 text-[10px] font-medium uppercase tracking-wide text-[var(--color-fg-subtle)]">
                {t('projects.bundled')}
              </div>
              <div className="flex flex-col gap-0.5">
                {bundledProjects.map((p) => (
                  <ProjectRow
                    key={p.repoId}
                    project={p}
                    active={p.repoId === activeRepoId}
                    onSwitch={() => {
                      setOpen(false)
                      onSwitchProject(p.repoId)
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* 添加按钮 */}
          <div className="mt-2 border-t border-[var(--color-border)] p-1">
            <button
              onClick={() => {
                setOpen(false)
                onAddProject()
              }}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[12px] text-[var(--color-fg)] transition-colors hover:bg-[var(--color-bg-2)]"
            >
              <FolderPlus size={14} className="text-[var(--color-accent-strong)]" />
              <span className="flex-1">{t('projects.add')}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function ProjectRow({
  project,
  active,
  onSwitch,
  onRemove,
}: {
  project: ProjectEntry
  active: boolean
  onSwitch: () => void
  onRemove?: () => void
}) {
  const { t } = useI18n()
  const Icon = project.kind === 'bundled' ? Sparkle : project.kind === 'fsa' ? FolderOpen : UploadIcon

  return (
    <div
      className={cn(
        'group flex items-center gap-2 rounded-md px-2 py-1.5 cursor-pointer transition-colors',
        active
          ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent-strong)]'
          : 'hover:bg-[var(--color-bg-2)] text-[var(--color-fg)]',
      )}
      onClick={onSwitch}
    >
      <Icon size={13} className={active ? 'text-[var(--color-accent-strong)]' : 'text-[var(--color-fg-subtle)]'} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[12px] font-medium">{project.displayName}</div>
        <div className="flex items-center gap-1.5 text-[10px] text-[var(--color-fg-subtle)]">
          {(project.featuresCount != null && project.epicsCount != null) ? (
            <span className="font-mono">
              {project.epicsCount}e · {project.featuresCount}f
            </span>
          ) : (
            <span className="truncate">{project.sourceLabel}</span>
          )}
          {project.kind !== 'bundled' && project.lastOpenedAt > 0 && (
            <>
              <span>·</span>
              <span>{formatRelative(project.lastOpenedAt)}</span>
            </>
          )}
        </div>
      </div>
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            if (confirm(t('projects.confirmRemove', { name: project.displayName }))) {
              onRemove()
            }
          }}
          title={t('projects.remove')}
          className="opacity-0 group-hover:opacity-100 rounded p-1 text-[var(--color-fg-subtle)] transition-opacity hover:bg-[var(--color-bg-sunken)] hover:text-[var(--color-fg)]"
        >
          <Trash2 size={11} />
        </button>
      )}
    </div>
  )
}

function formatRelative(ts: number): string {
  const diff = Date.now() - ts
  const min = 60 * 1000
  const hour = 60 * min
  const day = 24 * hour
  if (diff < min) return '刚刚'
  if (diff < hour) return `${Math.floor(diff / min)}分钟前`
  if (diff < day) return `${Math.floor(diff / hour)}小时前`
  if (diff < 30 * day) return `${Math.floor(diff / day)}天前`
  return new Date(ts).toLocaleDateString()
}
