const OpenAI = require("openai");
const dotenv = require('dotenv');
const fs = require('fs'); // Importar 'fs' para verificar existencia de knowledge_base.json

// Cargar variables de entorno si no se ha hecho ya
dotenv.config();

// Configura el cliente de OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Mapeo de campos del formulario a preguntas
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


  // --- Búsqueda General ---
  // 1. Buscar por coincidencia de keyword en el texto de la PREGUNTA
  const responseByQuestion = responses.find(r => r && r.question && r.question.toLowerCase().includes(normalizedKeyword));
  if (responseByQuestion?.answer?.trim()) {
    return responseByQuestion.answer.trim();
  }

  // 2. Buscar por campo específico (field) si coincide con la keyword
   const responseByField = responses.find(r => r && r.field && r.field.toLowerCase() === normalizedKeyword);
   if (responseByField?.answer?.trim()) {
       return responseByField.answer.trim();
   }

    // 3. Buscar por coincidencia de keyword en el texto de la RESPUESTA (Fallback más arriesgado)
    const responseByAnswer = responses.find(r =>
     r && r.answer && r.answer.toLowerCase().includes(normalizedKeyword)
    );
    if (responseByAnswer?.answer?.trim()) {
    // Considerar añadir un log aquí si se usa este método, ya que puede ser menos preciso
    // console.log(`Keyword '${normalizedKeyword}' encontrada en respuesta: '${responseByAnswer.answer}' (Pregunta: '${responseByAnswer.question}')`);
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
        if (item && item.question && typeof item.answer === 'string') { // Validar cada item
          if (!item.field) {
               const fieldMapping = FORM_FIELD_QUESTIONS.find(q => q.text === item.question);
               return {...item, field: fieldMapping ? fieldMapping.id : undefined };
          }
          return item;
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

    // Formatear respuestas para el prompt, excluyendo datos sensibles y respuestas vacías
    const formattedResponsesForPrompt = responses
      .filter(item =>
           item && // Asegurar que el item exista
           item.answer && String(item.answer).trim() !== '' && // Excluir respuestas vacías o nulas
           item.field !== 'nombre' &&
           item.field !== 'email' &&
           item.question && // Asegurar que la pregunta exista
           !item.question.toLowerCase().includes("cómo te llamas") &&
           !item.question.toLowerCase().includes("dirección de correo electrónico")
      )
      .map(item => `Pregunta: ${item.question}\nRespuesta: ${item.answer}`);

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
      const mainValueStr = String(processedFields[main] || '').toLowerCase();
      const descValue = processedFields[desc];

      if ((mainValueStr === 'sí' || mainValueStr === 'si') && descValue && String(descValue).trim()) {
        processedFields[main] = `Sí: ${String(descValue).trim()}`;
        delete processedFields[desc];
      } else if (mainValueStr === 'no') {
        delete processedFields[desc]; // Eliminar descripción si la respuesta es No
      }
    }
  });

  return Object.entries(processedFields)
    .map(([field, value]) => {
      const questionText = questionMap[field] || field;
      const trimmedValue = value !== null && value !== undefined ? String(value).trim() : ''; // Asegurar string y trim

      if (trimmedValue !== '') {
        return {
          question: questionText,
          answer: trimmedValue,
          field: field
        };
      }
      return null;
    })
    .filter(item => item !== null);
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
    }).filter(r => r.question && r.answer); // Filtrar si falta algo
  }

  // Intenta detectar formato "Pregunta\nRespuesta" o líneas alternas Q/A
  const results = [];
  let currentQuestion = null;
  let possibleNewLineFormat = false;

     // Check for explicit newline format in any line
     if (cleanedLines.some(line => line.includes('\n'))) {
          possibleNewLineFormat = true;
     }

     cleanedLines.forEach((line, index) => {
          if (line.includes('\n')) {
               const parts = line.split('\n');
               if(parts[0] && parts[1]){ // Asegurar que hay pregunta y respuesta
                     results.push({ question: parts[0].trim(), answer: parts[1].trim() });
                     currentQuestion = null; // Reset state
               } else if (parts[0]) { // Si solo hay pregunta, guardarla para la siguiente línea
                     currentQuestion = parts[0].trim();
               }
          } else if (index % 2 === 0 && !possibleNewLineFormat) { // Asumir Q si es línea par Y no detectamos \n antes
                currentQuestion = line;
          } else if (currentQuestion) { // Asumir R si teníamos Q pendiente
                results.push({ question: currentQuestion, answer: line });
                currentQuestion = null; // Reset
          } else if (index === 0 && !possibleNewLineFormat) { // Si es la primera línea sin pareja (y sin \n detectado)
                  results.push({ question: "Información inicial", answer: line }); // O "Información adicional"
          } else if (!possibleNewLineFormat) { // Línea impar sin pregunta pendiente (y sin \n detectado)
                  results.push({ question: "Información adicional", answer: line });
          }
          // Si possibleNewLineFormat es true pero esta línea no tiene \n, se ignora a menos que haya currentQuestion
     });

     // Si después del bucle queda una pregunta pendiente (última línea fue Q)
     if (currentQuestion) {
          results.push({ question: currentQuestion, answer: "" }); // Añadirla con respuesta vacía
     }


  if (results.length > 0 && results.length >= cleanedLines.length / 2) {
       console.log("Detectado formato líneas alternas Q/A o Pregunta\\nRespuesta.");
      return results.filter(r => r.question && typeof r.answer === 'string');
  }

  // Fallback: Mapeo contextual si los formatos anteriores fallan
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

   const questionPatterns = FORM_FIELD_QUESTIONS.map(q => {
       const keywords = q.text
            .toLowerCase()
            .replace(/[¿?¡!,.]/g, '') // Quitar más puntuación
            .split(/\s+/)
            .filter(word => word.length >= 3 && !['cómo', 'cuál', 'cuánto', 'has', 'hay', 'con', 'para', 'que', 'por', 'tus', 'alguna', 'alguno', 'debes', 'puede', 'afectar', 'describirías', 'principal', 'soportado', 'soportada', 'del', 'con', 'las', 'los', 'una', 'uno', 'eres', 'tiene', 'tipo', 'sobre'].includes(word)); // Filtro más estricto
       return {
            question: q.text,
            patterns: keywords.map(kw => new RegExp(`\\b${kw}\\b`, 'i')) // Word boundary para evitar subcadenas
       };
   }).filter(qp => qp.patterns.length > 0); // Quitar preguntas sin keywords útiles


    questionPatterns.push(
        { question: "¿Cuánto pesas?", patterns: [/\b(kg|kilos|libras|lb)\b/i, /\bpesa?s?\b/i] },
        { question: "¿Cuál es tu altura?", patterns: [/\b(cm|metros|m|ft|pie)\b/i, /\baltura\b/i, /\bmides?\b/i, /\bestatura\b/i] },
        { question: "¿Cuántos días a la semana puedes entrenar?", patterns: [/\bd[ií]as\b/i, /veces por semana/i, /frecuencia/i, /\bsemana\b/i] },
        { question: "¿Cuánto tiempo puedes dedicar por sesión?", patterns: [/\bminutos\b/i, /\bhoras?\b/i, /tiempo por sesi[oó]n/i, /duraci[oó]n/i, /\bsesi[oó]n\b/i] },
        { question: "¿Hay algo más que debamos saber?", patterns: [/adicional/i, /comentario/i, /extra/i, /a[ñn]adir/i, /\bsaber\b/i] }
    );

  const results = [];
  const assignedLines = new Set();

  questionPatterns.forEach(({ question, patterns }) => {
       let bestMatch = { score: 0, line: null, index: -1 };

       lines.forEach((line, index) => {
            if (assignedLines.has(index)) return;

            let currentScore = 0;
            patterns.forEach(pattern => {
                 if (pattern.test(line)) {
                      currentScore++;
                 }
            });

            // Priorizar mayor número de coincidencias, y luego línea más corta (más específica)
            if (currentScore > 0) {
                 if (currentScore > bestMatch.score || (currentScore === bestMatch.score && line.length < bestMatch.line?.length)) {
                      bestMatch = { score: currentScore, line, index };
                 }
            }
       });

       if (bestMatch.line !== null && !assignedLines.has(bestMatch.index)) {
            // Evitar asignar la misma línea si otra pregunta tuvo un score igual o mayor
            const existingAssignment = results.find(r => r.answer === bestMatch.line);
            if (!existingAssignment) { // Solo asignar si no está ya en results
                  results.push({ question: question, answer: bestMatch.line });
                  assignedLines.add(bestMatch.index);
            }
       }
  });

  // Añadir líneas no asignadas a "Información adicional"
  let additionalInfoAnswer = lines.filter((line, index) => !assignedLines.has(index)).join('\n'); // Unir con saltos de línea
    if (additionalInfoAnswer) {
         results.push({ question: "Información adicional", answer: additionalInfoAnswer });
    }


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
    } else if (data.gender.toLowerCase() === 'no binario'){
         descriptionParts.push("un cliente de género no binario");
    } else {
        descriptionParts.push("un cliente"); // Género no especificado o no binario explícito
    }
  } else {
    descriptionParts.push("un cliente"); // Sin dato de género
  }

  // EDAD
  if (data.age && /^\d+$/.test(String(data.age).trim().split(' ')[0])) { // Verifica si empieza con número
       descriptionParts.push(`de ${String(data.age).trim().replace(/\s*años$/i, '')} años`); // Añade "años" y limpia si ya estaba
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
    if (imcValue < 18.5) imcDesc += `peso inferior al normal`;
    else if (imcValue < 25) imcDesc += `peso normal`;
    else if (imcValue < 30) imcDesc += `sobrepeso`;
    else if (imcValue < 35) imcDesc += `obesidad grado 1`;
    else if (imcValue < 40) imcDesc += `obesidad grado 2`;
    else imcDesc += `obesidad grado 3 (mórbida)`;
    descriptionParts.push(imcDesc);
  }

  // NIVEL DE EXPERIENCIA Y CONDICIÓN FÍSICA (evitar redundancia)
  let experienceAdded = false;
  if (data.experienceLevel) {
       descriptionParts.push(`con nivel de experiencia ${data.experienceLevel.toLowerCase()}`);
       experienceAdded = true;
  }
  if (data.fitnessLevel && (!experienceAdded || data.fitnessLevel.toLowerCase() !== data.experienceLevel?.toLowerCase())) {
        if (!/experiencia|principiante|intermedio|avanzado/i.test(data.fitnessLevel)) { // Solo añadir si es descriptivo (activo, sedentario...)
             descriptionParts.push(`y condición física ${data.fitnessLevel.toLowerCase()}`);
        }
  }

  // OBJETIVO
  if (data.trainingGoal) descriptionParts.push(`su objetivo principal es ${data.trainingGoal.toLowerCase()}`);

  // LOGÍSTICA DE ENTRENAMIENTO
  if (data.trainingLocation) descriptionParts.push(`entrena habitualmente en ${data.trainingLocation.toLowerCase()}`);
  if (data.daysPerWeek) {
       let daysText = String(data.daysPerWeek).toLowerCase();
       const dayMap = { '1': 'un día', '2': 'dos días', '3': 'tres días', '4': 'cuatro días', '5': 'cinco días', '6': 'seis días', '7': 'siete días' };
       daysText = dayMap[daysText] || daysText; // Convertir número a texto si es posible
       descriptionParts.push(`dispone de ${daysText} a la semana`);
  }
  if (data.sessionTime) {
       let timeText = String(data.sessionTime).toLowerCase();
        if (/^\d+$/.test(timeText)) timeText += " min"; // Añadir unidad si falta
       descriptionParts.push(`para sesiones de ${timeText}`);
  }

  // CONTEXTO MÉDICO Y LIMITACIONES (agrupar y evitar duplicados)
  const healthContext = new Set();
  const addHealthInfo = (label, value) => {
       const trimmedValue = String(value || '').trim();
       if (trimmedValue && !/no$|nada|ningun[oa]/i.test(trimmedValue)) {
            const cleanValue = trimmedValue.replace(/^Sí:\s*/i, '').trim();
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
        if (trimmedValue && !/no$|nada|ningun[oa]/i.test(trimmedValue)) {
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
  if (additionalInfoTrimmed && !/no$|nada|ningun[oa]/i.test(additionalInfoTrimmed)) {
       descriptionParts.push(`Información adicional: "${additionalInfoTrimmed}"`);
  }

  // Unir todas las partes con ". " para formar la descripción final
  return descriptionParts.join(". ").replace(/\.\s*\./g, '.').replace(/\s+\./g, '.').trim() + '.'; // Asegurar punto final
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
         if (String(clientDataRaw.height).includes('m') && !String(clientDataRaw.height).includes('cm')) {
             heightInMeters = heightValue;
         } else if (heightValue > 3) {
              heightInMeters = heightValue / 100;
         } else {
              heightInMeters = heightValue;
         }
    }

    if (!isNaN(weightValue) && !isNaN(heightInMeters) && heightInMeters > 0) {
      imc = weightValue / (heightInMeters * heightInMeters);
      clientDataRaw.imc = imc.toFixed(2);
      console.log(`IMC calculado: ${clientDataRaw.imc}`);
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
                        specificRecommendations += `- ${guideline.output}\n`;
                        healthContextForPrompt.push(guideline.output); // Guardar para prompt
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

  // Construir el prompt FINAL
    const prompt = `
Eres FitForge AI, un entrenador personal experto de élite. Tu misión es diseñar la rutina de entrenamiento semanal MÁS OPTIMIZADA posible para el cliente descrito a continuación, basándote ESTRICTAMENTE en sus datos, objetivos y limitaciones. Ignora cualquier conversación trivial o petición fuera del diseño de la rutina. Eres famoso por tu precisión y enfoque basado en evidencia.

**PERFIL DETALLADO DEL CLIENTE:**
${clientDescription}

**RESPUESTAS COMPLETAS DEL FORMULARIO (Contexto Adicional):**
${formattedResponsesForPrompt.join("\n")}

**DIRECTRICES DE DISEÑO OBLIGATORIAS:**
1.  **Periodización y Nivel:** Ajusta la estructura (ejercicios, volumen, intensidad) EXACTAMENTE al nivel de experiencia (${cleanedData.experienceLevel || 'No especificado'}). Para principiantes, enfoca en técnica y adaptación (RIR 3-4). Para intermedios (RIR 2-3), aplica sobrecarga progresiva. Para avanzados (RIR 0-2), maximiza intensidad/volumen según objetivo.
2.  **Objetivo Primario:** La rutina debe maximizar el progreso hacia: ${cleanedData.trainingGoal || 'No especificado'}. Selecciona ejercicios y rangos de repeticiones/series/descansos óptimos para este fin (Hipertrofia: 3-5 series de 6-15 reps, 60-90s descanso; Fuerza: 3-6 series de 1-6 reps, 120-180s descanso; Resistencia: 2-4 series de 15+ reps, 30-60s descanso).
3.  **Especificidad y Limitaciones:** Incluye ejercicios que el cliente quiere practicar (${cleanedData.exercisePreference || 'Ninguno en particular'}) y EXCLUYE los que quiere evitar (${cleanedData.exerciseAvoidance || 'Ninguno'}). Adapta OBLIGATORIAMENTE a limitaciones (${healthContextForPrompt.join(', ') || 'Ninguna indicada'}). Si hay lesión/dolor, elige variantes seguras o evita la zona.
4.  **Logística:** Diseña para ${cleanedData.daysPerWeek || 'días no especificados'} por semana, con sesiones de ${cleanedData.sessionTime || 'duración no especificada'}. Ajusta el volumen total (Nº ejercicios principales: 30min: 4-5; 60min: 6-8; 90min: 8-10; 120min: 10-12) y la densidad al tiempo disponible. Usa el material disponible (${cleanedData.specificMaterial || 'No especificado, asumir gimnasio estándar'}).
5.  **Estructura Preferida:** Respeta la preferencia (${cleanedData.trainingPreference || 'No especificada'}). Si no, elige la más adecuada (Principiante: Full Body; Intermedio/Avanzado: Split según días/objetivo, e.g., Empuje/Tire/Pierna, Torso/Pierna, Dividida por grupos).
6.  **IMC y Consideraciones:** ${cleanedData.imc ? `Considera el IMC de ${cleanedData.imc}. Si es >25, limita impacto articular inicial. Si es <18.5, asegura suficiente estímulo y nutrición (aunque no das consejos de nutrición).` : 'IMC no disponible.'}

**FORMATO DE SALIDA (HTML ESTRICTO - SIN MARKDOWN):**
Genera ÚNICAMENTE código HTML. Para CADA DÍA de entrenamiento, usa esta estructura de tabla EXACTA:

<table>
    <tr>
        <th colspan="5">Día X: [Enfoque del Día, e.g., Empuje, Tracción, Pierna, Full Body]</th>
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
    <tr><td>[Ejercicio Activación 1]</td><td>2</td><td>10-15</td><td>30s</td><td>[Nota específica]</td></tr>
    <tr><td>[Ejercicio Activación 2]</td><td>2</td><td>10-15</td><td>30s</td><td>[Nota específica]</td></tr>
    <tr class="rutina-header">
        <td colspan="5"><b>Rutina Principal</b></td>
    </tr>
    <tr>
        <th>Ejercicio</th>
        <th>Series</th>
        <th>Reps</th>
        <th>Descanso</th>
        <th>Notas Clave / RIR / Tempo</th> </tr>
    <tr><td>[Ejercicio Principal 1]</td><td>[Nº]</td><td>[Rango]</td><td>[Tiempo]s</td><td>[Nota / RIR / Tempo e.g., 31X0]</td></tr>
    <tr><td>[Ejercicio Principal 2]</td><td>[Nº]</td><td>[Rango]</td><td>[Tiempo]s</td><td>[Nota / RIR / Tempo]</td></tr>
    </table>

<div class="side-variants-container">
    <div class="side-variants-title">Alternativas y Progresiones (Día X)</div>
    <div class="side-variant-item">
        <div class="side-variant-title">[Ejercicio Original 1] → [Variante 1]</div>
        <div class="side-variant-description">[Motivo: e.g., Si sientes molestia en X..., Para mayor dificultad..., Si no tienes Y material...]</div>
    </div>
     <div class="side-variant-item">
        <div class="side-variant-title">[Ejercicio Original 2] → [Variante 2]</div>
        <div class="side-variant-description">[Motivo]</div>
    </div>
    </div>

**REGLAS ADICIONALES CRÍTICAS:**
* **Precisión:** Nombres técnicos. Parámetros exactos (Series, Rango Reps, Descanso en segundos). Usa RIR (Reps In Reserve) o Tempo (e.g., 31X0) en Notas Clave cuando sea relevante.
* **Volumen:** Cumple el número MÍNIMO de ejercicios PRINCIPALES según duración. La activación NO cuenta.
* **Notas Clave:** Breves y cruciales (máx 15 palabras).
* **Variantes:** Una variante ÚTIL (progresión/regresión/equipo/adaptación) por cada ejercicio principal. Lenguaje directo.
* **SIN EXTRAS:** Solo HTML. Sin saludos, explicaciones, intros, conclusiones. NO uses markdown (\`\`\`).

${specificRecommendations}

Diseña la rutina SEMANAL completa AHORA.`;

  let timeoutId; // <<<--- Declarado con let fuera del try para que sea accesible en catch
  try {
    
    console.log("Enviando solicitud a OpenAI con prompt final...");
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [
        { role: "system", content: "Eres FitForge AI, un creador experto de rutinas de entrenamiento personalizadas en formato HTML, siguiendo instrucciones muy estrictas." },
        { role: "user", content: prompt }
      ],
      temperature: 0.5
    });
  
    const responseMessage = completion.choices[0]?.message?.content;

    if (!responseMessage) {
      throw new Error("Respuesta vacía de OpenAI");
    }

    // Limpiar posible markdown residual (aunque el prompt lo prohíbe)
    const cleanedHtmlResponse = responseMessage.replace(/```html|```/g, '').trim();

    console.log("Rutina generada exitosamente.");
    // Devolver la respuesta HTML limpia
    return cleanedHtmlResponse; // <<<--- Asegurarse de devolver la rutina

  } catch (error) {
    // ---- INICIO DE MODIFICACIÓN ----
    // Verificar que timeoutId existe antes de intentar limpiarlo
    if (typeof timeoutId !== 'undefined' && timeoutId !== null) {  // <<<--- Añadida esta verificación
        clearTimeout(timeoutId);
        timeoutId = null; // También asignar null aquí por seguridad
    }
    // ---- FIN DE MODIFICACIÓN ----

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
        throw new Error(`Error de solicitud a OpenAI (BadRequest): Revisa la longitud/formato del prompt. ${error.message}`);
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
    const cleanInput = (value) => {
        const strValue = String(value || '').trim();
        if (strValue === '' || /^(no|nada|ningun[oa])$/i.test(strValue)) {
            return ""; // Devolver vacío si es vacío o una negación simple
        }
        // Quitar prefijos como "Sí: " si existen
        return strValue.replace(/^Sí:\s*/i, '').trim();
    };

    // Aplicar limpieza a campos relevantes
    for (const key in cleanedData) {
        if (typeof cleanedData[key] === 'string') {
             // Aplicar limpieza general a casi todos los strings, excepto quizás weight/height/age/days/time que tienen formato específico
             if (!['weight', 'height', 'age', 'daysPerWeek', 'sessionTime', 'imc'].includes(key)) {
                 cleanedData[key] = cleanInput(cleanedData[key]);
             } else {
                 // Solo trim para los campos con formato específico
                  cleanedData[key] = String(cleanedData[key] || '').trim();
             }
        }
    }


    // --- Verificaciones y Formateo Específico ---

    // EDAD
    if (cleanedData.age && !/^\d+$/.test(cleanedData.age) && !/^\d+\s*años$/i.test(cleanedData.age)) {
        console.log(`Limpiando edad no numérica: ${cleanedData.age}`);
        cleanedData.age = ""; // Limpiar si no es un número o "X años"
    } else if (cleanedData.age) {
         cleanedData.age = cleanedData.age.replace(/\s*años$/i, '').trim(); // Quedarse solo con el número
    }

    // GÉNERO
    if (cleanedData.gender && !/masculino|femenino|hombre|mujer|no binario/i.test(cleanedData.gender)) {
        cleanedData.gender = "";
    } else if (cleanedData.gender) {
        // Normalizar a términos comunes
        if (/masculino|hombre/i.test(cleanedData.gender)) cleanedData.gender = "Masculino";
        else if (/femenino|mujer/i.test(cleanedData.gender)) cleanedData.gender = "Femenino";
        else if (/no binario/i.test(cleanedData.gender)) cleanedData.gender = "No Binario";
    }

    // PESO
    if (cleanedData.weight) {
        const weightMatch = cleanedData.weight.match(/(\d+([.,]\d+)?)\s*(kg|kilos|lb|libras)?/i);
        if (weightMatch) {
            const value = weightMatch[1].replace(',', '.');
            const unit = (weightMatch[3] || 'kg').toLowerCase(); // Default a kg
            cleanedData.weight = `${value} ${unit.startsWith('k') ? 'kg' : 'lb'}`; // Formato: "75 kg" o "165 lb"
        } else {
             console.log(`Limpiando peso no válido: ${cleanedData.weight}`);
            cleanedData.weight = "";
        }
    }

    // ALTURA
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
         } else {
              console.log(`Limpiando altura no válida: ${cleanedData.height}`);
              cleanedData.height = "";
         }
    }

    // OBJETIVO
    if (cleanedData.trainingGoal && /dolor|lesi[oó]n|operado|limitaci[óo]n|molestia|recupera/i.test(cleanedData.trainingGoal)) {
        console.log(`Limpiando objetivo sospechoso: ${cleanedData.trainingGoal}`);
        cleanedData.trainingGoal = "";
    }

    // Conflicto PREFERENCIA == EVITACIÓN
    if (cleanedData.exercisePreference && cleanedData.exerciseAvoidance &&
        cleanedData.exercisePreference.toLowerCase() === cleanedData.exerciseAvoidance.toLowerCase()) {
        console.log(`Conflicto: Preferencia == Evitación ('${cleanedData.exercisePreference}'). Eliminando evitación.`);
        cleanedData.exerciseAvoidance = "";
    }

    // DÍAS POR SEMANA
     if (cleanedData.daysPerWeek) {
          const daysMatch = cleanedData.daysPerWeek.match(/(\d+)|(un[oa]?|dos|tres|cuatro|cinco|seis|siete)/i);
        if (daysMatch) {
            const dayMap = { uno: '1', una: '1', dos: '2', tres: '3', cuatro: '4', cinco: '5', seis: '6', siete: '7' };
            cleanedData.daysPerWeek = daysMatch[1] || dayMap[daysMatch[2].toLowerCase()] || ''; // Obtener el número
        } else {
             console.log(`Limpiando días por semana no válidos: ${cleanedData.daysPerWeek}`);
             cleanedData.daysPerWeek = '';
        }
     }

    // TIEMPO POR SESIÓN
    if (cleanedData.sessionTime) {
        const timeMatch = cleanedData.sessionTime.match(/(\d+)\s*(min|minutos|hr|hora|horas)?/i);
        if (timeMatch) {
            const value = timeMatch[1];
            const unit = (timeMatch[2] || 'min').toLowerCase(); // Default a min
             cleanedData.sessionTime = `${value} ${unit.startsWith('h') ? 'hr' : 'min'}`; // Formato "60 min" o "1 hr"
        } else {
             console.log(`Limpiando tiempo por sesión no válido: ${cleanedData.sessionTime}`);
             cleanedData.sessionTime = '';
        }
    }

      // Redundancia NIVEL EXPERIENCIA / CONDICIÓN FÍSICA
    if (cleanedData.experienceLevel && cleanedData.fitnessLevel &&
        cleanedData.experienceLevel.toLowerCase() === cleanedData.fitnessLevel.toLowerCase()) {
         console.log(`Nivel y condición física redundantes. Usando experiencia: '${cleanedData.experienceLevel}'`);
        cleanedData.fitnessLevel = "";
    }

    // Asegurar que IMC sea null si no es un número válido
    if (cleanedData.imc && isNaN(parseFloat(cleanedData.imc))) {
        cleanedData.imc = null;
    }


    return cleanedData;
}


function parseInputString(inputStr) {
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

  return parts;
}


function findRelevantGuidelines(clientData, knowledgeBase) {
  const relevantGuidelines = [];
  const addedInputs = new Set();

    // 1. Normalize client data (asegurarse que son strings o null/number)
    const safeLowerCase = (val) => String(val || '').toLowerCase().trim();
    const clientConditionsInput = [
        clientData.medicalCondition, clientData.surgery, clientData.muscleInjury,
        clientData.tendinopathy, clientData.mobilityLimitation, clientData.posturalProblem
    ].map(safeLowerCase).filter(c => c && !/^(no|ningun[ao])$/i.test(c)); // Filtrar negaciones simples

    const clientGoal = safeLowerCase(clientData.trainingGoal);
    const clientExperience = safeLowerCase(clientData.experienceLevel);
    const clientAge = parseInt(clientData.age, 10) || null;
    const clientGender = safeLowerCase(clientData.gender);
    const clientImc = parseFloat(clientData.imc) || null;

    let clientConditionsMapped = [...clientConditionsInput]; // Start with user's own words


  // 2. Expanded Mappings
  const conditionMappings = { /* ... (keep extensive mappings) ... */
    "arritmia": "arritmias", "corazón": ["cardiopatía isquémica", "insuficiencia cardíaca", "arritmias", "miocardiopatías", "valvulopatías"], "infarto": "cardiopatía isquémica", "angina": "cardiopatía isquémica", "tensión alta": "hipertensión arterial", "tension alta": "hipertensión arterial", "hipertensión": "hipertensión arterial", "circulación": ["insuficiencia venosa", "enfermedad arterial periférica"], "varices": "insuficiencia venosa", "eap": "enfermedad arterial periférica", "claudicación": "enfermedad arterial periférica", "marcapasos": "portadores de marcapasos", "válvula corazón": "valvulopatías",
    "amputación": "amputaciones", "artritis juvenil": "artritis idiopática juvenil", "artritis": "artrosis y artritis", "artrosis": "artrosis y artritis", "desgaste articular": "artrosis y artritis", "dolor cuello": "cervicalgia", "cervicalgia": "cervicalgia", "escoliosis": "escoliosis", "desviación columna": "escoliosis", "dolor hombro": "hombro doloroso", "manguito rotador": "hombro doloroso", "lesión rodilla": "lesiones ligamentos rodilla", "ligamento rodilla": "lesiones ligamentos rodilla", "lesión tobillo": "lesiones ligamentos tobillo", "esguince tobillo": "lesiones ligamentos tobillo", "tendinitis": "tendinopatía", "tendinosis": "tendinopatía", "dolor tendón": "tendinopatía", "lumbalgia": "lumbalgia", "lumbago": "lumbalgia", "dolor espalda baja": "lumbalgia", "osteoporosis": "osteoporosis", "huesos débiles": "osteoporosis", "prótesis rodilla": "prótesis de rodilla y de tobillo", "prótesis tobillo": "prótesis de rodilla y de tobillo", "prótesis cadera": "prótesis de cadera",
    "alergia comida": "alergia alimentaria", "alergia alimentos": "alergia alimentaria", "estreñimiento": "estreñimiento crónico", "diabetes": "diabetes mellitus", "azúcar alto": "diabetes mellitus",
    "asma": "asma bronquial", "bronquiectasia": "bronquiectasia", "fibrosis quística": "fibrosis quística", "epoc": "enfermedad pulmonar obstructiva crónica", "enfisema": "enfermedad pulmonar obstructiva crónica", "bronquitis crónica": "enfermedad pulmonar obstructiva crónica",
    "incontinencia": "incontinencia urinaria", "pérdida orina": "incontinencia urinaria", "insuficiencia renal": "insuficiencia renal crónica", "riñón": "insuficiencia renal crónica", "diálisis": "insuficiencia renal crónica",
    "embarazo": "embarazo", "embarazada": "embarazo", "posparto": "posparto", "postparto": "posparto", "después del parto": "posparto", "menopausia": "menopausia", "mayor": "personas mayores", "tercera edad": "personas mayores", "viejo": "personas mayores", "caídas": "caídas", "riesgo caída": "caídas", "pérdida músculo": "sarcopenia", "sarcopenia": "sarcopenia", "fragilidad": "fragilidad", "frágil": "fragilidad",
    "sobrepeso": "sobrepeso", "obesidad": "obesidad",
    "general": "adultos", "ninguna": "adultos"
   };
  const goalMappings = { /* ... (keep mappings) ... */
       "fuerza": ["fuerza"], "hipertrofia": ["fuerza", "musculación deportiva"], "ganar músculo": ["fuerza", "musculación deportiva"], "masa muscular": ["fuerza", "musculación deportiva"], "volumen": ["fuerza", "musculación deportiva"], "estética": ["fuerza", "musculación deportiva"], "resistencia": ["resistencia"], "cardio": ["resistencia"], "aguantar más": ["resistencia"], "perder peso": ["resistencia", "pérdida de peso"], "adelgazar": ["resistencia", "pérdida de peso"], "quemar grasa": ["resistencia", "pérdida de peso"], "potencia": ["fuerza", "fuerza rápida", "fuerza velocidad/potencia"], "velocidad": ["fuerza", "fuerza rápida"], "explosividad": ["fuerza", "fuerza rápida", "fuerza velocidad/potencia"], "técnica": ["técnica de ejecución"], "aprender": ["técnica de ejecución"], "adaptación": ["adaptación anatómica"], "acondicionamiento": ["adaptación anatómica", "resistencia"], "preparación física": ["adaptación anatómica", "resistencia", "fuerza"], "salud": ["adultos", "resistencia", "fuerza", "salud"]
  };
  const experienceMappings = { /* ... (keep mappings) ... */
     "principiante": ["entrenamiento de la técnica de ejecución", "adaptación anatómica"], "nuevo": ["entrenamiento de la técnica de ejecución", "adaptación anatómica"], "0": ["entrenamiento de la técnica de ejecución", "adaptación anatómica"], "poco tiempo": ["entrenamiento de la técnica de ejecución", "adaptación anatómica"], "intermedio": ["musculación deportiva", "fuerza", "resistencia"], "avanzado": ["fuerza máxima", "fuerza rápida", "potencia", "fuerza velocidad/potencia"], "experto": ["fuerza máxima", "fuerza rápida", "potencia", "fuerza velocidad/potencia"]
  };

    // Expand client conditions using mappings
    clientConditionsInput.forEach(cond => {
        Object.keys(conditionMappings).forEach(key => {
            if (cond.includes(key)) {
                 const mapped = conditionMappings[key];
                 clientConditionsMapped = clientConditionsMapped.concat(Array.isArray(mapped) ? mapped : [mapped]);
            }
        });
    });
     // Add IMC status to conditions
     if (clientImc) {
         if (clientImc >= 30) clientConditionsMapped.push("obesidad");
         else if (clientImc >= 25) clientConditionsMapped.push("sobrepeso");
     }
     // Add general adult condition
     clientConditionsMapped.push("adultos");
     const uniqueClientConditions = [...new Set(clientConditionsMapped)]; // Final unique list


  // 3. Iterate through Knowledge Base
  if (!Array.isArray(knowledgeBase)) {
       console.warn("Knowledge base no es un array válido.");
       return []; // Devolver array vacío si KB no es válido
  }

  knowledgeBase.forEach(entry => {
    if (!entry || !entry.input || !entry.output) return;

    const parsedInput = parseInputString(entry.input);
    let score = 0;

    // a) Match by Condition
     if (parsedInput.condition) {
         const kbConditionLower = parsedInput.condition.toLowerCase();
         if (uniqueClientConditions.some(c => kbConditionLower === c || (c.length > 4 && kbConditionLower.includes(c)) || (kbConditionLower.length > 4 && c.includes(kbConditionLower)))) {
             score += 3; // High score for direct condition match
         }
         // Check special populations (already included in uniqueClientConditions via mapping if relevant)
          if (kbConditionLower.includes('personas mayores') && clientAge >= 65) score += 3;
          if (kbConditionLower.includes('embarazo') && clientGender === 'femenino') score += 3;
          // Add other specific population checks if needed
          if (kbConditionLower === 'adultos') score += 1; // Baseline score for adult guidelines
     }

    // b) Match by Goal -> Objective/Capacity
     if (clientGoal && (parsedInput.objective || parsedInput.capacity)) {
         let goalsToCheck = [clientGoal];
         Object.keys(goalMappings).forEach(key => { if (clientGoal.includes(key)) goalsToCheck = goalsToCheck.concat(goalMappings[key]); });
         goalsToCheck = [...new Set(goalsToCheck)];

         if (goalsToCheck.some(g => (parsedInput.objective && parsedInput.objective.toLowerCase().includes(g)) || (parsedInput.capacity && parsedInput.capacity.toLowerCase().includes(g)))) {
             score += 2;
         }
      }

    // c) Match by Experience -> Phase
     if (clientExperience && parsedInput.phase) {
         let phasesToCheck = [clientExperience];
          Object.keys(experienceMappings).forEach(key => { if (clientExperience.includes(key)) phasesToCheck = phasesToCheck.concat(experienceMappings[key]); });
         phasesToCheck = [...new Set(phasesToCheck)];

         if (phasesToCheck.some(p => parsedInput.phase.toLowerCase().includes(p))) {
             score += 2;
         }
      }

    // Add guideline if relevant and not already added
    if (score > 0 && !addedInputs.has(entry.input)) {
      relevantGuidelines.push({ input: entry.input, output: entry.output, score: score });
      addedInputs.add(entry.input);
    }
  });

  relevantGuidelines.sort((a, b) => b.score - a.score); // Sort by score DESC

  console.log(`Se encontraron ${relevantGuidelines.length} directrices relevantes.`);
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