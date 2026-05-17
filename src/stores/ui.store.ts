import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { ActivePanel, Toast } from '@/types'

export const useUiStore = defineStore('ui', () => {
  const activePanel     = ref<ActivePanel>('r1')
  const selectedAirport = ref<string | null>(null)
  const highlightedPath = ref<string[]>([])
  const toasts          = ref<Toast[]>([])

  function setPanel(p: ActivePanel) { activePanel.value = p }
  function selectAirport(id: string | null) { selectedAirport.value = id }
  function highlightPath(path: string[]) { highlightedPath.value = path }
  function clearHighlight() { highlightedPath.value = [] }

  function toast(type: Toast['type'], text: string) {
    const id = crypto.randomUUID()
    toasts.value.push({ id, type, text })
    setTimeout(() => { toasts.value = toasts.value.filter(t => t.id !== id) }, 4500)
  }

  return { activePanel, selectedAirport, highlightedPath, toasts, setPanel, selectAirport, highlightPath, clearHighlight, toast }
})
