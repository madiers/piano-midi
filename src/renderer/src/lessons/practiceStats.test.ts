import { describe, expect, it } from 'vitest'
import { recordPractice, localDateKey, formatPracticeTime } from './practiceStats'
import { createEmptyProgress } from '@shared/types'

const base = createEmptyProgress().stats

describe('practice streaks', () => {
  it('starts a streak on the first practice', () => {
    const { stats, isNewDay } = recordPractice(base, 60000, 40, '2026-03-01')
    expect(stats.streakDays).toBe(1)
    expect(stats.sessions).toBe(1)
    expect(isNewDay).toBe(true)
    expect(stats.totalPracticeMs).toBe(60000)
  })

  it('extends on consecutive days', () => {
    let s = recordPractice(base, 0, 0, '2026-03-01').stats
    s = recordPractice(s, 0, 0, '2026-03-02').stats
    s = recordPractice(s, 0, 0, '2026-03-03').stats
    expect(s.streakDays).toBe(3)
    expect(s.longestStreakDays).toBe(3)
  })

  it('does not double-count a second session on the same day', () => {
    let s = recordPractice(base, 1000, 10, '2026-03-01').stats
    const again = recordPractice(s, 2000, 5, '2026-03-01')
    expect(again.stats.streakDays).toBe(1)
    expect(again.stats.sessions).toBe(1)
    expect(again.isNewDay).toBe(false)
    // Totals still accumulate.
    expect(again.stats.totalPracticeMs).toBe(3000)
    expect(again.stats.notesPlayed).toBe(15)
  })

  it('forgives one missed day using a freeze', () => {
    let s = recordPractice(base, 0, 0, '2026-03-01').stats
    s = recordPractice(s, 0, 0, '2026-03-02').stats
    expect(s.freezesRemaining).toBe(1)

    // Skips 2026-03-03 entirely.
    const after = recordPractice(s, 0, 0, '2026-03-04')
    expect(after.usedFreeze).toBe(true)
    expect(after.stats.streakDays).toBe(3)
    expect(after.stats.freezesRemaining).toBe(0)
  })

  it('breaks the streak when no freeze is left', () => {
    let s = recordPractice(base, 0, 0, '2026-03-01').stats
    s = recordPractice(s, 0, 0, '2026-03-03').stats // uses the freeze
    expect(s.freezesRemaining).toBe(0)

    const broken = recordPractice(s, 0, 0, '2026-03-05')
    expect(broken.usedFreeze).toBe(false)
    expect(broken.stats.streakDays).toBe(1)
  })

  it('breaks the streak after a long gap, and refills the freeze', () => {
    let s = recordPractice(base, 0, 0, '2026-03-01').stats
    s = recordPractice(s, 0, 0, '2026-03-02').stats
    s = recordPractice(s, 0, 0, '2026-03-20').stats
    expect(s.streakDays).toBe(1)
    expect(s.longestStreakDays).toBe(2)
    expect(s.freezesRemaining).toBe(1)
  })

  it('does not punish a clock that moves backwards', () => {
    // A timezone change or a wrong system clock must not wipe a streak.
    let s = recordPractice(base, 0, 0, '2026-03-05').stats
    s = recordPractice(s, 0, 0, '2026-03-06').stats
    const back = recordPractice(s, 0, 0, '2026-03-04')
    expect(back.stats.streakDays).toBeGreaterThanOrEqual(2)
  })

  it('produces a valid local date key', () => {
    expect(localDateKey(new Date(2026, 0, 5))).toBe('2026-01-05')
    expect(localDateKey(new Date(2026, 11, 31))).toBe('2026-12-31')
  })
})

describe('formatting', () => {
  it('reads naturally', () => {
    expect(formatPracticeTime(120000)).toBe('2 min')
    expect(formatPracticeTime(3600000)).toBe('1 h')
    expect(formatPracticeTime(5400000)).toBe('1 h 30 min')
  })
})
