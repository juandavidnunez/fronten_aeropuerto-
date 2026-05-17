import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { dynamicApi } from '@/api'
import realtime from '@/realtime'
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

  const isActive  = computed(() => session.value !== null)
  const sessionId = computed(() => session.value?.session_id ?? null)
  const budgetPct = computed(() =>
    session.value ? Math.max(0, (session.value.budget_remaining / initialBudget.value) * 100) : 100
  )

  async function startTrip(origin: string, budget: number, hours: number) {
    loading.value = true; error.value = null
    try {
      session.value = await dynamicApi.start({ origin, initial_budget: budget, time_hours: hours })
      initialBudget.value = budget
      eventLog.value = [`Viaje iniciado en ${origin} — $${budget} / ${hours}h`]
      // session started; UI may choose to connect to realtime to receive live events
      await _refreshAll()
    } catch (e: any) { error.value = e.message }
    finally { loading.value = false }
  }

  async function fly(dest: string, aircraft_type: string): Promise<FlyResult | null> {
    if (!sessionId.value) return null
    loading.value = true; error.value = null
    try {
      const r = await dynamicApi.fly({ session_id: sessionId.value, dest, aircraft_type })
      session.value!.current_airport      = r.current_airport
      session.value!.budget_remaining     = r.budget_remaining
      session.value!.time_remaining_hours = r.time_remaining_hours
      session.value!.visited              = r.visited
      if (r.mandatory_events.length) eventLog.value.push(...r.mandatory_events)
      eventLog.value.push(`✈ ${r.segment.origin} → ${r.segment.dest}  $${r.segment.cost_usd.toFixed(2)}`)
      await _refreshAll()
      // emit animate-flight event for map to animate an airplane along the segment
      try { realtime.emit('animate-flight', { segment: r.segment }) } catch {}
      return r
    } catch (e: any) { error.value = e.message; return null }
    finally { loading.value = false }
  }

  async function doActivity(name: string) {
    if (!sessionId.value) return
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
    if (!sessionId.value) return
    loading.value = true
    try {
      const r = await dynamicApi.job({ session_id: sessionId.value, job_name, hours })
      session.value!.budget_remaining     = r.budget_remaining
      session.value!.time_remaining_hours = r.time_remaining_hours
      eventLog.value.push(`💼 Trabajo: ${job_name} ${hours}h  +$${r.income_usd.toFixed(2)}`)
      await _refreshAll()
    } catch (e: any) { error.value = e.message }
    finally { loading.value = false }
  }

  async function endTrip() {
    if (!sessionId.value) return
    await dynamicApi.end(sessionId.value)
    eventLog.value.push('🏁 Viaje finalizado')
  }

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

  function reset() {
    session.value = null; flights.value = []; activities.value = []
    jobs.value = []; suggestion.value = null; eventLog.value = []
    error.value = null; initialBudget.value = 0
  }

  return {
    session, flights, activities, jobs, suggestion, eventLog,
    loading, error, isActive, sessionId, budgetPct, initialBudget,
    startTrip, fly, doActivity, doJob, endTrip, reset,
  }
})
