<template>
  <div class="toast-stack" aria-live="polite">
    <TransitionGroup name="toast">
      <div
        v-for="t in uiStore.toasts"
        :key="t.id"
        class="toast"
        :class="t.type"
      >
        {{ t.text }}
      </div>
    </TransitionGroup>
  </div>
</template>

<script setup lang="ts">
import { useUiStore } from '@/stores/ui.store'

const uiStore = useUiStore()
</script>

<style scoped>
.toast-stack {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 8px;
  pointer-events: none;
}

.toast {
  min-width: 240px;
  max-width: 360px;
  padding: 10px 14px;
  border-radius: var(--radius-md);
  font-size: 12px;
  font-weight: 500;
  background: var(--sky-card);
  border: 1px solid var(--sky-border);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
}

.toast.success { border-left: 3px solid var(--sky-green); }
.toast.error { border-left: 3px solid var(--sky-red); }
.toast.warning { border-left: 3px solid var(--sky-gold); }
.toast.info { border-left: 3px solid var(--sky-accent2); }

.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(12px);
}
</style>
