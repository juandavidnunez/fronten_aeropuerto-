/**
 * API layer — wraps every backend endpoint.
 * Unwraps ApiResponse<T> and throws on error so callers get clean data.
 */
import axios from 'axios'
import type {
  ApiResponse, Airport, Route, GraphSummary,
  ItineraryResponse, BestRouteResponse,
  SessionState, FlightOption, ActivityOption, JobOption, FlyResult, Suggestion,
  BlockedRoute, RecalculateResponse,
  TripReport, TripSummary,
} from '@/types'

const http = axios.create({ baseURL: '/api/v1' })

async function unwrap<T>(p: Promise<{ data: ApiResponse<T> }>): Promise<T> {
  const { data: env } = await p
  if (env.error) throw new Error(env.error)
  return env.data as T
}

// R1
export const graphApi = {
  load:   () => unwrap<GraphSummary>(http.get('/graph/load')),
  status: () => unwrap<GraphSummary>(http.get('/graph/status')),
  nodes:  () => unwrap<Airport[]>(http.get('/graph/nodes')),
  node:   (id: string) => unwrap<Airport>(http.get(`/graph/nodes/${id}`)),
  edges:  () => unwrap<Route[]>(http.get('/graph/edges')),
  reload: () => unwrap<GraphSummary>(http.post('/graph/reload')),
}

// R2
export const planApi = {
  itinerary: (b: { origin: string; budget_usd: number; time_hours: number; aircraft_types: string[]; include_secondary: boolean }) =>
    unwrap<ItineraryResponse>(http.post('/plan/itinerary', b)),
  bestRoute: (b: { origin: string; destination: string; criteria: string[]; aircraft_types: string[]; include_secondary: boolean }) =>
    unwrap<BestRouteResponse>(http.post('/plan/best-route', b)),
}

// R3
export const dynamicApi = {
  start:      (b: { origin: string; initial_budget: number; time_hours: number }) => unwrap<SessionState>(http.post('/dynamic/start', b)),
  flights:    (s: string) => unwrap<FlightOption[]>(http.get('/dynamic/flights', { params: { session_id: s } })),
  activities: (s: string) => unwrap<ActivityOption[]>(http.get('/dynamic/activities', { params: { session_id: s } })),
  jobs:       (s: string) => unwrap<JobOption[]>(http.get('/dynamic/jobs', { params: { session_id: s } })),
  suggest:    (s: string) => unwrap<Suggestion>(http.get('/dynamic/suggest', { params: { session_id: s } })),
  fly:        (b: { session_id: string; dest: string; aircraft_type: string }) => unwrap<FlyResult>(http.post('/dynamic/fly', b)),
  activity:   (b: { session_id: string; activity_name: string }) => unwrap<any>(http.post('/dynamic/activity', b)),
  job:        (b: { session_id: string; job_name: string; hours: number }) => unwrap<any>(http.post('/dynamic/job', b)),
  end:        (session_id: string) => unwrap<any>(http.post('/dynamic/end', { session_id })),
}

// R4
export const eventsApi = {
  block:       (b: { origin: string; dest: string; session_id?: string }) => unwrap<any>(http.post('/events/block-route', b)),
  unblock:     (b: { origin: string; dest: string }) => unwrap<any>(http.post('/events/unblock-route', b)),
  recalculate: (b: { current_node: string; final_destination: string }) => unwrap<RecalculateResponse>(http.post('/events/recalculate', b)),
  blocked:     () => unwrap<BlockedRoute[]>(http.get('/events/blocked-routes')),
}

// R5
export const reportApi = {
  full:    (id: string) => unwrap<TripReport>(http.get(`/report/${id}`)),
  summary: (id: string) => unwrap<TripSummary>(http.get(`/report/${id}/summary`)),
}
