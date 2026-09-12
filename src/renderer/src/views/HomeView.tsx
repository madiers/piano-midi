import { useMemo } from 'react'
import { useAppStore } from '../store/appStore'
import {
  CURRICULUM,
  firstIncompleteLesson,
  isLessonUnlocked,
  summariseUnit
} from '../lessons/curriculum'
import { ANCHORS, type Lesson } from '@shared/types'

const KIND_LABEL: Record<Lesson['kind'], string> = {
  concept: 'Learn',
  drill: 'Drill',
  play: 'Play',
  review: 'Review',
  assess: 'Test'
}

const KIND_STYLE: Record<Lesson['kind'], string> = {
  concept: 'bg-ink-700 text-ink-200',
  drill: 'bg-brand-600/25 text-brand-400',
  play: 'bg-good-500/20 text-good-500',
  review: 'bg-ink-700 text-ink-200',
  assess: 'bg-warn-500/20 text-warn-500'
}

export function HomeView({
  onOpenLesson
}: {
  onOpenLesson: (lessonId: string) => void
}): React.JSX.Element {
  const progress = useAppStore((s) => s.progress)
  const resume = useMemo(() => firstIncompleteLesson(progress), [progress])

  const totalLessons = CURRICULUM.reduce((n, u) => n + u.lessons.length, 0)
  const completed = Object.values(progress.lessons).filter((l) => l.completed).length

  return (
    <div className="mx-auto max-w-4xl px-8 py-8">
      <div className="mb-8 rounded-xl border border-ink-700 bg-gradient-to-br from-ink-850 to-ink-800 p-6">
        <p className="text-xs uppercase tracking-wide text-ink-400">Your course</p>
        <h1 className="mt-1 text-2xl font-bold text-ink-100">Learn piano, step by step</h1>
        <p className="mt-2 max-w-xl text-sm text-ink-300">
          Sixteen units from finding Middle C to reading both clefs, built specifically around a
          25-key keyboard — so nothing here asks for a note you do not have.
        </p>

        <div className="mt-5 flex items-center gap-4">
          <button
            onClick={() => onOpenLesson(resume.id)}
            className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-500"
          >
            {completed === 0 ? 'Start Unit 0' : 'Continue'} → {resume.title}
          </button>
          <span className="text-xs text-ink-400">
            {completed} of {totalLessons} lessons complete
          </span>
        </div>

        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-ink-700">
          <div
            className="h-full rounded-full bg-brand-500 transition-all"
            style={{ width: `${(completed / totalLessons) * 100}%` }}
          />
        </div>
      </div>

      <div className="space-y-4 pb-10">
        {CURRICULUM.map((unit) => {
          const summary = summariseUnit(unit, progress)
          return (
            <section
              key={unit.id}
              className={`rounded-xl border p-5 ${
                summary.unlocked
                  ? 'border-ink-700 bg-ink-850'
                  : 'border-ink-800 bg-ink-850/40 opacity-60'
              }`}
            >
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-xs text-ink-500">
                  {String(unit.index).padStart(2, '0')}
                </span>
                <h2 className="text-base font-semibold text-ink-100">{unit.title}</h2>
                {unit.anchor && (
                  <span className="rounded bg-ink-700 px-1.5 py-0.5 text-[10px] text-ink-300">
                    {ANCHORS[unit.anchor].label}
                  </span>
                )}
                <span className="ml-auto text-xs text-ink-400">
                  {summary.completed}/{summary.total}
                  {summary.maxStars > 0 && (
                    <span className="ml-2 text-warn-500">
                      ★ {summary.stars}/{summary.maxStars}
                    </span>
                  )}
                </span>
              </div>

              <p className="mt-1 text-sm text-ink-400">{unit.goal}</p>

              <ul className="mt-4 space-y-1">
                {unit.lessons.map((lesson) => {
                  const record = progress.lessons[lesson.id]
                  const unlocked = isLessonUnlocked(lesson.id, progress)
                  return (
                    <li key={lesson.id}>
                      <button
                        disabled={!unlocked}
                        onClick={() => onOpenLesson(lesson.id)}
                        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm ${
                          unlocked
                            ? 'text-ink-200 hover:bg-ink-800'
                            : 'cursor-not-allowed text-ink-500'
                        }`}
                      >
                        <span
                          className={`w-12 shrink-0 rounded px-1.5 py-0.5 text-center text-[10px] font-semibold ${KIND_STYLE[lesson.kind]}`}
                        >
                          {KIND_LABEL[lesson.kind]}
                        </span>
                        <span className="flex-1 truncate">{lesson.title}</span>

                        {lesson.newConcepts.length > 0 && (
                          <span className="hidden truncate text-[11px] text-ink-500 md:inline">
                            {lesson.newConcepts.slice(0, 2).join(' · ')}
                          </span>
                        )}

                        {record?.completed && lesson.kind === 'concept' && (
                          <span className="text-good-500">✓</span>
                        )}
                        {lesson.kind !== 'concept' && (
                          <span className="w-12 shrink-0 text-right text-xs">
                            {record && record.stars > 0 ? (
                              <span className="text-warn-500">{'★'.repeat(record.stars)}</span>
                            ) : record?.completed ? (
                              <span className="text-good-500">✓</span>
                            ) : (
                              <span className="text-ink-700">☆☆☆</span>
                            )}
                          </span>
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          )
        })}
      </div>
    </div>
  )
}
