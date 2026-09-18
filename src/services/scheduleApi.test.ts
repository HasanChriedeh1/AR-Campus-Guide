import { describe, expect, it } from 'vitest'
import { normalizeSchedule, parseCourseName } from './scheduleApi'

const payload = {
  courses: [{ code: 'BIOM502', name: 'BIOM502-1-AI Applications in Health Care-diabmo', section: 1, issue: '', courseId: 520 }],
  meetings: [
    { code: 'BIOM502', name: 'BIOM502-1-AI Applications in Health Care-diabmo', section: 1, day: 'M', start: 660, end: 735, room: 'D203', conflict: false },
    { code: 'BIOM502', name: 'BIOM502-1-AI Applications in Health Care-diabmo', section: 1, day: 'R', start: 900, end: 975, room: 'D203', conflict: true },
  ],
}

describe('schedule webhook normalization', () => {
  it('parses title and instructor without losing hyphenated title content', () => {
    expect(parseCourseName('BIOM521-1-Introduction to E- Health Care-sabbahmm', 1)).toEqual({
      title: 'Introduction to E- Health Care',
      instructor: 'sabbahmm',
    })
    expect(parseCourseName('Unstructured course name', 2)).toEqual({ title: 'Unstructured course name', instructor: null })
  })

  it('maps webhook day codes, minute times, conflicts, and course metadata', () => {
    const result = normalizeSchedule(payload)
    expect(result.courses[0]).toMatchObject({ code: 'BIOM502', title: 'AI Applications in Health Care', instructor: 'diabmo' })
    expect(result.meetings[0]).toMatchObject({ day: 'Monday', startMinutes: 660, endMinutes: 735, room: 'D203' })
    expect(result.meetings[1]).toMatchObject({ day: 'Thursday', conflict: true })
  })

  it('supports every weekday abbreviation returned by the workflow', () => {
    const dayMeetings = (['M', 'T', 'W', 'R', 'F'] as const).map((day, index) => ({
      code: 'TEST100',
      name: 'TEST100-1-Test Course-instructor',
      section: 1,
      day,
      start: 480 + index * 60,
      end: 540 + index * 60,
      room: 'C101',
      conflict: false,
    }))
    expect(normalizeSchedule({ courses: [], meetings: dayMeetings }).meetings.map(meeting => meeting.day)).toEqual([
      'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday',
    ])
  })

  it('rejects malformed meetings rather than authenticating with bad data', () => {
    expect(() => normalizeSchedule({ courses: [], meetings: [{ day: 'X' }] })).toThrow(/unexpected response/)
  })
})
