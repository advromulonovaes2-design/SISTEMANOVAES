// Permite instalar o sistema no celular e abrir a tela mesmo com internet fraca.
// Sempre tenta a versão mais nova primeiro; os dados do escritório nunca ficam guardados aqui.
const CACHE = 'banca-v21';
const BASE = ['./', './index.html', './estilo.css', './calc.js', './app.js', './modulos.js', './visual.js', './editor.js', './agenda.js', './juri.js', './prev.js', './cofre.js', './imagem.js', './seguranca.js', './envios.js', './extras.js', './pecas.js', './aovivo.js', './relatorios.js', './papeis.js', './busca.js', './carteira.js', './ia.js', './organiza.js', './financeiro.js', './erros.js', './conferencia.js', './saude.js', './agendalink.js', './acompanha.js', './datajud.js', './lib/pdf-lib.min.js', './config.js', './manifest.webmanifest', './icone-192.png', './icone-512.png', './marca.png', './logo-documento.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(BASE)).catch(() => {})); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== CACHE).map(x => caches.delete(x))))); self.clients.claim(); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(r => { const cp = r.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); return r; }).catch(() => caches.match(e.request)));
});

// Avisos enviados pelo robô (prazos, intimações, documentos de clientes)
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { corpo: e.data ? e.data.text() : '' }; }
  const titulo = d.titulo || 'Escritório';
  e.waitUntil(self.registration.showNotification(titulo, {
    body: d.corpo || '', icon: 'icone-192.png', badge: 'icone-192.png',
    tag: d.tag || undefined, renotify: !!d.tag, data: { url: d.url || './' }
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const alvo = new URL((e.notification.data && e.notification.data.url) || './', self.registration.scope).href;
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(l => {
    for (const c of l) { if (c.url.startsWith(self.registration.scope)) { c.focus(); if ('navigate' in c) return c.navigate(alvo); return; } }
    return clients.openWindow(alvo);
  }));
});
