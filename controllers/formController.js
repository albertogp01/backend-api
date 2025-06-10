/**
 * backend-api/controllers/formController.js
 * Controlador principal para el procesamiento de formularios con manejo de estado asíncrono.
 */

// Importar servicios y utilidades
const { generateRoutine } = require('../services/openaiService');
const { sendEmail } = require('../services/emailService');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const fsPromises = fs.promises;

const requestsStore = {
  pending: new Map(),
  completed: new Map(),
  failed: new Map()
};

const statistics = {
  totalSubmissions: 0,
  successfulRoutines: 0,
  failedRoutines: 0,
  processingErrors: 0,
  lastSubmissionTimestamp: null
};

exports.processForm = async (req, res, next) => {
  const controllerRequestId = req.requestId || 'temp-' + Date.now();
  try {
    console.log(`[${controllerRequestId}] ==== NUEVA SOLICITUD DE FORMULARIO ====`);
    const processingRequestId = uuidv4();

    if (typeof req.body !== 'object' || req.body === null) {
      throw new Error('El cuerpo de la solicitud (req.body) no es un objeto válido.');
    }
    
    // Extraer nombre y email, y dejar el resto en formData
    const { nombre = "Cliente", email, ...formData } = req.body;
    
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      throw new Error("Se requiere una dirección de correo electrónico válida.");
    }

    const requestData = {
      id: processingRequestId,
      timestamp: new Date().toISOString(),
      clientName: nombre,
      email,
      formData: formData, 
      status: 'pending',
      message: 'Solicitud recibida, en cola para procesamiento...'
    };

    requestsStore.pending.set(processingRequestId, requestData);
    statistics.totalSubmissions++;
    statistics.lastSubmissionTimestamp = requestData.timestamp;

    res.status(202).json({
      success: true,
      message: "Formulario recibido. Tu rutina se está generando y se enviará a tu correo.",
      requestId: processingRequestId,
      statusUrl: `/api/form/status/${processingRequestId}`
    });

    setImmediate(() => {
        processFormDataInBackground(requestData).catch(error => {
            console.error(`[${processingRequestId}] Error FATAL en processFormDataInBackground:`, error);
        });
    });

  } catch (error) {
    console.error(`[${controllerRequestId}] Error en processForm:`, error);
    next(error);
  }
};

async function processFormDataInBackground(requestData) {
  const { id: requestId, clientName, email, formData } = requestData;
  console.log(`[${requestId}] Iniciando procesamiento en segundo plano para ${email}.`);

  try {
    requestData.status = 'processing';
    requestData.message = 'Generando rutina con IA...';
    requestsStore.pending.set(requestId, requestData);
    
    // Pasamos el objeto formData directamente a generateRoutine.
    // La lógica de procesamiento ahora estará dentro de generateRoutine.
    const routineHtml = await generateRoutine(formData);

    if (!routineHtml || routineHtml.trim() === '') {
        throw new Error("La IA no generó contenido para la rutina.");
    }
    console.log(`[${requestId}] Rutina HTML generada.`);

    requestData.message = 'Creando documento PDF...';
    requestsStore.pending.set(requestId, requestData);
    
    // Carga diferida de pdfService para ahorrar memoria
    const { generatePDF } = require('../services/pdfService');
    const tempDir = process.env.TEMP_DIR || path.join(__dirname, '../temp');
    await fsPromises.mkdir(tempDir, { recursive: true });

    const pdfPath = await generatePDF(routineHtml, clientName, tempDir, requestId);
    console.log(`[${requestId}] PDF generado en: ${pdfPath}`);

    requestData.message = 'Enviando email...';
    requestsStore.pending.set(requestId, requestData);
    await sendEmail(email, clientName, pdfPath, requestId);
    console.log(`[${requestId}] Email enviado.`);

    requestData.status = 'completed';
    requestData.message = '¡Rutina generada y enviada a tu correo!';
    requestData.completedAt = new Date().toISOString();
    statistics.successfulRoutines++;
    requestsStore.completed.set(requestId, requestData);
    requestsStore.pending.delete(requestId);
    console.log(`[${requestId}] Procesamiento completado con éxito.`);

  } catch (error) {
    console.error(`[${requestId}] ERROR en background para ${email}:`, error);
    requestData.status = 'failed';
    requestData.message = `Error al generar la rutina: ${error.message}`;
    requestData.error = error.message;
    requestData.failedAt = new Date().toISOString();
    
    requestsStore.failed.set(requestId, requestData);
    requestsStore.pending.delete(requestId);
    statistics.failedRoutines++;
    statistics.processingErrors++;
  }
}

exports.checkStatus = (req, res, next) => {
  try {
      const { requestId } = req.params;
      const requestData = requestsStore.pending.get(requestId) || requestsStore.completed.get(requestId) || requestsStore.failed.get(requestId);
      if (!requestData) {
          return res.status(404).json({ success: false, message: "Solicitud no encontrada." });
      }
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
      next(error);
  }
};

exports.getSubmissions = (req, res, next) => {
  try {
      const mapRequestSummary = (item) => ({ id: item.id, timestamp: item.timestamp, clientName: item.clientName, email: item.email, status: item.status, error: item.error, completedAt: item.completedAt });
      const sortByRecent = (a, b) => new Date(b.timestamp) - new Date(a.timestamp);
      
      const summary = {
          totals: { pending: requestsStore.pending.size, completed: requestsStore.completed.size, failed: requestsStore.failed.size },
          statistics,
          recentPending: Array.from(requestsStore.pending.values()).sort(sortByRecent).slice(0, 20).map(mapRequestSummary),
          recentCompleted: Array.from(requestsStore.completed.values()).sort(sortByRecent).slice(0, 20).map(mapRequestSummary),
          recentFailed: Array.from(requestsStore.failed.values()).sort(sortByRecent).slice(0, 20).map(mapRequestSummary)
      };
      res.status(200).json({ success: true, data: summary });
  } catch (error) {
      next(error);
  }
};