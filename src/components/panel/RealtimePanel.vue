<template>
  <div class="realtime-panel">
    <div class="panel-header">
      <h3>Simulación en Tiempo Real</h3>
      <span class="conn-badge" :data-mode="connectionMode">{{ connectionModeLabel }}</span>
    </div>

    <!-- Control Form -->
    <div class="control-card card">
      <div class="form-group">
        <label>Aeropuerto de Origen</label>
        <div class="autocomplete">
          <input
            v-model="origin"
            @focus="showOriginList = true"
            @input="onOriginInput"
            @keydown="onInputKeydown"
            class="input"
            placeholder="Escribe para buscar origen..."
          />
          <ul v-if="showOriginList && filteredOrigins.length" class="autocomplete-list">
            <li
              v-for="(a, idx) in filteredOrigins"
              :key="a.id"
              @click="pickOrigin(a.id)"
              @mouseover="highlightedIndex = idx"
              :class="{ active: idx === highlightedIndex }"
            >
              <span class="iata">{{ a.id }}</span>
              <span class="city">{{ a.city }}</span>
            </li>
          </ul>
        </div>
      </div>

      <div class="row">
        <div class="form-group flex-1">
          <label>Presupuesto ($)</label>
          <input v-model.number="budget" type="number" min="0" class="input" />
        </div>
        <div class="form-group flex-1">
          <label>Tiempo Máx (Horas)</label>
          <input v-model.number="hours" type="number" min="1" class="input" />
        </div>
      </div>

      <div class="buttons-grid">
        <button
          class="btn btn-primary"
          @click="start"
          :disabled="sessionStore.loading || sessionStore.isActive"
        >
          🚀 Iniciar Viaje
        </button>
        <button
          class="btn btn-danger"
          @click="end"
          :disabled="!sessionStore.isActive"
        >
          ⏹ Finalizar
        </button>
      </div>

      <button
        class="btn btn-secondary btn-block"
        @click="toggleRealtime"
        style="margin-top: 10px;"
      >
        {{ connected ? '🔌 Desconectar Servidor' : '⚡ Conectar Servidor' }}
      </button>
    </div>

    <!-- Active Session status -->
    <h4>Estado del Itinerario</h4>
    <div class="session-box card">
      <div v-slot:default v-if="sessionStore.session" class="session-details">
        <div class="detail-row">
          <span class="label">ID de Sesión:</span>
          <span class="value code">{{ sessionStore.session.session_id.substring(0, 8) }}...</span>
        </div>
        <div class="detail-row">
          <span class="label">Ubicación Actual:</span>
          <span class="value highlight">{{ sessionStore.session.current_airport }}</span>
        </div>
        <div class="detail-row">
          <span class="label">Presupuesto Restante:</span>
          <span class="value text-green">${{ sessionStore.session.budget_remaining.toFixed(2) }}</span>
        </div>
        <div class="detail-row">
          <span class="label">Tiempo Restante:</span>
          <span class="value text-gold">{{ sessionStore.session.time_remaining_hours }} horas</span>
        </div>

        <div class="budget-bar-container">
          <div class="budget-bar" :style="{ width: sessionStore.budgetPct + '%' }"></div>
        </div>
      </div>
      <div v-slot:default v-else class="muted text-center">
        No hay simulación activa. Define el origen e inicia un viaje.
      </div>
    </div>

    <!-- Flight execution panel -->
    <div v-slot:default v-if="sessionStore.isActive" class="action-card card">
      <h4>Ejecutar Vuelo</h4>
      <div class="fly-row" v-if="uiStore.selectedAirport">
        <div class="destination-preview">
          Destino: <span class="iata-dest">{{ uiStore.selectedAirport }}</span>
        </div>
        <div class="aircraft-select" v-slot:default v-if="aircraftOptions.length">
          <label>Aeronave:</label>
          <select v-model="selectedAircraft" class="select">
            <option v-for="opt in aircraftOptions" :key="opt.aircraft_type" :value="opt.aircraft_type">
              {{ opt.aircraft_type }} (Coste: ${{ opt.cost_usd }})
            </option>
          </select>
        </div>
        <button class="btn btn-primary btn-block" @click="flySelected">
          ✈ Confirmar y Volar
        </button>
      </div>
      <div v-slot:default v-else class="muted">
        Selecciona un aeropuerto de destino en el mapa o lista para volar.
      </div>
    </div>

    <!-- Event logs -->
    <h4>Registro de Simulación</h4>
    <div class="log">
      <div v-for="(l, i) in recentLog" :key="i" class="log-line">
        <span class="time">[{{ recentLog.length - i }}]</span> {{ l }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import realtime from '@/realtime'
import { useSessionStore } from '@/stores/session.store'
import { useGraphStore } from '@/stores/graph.store'
import { useUiStore } from '@/stores/ui.store'

const sessionStore = useSessionStore()

const origin = ref('')
const budget = ref(5000)
const hours = ref(20)
const connected = ref(false)
const connectionMode = ref<'none' | 'ws' | 'polling' | 'disconnected'>('none')
const graphStore = useGraphStore()
const uiStore = useUiStore()
const showOriginList = ref(false)
const filteredOrigins = ref<any[]>([])
const highlightedIndex = ref(-1)
const selectedAircraft = ref<string | null>(null)
const aircraftOptions = ref<Array<{ aircraft_type: string; cost_usd?: number }>>([])

let handleGraph: any = null
let handleSession: any = null
let handleEvent: any = null

let onConnected: (() => void) | null = null
let onWsFailed: (() => void) | null = null
let onDisconnected: (() => void) | null = null

const connectionModeLabel = computed(() => {
  switch (connectionMode.value) {
    case 'ws': return 'Tiempo Real'
    case 'polling': return 'Sincronizado'
    case 'disconnected': return 'Desconectado'
    default: return 'Inactivo'
  }
})

function start() {
  if (!origin.value) return sessionStore.error = 'Selecciona un aeropuerto de origen'
  sessionStore.startTrip(origin.value, budget.value, hours.value)
}

function end() { sessionStore.endTrip(); sessionStore.reset() }

function toggleRealtime() {
  if (connected.value) {
    if (handleGraph) realtime.off('graph', handleGraph)
    if (handleSession) realtime.off('session', handleSession)
    if (handleEvent) realtime.off('event', handleEvent)
    if (onConnected) realtime.off('connected', onConnected)
    if (onWsFailed) realtime.off('ws-failed', onWsFailed)
    if (onDisconnected) realtime.off('disconnected', onDisconnected)
    realtime.close()
    connected.value = false
    connectionMode.value = 'none'
    handleGraph = handleSession = handleEvent = null
    onConnected = onWsFailed = onDisconnected = null
    return
  }

  realtime.connect()
  handleGraph = (p: any) => {
    try { graphStore.airports = p.airports; graphStore.routes = p.routes; graphStore.blocked = p.blocked } catch {}
  }
  handleSession = (p: any) => { try { sessionStore.session = p } catch {} }
  handleEvent = (p: any) => { try { sessionStore.eventLog.push(p.message ?? JSON.stringify(p)) } catch {} }

  realtime.on('graph', handleGraph)
  realtime.on('session', handleSession)
  realtime.on('event', handleEvent)

  onConnected = () => { connectionMode.value = 'ws' }
  onWsFailed = () => { connectionMode.value = 'polling' }
  onDisconnected = () => { connectionMode.value = 'disconnected' }
  realtime.on('connected', onConnected)
  realtime.on('ws-failed', onWsFailed)
  realtime.on('disconnected', onDisconnected)
  connected.value = true
}

async function flySelected() {
  const dest = uiStore.selectedAirport
  if (!dest) { sessionStore.error = 'Selecciona un aeropuerto destino en la lista'; return }
  if (!sessionStore.isActive) { sessionStore.error = 'No hay sesión activa'; return }
  const opt = sessionStore.flights.find(f => f.dest === dest)
  let aircraft = selectedAircraft.value ?? 'default'
  if (!selectedAircraft.value && opt) {
    aircraft = (opt as any).recommended_aircraft?.aircraft_type ?? (opt.aircraft_options?.[0]?.aircraft_type ?? 'default')
  }
  await sessionStore.fly(dest, aircraft)
}

function onOriginInput() {
  const q = origin.value.trim().toLowerCase()
  if (!q) { filteredOrigins.value = graphStore.airports.slice(0, 20); highlightedIndex.value = -1; return }
  filteredOrigins.value = graphStore.airports.filter(a => a.id.toLowerCase().includes(q) || a.city.toLowerCase().includes(q) || a.country.toLowerCase().includes(q)).slice(0, 20)
  highlightedIndex.value = -1
}

function pickOrigin(id: string) {
  origin.value = id
  showOriginList.value = false
  highlightedIndex.value = -1
}

function onInputKeydown(e: KeyboardEvent) {
  if (!showOriginList.value) return
  const max = filteredOrigins.value.length - 1
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    highlightedIndex.value = Math.min(max, Math.max(0, highlightedIndex.value + 1))
    scrollHighlightedIntoView()
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    highlightedIndex.value = Math.max(0, highlightedIndex.value - 1)
    scrollHighlightedIntoView()
  } else if (e.key === 'Enter') {
    e.preventDefault()
    if (highlightedIndex.value >= 0 && highlightedIndex.value <= max) {
      const sel = filteredOrigins.value[highlightedIndex.value]
      if (sel) pickOrigin(sel.id)
    } else if (filteredOrigins.value.length === 1) {
      pickOrigin(filteredOrigins.value[0].id)
    }
  } else if (e.key === 'Escape') {
    showOriginList.value = false
    highlightedIndex.value = -1
  }
}

function scrollHighlightedIntoView() {
  const list = document.querySelector('.autocomplete-list') as HTMLElement | null
  if (!list) return
  const items = list.querySelectorAll('li')
  if (highlightedIndex.value < 0 || highlightedIndex.value >= items.length) return
  const el = items[highlightedIndex.value] as HTMLElement
  const rect = el.getBoundingClientRect()
  const listRect = list.getBoundingClientRect()
  if (rect.top < listRect.top) el.scrollIntoView({ block: 'nearest' })
  else if (rect.bottom > listRect.bottom) el.scrollIntoView({ block: 'nearest' })
}

watch(() => [uiStore.selectedAirport, sessionStore.flights], () => {
  const dest = uiStore.selectedAirport
  if (!dest) { aircraftOptions.value = []; selectedAircraft.value = null; return }
  const opt = sessionStore.flights.find(f => f.dest === dest)
  if (!opt) { aircraftOptions.value = []; selectedAircraft.value = null; return }
  aircraftOptions.value = (opt as any).aircraft_options?.map((a: any) => ({ aircraft_type: a.aircraft_type, cost_usd: a.cost_usd })) || []
  selectedAircraft.value = (opt as any).recommended_aircraft?.aircraft_type ?? aircraftOptions.value[0]?.aircraft_type ?? null
}, { deep: true })

const recentLog = computed(() => sessionStore.eventLog.slice(-50).reverse())

onMounted(() => {
  const onDoc = (e: MouseEvent) => {
    const tgt = e.target as HTMLElement
    if (!tgt.closest || !document.querySelector('.autocomplete')) return
    const ac = document.querySelector('.autocomplete')!
    if (!ac.contains(tgt)) { showOriginList.value = false; highlightedIndex.value = -1 }
  }
  document.addEventListener('click', onDoc)
  onUnmounted(() => document.removeEventListener('click', onDoc))
})
</script>

<style scoped>
.realtime-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.panel-header h3 {
  font-size: 16px;
  font-weight: 600;
  margin: 0;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 12px;
}

.form-group:last-child {
  margin-bottom: 0;
}

.row {
  display: flex;
  gap: 12px;
}

.flex-1 {
  flex: 1;
}

.buttons-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-top: 12px;
}

.btn-block {
  width: 100%;
  justify-content: center;
}

.session-details {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
}

.detail-row .label {
  color: var(--sky-text2);
}

.detail-row .value {
  font-weight: 600;
}

.detail-row .value.code {
  font-family: var(--font-mono);
  font-size: 12px;
}

.detail-row .value.highlight {
  color: var(--sky-accent2);
}

.budget-bar-container {
  height: 6px;
  background: var(--sky-surface);
  border-radius: 3px;
  overflow: hidden;
  margin-top: 6px;
}

.budget-bar {
  height: 100%;
  background: var(--sky-green);
  transition: width 0.3s ease;
}

.action-card {
  border-color: var(--sky-accent);
}

.destination-preview {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 10px;
}

.destination-preview .iata-dest {
  color: var(--sky-accent2);
  font-size: 18px;
  font-weight: 700;
}

.fly-row {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.aircraft-select {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.autocomplete {
  position: relative;
}

.autocomplete-list {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  max-height: 200px;
  overflow-y: auto;
  background: var(--sky-card);
  border: 1px solid var(--sky-border);
  border-radius: var(--radius-md);
  list-style: none;
  z-index: 1000;
  box-shadow: 0 4px 20px rgba(0,0,0,0.5);
}

.autocomplete-list li {
  padding: 8px 12px;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: var(--transition);
}

.autocomplete-list li:hover {
  background: var(--sky-surface);
}

.autocomplete-list li.active {
  background: var(--sky-accent);
}

.autocomplete-list li .iata {
  font-weight: 700;
  color: var(--sky-accent2);
}

.autocomplete-list li.active .iata {
  color: #fff;
}

.log {
  max-height: 200px;
  overflow-y: auto;
  background: #070b12;
  border: 1px solid var(--sky-border);
  border-radius: var(--radius-md);
  padding: 8px 12px;
  font-family: var(--font-mono);
}

.log-line {
  font-size: 11px;
  line-height: 1.5;
  color: var(--sky-text2);
  padding: 4px 0;
  border-bottom: 1px solid rgba(255,255,255,0.03);
}

.log-line .time {
  color: var(--sky-text3);
}

.conn-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 12px;
  color: #fff;
}

.conn-badge[data-mode="none"] { background: #4a5568; }
.conn-badge[data-mode="ws"] { background: var(--sky-green); }
.conn-badge[data-mode="polling"] { background: var(--sky-gold); }
.conn-badge[data-mode="disconnected"] { background: var(--sky-red); }

.text-center {
  text-align: center;
}
</style>
