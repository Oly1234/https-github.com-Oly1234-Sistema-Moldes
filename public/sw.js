const CACHE_NAME = 'vingi-moldes-cache-v3-dynamic'; // Mudança de nome força atualização
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json'
];

// Instalação: Força o novo SW a assumir imediatamente (skipWaiting)
self.addEventListener('install', (event) => {
  self.skipWaiting(); // CRUCIAL: Não espera o usuário fechar a aba
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(urlsToCache);
      })
  );
});

// Ativação: Limpa caches antigos imediatamente
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('SW: Limpando cache antigo', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      return self.clients.claim(); // Assume controle de todas as abas abertas imediatamente
    })
  );
});

// Fetch: Estratégia Network First para HTML (garante atualização)
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // Para navegação (HTML), tenta Rede primeiro, depois Cache
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          return caches.match(event.request);
        })
    );
    return;
  }

  // Para outros recursos (Imagens, CSS, JS), Cache First (Performance)
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});