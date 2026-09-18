import type { ScheduleMeeting } from '../types'

export const REMINDER_LEAD_MINUTES = 10

const DELIVERED_KEY = 'rhu-class-reminders-delivered-v1'
const MAX_DELIVERED_REMINDERS = 80

const dayNumbers: Record<ScheduleMeeting['day'], number> = {
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
}

type DeliveredReminders = Record<string, string[]>

export type BrowserNotificationPermission = NotificationPermission | 'unsupported'

export type ClassReminder = {
  id: string
  meeting: ScheduleMeeting
  startsAt: Date
  notifyAt: Date
  minutesUntilStart: number
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) as T : fallback
  } catch {
    return fallback
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Reminders still work for the current tab if persistent storage is unavailable.
  }
}

function occurrenceId(meeting: ScheduleMeeting, startsAt: Date) {
  const date = [
    startsAt.getFullYear(),
    String(startsAt.getMonth() + 1).padStart(2, '0'),
    String(startsAt.getDate()).padStart(2, '0'),
  ].join('-')
  return `${date}:${meeting.code}:${meeting.section}:${meeting.startMinutes}`
}

export function getNextOccurrence(meeting: ScheduleMeeting, now = new Date()) {
  const startsAt = new Date(now)
  const daysAhead = (dayNumbers[meeting.day] - now.getDay() + 7) % 7
  startsAt.setDate(now.getDate() + daysAhead)
  startsAt.setHours(Math.floor(meeting.startMinutes / 60), meeting.startMinutes % 60, 0, 0)

  if (startsAt.getTime() <= now.getTime()) startsAt.setDate(startsAt.getDate() + 7)
  return startsAt
}

export function findDueClassReminder(meetings: ScheduleMeeting[], delivered: Set<string>, now = new Date(), leadMinutes = REMINDER_LEAD_MINUTES): ClassReminder | null {
  const leadMilliseconds = leadMinutes * 60_000
  const due = meetings.flatMap(meeting => {
    const startsAt = getNextOccurrence(meeting, new Date(now.getTime() - leadMilliseconds))
    const notifyAt = new Date(startsAt.getTime() - leadMilliseconds)
    const id = occurrenceId(meeting, startsAt)
    if (delivered.has(id) || now < notifyAt || now >= startsAt) return []
    return [{
      id,
      meeting,
      startsAt,
      notifyAt,
      minutesUntilStart: Math.max(1, Math.ceil((startsAt.getTime() - now.getTime()) / 60_000)),
    }]
  })

  return due.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())[0] ?? null
}

export function readDeliveredReminders(username: string) {
  return new Set(readJson<DeliveredReminders>(DELIVERED_KEY, {})[username] ?? [])
}

export function saveDeliveredReminder(username: string, id: string) {
  const delivered = readJson<DeliveredReminders>(DELIVERED_KEY, {})
  const studentReminders = [...new Set([...(delivered[username] ?? []), id])].slice(-MAX_DELIVERED_REMINDERS)
  writeJson(DELIVERED_KEY, { ...delivered, [username]: studentReminders })
}

export function getBrowserNotificationPermission(): BrowserNotificationPermission {
  return typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
}

export async function requestBrowserNotificationPermission(): Promise<BrowserNotificationPermission> {
  if (typeof Notification === 'undefined') return 'unsupported'
  return Notification.requestPermission()
}

export function showBrowserClassReminder(reminder: ClassReminder) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  const room = reminder.meeting.room ? ` · Room ${reminder.meeting.room}` : ''
  try {
    new Notification(`${reminder.meeting.code} starts in ${reminder.minutesUntilStart} minutes`, {
      body: `${reminder.meeting.title}${room}`,
      icon: '/images/brand/rhu-logo.webp',
      tag: `rhu-class-${reminder.id}`,
    })
  } catch {
    // The in-app reminder remains available if the OS rejects a notification.
  }
}
