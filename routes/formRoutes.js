/**
 * backend-api/routes/formRoutes.js
 * Rutas para manejar la interacción con el formulario
 */

const express = require('express');
const router = express.Router();
const formController = require('../controllers/formController');
const { validateFormData } = require('../middleware/validator');
const rateLimit = require('express-rate-limit');

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

// Ruta principal para procesar el formulario
router.post('/submit', apiLimiter, validateFormData, formController.processForm);

// Ruta para verificar el estado de un envío (útil para verificar si se procesó correctamente)
router.get('/status/:requestId', formController.checkStatus);

// Ruta para el panel de administración (protegerla adecuadamente en producción)
// En producción, agregar middleware de autenticación
router.get('/admin/submissions', formController.getSubmissions);

// Ruta para depuración (solo disponible en desarrollo)
if (process.env.NODE_ENV === 'development') {
  router.get('/debug/test', (req, res) => {
    res.status(200).json({
      message: 'Ruta de depuración funcionando correctamente',
      timestamp: new Date().toISOString(),
      env: process.env.NODE_ENV
    });
  });
}

module.exports = router;