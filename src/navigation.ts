export type GeoCoordinate = {
  lat: number
  lng: number
}

export type NavigationDestination = {
  id: string
  label: string
  description: string
  imageSrc: string
  imageAlt: string
  isDemoCoordinate: boolean
  coordinate: GeoCoordinate
}

export type GuidanceCueId =
  | 'hold-steady'
  | 'go-straight'
  | 'bear-left'
  | 'bear-right'
  | 'turn-left'
  | 'turn-right'
  | 'turn-around'
  | 'arrived'

export type GuidanceCue = {
  id: GuidanceCueId
  label: string
  announcement: string
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
  /** Used to fall back to GPS travel direction if compass events stop. */
  updatedAt: number
}

const EARTH_RADIUS_METERS = 6_371_000
const STRAIGHT_THRESHOLD_DEGREES = 15
const BEAR_THRESHOLD_DEGREES = 45
const TURN_AROUND_THRESHOLD_DEGREES = 135
const CUE_HYSTERESIS_DEGREES = 5

const GUIDANCE_CUES: Record<GuidanceCueId, GuidanceCue> = {
  'hold-steady': { id: 'hold-steady', label: 'Hold steady', announcement: 'Hold steady' },
  'go-straight': { id: 'go-straight', label: 'Go straight', announcement: 'Go straight' },
  'bear-left': { id: 'bear-left', label: 'Bear left', announcement: 'Bear left' },
  'bear-right': { id: 'bear-right', label: 'Bear right', announcement: 'Bear right' },
  'turn-left': { id: 'turn-left', label: 'Turn left now', announcement: 'Turn left now' },
  'turn-right': { id: 'turn-right', label: 'Turn right now', announcement: 'Turn right now' },
  'turn-around': { id: 'turn-around', label: 'Turn around', announcement: 'Turn around' },
  arrived: { id: 'arrived', label: 'You\u2019ve arrived', announcement: 'You have arrived' },
}

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

/** Return the shortest signed turn from the device heading to the target. */
export function signedRelativeBearing(targetBearing: number, deviceHeading: number) {
  const turn = normalizeDegrees(targetBearing - deviceHeading + 180) - 180
  return Object.is(turn, -0) ? 0 : turn
}

/**
 * Convert the live relative bearing into a calm, human-readable instruction.
 * The previous stable cue expands its own range slightly so small compass
 * changes near a threshold do not make the UI and voice guidance chatter.
 */
export function getGuidanceCue(
  turn: number | null,
  arrived = false,
  previousCueId?: GuidanceCueId,
): GuidanceCue {
  if (arrived) return GUIDANCE_CUES.arrived
  if (turn === null || !Number.isFinite(turn)) return GUIDANCE_CUES['hold-steady']

  const magnitude = Math.abs(turn)
  const direction = turn < 0 ? 'left' : 'right'

  if (previousCueId === 'go-straight' && magnitude <= STRAIGHT_THRESHOLD_DEGREES + CUE_HYSTERESIS_DEGREES) {
    return GUIDANCE_CUES['go-straight']
  }
  if (previousCueId === `bear-${direction}` && magnitude >= STRAIGHT_THRESHOLD_DEGREES - CUE_HYSTERESIS_DEGREES
    && magnitude <= BEAR_THRESHOLD_DEGREES + CUE_HYSTERESIS_DEGREES) {
    return GUIDANCE_CUES[previousCueId]
  }
  if (previousCueId === `turn-${direction}` && magnitude >= BEAR_THRESHOLD_DEGREES - CUE_HYSTERESIS_DEGREES
    && magnitude <= TURN_AROUND_THRESHOLD_DEGREES + CUE_HYSTERESIS_DEGREES) {
    return GUIDANCE_CUES[previousCueId]
  }
  if (previousCueId === 'turn-around' && magnitude >= TURN_AROUND_THRESHOLD_DEGREES - CUE_HYSTERESIS_DEGREES) {
    return GUIDANCE_CUES['turn-around']
  }

  if (magnitude <= STRAIGHT_THRESHOLD_DEGREES) return GUIDANCE_CUES['go-straight']
  if (magnitude <= BEAR_THRESHOLD_DEGREES) return GUIDANCE_CUES[`bear-${direction}`]
  if (magnitude <= TURN_AROUND_THRESHOLD_DEGREES) return GUIDANCE_CUES[`turn-${direction}`]
  return GUIDANCE_CUES['turn-around']
}

/** Keep a normalized angle on a continuous axis so CSS never spins the long way. */
export function unwrapDegrees(previous: number | null, next: number) {
  const normalizedNext = normalizeDegrees(next)
  if (previous === null) return normalizedNext
  const previousNormalized = normalizeDegrees(previous)
  const shortestArc = normalizeDegrees(normalizedNext - previousNormalized + 180) - 180
  return previous + shortestArc
}

/**
 * Calculate the direction faced by the rear camera from an absolute
 * DeviceOrientation reading. This is the tilt-compensated algorithm described
 * by the Device Orientation specification for augmented-reality interfaces.
 */
export function compassHeadingFromOrientation(
  alpha: number | null,
  beta: number | null,
  gamma: number | null,
  screenAngle = 0,
) {
  if (alpha === null || beta === null || gamma === null) return null
  if (![alpha, beta, gamma, screenAngle].every(Number.isFinite)) return null

  // When the device is flat, the camera vector has no horizontal component;
  // use the conventional top-of-device heading instead.
  if (Math.abs(beta) < 0.0001 && Math.abs(gamma) < 0.0001) {
    return normalizeDegrees(360 - alpha + screenAngle)
  }

  const degreesToRadians = Math.PI / 180
  const x = beta * degreesToRadians
  const y = gamma * degreesToRadians
  const z = alpha * degreesToRadians
  const cY = Math.cos(y)
  const cZ = Math.cos(z)
  const sX = Math.sin(x)
  const sY = Math.sin(y)
  const sZ = Math.sin(z)
  const vectorX = -cZ * sY - sZ * sX * cY
  const vectorY = -sZ * sY + cZ * sX * cY

  return normalizeDegrees(Math.atan2(vectorX, vectorY) / degreesToRadians + screenAngle)
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
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`
  if (meters >= 100) return `${Math.round(meters)} m`
  return `${meters.toFixed(1)} m`
}

function toRadians(degrees: number) {
  return degrees * Math.PI / 180
}

function toDegrees(radians: number) {
  return radians * 180 / Math.PI
}
