import { createRouter, createWebHistory } from 'vue-router'
import RealtimeDashboard from '@/components/RealtimeDashboard.vue'

const routes = [ { path: '/', component: RealtimeDashboard } ]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router

