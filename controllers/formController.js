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
    console.log(`[${controllerRequestId}] Datos recibidos: ${req.body ? 'Presentes' : 'Ausentes'}`);

    // ----> SECCIÓN DE LOGGING MODIFICADA (FIX APLICADO) <----
    console.log(`[${controllerRequestId}] Verificando propiedades esperadas en req.body...`);
    try {
        // Usa optional chaining (?.) por si req.body no fuera un objeto
        console.log(`[${controllerRequestId}] req.body.nombre:`, req.body?.nombre);
        console.log(`[${controllerRequestId}] req.body.email:`, req.body?.email);
        // Loguear todas las claves puede ser útil y es más seguro que loguear el objeto entero
        console.log(`[${controllerRequestId}] Claves en req.body:`, req.body ? Object.keys(req.body) : 'N/A');
        console.log(`[${controllerRequestId}] Tipo de req.body:`, typeof req.body); // Mantener este log
    } catch (logError) {
        // Captura errores que pudieran ocurrir al intentar acceder/loguear propiedades
        console.error(`[${controllerRequestId}] Error al intentar loguear propiedades de req.body:`, logError);
    }
    // ----> FIN DE LA SECCIÓN MODIFICADA <----

    console.log(`[${controllerRequestId}] IP (confiable): ${req.ip}`);
    console.log(`[${controllerRequestId}] Fecha y hora: ${new Date().toISOString()}`);

    const processingRequestId = uuidv4();
    console.log(`[${controllerRequestId}] ID de procesamiento generado: ${processingRequestId}`);

    let email, clientName, formData; // Declarar variables fuera del try específico

    try {
      // ---> INICIO TRY ESPECÍFICO PARA DESESTRUCTURACIÓN Y VALIDACIÓN INICIAL <---
      console.log(`[${controllerRequestId}] Intentando desestructurar req.body...`);
      // Desestructurar aquí dentro
      // Asegurarse de que req.body sea un objeto antes de desestructurar
      if (typeof req.body !== 'object' || req.body === null) {
          throw new Error('El cuerpo de la solicitud (req.body) no es un objeto válido.');
      }
      const { nombre, email: extractedEmail, ...extractedFormData } = req.body;
      email = extractedEmail; // Asignar a la variable externa
      formData = extractedFormData; // Asignar a la variable externa
      console.log(`[${controllerRequestId}] Desestructuración preliminar EXITOSA.`);

      clientName = nombre || "Cliente"; // Asignar clientName

      console.log(`[${controllerRequestId}] Validando email: ${email}`);
      if (!email || typeof email !== 'string' || !email.includes('@')) {
        console.warn(`[${controllerRequestId}] Solicitud rechazada (400): Email inválido o faltante.`);
        // Lanzar error para que lo capture el catch de este bloque try específico
        throw new Error("Se requiere una dirección de correo electrónico válida.");
      }
      console.log(`[${processingRequestId}] Email validado correctamente: ${email}`);
      // ---> FIN TRY ESPECÍFICO <---

    } catch (validationError) {
      console.error(`[${controllerRequestId}] ¡ERROR en validación inicial o desestructuración!:`, validationError.message);
      // Devolver respuesta 400 directamente o pasar al manejador global
      return res.status(400).json({
        success: false,
        message: validationError.message || "Datos de formulario inválidos."
      });
    }

    // --- Si llegamos aquí, la desestructuración y validación básica del email fueron exitosas ---

    // Crear objeto de seguimiento inicial
    const requestData = {
      id: processingRequestId, // Usar el ID de procesamiento
      timestamp: new Date().toISOString(),
      clientName,
      email, // Usar la variable ya validada
      formData, // Usar la variable ya extraída
      status: 'pending',
      message: 'Solicitud recibida, en cola para procesamiento...'
    };
    console.log(`[${processingRequestId}] RequestData creado.`);

    // Guardar en el almacén de pendientes
    requestsStore.pending.set(processingRequestId, requestData);
    console.log(`[${processingRequestId}] Guardado en pending store.`);

    // Actualizar estadísticas
    statistics.totalSubmissions++;
    statistics.lastSubmissionTimestamp = requestData.timestamp;
    console.log(`[${processingRequestId}] Estadísticas actualizadas.`);

    // Responder inmediatamente al cliente indicando que se está procesando
    console.log(`[${processingRequestId}] Enviando respuesta 202 Accepted...`);
    res.status(202).json({ // Usar 202 Accepted
      success: true,
      message: "Formulario recibido. Tu rutina se está generando y se enviará a tu correo electrónico cuando esté lista.",
      requestId: processingRequestId, // Enviar el ID de procesamiento
      statusUrl: `/api/form/status/${processingRequestId}` // URL para consultar estado
    });
    console.log(`[${processingRequestId}] Respuesta 202 enviada a ${req.ip}.`);

    // Disparar el procesamiento en segundo plano (sin await)
    console.log(`[${processingRequestId}] Programando processFormDataInBackground con setImmediate...`);
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
    console.log(`[${processingRequestId}] processFormDataInBackground programado. Fin de processForm.`);

  } catch (error) {
    // Capturar errores síncronos generales (los que no capturó el try específico)
    console.error(`[${controllerRequestId}] Error SÍNCRONO GENERAL CAPTURADO en processForm:`, error);
    // Pasar al manejador de errores global definido en server.js
    // Asegúrate de que no se haya enviado ya una respuesta
    if (!res.headersSent) {
        next(error); // Llama a next solo si no se ha enviado respuesta
    } else {
        console.error(`[${controllerRequestId}] Error ocurrido DESPUÉS de enviar la respuesta inicial.`);
    }
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
    // Actualizar en el store (asegurarse que sigue en pending)
    if(requestsStore.pending.has(requestId)) {
        requestsStore.pending.set(requestId, requestData);
    } else {
        console.warn(`[${requestId}] Intento de actualizar estado a 'processing', pero ya no estaba en 'pending'.`);
        // Podrías decidir detener el proceso aquí si ya no está pendiente
        // return;
    }


    // Asegúrate de que FORM_FIELD_QUESTIONS está definido en algún lugar accesible
    // ¡¡ASEGÚRATE DE QUE ESTA RUTA Y ARCHIVO SEAN CORRECTOS!!
    const FORM_FIELD_QUESTIONS = require('../config/formQuestions');

    const routineInputData = formatFormDataToObjects(formData, FORM_FIELD_QUESTIONS); // Pasar FORM_FIELD_QUESTIONS

    if (!routineInputData || routineInputData.length === 0) {
        throw new Error("No se pudieron formatear datos válidos del formulario para la IA.");
    }
    console.log(`[${requestId}] Datos formateados (${routineInputData.length} items).`);

    // --- Paso 2: Generar Rutina ---
    console.log(`[${requestId}] Paso 2: Llamando a generateRoutine...`);
    requestData.message = 'Generando rutina personalizada con IA...';
    if(requestsStore.pending.has(requestId)) requestsStore.pending.set(requestId, requestData); // Actualizar estado

    const routineHtml = await generateRoutine(routineInputData);
    console.log(`[${requestId}] Rutina HTML recibida de generateRoutine.`);

    // --- Paso 3: Generar PDF ---
    console.log(`[${requestId}] Paso 3: Creando PDF...`);
    requestData.message = 'Rutina generada, creando documento PDF...';
    if(requestsStore.pending.has(requestId)) requestsStore.pending.set(requestId, requestData); // Actualizar estado

    const tempDir = process.env.TEMP_DIR || path.join(__dirname, '../temp');
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
    if(requestsStore.pending.has(requestId)) requestsStore.pending.set(requestId, requestData); // Actualizar estado

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
    console.error(`[${requestId}] ERROR durante el procesamiento en background para ${email}:`, error.message);
    if (error.stack) {
        console.error(error.stack); // Loguear stacktrace completo para debug
    }

    // Asegurarse de que requestData exista antes de modificarlo
    if (requestData) {
        requestData.status = 'failed';
        requestData.message = `Error al generar la rutina: ${error.message || 'Error desconocido'}`;
        requestData.error = error.message || 'Error desconocido';
        requestData.failedAt = new Date().toISOString();

        // Mover de pending a failed (asegurarse que no esté ya en failed por el catch de setImmediate)
        if (requestsStore.pending.has(requestId)) {
            requestsStore.failed.set(requestId, requestData);
            requestsStore.pending.delete(requestId);
            console.log(`[${requestId}] Procesamiento movido a estado 'failed' desde catch interno de background.`);
        } else {
            // Si ya no está en pending, quizás el catch externo ya lo movió, actualizarlo si existe en failed
            if (requestsStore.failed.has(requestId)) {
                // Actualizar el registro fallido existente con los detalles de este error
                const existingFailedData = requestsStore.failed.get(requestId);
                existingFailedData.message += ` | Error interno background: ${error.message || 'Error desconocido'}`;
                existingFailedData.error = error.message || 'Error desconocido';
                existingFailedData.failedAt = new Date().toISOString(); // Actualizar timestamp del último error
                requestsStore.failed.set(requestId, existingFailedData);
                console.log(`[${requestId}] Estado 'failed' existente actualizado con detalles del error interno de background.`);
            } else {
                console.error(`[${requestId}] Error CRÍTICO: La solicitud no se encontró en pending ni failed después de un error interno de background.`);
                // Guardarlo en failed igualmente para registro, aunque sea redundante con el posible estado del catch externo
                 requestsStore.failed.set(requestId, requestData);
            }
        }
         // Actualizar estadísticas de error (fuera del if/else para que se haga siempre que haya error)
        statistics.failedRoutines++; // Incrementar fallos de rutina específicamente
        statistics.processingErrors++; // También contar como error general de procesamiento
    } else {
         console.error(`[${requestId}] Error CRÍTICO: requestData es null/undefined en el catch de processFormDataInBackground.`);
         // Incrementar error general aunque no tengamos datos de la solicitud
         statistics.processingErrors++;
    }
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
function formatFormDataToObjects(formData, formFieldQuestions) {
    if (typeof formData !== 'object' || formData === null) {
        console.error("formatFormDataToObjects recibió datos no válidos (formData):", formData);
        return [];
    }

    const questionMap = {};
    if (!Array.isArray(formFieldQuestions)) {
         console.error("formatFormDataToObjects recibió datos no válidos (formFieldQuestions no es array):", formFieldQuestions);
         return []; // Retornar vacío si el mapeo no es válido
    }

    formFieldQuestions.forEach(q => {
        if (q.id && q.text) { // Asegurarse de que ambos existan
            questionMap[q.id] = q.text;
        }
    });

    const responses = [];
    Object.entries(formData).forEach(([fieldName, value]) => {
      const questionText = questionMap[fieldName];
      const trimmedValue = String(value || '').trim();

      if (questionText && trimmedValue !== '') {
        responses.push({
          question: questionText,
          answer: trimmedValue,
          field: fieldName
        });
      } else if (trimmedValue !== '' && fieldName !== 'nombre' && fieldName !== 'email') {
          console.warn(`Campo no mapeado/desconocido con valor recibido: '${fieldName}' = '${trimmedValue}'`);
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