<template>
  <div class="r3-simulation">
    <div class="section-header">
      <h2>Panel de Simulación</h2>
      <span class="text-muted">R3 — Ecosistema y Operaciones en Vivo</span>
    </div>

    <!-- Active session state selector -->
    <div v-if="!sessionStore.isActive" class="card empty-card text-center">
      <div class="empty-icon">🎮</div>
      <h3>No hay simulación activa</h3>
      <p class="text-muted mb-4">Ingresa un aeropuerto inicial, tu presupuesto y horas disponibles para comenzar el viaje.</p>
      
      <div class="form-group text-left">
        <label>Origen de partida</label>
        <div class="autocomplete">
          <input 
            v-model="startForm.origin" 
            @focus="showStartList = true"
            @input="onStartInput"
            class="input"
            placeholder="Selecciona aeropuerto inicial..."
          />
          <ul v-if="showStartList && filteredStart.length" class="autocomplete-list">
            <li 
              v-for="a in filteredStart" 
              :key="a.id"
              @click="selectStart(a.id)"
            >
              <span class="iata">{{ a.id }}</span>
              <span class="city-name">{{ a.city }}</span>
            </li>
          </ul>
        </div>
      </div>

      <div class="row text-left mt-2">
        <div class="form-group flex-1">
          <label>Presupuesto Inicial ($)</label>
          <input v-model.number="startForm.budget" type="number" min="500" class="input" />
        </div>
        <div class="form-group flex-1">
          <label>Tiempo Inicial (Horas)</label>
          <input v-model.number="startForm.hours" type="number" min="1" class="input" />
        </div>
      </div>

      <button 
        class="btn btn-primary btn-block mt-4" 
        :disabled="sessionStore.loading || !startForm.origin"
        @click="initSession"
      >
        🚀 Iniciar Simulación
      </button>
    </div>

    <!-- SIMULATION IS ACTIVE -->
    <div v-else class="simulation-dashboard">
      <!-- Session stats card -->
      <div class="card status-card">
        <div class="status-header">
          <div class="session-id text-muted">Sesión: {{ sessionStore.sessionId?.substring(0, 8) }}...</div>
          <button class="btn btn-danger btn-sm" @click="endSession">Finalizar Viaje</button>
        </div>

        <div class="stats-row">
          <div class="stat-item">
            <span class="val">{{ sessionStore.session?.current_airport }}</span>
            <span class="lbl">Aeropuerto Actual</span>
          </div>
          <div class="stat-item">
            <span class="val text-green">${{ sessionStore.session?.budget_remaining.toFixed(2) }}</span>
            <span class="lbl">Presupuesto</span>
          </div>
          <div class="stat-item">
            <span class="val text-gold">{{ sessionStore.session?.time_remaining_hours }}h</span>
            <span class="lbl">Tiempo Disponible</span>
          </div>
        </div>

        <div class="progress-container mt-3">
          <div class="progress-info">
            <span>Presupuesto Consumido</span>
            <span>{{ sessionStore.budgetPct.toFixed(0) }}%</span>
          </div>
          <div class="progress-track">
            <div class="progress-bar" :style="{ width: sessionStore.budgetPct + '%' }"></div>
          </div>
        </div>
      </div>

      <!-- Current City details (Lodging, Food) -->
      <div class="card city-details-card mt-3" v-if="currentAirportData">
        <h3>Información de {{ currentAirportData.city }} ({{ currentAirportData.id }})</h3>
        <div class="city-info-grid">
          <div class="info-item">
            <span class="icon">🏨</span>
            <div class="info-body">
              <span class="val">${{ currentAirportData.lodging_cost }}/noche</span>
              <span class="lbl">Costo Hospedaje</span>
            </div>
          </div>
          <div class="info-item">
            <span class="icon">🍽</span>
            <div class="info-body">
              <span class="val">${{ currentAirportData.food_cost }}/comida</span>
              <span class="lbl">Costo Alimentación</span>
            </div>
          </div>
        </div>
      </div>

      <!-- IN-FLIGHT BANNER -->
      <div v-if="sessionStore.isInTransit && sessionStore.inTransit" class="card inflight-card mt-3">
        <div class="inflight-header">
          <span class="inflight-tag">✈ EN VUELO</span>
          <span class="text-muted">{{ sessionStore.inTransit.origin }} → {{ sessionStore.inTransit.dest }}</span>
        </div>
        <p class="text-xs text-muted mt-1">
          Duración simulada: {{ (sessionStore.inTransit.flight_time_min / 60).toFixed(1) }}h
          ({{ (sessionStore.inTransit.flight_time_min / 60).toFixed(1) }}s en pantalla)
        </p>
        <div class="progress-track mt-2">
          <div class="progress-bar inflight-bar" :style="{ width: (sessionStore.inTransit.progress * 100) + '%' }"></div>
        </div>
        <p class="text-xs text-gold mt-2">
          Durante el vuelo puedes bloquear esta ruta en la pestaña Events — el avión regresará al origen.
        </p>
      </div>

      <!-- JOB RECOMMENDATIONS WHEN BUDGET LOW -->
      <div
        v-if="sessionStore.suggestion?.needs_jobs && sessionStore.suggestion.job_recommendations?.length"
        class="card job-alert-card mt-3"
      >
        <div class="suggest-header">
          <span class="suggest-tag warn">⚠ FONDOS INSUFICIENTES</span>
        </div>
        <p class="text-xs mt-1">
          Déficit estimado: <strong class="text-red">${{ sessionStore.suggestion.budget_deficit.toFixed(2) }}</strong>
          · Vuelo más barato: <strong>${{ sessionStore.suggestion.cheapest_flight_cost.toFixed(2) }}</strong>
        </p>
        <p class="text-xs text-muted mt-1">Trabajos recomendados (incluye hospedaje y comida mientras trabajas):</p>
        <div
          v-for="jr in sessionStore.suggestion.job_recommendations"
          :key="jr.name"
          class="job-rec-item mt-2"
        >
          <div class="job-rec-title">{{ jr.name }}</div>
          <div class="text-xs text-muted">{{ jr.reason }}</div>
          <button
            class="btn btn-secondary btn-sm mt-1"
            :disabled="sessionStore.isInTransit"
            @click="applyJobRecommendation(jr.name, jr.recommended_hours)"
          >
            Trabajar {{ jr.recommended_hours }}h (+${{ jr.net_gain.toFixed(0) }} neto)
          </button>
        </div>
      </div>

      <!-- SUGGESTIONS CARD -->
      <div class="card suggest-card mt-3" v-if="sessionStore.suggestion">
        <div class="suggest-header">
          <span class="suggest-tag">💡 RECOMENDACIÓN DE LA RED</span>
        </div>
        <div v-if="sessionStore.suggestion.suggested_dest" class="suggest-body">
          <p>La aerolínea sugiere volar a <span class="highlight">{{ sessionStore.suggestion.suggested_dest }}</span>.</p>
          <div class="suggest-details text-muted">
            <span>Costo estimado: ${{ sessionStore.suggestion.estimated_cost.toFixed(2) }}</span> •
            <span>Duración: {{ (sessionStore.suggestion.estimated_time_min / 60).toFixed(1) }}h</span>
          </div>
          <button 
            class="btn btn-secondary btn-sm mt-2" 
            @click="useSuggestion(sessionStore.suggestion.suggested_dest)"
          >
            ✈ Trazar camino sugerido
          </button>
        </div>
        <div v-else class="suggest-body muted">
          No hay vuelos viables con el presupuesto actual. Revisa las recomendaciones de trabajo arriba.
        </div>
      </div>

      <!-- WORK AND ACTIVITIES TAB SECTION -->
      <div class="card actions-tabs-card mt-3">
        <div class="subtabs">
          <button 
            class="subtab-btn" 
            :class="{ active: activeActionTab === 'fly' }"
            @click="activeActionTab = 'fly'"
          >
            ✈ Salidas ({{ sessionStore.flights.length }})
          </button>
          <button 
            class="subtab-btn" 
            :class="{ active: activeActionTab === 'activities' }"
            @click="activeActionTab = 'activities'"
          >
            🎯 Actividades ({{ sessionStore.activities.length }})
          </button>
          <button 
            class="subtab-btn" 
            :class="{ active: activeActionTab === 'jobs' }"
            @click="activeActionTab = 'jobs'"
          >
            💼 Trabajos ({{ sessionStore.jobs.length }})
          </button>
        </div>

        <div class="action-tab-content">
          <!-- FLY TAB -->
          <div v-if="activeActionTab === 'fly'" class="fly-tab">
            <div class="empty-msg" v-if="!sessionStore.flights.length">
              No hay vuelos disponibles de salida. ¿Rutas bloqueadas o falta de presupuesto?
            </div>
            <div v-else class="flight-list">
              <div 
                v-for="f in sessionStore.flights" 
                :key="f.dest" 
                class="flight-card"
                :class="{ selected: uiStore.selectedAirport === f.dest }"
                @click="uiStore.selectAirport(f.dest)"
              >
                <div class="flight-main">
                  <div class="flight-dest">
                    <span class="iata">{{ f.dest }}</span>
                    <span class="details text-muted">{{ f.distance_km }} km • stay {{ f.min_stay_min }}m</span>
                  </div>
                  <div class="flight-price text-green">
                    ${{ f.recommended_aircraft.cost_usd.toFixed(2) }}
                  </div>
                </div>
                
                <div class="aircraft-selection-row mt-2" v-if="uiStore.selectedAirport === f.dest">
                  <div class="form-group flex-1">
                    <label>Aeronave</label>
                    <select v-model="selectedAircraftType" class="select" @click.stop>
                      <option v-for="opt in f.aircraft_options" :key="opt.aircraft_type" :value="opt.aircraft_type">
                        {{ opt.aircraft_type }} (${{ opt.cost_usd }} • {{ (opt.time_min/60).toFixed(1) }}h)
                      </option>
                    </select>
                  </div>
                  <button 
                    class="btn btn-primary btn-sm align-end" 
                    :disabled="sessionStore.isInTransit || sessionStore.loading"
                    @click.stop="executeFlight(f.dest)"
                  >
                    <span v-if="sessionStore.isInTransit">En vuelo…</span>
                    <span v-else>Volar ✈</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- ACTIVITIES TAB -->
          <div v-if="activeActionTab === 'activities'" class="activities-tab">
            <div class="empty-msg" v-if="!sessionStore.activities.length">
              No hay actividades recreativas registradas en este aeropuerto.
            </div>
            <div v-else class="activities-list">
              <div 
                v-for="act in sessionStore.activities" 
                :key="act.name" 
                class="activity-card"
              >
                <div class="activity-info">
                  <span class="act-name">{{ act.name }}</span>
                  <span class="act-details text-muted">Duración: {{ act.duration_min }}m • Tipo: {{ act.type }}</span>
                </div>
                <div class="activity-action">
                  <span class="act-cost text-red">-${{ act.cost_usd }}</span>
                  <button 
                    class="btn btn-secondary btn-sm" 
                    :disabled="!act.can_afford"
                    @click="performActivity(act.name)"
                  >
                    Hacer
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- JOBS TAB -->
          <div v-if="activeActionTab === 'jobs'" class="jobs-tab">
            <p class="text-xs text-muted mb-2">
              Trabaja en cualquier aeropuerto para ganar dinero. Mientras trabajas debes pagar hospedaje y comida local.
            </p>
            <div class="empty-msg" v-if="!sessionStore.jobs.length">
              No hay ofertas de empleo en este aeropuerto.
            </div>
            <div v-else class="jobs-list">
              <div 
                v-for="job in sessionStore.jobs" 
                :key="job.name" 
                class="job-card"
                :class="{ recommended: job.is_recommended }"
              >
                <div class="job-info">
                  <span class="job-name">
                    {{ job.name }}
                    <span v-if="job.is_recommended" class="rec-badge">RECOMENDADO</span>
                  </span>
                  <span class="job-rate text-green">+${{ job.hourly_rate }}/hora</span>
                  <span class="job-limit text-muted">Límite: {{ job.max_hours }} horas</span>
                </div>
                <p v-if="job.recommendation_reason" class="text-xs text-muted mt-1">{{ job.recommendation_reason }}</p>
                <p v-if="job.recommended_hours" class="text-xs text-gold mt-1">
                  Sugerido: {{ job.recommended_hours }}h → neto ~${{ job.estimated_net_income?.toFixed(0) }}
                  (estadía ~${{ job.estimated_living_cost?.toFixed(0) }})
                </p>
                
                <div class="job-action-box mt-2">
                  <input 
                    type="number" 
                    v-model.number="jobWorkHours[job.name]" 
                    min="1" 
                    :max="job.max_hours" 
                    class="input hours-input"
                    placeholder="Hrs"
                    :disabled="sessionStore.isInTransit"
                  />
                  <button 
                    class="btn btn-secondary btn-sm"
                    :disabled="sessionStore.isInTransit"
                    @click="performJob(job.name, jobWorkHours[job.name] || job.recommended_hours || 1)"
                  >
                    Trabajar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Logs segment -->
      <div class="card logs-card mt-3">
        <h3>Historial de Bitácora</h3>
        <div class="log-flow">
          <div v-for="(log, idx) in sessionStore.eventLog.slice().reverse()" :key="idx" class="log-item">
            <span class="bullet">•</span>
            <span class="text">{{ log }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useSessionStore } from '@/stores/session.store'
import { useGraphStore } from '@/stores/graph.store'
import { useUiStore } from '@/stores/ui.store'

const sessionStore = useSessionStore()
const graphStore = useGraphStore()
const uiStore = useUiStore()

const startForm = ref({
  origin: '',
  budget: 5000,
  hours: 36
})

const showStartList = ref(false)
const filteredStart = ref<any[]>([])

const activeActionTab = ref<'fly' | 'activities' | 'jobs'>('fly')
const selectedAircraftType = ref<string>('default')
const jobWorkHours = ref<Record<string, number>>({})

// Compute current airport details from graph store
const currentAirportData = computed(() => {
  if (!sessionStore.session?.current_airport) return null
  return graphStore.airportMap[sessionStore.session.current_airport] || null
})

onMounted(async () => {
  if (!graphStore.isLoaded) {
    await graphStore.load()
  }
  onStartInput()
})

function onStartInput() {
  const q = startForm.value.origin.trim().toLowerCase()
  filteredStart.value = graphStore.airports.filter(
    a => a.id.toLowerCase().includes(q) || a.city.toLowerCase().includes(q)
  ).slice(0, 10)
}

function selectStart(id: string) {
  startForm.value.origin = id
  showStartList.value = false
}

async function initSession() {
  if (!startForm.value.origin) return
  try {
    await sessionStore.startTrip(startForm.value.origin, startForm.value.budget, startForm.value.hours)
    uiStore.toast('success', `Simulación iniciada en ${startForm.value.origin}`)
  } catch (e: any) {
    uiStore.toast('error', `Error iniciando viaje: ${e.message}`)
  }
}

async function endSession() {
  try {
    await sessionStore.endTrip()
    sessionStore.reset()
    uiStore.toast('info', 'Simulación finalizada exitosamente')
  } catch (e: any) {
    uiStore.toast('error', `Error: ${e.message}`)
  }
}

function useSuggestion(dest: string) {
  uiStore.selectAirport(dest)
  if (sessionStore.suggestion?.path) {
    uiStore.highlightPath(sessionStore.suggestion.path)
  }
}

// Watch selected destination to set recommended aircraft type
watch(() => uiStore.selectedAirport, (newDest) => {
  if (!newDest) return
  const fOption = sessionStore.flights.find(f => f.dest === newDest)
  if (fOption) {
    selectedAircraftType.value = fOption.recommended_aircraft?.aircraft_type ?? fOption.aircraft_options[0]?.aircraft_type ?? 'default'
  }
})

async function executeFlight(dest: string) {
  const aircraft = selectedAircraftType.value
  try {
    const res = await sessionStore.fly(dest, aircraft)
    if (res) {
      uiStore.toast('success', `Vuelo completado con éxito a ${dest}`)
      uiStore.selectAirport(null)
    }
  } catch (e: any) {
    uiStore.toast('error', `Error de vuelo: ${e.message}`)
  }
}

async function performActivity(name: string) {
  try {
    await sessionStore.doActivity(name)
    uiStore.toast('success', `Actividad recreativa realizada: ${name}`)
  } catch (e: any) {
    uiStore.toast('error', `Error de actividad: ${e.message}`)
  }
}

watch(() => sessionStore.jobs, (list) => {
  for (const j of list) {
    if (j.recommended_hours && !jobWorkHours.value[j.name]) {
      jobWorkHours.value[j.name] = j.recommended_hours
    }
  }
}, { immediate: true, deep: true })

async function applyJobRecommendation(name: string, hours: number) {
  jobWorkHours.value[name] = hours
  activeActionTab.value = 'jobs'
  await performJob(name, hours)
}

async function performJob(name: string, hours: number) {
  try {
    await sessionStore.doJob(name, hours)
    uiStore.toast('success', `Trabajo realizado con éxito (+${hours} horas)`)
    jobWorkHours.value[name] = 1 // reset
  } catch (e: any) {
    uiStore.toast('error', `Error de trabajo: ${e.message}`)
  }
}
</script>

<style scoped>
.r3-simulation {
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

.empty-card {
  padding: 40px 24px;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 12px;
}

.text-left {
  text-align: left;
}

.mb-4 { margin-bottom: 16px; }

.status-card {
  border-left: 4px solid var(--sky-accent);
}

.status-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--sky-border);
  padding-bottom: 10px;
  margin-bottom: 12px;
}

.session-id {
  font-size: 11px;
  font-family: var(--font-mono);
}

.stats-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.stat-item .val {
  font-size: 18px;
  font-weight: 700;
}

.stat-item .lbl {
  font-size: 9px;
  color: var(--sky-text2);
  text-transform: uppercase;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  margin-bottom: 4px;
}

.progress-track {
  height: 6px;
  background: var(--sky-surface);
  border-radius: 3px;
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  background: var(--sky-accent);
  transition: width 0.3s ease;
}

.city-info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.info-item {
  display: flex;
  align-items: center;
  gap: 10px;
}

.info-item .icon {
  font-size: 24px;
}

.info-body {
  display: flex;
  flex-direction: column;
}

.info-body .val {
  font-size: 14px;
  font-weight: 600;
}

.info-body .lbl {
  font-size: 10px;
  color: var(--sky-text3);
}

.inflight-card {
  border: 1px solid var(--sky-gold);
  background: rgba(245, 158, 11, 0.08);
}

.inflight-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.inflight-tag {
  font-size: 11px;
  font-weight: 700;
  color: var(--sky-gold);
}

.inflight-bar {
  background: var(--sky-gold);
}

.job-alert-card {
  border: 1px solid var(--sky-red);
  background: rgba(239, 68, 68, 0.06);
}

.suggest-tag.warn {
  color: var(--sky-red);
}

.job-rec-item {
  background: var(--sky-surface);
  border-radius: var(--radius-md);
  padding: 8px;
  border-left: 3px solid var(--sky-green);
}

.job-rec-title {
  font-weight: 600;
  font-size: 12px;
}

.job-card.recommended {
  border-color: var(--sky-green);
  border-left: 3px solid var(--sky-green);
}

.rec-badge {
  font-size: 8px;
  background: var(--sky-green);
  color: #fff;
  padding: 1px 5px;
  border-radius: 4px;
  margin-left: 6px;
  vertical-align: middle;
}

.suggest-card {
  border: 1px dashed var(--sky-gold);
}

.suggest-tag {
  font-size: 10px;
  font-weight: 700;
  color: var(--sky-gold);
}

.suggest-body p {
  font-size: 12px;
  margin: 6px 0;
}

.suggest-body p .highlight {
  font-weight: 700;
  color: var(--sky-accent2);
}

.suggest-details {
  font-size: 10px;
}

.subtabs {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  border-bottom: 1px solid var(--sky-border);
}

.subtab-btn {
  background: none;
  border: none;
  color: var(--sky-text3);
  padding: 10px 4px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
}

.subtab-btn.active {
  color: var(--sky-accent2);
  border-bottom: 2px solid var(--sky-accent2);
}

.action-tab-content {
  padding-top: 12px;
}

.empty-msg {
  font-size: 11px;
  color: var(--sky-text3);
  text-align: center;
  padding: 24px 0;
}

.flight-list, .activities-list, .jobs-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 250px;
  overflow-y: auto;
}

.flight-card, .activity-card, .job-card {
  background: var(--sky-surface);
  border: 1px solid var(--sky-border);
  border-radius: var(--radius-md);
  padding: 10px;
  cursor: pointer;
  transition: var(--transition);
}

.flight-card:hover, .activity-card:hover, .job-card:hover {
  border-color: var(--sky-text3);
}

.flight-card.selected {
  border-color: var(--sky-accent);
}

.flight-main {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.flight-dest {
  display: flex;
  flex-direction: column;
}

.flight-dest .iata {
  font-weight: 700;
  font-size: 15px;
}

.flight-dest .details {
  font-size: 10px;
}

.flight-price {
  font-size: 14px;
  font-weight: 700;
}

.aircraft-selection-row {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  border-top: 1px solid var(--sky-border);
  padding-top: 8px;
}

.align-end {
  height: 34px;
}

.activity-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.activity-info {
  display: flex;
  flex-direction: column;
}

.act-name {
  font-weight: 600;
  font-size: 13px;
}

.act-details {
  font-size: 10px;
}

.activity-action {
  display: flex;
  align-items: center;
  gap: 10px;
}

.act-cost {
  font-weight: 700;
  font-size: 12px;
}

.job-card {
  display: flex;
  flex-direction: column;
}

.job-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.job-name {
  font-weight: 600;
  font-size: 13px;
}

.job-rate {
  font-weight: 700;
  font-size: 12px;
}

.job-limit {
  font-size: 10px;
}

.job-action-box {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.hours-input {
  width: 70px;
}

.log-flow {
  max-height: 180px;
  overflow-y: auto;
  font-family: var(--font-mono);
  font-size: 11px;
}

.log-item {
  display: flex;
  gap: 8px;
  padding: 4px 0;
  border-bottom: 1px dashed rgba(255, 255, 255, 0.03);
}

.log-item .bullet {
  color: var(--sky-accent2);
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

.mt-2 { margin-top: 8px; }
.mt-3 { margin-top: 12px; }
.mt-4 { margin-top: 16px; }
</style>
