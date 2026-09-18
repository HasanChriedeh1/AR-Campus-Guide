import type { Enrollment, Meeting, ScheduleResponse } from '../types'

const scheduleUrl = import.meta.env.VITE_SCHEDULE_API_URL || '/api/schedule'
const days = new Set(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'])
const isEnrollment = (value: unknown): value is Enrollment => {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  return typeof item.course === 'string' && typeof item.section === 'string'
}
const isMeeting = (value: unknown): value is Meeting => {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  return typeof item.course === 'string' && typeof item.section === 'string' && typeof item.title === 'string' && (item.day === null || (typeof item.day === 'string' && days.has(item.day))) && (item.start === null || typeof item.start === 'string') && (item.end === null || typeof item.end === 'string') && (item.room === null || typeof item.room === 'string') && typeof item.status === 'string'
}
function validate(value: unknown): ScheduleResponse {
  if (!value || typeof value !== 'object') throw new Error('The schedule service returned an invalid response.')
  const item = value as Record<string, unknown>
  if (typeof item.semester !== 'string' || typeof item.totalMeetings !== 'number' || !Array.isArray(item.enrolledCourses) || !item.enrolledCourses.every(isEnrollment) || !Array.isArray(item.timetable) || !item.timetable.every(isMeeting) || !Array.isArray(item.missingCourses) || !item.missingCourses.every(isEnrollment)) throw new Error('The schedule service returned an unexpected response shape.')
  return value as ScheduleResponse
}
export async function fetchSchedule(enrolledCourses: Enrollment[]) {
  const response = await fetch(scheduleUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enrolledCourses }) })
  if (!response.ok) throw new Error(`Schedule service error (${response.status}). Please try again.`)
  return validate(await response.json())
}
