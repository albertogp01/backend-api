/**
 * backend-api/middleware/validator.js
 * Validación de datos del formulario
 */

/**
 * Middleware para validar datos del formulario antes de procesarlos
 * Verifica la presencia de campos obligatorios y el formato correcto
 */
exports.validateFormData = (req, res, next) => {
  try {
    // Extraer datos del cuerpo de la petición
    const formData = req.body;
    
    // Verificar que hay datos
    if (!formData || Object.keys(formData).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No se recibieron datos del formulario"
      });
    }
    
    // Log para depuración
    console.log(`[DEBUG] Validando campos del formulario: ${JSON.stringify(Object.keys(formData))}`);
    
    // Lista de campos requeridos
    const requiredFields = ['email', 'nombre'];
    const missingFields = [];
    
    // Verificar campos requeridos
    requiredFields.forEach(field => {
      if (!formData[field] || typeof formData[field] !== 'string' || formData[field].trim() === '') {
        missingFields.push(field);
        console.log(`[DEBUG] Campo requerido faltante: ${field}`);
      }
    });
    
    // Si faltan campos requeridos, devolver error
    if (missingFields.length > 0) {
      console.log(`[DEBUG] Solicitud rechazada por campos faltantes: ${missingFields.join(', ')}`);
      return res.status(400).json({
        success: false,
        message: "Faltan campos requeridos",
        missingFields
      });
    }
    
    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      console.log(`[DEBUG] Email inválido: ${formData.email}`);
      return res.status(400).json({
        success: false,
        message: "El formato del correo electrónico no es válido"
      });
    }
    
    // Validar cantidad mínima de información para generar una rutina útil
    let dataPointsCount = 0;
    const keyFields = [
      'objetivo', 'nivel', 'condicion_fisica', 'lugar_entrenamiento',
      'dias_entrenamiento', 'tiempo_sesion'
    ];
    
    keyFields.forEach(field => {
      if (formData[field] && typeof formData[field] === 'string' && formData[field].trim() !== '') {
        dataPointsCount++;
      }
    });
    
    // Si no hay suficientes campos clave pero hay información adicional, considerar eso también
    if (dataPointsCount < 3 && formData.info_adicional && formData.info_adicional.trim().length > 50) {
      console.log('[DEBUG] Información adicional compensando falta de campos clave');
      dataPointsCount = 3; // La información adicional es lo suficientemente rica
    }
    
    // Requerimos al menos 3 campos clave para generar una rutina decente
    if (dataPointsCount < 3) {
      console.log(`[DEBUG] Información insuficiente. Campos clave completados: ${dataPointsCount}/3`);
      return res.status(400).json({
        success: false,
        message: "Información insuficiente para generar una rutina personalizada",
        description: "Por favor completa más campos del formulario para obtener mejores resultados"
      });
    }
    
    // Sanear datos
    Object.keys(formData).forEach(key => {
      // Si es string, eliminar espacios al inicio y final
      if (typeof formData[key] === 'string') {
        formData[key] = formData[key].trim();
        
        // Limitar longitud a 2000 caracteres para evitar ataques
        if (formData[key].length > 2000) {
          formData[key] = formData[key].substring(0, 2000);
        }
      }
    });
    
    console.log('[DEBUG] Validación completada con éxito');
    // Todos los datos son válidos, continuar
    next();
    
  } catch (error) {
    console.error('Error en validación de datos:', error);
    res.status(400).json({
      success: false,
      message: "Error en la validación de datos",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Middleware para validar ID en parámetros de URL
 * Útil para rutas como /status/:requestId
 */
exports.validateRequestId = (req, res, next) => {
  const { requestId } = req.params;
  
  // Verficar que el requestId existe y tiene formato UUID válido
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  
  if (!requestId || !uuidRegex.test(requestId)) {
    return res.status(400).json({
      success: false,
      message: "ID de solicitud no válido"
    });
  }
  
  // ID válido, continuar
  next();
};

/**
 * Middleware para validar credenciales de administrador
 * Útil para rutas protegidas como /admin/submissions
 */
exports.validateAdminAuth = (req, res, next) => {
  // Si no hay clave configurada, denegar acceso
  if (!process.env.API_SECRET || process.env.API_SECRET.trim() === '') {
    return res.status(403).json({
      success: false,
      message: "Acceso no autorizado"
    });
  }
  
  // Obtener token del header Authorization
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
  
  // Si no hay token, denegar acceso
  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Se requiere autenticación"
    });
  }
  
  // Verificar token (simple API_SECRET)
  if (token !== process.env.API_SECRET) {
    return res.status(403).json({
      success: false,
      message: "Credenciales no válidas"
    });
  }
  
  // Credenciales válidas, continuar
  next();
};