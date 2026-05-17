import { createRouter, createWebHistory } from 'vue-router'
import R1NetworkPanel from '@/components/panel/R1NetworkPanel.vue'
import MapCanvas from '@/components/map/MapCanvas.vue'

const routes = [
  { path: '/', component: R1NetworkPanel },
  { path: '/map', component: MapCanvas }
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router

