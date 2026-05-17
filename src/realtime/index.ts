import { graphApi, eventsApi } from '@/api'

type Handler = (payload: any) => void

class RealtimeClient {
  url: string
  ws: WebSocket | null = null
  handlers: Record<string, Handler[]> = {}
  reconnectDelay = 1000
  maxReconnect = 30000
  pollTimer: any = null
  lastGraphSnapshot = ''

  constructor(url?: string) {
    this.url = url ?? (import.meta.env.VITE_REALTIME_URL as string) ?? 'ws://localhost:8000/realtime'
  }

  on(event: string, cb: Handler) {
    (this.handlers[event] ??= []).push(cb)
  }

  off(event: string, cb?: Handler) {
    if (!cb) delete this.handlers[event]
    else this.handlers[event] = (this.handlers[event] || []).filter(h => h !== cb)
  }

  emit(event: string, payload: any) {
    ;(this.handlers[event] || []).forEach(h => { try { h(payload) } catch {} })
  }

  connect() {
    if (this.ws) return
    try {
      this.ws = new WebSocket(this.url)
    } catch (e) {
      this.startPolling();
      return
    }

    let opened = false
    const handshakeTimeout = setTimeout(() => {
      if (!opened) {
        try { this.ws?.close() } catch {}
        this.ws = null
        this.emit('ws-failed', null)
        this.startPolling()
      }
    }, 3000)

    this.ws.onopen = () => {
      opened = true
      clearTimeout(handshakeTimeout)
      this.emit('connected', null)
      this.reconnectDelay = 1000
      if (this.pollTimer) { clearInterval(this.pollTimer); this.pollTimer = null }
    }

    this.ws.onmessage = (ev) => {
      try {
        const m = typeof ev.data === 'string' ? JSON.parse(ev.data) : ev.data
        if (m?.type) this.emit(m.type, m.payload)
        else this.emit('message', m)
      } catch (e) { this.emit('message', ev.data) }
    }

    this.ws.onclose = () => {
      clearTimeout(handshakeTimeout)
      const hadOpen = opened
      this.ws = null
      this.emit('disconnected', null)
      if (hadOpen) this.scheduleReconnect()
      else this.startPolling()
    }

    this.ws.onerror = () => {
      // errors are expected if server not available — onclose/handshake will handle fallback
    }
  }

  scheduleReconnect() {
    setTimeout(() => { if (!this.ws) this.connect() }, this.reconnectDelay)
    this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, this.maxReconnect)
  }

  close() {
    this.ws?.close()
    this.ws = null
    if (this.pollTimer) { clearInterval(this.pollTimer); this.pollTimer = null }
  }

  async pollOnce() {
    try {
      const [airports, routes, blocked] = await Promise.all([graphApi.nodes(), graphApi.edges(), eventsApi.blocked()])
      const snapshot = JSON.stringify({ airports, routes, blocked })
      if (snapshot !== this.lastGraphSnapshot) {
        this.lastGraphSnapshot = snapshot
        this.emit('graph', { airports, routes, blocked })
      }
    } catch (e) {}
  }

  startPolling(interval = 3000) {
    if (this.pollTimer) return
    this.pollTimer = setInterval(() => this.pollOnce(), interval)
    // run immediately
    this.pollOnce()
  }
}

const realtime = new RealtimeClient()
export default realtime
export { RealtimeClient }
