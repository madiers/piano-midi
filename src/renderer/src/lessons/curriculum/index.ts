import type { Lesson, Unit, UserProgress } from '@shared/types'
import { UNIT_0, UNIT_1, UNIT_2, UNIT_3, UNIT_4, UNIT_5, UNIT_6, UNIT_7 } from './unitsEarly'
import {
  UNIT_8,
  UNIT_9,
  UNIT_10,
  UNIT_11,
  UNIT_12,
  UNIT_13,
  UNIT_14,
  UNIT_15
} from './unitsLate'

export const CURRICULUM: Unit[] = [
  UNIT_0,
  UNIT_1,
  UNIT_2,
  UNIT_3,
  UNIT_4,
  UNIT_5,
  UNIT_6,
  UNIT_7,
  UNIT_8,
  UNIT_9,
  UNIT_10,
  UNIT_11,
  UNIT_12,
  UNIT_13,
  UNIT_14,
  UNIT_15
]

export const ALL_LESSONS: Lesson[] = CURRICULUM.flatMap((unit) => unit.lessons)

const LESSON_BY_ID = new Map(ALL_LESSONS.map((lesson) => [lesson.id, lesson]))
const UNIT_BY_ID = new Map(CURRICULUM.map((unit) => [unit.id, unit]))

export function getLesson(id: string): Lesson | undefined {
  return LESSON_BY_ID.get(id)
}

export function getUnit(id: string): Unit | undefined {
  return UNIT_BY_ID.get(id)
}

export function lessonIndex(id: string): number {
  return ALL_LESSONS.findIndex((lesson) => lesson.id === id)
}

export function nextLesson(id: string): Lesson | undefined {
  const index = lessonIndex(id)
  return index >= 0 ? ALL_LESSONS[index + 1] : undefined
}

export function previousLesson(id: string): Lesson | undefined {
  const index = lessonIndex(id)
  return index > 0 ? ALL_LESSONS[index - 1] : undefined
}

/**
 * Whether a lesson is available to start.
 *
 * Gating is deliberately gentle: a lesson unlocks as soon as the one before it
 * is complete, rather than requiring every earlier lesson to be perfect. Hard
 * gating on a solo adult learner mostly produces abandonment, and the star
 * rating already communicates how well something went.
 */
export function isLessonUnlocked(lessonId: string, progress: UserProgress): boolean {
  const index = lessonIndex(lessonId)
  if (index <= 0) return true

  const previous = ALL_LESSONS[index - 1]
  if (!previous) return true

  // Concept lessons have nothing to grade, so reading one is completing it.
  const record = progress.lessons[previous.id]
  return Boolean(record?.completed)
}

/** First lesson that has not been completed — where "Continue" goes. */
export function firstIncompleteLesson(progress: UserProgress): Lesson {
  return ALL_LESSONS.find((lesson) => !progress.lessons[lesson.id]?.completed) ?? ALL_LESSONS[0]!
}

export interface UnitProgressSummary {
  unitId: string
  total: number
  completed: number
  stars: number
  maxStars: number
  unlocked: boolean
}

export function summariseUnit(unit: Unit, progress: UserProgress): UnitProgressSummary {
  const gradeable = unit.lessons.filter((l) => l.kind !== 'concept')
  let completed = 0
  let stars = 0

  for (const lesson of unit.lessons) {
    const record = progress.lessons[lesson.id]
    if (record?.completed) completed += 1
    if (lesson.kind !== 'concept') stars += record?.stars ?? 0
  }

  return {
    unitId: unit.id,
    total: unit.lessons.length,
    completed,
    stars,
    maxStars: gradeable.length * 3,
    unlocked: unit.lessons.length > 0 && isLessonUnlocked(unit.lessons[0]!.id, progress)
  }
}

export { UNIT_0 }
