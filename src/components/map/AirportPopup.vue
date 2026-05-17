<template>
  <div class="popup">
    <div class="popup-header">
      <div>
        <div class="popup-iata">{{ airport.id }}</div>
        <div class="popup-name">{{ airport.name }}</div>
        <div class="popup-loc">{{ airport.city }}, {{ airport.country }}</div>
      </div>
      <div class="popup-badges">
        <span :class="airport.is_hub ? 'badge badge-hub' : 'badge badge-sec'">
          {{ airport.is_hub ? 'HUB' : 'Regional' }}
        </span>
      </div>
      <button class="close-btn" @click="$emit('close')">✕</button>
    </div>

    <div class="popup-grid">
      <div class="stat">
        <span class="stat-label">Lodging / night</span>
        <span class="stat-val text-gold">${{ airport.lodging_cost }}</span>
      </div>
      <div class="stat">
        <span class="stat-label">Food / meal</span>
        <span class="stat-val text-gold">${{ airport.food_cost }}</span>
      </div>
      <div class="stat">
        <span class="stat-label">Timezone</span>
        <span class="stat-val mono">{{ airport.timezone }}</span>
      </div>
      <div class="stat">
        <span class="stat-label">Airlines</span>
        <span class="stat-val">{{ airport.airlines.length }}</span>
      </div>
    </div>

    <div v-if="airport.airlines.length" class="section">
      <div class="section-title">Airlines</div>
      <div class="airline-list">
        <span v-for="a in airport.airlines" :key="a" class="airline-chip">{{ a }}</span>
      </div>
    </div>

    <div v-if="airport.activities.length" class="section">
      <div class="section-title">Activities ({{ airport.activities.length }})</div>
      <div v-for="act in airport.activities" :key="act.name" class="activity-row">
        <span class="activity-name">{{ act.name }}</span>
        <span :class="act.type === 'opcional' ? 'badge badge-ok' : 'badge badge-warn'">
          {{ act.type }}
        </span>
        <span class="mono text-muted">{{ act.duration_min }}min</span>
        <span class="text-gold">${{ act.cost_usd }}</span>
      </div>
    </div>

    <div v-if="airport.jobs.length" class="section">
      <div class="section-title">Jobs available</div>
      <div v-for="j in airport.jobs" :key="j.name" class="activity-row">
        <span class="activity-name">{{ j.name }}</span>
        <span class="text-green">${{ j.hourly_rate }}/h</span>
        <span class="text-muted">max {{ j.max_hours }}h</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Airport } from '@/types'
defineProps<{ airport: Airport }>()
defineEmits<{ close: [] }>()
</script>

<style scoped>
.popup {
  position: absolute; top: 16px; left: 16px; z-index: 10;
  width: 320px; max-height: calc(100% - 32px); overflow-y: auto;
  background: var(--sky-card); border: 1px solid var(--sky-border);
  border-radius: var(--radius-xl); padding: 16px;
  box-shadow: 0 16px 48px rgba(0,0,0,0.7);
}
.popup-header { display: flex; align-items: flex-start; gap: 8px; margin-bottom: 12px }
.popup-iata { font-size: 22px; font-weight: 700; color: var(--sky-accent); letter-spacing: 1px }
.popup-name { font-size: 12px; font-weight: 500; color: var(--sky-text) }
.popup-loc  { font-size: 11px; color: var(--sky-text2) }
.popup-badges { margin-left: auto; display: flex; flex-direction: column; gap: 4px }
.close-btn {
  background: none; border: none; color: var(--sky-text3);
  cursor: pointer; font-size: 14px; padding: 4px;
  transition: color 0.15s;
}
.close-btn:hover { color: var(--sky-text) }
.popup-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px }
.stat { background: var(--sky-surface); border-radius: var(--radius-md); padding: 8px 10px }
.stat-label { display: block; font-size: 10px; color: var(--sky-text3); margin-bottom: 2px }
.stat-val { font-size: 13px; font-weight: 600 }
.section { margin-top: 10px }
.section-title { font-size: 11px; font-weight: 600; color: var(--sky-text3); text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 6px }
.airline-list { display: flex; flex-wrap: wrap; gap: 4px }
.airline-chip { background: var(--sky-surface); border: 1px solid var(--sky-border); border-radius: 4px; padding: 2px 8px; font-size: 11px }
.activity-row { display: flex; align-items: center; gap: 8px; padding: 4px 0; border-bottom: 1px solid var(--sky-border); font-size: 12px }
.activity-name { flex: 1; font-weight: 500 }
</style>
