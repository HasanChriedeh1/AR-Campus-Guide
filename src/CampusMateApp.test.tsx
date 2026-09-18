// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import CampusMateApp from './CampusMateApp'

let watchSuccess: PositionCallback | null
let watchError: PositionErrorCallback | null
let clearWatch: ReturnType<typeof vi.fn>
let getUserMedia: ReturnType<typeof vi.fn>
let requestMotionPermission: ReturnType<typeof vi.fn>
let stopTrack: ReturnType<typeof vi.fn>
let speechSpeak: ReturnType<typeof vi.fn>
let speechCancel: ReturnType<typeof vi.fn>
let storage: Map<string, string>

beforeEach(() => {
  watchSuccess = null
  watchError = null
  clearWatch = vi.fn()
  stopTrack = vi.fn()
  getUserMedia = vi.fn().mockResolvedValue({ getTracks: () => [{ stop: stopTrack }] })
  requestMotionPermission = vi.fn().mockResolvedValue('granted')
  speechSpeak = vi.fn()
  speechCancel = vi.fn()
  storage = new Map()

  class MockSpeechSynthesisUtterance {
    text: string
    lang = ''
    rate = 1

    constructor(text: string) {
      this.text = text
    }
  }

  const localStorageMock: Storage = {
    get length() { return storage.size },
    clear: () => storage.clear(),
    getItem: key => storage.get(key) ?? null,
    key: index => [...storage.keys()][index] ?? null,
    removeItem: key => { storage.delete(key) },
    setItem: (key, value) => { storage.set(key, value) },
  }

  Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true })
  Object.defineProperty(HTMLMediaElement.prototype, 'play', { configurable: true, value: vi.fn().mockResolvedValue(undefined) })
  Object.defineProperty(window, 'localStorage', { configurable: true, value: localStorageMock })
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: localStorageMock })
  Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { cancel: speechCancel, speak: speechSpeak } })
  Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: MockSpeechSynthesisUtterance })
  Object.defineProperty(window, 'DeviceOrientationEvent', {
    configurable: true,
    value: { requestPermission: requestMotionPermission },
  })
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia },
  })
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: {
      clearWatch,
      getCurrentPosition: vi.fn(),
      watchPosition: vi.fn((success: PositionCallback, error: PositionErrorCallback) => {
        watchSuccess = success
        watchError = error
        return 73
      }),
    },
  })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

function openCameraRoute() {
  render(<CampusMateApp />)
  fireEvent.click(screen.getAllByRole('button', { name: 'Campus Guide' })[0])
  fireEvent.click(screen.getByRole('button', { name: 'Start camera route' }))
}

function sendPosition(overrides: Partial<Omit<GeolocationCoordinates, 'toJSON'>> = {}) {
  const coordinates: GeolocationCoordinates = {
    latitude: 33.71314599891659,
    longitude: 35.48269627287705,
    accuracy: 7,
    altitude: null,
    altitudeAccuracy: null,
    heading: null,
    speed: null,
    ...overrides,
    toJSON: () => ({}),
  }
  act(() => watchSuccess?.({ coords: coordinates, timestamp: Date.now() } as GeolocationPosition))
}

function sendOrientation(
  type: 'deviceorientation' | 'deviceorientationabsolute',
  values: { alpha?: number; beta?: number; gamma?: number; absolute?: boolean; webkitCompassHeading?: number; webkitCompassAccuracy?: number } = {},
) {
  const orientation = new Event(type)
  Object.defineProperties(orientation, {
    alpha: { value: values.alpha ?? 0 },
    beta: { value: values.beta ?? 90 },
    gamma: { value: values.gamma ?? 0 },
    absolute: { value: values.absolute ?? type === 'deviceorientationabsolute' },
    ...(values.webkitCompassHeading === undefined ? {} : { webkitCompassHeading: { value: values.webkitCompassHeading } }),
    ...(values.webkitCompassAccuracy === undefined ? {} : { webkitCompassAccuracy: { value: values.webkitCompassAccuracy } }),
  })
  act(() => window.dispatchEvent(orientation))
}

describe('live camera navigation', () => {
  it('keeps navigation fixed to the selected preset and removes custom coordinates', () => {
    render(<CampusMateApp />)
    fireEvent.click(screen.getAllByRole('button', { name: 'Campus Guide' })[0])
    expect(screen.getByRole('heading', { name: 'Student Parking · Point B' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Add custom coordinate' })).toBeNull()
  })

  it('uses fresh GPS and an approved compass event to render a live, screen-relative arrow', async () => {
    openCameraRoute()
    await waitFor(() => expect(requestMotionPermission).toHaveBeenCalledWith(true))
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(1))
    expect(screen.getByText('—')).toBeTruthy()

    sendPosition()
    sendOrientation('deviceorientationabsolute')

    expect(await screen.findByText('phone compass')).toBeTruthy()
    expect(screen.queryByText('—')).toBeNull()
    expect(screen.getByText(/Follow the arrow/)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Exit navigation' }))
    expect(clearWatch).toHaveBeenCalledWith(73)
    expect(stopTrack).toHaveBeenCalledTimes(1)
  })

  it('shows a permission error instead of reverting to the Point A demo coordinate', async () => {
    openCameraRoute()
    await waitFor(() => expect(watchError).not.toBeNull())
    act(() => watchError?.({ code: 1, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2 } as GeolocationPositionError))

    expect(await screen.findByText(/Location access was denied/)).toBeTruthy()
    expect(screen.getByText('—')).toBeTruthy()
    expect(screen.queryByText(/Point A/)).toBeNull()
  })

  it('uses GPS course only while moving when no compass heading is available', async () => {
    openCameraRoute()
    sendPosition({ heading: 90, speed: 1 })

    expect(await screen.findByText('walking direction')).toBeTruthy()
    expect(screen.queryByText('—')).toBeNull()
  })

  it('recomputes remaining distance from every live location fix', () => {
    openCameraRoute()
    sendPosition()
    const initialDistance = document.querySelector('.precision-distance > strong')?.textContent

    sendPosition({ longitude: 35.48279627287705 })
    const updatedDistance = document.querySelector('.precision-distance > strong')?.textContent

    expect(initialDistance).toBeTruthy()
    expect(updatedDistance).toBe('0.0 m')
    expect(updatedDistance).not.toBe(initialDistance)
  })

  it('rejects unanchored relative orientation but accepts the iOS WebKit compass heading', async () => {
    openCameraRoute()
    await waitFor(() => expect(requestMotionPermission).toHaveBeenCalledWith(true))
    sendPosition()

    sendOrientation('deviceorientation', { alpha: 0, absolute: false })
    expect(screen.queryByText('phone compass')).toBeNull()
    expect(screen.getByLabelText('Calibrating direction')).toBeTruthy()

    sendOrientation('deviceorientation', { absolute: false, webkitCompassHeading: 0, webkitCompassAccuracy: 5 })
    expect(await screen.findByText('phone compass')).toBeTruthy()
    expect(screen.getByLabelText(/Turn 90° right/)).toBeTruthy()

    sendOrientation('deviceorientation', { absolute: false, webkitCompassHeading: 90, webkitCompassAccuracy: 5 })
    expect(screen.getByLabelText(/^Turn/).getAttribute('aria-label')).not.toBe('Turn 90° right')
  })

  it('filters stationary compass jitter without delaying a deliberate turn', async () => {
    openCameraRoute()
    await waitFor(() => expect(requestMotionPermission).toHaveBeenCalledWith(true))
    sendPosition()
    sendOrientation('deviceorientation', { webkitCompassHeading: 0, webkitCompassAccuracy: 5 })

    const arrow = document.querySelector('.precision-arrow svg') as SVGSVGElement
    const initialTransform = arrow.style.transform
    sendOrientation('deviceorientation', { webkitCompassHeading: 0.8, webkitCompassAccuracy: 5 })
    sendOrientation('deviceorientation', { webkitCompassHeading: 359.4, webkitCompassAccuracy: 5 })
    expect(arrow.style.transform).toBe(initialTransform)

    sendOrientation('deviceorientation', { webkitCompassHeading: 30, webkitCompassAccuracy: 5 })
    expect(arrow.style.transform).not.toBe(initialTransform)
  })

  it('stabilizes the contextual cue before animating a new instruction', async () => {
    vi.useFakeTimers()
    openCameraRoute()
    await act(async () => { await Promise.resolve() })
    sendPosition()
    sendOrientation('deviceorientation', { webkitCompassHeading: 0, webkitCompassAccuracy: 5 })

    expect(screen.getByRole('status').textContent).toBe('Hold steady')
    act(() => vi.advanceTimersByTime(749))
    expect(screen.getByRole('status').textContent).toBe('Hold steady')
    act(() => vi.advanceTimersByTime(1))
    expect(screen.getByRole('status').textContent).toBe('Turn right now')
  })

  it('speaks stable cues by default, throttles them, and supports mute and cleanup', async () => {
    vi.useFakeTimers()
    openCameraRoute()
    await act(async () => { await Promise.resolve() })

    expect(speechSpeak).toHaveBeenCalledTimes(1)
    expect(speechSpeak.mock.calls[0][0].text).toBe('Starting guidance to Student Parking · Point B')

    sendPosition()
    sendOrientation('deviceorientation', { webkitCompassHeading: 0, webkitCompassAccuracy: 5 })
    act(() => vi.advanceTimersByTime(750))
    expect(speechSpeak).toHaveBeenCalledTimes(1)
    act(() => vi.advanceTimersByTime(2_250))
    expect(speechSpeak).toHaveBeenCalledTimes(2)
    expect(speechSpeak.mock.calls[1][0].text).toBe('Turn right now')

    fireEvent.click(screen.getByRole('button', { name: 'Mute spoken guidance' }))
    expect(speechCancel).toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Unmute spoken guidance' }))
    expect(speechSpeak).toHaveBeenCalledTimes(3)
    expect(speechSpeak.mock.calls[2][0].text).toBe('Turn right now')

    fireEvent.click(screen.getByRole('button', { name: 'Exit navigation' }))
    expect(speechCancel.mock.calls.length).toBeGreaterThanOrEqual(2)
  })

  it('keeps visual guidance available when speech synthesis is unsupported', () => {
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: undefined })
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: undefined })
    openCameraRoute()

    expect(screen.getByRole('button', { name: 'Spoken guidance unavailable' }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByRole('status').textContent).toBe('Hold steady')
  })

  it('falls back to a fresh walking direction when compass updates stop', async () => {
    vi.useFakeTimers()
    openCameraRoute()
    await act(async () => { await Promise.resolve() })
    sendPosition({ heading: 90, speed: 1 })
    sendOrientation('deviceorientation', { webkitCompassHeading: 0, webkitCompassAccuracy: 5 })

    expect(screen.getByText('phone compass')).toBeTruthy()
    act(() => vi.advanceTimersByTime(1_501))

    expect(screen.getByText('walking direction')).toBeTruthy()
  })

  it('turns green when aligned and confirms arrival only after three accurate fixes', async () => {
    openCameraRoute()
    await waitFor(() => expect(requestMotionPermission).toHaveBeenCalledWith(true))
    sendPosition()
    sendOrientation('deviceorientationabsolute', { alpha: 270, beta: 90, gamma: 0, absolute: true })

    expect(document.querySelector('.apple-navigation')?.classList.contains('is-aligned')).toBe(true)

    sendPosition({ longitude: 35.48279627287705, accuracy: 5 })
    sendPosition({ longitude: 35.48279627287705, accuracy: 5 })
    expect(screen.queryByLabelText('Destination reached')).toBeNull()
    sendPosition({ longitude: 35.48279627287705, accuracy: 5 })

    expect(screen.getByLabelText('Destination reached')).toBeTruthy()
    expect(document.querySelector('.apple-navigation')?.classList.contains('is-arrived')).toBe(true)
    expect(speechSpeak.mock.calls.at(-1)?.[0].text).toBe('You have arrived')
  })

  it('keeps guidance visible on the gradient fallback when the camera fails', async () => {
    getUserMedia.mockRejectedValueOnce(new DOMException('denied', 'NotAllowedError'))
    openCameraRoute()

    await waitFor(() => expect(screen.getByText(/Camera permission was denied/)).toBeTruthy())
    expect(document.querySelector('.apple-navigation')?.classList.contains('camera-unavailable')).toBe(true)
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy()
    expect(screen.getByLabelText('Calibrating direction')).toBeTruthy()
  })
})
