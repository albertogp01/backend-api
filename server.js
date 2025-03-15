/**
 * backend-api/server.js
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
const PORT = process.env.PORT || 3000;

// Middleware básico
app.use(helmet()); // Seguridad
app.use(cors({
  // Configurar los dominios permitidos
  origin: process.env.CORS_ALLOWED_ORIGINS 
    ? process.env.CORS_ALLOWED_ORIGINS.split(',') 
    : ['http://localhost:3000', 'https://tudominio.com'],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev')); // Logging de solicitudes

// Rutas
app.use('/api/form', formRoutes);

// Ruta básica para verificar que el servidor está funcionando
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Manejador global de errores
app.use((err, req, res, next) => {
  console.error('Error del servidor:', err);
  
  // Enviar respuesta de error
  res.status(500).json({ 
    success: false, 
    message: 'Error interno del servidor',
    // Incluir detalles del error solo en desarrollo
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`
  ========================================
  🚀 Servidor API funcionando en puerto ${PORT}
  📄 Modo: ${process.env.NODE_ENV || 'development'}
  ========================================
  `);
});