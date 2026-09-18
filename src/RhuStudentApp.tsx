import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Bot,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Coffee,
  GraduationCap,
  Home,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  MapPin,
  MessageCircle,
  Navigation,
  RefreshCw,
  Send,
  Sparkles,
  UtensilsCrossed,
  X,
} from 'lucide-react'
import { Guide } from './CampusMateApp'
import { CAFETERIA_MENU, CAMPUS_DESTINATIONS, type MenuCategory } from './campusData'
import { isChatConfigured, sendChatMessage } from './services/chatApi'
import {
  findDueClassReminder,
  readDeliveredReminders,
  saveDeliveredReminder,
  showBrowserClassReminder,
  type ClassReminder,
} from './services/classReminders'
import { fetchSchedule } from './services/scheduleApi'
import type { DayName, ScheduleMeeting, StudentSession } from './types'
import './rhu.css'

const SESSION_KEY = 'rhu-student-session-v1'
const CREDENTIAL_KEY = 'rhu-student-credential-v1'
const CHAT_SESSION_KEY = 'rhu-chat-session-v1'
const DAYS: DayName[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
const MENU_CATEGORIES: MenuCategory[] = ['Breakfast', 'Mains', 'Snacks', 'Drinks']

type View = 'home' | 'nav' | 'classes' | 'menu'
type ChatMessage = { id: string; role: 'user' | 'assistant'; text: string }

const navigationItems = [
  { id: 'home' as View, label: 'Home', icon: Home },
  { id: 'nav' as View, label: 'Nav', icon: Navigation },
  { id: 'classes' as View, label: 'Classes', icon: GraduationCap },
  { id: 'menu' as View, label: 'Menu', icon: UtensilsCrossed },
]

function createId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function readSession(): StudentSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const value = JSON.parse(raw) as Partial<StudentSession>
    if (typeof value.username !== 'string'
      || typeof value.fetchedAt !== 'number'
      || !value.schedule
      || !Array.isArray(value.schedule.courses)
      || !Array.isArray(value.schedule.meetings)) return null
    const schedule = value.schedule as StudentSession['schedule']
    return {
      ...value,
      schedule: {
        ...schedule,
        reminderMinutesBefore: Number.isInteger(schedule.reminderMinutesBefore)
          ? schedule.reminderMinutesBefore
          : 10,
      },
    } as StudentSession
  } catch {
    return null
  }
}

function saveCredential(username: string, password: string) {
  sessionStorage.setItem(CREDENTIAL_KEY, JSON.stringify({ username, password }))
}

function readCredential(username: string) {
  try {
    const raw = sessionStorage.getItem(CREDENTIAL_KEY)
    if (!raw) return null
    const value = JSON.parse(raw) as { username?: unknown; password?: unknown }
    return value.username === username && typeof value.password === 'string' && value.password
      ? value.password
      : null
  } catch {
    return null
  }
}

function currentDay(): DayName | null {
  const name = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date())
  return DAYS.includes(name as DayName) ? name as DayName : null
}

function findNextScheduledDay(meetings: ScheduleMeeting[], preferredDay: DayName | null = currentDay()): DayName {
  const fallbackDay = preferredDay ?? 'Monday'
  const scheduledDays = new Set(meetings.map(meeting => meeting.day))
  if (!scheduledDays.size) return fallbackDay

  const startIndex = preferredDay ? DAYS.indexOf(preferredDay) : 0
  for (let offset = 0; offset < DAYS.length; offset += 1) {
    const candidate = DAYS[(startIndex + offset) % DAYS.length]
    if (scheduledDays.has(candidate)) return candidate
  }

  return fallbackDay
}

function formatMinutes(total: number) {
  const hours = Math.floor(total / 60)
  const minutes = total % 60
  return `${hours % 12 || 12}:${String(minutes).padStart(2, '0')} ${hours >= 12 ? 'PM' : 'AM'}`
}

function findNextMeeting(meetings: ScheduleMeeting[], now = new Date()) {
  const currentDayIndex = now.getDay() === 0 ? 6 : now.getDay() - 1
  const currentMinutes = now.getHours() * 60 + now.getMinutes()
  return meetings
    .map(meeting => {
      const meetingDayIndex = DAYS.indexOf(meeting.day)
      let dayDistance = (meetingDayIndex - currentDayIndex + 7) % 7
      if (dayDistance === 0 && meeting.startMinutes < currentMinutes) dayDistance = 7
      return { meeting, distance: dayDistance * 1440 + meeting.startMinutes - (dayDistance === 0 ? currentMinutes : 0) }
    })
    .sort((a, b) => a.distance - b.distance)[0]?.meeting ?? null
}

function formatUpdated(timestamp: number) {
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date(timestamp))
}

export default function RhuStudentApp() {
  const [session, setSession] = useState<StudentSession | null>(() => readSession())
  const [view, setView] = useState<View>('home')
  const [destination, setDestination] = useState<(typeof CAMPUS_DESTINATIONS)[number] | null>(null)
  const [camera, setCamera] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [refreshOpen, setRefreshOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState('')
  const [classReminder, setClassReminder] = useState<ClassReminder | null>(null)

  useEffect(() => {
    if (!session) return
    const delivered = readDeliveredReminders(session.username)
    const checkForClass = () => {
      const reminder = findDueClassReminder(session.schedule.meetings, delivered, new Date(), session.schedule.reminderMinutesBefore)
      if (!reminder) return
      delivered.add(reminder.id)
      saveDeliveredReminder(session.username, reminder.id)
      setClassReminder(reminder)
      showBrowserClassReminder(reminder)
    }
    checkForClass()
    const interval = window.setInterval(checkForClass, 15_000)
    return () => window.clearInterval(interval)
  }, [session])

  const saveSession = (next: StudentSession) => {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(next))
    setSession(next)
  }

  const authenticate = async (username: string, password: string) => {
    const schedule = await fetchSchedule(username, password)
    saveCredential(username, password)
    saveSession({ username, schedule, fetchedAt: Date.now() })
  }

  const refreshSchedule = async (password?: string) => {
    if (!session) return
    const savedPassword = password ?? readCredential(session.username)
    if (!savedPassword) {
      setRefreshOpen(true)
      return
    }
    setRefreshing(true)
    setRefreshError('')
    try {
      const schedule = await fetchSchedule(session.username, savedPassword)
      saveCredential(session.username, savedPassword)
      saveSession({ ...session, schedule, fetchedAt: Date.now() })
      setRefreshOpen(false)
    } catch (reason) {
      setRefreshError(reason instanceof Error ? reason.message : 'Could not refresh the schedule.')
      throw reason
    } finally {
      setRefreshing(false)
    }
  }

  const logout = () => {
    sessionStorage.removeItem(SESSION_KEY)
    sessionStorage.removeItem(CREDENTIAL_KEY)
    sessionStorage.removeItem(CHAT_SESSION_KEY)
    setChatOpen(false)
    setClassReminder(null)
    setRefreshOpen(false)
    setSession(null)
    setView('home')
  }

  if (!session) return <SignIn onAuthenticate={authenticate} />

  const openDestination = (id: string) => {
    const next = CAMPUS_DESTINATIONS.find(item => item.id === id)
    if (next) setDestination(next)
    setView('nav')
  }

  const content = view === 'home'
    ? <HomeView session={session} go={setView} openDestination={openDestination} />
    : view === 'nav'
      ? <NavigationView selected={destination} select={setDestination} camera={camera} setCamera={setCamera} />
      : view === 'classes'
        ? <ClassesView session={session} requestRefresh={() => { void refreshSchedule().catch(() => undefined) }} refreshing={refreshing} refreshError={refreshError} />
        : <MenuView />

  return (
    <div className="rhu-app">
      <header className="rhu-header">
        <div className="rhu-header-inner">
          <button className="rhu-brand" type="button" onClick={() => setView('home')} aria-label="RHU Student Companion home">
            <img src="/images/brand/rhu-logo.webp" alt="Rafik Hariri University" width="447" height="447" decoding="async" />
          </button>
          <nav className="rhu-desktop-tabs" aria-label="Primary navigation">
            {navigationItems.map(({ id, label, icon: Icon }) => (
              <button key={id} className={view === id ? 'active' : ''} aria-current={view === id ? 'page' : undefined} onClick={() => setView(id)}>
                <Icon size={17} />{label}
              </button>
            ))}
          </nav>
          <div className="rhu-account">
            <span><small>Student ID</small><strong>{session.username}</strong></span>
            <button type="button" onClick={logout} aria-label="Log out"><LogOut size={18} /></button>
          </div>
        </div>
      </header>

      <main className="rhu-main">
        {classReminder && <ClassReminderToast reminder={classReminder} dismiss={() => setClassReminder(null)} />}
        {content}
      </main>

      <nav className="rhu-mobile-tabs" aria-label="Primary navigation">
        {navigationItems.map(({ id, label, icon: Icon }) => (
          <button key={id} className={view === id ? 'active' : ''} aria-current={view === id ? 'page' : undefined} onClick={() => setView(id)}>
            <Icon size={20} /><span>{label}</span>
          </button>
        ))}
      </nav>

      <button className="chat-fab" type="button" onClick={() => setChatOpen(true)} aria-label="Open Campus Assistant">
        <MessageCircle size={23} /><span>Ask RHU</span>
      </button>
      <ChatDrawer open={chatOpen} close={() => setChatOpen(false)} />
      {refreshOpen && (
        <RefreshScheduleModal
          username={session.username}
          close={() => setRefreshOpen(false)}
          refresh={refreshSchedule}
        />
      )}
    </div>
  )
}

function ClassReminderToast({ reminder, dismiss }: { reminder: ClassReminder; dismiss: () => void }) {
  return (
    <aside className="class-reminder-toast" role="status" aria-live="polite">
      <span><Bell size={20} /></span>
      <div><small>Class starts in {reminder.minutesUntilStart} minutes</small><strong>{reminder.meeting.code} · {reminder.meeting.title}</strong><p>{reminder.meeting.room ? `Room ${reminder.meeting.room}` : 'Room TBA'}</p></div>
      <button type="button" onClick={dismiss} aria-label="Dismiss class reminder"><X size={18} /></button>
    </aside>
  )
}

function SignIn({ onAuthenticate }: { onAuthenticate: (username: string, password: string) => Promise<void> }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!username.trim() || !password) return
    setLoading(true)
    setError('')
    try {
      await onAuthenticate(username.trim(), password)
      setPassword('')
    } catch (reason) {
      setPassword('')
      setError(reason instanceof Error ? reason.message : 'Sign-in failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="sign-in-page">
      <section className="sign-in-brand" aria-label="Rafik Hariri University Student Companion">
        <img src="/images/brand/rhu-logo.webp" alt="Rafik Hariri University" width="447" height="447" decoding="async" fetchPriority="high" />
        <span className="sign-in-badge"><Sparkles size={15} />Student Companion</span>
        <h1>Your campus,<br />made simpler.</h1>
        <p>Classes, campus directions, cafeteria choices, and help in one calm space.</p>
        <div className="sign-in-features">
          <span><Navigation size={18} />Find your way</span>
          <span><CalendarDays size={18} />Keep up with class</span>
          <span><Coffee size={18} />See what’s available</span>
        </div>
      </section>
      <section className="sign-in-panel">
        <div className="sign-in-mobile-logo"><img src="/images/brand/rhu-logo.webp" alt="Rafik Hariri University" width="447" height="447" decoding="async" fetchPriority="high" /></div>
        <span className="rhu-kicker">Welcome back</span>
        <h2>Sign in to continue</h2>
        <p>Use your RHU student credentials to securely retrieve your schedule.</p>
        <form onSubmit={submit} noValidate>
          <label>Student ID<input autoComplete="username" inputMode="numeric" value={username} onChange={event => setUsername(event.target.value)} placeholder="Enter your student ID" /></label>
          <label>Password<input type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} placeholder="Enter your password" /></label>
          {error && <div className="rhu-alert error" role="alert"><AlertTriangle size={18} />{error}</div>}
          <button className="rhu-primary sign-in-submit" disabled={loading || !username.trim() || !password}>
            {loading ? <><LoaderCircle className="spin" size={18} />Loading your schedule…</> : <>Sign in securely<ArrowRight size={18} /></>}
          </button>
        </form>
        <div className="privacy-note"><LockKeyhole size={16} /><span>Your password is kept only in this browser tab so schedule refreshes do not ask again. It is cleared when you log out or close the tab.</span></div>
      </section>
    </main>
  )
}

function HomeView({ session, go, openDestination }: { session: StudentSession; go: (view: View) => void; openDestination: (id: string) => void }) {
  const today = currentDay()
  const todayMeetings = session.schedule.meetings.filter(meeting => meeting.day === today).sort((a, b) => a.startMinutes - b.startMinutes)
  const next = findNextMeeting(session.schedule.meetings)
  const featured = CAFETERIA_MENU.find(item => item.featured) ?? CAFETERIA_MENU[0]

  return (
    <div className="rhu-view">
      <section className="home-welcome">
        <div><span className="rhu-kicker">{new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date())}</span><h1>Welcome back.</h1><p>Everything you need for a smoother day at RHU.</p></div>
        <button className="rhu-primary" onClick={() => go('nav')}><Navigation size={18} />Navigate campus</button>
      </section>

      <div className="home-primary-grid">
        <section className="rhu-card next-class-card">
          <div className="card-heading"><span className="rhu-kicker">Up next</span><CalendarDays size={20} /></div>
          {next ? <>
            <div className="next-class-time">{formatMinutes(next.startMinutes)}<small>{next.day}</small></div>
            <h2>{next.code}</h2><p>{next.title}</p>
            <div className="class-meta"><span><MapPin size={16} />{next.room || 'Room TBA'}</span><span>Section {next.section}</span></div>
            <button className="rhu-link" onClick={() => go('classes')}>View classes<ArrowRight size={16} /></button>
          </> : <EmptyState icon={CalendarDays} title="No upcoming classes" text="Your returned schedule does not include an upcoming meeting." />}
        </section>

        <section className="rhu-card today-card-rhu">
          <div className="card-heading"><div><span className="rhu-kicker">Today</span><h2>{todayMeetings.length} {todayMeetings.length === 1 ? 'class' : 'classes'}</h2></div><button className="icon-button" onClick={() => go('classes')} aria-label="View classes"><ArrowRight size={18} /></button></div>
          {todayMeetings.length ? <div className="today-list">{todayMeetings.slice(0, 4).map(meeting => <button key={`${meeting.code}-${meeting.startMinutes}`} onClick={() => go('classes')}><time>{formatMinutes(meeting.startMinutes)}</time><span><strong>{meeting.code}</strong><small>{meeting.title}</small></span><em>{meeting.room || 'TBA'}</em></button>)}</div> : <EmptyState icon={CheckCircle2} title="Your day is clear" text="There are no classes scheduled for today." />}
        </section>
      </div>

      <section className="home-section">
        <div className="section-heading"><div><span className="rhu-kicker">Quick directions</span><h2>Where are you going?</h2></div><button className="rhu-link" onClick={() => go('nav')}>Open Nav<ArrowRight size={16} /></button></div>
        <div className="quick-destinations">{CAMPUS_DESTINATIONS.map(item => <button key={item.id} onClick={() => openDestination(item.id)}><span><MapPin size={19} /></span><strong>{item.label}</strong><small>{item.description}</small><ArrowRight size={16} /></button>)}</div>
      </section>

      <section className="menu-preview">
        <div><span className="rhu-kicker">Cafeteria pick</span><h2>{featured.name}</h2><p>{featured.description}</p><button className="rhu-link light-link" onClick={() => go('menu')}>Explore today’s menu<ArrowRight size={16} /></button></div>
        <strong>${featured.price.toFixed(2)}</strong>
      </section>
    </div>
  )
}

function NavigationView({ selected, select, camera, setCamera }: { selected: typeof CAMPUS_DESTINATIONS[number] | null; select: (item: typeof CAMPUS_DESTINATIONS[number] | null) => void; camera: boolean; setCamera: (value: boolean) => void }) {
  return (
    <div className="rhu-view">
      <PageHeading kicker="Campus navigation" title="Where do you want to go?" description="Tap a destination to see how far away it is and start navigation." />
      <div className="destination-grid">
        {CAMPUS_DESTINATIONS.map(item => (
          <button key={item.id} className={selected?.id === item.id ? 'selected' : ''} aria-pressed={selected?.id === item.id} onClick={() => select(item)}>
            <span className="destination-photo"><img src={item.imageSrc} srcSet={item.imageSrcSet} sizes="(max-width: 960px) 50vw, 200px" width={item.imageWidth} height={item.imageHeight} loading="lazy" decoding="async" alt={item.imageAlt} /></span>
            <span className="destination-copy"><strong>{item.label}</strong><small>{item.description}</small></span>
            <span className="destination-choice" aria-hidden="true">{selected?.id === item.id ? <CheckCircle2 size={20} /> : <ArrowRight size={18} />}</span>
          </button>
        ))}
      </div>
      {selected && <Guide key={selected.id} destination={selected} camera={camera} setCamera={setCamera} presentation="modal" autoLocate onClose={() => select(null)} />}
    </div>
  )
}

function ClassesView({ session, requestRefresh, refreshing, refreshError }: { session: StudentSession; requestRefresh: () => void; refreshing: boolean; refreshError: string }) {
  const [preferredDay, setPreferredDay] = useState<DayName>(() => currentDay() ?? 'Monday')
  const day = findNextScheduledDay(session.schedule.meetings, preferredDay)
  const meetings = session.schedule.meetings.filter(meeting => meeting.day === day).sort((a, b) => a.startMinutes - b.startMinutes)
  const courseIssues = useMemo(() => new Map(session.schedule.courses.map(course => [course.code, course.issue])), [session.schedule.courses])

  return (
    <div className="rhu-view">
      <PageHeading
        kicker="Your timetable"
        title="Classes"
        description={`${session.schedule.courses.length} courses · Updated ${formatUpdated(session.fetchedAt)}`}
        action={<button className="rhu-secondary" onClick={requestRefresh} disabled={refreshing}>{refreshing ? <><LoaderCircle className="spin" size={17} />Refreshing…</> : <><RefreshCw size={17} />Refresh schedule</>}</button>}
      />
      {refreshError && <div className="rhu-alert error" role="alert"><AlertTriangle size={17} />{refreshError}</div>}
      <div className="day-tabs" role="tablist" aria-label="Class day">
        {DAYS.map(item => <button role="tab" aria-selected={day === item} className={day === item ? 'active' : ''} key={item} onClick={() => setPreferredDay(item)}><span>{item.slice(0, 3)}</span><small>{session.schedule.meetings.filter(meeting => meeting.day === item).length}</small></button>)}
      </div>
      <section className="classes-list" aria-label={`${day} classes`}>
        <div className="classes-day-heading"><div><span className="rhu-kicker">Selected day</span><h2>{day}</h2></div><span>{meetings.length} {meetings.length === 1 ? 'meeting' : 'meetings'}</span></div>
        {meetings.length ? meetings.map(meeting => {
          const issue = courseIssues.get(meeting.code)
          return <article className={`class-card ${meeting.conflict ? 'has-conflict' : ''}`} key={`${meeting.code}-${meeting.startMinutes}`}>
            <div className="class-time"><Clock3 size={17} /><strong>{formatMinutes(meeting.startMinutes)}</strong><span>to {formatMinutes(meeting.endMinutes)}</span></div>
            <div className="class-details"><div className="class-labels"><span>{meeting.code}</span><small>Section {meeting.section}</small>{meeting.conflict && <b><AlertTriangle size={13} />Conflict</b>}</div><h3>{meeting.title}</h3><p>{meeting.instructor ? `Instructor: ${meeting.instructor}` : 'Instructor not provided'}</p>{issue && <div className="course-issue"><AlertTriangle size={14} />{issue}</div>}</div>
            <div className="class-room"><MapPin size={17} /><span><small>Room</small><strong>{meeting.room || 'TBA'}</strong></span></div>
          </article>
        }) : <EmptyState icon={CalendarDays} title={`No classes on ${day}`} text="Choose another day to continue exploring your timetable." />}
      </section>
    </div>
  )
}

function MenuView() {
  return (
    <div className="rhu-view">
      <PageHeading kicker="RHU cafeteria" title="Today’s menu" description="A simple look at what’s available around campus." />
      <div className="menu-sections">
        {MENU_CATEGORIES.map(category => <section key={category}><div className="menu-category-heading"><h2>{category}</h2><span>{CAFETERIA_MENU.filter(item => item.category === category).length} items</span></div><div className="menu-grid">{CAFETERIA_MENU.filter(item => item.category === category).map(item => <article className="menu-card" key={item.id}><div><span className="menu-item-icon">{category === 'Drinks' ? <Coffee size={19} /> : <UtensilsCrossed size={19} />}</span><h3>{item.name}</h3><p>{item.description}</p></div><strong>${item.price.toFixed(2)}</strong></article>)}</div></section>)}
      </div>
    </div>
  )
}

function PageHeading({ kicker, title, description, action }: { kicker: string; title: string; description: string; action?: React.ReactNode }) {
  return <header className="page-heading"><div><span className="rhu-kicker">{kicker}</span><h1>{title}</h1><p>{description}</p></div>{action}</header>
}

function EmptyState({ icon: Icon, title, text }: { icon: typeof CalendarDays; title: string; text: string }) {
  return <div className="rhu-empty"><span><Icon size={22} /></span><strong>{title}</strong><p>{text}</p></div>
}

function RefreshScheduleModal({ username, close, refresh }: { username: string; close: () => void; refresh: (password: string) => Promise<void> }) {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { inputRef.current?.focus() }, [])

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!password || loading) return
    setLoading(true)
    setError('')
    try {
      await refresh(password)
      setPassword('')
      close()
    } catch (reason) {
      setPassword('')
      setError(reason instanceof Error ? reason.message : 'Could not refresh the schedule.')
      setLoading(false)
    }
  }

  return <div className="rhu-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) close() }}><section className="rhu-modal" role="dialog" aria-modal="true" aria-labelledby="refresh-title"><button className="modal-close-rhu" onClick={close} aria-label="Close"><X size={20} /></button><span className="rhu-kicker">Secure refresh</span><h2 id="refresh-title">Update your schedule</h2><p>Enter your password once for student ID <strong>{username}</strong>. It will be reused for refreshes in this tab.</p><form onSubmit={submit}><label>Password<input ref={inputRef} type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} /></label>{error && <div className="rhu-alert error" role="alert"><AlertTriangle size={17} />{error}</div>}<button className="rhu-primary" disabled={!password || loading}>{loading ? <><LoaderCircle className="spin" size={17} />Refreshing…</> : <><RefreshCw size={17} />Refresh schedule</>}</button></form></section></div>
}

function ChatDrawer({ open, close }: { open: boolean; close: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([{ id: 'welcome', role: 'assistant', text: 'Hi! I’m the RHU Campus Assistant. How can I help?' }])
  const [draft, setDraft] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [failedMessage, setFailedMessage] = useState('')
  const panelRef = useRef<HTMLElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const messagesRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    closeRef.current?.focus()
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { close(); return }
      if (event.key !== 'Tab' || !panelRef.current) return
      const focusable = [...panelRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), textarea:not([disabled])')]
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', keydown)
    return () => document.removeEventListener('keydown', keydown)
  }, [close, open])

  useEffect(() => { messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight, behavior: 'smooth' }) }, [messages, pending])

  const getChatSession = () => {
    const existing = sessionStorage.getItem(CHAT_SESSION_KEY)
    if (existing) return existing
    const next = createId()
    sessionStorage.setItem(CHAT_SESSION_KEY, next)
    return next
  }

  const deliver = async (text: string, appendUser: boolean) => {
    if (!text.trim() || pending || !isChatConfigured) return
    const clean = text.trim()
    if (appendUser) setMessages(current => [...current, { id: createId(), role: 'user', text: clean }])
    setDraft('')
    setPending(true)
    setError('')
    setFailedMessage('')
    try {
      const reply = await sendChatMessage(clean, getChatSession())
      setMessages(current => [...current, { id: createId(), role: 'assistant', text: reply }])
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The Campus Assistant could not reply.')
      setFailedMessage(clean)
    } finally {
      setPending(false)
    }
  }

  if (!open) return null
  return <div className="chat-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) close() }}><aside ref={panelRef} className="chat-drawer" role="dialog" aria-modal="true" aria-labelledby="chat-title"><header><span className="assistant-avatar"><Bot size={21} /></span><div><h2 id="chat-title">Campus Assistant</h2></div><button ref={closeRef} onClick={close} aria-label="Close Campus Assistant"><X size={21} /></button></header>{!isChatConfigured ? <div className="chat-unavailable"><span><Bot size={28} /></span></div> : <><div className="chat-messages" ref={messagesRef} aria-live="polite">{messages.map(message => <div className={`chat-message ${message.role}`} key={message.id}><span>{message.text}</span></div>)}{pending && <div className="chat-message assistant pending"><span><i /><i /><i /></span></div>}</div><div className="chat-compose">{error && <div className="chat-error" role="alert"><span>{error}</span><button onClick={() => void deliver(failedMessage, false)}>Retry</button></div>}<div className="chat-input"><textarea rows={1} value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void deliver(draft, true) } }} placeholder="Ask about RHU…" aria-label="Message Campus Assistant" /><button disabled={!draft.trim() || pending} onClick={() => void deliver(draft, true)} aria-label="Send message"><Send size={18} /></button></div><small>Enter to send · Shift + Enter for a new line</small></div></>}</aside></div>
}
