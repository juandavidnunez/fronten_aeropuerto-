import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { graphApi, eventsApi } from '@/api'
import type { Airport, Route, GraphSummary, BlockedRoute } from '@/types'

export const useGraphStore = defineStore('graph', () => {
  const airports = ref<Airport[]>([])
  const routes   = ref<Route[]>([])
  const summary  = ref<GraphSummary | null>(null)
  const blocked  = ref<BlockedRoute[]>([])
  const loading  = ref(false)
  const error    = ref<string | null>(null)

  const airportMap = computed(() => Object.fromEntries(airports.value.map(a => [a.id, a])))
  const isLoaded   = computed(() => airports.value.length > 0)

  async function load() {
    loading.value = true; error.value = null
    try {
      summary.value  = await graphApi.load()
      airports.value = await graphApi.nodes()
      routes.value   = await graphApi.edges()
      blocked.value  = await eventsApi.blocked()
      // graph loaded; UI may connect to realtime for live updates
    } catch (e: any) { error.value = e.message }
    finally { loading.value = false }
  }

  async function refreshBlocked() {
    try { blocked.value = await eventsApi.blocked() } catch {}
  }

  function isEdgeBlocked(origin: string, dest: string) {
    return blocked.value.some(b => b.origin === origin && b.dest === dest)
  }

  return { airports, routes, summary, blocked, loading, error, airportMap, isLoaded, load, refreshBlocked, isEdgeBlocked }
})
