/**
 * backend-api/middleware/rateLimiter.js
 * Limitador de tasa de peticiones para prevenir abusos
 */

const rateLimit = require('express-rate-limit');

/**
 * Crea y configura un limitador de tasa de peticiones
 * @param {Object} options - Opciones de configuración personalizadas
 * @returns {Function} Middleware de Express rate-limit
 */
function createRateLimiter(options = {}) {
  // Obtener opciones desde variables de entorno o usar valores por defecto
  const windowMs = process.env.RATE_LIMIT_WINDOW_MS
    ? parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10)
    : 60 * 1000; // 1 minuto por defecto
  
  const max = process.env.RATE_LIMIT_MAX
    ? parseInt(process.env.RATE_LIMIT_MAX, 10)
    : 5; // 5 peticiones por ventana por defecto
  
  // Crear limitador con opciones combinadas
  return rateLimit({
    windowMs, // Duración de la ventana en milisegundos
    max, // Número máximo de peticiones por IP
    standardHeaders: true, // Devolver info en los headers `RateLimit-*`
    legacyHeaders: false, // Desactiva los headers `X-RateLimit-*`
    message: {
      success: false,
      message: "Demasiadas solicitudes, por favor intenta de nuevo más tarde",
      retryAfter: Math.ceil(windowMs / 1000) // Segundos para reintentar
    },
    // Opciones personalizadas
    ...options,
    // Función para generar la clave (por defecto, usa IP)
    keyGenerator: options.keyGenerator || ((req) => {
      // Usar X-Forwarded-For si está detrás de un proxy
      const xForwardedFor = req.headers['x-forwarded-for'];
      const ip = xForwardedFor 
        ? xForwardedFor.split(',')[0].trim() 
        : req.ip;
      return ip;
    }),
    // Handler cuando se excede el límite
    handler: options.handler || ((req, res, next, options) => {
      res.status(429).json(options.message);
    }),
    // Función para saltar el límite (p.ej. para IPs de confianza)
    skip: options.skip || ((req, res) => {
      // Opcional: Lista de IPs de confianza que saltan el límite
      const trustedIps = process.env.TRUSTED_IPS 
        ? process.env.TRUSTED_IPS.split(',') 
        : [];
      
      // Si la IP del cliente está en la lista de confianza, saltar el límite
      return trustedIps.includes(req.ip);
    })
  });
}

// Exportar un limitador por defecto
module.exports = createRateLimiter();

// Exportar también la función para crear limitadores personalizados
module.exports.createRateLimiter = createRateLimiter;

// Limitadores predefinidos para diferentes escenarios

// Limitador más estricto para rutas sensibles (login, registro, etc.)
module.exports.strictLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // 5 peticiones por ventana
  message: {
    success: false,
    message: "Demasiados intentos, por favor espera 15 minutos antes de reintentar"
  }
});

// Limitador para la API general (más permisivo)
module.exports.apiLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minuto
  max: 20, // 20 peticiones por minuto
});

// Limitador específico para peticiones de formulario
module.exports.formLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 10, // 10 formularios por hora desde la misma IP
  message: {
    success: false,
    message: "Has enviado demasiados formularios. Por favor, intenta más tarde."
  }
}); 