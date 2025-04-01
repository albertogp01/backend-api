const OpenAI = require("openai");
const dotenv = require('dotenv');
const fs = require('fs'); // Importar 'fs' para verificar existencia de knowledge_base.json

// Cargar variables de entorno si no se ha hecho ya
dotenv.config();

// Configura el cliente de OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Mapeo de campos del formulario a preguntas (Mantener consistencia con el frontend)
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
 * Intenta normalizar a "X min" o "Y hr".
 * @param {Array<object>} responses - Respuestas del cliente (objetos con question, answer, field?)
 * @returns {string} - Tiempo de sesión normalizado (e.g., "60 min", "1.5 hr") o cadena vacía
 */
function findSessionTime(responses) {
    if (!Array.isArray(responses)) return '';

    let foundTime = '';

    // 1. Buscar por campo específico 'tiempo_sesion'
    const sessionField = responses.find(r => r && r.field === 'tiempo_sesion');
    if (sessionField?.answer?.trim()) {
        foundTime = sessionField.answer.trim();
    }

    // 2. Buscar por preguntas específicas sobre el tiempo de sesión (si no se encontró antes)
    if (!foundTime) {
        const sessionQuestion = responses.find(r => r && r.question && (
            (r.question.toLowerCase().includes("tiempo") && r.question.toLowerCase().includes("sesión")) ||
            r.question.toLowerCase().includes("cuánto tiempo puedes dedicar")
        ));
        if (sessionQuestion?.answer?.trim()) {
            foundTime = sessionQuestion.answer.trim();
        }
    }

    // 3. Buscar respuestas que mencionen minutos u horas en relación a preguntas de tiempo/sesión (si no se encontró antes)
    if (!foundTime) {
        const timePattern = responses.find(r => r && r.question && r.answer &&
            (r.question.toLowerCase().includes("tiempo") || r.question.toLowerCase().includes("sesión")) &&
            /\d+([.,]\d+)?\s*(minutos?|min|horas?|hr|h)\b/i.test(r.answer) // Más robusto con decimales y unidades
        );
        if (timePattern?.answer) {
            foundTime = timePattern.answer.trim();
        }
    }

    // 4. Normalizar el tiempo encontrado
    if (foundTime) {
        const timeMatch = foundTime.match(/(\d+([.,]\d+)?)\s*(minutos?|min|horas?|hr|h)?/i);
        if (timeMatch) {
            const value = timeMatch[1].replace(',', '.');
            const unit = (timeMatch[3] || 'min').toLowerCase(); // Default a min
            if (unit.startsWith('h')) {
                return `${value} hr`; // Normalizar a "hr"
            } else {
                return `${value} min`; // Normalizar a "min"
            }
        }
        // Si no se pudo normalizar pero se encontró algo, devolverlo tal cual (menos ideal)
        return foundTime;
    }

    return ''; // No se encontró tiempo
}

/**
 * Obtiene el peso del cliente excluyendo confusiones con el tiempo de sesión.
 * @param {Array<object>} responses - Respuestas del cliente
 * @param {string} sessionTime - Tiempo de sesión identificado previamente (ya normalizado)
 * @returns {string} - Peso formateado (e.g., "75 kg", "165 lb") o cadena vacía
 */
function getWeightExcludingSession(responses, sessionTime) {
    if (!Array.isArray(responses)) return '';

    // Función para verificar conflicto con el tiempo de sesión (comparando solo el valor numérico)
    const checkConflict = (value) => {
        const valueStr = String(value || '').trim();
        const sessionTimeStr = String(sessionTime || '').trim();

        if (!valueStr || !sessionTimeStr) return false; // No hay conflicto si alguno falta

        const valueMatch = valueStr.match(/(\d+([.,]\d+)?)/);
        const sessionTimeMatch = sessionTimeStr.match(/(\d+([.,]\d+)?)/);

        if (valueMatch && sessionTimeMatch) {
            const numericValue = parseFloat(valueMatch[1].replace(',', '.'));
            const numericSessionTime = parseFloat(sessionTimeMatch[1].replace(',', '.'));
            if (numericValue === numericSessionTime) {
                 console.log(`Conflicto detectado: Valor numérico de peso (${numericValue}) es igual al tiempo de sesión (${numericSessionTime}). Ignorando.`);
                 return true; // Hay conflicto
            }
        }
        return false; // No hay conflicto
    };

    // Función para formatear y normalizar el peso
    const formatWeight = (value) => {
        const trimmedValue = String(value || '').trim();
        const weightMatch = trimmedValue.match(/(\d+([.,]\d+)?)\s*(kg|kilos|lb|libras)?/i);
        if (weightMatch) {
            const numValue = weightMatch[1].replace(',', '.');
            const unit = (weightMatch[3] || 'kg').toLowerCase(); // Default a kg
            return `${numValue} ${unit.startsWith('k') ? 'kg' : 'lb'}`;
        }
        // Si solo son números, intentar inferir (asumir kg si > 20, lb si no) - Puede ser arriesgado
        if (/^\d+([.,]\d+)?$/.test(trimmedValue)) {
            const num = parseFloat(trimmedValue.replace(',', '.'));
            return num > 20 ? `${num} kg` : `${num} lb`; // Asunción simple, podría mejorarse
        }
        return ""; // No es un formato de peso reconocible
    };

    let potentialWeight = '';

    // 1. Buscar por campo específico 'peso'
    let potentialWeightObj = responses.find(r => r && r.field === 'peso');
    if (potentialWeightObj?.answer?.trim()) {
        potentialWeight = formatWeight(potentialWeightObj.answer);
        if (potentialWeight && !checkConflict(potentialWeight)) return potentialWeight;
    }

    // 2. Buscar por pregunta exacta "¿cuánto pesas?"
    potentialWeightObj = responses.find(r => r && r.question?.toLowerCase() === "¿cuánto pesas?");
    if (potentialWeightObj?.answer?.trim()) {
        potentialWeight = formatWeight(potentialWeightObj.answer);
        if (potentialWeight && !checkConflict(potentialWeight)) return potentialWeight;
    }

    // 3. Buscar por pregunta que contenga "peso" (y no palabras conflictivas)
    potentialWeightObj = responses.find(r => r && r.question &&
        r.question.toLowerCase().includes("peso") &&
        !r.question.toLowerCase().includes("tiempo") &&
        !r.question.toLowerCase().includes("sesión")
    );
    if (potentialWeightObj?.answer?.trim()) {
        potentialWeight = formatWeight(potentialWeightObj.answer);
        if (potentialWeight && !checkConflict(potentialWeight)) return potentialWeight;
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
        potentialWeight = formatWeight(weightPatternResponse.answer); // formatWeight ya extrae y normaliza
        if (potentialWeight && !checkConflict(potentialWeight)) {
            return potentialWeight;
        }
    }

    return ''; // No se encontró peso válido y sin conflicto
}

/**
 * Obtiene la altura del cliente excluyendo confusiones con el tiempo de sesión.
 * @param {Array<object>} responses - Respuestas del cliente
 * @param {string} sessionTime - Tiempo de sesión identificado previamente (ya normalizado)
 * @returns {string} - Altura formateada (e.g., "175 cm", "1.75 m") o cadena vacía
 */
function getHeightExcludingSession(responses, sessionTime) {
    if (!Array.isArray(responses)) return '';

     // Función para verificar conflicto con el tiempo de sesión (comparando solo el valor numérico)
     const checkConflict = (value) => {
        const valueStr = String(value || '').trim();
        const sessionTimeStr = String(sessionTime || '').trim();

        if (!valueStr || !sessionTimeStr) return false; // No hay conflicto si alguno falta

        const valueMatch = valueStr.match(/(\d+([.,]\d+)?)/);
        const sessionTimeMatch = sessionTimeStr.match(/(\d+([.,]\d+)?)/);

        if (valueMatch && sessionTimeMatch) {
            const numericValue = parseFloat(valueMatch[1].replace(',', '.'));
            const numericSessionTime = parseFloat(sessionTimeMatch[1].replace(',', '.'));
            if (numericValue === numericSessionTime) {
                 console.log(`Conflicto detectado: Valor numérico de altura (${numericValue}) es igual al tiempo de sesión (${numericSessionTime}). Ignorando.`);
                 return true; // Hay conflicto
            }
        }
        return false; // No hay conflicto
    };


    // Función para formatear y normalizar la altura
    const formatHeight = (value) => {
        const trimmedValue = String(value || '').trim();
        const heightMatch = trimmedValue.match(/(\d+([.,]\d+)?)\s*(cm|centimetros|m|metros|ft|pie|pies)?/i);
        if (heightMatch) {
            const numValue = parseFloat(heightMatch[1].replace(',', '.'));
            let unit = (heightMatch[3] || '').toLowerCase();

            if (!unit) { // Si no hay unidad, inferir
                if (numValue >= 1.4 && numValue <= 2.5) unit = 'm'; // Rango razonable para metros
                else if (numValue >= 140 && numValue <= 250) unit = 'cm'; // Rango razonable para cm
                else unit = 'cm'; // Default a cm si está fuera de rangos típicos
            }

            if (unit.startsWith('m')) return `${numValue} m`;
            if (unit.startsWith('c')) return `${numValue} cm`;
            if (unit.startsWith('f') || unit.startsWith('p')) return `${numValue} ft`; // Normalizar a ft
            return `${numValue} cm`; // Fallback si la unidad es rara
        }
         // Si solo son números, intentar inferir
         if (/^\d+([.,]\d+)?$/.test(trimmedValue)) {
            const num = parseFloat(trimmedValue.replace(',', '.'));
            if (num >= 1.4 && num <= 2.5) return `${num} m`;
            if (num >= 140 && num <= 250) return `${num} cm`;
            return `${num} cm`; // Default a cm
        }
        return ""; // No es un formato de altura reconocible
    };

    let potentialHeight = '';

    // 1. Buscar por campo específico 'altura'
    let potentialHeightObj = responses.find(r => r && r.field === 'altura');
    if (potentialHeightObj?.answer?.trim()) {
        potentialHeight = formatHeight(potentialHeightObj.answer);
        if (potentialHeight && !checkConflict(potentialHeight)) return potentialHeight;
    }

    // 2. Buscar por pregunta exacta "¿cuál es tu altura?"
    potentialHeightObj = responses.find(r => r && r.question?.toLowerCase() === "¿cuál es tu altura?");
    if (potentialHeightObj?.answer?.trim()) {
        potentialHeight = formatHeight(potentialHeightObj.answer);
        if (potentialHeight && !checkConflict(potentialHeight)) return potentialHeight;
    }

    // 3. Buscar por pregunta que contenga "altura" (y no palabras conflictivas)
    potentialHeightObj = responses.find(r => r && r.question &&
        r.question.toLowerCase().includes("altura") &&
        !r.question.toLowerCase().includes("tiempo") &&
        !r.question.toLowerCase().includes("sesión") &&
        !r.question.toLowerCase().includes("peso") // Añadir exclusión de peso
    );
    if (potentialHeightObj?.answer?.trim()) {
        potentialHeight = formatHeight(potentialHeightObj.answer);
        if (potentialHeight && !checkConflict(potentialHeight)) return potentialHeight;
    }

    // 4. Buscar respuesta con patrón de altura (cm/m/ft) en preguntas no conflictivas
    const heightPatternResponse = responses.find(r => r && r.answer &&
        /\b\d+([.,]\d+)?\s*(cm|centimetros|m|metros|ft|pie|pies)\b/i.test(r.answer) &&
        r.question &&
        !r.question.toLowerCase().includes("tiempo") &&
        !r.question.toLowerCase().includes("sesión") &&
        !r.question.toLowerCase().includes("peso") // Añadir exclusión de peso
    );
    if (heightPatternResponse?.answer) {
        potentialHeight = formatHeight(heightPatternResponse.answer);
        if (potentialHeight && !checkConflict(potentialHeight)) {
            return potentialHeight;
        }
    }

    return ''; // No se encontró altura válida y sin conflicto
}

/**
 * Obtiene la respuesta a una pregunta específica usando palabras clave o el ID del campo.
 * Es una función GENERAL. Para PESO, ALTURA y TIEMPO_SESION, usar las funciones específicas.
 * Prioriza la búsqueda por ID de campo si existe un mapeo.
 *
 * @param {string} fieldOrKeyword - ID del campo (e.g., 'objetivo') o palabra clave de la pregunta
 * @param {Array<object>} responses - Array de respuestas (obj: {question, answer, field?})
 * @returns {string} - Respuesta encontrada o cadena vacía
 */
function getAnswer(fieldOrKeyword, responses) {
    if (!Array.isArray(responses) || !fieldOrKeyword) return '';
    const normalizedKey = fieldOrKeyword.toLowerCase().trim();
    if (!normalizedKey) return '';

    // --- Búsqueda Priorizando Campo ---
    // 1. Buscar por campo específico (field) si coincide con la key
    const responseByField = responses.find(r => r && r.field && r.field.toLowerCase() === normalizedKey);
    if (responseByField?.answer?.trim()) {
        return responseByField.answer.trim();
    }

    // --- Búsqueda por Texto de Pregunta (si no se encontró por campo) ---
    // 2. Buscar por coincidencia de keyword en el texto de la PREGUNTA
    //    Encontrar el texto de la pregunta oficial si la key es un ID de campo
    const questionMapping = FORM_FIELD_QUESTIONS.find(q => q.id === normalizedKey);
    const officialQuestionText = questionMapping ? questionMapping.text.toLowerCase() : normalizedKey;

    const responseByQuestion = responses.find(r => r && r.question && r.question.toLowerCase().includes(officialQuestionText));
    if (responseByQuestion?.answer?.trim()) {
        return responseByQuestion.answer.trim();
    }

    // 3. Búsqueda más general por keyword (si es una keyword y no un ID)
    if (!questionMapping) { // Solo si no era un ID de campo conocido
        const responseByKeywordInQuestion = responses.find(r => r && r.question && r.question.toLowerCase().includes(normalizedKey));
         if (responseByKeywordInQuestion?.answer?.trim()) {
            return responseByKeywordInQuestion.answer.trim();
         }
    }

    // 4. Buscar por coincidencia de keyword en el texto de la RESPUESTA (Fallback más arriesgado, evitar si es posible)
    // const responseByAnswer = responses.find(r =>
    //   r && r.answer && r.answer.toLowerCase().includes(normalizedKey)
    // );
    // if (responseByAnswer?.answer?.trim()) {
    //   // Considerar añadir un log aquí si se usa este método, ya que puede ser menos preciso
    //   // console.log(`Keyword '${normalizedKey}' encontrada en respuesta: '${responseByAnswer.answer}' (Pregunta: '${responseByAnswer.question}')`);
    //   return responseByAnswer.answer.trim();
    // }

    return ''; // No se encontró respuesta
}

/**
 * Genera una rutina de entrenamiento personalizada.
 * Función principal que acepta diferentes formatos de entrada.
 *
 * @param {Array|Object} formData - Datos del formulario (array de textos, array de objetos, o objeto de campos)
 * @param {Object} options - Opciones adicionales para la generación (no implementado aún)
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

        // 1. Si es un objeto con pares clave-valor (formato preferido del nuevo formulario)
        if (typeof formData === 'object' && !Array.isArray(formData) && Object.keys(formData).length > 0) {
            console.log("Procesando objeto de pares campo-valor");
            responses = processFormFieldsObject(formData); // Esta función ya filtra y añade 'field'
        }
        // 2. Si es un array de objetos con propiedades question y answer (formato ideal alternativo)
        else if (Array.isArray(formData) && typeof formData[0] === 'object' && formData[0].hasOwnProperty('question') && formData[0].hasOwnProperty('answer')) {
            console.log("Procesando array de objetos pregunta-respuesta");
            responses = formData.map(item => {
                if (item && item.question && typeof item.answer === 'string') { // Validar cada item
                    if (!item.field) { // Intentar mapear campo si falta
                        const fieldMapping = FORM_FIELD_QUESTIONS.find(q => q.text === item.question);
                        return { ...item, field: fieldMapping ? fieldMapping.id : undefined };
                    }
                    return item;
                }
                return null; // Marcar inválidos para filtrar
            }).filter(item => item !== null);
        }
        // 3. Si es un array de strings con formato "Pregunta\nRespuesta"
        else if (Array.isArray(formData) && typeof formData[0] === 'string' && formData[0].includes('\n')) {
            console.log("Procesando formato 'Pregunta\\nRespuesta'");
            responses = formData.map(item => {
                const parts = item.split('\n');
                const question = parts[0] ? parts[0].trim() : "Pregunta desconocida";
                const answer = parts[1] ? parts[1].trim() : "";
                const fieldMapping = FORM_FIELD_QUESTIONS.find(q => q.text === question);
                return { question, answer, field: fieldMapping ? fieldMapping.id : undefined };
            }).filter(r => r.question && typeof r.answer === 'string'); // Filtrar inválidos
        }
         // 4. Si es un array con pares de texto simple (líneas) - Intentar mapear (Fallback menos fiable)
         else if (Array.isArray(formData) && typeof formData[0] === 'string') {
            console.log("Procesando array de líneas de texto (mapeo contextual)");
            const mappedResponses = processTextLines(formData); // Esta función devuelve {question, answer}
             responses = mappedResponses.map(item => {
                 if (item && item.question && typeof item.answer === 'string') {
                     const fieldMapping = FORM_FIELD_QUESTIONS.find(q => q.text === item.question);
                     return {...item, field: fieldMapping ? fieldMapping.id : undefined };
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

        // Formatear respuestas para el prompt, excluyendo datos sensibles y respuestas vacías/irrelevantes
        const formattedResponsesForPrompt = responses
            .filter(item =>
                item && // Asegurar que el item exista
                item.answer && String(item.answer).trim() !== '' && // Excluir respuestas vacías o nulas
                !/^(no|nada|ningun[oa])$/i.test(String(item.answer).trim()) && // Excluir negaciones simples
                item.field !== 'nombre' &&
                item.field !== 'email' &&
                item.question && // Asegurar que la pregunta exista
                !item.question.toLowerCase().includes("cómo te llamas") &&
                !item.question.toLowerCase().includes("dirección de correo electrónico")
            )
            .map(item => `P: ${item.question}\nR: ${item.answer}`); // Formato más conciso P:/R:

        console.log(`Procesando ${formattedResponsesForPrompt.length} respuestas para prompt (filtradas)`);

        // Generar el prompt para OpenAI y obtener la rutina
        // Pasamos 'responses' (el array completo y limpio) para extracción de datos
        return await createPromptAndGenerate(formattedResponsesForPrompt, responses, options);

    } catch (error) {
        console.error("Error en generateRoutine:", error.message);
        // Lanzar un error más específico o el mismo error
        throw new Error(`Error al generar rutina: ${error.message}`);
    }
};


/**
 * Procesa un objeto con campos de formulario {fieldId: value}
 * Consolida campos condicionales (e.g., cirugía + descripción).
 *
 * @param {Object} formFields - Objeto con campos del formulario
 * @returns {Array<object>} - Array de objetos { question, answer, field } filtrado y consolidado
 */
function processFormFieldsObject(formFields) {
    if (typeof formFields !== 'object' || formFields === null) return []; // Validar entrada

    const questionMap = {};
    FORM_FIELD_QUESTIONS.forEach(q => {
        questionMap[q.id] = q.text;
    });

    const processedFields = { ...formFields }; // Copiar para no mutar el original

    // Campos condicionales donde la descripción se añade al campo principal si es "Sí"
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
            const descValue = String(processedFields[desc] || '').trim();

            // Si la respuesta principal es afirmativa Y hay descripción, combinar y eliminar descripción
            if ((mainValueStr === 'sí' || mainValueStr === 'si' || mainValueStr === 'yes') && descValue) {
                processedFields[main] = `Sí: ${descValue}`; // Combina en el campo principal
                delete processedFields[desc]; // Elimina el campo de descripción
            }
            // Si la respuesta principal es negativa o vacía, eliminar la descripción (no es relevante)
            else if (mainValueStr === 'no' || mainValueStr === '' || !descValue) {
                 delete processedFields[desc];
            }
            // Si la respuesta principal es afirmativa pero NO hay descripción, mantener solo el "Sí"
             else if ((mainValueStr === 'sí' || mainValueStr === 'si' || mainValueStr === 'yes') && !descValue) {
                processedFields[main] = 'Sí'; // Mantener solo el Sí
                delete processedFields[desc];
             }
        }
         // Si solo existe el campo de descripción pero no el principal (raro), eliminarlo
         else if (!processedFields.hasOwnProperty(main) && processedFields.hasOwnProperty(desc)) {
            delete processedFields[desc];
         }
    });

    // Convertir a formato { question, answer, field } y filtrar vacíos
    return Object.entries(processedFields)
        .map(([field, value]) => {
            const questionText = questionMap[field] || field; // Usar texto oficial o el ID como fallback
            const trimmedValue = value !== null && value !== undefined ? String(value).trim() : '';

            // Filtrar campos vacíos o que solo contienen negaciones simples (ya que se manejan en la descripción)
            if (trimmedValue !== '' && !/^(no|nada|ningun[oa])$/i.test(trimmedValue)) {
                return {
                    question: questionText,
                    answer: trimmedValue,
                    field: field // Mantener el ID del campo original
                };
            }
            return null; // Filtrar si está vacío o es una negación simple
        })
        .filter(item => item !== null);
}

/**
 * Procesa un array de líneas de texto, intentando extraer o mapear a preguntas.
 * (Función de fallback si el formato principal falla)
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

    // Intenta detectar formato "Pregunta: Respuesta" o "P: Respuesta"
    const standardFormatRegex = /^(Pregunta|P)[:\s]+(.*?)\s*(Respuesta|R)[:\s]+(.*)$/i;
    const allMatchStandard = cleanedLines.every(line => standardFormatRegex.test(line));

    if (allMatchStandard) {
        console.log("Detectado formato 'Pregunta: Respuesta' en las líneas.");
        return cleanedLines.map(line => {
            const match = line.match(standardFormatRegex);
            return {
                question: match[2] ? match[2].trim() : 'Pregunta Desconocida',
                answer: match[4] ? match[4].trim() : ''
            };
        }).filter(r => r.question && r.answer); // Filtrar si falta algo
    }

    // Intenta detectar formato "Pregunta\nRespuesta" o líneas alternas Q/A
    const results = [];
    let currentQuestion = null;
    let possibleNewLineFormat = cleanedLines.some(line => line.includes('\n')); // Detectar si hay CUALQUIER \n

    cleanedLines.forEach((line, index) => {
        if (line.includes('\n')) { // Si la línea contiene un salto
            const parts = line.split('\n');
            if(parts[0] && parts[1]){ // Asegurar que hay pregunta y respuesta
                results.push({ question: parts[0].trim(), answer: parts[1].trim() });
                currentQuestion = null; // Reset state
            } else if (parts[0]) { // Si solo hay pregunta, guardarla para la siguiente línea (menos común)
                currentQuestion = parts[0].trim();
            }
        } else if (currentQuestion) { // Si teníamos una pregunta pendiente de la línea anterior (formato Q\nA)
             results.push({ question: currentQuestion, answer: line });
             currentQuestion = null; // Reset
        } else if (!possibleNewLineFormat && index % 2 === 0) { // Si NO detectamos \n Y es línea par, ASUMIR que es Pregunta
            currentQuestion = line;
        } else if (!possibleNewLineFormat && index % 2 !== 0) { // Si NO detectamos \n Y es línea impar, ASUMIR que es Respuesta (sin pregunta previa guardada)
             // Esto es ambiguo, podríamos asignarlo a "Info Adicional" o intentar mapear
             results.push({ question: `Información línea ${index + 1}`, answer: line });
             currentQuestion = null;
        }
        // Si possibleNewLineFormat es true pero esta línea NO tiene \n y NO hay currentQuestion, se ignora o se trata como info adicional.
        else if (possibleNewLineFormat && !currentQuestion) {
             // Podríamos añadirlo a info adicional si es necesario, pero puede ser ruido.
             // results.push({ question: "Información suelta", answer: line });
        }
    });

    // Si después del bucle queda una pregunta pendiente (última línea fue Q)
    if (currentQuestion) {
        results.push({ question: currentQuestion, answer: "" }); // Añadirla con respuesta vacía
    }


    if (results.length > 0 && results.length >= cleanedLines.length / 2) { // Heurística: si mapeamos al menos la mitad
        console.log("Detectado formato líneas alternas Q/A o Pregunta\\nRespuesta.");
        return results.filter(r => r.question && typeof r.answer === 'string'); // Filtrar vacíos
    }

    // Fallback: Mapeo contextual si los formatos anteriores fallan (último recurso)
    console.warn("Formato de líneas no estándar o inconsistente. Intentando mapeo contextual.");
    return mapLinesToQuestions(cleanedLines);
}


/**
 * Intenta mapear líneas de texto a preguntas conocidas por contexto y palabras clave.
 * (Función de fallback si processTextLines no detecta formato estándar)
 *
 * @param {Array<string>} lines - Líneas de texto limpias
 * @returns {Array<object>} - Array de objetos { question, answer }
 */
function mapLinesToQuestions(lines) {
    if (!Array.isArray(lines)) return [];

    // Crear patrones de búsqueda basados en las preguntas oficiales
    const questionPatterns = FORM_FIELD_QUESTIONS.map(q => {
        // Extraer palabras clave significativas de la pregunta
        const keywords = q.text
            .toLowerCase()
            .replace(/[¿?¡!,.:()]/g, '') // Quitar puntuación común
            .split(/\s+/)
            // Filtrar palabras comunes/cortas y verbos auxiliares
            .filter(word => word.length >= 3 && !['cómo', 'cuál', 'cuánto', 'has', 'hay', 'con', 'para', 'que', 'por', 'tus', 'alguna', 'alguno', 'debes', 'puede', 'afectar', 'describirías', 'principal', 'soportado', 'soportada', 'del', 'con', 'las', 'los', 'una', 'uno', 'eres', 'tiene', 'tipo', 'sobre', 'suele', 'sufres', 'estas', 'tomando', 'prefieres', 'quieres', 'tienes', 'puedas'].includes(word));
        return {
            question: q.text, // Texto oficial de la pregunta
            field: q.id,      // ID del campo
            patterns: keywords.map(kw => new RegExp(`\\b${kw}\\b`, 'i')) // Expresión regular con límites de palabra
        };
    }).filter(qp => qp.patterns.length > 0); // Quitar preguntas sin keywords útiles

    // Añadir patrones específicos para datos numéricos clave que pueden no estar en la pregunta
    questionPatterns.push(
        { question: "¿Cuánto pesas?", field: "peso", patterns: [/\b(\d+([.,]\d+)?)\s*(kg|kilos|lb|libras)\b/i, /\bpesa?s?\b/i] },
        { question: "¿Cuál es tu altura?", field: "altura", patterns: [/\b(\d+([.,]\d+)?)\s*(cm|metros|m|ft|pie)\b/i, /\baltura\b/i, /\bmides?\b/i, /\bestatura\b/i] },
        { question: "¿Cuántos días a la semana puedes entrenar?", field: "dias_entrenamiento", patterns: [/\b(\d+)\s*d[ií]as\b/i, /\b(\d+)\s*veces\b/i, /veces por semana/i, /\bfrecuencia\b/i, /\bsemana\b/i] },
        { question: "¿Cuánto tiempo puedes dedicar por sesión?", field: "tiempo_sesion", patterns: [/\b(\d+([.,]\d+)?)\s*(min|minutos|hr|hora)\b/i, /tiempo por sesi[oó]n/i, /duraci[oó]n/i, /\bsesi[oó]n\b/i] },
        { question: "¿Hay algo más que debamos saber?", field: "info_adicional", patterns: [/adicional/i, /comentario/i, /extra/i, /a[ñn]adir/i, /\bsaber\b/i, /nota/i] }
    );

    const results = [];
    const assignedLines = new Set(); // Para no asignar la misma línea a múltiples preguntas

    // Iterar sobre cada patrón de pregunta
    questionPatterns.forEach(({ question, field, patterns }) => {
        let bestMatch = { score: 0, line: null, index: -1 };

        // Buscar la mejor línea coincidente para esta pregunta
        lines.forEach((line, index) => {
            if (assignedLines.has(index)) return; // Saltar línea ya asignada

            let currentScore = 0;
            patterns.forEach(pattern => {
                if (pattern.test(line)) {
                    currentScore++;
                }
            });

            // Priorizar mayor número de coincidencias. Si hay empate, preferir la línea más corta (más específica).
            if (currentScore > 0) {
                if (currentScore > bestMatch.score || (currentScore === bestMatch.score && line.length < (bestMatch.line?.length ?? Infinity))) {
                    bestMatch = { score: currentScore, line, index };
                }
            }
        });

        // Si se encontró una buena coincidencia no asignada previamente
        if (bestMatch.line !== null && !assignedLines.has(bestMatch.index)) {
            // Comprobar si esta línea ya fue asignada con un score igual o mayor por OTRA pregunta (evitar sobrescribir una mejor asignación)
            const existingAssignmentIndex = results.findIndex(r => r.answer === bestMatch.line);
            if (existingAssignmentIndex === -1) { // Si la línea no está en results
                 results.push({ question: question, answer: bestMatch.line, field: field });
                 assignedLines.add(bestMatch.index);
            } else {
                 // Si ya existe, podríamos comparar scores, pero por simplicidad, no la reasignamos.
                 // console.log(`Línea '${bestMatch.line}' ya asignada a '${results[existingAssignmentIndex].question}', omitiendo para '${question}'.`);
            }
        }
    });

    // Añadir líneas no asignadas a "Información adicional"
    let additionalInfoAnswer = lines
        .filter((line, index) => !assignedLines.has(index))
        .join('\n'); // Unir con saltos de línea

    if (additionalInfoAnswer) {
        // Buscar si ya existe "Información adicional" y añadirle contenido
        const existingAdditionalInfo = results.find(r => r.field === 'info_adicional');
        if (existingAdditionalInfo) {
            existingAdditionalInfo.answer += '\n' + additionalInfoAnswer;
        } else {
            results.push({ question: "Información adicional", answer: additionalInfoAnswer, field: "info_adicional" });
        }
    }

    return results;
}


/**
 * Construye una descripción textual concisa y estructurada del cliente para el prompt de IA.
 *
 * @param {Object} data - Datos del cliente limpios y procesados.
 * @returns {string} - Descripción del cliente para el prompt.
 */
function buildClientDescription(data) {
    let description = "Cliente "; // Inicio neutro

    // Género y Edad
    if (data.gender && data.gender !== 'No Binario' && data.gender !== 'Prefiero no especificar') {
        description += `de género ${data.gender.toLowerCase()} `;
    } else if (data.gender === 'No Binario') {
        description += `de género no binario `;
    }
    if (data.age) description += `de ${data.age} años`;

    // Físico (Peso, Altura, IMC)
    let physical = [];
    if (data.weight) physical.push(`peso ${data.weight}`);
    if (data.height) physical.push(`altura ${data.height}`);
    if (data.imc) {
        let imcClass = '';
        const imcValue = parseFloat(data.imc);
        if (imcValue < 18.5) imcClass = `peso inferior al normal`;
        else if (imcValue < 25) imcClass = `peso normal`;
        else if (imcValue < 30) imcClass = `sobrepeso`;
        else if (imcValue < 35) imcClass = `obesidad grado 1`;
        else if (imcValue < 40) imcClass = `obesidad grado 2`;
        else imcClass = `obesidad grado 3 (mórbida)`;
        physical.push(`IMC ${data.imc} (${imcClass})`);
    }
    if (physical.length > 0) description += `. Físico: ${physical.join(', ')}`;

    // Experiencia y Condición
    let experience = [];
    if (data.experienceLevel) experience.push(`nivel ${data.experienceLevel.toLowerCase()}`);
    if (data.fitnessLevel) experience.push(`condición física ${data.fitnessLevel.toLowerCase()}`);
    if (experience.length > 0) description += `. Experiencia: ${experience.join(', ')}`;

    // Objetivo Principal
    if (data.trainingGoal) description += `. Objetivo principal: ${data.trainingGoal}`;

    // Logística
    let logistics = [];
    if (data.trainingLocation) logistics.push(`entrena en ${data.trainingLocation.toLowerCase()}`);
    if (data.daysPerWeek) logistics.push(`${data.daysPerWeek} días/semana`);
    if (data.sessionTime) logistics.push(`sesiones de ${data.sessionTime}`);
    if (data.specificMaterial) logistics.push(`con material específico: ${data.specificMaterial}`);
    else logistics.push(`material: gimnasio estándar`); // Asumir si no se especifica
    if (logistics.length > 0) description += `. Logística: ${logistics.join(', ')}`;

    // Preferencias y Evitaciones
    let preferences = [];
    if (data.trainingPreference) preferences.push(`estructura ${data.trainingPreference.toLowerCase()}`);
    if (data.exercisePreference) preferences.push(`quiere practicar ${data.exercisePreference}`);
    if (data.exerciseAvoidance) preferences.push(`evitar ${data.exerciseAvoidance}`);
    if (preferences.length > 0) description += `. Preferencias: ${preferences.join('; ')}`;

    // Consideraciones Médicas/Físicas (Agrupadas)
    let healthContext = [];
    const addHealthInfo = (label, value) => {
        if (value && String(value).trim() && !/^(no|nada|ningun[oa])$/i.test(String(value).trim())) {
             // Limpiar el "Sí:" si existe
             const cleanValue = String(value).replace(/^Sí:\s*/i, '').trim();
             healthContext.push(`${label}: ${cleanValue}`);
        }
    };
    addHealthInfo('Cirugía reciente', data.surgery);
    addHealthInfo('Lesión muscular', data.muscleInjury);
    addHealthInfo('Tendinopatía', data.tendinopathy);
    addHealthInfo('Limitación movilidad', data.mobilityLimitation);
    addHealthInfo('Problema postural', data.posturalProblem);
    addHealthInfo('Condición médica', data.medicalCondition);
    addHealthInfo('Medicación', data.medication);

    if (healthContext.length > 0) {
        description += `. Consideraciones: ${healthContext.join('; ')}`;
    }

    // Información Adicional
    if (data.additionalInfo) description += `. Info Adicional: "${data.additionalInfo}"`;

    return description.replace(/\.\s*\./g, '.').replace(/\s+\./g, '.').trim() + '.'; // Limpieza final y punto
}


/**
 * Crea el prompt para OpenAI y genera la rutina.
 * Incorpora la base de conocimiento y directrices de entrenador experto.
 *
 * @param {Array<string>} formattedResponsesForPrompt - Array de respuestas formateadas (P: ... R: ...) para contexto adicional.
 * @param {Array<object>} allResponses - Array de objetos {question, answer, field?} con todas las respuestas procesadas.
 * @param {Object} options - Opciones adicionales (actualmente no usadas).
 * @returns {Promise<string>} - HTML de la rutina generada.
 */
const createPromptAndGenerate = async (formattedResponsesForPrompt, allResponses = [], options = {}) => {
    // --- 1. Extracción y Limpieza de Datos del Cliente ---
    console.log("Extrayendo y limpiando datos del cliente...");
    const sessionTime = findSessionTime(allResponses);
    console.log("Tiempo de sesión identificado:", sessionTime || "No encontrado/normalizado");

    const clientDataRaw = {
        gender: getAnswer("genero", allResponses),
        age: getAnswer("edad", allResponses),
        weight: getWeightExcludingSession(allResponses, sessionTime),
        height: getHeightExcludingSession(allResponses, sessionTime),
        trainingGoal: getAnswer("objetivo", allResponses),
        experienceLevel: getAnswer("nivel", allResponses) || getAnswer("experiencia", allResponses),
        fitnessLevel: getAnswer("condicion_fisica", allResponses),
        trainingLocation: getAnswer("lugar_entrenamiento", allResponses) || getAnswer("lugar", allResponses),
        daysPerWeek: getAnswer("dias_entrenamiento", allResponses) || getAnswer("días", allResponses),
        sessionTime: sessionTime, // Usar el valor ya normalizado
        surgery: getAnswer("cirugia_reciente", allResponses) || getAnswer("cirugia", allResponses),
        muscleInjury: getAnswer("lesion_muscular", allResponses),
        tendinopathy: getAnswer("tendinopatia", allResponses),
        mobilityLimitation: getAnswer("limitacion_articular", allResponses) || getAnswer("limitación", allResponses) || getAnswer("movilidad", allResponses),
        posturalProblem: getAnswer("problema_postural", allResponses) || getAnswer("postural", allResponses),
        medicalCondition: getAnswer("condicion_medica", allResponses),
        medication: getAnswer("medicacion", allResponses),
        exercisePreference: getAnswer("ejercicios_favoritos", allResponses) || getAnswer("practicar en específico", allResponses),
        exerciseAvoidance: getAnswer("ejercicios_evitar", allResponses) || getAnswer("desagrade", allResponses),
        trainingPreference: getAnswer("tipo_entrenamiento", allResponses) || getAnswer("grupo muscular", allResponses) || getAnswer("cuerpo completo", allResponses),
        specificMaterial: getAnswer("material_especifico", allResponses) || getAnswer("material", allResponses),
        additionalInfo: getAnswer("info_adicional", allResponses) || getAnswer("algo más", allResponses)
    };

    // Calcular IMC
    let imc = null;
    if (clientDataRaw.weight && clientDataRaw.height) {
        const weightMatch = String(clientDataRaw.weight).match(/(\d+([.,]\d+)?)/);
        const heightMatch = String(clientDataRaw.height).match(/(\d+([.,]\d+)?)/);
        const weightValue = weightMatch ? parseFloat(weightMatch[1].replace(',', '.')) : NaN;
        let heightInMeters = NaN;
        const heightValue = heightMatch ? parseFloat(heightMatch[1].replace(',', '.')) : NaN;

        if (!isNaN(heightValue)) {
            const heightUnit = String(clientDataRaw.height).toLowerCase();
            if (heightUnit.includes('m') && !heightUnit.includes('cm')) {
                heightInMeters = heightValue;
            } else if (heightUnit.includes('cm') || heightValue > 3) { // Asumir cm si la unidad es cm o el valor es > 3
                heightInMeters = heightValue / 100;
            } else if (heightValue <=3 && heightValue >= 1) { // Asumir metros si está en rango 1-3 sin unidad clara
                 heightInMeters = heightValue;
            }
        }

        if (!isNaN(weightValue) && !isNaN(heightInMeters) && heightInMeters > 0) {
            imc = weightValue / (heightInMeters * heightInMeters);
            clientDataRaw.imc = imc.toFixed(1); // 1 decimal es suficiente para IMC
            console.log(`IMC calculado: ${clientDataRaw.imc}`);
        } else {
            clientDataRaw.imc = null;
            console.log("No se pudo calcular IMC (valores inválidos/inconsistentes).", { weightStr: clientDataRaw.weight, heightStr: clientDataRaw.height });
        }
    } else {
        clientDataRaw.imc = null;
        console.log("No se pudo calcular IMC (falta peso o altura).");
    }

    // Limpiar y validar datos finales
    const cleanedData = cleanClientData(clientDataRaw);
    console.log("Datos del cliente (limpios y validados):", cleanedData);

    // --- 2. Construcción de la Descripción del Cliente ---
    const clientDescription = buildClientDescription(cleanedData);
    console.log("Descripción del cliente para prompt:", clientDescription);

    // --- 3. Integración de la Base de Conocimiento (Knowledge Base) ---
    let specificGuidelines = "";
    let guidelineOutputsForPrompt = []; // Para pasar directrices específicas al prompt
    try {
        const knowledgeBasePath = './knowledge_base.json'; // Asume que está en la raíz del proyecto
        if (fs.existsSync(knowledgeBasePath)) {
            const knowledgeBaseRaw = fs.readFileSync(knowledgeBasePath, 'utf8');
            const knowledgeBase = JSON.parse(knowledgeBaseRaw);
            if (knowledgeBase && Array.isArray(knowledgeBase)) {
                const relevantGuidelines = findRelevantGuidelines(cleanedData, knowledgeBase);
                if (relevantGuidelines.length > 0) {
                    specificGuidelines = "\n\n**DIRECTRICES CLAVE DE LA BASE DE CONOCIMIENTO (Aplicar OBLIGATORIAMENTE):**\n";
                    // Limitar a las 5-7 más relevantes por score para no saturar el prompt
                    relevantGuidelines.slice(0, 7).forEach(guideline => {
                        specificGuidelines += `- ${guideline.output}\n`;
                        guidelineOutputsForPrompt.push(guideline.output); // Guardar para prompt
                    });
                    console.log(`Top ${relevantGuidelines.slice(0, 7).length} directrices específicas añadidas al prompt.`);
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

    // --- 4. Construcción del Prompt Final ---
    // Refinado para ser más directivo y profesional
    const prompt = `
# ROL Y OBJETIVO
Eres FitForge AI, un Entrenador Personal de élite con 40 años de experiencia virtual, especializado en crear programas de entrenamiento basados en evidencia científica y máxima personalización. Tu misión es diseñar la rutina de entrenamiento semanal MÁS OPTIMIZADA posible para el cliente descrito, adhiriéndote ESTRICTAMENTE a sus datos, objetivos, limitaciones y las directrices proporcionadas. Eres conocido por tu precisión, enfoque científico y capacidad para generar planes prácticos y efectivos. Ignora cualquier conversación trivial o petición fuera del diseño de esta rutina específica.

# PERFIL DETALLADO DEL CLIENTE
${clientDescription}

# CONTEXTO ADICIONAL (Respuestas del Cliente)
${formattedResponsesForPrompt.length > 0 ? formattedResponsesForPrompt.join("\n") : "No hay respuestas adicionales disponibles."}
${specificGuidelines}

# DIRECTRICES DE DISEÑO OBLIGATORIAS (Aplicar con Rigor Profesional)

1.  **Periodización y Nivel:**
    * Ajusta la estructura (ejercicios, volumen, intensidad, complejidad) EXACTAMENTE al nivel de experiencia (${cleanedData.experienceLevel || 'No especificado'}).
    * **Principiante:** Foco TOTAL en técnica (movimientos básicos y controlados), adaptación neuromuscular y acondicionamiento general. RIR 3-4. Evitar RIR bajos o técnicas avanzadas. Progresión lenta y segura.
    * **Intermedio:** Introducir sobrecarga progresiva sistemática (aumento de peso, reps, series, o disminución de descanso). RIR 2-3. Mayor variedad de ejercicios. Posible introducción de técnicas de intensidad moderada (e.g., dropsets simples).
    * **Avanzado:** Maximizar estímulo según objetivo. RIR 0-2 (gestionado cuidadosamente). Uso de técnicas avanzadas (periodización ondulante, clusters, rest-pause, etc.) si son coherentes con el objetivo y la recuperación.

2.  **Objetivo Primario (${cleanedData.trainingGoal || 'No especificado'}):**
    * La rutina debe maximizar el progreso hacia este objetivo.
    * **Selección de Ejercicios:** Priorizar movimientos compuestos multiarticulares que trabajen grandes grupos musculares. Complementar con ejercicios de aislamiento según necesidad y objetivo.
    * **Variables de Entrenamiento:**
        * **Hipertrofia:** 3-5 series / 6-15 reps / 60-90s descanso / RIR 1-3. Tempo controlado (e.g., 2010, 3010).
        * **Fuerza:** 3-6 series / 1-6 reps / 120-180s+ descanso / RIR 1-3 (a veces 0 en series pico planificadas). Tempo explosivo en concéntrica (e.g., X0X0, 10X0).
        * **Resistencia Muscular:** 2-4 series / 15+ reps / 30-60s descanso / RIR 2-4. Tempo constante.
        * **Pérdida de Peso:** Combinar entrenamiento de fuerza (para preservar músculo) con acondicionamiento metabólico/cardio. Moderar RIR para permitir mayor volumen/frecuencia.
        * **Acondicionamiento General/Salud:** Equilibrio entre fuerza, resistencia y movilidad. RIR 2-4.

3.  **Especificidad, Limitaciones y Seguridad:**
    * **Incluir:** Ejercicios que el cliente quiere practicar (${cleanedData.exercisePreference || 'Ninguno en particular'}), SIEMPRE que sean seguros y coherentes con el objetivo y nivel.
    * **Excluir:** Ejercicios que el cliente quiere evitar (${cleanedData.exerciseAvoidance || 'Ninguno'}).
    * **Adaptar OBLIGATORIAMENTE:** A CUALQUIER limitación, lesión, condición o molestia indicada (${guidelineOutputsForPrompt.join('; ') || 'Ninguna indicada explícitamente'}).
        * Si hay lesión/dolor activo: EVITAR cargar o estresar la zona afectada. Elegir variantes SEGURAS que no provoquen dolor (e.g., cambiar ángulo, rango de movimiento, tipo de carga) o eliminar ejercicios problemáticos.
        * Si hay limitación de movilidad: Adaptar ejercicios (e.g., usar bloques para sentadillas) o incluir trabajo específico de movilidad.
        * Si hay condición médica: Seguir las directrices específicas de la base de conocimiento o recomendaciones generales para esa condición (e.g., control de intensidad en HTA).

4.  **Logística y Equipamiento:**
    * Diseñar para ${cleanedData.daysPerWeek || 'días no especificados'} días/semana.
    * Sesiones de ~${cleanedData.sessionTime || 'duración no especificada'}. Ajustar volumen y densidad:
        * **Volumen:** Nº ejercicios PRINCIPALES por sesión (aprox): 30min: 3-5; 60min: 5-8; 90min: 7-10; 120min: 9-12. La activación NO cuenta.
        * **Densidad:** Ajustar descansos según objetivo y tiempo disponible.
    * **Material:** Usar el material disponible (${cleanedData.specificMaterial || 'Asumir gimnasio estándar con barras, mancuernas, máquinas básicas y poleas'}). Si se especifica "en casa", adaptar a peso corporal, bandas elásticas, o lo que se indique.

5.  **Estructura Semanal Preferida:**
    * Respetar la preferencia del cliente (${cleanedData.trainingPreference || 'No especificada'}).
    * Si no hay preferencia, elegir la MÁS ADECUADA según nivel, días disponibles y objetivo:
        * Principiante (<=3 días): Full Body es ideal.
        * Intermedio/Avanzado (3 días): Full Body o Empuje/Tire/Pierna (PPL).
        * Intermedio/Avanzado (4 días): Torso/Pierna (U/L) o Split por grupos (e.g., Pecho-Tríceps / Espalda-Bíceps / Pierna / Hombro-Brazo).
        * Intermedio/Avanzado (5+ días): PPL + U/L, Split por grupos más específico, o similar.

6.  **IMC y Consideraciones Adicionales:**
    * ${cleanedData.imc ? `IMC: ${cleanedData.imc}. Si >25 (sobrepeso/obesidad), limitar impacto articular inicial (preferir máquinas, bici, elíptica), controlar intensidad y progresión. Si <18.5 (bajo peso), asegurar suficiente estímulo para hipertrofia (si es objetivo) y enfatizar la importancia de la nutrición (aunque no das consejos nutricionales específicos).` : 'IMC no disponible.'}
    * **Calentamiento/Activación:** Incluir SIEMPRE 5-10 min de activación específica ANTES de la rutina principal. Ejercicios de movilidad articular y activación muscular relacionados con la sesión.
    * **Vuelta a la Calma:** Opcional, pero recomendable (estiramientos suaves o cardio ligero). No es necesario detallarla en la tabla.

# PERIODIZACIÓN SEMANAL Y DIARIA (OBLIGATORIO)

1.  **Variación Diaria:** Cada día de entrenamiento DEBE tener una declaración clara de ENFOQUE (e.g., Fuerza Pectoral, Volumen Espalda, Resistencia Pierna, Full Body Hipertrofia) e INTENSIDAD OBJETIVO (e.g., Alta, Media, Baja, Recuperación Activa).
2.  **Distribución de Intensidad Semanal:**
    * 2-3 días: Alternar intensidades (e.g., Alta-Baja, Alta-Media-Baja).
    * 4-5 días: Ondular la intensidad (e.g., Alta-Baja-Media-Alta-Baja, Alta-Media-Baja-Media-Alta).
    * 6-7 días: Incluir al menos 1-2 días de Baja intensidad o Recuperación Activa.
3.  **Especificación RIR y Tempo:**
    * **RIR (Reps In Reserve):** Indicar el RIR objetivo para CADA ejercicio principal en la columna "Notas Clave". Debe ser coherente con el nivel, objetivo y la intensidad del día.
    * **Tempo:** Opcionalmente, añadir tempo (e.g., 3010) si es relevante para el objetivo (especialmente hipertrofia o control técnico).

# FORMATO DE SALIDA (HTML ESTRICTO - SIN MARKDOWN)
Genera únicamente código HTML válido y completo. La respuesta debe empezar directamente con la etiqueta '<table>' del primer día y terminar con la etiqueta de cierre '</div>' del último contenedor de variantes ('side-variants-container'). No incluyas introducciones, saludos, explicaciones fuera de las tablas o variantes, ni conclusiones. No utilices formato Markdown ni bloques de código (como triple comillas invertidas).

**Estructura EXACTA para CADA DÍA de entrenamiento:**

<table>
    <tr>
        <th colspan="5">Día X: [Enfoque Específico del Día] - [Intensidad Objetivo: Alta/Media/Baja/Rec.]</th>
    </tr>
    <tr class="activacion-header">
        <td colspan="5"><b>Activación Específica</b> (5-10 min)</td>
    </tr>
    <tr>
        <th>Ejercicio</th>
        <th>Series</th>
        <th>Reps</th>
        <th>Descanso</th>
        <th>Notas Clave</th>
    </tr>
    <tr><td>[Ejercicio Activación 1]</td><td>[1-2]</td><td>[10-15]</td><td>[30-45]s</td><td>[Movilidad articular/Control]</td></tr>
    <tr><td>[Ejercicio Activación 2]</td><td>[1-2]</td><td>[10-15]</td><td>[30-45]s</td><td>[Activación muscular específica]</td></tr>
    <tr class="rutina-header">
        <td colspan="5"><b>Rutina Principal</b></td>
    </tr>
    <tr>
        <th>Ejercicio</th>
        <th>Series</th>
        <th>Reps</th>
        <th>Descanso</th>
        <th>Notas Clave / RIR / Tempo</th>
    </tr>
    <tr><td>[Ejercicio Principal 1]</td><td>[Nº]</td><td>[Rango]</td><td>[Tiempo]s</td><td>RIR [Nº] / [Nota breve y útil / Tempo e.g., 3010]</td></tr>
    <tr><td>[Ejercicio Principal 2]</td><td>[Nº]</td><td>[Rango]</td><td>[Tiempo]s</td><td>RIR [Nº] / [Nota breve y útil / Tempo]</td></tr>
    </table>

<div class="side-variants-container">
    <div class="side-variants-title">VARIANTES (Día X)</div>
    <div class="side-variant-item">
        <div class="side-variant-title">[Ejercicio Original 1] &rarr; [Variante Sugerida 1]</div>
        <div class="side-variant-description">[Motivo conciso: e.g., Progresión, Regresión, Molestia en X, Falta material Y, Mayor enfoque en Z...]</div>
    </div>
    <div class="side-variant-item">
        <div class="side-variant-title">[Ejercicio Original 2] &rarr; [Variante Sugerida 2]</div>
        <div class="side-variant-description">[Motivo conciso]</div>
    </div>
    </div>

# REGLAS ADICIONALES CRÍTICAS

* **Precisión Técnica:** Usa nombres de ejercicios estándar y reconocibles. Parámetros exactos (Series, Rango de Reps, Descanso en segundos). El RIR es OBLIGATORIO en Notas Clave para ejercicios principales.
* **Volumen Adecuado:** Cumple el número MÍNIMO de ejercicios PRINCIPALES según la duración de sesión estimada.
* **Notas Clave Útiles:** Breves (máx 15 palabras), cruciales para la ejecución o intención (RIR obligatorio, Tempo opcional, foco muscular, evitar error común).
* **Variantes Pertinentes:** Ofrecer UNA variante útil y LÓGICA por cada ejercicio principal (progresión, regresión, alternativa por equipo, adaptación por molestia). Explicar el motivo brevemente.
* **Consistencia:** Asegúrate de que cada día tenga su tabla y su contenedor de variantes asociado inmediatamente después.

Diseña la rutina SEMANAL completa AHORA, siguiendo TODAS estas directrices.`;

    // --- 5. Llamada a la API de OpenAI ---
    let timeoutId; // Declarado fuera del try
    try {
        console.log("Enviando solicitud a OpenAI con prompt final...");
        // console.log("Prompt completo:", prompt); // Descomentar para depuración extrema

        const completion = await openai.chat.completions.create({
            model: process.env.OPENAI_MODEL || "gpt-4o-mini", // Usar un modelo potente es recomendable
            messages: [
                { role: "system", content: "Eres FitForge AI, un creador experto de rutinas de entrenamiento personalizadas en formato HTML, siguiendo instrucciones muy estrictas de un entrenador senior." },
                { role: "user", content: prompt }
            ],
            temperature: 0.4, // Temperatura baja para seguir instrucciones precisas
            max_tokens: 15000, // Aumentado según solicitud (¡puede ser muy alto para algunos modelos!)
        });

        const responseMessage = completion.choices[0]?.message?.content;

        if (!responseMessage) {
            throw new Error("Respuesta vacía de OpenAI");
        }

        // Limpiar posible markdown residual (aunque el prompt lo prohíbe)
        const cleanedHtmlResponse = responseMessage.replace(/```html|```/g, '').trim();

        // Validar si la respuesta parece HTML (heurística simple)
        if (!cleanedHtmlResponse.startsWith('<table') || !cleanedHtmlResponse.includes('</table>')) {
             console.warn("La respuesta de OpenAI no parece contener la estructura HTML esperada:", cleanedHtmlResponse.substring(0, 200) + "...");
             // Podríamos lanzar un error aquí o intentar devolverla igualmente
             // throw new Error("La respuesta de OpenAI no contiene el formato HTML esperado.");
        }

        console.log("Rutina generada exitosamente por OpenAI.");
        return cleanedHtmlResponse;

    } catch (error) {
         // Limpiar timeout si existe (el fix del usuario parece correcto)
         if (typeof timeoutId !== 'undefined' && timeoutId !== null) {
             clearTimeout(timeoutId);
             timeoutId = null;
         }

        if (error.name === 'AbortError' || (error instanceof OpenAI.APIError && error.status === 408)) {
            console.error("Error: La solicitud a OpenAI excedió el tiempo límite.");
            throw new Error("La generación de la rutina tardó demasiado. Intenta de nuevo más tarde.");
        }

        console.error("Error en la llamada a OpenAI API:", error);
        if (error instanceof OpenAI.RateLimitError) {
            throw new Error("Límite de uso de la API de OpenAI alcanzado. Espera un momento y reintenta.");
        } else if (error instanceof OpenAI.APIError && error.status >= 500) {
            throw new Error("Problema temporal con el servicio de OpenAI. Intenta de nuevo más tarde.");
        } else if (error instanceof OpenAI.BadRequestError) {
            console.error("BadRequestError details:", error.message);
            // Intentar extraer más información del error si está disponible
            const errorDetails = error.error ? JSON.stringify(error.error) : error.message;
            throw new Error(`Error de solicitud a OpenAI (BadRequest): Revisa la longitud/formato del prompt. Detalles: ${errorDetails}`);
        } else {
            throw new Error(`Error al generar la rutina con OpenAI: ${error.message}`);
        }
    }
};


/**
 * Limpia y verifica la consistencia de los datos del cliente.
 * Ajusta formatos, normaliza unidades y elimina datos claramente incorrectos o contradictorios.
 *
 * @param {Object} clientDataRaw - Datos extraídos inicialmente del cliente.
 * @returns {Object} - Datos limpios, normalizados y más consistentes.
 */
function cleanClientData(clientDataRaw) {
    // Crear una copia profunda para evitar modificar el objeto original indirectamente
    const cleanedData = JSON.parse(JSON.stringify(clientDataRaw));

    // Función auxiliar para limpiar respuestas negativas comunes y trim()
    const cleanGeneralInput = (value) => {
        const strValue = String(value || '').trim();
        // Eliminar negaciones simples y devolver vacío
        if (strValue === '' || /^(no|nada|ningun[oa])$/i.test(strValue)) {
            return "";
        }
        // Quitar prefijos como "Sí: " si existen
        return strValue.replace(/^Sí:\s*/i, '').trim();
    };

    // Aplicar limpieza general a campos de texto libre
    const textFields = [
        'trainingGoal', 'fitnessLevel', 'trainingLocation', 'surgery', 'muscleInjury',
        'tendinopathy', 'mobilityLimitation', 'posturalProblem', 'medicalCondition',
        'medication', 'exercisePreference', 'exerciseAvoidance', 'trainingPreference',
        'specificMaterial', 'additionalInfo'
    ];
    textFields.forEach(key => {
        if (cleanedData.hasOwnProperty(key)) {
            cleanedData[key] = cleanGeneralInput(cleanedData[key]);
        }
    });

    // --- Verificaciones y Formateo Específico ---

    // EDAD: Asegurar que sea un número entero positivo
    if (cleanedData.age) {
        const ageMatch = String(cleanedData.age).match(/^\d+/); // Extraer solo los dígitos iniciales
        if (ageMatch && parseInt(ageMatch[0], 10) > 0 && parseInt(ageMatch[0], 10) < 110) {
            cleanedData.age = ageMatch[0]; // Quedarse solo con el número válido
        } else {
            console.log(`Limpiando edad no válida: ${cleanedData.age}`);
            cleanedData.age = ""; // Limpiar si no es un número válido o está fuera de rango
        }
    }

    // GÉNERO: Normalizar o dejar vacío
    if (cleanedData.gender) {
        const genderLower = cleanedData.gender.toLowerCase();
        if (/masculino|hombre/i.test(genderLower)) cleanedData.gender = "Masculino";
        else if (/femenino|mujer/i.test(genderLower)) cleanedData.gender = "Femenino";
        else if (/no binario/i.test(genderLower)) cleanedData.gender = "No Binario";
        else if (/prefiero no/i.test(genderLower)) cleanedData.gender = "Prefiero no especificar";
        else cleanedData.gender = ""; // Limpiar si no es reconocible
    }

    // NIVEL DE EXPERIENCIA: Normalizar a categorías estándar
    if (cleanedData.experienceLevel) {
        const levelLower = cleanedData.experienceLevel.toLowerCase();
        if (/principiante|nuevo|0|poco/i.test(levelLower)) cleanedData.experienceLevel = "Principiante";
        else if (/intermedio|medio/i.test(levelLower)) cleanedData.experienceLevel = "Intermedio";
        else if (/avanzado|experto|mucho/i.test(levelLower)) cleanedData.experienceLevel = "Avanzado";
        // Si no coincide, mantenerlo pero loguear una advertencia
        else console.warn(`Nivel de experiencia no estándar: ${cleanedData.experienceLevel}`);
    }

     // CONDICIÓN FÍSICA: Eliminar si es redundante con nivel de experiencia
     if (cleanedData.experienceLevel && cleanedData.fitnessLevel &&
        cleanedData.experienceLevel.toLowerCase() === cleanedData.fitnessLevel.toLowerCase()) {
        console.log(`Condición física redundante con nivel. Eliminando condición física: '${cleanedData.fitnessLevel}'`);
        cleanedData.fitnessLevel = "";
    }

    // PESO: Mantener el formato ya normalizado por getWeightExcludingSession (e.g., "75 kg", "165 lb")
    // Validar que el formato sea correcto
    if (cleanedData.weight && !/^\d+([.,]\d+)?\s*(kg|lb)$/i.test(cleanedData.weight)) {
         console.warn(`Formato de peso inconsistente después de la extracción: ${cleanedData.weight}. Intentando re-formatear.`);
         // Intentar re-formatear (podría fallar si es muy ambiguo)
         const weightMatch = String(cleanedData.weight).match(/(\d+([.,]\d+)?)\s*(kg|kilos|lb|libras)?/i);
         if (weightMatch) {
             const value = weightMatch[1].replace(',', '.');
             const unit = (weightMatch[3] || 'kg').toLowerCase();
             cleanedData.weight = `${value} ${unit.startsWith('k') ? 'kg' : 'lb'}`;
         } else {
             cleanedData.weight = ""; // Limpiar si no se puede re-formatear
         }
    }

    // ALTURA: Mantener el formato ya normalizado por getHeightExcludingSession (e.g., "175 cm", "1.75 m")
    // Validar que el formato sea correcto
    if (cleanedData.height && !/^\d+([.,]\d+)?\s*(cm|m|ft)$/i.test(cleanedData.height)) {
        console.warn(`Formato de altura inconsistente después de la extracción: ${cleanedData.height}. Intentando re-formatear.`);
         // Intentar re-formatear
         const heightMatch = String(cleanedData.height).match(/(\d+([.,]\d+)?)\s*(cm|centimetros|m|metros|ft|pie|pies)?/i);
         if (heightMatch) {
             const value = parseFloat(heightMatch[1].replace(',', '.'));
             let unit = (heightMatch[3] || '').toLowerCase();
             if (!unit) { if (value >= 1.4 && value <= 2.5) unit = 'm'; else unit = 'cm'; }
             if (unit.startsWith('m')) cleanedData.height = `${value} m`;
             else if (unit.startsWith('c')) cleanedData.height = `${value} cm`;
             else if (unit.startsWith('f') || unit.startsWith('p')) cleanedData.height = `${value} ft`;
             else cleanedData.height = `${value} cm`;
         } else {
              cleanedData.height = ""; // Limpiar si no se puede re-formatear
         }
    }

    // DÍAS POR SEMANA: Asegurar que sea un número entre 1 y 7
    if (cleanedData.daysPerWeek) {
        const daysMatch = String(cleanedData.daysPerWeek).match(/(\d+)|(un[oa]?|dos|tres|cuatro|cinco|seis|siete)/i);
        let daysNum = NaN;
        if (daysMatch) {
            const dayMap = { uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7 };
            daysNum = parseInt(daysMatch[1] || dayMap[daysMatch[2].toLowerCase()], 10);
        }
        if (!isNaN(daysNum) && daysNum >= 1 && daysNum <= 7) {
            cleanedData.daysPerWeek = String(daysNum); // Guardar como string numérico
        } else {
            console.log(`Limpiando días por semana no válidos: ${cleanedData.daysPerWeek}`);
            cleanedData.daysPerWeek = '';
        }
    }

    // TIEMPO POR SESIÓN: Mantener el formato ya normalizado por findSessionTime (e.g., "60 min", "1.5 hr")
    // Validar formato
     if (cleanedData.sessionTime && !/^\d+([.,]\d+)?\s*(min|hr)$/i.test(cleanedData.sessionTime)) {
         console.warn(`Formato de tiempo de sesión inconsistente después de la extracción: ${cleanedData.sessionTime}. Intentando re-formatear.`);
         const timeMatch = String(cleanedData.sessionTime).match(/(\d+([.,]\d+)?)\s*(minutos?|min|horas?|hr|h)?/i);
         if (timeMatch) {
             const value = timeMatch[1].replace(',', '.');
             const unit = (timeMatch[2] || 'min').toLowerCase();
             cleanedData.sessionTime = `${value} ${unit.startsWith('h') ? 'hr' : 'min'}`;
         } else {
             cleanedData.sessionTime = ''; // Limpiar si no se puede re-formatear
         }
     }

    // Conflicto PREFERENCIA == EVITACIÓN
    if (cleanedData.exercisePreference && cleanedData.exerciseAvoidance &&
        cleanedData.exercisePreference.toLowerCase() === cleanedData.exerciseAvoidance.toLowerCase()) {
        console.log(`Conflicto: Preferencia == Evitación ('${cleanedData.exercisePreference}'). Eliminando evitación.`);
        cleanedData.exerciseAvoidance = "";
    }

    // Asegurar que IMC sea null si no es un número válido
    if (cleanedData.imc && isNaN(parseFloat(cleanedData.imc))) {
        cleanedData.imc = null;
    }

    // Eliminar claves con valores vacíos "" o null
    Object.keys(cleanedData).forEach(key => {
        if (cleanedData[key] === "" || cleanedData[key] === null) {
            delete cleanedData[key];
        }
    });

    return cleanedData;
}

/**
 * Parsea una cadena de entrada de la base de conocimiento (KB).
 * Intenta identificar condición, capacidad, fase, objetivo, etc.
 * @param {string} inputStr - La cadena de entrada de la KB.
 * @returns {object} - Objeto con las partes parseadas.
 */
function parseInputString(inputStr) {
    // Mantener la lógica original de parseo, ya que parece específica para la estructura de la KB
    const parts = { condition: null, capacity: null, phase: null, objective: null, loadContext: null, raw: inputStr };
    if (!inputStr || typeof inputStr !== 'string') return parts;

    const inputLower = inputStr.toLowerCase().trim();
    let remainingInput = inputLower;

    // Prioritize matching specific prefixes
    let match = remainingInput.match(/^(fase|objetivo|condición):\s*([^,]+)/);

    if (match) {
        const type = match[1];
        const value = match[2].trim();
        remainingInput = remainingInput.substring(match[0].length).trim().replace(/^,/, '').trim();

        if (type === 'fase') {
            parts.phase = value;
        } else if (type === 'objetivo') {
            parts.objective = value;
            // Infer capacity/phase from objective
            if (/fuerza|potencia|velocidad|hipertrofia|musculación|volumen/i.test(value)) parts.capacity = 'fuerza/potencia';
            else if (/resistencia|cardio|aguantar|perder peso|adelgazar|quemar grasa/i.test(value)) parts.capacity = 'resistencia';
            else if (/técnica|aprender/i.test(value)) parts.phase = 'técnica de ejecución';
            else if (/adaptación|acondicionamiento|preparación/i.test(value)) parts.phase = 'adaptación anatómica';

        } else if (type === 'condición') {
            parts.condition = value;
            const capacityMatch = remainingInput.match(/^capacidad:\s*([^,]+)/);
            if (capacityMatch) {
                parts.capacity = capacityMatch[1].trim();
                remainingInput = remainingInput.substring(capacityMatch[0].length).trim().replace(/^,/, '').trim();
            }
            const loadMatch = remainingInput.match(/^carga:\s*(.+)/);
            if (loadMatch) {
                parts.loadContext = loadMatch[1].trim();
            }
        }
    } else {
        // Fallback: Assume based on keywords if no prefix
        if (/\bfase\b/i.test(inputLower)) parts.phase = inputLower;
        else if (/\bobjetivo\b/i.test(inputLower)) parts.objective = inputLower;
        // Add more specific keyword checks for objectives/capacities before defaulting to condition
        else if (/\b(fuerza|hipertrofia|resistencia|potencia|velocidad)\b/i.test(inputLower)) parts.objective = inputLower;
        else parts.condition = inputLower; // Default assumption
    }

    // Clean up capacity
    if (parts.capacity) {
        parts.capacity = parts.capacity.split('(')[0].trim();
        if (parts.capacity.startsWith('resistencia')) parts.capacity = 'resistencia';
        else if (/potencia|velocidad|fuerza/i.test(parts.capacity)) parts.capacity = 'fuerza/potencia';
    }

     // Clean up phase
     if (parts.phase) {
        if (/técnica|tecnica/i.test(parts.phase)) parts.phase = 'técnica de ejecución';
        else if (/adaptaci[oó]n|acondicionamiento/i.test(parts.phase)) parts.phase = 'adaptación anatómica';
    }

    // Clean up objective
     if (parts.objective) {
         if (/fuerza|potencia|velocidad|hipertrofia|musculación|volumen/i.test(parts.objective)) parts.objective = 'fuerza/hipertrofia';
         else if (/resistencia|cardio|aguantar|perder peso|adelgazar|quemar grasa/i.test(parts.objective)) parts.objective = 'resistencia/pérdida de peso';
     }


    return parts;
}

/**
 * Encuentra directrices relevantes de la base de conocimiento (KB) basadas en los datos del cliente.
 * Utiliza mapeos expandidos y un sistema de puntuación para priorizar las directrices más pertinentes.
 * @param {Object} clientData - Datos del cliente limpios y normalizados.
 * @param {Array<Object>} knowledgeBase - Array de objetos de la KB (cada uno con 'input' y 'output').
 * @returns {Array<Object>} - Array de directrices relevantes ordenadas por puntuación descendente.
 */
function findRelevantGuidelines(clientData, knowledgeBase) {
    const relevantGuidelines = [];
    const addedInputs = new Set(); // Para evitar duplicados exactos de la KB

    if (!Array.isArray(knowledgeBase)) {
        console.warn("Knowledge base no es un array válido.");
        return [];
    }

    // --- 1. Preparar Datos del Cliente para Matching ---
    const safeLowerCase = (val) => String(val || '').toLowerCase().trim();

    // Agrupar todas las condiciones/limitaciones del cliente
    let clientConditionsInput = [
        clientData.medicalCondition, clientData.surgery, clientData.muscleInjury,
        clientData.tendinopathy, clientData.mobilityLimitation, clientData.posturalProblem
    ].map(safeLowerCase).filter(c => c && !/^(no|nada|ningun[ao])$/i.test(c)); // Filtrar negaciones simples y vacíos

    const clientGoal = safeLowerCase(clientData.trainingGoal);
    const clientExperience = safeLowerCase(clientData.experienceLevel);
    const clientAge = parseInt(clientData.age, 10) || null;
    const clientGender = safeLowerCase(clientData.gender);
    const clientImc = parseFloat(clientData.imc) || null;

    // --- 2. Mapeos Expandidos (Clave para conectar datos del cliente con terminología de la KB) ---
    // (Mantener los mapeos extensos proporcionados en el código original)
    const conditionMappings = {
        "arritmia": "arritmias", "corazón": ["cardiopatía isquémica", "insuficiencia cardíaca", "arritmias", "miocardiopatías", "valvulopatías"], "infarto": "cardiopatía isquémica", "angina": "cardiopatía isquémica", "tensión alta": "hipertensión arterial", "tension alta": "hipertensión arterial", "hipertensión": "hipertensión arterial", "circulación": ["insuficiencia venosa", "enfermedad arterial periférica"], "varices": "insuficiencia venosa", "eap": "enfermedad arterial periférica", "claudicación": "enfermedad arterial periférica", "marcapasos": "portadores de marcapasos", "válvula corazón": "valvulopatías",
        "amputación": "amputaciones", "artritis juvenil": "artritis idiopática juvenil", "artritis": "artrosis y artritis", "artrosis": "artrosis y artritis", "desgaste articular": "artrosis y artritis", "dolor cuello": "cervicalgia", "cervicalgia": "cervicalgia", "escoliosis": "escoliosis", "desviación columna": "escoliosis", "dolor hombro": "hombro doloroso", "manguito rotador": "hombro doloroso", "lesión rodilla": "lesiones ligamentos rodilla", "ligamento rodilla": "lesiones ligamentos rodilla", "lesión tobillo": "lesiones ligamentos tobillo", "esguince tobillo": "lesiones ligamentos tobillo", "tendinitis": "tendinopatía", "tendinosis": "tendinopatía", "dolor tendón": "tendinopatía", "lumbalgia": "lumbalgia", "lumbago": "lumbalgia", "dolor espalda baja": "lumbalgia", "osteoporosis": "osteoporosis", "huesos débiles": "osteoporosis", "prótesis rodilla": "prótesis de rodilla y de tobillo", "prótesis tobillo": "prótesis de rodilla y de tobillo", "prótesis cadera": "prótesis de cadera",
        "alergia comida": "alergia alimentaria", "alergia alimentos": "alergia alimentaria", "estreñimiento": "estreñimiento crónico", "diabetes": "diabetes mellitus", "azúcar alto": "diabetes mellitus",
        "asma": "asma bronquial", "bronquiectasia": "bronquiectasia", "fibrosis quística": "fibrosis quística", "epoc": "enfermedad pulmonar obstructiva crónica", "enfisema": "enfermedad pulmonar obstructiva crónica", "bronquitis crónica": "enfermedad pulmonar obstructiva crónica",
        "incontinencia": "incontinencia urinaria", "pérdida orina": "incontinencia urinaria", "insuficiencia renal": "insuficiencia renal crónica", "riñón": "insuficiencia renal crónica", "diálisis": "insuficiencia renal crónica",
        "embarazo": "embarazo", "embarazada": "embarazo", "posparto": "posparto", "postparto": "posparto", "después del parto": "posparto", "menopausia": "menopausia", "mayor": "personas mayores", "tercera edad": "personas mayores", "viejo": "personas mayores", "caídas": "caídas", "riesgo caída": "caídas", "pérdida músculo": "sarcopenia", "sarcopenia": "sarcopenia", "fragilidad": "fragilidad", "frágil": "fragilidad",
        "sobrepeso": "sobrepeso", "obesidad": "obesidad",
        "general": "adultos", "ninguna": "adultos" // Mapeo base
       };
    const goalMappings = {
       "fuerza": ["fuerza", "fuerza máxima", "fuerza rápida", "fuerza velocidad/potencia"], "hipertrofia": ["fuerza", "musculación deportiva", "hipertrofia"], "ganar músculo": ["fuerza", "musculación deportiva", "hipertrofia"], "masa muscular": ["fuerza", "musculación deportiva", "hipertrofia"], "volumen": ["fuerza", "musculación deportiva", "hipertrofia"], "estética": ["fuerza", "musculación deportiva", "hipertrofia", "pérdida de peso"], "resistencia": ["resistencia", "resistencia a la fuerza"], "cardio": ["resistencia"], "aguantar más": ["resistencia"], "perder peso": ["resistencia", "pérdida de peso"], "adelgazar": ["resistencia", "pérdida de peso"], "quemar grasa": ["resistencia", "pérdida de peso"], "potencia": ["fuerza", "fuerza rápida", "fuerza velocidad/potencia"], "velocidad": ["fuerza", "fuerza rápida"], "explosividad": ["fuerza", "fuerza rápida", "fuerza velocidad/potencia"], "técnica": ["técnica de ejecución"], "aprender": ["técnica de ejecución"], "adaptación": ["adaptación anatómica"], "acondicionamiento": ["adaptación anatómica", "resistencia"], "preparación física": ["adaptación anatómica", "resistencia", "fuerza"], "salud": ["adultos", "resistencia", "fuerza", "salud"]
    };
    const experienceMappings = {
       "principiante": ["entrenamiento de la técnica de ejecución", "adaptación anatómica"], "nuevo": ["entrenamiento de la técnica de ejecución", "adaptación anatómica"], "0": ["entrenamiento de la técnica de ejecución", "adaptación anatómica"], "poco tiempo": ["entrenamiento de la técnica de ejecución", "adaptación anatómica"], "intermedio": ["musculación deportiva", "fuerza", "resistencia", "hipertrofia"], "avanzado": ["fuerza máxima", "fuerza rápida", "potencia", "fuerza velocidad/potencia", "musculación deportiva"], "experto": ["fuerza máxima", "fuerza rápida", "potencia", "fuerza velocidad/potencia"]
    };

    // Expandir condiciones del cliente usando mapeos
    let clientConditionsMapped = [...clientConditionsInput]; // Empezar con las palabras del cliente
    clientConditionsInput.forEach(cond => {
        Object.keys(conditionMappings).forEach(key => {
            // Usar includes para permitir coincidencias parciales (e.g., "dolor lumbar" -> "lumbalgia")
            if (cond.includes(key)) {
                const mapped = conditionMappings[key];
                clientConditionsMapped = clientConditionsMapped.concat(Array.isArray(mapped) ? mapped : [mapped]);
            }
        });
    });
    // Añadir condición basada en IMC
    if (clientImc) {
        if (clientImc >= 30) clientConditionsMapped.push("obesidad");
        else if (clientImc >= 25) clientConditionsMapped.push("sobrepeso");
    }
     // Añadir condición basada en edad
     if (clientAge >= 65) clientConditionsMapped.push("personas mayores");
     // Añadir condición base "adultos"
     clientConditionsMapped.push("adultos");
    const uniqueClientConditions = [...new Set(clientConditionsMapped.map(c => c.toLowerCase()))]; // Final unique list, lowercase

    // Expandir objetivo del cliente
    let clientGoalsMapped = [clientGoal];
    if (clientGoal) {
        Object.keys(goalMappings).forEach(key => { if (clientGoal.includes(key)) clientGoalsMapped = clientGoalsMapped.concat(goalMappings[key]); });
    }
    const uniqueClientGoals = [...new Set(clientGoalsMapped.filter(g => g).map(g => g.toLowerCase()))];

    // Expandir experiencia del cliente
    let clientPhasesMapped = [clientExperience];
     if (clientExperience) {
        Object.keys(experienceMappings).forEach(key => { if (clientExperience.includes(key)) clientPhasesMapped = clientPhasesMapped.concat(experienceMappings[key]); });
     }
    const uniqueClientPhases = [...new Set(clientPhasesMapped.filter(p => p).map(p => p.toLowerCase()))];


    // --- 3. Iterar a través de la Base de Conocimiento y Puntuar ---
    knowledgeBase.forEach(entry => {
        if (!entry || !entry.input || !entry.output) return; // Saltar entradas inválidas

        const parsedInput = parseInputString(entry.input); // Parsear la entrada de la KB
        let score = 0;
        const kbInputLower = entry.input.toLowerCase(); // Para búsquedas de keywords directas

        // a) Match por Condición (Mayor Puntuación)
        if (parsedInput.condition) {
            const kbConditionLower = parsedInput.condition.toLowerCase();
            if (uniqueClientConditions.some(clientCond => kbConditionLower === clientCond || (clientCond.length > 4 && kbConditionLower.includes(clientCond)) || (kbConditionLower.length > 4 && clientCond.includes(kbConditionLower)))) {
                score += 5; // Puntuación alta por coincidencia de condición
            }
             // Bonus si la condición de la KB es específica de población y coincide
             if (kbConditionLower.includes('personas mayores') && uniqueClientConditions.includes('personas mayores')) score += 2;
             if (kbConditionLower.includes('embarazo') && uniqueClientConditions.includes('embarazo')) score += 2; // Asumiendo que el cliente indicó embarazo
             // ... otros bonus específicos ...
             if (kbConditionLower === 'adultos' && uniqueClientConditions.includes('adultos')) score += 1; // Puntuación base
        }

        // b) Match por Objetivo -> Objetivo/Capacidad de la KB (Puntuación Media)
        if (parsedInput.objective || parsedInput.capacity) {
             const kbObjectiveLower = parsedInput.objective ? parsedInput.objective.toLowerCase() : '';
             const kbCapacityLower = parsedInput.capacity ? parsedInput.capacity.toLowerCase() : '';
             if (uniqueClientGoals.some(clientGoal => kbObjectiveLower.includes(clientGoal) || kbCapacityLower.includes(clientGoal))) {
                 score += 3;
             }
        }

        // c) Match por Experiencia -> Fase de la KB (Puntuación Media-Baja)
        if (parsedInput.phase) {
            const kbPhaseLower = parsedInput.phase.toLowerCase();
             if (uniqueClientPhases.some(clientPhase => kbPhaseLower.includes(clientPhase))) {
                 score += 2;
             }
        }

        // d) Match por Keywords Generales (Puntuación Baja - Fallback)
        //    Si no hubo coincidencias fuertes, buscar keywords del cliente en la entrada de la KB
        if (score < 3) {
             if (uniqueClientConditions.some(cond => cond !== 'adultos' && kbInputLower.includes(cond))) score += 1;
             if (uniqueClientGoals.some(goal => kbInputLower.includes(goal))) score += 1;
             if (uniqueClientPhases.some(phase => kbInputLower.includes(phase))) score += 1;
        }


        // Añadir directriz si tiene puntuación y no es duplicada
        if (score > 0 && !addedInputs.has(entry.input)) {
            relevantGuidelines.push({ input: entry.input, output: entry.output, score: score });
            addedInputs.add(entry.input);
        }
    });

    // Ordenar por puntuación descendente
    relevantGuidelines.sort((a, b) => b.score - a.score);

    console.log(`Se encontraron ${relevantGuidelines.length} directrices relevantes en la KB.`);
    // console.log("Top 5 Directrices:", relevantGuidelines.slice(0, 5)); // Para depuración
    return relevantGuidelines;
}


// Exportar función principal y otras utilidades si se necesitan externamente o para testing
module.exports = {
    generateRoutine,
    // Exportar funciones auxiliares clave para posible testing o uso externo
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
    createPromptAndGenerate // Exportar esta también
};

