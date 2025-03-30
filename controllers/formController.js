/**
 * backend-api/controllers/formController.js
 * Controlador principal para el procesamiento de formularios con manejo de estado asíncrono.
 */

// Importar servicios y utilidades
const { generateRoutine } = require('../services/openaiService');
const { sendEmail } = require('../services/emailService');
const { generatePDF } = require('../services/pdfService');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

// Almacén en memoria para peticiones (Considerar Redis/DB en producción real)
const requestsStore = {
  pending: new Map(),   // Solicitudes en proceso { id: requestData }
  completed: new Map(), // Solicitudes completadas { id: requestData }
  failed: new Map()     // Solicitudes con error { id: requestData }
};

// Estadísticas básicas (solo en memoria)
const statistics = {
  totalSubmissions: 0,
  successfulRoutines: 0,
  failedRoutines: 0,
  processingErrors: 0,
  lastSubmissionTimestamp: null
};

// Limpieza periódica de solicitudes antiguas (ejemplo cada hora)
const CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hora en ms
const MAX_AGE_COMPLETED = 24 * 60 * 60 * 1000; // 24 horas en ms
const MAX_AGE_FAILED = 7 * 24 * 60 * 60 * 1000; // 7 días en ms

function cleanupOldRequests() {
    const now = Date.now();
    // No loguear la limpieza cada vez si es muy frecuente, o usar nivel 'debug'
    // console.log(`[${new Date().toISOString()}] Ejecutando limpieza de solicitudes antiguas...`);

    let completedDeleted = 0;
    requestsStore.completed.forEach((data, id) => {
        if (now - new Date(data.completedAt || data.timestamp).getTime() > MAX_AGE_COMPLETED) {
            requestsStore.completed.delete(id);
            completedDeleted++;
        }
    });
    if (completedDeleted > 0) console.log(`[Cleanup] Eliminadas ${completedDeleted} solicitudes completadas antiguas.`);

    let failedDeleted = 0;
    requestsStore.failed.forEach((data, id) => {
        if (now - new Date(data.failedAt || data.timestamp).getTime() > MAX_AGE_FAILED) {
            requestsStore.failed.delete(id);
            failedDeleted++;
        }
    });
    if (failedDeleted > 0) console.log(`[Cleanup] Eliminadas ${failedDeleted} solicitudes fallidas antiguas.`);
}
// Iniciar limpieza periódica (solo si el proceso va a estar corriendo mucho tiempo)
// Considera si esto es necesario en un entorno serverless o de corta vida.
// Si se ejecuta, almacenar el ID del intervalo para poder limpiarlo al cerrar (graceful shutdown)
// const cleanupIntervalId = setInterval(cleanupOldRequests, CLEANUP_INTERVAL);

/**
 * @description Maneja la recepción inicial de una solicitud de formulario POST.
 * Responde inmediatamente al cliente y dispara el procesamiento en segundo plano.
 * @route POST /api/form/submit
 */
exports.processForm = async (req, res, next) => { // Añadir next para pasar errores
  // Usar el requestId inyectado por el middleware en server.js si existe
  const controllerRequestId = req.requestId || 'temp-' + Date.now();
  try {
    console.log(`[${controllerRequestId}] ==== NUEVA SOLICITUD DE FORMULARIO ====`);
    // Evitar loguear todo el req.body si contiene datos sensibles
    console.log(`[${controllerRequestId}] Datos recibidos: ${req.body ? 'Presentes' : 'Ausentes'}`);
    console.log(`[${controllerRequestId}] IP (confiable): ${req.ip}`);
    console.log(`[${controllerRequestId}] Fecha y hora: ${new Date().toISOString()}`); // Último log que vimos antes

    // Generar ID único para esta solicitud específica de procesamiento
    const processingRequestId = uuidv4();
    console.log(`[${controllerRequestId}] ID de procesamiento generado: ${processingRequestId}`); // LOG NUEVO

    // Obtener datos del formulario y validar email
    const { nombre, email, ...formData } = req.body;
    const clientName = nombre || "Cliente";

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      console.warn(`[${controllerRequestId}] Solicitud rechazada (400): Email inválido o faltante.`);
      return res.status(400).json({
        success: false,
        message: "Se requiere una dirección de correo electrónico válida."
      });
    }
    console.log(`[${processingRequestId}] Email validado: ${email}`); // LOG NUEVO

    // Crear objeto de seguimiento inicial
    const requestData = {
      id: processingRequestId, // Usar el ID de procesamiento
      timestamp: new Date().toISOString(),
      clientName,
      email,
      formData, // Guardar los datos específicos del formulario
      status: 'pending',
      message: 'Solicitud recibida, en cola para procesamiento...'
    };
    console.log(`[${processingRequestId}] RequestData creado.`); // LOG NUEVO

    // Guardar en el almacén de pendientes
    requestsStore.pending.set(processingRequestId, requestData);
    console.log(`[${processingRequestId}] Guardado en pending store.`); // LOG NUEVO

    // Actualizar estadísticas
    statistics.totalSubmissions++;
    statistics.lastSubmissionTimestamp = requestData.timestamp;
    console.log(`[${processingRequestId}] Estadísticas actualizadas.`); // LOG NUEVO

    // Responder inmediatamente al cliente indicando que se está procesando
    console.log(`[${processingRequestId}] Enviando respuesta 202 Accepted...`); // LOG NUEVO
    res.status(202).json({ // Usar 202 Accepted
      success: true,
      message: "Formulario recibido. Tu rutina se está generando y se enviará a tu correo electrónico cuando esté lista.",
      requestId: processingRequestId, // Enviar el ID de procesamiento
      statusUrl: `/api/form/status/${processingRequestId}` // URL para consultar estado
    });
    console.log(`[${processingRequestId}] Respuesta 202 enviada a ${req.ip}.`); // LOG NUEVO

    // Disparar el procesamiento en segundo plano (sin await)
    console.log(`[${processingRequestId}] Programando processFormDataInBackground con setImmediate...`); // LOG NUEVO
    setImmediate(() => {
        // ----> LOG AL INICIO DE LA EJECUCIÓN ASÍNCRONA <----
        console.log(`[${processingRequestId}] setImmediate ejecutado: Iniciando processFormDataInBackground.`);
        // Llamar a la función de procesamiento y capturar cualquier error que lance
        processFormDataInBackground(requestData).catch(error => {
            console.error(`[${processingRequestId}] Error CAPTURADO en CATCH de setImmediate para processFormDataInBackground:`, error.message);
            // Loguear el stack si está disponible
            if (error.stack) {
                console.error(error.stack);
            }
            // Asegurarse de actualizar estado a fallido aquí también si es necesario
            // (Aunque processFormDataInBackground ya debería hacerlo en su propio catch)
            if (requestsStore.pending.has(processingRequestId)) {
                const failedData = requestsStore.pending.get(processingRequestId);
                failedData.status = 'failed';
                failedData.message = `Error interno (catch setImmediate): ${error.message || 'Error desconocido'}`;
                failedData.error = error.message || 'Error desconocido';
                failedData.failedAt = new Date().toISOString();
                requestsStore.failed.set(processingRequestId, failedData);
                requestsStore.pending.delete(processingRequestId);
                statistics.processingErrors++; // Contar como error de procesamiento
                console.log(`[${processingRequestId}] Estado actualizado a 'failed' desde CATCH de setImmediate.`);
            }
        });
    });
    console.log(`[${processingRequestId}] processFormDataInBackground programado. Fin de processForm.`); // LOG NUEVO

  } catch (error) {
    // Capturar errores síncronos en el propio controlador
    console.error(`[${controllerRequestId}] Error SÍNCRONO CAPTURADO en processForm:`, error);
    // Pasar al manejador de errores global definido en server.js
    next(error);
  }
};

/**
 * @description Verifica el estado de una solicitud de generación de rutina.
 * @route GET /api/form/status/:requestId
 */
exports.checkStatus = (req, res) => {
  const { requestId } = req.params;
    const controllerRequestId = req.requestId || requestId; // Usar ID de log si existe

  if (!requestId) {
    console.warn(`[${controllerRequestId}] Status Check rechazado (400): Falta requestId.`);
    return res.status(400).json({ success: false, message: "Falta el ID de la solicitud." });
  }

  // Buscar en todos los almacenes
  const requestData =
    requestsStore.pending.get(requestId) ||
    requestsStore.completed.get(requestId) ||
    requestsStore.failed.get(requestId);

  if (!requestData) {
    console.warn(`[${controllerRequestId}] Status Check (404): Solicitud ${requestId} no encontrada.`);
    return res.status(404).json({
      success: false,
      message: "Solicitud no encontrada o ya ha sido purgada."
    });
  }

  // Devolver estado actual (ofuscando datos sensibles)
  console.log(`[${controllerRequestId}] Status Check para ${requestId}: ${requestData.status}`);
  res.status(200).json({
    success: true,
    requestId: requestData.id,
    status: requestData.status,
    message: requestData.message,
    timestamp: requestData.timestamp,
    // Exponer solo información relevante y no sensible sobre el estado
    ...(requestData.status === 'failed' && { error: requestData.error }), // Mostrar error si falló
    ...(requestData.status === 'completed' && { completedAt: requestData.completedAt }) // Mostrar cuándo completó
  });
};

/**
 * @description Obtiene un resumen de las solicitudes (para posible dashboard de admin).
 * ¡PROTEGER ESTA RUTA EN PRODUCCIÓN!
 * @route GET /api/form/submissions
 */
exports.getSubmissions = (req, res) => {
    const controllerRequestId = req.requestId || 'admin-req';
  // !! AÑADIR AUTENTICACIÓN/AUTORIZACIÓN AQUÍ EN UN ENTORNO REAL !!
  // const ADMIN_KEY = process.env.ADMIN_API_KEY;
  // if (!ADMIN_KEY || req.query.key !== ADMIN_KEY) {
  //    console.warn(`[${controllerRequestId}] Intento de acceso no autorizado a /submissions desde ${req.ip}`);
  //    return res.status(403).json({ success: false, message: "Acceso denegado" });
  // }
    console.log(`[${controllerRequestId}] Acceso a /submissions permitido.`);

  try {
      // Función interna para mapear y ofuscar
      const mapRequestSummary = (item) => ({
          id: item.id,
          timestamp: item.timestamp,
          clientName: item.clientName,
          // Ofuscar email más seguro: a***@d***.com
          email: item.email ? item.email.replace(/^(.).*?@(.*?\.).*?(\.[^.]+)$/, '$1***@$2***$3') : 'N/A',
          status: item.status,
          ...(item.status === 'failed' && { error: item.error }),
          ...(item.status === 'completed' && { completedAt: item.completedAt }),
          ...(item.status === 'failed' && { failedAt: item.failedAt }),
      });

      // Ordenar por timestamp más reciente (considerando completedAt/failedAt si existen)
      const sortByRecent = (a, b) => {
        const dateA = new Date(a.completedAt || a.failedAt || a.timestamp);
        const dateB = new Date(b.completedAt || b.failedAt || b.timestamp);
        return dateB - dateA; // Descendente
      };

      const summary = {
          totals: {
              pending: requestsStore.pending.size,
              completed: requestsStore.completed.size,
              failed: requestsStore.failed.size,
              all: requestsStore.pending.size + requestsStore.completed.size + requestsStore.failed.size
          },
          statistics: {
            ...statistics,
              lastSubmissionTimestamp: statistics.lastSubmissionTimestamp
          },
          // Obtener una muestra (e.g., 20) de cada estado, ordenado
          recentPending: Array.from(requestsStore.pending.values()).sort(sortByRecent).slice(0, 20).map(mapRequestSummary),
          recentCompleted: Array.from(requestsStore.completed.values()).sort(sortByRecent).slice(0, 20).map(mapRequestSummary),
          recentFailed: Array.from(requestsStore.failed.values()).sort(sortByRecent).slice(0, 20).map(mapRequestSummary)
      };

      res.status(200).json({
          success: true,
          data: summary
      });
  } catch (error) {
      console.error(`[${controllerRequestId}] Error al obtener resumen de solicitudes:`, error);
      res.status(500).json({ success: false, message: "Error interno al obtener resumen." });
  }
};


/**
 * @description Función interna que realiza el procesamiento pesado de forma asíncrona.
 * Incluye generación de rutina, PDF y envío de email.
 * Maneja sus propios errores y actualiza el estado en `requestsStore`.
 * @param {object} requestData - El objeto que representa la solicitud pendiente.
 */
async function processFormDataInBackground(requestData) {
  // Extraer datos necesarios usando el ID guardado en requestData
  const { id: requestId, clientName, email, formData } = requestData;
  // ----> LOG AL INICIO DE LA FUNCIÓN <----
  console.log(`[${requestId}] DENTRO de processFormDataInBackground para ${clientName} (${email}).`);

  try {
    console.log(`[${requestId}] Paso 1: Formateando datos...`);
    requestData.status = 'processing'; // Actualizar estado
    requestData.message = 'Formateando datos para IA...';
    requestsStore.pending.set(requestId, requestData); // Actualizar en el store (opcional pero informativo)

    // Asegúrate de que FORM_FIELD_QUESTIONS está definido en algún lugar accesible
    // Si no lo está, necesitas definirlo aquí o importarlo
    const FORM_FIELD_QUESTIONS = require('../config/formQuestions'); // EJEMPLO: Asumiendo que está en config/formQuestions.js

    const routineInputData = formatFormDataToObjects(formData, FORM_FIELD_QUESTIONS); // Pasar FORM_FIELD_QUESTIONS

    if (!routineInputData || routineInputData.length === 0) {
        // Lanzar error si no hay datos formateados válidos
        throw new Error("No se pudieron formatear datos válidos del formulario para la IA.");
    }
    console.log(`[${requestId}] Datos formateados (${routineInputData.length} items).`);

    // --- Paso 2: Generar Rutina ---
    console.log(`[${requestId}] Paso 2: Llamando a generateRoutine...`);
    requestData.message = 'Generando rutina personalizada con IA...';
    requestsStore.pending.set(requestId, requestData);

    // La función generateRoutine ahora debería manejar su propio timeout interno
    const routineHtml = await generateRoutine(routineInputData); // No necesitamos Promise.race aquí
    console.log(`[${requestId}] Rutina HTML recibida de generateRoutine.`);

    // --- Paso 3: Generar PDF ---
    console.log(`[${requestId}] Paso 3: Creando PDF...`);
    requestData.message = 'Rutina generada, creando documento PDF...';
    requestsStore.pending.set(requestId, requestData);

    const tempDir = process.env.TEMP_DIR || path.join(__dirname, '../temp');
    // Asegurarse de que el directorio exista de forma síncrona antes de usarlo
    try {
      if (!fs.existsSync(tempDir)) {
        console.log(`[${requestId}] Creando directorio temporal: ${tempDir}`);
        fs.mkdirSync(tempDir, { recursive: true });
      }
    } catch (dirError) {
        console.error(`[${requestId}] Error creando directorio temporal ${tempDir}:`, dirError);
        throw new Error(`No se pudo crear el directorio temporal para el PDF: ${dirError.message}`);
    }

    const pdfPath = await generatePDF(routineHtml, clientName, tempDir, requestId);
    console.log(`[${requestId}] PDF generado en: ${pdfPath}`);

    // --- Paso 4: Enviar Email ---
    console.log(`[${requestId}] Paso 4: Enviando email a ${email}...`);
    requestData.message = 'Documento PDF creado, enviando por email...';
    requestsStore.pending.set(requestId, requestData);

    await sendEmail(email, clientName, pdfPath, requestId);
    console.log(`[${requestId}] Email enviado exitosamente.`);

    // --- Paso 5: Finalización Exitosa ---
    requestData.status = 'completed';
    requestData.message = '¡Rutina generada y enviada a tu correo!';
    requestData.completedAt = new Date().toISOString();
    statistics.successfulRoutines++;

    // Mover de pending a completed
    requestsStore.completed.set(requestId, requestData);
    requestsStore.pending.delete(requestId); // Eliminar de pendientes
    console.log(`[${requestId}] Procesamiento completado exitosamente.`);

    // Limpieza del PDF temporal (con manejo de errores)
    if (pdfPath) {
        setTimeout(() => {
            fs.unlink(pdfPath, (err) => {
                if (err) {
                    console.error(`[${requestId}] Error eliminando PDF temporal ${pdfPath}:`, err);
                } else {
                    console.log(`[${requestId}] PDF temporal eliminado: ${path.basename(pdfPath)}`);
                }
            });
        }, 60000); // Intentar borrar después de 1 minuto
    }

  } catch (error) {
    // --- Manejo Centralizado de Errores en Background ---
    console.error(`[${requestId}] ERROR durante el procesamiento para ${email}:`, error.message);
    if (error.stack) {
        console.error(error.stack); // Loguear stacktrace completo para debug
    }

    requestData.status = 'failed';
    requestData.message = `Error al generar la rutina: ${error.message || 'Error desconocido'}`;
    requestData.error = error.message || 'Error desconocido';
    requestData.failedAt = new Date().toISOString();
    statistics.failedRoutines++; // Incrementar fallos de rutina específicamente
    statistics.processingErrors++; // También contar como error general de procesamiento

    // Mover de pending a failed (asegurarse que no esté ya en failed por el catch de setImmediate)
    if (requestsStore.pending.has(requestId)) {
        requestsStore.failed.set(requestId, requestData);
        requestsStore.pending.delete(requestId);
        console.log(`[${requestId}] Procesamiento movido a estado 'failed' desde catch interno.`);
    } else {
        // Si ya no está en pending, quizás el catch externo ya lo movió, actualizarlo
        if (requestsStore.failed.has(requestId)) {
            requestsStore.failed.set(requestId, requestData); // Actualizar con detalles del error interno
            console.log(`[${requestId}] Estado 'failed' actualizado con detalles del error interno.`);
        } else {
            console.error(`[${requestId}] Error: La solicitud no se encontró en pending ni failed después de un error interno.`);
            // Guardarlo en failed igualmente para registro
            requestsStore.failed.set(requestId, requestData);
        }
    }

    // Importante: No relanzar el error aquí para que no lo capture el catch de setImmediate de nuevo.
    // El estado ya está actualizado a 'failed'.
  }
}


/**
 * @description Función interna: Convierte los datos del formulario (objeto clave-valor)
 * al formato de array de objetos [{ question, answer, field }]
 * esperado por el servicio de OpenAI.
 * @param {Object} formData - Objeto con los datos clave-valor del formulario.
 * @param {Array<object>} formFieldQuestions - Array con el mapeo {id, text}.
 * @returns {Array<object>} - Array de objetos formateados o array vacío si hay error.
 */
function formatFormDataToObjects(formData, formFieldQuestions) { // Añadido formFieldQuestions como parámetro
    if (typeof formData !== 'object' || formData === null) {
        console.error("formatFormDataToObjects recibió datos no válidos:", formData);
        return [];
    }

    // Usar el formFieldQuestions pasado como argumento
    const questionMap = {};
    if (Array.isArray(formFieldQuestions)) {
        formFieldQuestions.forEach(q => {
            if (q.id && q.text) { // Asegurarse de que ambos existan
              questionMap[q.id] = q.text;
            }
        });
    } else {
        console.error("formatFormDataToObjects: formFieldQuestions no es un array válido.");
        return []; // Retornar vacío si el mapeo no es válido
    }


    const responses = [];

    Object.entries(formData).forEach(([fieldName, value]) => {
      const questionText = questionMap[fieldName];
      // Limpiar valor asegurándose de que sea string
      const trimmedValue = String(value || '').trim();

      if (questionText && trimmedValue !== '') {
        responses.push({
          question: questionText,
          answer: trimmedValue,
          field: fieldName
        });
      } else if (trimmedValue !== '' && fieldName !== 'nombre' && fieldName !== 'email') { // Ignorar nombre/email si no tienen mapeo
          // Loguear campos desconocidos con valor
          console.warn(`Campo no mapeado/desconocido con valor recibido: '${fieldName}' = '${trimmedValue}'`);
          // Podrías decidir incluirlos o no. Por ahora los omitimos.
          // responses.push({ question: `Campo (${fieldName})`, answer: trimmedValue, field: fieldName });
      }
    });

    if (responses.length < 5) {
      console.warn(`formatFormDataToObjects: Pocas respuestas significativas (<5) formateadas para la IA (${responses.length} encontradas).`);
    }

    console.log(`[formatFormDataToObjects] Formateadas ${responses.length} respuestas.`);
    return responses;
}

// NO ES NECESARIO EL BLOQUE module.exports = { ... } AQUÍ ABAJO
// LAS FUNCIONES YA SE EXPORTARON CON exports.nombreFuncion = ...