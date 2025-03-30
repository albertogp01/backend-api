/**
 * backend-api/server.js
 * Servidor API con configuración de seguridad robusta
 */

const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const dotenv = require('dotenv');
const formRoutes = require('./routes/formRoutes'); // Asumo que el rate limiter está aquí dentro
const corsMiddleware = require('./middleware/cors');

// Cargar variables de entorno desde .env
dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

// --- CONFIGURACIÓN IMPORTANTE PARA RAILWAY/PROXY ---
// Confía en el primer proxy (necesario para que express-rate-limit funcione correctamente)
// Debe ir ANTES de que cualquier middleware use req.ip o confíe en X-Forwarded-For
app.set('trust proxy', 1);
// ----------------------------------------------------

// Determinar el entorno de ejecución
const isProduction = process.env.NODE_ENV === 'production';

// Middleware básico de seguridad con Helmet
app.use(helmet({
  // Ajusta las políticas según tus necesidades, habilitarlas en producción es buena práctica
  contentSecurityPolicy: isProduction ? undefined : false, // Deshabilitar CSP en desarrollo si causa problemas, configurar bien en prod
  crossOriginEmbedderPolicy: isProduction,
  crossOriginOpenerPolicy: isProduction,
  crossOriginResourcePolicy: { policy: "same-site" }, // Ajustar según necesidad ('same-origin', 'cross-origin')
  dnsPrefetchControl: { allow: false }, // Deshabilitar si no se necesita
  frameguard: { action: 'deny' }, // Prevenir clickjacking
  hidePoweredBy: true,
  hsts: isProduction ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false, // HSTS solo en prod con HTTPS
  ieNoOpen: true,
  noSniff: true,
  permittedCrossDomainPolicies: { permittedPolicies: "none" }, // Más restrictivo si no usas Flash/PDFs viejos
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }, // Buena política por defecto
  xssFilter: true, // Habilitado por defecto en navegadores modernos, pero no hace daño
}));

// Usar el middleware CORS personalizado
app.use(corsMiddleware);

// Límites para solicitudes JSON para prevenir ataques DoS
app.use(express.json({
  limit: '1mb', // Ajusta según el tamaño esperado de tus JSON
  strict: true
}));
app.use(express.urlencoded({
  extended: true, // Permite objetos anidados en datos de formulario
  limit: '1mb' // Ajusta según necesidad
}));

// Configuración de logger Morgan
const morganFormat = isProduction ? 'combined' : 'dev';
app.use(morgan(morganFormat, {
  skip: (req, res) => isProduction && res.statusCode < 400 // No loguear 2xx/3xx en producción
}));

// Middleware para logging de solicitudes con información adicional (Request ID)
app.use((req, res, next) => {
  const requestId = req.headers['x-request-id'] ||
                    req.headers['x-correlation-id'] ||
                    req.headers['x-railway-request-id'] || // Usar ID de Railway si existe
                    `req-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`; // ID más corto

  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  console.log(`[${new Date().toISOString()}] [${requestId}] ${req.method} ${req.originalUrl} IP: ${req.ip}`); // Loguear IP (ahora será la correcta gracias a trust proxy)

  // Registrar tiempo de respuesta
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] [${requestId}] Response ${res.statusCode} (${duration}ms)`);
  });

  next();
});

// Ruta básica en la raíz para verificar que el servidor está funcionando
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'FitForm API Service',
    status: 'running',
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Rutas de la API (aquí dentro se aplica el rate limiter en formRoutes.js)
app.use('/api/form', formRoutes);

// Ruta de verificación de estado /health
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime() // Tiempo que lleva corriendo el proceso
  });
});

// Ruta de prueba en desarrollo
if (!isProduction) {
  app.get('/test', (req, res) => {
    console.log(`Ruta de prueba accedida: ${req.requestId}`);
    res.status(200).json({
      message: 'API test endpoint',
      timestamp: new Date().toISOString(),
      requestId: req.requestId
    });
  });
}

// Manejador de rutas no encontradas (404) - Debe ir después de todas las rutas válidas
app.use((req, res, next) => {
  console.log(`[${req.requestId}] Ruta no encontrada: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
    path: req.originalUrl,
    requestId: req.requestId
  });
});

// Manejador global de errores - Debe ser el último middleware
app.use((err, req, res, next) => {
  const statusCode = typeof err.statusCode === 'number' ? err.statusCode : 500; // Asegurar que statusCode es número

  // Registrar error con ID de solicitud para seguimiento
  console.error(`[ERROR] [${req.requestId}] Status: ${statusCode} Message: ${err.message}`, err.stack || '(Sin stack trace)');

  // Respuesta segura que no expone detalles internos en producción
  res.status(statusCode).json({
    success: false,
    message: (isProduction && statusCode === 500) ? 'Internal server error' : err.message, // Mensaje genérico en prod para 500
    requestId: req.requestId,
    // Incluir stack solo en desarrollo
    ...(isProduction ? {} : {
      stack: err.stack?.split('\n').map(line => line.trim()) || 'No stack available'
    })
  });
});


// Manejar señales de terminación para cierre grácil (opcional pero bueno)
const signals = ['SIGINT', 'SIGTERM'];
signals.forEach(signal => {
    process.on(signal, () => {
        console.log(`${signal} señal recibida: cerrando servidor HTTP...`);
        server.close(() => {
            console.log('Servidor HTTP cerrado.');
            // Aquí podrías cerrar conexiones a DB, etc.
            process.exit(0); // Salir limpiamente
        });

        // Forzar salida si el servidor no cierra en un tiempo razonable
        setTimeout(() => {
            console.error('No se pudo cerrar conexiones a tiempo, forzando salida.');
            process.exit(1);
        }, 10000); // 10 segundos de gracia
    });
});


// Iniciar servidor
const server = app.listen(PORT, () => {
  console.log(`
  ========================================
  🚀 Servidor API funcionando en puerto ${PORT}
  📄 Modo: ${process.env.NODE_ENV || 'development'}
  ========================================
  `);
});

// Exportar app para posibles pruebas unitarias/integración
module.exports = app;