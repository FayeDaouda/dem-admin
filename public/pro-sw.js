/* Service worker de l'espace web DEM Pro (pro.dem.sn, ou /pro en local).
 *
 * Rôle volontairement minimal :
 *  - rendre l'application installable (écran d'accueil, fenêtre à part) ;
 *  - afficher une page « Hors connexion » quand une PAGE ne se charge pas.
 *
 * Il ne met RIEN en cache : ni les réponses de l'API (api.dem.sn, autre
 * origine, jamais interceptée), ni les fichiers de l'application. Seules les
 * navigations (ouverture d'une page) passent par lui, et toujours par le
 * réseau d'abord. Les données restent donc toujours celles du serveur.
 */
const VERSION = 'dem-pro-sw-1'

self.addEventListener('install', () => { self.skipWaiting() })

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Anciennes versions qui auraient pu créer un cache : supprimées
    const keys = await caches.keys()
    await Promise.all(keys.filter(k => k.startsWith('dem-pro')).map(k => caches.delete(k)))
    // Préchargement des navigations : la page part sur le réseau pendant
    // que le service worker démarre (aucun ralentissement)
    if (self.registration.navigationPreload) await self.registration.navigationPreload.enable()
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  // Uniquement l'ouverture d'une page de la même origine ; tout le reste
  // (API, scripts, images, socket) n'est pas touché
  if (req.mode !== 'navigate' || req.method !== 'GET') return
  if (new URL(req.url).origin !== self.location.origin) return
  event.respondWith((async () => {
    try {
      const preloaded = await event.preloadResponse
      if (preloaded) return preloaded
      return await fetch(req)
    } catch {
      return offlinePage(req.url)
    }
  })())
})

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

// Page autonome (pas de script : la CSP n'autorise pas le JavaScript en
// ligne) ; nouvel essai automatique toutes les 20 secondes.
function offlinePage(url) {
  const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#021520">
<meta http-equiv="refresh" content="20">
<title>DEM Pro · Hors connexion</title>
<style>
  *{box-sizing:border-box}
  html,body{margin:0;height:100%}
  body{display:grid;place-items:center;padding:24px 16px;background:#F6F8FB;color:#021520;
    font:15px/1.55 'DM Sans',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;-webkit-font-smoothing:antialiased}
  main{width:100%;max-width:440px;background:#fff;border:1px solid #E2E8F0;padding:36px 32px;position:relative}
  .c{position:absolute;width:6px;height:6px;background:#00D2FF}
  .tl{top:-1px;left:-1px}.tr{top:-1px;right:-1px}.bl{bottom:-1px;left:-1px}.br{bottom:-1px;right:-1px}
  .eyebrow{display:flex;align-items:center;gap:12px;margin:0 0 18px;font-weight:700;font-size:11.5px;line-height:1.2;
    letter-spacing:.14em;text-transform:uppercase;color:#006FA6}
  .eyebrow:before{content:'';width:36px;height:1px;background:currentColor}
  h1{margin:0 0 10px;font-size:24px;line-height:1.2;letter-spacing:-.01em}
  p{margin:0;color:#5B6B82}
  .ico{width:44px;height:44px;display:grid;place-items:center;background:#FFF7ED;color:#B45309;margin-bottom:18px}
  a{display:inline-flex;align-items:center;justify-content:center;height:44px;padding:0 20px;margin-top:24px;
    background:#021520;color:#fff;text-decoration:none;font-weight:700;font-size:12.5px;letter-spacing:.12em;text-transform:uppercase}
  a:hover{background:#00D2FF;color:#021520}
  a:focus-visible{outline:2px solid #0086C8;outline-offset:2px}
  small{display:block;margin-top:14px;color:#64748B;font-size:13px}
</style>
</head>
<body>
<main>
  <span class="c tl"></span><span class="c tr"></span><span class="c bl"></span><span class="c br"></span>
  <div class="ico" aria-hidden="true">
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h.01"/><path d="M8.5 16.43a5 5 0 0 1 7 0"/><path d="M5 12.86a10 10 0 0 1 5.17-2.69"/><path d="M19 12.86a10 10 0 0 0-2-1.38"/><path d="M2 8.82a15 15 0 0 1 4.18-2.65"/><path d="M22 8.82a15 15 0 0 0-11.29-3.76"/><path d="m2 2 20 20"/></svg>
  </div>
  <p class="eyebrow">DEM Pro</p>
  <h1>Pas de connexion internet</h1>
  <p>Votre espace DEM Pro a besoin d'internet pour afficher vos livraisons et vos commandes à jour. Vérifiez le Wi-Fi ou les données mobiles.</p>
  <a href="${esc(url)}">Réessayer</a>
  <small>Nouvel essai automatique dans quelques secondes.</small>
</main>
</body>
</html>`
  return new Response(html, {
    status: 503,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-DEM-SW': VERSION },
  })
}
