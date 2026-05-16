import { FolderOpen, GitBranch, Globe, RefreshCw, RotateCcw, Sparkles } from 'lucide-react'
import type { FeaturesFile } from '@/fcg/types'
import { useI18n } from '@/lib/i18n'

interface Props {
  file: FeaturesFile | null
  status: 'pending' | 'ok' | 'missing'
  sourceLabel: string
  onPick: () => void
  onClear: () => void
  liveReload: boolean
  onToggleLiveReload: () => void
  reloadHint: 'idle' | 'updated'
  liveAvailable: boolean
}

export function TopBar({
  file, status, sourceLabel, onPick, onClear,
  liveReload, onToggleLiveReload, reloadHint, liveAvailable,
}: Props) {
  const { t, locale, setLocale } = useI18n()

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
        <button
          onClick={onPick}
          title={t('topbar.openTitle')}
          className="inline-flex items-center gap-1 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-2)] px-2 py-1 text-[11px] text-[var(--color-fg-muted)] transition-colors hover:bg-[var(--color-bg-sunken)] hover:text-[var(--color-fg)]"
        >
          <FolderOpen size={12} />
          {t('topbar.open')}
        </button>
        {status === 'ok' && (
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
