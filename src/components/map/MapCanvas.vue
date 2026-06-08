<template>
  <div class="map-root">
    <!-- View Switcher Toggle -->
    <div class="view-toggle">
      <button 
        class="toggle-btn" 
        :class="{ active: viewMode === 'leaflet' }" 
        @click="switchView('leaflet')"
      >
        🌍 Mapa Geográfico
      </button>
      <button 
        class="toggle-btn" 
        :class="{ active: viewMode === 'cytoscape' }" 
        @click="switchView('cytoscape')"
      >
        🕸 Topología de Red
      </button>
    </div>

    <!-- Leaflet container -->
    <div 
      ref="leafletEl" 
      class="leaflet-map" 
      v-show="viewMode === 'leaflet'"
    ></div>

    <!-- Cytoscape container -->
    <div 
      ref="cyEl" 
      class="cytoscape-map" 
      v-show="viewMode === 'cytoscape'"
    ></div>

    <!-- Airport popup overlay -->
    <Transition name="fade">
      <AirportPopup v-if="selectedAirport" :airport="selectedAirport" @close="uiStore.selectAirport(null)" />
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed, nextTick } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import cytoscape from 'cytoscape'
import { useGraphStore } from '@/stores/graph.store'
import { useSessionStore } from '@/stores/session.store'
import { useUiStore } from '@/stores/ui.store'
import { AIRPORT_COORDS } from '@/types'
import AirportPopup from './AirportPopup.vue'
import {
  registerFlightRenderer,
  unregisterFlightRenderer,
  flightAnimationMs,
  type FlightSegment,
} from '@/utils/flightAnimation'

const PLANE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="36" height="36">
  <circle cx="24" cy="24" r="20" fill="#0ea5e9" opacity="0.25"/>
  <path d="M42 24 L28 20 L24 8 L20 20 L6 24 L20 26 L24 38 L28 26 Z" fill="#1e6bff" stroke="#fff" stroke-width="1.2"/>
  <path d="M8 24 L24 22 L40 24 L24 23 Z" fill="#0ea5e9"/>
</svg>`

const leafletEl = ref<HTMLElement | null>(null)
const cyEl      = ref<HTMLElement | null>(null)
const viewMode  = ref<'leaflet' | 'cytoscape'>('leaflet')

const graphStore   = useGraphStore()
const sessionStore = useSessionStore()
const uiStore      = useUiStore()

let map: L.Map | null = null
let nodesLayer: L.LayerGroup | null = null
let edgesLayer: L.LayerGroup | null = null
let flightLayer: L.LayerGroup | null = null
let cy: cytoscape.Core | null = null

const selectedAirport = computed(() =>
  uiStore.selectedAirport ? graphStore.airportMap[uiStore.selectedAirport] : null
)

// ── Cytoscape layout using real lat/lng ─────────────────────────────────────
function nodeLatLng(id: string) {
  const coords = AIRPORT_COORDS[id]
  if (!coords) return null
  return L.latLng(coords[0], coords[1])
}

function isEdgeHighlighted(o: string, d: string) {
  const path = uiStore.highlightedPath || []
  for (let i = 0; i < path.length - 1; i++) {
    if ((path[i] === o && path[i + 1] === d) || (path[i] === d && path[i + 1] === o)) return true
  }
  return false
}

// ── Initialize Leaflet ───────────────────────────────────────────────────────
function initLeaflet() {
  if (!leafletEl.value) return
  map = L.map(leafletEl.value, {
    center: [-8, -60], zoom: 4,
    zoomControl: true,
    attributionControl: false,
  })

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
  }).addTo(map)

  nodesLayer = L.layerGroup().addTo(map)
  edgesLayer = L.layerGroup().addTo(map)
  flightLayer = L.layerGroup().addTo(map)
}

function renderLeafletGraph() {
  if (!map || !nodesLayer || !edgesLayer) return
  if (sessionStore.isInTransit) return
  nodesLayer.clearLayers(); edgesLayer.clearLayers()

  const bounds: L.LatLngExpression[] = []

  for (const r of graphStore.routes) {
    const a = nodeLatLng(r.origin)
    const b = nodeLatLng(r.dest)
    if (!a || !b) continue
    bounds.push(a, b)
    const pts = [a, b]
    const blocked = graphStore.isEdgeBlocked(r.origin, r.dest)
    const highlighted = isEdgeHighlighted(r.origin, r.dest)
    const color = highlighted ? '#0ea5e9' : blocked ? '#ef4444' : (r.is_subsidized ? '#10b981' : '#1e2d45')
    const weight = highlighted ? 4 : 1.5
    const dashArray: string | undefined = blocked ? '5,5' : r.is_subsidized ? '6,4' : undefined
    L.polyline(pts as any, { color, weight, dashArray }).addTo(edgesLayer)
      .bindTooltip(`${r.distance_km} km`, { permanent: false, direction: 'center', className: 'edge-tooltip' })
  }

  for (const a of graphStore.airports) {
    const latlng = nodeLatLng(a.id)
    if (!latlng) continue
    bounds.push(latlng)
    const isCurrent = sessionStore.session?.current_airport === a.id
    const marker = L.circleMarker(latlng, {
      radius: isCurrent ? 9 : (a.is_hub ? 6.5 : 5),
      color: isCurrent ? '#f59e0b' : '#0ea5e9',
      fillColor: isCurrent ? '#f59e0b' : '#151b26',
      fillOpacity: 1,
      weight: 2,
    })
    marker.on('click', () => uiStore.selectAirport(a.id))
    marker.bindTooltip(`${a.id} — ${a.city}`, { direction: 'top' })
    marker.addTo(nodesLayer)
  }

  if (bounds.length && map) {
    try { map.fitBounds(L.latLngBounds(bounds), { padding: [40, 40] }) } catch {}
  }
}

// ── Initialize Cytoscape.js Graph View ───────────────────────────────────────
function renderCytoscapeGraph() {
  if (!cyEl.value) return
  
  // Build elements array
  const elements: cytoscape.ElementDefinition[] = []
  
  // Add nodes
  for (const a of graphStore.airports) {
    const isCurrent = sessionStore.session?.current_airport === a.id
    elements.push({
      group: 'nodes',
      data: {
        id: a.id,
        label: `${a.id}\n${a.city}`,
        isHub: a.is_hub,
        isCurrent: isCurrent,
        selected: uiStore.selectedAirport === a.id
      }
    })
  }
  
  // Add edges
  const edgeSet = new Set<string>()
  for (const r of graphStore.routes) {
    // Avoid double edges for bi-directional representation in cy
    const edgeKey = [r.origin, r.dest].sort().join('-')
    if (edgeSet.has(edgeKey)) continue
    edgeSet.add(edgeKey)
    
    const blocked = graphStore.isEdgeBlocked(r.origin, r.dest)
    const highlighted = isEdgeHighlighted(r.origin, r.dest)
    elements.push({
      group: 'edges',
      data: {
        id: `${r.origin}-${r.dest}`,
        source: r.origin,
        target: r.dest,
        blocked: blocked,
        highlighted: highlighted,
        isSubsidized: r.is_subsidized
      }
    })
  }

  cy = cytoscape({
    container: cyEl.value,
    elements: elements,
    style: [
      {
        selector: 'node',
        style: {
          'content': 'data(label)',
          'text-wrap': 'wrap',
          'text-valign': 'center',
          'text-halign': 'center',
          'color': '#e2e8f0',
          'font-family': 'Space Grotesk, sans-serif',
          'font-size': '10px',
          'font-weight': '600',
          'background-color': '#1a2233',
          'border-width': '2px',
          'border-color': '#0ea5e9',
          'width': '45px',
          'height': '45px',
          'transition-property': 'background-color, border-color, width, height',
          'transition-duration': 0.2
        }
      },
      {
        selector: 'node[?isHub]',
        style: {
          'width': '55px',
          'height': '55px',
          'background-color': '#0f172a',
          'border-color': '#1e6bff',
          'border-width': '3px'
        }
      },
      {
        selector: 'node[?isCurrent]',
        style: {
          'border-color': '#f59e0b',
          'background-color': '#3f2d12',
          'width': '60px',
          'height': '60px'
        }
      },
      {
        selector: 'node[?selected]',
        style: {
          'background-color': '#0d1e3d',
          'border-color': '#0ea5e9',
          'border-width': '4px',
          'color': '#fff'
        }
      },
      {
        selector: 'edge',
        style: {
          'width': 1.5,
          'line-color': '#1e2d45',
          'curve-style': 'bezier',
          'opacity': 0.8
        }
      },
      {
        selector: 'edge[?highlighted]',
        style: {
          'width': 4,
          'line-color': '#0ea5e9',
          'opacity': 1.0,
          'z-index': 100
        }
      },
      {
        selector: 'edge[?blocked]',
        style: {
          'line-color': '#ef4444',
          'line-style': 'dashed',
          'width': 2,
          'opacity': 0.9
        }
      },
      {
        selector: 'edge[?isSubsidized]',
        style: {
          'line-color': '#10b981',
          'line-style': 'dotted',
          'width': 2
        }
      }
    ],
    layout: {
      name: 'cose',
      idealEdgeLength: () => 100,
      nodeOverlap: 20,
      refresh: 20,
      fit: true,
      padding: 30,
      randomize: false,
      componentSpacing: 100,
      nodeRepulsion: () => 400000,
      edgeElasticity: () => 100,
      nestingFactor: 5,
      gravity: 80,
      numIter: 1000,
      initialTemp: 200,
      coolingFactor: 0.95,
      minTemp: 1.0
    }
  })

  // Tap interaction
  cy.on('tap', 'node', (evt) => {
    const node = evt.target
    uiStore.selectAirport(node.id())
  })
}

function switchView(mode: 'leaflet' | 'cytoscape') {
  viewMode.value = mode
  if (mode === 'cytoscape') {
    nextTick(() => {
      renderCytoscapeGraph()
    })
  } else {
    nextTick(() => {
      if (map) map.invalidateSize()
    })
  }
}

// Watchers
watch(() => graphStore.airports.length, (n) => { 
  if (n > 0) {
    renderLeafletGraph()
    if (viewMode.value === 'cytoscape') renderCytoscapeGraph()
  }
})

watch(() => [graphStore.blocked, uiStore.highlightedPath, sessionStore.session?.current_airport, uiStore.selectedAirport, sessionStore.isInTransit], () => {
  if (!sessionStore.isInTransit) {
    renderLeafletGraph()
    if (viewMode.value === 'cytoscape') renderCytoscapeGraph()
  }
}, { deep: true })

function computeBearing(a: L.LatLng, b: L.LatLng) {
  const toRad = (n: number) => n * Math.PI / 180
  const toDeg = (n: number) => n * 180 / Math.PI
  const φ1 = toRad(a.lat), φ2 = toRad(b.lat)
  const Δλ = toRad(b.lng - a.lng)
  const y = Math.sin(Δλ) * Math.cos(φ2)
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)
  return (toDeg(Math.atan2(y, x)) + 360) % 360
}

function setupFlightRenderer() {
  registerFlightRenderer((segment: FlightSegment, onProgress) => {
    if (!map || !flightLayer) {
      onProgress(1)
      return { abort: () => {} }
    }

    const start = nodeLatLng(segment.origin)
    const end = nodeLatLng(segment.dest)
    if (!start || !end) {
      onProgress(1)
      return { abort: () => {} }
    }

    flightLayer.clearLayers()
    const s = start as L.LatLng
    const e = end as L.LatLng
    const bearing = computeBearing(s, e)
    const durationMs = flightAnimationMs(segment.flight_time_min)

    const activeEdge = L.polyline([s, e], {
      color: '#f59e0b',
      weight: 5,
      opacity: 0.95,
      dashArray: '12,8',
    }).addTo(flightLayer)

    const trailEdge = L.polyline([s, s], {
      color: '#0ea5e9',
      weight: 3,
      opacity: 0.7,
    }).addTo(flightLayer)

    const planeIcon = L.divIcon({
      className: 'plane-marker',
      html: `<div class="plane-marker-inner" style="transform:rotate(${bearing - 90}deg)">${PLANE_SVG}</div>`,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    })
    const marker = L.marker(s, { icon: planeIcon, zIndexOffset: 1000 }).addTo(flightLayer)

    let cancelled = false
    const t0 = performance.now()

    function step(now: number) {
      if (cancelled) return
      const t = Math.min(1, (now - t0) / durationMs)
      const lat = s.lat + (e.lat - s.lat) * t
      const lng = s.lng + (e.lng - s.lng) * t
      marker.setLatLng([lat, lng])
      trailEdge.setLatLngs([s, L.latLng(lat, lng)])
      onProgress(t)
      sessionStore.setTransitProgress(t)
      if (t < 1) requestAnimationFrame(step)
      else setTimeout(() => flightLayer?.clearLayers(), 400)
    }
    requestAnimationFrame(step)

    return {
      abort: () => {
        cancelled = true
        flightLayer?.clearLayers()
        onProgress(0)
        renderLeafletGraph()
      },
    }
  })
}

onMounted(() => {
  initLeaflet()
  if (graphStore.isLoaded) renderLeafletGraph()
  setupFlightRenderer()
})

onUnmounted(() => {
  unregisterFlightRenderer()
  map?.remove()
  nodesLayer = null; edgesLayer = null; flightLayer = null
  cy?.destroy()
})
</script>

<style scoped>
.map-root { position: relative; width: 100%; height: 100%; overflow: hidden }
.leaflet-map, .cytoscape-map { position: absolute; inset: 0; z-index: 1 }
.cytoscape-map { background: #060a12; }

.view-toggle {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 10;
  display: flex;
  background: rgba(15, 23, 42, 0.85);
  border: 1px solid var(--sky-border);
  border-radius: var(--radius-md);
  padding: 4px;
  backdrop-filter: blur(10px);
}

.toggle-btn {
  background: none;
  border: none;
  color: var(--sky-text3);
  padding: 6px 12px;
  font-size: 11px;
  font-weight: 600;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-family: var(--font-ui);
  transition: var(--transition);
}

.toggle-btn:hover {
  color: var(--sky-text);
}

.toggle-btn.active {
  background: var(--sky-accent);
  color: #fff;
}

.plane-marker { background: none !important; border: none !important }
.plane-marker-inner {
  display: flex; align-items: center; justify-content: center;
  filter: drop-shadow(0 2px 6px rgba(30, 107, 255, 0.8));
  transform-origin: center center;
}
:global(.plane-marker) { background: transparent !important; border: none !important; }
</style>
