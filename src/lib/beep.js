// Bips courts joués par l'admin pour une alerte (SOS coursier, course sans
// coursier) — une alerte ne doit pas passer inaperçue dans un onglet ouvert.
export function beep({ count = 3, frequency = 880 } = {}) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    for (let i = 0; i < count; i++) {
      const t = i * 0.35
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'square'
      osc.frequency.value = frequency
      gain.gain.value = 0.08
      osc.connect(gain).connect(ctx.destination)
      osc.start(ctx.currentTime + t)
      osc.stop(ctx.currentTime + t + 0.2)
    }
  } catch { /* audio bloqué par le navigateur : le bandeau suffit */ }
}
