<template>
  <div class="r5-report">
    <div class="section-header">
      <h2>Informes y Rendimiento</h2>
      <span class="text-muted">R5 — Análisis de Simulación</span>
    </div>

    <!-- REPORT SEARCH/LOAD BOX -->
    <div class="card load-report-card">
      <h3>Cargar Historial de Sesión</h3>
      <p class="desc text-muted">Ingresa el identificador de un viaje finalizado o presiona el botón para cargar el estado actual.</p>
      
      <div class="row">
        <input 
          v-model="searchSessionId" 
          class="input font-mono" 
          placeholder="Código de Sesión..."
        />
        <button 
          class="btn btn-secondary btn-sm"
          @click="loadReport(searchSessionId)"
          :disabled="loading || !searchSessionId"
        >
          Cargar
        </button>
      </div>

      <button 
        v-if="sessionStore.isActive && sessionStore.sessionId"
        class="btn btn-primary btn-block mt-3"
        @click="loadReport(sessionStore.sessionId)"
        :disabled="loading"
      >
        📊 Cargar Reporte de Sesión Activa
      </button>
    </div>

    <!-- ERROR OR EMPTY BOX -->
    <div v-if="error" class="error-box mt-3">{{ error }}</div>

    <div v-if="!reportData && !loading" class="card empty-card text-center mt-3">
      <div class="empty-icon">📋</div>
      <h4>Sin Reporte Cargado</h4>
      <p class="text-muted">Carga el reporte de la sesión activa o consulta una sesión previa para ver el análisis de eficiencia del viaje.</p>
    </div>

    <div v-if="loading" class="card loading-card text-center mt-3">
      <div class="spinner"></div>
      <p class="mt-2">Generando análisis estadístico de vuelo...</p>
    </div>

    <!-- REPORT DETAILS (REPORT LOADED) -->
    <div v-if="reportData && !loading" class="report-content mt-3">
      <!-- SUMMARY CARDS -->
      <div class="card summary-card">
        <div class="session-label text-muted">CÓDIGO: {{ reportData.session_id }}</div>
        
        <div class="main-stats mt-3">
          <div class="stat-box">
            <span class="val text-green">${{ reportData.final_balance.toFixed(2) }}</span>
            <span class="lbl">Saldo Final</span>
          </div>
          <div class="stat-box">
            <span class="val">{{ reportData.destinations.length }}</span>
            <span class="lbl">Ciudades</span>
          </div>
          <div class="stat-box">
            <span class="val">{{ reportData.total_time_hours.toFixed(1) }}h</span>
            <span class="lbl">Tiempo Total</span>
          </div>
        </div>

        <div class="divider"></div>

        <div class="stats-table">
          <div class="row-stat">
            <span>Presupuesto Inicial</span>
            <span class="bold">${{ reportData.initial_budget.toFixed(2) }}</span>
          </div>
          <div class="row-stat">
            <span>Total Gastado</span>
            <span class="bold text-red">-${{ reportData.total_spent.toFixed(2) }}</span>
          </div>
          <div class="row-stat">
            <span>Total Ganado (Trabajos)</span>
            <span class="bold text-green">+${{ reportData.total_earned.toFixed(2) }}</span>
          </div>
          <div class="row-stat">
            <span>Distancia Recorrida</span>
            <span class="bold">{{ reportData.total_distance_km.toLocaleString() }} km</span>
          </div>
        </div>
      </div>

      <!-- PERFORMANCE SCORE CARD -->
      <div class="card score-card mt-3">
        <h3>Índice de Eficiencia Operativa</h3>
        <div class="score-body mt-2">
          <div class="dial-container">
            <div class="dial-circle">
              <span class="score-num">{{ efficiencyScore }}%</span>
            </div>
          </div>
          <div class="score-details">
            <p class="bold">{{ getScoreTier(efficiencyScore) }}</p>
            <p class="text-muted text-sm">{{ getScoreText(efficiencyScore) }}</p>
          </div>
        </div>
      </div>

      <!-- VISITED DESTINATIONS LIST -->
      <div class="card destinations-card mt-3">
        <h3>Destinos Visitados ({{ reportData.destinations.length }})</h3>
        <div class="destinations-timeline mt-2">
          <div 
            v-for="(d, idx) in reportData.destinations" 
            :key="d.iata_code" 
            class="dest-timeline-item"
          >
            <div class="dest-badge">{{ d.iata_code }}</div>
            <div class="dest-info">
              <div class="dest-header">
                <span class="dest-city">{{ d.city }}, {{ d.country }}</span>
                <span class="dest-cost text-green">${{ d.total_cost_usd.toFixed(2) }}</span>
              </div>
              <p class="text-muted text-xs">Estancia: {{ (d.stay_time_min / 60).toFixed(1) }} horas • {{ d.name }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- SEQUENTIAL TRAVEL LOGS -->
      <div class="card history-card mt-3">
        <h3>Bitácora Cronológica</h3>
        <div class="history-list mt-2">
          <!-- Merge activities, flights, and jobs chronologically -->
          <div 
            v-for="(item, idx) in chronologicalTimeline" 
            :key="idx" 
            class="history-item"
            :class="item.type"
          >
            <div class="item-icon">{{ getTimelineIcon(item.type) }}</div>
            <div class="item-body">
              <div class="item-title">{{ item.title }}</div>
              <div class="item-meta text-muted text-xs">
                <span>{{ item.meta }}</span>
                <span :class="item.costClass">{{ item.costText }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { reportApi } from '@/api'
import { useSessionStore } from '@/stores/session.store'
import { useUiStore } from '@/stores/ui.store'
import type { TripReport } from '@/types'

const sessionStore = useSessionStore()
const uiStore = useUiStore()

const searchSessionId = ref('')
const loading = ref(false)
const error = ref<string | null>(null)
const reportData = ref<TripReport | null>(null)

onMounted(() => {
  if (sessionStore.isActive && sessionStore.sessionId) {
    searchSessionId.value = sessionStore.sessionId
  }
})

async function loadReport(id: string) {
  if (!id) return
  loading.value = true
  error.value = null
  reportData.value = null
  try {
    const res = await reportApi.full(id)
    reportData.value = res
    uiStore.toast('success', `Reporte cargado con éxito para ${id.substring(0, 8)}`)
  } catch (e: any) {
    error.value = e.message
    uiStore.toast('error', `Error cargando reporte: ${e.message}`)
  } finally {
    loading.value = false
  }
}

// Calculate an efficiency score (arbitrary metric based on budget usage and cities visited)
const efficiencyScore = computed(() => {
  if (!reportData.value) return 0
  const cities = reportData.value.destinations.length
  if (cities === 0) return 0
  
  // High score = visited many cities while keeping final balance high
  const balanceRatio = Math.max(0, reportData.value.final_balance / reportData.value.initial_budget)
  const score = (cities * 15) + (balanceRatio * 40)
  return Math.min(100, Math.round(score))
})

// Timeline sorting helper
interface TimelineItem {
  type: 'flight' | 'activity' | 'job'
  title: string
  meta: string
  costText: string
  costClass: string
}

const chronologicalTimeline = computed((): TimelineItem[] => {
  if (!reportData.value) return []
  const list: TimelineItem[] = []

  // Add flights
  for (const s of reportData.value.segments) {
    list.push({
      type: 'flight',
      title: `Vuelo: ${s.origin} ✈ ${s.dest}`,
      meta: `Aeronave: ${s.aircraft_type} • Distancia: ${s.distance_km} km`,
      costText: `-$${s.cost_usd.toFixed(2)}`,
      costClass: 'text-red'
    })
  }

  // Add activities
  for (const a of reportData.value.activities) {
    list.push({
      type: 'activity',
      title: `Actividad: ${a.name}`,
      meta: `Aeropuerto: ${a.airport_iata} • Tipo: ${a.activity_type}`,
      costText: `-$${a.cost_usd.toFixed(2)}`,
      costClass: 'text-red'
    })
  }

  // Add jobs
  for (const j of reportData.value.jobs) {
    list.push({
      type: 'job',
      title: `Trabajo: ${j.name}`,
      meta: `Aeropuerto: ${j.airport_iata} • Duración: ${j.hours_worked}h`,
      costText: `+$${j.income_usd.toFixed(2)}`,
      costClass: 'text-green'
    })
  }

  return list
})

function getTimelineIcon(type: 'flight' | 'activity' | 'job'): string {
  switch (type) {
    case 'flight': return '✈️'
    case 'activity': return '🎯'
    case 'job': return '💼'
    default: return '•'
  }
}

function getScoreTier(score: number): string {
  if (score >= 85) return '🥇 Planificación Excelente'
  if (score >= 60) return '🥈 Planificación Eficiente'
  if (score >= 35) return '🥉 Planificación Promedio'
  return '⚠️ Planificación Ineficiente'
}

function getScoreText(score: number): string {
  if (score >= 85) return 'Has maximizado tus destinos manteniendo un uso muy eficiente de recursos y tiempos.'
  if (score >= 60) return 'Buen balance entre ciudades recorridas y gastos de simulación.'
  if (score >= 35) return 'Tu itinerario tiene márgenes de optimización. Intenta reducir costes de escalas.'
  return 'Consumo acelerado de presupuesto con pocas escalas. Utiliza el optimizador en la pestaña Planner.'
}
</script>

<style scoped>
.r5-report {
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

.load-report-card h3, .score-card h3, .destinations-card h3, .history-card h3 {
  font-size: 14px;
  font-weight: 600;
}

.load-report-card p.desc {
  font-size: 11px;
  margin-top: -6px;
}

.row {
  display: flex;
  gap: 8px;
}

.btn-block {
  width: 100%;
  justify-content: center;
}

.font-mono {
  font-family: var(--font-mono);
}

.error-box {
  background: #3b1414;
  border: 1px solid var(--sky-red);
  color: var(--sky-red);
  padding: 10px;
  border-radius: var(--radius-md);
  font-size: 12px;
}

.empty-card {
  padding: 32px;
}

.empty-icon {
  font-size: 40px;
  margin-bottom: 8px;
}

.loading-card {
  padding: 32px;
}

.spinner {
  width: 24px;
  height: 24px;
  border: 3px solid var(--sky-border);
  border-top-color: var(--sky-accent);
  border-radius: 50%;
  margin: 0 auto;
  animation: spin 1s infinite linear;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.summary-card {
  border-top: 4px solid var(--sky-green);
}

.session-label {
  font-size: 10px;
  font-family: var(--font-mono);
}

.main-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  text-align: center;
}

.stat-box {
  background: var(--sky-surface);
  border: 1px solid var(--sky-border);
  border-radius: var(--radius-md);
  padding: 8px 4px;
}

.stat-box .val {
  font-size: 18px;
  font-weight: 700;
}

.stat-box .lbl {
  font-size: 9px;
  color: var(--sky-text2);
  text-transform: uppercase;
}

.stats-table {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 12px;
}

.row-stat {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
}

.row-stat .bold {
  font-weight: 700;
}

.score-body {
  display: flex;
  align-items: center;
  gap: 16px;
}

.dial-container {
  flex-shrink: 0;
}

.dial-circle {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: var(--sky-surface);
  border: 4px solid var(--sky-accent2);
  display: flex;
  align-items: center;
  justify-content: center;
}

.score-num {
  font-size: 16px;
  font-weight: 700;
  color: var(--sky-text);
}

.score-details {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.bold {
  font-weight: 600;
}

.text-sm {
  font-size: 11px;
}

.destinations-timeline {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.dest-timeline-item {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--sky-surface);
  border: 1px solid var(--sky-border);
  padding: 8px;
  border-radius: var(--radius-md);
}

.dest-badge {
  background: var(--sky-accent);
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.dest-info {
  flex-grow: 1;
}

.dest-header {
  display: flex;
  justify-content: space-between;
}

.dest-city {
  font-weight: 600;
  font-size: 13px;
}

.dest-cost {
  font-weight: 700;
  font-size: 13px;
}

.text-xs {
  font-size: 10px;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 250px;
  overflow-y: auto;
}

.history-item {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--sky-surface);
  border-radius: var(--radius-md);
  padding: 8px;
  border-left: 3px solid var(--sky-border);
}

.history-item.flight {
  border-left-color: var(--sky-accent);
}

.history-item.activity {
  border-left-color: var(--sky-red);
}

.history-item.job {
  border-left-color: var(--sky-green);
}

.item-icon {
  font-size: 16px;
}

.item-body {
  flex-grow: 1;
}

.item-title {
  font-weight: 600;
  font-size: 12px;
}

.item-meta {
  display: flex;
  justify-content: space-between;
}

.mt-2 { margin-top: 8px; }
.mt-3 { margin-top: 12px; }
</style>
