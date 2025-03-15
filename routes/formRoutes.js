/**
 * backend-api/routes/formRoutes.js
 * Rutas para manejar la interacción con el formulario
 */

const express = require('express');
const router = express.Router();
const formController = require('../controllers/formController');
const { validateFormData } = require('../middleware/validator');
const rateLimit = require('express-rate-limit');

// Log para depuración
console.log('Cargando módulo formRoutes.js');

// Ruta para confirmar que el router está funcionando
router.get('/', (req, res) => {
  console.log('Ruta API /api/form accedida');
  res.status(200).json({ 
    message: 'API de formularios funcionando', 
    endpoints: {
      submit: 'POST /submit',
      status: 'GET /status/:requestId',
      admin: 'GET /admin/submissions'
    }
  });
});

// Ruta de prueba simple
router.get('/test', (req, res) => {
  console.log('Ruta de prueba /api/form/test accedida');
  res.status(200).json({
    success: true,
    message: 'Ruta de prueba funcionando correctamente',
    timestamp: new Date().toISOString()
  });
});

// Crear limitador de peticiones para evitar abusos
// Restringir a 5 solicitudes por minuto por IP
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 5, // 5 solicitudes por ventana
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Demasiadas solicitudes, por favor intenta de nuevo más tarde."
  }
});

// Versión simplificada de la ruta submit para pruebas
router.post('/submit-test', (req, res) => {
  console.log('Ruta /api/form/submit-test accedida');
  console.log('Datos recibidos:', req.body);
  res.status(200).json({ 
    success: true, 
    message: "Formulario recibido correctamente (endpoint de prueba)",
    data: req.body,
    timestamp: new Date().toISOString()
  });
});

// Middleware de debugging para la ruta /submit
router.use('/submit', (req, res, next) => {
  console.log(`[${new Date().toISOString()}] Accediendo a ruta /api/form/submit - Método: ${req.method}`);
  console.log('Headers:', req.headers);
  console.log('Body:', req.body);
  next();
});

// Ruta principal para procesar el formulario
// Temporalmente desactivamos la validación para pruebas
router.post('/submit', apiLimiter, (req, res) => {
  try {
    console.log('Procesando solicitud en /api/form/submit');
    
    // Si el validador está causando problemas, pasamos directamente al controlador
    return formController.processForm(req, res);
  } catch (error) {
    console.error('Error en ruta /submit:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno en el servidor',
      error: error.message
    });
  }
});

// Ruta para verificar el estado de un envío (útil para verificar si se procesó correctamente)
router.get('/status/:requestId', formController.checkStatus);

// Ruta para el panel de administración (protegerla adecuadamente en producción)
// En producción, agregar middleware de autenticación
router.get('/admin/submissions', formController.getSubmissions);

// Ruta para depuración (disponible en todos los entornos temporalmente)
router.get('/debug/test', (req, res) => {
  res.status(200).json({
    message: 'Ruta de depuración funcionando correctamente',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'production'
  });
});

// Manejar errores en este router
router.use((err, req, res, next) => {
  console.error(`Error en formRoutes: ${err.message}`);
  res.status(500).json({
    success: false,
    message: 'Error en el procesamiento del formulario',
    error: err.message
  });
});

module.exports = router;