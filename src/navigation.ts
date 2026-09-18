export type GeoCoordinate = {
  lat: number
  lng: number
}

export type NavigationDestination = {
  id: string
  label: string
  coordinate: GeoCoordinate
}

export type LivePosition = GeoCoordinate & {
  accuracy: number
  timestamp: number
  course: number | null
}

export type NavigationManeuver = {
  id: string
  instruction: string
  bearing: number
  distanceMeters: number
}

/**
 * Reserved for a future campus pedestrian-routing provider. The camera UI only
 * needs the current maneuver's bearing and remaining route distance.
 */
export type CampusWalkingRoute = {
  geometry: GeoCoordinate[]
  remainingDistanceMeters: number
  etaMinutes: number
  maneuvers: NavigationManeuver[]
  activeManeuverIndex: number
}

export type NavigationGuidance = {
  mode: 'direct' | 'route'
  bearing: number
  distanceMeters: number
  instruction: string
}

export type HeadingSource = 'compass' | 'course'

export type LiveHeading = {
  degrees: number
  source: HeadingSource
}

const EARTH_RADIUS_METERS = 6_371_000

export function normalizeDegrees(degrees: number) {
  return ((degrees % 360) + 360) % 360
}

export function distanceInMeters(from: GeoCoordinate, to: GeoCoordinate) {
  const dLat = toRadians(to.lat - from.lat)
  const dLng = toRadians(to.lng - from.lng)
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.sin(dLng / 2) ** 2
  return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function bearingBetween(from: GeoCoordinate, to: GeoCoordinate) {
  const dLng = toRadians(to.lng - from.lng)
  const fromLat = toRadians(from.lat)
  const toLat = toRadians(to.lat)
  const y = Math.sin(dLng) * Math.cos(toLat)
  const x = Math.cos(fromLat) * Math.sin(toLat) - Math.sin(fromLat) * Math.cos(toLat) * Math.cos(dLng)
  return normalizeDegrees(toDegrees(Math.atan2(y, x)))
}

export function relativeBearing(targetBearing: number, deviceHeading: number) {
  return normalizeDegrees(targetBearing - deviceHeading)
}

/** Smooth an angle along its shortest circular arc. */
export function smoothHeading(previous: number | null, next: number, amount = 0.28) {
  if (previous === null) return normalizeDegrees(next)
  const shortestArc = normalizeDegrees(next - previous + 180) - 180
  return normalizeDegrees(previous + shortestArc * amount)
}

export function getNavigationGuidance(
  position: GeoCoordinate,
  destination: NavigationDestination,
  route: CampusWalkingRoute | null = null,
): NavigationGuidance {
  const maneuver = route?.maneuvers[route.activeManeuverIndex]
  if (maneuver) {
    return {
      mode: 'route',
      bearing: normalizeDegrees(maneuver.bearing),
      distanceMeters: route.remainingDistanceMeters,
      instruction: maneuver.instruction,
    }
  }

  return {
    mode: 'direct',
    bearing: bearingBetween(position, destination.coordinate),
    distanceMeters: distanceInMeters(position, destination.coordinate),
    instruction: `Head toward ${destination.label}`,
  }
}

export function formatDistance(meters: number) {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`
}

function toRadians(degrees: number) {
  return degrees * Math.PI / 180
}

function toDegrees(radians: number) {
  return radians * 180 / Math.PI
}
