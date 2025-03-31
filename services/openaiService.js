// services/openaiService.js
const OpenAI = require("openai");
const dotenv = require('dotenv');
const fs = require('fs'); // Importar 'fs' para verificar existencia de knowledge_base.json
const chartService = require('./chartService'); // <--- IMPORTAR chartService

// Cargar variables de entorno si no se ha hecho ya
dotenv.config();

// Configura el cliente de OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Mapeo de campos del formulario a preguntas (Mantener tu mapeo existente)
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

// --- FUNCIONES AUXILIARES (Mantenidas de tu versión original) ---

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
        if (trimmedSessionTime && trimmedValue && trimmedValue === trimmedSessionTime) {
            console.log(`Conflicto detectado: Valor (${trimmedValue}) es igual al tiempo de sesión (${trimmedSessionTime}). Ignorando.`);
            return true; // Hay conflicto
        }
        return false; // No hay conflicto
    };
    const formatWeight = (value) => {
        const trimmedValue = String(value || '').trim();
        if (/\d+(\.\d+)?\s*(kg|kilos|libras|lb)/i.test(trimmedValue)) {
            return trimmedValue.replace(/kilos/i, 'kg').replace(/libras/i, 'lb'); // Normalizar unidad
        }
        if (/^\d+(\.\d+)?$/.test(trimmedValue)) { // Si solo son números
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
        /\b\d+(\.\d+)?\s*(kg|kilos|libras|lb)\b/i.test(r.answer) &&
        r.question &&
        !r.question.toLowerCase().includes("tiempo") &&
        !r.question.toLowerCase().includes("sesión") &&
        !r.question.toLowerCase().includes("altura") // Añadir exclusión de altura
    );
    if (weightPatternResponse?.answer) {
        const weightMatch = weightPatternResponse.answer.match(/\b\d+(\.\d+)?\s*(kg|kilos|libras|lb)\b/i);
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
        if (trimmedSessionTime && trimmedValue && trimmedValue === trimmedSessionTime) {
            console.log(`Conflicto detectado: Valor (${trimmedValue}) es igual al tiempo de sesión (${trimmedSessionTime}). Ignorando.`);
            return true; // Hay conflicto
        }
        return false; // No hay conflicto
    };
    const formatHeight = (value) => {
        const trimmedValue = String(value || '').trim();
        if (/\d+(\.\d+)?\s*(cm|metros|m|pie|pies|ft)/i.test(trimmedValue)) {
             return trimmedValue.replace(/metros/i, 'm').replace(/pies|pie/i, 'ft'); // Normalizar unidad
        }
        if (/^\d+(\.\d+)?$/.test(trimmedValue)) { // Solo números
            const numValue = parseFloat(trimmedValue);
            if (numValue >= 1.4 && numValue <= 2.3) return trimmedValue + " m"; // Asumir metros
            if (numValue >= 140 && numValue <= 230) return trimmedValue + " cm"; // Asumir cm
            return trimmedValue + " cm"; // Default a cm si es número pero fuera de rangos
        }
        return trimmedValue; // Devolver tal cual si no es número ni tiene formato
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
        /\b\d+(\.\d+)?\s*(cm|metros|m|pie|pies|ft)\b/i.test(r.answer) &&
        r.question &&
        !r.question.toLowerCase().includes("tiempo") &&
        !r.question.toLowerCase().includes("sesión") &&
        !r.question.toLowerCase().includes("peso") // Añadir exclusión de peso
    );
     if (heightPatternResponse?.answer) {
        const heightMatch = heightPatternResponse.answer.match(/\b\d+(\.\d+)?\s*(cm|metros|m|pie|pies|ft)\b/i);
        let extractedHeight = heightMatch ? heightMatch[0].trim() : formatHeight(heightPatternResponse.answer); // Extraer o formatear
        extractedHeight = formatHeight(extractedHeight); // Re-formatear/normalizar
        if (!checkConflict(extractedHeight)) {
            return extractedHeight; // Ya viene formateado por la regex o formatHeight
        }
    }
    return ''; // No se encontró altura válida
}

/**
 * Obtiene la respuesta a una pregunta específica usando palabras clave.
 * Es una función GENERAL. Para PESO y ALTURA, usar las funciones específicas.
 *
 * @param {string} questionKeyword - Palabra clave o frase de la pregunta
 * @param {Array<object>} responses - Array de respuestas (obj: {question, answer, field?})
 * @returns {string} - Respuesta encontrada o cadena vacía
 */
function getAnswer(questionKeyword, responses) {
    if (!Array.isArray(responses) || !questionKeyword) return '';
    const normalizedKeyword = questionKeyword.toLowerCase().trim();
    if (!normalizedKeyword) return '';

    // 1. Buscar por keyword en PREGUNTA
    const responseByQuestion = responses.find(r => r && r.question && r.question.toLowerCase().includes(normalizedKeyword));
    if (responseByQuestion?.answer?.trim()) {
        return responseByQuestion.answer.trim();
    }
    // 2. Buscar por campo (field) si coincide con keyword
    const responseByField = responses.find(r => r && r.field && r.field.toLowerCase() === normalizedKeyword);
    if (responseByField?.answer?.trim()) {
        return responseByField.answer.trim();
    }
    // 3. Buscar por keyword en RESPUESTA (Fallback)
    const responseByAnswer = responses.find(r =>
        r && r.answer && r.answer.toLowerCase().includes(normalizedKeyword)
    );
    if (responseByAnswer?.answer?.trim()) {
        return responseByAnswer.answer.trim();
    }
    return ''; // No encontrado
}

/**
 * Procesa un objeto con campos de formulario {fieldId: value}
 * Combina campos condicionales (ej. cirugia_reciente + cirugia_descripcion)
 * @param {Object} formFields - Objeto con campos del formulario
 * @returns {Array<object>} - Array de objetos { question, answer, field } filtrado
 */
function processFormFieldsObject(formFields) {
    if (typeof formFields !== 'object' || formFields === null) return [];

    const questionMap = FORM_FIELD_QUESTIONS.reduce((map, q) => {
        map[q.id] = q.text;
        return map;
    }, {});

    const processedFields = { ...formFields }; // Copiar para no mutar original

    // Campos condicionales: si la respuesta es "Sí", combina la descripción
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
            const mainValueStr = String(processedFields[main] || '').trim().toLowerCase();
            const descValue = String(processedFields[desc] || '').trim();

            // Si es 'Sí' y hay descripción, combinar y eliminar campo de descripción
            if ((mainValueStr === 'sí' || mainValueStr === 'si') && descValue) {
                processedFields[main] = `Sí: ${descValue}`;
                delete processedFields[desc];
            // Si es 'No', simplemente eliminar el campo de descripción
            } else if (mainValueStr === 'no') {
                delete processedFields[desc];
            // Si es 'Sí' pero no hay descripción, mantener solo el 'Sí'
            } else if (mainValueStr === 'sí' || mainValueStr === 'si') {
                 processedFields[main] = 'Sí'; // O mantener como estaba
                 delete processedFields[desc]; // Eliminar descripción vacía
            }
             // Si el campo principal está vacío o es otra cosa, también eliminar descripción
             else {
                  delete processedFields[desc];
             }
        }
    });

    // Convertir a formato { question, answer, field } y filtrar vacíos
    return Object.entries(processedFields)
        .map(([field, value]) => {
            const questionText = questionMap[field] || field; // Usar ID si no hay pregunta mapeada
            const trimmedValue = value !== null && value !== undefined ? String(value).trim() : '';

            if (trimmedValue !== '') { // Incluir solo campos con respuesta
                return {
                    question: questionText,
                    answer: trimmedValue,
                    field: field
                };
            }
            return null;
        })
        .filter(item => item !== null); // Filtrar los nulos (campos vacíos)
}

/**
 * Procesa un array de líneas de texto, intentando extraer o mapear a preguntas.
 * Detecta formatos "Pregunta: Respuesta", "Pregunta\nRespuesta", líneas alternas Q/A.
 * Como fallback, usa mapeo contextual.
 * @param {Array<string>} textLines - Array de líneas de texto
 * @returns {Array<object>} - Array de objetos { question, answer }
 */
function processTextLines(textLines) {
    if (!Array.isArray(textLines)) return [];

    const cleanedLines = textLines
        .map(line => (typeof line === 'string' ? line.trim() : ''))
        .filter(line => line !== ''); // Quitar líneas vacías

    if (cleanedLines.length === 0) return [];

    // 1. Intenta detectar formato "Pregunta: Respuesta"
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
        }).filter(r => r.question && r.answer);
    }

    // 2. Intenta detectar formato "Pregunta\nRespuesta" o líneas alternas Q/A
    const results = [];
    let currentQuestion = null;
    let possibleNewLineFormat = cleanedLines.some(line => line.includes('\n'));

    cleanedLines.forEach((line, index) => {
        if (line.includes('\n')) { // Formato Pregunta\nRespuesta
            const parts = line.split('\n');
            if(parts[0] && parts[1]){
                results.push({ question: parts[0].trim(), answer: parts[1].trim() });
                currentQuestion = null;
            } else if (parts[0]) { // Solo pregunta, esperar respuesta en siguiente línea (improbable aquí)
                currentQuestion = parts[0].trim();
            }
        } else if (index % 2 === 0 && !possibleNewLineFormat && !currentQuestion) { // Asumir Pregunta en línea par si no hay formato \n y no hay Q pendiente
            currentQuestion = line;
        } else if (currentQuestion) { // Asumir Respuesta si teníamos Pregunta pendiente
            results.push({ question: currentQuestion, answer: line });
            currentQuestion = null;
        } else if (index === 0 && !possibleNewLineFormat) { // Primera línea sin pareja (y sin \n)
            results.push({ question: "Información inicial", answer: line });
        } else if (!possibleNewLineFormat && index > 0){ // Línea impar sin pregunta pendiente (y sin \n) -> Info adicional
             results.push({ question: "Información adicional", answer: line });
        }
        // Ignorar línea si es posible formato \n pero esta línea no lo tiene y no hay Q pendiente
    });
    if (currentQuestion) { // Pregunta pendiente al final
        results.push({ question: currentQuestion, answer: "" });
    }
    // Si se generaron suficientes pares Q/A, usar este resultado
    if (results.length > 0 && results.length >= cleanedLines.length / 2.1) { // Umbral flexible
        console.log("Detectado formato líneas alternas Q/A o Pregunta\\nRespuesta.");
        return results.filter(r => r.question && typeof r.answer === 'string');
    }

    // 3. Fallback: Mapeo contextual
    console.warn("Formato de líneas no estándar. Intentando mapeo contextual.");
    return mapLinesToQuestions(cleanedLines);
}


/**
 * Intenta mapear líneas de texto a preguntas conocidas por contexto y palabras clave.
 * (Función de fallback si processTextLines no detecta formato estándar)
 * @param {Array<string>} lines - Líneas de texto limpias
 * @returns {Array<object>} - Array de objetos { question, answer }
 */
function mapLinesToQuestions(lines) {
    if (!Array.isArray(lines)) return [];

    // Crear patrones de keywords para cada pregunta estándar
    const questionPatterns = FORM_FIELD_QUESTIONS.map(q => {
        const keywords = q.text.toLowerCase()
            .replace(/[¿?¡!,.:;()"']/g, '') // Quitar más puntuación
            .split(/\s+/)
            .filter(word => word.length >= 3 && ![ // Palabras comunes a ignorar
                 'cómo', 'cuál', 'cuánto', 'has', 'hay', 'con', 'para', 'que', 'por', 'tus',
                 'alguna', 'alguno', 'debes', 'puede', 'afectar', 'describirías', 'principal',
                 'soportado', 'soportada', 'del', 'con', 'las', 'los', 'una', 'uno', 'eres',
                 'tiene', 'tipo', 'sobre', 'tienes', 'cualquier', 'cada', 'este', 'esta',
                 'tuyo', 'tuya', 'otro', 'otra'
            ].includes(word));
        return {
            question: q.text,
            field: q.id, // Guardar el ID del campo
            patterns: keywords.map(kw => new RegExp(`\\b${kw}\\b`, 'i')) // Buscar palabra completa
        };
    }).filter(qp => qp.patterns.length > 0); // Ignorar preguntas sin keywords útiles

    // Añadir patrones específicos para datos clave
    questionPatterns.push(
        { question: "¿Cuánto pesas?", field: "peso", patterns: [/\b(kg|kilos|libras|lb)\b/i, /\bpesa?s?\b/i, /\bpeso\b/i] },
        { question: "¿Cuál es tu altura?", field: "altura", patterns: [/\b(cm|metros|m|ft|pie)\b/i, /\baltura\b/i, /\bmides?\b/i, /\bestatura\b/i] },
        { question: "¿Cuántos días a la semana puedes entrenar?", field: "dias_entrenamiento", patterns: [/\bd[ií]as\b/i, /veces por semana/i, /\bfrecuencia\b/i, /\bsemana\b/i] },
        { question: "¿Cuánto tiempo puedes dedicar por sesión?", field: "tiempo_sesion", patterns: [/\bminutos?\b/i, /\bhoras?\b/i, /tiempo por sesi[oó]n/i, /duraci[oó]n/i, /\bsesi[oó]n\b/i] },
        { question: "¿Hay algo más que debamos saber?", field: "info_adicional", patterns: [/adicional/i, /comentario/i, /extra/i, /a[ñn]adir/i, /\bsaber\b/i, /importante/i] }
    );

    const results = [];
    const assignedLines = new Set(); // Para no asignar la misma línea a múltiples preguntas

    // Iterar sobre cada patrón de pregunta
    questionPatterns.forEach(({ question, field, patterns }) => {
        let bestMatch = { score: 0, line: null, index: -1 };

        // Buscar la mejor línea que coincida con los patrones de esta pregunta
        lines.forEach((line, index) => {
            if (assignedLines.has(index)) return; // Saltar línea ya asignada

            let currentScore = 0;
            patterns.forEach(pattern => {
                if (pattern.test(line)) {
                    currentScore++;
                }
            });

            // Priorizar más coincidencias, luego línea más corta (posiblemente más específica)
            if (currentScore > 0) {
                if (currentScore > bestMatch.score || (currentScore === bestMatch.score && line.length < (bestMatch.line?.length || Infinity))) {
                    bestMatch = { score: currentScore, line, index };
                }
            }
        });

        // Si se encontró una buena coincidencia no asignada previamente
        if (bestMatch.line !== null && !assignedLines.has(bestMatch.index)) {
            // Evitar asignar si otra pregunta ya reclamó esta línea con igual o mejor score (menos probable con este enfoque)
            const existingAssignment = results.find(r => r.answer === bestMatch.line);
            if (!existingAssignment) {
                results.push({ question: question, answer: bestMatch.line, field: field }); // Añadir field
                assignedLines.add(bestMatch.index);
            }
        }
    });

    // Añadir líneas no asignadas a "Información adicional"
    let additionalInfoAnswer = lines.filter((_, index) => !assignedLines.has(index)).join('; '); // Unir con separador
    if (additionalInfoAnswer) {
         const existingAdditional = results.find(r => r.field === 'info_adicional');
         if (existingAdditional) {
             // Si ya existe "Información adicional", añadir esto al final
             existingAdditional.answer += (existingAdditional.answer ? '; ' : '') + additionalInfoAnswer;
         } else {
             // Si no existe, crearla
             results.push({
                 question: "Información adicional (no mapeada)",
                 answer: additionalInfoAnswer,
                 field: "info_adicional"
             });
         }
    }

    return results;
}

/**
 * Construye una descripción textual del cliente para el prompt de IA.
 * Usa los datos limpios y procesados.
 * @param {Object} data - Datos del cliente limpios y procesados.
 * @returns {string} - Descripción del cliente para el prompt.
 */
function buildClientDescription(data) {
    let descriptionParts = [];

    // Género
    if (data.gender) {
        if (/masculino|hombre/i.test(data.gender)) descriptionParts.push("un cliente de género masculino");
        else if (/femenino|mujer/i.test(data.gender)) descriptionParts.push("una cliente de género femenino");
        else if (data.gender.toLowerCase() === 'no binario') descriptionParts.push("un cliente de género no binario");
        else if (data.gender.toLowerCase() !== 'prefiero no especificar') descriptionParts.push(`un cliente de género ${data.gender.toLowerCase()}`);
        else descriptionParts.push("un cliente");
    } else { descriptionParts.push("un cliente"); }

    // Edad
    if (data.age && /^\d+$/.test(String(data.age).trim())) {
        descriptionParts.push(`de ${String(data.age).trim()} años`);
    } else if (data.age) {
        descriptionParts.push(`cuya edad es ${String(data.age).trim()}`);
    }

    // Peso y Altura
    if (data.weight) descriptionParts.push(`que pesa ${data.weight}`);
    if (data.height) descriptionParts.push(`y mide ${data.height}`);

    // IMC y Clasificación (si está disponible y es válido)
    if (data.imc && !isNaN(parseFloat(data.imc))) {
        const imcValue = parseFloat(data.imc);
        let imcCategory = '';
        if (imcValue < 18.5) imcCategory = `peso inferior al normal`;
        else if (imcValue < 25) imcCategory = `peso normal`;
        else if (imcValue < 30) imcCategory = `sobrepeso`;
        else if (imcValue < 35) imcCategory = `obesidad grado 1`;
        else if (imcValue < 40) imcCategory = `obesidad grado 2`;
        else imcCategory = `obesidad grado 3 (mórbida)`;
        descriptionParts.push(`con un IMC de ${data.imc} (${imcCategory})`);
    }

    // Nivel de Experiencia y Condición Física (Evitar redundancia)
    let experienceAdded = false;
    if (data.experienceLevel) {
        descriptionParts.push(`con nivel de experiencia ${data.experienceLevel.toLowerCase()}`);
        experienceAdded = true;
    }
    if (data.fitnessLevel && (!experienceAdded || data.fitnessLevel.toLowerCase() !== data.experienceLevel?.toLowerCase())) {
        // Añadir condición física solo si aporta info nueva (no es "principiante", etc.)
        if (!/principiante|intermedio|avanzado/i.test(data.fitnessLevel)) {
            descriptionParts.push(`y condición física ${data.fitnessLevel.toLowerCase()}`);
        }
    }

    // Objetivo Principal
    if (data.trainingGoal) descriptionParts.push(`su objetivo principal es ${data.trainingGoal.toLowerCase()}`);

    // Logística de Entrenamiento
    if (data.trainingLocation) descriptionParts.push(`entrena habitualmente en ${data.trainingLocation.toLowerCase()}`);
    if (data.daysPerWeek) {
        const dayMap = { '1': 'un día', '2': 'dos días', '3': 'tres días', '4': 'cuatro días', '5': 'cinco días', '6': 'seis días', '7': 'siete días' };
        let daysText = String(data.daysPerWeek).toLowerCase();
        daysText = dayMap[daysText] || `${daysText} días`; // Convertir número a texto o añadir "días"
        descriptionParts.push(`dispone de ${daysText} a la semana`);
    }
    if (data.sessionTime) {
        let timeText = String(data.sessionTime).toLowerCase();
        if (/^\d+$/.test(timeText)) timeText += " min"; // Añadir unidad si falta
        descriptionParts.push(`para sesiones de ${timeText}`);
    }

    // Contexto Médico y Limitaciones (Agrupadas)
    const healthContext = new Set();
    const addHealthInfo = (value) => { // Simplificado para añadir directamente el valor limpio
       const trimmedValue = String(value || '').trim();
       // Añadir si no es una negación simple y no está vacío
       if (trimmedValue && !/^(no|nada|ningun[oa])$/i.test(trimmedValue)) {
            // Quitar prefijo "Sí: " si existe
            const cleanValue = trimmedValue.replace(/^Sí:\s*/i, '').trim();
            healthContext.add(cleanValue);
       }
    };
    addHealthInfo(data.surgery);
    addHealthInfo(data.muscleInjury);
    addHealthInfo(data.tendinopathy);
    addHealthInfo(data.mobilityLimitation);
    addHealthInfo(data.posturalProblem);
    addHealthInfo(data.medicalCondition);
    addHealthInfo(data.medication);

    if (healthContext.size > 0) {
        descriptionParts.push(`Consideraciones médicas/físicas relevantes: ${Array.from(healthContext).join('; ')}`);
    }

    // Preferencias y Evitaciones
    const preferences = [];
    const avoidances = [];
    if (data.exercisePreference && !/^(no|nada|ningun[oa])$/i.test(data.exercisePreference)) preferences.push(`Le gustaría practicar específicamente: ${data.exercisePreference}`);
    if (data.exerciseAvoidance && !/^(no|nada|ningun[oa])$/i.test(data.exerciseAvoidance)) avoidances.push(`Prefiere evitar: ${data.exerciseAvoidance}`);
    if (data.trainingPreference && !/^(no|nada|ningun[oa]|indiferente)$/i.test(data.trainingPreference)) preferences.push(`Preferencia de estructura: ${data.trainingPreference}`);
    if (data.specificMaterial && !/^(no|nada|ningun[oa])$/i.test(data.specificMaterial)) preferences.push(`Quiere usar material específico: ${data.specificMaterial}`);

    if (preferences.length > 0) descriptionParts.push(`Preferencias: ${preferences.join('; ')}`);
    if (avoidances.length > 0) descriptionParts.push(avoidances.join('; '));


    // Información Adicional
    const additionalInfoTrimmed = String(data.additionalInfo || '').trim();
    if (additionalInfoTrimmed && !/^(no|nada|ningun[oa])$/i.test(additionalInfoTrimmed)) {
        descriptionParts.push(`Información adicional proporcionada: "${additionalInfoTrimmed}"`);
    }

    // Unir todas las partes con ". " y asegurar punto final
    return descriptionParts.join(". ").replace(/\.\s*\./g, '.').replace(/\s+\./g, '.').trim() + '.';
}

/**
 * Limpia y verifica la consistencia de los datos del cliente.
 * Ajusta formatos y elimina datos claramente incorrectos o contradictorios.
 * @param {Object} clientDataRaw - Datos extraídos inicialmente del cliente.
 * @returns {Object} - Datos limpios y más consistentes.
 */
function cleanClientData(clientDataRaw) {
    const cleanedData = JSON.parse(JSON.stringify(clientDataRaw)); // Copia profunda

    // Limpieza general: trim y negaciones simples a ""
    const cleanInput = (value) => {
        const strValue = String(value || '').trim();
        if (strValue === '' || /^(no|nada|ningun[oa])$/i.test(strValue)) return "";
        return strValue.replace(/^Sí:\s*/i, '').trim(); // Quitar prefijo "Sí: "
    };

    for (const key in cleanedData) {
        if (typeof cleanedData[key] === 'string') {
             // No aplicar cleanInput a campos con formato específico (peso, altura, edad, días, tiempo, IMC)
             if (!['weight', 'height', 'age', 'daysPerWeek', 'sessionTime', 'imc'].includes(key)) {
                 cleanedData[key] = cleanInput(cleanedData[key]);
             } else {
                 cleanedData[key] = String(cleanedData[key] || '').trim(); // Solo trim para estos
             }
        }
    }

    // --- Verificaciones y Formateo Específico ---
    // EDAD: Asegurar que sea número
    if (cleanedData.age && !/^\d+$/.test(cleanedData.age.replace(/\s*años$/i, '').trim())) {
        console.warn(`Limpiando edad no numérica: ${cleanedData.age}`);
        cleanedData.age = "";
    } else if (cleanedData.age) {
        cleanedData.age = cleanedData.age.replace(/\s*años$/i, '').trim(); // Solo el número
    }

    // GÉNERO: Normalizar
    if (cleanedData.gender) {
        const genderLower = cleanedData.gender.toLowerCase();
        if (genderLower.includes('masculino') || genderLower.includes('hombre')) cleanedData.gender = "Masculino";
        else if (genderLower.includes('femenino') || genderLower.includes('mujer')) cleanedData.gender = "Femenino";
        else if (genderLower.includes('no binario')) cleanedData.gender = "No Binario";
        else if (genderLower.includes('prefiero no')) cleanedData.gender = ""; // Vacío si prefiere no decir
        // Mantener otros géneros si se especifican
    }

    // PESO: Formato "NNN kg" o "NNN lb"
    if (cleanedData.weight) {
        const weightMatch = cleanedData.weight.match(/(\d+([.,]\d+)?)\s*(kg|kilos|lb|libras)?/i);
        if (weightMatch) {
            const value = weightMatch[1].replace(',', '.');
            const unit = (weightMatch[3] || 'kg').toLowerCase(); // Default kg
            cleanedData.weight = `${value} ${unit.startsWith('k') ? 'kg' : 'lb'}`;
        } else {
             console.warn(`Limpiando peso no válido: ${cleanedData.weight}`);
             cleanedData.weight = ""; // Limpiar si no es válido
        }
    }

    // ALTURA: Formato "NNN cm" o "N.NN m"
    if (cleanedData.height) {
         const heightMatch = cleanedData.height.match(/(\d+([.,]\d+)?)\s*(cm|m|metros|ft|pie|pies)?/i);
         if (heightMatch) {
             const value = parseFloat(heightMatch[1].replace(',', '.'));
             let unit = (heightMatch[3] || '').toLowerCase();
             if (!unit) { // Inferir unidad si falta
                 if (value >= 1.4 && value <= 2.3) unit = 'm';
                 else if (value >= 140 && value <= 230) unit = 'cm';
                 else unit = 'cm'; // Default cm
             }
             if (unit.startsWith('m')) cleanedData.height = `${value} m`;
             else if (unit === 'cm') cleanedData.height = `${value} cm`;
             else if (unit.startsWith('f') || unit.startsWith('p')) cleanedData.height = `${value} ft`;
             else cleanedData.height = `${value} cm`; // Fallback cm
         } else {
              console.warn(`Limpiando altura no válida: ${cleanedData.height}`);
              cleanedData.height = "";
         }
    }

    // OBJETIVO: Limpiar si parece una lesión/limitación
     if (cleanedData.trainingGoal && /dolor|lesi[oó]n|operado|limitaci[óo]n|molestia|recupera|rehab/i.test(cleanedData.trainingGoal)) {
         console.warn(`Objetivo parece una limitación médica, limpiando: ${cleanedData.trainingGoal}`);
         // Podrías moverlo a 'additionalInfo' o simplemente limpiarlo
         // cleanedData.additionalInfo = (cleanedData.additionalInfo ? cleanedData.additionalInfo + '; ' : '') + `Objetivo mencionado: ${cleanedData.trainingGoal}`;
         cleanedData.trainingGoal = "";
     }


    // Conflicto PREFERENCIA == EVITACIÓN
    if (cleanedData.exercisePreference && cleanedData.exerciseAvoidance &&
        cleanedData.exercisePreference.toLowerCase() === cleanedData.exerciseAvoidance.toLowerCase()) {
        console.warn(`Conflicto Preferencia/Evitación: '${cleanedData.exercisePreference}'. Eliminando evitación.`);
        cleanedData.exerciseAvoidance = "";
    }

    // DÍAS POR SEMANA: Solo número
     if (cleanedData.daysPerWeek) {
          const daysMatch = cleanedData.daysPerWeek.match(/(\d+)|(un[oa]?|dos|tres|cuatro|cinco|seis|siete)/i);
        if (daysMatch) {
            const dayMap = { uno: '1', una: '1', dos: '2', tres: '3', cuatro: '4', cinco: '5', seis: '6', siete: '7' };
            cleanedData.daysPerWeek = daysMatch[1] || dayMap[daysMatch[2]?.toLowerCase()] || ''; // Obtener número
            if (isNaN(parseInt(cleanedData.daysPerWeek))) cleanedData.daysPerWeek = ''; // Asegurar que sea número
        } else {
             console.warn(`Limpiando días por semana no válidos: ${cleanedData.daysPerWeek}`);
             cleanedData.daysPerWeek = '';
        }
     }

    // TIEMPO POR SESIÓN: Formato "NNN min" o "NNN hr"
    if (cleanedData.sessionTime) {
        const timeMatch = cleanedData.sessionTime.match(/(\d+)\s*(min|minutos|hr|hora|horas)?/i);
        if (timeMatch) {
            const value = timeMatch[1];
            const unit = (timeMatch[2] || 'min').toLowerCase(); // Default min
            cleanedData.sessionTime = `${value} ${unit.startsWith('h') ? 'hr' : 'min'}`;
        } else {
             console.warn(`Limpiando tiempo por sesión no válido: ${cleanedData.sessionTime}`);
             cleanedData.sessionTime = '';
        }
    }

    // Redundancia NIVEL EXPERIENCIA / CONDICIÓN FÍSICA
    if (cleanedData.experienceLevel && cleanedData.fitnessLevel &&
        cleanedData.experienceLevel.toLowerCase() === cleanedData.fitnessLevel.toLowerCase()) {
         console.log(`Nivel y condición física redundantes ('${cleanedData.experienceLevel}'). Usando solo nivel de experiencia.`);
        cleanedData.fitnessLevel = ""; // Limpiar condición si es igual al nivel
    }

    // IMC: Asegurar null si no es válido
    if (cleanedData.imc && isNaN(parseFloat(cleanedData.imc))) {
        cleanedData.imc = null;
    }

    return cleanedData;
}


/**
 * Parsea la entrada de la base de conocimiento (formato flexible).
 * @param {string} inputStr - Cadena de entrada de knowledge_base.json
 * @returns {object} - Objeto con { condition, capacity, phase, objective, loadContext, raw }
 */
function parseInputString(inputStr) {
    const parts = { condition: null, capacity: null, phase: null, objective: null, loadContext: null, raw: inputStr };
    if (!inputStr || typeof inputStr !== 'string') return parts;

    const inputLower = inputStr.toLowerCase().trim();
    let remainingInput = inputLower;

    // Priorizar prefijos explícitos: "condición:", "fase:", "objetivo:", "capacidad:", "carga:"
    const prefixes = ['condición', 'fase', 'objetivo', 'capacidad', 'carga'];
    let foundPrefix = false;

    for (const prefix of prefixes) {
        const regex = new RegExp(`^${prefix}:\\s*([^,]+)`);
        const match = remainingInput.match(regex);
        if (match) {
            foundPrefix = true;
            const value = match[1].trim();
            remainingInput = remainingInput.substring(match[0].length).trim().replace(/^,/, '').trim();

            if (prefix === 'condición') parts.condition = value;
            else if (prefix === 'fase') parts.phase = value;
            else if (prefix === 'objetivo') parts.objective = value;
            else if (prefix === 'capacidad') parts.capacity = value;
            else if (prefix === 'carga') parts.loadContext = value;
            break; // Asumir un prefijo principal por línea por simplicidad
        }
    }

    // Si no se encontró prefijo explícito, intentar inferir o asignar a 'condición'
    if (!foundPrefix) {
        if (/\b(fuerza|hipertrofia|resistencia|potencia|velocidad|cardio|técnica|adaptación|movilidad)\b/i.test(inputLower)) {
             parts.objective = inputLower; // Asumir objetivo si hay keywords de entrenamiento
        } else {
            parts.condition = inputLower; // Default a condición
        }
    }

    // Mapeo adicional de Objetivo a Capacidad/Fase si no están explícitos
     if (parts.objective && !parts.capacity && !parts.phase) {
        const objectiveLower = parts.objective.toLowerCase();
        if (/fuerza|potencia|velocidad|hipertrofia|musculación|volumen/i.test(objectiveLower)) parts.capacity = 'fuerza/potencia';
        else if (/resistencia|cardio|aguantar|perder peso|adelgazar|quemar grasa/i.test(objectiveLower)) parts.capacity = 'resistencia';
        else if (/técnica|aprender|control/i.test(objectiveLower)) parts.phase = 'técnica de ejecución';
        else if (/adaptación|acondicionamiento|preparación|inicial/i.test(objectiveLower)) parts.phase = 'adaptación anatómica';
     }

     // Limpieza final de capacidad
     if (parts.capacity) {
         parts.capacity = parts.capacity.split('(')[0].trim(); // Quitar texto en paréntesis
         if (parts.capacity.startsWith('resistencia')) parts.capacity = 'resistencia';
         else if (/potencia|velocidad|fuerza/i.test(parts.capacity)) parts.capacity = 'fuerza/potencia';
     }


    return parts;
}

/**
 * Encuentra directrices relevantes en la base de conocimiento para el perfil del cliente.
 * @param {Object} clientData - Datos limpios del cliente.
 * @param {Array<Object>} knowledgeBase - Array de entradas { input, output } de knowledge_base.json.
 * @returns {Array<Object>} - Array de directrices { input, output, score } ordenadas por relevancia.
 */
function findRelevantGuidelines(clientData, knowledgeBase) {
    const relevantGuidelines = [];
    const addedInputs = new Set(); // Para evitar duplicados exactos

    if (!Array.isArray(knowledgeBase)) {
        console.warn("Base de conocimiento (knowledgeBase) no es un array válido.");
        return [];
    }

    // 1. Normalizar datos del cliente relevantes para el mapeo
    const safeLowerCase = (val) => String(val || '').toLowerCase().trim();
    const clientConditionsInput = [ // Recoger todas las posibles condiciones/lesiones/limitaciones
        clientData.medicalCondition, clientData.surgery, clientData.muscleInjury,
        clientData.tendinopathy, clientData.mobilityLimitation, clientData.posturalProblem
    ].map(safeLowerCase).filter(c => c && !/^(no|ningun[ao])$/i.test(c)); // Filtrar vacíos y negaciones

    const clientGoal = safeLowerCase(clientData.trainingGoal);
    const clientExperience = safeLowerCase(clientData.experienceLevel);
    const clientAge = parseInt(clientData.age, 10) || null;
    const clientGender = safeLowerCase(clientData.gender);
    const clientImc = parseFloat(clientData.imc) || null;

    // 2. Mapeos Expandidos (Mantener/Ajustar tus mapeos)
    // Estos mapeos traducen las respuestas del usuario a los términos usados en knowledge_base.json
    const conditionMappings = {
        "arritmia": "arritmias", "corazón": ["cardiopatía isquémica", "insuficiencia cardíaca", "arritmias", "miocardiopatías", "valvulopatías"], "infarto": "cardiopatía isquémica", "angina": "cardiopatía isquémica", "tensión alta": "hipertensión arterial", "tension alta": "hipertensión arterial", "hipertensión": "hipertensión arterial", "circulación": ["insuficiencia venosa", "enfermedad arterial periférica"], "varices": "insuficiencia venosa", "eap": "enfermedad arterial periférica", "claudicación": "enfermedad arterial periférica", "marcapasos": "portadores de marcapasos", "válvula corazón": "valvulopatías",
        "amputación": "amputaciones", "artritis juvenil": "artritis idiopática juvenil", "artritis": "artrosis y artritis", "artrosis": "artrosis y artritis", "desgaste articular": "artrosis y artritis", "dolor cuello": "cervicalgia", "cervicalgia": "cervicalgia", "escoliosis": "escoliosis", "desviación columna": "escoliosis", "dolor hombro": "hombro doloroso", "manguito rotador": "hombro doloroso", "lesión rodilla": "lesiones ligamentos rodilla", "ligamento rodilla": "lesiones ligamentos rodilla", "lesión tobillo": "lesiones ligamentos tobillo", "esguince tobillo": "lesiones ligamentos tobillo", "tendinitis": "tendinopatía", "tendinosis": "tendinopatía", "dolor tendón": "tendinopatía", "lumbalgia": "lumbalgia", "lumbago": "lumbalgia", "dolor espalda baja": "lumbalgia", "osteoporosis": "osteoporosis", "huesos débiles": "osteoporosis", "prótesis rodilla": "prótesis de rodilla y de tobillo", "prótesis tobillo": "prótesis de rodilla y de tobillo", "prótesis cadera": "prótesis de cadera",
        "alergia comida": "alergia alimentaria", "alergia alimentos": "alergia alimentaria", "estreñimiento": "estreñimiento crónico", "diabetes": "diabetes mellitus", "azúcar alto": "diabetes mellitus",
        "asma": "asma bronquial", "bronquiectasia": "bronquiectasia", "fibrosis quística": "fibrosis quística", "epoc": "enfermedad pulmonar obstructiva crónica", "enfisema": "enfermedad pulmonar obstructiva crónica", "bronquitis crónica": "enfermedad pulmonar obstructiva crónica",
        "incontinencia": "incontinencia urinaria", "pérdida orina": "incontinencia urinaria", "insuficiencia renal": "insuficiencia renal crónica", "riñón": "insuficiencia renal crónica", "diálisis": "insuficiencia renal crónica",
        "embarazo": "embarazo", "embarazada": "embarazo", "posparto": "posparto", "postparto": "posparto", "después del parto": "posparto", "menopausia": "menopausia", "mayor": "personas mayores", "tercera edad": "personas mayores", "viejo": "personas mayores", "caídas": "caídas", "riesgo caída": "caídas", "pérdida músculo": "sarcopenia", "sarcopenia": "sarcopenia", "fragilidad": "fragilidad", "frágil": "fragilidad",
        "sobrepeso": "sobrepeso", "obesidad": "obesidad",
        "general": "adultos", "ninguna": "adultos" // Mapeo genérico
    };
    const goalMappings = { // Mapea objetivo del usuario a términos de KB
        "fuerza": ["fuerza"], "hipertrofia": ["fuerza", "musculación deportiva"], "ganar músculo": ["fuerza", "musculación deportiva"], "masa muscular": ["fuerza", "musculación deportiva"], "volumen": ["fuerza", "musculación deportiva"], "estética": ["fuerza", "musculación deportiva"],
        "resistencia": ["resistencia"], "cardio": ["resistencia"], "aguantar más": ["resistencia"], "perder peso": ["resistencia", "pérdida de peso"], "adelgazar": ["resistencia", "pérdida de peso"], "quemar grasa": ["resistencia", "pérdida de peso"],
        "potencia": ["fuerza", "fuerza rápida", "fuerza velocidad/potencia"], "velocidad": ["fuerza", "fuerza rápida"], "explosividad": ["fuerza", "fuerza rápida", "fuerza velocidad/potencia"],
        "técnica": ["técnica de ejecución"], "aprender": ["técnica de ejecución"],
        "adaptación": ["adaptación anatómica"], "acondicionamiento": ["adaptación anatómica", "resistencia"], "preparación física": ["adaptación anatómica", "resistencia", "fuerza"],
        "salud": ["adultos", "resistencia", "fuerza", "salud"] // Objetivo general de salud
    };
    const experienceMappings = { // Mapea nivel de experiencia a fases de KB
        "principiante": ["entrenamiento de la técnica de ejecución", "adaptación anatómica"], "nuevo": ["entrenamiento de la técnica de ejecución", "adaptación anatómica"], "0": ["entrenamiento de la técnica de ejecución", "adaptación anatómica"], "poco tiempo": ["entrenamiento de la técnica de ejecución", "adaptación anatómica"],
        "intermedio": ["musculación deportiva", "fuerza", "resistencia"], // Puede solapar con objetivos
        "avanzado": ["fuerza máxima", "fuerza rápida", "potencia", "fuerza velocidad/potencia"], "experto": ["fuerza máxima", "fuerza rápida", "potencia", "fuerza velocidad/potencia"]
    };

    // Expandir condiciones del cliente usando mapeos
    let clientConditionsMapped = [...clientConditionsInput]; // Empezar con las originales
    clientConditionsInput.forEach(condInput => {
        Object.keys(conditionMappings).forEach(key => {
            // Usar includes() para coincidencias parciales (ej. "dolor lumbar" -> "lumbalgia")
            if (condInput.includes(key)) {
                const mappedValues = conditionMappings[key];
                clientConditionsMapped = clientConditionsMapped.concat(Array.isArray(mappedValues) ? mappedValues : [mappedValues]);
            }
        });
    });
    // Añadir mapeo por IMC
    if (clientImc) {
        if (clientImc >= 30) clientConditionsMapped.push("obesidad");
        else if (clientImc >= 25) clientConditionsMapped.push("sobrepeso");
    }
    // Añadir condición genérica "adultos" y poblaciones especiales
    clientConditionsMapped.push("adultos");
    if (clientAge >= 65) clientConditionsMapped.push("personas mayores");
    if (clientGender === 'femenino') { // Potencialmente añadir embarazo/posparto si se pregunta
        // clientConditionsMapped.push("embarazo"); // Solo si se confirma
        // clientConditionsMapped.push("posparto"); // Solo si se confirma
        // clientConditionsMapped.push("menopausia"); // Podría inferirse por edad
    }

    const uniqueClientConditions = [...new Set(clientConditionsMapped)]; // Lista final única de condiciones/contextos

    // 3. Iterar sobre la Base de Conocimiento
    knowledgeBase.forEach(entry => {
        if (!entry || !entry.input || !entry.output) return; // Saltar entradas inválidas

        const parsedInput = parseInputString(entry.input); // Parsear la entrada de KB
        let score = 0; // Puntuación de relevancia

        // a) Coincidencia por Condición/Contexto
        if (parsedInput.condition) {
            const kbConditionLower = parsedInput.condition.toLowerCase();
            // Coincidencia exacta o parcial con las condiciones mapeadas del cliente
            if (uniqueClientConditions.some(clientCond =>
                kbConditionLower === clientCond ||
                (clientCond.length > 3 && kbConditionLower.includes(clientCond)) || // KB incluye Cliente
                (kbConditionLower.length > 3 && clientCond.includes(kbConditionLower)) // Cliente incluye KB
             )) {
                score += 3; // Alta puntuación por coincidencia de condición
            }
             // Puntuación base si es una directriz general para "adultos"
            if (kbConditionLower === 'adultos' && score === 0) score += 0.5; // Menor score si no hay otra coincidencia
        }

        // b) Coincidencia por Objetivo -> Objetivo/Capacidad de KB
        if (clientGoal && (parsedInput.objective || parsedInput.capacity)) {
            let goalsToCheck = [clientGoal]; // Empezar con el objetivo literal
            // Añadir objetivos mapeados
            Object.keys(goalMappings).forEach(key => { if (clientGoal.includes(key)) goalsToCheck = goalsToCheck.concat(goalMappings[key]); });
            goalsToCheck = [...new Set(goalsToCheck)]; // Únicos

            const kbObjectiveLower = safeLowerCase(parsedInput.objective);
            const kbCapacityLower = safeLowerCase(parsedInput.capacity);

            if (goalsToCheck.some(goal =>
                 (kbObjectiveLower && kbObjectiveLower.includes(goal)) ||
                 (kbCapacityLower && kbCapacityLower.includes(goal))
             )) {
                score += 2; // Buena puntuación por coincidencia de objetivo/capacidad
            }
        }

        // c) Coincidencia por Experiencia -> Fase de KB
        if (clientExperience && parsedInput.phase) {
            let phasesToCheck = [clientExperience]; // Empezar con experiencia literal
            // Añadir fases mapeadas
            Object.keys(experienceMappings).forEach(key => { if (clientExperience.includes(key)) phasesToCheck = phasesToCheck.concat(experienceMappings[key]); });
            phasesToCheck = [...new Set(phasesToCheck)]; // Únicos

            const kbPhaseLower = safeLowerCase(parsedInput.phase);

            if (phasesToCheck.some(phase => kbPhaseLower.includes(phase))) {
                score += 1.5; // Puntuación media por coincidencia de fase/experiencia
            }
        }

        // Añadir directriz si es relevante (score > 0) y no es un duplicado exacto
        if (score > 0 && !addedInputs.has(entry.input)) {
            relevantGuidelines.push({ input: entry.input, output: entry.output, score: score });
            addedInputs.add(entry.input);
        }
    });

    // Ordenar por puntuación descendente
    relevantGuidelines.sort((a, b) => b.score - a.score);

    console.log(`Se encontraron ${relevantGuidelines.length} directrices relevantes en la base de conocimiento.`);
    return relevantGuidelines;
}


// --- FUNCIÓN PRINCIPAL (Modificada) ---

/**
 * Genera una rutina de entrenamiento personalizada y datos para el gráfico radar.
 * Función principal que acepta diferentes formatos de entrada.
 *
 * @param {Array|Object} formData - Datos del formulario.
 * @param {Object} options - Opciones adicionales.
 * @returns {Promise<object>} - Objeto con { htmlContent, chartImage }.
 */
const generateRoutine = async (formData, options = {}) => {
  if (!formData) {
    console.error("Error: No se proporcionaron datos del formulario");
    throw new Error("No se proporcionaron datos del formulario");
  }

  console.log("Generando rutina con datos:", Array.isArray(formData) ? `${formData.length} respuestas` : `${Object.keys(formData).length} campos`);

  try {
    let responses = [];
    // --- Procesamiento de Entrada (Como antes) ---
     if (Array.isArray(formData) && typeof formData[0] === 'string' && formData[0].includes('\n')) {
          console.log("Procesando formato 'Pregunta\\nRespuesta'");
          responses = formData.map(item => {
               const parts = item.split('\n');
               const question = parts[0] ? parts[0].trim() : "Pregunta desconocida";
               const answer = parts[1] ? parts[1].trim() : "";
               const fieldMapping = FORM_FIELD_QUESTIONS.find(q => q.text === question);
               return { question, answer, field: fieldMapping ? fieldMapping.id : undefined };
          }).filter(r => r.question && typeof r.answer === 'string');
     }
     else if (Array.isArray(formData) && typeof formData[0] === 'object' && formData[0].hasOwnProperty('question') && formData[0].hasOwnProperty('answer')) {
          console.log("Procesando array de objetos pregunta-respuesta");
           responses = formData.map(item => {
               if (item && item.question && typeof item.answer === 'string') {
                    if (!item.field) {
                         const fieldMapping = FORM_FIELD_QUESTIONS.find(q => q.text === item.question);
                         return {...item, field: fieldMapping ? fieldMapping.id : undefined };
                    }
                    return item;
               }
                return null;
           }).filter(item => item !== null);
     }
     else if (typeof formData === 'object' && !Array.isArray(formData) && Object.keys(formData).length > 0) {
           console.log("Procesando objeto de pares campo-valor");
           responses = processFormFieldsObject(formData);
     }
     else if (Array.isArray(formData) && typeof formData[0] === 'string') {
          console.log("Procesando array de líneas de texto (mapeo contextual)");
          const mappedResponses = processTextLines(formData);
           responses = mappedResponses.map(item => {
               // Añadir mapeo de campo si es posible desde mapLinesToQuestions o FORM_FIELD_QUESTIONS
               const fieldMapping = item.field ? item : FORM_FIELD_QUESTIONS.find(q => q.text === item.question);
                if (item && item.question && typeof item.answer === 'string') {
                     return {...item, field: fieldMapping?.id || item.field || undefined };
                }
                return null;
           }).filter(item => item !== null);
     }
     else {
           console.error("Formato de datos no soportado o datos vacíos:", formData);
           throw new Error("Formato de datos no soportado o datos vacíos para generar rutina");
     }
      // Asegurar que 'responses' sea un array
       if (!Array.isArray(responses)) {
          console.error("Error interno: 'responses' no es un array después del procesamiento inicial.");
          responses = [];
       }


    // Formatear respuestas para el prompt (filtrando datos sensibles)
    const formattedResponsesForPrompt = responses
      .filter(item =>
           item &&
           item.answer && String(item.answer).trim() !== '' &&
           item.field !== 'nombre' && // No incluir nombre en el prompt
           item.field !== 'email' &&  // No incluir email en el prompt
           item.question // Asegurar que haya una pregunta asociada
           // Podrías añadir más filtros si es necesario
      )
      .map(item => `Pregunta: ${item.question || item.field}\nRespuesta: ${item.answer}`); // Usar field si no hay question

    console.log(`Procesando ${formattedResponsesForPrompt.length} respuestas para prompt (filtradas)`);

    // --- Generar HTML de la rutina usando OpenAI ---
    const htmlContent = await createPromptAndGenerate(formattedResponsesForPrompt, responses, options);

    // --- Analizar rutina y generar gráfico ---
    console.log("Analizando HTML generado para gráfico radar...");
    const radarData = chartService.analyzeRoutine(htmlContent); // Analizar el HTML

    console.log("Generando imagen del gráfico radar...");
    const chartImage = await chartService.generateRadarChart(radarData); // Generar imagen base64

    // --- Devolver tanto el HTML como la imagen del gráfico ---
    return { htmlContent, chartImage }; // <--- DEVOLVER OBJETO

  } catch (error) {
    console.error("Error en generateRoutine:", error.message);
    // Lanzar un error más específico o el mismo error
    throw new Error(`Error al generar rutina completa: ${error.message}`);
  }
};

// --- FUNCIÓN PARA CREAR PROMPT Y LLAMAR A OPENAI (Modificada para devolver solo HTML) ---

/**
 * Crea el prompt para OpenAI y genera la rutina HTML.
 * (Nota: El valor de retorno de esta función ahora es solo la cadena HTML)
 *
 * @param {Array<string>} formattedResponsesForPrompt - Respuestas formateadas para el prompt.
 * @param {Array<object>} allResponses - Todas las respuestas procesadas.
 * @param {Object} options - Opciones adicionales.
 * @returns {Promise<string>} - HTML de la rutina generada.
 */
const createPromptAndGenerate = async (formattedResponsesForPrompt, allResponses = [], options = {}) => {
    // --- Extracción y Preparación de Datos del Cliente (Como antes) ---
    const sessionTime = findSessionTime(allResponses);
    const clientDataRaw = {
        gender: getAnswer("género", allResponses),
        age: getAnswer("edad", allResponses),
        weight: getWeightExcludingSession(allResponses, sessionTime),
        height: getHeightExcludingSession(allResponses, sessionTime),
        trainingGoal: getAnswer("objetivo", allResponses),
        experienceLevel: getAnswer("nivel", allResponses) || getAnswer("experiencia", allResponses),
        fitnessLevel: getAnswer("condición física", allResponses),
        trainingLocation: getAnswer("dónde sueles entrenar", allResponses) || getAnswer("lugar", allResponses),
        daysPerWeek: getAnswer("días", allResponses) || getAnswer("cuántos días", allResponses) || getAnswer("días entrenamiento", allResponses),
        sessionTime: sessionTime,
        surgery: getAnswer("cirugía reciente", allResponses) || getAnswer("cirugía", allResponses),
        muscleInjury: getAnswer("lesión muscular", allResponses),
        tendinopathy: getAnswer("tendinopatía", allResponses),
        mobilityLimitation: getAnswer("limitacion articular", allResponses) || getAnswer("limitación", allResponses) || getAnswer("movilidad", allResponses),
        posturalProblem: getAnswer("problema postural", allResponses) || getAnswer("postural", allResponses),
        medicalCondition: getAnswer("condición médica", allResponses),
        medication: getAnswer("medicación", allResponses),
        exercisePreference: getAnswer("ejercicios favoritos", allResponses) || getAnswer("practicar en específico", allResponses) || getAnswer("movimiento que quieras practicar", allResponses),
        exerciseAvoidance: getAnswer("ejercicios evitar", allResponses) || getAnswer("desagrade", allResponses),
        trainingPreference: getAnswer("tipo entrenamiento", allResponses) || getAnswer("grupo muscular", allResponses) || getAnswer("cuerpo completo", allResponses),
        specificMaterial: getAnswer("material específico", allResponses) || getAnswer("material", allResponses),
        additionalInfo: getAnswer("info adicional", allResponses) || getAnswer("algo más", allResponses)
    };

    // Calcular IMC (como antes)
    let imc = null;
    if (clientDataRaw.weight && clientDataRaw.height) {
        const weightMatch = String(clientDataRaw.weight).match(/(\d+([.,]\d+)?)/);
        const heightMatch = String(clientDataRaw.height).match(/(\d+([.,]\d+)?)/);
        const weightValue = weightMatch ? parseFloat(weightMatch[1].replace(',', '.')) : NaN;
        let heightInMeters = NaN;
        const heightValue = heightMatch ? parseFloat(heightMatch[1].replace(',', '.')) : NaN;
        if (!isNaN(heightValue)) {
            if (String(clientDataRaw.height).includes('m') && !String(clientDataRaw.height).includes('cm')) heightInMeters = heightValue;
            else if (String(clientDataRaw.height).includes('cm') || heightValue > 3) heightInMeters = heightValue / 100;
            else heightInMeters = heightValue; // Asumir metros si < 3 y sin unidad 'cm'
        }
        if (!isNaN(weightValue) && !isNaN(heightInMeters) && heightInMeters > 0) {
            imc = weightValue / (heightInMeters * heightInMeters);
            clientDataRaw.imc = imc.toFixed(2);
            console.log(`IMC calculado: ${clientDataRaw.imc}`);
        } else {
            clientDataRaw.imc = null;
            console.log("No se pudo calcular IMC (valores inválidos/faltantes).", { weightStr: clientDataRaw.weight, heightStr: clientDataRaw.height });
        }
    } else {
        clientDataRaw.imc = null;
        console.log("No se pudo calcular IMC (falta peso o altura).");
    }

    // Limpiar datos y construir descripción (como antes)
    const cleanedData = cleanClientData(clientDataRaw);
    console.log("Datos del cliente (limpios):", cleanedData);
    const clientDescription = buildClientDescription(cleanedData);
    console.log("Descripción del cliente para prompt:", clientDescription);

    // --- Integración de Base de Conocimiento (Como antes) ---
    let specificRecommendations = "";
    let healthContextForPrompt = []; // Para pasar condiciones relevantes al prompt
    try {
        const knowledgeBasePath = './knowledge_base.json'; // Ajusta la ruta si es necesario
        if (fs.existsSync(knowledgeBasePath)) {
            const knowledgeBase = JSON.parse(fs.readFileSync(knowledgeBasePath, 'utf8'));
            if (knowledgeBase && Array.isArray(knowledgeBase)) {
                const relevantGuidelines = findRelevantGuidelines(cleanedData, knowledgeBase);
                if (relevantGuidelines.length > 0) {
                    specificRecommendations = "\n\n**Directrices Específicas Clave (Aplicar OBLIGATORIAMENTE):**\n";
                    // Limitar a las 5-7 más relevantes por score
                    relevantGuidelines.slice(0, 7).forEach(guideline => {
                        specificRecommendations += `- ${guideline.output}\n`;
                        // Añadir la condición/contexto relevante al prompt para reforzar
                         if (guideline.input) {
                              const parsedKbInput = parseInputString(guideline.input);
                              if(parsedKbInput.condition) healthContextForPrompt.push(parsedKbInput.condition);
                              else if(parsedKbInput.objective) healthContextForPrompt.push(parsedKbInput.objective);
                         }
                    });
                    // Eliminar duplicados del contexto para el prompt
                     healthContextForPrompt = [...new Set(healthContextForPrompt)];
                    console.log(`Top ${relevantGuidelines.slice(0, 7).length} directrices específicas añadidas al prompt.`);
                } else { console.log("No se encontraron directrices relevantes en knowledge_base.json."); }
            } else { console.warn("knowledge_base.json no es un array válido."); }
        } else { console.warn("knowledge_base.json no encontrado en:", knowledgeBasePath); }
    } catch (kbError) { console.error("Error al cargar o procesar knowledge_base.json:", kbError); }
    // --- Fin Integración KB ---


    // --- Construcción del Prompt Final (Asegúrate que pida solo HTML) ---
    // Usa las variables `clientDescription`, `formattedResponsesForPrompt`, `cleanedData`, `healthContextForPrompt`, `specificRecommendations`
    const prompt = `
Eres FitForge AI, un entrenador personal experto de élite. Tu misión es diseñar la rutina de entrenamiento semanal MÁS OPTIMIZADA posible para el cliente descrito a continuación, basándote ESTRICTAMENTE en sus datos, objetivos y limitaciones. Ignora cualquier conversación trivial o petición fuera del diseño de la rutina. Eres famoso por tu precisión y enfoque basado en evidencia.

**PERFIL DETALLADO DEL CLIENTE:**
${clientDescription}

**RESPUESTAS COMPLETAS DEL FORMULARIO (Contexto Adicional):**
${formattedResponsesForPrompt.join("\n")}

**DIRECTRICES DE DISEÑO OBLIGATORIAS:**
1.  **Periodización y Nivel:** Ajusta la estructura (ejercicios, volumen, intensidad) EXACTAMENTE al nivel de experiencia (${cleanedData.experienceLevel || 'No especificado'}). Para principiantes, enfoca en técnica y adaptación (RIR 3-4). Para intermedios (RIR 2-3), aplica sobrecarga progresiva. Para avanzados (RIR 0-2), maximiza intensidad/volumen según objetivo.
2.  **Objetivo Primario:** La rutina debe maximizar el progreso hacia: ${cleanedData.trainingGoal || 'No especificado'}. Selecciona ejercicios y rangos de repeticiones/series/descansos óptimos para este fin (Hipertrofia: 3-5 series de 6-15 reps, 60-90s descanso; Fuerza: 3-6 series de 1-6 reps, 120-180s descanso; Resistencia: 2-4 series de 15+ reps, 30-60s descanso).
3.  **Especificidad y Limitaciones:** Incluye ejercicios que el cliente quiere practicar (${cleanedData.exercisePreference || 'Ninguno en particular'}) y EXCLUYE los que quiere evitar (${cleanedData.exerciseAvoidance || 'Ninguno'}). Adapta OBLIGATORIAMENTE a limitaciones y condiciones relevantes (${healthContextForPrompt.join(', ') || 'Ninguna indicada explícitamente'}). Si hay lesión/dolor, elige variantes seguras o evita la zona. Utiliza las Directrices Específicas Clave proporcionadas más abajo.
4.  **Logística:** Diseña para ${cleanedData.daysPerWeek || 'días no especificados'} por semana, con sesiones de ${cleanedData.sessionTime || 'duración no especificada'}. Ajusta el volumen total (Nº ejercicios principales sugerido: 30min: 4-5; 60min: 6-8; 90min: 8-10; 120min: 10-12) y la densidad al tiempo disponible. Usa el material disponible (${cleanedData.specificMaterial || 'Asumir gimnasio estándar si no se especifica'}).
5.  **Estructura Preferida:** Respeta la preferencia (${cleanedData.trainingPreference || 'No especificada'}). Si no hay preferencia, elige la más adecuada (Principiante: Full Body; Intermedio/Avanzado: Split según días/objetivo, e.g., Empuje/Tire/Pierna, Torso/Pierna, Dividida por grupos).
6.  **IMC y Consideraciones:** ${cleanedData.imc ? `Considera el IMC de ${cleanedData.imc}. Si es >30 (Obesidad) o >25 (Sobrepeso), limita el impacto articular inicial y enfoca en consistencia. Si es <18.5 (Bajo peso), asegura suficiente estímulo y recomienda (fuera de la rutina) buscar asesoramiento nutricional.` : 'IMC no disponible.'}

**FORMATO DE SALIDA (HTML ESTRICTO - SIN MARKDOWN):**
Genera ÚNICAMENTE código HTML válido. Para CADA DÍA de entrenamiento, usa esta estructura de tabla EXACTA (incluyendo las clases CSS especificadas):

<table>
    <tr>
        <th colspan="5">Día X: [Enfoque del Día, e.g., Empuje, Tracción, Pierna, Full Body]</th>
    </tr>
    <tr class="activacion-header">
        <td colspan="5"><b>Activación Específica</b> (5-10 min)</td>
    </tr>
    <tr> <th>Ejercicio</th>
        <th>Series</th>
        <th>Reps</th>
        <th>Descanso</th>
        <th>Notas Clave</th>
    </tr>
    <tr><td>[Ejercicio Activación 1]</td><td>[Nº]</td><td>[Rango]</td><td>[Tiempo]s</td><td>[Nota específica]</td></tr>
    <tr><td>[Ejercicio Activación 2]</td><td>[Nº]</td><td>[Rango]</td><td>[Tiempo]s</td><td>[Nota específica]</td></tr>
    <tr class="rutina-header">
        <td colspan="5"><b>Rutina Principal</b></td>
    </tr>
    <tr> <th>Ejercicio</th>
        <th>Series</th>
        <th>Reps</th>
        <th>Descanso</th>
        <th>Notas Clave / RIR / Tempo</th>
    </tr>
    <tr><td>[Ejercicio Principal 1]</td><td>[Nº]</td><td>[Rango]</td><td>[Tiempo]s</td><td>[Nota / RIR / Tempo e.g., 31X0]</td></tr>
    <tr><td>[Ejercicio Principal 2]</td><td>[Nº]</td><td>[Rango]</td><td>[Tiempo]s</td><td>[Nota / RIR / Tempo]</td></tr>
    </table>

<div class="side-variants-container">
    <div class="side-variants-title">Alternativas y Progresiones (Día X)</div> <div class="side-variant-item">
        <div class="side-variant-title">[Ejercicio Original 1]<span class="arrow-right"> → </span>[Variante 1]</div>
        <div class="side-variant-description">[Motivo conciso: e.g., Si sientes molestia en X..., Para mayor dificultad..., Si no tienes Y material..., Para enfocar en Z músculo...]</div>
    </div>
     <div class="side-variant-item">
        <div class="side-variant-title">[Ejercicio Original 2]<span class="arrow-right"> → </span>[Variante 2]</div>
        <div class="side-variant-description">[Motivo conciso]</div>
    </div>
    </div>

**REGLAS ADICIONALES CRÍTICAS:**
* **Precisión Absoluta:** Usa nombres técnicos correctos para ejercicios. Especifica parámetros EXACTOS: Nº Series, Rango de Reps (e.g., "8-12"), Descanso en segundos (e.g., "90s"). Usa RIR (Reps In Reserve) o Tempo (e.g., "31X0" -> 3s bajar, 1s pausa abajo, X explosivo subir, 0s pausa arriba) en la columna de Notas Clave cuando sea relevante para guiar la intensidad o ejecución.
* **Volumen Adecuado:** Cumple el número MÍNIMO de ejercicios PRINCIPALES según la duración de sesión indicada. La activación NO cuenta para este mínimo.
* **Notas Clave Útiles:** Deben ser breves (máx 15 palabras) y aportar información crucial sobre la ejecución, intensidad o enfoque (e.g., "Enfocar en retracción escapular", "Mantener core activo", "RIR 2", "Tempo 4010").
* **Variantes Pertinentes:** Proporciona UNA variante útil (progresión, regresión, alternativa por equipo, o adaptación a limitación) por CADA ejercicio principal. El motivo debe ser claro y conciso. Usa el formato con la flecha: \`Ejercicio Original<span class="arrow-right"> → </span>Variante\`.
* **HTML y Nada Más:** NO incluyas NADA fuera del código HTML solicitado (tablas y divs de variantes). Sin saludos, introducciones, explicaciones adicionales, conclusiones, resúmenes o comentarios HTML. NO uses markdown (\`\`\`). La salida debe empezar directamente con \`<table>\` y terminar con \`</div>\` del último contenedor de variantes.

${specificRecommendations}

Diseña la rutina SEMANAL completa en formato HTML AHORA.`;

    let timeoutId; // Declarado fuera para acceso en catch
    try {
        console.log("Enviando solicitud a OpenAI con prompt final...");
        const completion = await openai.chat.completions.create({
            model: process.env.OPENAI_MODEL || "gpt-4o-mini", // Usa el modelo especificado o un fallback
            messages: [
                // Rol del sistema para guiar el comportamiento general
                { role: "system", content: "Eres FitForge AI, un creador experto de rutinas de entrenamiento personalizadas en formato HTML, siguiendo instrucciones muy estrictas." },
                // Rol del usuario con el prompt detallado
                { role: "user", content: prompt }
            ],
            temperature: 0.5, // Temperatura moderada para equilibrio entre creatividad y precisión
            // max_tokens: 4096 // Puedes ajustar si necesitas respuestas más largas, pero cuidado con el límite
        });

        const responseMessage = completion.choices[0]?.message?.content;

        if (!responseMessage) {
            throw new Error("Respuesta vacía de OpenAI");
        }

        // Limpiar posible markdown residual (aunque el prompt lo prohíbe)
        const cleanedHtmlResponse = responseMessage.replace(/```html|```/g, '').trim();

        console.log("Rutina HTML generada exitosamente por OpenAI.");
        // Devolver SOLO el contenido HTML limpio
        return cleanedHtmlResponse; // <--- Devolver solo HTML

    } catch (error) {
         // --- Manejo de Errores OpenAI (Como antes) ---
         if (typeof timeoutId !== 'undefined' && timeoutId !== null) {
             clearTimeout(timeoutId);
             timeoutId = null;
         }
         console.error("Error en la llamada a OpenAI API:", error);
         if (error.name === 'AbortError' || (error instanceof OpenAI.APIError && error.status === 408)) {
             throw new Error("La generación de la rutina tardó demasiado (Timeout). Intenta de nuevo.");
         } else if (error instanceof OpenAI.RateLimitError) {
             throw new Error("Límite de uso de la API de OpenAI alcanzado. Espera y reintenta.");
         } else if (error instanceof OpenAI.APIError && error.status >= 500) {
             throw new Error("Problema temporal con el servicio de OpenAI (Error 5xx). Intenta de nuevo más tarde.");
         } else if (error instanceof OpenAI.BadRequestError) { // Error 400
              console.error("BadRequestError details:", error.message, error.body); // Loguear detalles
              // Intentar dar una pista sobre la causa común (longitud del prompt)
              const errorHint = error.message.includes('context_length_exceeded') ? 'El prompt es demasiado largo.' : error.message;
              throw new Error(`Error de solicitud a OpenAI (BadRequest 400): Revisa formato/longitud del prompt. ${errorHint}`);
         } else {
              throw new Error(`Error al generar la rutina con OpenAI: ${error.message}`);
         }
    }
};

// --- EXPORTS ---
// Exportar las funciones que se usarán desde otros módulos
module.exports = {
  generateRoutine, // Función principal
  // Exportar otras funciones si se usan directamente en tests u otros servicios
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
  createPromptAndGenerate // Podría ser útil para tests aislados
};