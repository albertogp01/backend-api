/**
 * backend-api/server.js
 * Servidor API con configuración de seguridad robusta
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const dotenv = require('dotenv');
const formRoutes = require('./routes/formRoutes');

// Cargar variables de entorno desde .env
dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

// Determinar el entorno de ejecución
const isProduction = process.env.NODE_ENV === 'production';

// Configurar orígenes permitidos para CORS
const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS 
  ? process.env.CORS_ALLOWED_ORIGINS.split(',') 
  : ['https://fitform.coach', 'https://www.fitform.coach'];

// Agregar localhost solo en desarrollo
if (!isProduction) {
  allowedOrigins.push('http://localhost:3000', 'http://localhost:8000');
}

// Middleware básico
app.use(helmet({
  contentSecurityPolicy: isProduction, // Habilitar en producción
  crossOriginEmbedderPolicy: isProduction,
  crossOriginOpenerPolicy: isProduction,
  crossOriginResourcePolicy: isProduction,
  dnsPrefetchControl: true,
  frameguard: true,
  hidePoweredBy: true,
  hsts: isProduction,
  ieNoOpen: true,
  noSniff: true,
  permittedCrossDomainPolicies: true,
  referrerPolicy: true,
  xssFilter: true,
}));

// Configuración CORS segura
app.use(cors({
  origin: (origin, callback) => {
    // Permitir solicitudes sin origen (como las aplicaciones móviles o curl)
    if (!origin) return callback(null, true);
    
    // Verificar si el origen está en la lista de permitidos
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.warn(`Origen bloqueado por CORS: ${origin}`);
      callback(new Error('No permitido por CORS'));
    }
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Length', 'X-Request-Id'],
  credentials: true,
  maxAge: 86400 // 24 horas en segundos
}));

// Límites para solicitudes JSON para prevenir ataques DoS
app.use(express.json({ 
  limit: '1mb',
  strict: true 
}));
app.use(express.urlencoded({ 
  extended: true,
  limit: '1mb'
}));

// Configuración de logger
const morganFormat = isProduction ? 'combined' : 'dev';
app.use(morgan(morganFormat, {
  skip: (req, res) => isProduction && res.statusCode < 400
}));

// Middleware para logging de solicitudes con información adicional
app.use((req, res, next) => {
  const requestId = req.headers['x-request-id'] || 
                    req.headers['x-correlation-id'] || 
                    `req-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  
  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  
  console.log(`[${new Date().toISOString()}] [${requestId}] ${req.method} ${req.originalUrl}`);
  
  // Registrar tiempo de respuesta
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] [${requestId}] ${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`);
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

// Rutas de la API
app.use('/api/form', formRoutes);

// Ruta de verificación de estado
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime()
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

// Manejador de rutas no encontradas
app.use((req, res, next) => {
  console.log(`Ruta no encontrada: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ 
    success: false, 
    message: 'Endpoint not found',
    path: req.originalUrl
  });
});

// Manejador global de errores
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  
  // Registrar error con ID de solicitud para seguimiento
  console.error(`[ERROR] [${req.requestId}] ${err.message}`, err.stack);
  
  // Respuesta segura que no expone información sensible en producción
  res.status(statusCode).json({ 
    success: false, 
    message: isProduction ? 'Internal server error' : err.message,
    requestId: req.requestId,
    // Incluir detalles del error solo en desarrollo
    ...(isProduction ? {} : { 
      stack: err.stack?.split('\n').map(line => line.trim())
    })
  });
});

// Manejar señales de terminación
process.on('SIGTERM', () => {
  console.log('SIGTERM señal recibida: cerrando servidor HTTP');
  // Operaciones de limpieza antes de terminar
  process.exit(0);
});

// Iniciar servidor
const server = app.listen(PORT, () => {
  console.log(`
  ========================================
  🚀 Servidor API funcionando en puerto ${PORT}
  📄 Modo: ${process.env.NODE_ENV || 'development'}
  🔒 CORS: ${allowedOrigins.join(', ')}
  ========================================
  `);
});

// Exportar app para pruebas
module.exports = app;