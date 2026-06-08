<template>
  <div class="r4-events">
    <div class="section-header">
      <h2>Control de Eventos e Incidencias</h2>
      <span class="text-muted">R4 — Monitoreo de Red en Tiempo Real</span>
    </div>

    <!-- SIMULATE BLOCKAGE CARD -->
    <div class="card event-form-card">
      <h3>Simular Bloqueo de Ruta</h3>
      <p class="desc text-muted">Afecta la conectividad regional bloqueando una ruta directa debido a mal clima o fallas operacionales.</p>
      
      <div class="row">
        <!-- Origin Selector -->
        <div class="form-group flex-1">
          <label>Origen</label>
          <div class="autocomplete">
            <input 
              v-model="blockForm.origin" 
              @focus="showOriginList = true"
              @input="onOriginInput"
              class="input"
              placeholder="Origen..."
            />
            <ul v-if="showOriginList && filteredOrigins.length" class="autocomplete-list">
              <li v-for="a in filteredOrigins" :key="a.id" @click="selectOrigin(a.id)">
                <span class="iata">{{ a.id }}</span>
                <span class="city-name">{{ a.city }}</span>
              </li>
            </ul>
          </div>
        </div>

        <!-- Destination Selector -->
        <div class="form-group flex-1">
          <label>Destino</label>
          <div class="autocomplete">
            <input 
              v-model="blockForm.dest" 
              @focus="showDestList = true"
              @input="onDestInput"
              class="input"
              placeholder="Destino..."
            />
            <ul v-if="showDestList && filteredDests.length" class="autocomplete-list">
              <li v-for="a in filteredDests" :key="a.id" @click="selectDest(a.id)">
                <span class="iata">{{ a.id }}</span>
                <span class="city-name">{{ a.city }}</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <button 
        class="btn btn-danger btn-block mt-3" 
        :disabled="loading || !blockForm.origin || !blockForm.dest"
        @click="blockRoute"
      >
        ⚠️ Simular Cancelación
      </button>
    </div>

    <!-- LIST OF BLOCKED ROUTES -->
    <div class="card blocked-list-card mt-3">
      <h3>Rutas Suspendidas ({{ graphStore.blocked.length }})</h3>
      <div v-if="!graphStore.blocked.length" class="empty-blocked">
        🟢 Todos los corredores aéreos operan con normalidad.
      </div>
      <div v-else class="blocked-list">
        <div 
          v-for="b in graphStore.blocked" 
          :key="`${b.origin}-${b.dest}`" 
          class="blocked-item"
        >
          <div class="blocked-info">
            <span class="danger-badge">BLOQUEADO</span>
            <span class="route-name">{{ b.origin }} ➔ {{ b.dest }}</span>
          </div>
          <button 
            class="btn btn-secondary btn-sm"
            @click="unblockRoute(b.origin, b.dest)"
          >
            Reabrir
          </button>
        </div>
      </div>
    </div>

    <!-- EMERGENCY REROUTING -->
    <div class="card recalculate-card mt-3">
      <h3>Desvío de Emergencia (Dijkstra)</h3>
      <p class="desc text-muted">Si la ruta actual ha quedado inhabilitada, recalcula el camino alternativo más económico disponible.</p>

      <div class="row">
        <div class="form-group flex-1">
          <label>Posición Actual</label>
          <div class="autocomplete">
            <input 
              v-model="recalcForm.current" 
              @focus="showRecalcCurrentList = true"
              @input="onRecalcCurrentInput"
              class="input"
              placeholder="Posición..."
            />
            <ul v-if="showRecalcCurrentList && filteredRecalcCurrent.length" class="autocomplete-list">
              <li v-for="a in filteredRecalcCurrent" :key="a.id" @click="selectRecalcCurrent(a.id)">
                <span class="iata">{{ a.id }}</span>
                <span class="city-name">{{ a.city }}</span>
              </li>
            </ul>
          </div>
        </div>

        <div class="form-group flex-1">
          <label>Destino Final</label>
          <div class="autocomplete">
            <input 
              v-model="recalcForm.dest" 
              @focus="showRecalcDestList = true"
              @input="onRecalcDestInput"
              class="input"
              placeholder="Destino..."
            />
            <ul v-if="showRecalcDestList && filteredRecalcDests.length" class="autocomplete-list">
              <li v-for="a in filteredRecalcDests" :key="a.id" @click="selectRecalcDest(a.id)">
                <span class="iata">{{ a.id }}</span>
                <span class="city-name">{{ a.city }}</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <button 
        class="btn btn-primary btn-block mt-3" 
        :disabled="loading || !recalcForm.current || !recalcForm.dest"
        @click="recalculatePath"
      >
        🧭 Recalcular Itinerario Alternativo
      </button>

      <!-- Recalculated Reroute Results -->
      <div v-if="recalcResult" class="recalc-results mt-3">
        <div v-if="!recalcResult.found" class="error-box">
          ⚠️ No existe ninguna ruta alternativa viable con las aeronaves y conexiones activas actuales.
        </div>
        <div v-else class="success-box card">
          <div class="recalc-summary mb-2">
            <span class="badge badge-accent">Nuevo Itinerario Hallado</span>
            <span class="cost text-green" v-if="recalcResult.total_cost">${{ recalcResult.total_cost.toFixed(2) }}</span>
          </div>
          <div class="path-sequence mt-2">
            <span v-for="(node, idx) in recalcResult.path" :key="idx" class="path-node">
              {{ node }}<span v-if="idx < recalcResult.path.length - 1" class="arrow">➔</span>
            </span>
          </div>
          <div class="segment-breakdown mt-2">
            <div 
              v-for="(s, sIdx) in recalcResult.segments" 
              :key="sIdx" 
              class="recalc-segment-item"
            >
              <span>{{ s.origin }} ➔ {{ s.dest }} ({{ s.aircraft_type }})</span>
              <span class="text-green">${{ s.cost_usd.toFixed(2) }}</span>
            </div>
          </div>
          <button 
            class="btn btn-primary btn-block mt-3"
            @click="applyEmergencyPath"
          >
            🗺 Trazar esta nueva ruta en el Mapa
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { eventsApi } from '@/api'
import { useGraphStore } from '@/stores/graph.store'
import { useUiStore } from '@/stores/ui.store'
import { useSessionStore } from '@/stores/session.store'
import type { RecalculateResponse } from '@/types'

const graphStore = useGraphStore()
const uiStore = useUiStore()
const sessionStore = useSessionStore()

const loading = ref(false)

// Forms
const blockForm = ref({
  origin: '',
  dest: ''
})

const recalcForm = ref({
  current: '',
  dest: ''
})

// Autocompletes
const showOriginList = ref(false)
const filteredOrigins = ref<any[]>([])
const showDestList = ref(false)
const filteredDests = ref<any[]>([])

const showRecalcCurrentList = ref(false)
const filteredRecalcCurrent = ref<any[]>([])
const showRecalcDestList = ref(false)
const filteredRecalcDests = ref<any[]>([])

// Results
const recalcResult = ref<RecalculateResponse | null>(null)

onMounted(async () => {
  if (!graphStore.isLoaded) {
    await graphStore.load()
  }
  onOriginInput()
  onDestInput()
  onRecalcCurrentInput()
  onRecalcDestInput()
  
  if (sessionStore.isActive && sessionStore.session) {
    recalcForm.value.current = sessionStore.session.current_airport
  }
})

watch(() => sessionStore.inTransit, (t) => {
  if (t) {
    blockForm.value.origin = t.origin
    blockForm.value.dest = t.dest
  }
}, { immediate: true })

// Autocomplete actions
function onOriginInput() {
  const q = blockForm.value.origin.trim().toLowerCase()
  filteredOrigins.value = graphStore.airports.filter(
    a => a.id.toLowerCase().includes(q) || a.city.toLowerCase().includes(q)
  ).slice(0, 10)
}

function selectOrigin(id: string) {
  blockForm.value.origin = id
  showOriginList.value = false
}

function onDestInput() {
  const q = blockForm.value.dest.trim().toLowerCase()
  filteredDests.value = graphStore.airports.filter(
    a => a.id.toLowerCase().includes(q) || a.city.toLowerCase().includes(q)
  ).slice(0, 10)
}

function selectDest(id: string) {
  blockForm.value.dest = id
  showDestList.value = false
}

function onRecalcCurrentInput() {
  const q = recalcForm.value.current.trim().toLowerCase()
  filteredRecalcCurrent.value = graphStore.airports.filter(
    a => a.id.toLowerCase().includes(q) || a.city.toLowerCase().includes(q)
  ).slice(0, 10)
}

function selectRecalcCurrent(id: string) {
  recalcForm.value.current = id
  showRecalcCurrentList.value = false
}

function onRecalcDestInput() {
  const q = recalcForm.value.dest.trim().toLowerCase()
  filteredRecalcDests.value = graphStore.airports.filter(
    a => a.id.toLowerCase().includes(q) || a.city.toLowerCase().includes(q)
  ).slice(0, 10)
}

function selectRecalcDest(id: string) {
  recalcForm.value.dest = id
  showRecalcDestList.value = false
}

// Button click handlers
async function blockRoute() {
  const { origin, dest } = blockForm.value
  if (!origin || !dest) return
  if (sessionStore.isInTransit && sessionStore.inTransit?.origin === origin && sessionStore.inTransit?.dest === dest) {
    uiStore.toast('warning', 'Bloqueando ruta activa — el vuelo regresará al origen')
  }
  loading.value = true
  try {
    await eventsApi.block({ origin, dest, session_id: sessionStore.sessionId || undefined })
    await graphStore.refreshBlocked()
    uiStore.toast('warning', `Corredor aéreo ${origin} ➔ ${dest} cerrado`)
    blockForm.value.dest = '' // reset dest
  } catch (e: any) {
    uiStore.toast('error', `Error al bloquear: ${e.message}`)
  } finally {
    loading.value = false
  }
}

async function unblockRoute(origin: string, dest: string) {
  loading.value = true
  try {
    await eventsApi.unblock({ origin, dest })
    await graphStore.refreshBlocked()
    uiStore.toast('success', `Corredor aéreo ${origin} ➔ ${dest} rehabilitado`)
  } catch (e: any) {
    uiStore.toast('error', `Error al desbloquear: ${e.message}`)
  } finally {
    loading.value = false
  }
}

async function recalculatePath() {
  const { current, dest } = recalcForm.value
  if (!current || !dest) return
  loading.value = true
  try {
    const res = await eventsApi.recalculate({
      current_node: current,
      final_destination: dest
    })
    recalcResult.value = res
    if (res.found && res.path) {
      uiStore.highlightPath(res.path)
      uiStore.toast('success', 'Nueva ruta calculada con Dijkstra de desvío')
    } else {
      uiStore.toast('error', 'No se encontró una ruta alternativa viable')
    }
  } catch (e: any) {
    uiStore.toast('error', `Error al recalcular: ${e.message}`)
    recalcResult.value = null
  } finally {
    loading.value = false
  }
}

function applyEmergencyPath() {
  if (recalcResult.value?.path) {
    uiStore.highlightPath(recalcResult.value.path)
  }
}
</script>

<style scoped>
.r4-events {
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

.event-form-card h3 {
  font-size: 14px;
  font-weight: 600;
}

.event-form-card p.desc, .recalculate-card p.desc {
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

.btn-block {
  width: 100%;
  justify-content: center;
}

.blocked-list-card h3, .recalculate-card h3 {
  font-size: 14px;
  font-weight: 600;
}

.empty-blocked {
  font-size: 12px;
  text-align: center;
  padding: 16px 0;
  color: var(--sky-text2);
}

.blocked-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 200px;
  overflow-y: auto;
}

.blocked-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--sky-surface);
  border: 1px solid var(--sky-border);
  padding: 8px 12px;
  border-radius: var(--radius-md);
}

.blocked-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.danger-badge {
  background: rgba(239, 68, 68, 0.15);
  color: var(--sky-red);
  border: 1px solid rgba(239, 68, 68, 0.3);
  font-size: 9px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
}

.route-name {
  font-weight: 600;
  font-size: 13px;
  font-family: var(--font-mono);
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

.success-box {
  background: var(--sky-surface);
  border: 1px solid var(--sky-border);
  padding: 12px;
  border-radius: var(--radius-md);
}

.recalc-summary {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.recalc-summary .cost {
  font-weight: 700;
  font-size: 16px;
}

.path-sequence {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  font-family: var(--font-mono);
  font-weight: 600;
  font-size: 12px;
}

.path-sequence .arrow {
  color: var(--sky-text3);
  margin: 0 4px;
}

.segment-breakdown {
  display: flex;
  flex-direction: column;
  gap: 4px;
  border-top: 1px dashed var(--sky-border);
  padding-top: 8px;
}

.recalc-segment-item {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
}

.mt-3 { margin-top: 12px; }
</style>
