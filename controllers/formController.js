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
// Guardará el estado de cada solicitud (pending, completed, failed)
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
    console.log(`[${new Date().toISOString()}] Ejecutando limpieza de solicitudes antiguas...`);

    requestsStore.completed.forEach((data, id) => {
        if (now - new Date(data.completedAt || data.timestamp).getTime() > MAX_AGE_COMPLETED) {
            console.log(`Eliminando solicitud completada antigua: ${id}`);
            requestsStore.completed.delete(id);
        }
    });

    requestsStore.failed.forEach((data, id) => {
         if (now - new Date(data.failedAt || data.timestamp).getTime() > MAX_AGE_FAILED) {
            console.log(`Eliminando solicitud fallida antigua: ${id}`);
            requestsStore.failed.delete(id);
        }
    });
}
setInterval(cleanupOldRequests, CLEANUP_INTERVAL);

/**
 * @description Maneja la recepción inicial de una solicitud de formulario POST.
 * Responde inmediatamente al cliente y dispara el procesamiento en segundo plano.
 * @route POST /api/form/submit
 */
exports.processForm = async (req, res, next) => { // Añadir next para pasar errores
  try {
    console.log(`[${req.requestId || 'N/A'}] ==== NUEVA SOLICITUD DE FORMULARIO ====`);
    console.log(`[${req.requestId || 'N/A'}] Datos recibidos:`, req.body ? 'Presentes' : 'Ausentes'); // Evitar loguear datos sensibles directamente
    console.log(`[${req.requestId || 'N/A'}] IP (confiable): ${req.ip}`); // req.ip es fiable si 'trust proxy' está bien configurado
    console.log(`[${req.requestId || 'N/A'}] Fecha y hora:`, new Date().toISOString());

    // Generar ID único para esta solicitud
    const requestId = uuidv4();

    // Obtener datos del formulario y validar email
    const { nombre, email, ...formData } = req.body;
    const clientName = nombre || "Cliente"; // Nombre por defecto si no se proporciona

    if (!email || typeof email !== 'string' || !email.includes('@')) { // Validación básica de email
       console.warn(`[${req.requestId || 'N/A'}] Solicitud rechazada (400): Email inválido o faltante.`);
      return res.status(400).json({
        success: false,
        message: "Se requiere una dirección de correo electrónico válida."
      });
    }

    // Crear objeto de seguimiento inicial
    const requestData = {
      id: requestId,
      timestamp: new Date().toISOString(),
      clientName,
      email, // Guardar email para uso posterior (envío)
      formData, // Guardar los datos específicos del formulario
      status: 'pending',
      message: 'Solicitud recibida, en cola para procesamiento...'
    };

    // Guardar en el almacén de pendientes
    requestsStore.pending.set(requestId, requestData);
    console.log(`[${requestId}] Solicitud encolada para ${clientName} (${email})`);

    // Actualizar estadísticas
    statistics.totalSubmissions++;
    statistics.lastSubmissionTimestamp = requestData.timestamp;

    // Responder inmediatamente al cliente indicando que se está procesando
    res.status(202).json({ // Usar 202 Accepted para indicar procesamiento asíncrono
      success: true,
      message: "Formulario recibido. Tu rutina se está generando y se enviará a tu correo electrónico cuando esté lista.",
      requestId: requestId,
      statusUrl: `/api/form/status/${requestId}` // URL para consultar estado
    });

    // Disparar el procesamiento en segundo plano (sin await)
    // Usamos setImmediate para asegurar que la respuesta se envíe antes de empezar el trabajo pesado
    setImmediate(() => {
        processFormDataInBackground(requestData).catch(error => {
            // Este catch maneja errores no capturados dentro de processFormDataInBackground
            console.error(`[${requestId}] Error CATASTRÓFICO no manejado en processFormDataInBackground:`, error);
            // Asegurarse de actualizar el estado a fallido incluso en este caso extremo
             if (requestsStore.pending.has(requestId)) {
                 requestData.status = 'failed';
                 requestData.message = `Error interno inesperado durante el procesamiento: ${error.message}`;
                 requestData.error = error.message;
                 requestData.failedAt = new Date().toISOString();
                 requestsStore.failed.set(requestId, requestData);
                 requestsStore.pending.delete(requestId);
                 statistics.processingErrors++; // Contar como error de procesamiento
             }
        });
    });

  } catch (error) {
    // Capturar errores síncronos en el propio controlador (validación, etc.)
    console.error(`[${req.requestId || 'N/A'}] Error SÍNCRONO en processForm:`, error);
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

  if (!requestId) {
    return res.status(400).json({ success: false, message: "Falta el ID de la solicitud." });
  }

  // Buscar en todos los almacenes
  const requestData =
    requestsStore.pending.get(requestId) ||
    requestsStore.completed.get(requestId) ||
    requestsStore.failed.get(requestId);

  if (!requestData) {
    console.warn(`[Status Check] Solicitud no encontrada: ${requestId}`);
    return res.status(404).json({
      success: false,
      message: "Solicitud no encontrada o ya ha sido purgada."
    });
  }

  // Devolver estado actual (ofuscando datos sensibles)
  console.log(`[Status Check] Consultando estado para ${requestId}: ${requestData.status}`);
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
  // !! AÑADIR AUTENTICACIÓN/AUTORIZACIÓN AQUÍ EN UN ENTORNO REAL !!
  // Ejemplo básico: verificar una clave secreta en header o query param
  // const ADMIN_KEY = process.env.ADMIN_API_KEY;
  // if (!ADMIN_KEY || req.query.key !== ADMIN_KEY) {
  //    return res.status(403).json({ success: false, message: "Acceso denegado" });
  // }

  try {
      // Preparar resumen (mapeando y ofuscando datos)
      const mapRequestSummary = (item) => ({
          id: item.id,
          timestamp: item.timestamp,
          clientName: item.clientName,
          email: item.email ? `${item.email.substring(0, 3)}***${item.email.substring(item.email.indexOf('@'))}` : 'N/A', // Ofuscar email
          status: item.status,
          ...(item.status === 'failed' && { error: item.error }),
          ...(item.status === 'completed' && { completedAt: item.completedAt }),
      });

      const summary = {
          totals: {
              pending: requestsStore.pending.size,
              completed: requestsStore.completed.size,
              failed: requestsStore.failed.size,
              all: requestsStore.pending.size + requestsStore.completed.size + requestsStore.failed.size
          },
          statistics: {
            ...statistics,
             // Calcular tiempo promedio si hay datos
             // avgProcessingTime: calcularTiempoPromedio(), // Implementar si es necesario
          },
          // Obtener una muestra de cada estado (más recientes primero)
          recentPending: Array.from(requestsStore.pending.values())
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, 10)
            .map(mapRequestSummary),
          recentCompleted: Array.from(requestsStore.completed.values())
            .sort((a, b) => new Date(b.completedAt || b.timestamp) - new Date(a.completedAt || a.timestamp))
            .slice(0, 10)
            .map(mapRequestSummary),
          recentFailed: Array.from(requestsStore.failed.values())
            .sort((a, b) => new Date(b.failedAt || b.timestamp) - new Date(a.failedAt || a.timestamp))
            .slice(0, 10)
            .map(mapRequestSummary)
      };

      res.status(200).json({
          success: true,
          data: summary
      });
  } catch (error) {
      console.error("Error al obtener resumen de solicitudes:", error);
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
  const { id: requestId, clientName, email, formData } = requestData;

  try {
    console.log(`[${requestId}] Iniciando procesamiento para ${clientName}...`);
    requestData.status = 'processing'; // Estado intermedio opcional
    requestData.message = 'Formateando datos para IA...';

    // Convertir los datos del formulario al formato de objetos esperado por generateRoutine
    const routineInputData = formatFormDataToObjects(formData);

    if (!routineInputData || routineInputData.length === 0) {
        throw new Error("No se pudieron formatear los datos del formulario para la IA.");
    }

    console.log(`[${requestId}] Datos formateados (${routineInputData.length} items). Generando rutina...`);
    requestData.message = 'Generando rutina personalizada con IA...';

    // Llamar a generateRoutine (que ahora maneja su propio timeout internamente)
    // Pasar el array de objetos [{ question, answer, field }]
    const routineHtml = await generateRoutine(routineInputData); // Ya no necesitamos Promise.race aquí

    console.log(`[${requestId}] Rutina generada. Creando PDF...`);
    requestData.message = 'Rutina generada, creando documento PDF...';

    // --- Generación de PDF ---
    // Crear directorio temporal si no existe
    const tempDir = process.env.TEMP_DIR || path.join(__dirname, '../temp');
     if (!fs.existsSync(tempDir)) {
       console.log(`[${requestId}] Creando directorio temporal: ${tempDir}`);
       fs.mkdirSync(tempDir, { recursive: true });
     }

    const pdfPath = await generatePDF(routineHtml, clientName, tempDir, requestId); // Pasar tempDir y requestId
    console.log(`[${requestId}] PDF generado en: ${pdfPath}`);
    requestData.message = 'Documento PDF creado. Enviando email...';

    // --- Envío de Email ---
    await sendEmail(email, clientName, pdfPath, requestId); // Pasar clientName también puede ser útil
    console.log(`[${requestId}] Email enviado a ${email}.`);

    // --- Finalización Exitosa ---
    requestData.status = 'completed';
    requestData.message = '¡Rutina generada y enviada a tu correo!';
    requestData.completedAt = new Date().toISOString();
    statistics.successfulRoutines++;

    // Mover de pending a completed
    requestsStore.completed.set(requestId, requestData);
    requestsStore.pending.delete(requestId);
    console.log(`[${requestId}] Procesamiento completado exitosamente.`);

    // Opcional: Limpiar el archivo PDF temporal después de un tiempo o si el envío fue exitoso
    // setTimeout(() => { try { fs.unlinkSync(pdfPath); console.log(`[${requestId}] PDF temporal eliminado: ${pdfPath}`); } catch(e){ console.error(`Error eliminando PDF ${pdfPath}`, e)} }, 60000); // Borrar después de 1 min

  } catch (error) {
    // --- Manejo de Errores Durante el Procesamiento ---
    console.error(`[${requestId}] ERROR durante el procesamiento para ${email}:`, error.message);
    console.error(error.stack); // Loguear stacktrace para debug

    requestData.status = 'failed';
    // Usar un mensaje de error más descriptivo si es posible
    requestData.message = `Error al generar la rutina: ${error.message}`;
    requestData.error = error.message; // Guardar mensaje de error
    requestData.failedAt = new Date().toISOString();
    statistics.failedRoutines++;

    // Mover de pending a failed
    requestsStore.failed.set(requestId, requestData);
    requestsStore.pending.delete(requestId);
    console.log(`[${requestId}] Procesamiento movido a estado 'failed'.`);

    // Opcional: Notificar al admin o intentar enviar un email de error al usuario?
    // try { await sendErrorEmail(email, requestId, error.message); } catch (e) { console.error("Error enviando email de notificación de fallo:", e); }
  }
}


/**
 * @description Función interna: Convierte los datos del formulario (objeto clave-valor)
 * al formato de array de objetos [{ question, answer, field }]
 * esperado por el servicio de OpenAI.
 * @param {Object} formData - Objeto con los datos clave-valor del formulario.
 * @returns {Array<object>} - Array de objetos formateados o array vacío si hay error.
 */
function formatFormDataToObjects(formData) {
    if (typeof formData !== 'object' || formData === null) {
        console.error("formatFormDataToObjects recibió datos no válidos:", formData);
        return [];
    }

  // Mapeo entre campos del formulario (ids) y el texto de la pregunta
  // Usamos el FORM_FIELD_QUESTIONS definido al inicio del archivo
  const questionMap = {};
  FORM_FIELD_QUESTIONS.forEach(q => {
    questionMap[q.id] = q.text;
  });

  const responses = [];

  // Procesar cada campo del formulario recibido
  Object.entries(formData).forEach(([fieldName, value]) => {
    const questionText = questionMap[fieldName];
    const trimmedValue = String(value || '').trim();

    // Incluir solo si el campo tiene mapeo de pregunta y tiene un valor no vacío
    if (questionText && trimmedValue !== '') {
      responses.push({
        question: questionText,
        answer: trimmedValue,
        field: fieldName // Incluir el ID del campo original puede ser útil
      });
    } else if (trimmedValue !== '' && !questionText) {
        // Loguear campos recibidos que no tienen mapeo (podrían ser nuevos campos)
        console.warn(`Campo no mapeado recibido en formData: '${fieldName}' con valor: '${trimmedValue}'`);
        // Opcionalmente, incluirlos como "Información Adicional" genérica si se desea
        // responses.push({ question: `Campo adicional (${fieldName})`, answer: trimmedValue, field: fieldName });
    }
  });

  // Verificar si se obtuvieron suficientes datos
  if (responses.length < 5) { // Umbral arbitrario, ajustar si es necesario
    console.warn("formatFormDataToObjects: Pocas respuestas significativas (<5) formateadas para la IA.");
  }

  return responses;
}


// Exportar funciones públicas del controlador
// (processFormData e formatFormDataToObjects son internas y no se exportan directamente)
// Pero sí exportamos el almacén y estadísticas si queremos acceder desde tests u otros módulos (con precaución)
exports.requestsStore = requestsStore;
exports.statistics = statistics;