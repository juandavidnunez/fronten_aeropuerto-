/**
 * Flight animation bus — MapCanvas registers the renderer; session store awaits completion.
 * Duration scale: 1 hour of flight time = 1 second of animation.
 */
import type { TripSegment } from '@/types'

export type FlightSegment = Pick<TripSegment, 'origin' | 'dest' | 'flight_time_min' | 'aircraft_type' | 'cost_usd'>

export interface InTransitState {
  origin: string
  dest: string
  aircraft_type: string
  flight_time_min: number
  cost_usd: number
  progress: number
}

type RenderFn = (segment: FlightSegment, onProgress: (t: number) => void) => { abort: () => void }

let renderFn: RenderFn | null = null
let abortCurrent: (() => void) | null = null

/** 1 hour of flight → 1 second on screen (min 2s, max 90s). */
export function flightAnimationMs(flightTimeMin: number): number {
  const hours = flightTimeMin / 60
  return Math.min(90_000, Math.max(2_000, hours * 1_000))
}

export function registerFlightRenderer(fn: RenderFn) {
  renderFn = fn
}

export function unregisterFlightRenderer() {
  renderFn = null
  abortFlightAnimation()
}

export function abortFlightAnimation() {
  abortCurrent?.()
  abortCurrent = null
}

export function waitForFlightAnimation(segment: FlightSegment): Promise<void> {
  const ms = flightAnimationMs(segment.flight_time_min)
  if (!renderFn) {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
  return new Promise((resolve, reject) => {
    let settled = false
    const { abort } = renderFn!(segment, (t) => {
      if (t >= 1 && !settled) {
        settled = true
        abortCurrent = null
        resolve()
      }
    })
    abortCurrent = () => {
      if (settled) return
      settled = true
      abort()
      abortCurrent = null
      reject(new Error('ROUTE_BLOCKED'))
    }
  })
}
