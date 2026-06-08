<template>
  <div class="app-container">
    <header class="app-header">
      <div class="header-left">
        <span class="logo-icon">✈</span>
        <div class="header-title">SkyRoute <span class="badge badge-accent">Centro de Operaciones</span></div>
      </div>
      <div class="header-right">
        <div class="header-status">
          <span class="pulse-dot"></span>
          <span class="status-indicator">Sistema de Simulación Activo</span>
        </div>
      </div>
    </header>

    <div class="dashboard-root">
      <!-- Unified navigation control sidebar (R1-R5) -->
      <aside class="left-sidebar">
        <SidePanel />
      </aside>

      <!-- Center Interactive Route Map -->
      <main class="center-map">
        <MapCanvas />
      </main>

      <!-- Executive Operations Console (Right panel) -->
      <aside class="right-sidebar">
        <div class="ops-console">
          <div class="console-header">
            <h3>Telemetría y Estado de Vuelo</h3>
            <span class="status-badge" :class="{ active: sessionStore.isActive }">
              {{ sessionStore.isActive ? 'EN RUTA' : 'STANDBY' }}
            </span>
          </div>

          <!-- Active flight details -->
          <div v-if="sessionStore.isInTransit && sessionStore.inTransit" class="card telemetry-card inflight-telemetry">
            <div class="telemetry-grid">
              <div class="t-item">
                <span class="t-lbl">VUELO EN CURSO</span>
                <span class="t-val highlight">{{ sessionStore.inTransit.origin }} → {{ sessionStore.inTransit.dest }}</span>
              </div>
              <div class="t-item">
                <span class="t-lbl">PROGRESO</span>
                <span class="t-val text-gold">{{ (sessionStore.inTransit.progress * 100).toFixed(0) }}%</span>
              </div>
            </div>
            <div class="progress-track mt-2">
              <div class="progress-bar" :style="{ width: (sessionStore.inTransit.progress * 100) + '%', background: 'var(--sky-gold)' }"></div>
            </div>
          </div>

          <div v-else-if="sessionStore.isActive && sessionStore.session" class="card telemetry-card">
            <div class="telemetry-grid">
              <div class="t-item">
                <span class="t-lbl">AEROPUERTO ACTUAL</span>
                <span class="t-val highlight">{{ sessionStore.session.current_airport }}</span>
              </div>
              <div class="t-item">
                <span class="t-lbl">PRES. RESTANTE</span>
                <span class="t-val text-green">${{ sessionStore.session.budget_remaining.toFixed(2) }}</span>
              </div>
              <div class="t-item">
                <span class="t-lbl">TIEMPO LÍMITE</span>
                <span class="t-val text-gold">{{ sessionStore.session.time_remaining_hours }}h</span>
              </div>
              <div class="t-item">
                <span class="t-lbl">CUIDADES VISITADAS</span>
                <span class="t-val">{{ sessionStore.session.visited.length }}</span>
              </div>
            </div>

            <div class="visited-chips mt-3">
              <div class="t-lbl mb-1">CUIDADES EN EL ITINERARIO</div>
              <div class="chips-container">
                <span 
                  v-for="city in sessionStore.session.visited" 
                  :key="city" 
                  class="visited-chip"
                >
                  📍 {{ city }}
                </span>
              </div>
            </div>
          </div>

          <div v-else class="card info-card text-center">
            <span class="icon">✈️</span>
            <h4>Consola de Telemetría Apagada</h4>
            <p class="text-muted text-xs">Inicia una sesión de simulación en la pestaña "Dynamic" para habilitar el seguimiento del vuelo.</p>
          </div>

          <!-- Alert feed (Active blocked corridors) -->
          <div class="ops-alerts-box mt-3">
            <div class="alerts-header">
              <h4>Corredores Aéreos Bloqueados ({{ graphStore.blocked.length }})</h4>
              <span class="alert-icon">⚠️</span>
            </div>
            
            <div v-if="!graphStore.blocked.length" class="no-alerts-card card">
              🟢 Sin alertas meteorológicas ni cierres operacionales activos en la red regional.
            </div>
            
            <div v-else class="alerts-list">
              <div 
                v-for="alert in graphStore.blocked" 
                :key="`${alert.origin}-${alert.dest}`" 
                class="alert-card card"
              >
                <div class="alert-body">
                  <div class="alert-title">Suspensión de Conectividad</div>
                  <div class="alert-route">{{ alert.origin }} ➔ {{ alert.dest }}</div>
                  <div class="alert-meta text-muted text-xs">Vuelos directos suspendidos temporalmente. Trazar desvío alternativo.</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Quick access suggestions -->
          <div v-if="sessionStore.isActive && sessionStore.suggestion" class="ops-suggest mt-3 card">
            <h4>Próximo Vuelo Recomendado</h4>
            <div v-if="sessionStore.suggestion.suggested_dest" class="suggest-details">
              <div class="suggest-dest-row">
                <span class="iata">{{ sessionStore.suggestion.suggested_dest }}</span>
                <span class="cost text-green">${{ sessionStore.suggestion.estimated_cost.toFixed(2) }}</span>
              </div>
              <p class="text-muted text-xs mt-1">El algoritmo de la aerolínea recomienda continuar hacia esta ciudad para optimizar el recorrido.</p>
            </div>
            <div v-else class="muted text-xs">
              No hay vuelos viables en este momento. Trabaja para ganar fondos o cambia de ruta.
            </div>
          </div>
        </div>
      </aside>
    </div>

    <ToastStack />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import SidePanel from '@/components/panel/SidePanel.vue'
import MapCanvas from '@/components/map/MapCanvas.vue'
import ToastStack from '@/components/ToastStack.vue'
import { useSessionStore } from '@/stores/session.store'
import { useGraphStore } from '@/stores/graph.store'
import realtime from '@/realtime'

const sessionStore = useSessionStore()
const graphStore = useGraphStore()

onMounted(async () => {
  if (!graphStore.isLoaded) {
    await graphStore.load()
  }
  realtime.connect()
  realtime.on('graph', (p: any) => {
    if (p?.airports) graphStore.airports = p.airports
    if (p?.routes) graphStore.routes = p.routes
    if (p?.blocked) graphStore.blocked = p.blocked
  })
})
</script>

<style scoped>
.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  background: var(--sky-black);
  overflow: hidden;
}

.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 24px;
  height: 60px;
  background: var(--sky-surface);
  border-bottom: 1px solid var(--sky-border);
  flex-shrink: 0;
  z-index: 100;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo-icon {
  font-size: 24px;
  color: var(--sky-accent2);
}

.header-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--sky-text);
  display: flex;
  align-items: center;
  gap: 10px;
}

.badge-accent {
  background: rgba(14, 165, 233, 0.15);
  color: var(--sky-accent2);
  border: 1px solid rgba(14, 165, 233, 0.3);
  font-size: 11px;
}

.header-right {
  display: flex;
  align-items: center;
}

.header-status {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(16, 185, 129, 0.1);
  padding: 6px 12px;
  border-radius: 20px;
  border: 1px solid rgba(16, 185, 129, 0.2);
}

.pulse-dot {
  width: 8px;
  height: 8px;
  background-color: var(--sky-green);
  border-radius: 50%;
  box-shadow: 0 0 8px var(--sky-green);
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0% { transform: scale(0.95); opacity: 0.5; }
  50% { transform: scale(1.2); opacity: 1; }
  100% { transform: scale(0.95); opacity: 0.5; }
}

.status-indicator {
  font-size: 11px;
  color: var(--sky-green);
  font-weight: 600;
}

.dashboard-root {
  display: grid;
  grid-template-columns: 420px 1fr 380px;
  height: calc(100vh - 60px);
  width: 100%;
  flex-grow: 1;
}

.left-sidebar {
  background: var(--sky-dark);
  border-right: 1px solid var(--sky-border);
  height: 100%;
  overflow: hidden;
}

.right-sidebar {
  background: var(--sky-dark);
  border-left: 1px solid var(--sky-border);
  overflow-y: auto;
  padding: 20px;
  height: 100%;
}

.center-map {
  position: relative;
  background: var(--sky-black);
  height: 100%;
  width: 100%;
}

.center-map > * {
  position: absolute;
  inset: 0;
}

.ops-console {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.console-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.console-header h3 {
  font-size: 15px;
  font-weight: 600;
  margin: 0;
}

.status-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 4px;
  background: #334155;
  color: #94a3b8;
}

.status-badge.active {
  background: rgba(30, 107, 255, 0.15);
  color: var(--sky-accent);
  border: 1px solid rgba(30, 107, 255, 0.3);
}

.telemetry-card {
  padding: 14px;
}

.telemetry-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.t-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.t-lbl {
  font-size: 9px;
  color: var(--sky-text3);
  text-transform: uppercase;
  font-weight: 600;
}

.t-val {
  font-size: 15px;
  font-weight: 700;
}

.t-val.highlight {
  color: var(--sky-accent2);
}

.chips-container {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.visited-chip {
  background: var(--sky-surface);
  border: 1px solid var(--sky-border);
  border-radius: 12px;
  padding: 2px 8px;
  font-size: 10px;
  font-weight: 500;
}

.info-card {
  padding: 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.info-card .icon {
  font-size: 32px;
}

.info-card h4 {
  font-size: 13px;
  font-weight: 600;
}

.ops-alerts-box {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.alerts-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.alerts-header h4 {
  font-size: 12px;
  font-weight: 600;
  margin: 0;
}

.no-alerts-card {
  font-size: 11px;
  color: var(--sky-text2);
  padding: 12px;
  border-left: 3px solid var(--sky-green);
}

.alerts-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.alert-card {
  padding: 10px;
  border-left: 3px solid var(--sky-red);
}

.alert-title {
  font-weight: 700;
  font-size: 11px;
  color: var(--sky-red);
}

.alert-route {
  font-family: var(--font-mono);
  font-weight: 700;
  font-size: 13px;
  margin: 2px 0;
}

.ops-suggest h4 {
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 8px;
}

.suggest-dest-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.suggest-dest-row .iata {
  font-size: 18px;
  font-weight: 700;
  color: var(--sky-accent2);
}

.suggest-dest-row .cost {
  font-weight: 700;
  font-size: 15px;
}

.text-center { text-align: center; }
.mt-2 { margin-top: 8px; }
.mt-3 { margin-top: 12px; }
.mb-1 { margin-bottom: 4px; }
.text-xs { font-size: 10px; }

.progress-track {
  height: 6px;
  background: var(--sky-surface);
  border-radius: 3px;
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  background: var(--sky-accent);
  transition: width 0.15s linear;
}

.inflight-telemetry {
  border-left: 4px solid var(--sky-gold);
}
</style>
