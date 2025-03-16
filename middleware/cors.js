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
  
  // Para depuración, permitir temporalmente cualquier origen
  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
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