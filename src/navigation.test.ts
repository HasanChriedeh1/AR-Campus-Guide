import { describe, expect, it } from 'vitest'
import { bearingBetween, compassHeadingFromOrientation, distanceInMeters, getNavigationGuidance, relativeBearing, signedRelativeBearing, smoothHeading, unwrapDegrees } from './navigation'
import type { CampusWalkingRoute, NavigationDestination } from './navigation'

const destination: NavigationDestination = {
  id: 'student-parking',
  label: 'Student Parking · Point B',
  coordinate: { lat: 33.71314599891659, lng: 35.48279627287705 },
}

describe('navigation calculations', () => {
  it('calculates direct distance and bearing from the latest coordinate', () => {
    const position = { lat: destination.coordinate.lat, lng: destination.coordinate.lng - 0.0001 }
    const guidance = getNavigationGuidance(position, destination)

    expect(guidance.mode).toBe('direct')
    expect(guidance.distanceMeters).toBeGreaterThan(8)
    expect(guidance.distanceMeters).toBeLessThan(10)
    expect(guidance.bearing).toBeGreaterThan(89)
    expect(guidance.bearing).toBeLessThan(91)
    expect(distanceInMeters(position, destination.coordinate)).toBe(guidance.distanceMeters)
    expect(bearingBetween(position, destination.coordinate)).toBe(guidance.bearing)
  })

  it('wraps relative bearings and smooths across north instead of spinning around the dial', () => {
    expect(relativeBearing(10, 350)).toBe(20)
    expect(relativeBearing(350, 10)).toBe(340)
    expect(signedRelativeBearing(10, 350)).toBe(20)
    expect(signedRelativeBearing(350, 10)).toBe(-20)
    expect(smoothHeading(350, 10, 0.5)).toBe(0)
    expect(unwrapDegrees(359, 1)).toBe(361)
    expect(unwrapDegrees(361, 359)).toBe(359)
  })

  it('calculates a tilt-compensated camera heading and corrects screen rotation', () => {
    expect(compassHeadingFromOrientation(0, 90, 0)).toBeCloseTo(0)
    expect(compassHeadingFromOrientation(90, 90, 0)).toBeCloseTo(270)
    expect(compassHeadingFromOrientation(270, 45, 0)).toBeCloseTo(90)
    expect(compassHeadingFromOrientation(0, 90, 0, 90)).toBeCloseTo(90)
    expect(compassHeadingFromOrientation(45, 0, 0)).toBeCloseTo(315)
    expect(compassHeadingFromOrientation(null, 90, 0)).toBeNull()
  })

  it('accepts future walking-route guidance without changing the camera interface', () => {
    const route: CampusWalkingRoute = {
      geometry: [],
      remainingDistanceMeters: 124,
      etaMinutes: 2,
      activeManeuverIndex: 0,
      maneuvers: [{ id: 'turn-right', instruction: 'Turn right at the library', bearing: 135, distanceMeters: 24 }],
    }

    expect(getNavigationGuidance({ lat: 33.713, lng: 35.48 }, destination, route)).toEqual({
      mode: 'route',
      bearing: 135,
      distanceMeters: 124,
      instruction: 'Turn right at the library',
    })
  })
})
