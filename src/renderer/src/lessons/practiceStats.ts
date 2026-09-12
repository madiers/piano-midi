/**
 * Practice streaks and session time.
 *
 * Streaks are the one motivation mechanic worth building early, but they are
 * also the easiest to get wrong: a streak tied to time-on-task rewards leaving
 * the app open, and a streak that breaks on a single missed day punishes
 * exactly the person who is otherwise doing well. So:
 *
 *  - the streak advances on a day where something was actually PRACTISED,
 *    not on a day the app was merely opened
 *  - one missed day per week is forgiven automatically, rather than requiring
 *    the learner to notice and spend something
 */

import type { PracticeStats, UserProgress } from '@shared/types'

/** Local calendar date, which is what "a day" means to a person. */
export function localDateKey(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function daysBetween(fromKey: string, toKey: string): number {
  const [fy, fm, fd] = fromKey.split('-').map(Number)
  const [ty, tm, td] = toKey.split('-').map(Number)
  const from = Date.UTC(fy!, (fm ?? 1) - 1, fd ?? 1)
  const to = Date.UTC(ty!, (tm ?? 1) - 1, td ?? 1)
  return Math.round((to - from) / 86400000)
}

export interface StreakUpdate {
  stats: PracticeStats
  /** True when this is the first practice of a new day. */
  isNewDay: boolean
  /** True when a missed day was forgiven rather than breaking the streak. */
  usedFreeze: boolean
}

/**
 * Fold a completed practice session into the stats.
 *
 * `practisedMs` is time spent inside a graded exercise, not time with the app
 * open — tying rewards to wall-clock presence is how gamification starts
 * displacing the thing it is supposed to encourage.
 */
export function recordPractice(
  stats: PracticeStats,
  practisedMs: number,
  notesPlayed: number,
  today = localDateKey()
): StreakUpdate {
  const next: PracticeStats = {
    ...stats,
    totalPracticeMs: stats.totalPracticeMs + Math.max(0, practisedMs),
    notesPlayed: stats.notesPlayed + Math.max(0, notesPlayed)
  }

  if (stats.lastPracticeDate === today) {
    // Already counted today; only the totals move.
    return { stats: next, isNewDay: false, usedFreeze: false }
  }

  next.sessions = stats.sessions + 1
  next.lastPracticeDate = today

  if (!stats.lastPracticeDate) {
    next.streakDays = 1
    next.longestStreakDays = Math.max(stats.longestStreakDays, 1)
    return { stats: next, isNewDay: true, usedFreeze: false }
  }

  const gap = daysBetween(stats.lastPracticeDate, today)
  let usedFreeze = false

  if (gap === 1) {
    next.streakDays = stats.streakDays + 1
  } else if (gap === 2 && stats.freezesRemaining > 0) {
    // Exactly one day missed, and a freeze is available: bridge it.
    next.streakDays = stats.streakDays + 1
    next.freezesRemaining = stats.freezesRemaining - 1
    usedFreeze = true
  } else if (gap <= 0) {
    // Clock moved backwards (timezone change, or the system clock was wrong).
    // Do not punish, do not reward.
    next.streakDays = Math.max(1, stats.streakDays)
  } else {
    next.streakDays = 1
  }

  // Freezes replenish weekly, so a long streak is not one bad week from zero.
  if (gap >= 7) next.freezesRemaining = 1

  next.longestStreakDays = Math.max(stats.longestStreakDays, next.streakDays)
  return { stats: next, isNewDay: true, usedFreeze }
}

/** Total stars earned, for a headline figure. */
export function totalStars(progress: UserProgress): number {
  return Object.values(progress.lessons).reduce((n, l) => n + l.stars, 0)
}

export function formatPracticeTime(ms: number): string {
  const minutes = Math.round(ms / 60000)
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`
}
