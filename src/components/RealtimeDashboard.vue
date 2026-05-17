<template>
  <div class="dashboard-root">
    <header class="app-header">
      <img src="/logo.svg" alt="SkyRoute" class="app-logo" />
      <div class="header-title">SkyRoute — Planificador</div>
    </header>

    <aside class="left-panel">
      <R1NetworkPanel />
    </aside>

    <main class="center-map">
      <MapCanvas />
    </main>

    <aside class="right-panel">
      <RealtimePanel />
    </aside>
  </div>
</template>

<script setup lang="ts">
import R1NetworkPanel from '@/components/panel/R1NetworkPanel.vue'
import MapCanvas from '@/components/map/MapCanvas.vue'
import RealtimePanel from '@/components/panel/RealtimePanel.vue'
</script>

<style scoped>
.dashboard-root { display:grid; grid-template-columns: 320px 1fr 320px; height:100vh }
.left-panel { border-right:1px solid var(--sky-border); overflow:auto; padding:12px }
.center-map { position:relative }
.right-panel { border-left:1px solid var(--sky-border); overflow:auto; padding:12px }

/* ensure leaflet/map canvas fill */
.center-map > * { position:absolute; inset:0 }
.app-header { display:flex; align-items:center; gap:12px; padding:10px 16px; border-bottom:1px solid var(--sky-border); background:var(--sky-surface); grid-column: 1/-1 }
.app-logo { height:36px }
.header-title { font-weight:600; color:var(--sky-text) }
.dashboard-root { display:grid; grid-template-columns: 320px 1fr 320px; height:calc(100vh - 58px) }
.left-panel { border-right:1px solid var(--sky-border); overflow:auto; padding:12px }
.center-map { position:relative }
.right-panel { border-left:1px solid var(--sky-border); overflow:auto; padding:12px }

/* ensure leaflet/map canvas fill */
.center-map > * { position:absolute; inset:0 }
</style>
