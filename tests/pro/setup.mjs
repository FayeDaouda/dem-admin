// Environnement navigateur minimal pour tester les modules de l'espace web
// DEM Pro avec le testeur intégré de Node (node --test), sans dépendance.
class MemoryStorage {
  #m = new Map()
  getItem(k) { return this.#m.has(k) ? this.#m.get(k) : null }
  setItem(k, v) { this.#m.set(k, String(v)) }
  removeItem(k) { this.#m.delete(k) }
  clear() { this.#m.clear() }
}
globalThis.localStorage = new MemoryStorage()
globalThis.sessionStorage = new MemoryStorage()
if (!globalThis.window) globalThis.window = new EventTarget()
if (!globalThis.CustomEvent) {
  globalThis.CustomEvent = class extends Event { constructor(t, o = {}) { super(t); this.detail = o.detail } }
}
