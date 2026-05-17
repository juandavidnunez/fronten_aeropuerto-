<template>
  <div class="map-root">
    <div ref="leafletEl" class="leaflet-map" />
    <canvas ref="cytoscapeEl" class="cytoscape-overlay" />
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
import cytoscape from 'cytoscape'
import { useGraphStore } from '@/stores/graph.store'
import { useSessionStore } from '@/stores/session.store'
import { useUiStore } from '@/stores/ui.store'
import { AIRPORT_COORDS } from '@/types'
import AirportPopup from './AirportPopup.vue'

const leafletEl   = ref<HTMLElement>()
const cytoscapeEl = ref<HTMLCanvasElement>()

const graphStore   = useGraphStore()
const sessionStore = useSessionStore()
const uiStore      = useUiStore()

let map: L.Map | null = null
let cy:  cytoscape.Core | null = null

const selectedAirport = computed(() =>
  uiStore.selectedAirport ? graphStore.airportMap[uiStore.selectedAirport] : null
)

// ── Build Cytoscape elements from store ──────────────────────────────────────
function buildElements() {
  const nodes = graphStore.airports.map(a => ({
    data: {
      id: a.id, label: a.id, isHub: a.is_hub,
      current: a.id === sessionStore.session?.current_airport,
      visited: sessionStore.session?.visited.includes(a.id) ?? false,
    },
  }))

  const edges = graphStore.routes.map(r => ({
    data: {
      id: `${r.origin}-${r.dest}`,
      source: r.origin, target: r.dest,
      blocked: graphStore.isEdgeBlocked(r.origin, r.dest),
      subsidized: r.is_subsidized,
      highlighted: isEdgeHighlighted(r.origin, r.dest),
    },
  }))

  return [...nodes, ...edges]
}

function isEdgeHighlighted(o: string, d: string) {
  const path = uiStore.highlightedPath
  for (let i = 0; i < path.length - 1; i++) {
    if (path[i] === o && path[i + 1] === d) return true
  }
  return false
}

// ── Cytoscape layout using real lat/lng ─────────────────────────────────────
function nodePosition(id: string) {
  const coords = AIRPORT_COORDS[id]
  if (!coords || !map) return { x: 0, y: 0 }
  const point = map.latLngToContainerPoint(L.latLng(coords[0], coords[1]))
  return { x: point.x, y: point.y }
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

  map.on('moveend zoomend', updateCyPositions)
  map.on('resize', updateCyPositions)
}

// ── Initialize Cytoscape ─────────────────────────────────────────────────────
function initCytoscape() {
  if (!cytoscapeEl.value) return

  cy = cytoscape({
    container: cytoscapeEl.value,
    elements: [],
    style: [
      {
        selector: 'node',
        style: {
          'background-color': '#1a2233',
          'border-color': '#1e6bff',
          'border-width': 1.5,
          'width': 28, 'height': 28,
          'label': 'data(label)',
          'color': '#e2e8f0',
          'font-size': '10px',
          'font-family': 'Space Grotesk, sans-serif',
          'font-weight': '600',
          'text-valign': 'bottom',
          'text-margin-y': 4,
          'text-background-color': '#0a0c10',
          'text-background-opacity': 0.8,
          'text-background-padding': '2px',
          'text-background-shape': 'roundrectangle',
        },
      },
      {
        selector: 'node[?isHub]',
        style: {
          'background-color': '#0d2a5e',
          'border-color': '#3b82f6',
          'border-width': 2.5,
          'width': 36, 'height': 36,
          'font-size': '11px',
        },
      },
      {
        selector: 'node[?current]',
        style: {
          'background-color': '#1d4ed8',
          'border-color': '#60a5fa',
          'border-width': 3,
          'width': 40, 'height': 40,
        },
      },
      {
        selector: 'node[?visited]',
        style: {
          'background-color': '#14352b',
          'border-color': '#10b981',
          'border-width': 2,
        },
      },
      {
        selector: 'edge',
        style: {
          'width': 1,
          'line-color': '#1e2d45',
          'target-arrow-color': '#1e2d45',
          'target-arrow-shape': 'triangle',
          'arrow-scale': 0.6,
          'curve-style': 'bezier',
          'opacity': 0.6,
        },
      },
      {
        selector: 'edge[?blocked]',
        style: {
          'line-color': '#ef4444',
          'target-arrow-color': '#ef4444',
          'line-style': 'dashed',
          'line-dash-pattern': [6, 4],
          'opacity': 0.9,
          'width': 2,
        },
      },
      {
        selector: 'edge[?highlighted]',
        style: {
          'line-color': '#1e6bff',
          'target-arrow-color': '#1e6bff',
          'width': 3,
          'opacity': 1,
        },
      },
      {
        selector: 'edge[?subsidized]',
        style: {
          'line-color': '#10b981',
          'target-arrow-color': '#10b981',
          'line-style': 'dashed',
          'line-dash-pattern': [4, 3],
          'opacity': 0.7,
        },
      },
      {
        selector: ':selected',
        style: { 'border-color': '#f59e0b', 'border-width': 3 },
      },
    ],
    layout: { name: 'preset', positions: {} },
    userZoomingEnabled: false,
    userPanningEnabled: false,
    boxSelectionEnabled: false,
    autoungrabify: true,
  })

  cy.on('tap', 'node', (e) => {
    uiStore.selectAirport(e.target.data('id'))
  })
  cy.on('tap', (e) => {
    if (e.target === cy) uiStore.selectAirport(null)
  })
}

// ── Sync Cytoscape node positions to Leaflet projection ─────────────────────
function updateCyPositions() {
  if (!cy || !map) return
  const w = leafletEl.value!.clientWidth
  const h = leafletEl.value!.clientHeight
  cy.resize()

  cy.nodes().forEach(node => {
    const pos = nodePosition(node.id())
    node.position(pos)
  })

  cy.fit(undefined, 0)
  cy.zoom({ level: 1, renderedPosition: { x: w / 2, y: h / 2 } })
}

// ── Load graph data into Cytoscape ──────────────────────────────────────────
function renderGraph() {
  if (!cy) return
  cy.elements().remove()
  cy.add(buildElements())
  updateCyPositions()
}

// ── Watchers ─────────────────────────────────────────────────────────────────
watch(() => graphStore.airports.length, (n) => { if (n > 0) renderGraph() })
watch(() => [graphStore.blocked, uiStore.highlightedPath, sessionStore.session?.current_airport, sessionStore.session?.visited], renderGraph, { deep: true })

onMounted(() => {
  initLeaflet()
  initCytoscape()

  // Sync canvas size to leaflet container
  const ro = new ResizeObserver(() => {
    if (!cytoscapeEl.value || !leafletEl.value) return
    cytoscapeEl.value.width  = leafletEl.value.clientWidth
    cytoscapeEl.value.height = leafletEl.value.clientHeight
    cy?.resize()
    updateCyPositions()
  })
  ro.observe(leafletEl.value!)

  if (graphStore.isLoaded) renderGraph()
})

onUnmounted(() => {
  map?.remove()
  cy?.destroy()
})
</script>

<style scoped>
.map-root { position: relative; width: 100%; height: 100%; overflow: hidden }
.leaflet-map { position: absolute; inset: 0; z-index: 1 }
.cytoscape-overlay {
  position: absolute; inset: 0; z-index: 2;
  pointer-events: auto; background: transparent;
}
</style>
