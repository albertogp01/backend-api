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

// Crear limitador de peticiones para evitar abusos
// Restringir a 10 solicitudes por minuto por IP
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 10, // 10 solicitudes por ventana
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Demasiadas solicitudes, por favor intenta de nuevo más tarde."
  }
});

// Ruta principal para procesar el formulario
// Activar la validación para ayudar a detectar problemas de formato
router.post('/submit', apiLimiter, validateFormData, (req, res) => {
  try {
    console.log('Ruta /api/form/submit accedida');
    console.log('Cuerpo de la solicitud:', req.body);
    
    // Si llegamos aquí, los datos son válidos, pasarlos al controlador
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

// Ruta para verificar el estado de un envío
router.get('/status/:requestId', formController.checkStatus);

// Ruta para el panel de administración
router.get('/admin/submissions', formController.getSubmissions);

// Ruta para depuración (disponible en todos los entornos temporalmente)
router.get('/debug/test', (req, res) => {
  res.status(200).json({
    message: 'Ruta de depuración funcionando correctamente',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'production'
  });
});

// Nueva ruta para verificación del formato de datos
router.post('/debug/echo', (req, res) => {
  res.status(200).json({
    message: 'Echo de datos recibidos',
    received: req.body,
    contentType: req.headers['content-type'],
    timestamp: new Date().toISOString()
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