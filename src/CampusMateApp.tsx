import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, ArrowUp, Bot, CalendarDays, Camera, Check, ChevronDown, CircleAlert, Compass, CornerDownRight, Edit3, LayoutDashboard, LocateFixed, MapPin, Navigation, Plus, RefreshCw, RotateCcw, Send, Sparkles, Trash2, X } from 'lucide-react'
import type { DayName, Enrollment, Meeting, ScheduleResponse } from './types'
import { bearingBetween, compassHeadingFromOrientation, distanceInMeters, formatDistance, getNavigationGuidance, normalizeDegrees, signedRelativeBearing, smoothHeading, unwrapDegrees } from './navigation'
import type { CampusWalkingRoute, LiveHeading, LivePosition, NavigationDestination } from './navigation'
import './campus-route.css'

const DEMO: Enrollment[] = ['BIOM502','BIOM519','BIOM521','BIOM522','ECE595A','CCEE534','ENGR510'].map((course, index) => ({ course, section: index === 5 ? '2' : '1' }))
const DAYS: DayName[] = ['Monday','Tuesday','Wednesday','Thursday','Friday']
const HOURS = Array.from({ length: 11 }, (_, i) => i + 8)
const COLORS = ['coral','cyan','lime','violet','amber','blue','pink']
const STUDENT_PARKING: NavigationDestination = {
  id: 'student-parking',
  label: 'Student Parking · Point B',
  coordinate: { lat: 33.71314599891659, lng: 35.48279627287705 },
}
const LOCATION_OPTIONS: PositionOptions = { enableHighAccuracy: true, maximumAge: 0, timeout: 15_000 }
const POLLED_LOCATION_OPTIONS: PositionOptions = { enableHighAccuracy: true, maximumAge: 0, timeout: 4_000 }
const GPS_LOCK_ACCURACY_METERS = 50
const COMPASS_STALE_AFTER_MS = 1_500
const COMPASS_RENDER_INTERVAL_MS = 50
const COMPASS_JITTER_DEAD_ZONE_DEGREES = 1.5
const COURSE_STALE_AFTER_MS = 5_000
const LOCATION_POLL_INTERVAL_MS = 1_250
const ALIGNED_THRESHOLD_DEGREES = 15
const NEARBY_DISTANCE_METERS = 10
const ARRIVAL_DISTANCE_METERS = 3
const ARRIVAL_ACCURACY_METERS = 10
const ARRIVAL_FIX_COUNT = 3
const DEMO_SCHEDULE: ScheduleResponse = {
  semester: 'Fall 2026–27',
  enrolledCourses: [{ course: 'BIOM502', section: '1' }],
  totalMeetings: 1,
  timetable: [{ course: 'BIOM502', section: '1', title: 'Biomedical Instrumentation', day: 'Monday', start: '09:00', end: '10:30', room: 'Student Parking · Point B', status: 'scheduled' }],
  missingCourses: [],
}
type View = 'dashboard' | 'schedule' | 'edit' | 'guide' | 'assistant'
const nav = [{ id: 'dashboard' as View, label: 'Overview', icon: LayoutDashboard }, { id: 'schedule' as View, label: 'My schedule', icon: CalendarDays }, { id: 'edit' as View, label: 'Edit schedule', icon: Edit3 }, { id: 'guide' as View, label: 'Campus Guide', icon: Compass }, { id: 'assistant' as View, label: 'AI assistant', icon: Bot }]
const today = (): DayName => { const day = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date()); return DAYS.includes(day as DayName) ? day as DayName : 'Monday' }
const minutes = (time: string | null) => time ? time.split(':').map(Number).reduce((h, m) => h * 60 + m) : null
const timeLabel = (time: string | null) => { if (!time) return 'TBD'; const [h, m] = time.split(':').map(Number); return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}` }
const color = (course: string) => COLORS[course.split('').reduce((sum, c) => sum + c.charCodeAt(0), 0) % COLORS.length]

export default function CampusMateApp() {
  const [view, setView] = useState<View>('dashboard')
  const [courses, setCourses] = useState<Enrollment>(() => ({ course: '', section: '' }))
  const [enrollments, setEnrollments] = useState<Enrollment[]>(() => { const saved = localStorage.getItem('campusmate-enrollments'); return saved ? JSON.parse(saved) : DEMO })
  const [original] = useState(DEMO)
  const [data] = useState<ScheduleResponse>(DEMO_SCHEDULE)
  const [loading] = useState(false)
  const [error] = useState('')
  const [day, setDay] = useState<DayName>(today())
  const [selected, setSelected] = useState<Meeting | null>(null)
  const [destination] = useState(STUDENT_PARKING)
  const [camera, setCamera] = useState(false)
  useEffect(() => { localStorage.setItem('campusmate-enrollments', JSON.stringify(enrollments)) }, [enrollments])
  const meetings = useMemo(() => data?.timetable ?? [], [data])
  const next = useMemo(() => { const now = new Date(); const todayIndex = now.getDay() === 0 ? 0 : now.getDay() - 1; const nowMin = now.getHours() * 60 + now.getMinutes(); const sorted = meetings.filter(m => m.day && m.start).sort((a, b) => ((DAYS.indexOf(a.day as DayName) - todayIndex + 5) % 5) * 1440 + (minutes(a.start) ?? 0) - (((DAYS.indexOf(b.day as DayName) - todayIndex + 5) % 5) * 1440 + (minutes(b.start) ?? 0))); return sorted.find(m => { const distance = (DAYS.indexOf(m.day as DayName) - todayIndex + 5) % 5; return distance > 0 || (distance === 0 && (minutes(m.start) ?? 0) >= nowMin) }) ?? sorted[0] ?? null }, [meetings])
  const status = <Status loading={loading} error={error} retry={() => undefined} />
  const edit = (items: Enrollment[]) => setEnrollments(items.filter(item => item.course.trim()))
  const content = view === 'dashboard' ? <Dashboard meetings={meetings.filter(m => m.day === today())} next={next} loading={loading} error={error} retry={() => undefined} go={setView} /> : view === 'schedule' ? <Schedule meetings={meetings} day={day} setDay={setDay} select={setSelected} status={status} /> : view === 'edit' ? <Editor items={enrollments} original={original} onChange={edit} add={courses} setAdd={setCourses} save={() => undefined} restore={() => edit(original)} status={status} /> : view === 'guide' ? <Guide destination={destination} camera={camera} setCamera={setCamera} /> : <Assistant />
  return <div className="app-shell"><aside className="sidebar"><Brand /><div className="workspace-label">RHU / Fall 2026–27</div><nav>{nav.map(({ id, label, icon: Icon }) => <button className={`nav-item ${view === id ? 'active' : ''}`} key={id} onClick={() => setView(id)}><Icon size={18} />{label}{id === 'assistant' && <i className="soon-dot" />}</button>)}</nav><div className="sidebar-bottom"><div className="profile"><span className="avatar">SA</span><span><b>Student account</b><small>Demo profile</small></span><ChevronDown size={14} /></div><div className="api-status"><i className="status-dot" />Demo schedule</div></div></aside><main><header className="topbar"><Brand compact /><div className="breadcrumbs"><span>Rafik Hariri University</span><CornerDownRight size={14} /><b>{nav.find(item => item.id === view)?.label}</b></div><span className="avatar mobile-avatar">SA</span></header><div className="page-wrap">{content}</div></main><nav className="mobile-nav">{nav.slice(0, 4).map(({ id, icon: Icon }) => <button className={view === id ? 'active' : ''} key={id} onClick={() => setView(id)}><Icon size={18} /><span>{id === 'schedule' ? 'Schedule' : id === 'edit' ? 'Edit' : id === 'guide' ? 'Campus Guide' : 'Overview'}</span></button>)}</nav>{selected && <Modal meeting={selected} close={() => setSelected(null)} />}</div>
}

function Brand({ compact = false }: { compact?: boolean }) { return <div className={compact ? 'brand compact-brand' : 'brand'}><span className="brand-mark"><Sparkles size={16} /></span>Campus<span className="accent">Mate</span></div> }
function Status({ loading, error, retry }: { loading: boolean; error: string; retry: () => void }) { if (loading) return <div className="inline-status"><RefreshCw size={15} className="spin" />Syncing with RHU schedule service...</div>; if (error) return <div className="error-banner"><CircleAlert size={17} /><span>{error}<small>Live data is unavailable; no placeholder classes were added.</small></span><button onClick={retry}>Retry</button></div>; return null }
function Heading({ eyebrow, title, description, action }: { eyebrow: string; title: React.ReactNode; description: string; action?: React.ReactNode }) { return <div className="view-heading"><div><div className="eyebrow"><i />{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{action}</div> }
function Dashboard({ meetings, next, loading, error, retry, go }: { meetings: Meeting[]; next: Meeting | null; loading: boolean; error: string; retry: () => void; go: (view: View) => void }) { return <div className="view"><div className="eyebrow"><i />Saturday, September 19, 2026</div><div className="hero-heading"><div><h1>Good morning, <em>student.</em></h1><p>Here is your campus rhythm for today.</p></div><button className="primary" onClick={() => go('guide')}><Navigation size={16} />Guide me <ArrowRight size={15} /></button></div><Status loading={loading} error={error} retry={retry} /><div className="dashboard-grid"><section className="panel next-card"><div className="section-label"><i className="live" />UP NEXT</div>{next ? <><div className="next-time">{timeLabel(next.start)} <small>{next.day}</small></div><h2>{next.course} <span>· Section {next.section}</span></h2><p className="muted">{next.title}</p><div className="meta"><span><MapPin size={14} />{next.room || 'Room TBD'}</span><span><CalendarDays size={14} />{next.day}</span></div><button className="text-button" onClick={() => go('guide')}>Find this room <ArrowRight size={14} /></button></> : <Empty title="Your next class will appear here" text="Connect to the live schedule to see what is coming up." />}</section><section className="panel today-card"><div className="panel-heading"><div><div className="section-label">TODAY / {today().toUpperCase()}</div><h2>{meetings.length} <span>classes scheduled</span></h2></div><button className="round-button" onClick={() => go('schedule')}><ArrowRight size={17} /></button></div>{meetings.length ? <div className="mini-list">{meetings.slice(0, 4).map(m => <button className="mini-class" key={`${m.course}-${m.start}`} onClick={() => go('schedule')}><i className={`course-dot ${color(m.course)}`} /><time>{timeLabel(m.start)}</time><span><b>{m.course}</b><small>{m.title}</small></span><em>{m.room || 'TBD'}</em></button>)}</div> : <Empty title="Nothing on the calendar" text="A clear day. Use the guide to explore campus." />}</section></div><div className="lower-grid"><section className="focus-panel"><div className="orbit one" /><div className="orbit two" /><div className="focus-copy"><div className="section-label">YOUR CAMPUS COMPANION</div><h2>Make the most of<br /><em>your first week.</em></h2><p>Plan your route, find your rhythm, and keep every detail close.</p><button className="text-button" onClick={() => go('assistant')}>Open AI assistant <ArrowRight size={14} /></button></div><Sparkles className="focus-spark" size={82} /></section><section className="panel quick-panel"><div className="section-label">QUICK ACCESS</div><button onClick={() => go('schedule')}><CalendarDays size={17} /><span><b>Weekly timetable</b><small>See your full week</small></span><ArrowRight size={15} /></button><button onClick={() => go('edit')}><Edit3 size={17} /><span><b>Plan your courses</b><small>7 courses in your plan</small></span><ArrowRight size={15} /></button></section></div></div> }
function Schedule({ meetings, day, setDay, select, status }: { meetings: Meeting[]; day: DayName; setDay: (day: DayName) => void; select: (meeting: Meeting) => void; status: React.ReactNode }) { return <div className="view"><Heading eyebrow="Semester view" title={<>My <em>schedule.</em></>} description="Everything in one considered rhythm." action={<button className="outline" onClick={() => location.reload()}><RefreshCw size={15} />Refresh</button>} />{status}<div className="schedule-toolbar"><div className="day-selector">{DAYS.map(d => <button className={day === d ? 'active' : ''} key={d} onClick={() => setDay(d)}>{d.slice(0,3)}<span>{d}</span></button>)}</div><div className="legend"><span><i className="scheduled" />Scheduled</span><span><i className="unscheduled" />Unscheduled</span></div></div><div className="timetable"> <div className="time-head" />{DAYS.map(d => <div className={`day-head ${today() === d ? 'is-today' : ''}`} key={d}>{d}<small>{meetings.filter(m => m.day === d).length} classes</small></div>)}{HOURS.map(hour => <div className="time-row" key={hour}><span>{timeLabel(`${String(hour).padStart(2,'0')}:00`)}</span>{DAYS.map(d => <i key={d} />)}</div>)}{meetings.filter(m => m.day && m.start && m.end).map(m => <ScheduleBlock meeting={m} select={select} key={`${m.course}-${m.day}-${m.start}`} />)}</div><div className="mobile-schedule"><h3>{day}<small>{meetings.filter(m => m.day === day).length} classes</small></h3>{meetings.filter(m => m.day === day).map(m => <button key={`${m.course}-${m.start}`} onClick={() => select(m)}><i className={`course-dot ${color(m.course)}`} /><span><b>{m.course} · {m.title}</b><small>{timeLabel(m.start)} – {timeLabel(m.end)} · {m.room || 'Room TBD'}</small></span><ArrowRight size={15} /></button>)}{meetings.filter(m => m.day === day).length === 0 && <Empty title="No classes this day" text="Your schedule has no scheduled meetings here." />}</div></div> }
function ScheduleBlock({ meeting, select }: { meeting: Meeting; select: (meeting: Meeting) => void }) { const start = minutes(meeting.start) ?? 480; const end = minutes(meeting.end) ?? start + 60; const left = 70 + DAYS.indexOf(meeting.day as DayName) * 18.6; return <button className={`schedule-block ${color(meeting.course)}`} style={{ left: `${left}%`, top: `${47 + ((start - 480) / 60) * 60}px`, height: `${Math.max(55, ((end - start) / 60) * 60)}px` }} onClick={() => select(meeting)}><b>{meeting.course}</b><span>Sec. {meeting.section} · {meeting.room || 'TBD'}</span><small>{timeLabel(meeting.start)} – {timeLabel(meeting.end)}</small></button> }
function Editor({ items, original, onChange, add, setAdd, save, restore, status }: { items: Enrollment[]; original: Enrollment[]; onChange: (items: Enrollment[]) => void; add: Enrollment; setAdd: (item: Enrollment) => void; save: () => void; restore: () => void; status: React.ReactNode }) { return <div className="view"><Heading eyebrow="Personal planning tool" title={<>Shape your <em>week.</em></>} description="Adjust your plan without touching official registration." action={<button className="outline" onClick={restore}><RotateCcw size={15} />Restore original</button>} />{status}<div className="edit-layout"><section className="panel edit-list"><div className="panel-heading"><div><div className="section-label">PLANNING COURSES</div><h2>{items.length} <span>courses selected</span></h2></div><b className="badge">DEMO PROFILE</b></div>{items.map((item, index) => <div className="edit-row" key={`${item.course}-${index}`}><i className={`course-index ${color(item.course)}`}>{String(index + 1).padStart(2,'0')}</i><span><b>{item.course}</b><small>Demo enrollment</small></span><label>Section<input value={item.section} onChange={e => onChange(items.map((row, i) => i === index ? { ...row, section: e.target.value } : row))} /></label><button className="remove" onClick={() => onChange(items.filter((_, i) => i !== index))}><Trash2 size={15} /></button></div>)}<div className="add-row"><Plus size={16} /><input placeholder="Course code" value={add.course} onChange={e => setAdd({ ...add, course: e.target.value.toUpperCase() })} /><input className="section-input" placeholder="Sec." value={add.section} onChange={e => setAdd({ ...add, section: e.target.value })} /><button className="small-primary" onClick={() => { if (add.course.trim()) { onChange([...items, { course: add.course.trim(), section: add.section || '1' }]); setAdd({ course: '', section: '' }) } }}>Add</button></div><div className="edit-actions"><button className="primary" onClick={save}><RefreshCw size={15} />Generate updated timetable</button><span>Changes are saved locally for this demo.</span></div></section><aside className="edit-note"><CircleAlert size={18} /><h3>A planning layer, not registration.</h3><p>CampusMate sends course codes and sections to the existing schedule service to preview a personal timetable. It never changes official RHU enrollment.</p><hr /><strong>{original.length}</strong><small>original courses</small></aside></div></div> }
type LocationState = 'idle' | 'acquiring' | 'live' | 'weak' | 'denied' | 'unavailable' | 'error'
type CompassState = 'idle' | 'acquiring' | 'active' | 'denied' | 'unavailable'
type DeviceOrientationConstructor = typeof DeviceOrientationEvent & {
  requestPermission?: (absolute?: boolean) => Promise<'granted' | 'denied'>
}

export function Guide({ destination: defaultDestination, camera, setCamera }: { destination: NavigationDestination; camera: boolean; setCamera: (value: boolean) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const watchIdRef = useRef<number | null>(null)
  const locationPollRef = useRef<number | null>(null)
  const locationPollPendingRef = useRef(false)
  const latestPositionRef = useRef<LivePosition | null>(null)
  const orientationListenerRef = useRef<((event: DeviceOrientationEvent) => void) | null>(null)
  const compassTimeoutRef = useRef<number | null>(null)
  const headingRef = useRef<LiveHeading | null>(null)
  const latestCourseHeadingRef = useRef<LiveHeading | null>(null)
  const lastCompassSampleAtRef = useRef(0)
  const displayRotationRef = useRef<number | null>(null)
  const arrowIconRef = useRef<SVGSVGElement>(null)
  const arrivalFixesRef = useRef(0)
  const navigationSessionRef = useRef(0)
  const [position, setPosition] = useState<LivePosition | null>(null)
  const [locationState, setLocationState] = useState<LocationState>('idle')
  const [locationError, setLocationError] = useState('')
  const [compassState, setCompassState] = useState<CompassState>('idle')
  const [heading, setHeading] = useState<LiveHeading | null>(null)
  const [arrivalFixes, setArrivalFixes] = useState(0)
  const [cameraError, setCameraError] = useState('')
  const [cameraAttempt, setCameraAttempt] = useState(0)
  const destination = defaultDestination
  const route: CampusWalkingRoute | null = null
  const guidance = useMemo(() => position ? getNavigationGuidance(position, destination, route) : null, [destination, position, route])

  const clearCompassTimeout = useCallback(() => {
    if (compassTimeoutRef.current !== null) {
      window.clearTimeout(compassTimeoutRef.current)
      compassTimeoutRef.current = null
    }
  }, [])

  const stopLocationTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    if (locationPollRef.current !== null) {
      window.clearInterval(locationPollRef.current)
      locationPollRef.current = null
    }
    locationPollPendingRef.current = false
  }, [])

  const stopCompassTracking = useCallback(() => {
    clearCompassTimeout()
    if (orientationListenerRef.current) {
      window.removeEventListener('deviceorientationabsolute', orientationListenerRef.current)
      window.removeEventListener('deviceorientation', orientationListenerRef.current)
      orientationListenerRef.current = null
    }
  }, [clearCompassTimeout])

  const stopSensors = useCallback(() => {
    stopLocationTracking()
    stopCompassTracking()
  }, [stopCompassTracking, stopLocationTracking])

  const saveHeading = useCallback((degrees: number, source: LiveHeading['source']) => {
    const current = headingRef.current
    const updatedAt = Date.now()
    const normalized = normalizeDegrees(degrees)
    if (source === 'compass') lastCompassSampleAtRef.current = updatedAt

    if (source === 'compass' && current?.source === 'compass') {
      const change = signedRelativeBearing(normalized, current.degrees)
      const changeMagnitude = Math.abs(change)
      const tooSoonForAnotherSmallUpdate = updatedAt - current.updatedAt < COMPASS_RENDER_INTERVAL_MS
        && changeMagnitude < 12

      // iPhone compass events contain small, high-frequency fluctuations even
      // when the phone is held still. Do not send that noise to the arrow.
      if (changeMagnitude < COMPASS_JITTER_DEAD_ZONE_DEGREES || tooSoonForAnotherSmallUpdate) return
    }

    const sourcePrevious = source === 'course'
      ? latestCourseHeadingRef.current?.degrees ?? null
      : current?.source === 'compass' ? current.degrees : null
    const changeMagnitude = sourcePrevious === null ? Number.POSITIVE_INFINITY : Math.abs(signedRelativeBearing(normalized, sourcePrevious))
    const smoothingAmount = source === 'course'
      ? 0.25
      : changeMagnitude < 8 ? 0.14 : changeMagnitude < 35 ? 0.25 : 0.45
    const next = { degrees: smoothHeading(sourcePrevious, normalized, smoothingAmount), source, updatedAt }

    if (source === 'course') latestCourseHeadingRef.current = next
    // A compass reading should win while it is arriving, but a stale reading
    // must not freeze the arrow when GPS has a fresh travel direction.
    if (source === 'course' && current?.source === 'compass' && updatedAt - lastCompassSampleAtRef.current < COMPASS_STALE_AFTER_MS) return
    headingRef.current = next
    setHeading(next)
  }, [])

  const armCompassFreshnessWatchdog = useCallback(() => {
    clearCompassTimeout()
    compassTimeoutRef.current = window.setTimeout(() => {
      lastCompassSampleAtRef.current = 0
      const course = latestCourseHeadingRef.current
      if (course && Date.now() - course.updatedAt <= COURSE_STALE_AFTER_MS) {
        headingRef.current = course
        setHeading(course)
      } else if (headingRef.current?.source === 'compass') {
        headingRef.current = null
        setHeading(null)
      }
      setCompassState('unavailable')
    }, COMPASS_STALE_AFTER_MS)
  }, [clearCompassTimeout])

  const savePosition = useCallback((coords: GeolocationCoordinates, timestamp: number) => {
    const course = typeof coords.heading === 'number' && Number.isFinite(coords.heading) && coords.heading >= 0 ? normalizeDegrees(coords.heading) : null
    const previousPosition = latestPositionRef.current
    const nextPosition: LivePosition = {
      lat: coords.latitude,
      lng: coords.longitude,
      accuracy: coords.accuracy,
      timestamp,
      course,
    }
    latestPositionRef.current = nextPosition
    setPosition(nextPosition)
    setLocationError('')
    setLocationState(nextPosition.accuracy <= GPS_LOCK_ACCURACY_METERS ? 'live' : 'weak')
    const arrivalReading = nextPosition.accuracy <= ARRIVAL_ACCURACY_METERS
      && distanceInMeters(nextPosition, destination.coordinate) <= ARRIVAL_DISTANCE_METERS
    arrivalFixesRef.current = arrivalReading ? Math.min(ARRIVAL_FIX_COUNT, arrivalFixesRef.current + 1) : 0
    setArrivalFixes(arrivalFixesRef.current)
    const speed = typeof coords.speed === 'number' && Number.isFinite(coords.speed) ? coords.speed : null
    if (course !== null && (speed === null || speed > 0.25)) {
      saveHeading(course, 'course')
      return
    }
    if (previousPosition) {
      const movement = distanceInMeters(previousPosition, nextPosition)
      const movementThreshold = Math.max(2, Math.min(8, Math.max(previousPosition.accuracy, nextPosition.accuracy) * 0.25))
      if (movement >= movementThreshold) saveHeading(bearingBetween(previousPosition, nextPosition), 'course')
    }
  }, [destination.coordinate, saveHeading])

  const reportLocationError = useCallback((error: GeolocationPositionError) => {
    if (error.code === error.PERMISSION_DENIED) {
      latestPositionRef.current = null
      arrivalFixesRef.current = 0
      setPosition(null)
      setArrivalFixes(0)
      setLocationState('denied')
      setLocationError('Location access was denied. Allow precise location and start navigation again.')
      return
    }
    // Keep the last good fix during a temporary GPS interruption. The active
    // watch and polling loop will continue trying in the background.
    if (latestPositionRef.current) {
      setLocationState('weak')
      setLocationError('GPS update delayed. Keeping your last fix while reconnecting.')
      return
    }
    setPosition(null)
    if (error.code === error.POSITION_UNAVAILABLE) {
      setLocationState('unavailable')
      setLocationError('Your location is unavailable. Move outdoors or check that location services are on.')
      return
    }
    setLocationState('error')
    setLocationError('Location took too long to acquire. Check your signal and try again.')
  }, [])

  const startLocationTracking = useCallback((session: number) => {
    stopLocationTracking()
    if (!window.isSecureContext) {
      setLocationState('unavailable')
      setLocationError('Live location requires HTTPS (or localhost). Open this route from a secure address.')
      return
    }
    if (!navigator.geolocation) {
      setLocationState('unavailable')
      setLocationError('This browser does not support live location.')
      return
    }
    setLocationState('acquiring')
    watchIdRef.current = navigator.geolocation.watchPosition(
      ({ coords, timestamp }) => { if (navigationSessionRef.current === session) savePosition(coords, timestamp) },
      error => { if (navigationSessionRef.current === session) reportLocationError(error) },
      LOCATION_OPTIONS,
    )
    const pollFreshPosition = () => {
      if (navigationSessionRef.current !== session || locationPollPendingRef.current) return
      locationPollPendingRef.current = true
      navigator.geolocation.getCurrentPosition(
        ({ coords, timestamp }) => {
          locationPollPendingRef.current = false
          if (navigationSessionRef.current === session) savePosition(coords, timestamp)
        },
        error => {
          locationPollPendingRef.current = false
          if (navigationSessionRef.current === session) reportLocationError(error)
        },
        POLLED_LOCATION_OPTIONS,
      )
    }
    locationPollRef.current = window.setInterval(pollFreshPosition, LOCATION_POLL_INTERVAL_MS)
  }, [reportLocationError, savePosition, stopLocationTracking])

  const requestSingleLocation = useCallback(() => {
    if (!window.isSecureContext) {
      setLocationState('unavailable')
      setLocationError('Live location requires HTTPS (or localhost). Open this route from a secure address.')
      return
    }
    if (!navigator.geolocation) {
      setLocationState('unavailable')
      setLocationError('This browser does not support live location.')
      return
    }
    setLocationState('acquiring')
    setLocationError('')
    navigator.geolocation.getCurrentPosition(
      ({ coords, timestamp }) => savePosition(coords, timestamp),
      reportLocationError,
      LOCATION_OPTIONS,
    )
  }, [reportLocationError, savePosition])

  const requestCompass = useCallback(async (session: number) => {
    stopCompassTracking()
    lastCompassSampleAtRef.current = 0
    if (!window.isSecureContext) {
      setCompassState('unavailable')
      return
    }
    const OrientationEvent = window.DeviceOrientationEvent as DeviceOrientationConstructor | undefined
    if (!OrientationEvent) {
      setCompassState('unavailable')
      return
    }
    if (typeof OrientationEvent.requestPermission === 'function') {
      try {
        const permission = await OrientationEvent.requestPermission(true)
        if (navigationSessionRef.current !== session) return
        if (permission !== 'granted') {
          setCompassState('denied')
          return
        }
      } catch {
        if (navigationSessionRef.current !== session) return
        setCompassState('denied')
        return
      }
    }

    const listener = (event: DeviceOrientationEvent) => {
      if (navigationSessionRef.current !== session) return
      const nextHeading = headingFromEvent(event)
      if (nextHeading === null) return
      saveHeading(nextHeading, 'compass')
      setCompassState('active')
      armCompassFreshnessWatchdog()
    }
    orientationListenerRef.current = listener
    window.addEventListener('deviceorientationabsolute', listener)
    window.addEventListener('deviceorientation', listener)
    if (navigationSessionRef.current !== session) {
      stopCompassTracking()
      return
    }
    setCompassState('acquiring')
    compassTimeoutRef.current = window.setTimeout(() => {
      if (headingRef.current?.source !== 'compass') setCompassState('unavailable')
    }, 8_000)
  }, [armCompassFreshnessWatchdog, saveHeading, stopCompassTracking])

  const startNavigation = () => {
    stopSensors()
    const session = navigationSessionRef.current + 1
    navigationSessionRef.current = session
    headingRef.current = null
    latestCourseHeadingRef.current = null
    lastCompassSampleAtRef.current = 0
    latestPositionRef.current = null
    displayRotationRef.current = null
    arrivalFixesRef.current = 0
    setHeading(null)
    setPosition(null)
    setArrivalFixes(0)
    setLocationError('')
    setCameraError(!window.isSecureContext ? 'Camera access requires HTTPS (or localhost).' : !navigator.mediaDevices?.getUserMedia ? 'This browser does not support camera access.' : '')
    setCompassState('acquiring')
    setCamera(true)
    startLocationTracking(session)
    void requestCompass(session)
  }

  const exitNavigation = () => {
    navigationSessionRef.current += 1
    stopSensors()
    setCamera(false)
  }

  useEffect(() => () => {
    navigationSessionRef.current += 1
    stopSensors()
  }, [stopSensors])

  useEffect(() => {
    if (!camera) return
    let stream: MediaStream | null = null
    let cancelled = false
    const getUserMedia = navigator.mediaDevices?.getUserMedia
    if (!window.isSecureContext || !getUserMedia) return
    const video = videoRef.current
    void getUserMedia.call(navigator.mediaDevices, { video: { facingMode: { ideal: 'environment' } }, audio: false }).then(nextStream => {
      if (cancelled) {
        nextStream.getTracks().forEach(track => track.stop())
        return
      }
      stream = nextStream
      setCameraError('')
      if (video) {
        video.srcObject = nextStream
        void video.play().catch(() => undefined)
      }
    }).catch(error => {
      const name = error instanceof DOMException ? error.name : ''
      setCameraError(name === 'NotAllowedError' ? 'Camera permission was denied. Live route data will continue without the preview.' : 'Camera access is unavailable. Live route data will continue without the preview.')
    })
    return () => {
      cancelled = true
      stream?.getTracks().forEach(track => track.stop())
      if (video) video.srcObject = null
    }
  }, [camera, cameraAttempt])

  const turn = guidance && heading ? signedRelativeBearing(guidance.bearing, heading.degrees) : null
  useLayoutEffect(() => {
    if (turn === null) {
      displayRotationRef.current = null
      return
    }
    const nextRotation = unwrapDegrees(displayRotationRef.current, turn)
    displayRotationRef.current = nextRotation
    if (arrowIconRef.current) arrowIconRef.current.style.transform = `rotate(${nextRotation}deg)`
  }, [turn])

  const arrived = arrivalFixes >= ARRIVAL_FIX_COUNT
  const nearby = !arrived && (guidance?.distanceMeters ?? Number.POSITIVE_INFINITY) <= NEARBY_DISTANCE_METERS
  const aligned = turn !== null && Math.abs(turn) <= ALIGNED_THRESHOLD_DEGREES
  const precisionState = arrived ? 'arrived' : aligned ? 'aligned' : turn !== null ? 'active' : 'searching'
  const locationLabel = locationState === 'live' ? 'GPS LOCKED' : locationState === 'weak' ? `GPS ±${Math.round(position?.accuracy ?? 0)} M` : locationState === 'acquiring' ? 'ACQUIRING GPS' : locationState === 'denied' ? 'LOCATION DENIED' : locationState === 'unavailable' ? 'GPS UNAVAILABLE' : locationState === 'error' ? 'GPS RETRY NEEDED' : 'GPS IDLE'
  const compassLabel = heading?.source === 'compass' ? 'phone compass' : heading?.source === 'course' ? 'walking direction' : compassState === 'denied' ? 'compass denied' : compassState === 'unavailable' ? 'compass unavailable' : 'calibrating compass'
  const serviceErrors = [locationError, cameraError].filter(Boolean).join(' ')
  const precisionMessage = serviceErrors || (arrived
    ? `You have reached ${destination.label}.`
    : !guidance
      ? 'Getting a fresh GPS position. Keep precise location enabled.'
      : !heading
        ? compassState === 'denied'
          ? 'Compass access was denied. Allow Motion & Orientation access, then try again.'
          : compassState === 'unavailable'
            ? 'Direction is unavailable. Start walking to use your travel direction, or retry the compass.'
            : 'Calibrating direction. Hold the phone upright and move it in a figure eight.'
        : aligned
          ? `Continue toward ${destination.label}.`
          : `${guidance.instruction}. Follow the arrow as you walk.`)
  const turnLabel = turn === null
    ? 'Calibrating direction'
    : Math.abs(turn) <= ALIGNED_THRESHOLD_DEGREES
      ? 'Straight ahead'
      : `Turn ${Math.round(Math.abs(turn))}° ${turn < 0 ? 'left' : 'right'}`
  const needsRetry = locationState === 'denied' || locationState === 'unavailable' || locationState === 'error'
    || compassState === 'denied' || compassState === 'unavailable' || Boolean(cameraError)

  const retryServices = () => {
    const session = navigationSessionRef.current
    setLocationError('')
    setCompassState('acquiring')
    setCameraError(!window.isSecureContext ? 'Camera access requires HTTPS (or localhost).' : !navigator.mediaDevices?.getUserMedia ? 'This browser does not support camera access.' : '')
    startLocationTracking(session)
    void requestCompass(session)
    setCameraAttempt(attempt => attempt + 1)
  }

  if (camera) {
    return (
      <div className={`camera-route apple-navigation is-${precisionState} ${cameraError ? 'camera-unavailable' : ''}`}>
        <video ref={videoRef} autoPlay playsInline muted />
        <div className="camera-tint" />
        <header className="precision-header">
          <div className="precision-destination"><small>Finding</small><b>{destination.label}</b></div>
          <button className="precision-close" aria-label="Exit navigation" onClick={exitNavigation}><X size={20} /></button>
        </header>
        <main className="precision-stage" aria-live="polite">
          {arrived ? (
            <div className="precision-arrival" aria-label="Destination reached"><Check size={82} strokeWidth={2.5} /></div>
          ) : turn !== null ? (
            <div className="precision-arrow" aria-label={turnLabel}>
              <span className="precision-arrow-halo" />
              <ArrowUp ref={arrowIconRef} size={112} strokeWidth={2.6} />
            </div>
          ) : (
            <div className="precision-search" aria-label="Calibrating direction">
              <i /><i /><span><LocateFixed size={42} /></span>
            </div>
          )}
          <div className="precision-distance">
            <strong>{arrived ? 'Here' : guidance ? formatDistance(guidance.distanceMeters) : '—'}</strong>
            <span>{arrived ? 'Destination reached' : nearby ? 'Nearby' : turnLabel}</span>
          </div>
        </main>
        <footer className="precision-footer">
          <div className="precision-status-row">
            <span className={`precision-status ${locationState === 'denied' || locationState === 'unavailable' || locationState === 'error' ? 'has-error' : ''}`}><i />{locationLabel}</span>
            <span className={`precision-status ${compassState === 'denied' || compassState === 'unavailable' ? 'has-error' : ''}`}><Compass size={13} />{compassLabel}</span>
          </div>
          <p>{precisionMessage}</p>
          <div className="precision-meta">
            <span>{position ? `Accuracy ±${Math.round(position.accuracy)} m` : 'Waiting for position'}</span>
            <span>{guidance?.mode === 'route' ? 'Walking route' : 'Direct guidance'}</span>
          </div>
          <div className="precision-actions">
            {needsRetry && <button className="precision-retry" onClick={retryServices}><RefreshCw size={15} />Try again</button>}
            <button className="precision-end" onClick={exitNavigation}>End</button>
          </div>
        </footer>
      </div>
    )
  }

  return (
    <div className="guide-live-panel">
      <div className="guide-live-copy">
        <span className="rhu-kicker">Selected destination</span>
        <h2>{destination.label}</h2>
        <p>Use live GPS and your phone compass for direct, camera-assisted guidance.</p>
      </div>
      <div className="guide-live-route">
        <div><span className="guide-point">You</span><small>{position ? `±${Math.round(position.accuracy)} m accuracy` : 'Live location not acquired'}</small></div>
        <ArrowRight size={18} aria-hidden="true" />
        <div><span className="guide-point destination-point"><MapPin size={16} /></span><small>{destination.label}</small></div>
      </div>
      <div className="guide-live-metrics">
        <div><span>Distance</span><strong>{guidance ? formatDistance(guidance.distanceMeters) : '—'}</strong></div>
        <div><span>Direction</span><strong>{guidance ? `${Math.round(guidance.bearing)}°` : '—'}</strong></div>
        <div><span>Status</span><strong>{locationLabel}</strong></div>
      </div>
      {locationError && <div className="rhu-alert error" role="alert"><CircleAlert size={17} />{locationError}</div>}
      <div className="guide-live-actions">
        <button className="rhu-primary" onClick={startNavigation}><Camera size={17} />Start camera route</button>
        <button className="rhu-secondary" onClick={requestSingleLocation}><LocateFixed size={17} />{locationState === 'acquiring' ? 'Locating…' : 'Use live location'}</button>
      </div>
    </div>
  )
}

function headingFromEvent(event: DeviceOrientationEvent) {
  const webkitEvent = event as DeviceOrientationEvent & { webkitCompassHeading?: number; webkitCompassAccuracy?: number }
  const legacyScreenAngle = (window as Window & { orientation?: number }).orientation
  const screenAngle = window.screen.orientation?.angle ?? (typeof legacyScreenAngle === 'number' ? legacyScreenAngle : 0)
  const hasWebkitCompass = typeof webkitEvent.webkitCompassHeading === 'number'
    && Number.isFinite(webkitEvent.webkitCompassHeading)
    && (webkitEvent.webkitCompassAccuracy === undefined || webkitEvent.webkitCompassAccuracy >= 0)
  if (hasWebkitCompass) return normalizeDegrees(webkitEvent.webkitCompassHeading! + screenAngle)
  if (event.type !== 'deviceorientationabsolute' && event.absolute !== true) return null
  return compassHeadingFromOrientation(event.alpha, event.beta, event.gamma, screenAngle)
}
function Assistant() { const prompts = ['Where is my next class?', 'What should I do now?', 'I have 40 minutes before class.', 'Take me to Student Parking.']; const [message, setMessage] = useState(''); return <div className="view"><div className="assistant-heading"><span className="assistant-orb"><Bot size={26} /></span><div><div className="eyebrow"><i />CampusMate intelligence</div><h1>Ask your <em>companion.</em></h1><p>The n8n AI agent will live here next.</p></div><b className="coming">COMING SOON</b></div><div className="panel chat"><div className="chat-intro"><Sparkles size={18} /><h2>Ready when you are.</h2><p>Connect a future AI Agent webhook to make this space conversational.</p></div><div className="prompts">{prompts.map(prompt => <button key={prompt} onClick={() => setMessage(prompt)}>{prompt}<ArrowRight size={14} /></button>)}</div><div className="composer"><input value={message} onChange={e => setMessage(e.target.value)} placeholder="Ask CampusMate anything..." /><button disabled={!message}><Send size={16} /></button></div><small className="disclaimer"><CircleAlert size={13} />No AI agent is connected in this preview. Your message will not be sent.</small></div></div> }
function Modal({ meeting, close }: { meeting: Meeting; close: () => void }) { return <div className="backdrop" onClick={close}><section className="panel modal" onClick={e => e.stopPropagation()}><button className="modal-close" onClick={close}><X size={16} /></button><b className={`course-tag ${color(meeting.course)}`}>{meeting.course}</b><h2>{meeting.title}</h2><p>Section {meeting.section} · {meeting.status}</p><div className="modal-details"><span><CalendarDays size={15} />{meeting.day}, {timeLabel(meeting.start)} – {timeLabel(meeting.end)}</span><span><MapPin size={15} />{meeting.room || 'Room to be announced'}</span></div><button className="primary full"><Navigation size={15} />Guide me here</button></section></div> }
function Empty({ title, text }: { title: string; text: string }) { return <div className="empty"><CalendarDays size={19} /><b>{title}</b><p>{text}</p></div> }

