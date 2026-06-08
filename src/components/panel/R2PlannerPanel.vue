<template>
  <div class="r2-planner">
    <div class="section-header">
      <h2>Planificador de Rutas</h2>
      <span class="text-muted">R2 — Optimización y Búsqueda</span>
    </div>

    <!-- Mode Selector Tabs -->
    <div class="mode-selector">
      <button 
        class="mode-btn" 
        :class="{ active: activeMode === 'itinerary' }"
        @click="activeMode = 'itinerary'"
      >
        🗺 Optimizar Itinerario
      </button>
      <button 
        class="mode-btn" 
        :class="{ active: activeMode === 'point2point' }"
        @click="activeMode = 'point2point'"
      >
        🧭 Punto a Punto
      </button>
    </div>

    <!-- MODE 1: ITINERARY PLANNER -->
    <div v-if="activeMode === 'itinerary'" class="form-container">
      <div class="card form-card">
        <h3>Simular Itinerario Turístico</h3>
        <p class="desc text-muted">Maximiza los destinos visitados dentro de un presupuesto y tiempo límite usando algoritmos de optimización.</p>

        <!-- Origin -->
        <div class="form-group">
          <label>Aeropuerto de Origen</label>
          <div class="autocomplete">
            <input 
              v-model="itiForm.origin" 
              @focus="showOriginList = true"
              @input="onOriginInput"
              class="input"
              placeholder="Ej: BOG, MDE, LIM..."
            />
            <ul v-if="showOriginList && filteredOrigins.length" class="autocomplete-list">
              <li 
                v-for="a in filteredOrigins" 
                :key="a.id"
                @click="selectOrigin(a.id)"
              >
                <span class="iata">{{ a.id }}</span>
                <span class="city-name">{{ a.city }} ({{ a.country }})</span>
              </li>
            </ul>
          </div>
        </div>

        <!-- Budget & Hours -->
        <div class="row">
          <div class="form-group flex-1">
            <label>Presupuesto Máximo ($)</label>
            <input v-model.number="itiForm.budget" type="number" min="100" step="100" class="input" />
          </div>
          <div class="form-group flex-1">
            <label>Tiempo Disponible (Hrs)</label>
            <input v-model.number="itiForm.hours" type="number" min="1" class="input" />
          </div>
        </div>

        <!-- Aircraft Filtering -->
        <div class="form-group">
          <label>Aeronaves Permitidas</label>
          <div class="aircraft-grid">
            <label v-for="ac in availableAircrafts" :key="ac" class="checkbox-label">
              <input type="checkbox" :value="ac" v-model="itiForm.aircrafts" />
              <span>{{ ac }}</span>
            </label>
          </div>
        </div>

        <!-- Secondary Routes Toggle -->
        <div class="form-group">
          <label class="checkbox-label flex-row">
            <input type="checkbox" v-model="itiForm.includeSecondary" />
            <span>Incluir aeropuertos regionales secundarios</span>
          </label>
        </div>

        <button 
          class="btn btn-primary btn-block" 
          :disabled="loading"
          @click="planItinerary"
        >
          <span v-if="loading">Calculando Itinerario Óptimo...</span>
          <span v-else>🔍 Generar Itinerarios</span>
        </button>
      </div>

      <div v-if="error" class="error-box mt-4">{{ error }}</div>

      <!-- ITINERARY RESULTS -->
      <div v-if="itineraryResult" class="results-container mt-4">
        <div class="tabs-sub">
          <button 
            class="tab-sub" 
            :class="{ active: itiResultTab === 'budget' }"
            @click="selectItineraryPath('budget')"
          >
            💰 Optimizado por Presupuesto
          </button>
          <button 
            class="tab-sub" 
            :class="{ active: itiResultTab === 'time' }"
            @click="selectItineraryPath('time')"
          >
            ⏱ Optimizado por Tiempo
          </button>
        </div>

        <!-- Selected Itinerary Details -->
        <div class="card result-card mt-2">
          <div class="stats-grid">
            <div class="stat-card">
              <div class="num">{{ currentItiPath.length }}</div>
              <div class="lbl">Vuelos</div>
            </div>
            <div class="stat-card">
              <div class="num">${{ itineraryCost.toFixed(2) }}</div>
              <div class="lbl">Coste Total</div>
            </div>
            <div class="stat-card">
              <div class="num">{{ (itineraryTime / 60).toFixed(1) }}h</div>
              <div class="lbl">Duración total</div>
            </div>
            <div class="stat-card">
              <div class="num">{{ itineraryDistance.toLocaleString() }} km</div>
              <div class="lbl">Distancia</div>
            </div>
          </div>

          <div class="itinerary-flow mt-4">
            <h4>Secuencia de Vuelo Sugerida</h4>
            <div v-if="!currentItiPath.length" class="empty-iti">
              No se encontraron rutas que cumplan con los filtros de presupuesto y tiempo. Intenta ampliarlos.
            </div>
            <div v-else class="flow-list">
              <div 
                v-for="(seg, idx) in currentItiPath" 
                :key="idx" 
                class="flow-item"
                @mouseenter="highlightSegment(seg)"
                @mouseleave="clearHighlight"
              >
                <div class="flow-marker">
                  <div class="dot"></div>
                  <div class="line" v-if="idx < currentItiPath.length - 1"></div>
                </div>
                <div class="flow-content">
                  <div class="flow-header">
                    <span class="segment-title">{{ seg.origin }} ✈ {{ seg.dest }}</span>
                    <span class="badge badge-accent">{{ seg.aircraft_type }}</span>
                  </div>
                  <div class="flow-details text-muted">
                    <span>Distancia: {{ seg.distance_km }} km</span> •
                    <span>Tiempo: {{ (seg.flight_time_min / 60).toFixed(1) }}h</span> •
                    <span class="text-green">Coste: ${{ seg.cost_usd.toFixed(2) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <button 
            v-if="currentItiPath.length" 
            class="btn btn-secondary btn-block mt-3"
            @click="startSimulationWithItinerary"
          >
            🎮 Iniciar Simulación con esta Ruta
          </button>
        </div>
      </div>
    </div>

    <!-- MODE 2: POINT-TO-POINT BEST ROUTE -->
    <div v-if="activeMode === 'point2point'" class="form-container">
      <div class="card form-card">
        <h3>Encontrar Mejor Ruta</h3>
        <p class="desc text-muted">Calcula el camino más corto entre dos ciudades específicas utilizando criterios de optimización seleccionables.</p>

        <!-- Origin and Destination -->
        <div class="row">
          <div class="form-group flex-1">
            <label>Origen</label>
            <div class="autocomplete">
              <input 
                v-model="p2pForm.origin" 
                @focus="showP2pOriginList = true"
                @input="onP2pOriginInput"
                class="input"
                placeholder="Origen..."
              />
              <ul v-if="showP2pOriginList && filteredP2pOrigins.length" class="autocomplete-list">
                <li 
                  v-for="a in filteredP2pOrigins" 
                  :key="a.id"
                  @click="selectP2pOrigin(a.id)"
                >
                  <span class="iata">{{ a.id }}</span>
                  <span class="city-name">{{ a.city }}</span>
                </li>
              </ul>
            </div>
          </div>

          <div class="form-group flex-1">
            <label>Destino</label>
            <div class="autocomplete">
              <input 
                v-model="p2pForm.dest" 
                @focus="showP2pDestList = true"
                @input="onP2pDestInput"
                class="input"
                placeholder="Destino..."
              />
              <ul v-if="showP2pDestList && filteredP2pDests.length" class="autocomplete-list">
                <li 
                  v-for="a in filteredP2pDests" 
                  :key="a.id"
                  @click="selectP2pDest(a.id)"
                >
                  <span class="iata">{{ a.id }}</span>
                  <span class="city-name">{{ a.city }}</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <!-- Optimization Criteria Checklist -->
        <div class="form-group">
          <label>Criterios a Comparar</label>
          <div class="criteria-grid">
            <label class="checkbox-label">
              <input type="checkbox" value="cost_usd" v-model="p2pForm.criteria" />
              <span>💰 Menor Coste ($)</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" value="flight_time_min" v-model="p2pForm.criteria" />
              <span>⏱ Menor Tiempo (Min)</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" value="distance_km" v-model="p2pForm.criteria" />
              <span>📏 Menor Distancia (Km)</span>
            </label>
          </div>
        </div>

        <!-- Aircraft Filtering -->
        <div class="form-group">
          <label>Aeronaves Permitidas</label>
          <div class="aircraft-grid">
            <label v-for="ac in availableAircrafts" :key="ac" class="checkbox-label">
              <input type="checkbox" :value="ac" v-model="p2pForm.aircrafts" />
              <span>{{ ac }}</span>
            </label>
          </div>
        </div>

        <!-- Regional Routes Toggle -->
        <div class="form-group">
          <label class="checkbox-label flex-row">
            <input type="checkbox" v-model="p2pForm.includeSecondary" />
            <span>Incluir aeropuertos regionales secundarios</span>
          </label>
        </div>

        <button 
          class="btn btn-primary btn-block" 
          :disabled="loading || !p2pForm.origin || !p2pForm.dest"
          @click="searchBestRoute"
        >
          <span v-if="loading">Analizando Conectividad del Grafo...</span>
          <span v-else>🧭 Buscar Rutas</span>
        </button>
      </div>

      <div v-if="error" class="error-box mt-4">{{ error }}</div>

      <!-- POINT-TO-POINT RESULTS -->
      <div v-if="p2pResults" class="results-container mt-4">
        <h3>Comparativa de Rutas Óptimas</h3>
        
        <div class="comparative-table card">
          <div 
            v-for="(res, crit) in p2pResults.results" 
            :key="crit" 
            class="p2p-route-item"
            :class="{ active: selectedP2pCriterion === crit }"
            @click="selectP2pPath(crit, res.path)"
          >
            <div class="p2p-header-row">
              <span class="criterion-tag">{{ getCriterionLabel(crit) }}</span>
              <span v-if="res.path.length" class="hops-count">{{ res.path.length - 1 }} escalas</span>
              <span v-else class="hops-count text-red">Inalcanzable</span>
            </div>
            
            <div v-if="res.path.length" class="p2p-path-preview">
              <span v-for="(node, nIdx) in res.path" :key="nIdx" class="path-node">
                {{ node }}<span v-if="nIdx < res.path.length - 1" class="path-arrow">➔</span>
              </span>
            </div>

            <div v-if="res.path.length" class="p2p-stats text-muted">
              <span>Distancia: {{ sumSegments(res.segments, 'distance_km') }} km</span> |
              <span>Tiempo: {{ (sumSegments(res.segments, 'flight_time_min') / 60).toFixed(1) }} hrs</span> |
              <span class="text-green">Coste: ${{ sumSegments(res.segments, 'cost_usd').toFixed(2) }}</span>
            </div>
            <div v-else class="p2p-stats text-red">
              No existe ninguna combinación de vuelos aprobada bajo los criterios seleccionados.
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { planApi } from '@/api'
import { useGraphStore } from '@/stores/graph.store'
import { useUiStore } from '@/stores/ui.store'
import { useSessionStore } from '@/stores/session.store'
import type { ItineraryResponse, BestRouteResponse, TripSegment } from '@/types'

const graphStore = useGraphStore()
const uiStore = useUiStore()
const sessionStore = useSessionStore()

const activeMode = ref<'itinerary' | 'point2point'>('itinerary')
const loading = ref(false)
const error = ref<string | null>(null)

// Forms
const itiForm = ref({
  origin: '',
  budget: 4000,
  hours: 36,
  aircrafts: ['Avión Comercial', 'Avión Regional', 'Hélice'] as string[],
  includeSecondary: true
})

const p2pForm = ref({
  origin: '',
  dest: '',
  criteria: ['cost_usd', 'flight_time_min'] as string[],
  aircrafts: ['Avión Comercial', 'Avión Regional', 'Hélice'] as string[],
  includeSecondary: true
})

const availableAircrafts = ['Avión Comercial', 'Avión Regional', 'Hélice']

// Autocomplete filters
const showOriginList = ref(false)
const filteredOrigins = ref<any[]>([])

const showP2pOriginList = ref(false)
const filteredP2pOrigins = ref<any[]>([])
const showP2pDestList = ref(false)
const filteredP2pDests = ref<any[]>([])

// Results
const itineraryResult = ref<ItineraryResponse | null>(null)
const itiResultTab = ref<'budget' | 'time'>('budget')

const p2pResults = ref<BestRouteResponse | null>(null)
const selectedP2pCriterion = ref<string>('cost_usd')

// Computed itinerary selectors
const currentItiPath = computed((): TripSegment[] => {
  if (!itineraryResult.value) return []
  return itiResultTab.value === 'budget' 
    ? itineraryResult.value.by_budget 
    : itineraryResult.value.by_time
})

const itineraryCost = computed(() => currentItiPath.value.reduce((acc, s) => acc + s.cost_usd, 0))
const itineraryTime = computed(() => currentItiPath.value.reduce((acc, s) => acc + s.flight_time_min, 0))
const itineraryDistance = computed(() => currentItiPath.value.reduce((acc, s) => acc + s.distance_km, 0))

onMounted(async () => {
  if (!graphStore.isLoaded) {
    await graphStore.load()
  }
  // Initialize lists
  onOriginInput()
  onP2pOriginInput()
  onP2pDestInput()
})

// Autocomplete Methods
function onOriginInput() {
  const q = itiForm.value.origin.trim().toLowerCase()
  filteredOrigins.value = graphStore.airports.filter(
    a => a.id.toLowerCase().includes(q) || a.city.toLowerCase().includes(q)
  ).slice(0, 10)
}

function selectOrigin(id: string) {
  itiForm.value.origin = id
  showOriginList.value = false
}

function onP2pOriginInput() {
  const q = p2pForm.value.origin.trim().toLowerCase()
  filteredP2pOrigins.value = graphStore.airports.filter(
    a => a.id.toLowerCase().includes(q) || a.city.toLowerCase().includes(q)
  ).slice(0, 10)
}

function selectP2pOrigin(id: string) {
  p2pForm.value.origin = id
  showP2pOriginList.value = false
}

function onP2pDestInput() {
  const q = p2pForm.value.dest.trim().toLowerCase()
  filteredP2pDests.value = graphStore.airports.filter(
    a => a.id.toLowerCase().includes(q) || a.city.toLowerCase().includes(q)
  ).slice(0, 10)
}

function selectP2pDest(id: string) {
  p2pForm.value.dest = id
  showP2pDestList.value = false
}

// Action Handlers
async function planItinerary() {
  if (!itiForm.value.origin) {
    error.value = 'Debes seleccionar un aeropuerto de origen.'
    return
  }
  loading.value = true
  error.value = null
  try {
    const res = await planApi.itinerary({
      origin: itiForm.value.origin,
      budget_usd: itiForm.value.budget,
      time_hours: itiForm.value.hours,
      aircraft_types: itiForm.value.aircrafts,
      include_secondary: itiForm.value.includeSecondary
    })
    itineraryResult.value = res
    if (res.by_budget.length) {
      selectItineraryPath('budget')
    } else if (res.by_time.length) {
      selectItineraryPath('time')
    }
    uiStore.toast('success', 'Itinerario calculado exitosamente')
  } catch (e: any) {
    error.value = e.message
    itineraryResult.value = null
  } finally {
    loading.value = false
  }
}

function selectItineraryPath(type: 'budget' | 'time') {
  itiResultTab.value = type
  if (!itineraryResult.value) return
  const path = currentItiPath.value
  const nodeSequence = path.length ? [path[0].origin, ...path.map(p => p.dest)] : []
  uiStore.highlightPath(nodeSequence)
}

async function searchBestRoute() {
  if (!p2pForm.value.origin || !p2pForm.value.dest) return
  loading.value = true
  error.value = null
  try {
    const res = await planApi.bestRoute({
      origin: p2pForm.value.origin,
      destination: p2pForm.value.dest,
      criteria: p2pForm.value.criteria,
      aircraft_types: p2pForm.value.aircrafts,
      include_secondary: p2pForm.value.includeSecondary
    })
    p2pResults.value = res
    // select first valid criterion path
    const availableCrits = Object.keys(res.results)
    if (availableCrits.length > 0) {
      const firstCrit = availableCrits[0]
      selectP2pPath(firstCrit, res.results[firstCrit].path)
    }
    uiStore.toast('success', 'Rutas óptimas punto a punto calculadas')
  } catch (e: any) {
    error.value = e.message
    p2pResults.value = null
  } finally {
    loading.value = false
  }
}

function selectP2pPath(criterion: string, path: string[]) {
  selectedP2pCriterion.value = criterion
  uiStore.highlightPath(path)
}

function highlightSegment(seg: TripSegment) {
  uiStore.highlightPath([seg.origin, seg.dest])
}

function clearHighlight() {
  if (activeMode.value === 'itinerary' && currentItiPath.value.length) {
    const path = currentItiPath.value
    uiStore.highlightPath([path[0].origin, ...path.map(p => p.dest)])
  } else {
    uiStore.clearHighlight()
  }
}

async function startSimulationWithItinerary() {
  if (!itiForm.value.origin) return
  try {
    await sessionStore.startTrip(itiForm.value.origin, itiForm.value.budget, itiForm.value.hours)
    uiStore.setPanel('r3') // Go to simulation dashboard tab
    uiStore.toast('success', `Simulación iniciada en ${itiForm.value.origin}`)
  } catch (e: any) {
    uiStore.toast('error', `Error iniciando viaje: ${e.message}`)
  }
}

// Helpers
function sumSegments(segments: TripSegment[], key: 'cost_usd' | 'flight_time_min' | 'distance_km'): number {
  return segments.reduce((acc, s) => acc + (s[key] as number), 0)
}

function getCriterionLabel(crit: string): string {
  switch (crit) {
    case 'cost_usd': return 'Optimizado por Coste (USD)'
    case 'flight_time_min': return 'Optimizado por Duración'
    case 'distance_km': return 'Optimizado por Distancia'
    default: return crit
  }
}
</script>

<style scoped>
.r2-planner {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.section-header {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.section-header h2 {
  font-size: 16px;
  font-weight: 600;
}

.mode-selector {
  display: grid;
  grid-template-columns: 1fr 1fr;
  background: var(--sky-surface);
  border: 1px solid var(--sky-border);
  border-radius: var(--radius-md);
  padding: 4px;
}

.mode-btn {
  background: none;
  border: none;
  color: var(--sky-text3);
  padding: 8px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-family: var(--font-ui);
  font-weight: 600;
  font-size: 12px;
  transition: var(--transition);
}

.mode-btn:hover {
  color: var(--sky-text);
}

.mode-btn.active {
  background: var(--sky-card);
  color: var(--sky-accent2);
}

.form-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.form-card h3 {
  font-size: 14px;
  font-weight: 600;
}

.form-card p.desc {
  font-size: 11px;
  margin-top: -6px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.row {
  display: flex;
  gap: 12px;
}

.flex-1 {
  flex: 1;
}

.flex-row {
  flex-direction: row;
  align-items: center;
  gap: 8px;
}

.aircraft-grid {
  display: flex;
  flex-direction: column;
  gap: 6px;
  background: var(--sky-surface);
  padding: 8px;
  border: 1px solid var(--sky-border);
  border-radius: var(--radius-md);
}

.criteria-grid {
  display: flex;
  flex-direction: column;
  gap: 6px;
  background: var(--sky-surface);
  padding: 8px;
  border: 1px solid var(--sky-border);
  border-radius: var(--radius-md);
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  cursor: pointer;
  user-select: none;
}

.btn-block {
  width: 100%;
  justify-content: center;
}

.autocomplete {
  position: relative;
}

.autocomplete-list {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  max-height: 160px;
  overflow-y: auto;
  background: var(--sky-card);
  border: 1px solid var(--sky-border);
  border-radius: var(--radius-md);
  list-style: none;
  z-index: 1000;
}

.autocomplete-list li {
  padding: 8px;
  cursor: pointer;
  display: flex;
  gap: 8px;
}

.autocomplete-list li:hover {
  background: var(--sky-surface);
}

.autocomplete-list li .iata {
  font-weight: 700;
  color: var(--sky-accent2);
}

.error-box {
  background: #3b1414;
  border: 1px solid var(--sky-red);
  color: var(--sky-red);
  padding: 10px;
  border-radius: var(--radius-md);
  font-size: 12px;
}

.tabs-sub {
  display: flex;
  border-bottom: 1px solid var(--sky-border);
  gap: 8px;
}

.tab-sub {
  background: none;
  border: none;
  color: var(--sky-text3);
  padding: 8px 12px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  position: relative;
}

.tab-sub.active {
  color: var(--sky-text);
}

.tab-sub.active::after {
  content: '';
  position: absolute;
  bottom: -1px;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--sky-accent);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
  text-align: center;
}

.stat-card {
  background: var(--sky-surface);
  border: 1px solid var(--sky-border);
  border-radius: var(--radius-md);
  padding: 8px 4px;
}

.stat-card .num {
  font-size: 15px;
  font-weight: 700;
  color: var(--sky-accent2);
}

.stat-card .lbl {
  font-size: 9px;
  color: var(--sky-text3);
  text-transform: uppercase;
}

.itinerary-flow h4 {
  font-size: 12px;
  margin-bottom: 8px;
}

.empty-iti {
  font-size: 11px;
  color: var(--sky-text3);
  text-align: center;
  padding: 16px 0;
}

.flow-list {
  display: flex;
  flex-direction: column;
}

.flow-item {
  display: flex;
  gap: 12px;
  padding: 8px;
  border-radius: var(--radius-sm);
  transition: var(--transition);
  cursor: pointer;
}

.flow-item:hover {
  background: var(--sky-surface);
}

.flow-marker {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 12px;
}

.flow-marker .dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--sky-accent);
  margin-top: 4px;
}

.flow-marker .line {
  width: 2px;
  flex-grow: 1;
  background: var(--sky-border);
  margin: 4px 0;
}

.flow-content {
  flex-grow: 1;
}

.flow-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.segment-title {
  font-weight: 600;
  font-size: 13px;
}

.flow-details {
  font-size: 11px;
  display: flex;
  gap: 6px;
}

.p2p-route-item {
  padding: 12px;
  border-bottom: 1px solid var(--sky-border);
  cursor: pointer;
  transition: var(--transition);
}

.p2p-route-item:last-child {
  border-bottom: none;
}

.p2p-route-item:hover {
  background: var(--sky-surface);
}

.p2p-route-item.active {
  background: #0d1e3d;
  border-left: 3px solid var(--sky-accent);
}

.p2p-header-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 6px;
}

.criterion-tag {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--sky-accent2);
}

.hops-count {
  font-size: 11px;
  color: var(--sky-text3);
}

.p2p-path-preview {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 8px;
  font-family: var(--font-mono);
  font-weight: 600;
  font-size: 12px;
}

.path-arrow {
  margin: 0 4px;
  color: var(--sky-text3);
}

.p2p-stats {
  font-size: 11px;
}

.mt-2 { margin-top: 8px; }
.mt-3 { margin-top: 12px; }
.mt-4 { margin-top: 16px; }
</style>
