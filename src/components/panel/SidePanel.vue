<template>
  <aside class="panel">
    <!-- Header -->
    <div class="panel-header">
      <div class="logo">
        <span class="logo-icon">✈</span>
        <span class="logo-text">SkyRoute</span>
        <span class="logo-sub">Planner</span>
      </div>
      <div v-if="graphStore.summary" class="graph-badge">
        <span>{{ graphStore.summary.node_count }} airports</span>
        <span class="divider-v">·</span>
        <span>{{ graphStore.summary.edge_count }} routes</span>
        <span v-if="graphStore.summary.blocked_edge_count > 0" class="text-red">
          · {{ graphStore.summary.blocked_edge_count }} blocked
        </span>
      </div>
    </div>

    <!-- Tab bar -->
    <nav class="tab-bar">
      <button
        v-for="tab in tabs" :key="tab.id"
        :class="['tab', { active: uiStore.activePanel === tab.id }]"
        @click="uiStore.setPanel(tab.id)"
      >
        <span class="tab-icon">{{ tab.icon }}</span>
        <span class="tab-label">{{ tab.label }}</span>
        <span v-if="tab.id === 'r4' && graphStore.blocked.length" class="tab-badge">
          {{ graphStore.blocked.length }}
        </span>
      </button>
    </nav>

    <!-- Panel content -->
    <div class="panel-body">
      <Transition name="slide" mode="out-in">
        <R1NetworkPanel  v-if="uiStore.activePanel === 'r1'" key="r1" />
        <R2PlannerPanel  v-else-if="uiStore.activePanel === 'r2'" key="r2" />
        <R3DynamicPanel  v-else-if="uiStore.activePanel === 'r3'" key="r3" />
        <R4EventsPanel   v-else-if="uiStore.activePanel === 'r4'" key="r4" />
        <R5ReportPanel   v-else-if="uiStore.activePanel === 'r5'" key="r5" />
      </Transition>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { useUiStore } from '@/stores/ui.store'
import { useGraphStore } from '@/stores/graph.store'
import R1NetworkPanel from './R1NetworkPanel.vue'
import R2PlannerPanel from './R2PlannerPanel.vue'
import R3DynamicPanel from './R3DynamicPanel.vue'
import R4EventsPanel  from './R4EventsPanel.vue'
import R5ReportPanel  from './R5ReportPanel.vue'

const uiStore    = useUiStore()
const graphStore = useGraphStore()

const tabs = [
  { id: 'r1', icon: '🗺', label: 'Network' },
  { id: 'r2', icon: '🧭', label: 'Planner' },
  { id: 'r3', icon: '🎮', label: 'Dynamic' },
  { id: 'r4', icon: '⚡', label: 'Events' },
  { id: 'r5', icon: '📋', label: 'Report' },
] as const
</script>

<style scoped>
.panel {
  width: var(--panel-w); height: 100%; display: flex; flex-direction: column;
  background: var(--sky-dark); border-left: 1px solid var(--sky-border);
  flex-shrink: 0;
}
.panel-header {
  padding: 16px 20px 12px; border-bottom: 1px solid var(--sky-border);
  display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 6px;
}
.logo { display: flex; align-items: center; gap: 6px }
.logo-icon { font-size: 20px }
.logo-text { font-size: 18px; font-weight: 700; color: var(--sky-accent); letter-spacing: 0.5px }
.logo-sub  { font-size: 12px; color: var(--sky-text2); font-weight: 300 }
.graph-badge { font-size: 11px; color: var(--sky-text2) }
.divider-v { margin: 0 4px }

.tab-bar {
  display: flex; padding: 8px 12px; gap: 4px;
  border-bottom: 1px solid var(--sky-border); background: var(--sky-surface);
}
.tab {
  flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px;
  padding: 6px 4px; border-radius: var(--radius-md); background: none;
  border: none; cursor: pointer; color: var(--sky-text3); transition: var(--transition);
  position: relative; font-family: var(--font-ui);
}
.tab:hover { color: var(--sky-text); background: var(--sky-card) }
.tab.active { color: var(--sky-accent); background: #0d1e3d }
.tab-icon  { font-size: 16px }
.tab-label { font-size: 10px; font-weight: 500 }
.tab-badge {
  position: absolute; top: 2px; right: 4px;
  background: var(--sky-red); color: #fff;
  font-size: 9px; font-weight: 700; border-radius: 10px; padding: 1px 4px;
}
.panel-body { flex: 1; overflow-y: auto; padding: 16px }
</style>
