<template>
  <div class="map-root">
    <div ref="leafletEl" class="leaflet-map"></div>
    <!-- Airport popup -->
    <Transition name="fade">
      <AirportPopup v-if="selectedAirport" :airport="selectedAirport" @close="uiStore.selectAirport(null)" />
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useGraphStore } from '@/stores/graph.store'
import { useSessionStore } from '@/stores/session.store'
import { useUiStore } from '@/stores/ui.store'
import { AIRPORT_COORDS } from '@/types'
import AirportPopup from './AirportPopup.vue'
import realtime from '@/realtime'

const leafletEl   = ref<HTMLElement | null>(null)

const graphStore   = useGraphStore()
const sessionStore = useSessionStore()
const uiStore      = useUiStore()

let map: L.Map | null = null
let nodesLayer: L.LayerGroup | null = null
let edgesLayer: L.LayerGroup | null = null

const selectedAirport = computed(() =>
  uiStore.selectedAirport ? graphStore.airportMap[uiStore.selectedAirport] : null
)

// ── Build Cytoscape elements from store ──────────────────────────────────────
function isEdgeHighlighted(o: string, d: string) {
  const path = uiStore.highlightedPath || []
  for (let i = 0; i < path.length - 1; i++) {
    if (path[i] === o && path[i + 1] === d) return true
  }
  return false
}

// ── Cytoscape layout using real lat/lng ─────────────────────────────────────
function nodeLatLng(id: string) {
  const coords = AIRPORT_COORDS[id]
  if (!coords) return null
  return L.latLng(coords[0], coords[1])
}

// ── Initialize map ───────────────────────────────────────────────────────────
function initLeaflet() {
  map = L.map(leafletEl.value!, {
    center: [-8, -60], zoom: 4,
    zoomControl: true,
    attributionControl: false,
  })

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
  }).addTo(map)

  nodesLayer = L.layerGroup().addTo(map)
  edgesLayer = L.layerGroup().addTo(map)

  map.on('moveend zoomend', () => { /* nothing needed; markers are geo-based */ })
  map.on('resize', () => { /* noop */ })
}

// ── Initialize Cytoscape ─────────────────────────────────────────────────────
function renderGraph() {
  if (!map || !nodesLayer || !edgesLayer) return
  nodesLayer.clearLayers(); edgesLayer.clearLayers()

  const bounds: L.LatLngExpression[] = []

  // draw edges first (so markers on top)
  for (const r of graphStore.routes) {
    const a = nodeLatLng(r.origin)
    const b = nodeLatLng(r.dest)
    if (!a || !b) continue
    bounds.push(a, b)
    const pts = [a, b]
    const blocked = graphStore.isEdgeBlocked(r.origin, r.dest)
    const highlighted = isEdgeHighlighted(r.origin, r.dest)
    const color = highlighted ? '#1e6bff' : blocked ? '#ef4444' : (r.is_subsidized ? '#10b981' : '#1e2d45')
    const weight = highlighted ? 3 : 1
    const dashArray: string | undefined = blocked || r.is_subsidized ? '6,4' : undefined
    L.polyline(pts as any, { color, weight, dashArray }).addTo(edgesLayer)
  }

  for (const a of graphStore.airports) {
    const latlng = nodeLatLng(a.id)
    if (!latlng) continue
    bounds.push(latlng)
    const isCurrent = sessionStore.session?.current_airport === a.id
    const marker = L.circleMarker(latlng, {
      radius: isCurrent ? 8 : (a.is_hub ? 6 : 5),
      color: isCurrent ? '#f59e0b' : '#1e6bff',
      fillColor: isCurrent ? '#f59e0b' : '#1a2233',
      fillOpacity: 1,
      weight: 2,
    })
    marker.on('click', () => uiStore.selectAirport(a.id))
    marker.bindTooltip(`${a.id} — ${a.city}`, { direction: 'top' })
    marker.addTo(nodesLayer)
  }

  // zoom to bounds if available
  if (bounds.length && map) {
    try { map.fitBounds(L.latLngBounds(bounds), { padding: [40, 40] }) } catch {}
  }
}

// ── Sync Cytoscape node positions to Leaflet projection ─────────────────────
// Watchers
watch(() => graphStore.airports.length, (n) => { if (n > 0) renderGraph() })
watch(() => [graphStore.blocked, uiStore.highlightedPath, sessionStore.session?.current_airport, sessionStore.session?.visited], renderGraph, { deep: true })

onMounted(() => {
  initLeaflet()
  // initial render if data already present
  if (graphStore.isLoaded) renderGraph()
  // listen for animate-flight events
  realtime.on('animate-flight', (p: any) => {
    try { animateFlight(p.segment) } catch {}
  })
})

onUnmounted(() => {
  map?.remove()
  nodesLayer = null; edgesLayer = null
  realtime.off('animate-flight')
})

// animate an airplane marker along origin->dest segment
function animateFlight(segment: any) {
  if (!map) return
  const start = nodeLatLng(segment.origin)
  const end = nodeLatLng(segment.dest)
  if (!start || !end) return
  const s = start as L.LatLng
  const e = end as L.LatLng

  const latlngs = [start, end]
  const durationMs = Math.max(1500, (segment.flight_time_min ?? 1) * 200) // scale

  const planeIcon = L.divIcon({ className: 'plane-icon', html: '✈️', iconSize: [24,24] })
  const marker = L.marker(start, { icon: planeIcon, pane: 'markerPane' }).addTo(map)

  const startTime = performance.now()
  // compute constant bearing from start->end (deg)
  function computeBearing(a: L.LatLng, b: L.LatLng) {
    const toRad = (n: number) => n * Math.PI / 180
    const toDeg = (n: number) => n * 180 / Math.PI
    const φ1 = toRad(a.lat), φ2 = toRad(b.lat)
    const Δλ = toRad(b.lng - a.lng)
    const y = Math.sin(Δλ) * Math.cos(φ2)
    const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)
    const θ = Math.atan2(y, x)
    return (toDeg(θ) + 360) % 360
  }
  const bearing = computeBearing(s, e)
  function step(now: number) {
    const t = Math.min(1, (now - startTime) / durationMs)
    const lat = s.lat + (e.lat - s.lat) * t
    const lng = s.lng + (e.lng - s.lng) * t
    marker.setLatLng([lat, lng])
    // rotate plane element to match bearing
    const el = marker.getElement()
    if (el) {
      // translate to center then rotate
      (el as HTMLElement).style.transform = `translate(-50%, -50%) rotate(${bearing}deg)`
    }
    if (t < 1) requestAnimationFrame(step)
    else setTimeout(() => { marker.remove() }, 500)
  }
  requestAnimationFrame(step)
}
</script>

<style scoped>
.map-root { position: relative; width: 100%; height: 100%; overflow: hidden }
.leaflet-map { position: absolute; inset: 0; z-index: 1 }
.cytoscape-overlay {
  position: absolute; inset: 0; z-index: 2;
  pointer-events: none; background: transparent;
}
.plane-icon { display:inline-block; font-size:18px; line-height:24px; transform-origin:center center }
</style>
