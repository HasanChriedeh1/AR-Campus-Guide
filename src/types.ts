export type DayName = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday'

export type Enrollment = { course: string; section: string }
export type Meeting = { course: string; section: string; title: string; day: DayName | null; start: string | null; end: string | null; room: string | null; status: string }
export type ScheduleResponse = { semester: string; enrolledCourses: Enrollment[]; totalMeetings: number; timetable: Meeting[]; missingCourses: Enrollment[] }
