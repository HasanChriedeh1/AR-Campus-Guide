export type DayName = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday'
export type WebhookDay = 'M' | 'T' | 'W' | 'R' | 'F'

export type WebhookCourse = {
  code: string
  name: string
  section: number
  issue: string
  courseId: number
}

export type WebhookMeeting = {
  code: string
  name: string
  section: number
  day: WebhookDay
  start: number
  end: number
  room: string
  conflict: boolean
}

export type ScheduleWebhookResponse = {
  courses: WebhookCourse[]
  meetings: WebhookMeeting[]
}

export type Course = {
  code: string
  title: string
  instructor: string | null
  section: number
  issue: string
  courseId: number
  rawName: string
}

export type ScheduleMeeting = {
  code: string
  title: string
  instructor: string | null
  section: number
  day: DayName
  dayCode: WebhookDay
  startMinutes: number
  endMinutes: number
  room: string
  conflict: boolean
  rawName: string
}

export type ScheduleData = {
  courses: Course[]
  meetings: ScheduleMeeting[]
}

export type StudentSession = {
  username: string
  schedule: ScheduleData
  fetchedAt: number
}

// Kept for the isolated, tested camera-navigation host component while the
// authenticated student experience uses ScheduleMeeting above.
export type Enrollment = { course: string; section: string }
export type Meeting = { course: string; section: string; title: string; day: DayName | null; start: string | null; end: string | null; room: string | null; status: string }
export type ScheduleResponse = { semester: string; enrolledCourses: Enrollment[]; totalMeetings: number; timetable: Meeting[]; missingCourses: Enrollment[] }
