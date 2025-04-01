const OpenAI = require("openai");
const dotenv = require('dotenv');
const fs = require('fs'); // Importar 'fs' para verificar existencia de knowledge_base.json

// Cargar variables de entorno si no se ha hecho ya
dotenv.config();

// Configura el cliente de OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Mapeo de campos del formulario a preguntas (Mantener como referencia)
const FORM_FIELD_QUESTIONS = [
  { id: "nombre", text: "¿Cómo te llamas?" },
  { id: "edad", text: "¿Cuál es tu edad?" },
  { id: "genero", text: "¿Cuál es tu género?" },
  { id: "email", text: "¿Cuál es tu dirección de correo electrónico?" },
  { id: "peso", text: "¿Cuánto pesas?" },
  { id: "altura", text: "¿Cuál es tu altura?" },
  { id: "objetivo", text: "¿Cuál es tu objetivo principal de entrenamiento?" },
  { id: "nivel", text: "¿Cuál es tu nivel de experiencia con el entrenamiento?" },
  { id: "condicion_fisica", text: "¿Cómo describirías tu condición física actual?" },
  { id: "lugar_entrenamiento", text: "¿Dónde sueles entrenar?" },
  { id: "dias_entrenamiento", text: "¿Cuántos días a la semana puedes entrenar?" },
  { id: "tiempo_sesion", text: "¿Cuánto tiempo puedes dedicar por sesión?" },
  { id: "cirugia_reciente", text: "¿Has tenido alguna cirugía reciente (último año) que debamos tener en cuenta?" },
  { id: "cirugia_descripcion", text: "Descripción de cirugía reciente" },
  { id: "lesion_muscular", text: "¿Tienes alguna lesión muscular que pueda afectar tu movilidad?" },
  { id: "lesion_muscular_descripcion", text: "Descripción de lesión muscular" },
  { id: "tendinopatia", text: "¿Tienes alguna tendinopatía que pueda afectar tu movilidad?" },
  { id: "tendinopatia_descripcion", text: "Descripción de tendinopatía" },
  { id: "limitacion_articular", text: "¿Tienes limitaciones de movilidad en alguna articulación?" },
  { id: "limitacion_articular_descripcion", text: "Descripción de limitación articular" },
  { id: "problema_postural", text: "¿Tienes algún problema postural que afecte tu entrenamiento?" },
  { id: "problema_postural_descripcion", text: "Descripción de problema postural" },
  { id: "condicion_medica", text: "¿Sufres de alguna condición médica que afecte tu rendimiento?" },
  { id: "condicion_medica_descripcion", text: "Descripción de condición médica" },
  { id: "medicacion", text: "¿Estás tomando alguna medicación que pueda afectar tu entrenamiento?" },
  { id: "medicacion_descripcion", text: "Descripción de medicación" },
  { id: "ejercicios_favoritos", text: "¿Hay algún movimiento que quieras practicar en específico?" },
  { id: "ejercicios_evitar", text: "¿Hay algún tipo de ejercicio que te desagrade o prefieras evitar?" },
  { id: "tipo_entrenamiento", text: "¿Prefieres entrenamientos enfocados en un grupo muscular por día o entrenamientos de cuerpo completo?" },
  { id: "material_especifico", text: "¿Quieres usar material específico?" },
  { id: "info_adicional", text: "¿Hay algo más que debamos saber para personalizar mejor tu rutina?" }
];

/**
 * Encuentra específicamente el tiempo de sesión entre las respuestas.
 * Busca por campo 'tiempo_sesion', preguntas específicas, y patrones de tiempo en respuestas.
 * @param {Array<object>} responses - Respuestas del cliente (objetos con question, answer, field?)
 * @returns {string} - Tiempo de sesión o cadena vacía
 */
function findSessionTime(responses) {
    if (!Array.isArray(responses)) return ''; // Asegurar que responses es un array
    // Buscar primero por el campo específico
    const sessionField = responses.find(r => r && r.field === 'tiempo_sesion');
    if (sessionField?.answer?.trim()) { // Simplificado con optional chaining y truthiness
        return sessionField.answer.trim();
    }

    // Buscar por preguntas específicas sobre el tiempo de sesión
    const sessionQuestion = responses.find(r => r && r.question && (
        (r.question.toLowerCase().includes("tiempo") && r.question.toLowerCase().includes("sesión")) ||
        r.question.toLowerCase().includes("cuánto tiempo puedes dedicar")
    ));
    if (sessionQuestion?.answer?.trim()) {
        return sessionQuestion.answer.trim();
    }

    // Buscar respuestas que mencionen minutos u horas en relación a preguntas de tiempo/sesión
    const timePattern = responses.find(r => r && r.question && r.answer &&
        (r.question.toLowerCase().includes("tiempo") || r.question.toLowerCase().includes("sesión")) &&
        /\d+\s*(minutos?|min|horas?|hr)/i.test(r.answer)
    );
    if (timePattern?.answer) { // No necesita trim aquí porque la regex ya valida el contenido
        return timePattern.answer.trim();
    }

    return '';
}

/**
 * Obtiene el peso del cliente excluyendo confusiones con el tiempo de sesión.
 * @param {Array<object>} responses - Respuestas del cliente
 * @param {string} sessionTime - Tiempo de sesión identificado previamente
 * @returns {string} - Peso formateado (e.g., "75 kg") o cadena vacía
 */
function getWeightExcludingSession(responses, sessionTime) {
    if (!Array.isArray(responses)) return '';
    const checkConflict = (value) => {
        const trimmedValue = String(value || '').trim();
        const trimmedSessionTime = String(sessionTime || '').trim();
        // Extraer solo el número del tiempo de sesión para una comparación más robusta
        const sessionTimeNumberMatch = trimmedSessionTime.match(/^\d+/);
        const sessionTimeNumber = sessionTimeNumberMatch ? sessionTimeNumberMatch[0] : null;

        // Comparar si el valor es exactamente igual al tiempo de sesión completo O solo al número del tiempo de sesión
        if (trimmedSessionTime && trimmedValue &&
            (trimmedValue === trimmedSessionTime || (sessionTimeNumber && trimmedValue === sessionTimeNumber))) {
            console.log(`Conflicto detectado: Valor (${trimmedValue}) coincide con tiempo de sesión (${trimmedSessionTime}). Ignorando.`);
            return true; // Hay conflicto
        }
        return false; // No hay conflicto
    };

    const formatWeight = (value) => {
        const trimmedValue = String(value || '').trim();
        if (/\d+([.,]\d+)?\s*(kg|kilos|libras|lb)/i.test(trimmedValue)) {
             // Extraer valor y unidad, normalizar unidad
             const match = trimmedValue.match(/(\d+([.,]\d+)?)\s*(kg|kilos|lb|libras)?/i);
             const numValue = match[1].replace(',', '.');
             const unit = (match[3] || 'kg').toLowerCase();
             return `${numValue} ${unit.startsWith('k') ? 'kg' : 'lb'}`;
        }
        if (/^\d+([.,]\d+)?$/.test(trimmedValue)) { // Si solo son números
            return trimmedValue + " kg"; // Asumir kg
        }
        return trimmedValue; // Devolver como está si no coincide
    };

    // 1. Buscar por campo específico 'peso'
    let potentialWeightObj = responses.find(r => r && r.field === 'peso');
    if (potentialWeightObj?.answer?.trim()) {
        let formatted = formatWeight(potentialWeightObj.answer);
        if (!checkConflict(formatted)) return formatted;
    }

    // 2. Buscar por pregunta exacta "¿cuánto pesas?"
    potentialWeightObj = responses.find(r => r && r.question?.toLowerCase() === "¿cuánto pesas?");
    if (potentialWeightObj?.answer?.trim()) {
        let formatted = formatWeight(potentialWeightObj.answer);
        if (!checkConflict(formatted)) return formatted;
    }

    // 3. Buscar por pregunta que contenga "peso" (y no palabras conflictivas)
    potentialWeightObj = responses.find(r => r && r.question &&
        r.question.toLowerCase().includes("peso") &&
        !r.question.toLowerCase().includes("tiempo") &&
        !r.question.toLowerCase().includes("sesión")
    );
    if (potentialWeightObj?.answer?.trim()) {
        let formatted = formatWeight(potentialWeightObj.answer);
        if (!checkConflict(formatted)) return formatted;
    }

    // 4. Buscar respuesta con patrón de peso (kg/lb) en preguntas no conflictivas
    const weightPatternResponse = responses.find(r => r && r.answer &&
        /\b\d+([.,]\d+)?\s*(kg|kilos|libras|lb)\b/i.test(r.answer) &&
        r.question &&
        !r.question.toLowerCase().includes("tiempo") &&
        !r.question.toLowerCase().includes("sesión") &&
        !r.question.toLowerCase().includes("altura") // Añadir exclusión de altura
    );
    if (weightPatternResponse?.answer) {
        const weightMatch = weightPatternResponse.answer.match(/\b\d+([.,]\d+)?\s*(kg|kilos|libras|lb)\b/i);
        let extractedWeight = weightMatch ? weightMatch[0].trim() : formatWeight(weightPatternResponse.answer); // Extraer o formatear
        extractedWeight = formatWeight(extractedWeight); // Re-formatear/normalizar
        if (!checkConflict(extractedWeight)) {
            return extractedWeight;
        }
    }

    return ''; // No se encontró peso válido
}

/**
 * Obtiene la altura del cliente excluyendo confusiones con el tiempo de sesión.
 * @param {Array<object>} responses - Respuestas del cliente
 * @param {string} sessionTime - Tiempo de sesión identificado previamente
 * @returns {string} - Altura formateada (e.g., "175 cm", "1.75 m") o cadena vacía
 */
function getHeightExcludingSession(responses, sessionTime) {
    if (!Array.isArray(responses)) return '';
    const checkConflict = (value) => {
        const trimmedValue = String(value || '').trim();
        const trimmedSessionTime = String(sessionTime || '').trim();
        // Extraer solo el número del tiempo de sesión
        const sessionTimeNumberMatch = trimmedSessionTime.match(/^\d+/);
        const sessionTimeNumber = sessionTimeNumberMatch ? sessionTimeNumberMatch[0] : null;

        if (trimmedSessionTime && trimmedValue &&
            (trimmedValue === trimmedSessionTime || (sessionTimeNumber && trimmedValue === sessionTimeNumber))) {
            console.log(`Conflicto detectado: Valor (${trimmedValue}) coincide con tiempo de sesión (${trimmedSessionTime}). Ignorando.`);
            return true; // Hay conflicto
        }
        return false; // No hay conflicto
    };

    const formatHeight = (value) => {
        const trimmedValue = String(value || '').trim();
        const heightMatch = trimmedValue.match(/(\d+([.,]\d+)?)\s*(cm|m|metros|ft|pie|pies)?/i);

        if (heightMatch) {
            const numValue = parseFloat(heightMatch[1].replace(',', '.'));
            let unit = (heightMatch[3] || '').toLowerCase();
            if (!unit) { // Si no hay unidad, inferir
                if (numValue >= 1.4 && numValue <= 2.3) unit = 'm';
                else if (numValue >= 140 && numValue <= 230) unit = 'cm';
                else unit = 'cm'; // Default a cm
            }
            if (unit.startsWith('m')) return `${numValue} m`;
            if (unit === 'cm') return `${numValue} cm`;
            if (unit.startsWith('f') || unit.startsWith('p')) return `${numValue} ft`; // Normalizar a ft
            return `${numValue} cm`; // Fallback
        }
         if (/^\d+([.,]\d+)?$/.test(trimmedValue)) { // Si solo es número, intentar inferir
             const numValue = parseFloat(trimmedValue);
             if (numValue >= 1.4 && numValue <= 2.3) return `${numValue} m`;
             if (numValue >= 140 && numValue <= 230) return `${numValue} cm`;
             return `${numValue} cm`; // Default a cm
         }

        return trimmedValue; // Devolver tal cual si no es número ni tiene formato reconocible
    };

    // 1. Buscar por campo específico 'altura'
    let potentialHeightObj = responses.find(r => r && r.field === 'altura');
    if (potentialHeightObj?.answer?.trim()) {
        let formatted = formatHeight(potentialHeightObj.answer);
        if (!checkConflict(formatted)) return formatted;
    }

    // 2. Buscar por pregunta exacta "¿cuál es tu altura?"
    potentialHeightObj = responses.find(r => r && r.question?.toLowerCase() === "¿cuál es tu altura?");
    if (potentialHeightObj?.answer?.trim()) {
        let formatted = formatHeight(potentialHeightObj.answer);
        if (!checkConflict(formatted)) return formatted;
    }

    // 3. Buscar por pregunta que contenga "altura" (y no palabras conflictivas)
    potentialHeightObj = responses.find(r => r && r.question &&
        r.question.toLowerCase().includes("altura") &&
        !r.question.toLowerCase().includes("tiempo") &&
        !r.question.toLowerCase().includes("sesión") &&
        !r.question.toLowerCase().includes("peso") // Añadir exclusión de peso
    );
    if (potentialHeightObj?.answer?.trim()) {
        let formatted = formatHeight(potentialHeightObj.answer);
        if (!checkConflict(formatted)) return formatted;
    }

    // 4. Buscar respuesta con patrón de altura (cm/m/ft) en preguntas no conflictivas
    const heightPatternResponse = responses.find(r => r && r.answer &&
        /\b\d+([.,]\d+)?\s*(cm|metros|m|pie|pies|ft)\b/i.test(r.answer) &&
        r.question &&
        !r.question.toLowerCase().includes("tiempo") &&
        !r.question.toLowerCase().includes("sesión") &&
        !r.question.toLowerCase().includes("peso") // Añadir exclusión de peso
    );
    if (heightPatternResponse?.answer) {
        let formatted = formatHeight(heightPatternResponse.answer); // Usar formatHeight directamente
        if (!checkConflict(formatted)) {
            return formatted;
        }
    }

    return ''; // No se encontró altura válida
}

/**
 * Obtiene la respuesta a una pregunta específica usando palabras clave.
 * Es una función GENERAL. Para PESO y ALTURA, usar las funciones específicas:
 * getWeightExcludingSession() y getHeightExcludingSession().
 *
 * @param {string} questionKeyword - Palabra clave o frase de la pregunta
 * @param {Array<object>} responses - Array de respuestas (obj: {question, answer, field?})
 * @returns {string} - Respuesta encontrada o cadena vacía
 */
function getAnswer(questionKeyword, responses) {
    if (!Array.isArray(responses) || !questionKeyword) return '';
    // Normalizar la palabra clave para la búsqueda
    const normalizedKeyword = questionKeyword.toLowerCase().trim();
    if (!normalizedKeyword) return '';

    // --- Búsqueda Priorizada ---
    // 1. Buscar por campo específico (field) si coincide con la keyword
    const responseByField = responses.find(r => r && r.field && r.field.toLowerCase() === normalizedKeyword);
    // Devolver respuesta incluso si está vacía si se encontró por field (para capturar "No" o "" explícitos)
    if (responseByField && typeof responseByField.answer === 'string') {
        return responseByField.answer.trim();
    }

    // 2. Buscar por coincidencia de keyword en el texto de la PREGUNTA
    const responseByQuestion = responses.find(r => r && r.question && r.question.toLowerCase().includes(normalizedKeyword));
    if (responseByQuestion && typeof responseByQuestion.answer === 'string') {
        return responseByQuestion.answer.trim();
    }

    // 3. Buscar por coincidencia de keyword en el texto de la RESPUESTA (Fallback más arriesgado)
    //    - Se añade filtro para que la pregunta no contenga keywords conflictivas (peso, altura, tiempo, sesión)
    //      si la keyword buscada no es una de esas.
    const conflictingKeywords = ['peso', 'altura', 'tiempo', 'sesión'];
    const isConflictingKeyword = conflictingKeywords.includes(normalizedKeyword);

    const responseByAnswer = responses.find(r =>
        r && r.answer && r.answer.toLowerCase().includes(normalizedKeyword) &&
        r.question && // Asegurar que hay pregunta para el filtro
        (isConflictingKeyword || // Si buscamos una keyword conflictiva, no filtramos por pregunta
            !conflictingKeywords.some(ck => r.question.toLowerCase().includes(ck))) // Si no, filtramos preguntas conflictivas
    );
    if (responseByAnswer && typeof responseByAnswer.answer === 'string') {
        // console.log(`Keyword '${normalizedKeyword}' encontrada en respuesta: '${responseByAnswer.answer}' (Pregunta: '${responseByAnswer.question}') - Usando Fallback`);
        return responseByAnswer.answer.trim();
    }

    return ''; // No se encontró respuesta por ninguno de los métodos
}

/**
 * Genera una rutina de entrenamiento personalizada
 * Función principal que acepta diferentes formatos de entrada
 *
 * @param {Array|Object} formData - Datos del formulario (array de textos o objeto de campos)
 * @param {Object} options - Opciones adicionales para la generación
 * @returns {Promise<string>} - HTML con la rutina generada
 */
const generateRoutine = async (formData, options = {}) => {
    if (!formData) {
        console.error("Error: No se proporcionaron datos del formulario");
        throw new Error("No se proporcionaron datos del formulario");
    }

    console.log("Generando rutina con datos:",
        Array.isArray(formData) ? `${formData.length} respuestas` : `${Object.keys(formData).length} campos`);

    try {
        // Procesar según el formato de entrada
        let responses = []; // Inicializar como array vacío

        // 1. Si es un array de strings con formato "Pregunta\nRespuesta"
        if (Array.isArray(formData) && typeof formData[0] === 'string' && formData[0].includes('\n')) {
            console.log("Procesando formato 'Pregunta\\nRespuesta'");
            responses = formData.map(item => {
                const parts = item.split('\n');
                const question = parts[0] ? parts[0].trim() : "Pregunta desconocida";
                const answer = parts[1] ? parts[1].trim() : "";
                const fieldMapping = FORM_FIELD_QUESTIONS.find(q => q.text === question);
                return { question, answer, field: fieldMapping ? fieldMapping.id : undefined };
            }).filter(r => r.question && typeof r.answer === 'string'); // Filtrar inválidos
        }
        // 2. Si es un array de objetos con propiedades question y answer (ideal)
        else if (Array.isArray(formData) && typeof formData[0] === 'object' && formData[0].hasOwnProperty('question') && formData[0].hasOwnProperty('answer')) {
            console.log("Procesando array de objetos pregunta-respuesta");
            responses = formData.map(item => {
                if (item && item.question && typeof item.answer !== 'undefined' && item.answer !== null) { // Validar cada item, permitir respuesta vacía ''
                    if (!item.field) {
                        const fieldMapping = FORM_FIELD_QUESTIONS.find(q => q.text === item.question);
                        return { ...item, answer: String(item.answer), field: fieldMapping ? fieldMapping.id : undefined }; // Asegurar string
                    }
                    return { ...item, answer: String(item.answer) }; // Asegurar string
                }
                return null; // Marcar inválidos para filtrar
            }).filter(item => item !== null);
        }
        // 3. Si es un objeto con pares clave-valor (formato del nuevo formulario)
        else if (typeof formData === 'object' && !Array.isArray(formData) && Object.keys(formData).length > 0) {
            console.log("Procesando objeto de pares campo-valor");
            responses = processFormFieldsObject(formData); // Esta función ya filtra y añade 'field'
        }
        // 4. Si es un array con pares de texto simple (líneas) - Intentar mapear
        else if (Array.isArray(formData) && typeof formData[0] === 'string') {
            console.log("Procesando array de líneas de texto (mapeo contextual)");
            const mappedResponses = processTextLines(formData); // Esta función devuelve {question, answer}
            responses = mappedResponses.map(item => {
                if (item && item.question && typeof item.answer === 'string') {
                    const fieldMapping = FORM_FIELD_QUESTIONS.find(q => q.text === item.question);
                    return { ...item, field: fieldMapping ? fieldMapping.id : undefined };
                }
                return null;
            }).filter(item => item !== null);
        }
        // Formato no soportado o datos vacíos
        else {
            console.error("Formato de datos no soportado o datos vacíos:", formData);
            throw new Error("Formato de datos no soportado o datos vacíos para generar rutina");
        }

        // Asegurarse de que 'responses' sea siempre un array válido después del procesamiento
        if (!Array.isArray(responses)) {
            console.error("Error interno: 'responses' no es un array después del procesamiento inicial.");
            responses = [];
        }

        // Formatear respuestas para el prompt, excluyendo datos sensibles y respuestas vacías
        // PERO manteniendo respuestas explícitas como "No", "Ninguno", etc.
        const formattedResponsesForPrompt = responses
            .filter(item =>
                item && // Asegurar que el item exista
                item.question && // Asegurar que la pregunta exista
                typeof item.answer === 'string' && // Asegurar que la respuesta sea string
                item.answer.trim() !== '' && // Excluir respuestas completamente vacías después de trim
                item.field !== 'nombre' &&
                item.field !== 'email' &&
                !item.question.toLowerCase().includes("cómo te llamas") &&
                !item.question.toLowerCase().includes("dirección de correo electrónico")
            )
            .map(item => `Pregunta: ${item.question}\nRespuesta: ${item.answer.trim()}`); // Usar trim aquí

        console.log(`Procesando ${formattedResponsesForPrompt.length} respuestas para prompt (filtradas)`);

        // Generar el prompt para OpenAI y obtener la rutina
        // Pasamos 'responses' (el array completo y limpio) para extracción de datos
        return await createPromptAndGenerate(formattedResponsesForPrompt, responses, options);

    } catch (error) {
        console.error("Error en generateRoutine:", error);
        // Lanzar un error más específico o el mismo error
        throw new Error(`Error al generar rutina: ${error.message}`);
    }
};


/**
 * Procesa un objeto con campos de formulario {fieldId: value}
 *
 * @param {Object} formFields - Objeto con campos del formulario
 * @returns {Array<object>} - Array de objetos { question, answer, field } filtrado
 */
function processFormFieldsObject(formFields) {
    if (typeof formFields !== 'object' || formFields === null) return []; // Validar entrada

    const questionMap = {};
    FORM_FIELD_QUESTIONS.forEach(q => {
        questionMap[q.id] = q.text;
    });

    const processedFields = { ...formFields }; // Copiar

    const conditionalFields = [
        { main: 'cirugia_reciente', desc: 'cirugia_descripcion' },
        { main: 'lesion_muscular', desc: 'lesion_muscular_descripcion' },
        { main: 'tendinopatia', desc: 'tendinopatia_descripcion' },
        { main: 'limitacion_articular', desc: 'limitacion_articular_descripcion' },
        { main: 'problema_postural', desc: 'problema_postural_descripcion' },
        { main: 'condicion_medica', desc: 'condicion_medica_descripcion' },
        { main: 'medicacion', desc: 'medicacion_descripcion' },
    ];

    conditionalFields.forEach(({ main, desc }) => {
        if (processedFields.hasOwnProperty(main) && processedFields.hasOwnProperty(desc)) {
            const mainValueStr = String(processedFields[main] || '').toLowerCase().trim();
            const descValue = processedFields[desc];

            if ((mainValueStr === 'sí' || mainValueStr === 'si') && descValue && String(descValue).trim()) {
                // Combinar respuesta principal y descripción
                processedFields[main] = `Sí: ${String(descValue).trim()}`;
                delete processedFields[desc]; // Eliminar campo de descripción
            } else if (mainValueStr === 'no') {
                // Si la respuesta principal es 'No', eliminar la descripción asociada
                delete processedFields[desc];
            }
            // Si la respuesta principal no es 'Sí' ni 'No' (o está vacía), y hay descripción,
            // mantener ambos campos separados por ahora, se filtrarán luego si están vacíos.
        }
    });

    return Object.entries(processedFields)
        .map(([field, value]) => {
            const questionText = questionMap[field] || field; // Usar field como fallback si no hay pregunta mapeada
            // Permitir respuestas vacías '' pero filtrar null/undefined
            const answerValue = (value !== null && value !== undefined) ? String(value) : '';
            // const trimmedValue = answerValue.trim(); // No hacer trim aquí, hacerlo al formatear para prompt

            // Incluir el campo incluso si la respuesta está vacía (para que getAnswer pueda encontrarlo si es necesario)
            // El filtrado final para el prompt se hará después
            return {
                question: questionText,
                answer: answerValue, // Mantener el valor original (con espacios si los tiene)
                field: field
            };
        })
        .filter(item => item !== null); // Filtrar cualquier nulo inesperado
}

/**
 * Procesa un array de líneas de texto, intentando extraer o mapear a preguntas.
 *
 * @param {Array<string>} textLines - Array de líneas de texto
 * @returns {Array<object>} - Array de objetos { question, answer }
 */
function processTextLines(textLines) {
    if (!Array.isArray(textLines)) return [];

    const cleanedLines = textLines
        .map(line => (typeof line === 'string' ? line.trim() : ''))
        .filter(line => line !== '');

    if (cleanedLines.length === 0) return [];

    // Intenta detectar formato "Pregunta: Respuesta"
    const standardFormatRegex = /^(Pregunta|P):?\s*(.*?)\s*(Respuesta|R):?\s*(.*)$/i;
    const allMatchStandard = cleanedLines.every(line => standardFormatRegex.test(line));

    if (allMatchStandard) {
        console.log("Detectado formato 'Pregunta: Respuesta' en las líneas.");
        return cleanedLines.map(line => {
            const match = line.match(standardFormatRegex);
            return {
                question: match[2] ? match[2].trim() : 'Pregunta Desconocida',
                answer: match[4] ? match[4].trim() : ''
            };
        }).filter(r => r.question && typeof r.answer === 'string'); // Filtrar si falta algo o respuesta no es string
    }

    // Intenta detectar formato "Pregunta\nRespuesta" o líneas alternas Q/A
    const results = [];
    let currentQuestion = null;
    let possibleNewLineFormat = false;

    // Check for explicit newline format in any line
    if (cleanedLines.some(line => line.includes('\n'))) {
        possibleNewLineFormat = true;
        console.log("Detectado posible formato con saltos de línea ('\\n').");
    }

    cleanedLines.forEach((line, index) => {
        if (line.includes('\n')) {
            const parts = line.split('\n');
            if (parts[0] && typeof parts[1] !== 'undefined') { // Asegurar que hay pregunta y respuesta (puede ser vacía)
                results.push({ question: parts[0].trim(), answer: parts[1].trim() });
                currentQuestion = null; // Reset state
            } else if (parts[0]) { // Si solo hay pregunta, guardarla para la siguiente línea
                currentQuestion = parts[0].trim();
            }
        } else if (index % 2 === 0 && !possibleNewLineFormat && cleanedLines.length > index + 1) { // Asumir Q si es línea par Y no detectamos \n antes Y hay línea siguiente
            currentQuestion = line;
        } else if (currentQuestion) { // Asumir R si teníamos Q pendiente
            results.push({ question: currentQuestion, answer: line });
            currentQuestion = null; // Reset
        } else if (!possibleNewLineFormat) { // Si no es formato \n y no hay pregunta pendiente
             // Intentar mapear la línea actual como respuesta a una pregunta estándar si es posible
             const mapped = mapSingleLineToQuestion(line);
             if(mapped){
                 results.push(mapped);
             } else {
                 // Si no se puede mapear, añadir como info adicional
                 const infoField = `info_linea_${index + 1}`;
                 results.push({ question: `Información línea ${index + 1}`, answer: line, field: infoField });
                 console.log(`Línea ${index + 1} ('${line}') no reconocida, añadida como ${infoField}.`);
             }
        }
        // Si possibleNewLineFormat es true pero esta línea no tiene \n, se ignora a menos que haya currentQuestion
    });

    // Si después del bucle queda una pregunta pendiente (última línea fue Q)
    if (currentQuestion) {
        results.push({ question: currentQuestion, answer: "" }); // Añadirla con respuesta vacía
    }


    if (results.length > 0 && (possibleNewLineFormat || results.length >= cleanedLines.length / 2)) {
        console.log("Detectado formato líneas alternas Q/A o Pregunta\\nRespuesta.");
        return results.filter(r => r.question && typeof r.answer === 'string');
    }

    // Fallback: Mapeo contextual si los formatos anteriores fallan
    console.warn("Formato de líneas no estándar o inconsistente. Intentando mapeo contextual línea por línea.");
    return mapLinesToQuestions(cleanedLines); // Usar la función de mapeo más robusta
}

/**
 * Intenta mapear UNA SOLA línea de texto a una pregunta conocida.
 * Usado como helper en processTextLines para líneas sueltas.
 * @param {string} line - La línea de texto a mapear.
 * @returns {object|null} - Objeto { question, answer, field } si se mapea, o null.
 */
function mapSingleLineToQuestion(line) {
    if (!line) return null;
    const lineLower = line.toLowerCase();

    // Mapeos rápidos y comunes con field
    if (/\b(kg|kilos|lb|libras)\b/i.test(lineLower) && /\d/.test(lineLower)) return { question: "¿Cuánto pesas?", answer: line, field: "peso" };
    if (/\b(cm|m|metros|ft|pie)\b/i.test(lineLower) && /\d/.test(lineLower)) return { question: "¿Cuál es tu altura?", answer: line, field: "altura" };
    if (/\b(min|minutos|hr|hora)\b/i.test(lineLower) && /\d/.test(lineLower)) return { question: "¿Cuánto tiempo puedes dedicar por sesión?", answer: line, field: "tiempo_sesion" };
    if (/\b(d[ií]as|veces)\b/i.test(lineLower) && /\bsemana\b/i.test(lineLower) && /\d/.test(lineLower)) return { question: "¿Cuántos días a la semana puedes entrenar?", answer: line, field: "dias_entrenamiento" };
    if (/\b(años|edad)\b/i.test(lineLower) && /\d/.test(lineLower)) return { question: "¿Cuál es tu edad?", answer: line, field: "edad" };
    if (/\b(hombre|mujer|masculino|femenino|no binario)\b/i.test(lineLower)) return { question: "¿Cuál es tu género?", answer: line, field: "genero" };
    if (/\b(principiante|intermedio|avanzado)\b/i.test(lineLower)) return { question: "¿Cuál es tu nivel de experiencia con el entrenamiento?", answer: line, field: "nivel" };
    if (/\b(casa|gimnasio|gym|parque)\b/i.test(lineLower)) return { question: "¿Dónde sueles entrenar?", answer: line, field: "lugar_entrenamiento" };
    if (/\b(hipertrofia|fuerza|resistencia|perder peso|adelgazar|ganar m[uú]sculo)\b/i.test(lineLower)) return { question: "¿Cuál es tu objetivo principal de entrenamiento?", answer: line, field: "objetivo" };

    // Podrían añadirse más mapeos heurísticos aquí

    return null; // No se pudo mapear con confianza
}


/**
 * Intenta mapear líneas de texto a preguntas conocidas por contexto y palabras clave.
 * (Función de fallback si processTextLines no detecta formato estándar)
 *
 * @param {Array<string>} lines - Líneas de texto limpias
 * @returns {Array<object>} - Array de objetos { question, answer, field }
 */
function mapLinesToQuestions(lines) {
    if (!Array.isArray(lines)) return [];

    const questionPatterns = FORM_FIELD_QUESTIONS.map(q => {
        const keywords = q.text
            .toLowerCase()
            .replace(/[¿?¡!,.:;]/g, '') // Quitar más puntuación
            .split(/\s+/)
            // Filtro más estricto de palabras clave comunes o poco distintivas
            .filter(word => word.length >= 3 && !['cómo', 'cuál', 'cuánto', 'has', 'hay', 'con', 'para', 'que', 'por', 'tus', 'alguna', 'alguno', 'debes', 'puede', 'afectar', 'describirías', 'principal', 'soportado', 'soportada', 'del', 'con', 'las', 'los', 'una', 'uno', 'eres', 'tiene', 'tipo', 'sobre', 'tuyo', 'tuyos', 'tuyas', 'para', 'este', 'estos', 'esta', 'estas', 'ser', 'estar', 'tener', 'hacer', 'decir', 'poder', 'querer', 'saber', 'poner', 'haber', 'dejar', 'seguir', 'encontrar', 'llamar', 'venir', 'pensar', 'salir', 'volver', 'tomar', 'conocer', 'vivir', 'sentir', 'tratar', 'mirar', 'contar', 'empezar', 'esperar', 'buscar', 'entrar', 'trabajar', 'escribir', 'perder', 'ocurrir', 'recibir', 'recordar', 'terminar', 'necesitar', 'cambiar', 'presentar', 'crear', 'abrir', 'considerar', 'oír', 'acabar', 'convertir', 'ganar', 'formar', 'traer', 'partir', 'morir', 'aceptar', 'realizar', 'suponer', 'comprender', 'lograr', 'explicar', 'preguntar', 'tocar', 'estudiar', 'alcanzar', 'nacer', 'dirigir', 'correr', 'utilizar', 'pagar', 'ayudar', 'gustar', 'jugar', 'escuchar', 'levantar', 'intentar', 'usar', 'decidir'].includes(word));
        return {
            question: q.text,
            field: q.id, // Guardar el field para posible uso posterior
            patterns: keywords.map(kw => new RegExp(`\\b${kw}\\b`, 'i')) // Word boundary para evitar subcadenas
        };
    }).filter(qp => qp.patterns.length > 0); // Quitar preguntas sin keywords útiles

    // Añadir patrones específicos para datos clave si no están bien cubiertos
    const addSpecificPattern = (qText, fId, patterns) => {
        if (!questionPatterns.some(qp => qp.field === fId)) {
            questionPatterns.push({ question: qText, field: fId, patterns: patterns });
        } else {
            // Opcional: añadir patrones a la existente si falta alguno
            const existing = questionPatterns.find(qp => qp.field === fId);
            patterns.forEach(p => {
                if (!existing.patterns.some(ep => ep.toString() === p.toString())) {
                    existing.patterns.push(p);
                }
            });
        }
    };

    addSpecificPattern("¿Cuánto pesas?", "peso", [/\b(kg|kilos|libras|lb)\b/i, /\bpesa?s?\b/i, /\bpeso\b/i]);
    addSpecificPattern("¿Cuál es tu altura?", "altura", [/\b(cm|metros|m|ft|pie)\b/i, /\baltura\b/i, /\bmides?\b/i, /\bestatura\b/i]);
    addSpecificPattern("¿Cuántos días a la semana puedes entrenar?", "dias_entrenamiento", [/\bd[ií]as\b/i, /veces por semana/i, /frecuencia/i, /\bsemana\b/i]);
    addSpecificPattern("¿Cuánto tiempo puedes dedicar por sesión?", "tiempo_sesion", [/\bminutos?\b/i, /\bhoras?\b/i, /tiempo por sesi[oó]n/i, /duraci[oó]n/i, /\bsesi[oó]n\b/i]);
    addSpecificPattern("¿Hay algo más que debamos saber?", "info_adicional", [/adicional/i, /comentario/i, /extra/i, /a[ñn]adir/i, /\bsaber\b/i, /otra cosa/i]);

    const results = [];
    const assignedLines = new Set(); // Para marcar qué líneas ya han sido asignadas
    const assignedFields = new Set(); // Para marcar qué fields ya han sido asignados

    // Iterar por cada línea e intentar asignarla a la pregunta con mejor puntuación
    lines.forEach((line, lineIndex) => {
        if (assignedLines.has(lineIndex)) return; // Saltar si la línea ya fue asignada

        let bestMatch = { score: 0, question: null, field: null };

        questionPatterns.forEach(({ question, field, patterns }) => {
             if (assignedFields.has(field)) return; // Saltar si el field ya fue asignado

            let currentScore = 0;
            patterns.forEach(pattern => {
                if (pattern.test(line)) {
                    currentScore++;
                }
            });

            // Añadir bonus si la línea contiene números y la pregunta espera uno (edad, peso, altura, etc.)
            if (/\d/.test(line) && ['edad', 'peso', 'altura', 'dias_entrenamiento', 'tiempo_sesion'].includes(field)) {
                currentScore += 0.5;
            }
             // Añadir bonus si la línea contiene unidades esperadas
             if (field === 'peso' && /\b(kg|lb)\b/i.test(line)) currentScore += 0.5;
             if (field === 'altura' && /\b(cm|m|ft)\b/i.test(line)) currentScore += 0.5;
             if (field === 'tiempo_sesion' && /\b(min|hr)\b/i.test(line)) currentScore += 0.5;


            if (currentScore > bestMatch.score) {
                bestMatch = { score: currentScore, question: question, field: field };
            }
        });

        // Asignar si encontramos un match razonable (score > 0) y el field no ha sido asignado
        if (bestMatch.score > 0 && bestMatch.field && !assignedFields.has(bestMatch.field)) {
             results.push({ question: bestMatch.question, answer: line, field: bestMatch.field });
             assignedLines.add(lineIndex);
             assignedFields.add(bestMatch.field); // Marcar el field como asignado
        }
    });

    // Añadir líneas no asignadas a "Información adicional"
    const additionalInfoLines = lines.filter((line, index) => !assignedLines.has(index));
    if (additionalInfoLines.length > 0) {
        const existingAdditionalInfo = results.find(r => r.field === 'info_adicional');
        const additionalInfoAnswer = additionalInfoLines.join('\n'); // Unir con saltos de línea

        if (existingAdditionalInfo) {
            // Si ya existe info adicional, añadir las nuevas líneas
            existingAdditionalInfo.answer += (existingAdditionalInfo.answer ? '\n' : '') + additionalInfoAnswer;
        } else {
            // Si no existe, crear la entrada
            const additionalInfoQuestion = questionPatterns.find(q => q.field === 'info_adicional')?.question || "Información adicional";
            results.push({ question: additionalInfoQuestion, answer: additionalInfoAnswer, field: 'info_adicional' });
            assignedFields.add('info_adicional'); // Marcar como asignado
        }
         console.log(`Líneas no asignadas (${additionalInfoLines.length}) añadidas a 'Información adicional'.`);
    }

    console.log(`Mapeo contextual finalizado. ${results.length} preguntas/respuestas identificadas.`);
    return results;
}


/**
 * Construye una descripción textual del cliente para el prompt de IA.
 *
 * @param {Object} data - Datos del cliente limpios y procesados
 * @returns {string} - Descripción del cliente
 */
function buildClientDescription(data) {
    let descriptionParts = []; // Usar un array para construir la descripción

    // GÉNERO
    if (data.gender) {
        if (/masculino|hombre/i.test(data.gender)) {
            descriptionParts.push("un cliente de género masculino");
        } else if (/femenino|mujer/i.test(data.gender)) {
            descriptionParts.push("una cliente de género femenino");
        } else if (data.gender.toLowerCase() !== 'prefiero no especificar' && data.gender.toLowerCase() !== 'no binario') { // Ser específico si no es binario
            descriptionParts.push(`un cliente de género ${data.gender.toLowerCase()}`);
        } else if (data.gender.toLowerCase() === 'no binario') {
            descriptionParts.push("un cliente de género no binario");
        } else {
            descriptionParts.push("un cliente"); // Género no especificado o prefiero no decir
        }
    } else {
        descriptionParts.push("un cliente"); // Sin dato de género
    }

    // EDAD
    if (data.age && /^\d+$/.test(String(data.age).trim().split(' ')[0])) { // Verifica si empieza con número
        descriptionParts.push(`de ${String(data.age).trim().replace(/\s*años$/i, '')} años`); // Limpia "años" si ya estaba
    } else if (data.age) { // Si no es numérico pero existe, añadirlo
        descriptionParts.push(`cuya edad es ${String(data.age).trim()}`);
    }

    // PESO Y ALTURA (si existen)
    if (data.weight) descriptionParts.push(`que pesa ${data.weight}`);
    if (data.height) descriptionParts.push(`y mide ${data.height}`);

    // IMC y Clasificación
    if (data.imc) {
        let imcDesc = `con un IMC de ${data.imc}, clasificando como `;
        const imcValue = parseFloat(data.imc);
        if (!isNaN(imcValue)) {
            if (imcValue < 18.5) imcDesc += `peso inferior al normal`;
            else if (imcValue < 25) imcDesc += `peso normal`;
            else if (imcValue < 30) imcDesc += `sobrepeso`;
            else if (imcValue < 35) imcDesc += `obesidad grado 1`;
            else if (imcValue < 40) imcDesc += `obesidad grado 2`;
            else imcDesc += `obesidad grado 3 (mórbida)`;
            descriptionParts.push(imcDesc);
        }
    }

    // NIVEL DE EXPERIENCIA Y CONDICIÓN FÍSICA (evitar redundancia)
    let experienceAdded = false;
    if (data.experienceLevel) {
        descriptionParts.push(`con nivel de experiencia ${data.experienceLevel.toLowerCase()}`);
        experienceAdded = true;
    }
    if (data.fitnessLevel && (!experienceAdded || data.fitnessLevel.toLowerCase() !== data.experienceLevel?.toLowerCase())) {
        // Solo añadir si es descriptivo (activo, sedentario...) y no repite el nivel
         if (!/principiante|intermedio|avanzado/i.test(data.fitnessLevel.toLowerCase())) {
            descriptionParts.push(`y condición física ${data.fitnessLevel.toLowerCase()}`);
         }
    }

    // OBJETIVO
    if (data.trainingGoal) descriptionParts.push(`su objetivo principal es ${data.trainingGoal.toLowerCase()}`);

    // LOGÍSTICA DE ENTRENAMIENTO
    if (data.trainingLocation) descriptionParts.push(`entrena habitualmente en ${data.trainingLocation.toLowerCase()}`);
    if (data.daysPerWeek) {
        let daysText = String(data.daysPerWeek).toLowerCase().trim();
        const dayMap = { '1': 'un día', '2': 'dos días', '3': 'tres días', '4': 'cuatro días', '5': 'cinco días', '6': 'seis días', '7': 'siete días' };
        // Intentar convertir número a texto, si no, usar el texto original si no es solo número
        daysText = dayMap[daysText] || (/^\d+$/.test(daysText) ? `${daysText} días` : daysText);
        descriptionParts.push(`dispone de ${daysText} a la semana`);
    }
    if (data.sessionTime) {
        let timeText = String(data.sessionTime).toLowerCase().trim();
        // Asegurar que tenga unidad (min/hr)
        if (/^\d+$/.test(timeText)) timeText += " min"; // Añadir min si solo es número
        else timeText = timeText.replace(/horas?/i, 'hr').replace(/minutos?/i, 'min'); // Normalizar
        descriptionParts.push(`para sesiones de ${timeText}`);
    }

    // CONTEXTO MÉDICO Y LIMITACIONES (agrupar y evitar duplicados)
    const healthContext = new Set();
    const addHealthInfo = (label, value) => {
        const trimmedValue = String(value || '').trim();
        // Filtrar respuestas negativas explícitas
        if (trimmedValue && !/^(no|nada|ningun[oa])$/i.test(trimmedValue) && trimmedValue.toLowerCase() !== 'no aplica') {
            const cleanValue = trimmedValue.replace(/^Sí:\s*/i, '').trim(); // Limpiar prefijo "Sí: "
            healthContext.add(`${label}: ${cleanValue}`);
        }
    };

    addHealthInfo('Cirugía reciente', data.surgery);
    addHealthInfo('Lesión muscular', data.muscleInjury);
    addHealthInfo('Tendinopatía', data.tendinopathy);
    addHealthInfo('Limitación de movilidad', data.mobilityLimitation);
    addHealthInfo('Problema postural', data.posturalProblem);
    addHealthInfo('Condición médica', data.medicalCondition);
    addHealthInfo('Medicación', data.medication);

    if (healthContext.size > 0) {
        descriptionParts.push(`Consideraciones médicas/físicas: ${Array.from(healthContext).join('; ')}`);
    }

    // PREFERENCIAS Y EVITACIONES
    const preferences = new Set();
    const addPreference = (label, value) => {
        const trimmedValue = String(value || '').trim();
        if (trimmedValue && !/^(no|nada|ningun[oa]|ninguno en particular)$/i.test(trimmedValue) && trimmedValue.toLowerCase() !== 'no aplica') {
            preferences.add(`${label}: ${trimmedValue}`);
        }
    };

    addPreference('Le gustaría practicar', data.exercisePreference);
    addPreference('Prefiere evitar', data.exerciseAvoidance);
    addPreference('Preferencia de estructura', data.trainingPreference);
    addPreference('Material específico a usar', data.specificMaterial);

    if (preferences.size > 0) {
        descriptionParts.push(`Preferencias: ${Array.from(preferences).join('; ')}`);
    }

    // INFORMACIÓN ADICIONAL
    const additionalInfoTrimmed = String(data.additionalInfo || '').trim();
    if (additionalInfoTrimmed && !/^(no|nada|ningun[oa])$/i.test(additionalInfoTrimmed) && additionalInfoTrimmed.toLowerCase() !== 'no aplica') {
        descriptionParts.push(`Información adicional: "${additionalInfoTrimmed}"`);
    }

    // Unir todas las partes con ". " para formar la descripción final
    return descriptionParts.join(". ").replace(/\.\s*\./g, '.').replace(/\s+\./g, '.').trim() + '.'; // Asegurar punto final y limpiar dobles puntos
}

/**
 * Crea el prompt para OpenAI y genera la rutina
 *
 * @param {Array<string>} formattedResponsesForPrompt - Array de respuestas formateadas (Pregunta: ... Respuesta: ...) para el prompt
 * @param {Array<object>} allResponses - Array de objetos {question, answer, field?} con todas las respuestas procesadas
 * @param {Object} options - Opciones adicionales para la generación
 * @returns {Promise<string>} - HTML de la rutina generada
 */
const createPromptAndGenerate = async (formattedResponsesForPrompt, allResponses = [], options = {}) => {
    // Extraer información relevante del cliente usando las funciones mejoradas
    const sessionTime = findSessionTime(allResponses);
    console.log("Tiempo de sesión identificado:", sessionTime || "No encontrado");

    // Usar las funciones específicas que excluyen la confusión con el tiempo de sesión
    // Y la función getAnswer mejorada
    const clientDataRaw = {
        gender: getAnswer("género", allResponses),
        age: getAnswer("edad", allResponses),
        weight: getWeightExcludingSession(allResponses, sessionTime),
        height: getHeightExcludingSession(allResponses, sessionTime),
        trainingGoal: getAnswer("objetivo", allResponses) || getAnswer("objetivo principal", allResponses),
        experienceLevel: getAnswer("nivel", allResponses) || getAnswer("experiencia", allResponses),
        fitnessLevel: getAnswer("condición física", allResponses),
        trainingLocation: getAnswer("lugar_entrenamiento", allResponses) || getAnswer("dónde sueles entrenar", allResponses) || getAnswer("lugar", allResponses),
        daysPerWeek: getAnswer("dias_entrenamiento", allResponses) || getAnswer("días", allResponses) || getAnswer("cuántos días", allResponses),
        sessionTime: sessionTime, // Usar el valor ya identificado
        surgery: getAnswer("cirugia_reciente", allResponses) || getAnswer("cirugía", allResponses),
        muscleInjury: getAnswer("lesion_muscular", allResponses) || getAnswer("lesión muscular", allResponses),
        tendinopathy: getAnswer("tendinopatia", allResponses) || getAnswer("tendinopatía", allResponses),
        mobilityLimitation: getAnswer("limitacion_articular", allResponses) || getAnswer("limitacion articular", allResponses) || getAnswer("limitación", allResponses) || getAnswer("movilidad", allResponses),
        posturalProblem: getAnswer("problema_postural", allResponses) || getAnswer("problema postural", allResponses) || getAnswer("postural", allResponses),
        medicalCondition: getAnswer("condicion_medica", allResponses) || getAnswer("condición médica", allResponses),
        medication: getAnswer("medicacion", allResponses) || getAnswer("medicación", allResponses),
        exercisePreference: getAnswer("ejercicios_favoritos", allResponses) || getAnswer("ejercicios favoritos", allResponses) || getAnswer("practicar en específico", allResponses) || getAnswer("movimiento que quieras practicar", allResponses),
        exerciseAvoidance: getAnswer("ejercicios_evitar", allResponses) || getAnswer("ejercicios evitar", allResponses) || getAnswer("desagrade", allResponses),
        trainingPreference: getAnswer("tipo_entrenamiento", allResponses) || getAnswer("tipo entrenamiento", allResponses) || getAnswer("grupo muscular", allResponses) || getAnswer("cuerpo completo", allResponses),
        specificMaterial: getAnswer("material_especifico", allResponses) || getAnswer("material específico", allResponses) || getAnswer("material", allResponses),
        additionalInfo: getAnswer("info_adicional", allResponses) || getAnswer("info adicional", allResponses) || getAnswer("algo más", allResponses)
    };

    console.log("Datos del cliente extraídos (raw):", clientDataRaw);

    // Calcular IMC
    let imc = null;
    if (clientDataRaw.weight && clientDataRaw.height) {
        const weightMatch = String(clientDataRaw.weight).match(/(\d+([.,]\d+)?)/);
        const heightMatch = String(clientDataRaw.height).match(/(\d+([.,]\d+)?)/);
        const weightValue = weightMatch ? parseFloat(weightMatch[1].replace(',', '.')) : NaN;
        let heightInMeters = NaN;
        const heightValue = heightMatch ? parseFloat(heightMatch[1].replace(',', '.')) : NaN;

        if (!isNaN(heightValue)) {
            // Priorizar unidad explícita (m, cm, ft)
            if (String(clientDataRaw.height).includes('m') && !String(clientDataRaw.height).includes('cm')) {
                heightInMeters = heightValue;
            } else if (String(clientDataRaw.height).includes('cm')) {
                heightInMeters = heightValue / 100;
            } else if (String(clientDataRaw.height).includes('ft') || String(clientDataRaw.height).includes('pie')) {
                 heightInMeters = heightValue * 0.3048; // Convertir pies a metros
            }
            // Inferir si no hay unidad
            else if (heightValue >= 1.4 && heightValue <= 2.3) { // Asumir metros
                heightInMeters = heightValue;
            } else if (heightValue >= 140 && heightValue <= 230) { // Asumir cm
                heightInMeters = heightValue / 100;
            } else {
                 // Si está fuera de rangos razonables, no se puede inferir con seguridad
                 console.warn(`Altura (${clientDataRaw.height}) sin unidad clara y fuera de rangos esperados para inferencia.`);
                 heightInMeters = NaN;
            }
        }

        // Convertir peso si está en libras
        let weightInKg = weightValue;
        if (!isNaN(weightValue) && String(clientDataRaw.weight).includes('lb')) {
             weightInKg = weightValue * 0.453592;
        }


        if (!isNaN(weightInKg) && !isNaN(heightInMeters) && heightInMeters > 0) {
            imc = weightInKg / (heightInMeters * heightInMeters);
            clientDataRaw.imc = imc.toFixed(2);
            console.log(`IMC calculado: ${clientDataRaw.imc} (Peso: ${weightInKg.toFixed(1)} kg, Altura: ${heightInMeters.toFixed(2)} m)`);
        } else {
            clientDataRaw.imc = null;
            console.log("No se pudo calcular IMC (valores inválidos/inconsistentes).", { weightStr: clientDataRaw.weight, heightStr: clientDataRaw.height });
        }
    } else {
        clientDataRaw.imc = null;
        console.log("No se pudo calcular IMC (falta peso o altura).");
    }

    // Limpiar datos
    const cleanedData = cleanClientData(clientDataRaw);
    console.log("Datos del cliente (limpios):", cleanedData);

    // Construir descripción
    const clientDescription = buildClientDescription(cleanedData);
    console.log("Descripción del cliente para prompt:", clientDescription);

    // --- Integración de la base de conocimiento ---
    let specificRecommendations = "";
    let healthContextForPrompt = []; // Para pasar al prompt
    let periodizationGuideline = ""; // Para guardar guía de periodización si se encuentra
    try {
        const knowledgeBasePath = './knowledge_base.json';
        if (fs.existsSync(knowledgeBasePath)) {
            const knowledgeBase = JSON.parse(fs.readFileSync(knowledgeBasePath, 'utf8'));
            if (knowledgeBase && Array.isArray(knowledgeBase)) {
                const relevantGuidelines = findRelevantGuidelines(cleanedData, knowledgeBase);
                if (relevantGuidelines.length > 0) {
                    specificRecommendations = "\n\n**Directrices Clave Basadas en el Perfil:**\n";
                    // Limitar a las 5-7 más relevantes por score para no saturar el prompt
                    relevantGuidelines.slice(0, 7).forEach(guideline => {
                         // Separar guías de periodización de las de condiciones
                         if (guideline.input.toLowerCase().startsWith("periodization model:")) {
                             if (!periodizationGuideline) { // Tomar solo la primera guía de periodización encontrada
                                 periodizationGuideline = `- ${guideline.output}\n`;
                                 console.log(`Directriz de periodización encontrada: ${guideline.output}`);
                             }
                         } else {
                             specificRecommendations += `- ${guideline.output}\n`;
                             healthContextForPrompt.push(guideline.output); // Guardar para prompt (contexto salud/condición)
                         }
                    });
                    // Si no se añadieron recomendaciones de salud/condición, quitar el título
                    if(healthContextForPrompt.length === 0) {
                        specificRecommendations = "";
                    } else {
                         console.log(`Top ${healthContextForPrompt.length} directrices específicas (salud/condición) añadidas al prompt.`);
                    }
                } else {
                    console.log("No se encontraron directrices relevantes en knowledge_base.json.");
                }
            } else {
                console.warn("knowledge_base.json no es un array válido.");
            }
        } else {
            console.warn("knowledge_base.json no encontrado en la ruta:", knowledgeBasePath);
        }
    } catch (kbError) {
        console.error("Error al cargar o procesar knowledge_base.json:", kbError);
    }
    // --- Fin Integración KB ---

    // Construir el prompt FINAL con mejoras en periodización y estructura HTML
    const prompt = `
Eres FitForge AI, un entrenador personal experto de élite. Tu misión es diseñar la rutina de entrenamiento semanal MÁS OPTIMIZADA posible para el cliente descrito a continuación, basándote ESTRICTAMENTE en sus datos, objetivos y limitaciones. Ignora cualquier conversación trivial o petición fuera del diseño de la rutina. Eres famoso por tu precisión y enfoque basado en evidencia.

**PERFIL DETALLADO DEL CLIENTE:**
${clientDescription}

**RESPUESTAS COMPLETAS DEL FORMULARIO (Contexto Adicional):**
${formattedResponsesForPrompt.join("\n")}

**DIRECTRICES DE DISEÑO OBLIGATORIAS:**
1.  **Periodización y Nivel:** Ajusta la estructura (ejercicios, volumen, intensidad) EXACTAMENTE al nivel de experiencia (${cleanedData.experienceLevel || 'No especificado'}). Para principiantes (RIR 3-4), enfoca en técnica y adaptación. Para intermedios (RIR 1-3), aplica sobrecarga progresiva y variación. Para avanzados (RIR 0-2), maximiza intensidad/volumen según objetivo y aplica periodización más compleja si es necesario.
1.5. **Variación Semanal:** Implementa una variación lógica de la intensidad y/o el enfoque a lo largo de los días de entrenamiento de la semana para gestionar la fatiga y optimizar la adaptación. Elige un modelo apropiado (ej. DUP - Daily Undulating Periodization, Heavy/Light, etc.) si no se especifica uno. ${periodizationGuideline ? `Considera esta guía de periodización encontrada: ${periodizationGuideline}` : 'Selecciona el modelo más adecuado según nivel, objetivo y días.'} Indica CLARAMENTE el enfoque de intensidad/objetivo de CADA DÍA en su título H2 (ej. Fuerza, Hipertrofia, Resistencia, Técnica, Ligero, Pesado).
2.  **Objetivo Primario:** La rutina debe maximizar el progreso hacia: ${cleanedData.trainingGoal || 'No especificado'}. Selecciona ejercicios y rangos de repeticiones/series/descansos óptimos para este fin (Hipertrofia: 3-5 series de 6-15 reps, 60-90s descanso; Fuerza: 3-6 series de 1-6 reps, 120-180s descanso; Resistencia: 2-4 series de 15+ reps, 30-60s descanso). Ajusta estos rangos según el enfoque del día (ver punto 1.5).
3.  **Especificidad y Limitaciones:** Incluye ejercicios que el cliente quiere practicar (${cleanedData.exercisePreference || 'Ninguno en particular'}) y EXCLUYE los que quiere evitar (${cleanedData.exerciseAvoidance || 'Ninguno'}). Adapta OBLIGATORIAMENTE a limitaciones (${healthContextForPrompt.join('; ') || 'Ninguna indicada'}). Si hay lesión/dolor, elige variantes seguras o evita la zona.
4.  **Logística:** Diseña para ${cleanedData.daysPerWeek || 'días no especificados'} por semana, con sesiones de ${cleanedData.sessionTime || 'duración no especificada'}. Ajusta el volumen total (Nº ejercicios principales: 30min: 4-5; 60min: 6-8; 90min: 8-10; 120min: 10-12) y la densidad al tiempo disponible. Usa el material disponible (${cleanedData.specificMaterial || 'No especificado, asumir gimnasio estándar'}).
5.  **Estructura Preferida:** Respeta la preferencia (${cleanedData.trainingPreference || 'No especificada'}). Si no, elige la más adecuada (Principiante: Full Body; Intermedio/Avanzado: Split según días/objetivo, e.g., Empuje/Tire/Pierna, Torso/Pierna, Dividida por grupos). Combina esto con el modelo de variación semanal (punto 1.5).
6.  **IMC y Consideraciones:** ${cleanedData.imc ? `Considera el IMC de ${cleanedData.imc}. Si es >25 (sobrepeso/obesidad), limita impacto articular inicial y sugiere progresión gradual. Si es <18.5 (bajo peso), asegura suficiente estímulo para hipertrofia si es el objetivo y considera la recuperación.` : 'IMC no disponible.'}

**FORMATO DE SALIDA (HTML ESTRICTO - SIN MARKDOWN):**
Genera ÚNICAMENTE código HTML. Para CADA DÍA de entrenamiento, usa esta estructura EXACTA y ORDEN:
1. Un título H2 con la clase "day-title". Incluye el número de día, enfoque muscular y enfoque de intensidad/objetivo. Ejemplo: <h2 class="day-title">Día 1: Empuje - Fuerza (RIR 2-3)</h2>
2. La tabla HTML para ese día (con activación y rutina principal).
3. INMEDIATAMENTE DESPUÉS de la tabla (si hay variantes), el div con clase "side-variants-container".

Ejemplo de estructura para UN DÍA:

<h2 class="day-title">Día X: [Enfoque Grupo Muscular] - [Enfoque Intensidad/Objetivo del Día]</h2>
<table>
    <tr class="activation-header">...</tr>
    <tr class="rutina-header">...</tr>
    </table>
<div class="side-variants-container">
    <div class="side-variants-title">VARIANTES</div>
    </div>
**REGLAS ADICIONALES CRÍTICAS:**
* **Estructura HTML:** Sigue el orden H2 -> TABLE -> DIV (opcional) para cada día SIN NINGÚN OTRO ELEMENTO ENTRE ELLOS.
* **Precisión:** Nombres técnicos. Parámetros exactos (Series, Rango Reps, Descanso en segundos). Usa RIR (Reps In Reserve) OBJETIVO para cada día según la periodización semanal en Notas Clave. Tempo (e.g., 31X0) es opcional pero útil.
* **Volumen:** Cumple el número MÍNIMO de ejercicios PRINCIPALES según duración. La activación NO cuenta.
* **Notas Clave:** Breves y cruciales (máx 15 palabras). Deben incluir el RIR objetivo para los ejercicios principales de ese día.
* **Variantes:** Una variante ÚTIL (progresión/regresión/equipo/adaptación) por cada ejercicio principal en el div \`side-variants-container\`. Lenguaje directo. El título SIEMPRE debe ser "VARIANTES".
* **SIN EXTRAS:** Solo HTML. Sin saludos, explicaciones, intros, conclusiones, comentarios HTML innecesarios. NO uses markdown (\\\`\\\`\\\`). NO incluyas \\\`<html>\\\`, \\\`<head>\\\`, \\\`<body>\\\` ni \\\`<style>\\\` tags. Solo el contenido de la rutina (H2s, TABLEs, DIVs).

${specificRecommendations}

Diseña la rutina SEMANAL completa AHORA.`;

    let timeoutId;
    try {
        console.log("Enviando solicitud a OpenAI con prompt final...");
        // console.log("--- PROMPT COMPLETO ---"); // Descomentar para depuración
        // console.log(prompt);
        // console.log("--- FIN PROMPT ---");

        // Añadir un timeout (ej. 90 segundos)
        const controller = new AbortController();
        timeoutId = setTimeout(() => {
             console.warn("Timeout manual activado para la solicitud OpenAI.");
             controller.abort();
        }, 90000); // 90 segundos

        const completion = await openai.chat.completions.create({
            model: process.env.OPENAI_MODEL || "gpt-4o-mini", // Usar gpt-4o-mini como default si no está en .env
            messages: [
                { role: "system", content: "Eres FitForge AI, un creador experto de rutinas de entrenamiento personalizadas en formato HTML, siguiendo instrucciones muy estrictas de estructura y contenido." },
                { role: "user", content: prompt }
            ],
            temperature: 0.5, // Ligeramente más determinista pero permitiendo algo de variabilidad
            // max_tokens: 3500 // Aumentar ligeramente si las rutinas son largas
        }, { signal: controller.signal }); // Pasar la señal del AbortController

        clearTimeout(timeoutId); // Limpiar el timeout si la respuesta llega a tiempo
        timeoutId = null;

        const responseMessage = completion.choices[0]?.message?.content;

        if (!responseMessage) {
            throw new Error("Respuesta vacía de OpenAI");
        }

        // Limpiar posible markdown residual (aunque el prompt lo prohíbe)
        let cleanedHtmlResponse = responseMessage.replace(/```html|```/g, '').trim();

         // Asegurar que no haya HTML extra antes del primer H2 o después del último elemento
         // (Intenta encontrar el primer H2 y el último elemento esperado)
         const firstH2Match = cleanedHtmlResponse.match(/<h2 class="day-title">/);
         if (firstH2Match && firstH2Match.index > 0) {
             console.warn("Limpiando contenido antes del primer H2...");
             cleanedHtmlResponse = cleanedHtmlResponse.substring(firstH2Match.index);
         }
         // Podríamos añadir limpieza similar al final si fuera necesario

        console.log("Rutina generada exitosamente (HTML crudo):");
        // console.log(cleanedHtmlResponse); // Log para depuración

        // Devolver la respuesta HTML limpia
        return cleanedHtmlResponse;

    } catch (error) {
        // Limpiar timeout si existe y el error no fue por abortar
        if (timeoutId && error.name !== 'AbortError') {
             clearTimeout(timeoutId);
             timeoutId = null;
        }

        if (error.name === 'AbortError' || (error instanceof OpenAI.APIError && error.status === 408)) {
            console.error("Error: La solicitud a OpenAI excedió el tiempo límite.");
            throw new Error("La generación de la rutina tardó demasiado. Intenta de nuevo más tarde o revisa la complejidad del prompt.");
        }

        console.error("Error en la llamada a OpenAI API:", error);
        if (error instanceof OpenAI.RateLimitError) {
            throw new Error("Límite de uso de la API de OpenAI alcanzado. Espera un momento y reintenta.");
        } else if (error instanceof OpenAI.APIError && error.status >= 500) {
            throw new Error("Problema temporal con el servicio de OpenAI. Intenta de nuevo más tarde.");
        } else if (error instanceof OpenAI.BadRequestError) {
             console.error("BadRequestError details:", error.message);
             // Intentar loguear parte del prompt si es posible sin exponer datos sensibles
             console.error("Prompt (inicio):", prompt.substring(0, 500));
             throw new Error(`Error de solicitud a OpenAI (BadRequest): Revisa la longitud/formato del prompt. Detalle: ${error.message}`);
        } else {
            throw new Error(`Error al generar la rutina con OpenAI: ${error.message}`);
        }
    }
};


/**
 * Limpia y verifica la consistencia de los datos del cliente.
 * Ajusta formatos y elimina datos claramente incorrectos o contradictorios.
 *
 * @param {Object} clientDataRaw - Datos extraídos inicialmente del cliente.
 * @returns {Object} - Datos limpios y más consistentes.
 */
function cleanClientData(clientDataRaw) {
    // Crear una copia profunda para evitar modificar el objeto original indirectamente
    const cleanedData = JSON.parse(JSON.stringify(clientDataRaw));

    // Función auxiliar para limpiar respuestas negativas comunes y trim()
    const cleanGeneralInput = (value) => {
        const strValue = String(value || '').trim();
        // Mantener "No" explícito pero limpiar "nada", "ninguno/a" a vacío
        if (strValue === '' || /^(nada|ningun[oa])$/i.test(strValue)) {
            return "";
        }
        // Quitar prefijos como "Sí: " si existen
        return strValue.replace(/^Sí:\s*/i, '').trim();
    };

     // Función auxiliar para limpiar específicamente campos numéricos/con unidad
     const cleanNumericUnitInput = (value) => {
         return String(value || '').trim(); // Solo trim, mantener el valor para formateo posterior
     };

    // Aplicar limpieza a campos relevantes
    for (const key in cleanedData) {
        if (typeof cleanedData[key] === 'string') {
            // Aplicar limpieza específica para campos numéricos/con unidad
            if (['weight', 'height', 'age', 'daysPerWeek', 'sessionTime', 'imc'].includes(key)) {
                 cleanedData[key] = cleanNumericUnitInput(cleanedData[key]);
            } else {
                 // Aplicar limpieza general a los demás strings
                 cleanedData[key] = cleanGeneralInput(cleanedData[key]);
            }
        } else if (cleanedData[key] === null || typeof cleanedData[key] === 'undefined') {
             cleanedData[key] = ""; // Convertir null/undefined a string vacío
        } else {
             cleanedData[key] = String(cleanedData[key]); // Convertir otros tipos (ej. números) a string
        }
    }


    // --- Verificaciones y Formateo Específico ---

    // EDAD
    if (cleanedData.age) {
        const ageMatch = cleanedData.age.match(/(\d+)/);
         if (ageMatch) {
             cleanedData.age = ageMatch[1]; // Quedarse solo con el número
         } else {
             console.log(`Limpiando edad no numérica: ${cleanedData.age}`);
             cleanedData.age = ""; // Limpiar si no contiene número
         }
    }

    // GÉNERO (Normalizar)
    if (cleanedData.gender) {
        const genderLower = cleanedData.gender.toLowerCase();
        if (/masculino|hombre/i.test(genderLower)) cleanedData.gender = "Masculino";
        else if (/femenino|mujer/i.test(genderLower)) cleanedData.gender = "Femenino";
        else if (/no binario/i.test(genderLower)) cleanedData.gender = "No Binario";
        else if (/prefiero no/i.test(genderLower)) cleanedData.gender = "Prefiero no especificar";
        // Mantener otros valores si son específicos y no negativos
        else if (!/^(no|nada|ningun[oa])$/i.test(genderLower) && genderLower !== '') {
             cleanedData.gender = cleanedData.gender; // Mantener como está
        }
        else cleanedData.gender = ""; // Limpiar si no es reconocible o es negativo
    }

    // PESO (Formatear con unidad)
    if (cleanedData.weight) {
        const weightMatch = cleanedData.weight.match(/(\d+([.,]\d+)?)\s*(kg|kilos|lb|libras)?/i);
        if (weightMatch) {
            const value = weightMatch[1].replace(',', '.');
            const unit = (weightMatch[3] || 'kg').toLowerCase(); // Default a kg si no hay unidad
            cleanedData.weight = `${value} ${unit.startsWith('k') ? 'kg' : 'lb'}`; // Formato: "75 kg" o "165 lb"
        } else if (/^\d+([.,]\d+)?$/.test(cleanedData.weight)){ // Si solo es número
             cleanedData.weight = `${cleanedData.weight} kg`; // Asumir kg
        } else {
            console.log(`Limpiando peso no válido: ${cleanedData.weight}`);
            cleanedData.weight = "";
        }
    }

    // ALTURA (Formatear con unidad)
    if (cleanedData.height) {
        const heightMatch = cleanedData.height.match(/(\d+([.,]\d+)?)\s*(cm|m|metros|ft|pie|pies)?/i);
        if (heightMatch) {
            const value = parseFloat(heightMatch[1].replace(',', '.'));
            let unit = (heightMatch[3] || '').toLowerCase();
            if (!unit) { // Si no hay unidad, inferir
                if (value >= 1.4 && value <= 2.3) unit = 'm';
                else if (value >= 140 && value <= 230) unit = 'cm';
                else unit = 'cm'; // Default a cm
            }
            if (unit.startsWith('m')) cleanedData.height = `${value} m`;
            else if (unit === 'cm') cleanedData.height = `${value} cm`;
            else if (unit.startsWith('f') || unit.startsWith('p')) cleanedData.height = `${value} ft`; // Normalizar a ft
            else cleanedData.height = `${value} cm`; // Fallback
        } else if (/^\d+([.,]\d+)?$/.test(cleanedData.height)){ // Si solo es número
             const numValue = parseFloat(cleanedData.height);
             if (numValue >= 1.4 && numValue <= 2.3) cleanedData.height = `${numValue} m`;
             else if (numValue >= 140 && numValue <= 230) cleanedData.height = `${numValue} cm`;
             else cleanedData.height = `${numValue} cm`; // Default a cm
        } else {
            console.log(`Limpiando altura no válida: ${cleanedData.height}`);
            cleanedData.height = "";
        }
    }

    // OBJETIVO (Limpiar si parece una condición médica/limitación)
    if (cleanedData.trainingGoal && /dolor|lesi[oó]n|operado|limitaci[óo]n|molestia|recupera|cirug[ií]a|m[eé]dic[oa]/i.test(cleanedData.trainingGoal)) {
        console.log(`Limpiando objetivo sospechoso (parece condición): ${cleanedData.trainingGoal}`);
        cleanedData.trainingGoal = "";
    }

    // Conflicto PREFERENCIA == EVITACIÓN
    if (cleanedData.exercisePreference && cleanedData.exerciseAvoidance &&
        cleanedData.exercisePreference.toLowerCase() === cleanedData.exerciseAvoidance.toLowerCase()) {
        console.log(`Conflicto: Preferencia == Evitación ('${cleanedData.exercisePreference}'). Eliminando evitación.`);
        cleanedData.exerciseAvoidance = "";
    }

    // DÍAS POR SEMANA (Extraer solo número)
    if (cleanedData.daysPerWeek) {
        const daysMatch = cleanedData.daysPerWeek.match(/(\d+)|(un[oa]?|dos|tres|cuatro|cinco|seis|siete)/i);
        if (daysMatch) {
            const dayMap = { uno: '1', una: '1', dos: '2', tres: '3', cuatro: '4', cinco: '5', seis: '6', siete: '7' };
            cleanedData.daysPerWeek = daysMatch[1] || dayMap[(daysMatch[2] || '').toLowerCase()] || ''; // Obtener el número
            if (parseInt(cleanedData.daysPerWeek, 10) > 7 || parseInt(cleanedData.daysPerWeek, 10) < 1) { // Validar rango 1-7
                 console.log(`Días por semana (${cleanedData.daysPerWeek}) fuera de rango [1-7]. Limpiando.`);
                 cleanedData.daysPerWeek = '';
            }
        } else {
            console.log(`Limpiando días por semana no válidos: ${cleanedData.daysPerWeek}`);
            cleanedData.daysPerWeek = '';
        }
    }

    // TIEMPO POR SESIÓN (Formatear con unidad min/hr)
    if (cleanedData.sessionTime) {
        const timeMatch = cleanedData.sessionTime.match(/(\d+)\s*(min|minutos|hr|hora|horas)?/i);
        if (timeMatch) {
            const value = timeMatch[1];
            const unit = (timeMatch[2] || 'min').toLowerCase(); // Default a min si no hay unidad
            cleanedData.sessionTime = `${value} ${unit.startsWith('h') ? 'hr' : 'min'}`; // Formato "60 min" o "1 hr"
        } else if (/^\d+$/.test(cleanedData.sessionTime)) { // Si solo es número
             cleanedData.sessionTime = `${cleanedData.sessionTime} min`; // Asumir minutos
        } else {
            console.log(`Limpiando tiempo por sesión no válido: ${cleanedData.sessionTime}`);
            cleanedData.sessionTime = '';
        }
    }

    // Redundancia NIVEL EXPERIENCIA / CONDICIÓN FÍSICA
    if (cleanedData.experienceLevel && cleanedData.fitnessLevel &&
        cleanedData.experienceLevel.toLowerCase() === cleanedData.fitnessLevel.toLowerCase()) {
        console.log(`Nivel y condición física redundantes. Usando experiencia: '${cleanedData.experienceLevel}'`);
        cleanedData.fitnessLevel = ""; // Limpiar condición física si es igual al nivel
    } else if (cleanedData.fitnessLevel && /principiante|intermedio|avanzado/i.test(cleanedData.fitnessLevel.toLowerCase())) {
         // Si la condición física es un nivel (principiante, etc.) y no tenemos nivel de experiencia, moverlo a experiencia
         if (!cleanedData.experienceLevel) {
             console.log(`Moviendo condición física '${cleanedData.fitnessLevel}' a nivel de experiencia.`);
             cleanedData.experienceLevel = cleanedData.fitnessLevel;
             cleanedData.fitnessLevel = "";
         } else {
             // Si ambos existen y son niveles diferentes, mantener ambos (aunque raro)
             console.log(`Nivel experiencia (${cleanedData.experienceLevel}) y condición física (${cleanedData.fitnessLevel}) parecen ambos niveles. Manteniendo ambos.`);
         }
    }


    // Asegurar que IMC sea null si no es un número válido o si se limpió peso/altura
     if (!cleanedData.weight || !cleanedData.height || (cleanedData.imc && isNaN(parseFloat(cleanedData.imc)))) {
         cleanedData.imc = null;
     }


    return cleanedData;
}


/**
 * Parsea una cadena de entrada de la base de conocimiento.
 * Intenta extraer Condición, Capacidad, Fase, Objetivo, Carga.
 * @param {string} inputStr - La cadena de entrada (ej. "Condición: Arritmias, Capacidad: Fuerza, Carga")
 * @returns {object} - Objeto con las partes extraídas.
 */
function parseInputString(inputStr) {
    const parts = { condition: null, capacity: null, phase: null, objective: null, loadContext: null, model: null, raw: inputStr };
    if (!inputStr || typeof inputStr !== 'string') return parts;

    const inputLower = inputStr.toLowerCase().trim();
    let remainingInput = inputLower;

    // Extraer componentes usando expresiones regulares más flexibles
    const extractComponent = (regex) => {
        const match = remainingInput.match(regex);
        if (match) {
            const value = match[1].trim();
            // Eliminar el componente encontrado y la coma/espacio siguiente de remainingInput
            remainingInput = remainingInput.replace(match[0], '').replace(/^[,;\s]+/, '').trim();
            return value;
        }
        return null;
    };

    // Extraer en un orden específico para evitar solapamientos
    // Priorizar Modelo de Periodización por si contiene otras keywords
    parts.model = extractComponent(/^(?:periodization model|modelo periodizaci[oó]n):\s*([^,;]+)/i);
    parts.condition = extractComponent(/^(?:condici[oó]n|condition):\s*([^,;]+)/i);
    parts.capacity = extractComponent(/^(?:capacidad|capacity):\s*([^,;]+)/i);
    parts.phase = extractComponent(/^(?:fase|phase):\s*([^,;]+)/i);
    parts.objective = extractComponent(/^(?:objetivo|goal):\s*([^,;]+)/i);
    parts.loadContext = extractComponent(/^(?:carga|load context|contexto):\s*([^,;]+)/i);


    // Si no se extrajo condición pero la cadena empieza con algo que no es una keyword conocida,
    // asumir que es la condición (manejo de formatos implícitos)
    if (!parts.condition && !parts.model && !/^(capacidad|fase|objetivo|carga)/i.test(inputLower)) {
         const potentialConditionMatch = inputLower.match(/^([^,;]+)/);
         if (potentialConditionMatch) {
             // Verificar si lo extraído parece una condición común antes de asignarlo
             const potentialCondition = potentialConditionMatch[1].trim();
              // Lista simple de keywords comunes en otras partes para evitar mala asignación
             const nonConditionKeywords = ['fuerza', 'resistencia', 'hipertrofia', 'potencia', 'velocidad', 'técnica', 'adaptación', 'principiante', 'intermedio', 'avanzado'];
             if (!nonConditionKeywords.some(kw => potentialCondition.includes(kw))) {
                 parts.condition = potentialCondition;
                 remainingInput = remainingInput.replace(potentialCondition, '').replace(/^[,;\s]+/, '').trim();
                 // Re-intentar extraer los otros componentes del resto de la cadena
                 parts.capacity = parts.capacity || extractComponent(/^(?:capacidad|capacity):\s*([^,;]+)/i);
                 parts.phase = parts.phase || extractComponent(/^(?:fase|phase):\s*([^,;]+)/i);
                 parts.objective = parts.objective || extractComponent(/^(?:objetivo|goal):\s*([^,;]+)/i);
                 parts.loadContext = parts.loadContext || extractComponent(/^(?:carga|load context|contexto):\s*([^,;]+)/i);
             }
         }
    }

     // Si queda algo en remainingInput, podría ser contexto adicional o parte no reconocida
     if (remainingInput) {
         // Podríamos intentar asignarlo a 'loadContext' si está vacío, o simplemente loguearlo
         if (!parts.loadContext) {
             parts.loadContext = remainingInput;
             // console.log(`Asignando texto restante '${remainingInput}' a loadContext`);
         } else {
              console.log(`Texto restante no reconocido en parseInputString: '${remainingInput}' (Original: '${inputStr}')`);
         }
     }


    // Limpieza final de valores extraídos (ej. quitar paréntesis)
    for (const key in parts) {
        if (typeof parts[key] === 'string') {
            parts[key] = parts[key].split('(')[0].trim(); // Quitar texto entre paréntesis
            // Normalizar términos comunes si es necesario
            if (key === 'capacity') {
                 if (parts.capacity.startsWith('resistencia')) parts.capacity = 'resistencia';
                 else if (/potencia|velocidad|fuerza/i.test(parts.capacity)) parts.capacity = 'fuerza/potencia'; // Agrupar fuerza/potencia
            }
        }
    }

    return parts;
}


/**
 * Encuentra directrices relevantes en la base de conocimiento para el perfil del cliente.
 * @param {Object} clientData - Datos limpios del cliente.
 * @param {Array<Object>} knowledgeBase - La base de conocimiento cargada.
 * @returns {Array<Object>} - Array de directrices relevantes ordenadas por puntuación.
 */
function findRelevantGuidelines(clientData, knowledgeBase) {
    const relevantGuidelines = [];
    const addedOutputs = new Set(); // Usar output para evitar duplicados exactos

    // 1. Normalizar datos del cliente
    const safeLowerCase = (val) => String(val || '').toLowerCase().trim();
    const clientConditionsInput = [
        clientData.medicalCondition, clientData.surgery, clientData.muscleInjury,
        clientData.tendinopathy, clientData.mobilityLimitation, clientData.posturalProblem,
        // Añadir otros campos que puedan mapear a condiciones si es necesario
    ].map(safeLowerCase).filter(c => c && !/^(no|ningun[ao]|ninguna|nada)$/i.test(c)); // Filtrar negaciones simples

    const clientGoal = safeLowerCase(clientData.trainingGoal);
    const clientExperience = safeLowerCase(clientData.experienceLevel);
    const clientAge = parseInt(clientData.age, 10) || null;
    const clientGender = safeLowerCase(clientData.gender);
    const clientImc = parseFloat(clientData.imc) || null;
    const clientDays = parseInt(clientData.daysPerWeek, 10) || null; // Añadir días

    let clientConditionsMapped = [...clientConditionsInput]; // Start with user's own words

    // 2. Mapeos Expandidos (Simplificados para brevedad, mantener los extensos del original)
     const conditionMappings = {
         "arritmia": "arritmias", "corazón": ["cardiopatía isquémica", "insuficiencia cardíaca", "arritmias", "miocardiopatías", "valvulopatías"], "infarto": "cardiopatía isquémica", "angina": "cardiopatía isquémica", "tensión alta": "hipertensión arterial", "tension alta": "hipertensión arterial", "hipertensión": "hipertensión arterial", "circulación": ["insuficiencia venosa", "enfermedad arterial periférica"], "varices": "insuficiencia venosa", "eap": "enfermedad arterial periférica", "claudicación": "enfermedad arterial periférica", "marcapasos": "portadores de marcapasos", "válvula corazón": "valvulopatías",
         "amputación": "amputaciones", "artritis juvenil": "artritis idiopática juvenil", "artritis": "artrosis y artritis", "artrosis": "artrosis y artritis", "desgaste articular": "artrosis y artritis", "dolor cuello": "cervicalgia", "cervicalgia": "cervicalgia", "escoliosis": "escoliosis", "desviación columna": "escoliosis", "dolor hombro": "hombro doloroso", "manguito rotador": "hombro doloroso", "lesión rodilla": "lesiones ligamentos rodilla", "ligamento rodilla": "lesiones ligamentos rodilla", "lesión tobillo": "lesiones ligamentos tobillo", "esguince tobillo": "lesiones ligamentos tobillo", "tendinitis": "tendinopatía", "tendinosis": "tendinopatía", "dolor tendón": "tendinopatía", "lumbalgia": "lumbalgia", "lumbago": "lumbalgia", "dolor espalda baja": "lumbalgia", "osteoporosis": "osteoporosis", "huesos débiles": "osteoporosis", "prótesis rodilla": "prótesis de rodilla y de tobillo", "prótesis tobillo": "prótesis de rodilla y de tobillo", "prótesis cadera": "prótesis de cadera",
         "alergia comida": "alergia alimentaria", "alergia alimentos": "alergia alimentaria", "estreñimiento": "estreñimiento crónico", "diabetes": "diabetes mellitus", "azúcar alto": "diabetes mellitus",
         "asma": "asma bronquial", "bronquiectasia": "bronquiectasia", "fibrosis quística": "fibrosis quística", "epoc": "enfermedad pulmonar obstructiva crónica", "enfisema": "enfermedad pulmonar obstructiva crónica", "bronquitis crónica": "enfermedad pulmonar obstructiva crónica",
         "incontinencia": "incontinencia urinaria", "pérdida orina": "incontinencia urinaria", "insuficiencia renal": "insuficiencia renal crónica", "riñón": "insuficiencia renal crónica", "diálisis": "insuficiencia renal crónica",
         "embarazo": "embarazo", "embarazada": "embarazo", "posparto": "posparto", "postparto": "posparto", "después del parto": "posparto", "menopausia": "menopausia", "mayor": "personas mayores", "tercera edad": "personas mayores", "viejo": "personas mayores", "caídas": "caídas", "riesgo caída": "caídas", "pérdida músculo": "sarcopenia", "sarcopenia": "sarcopenia", "fragilidad": "fragilidad", "frágil": "fragilidad",
         "sobrepeso": "sobrepeso", "obesidad": "obesidad",
         "general": "adultos", "ninguna": "adultos"
     };
     const goalMappings = {
         "fuerza": ["fuerza", "fuerza máxima"], "hipertrofia": ["fuerza", "musculación deportiva", "hipertrofia"], "ganar músculo": ["fuerza", "musculación deportiva", "hipertrofia"], "masa muscular": ["fuerza", "musculación deportiva", "hipertrofia"], "volumen": ["fuerza", "musculación deportiva", "hipertrofia"], "estética": ["fuerza", "musculación deportiva", "hipertrofia"], "resistencia": ["resistencia", "resistencia aeróbica"], "cardio": ["resistencia", "resistencia aeróbica"], "aguantar más": ["resistencia"], "perder peso": ["resistencia", "pérdida de peso"], "adelgazar": ["resistencia", "pérdida de peso"], "quemar grasa": ["resistencia", "pérdida de peso"], "potencia": ["fuerza", "fuerza rápida", "fuerza velocidad/potencia", "potencia"], "velocidad": ["fuerza", "fuerza rápida", "velocidad"], "explosividad": ["fuerza", "fuerza rápida", "fuerza velocidad/potencia", "potencia"], "técnica": ["técnica de ejecución"], "aprender": ["técnica de ejecución"], "adaptación": ["adaptación anatómica"], "acondicionamiento": ["adaptación anatómica", "resistencia"], "preparación física": ["adaptación anatómica", "resistencia", "fuerza"], "salud": ["adultos", "resistencia", "fuerza", "salud"]
     };
     const experienceMappings = {
        "principiante": ["entrenamiento de la técnica de ejecución", "adaptación anatómica", "beginner"], "nuevo": ["entrenamiento de la técnica de ejecución", "adaptación anatómica", "beginner"], "0": ["entrenamiento de la técnica de ejecución", "adaptación anatómica", "beginner"], "poco tiempo": ["entrenamiento de la técnica de ejecución", "adaptación anatómica", "beginner"],
        "intermedio": ["musculación deportiva", "fuerza", "resistencia", "intermediate"],
        "avanzado": ["fuerza máxima", "fuerza rápida", "potencia", "fuerza velocidad/potencia", "advanced"], "experto": ["fuerza máxima", "fuerza rápida", "potencia", "fuerza velocidad/potencia", "advanced"]
     };
     const levelMappings = { // Mapeo simple de nivel para modelos de periodización
         "principiante": "beginner",
         "intermedio": "intermediate",
         "avanzado": "advanced"
     };


    // Expandir condiciones del cliente
    clientConditionsInput.forEach(cond => {
        Object.keys(conditionMappings).forEach(key => {
            if (cond.includes(key)) {
                const mapped = conditionMappings[key];
                clientConditionsMapped = clientConditionsMapped.concat(Array.isArray(mapped) ? mapped : [mapped]);
            }
        });
    });
    // Añadir IMC status
    if (clientImc) {
        if (clientImc >= 30) clientConditionsMapped.push("obesidad");
        else if (clientImc >= 25) clientConditionsMapped.push("sobrepeso");
    }
     // Añadir edad > 65
     if (clientAge >= 65) clientConditionsMapped.push("personas mayores");
     // Añadir embarazo/posparto si género es femenino
     if (clientGender === 'femenino') {
         if (clientConditionsInput.some(c => c.includes('embarazo') || c.includes('embarazada'))) clientConditionsMapped.push("embarazo");
         if (clientConditionsInput.some(c => c.includes('posparto') || c.includes('postparto'))) clientConditionsMapped.push("posparto");
     }
    // Añadir 'adultos' como base
    clientConditionsMapped.push("adultos");
    const uniqueClientConditions = [...new Set(clientConditionsMapped)];

    // Expandir objetivo del cliente
    let clientGoalsMapped = [clientGoal];
    if (clientGoal) {
        Object.keys(goalMappings).forEach(key => {
            if (clientGoal.includes(key)) {
                clientGoalsMapped = clientGoalsMapped.concat(goalMappings[key]);
            }
        });
    }
    const uniqueClientGoals = [...new Set(clientGoalsMapped)].filter(g => g); // Filtrar vacíos

     // Expandir experiencia del cliente a fases/niveles
     let clientExperienceMapped = [clientExperience];
     if (clientExperience) {
         Object.keys(experienceMappings).forEach(key => {
             if (clientExperience.includes(key)) {
                 clientExperienceMapped = clientExperienceMapped.concat(experienceMappings[key]);
             }
         });
     }
     const uniqueClientExperience = [...new Set(clientExperienceMapped)].filter(e => e); // Filtrar vacíos
     const clientLevelMapped = levelMappings[clientExperience] || null; // Nivel mapeado simple


    // 3. Iterar a través de la Base de Conocimiento
    if (!Array.isArray(knowledgeBase)) {
        console.warn("Knowledge base no es un array válido.");
        return [];
    }

    knowledgeBase.forEach(entry => {
        if (!entry || !entry.input || !entry.output) return;

        const parsedInput = parseInputString(entry.input);
        let score = 0;
        const inputLower = entry.input.toLowerCase(); // Para búsquedas simples

        // a) Match por Condición (Alta prioridad)
        if (parsedInput.condition) {
            const kbConditionLower = parsedInput.condition.toLowerCase();
            if (uniqueClientConditions.some(c => kbConditionLower === c || (c.length > 4 && kbConditionLower.includes(c)) || (kbConditionLower.length > 4 && c.includes(kbConditionLower)))) {
                score += 3; // Match directo o parcial de condición
            }
            if (kbConditionLower === 'adultos') score += 0.5; // Baseline score bajo para adulto general
        }

        // b) Match por Objetivo/Capacidad (Prioridad media)
        if (parsedInput.objective || parsedInput.capacity) {
            const kbObjectiveLower = (parsedInput.objective || '').toLowerCase();
            const kbCapacityLower = (parsedInput.capacity || '').toLowerCase();
            if (uniqueClientGoals.some(g => kbObjectiveLower.includes(g) || kbCapacityLower.includes(g))) {
                score += 2;
            }
        }

        // c) Match por Experiencia/Fase (Prioridad media-baja)
        if (parsedInput.phase) {
            const kbPhaseLower = parsedInput.phase.toLowerCase();
            if (uniqueClientExperience.some(p => kbPhaseLower.includes(p))) {
                score += 1.5;
            }
        }

         // d) Match por Modelo de Periodización (Nueva - Prioridad Alta si coincide Nivel/Objetivo/Días)
         if (parsedInput.model) {
             const kbModelLower = parsedInput.model.toLowerCase();
             let modelMatchScore = 1; // Base score por ser modelo
             // Comprobar si el input del modelo menciona nivel, objetivo o días que coincidan
             if (clientLevelMapped && inputLower.includes(clientLevelMapped)) modelMatchScore += 1;
             if (clientGoal && uniqueClientGoals.some(g => inputLower.includes(g))) modelMatchScore += 1;
             if (clientDays && (inputLower.includes(`days: ${clientDays}`) || inputLower.includes(`${clientDays} días`))) modelMatchScore += 1; // Asume formato específico en KB

             // Si el modelo parece relevante basado en keywords, aumentar score
             if (modelMatchScore > 1) {
                  score += modelMatchScore;
                  console.log(`Modelo periodización '${kbModelLower}' coincide con perfil (Score: +${modelMatchScore})`);
             } else if (inputLower.includes("general") || inputLower.includes("beginner")) {
                 // Dar un score bajo a modelos generales o de principiante si el cliente lo es
                 if (clientLevelMapped === 'beginner') score += 1;
             }
         }


        // Añadir directriz si es relevante y no es un duplicado exacto del output
        if (score > 0 && !addedOutputs.has(entry.output)) {
            relevantGuidelines.push({ input: entry.input, output: entry.output, score: score });
            addedOutputs.add(entry.output);
        }
    });

    relevantGuidelines.sort((a, b) => b.score - a.score); // Ordenar por puntuación DESC

    console.log(`Se encontraron ${relevantGuidelines.length} directrices relevantes.`);
    // console.log("Top 5:", relevantGuidelines.slice(0, 5)); // Log para depuración
    return relevantGuidelines;
}


// Exportar función principal y otras utilidades para testing
module.exports = {
    generateRoutine,
    // Exportar funciones auxiliares si se usan para testing
    processFormFieldsObject,
    processTextLines,
    mapLinesToQuestions,
    buildClientDescription,
    getAnswer,
    getWeightExcludingSession,
    getHeightExcludingSession,
    findSessionTime,
    cleanClientData,
    findRelevantGuidelines,
    parseInputString,
    createPromptAndGenerate // Asegurarse que esta también se exporte si es necesaria externamente
};
