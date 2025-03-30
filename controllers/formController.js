/**
 * backend-api/controllers/formController.js
 * Controlador principal para el procesamiento de formularios con manejo de estado asíncrono.
 */

// Importar servicios y utilidades
const { generateRoutine } = require('../services/openaiService'); // Correcto
const { sendEmail } = require('../services/emailService');     // Correcto
const { generatePDF } = require('../services/pdfService');     // Correcto
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const fsPromises = fs.promises; // Usar promesas de fs para operaciones async

// Almacén en memoria para peticiones
const requestsStore = {
  pending: new Map(),
  completed: new Map(),
  failed: new Map()
};

// Estadísticas básicas
const statistics = {
  totalSubmissions: 0,
  successfulRoutines: 0,
  failedRoutines: 0,
  processingErrors: 0,
  lastSubmissionTimestamp: null
};

// ---- YA NO SE NECESITA FORM_FIELD_QUESTIONS AQUÍ ----

// Limpieza periódica (opcional)
const CLEANUP_INTERVAL = 60 * 60 * 1000;
const MAX_AGE_COMPLETED = 24 * 60 * 60 * 1000;
const MAX_AGE_FAILED = 7 * 24 * 60 * 60 * 1000;

function cleanupOldRequests() {
    const now = Date.now();
    let completedDeleted = 0;
    requestsStore.completed.forEach((data, id) => {
        if (now - new Date(data.completedAt || data.timestamp).getTime() > MAX_AGE_COMPLETED) {
            requestsStore.completed.delete(id);
            completedDeleted++;
        }
    });
    // if (completedDeleted > 0) console.log(`[Cleanup] Eliminadas ${completedDeleted} solicitudes completadas antiguas.`);

    let failedDeleted = 0;
    requestsStore.failed.forEach((data, id) => {
        if (now - new Date(data.failedAt || data.timestamp).getTime() > MAX_AGE_FAILED) {
            requestsStore.failed.delete(id);
            failedDeleted++;
        }
    });
    // if (failedDeleted > 0) console.log(`[Cleanup] Eliminadas ${failedDeleted} solicitudes fallidas antiguas.`);
}
// const cleanupIntervalId = setInterval(cleanupOldRequests, CLEANUP_INTERVAL);

/**
 * @description Maneja la recepción inicial de una solicitud de formulario POST.
 */
exports.processForm = async (req, res, next) => {
  const controllerRequestId = req.requestId || 'temp-' + Date.now();
  try {
    console.log(`[${controllerRequestId}] ==== NUEVA SOLICITUD DE FORMULARIO ====`);
    console.log(`[${controllerRequestId}] Datos recibidos: ${req.body ? 'Presentes' : 'Ausentes'}`);

    // Logueo seguro de propiedades recibidas
    console.log(`[${controllerRequestId}] Verificando propiedades esperadas en req.body...`);
    try {
        console.log(`[${controllerRequestId}] req.body.nombre:`, req.body?.nombre);
        console.log(`[${controllerRequestId}] req.body.email:`, req.body?.email);
        console.log(`[${controllerRequestId}] Claves en req.body:`, req.body ? Object.keys(req.body) : 'N/A');
        console.log(`[${controllerRequestId}] Tipo de req.body:`, typeof req.body);
    } catch (logError) {
        console.error(`[${controllerRequestId}] Error al intentar loguear propiedades de req.body:`, logError);
    }

    console.log(`[${controllerRequestId}] IP (confiable): ${req.ip}`);
    console.log(`[${controllerRequestId}] Fecha y hora: ${new Date().toISOString()}`);

    const processingRequestId = uuidv4();
    console.log(`[${controllerRequestId}] ID de procesamiento generado: ${processingRequestId}`);

    let email, clientName, formData;

    // Validación inicial y desestructuración
    try {
      console.log(`[${controllerRequestId}] Intentando desestructurar req.body...`);
      if (typeof req.body !== 'object' || req.body === null) {
          throw new Error('El cuerpo de la solicitud (req.body) no es un objeto válido.');
      }
      // Extraer nombre y email, el resto es formData
      const { nombre, email: extractedEmail, ...extractedFormData } = req.body;
      email = extractedEmail;
      formData = extractedFormData; // Este es el objeto que pasaremos a generateRoutine
      console.log(`[${controllerRequestId}] Desestructuración preliminar EXITOSA.`);
      clientName = nombre || "Cliente"; // Usar nombre si existe, sino 'Cliente'

      console.log(`[${controllerRequestId}] Validando email: ${email}`);
      if (!email || typeof email !== 'string' || !email.includes('@')) {
        console.warn(`[${controllerRequestId}] Solicitud rechazada (400): Email inválido o faltante.`);
        throw new Error("Se requiere una dirección de correo electrónico válida.");
      }
      console.log(`[${processingRequestId}] Email validado correctamente: ${email}`);

    } catch (validationError) {
      console.error(`[${controllerRequestId}] ¡ERROR en validación inicial o desestructuración!:`, validationError.message);
      return res.status(400).json({
        success: false,
        message: validationError.message || "Datos de formulario inválidos."
      });
    }

    // Crear objeto de seguimiento
    const requestData = {
      id: processingRequestId,
      timestamp: new Date().toISOString(),
      clientName,
      email,
      formData, // Guardamos el objeto formData crudo
      status: 'pending',
      message: 'Solicitud recibida, en cola para procesamiento...'
    };
    console.log(`[${processingRequestId}] RequestData creado.`);

    requestsStore.pending.set(processingRequestId, requestData);
    console.log(`[${processingRequestId}] Guardado en pending store.`);

    statistics.totalSubmissions++;
    statistics.lastSubmissionTimestamp = requestData.timestamp;
    console.log(`[${processingRequestId}] Estadísticas actualizadas.`);

    // Responder al cliente
    console.log(`[${processingRequestId}] Enviando respuesta 202 Accepted...`);
    res.status(202).json({
      success: true,
      message: "Formulario recibido. Tu rutina se está generando y se enviará a tu correo electrónico cuando esté lista.",
      requestId: processingRequestId,
      statusUrl: `/api/form/status/${processingRequestId}`
    });
    console.log(`[${processingRequestId}] Respuesta 202 enviada a ${req.ip}.`);

    // Iniciar proceso en segundo plano
    console.log(`[${processingRequestId}] Programando processFormDataInBackground con setImmediate...`);
    setImmediate(() => {
        console.log(`[${processingRequestId}] setImmediate ejecutado: Iniciando processFormDataInBackground.`);
        processFormDataInBackground(requestData).catch(error => {
            console.error(`[${processingRequestId}] Error FATAL CAPTURADO en CATCH de setImmediate para processFormDataInBackground:`, error.message);
            if (error.stack) console.error("Stack Trace (setImmediate catch):", error.stack);
            if (requestsStore.pending.has(processingRequestId)) {
                const failedData = requestsStore.pending.get(processingRequestId);
                failedData.status = 'failed';
                failedData.message = `Error interno fatal (catch setImmediate): ${error.message || 'Error desconocido'}`;
                failedData.error = error.message || 'Error desconocido';
                failedData.failedAt = new Date().toISOString();
                requestsStore.failed.set(processingRequestId, failedData);
                requestsStore.pending.delete(processingRequestId);
                statistics.processingErrors++;
                console.log(`[${processingRequestId}] Estado actualizado a 'failed' desde CATCH de setImmediate.`);
            }
        });
    });
    console.log(`[${processingRequestId}] processFormDataInBackground programado. Fin de processForm.`);

  } catch (error) {
    console.error(`[${controllerRequestId}] Error SÍNCRONO GENERAL CAPTURADO en processForm:`, error);
    if (!res.headersSent) {
        next(error);
    } else {
        console.error(`[${controllerRequestId}] Error ocurrido DESPUÉS de enviar la respuesta inicial.`);
    }
  }
};

/**
 * @description Verifica el estado de una solicitud de generación de rutina.
 */
exports.checkStatus = (req, res, next) => {
  const { requestId } = req.params;
  const controllerRequestId = req.requestId || requestId;
  try {
      if (!requestId) {
          console.warn(`[${controllerRequestId}] Status Check rechazado (400): Falta requestId.`);
          return res.status(400).json({ success: false, message: "Falta el ID de la solicitud." });
      }
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
      console.log(`[${controllerRequestId}] Status Check para ${requestId}: ${requestData.status}`);
      res.status(200).json({
          success: true,
          requestId: requestData.id,
          status: requestData.status,
          message: requestData.message,
          timestamp: requestData.timestamp,
          ...(requestData.status === 'failed' && { error: requestData.error }),
          ...(requestData.status === 'completed' && { completedAt: requestData.completedAt })
      });
  } catch(error) {
      console.error(`[${controllerRequestId}] Error en checkStatus:`, error);
      next(error);
  }
};

/**
 * @description Obtiene un resumen de las solicitudes (para posible dashboard de admin).
 */
exports.getSubmissions = (req, res, next) => {
    const controllerRequestId = req.requestId || 'admin-req';
    console.log(`[${controllerRequestId}] Acceso a /submissions permitido (¡PROTEGER EN PRODUCCIÓN!).`);
  try {
      const mapRequestSummary = (item) => ({
          id: item.id,
          timestamp: item.timestamp,
          clientName: item.clientName,
          email: item.email ? item.email.replace(/^(.).*?@(.*?\.).*?(\.[^.]+)$/, '$1***@$2***$3') : 'N/A',
          status: item.status,
          ...(item.status === 'failed' && { error: item.error }),
          ...(item.status === 'completed' && { completedAt: item.completedAt }),
          ...(item.status === 'failed' && { failedAt: item.failedAt }),
      });
      const sortByRecent = (a, b) => {
        const dateA = new Date(a.completedAt || a.failedAt || a.timestamp);
        const dateB = new Date(b.completedAt || b.failedAt || b.timestamp);
        return dateB - dateA;
      };
      const summary = {
          totals: {
              pending: requestsStore.pending.size,
              completed: requestsStore.completed.size,
              failed: requestsStore.failed.size,
              all: requestsStore.pending.size + requestsStore.completed.size + requestsStore.failed.size
          },
          statistics: { ...statistics },
          recentPending: Array.from(requestsStore.pending.values()).sort(sortByRecent).slice(0, 20).map(mapRequestSummary),
          recentCompleted: Array.from(requestsStore.completed.values()).sort(sortByRecent).slice(0, 20).map(mapRequestSummary),
          recentFailed: Array.from(requestsStore.failed.values()).sort(sortByRecent).slice(0, 20).map(mapRequestSummary)
      };
      res.status(200).json({ success: true, data: summary });
  } catch (error) {
      console.error(`[${controllerRequestId}] Error al obtener resumen de solicitudes:`, error);
      next(error);
  }
};


/**
 * @description Función interna que realiza el procesamiento pesado de forma asíncrona.
 */
async function processFormDataInBackground(requestData) {
  // Validación inicial de requestData
   console.log(`[DEBUG] processFormDataInBackground: Entrando. ID preliminar: ${requestData?.id}`);
   if (!requestData || typeof requestData !== 'object' || !requestData.id || !requestData.email || typeof requestData.formData !== 'object') {
       console.error("[ERROR_CRITICO] processFormDataInBackground: requestData inválido o incompleto al inicio.", {
           has_id: !!requestData?.id,
           has_email: !!requestData?.email,
           formData_type: typeof requestData?.formData
       });
       statistics.processingErrors++;
       return; // Salir
   }

  // Desestructuración
  const { id: requestId, clientName, email, formData } = requestData; // formData es el objeto con los campos
  console.log(`[${requestId}] DENTRO de processFormDataInBackground para ${clientName} (${email}).`);

  try {
    // Actualizar estado a 'processing'
    console.log(`[${requestId}] Iniciando procesamiento, actualizando estado...`);
    requestData.status = 'processing';
    requestData.message = 'Generando rutina personalizada con IA...'; // Mensaje más genérico al inicio
    if(requestsStore.pending.has(requestId)) {
        requestsStore.pending.set(requestId, requestData);
    } else {
        console.warn(`[${requestId}] processFormDataInBackground: No se encontró en 'pending' al actualizar a 'processing'.`);
        // No necesariamente salir, podría haber sido movido a failed por un error anterior no fatal
    }

    // ---- PASO 1: LLAMAR A generateRoutine (que ahora maneja el formato interno) ----
    console.log(`[${requestId}] Paso 1: Llamando a generateRoutine (OpenAI Service)...`);
    // Pasar el objeto formData directamente
    const routineHtml = await generateRoutine(formData); // generateRoutine usa su FORM_FIELD_QUESTIONS interno
     if (!routineHtml || typeof routineHtml !== 'string' || routineHtml.trim() === '') {
        console.error(`[${requestId}] generateRoutine devolvió un resultado inválido o vacío.`);
        throw new Error("La generación de la rutina no produjo un resultado válido.");
    }
    console.log(`[${requestId}] Rutina HTML recibida (longitud: ${routineHtml.length}).`);

    // --- PASO 2: Generar PDF ---
    console.log(`[${requestId}] Paso 2: Creando PDF...`);
    requestData.message = 'Rutina generada, creando documento PDF...';
    if(requestsStore.pending.has(requestId)) requestsStore.pending.set(requestId, requestData);

    const tempDir = process.env.TEMP_DIR || path.join(__dirname, '../temp');
    try {
      await fsPromises.mkdir(tempDir, { recursive: true });
      console.log(`[${requestId}] Directorio temporal asegurado: ${tempDir}`);
    } catch (dirError) {
        if (dirError.code !== 'EEXIST') {
            console.error(`[${requestId}] Error creando directorio temporal ${tempDir}:`, dirError);
            throw new Error(`No se pudo crear el directorio temporal para el PDF: ${dirError.message}`);
        } else {
             console.log(`[${requestId}] Directorio temporal ya existía: ${tempDir}`);
        }
    }

    const pdfPath = await generatePDF(routineHtml, clientName, tempDir, requestId);
     if (!pdfPath || typeof pdfPath !== 'string') {
         console.error(`[${requestId}] generatePDF no devolvió una ruta válida.`);
         throw new Error("Error interno al generar el documento PDF.");
     }
    console.log(`[${requestId}] PDF generado en: ${pdfPath}`);

    // --- PASO 3: Enviar Email ---
    console.log(`[${requestId}] Paso 3: Enviando email a ${email}...`);
    requestData.message = 'Documento PDF creado, enviando por email...';
    if(requestsStore.pending.has(requestId)) requestsStore.pending.set(requestId, requestData);

    // Pasar clientName a sendEmail (ya se hacía antes)
    await sendEmail(email, clientName, pdfPath, requestId);
    console.log(`[${requestId}] Llamada a sendEmail completada.`); // EmailService logueará éxito/error

    // --- PASO 4: Finalización Exitosa ---
    console.log(`[${requestId}] Paso 4: Marcando como completado...`);
    requestData.status = 'completed';
    requestData.message = '¡Rutina generada y enviada a tu correo!';
    requestData.completedAt = new Date().toISOString();
    statistics.successfulRoutines++;

    requestsStore.completed.set(requestId, requestData);
    if (requestsStore.pending.has(requestId)) requestsStore.pending.delete(requestId);
    console.log(`[${requestId}] Procesamiento completado exitosamente.`);

    // Limpieza del PDF (async no bloqueante)
    if (pdfPath) {
        fsPromises.unlink(pdfPath)
            .then(() => console.log(`[${requestId}] PDF temporal eliminado ASYNC: ${path.basename(pdfPath)}`))
            .catch(unlinkErr => console.error(`[${requestId}] Error eliminando PDF temporal ASYNC ${pdfPath}:`, unlinkErr));
    }

  } catch (error) {
    // --- Manejo Centralizado de Errores en Background ---
    console.error(`[${requestId}] ERROR CAPTURADO en processFormDataInBackground para ${email}:`, error.message);
    if (error.stack) console.error(`[${requestId}] Stack Trace del error en background:`, error.stack);

    if (requestData && requestId) {
        requestData.status = 'failed';
        requestData.message = `Error al generar la rutina: ${error.message || 'Error desconocido'}`;
        requestData.error = error.message || 'Error desconocido';
        requestData.failedAt = new Date().toISOString();

        if (requestsStore.pending.has(requestId)) {
            requestsStore.failed.set(requestId, requestData);
            requestsStore.pending.delete(requestId);
            console.log(`[${requestId}] Procesamiento movido a estado 'failed' desde catch interno de background.`);
        } else {
            if (requestsStore.failed.has(requestId)) {
                const existingFailedData = requestsStore.failed.get(requestId);
                existingFailedData.message += ` | Error posterior: ${error.message || 'Error desconocido'}`;
                existingFailedData.error = error.message || 'Error desconocido';
                existingFailedData.failedAt = new Date().toISOString();
                requestsStore.failed.set(requestId, existingFailedData);
                console.log(`[${requestId}] Estado 'failed' existente actualizado con detalles del error posterior.`);
            } else {
                console.warn(`[${requestId}] Solicitud no encontrada en pending/failed al manejar error. Guardando en failed.`);
                requestsStore.failed.set(requestId, requestData);
            }
        }
        statistics.failedRoutines++;
        statistics.processingErrors++;
    } else {
         console.error(`[ERROR_CRITICO] requestData o requestId inválido en CATCH de processFormDataInBackground.`);
         statistics.processingErrors++;
    }
  }
}

// ---- YA NO SE NECESITA LA FUNCIÓN formatFormDataToObjects AQUÍ ----

// NO ES NECESARIO EL BLOQUE module.exports = { ... } AL FINAL