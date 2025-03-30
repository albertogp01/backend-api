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

// NUEVA: Ruta detallada para depuración
router.post('/debug/submit', (req, res) => {
  try {
    console.log('------------------------------------');
    console.log('Ruta /api/form/debug/submit accedida');
    console.log('Headers:', JSON.stringify(req.headers, null, 2));
    console.log('Cuerpo:', JSON.stringify(req.body, null, 2));
    console.log('URL original:', req.originalUrl);
    console.log('Método:', req.method);
    console.log('IP:', req.ip);
    console.log('------------------------------------');
    
    // Responder para confirmar que la ruta funciona
    res.status(200).json({
      success: true,
      message: 'Datos recibidos correctamente para depuración',
      received: req.body,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error en ruta de depuración:', error);
    res.status(500).json({
      success: false,
      message: 'Error en el procesamiento',
      error: error.message
    });
  }
});

// Ruta principal para procesar el formulario
// Activar la validación para ayudar a detectar problemas de formato
router.post('/submit', apiLimiter, validateFormData, (req, res, next) => {
  try {
    console.log('------------------------------------');
    console.log('Ruta /api/form/submit accedida');
    console.log('Headers:', JSON.stringify(req.headers, null, 2));
    console.log('Contenido recibido:', typeof req.body === 'object' ? 'Objeto JSON válido' : typeof req.body);
    console.log('IP:', req.ip);
    console.log('Timestamp:', new Date().toISOString());
    console.log('------------------------------------');
    
    // Log adicional para debuggar problemas de formato del cuerpo
    if (typeof req.body === 'object') {
      console.log('Campos recibidos:', Object.keys(req.body).join(', '));
      
      // Verificar explícitamente los campos críticos
      if (!req.body.email || !req.body.nombre) {
        console.log('ADVERTENCIA: Campos requeridos faltantes en el cuerpo de la solicitud');
        console.log('email presente:', !!req.body.email);
        console.log('nombre presente:', !!req.body.nombre);
        
        return res.status(400).json({
          success: false,
          message: "Faltan campos obligatorios (email y/o nombre)",
          requiredFields: ['email', 'nombre']
        });
      }
    }
    
    // Si llegamos aquí, los datos son válidos, pasarlos al controlador
    return formController.processForm(req, res, next);
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

// NUEVA: Ruta para depuración (disponible en todos los entornos temporalmente)
router.get('/debug/test', (req, res) => {
  res.status(200).json({
    message: 'Ruta de depuración funcionando correctamente',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'production',
    headers: req.headers
  });
});

// NUEVA: Ruta para verificación del formato de datos
router.post('/debug/echo', (req, res) => {
  console.log('Ruta /api/form/debug/echo accedida');
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  console.log('Cuerpo:', JSON.stringify(req.body, null, 2));
  
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