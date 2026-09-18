// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import RhuStudentApp from './RhuStudentApp'
import { CAMPUS_DESTINATIONS } from './campusData'
import { normalizeSchedule } from './services/scheduleApi'

const webhookPayload = {
  courses: [{ code: 'BIOM502', name: 'BIOM502-1-AI Applications in Health Care-diabmo', section: 1, issue: '', courseId: 520 }],
  meetings: [
    { code: 'BIOM502', name: 'BIOM502-1-AI Applications in Health Care-diabmo', section: 1, day: 'M', start: 660, end: 735, room: 'D203', conflict: false },
    { code: 'BIOM502', name: 'BIOM502-1-AI Applications in Health Care-diabmo', section: 1, day: 'R', start: 900, end: 975, room: 'D203', conflict: true },
  ],
}

const authenticatedSession = {
  username: 'student-demo',
  schedule: normalizeSchedule(webhookPayload),
  fetchedAt: Date.now(),
}

beforeEach(() => {
  const localValues = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    clear: () => localValues.clear(),
    getItem: (key: string) => localValues.get(key) ?? null,
    removeItem: (key: string) => localValues.delete(key),
    setItem: (key: string, value: string) => localValues.set(key, value),
  })
  sessionStorage.clear()
  localStorage.clear()
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function renderAuthenticated(password?: string) {
  sessionStorage.setItem('rhu-student-session-v1', JSON.stringify(authenticatedSession))
  if (password) sessionStorage.setItem('rhu-student-credential-v1', JSON.stringify({ username: authenticatedSession.username, password }))
  return render(<RhuStudentApp />)
}

describe('RHU student experience', () => {
  it('signs in through the schedule webhook and retains the password for this tab', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => webhookPayload } as Response)
    render(<RhuStudentApp />)

    fireEvent.change(screen.getByLabelText('Student ID'), { target: { value: 'student-demo' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'temporary-secret' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in securely' }))

    expect(await screen.findByRole('heading', { name: 'Welcome back.' })).toBeTruthy()
    expect(fetch).toHaveBeenCalledWith('/api/schedule', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ Username: 'student-demo', Password: 'temporary-secret' }),
    }))
    expect(sessionStorage.getItem('rhu-student-session-v1')).not.toContain('temporary-secret')
    expect(sessionStorage.getItem('rhu-student-credential-v1')).toContain('temporary-secret')
  })

  it('shows authentication failures without creating a session', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 401 } as Response)
    render(<RhuStudentApp />)
    fireEvent.change(screen.getByLabelText('Student ID'), { target: { value: 'student-demo' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong-value' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in securely' }))
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'The username or password was not accepted.')
    expect(sessionStorage.getItem('rhu-student-session-v1')).toBeNull()
  })

  it('restores a tab session and exposes exactly the four requested primary labels', () => {
    renderAuthenticated()
    for (const label of ['Home', 'Nav', 'Classes', 'Menu']) expect(screen.getAllByRole('button', { name: label }).length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: 'Edit schedule' })).toBeNull()
    expect(screen.queryByText('10-minute class reminders')).toBeNull()
  })

  it('shows parsed read-only classes, conflicts, and the refresh reauthentication prompt', () => {
    renderAuthenticated()
    fireEvent.click(screen.getAllByRole('button', { name: 'Classes' })[0])
    fireEvent.click(screen.getByRole('tab', { name: /Mon/ }))
    expect(screen.getByText('AI Applications in Health Care')).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: /Thu/ }))
    expect(screen.getByText('Conflict')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Refresh schedule' }))
    expect(screen.getByRole('dialog', { name: 'Update your schedule' })).toBeTruthy()
  })

  it('advances empty class days to the next day with meetings and wraps to Monday', () => {
    renderAuthenticated()
    fireEvent.click(screen.getAllByRole('button', { name: 'Classes' })[0])

    fireEvent.click(screen.getByRole('tab', { name: /Tue/ }))
    expect(screen.getByRole('tab', { name: /Thu/ }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('heading', { name: 'Thursday' })).toBeTruthy()

    fireEvent.click(screen.getByRole('tab', { name: /Fri/ }))
    expect(screen.getByRole('tab', { name: /Mon/ }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('heading', { name: 'Monday' })).toBeTruthy()
  })

  it('refreshes directly with the password saved at sign-in', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => webhookPayload } as Response)
    renderAuthenticated('saved-secret')
    fireEvent.click(screen.getAllByRole('button', { name: 'Classes' })[0])
    fireEvent.click(screen.getByRole('button', { name: 'Refresh schedule' }))
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/schedule', expect.objectContaining({ body: JSON.stringify({ Username: 'student-demo', Password: 'saved-secret' }) })))
    expect(screen.queryByRole('dialog', { name: 'Update your schedule' })).toBeNull()
  })

  it('saves a password entered by an existing session and reuses it next time', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => webhookPayload } as Response)
    renderAuthenticated()
    fireEvent.click(screen.getAllByRole('button', { name: 'Classes' })[0])
    fireEvent.click(screen.getByRole('button', { name: 'Refresh schedule' }))
    const dialog = screen.getByRole('dialog', { name: 'Update your schedule' })
    fireEvent.change(within(dialog).getByLabelText('Password'), { target: { value: 'one-time-secret' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Refresh schedule' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Update your schedule' })).toBeNull())
    expect(sessionStorage.getItem('rhu-student-credential-v1')).toContain('one-time-secret')
    vi.mocked(fetch).mockClear()
    fireEvent.click(screen.getByRole('button', { name: 'Refresh schedule' }))
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/schedule', expect.objectContaining({ body: JSON.stringify({ Username: 'student-demo', Password: 'one-time-secret' }) })))
  })

  it('provides six unselected photo destinations with their real coordinates', () => {
    renderAuthenticated()
    fireEvent.click(screen.getAllByRole('button', { name: 'Nav' })[0])
    for (const label of ['Finance', 'Cafeteria', 'Block C', 'Library', 'Admissions', "Student's Affairs"]) {
      expect(screen.getByRole('button', { name: new RegExp(label) }).getAttribute('aria-pressed')).toBe('false')
    }
    expect(screen.queryByRole('button', { name: /Block I/ })).toBeNull()
    for (const image of ['Finance office', 'cafeteria building', 'Block C', 'RHU Library', 'Admissions Office', 'Student Affairs office']) expect(screen.getByRole('img', { name: new RegExp(image, 'i') })).toBeTruthy()
    expect(Object.fromEntries(CAMPUS_DESTINATIONS.map(item => [item.id, item.coordinate]))).toEqual({
      finance: { lat: 33.71375, lng: 35.48433333333333 },
      cafeteria: { lat: 33.71349606857637, lng: 35.48392689194502 },
      'block-c': { lat: 33.71447222222222, lng: 35.48391666666667 },
      library: { lat: 33.71377777777778, lng: 35.48425 },
      admissions: { lat: 33.71322673114103, lng: 35.48393880973027 },
      'student-affairs': { lat: 33.71325, lng: 35.48386111111111 },
    })
    expect(screen.queryByText(/custom coordinate/i)).toBeNull()
    expect(screen.queryByText(/Demo coordinate/)).toBeNull()
    expect(screen.queryByText('Selected destination')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /Finance/ }))
    expect(screen.getByRole('dialog', { name: 'Finance' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Finance' })).toBeTruthy()
    expect(screen.getByText('Distance from you')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Start Navigation' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Start camera route' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Use live location' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Start Navigation' }))
    const liveNavigation = screen.getByRole('dialog', { name: 'Navigation to Finance' })
    expect(liveNavigation.parentElement).toBe(document.body)
    expect(document.documentElement.style.overflow).toBe('hidden')
    expect(document.body.style.overflow).toBe('hidden')
    expect(document.body.style.position).toBe('fixed')

    fireEvent.click(screen.getByRole('button', { name: 'End' }))
    fireEvent.click(screen.getByRole('button', { name: 'Close destination details' }))
    expect(document.documentElement.style.overflow).toBe('')
    expect(document.body.style.overflow).toBe('')
    expect(document.body.style.position).toBe('')
  })

  it('calculates the selected destination distance automatically', async () => {
    const getCurrentPosition = vi.fn((success: PositionCallback) => success({
      coords: {
        accuracy: 5,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        latitude: 33.71377777777778,
        longitude: 35.48425,
        speed: null,
        toJSON: () => ({}),
      },
      timestamp: Date.now(),
      toJSON: () => ({}),
    }))
    vi.stubGlobal('isSecureContext', true)
    vi.stubGlobal('navigator', { ...navigator, geolocation: { getCurrentPosition } })

    renderAuthenticated()
    fireEvent.click(screen.getAllByRole('button', { name: 'Nav' })[0])
    fireEvent.click(screen.getByRole('button', { name: /Library/ }))

    expect(getCurrentPosition).toHaveBeenCalledOnce()
    expect(await screen.findByText('0.0 m')).toBeTruthy()
  })

  it('shows the cafeteria menu without exposing assistant setup notes', async () => {
    renderAuthenticated()
    fireEvent.click(screen.getAllByRole('button', { name: 'Menu' })[0])
    expect(screen.getByText('Chicken shawarma plate')).toBeTruthy()
    expect(screen.getByText('$6.50')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Open Campus Assistant' }))
    expect(await screen.findByRole('dialog', { name: 'Campus Assistant' })).toBeTruthy()
    expect(screen.queryByText(/Connection pending|Assistant coming soon|n8n|VITE_CHAT_API_URL/)).toBeNull()
  })

  it('clears schedule and chat session data on logout', async () => {
    sessionStorage.setItem('rhu-chat-session-v1', 'chat-session')
    renderAuthenticated()
    fireEvent.click(screen.getByRole('button', { name: 'Log out' }))
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Sign in to continue' })).toBeTruthy())
    expect(sessionStorage.getItem('rhu-student-session-v1')).toBeNull()
    expect(sessionStorage.getItem('rhu-student-credential-v1')).toBeNull()
    expect(sessionStorage.getItem('rhu-chat-session-v1')).toBeNull()
  })
})
