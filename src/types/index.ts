/** TypeScript interfaces — mirrors FastAPI Pydantic schemas 1:1 */

export interface ApiResponse<T> { data: T | null; error: string | null }

// R1
export interface ActivitySchema { name: string; type: 'obligatoria' | 'opcional'; duration_min: number; cost_usd: number }
export interface JobSchema { name: string; hourly_rate: number; max_hours: number }
export interface Airport {
  id: string; name: string; city: string; country: string; timezone: string
  is_hub: boolean; lodging_cost: number; food_cost: number
  activities: ActivitySchema[]; jobs: JobSchema[]; airlines: string[]
}
export interface Route {
  origin: string; dest: string; distance_km: number; aircraft_types: string[]
  base_cost: number; min_stay_min: number; is_subsidized: boolean
  costs_by_aircraft: Record<string, number>; times_by_aircraft: Record<string, number>
}
export interface GraphSummary { node_count: number; edge_count: number; hub_count: number; blocked_edge_count: number }

// R2
export interface TripSegment {
  origin: string; dest: string; aircraft_type: string; distance_km: number
  flight_time_min: number; cost_usd: number; cumulative_cost: number; cumulative_time_min: number
}
export interface ItineraryResponse { by_budget: TripSegment[]; by_time: TripSegment[] }
export interface BestRouteResult { total: number | null; path: string[]; segments: TripSegment[] }
export interface BestRouteResponse { results: Record<string, BestRouteResult> }

// R3
export interface SessionState {
  session_id: string; current_airport: string; budget_remaining: number
  time_remaining_hours: number; visited: string[]
}
export interface AircraftOption { aircraft_type: string; cost_usd: number; time_min: number }
export interface FlightOption {
  dest: string; distance_km: number; is_subsidized: boolean; min_stay_min: number
  aircraft_options: AircraftOption[]; recommended_aircraft: AircraftOption
}
export interface ActivityOption { name: string; type: string; duration_min: number; cost_usd: number; can_afford: boolean }
export interface JobOption { name: string; hourly_rate: number; max_hours: number; max_earnable_usd: number }
export interface FlyResult {
  segment: TripSegment; mandatory_events: string[]; budget_remaining: number
  time_remaining_hours: number; current_airport: string; visited: string[]
}
export interface Suggestion { suggested_dest: string | null; path: string[]; estimated_cost: number; estimated_time_min: number }

// R4
export interface BlockedRoute { origin: string; dest: string }
export interface RecalculateResponse { found: boolean; total_cost: number | null; path: string[]; segments: TripSegment[]; error: string | null }

// R5
export interface DestinationSummary { iata_code: string; name: string; city: string; country: string; stay_time_min: number; total_cost_usd: number }
export interface ActivitySummary { name: string; activity_type: string; duration_min: number; cost_usd: number; airport_iata: string }
export interface JobSummary { name: string; hours_worked: number; income_usd: number; airport_iata: string }
export interface TripReport {
  session_id: string; destinations: DestinationSummary[]; segments: TripSegment[]
  activities: ActivitySummary[]; jobs: JobSummary[]; initial_budget: number
  total_spent: number; total_earned: number; final_balance: number
  total_time_hours: number; total_distance_km: number
}
export interface TripSummary {
  session_id: string; initial_budget: number; total_spent: number; total_earned: number
  final_balance: number; total_time_hours: number; destinations_visited: number
}

// UI
export type ActivePanel = 'r1' | 'r2' | 'r3' | 'r4' | 'r5'
export interface Toast { id: string; type: 'success' | 'error' | 'warning' | 'info'; text: string }

/** Lat/Lng lookup for the 32 airports in network.json */
export const AIRPORT_COORDS: Record<string, [number, number]> = {
  BOG: [4.7016, -74.1469],   MDE: [6.1645, -75.4232],  CLO: [3.5432, -76.3816],
  CTG: [10.4424, -75.5130],  BAQ: [10.8896, -74.7808],  LIM: [-12.0219, -77.1143],
  CUZ: [-13.5358, -71.9388], AQP: [-16.3411, -71.5830], GYE: [-2.1574, -79.8836],
  UIO: [-0.1292, -78.3575],  SCL: [-33.3930, -70.7858], ANF: [-23.4444, -70.4451],
  EZE: [-34.8222, -58.5358], MDZ: [-32.8317, -68.7928],  MVD: [-34.8384, -56.0308],
  ASU: [-25.2398, -57.5191], GRU: [-23.4356, -46.4731],  GIG: [-22.8099, -43.2506],
  BSB: [-15.8711, -47.9186], FOR: [-3.7763, -38.5326],   CCS: [10.6031, -66.9912],
  PTY: [9.0713, -79.3835],   SAL: [13.4409, -89.0557],   MGA: [12.1415, -86.1681],
  SJO: [9.9939, -84.2088],   HAV: [22.9892, -82.4091],   SDQ: [18.4297, -69.6689],
  MEX: [19.4363, -99.0721],  GDL: [20.5218, -103.3111],  LPB: [-16.5133, -68.1921],
  VVI: [-17.6448, -63.1354],
}
