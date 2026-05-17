<template>
  <div class="realtime-panel">
    <h3>Control de simulación <span class="conn-badge" :data-mode="connectionMode">{{ connectionModeLabel }}</span></h3>
    <div class="controls">
      <div class="autocomplete">
        <input
          v-model="origin"
          @focus="showOriginList = true"
          @input="onOriginInput"
          @keydown="onInputKeydown"
          placeholder="Selecciona origen..."
        />
        <ul v-if="showOriginList && filteredOrigins.length" class="autocomplete-list">
          <li v-for="(a, idx) in filteredOrigins" :key="a.id" @click="pickOrigin(a.id)" @mouseover="highlightedIndex = idx" :class="{ active: idx === highlightedIndex }">{{ a.id }} — {{ a.city }}</li>
        </ul>
      </div>
      <div class="row">
        <input v-model.number="budget" type="number" min="0" />
        <input v-model.number="hours" type="number" min="1" />
      </div>
      <div class="buttons">
        <button class="btn" @click="start" :disabled="sessionStore.loading || sessionStore.isActive">Iniciar</button>
        <button class="btn" @click="end" :disabled="!sessionStore.isActive">Finalizar</button>
        <button class="btn" @click="toggleRealtime">{{ connected ? 'Desconectar' : 'Conectar' }}</button>
      </div>
    </div>

    <h4>Sesión</h4>
    <div class="session-box">
      <div v-if="sessionStore.session">
        <div><strong>Session:</strong> {{ sessionStore.session.session_id }}</div>
        <div><strong>Current:</strong> {{ sessionStore.session.current_airport }}</div>
        <div><strong>Budget:</strong> ${{ sessionStore.session.budget_remaining.toFixed(2) }}</div>
        <div><strong>Time left:</strong> {{ sessionStore.session.time_remaining_hours }}h</div>
      </div>
      <div v-else class="muted">No hay sesión activa</div>
    </div>

    <h4>Registro de eventos</h4>
    <div class="log">
      <div v-for="(l, i) in recentLog" :key="i" class="log-line">{{ l }}</div>
    </div>
    <div style="margin-top:8px">
      <div class="fly-row">
        <div class="aircraft-select" v-if="aircraftOptions.length">
          <label>Avión:</label>
          <select v-model="selectedAircraft">
            <option v-for="opt in aircraftOptions" :key="opt.aircraft_type" :value="opt.aircraft_type">{{ opt.aircraft_type }} — ${{ opt.cost_usd }}</option>
          </select>
        </div>
        <button class="btn" @click="flySelected">Volar al seleccionado</button>
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

  // connect and subscribe handlers
  realtime.connect()
  handleGraph = (p: any) => {
    try { graphStore.airports = p.airports; graphStore.routes = p.routes; graphStore.blocked = p.blocked } catch {}
  }
  handleSession = (p: any) => { try { sessionStore.session = p } catch {} }
  handleEvent = (p: any) => { try { sessionStore.eventLog.push(p.message ?? JSON.stringify(p)) } catch {} }

  realtime.on('graph', handleGraph)
  realtime.on('session', handleSession)
  realtime.on('event', handleEvent)

  // connection state handlers
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
  // find flight option and use selected aircraft if provided
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
  // ensure the highlighted <li> is visible in the list
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

// update aircraft options when selected airport or flights change
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
  // click-away to close origin list
  const onDoc = (e: MouseEvent) => {
    const tgt = e.target as HTMLElement
    if (!tgt.closest || !document.querySelector('.autocomplete')) return
    const ac = document.querySelector('.autocomplete')!
    if (!ac.contains(tgt)) { showOriginList.value = false; highlightedIndex.value = -1 }
  }
  document.addEventListener('click', onDoc)
  onUnmounted(() => document.removeEventListener('click', onDoc))
})

// do not auto-connect; user toggles connection

</script>

<style scoped>
.realtime-panel { padding: 12px; display:flex; flex-direction:column; gap:10px }
.controls input { width:100%; padding:8px; margin-bottom:6px }
.row { display:flex; gap:8px }
.row input { flex:1 }
.buttons { display:flex; gap:8px }
.btn { padding:8px 10px; background:var(--sky-accent); color:white; border:none; border-radius:6px; cursor:pointer }
.session-box { background:var(--sky-surface); padding:8px; border-radius:6px }
.log { max-height:220px; overflow:auto; background:#071022; padding:8px; border-radius:6px }
.log-line { font-size:12px; padding:4px 0; border-bottom:1px dashed rgba(255,255,255,0.02) }
.muted { color:var(--sky-text2) }
.conn-badge { margin-left:10px; font-size:12px; padding:2px 8px; border-radius:12px; color:white }
.conn-badge[data-mode="none"] { background:#6b7280 }
.conn-badge[data-mode="ws"] { background:#10b981 }
.conn-badge[data-mode="polling"] { background:#f59e0b }
.conn-badge[data-mode="disconnected"] { background:#ef4444 }
.autocomplete { position:relative }
.autocomplete-list { position:absolute; top:36px; left:0; right:0; max-height:220px; overflow:auto; background:var(--sky-surface); border:1px solid var(--sky-border); border-radius:6px; z-index:50 }
.autocomplete-list li { padding:8px; cursor:pointer }
.autocomplete-list li:hover { background:var(--sky-border) }
.fly-row { display:flex; gap:8px; align-items:center }
.aircraft-select { display:flex; gap:6px; align-items:center }
.aircraft-select select { padding:6px }
.autocomplete-list li.active { background:var(--sky-accent); color:white }
</style>
