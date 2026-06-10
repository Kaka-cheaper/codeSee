/**
 * 引导式导览（Tour）—— 把画布从"地图"变成"旅程"。
 *
 * 认知设计（每条都有依据，别轻易删）：
 *   - 逐盏点亮：未到达的节点 hidden（不渲染，不占注意力预算），
 *     已走过的 dimmed（保持空间记忆锚点），当前步全亮。
 *   - 布局算满图、渲染做减法：节点位置自始至终稳定，绝不因点亮顺序漂移。
 *   - gap 先于 reveal：每步先抛问题制造信息缺口（Loewenstein），再揭晓答案。
 *   - quiz 放岔路口：让用户预测，答错记得更牢（hypercorrection effect）。
 *   - 走完解锁全图：马提尼杯结构——全图是毕业证书，不是教科书。
 */
import { useState } from 'react'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/cn'
import { Check, ChevronRight, Compass, X } from 'lucide-react'
import type { TourPlay } from './tourLogic'

/* ------------------------------------------------------------ UI */

/**
 * 顶部居中的导览入口按钮（有 tours 且未在播放时显示）。
 * 实色 accent + 呼吸光晕 + 指南针周期性摆动——画布上唯一会"呼吸"的元素，
 * 存在感由动效给，不靠加大面积破坏版面。
 */
export function TourStartButton({
  title,
  stepCount,
  onStart,
}: {
  title: string
  stepCount: number
  onStart: () => void
}) {
  const { t } = useI18n()
  return (
    <div className="pointer-events-none absolute top-4 left-1/2 z-10 -translate-x-1/2">
      <button
        onClick={onStart}
        title={t('tour.startTitle', { count: stepCount })}
        className="tour-start-btn pointer-events-auto flex items-center gap-2.5 rounded-full px-5 py-2 text-[13px]"
        style={{
          background: 'linear-gradient(135deg, var(--color-accent) 0%, var(--color-accent-strong) 100%)',
          color: 'oklch(0.985 0.008 80)',
          border: '1px solid color-mix(in oklch, var(--color-accent-strong) 70%, transparent)',
        }}
      >
        <Compass size={16} strokeWidth={2.2} className="tour-compass" />
        <span className="font-medium">{title}</span>
        <span
          className="rounded-full px-2 py-0.5 text-[11px] font-medium"
          style={{ background: 'oklch(1 0 0 / 0.18)' }}
        >
          {t('tour.badge', { count: stepCount })}
        </span>
      </button>
    </div>
  )
}

/**
 * 导览播放面板（底部居中）。
 * quiz 的已选状态放在组件内部——父组件用 key={stepIndex} 强制换步时重置。
 */
export function TourPanel({
  play,
  onReveal,
  onNext,
  onExit,
}: {
  play: TourPlay
  onReveal: () => void
  onNext: () => void
  onExit: () => void
}) {
  const { t } = useI18n()
  const step = play.tour.steps[play.stepIndex]
  const total = play.tour.steps.length
  const isLast = play.stepIndex === total - 1
  const quiz = step.quiz
  const [picked, setPicked] = useState<number | null>(null)
  const answered = picked !== null
  const correct = answered && quiz != null && picked === quiz.answer

  return (
    <div className="pointer-events-none absolute bottom-6 left-1/2 z-20 w-full max-w-[560px] -translate-x-1/2 px-4">
      <div className="pointer-events-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-1)] shadow-[0_4px_24px_oklch(0_0_0/0.10)]">
        {/* header */}
        <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-4 py-2">
          <Compass size={13} className="shrink-0 text-[var(--color-accent-strong)]" />
          <span className="min-w-0 flex-1 truncate text-[11.5px] text-[var(--color-fg-muted)]">
            {play.tour.title}
          </span>
          <span className="shrink-0 font-mono text-[11px] text-[var(--color-fg-subtle)]">
            {play.stepIndex + 1}/{total}
          </span>
          <button
            onClick={onExit}
            title={t('tour.exit')}
            className="shrink-0 rounded-md p-1 text-[var(--color-fg-subtle)] transition-colors hover:bg-[var(--color-bg-2)] hover:text-[var(--color-fg)]"
          >
            <X size={13} />
          </button>
        </div>

        {/* body */}
        <div className="px-4 py-3">
          {/* 首步先立目标：让用户知道走完能得到什么 */}
          {play.stepIndex === 0 && play.phase === 'ask' && (
            <p className="mb-2 text-[11px] leading-relaxed text-[var(--color-fg-subtle)]">
              {t('tour.goalLabel')}：{play.tour.goal}
            </p>
          )}

          {/* gap：揭晓后弱化但保留，让问题和答案在视觉上连起来 */}
          <p
            className={cn(
              'leading-relaxed',
              play.phase === 'ask'
                ? 'text-[14.5px] font-medium text-[var(--color-fg)]'
                : 'text-[12.5px] text-[var(--color-fg-subtle)]',
            )}
          >
            {step.gap}
          </p>

          {/* quiz：ask 阶段强制先猜再揭晓 */}
          {quiz && play.phase === 'ask' && (
            <div className="mt-3 flex flex-col gap-1.5">
              {!answered && (
                <p className="text-[11px] text-[var(--color-fg-subtle)]">{t('tour.pickHint')}</p>
              )}
              {quiz.options.map((opt, i) => {
                const isPicked = picked === i
                const isAnswer = i === quiz.answer
                // 答完后：正确项标绿勾，选错的标出来，其余淡出
                const showState = answered
                return (
                  <button
                    key={i}
                    disabled={answered}
                    onClick={() => setPicked(i)}
                    className={cn(
                      'flex items-start gap-2 rounded-lg border px-3 py-2 text-left text-[13px] leading-relaxed transition-colors',
                      !showState && 'border-[var(--color-border)] hover:bg-[var(--color-bg-2)]',
                      showState && isAnswer && 'border-[var(--color-accent)] bg-[var(--color-accent-soft)]',
                      showState && !isAnswer && isPicked && 'border-[var(--color-border)] opacity-70',
                      showState && !isAnswer && !isPicked && 'border-[var(--color-border)] opacity-40',
                    )}
                  >
                    {showState && isAnswer && (
                      <Check size={13} className="mt-0.5 shrink-0 text-[var(--color-accent-strong)]" />
                    )}
                    <span>{opt}</span>
                  </button>
                )
              })}
              {answered && (
                <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--color-fg-muted)]">
                  {correct
                    ? t('tour.correct')
                    : `${t('tour.wrong')}${quiz.wrong_note ?? ''}`}
                </p>
              )}
            </div>
          )}

          {/* reveal：揭晓后的答案叙事 */}
          {play.phase === 'shown' && (
            <p className="mt-2 text-[14.5px] leading-relaxed text-[var(--color-fg)]">
              {step.reveal}
            </p>
          )}

          {/* action */}
          <div className="mt-3 flex justify-end">
            {play.phase === 'ask' ? (
              <PrimaryBtn
                onClick={onReveal}
                disabled={quiz != null && !answered}
              >
                {t('tour.reveal')}
                <ChevronRight size={13} />
              </PrimaryBtn>
            ) : (
              <PrimaryBtn onClick={onNext}>
                {isLast ? t('tour.finish') : t('tour.next')}
                <ChevronRight size={13} />
              </PrimaryBtn>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function PrimaryBtn({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex items-center gap-1 rounded-lg px-3.5 py-1.5 text-[12.5px] font-medium transition-colors',
        disabled ? 'cursor-not-allowed opacity-40' : '',
      )}
      style={{
        background: 'var(--color-accent-soft)',
        color: 'var(--color-accent-strong)',
        border: '1px solid var(--color-accent)',
      }}
    >
      {children}
    </button>
  )
}
