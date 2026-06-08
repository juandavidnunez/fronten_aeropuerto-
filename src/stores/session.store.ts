import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { dynamicApi } from '@/api'
import { useGraphStore } from '@/stores/graph.store'
import {
  waitForFlightAnimation,
  abortFlightAnimation,
  type InTransitState,
} from '@/utils/flightAnimation'
import type { SessionState, FlightOption, ActivityOption, JobOption, FlyResult, Suggestion } from '@/types'

export const useSessionStore = defineStore('session', () => {
  const session      = ref<SessionState | null>(null)
  const flights      = ref<FlightOption[]>([])
  const activities   = ref<ActivityOption[]>([])
  const jobs         = ref<JobOption[]>([])
  const suggestion   = ref<Suggestion | null>(null)
  const eventLog     = ref<string[]>([])
  const loading      = ref(false)
  const error        = ref<string | null>(null)
  const initialBudget = ref(0)
  const inTransit    = ref<InTransitState | null>(null)

  const isActive    = computed(() => session.value !== null)
  const isInTransit = computed(() => inTransit.value !== null)
  const sessionId   = computed(() => session.value?.session_id ?? null)
  const budgetPct   = computed(() =>
    session.value && initialBudget.value > 0
      ? Math.min(100, Math.max(0, (1 - session.value.budget_remaining / initialBudget.value) * 100))
      : 0
  )

  const graphStore = useGraphStore()

  watch(
    () => graphStore.blocked.map(b => `${b.origin}-${b.dest}`).join('|'),
    () => {
      if (!inTransit.value) return
      const { origin, dest } = inTransit.value
      if (graphStore.isEdgeBlocked(origin, dest)) {
        abortFlightAnimation()
      }
    },
  )

  async function _refreshAll() {
    if (!sessionId.value) return
    const id = sessionId.value
    const [f, a, j, s] = await Promise.allSettled([
      dynamicApi.flights(id), dynamicApi.activities(id),
      dynamicApi.jobs(id),    dynamicApi.suggest(id),
    ])
    if (f.status === 'fulfilled') flights.value    = f.value
    if (a.status === 'fulfilled') activities.value = a.value
    if (j.status === 'fulfilled') jobs.value       = j.value
    if (s.status === 'fulfilled') suggestion.value = s.value
  }

  async function startTrip(origin: string, budget: number, hours: number) {
    loading.value = true; error.value = null
    try {
      session.value = await dynamicApi.start({ origin, initial_budget: budget, time_hours: hours })
      initialBudget.value = budget
      eventLog.value = [`Viaje iniciado en ${origin} — $${budget} / ${hours}h`]
      await _refreshAll()
    } catch (e: any) { error.value = e.message }
    finally { loading.value = false }
  }

  async function fly(dest: string, aircraft_type: string): Promise<FlyResult | null> {
    if (!sessionId.value || !session.value || isInTransit.value) return null

    const flight = flights.value.find(f => f.dest === dest)
    const acOpt = flight?.aircraft_options.find(a => a.aircraft_type === aircraft_type)
      ?? flight?.recommended_aircraft
    if (!acOpt) {
      error.value = 'Aeronave no disponible en esta ruta'
      return null
    }

    const origin = session.value.current_airport
    const segment = {
      origin,
      dest,
      aircraft_type,
      flight_time_min: acOpt.time_min,
      cost_usd: acOpt.cost_usd,
    }

    loading.value = true
    error.value = null
    inTransit.value = { ...segment, progress: 0 }
    eventLog.value.push(`🛫 Despegando ${origin} → ${dest} (${(acOpt.time_min / 60).toFixed(1)}h de vuelo)...`)

    try {
      await waitForFlightAnimation(segment)

      const r = await dynamicApi.fly({ session_id: sessionId.value, dest, aircraft_type })
      session.value.current_airport      = r.current_airport
      session.value.budget_remaining     = r.budget_remaining
      session.value.time_remaining_hours = r.time_remaining_hours
      session.value.visited              = r.visited
      if (r.mandatory_events.length) eventLog.value.push(...r.mandatory_events)
      eventLog.value.push(`✈ Aterrizaje en ${r.segment.dest} — $${r.segment.cost_usd.toFixed(2)}`)
      await _refreshAll()
      return r
    } catch (e: any) {
      if (e.message === 'ROUTE_BLOCKED') {
        eventLog.value.push(`⚠ Ruta ${origin}→${dest} bloqueada durante el vuelo`)
        eventLog.value.push(`🚨 Activando desvío de emergencia...`)
        error.value = 'Vuelo interrumpido: la ruta fue bloqueada durante el vuelo. Se ha activado un desvío de emergencia.'
        // Actualizar la sesión después del desvío
        await _refreshAll()
      } else {
        error.value = e.message
        eventLog.value.push(`❌ Error en vuelo: ${e.message}`)
      }
      return null
    } finally {
      inTransit.value = null
      loading.value = false
    }
  }

  async function doActivity(name: string) {
    if (!sessionId.value || isInTransit.value) return
    loading.value = true
    try {
      const r = await dynamicApi.activity({ session_id: sessionId.value, activity_name: name })
      session.value!.budget_remaining     = r.budget_remaining
      session.value!.time_remaining_hours = r.time_remaining_hours
      eventLog.value.push(`🎯 Actividad: ${name}  -$${r.cost_usd.toFixed(2)}`)
      await _refreshAll()
    } catch (e: any) { error.value = e.message }
    finally { loading.value = false }
  }

  async function doJob(job_name: string, hours: number) {
    if (!sessionId.value || isInTransit.value) return
    loading.value = true
    try {
      const r = await dynamicApi.job({ session_id: sessionId.value, job_name, hours })
      session.value!.budget_remaining     = r.budget_remaining
      session.value!.time_remaining_hours = r.time_remaining_hours
      eventLog.value.push(`💼 Trabajo: ${job_name} ${hours}h  +$${r.income_usd.toFixed(2)} (incl. costos de estadía)`)
      await _refreshAll()
    } catch (e: any) { error.value = e.message }
    finally { loading.value = false }
  }

  async function endTrip() {
    if (!sessionId.value) return
    await dynamicApi.end(sessionId.value)
    eventLog.value.push('🏁 Viaje finalizado')
  }

  function reset() {
    abortFlightAnimation()
    session.value = null; flights.value = []; activities.value = []
    jobs.value = []; suggestion.value = null; eventLog.value = []
    error.value = null; initialBudget.value = 0; inTransit.value = null
  }

  function setTransitProgress(p: number) {
    if (inTransit.value) inTransit.value.progress = p
  }

  return {
    session, flights, activities, jobs, suggestion, eventLog, inTransit,
    loading, error, isActive, isInTransit, sessionId, budgetPct, initialBudget,
    startTrip, fly, doActivity, doJob, endTrip, reset, setTransitProgress,
  }
})
