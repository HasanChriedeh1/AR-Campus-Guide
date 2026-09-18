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
let storage: Map<string, string>

beforeEach(() => {
  watchSuccess = null
  watchError = null
  clearWatch = vi.fn()
  stopTrack = vi.fn()
  getUserMedia = vi.fn().mockResolvedValue({ getTracks: () => [{ stop: stopTrack }] })
  requestMotionPermission = vi.fn().mockResolvedValue('granted')
  storage = new Map()

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

afterEach(() => cleanup())

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

describe('live camera navigation', () => {
  it('uses fresh GPS and an approved compass event to render a live, screen-relative arrow', async () => {
    openCameraRoute()
    await waitFor(() => expect(requestMotionPermission).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(1))
    expect(screen.getAllByText('—')).toHaveLength(2)

    sendPosition()
    const orientation = new Event('deviceorientationabsolute')
    Object.defineProperties(orientation, { absolute: { value: true }, alpha: { value: 0 } })
    act(() => window.dispatchEvent(orientation))

    expect(await screen.findByText('phone compass')).toBeTruthy()
    expect(screen.queryByText('—')).toBeNull()
    expect(screen.getByText(/to Student Parking · Point B/)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Exit navigation' }))
    expect(clearWatch).toHaveBeenCalledWith(73)
    expect(stopTrack).toHaveBeenCalledTimes(1)
  })

  it('shows a permission error instead of reverting to the Point A demo coordinate', async () => {
    openCameraRoute()
    await waitFor(() => expect(watchError).not.toBeNull())
    act(() => watchError?.({ code: 1, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2 } as GeolocationPositionError))

    expect(await screen.findByText(/Location access was denied/)).toBeTruthy()
    expect(screen.getAllByText('—')).toHaveLength(2)
    expect(screen.queryByText(/Point A/)).toBeNull()
  })

  it('uses GPS course only while moving when no compass heading is available', async () => {
    openCameraRoute()
    sendPosition({ heading: 90, speed: 1 })

    expect(await screen.findByText('walking direction')).toBeTruthy()
    expect(screen.queryByText('—')).toBeNull()
  })

  it('updates from regular deviceorientation events that do not expose the absolute flag', async () => {
    openCameraRoute()
    await waitFor(() => expect(requestMotionPermission).toHaveBeenCalledTimes(1))
    sendPosition()

    const firstOrientation = new Event('deviceorientation')
    Object.defineProperty(firstOrientation, 'alpha', { value: 0 })
    act(() => window.dispatchEvent(firstOrientation))

    expect(await screen.findByText('phone compass')).toBeTruthy()
    expect(screen.getByLabelText(/Turn 90 degrees/)).toBeTruthy()

    const nextOrientation = new Event('deviceorientation')
    Object.defineProperty(nextOrientation, 'alpha', { value: 90 })
    act(() => window.dispatchEvent(nextOrientation))

    expect(screen.getByLabelText(/^Turn/).getAttribute('aria-label')).not.toBe('Turn 90 degrees')
  })
})
