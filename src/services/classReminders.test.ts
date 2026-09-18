import { describe, expect, it } from 'vitest'
import { findDueClassReminder, getNextOccurrence, REMINDER_LEAD_MINUTES } from './classReminders'
import type { ScheduleMeeting } from '../types'

const mondayClass: ScheduleMeeting = {
  code: 'BIOM502',
  title: 'AI Applications in Health Care',
  instructor: 'diabmo',
  section: 1,
  day: 'Monday',
  dayCode: 'M',
  startMinutes: 11 * 60,
  endMinutes: 12 * 60,
  room: 'D203',
  conflict: false,
  rawName: 'BIOM502-1-AI Applications in Health Care-diabmo',
}

describe('class reminders', () => {
  it('finds the next weekly occurrence without changing the meeting', () => {
    const occurrence = getNextOccurrence(mondayClass, new Date(2026, 8, 21, 10, 0))
    expect(occurrence).toEqual(new Date(2026, 8, 21, 11, 0))
    expect(REMINDER_LEAD_MINUTES).toBe(10)
  })

  it('returns one reminder during the ten-minute window', () => {
    const reminder = findDueClassReminder([mondayClass], new Set(), new Date(2026, 8, 21, 10, 52))
    expect(reminder).toMatchObject({ minutesUntilStart: 8, meeting: { code: 'BIOM502', room: 'D203' } })
  })

  it('honors a workflow-provided reminder lead time', () => {
    const reminder = findDueClassReminder([mondayClass], new Set(), new Date(2026, 8, 21, 10, 46), 15)
    expect(reminder).toMatchObject({ minutesUntilStart: 14 })
  })

  it('does not alert early, after class starts, or twice for one occurrence', () => {
    expect(findDueClassReminder([mondayClass], new Set(), new Date(2026, 8, 21, 10, 49))).toBeNull()
    expect(findDueClassReminder([mondayClass], new Set(), new Date(2026, 8, 21, 11, 0))).toBeNull()
    const due = findDueClassReminder([mondayClass], new Set(), new Date(2026, 8, 21, 10, 55))
    expect(due).not.toBeNull()
    expect(findDueClassReminder([mondayClass], new Set([due!.id]), new Date(2026, 8, 21, 10, 56))).toBeNull()
  })
})
