import type {
  Course,
  DayName,
  ScheduleMeeting,
  ScheduleData,
  ScheduleWebhookResponse,
  WebhookCourse,
  WebhookDay,
  WebhookMeeting,
} from '../types'

const scheduleUrl = import.meta.env.VITE_SCHEDULE_API_URL || '/api/schedule'
const dayNames: Record<WebhookDay, DayName> = {
  M: 'Monday',
  T: 'Tuesday',
  W: 'Wednesday',
  R: 'Thursday',
  F: 'Friday',
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isWebhookCourse(value: unknown): value is WebhookCourse {
  if (!isObject(value)) return false
  return typeof value.code === 'string'
    && typeof value.name === 'string'
    && typeof value.section === 'number'
    && Number.isFinite(value.section)
    && typeof value.issue === 'string'
    && typeof value.courseId === 'number'
    && Number.isFinite(value.courseId)
}

function isWebhookMeeting(value: unknown): value is WebhookMeeting {
  if (!isObject(value)) return false
  return typeof value.code === 'string'
    && typeof value.name === 'string'
    && typeof value.section === 'number'
    && Number.isFinite(value.section)
    && typeof value.day === 'string'
    && value.day in dayNames
    && typeof value.start === 'number'
    && Number.isFinite(value.start)
    && value.start >= 0
    && value.start < 1440
    && typeof value.end === 'number'
    && Number.isFinite(value.end)
    && value.end > value.start
    && value.end <= 1440
    && typeof value.room === 'string'
    && typeof value.conflict === 'boolean'
}

function validate(value: unknown): ScheduleWebhookResponse {
  if (!isObject(value)
    || !Array.isArray(value.courses)
    || !value.courses.every(isWebhookCourse)
    || !Array.isArray(value.meetings)
    || !value.meetings.every(isWebhookMeeting)) {
    throw new Error('The schedule service returned an unexpected response. Please try again.')
  }
  return value as ScheduleWebhookResponse
}

export function parseCourseName(name: string, section: number) {
  const marker = `-${section}-`
  const markerIndex = name.indexOf(marker)
  if (markerIndex < 0) return { title: name.trim(), instructor: null }

  const details = name.slice(markerIndex + marker.length).trim()
  const lastSeparator = details.lastIndexOf('-')
  if (lastSeparator <= 0 || lastSeparator === details.length - 1) {
    return { title: details || name.trim(), instructor: null }
  }

  return {
    title: details.slice(0, lastSeparator).trim() || name.trim(),
    instructor: details.slice(lastSeparator + 1).trim() || null,
  }
}

function normalizeCourse(course: WebhookCourse): Course {
  const parsed = parseCourseName(course.name, course.section)
  return { ...course, ...parsed, rawName: course.name }
}

function normalizeMeeting(meeting: WebhookMeeting): ScheduleMeeting {
  const parsed = parseCourseName(meeting.name, meeting.section)
  return {
    code: meeting.code,
    ...parsed,
    section: meeting.section,
    day: dayNames[meeting.day],
    dayCode: meeting.day,
    startMinutes: meeting.start,
    endMinutes: meeting.end,
    room: meeting.room,
    conflict: meeting.conflict,
    rawName: meeting.name,
  }
}

export function normalizeSchedule(value: unknown): ScheduleData {
  const response = validate(value)
  return {
    courses: response.courses.map(normalizeCourse),
    meetings: response.meetings.map(normalizeMeeting),
  }
}

export async function fetchSchedule(username: string, password: string) {
  const response = await fetch(scheduleUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ Username: username, Password: password }),
  })
  if (!response.ok) {
    throw new Error(response.status === 401 || response.status === 403
      ? 'The username or password was not accepted.'
      : `The schedule service is unavailable (${response.status}). Please try again.`)
  }
  return normalizeSchedule(await response.json())
}
