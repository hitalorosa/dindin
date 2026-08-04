/* Service worker — cache offline do app shell.
   ⚠️ REGRA: todo deploy que mude js/ ou css/ TEM que bumpar o CACHE abaixo.
   O install só re-roda se os BYTES deste arquivo mudarem — sem o bump, o PWA
   já instalado continua servindo a versão antiga para sempre. */
const CACHE = 'planejador-v2';
const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/app.js',
  './js/mes.js',
  './js/carteiras.js',
  './js/dividas.js',
  './js/desejos.js',
  './manifest.json',
  './icon.svg'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  // App shell (HTML): rede primeiro, cai pro cache offline
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.match('./index.html')));
    return;
  }

  // Só assets locais. Cross-origin (ex.: microlink, fontes) passa direto pela rede.
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  // Código do app (js/css): REDE PRIMEIRO, cache só como rede de segurança offline.
  // Cache-first aqui é uma armadilha: se um deploy sair sem bumpar o CACHE acima,
  // o app instalado serve a versão velha para sempre e a atualização nunca chega.
  const ehCodigo = /\.(js|css)$/i.test(url.pathname);
  if (ehCodigo) {
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
        return res;
      }).catch(() => caches.match(req))
    );
    return;
  }

  // Resto (ícones, manifest): cache primeiro, que praticamente não muda.
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy));
      return res;
    }).catch(() => hit))
  );
});
