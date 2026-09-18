import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, ArrowUp, Bot, CalendarDays, Camera, ChevronDown, CircleAlert, Compass, CornerDownRight, Edit3, LayoutDashboard, LocateFixed, MapPin, Navigation, Plus, RefreshCw, RotateCcw, Send, Sparkles, Target, Trash2, X } from 'lucide-react'
import type { DayName, Enrollment, Meeting, ScheduleResponse } from './types'
import { formatDistance, getNavigationGuidance, normalizeDegrees, relativeBearing, smoothHeading } from './navigation'
import type { CampusWalkingRoute, LiveHeading, LivePosition, NavigationDestination } from './navigation'
import './campus.css'
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
const GPS_LOCK_ACCURACY_METERS = 50
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
  requestPermission?: () => Promise<'granted' | 'denied'>
}

function Guide({ destination, camera, setCamera }: { destination: NavigationDestination; camera: boolean; setCamera: (value: boolean) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const watchIdRef = useRef<number | null>(null)
  const orientationListenerRef = useRef<((event: DeviceOrientationEvent) => void) | null>(null)
  const compassTimeoutRef = useRef<number | null>(null)
  const headingRef = useRef<LiveHeading | null>(null)
  const navigationSessionRef = useRef(0)
  const [position, setPosition] = useState<LivePosition | null>(null)
  const [locationState, setLocationState] = useState<LocationState>('idle')
  const [locationError, setLocationError] = useState('')
  const [compassState, setCompassState] = useState<CompassState>('idle')
  const [heading, setHeading] = useState<LiveHeading | null>(null)
  const [cameraError, setCameraError] = useState('')
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
    if (source === 'course' && current?.source === 'compass') return
    const previous = current?.source === source ? current.degrees : null
    const next = { degrees: smoothHeading(previous, normalizeDegrees(degrees)), source }
    headingRef.current = next
    setHeading(next)
  }, [])

  const savePosition = useCallback((coords: GeolocationCoordinates, timestamp: number) => {
    const course = typeof coords.heading === 'number' && Number.isFinite(coords.heading) && coords.heading >= 0 ? normalizeDegrees(coords.heading) : null
    const nextPosition: LivePosition = {
      lat: coords.latitude,
      lng: coords.longitude,
      accuracy: coords.accuracy,
      timestamp,
      course,
    }
    setPosition(nextPosition)
    setLocationError('')
    setLocationState(nextPosition.accuracy <= GPS_LOCK_ACCURACY_METERS ? 'live' : 'weak')
    if (course !== null && typeof coords.speed === 'number' && Number.isFinite(coords.speed) && coords.speed > 0.5) saveHeading(course, 'course')
  }, [saveHeading])

  const reportLocationError = useCallback((error: GeolocationPositionError) => {
    setPosition(null)
    if (error.code === error.PERMISSION_DENIED) {
      setLocationState('denied')
      setLocationError('Location access was denied. Allow precise location and start navigation again.')
      return
    }
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
        const permission = await OrientationEvent.requestPermission()
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
      clearCompassTimeout()
      saveHeading(nextHeading, 'compass')
      setCompassState('active')
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
  }, [clearCompassTimeout, saveHeading, stopCompassTracking])

  const startNavigation = () => {
    stopSensors()
    const session = navigationSessionRef.current + 1
    navigationSessionRef.current = session
    headingRef.current = null
    setHeading(null)
    setPosition(null)
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
  }, [camera])

  const turn = guidance && heading ? relativeBearing(guidance.bearing, heading.degrees) : null
  const locationLabel = locationState === 'live' ? 'GPS LOCKED' : locationState === 'weak' ? `GPS ±${Math.round(position?.accuracy ?? 0)} M` : locationState === 'acquiring' ? 'ACQUIRING GPS' : locationState === 'denied' ? 'LOCATION DENIED' : locationState === 'unavailable' ? 'GPS UNAVAILABLE' : locationState === 'error' ? 'GPS RETRY NEEDED' : 'GPS IDLE'
  const compassLabel = heading?.source === 'compass' ? 'phone compass' : heading?.source === 'course' ? 'walking direction' : compassState === 'denied' ? 'compass denied' : compassState === 'unavailable' ? 'compass unavailable' : 'calibrating compass'
  const serviceErrors = [locationError, cameraError].filter(Boolean).join(' ')
  const routeMessage = serviceErrors || (!guidance ? 'Getting a fresh GPS position. Keep precise location enabled.' : !heading ? compassState === 'denied' ? 'Compass access was denied. Enable Motion & Orientation access, then start again.' : compassState === 'unavailable' ? 'Compass is unavailable. Start walking to use your travel direction instead.' : 'Calibrating your compass. Hold the phone upright and move it in a figure eight.' : `${guidance.instruction}. Keep the arrow centered as you walk.`)

  if (camera) {
    return <div className="camera-route"><video ref={videoRef} autoPlay playsInline muted /><div className="camera-tint" /><button className="camera-exit" onClick={exitNavigation}><X size={17} />Exit navigation</button>{turn !== null && <div className="route-arrow"><span className="route-arrow-ring" style={{ transform: `rotate(${turn}deg)` }}><ArrowUp size={31} strokeWidth={2.7} /></span><span className="route-arrow-label">{Math.round(turn)}°</span></div>}<div className="camera-overlay"><div className="camera-status"><i className="live" />LIVE ROUTE / {locationLabel}</div><div className="route-readout"><div><b>{guidance ? formatDistance(guidance.distanceMeters) : '—'}</b><span>to {destination.label}</span></div><div><b>{turn === null ? '—' : `${Math.round(turn)}°`}</b><span>{compassLabel}</span></div></div><p>{routeMessage}</p><button className="outline light" onClick={exitNavigation}>Back to route details</button></div></div>
  }

  return <div className="view"><div className="guide-hero route-hero"><div className="grid-pattern" /><div className="guide-copy"><div className="eyebrow light"><i />Campus Guide / Live guidance</div><h1>Your position<br /><em>to Point B.</em></h1><p>Use your live location and compass to point directly to the BIOM502 class at Student Parking.</p></div><div className="route-orbit"><Target size={24} /><span>C</span><i /><span>B</span></div></div><div className="route-summary"><div className="route-point"><span className="point-pin start-pin">C</span><div><small>CURRENT POSITION</small><b>{position ? 'Your live location' : 'Live location not acquired'}</b><em>{position ? `${position.lat.toFixed(4)}, ${position.lng.toFixed(4)} · ±${Math.round(position.accuracy)} m` : 'Start camera navigation for a fresh GPS position'}</em></div></div><ArrowRight className="route-line" size={18} /><div className="route-point"><span className="point-pin end-pin">B</span><div><small>DESTINATION</small><b>{destination.label}</b><em>{destination.coordinate.lat.toFixed(4)}, {destination.coordinate.lng.toFixed(4)}</em></div></div></div><div className="route-metrics"><div><span>Distance</span><b>{guidance ? formatDistance(guidance.distanceMeters) : '—'}</b></div><div><span>Direction</span><b>{guidance ? `${Math.round(guidance.bearing)}°` : '—'}</b></div><div><span>Route status</span><b className={`location-state ${locationState === 'unavailable' || locationState === 'denied' || locationState === 'error' ? 'unavailable' : ''}`}>{locationLabel}</b></div></div><div className="route-actions"><button className="primary" onClick={startNavigation}><Camera size={15} />Start camera route <ArrowRight size={15} /></button><button className="outline" onClick={requestSingleLocation}><LocateFixed size={15} />{locationState === 'acquiring' ? 'Locating...' : 'Use live location'}</button></div><div className="footnote"><CircleAlert size={15} />Guidance points directly to Student Parking today. Campus walking routes can later provide the same camera overlay with path-aware turns.</div></div>
}

function headingFromEvent(event: DeviceOrientationEvent) {
  const webkitEvent = event as DeviceOrientationEvent & { webkitCompassHeading?: number; webkitCompassAccuracy?: number }
  if (typeof webkitEvent.webkitCompassHeading === 'number' && Number.isFinite(webkitEvent.webkitCompassHeading) && (webkitEvent.webkitCompassAccuracy === undefined || webkitEvent.webkitCompassAccuracy >= 0)) return normalizeDegrees(webkitEvent.webkitCompassHeading)
  if (event.type !== 'deviceorientationabsolute' || !event.absolute || typeof event.alpha !== 'number' || !Number.isFinite(event.alpha)) return null
  const screenAngle = window.screen.orientation?.angle ?? 0
  return normalizeDegrees(360 - event.alpha + screenAngle)
}
function Assistant() { const prompts = ['Where is my next class?', 'What should I do now?', 'I have 40 minutes before class.', 'Take me to Student Parking.']; const [message, setMessage] = useState(''); return <div className="view"><div className="assistant-heading"><span className="assistant-orb"><Bot size={26} /></span><div><div className="eyebrow"><i />CampusMate intelligence</div><h1>Ask your <em>companion.</em></h1><p>The n8n AI agent will live here next.</p></div><b className="coming">COMING SOON</b></div><div className="panel chat"><div className="chat-intro"><Sparkles size={18} /><h2>Ready when you are.</h2><p>Connect a future AI Agent webhook to make this space conversational.</p></div><div className="prompts">{prompts.map(prompt => <button key={prompt} onClick={() => setMessage(prompt)}>{prompt}<ArrowRight size={14} /></button>)}</div><div className="composer"><input value={message} onChange={e => setMessage(e.target.value)} placeholder="Ask CampusMate anything..." /><button disabled={!message}><Send size={16} /></button></div><small className="disclaimer"><CircleAlert size={13} />No AI agent is connected in this preview. Your message will not be sent.</small></div></div> }
function Modal({ meeting, close }: { meeting: Meeting; close: () => void }) { return <div className="backdrop" onClick={close}><section className="panel modal" onClick={e => e.stopPropagation()}><button className="modal-close" onClick={close}><X size={16} /></button><b className={`course-tag ${color(meeting.course)}`}>{meeting.course}</b><h2>{meeting.title}</h2><p>Section {meeting.section} · {meeting.status}</p><div className="modal-details"><span><CalendarDays size={15} />{meeting.day}, {timeLabel(meeting.start)} – {timeLabel(meeting.end)}</span><span><MapPin size={15} />{meeting.room || 'Room to be announced'}</span></div><button className="primary full"><Navigation size={15} />Guide me here</button></section></div> }
function Empty({ title, text }: { title: string; text: string }) { return <div className="empty"><CalendarDays size={19} /><b>{title}</b><p>{text}</p></div> }

