<template>
  <div class="r1">
    <div class="section-header">
      <h2>Network</h2>
      <span class="text-muted">R1 — Load &amp; visualize</span>
    </div>

    <!-- Load button -->
    <div class="load-row">
      <button class="btn btn-primary" :disabled="graphStore.loading" @click="load">
        <span v-if="graphStore.loading">Loading…</span>
        <span v-else>{{ graphStore.isLoaded ? '↺ Reload network' : '⬆ Load network' }}</span>
      </button>
      <div v-if="graphStore.summary" class="status-chips">
        <span class="chip">{{ graphStore.summary.node_count }} nodes</span>
        <span class="chip">{{ graphStore.summary.edge_count }} edges</span>
        <span class="chip chip-blue">{{ graphStore.summary.hub_count }} hubs</span>
        <span v-if="graphStore.summary.blocked_edge_count" class="chip chip-red">
          {{ graphStore.summary.blocked_edge_count }} blocked
        </span>
      </div>
    </div>

    <div v-if="graphStore.error" class="error-box">{{ graphStore.error }}</div>

    <!-- Airport list -->
    <div v-if="graphStore.airports.length" class="airport-section">
      <div class="filter-row">
        <input v-model="search" class="input" placeholder="Search airport…" />
        <label class="checkbox-label">
          <input v-model="hubOnly" type="checkbox" />
          Hubs only
        </label>
      </div>

      <div class="airport-list">
        <div
          v-for="a in filtered" :key="a.id"
          class="airport-item"
          :class="{ selected: uiStore.selectedAirport === a.id }"
          @click="uiStore.selectAirport(a.id)"
        >
          <div class="airport-iata">{{ a.id }}</div>
          <div class="airport-info">
            <div class="airport-city">{{ a.city }}, {{ a.country }}</div>
            <div class="airport-name text-muted">{{ a.name }}</div>
          </div>
          <span :class="a.is_hub ? 'badge badge-hub' : 'badge badge-sec'">
            {{ a.is_hub ? 'HUB' : 'REG' }}
          </span>
        </div>
      </div>
    </div>

    <div v-else-if="!graphStore.loading" class="empty">
      <div class="empty-icon">🗺</div>
      <div>Load the network to see airports and routes on the map.</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useGraphStore } from '@/stores/graph.store'
import { useUiStore } from '@/stores/ui.store'

const graphStore = useGraphStore()
const uiStore    = useUiStore()

const search  = ref('')
const hubOnly = ref(false)

async function load() { await graphStore.load() }

const filtered = computed(() =>
  graphStore.airports.filter(a => {
    if (hubOnly.value && !a.is_hub) return false
    const q = search.value.toLowerCase()
    return !q || a.id.toLowerCase().includes(q) || a.city.toLowerCase().includes(q) || a.country.toLowerCase().includes(q)
  })
)
</script>

<style scoped>
.r1 { display: flex; flex-direction: column; gap: 14px }
.section-header { display: flex; flex-direction: column; gap: 2px }
.section-header h2 { font-size: 16px; font-weight: 600 }
.load-row { display: flex; flex-direction: column; gap: 8px }
.status-chips { display: flex; flex-wrap: wrap; gap: 6px }
.chip {
  background: var(--sky-surface); border: 1px solid var(--sky-border);
  border-radius: 20px; padding: 2px 10px; font-size: 11px; font-weight: 500;
}
.chip-blue { border-color: var(--sky-accent); color: var(--sky-accent) }
.chip-red  { border-color: var(--sky-red);    color: var(--sky-red) }
.error-box { background: #3b1414; border: 1px solid var(--sky-red); border-radius: var(--radius-md); padding: 10px; font-size: 12px; color: var(--sky-red) }
.filter-row { display: flex; align-items: center; gap: 10px }
.checkbox-label { display: flex; align-items: center; gap: 5px; font-size: 12px; color: var(--sky-text2); white-space: nowrap; cursor: pointer }
.airport-list { display: flex; flex-direction: column; gap: 4px; max-height: 400px; overflow-y: auto }
.airport-item {
  display: flex; align-items: center; gap: 10px; padding: 8px 10px;
  border-radius: var(--radius-md); cursor: pointer; border: 1px solid transparent;
  transition: var(--transition);
}
.airport-item:hover { background: var(--sky-surface); border-color: var(--sky-border) }
.airport-item.selected { background: #0d1e3d; border-color: var(--sky-accent) }
.airport-iata { font-size: 15px; font-weight: 700; color: var(--sky-accent); min-width: 36px }
.airport-info { flex: 1 }
.airport-city { font-size: 12px; font-weight: 500 }
.airport-name { font-size: 11px }
.empty { text-align: center; color: var(--sky-text2); padding: 40px 0; font-size: 13px }
.empty-icon { font-size: 40px; margin-bottom: 10px }
</style>
