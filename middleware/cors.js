/**
 * backend-api/middleware/cors.js
 * Configuración de CORS para la API
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
        ];
  
    const origin = req.headers.origin;
    
    // Verificar si el origen de la solicitud está en la lista de permitidos
    if (allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    } else if (process.env.NODE_ENV === 'development') {
      // En desarrollo, podemos ser más permisivos
      res.setHeader('Access-Control-Allow-Origin', origin || '*');
    }
    
    // Configurar otros headers CORS
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    
    // Configurar máximo tiempo de caché para preflight requests
    res.setHeader('Access-Control-Max-Age', '86400'); // 24 horas
    
    // Manejar solicitudes preflight OPTIONS automáticamente
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    
    // Pasar al siguiente middleware
    next();
  };