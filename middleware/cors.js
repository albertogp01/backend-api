/**
 * backend-api/middleware/cors.js
 * Configuración mejorada de CORS para la API
 */

/**
 * Middleware para gestionar el CORS (Cross-Origin Resource Sharing)
 * Permite controlar qué dominios pueden acceder a la API
 */
module.exports = (req, res, next) => {
  // Lista de dominios permitidos (configurable desde variables de entorno)
  const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS 
    ? process.env.CORS_ALLOWED_ORIGINS.split(',') 
    : [
        'http://localhost:3000',
        'http://localhost:8080',
        'https://fitform.coach',
        'https://www.fitform.coach',
        // Añadir más dominios permitidos aquí
      ];

  // Obtener el origen de la solicitud
  const origin = req.headers.origin;
  console.log(`[CORS] Solicitud recibida de origen: ${origin || 'desconocido'}`);
  
  // Verificar si el origen de la solicitud está en la lista de permitidos
  if (origin && (allowedOrigins.includes(origin) || allowedOrigins.includes('*'))) {
    console.log(`[CORS] Origen permitido: ${origin}`);
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (process.env.NODE_ENV === 'development' || process.env.CORS_ALLOW_ALL === 'true') {
    // En desarrollo o si se configura explícitamente, ser más permisivos
    console.log(`[CORS] Modo desarrollo: permitiendo origen ${origin || '*'}`);
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  } else if (origin) {
    // Registrar intentos de acceso no permitidos
    console.warn(`[CORS] Origen no permitido: ${origin}`);
    
    // Para depuración, permitir temporalmente cualquier origen en producción
    // NOTA: Eliminar estas líneas después de solucionar el problema
    console.log(`[CORS] TEMPORAL: Permitiendo origen no listado ${origin} para depuración`);
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  
  // Configurar otros headers CORS - MÁS PERMISIVOS PARA DIAGNÓSTICO
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length, X-Request-Id');
  
  // Configurar máximo tiempo de caché para preflight requests
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 horas
  
  // Para debugging durante el desarrollo, registrar todos los headers de la solicitud
  if (process.env.NODE_ENV === 'development' || process.env.DEBUG_HEADERS === 'true') {
    console.log('[CORS] Headers recibidos:', req.headers);
  }
  
  // Manejar solicitudes preflight OPTIONS automáticamente
  if (req.method === 'OPTIONS') {
    console.log('[CORS] Respondiendo a preflight OPTIONS');
    return res.status(200).end();
  }
  
  // Pasar al siguiente middleware
  next();
};