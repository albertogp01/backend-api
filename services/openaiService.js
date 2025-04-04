// Import necessary modules
const OpenAI = require("openai");
const dotenv = require('dotenv');
const fs = require('fs'); // Import 'fs' to check for knowledge_base.json existence

// Load environment variables if not already loaded
dotenv.config();

// Configure the OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  // Note: Timeout configuration might be needed here depending on the library version
  // e.g., timeout: 120000, // 120 seconds in milliseconds
});

// Mapping of form fields to questions (Spanish)
const FORM_FIELD_QUESTIONS = [
  { id: "nombre", text: "¿Cómo te llamas?" },
  { id: "edad", text: "¿Cuál es tu edad?" },
  { id: "genero", text: "¿Cuál es tu género?" },
  { id: "email", text: "¿Cuál es tu dirección de correo electrónico?" },
  { id: "peso", text: "¿Cuánto pesas?" },
  { id: "altura", text: "¿Cuál es tu altura?" },
  { id: "objetivo", text: "¿Cuál es tu objetivo principal de entrenamiento?" }, // Primary training goal
  { id: "nivel", text: "¿Cuál es tu nivel de experiencia con el entrenamiento?" }, // Experience level
  { id: "condicion_fisica", text: "¿Cómo describirías tu condición física actual?" }, // Current physical condition
  { id: "lugar_entrenamiento", text: "¿Dónde sueles entrenar?" }, // Training location
  { id: "dias_entrenamiento", text: "¿Cuántos días a la semana puedes entrenar?" }, // Training days per week
  { id: "tiempo_sesion", text: "¿Cuánto tiempo puedes dedicar por sesión?" }, // Time per session
  { id: "cirugia_reciente", text: "¿Has tenido alguna cirugía reciente (último año) que debamos tener en cuenta?" }, // Recent surgery
  { id: "cirugia_descripcion", text: "Descripción de cirugía reciente" }, // Recent surgery description
  { id: "lesion_muscular", text: "¿Tienes alguna lesión muscular que pueda afectar tu movilidad?" }, // Muscle injury
  { id: "lesion_muscular_descripcion", text: "Descripción de lesión muscular" }, // Muscle injury description
  { id: "tendinopatia", text: "¿Tienes alguna tendinopatía que pueda afectar tu movilidad?" }, // Tendinopathy
  { id: "tendinopatia_descripcion", text: "Descripción de tendinopatía" }, // Tendinopathy description
  { id: "limitacion_articular", text: "¿Tienes limitaciones de movilidad en alguna articulación?" }, // Joint limitation
  { id: "limitacion_articular_descripcion", text: "Descripción de limitación articular" }, // Joint limitation description
  { id: "problema_postural", text: "¿Tienes algún problema postural que afecte tu entrenamiento?" }, // Postural problem
  { id: "problema_postural_descripcion", text: "Descripción de problema postural" }, // Postural problem description
  { id: "condicion_medica", text: "¿Sufres de alguna condición médica que afecte tu rendimiento?" }, // Medical condition
  { id: "condicion_medica_descripcion", text: "Descripción de condición médica" }, // Medical condition description
  { id: "medicacion", text: "¿Estás tomando alguna medicación que pueda afectar tu entrenamiento?" }, // Medication
  { id: "medicacion_descripcion", text: "Descripción de medicación" }, // Medication description
  { id: "ejercicios_favoritos", text: "¿Hay algún movimiento que quieras practicar en específico?" }, // Favorite exercises
  { id: "ejercicios_evitar", text: "¿Hay algún tipo de ejercicio que te desagrade o prefieras evitar?" }, // Exercises to avoid
  { id: "tipo_entrenamiento", text: "¿Prefieres entrenamientos enfocados en un grupo muscular por día o entrenamientos de cuerpo completo?" }, // Training split preference
  { id: "material_especifico", text: "¿Quieres usar material específico?" }, // Specific equipment
  { id: "info_adicional", text: "¿Hay algo más que debamos saber para personalizar mejor tu rutina?" } // Additional info
];

/**
 * Specifically finds the session time among the responses.
 * Searches by 'tiempo_sesion' field, specific questions, and time patterns in answers.
 * @param {Array<object>} responses - Client responses (objects with question, answer, field?)
 * @returns {string} - Session time or empty string
 */
function findSessionTime(responses) {
    if (!Array.isArray(responses)) return ''; // Ensure responses is an array
    // Search first by the specific field
    const sessionField = responses.find(r => r && r.field === 'tiempo_sesion');
    if (sessionField?.answer?.trim()) { // Simplified with optional chaining and truthiness
        return sessionField.answer.trim();
    }

    // Search by specific questions about session time
    const sessionQuestion = responses.find(r => r && r.question && (
        (r.question.toLowerCase().includes("tiempo") && r.question.toLowerCase().includes("sesión")) ||
        r.question.toLowerCase().includes("cuánto tiempo puedes dedicar")
    ));
    if (sessionQuestion?.answer?.trim()) {
        return sessionQuestion.answer.trim();
    }

    // Search for answers mentioning minutes or hours related to time/session questions
    const timePattern = responses.find(r => r && r.question && r.answer &&
        (r.question.toLowerCase().includes("tiempo") || r.question.toLowerCase().includes("sesión")) &&
        /\d+\s*(minutos?|min|horas?|hr)/i.test(r.answer)
    );
    if (timePattern?.answer) { // No need to trim here because regex validates content
        return timePattern.answer.trim();
    }

    return '';
}

/**
 * Gets the client's weight, excluding confusion with session time.
 * @param {Array<object>} responses - Client responses
 * @param {string} sessionTime - Previously identified session time
 * @returns {string} - Formatted weight (e.g., "75 kg") or empty string
 */
function getWeightExcludingSession(responses, sessionTime) {
    if (!Array.isArray(responses)) return '';
    const checkConflict = (value) => {
        const trimmedValue = String(value || '').trim();
        const trimmedSessionTime = String(sessionTime || '').trim();
        // Check if the numeric part of the value matches the numeric part of session time
        const valueNumMatch = trimmedValue.match(/^\d+/);
        const sessionTimeNumMatch = trimmedSessionTime.match(/^\d+/);
        if (valueNumMatch && sessionTimeNumMatch && valueNumMatch[0] === sessionTimeNumMatch[0]) {
             // Further check if the units might be confused (e.g., "60" vs "60 min")
             if (trimmedValue === sessionTimeNumMatch[0] || trimmedValue === trimmedSessionTime) {
                console.log(`Conflict detected: Value (${trimmedValue}) might be confused with session time (${trimmedSessionTime}). Ignoring.`);
                return true; // Conflict
             }
        }
        return false; // No conflict
    };

    const formatWeight = (value) => {
        const trimmedValue = String(value || '').trim();
        if (/\d+([.,]\d+)?\s*(kg|kilos|libras|lb)/i.test(trimmedValue)) {
            return trimmedValue.replace(/kilos/i, 'kg').replace(/libras/i, 'lb'); // Normalize unit
        }
        if (/^\d+([.,]\d+)?$/.test(trimmedValue)) { // If only numbers
            return trimmedValue + " kg"; // Assume kg
        }
        return trimmedValue; // Return as is if no match
    };

    // 1. Search by specific field 'peso'
    let potentialWeightObj = responses.find(r => r && r.field === 'peso');
    if (potentialWeightObj?.answer?.trim()) {
        let formatted = formatWeight(potentialWeightObj.answer);
        if (!checkConflict(formatted)) return formatted;
    }


    // 2. Search by exact question "¿cuánto pesas?"
    potentialWeightObj = responses.find(r => r && r.question?.toLowerCase() === "¿cuánto pesas?");
     if (potentialWeightObj?.answer?.trim()) {
        let formatted = formatWeight(potentialWeightObj.answer);
        if (!checkConflict(formatted)) return formatted;
    }

    // 3. Search by question containing "peso" (and not conflicting words)
    potentialWeightObj = responses.find(r => r && r.question &&
        r.question.toLowerCase().includes("peso") &&
        !r.question.toLowerCase().includes("tiempo") &&
        !r.question.toLowerCase().includes("sesión")
    );
    if (potentialWeightObj?.answer?.trim()) {
        let formatted = formatWeight(potentialWeightObj.answer);
        if (!checkConflict(formatted)) return formatted;
    }

    // 4. Search for response with weight pattern (kg/lb) in non-conflicting questions
    const weightPatternResponse = responses.find(r => r && r.answer &&
        /\b\d+([.,]\d+)?\s*(kg|kilos|libras|lb)\b/i.test(r.answer) &&
        r.question &&
        !r.question.toLowerCase().includes("tiempo") &&
        !r.question.toLowerCase().includes("sesión") &&
        !r.question.toLowerCase().includes("altura") // Add exclusion for height
    );
    if (weightPatternResponse?.answer) {
        const weightMatch = weightPatternResponse.answer.match(/\b\d+([.,]\d+)?\s*(kg|kilos|libras|lb)\b/i);
        let extractedWeight = weightMatch ? weightMatch[0].trim() : formatWeight(weightPatternResponse.answer); // Extract or format
        extractedWeight = formatWeight(extractedWeight); // Re-format/normalize
         if (!checkConflict(extractedWeight)) {
               return extractedWeight;
         }
    }

    return ''; // No valid weight found
}

/**
 * Gets the client's height, excluding confusion with session time.
 * @param {Array<object>} responses - Client responses
 * @param {string} sessionTime - Previously identified session time
 * @returns {string} - Formatted height (e.g., "175 cm", "1.75 m") or empty string
 */
function getHeightExcludingSession(responses, sessionTime) {
    if (!Array.isArray(responses)) return '';
     const checkConflict = (value) => {
        const trimmedValue = String(value || '').trim();
        const trimmedSessionTime = String(sessionTime || '').trim();
         // Check if the numeric part of the value matches the numeric part of session time
        const valueNumMatch = trimmedValue.match(/^\d+/);
        const sessionTimeNumMatch = trimmedSessionTime.match(/^\d+/);
        if (valueNumMatch && sessionTimeNumMatch && valueNumMatch[0] === sessionTimeNumMatch[0]) {
             // Further check if the units might be confused (e.g., "90" vs "90 min")
             if (trimmedValue === sessionTimeNumMatch[0] || trimmedValue === trimmedSessionTime) {
                console.log(`Conflict detected: Value (${trimmedValue}) might be confused with session time (${trimmedSessionTime}). Ignoring.`);
                return true; // Conflict
             }
        }
        return false; // No conflict
    };

    const formatHeight = (value) => {
        const trimmedValue = String(value || '').trim();
        if (/\d+([.,]\d+)?\s*(cm|metros|m|pie|pies|ft)/i.test(trimmedValue)) {
             return trimmedValue.replace(/metros/i, 'm').replace(/pies|pie/i, 'ft'); // Normalize unit
        }
        if (/^\d+([.,]\d+)?$/.test(trimmedValue)) { // Only numbers
            const numValue = parseFloat(trimmedValue.replace(',', '.'));
            if (numValue >= 1.4 && numValue <= 2.3) return trimmedValue + " m"; // Assume meters
            if (numValue >= 140 && numValue <= 230) return trimmedValue + " cm"; // Assume cm
            return trimmedValue + " cm"; // Default to cm if it's a number but outside ranges
        }
        return trimmedValue; // Return as is if not number or no format
    };

    // 1. Search by specific field 'altura'
    let potentialHeightObj = responses.find(r => r && r.field === 'altura');
    if (potentialHeightObj?.answer?.trim()) {
        let formatted = formatHeight(potentialHeightObj.answer);
        if (!checkConflict(formatted)) return formatted;
    }

    // 2. Search by exact question "¿cuál es tu altura?"
    potentialHeightObj = responses.find(r => r && r.question?.toLowerCase() === "¿cuál es tu altura?");
    if (potentialHeightObj?.answer?.trim()) {
        let formatted = formatHeight(potentialHeightObj.answer);
        if (!checkConflict(formatted)) return formatted;
    }

    // 3. Search by question containing "altura" (and not conflicting words)
    potentialHeightObj = responses.find(r => r && r.question &&
        r.question.toLowerCase().includes("altura") &&
        !r.question.toLowerCase().includes("tiempo") &&
        !r.question.toLowerCase().includes("sesión") &&
        !r.question.toLowerCase().includes("peso") // Add exclusion for weight
    );
     if (potentialHeightObj?.answer?.trim()) {
        let formatted = formatHeight(potentialHeightObj.answer);
        if (!checkConflict(formatted)) return formatted;
    }

    // 4. Search for response with height pattern (cm/m/ft) in non-conflicting questions
    const heightPatternResponse = responses.find(r => r && r.answer &&
        /\b\d+([.,]\d+)?\s*(cm|metros|m|pie|pies|ft)\b/i.test(r.answer) &&
        r.question &&
        !r.question.toLowerCase().includes("tiempo") &&
        !r.question.toLowerCase().includes("sesión") &&
        !r.question.toLowerCase().includes("peso") // Add exclusion for weight
    );
     if (heightPatternResponse?.answer) {
        const heightMatch = heightPatternResponse.answer.match(/\b\d+([.,]\d+)?\s*(cm|metros|m|pie|pies|ft)\b/i);
        let extractedHeight = heightMatch ? heightMatch[0].trim() : formatHeight(heightPatternResponse.answer); // Extract or format
        extractedHeight = formatHeight(extractedHeight); // Re-format/normalize
        if (!checkConflict(extractedHeight)) {
            return extractedHeight; // Already formatted by regex or formatHeight
        }
    }

    return ''; // No valid height found
}

/**
 * Gets the answer to a specific question using keywords.
 * This is a GENERAL function. For WEIGHT and HEIGHT, use specific functions:
 * getWeightExcludingSession() and getHeightExcludingSession().
 *
 * @param {string} questionKeyword - Keyword or phrase from the question
 * @param {Array<object>} responses - Array of responses (obj: {question, answer, field?})
 * @returns {string} - Found answer or empty string
 */
function getAnswer(questionKeyword, responses) {
    if (!Array.isArray(responses) || !questionKeyword) return '';
    // Normalize the keyword for searching
    const normalizedKeyword = questionKeyword.toLowerCase().trim();
    if (!normalizedKeyword) return '';

    // --- General Search ---
    // 1. Search by keyword match in the QUESTION text
    // Prioritize questions that *end* with the keyword (more specific) or contain it
    const responseByQuestion = responses.find(r => r && r.question &&
        (r.question.toLowerCase().endsWith(normalizedKeyword) || r.question.toLowerCase().includes(normalizedKeyword))
    );
     if (responseByQuestion?.answer?.trim()) {
        // Check if the answer itself seems like a question, indicating a misunderstanding
        if (!/[?¿]/.test(responseByQuestion.answer)) {
             return responseByQuestion.answer.trim();
        }
    }

    // 2. Search by specific field (field) if it matches the keyword
     const responseByField = responses.find(r => r && r.field && r.field.toLowerCase() === normalizedKeyword);
     if (responseByField?.answer?.trim()) {
        if (!/[?¿]/.test(responseByField.answer)) {
             return responseByField.answer.trim();
        }
     }

     // 3. Search by keyword match in the ANSWER text (More risky fallback)
     // Only use this if the question keyword is reasonably unique (e.g., 'objetivo', 'nivel')
     const uniqueKeywords = ['objetivo', 'nivel', 'experiencia', 'condición física', 'dónde', 'días', 'tiempo', 'cirugía', 'lesión', 'tendinopatía', 'limitacion', 'postural', 'médica', 'medicación', 'favoritos', 'evitar', 'tipo', 'material', 'adicional'];
     if (uniqueKeywords.includes(normalizedKeyword)) {
         const responseByAnswer = responses.find(r =>
            r && r.answer && r.answer.toLowerCase().includes(normalizedKeyword) && r.question &&
            // Avoid matching if the question *also* contains the keyword (already handled)
            !r.question.toLowerCase().includes(normalizedKeyword)
         );
         if (responseByAnswer?.answer?.trim()) {
            // Consider adding a log here if using this method, as it can be less precise
            // console.log(`Keyword '${normalizedKeyword}' found in answer: '${responseByAnswer.answer}' (Question: '${responseByAnswer.question}')`);
             if (!/[?¿]/.test(responseByAnswer.answer)) {
                return responseByAnswer.answer.trim();
             }
         }
     }


    return ''; // No answer found by any method
}

/**
 * Generates a personalized training routine
 * Main function that accepts different input formats
 *
 * @param {Array|Object} formData - Form data (array of texts or object of fields)
 * @param {Object} options - Additional options for generation
 * @returns {Promise<string>} - HTML with the generated routine
 */
const generateRoutine = async (formData, options = {}) => {
  if (!formData) {
    console.error("Error: No form data provided");
    throw new Error("No se proporcionaron datos del formulario"); // Spanish error message
  }

  console.log("Generando rutina con datos:",
    Array.isArray(formData) ? `${formData.length} respuestas` : `${Object.keys(formData).length} campos`);

  try {
    // Process according to input format
    let responses = []; // Initialize as empty array

    // 1. If it's an array of strings with format "Question\nAnswer"
    if (Array.isArray(formData) && typeof formData[0] === 'string' && formData[0].includes('\n')) {
      console.log("Procesando formato 'Pregunta\\nRespuesta'");
      responses = formData.map(item => {
        const parts = item.split('\n');
        const question = parts[0] ? parts[0].trim() : "Pregunta desconocida";
        const answer = parts[1] ? parts[1].trim() : "";
        const fieldMapping = FORM_FIELD_QUESTIONS.find(q => q.text === question);
        return { question, answer, field: fieldMapping ? fieldMapping.id : undefined };
      }).filter(r => r.question && typeof r.answer === 'string'); // Filter invalid ones
    }
    // 2. If it's an array of objects with question and answer properties (ideal)
    else if (Array.isArray(formData) && typeof formData[0] === 'object' && formData[0].hasOwnProperty('question') && formData[0].hasOwnProperty('answer')) {
      console.log("Procesando array de objetos pregunta-respuesta");
      responses = formData.map(item => {
        if (item && item.question && typeof item.answer === 'string') { // Validate each item
          if (!item.field) {
               const fieldMapping = FORM_FIELD_QUESTIONS.find(q => q.text === item.question);
               return {...item, field: fieldMapping ? fieldMapping.id : undefined };
          }
          return item;
        }
        return null; // Mark invalid ones for filtering
      }).filter(item => item !== null);
    }
    // 3. If it's an object with key-value pairs (new form format)
    else if (typeof formData === 'object' && !Array.isArray(formData) && Object.keys(formData).length > 0) {
      console.log("Procesando objeto de pares campo-valor");
      responses = processFormFieldsObject(formData); // This function already filters and adds 'field'
    }
    // 4. If it's an array with simple text pairs (lines) - Try mapping
    else if (Array.isArray(formData) && typeof formData[0] === 'string') {
      console.log("Procesando array de líneas de texto (mapeo contextual)");
      const mappedResponses = processTextLines(formData); // This function returns {question, answer}
       responses = mappedResponses.map(item => {
           if (item && item.question && typeof item.answer === 'string') {
                const fieldMapping = FORM_FIELD_QUESTIONS.find(q => q.text === item.question);
                return {...item, field: fieldMapping ? fieldMapping.id : undefined };
           }
           return null;
       }).filter(item => item !== null);
    }
    // Unsupported format or empty data
    else {
      console.error("Formato de datos no soportado o datos vacíos:", formData);
      throw new Error("Formato de datos no soportado o datos vacíos para generar rutina"); // Spanish error message
    }

       // Ensure 'responses' is always a valid array after processing
       if (!Array.isArray(responses)) {
         console.error("Error interno: 'responses' no es un array después del procesamiento inicial.");
         responses = [];
       }

    // Format responses for the prompt, excluding sensitive data and empty answers
    const formattedResponsesForPrompt = responses
      .filter(item =>
           item && // Ensure item exists
           item.answer && String(item.answer).trim() !== '' && // Exclude empty or null answers
           item.field !== 'nombre' && // Exclude name
           item.field !== 'email' && // Exclude email
           item.question && // Ensure question exists
           !item.question.toLowerCase().includes("cómo te llamas") &&
           !item.question.toLowerCase().includes("dirección de correo electrónico")
      )
      .map(item => `Pregunta: ${item.question}\nRespuesta: ${item.answer}`);

    console.log(`Procesando ${formattedResponsesForPrompt.length} respuestas para prompt (filtradas)`);

    // Generate the prompt for OpenAI and get the routine
    // Pass 'responses' (the complete and clean array) for data extraction
    return await createPromptAndGenerate(formattedResponsesForPrompt, responses, options);

  } catch (error) {
    console.error("Error en generateRoutine:", error.message);
    // Throw a more specific error or the same error
    throw new Error(`Error al generar rutina: ${error.message}`); // Spanish error message
  }
};


/**
 * Processes an object with form fields {fieldId: value}
 *
 * @param {Object} formFields - Object with form fields
 * @returns {Array<object>} - Filtered array of { question, answer, field } objects
 */
function processFormFieldsObject(formFields) {
  if (typeof formFields !== 'object' || formFields === null) return []; // Validate input

  const questionMap = {};
  FORM_FIELD_QUESTIONS.forEach(q => {
    questionMap[q.id] = q.text;
  });

  const processedFields = { ...formFields }; // Copy

  // Handle conditional description fields
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

      // Combine if main answer is 'yes' and description is provided
      if ((mainValueStr === 'sí' || mainValueStr === 'si') && descValue && String(descValue).trim()) {
        processedFields[main] = `Sí: ${String(descValue).trim()}`; // Combine
        delete processedFields[desc]; // Remove separate description field
      } else if (mainValueStr === 'no' || mainValueStr === '') { // If 'no' or empty main answer
        delete processedFields[desc]; // Remove description field
         // Optionally keep 'No' answer for the main field or remove it too if preferred
         // if (mainValueStr === '') delete processedFields[main];
      }
      // If 'yes' but no description, keep the 'yes'
    } else if (processedFields.hasOwnProperty(main) && !processedFields.hasOwnProperty(desc)) {
        // If only the main field exists (e.g., "Sí") and no description field was sent, keep it as is.
    }
  });

  // Convert the processed object back to the desired array format
  return Object.entries(processedFields)
    .map(([field, value]) => {
      const questionText = questionMap[field] || field; // Use mapped question or field ID
      const trimmedValue = value !== null && value !== undefined ? String(value).trim() : ''; // Ensure string and trim

      // Only include fields with a non-empty value
      if (trimmedValue !== '') {
        return {
          question: questionText,
          answer: trimmedValue,
          field: field
        };
      }
      return null; // Exclude empty fields
    })
    .filter(item => item !== null); // Remove null entries
}

/**
 * Processes an array of text lines, trying to extract or map to questions.
 *
 * @param {Array<string>} textLines - Array of text lines
 * @returns {Array<object>} - Array of { question, answer } objects
 */
function processTextLines(textLines) {
    if (!Array.isArray(textLines)) return [];

    const cleanedLines = textLines
           .map(line => (typeof line === 'string' ? line.trim() : ''))
           .filter(line => line !== '');

    if (cleanedLines.length === 0) return [];

    // Try detecting "Question: Answer" format
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
        }).filter(r => r.question && r.answer); // Filter if something is missing
    }

    // Try detecting "Question\nAnswer" or alternating Q/A lines
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
                if(parts[0] && parts[1]){ // Ensure there's a question and an answer
                     results.push({ question: parts[0].trim(), answer: parts[1].trim() });
                     currentQuestion = null; // Reset state
                } else if (parts[0]) { // If only a question, save it for the next line
                     currentQuestion = parts[0].trim();
                }
           } else if (index % 2 === 0 && !possibleNewLineFormat) { // Assume Q if it's an even line AND we didn't detect \n before
                currentQuestion = line;
           } else if (currentQuestion) { // Assume R if we had a pending Q
                results.push({ question: currentQuestion, answer: line });
                currentQuestion = null; // Reset
           } else if (index === 0 && !possibleNewLineFormat) { // If it's the first line without a pair (and no \n detected)
                 results.push({ question: "Información inicial", answer: line }); // Or "Additional Information"
           } else if (!possibleNewLineFormat) { // Odd line without a pending question (and no \n detected)
                 results.push({ question: "Información adicional", answer: line });
           }
           // If possibleNewLineFormat is true but this line doesn't have \n, ignore it unless there's a currentQuestion
       });

       // If after the loop there's a pending question (last line was Q)
       if (currentQuestion) {
           results.push({ question: currentQuestion, answer: "" }); // Add it with an empty answer
       }


    if (results.length > 0 && results.length >= cleanedLines.length / 2) {
        console.log("Detectado formato líneas alternas Q/A o Pregunta\\nRespuesta.");
        return results.filter(r => r.question && typeof r.answer === 'string');
    }

    // Fallback: Contextual mapping if the above formats fail
    console.warn("Formato de líneas no estándar o inconsistente. Intentando mapeo contextual.");
    return mapLinesToQuestions(cleanedLines);
}


/**
 * Tries to map text lines to known questions by context and keywords.
 * (Fallback function if processTextLines doesn't detect standard format)
 *
 * @param {Array<string>} lines - Cleaned text lines
 * @returns {Array<object>} - Array of { question, answer } objects
 */
function mapLinesToQuestions(lines) {
    if (!Array.isArray(lines)) return [];

    // Create patterns based on keywords from FORM_FIELD_QUESTIONS
    const questionPatterns = FORM_FIELD_QUESTIONS.map(q => {
        const keywords = q.text
            .toLowerCase()
            .replace(/[¿?¡!,.:;]/g, '') // Remove more punctuation
            .split(/\s+/)
            // Filter out common Spanish stop words and short words
            .filter(word => word.length >= 3 && !['cómo', 'cuál', 'cuánto', 'has', 'hay', 'con', 'para', 'que', 'por', 'tus', 'alguna', 'alguno', 'debes', 'puede', 'afectar', 'describirías', 'principal', 'soportado', 'soportada', 'del', 'con', 'las', 'los', 'una', 'uno', 'eres', 'tiene', 'tipo', 'sobre', 'qué', 'en', 'tu', 'te', 'la', 'el', 'un', 'y', 'o', 'a', 'al', 'es', 'su', 'se', 'lo', 'más', 'mi'].includes(word));
        return {
            question: q.text,
            // Create regex patterns for keywords (word boundary to avoid substrings)
            patterns: keywords.map(kw => new RegExp(`\\b${kw}\\b`, 'i'))
        };
    }).filter(qp => qp.patterns.length > 0); // Remove questions without useful keywords

    // Add specific patterns for potentially ambiguous questions
    questionPatterns.push(
        { question: "¿Cuánto pesas?", patterns: [/\b(kg|kilos|libras|lb)\b/i, /\bpesa?s?\b/i, /peso corporal/i] },
        { question: "¿Cuál es tu altura?", patterns: [/\b(cm|metros|m|ft|pie)\b/i, /\baltura\b/i, /\bmides?\b/i, /\bestatura\b/i] },
        { question: "¿Cuántos días a la semana puedes entrenar?", patterns: [/\bd[ií]as\b/i, /veces por semana/i, /frecuencia/i, /\bsemana\b/i] },
        { question: "¿Cuánto tiempo puedes dedicar por sesión?", patterns: [/\bminutos\b/i, /\bhoras?\b/i, /tiempo por sesi[oó]n/i, /duraci[oó]n/i, /\bsesi[oó]n\b/i] },
        { question: "¿Hay algo más que debamos saber?", patterns: [/adicional/i, /comentario/i, /extra/i, /a[ñn]adir/i, /\bsaber\b/i, /importante/i] }
    );

    const results = [];
    const assignedLines = new Set(); // Keep track of lines already assigned to a question

    // Iterate through each question pattern
    questionPatterns.forEach(({ question, patterns }) => {
        let bestMatch = { score: 0, line: null, index: -1 };

        // Check each line against the current question's patterns
        lines.forEach((line, index) => {
            if (assignedLines.has(index)) return; // Skip already assigned lines

            let currentScore = 0;
            patterns.forEach(pattern => {
                if (pattern.test(line)) {
                    currentScore++;
                }
            });

            // Prioritize higher score, then shorter line (more specific)
            if (currentScore > 0) {
                 if (currentScore > bestMatch.score || (currentScore === bestMatch.score && line.length < (bestMatch.line?.length ?? Infinity))) {
                     bestMatch = { score: currentScore, line, index };
                 }
            }
        });

        // If a best match was found and the line hasn't been assigned yet
        if (bestMatch.line !== null && !assignedLines.has(bestMatch.index)) {
            // Avoid assigning the same line if another question had an equal or higher score for it (less likely with prioritization)
            const existingAssignment = results.find(r => r.answer === bestMatch.line);
            if (!existingAssignment) { // Only assign if not already in results
                 results.push({ question: question, answer: bestMatch.line });
                 assignedLines.add(bestMatch.index);
            }
        }
    });

    // Add unassigned lines to "Información adicional"
    let additionalInfoAnswer = lines
        .filter((line, index) => !assignedLines.has(index))
        .join('\n'); // Join with newlines
     if (additionalInfoAnswer) {
         results.push({ question: "Información adicional", answer: additionalInfoAnswer });
     }


    return results;
}

/**
 * Builds a textual description of the client for the AI prompt.
 *
 * @param {Object} data - Cleaned and processed client data
 * @returns {string} - Client description
 */
function buildClientDescription(data) {
  let descriptionParts = []; // Use an array to build the description

  // GENDER
  if (data.gender) {
    if (/masculino|hombre/i.test(data.gender)) {
      descriptionParts.push("un cliente de género masculino");
    } else if (/femenino|mujer/i.test(data.gender)) {
      descriptionParts.push("una cliente de género femenino");
    } else if (data.gender.toLowerCase() !== 'prefiero no especificar' && data.gender.toLowerCase() !== 'no binario') { // Be specific if not binary
      descriptionParts.push(`un cliente de género ${data.gender.toLowerCase()}`);
    } else if (data.gender.toLowerCase() === 'no binario'){
       descriptionParts.push("un cliente de género no binario");
    } else {
       descriptionParts.push("un cliente"); // Gender not specified or explicitly non-binary
    }
  } else {
    descriptionParts.push("un cliente"); // No gender data
  }

  // AGE
  if (data.age && /^\d+$/.test(String(data.age).trim())) { // Check if it's a number
     descriptionParts.push(`de ${String(data.age).trim()} años`); // Add "años"
  } else if (data.age) { // If not numeric but exists, add it
     descriptionParts.push(`cuya edad es ${String(data.age).trim()}`);
  }

  // WEIGHT AND HEIGHT (if they exist)
  if (data.weight) descriptionParts.push(`que pesa ${data.weight}`);
  if (data.height) descriptionParts.push(`y mide ${data.height}`);

  // BMI and Classification
  if (data.imc) {
    let imcDesc = `con un IMC de ${data.imc}, clasificando como `;
    const imcValue = parseFloat(data.imc);
    if (!isNaN(imcValue)) { // Ensure IMC is a valid number
        if (imcValue < 18.5) imcDesc += `peso inferior al normal`;
        else if (imcValue < 25) imcDesc += `peso normal`;
        else if (imcValue < 30) imcDesc += `sobrepeso`;
        else if (imcValue < 35) imcDesc += `obesidad grado 1`;
        else if (imcValue < 40) imcDesc += `obesidad grado 2`;
        else imcDesc += `obesidad grado 3 (mórbida)`;
        descriptionParts.push(imcDesc);
    }
  }

  // EXPERIENCE LEVEL AND FITNESS LEVEL (avoid redundancy)
  let experienceAdded = false;
  if (data.experienceLevel) {
     descriptionParts.push(`con nivel de experiencia ${data.experienceLevel.toLowerCase()}`);
     experienceAdded = true;
  }
  if (data.fitnessLevel && (!experienceAdded || data.fitnessLevel.toLowerCase() !== data.experienceLevel?.toLowerCase())) {
      // Only add if descriptive (active, sedentary...) and not just repeating the experience level
      if (!/principiante|intermedio|avanzado/i.test(data.fitnessLevel)) {
           descriptionParts.push(`y condición física ${data.fitnessLevel.toLowerCase()}`);
      }
  }

  // GOAL
  if (data.trainingGoal) descriptionParts.push(`su objetivo principal es ${data.trainingGoal.toLowerCase()}`);

  // TRAINING LOGISTICS
  if (data.trainingLocation) descriptionParts.push(`entrena habitualmente ${data.trainingLocation.toLowerCase().startsWith('en ') ? '' : 'en '}${data.trainingLocation.toLowerCase()}`); // Add "en " if missing
  if (data.daysPerWeek) {
     let daysText = String(data.daysPerWeek).toLowerCase();
     const dayMap = { '1': 'un día', '2': 'dos días', '3': 'tres días', '4': 'cuatro días', '5': 'cinco días', '6': 'seis días', '7': 'siete días' };
     daysText = dayMap[daysText.match(/\d+/)?.[0]] || daysText; // Convert number to text if possible
     descriptionParts.push(`dispone de ${daysText} a la semana`);
  }
  if (data.sessionTime) {
     let timeText = String(data.sessionTime).toLowerCase();
      if (/^\d+$/.test(timeText)) timeText += " min"; // Add unit if missing
      else timeText = timeText.replace('minutos', 'min').replace('horas', 'hr').replace('hora', 'hr'); // Normalize units
     descriptionParts.push(`para sesiones de ${timeText}`);
  }

  // MEDICAL CONTEXT AND LIMITATIONS (group and avoid duplicates)
  const healthContext = new Set();
  const addHealthInfo = (label, value) => {
     const trimmedValue = String(value || '').trim();
     // Exclude simple negations like "no", "nada", "ninguna"
     if (trimmedValue && !/^(no|nada|ningun[oa])$/i.test(trimmedValue)) {
         const cleanValue = trimmedValue.replace(/^Sí:\s*/i, '').trim(); // Remove "Sí: " prefix
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

  // PREFERENCES AND AVOIDANCES
  const preferences = new Set();
   const addPreference = (label, value) => {
      const trimmedValue = String(value || '').trim();
      // Exclude simple negations
      if (trimmedValue && !/^(no|nada|ningun[oa])$/i.test(trimmedValue)) {
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

  // ADDITIONAL INFORMATION
   const additionalInfoTrimmed = String(data.additionalInfo || '').trim();
   // Exclude simple negations
  if (additionalInfoTrimmed && !/^(no|nada|ningun[oa])$/i.test(additionalInfoTrimmed)) {
     descriptionParts.push(`Información adicional: "${additionalInfoTrimmed}"`);
  }

  // Join all parts with ". " to form the final description
  return descriptionParts.join(". ").replace(/\.\s*\./g, '.').replace(/\s+\./g, '.').trim() + '.'; // Ensure final period and clean up spacing
}


/**
 * Creates the prompt for OpenAI and generates the routine
 *
 * @param {Array<string>} formattedResponsesForPrompt - Array of formatted responses (Question: ... Answer: ...) for the prompt
 * @param {Array<object>} allResponses - Array of {question, answer, field?} objects with all processed responses
 * @param {Object} options - Additional options for generation
 * @returns {Promise<string>} - HTML of the generated routine
 */
const createPromptAndGenerate = async (formattedResponsesForPrompt, allResponses = [], options = {}) => {
  // Extract relevant client information using improved functions
  const sessionTime = findSessionTime(allResponses);
  console.log("Tiempo de sesión identificado:", sessionTime || "No encontrado");

  // Use specific functions that exclude confusion with session time
  const clientDataRaw = {
    gender: getAnswer("género", allResponses),
    age: getAnswer("edad", allResponses),
    weight: getWeightExcludingSession(allResponses, sessionTime),
    height: getHeightExcludingSession(allResponses, sessionTime),
    trainingGoal: getAnswer("objetivo", allResponses) || getAnswer("objetivo principal", allResponses), // Added alternative keyword
    experienceLevel: getAnswer("nivel", allResponses) || getAnswer("experiencia", allResponses),
    fitnessLevel: getAnswer("condición física", allResponses),
    trainingLocation: getAnswer("dónde sueles entrenar", allResponses) || getAnswer("lugar", allResponses) || getAnswer("lugar entrenamiento", allResponses), // Added alternative keyword
    daysPerWeek: getAnswer("días", allResponses) || getAnswer("cuántos días", allResponses) || getAnswer("días entrenamiento", allResponses), // Added alternative keyword
    sessionTime: sessionTime || getAnswer("tiempo sesión", allResponses), // Added alternative keyword as fallback
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

  // Calculate BMI
  let imc = null;
  if (clientDataRaw.weight && clientDataRaw.height) {
    const weightMatch = String(clientDataRaw.weight).match(/(\d+([.,]\d+)?)/);
    const heightMatch = String(clientDataRaw.height).match(/(\d+([.,]\d+)?)/);
    const weightValue = weightMatch ? parseFloat(weightMatch[1].replace(',', '.')) : NaN;
    let heightInMeters = NaN;
    const heightValue = heightMatch ? parseFloat(heightMatch[1].replace(',', '.')) : NaN;

    if (!isNaN(heightValue)) {
         // Check if height is already in meters (e.g., 1.75 m) or needs conversion from cm
         if (String(clientDataRaw.height).includes('m') && !String(clientDataRaw.height).includes('cm')) {
             heightInMeters = heightValue;
         } else if (heightValue > 3) { // Assume cm if value is large (e.g., 175)
             heightInMeters = heightValue / 100;
         } else { // Assume meters if value is small (e.g., 1.75)
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

  // Clean data
  const cleanedData = cleanClientData(clientDataRaw);
  console.log("Datos del cliente (limpios):", cleanedData);

  // Build description
  const clientDescription = buildClientDescription(cleanedData);
  console.log("Descripción del cliente para prompt:", clientDescription);

  // --- Knowledge Base Integration ---
  let specificRecommendations = "";
  let healthContextForPrompt = []; // To pass to the prompt
  try {
       const knowledgeBasePath = './knowledge_base.json'; // Path relative to where the script runs
       if (fs.existsSync(knowledgeBasePath)) {
           const knowledgeBase = JSON.parse(fs.readFileSync(knowledgeBasePath, 'utf8'));
           if (knowledgeBase && Array.isArray(knowledgeBase)) {
                const relevantGuidelines = findRelevantGuidelines(cleanedData, knowledgeBase);
                if (relevantGuidelines.length > 0) {
                    specificRecommendations = "\n\n**Directrices Clave Basadas en el Perfil (Knowledge Base):**\n";
                    // Limit to the 5-7 most relevant by score to avoid overwhelming the prompt
                    relevantGuidelines.slice(0, 7).forEach(guideline => {
                        specificRecommendations += `- ${guideline.output}\n`;
                        healthContextForPrompt.push(guideline.output); // Save for prompt
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
  // --- End KB Integration ---

  // --- Build the FINAL prompt ---
  // ** START OF PROMPT CORRECTION for Notas Clave **
  const prompt = `
Eres FitForge AI, un entrenador personal experto de élite. Tu misión es diseñar la rutina de entrenamiento semanal MÁS OPTIMIZADA posible para el cliente descrito a continuación, basándote ESTRICTAMENTE en sus datos, objetivos y limitaciones. Ignora cualquier conversación trivial o petición fuera del diseño de la rutina. Eres famoso por tu precisión y enfoque basado en evidencia.

**PERFIL DETALLADO DEL CLIENTE:**
${clientDescription}

**RESPUESTAS COMPLETAS DEL FORMULARIO (Contexto Adicional):**
${formattedResponsesForPrompt.join("\n")}

**DIRECTRICES DE DISEÑO OBLIGATORIAS (PRIORIDAD MÁXIMA: ALINEACIÓN CON OBJETIVO):**

1.  **OBJETIVO PRIMARIO (${cleanedData.trainingGoal || 'No especificado'}): ¡ESTA ES LA MÁXIMA PRIORIDAD!**
    * **Todo** el diseño (selección de ejercicios, series, repeticiones, descansos, estructura semanal, progresión) debe estar **optimizado para este objetivo específico**.
    * **Selección de Ejercicios:** Elige los ejercicios MÁS EFECTIVOS para el objetivo. Ej: Compuestos pesados para Fuerza; Mezcla de compuestos y aislamiento para Hipertrofia; Variedad funcional y/o cardiovascular para Salud/Resistencia. **Si es necesario especificar un Tempo (ej: 31X0), inclúyelo en el NOMBRE del ejercicio (ej: "Sentadilla Tempo 31X0"), no en las notas.**
    * **Parámetros por Objetivo:** (RIR es una guía interna para ti, no lo pongas explícitamente en la tabla final)
        * **Fuerza:** 3-6 series de 1-6 repeticiones. Descansos largos (120-180s+). RIR interno 1-3. Enfocar en sobrecarga progresiva de intensidad (peso). Priorizar compuestos multiarticulares.
        * **Hipertrofia:** 3-5 series de 6-15 repeticiones (mayoría en 8-12). Descansos moderados (60-120s). RIR interno 1-3 (ocasionalmente 0). Enfocar en volumen, tensión mecánica, estrés metabólico. Usar compuestos y aislamiento.
        * **Salud / Resistencia / Acondicionamiento General:** 2-4 series de 12-20+ repeticiones. Descansos cortos-moderados (30-75s). RIR interno 2-4. Enfocar en capacidad de trabajo, resistencia. Puede incluir circuitos, superseries, peso corporal, funcionales, cardio.
    * **Si el objetivo no está claro o es ambiguo, diseña para 'Salud / Acondicionamiento General'.**

2.  **Periodización y Nivel (${cleanedData.experienceLevel || 'No especificado'}):**
    * El nivel de experiencia determina **CÓMO** se persigue el objetivo (volumen inicial, intensidad relativa (RIR interno), complejidad, progresión), pero **NO cambia el objetivo en sí**.
    * **Principiante (RIR interno 3-4):** Foco en técnica, adaptación, bajo volumen, progresión simple. Full body ideal.
    * **Intermedio (RIR interno 2-3):** Sobrecarga progresiva sistemática, más variedad, posibles splits.
    * **Avanzado (RIR interno 0-2):** Maximizar estímulo, técnicas de intensidad, mayor volumen, periodización avanzada. Splits específicos.

3.  **Especificidad y Limitaciones:**
    * Incluye ejercicios preferidos (${cleanedData.exercisePreference || 'Ninguno en particular'}) **SI SON APROPIADOS PARA EL OBJETIVO**.
    * EXCLUYE OBLIGATORIAMENTE los evitados (${cleanedData.exerciseAvoidance || 'Ninguno'}).
    * Adapta **OBLIGATORIAMENTE** a limitaciones (${healthContextForPrompt.join('; ') || 'Ninguna indicada'}). Elige variantes seguras, modifica rangos, evita zonas problemáticas. Seguridad primordial.

4.  **Logística:**
    * Diseña para ${cleanedData.daysPerWeek || 'días no especificados'} días/semana, sesiones de ~${cleanedData.sessionTime || 'duración no especificada'}.
    * Ajusta **volumen total** (Nº ejercicios principales ≈ 4-5 para 30min; 6-8 para 60min; 8-10 para 90min; 10-12 para 120min). Activación no cuenta.
    * Usa material disponible (${cleanedData.specificMaterial || 'Asumir gimnasio estándar'}). Adapta si es casa/aire libre.

5.  **Estructura Preferida:**
    * Respeta preferencia (${cleanedData.trainingPreference || 'No especificada, elige la más adecuada'}) **SI ES EFECTIVA** para objetivo/nivel.
    * Si no, elige la más adecuada (Principiante: Full Body; Intermedio/Avanzado: Split según días/objetivo).

6.  **IMC y Consideraciones:** ${cleanedData.imc ? `Considera IMC ${cleanedData.imc}. >30: bajo impacto inicial. <18.5: asegura estímulo suficiente.` : 'IMC no disponible.'}

**RECUERDA: La adecuación al OBJETIVO PRIMARIO (${cleanedData.trainingGoal || 'No especificado'}) es el criterio MÁS IMPORTANTE.**

**FORMATO DE SALIDA (HTML ESTRICTO - SIN MARKDOWN):**
Genera ÚNICAMENTE código HTML. Para CADA DÍA de entrenamiento, usa esta estructura de tabla EXACTA:

<table>
    <tr>
        <th colspan="5">Día X: [Enfoque del Día, e.g., Empuje, Tracción, Pierna, Full Body - Alineado con Objetivo]</th>
    </tr>
    <tr class="activacion-header">
        <td colspan="5"><b>Calentamiento y Activación Específica</b> (5-10 min)</td>
    </tr>
    <tr>
        <th>Ejercicio</th>
        <th>Series</th>
        <th>Reps</th>
        <th>Descanso</th>
        <th>Notas Clave</th>
    </tr>
    <tr><td>[Ejercicio Calentamiento/Activación 1]</td><td>1-2</td><td>10-15</td><td>30s</td><td>[Movilidad articular, activación muscular]</td></tr>
    <tr><td>[Ejercicio Calentamiento/Activación 2]</td><td>1-2</td><td>10-15</td><td>30s</td><td>[Preparar patrones de movimiento]</td></tr>
    <tr class="rutina-header">
        <td colspan="5"><b>Rutina Principal</b></td>
    </tr>
    <tr>
        <th>Ejercicio</th>
        <th>Series</th>
        <th>Reps</th>
        <th>Descanso</th>
        <th>Notas Clave</th> </tr>
    <tr><td>[Ejercicio Principal 1 - Clave para Objetivo]</td><td>[Nº según Objetivo/Nivel]</td><td>[Rango según Objetivo]</td><td>[Tiempo según Objetivo]s</td><td>[Nota breve sobre técnica o error común a evitar (máx 15-20 palabras)]</td></tr> <tr><td>[Ejercicio Principal 2 - Clave para Objetivo]</td><td>[Nº]</td><td>[Rango]</td><td>[Tiempo]s</td><td>[Nota breve sobre técnica o error común a evitar (máx 15-20 palabras)]</td></tr> </table>

<div class="side-variants-container">
    <div class="side-variants-title">Alternativas y Progresiones (Día X)</div>
    <div class="side-variant-item">
        <div class="side-variant-title">[Ejercicio Original 1] → [Variante 1]</div>
        <div class="side-variant-description">[Motivo: e.g., Si sientes molestia en X..., Para mayor dificultad (progresión), Para menor dificultad (regresión), Si no tienes Y material...]</div>
    </div>
     <div class="side-variant-item">
        <div class="side-variant-title">[Ejercicio Original 2] → [Variante 2]</div>
        <div class="side-variant-description">[Motivo]</div>
    </div>
    </div>

**REGLAS ADICIONALES CRÍTICAS:**
* **Precisión:** Nombres técnicos correctos. Parámetros exactos (Series, Rango Reps, Descanso en segundos).
* **Volumen:** Cumple el número MÍNIMO de ejercicios PRINCIPALES según duración y objetivo.
* **Notas Clave:** **¡MUY IMPORTANTE!** Deben ser breves (máx 15-20 palabras), enfocadas ÚNICAMENTE en la **prevención de errores comunes** o el **punto técnico más crucial**. **NO incluir RIR ni Tempo aquí.**
* **Variantes:** Una variante ÚTIL (progresión/regresión/equipo/adaptación) por cada ejercicio principal. Lenguaje directo.
* **SIN EXTRAS:** Solo HTML. Sin saludos, explicaciones fuera de notas, intros, conclusiones, resúmenes. NO uses markdown (\`\`\`).

${specificRecommendations}

Diseña la rutina SEMANAL completa AHORA, asegurando la MÁXIMA alineación con el objetivo principal: ${cleanedData.trainingGoal || 'Salud / Acondicionamiento General'}.`;
  // ** END OF PROMPT CORRECTION for Notas Clave **

  try {
      console.log("Enviando solicitud a OpenAI con prompt final...");

      // Call OpenAI API (Timeout logic removed previously)
      const completion = await openai.chat.completions.create({
          model: process.env.OPENAI_MODEL || "gpt-4o-mini",
          messages: [
              { role: "system", content: "Eres FitForge AI, un creador experto de rutinas de entrenamiento personalizadas en formato HTML, siguiendo instrucciones muy estrictas con enfoque en el objetivo principal." },
              { role: "user", content: prompt }
          ],
          temperature: 0.4,
          max_tokens: 4096,
      });

      const responseMessage = completion.choices[0]?.message?.content;

      if (!responseMessage) {
          throw new Error("Respuesta vacía de OpenAI");
      }

      // Clean possible residual markdown
      const cleanedHtmlResponse = responseMessage.replace(/```html|```/g, '').trim();

      console.log("Rutina generada exitosamente.");
      return cleanedHtmlResponse;

  } catch (error) {
      // Error handling (Timeout logic removed previously)
      if (error.name === 'AbortError' || (error instanceof OpenAI.APIError && error.status === 408)) {
          console.error("Error: La solicitud a OpenAI excedió el tiempo límite (posiblemente del servidor).");
          throw new Error("La generación de la rutina tardó demasiado. Intenta de nuevo más tarde o revisa la complejidad de los datos.");
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
 * Cleans and verifies the consistency of client data.
 * Adjusts formats and removes clearly incorrect or contradictory data.
 *
 * @param {Object} clientDataRaw - Initially extracted client data.
 * @returns {Object} - Cleaned and more consistent data.
 */
function cleanClientData(clientDataRaw) {
    // Create a deep copy to avoid modifying the original object indirectly
    const cleanedData = JSON.parse(JSON.stringify(clientDataRaw));

    // Helper function to clean common negative responses and trim()
    const cleanInput = (value) => {
        const strValue = String(value || '').trim();
        // Check for common Spanish negations or empty string
        if (strValue === '' || /^(no|nada|ningun[oa]|ninguno|ninguna)$/i.test(strValue)) {
            return ""; // Return empty if it's empty or a simple negation
        }
        // Remove prefixes like "Sí: " if they exist
        return strValue.replace(/^Sí:\s*/i, '').trim();
    };

    // Apply cleaning to relevant fields
    for (const key in cleanedData) {
        if (typeof cleanedData[key] === 'string') {
             // Apply general cleaning to most strings, except perhaps weight/height/age/days/time which have specific formats
             if (!['weight', 'height', 'age', 'daysPerWeek', 'sessionTime', 'imc'].includes(key)) {
                 cleanedData[key] = cleanInput(cleanedData[key]);
             } else {
                 // Just trim for fields with specific formats
                  cleanedData[key] = String(cleanedData[key] || '').trim();
             }
        }
    }


    // --- Specific Verifications and Formatting ---

    // AGE
    if (cleanedData.age) {
        const ageMatch = cleanedData.age.match(/^(\d+)/); // Extract leading numbers
        if (ageMatch) {
            cleanedData.age = ageMatch[1]; // Keep only the number
        } else {
            console.log(`Limpiando edad no numérica: ${cleanedData.age}`);
            cleanedData.age = ""; // Clear if not starting with a number
        }
    }


    // GENDER
    if (cleanedData.gender) {
        const genderLower = cleanedData.gender.toLowerCase();
        if (/masculino|hombre/i.test(genderLower)) cleanedData.gender = "Masculino";
        else if (/femenino|mujer/i.test(genderLower)) cleanedData.gender = "Femenino";
        else if (/no binario/i.test(genderLower)) cleanedData.gender = "No Binario";
        else if (/prefiero no/i.test(genderLower)) cleanedData.gender = ""; // Clear if "prefer not to say"
        // Keep other specific genders as they are, or clear if invalid
        // else if (!/^\w+$/.test(cleanedData.gender)) cleanedData.gender = ""; // Example: Clear if contains weird characters
    }


    // WEIGHT
    if (cleanedData.weight) {
        const weightMatch = cleanedData.weight.match(/(\d+([.,]\d+)?)\s*(kg|kilos|lb|libras)?/i);
        if (weightMatch) {
            const value = weightMatch[1].replace(',', '.');
            const unit = (weightMatch[3] || 'kg').toLowerCase(); // Default to kg
            cleanedData.weight = `${value} ${unit.startsWith('k') ? 'kg' : 'lb'}`; // Format: "75 kg" or "165 lb"
        } else {
             console.log(`Limpiando peso no válido: ${cleanedData.weight}`);
            cleanedData.weight = "";
        }
    }

    // HEIGHT
    if (cleanedData.height) {
         const heightMatch = cleanedData.height.match(/(\d+([.,]\d+)?)\s*(cm|m|metros|ft|pie|pies)?/i);
         if (heightMatch) {
             const value = parseFloat(heightMatch[1].replace(',', '.'));
             let unit = (heightMatch[3] || '').toLowerCase();
             if (!unit) { // If no unit, infer
                 if (value >= 1.4 && value <= 2.3) unit = 'm';
                 else if (value >= 140 && value <= 230) unit = 'cm';
                 else unit = 'cm'; // Default to cm
             }
             if (unit.startsWith('m')) cleanedData.height = `${value} m`;
             else if (unit === 'cm') cleanedData.height = `${value} cm`;
             else if (unit.startsWith('f') || unit.startsWith('p')) cleanedData.height = `${value} ft`; // Normalize to ft
             else cleanedData.height = `${value} cm`; // Fallback
         } else {
              console.log(`Limpiando altura no válida: ${cleanedData.height}`);
              cleanedData.height = "";
         }
    }

    // GOAL - Normalize common goals
    if (cleanedData.trainingGoal) {
        const goalLower = cleanedData.trainingGoal.toLowerCase();
        if (/fuerza/i.test(goalLower)) cleanedData.trainingGoal = "Fuerza";
        else if (/hipertrofia|masa|volumen|musculaci[oó]n|m[úu]sculo/i.test(goalLower)) cleanedData.trainingGoal = "Hipertrofia";
        else if (/salud|general|acondicionamiento|bienestar|forma/i.test(goalLower)) cleanedData.trainingGoal = "Salud";
        else if (/resistencia|cardio|aguantar/i.test(goalLower)) cleanedData.trainingGoal = "Resistencia";
        else if (/perder peso|adelgazar|quemar grasa/i.test(goalLower)) cleanedData.trainingGoal = "Pérdida de Peso"; // Add specific category if needed
        // If goal seems related to injury/pain, clear it as it should be in limitations
        else if (/dolor|lesi[oó]n|operado|limitaci[óo]n|molestia|recupera/i.test(goalLower)) {
             console.log(`Limpiando objetivo sospechoso (posible limitación): ${cleanedData.trainingGoal}`);
             cleanedData.trainingGoal = ""; // Clear it, should be handled by limitations
        }
        // Keep other specific goals if they seem valid
    }

    // EXPERIENCE LEVEL - Normalize
     if (cleanedData.experienceLevel) {
        const levelLower = cleanedData.experienceLevel.toLowerCase();
        if (/principiante|nuevo|cero|poco/i.test(levelLower)) cleanedData.experienceLevel = "Principiante";
        else if (/intermedio|medio/i.test(levelLower)) cleanedData.experienceLevel = "Intermedio";
        else if (/avanzado|experto|mucho/i.test(levelLower)) cleanedData.experienceLevel = "Avanzado";
        // else cleanedData.experienceLevel = ""; // Clear if not recognized
     }

    // Conflict PREFERENCE == AVOIDANCE
    if (cleanedData.exercisePreference && cleanedData.exerciseAvoidance &&
        cleanedData.exercisePreference.toLowerCase() === cleanedData.exerciseAvoidance.toLowerCase()) {
        console.log(`Conflicto: Preferencia == Evitación ('${cleanedData.exercisePreference}'). Eliminando evitación.`);
        cleanedData.exerciseAvoidance = "";
    }

    // DAYS PER WEEK
     if (cleanedData.daysPerWeek) {
         const daysMatch = cleanedData.daysPerWeek.match(/(\d+)|(un[oa]?|dos|tres|cuatro|cinco|seis|siete)/i);
        if (daysMatch) {
            const dayMap = { uno: '1', una: '1', dos: '2', tres: '3', cuatro: '4', cinco: '5', seis: '6', siete: '7' };
            const numStr = daysMatch[1] || dayMap[daysMatch[2]?.toLowerCase()];
            const num = parseInt(numStr, 10);
            if (!isNaN(num) && num >= 1 && num <= 7) {
                cleanedData.daysPerWeek = String(num); // Keep only the valid number (1-7)
            } else {
                 console.log(`Limpiando días por semana fuera de rango: ${cleanedData.daysPerWeek}`);
                 cleanedData.daysPerWeek = '';
            }
        } else {
             console.log(`Limpiando días por semana no válidos: ${cleanedData.daysPerWeek}`);
             cleanedData.daysPerWeek = '';
        }
     }

    // TIME PER SESSION
    if (cleanedData.sessionTime) {
        const timeMatch = cleanedData.sessionTime.match(/(\d+)\s*(min|minutos|hr|hora|horas)?/i);
        if (timeMatch) {
            let value = parseInt(timeMatch[1], 10);
            const unit = (timeMatch[2] || 'min').toLowerCase();
            if (unit.startsWith('h')) {
                value *= 60; // Convert hours to minutes
            }
            // Standardize to minutes, e.g., "60 min", "90 min"
            if (!isNaN(value) && value > 0) {
                 cleanedData.sessionTime = `${value} min`;
            } else {
                 console.log(`Limpiando tiempo por sesión no válido: ${cleanedData.sessionTime}`);
                 cleanedData.sessionTime = '';
            }
        } else {
             console.log(`Limpiando tiempo por sesión no válido: ${cleanedData.sessionTime}`);
             cleanedData.sessionTime = '';
        }
    }

     // Redundancy EXPERIENCE LEVEL / FITNESS LEVEL
    if (cleanedData.experienceLevel && cleanedData.fitnessLevel) {
        const expLower = cleanedData.experienceLevel.toLowerCase();
        const fitLower = cleanedData.fitnessLevel.toLowerCase();
         // If fitness level is just repeating experience level, clear fitness level
        if (expLower === fitLower || (expLower === 'principiante' && /sedentar|liger/i.test(fitLower)) || (expLower === 'intermedio' && /moderad/i.test(fitLower)) || (expLower === 'avanzado' && /activ/i.test(fitLower)) ) {
            console.log(`Nivel y condición física redundantes o implícitos. Usando experiencia: '${cleanedData.experienceLevel}'. Limpiando condición física: '${cleanedData.fitnessLevel}'`);
           cleanedData.fitnessLevel = "";
        }
    }

    // Ensure IMC is null if not a valid number
    if (cleanedData.imc && isNaN(parseFloat(cleanedData.imc))) {
        cleanedData.imc = null;
    }


    return cleanedData;
}

/**
 * Parses the input string from the knowledge base to identify components.
 * @param {string} inputStr - The input string from knowledge_base.json
 * @returns {object} - Parsed components { condition, capacity, phase, objective, loadContext, raw }
 */
function parseInputString(inputStr) {
  // Initialize parts with null values
  const parts = { condition: null, capacity: null, phase: null, objective: null, loadContext: null, raw: inputStr };
  if (!inputStr || typeof inputStr !== 'string') return parts;

  const inputLower = inputStr.toLowerCase().trim();
  let remainingInput = inputLower;

  // --- Improved Parsing Logic ---

  // 1. Check for explicit prefixes like "Condición:", "Objetivo:", "Fase:", "Capacidad:"
  const prefixRegex = /^(condici[oó]n|objetivo|fase|capacidad|carga):\s*([^,(]+)/i;
  let match;
  while ((match = remainingInput.match(prefixRegex)) !== null) {
    const type = match[1].toLowerCase();
    const value = match[2].trim();
    remainingInput = remainingInput.substring(match[0].length).replace(/^[,(]\s*/, '').trim(); // Remove prefix, comma, parenthesis

    if (type.startsWith('condici')) parts.condition = value;
    else if (type === 'objetivo') parts.objective = value;
    else if (type === 'fase') parts.phase = value;
    else if (type === 'capacidad') parts.capacity = value;
    else if (type === 'carga') parts.loadContext = value;
  }

  // 2. If no prefixes found, try to infer based on keywords (more robustly)
  if (!parts.condition && !parts.objective && !parts.phase && !parts.capacity) {
      // Prioritize conditions based on medical/anatomical terms
      if (/\b(hipertensi[oó]n|diabetes|asma|epoc|cardio|renal|artrosis|artritis|lesi[oó]n|dolor|cirug[ií]a|pr[oó]tesis|escoliosis|lumbalgia|cervicalgia|tendinopat[ií]a|embarazo|posparto|menopausia|mayor|obesidad|sobrepeso|amputaci[oó]n|fibrosis|incontinencia|osteoporosis)\b/i.test(inputLower)) {
          parts.condition = inputLower; // Assume the whole string is the condition
      }
      // Then check for objectives/capacities
      else if (/\b(fuerza|hipertrofia|resistencia|potencia|velocidad|musculaci[oó]n|adelgazar|perder peso|rendimiento)\b/i.test(inputLower)) {
          parts.objective = inputLower;
      }
      // Then check for phases
      else if (/\b(adaptaci[oó]n|t[eé]cnica|preparaci[oó]n|acondicionamiento)\b/i.test(inputLower)) {
          parts.phase = inputLower;
      }
      // Default to condition if nothing else matches strongly
      else {
          parts.condition = inputLower;
      }
  }

  // 3. Refine Objective/Capacity/Phase based on keywords if primary type is set
  if (parts.objective) {
      if (/fuerza|potencia|velocidad|hipertrofia|musculaci[oó]n|volumen/i.test(parts.objective)) parts.capacity = parts.capacity || 'fuerza/potencia';
      if (/resistencia|cardio|aguantar|perder peso|adelgazar|quemar grasa/i.test(parts.objective)) parts.capacity = parts.capacity || 'resistencia';
      if (/t[eé]cnica|aprender/i.test(parts.objective)) parts.phase = parts.phase || 'técnica de ejecución';
      if (/adaptaci[oó]n|acondicionamiento|preparaci[oó]n/i.test(parts.objective)) parts.phase = parts.phase || 'adaptación anatómica';
  }
   if (parts.phase) {
       if (/t[eé]cnica/i.test(parts.phase)) parts.phase = 'entrenamiento de la técnica de ejecución';
       if (/adaptaci[oó]n/i.test(parts.phase)) parts.phase = 'adaptación anatómica';
   }

  // 4. Clean up capacity value (remove details in parentheses)
  if (parts.capacity) {
    parts.capacity = parts.capacity.split('(')[0].trim().toLowerCase();
    if (parts.capacity.startsWith('resistencia')) parts.capacity = 'resistencia';
    else if (/potencia|velocidad|fuerza/i.test(parts.capacity)) parts.capacity = 'fuerza/potencia';
    // Keep other specific capacities like 'fuerza máxima' if present
  }

  // 5. Extract load context if not explicitly prefixed
  if (!parts.loadContext && remainingInput.length > 0) {
      parts.loadContext = remainingInput;
  } else if (!parts.loadContext && parts.condition && parts.condition.includes('(')) {
      // Extract content in parenthesis from condition as possible load context
      const loadMatch = parts.condition.match(/\(([^)]+)\)/);
      if (loadMatch) parts.loadContext = loadMatch[1].trim();
  }


  // console.log("Parsed KB Input:", parts); // For debugging
  return parts;
}


/**
 * Finds relevant guidelines from the knowledge base based on client data.
 * @param {Object} clientData - Cleaned client data.
 * @param {Array<object>} knowledgeBase - Array of knowledge base entries {input, output}.
 * @returns {Array<object>} - Sorted array of relevant guidelines {input, output, score}.
 */
function findRelevantGuidelines(clientData, knowledgeBase) {
  const relevantGuidelines = [];
  const addedInputs = new Set(); // Avoid duplicate entries based on input string

   // 1. Normalize client data (ensure they are strings or null/number)
   const safeLowerCase = (val) => String(val || '').toLowerCase().trim();
   const clientConditionsInput = [ // Gather all potential conditions/limitations
     clientData.medicalCondition, clientData.surgery, clientData.muscleInjury,
     clientData.tendinopathy, clientData.mobilityLimitation, clientData.posturalProblem
   ].map(safeLowerCase).filter(c => c && !/^(no|nada|ningun[ao])$/i.test(c)); // Filter out simple negations

   const clientGoal = safeLowerCase(clientData.trainingGoal);
   const clientExperience = safeLowerCase(clientData.experienceLevel);
   const clientAge = parseInt(clientData.age, 10) || null;
   const clientGender = safeLowerCase(clientData.gender);
   const clientImc = parseFloat(clientData.imc) || null;

   let clientConditionsMapped = [...clientConditionsInput]; // Start with user's own words


  // 2. Expanded Mappings (Keep these extensive)
  const conditionMappings = {
    // Cardiovascular
    "arritmia": "arritmias", "corazón": ["cardiopatía isquémica", "insuficiencia cardíaca", "arritmias", "miocardiopatías", "valvulopatías"], "infarto": "cardiopatía isquémica", "angina": "cardiopatía isquémica", "tensión alta": "hipertensión arterial", "tension alta": "hipertensión arterial", "hipertensión": "hipertensión arterial", "circulación": ["insuficiencia venosa", "enfermedad arterial periférica"], "varices": "insuficiencia venosa", "eap": "enfermedad arterial periférica", "claudicación": "enfermedad arterial periférica", "marcapasos": "portadores de marcapasos", "válvula corazón": "valvulopatías",
    // Musculoskeletal
    "amputación": "amputaciones", "artritis juvenil": "artritis idiopática juvenil", "artritis": "artrosis y artritis", "artrosis": "artrosis y artritis", "desgaste articular": "artrosis y artritis", "dolor cuello": "cervicalgia", "cervicalgia": "cervicalgia", "escoliosis": "escoliosis", "desviación columna": "escoliosis", "dolor hombro": "hombro doloroso", "manguito rotador": "hombro doloroso", "lesión rodilla": "lesiones ligamentos rodilla", "ligamento rodilla": "lesiones ligamentos rodilla", "lesión tobillo": "lesiones ligamentos tobillo", "esguince tobillo": "lesiones ligamentos tobillo", "tendinitis": "tendinopatía", "tendinosis": "tendinopatía", "dolor tendón": "tendinopatía", "lumbalgia": "lumbalgia", "lumbago": "lumbalgia", "dolor espalda baja": "lumbalgia", "osteoporosis": "osteoporosis", "huesos débiles": "osteoporosis", "prótesis rodilla": "prótesis de rodilla y de tobillo", "prótesis tobillo": "prótesis de rodilla y de tobillo", "prótesis cadera": "prótesis de cadera",
    // Digestive
    "alergia comida": "alergia alimentaria", "alergia alimentos": "alergia alimentaria", "estreñimiento": "estreñimiento crónico", "diabetes": "diabetes mellitus", "azúcar alto": "diabetes mellitus",
    // Respiratory
    "asma": "asma bronquial", "bronquiectasia": "bronquiectasia", "fibrosis quística": "fibrosis quística", "epoc": "enfermedad pulmonar obstructiva crónica", "enfisema": "enfermedad pulmonar obstructiva crónica", "bronquitis crónica": "enfermedad pulmonar obstructiva crónica",
    // Urogenital
    "incontinencia": "incontinencia urinaria", "pérdida orina": "incontinencia urinaria", "insuficiencia renal": "insuficiencia renal crónica", "riñón": "insuficiencia renal crónica", "diálisis": "insuficiencia renal crónica",
    // Special Populations / Other
    "embarazo": "embarazo", "embarazada": "embarazo", "posparto": "posparto", "postparto": "posparto", "después del parto": "posparto", "menopausia": "menopausia", "mayor": "personas mayores", "tercera edad": "personas mayores", "viejo": "personas mayores", "caídas": "caídas", "riesgo caída": "caídas", "pérdida músculo": "sarcopenia", "sarcopenia": "sarcopenia", "fragilidad": "fragilidad", "frágil": "fragilidad",
    // Metabolic
    "sobrepeso": "sobrepeso", "obesidad": "obesidad",
    // General
    "general": "adultos", "ninguna": "adultos" // Map "ninguna" to general adult guidelines
   };
  const goalMappings = {
     "fuerza": ["fuerza", "fuerza máxima"], "hipertrofia": ["fuerza", "musculación deportiva"], "ganar músculo": ["fuerza", "musculación deportiva"], "masa muscular": ["fuerza", "musculación deportiva"], "volumen": ["fuerza", "musculación deportiva"], "estética": ["fuerza", "musculación deportiva"], "resistencia": ["resistencia"], "cardio": ["resistencia"], "aguantar más": ["resistencia"], "perder peso": ["resistencia", "pérdida de peso", "sobrepeso", "obesidad"], "adelgazar": ["resistencia", "pérdida de peso", "sobrepeso", "obesidad"], "quemar grasa": ["resistencia", "pérdida de peso", "sobrepeso", "obesidad"], "potencia": ["fuerza", "fuerza rápida", "fuerza velocidad/potencia"], "velocidad": ["fuerza", "fuerza rápida"], "explosividad": ["fuerza", "fuerza rápida", "fuerza velocidad/potencia"], "técnica": ["técnica de ejecución"], "aprender": ["técnica de ejecución"], "adaptación": ["adaptación anatómica"], "acondicionamiento": ["adaptación anatómica", "resistencia"], "preparación física": ["adaptación anatómica", "resistencia", "fuerza"], "salud": ["adultos", "resistencia", "fuerza", "salud"]
  };
  const experienceMappings = {
    "principiante": ["entrenamiento de la técnica de ejecución", "adaptación anatómica"], "nuevo": ["entrenamiento de la técnica de ejecución", "adaptación anatómica"], "0": ["entrenamiento de la técnica de ejecución", "adaptación anatómica"], "poco tiempo": ["entrenamiento de la técnica de ejecución", "adaptación anatómica"], "intermedio": ["musculación deportiva", "fuerza", "resistencia"], "avanzado": ["fuerza máxima", "fuerza rápida", "potencia", "fuerza velocidad/potencia"], "experto": ["fuerza máxima", "fuerza rápida", "potencia", "fuerza velocidad/potencia"]
  };

   // Expand client conditions using mappings
   clientConditionsInput.forEach(cond => {
       Object.keys(conditionMappings).forEach(key => {
           // Use word boundary for key matching to avoid partial matches (e.g., 'art' in 'parto')
           const keyRegex = new RegExp(`\\b${key}\\b`, 'i');
           if (keyRegex.test(cond)) {
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
    // Add general adult condition if no other specific condition applies strongly
    if (clientConditionsMapped.length === clientConditionsInput.length) { // Only add if no specific mappings were found
        clientConditionsMapped.push("adultos");
    }
    // Add age-related condition
    if (clientAge >= 65) {
        clientConditionsMapped.push("personas mayores");
        clientConditionsMapped.push("fragilidad"); // Assume potential fragility
        clientConditionsMapped.push("sarcopenia"); // Assume potential sarcopenia
        clientConditionsMapped.push("caídas"); // Assume risk of falls
    }
    // Add gender-specific conditions if applicable
    if (clientGender === 'femenino') {
        // Could add mappings for pregnancy, postpartum, menopause based on other client data if available
    }

    const uniqueClientConditions = [...new Set(clientConditionsMapped.map(c => c.toLowerCase()))]; // Final unique list, lowercased


  // 3. Iterate through Knowledge Base
  if (!Array.isArray(knowledgeBase)) {
     console.warn("Knowledge base no es un array válido.");
     return []; // Return empty array if KB is not valid
  }

  knowledgeBase.forEach(entry => {
    if (!entry || !entry.input || !entry.output) return; // Skip invalid entries

    const parsedInput = parseInputString(entry.input); // Parse the KB entry's input string
    let score = 0;
    const kbConditionLower = safeLowerCase(parsedInput.condition);
    const kbObjectiveLower = safeLowerCase(parsedInput.objective);
    const kbPhaseLower = safeLowerCase(parsedInput.phase);
    const kbCapacityLower = safeLowerCase(parsedInput.capacity);

    // --- Scoring Logic ---

    // a) Match by Condition (Highest Priority)
     if (kbConditionLower) {
        // Direct match or strong partial match with client's conditions
        if (uniqueClientConditions.some(clientCond => kbConditionLower === clientCond || (clientCond.length > 4 && kbConditionLower.includes(clientCond)) || (kbConditionLower.length > 4 && clientCond.includes(kbConditionLower)))) {
             score += 5; // High score for direct condition match
        }
        // General adult guidelines match if no specific condition matched strongly
        else if (kbConditionLower === 'adultos' && !uniqueClientConditions.some(c => c !== 'adultos')) {
             score += 1; // Baseline score for general adult guidelines
        }
     }

    // b) Match by Goal -> Objective/Capacity (Medium Priority)
     if (clientGoal && (kbObjectiveLower || kbCapacityLower)) {
        let goalsToCheck = [clientGoal];
        // Expand client goal using mappings
        Object.keys(goalMappings).forEach(key => { if (clientGoal.includes(key)) goalsToCheck = goalsToCheck.concat(goalMappings[key]); });
        goalsToCheck = [...new Set(goalsToCheck.map(g => g.toLowerCase()))];

        // Check if any mapped client goal matches KB objective or capacity
        if (goalsToCheck.some(g => (kbObjectiveLower && kbObjectiveLower.includes(g)) || (kbCapacityLower && kbCapacityLower.includes(g)))) {
             score += 3; // Good score for goal match
        }
     }

    // c) Match by Experience -> Phase (Medium Priority)
     if (clientExperience && kbPhaseLower) {
        let phasesToCheck = [clientExperience];
        // Expand client experience using mappings
         Object.keys(experienceMappings).forEach(key => { if (clientExperience.includes(key)) phasesToCheck = phasesToCheck.concat(experienceMappings[key]); });
        phasesToCheck = [...new Set(phasesToCheck.map(p => p.toLowerCase()))];

        // Check if any mapped client phase matches KB phase
        if (phasesToCheck.some(p => kbPhaseLower.includes(p))) {
             score += 2; // Medium score for experience/phase match
        }
     }

     // d) Boost score if multiple aspects match (e.g., Condition AND Goal)
     if (score >= 5 && ( (clientGoal && (kbObjectiveLower || kbCapacityLower)) || (clientExperience && kbPhaseLower) ) ) {
        score += 1; // Add bonus if condition matched AND goal/experience also matched
     }


    // Add guideline if relevant (score > 0) and not already added
    if (score > 0 && !addedInputs.has(entry.input)) {
      relevantGuidelines.push({ input: entry.input, output: entry.output, score: score });
      addedInputs.add(entry.input); // Mark this input string as added
    }
  });

  // Sort by score DESC
  relevantGuidelines.sort((a, b) => b.score - a.score);

  console.log(`Se encontraron ${relevantGuidelines.length} directrices relevantes con score > 0.`);
  // console.log("Top relevant guidelines:", relevantGuidelines.slice(0, 10)); // Log top matches for debugging
  return relevantGuidelines;
}


// Export main function and other utilities for testing or external use
module.exports = {
  generateRoutine,
  // Export helper functions if used for testing
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
  createPromptAndGenerate // Ensure this is also exported if needed externally
};
