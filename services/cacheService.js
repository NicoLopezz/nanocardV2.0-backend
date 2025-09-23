const NodeCache = require('node-cache');

const cache = new NodeCache({ 
  stdTTL: 300, // 5 minutos por defecto
  checkperiod: 60, // Verificar cada minuto
  useClones: false 
});

const CACHE_KEYS = {
  ADMIN_ALL_CARDS: 'admin_all_cards',
  ADMIN_STATS: 'admin_stats',
  CARD_STATS: 'card_stats',
  USER_STATS: 'user_stats'
};

const CACHE_TTL = {
  ADMIN_ALL_CARDS: 600, // 10 minutos
  ADMIN_STATS: 300, // 5 minutos
  CARD_STATS: 180, // 3 minutos
  USER_STATS: 300 // 5 minutos
};

const cacheService = {
  // Obtener datos del caché
  get: (key) => {
    return cache.get(key);
  },

  // Guardar datos en el caché
  set: (key, data, ttl = null) => {
    const cacheTTL = ttl || CACHE_TTL[key] || 300;
    return cache.set(key, data, cacheTTL);
  },

  // Invalidar caché específico
  invalidate: (key) => {
    return cache.del(key);
  },

  // Invalidar múltiples cachés
  invalidateMultiple: (keys) => {
    return cache.del(keys);
  },

  // Limpiar todo el caché
  clear: () => {
    return cache.flushAll();
  },

  // Obtener estadísticas del caché
  getStats: () => {
    return cache.getStats();
  },

  // Verificar si existe en caché
  has: (key) => {
    return cache.has(key);
  },

  // Obtener TTL restante
  getTtl: (key) => {
    return cache.getTtl(key);
  },

  // Claves de caché
  KEYS: CACHE_KEYS,

  // TTL por defecto
  TTL: CACHE_TTL
};

module.exports = cacheService;
