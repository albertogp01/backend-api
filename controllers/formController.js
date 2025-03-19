/**
 * backend-api/controllers/formController.js
 * Controlador principal para el procesamiento de formularios
 */

const { generateRoutine } = require('../services/openaiService');
const { sendEmail } = require('../services/emailService');
const { generatePDF } = require('../services/pdfService');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

// Almacén temporal para peticiones (en producción usar Redis o una base de datos)
const requestsStore = {
  pending: new Map(),    // Solicitudes en proceso
  completed: new Map(),  // Solicitudes completadas con éxito
  failed: new Map()      // Solicitudes con error
};

// Estadísticas básicas
const statistics = {
  totalSubmissions: 0,
  successfulRoutines: 0,
  failedRoutines: 0,
  processingErrors: 0,
  lastSubmission: null
};

/**
 * Procesa una solicitud de formulario
 */
exports.processForm = async (req, res) => {
  try {
    console.log("==== NUEVA SOLICITUD DE FORMULARIO ====");
    console.log("Datos recibidos:", JSON.stringify(req.body));
    console.log("IP:", req.ip);
    console.log("Fecha y hora:", new Date().toISOString());
    
    // Generar ID único para esta solicitud
    const requestId = uuidv4();
    
    // Obtener datos del formulario
    const { nombre: clientName = "Cliente", email, ...formData } = req.body;
    
    // Verificar datos mínimos requeridos (debería estar validado por middleware)
    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Falta el correo electrónico"
      });
    }
    
    // Crear objeto de seguimiento
    const requestData = {
      id: requestId,
      timestamp: new Date().toISOString(),
      clientName,
      email,
      formData,
      status: 'pending',
      message: 'Solicitud recibida, procesando...'
    };
    
    // Guardar en almacén temporal
    requestsStore.pending.set(requestId, requestData);
    
    // Actualizar estadísticas
    statistics.totalSubmissions++;
    statistics.lastSubmission = new Date().toISOString();
    
    // Responder inmediatamente al cliente
    res.status(200).json({
      success: true,
      message: "Formulario recibido correctamente. Tu rutina está siendo generada.",
      requestId,
      statusUrl: `/api/form/status/${requestId}`
    });
    
    // Procesar en segundo plano
    processFormData(requestData).catch(error => {
      console.error("Error procesando datos del formulario:", error);
      statistics.processingErrors++;
      
      // Actualizar estado en caso de error
      requestData.status = 'failed';
      requestData.message = 'Error al procesar la solicitud';
      requestData.error = error.message;
      
      // Mover de pending a failed
      requestsStore.pending.delete(requestId);
      requestsStore.failed.set(requestId, requestData);
    });
    
  } catch (error) {
    console.error("Error en el controlador del formulario:", error);
    res.status(500).json({
      success: false,
      message: "Error al procesar tu solicitud, por favor intenta de nuevo."
    });
  }
};

/**
 * Verifica el estado de una solicitud
 */
exports.checkStatus = (req, res) => {
  const { requestId } = req.params;
  
  // Buscar en todos los almacenes
  let requestData = 
    requestsStore.pending.get(requestId) || 
    requestsStore.completed.get(requestId) || 
    requestsStore.failed.get(requestId);
  
  if (!requestData) {
    return res.status(404).json({
      success: false,
      message: "Solicitud no encontrada"
    });
  }
  
  // Devolver estado actual (sin exponer datos sensibles)
  res.status(200).json({
    success: true,
    requestId,
    status: requestData.status,
    message: requestData.message,
    timestamp: requestData.timestamp,
    clientName: requestData.clientName,
    email: requestData.email?.substring(0, 3) + '***' // Ofuscar email
  });
};

/**
 * Obtiene todas las solicitudes (para administración)
 */
exports.getSubmissions = (req, res) => {
  // En producción, agregar autenticación aquí
  
  // Preparar resumen
  const summary = {
    total: {
      pending: requestsStore.pending.size,
      completed: requestsStore.completed.size,
      failed: requestsStore.failed.size,
      all: requestsStore.pending.size + requestsStore.completed.size + requestsStore.failed.size
    },
    statistics,
    // Últimas 10 solicitudes completadas (más recientes primero)
    recentCompleted: Array.from(requestsStore.completed.values())
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 10)
      .map(item => ({
        id: item.id,
        timestamp: item.timestamp,
        clientName: item.clientName,
        email: item.email?.substring(0, 3) + '***', // Ofuscar email
        status: item.status
      })),
    // Últimas 10 solicitudes fallidas
    recentFailed: Array.from(requestsStore.failed.values())
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 10)
      .map(item => ({
        id: item.id,
        timestamp: item.timestamp,
        clientName: item.clientName,
        email: item.email?.substring(0, 3) + '***', // Ofuscar email
        status: item.status,
        error: item.error
      }))
  };
  
  res.status(200).json({
    success: true,
    summary
  });
};

/**
 * Función interna: Procesa los datos del formulario en segundo plano
 * Esta es la función principal que hace todo el trabajo pesado
 */
async function processFormData(requestData) {
  try {
    const { id: requestId, clientName, email, formData } = requestData;
    
    console.log(`Procesando solicitud ${requestId} para cliente: ${clientName}`);
    
    // Actualizar mensaje de estado
    requestData.message = 'Generando rutina personalizada...';
    
    // Convertir los datos del formulario al formato que espera el servicio de OpenAI
    const formattedResponses = formatFormResponses(formData);
    
    console.log(`Datos formateados para OpenAI, generando rutina...`);
    
    // Crear un timeout para la generación de rutina (2 minutos)
    const routinePromise = generateRoutine(formattedResponses);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("Timeout: La generación de rutina tomó demasiado tiempo")), 120000)
    );
    
    // Ejecutar con timeout
    const routine = await Promise.race([routinePromise, timeoutPromise]);
    
    console.log(`Rutina generada para ${requestId}, creando PDF...`);
    requestData.message = 'Rutina generada, creando documento PDF...';
    
    // Crear directorio temporal si no existe
    const tempDir = process.env.TEMP_DIR || path.join(__dirname, '../temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Generar PDF
    const pdfPath = await generatePDF(routine, clientName);
    
    console.log(`PDF generado en ${pdfPath}, enviando email...`);
    requestData.message = 'Documento creado, enviando por email...';
    
    // Enviar email
    await sendEmail(email, pdfPath, requestId);
    
    console.log(`Email enviado a ${email} con rutina personalizada`);
    
    // Actualizar estado
    requestData.status = 'completed';
    requestData.message = 'Rutina enviada correctamente al email proporcionado';
    requestData.completedAt = new Date().toISOString();
    
    // Actualizar estadísticas
    statistics.successfulRoutines++;
    
    // Mover de pending a completed
    requestsStore.pending.delete(requestId);
    requestsStore.completed.set(requestId, requestData);
    
    // Limpiar entradas antiguas (mantener solo las últimas 100)
    if (requestsStore.completed.size > 100) {
      const oldestEntries = Array.from(requestsStore.completed.entries())
        .sort(([, a], [, b]) => new Date(a.timestamp) - new Date(b.timestamp))
        .slice(0, requestsStore.completed.size - 100);
      
      oldestEntries.forEach(([key]) => requestsStore.completed.delete(key));
    }
    
    return { success: true, requestId };
    
  } catch (error) {
    console.error("Error procesando formulario:", error);
    
    // Actualizar estadísticas
    statistics.failedRoutines++;
    
    // Relanzar para manejo superior
    throw error;
  }
}

/**
 * Función interna: Convierte los datos del formulario al formato esperado por OpenAI
 */
function formatFormResponses(formData) {
  // Mapeo entre campos del formulario y preguntas que espera OpenAI
  const fieldMapping = {
    'nombre': '¿Cómo te llamas?',
    'edad': '¿Cuál es tu edad?',
    'genero': '¿Cuál es tu género?',
    'peso': '¿Cuánto pesas?',         
    'altura': '¿Cuál es tu altura?', 
    'email': '¿Cuál es tu dirección de correo electrónico?',
    'objetivo': '¿Cuál es tu objetivo principal de entrenamiento?',
    'nivel': '¿Cuál es tu nivel de experiencia con el entrenamiento?',
    'condicion_fisica': '¿Cómo describirías tu condición física actual?',
    'lugar_entrenamiento': '¿Dónde sueles entrenar?',
    'dias_entrenamiento': '¿Cuántos días a la semana puedes entrenar?',
    'tiempo_sesion': '¿Cuánto tiempo puedes dedicar por sesión?',
    'cirugia_reciente': '¿Has tenido alguna cirugía reciente (último año) que debamos tener en cuenta?',
    'lesion_muscular': '¿Tienes alguna lesión muscular que pueda afectar tu movilidad?',
    'tendinopatia': '¿Tienes alguna tendinopatía que pueda afectar tu movilidad?',
    'limitacion_articular': '¿Tienes limitaciones de movilidad en alguna articulación?',
    'limitacion_ejercicios': '¿Tienes alguna limitación al realizar ejercicios como sentadillas, flexiones o saltos?',
    'problema_postural': '¿Tienes algún problema postural que afecte tu entrenamiento?',
    'condicion_medica': '¿Sufres de alguna condición médica que afecte tu rendimiento?',
    'medicacion': '¿Estás tomando alguna medicación que pueda afectar tu entrenamiento?',
    'ejercicios_favoritos': '¿Hay algún tipo de ejercicio que te guste especialmente?',
    'ejercicios_evitar': '¿Hay algún tipo de ejercicio que te desagrade o prefieras evitar?',
    'tipo_entrenamiento': '¿Prefieres entrenamientos enfocados en un grupo muscular por día o entrenamientos de cuerpo completo?',
    'material_especifico': '¿Quieres usar material específico?',
    'info_adicional': '¿Hay algo más que debamos saber para personalizar mejor tu rutina?'
  };

  // Array para almacenar respuestas formateadas
  const responses = [];

  // Procesar cada campo del formulario
  Object.entries(formData).forEach(([fieldName, value]) => {
    // Saltar campos vacíos o que no tienen mapeo
    if (!value || value.trim() === '' || !fieldMapping[fieldName]) {
      return;
    }

    // Formatear como "Pregunta\nRespuesta"
    responses.push(`${fieldMapping[fieldName]}\n${value.trim()}`);
  });

  // Asegurar que hay suficientes respuestas para generar una rutina útil
  if (responses.length < 5) {
    console.warn("Pocas respuestas para generar una rutina personalizada adecuada");
  }

  return responses;
}

// Exportar el almacén para pruebas (opcional)
exports.requestsStore = requestsStore;
exports.statistics = statistics;