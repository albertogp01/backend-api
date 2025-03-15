/**
 * backend-api/services/openaiService.js
 * Servicio robusto para generar rutinas de entrenamiento usando OpenAI
 * Adaptado de la versión original para funcionar sin Typeform
 */

const OpenAI = require("openai");
const dotenv = require('dotenv');

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
  { id: "limitacion_ejercicios", text: "¿Tienes alguna limitación al realizar ejercicios como sentadillas, flexiones o saltos?" },
  { id: "limitacion_ejercicios_descripcion", text: "Descripción de limitación de ejercicios" },
  { id: "problema_postural", text: "¿Tienes algún problema postural que afecte tu entrenamiento?" },
  { id: "problema_postural_descripcion", text: "Descripción de problema postural" },
  { id: "condicion_medica", text: "¿Sufres de alguna condición médica que afecte tu rendimiento?" },
  { id: "condicion_medica_descripcion", text: "Descripción de condición médica" },
  { id: "medicacion", text: "¿Estás tomando alguna medicación que pueda afectar tu entrenamiento?" },
  { id: "medicacion_descripcion", text: "Descripción de medicación" },
  { id: "restricciones_alimenticias", text: "¿Tienes alguna restricción alimenticia?" },
  { id: "restricciones_descripcion", text: "Descripción de restricciones alimenticias" },
  { id: "ejercicios_favoritos", text: "¿Hay algún tipo de ejercicio que te guste especialmente?" },
  { id: "ejercicios_evitar", text: "¿Hay algún tipo de ejercicio que te desagrade o prefieras evitar?" },
  { id: "tipo_entrenamiento", text: "¿Prefieres entrenamientos enfocados en un grupo muscular por día o entrenamientos de cuerpo completo?" },
  { id: "material_especifico", text: "¿Quieres usar material específico?" },
  { id: "info_adicional", text: "¿Hay algo más que debamos saber para personalizar mejor tu rutina?" }
];

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
    let responses;
    
    // 1. Si es un array de strings con formato "Pregunta\nRespuesta" (formato ya procesado)
    if (Array.isArray(formData) && typeof formData[0] === 'string' && formData[0].includes('\n')) {
      console.log("Procesando formato 'Pregunta\\nRespuesta'");
      responses = formData.map(item => {
        const [question, answer] = item.split('\n').map(part => part.trim());
        return { question, answer };
      });
    }
    // 2. Si es un array de objetos con propiedades question y answer
    else if (Array.isArray(formData) && typeof formData[0] === 'object' && formData[0].hasOwnProperty('question')) {
      console.log("Procesando array de objetos pregunta-respuesta");
      responses = formData;
    }
    // 3. Si es un objeto con pares clave-valor (formato del nuevo formulario)
    else if (typeof formData === 'object' && !Array.isArray(formData)) {
      console.log("Procesando objeto de pares campo-valor");
      responses = processFormFieldsObject(formData);
    }
    // 4. Si es un array con pares de texto simple (líneas)
    else if (Array.isArray(formData) && typeof formData[0] === 'string') {
      console.log("Procesando array de líneas de texto");
      responses = processTextLines(formData);
    }
    // Formato no soportado
    else {
      throw new Error("Formato de datos no soportado para generar rutina");
    }

    // Formatear respuestas para el prompt, excluyendo datos sensibles
    const formattedResponses = responses
      .filter(item => 
        !item.question.includes("¿Cómo te llamas?") && 
        !item.question.includes("dirección de correo electrónico")
      )
      .map(item => `Pregunta: ${item.question}\nRespuesta: ${item.answer || "Sin respuesta"}`);

    console.log(`Procesando ${formattedResponses.length} respuestas para generar rutina`);

    // Generar el prompt para OpenAI y obtener la rutina
    return await createPromptAndGenerate(formattedResponses, responses, options);
  } catch (error) {
    console.error("Error en generateRoutine:", error);
    throw error;
  }
};

/**
 * Procesa un objeto con campos de formulario
 * 
 * @param {Object} formFields - Objeto con campos del formulario
 * @returns {Array} - Array de objetos con pregunta y respuesta
 */
function processFormFieldsObject(formFields) {
  // Crear un mapa de IDs a preguntas para búsqueda rápida
  const questionMap = {};
  FORM_FIELD_QUESTIONS.forEach(q => {
    questionMap[q.id] = q.text;
  });

  // Copiar para no modificar el original
  const processedFields = { ...formFields };
  
  // Lista de pares de campos condicionales
  const conditionalFields = [
    { main: 'cirugia_reciente', desc: 'cirugia_descripcion' },
    { main: 'lesion_muscular', desc: 'lesion_muscular_descripcion' },
    { main: 'tendinopatia', desc: 'tendinopatia_descripcion' },
    { main: 'limitacion_articular', desc: 'limitacion_articular_descripcion' },
    { main: 'limitacion_ejercicios', desc: 'limitacion_ejercicios_descripcion' },
    { main: 'problema_postural', desc: 'problema_postural_descripcion' },
    { main: 'condicion_medica', desc: 'condicion_medica_descripcion' },
    { main: 'medicacion', desc: 'medicacion_descripcion' },
    { main: 'restricciones_alimenticias', desc: 'restricciones_descripcion' }
  ];
  
  // Procesar campos condicionales
  conditionalFields.forEach(({ main, desc }) => {
    if (processedFields[main] === 'Sí' && processedFields[desc]) {
      // Si la respuesta principal es "Sí" y hay descripción, combinarlas
      processedFields[main] = `Sí: ${processedFields[desc]}`;
      // Y eliminar el campo de descripción para evitar duplicación
      delete processedFields[desc];
    }
  });

  // Convertir a formato de preguntas y respuestas
  return Object.entries(processedFields)
    .filter(([field, value]) => value && value.trim() !== '')
    .map(([field, value]) => {
      // Buscar el texto de la pregunta correspondiente al campo
      const questionText = questionMap[field] || field;
      return {
        question: questionText,
        answer: value.trim(),
        field: field
      };
    });
}

/**
 * Procesa un array de líneas de texto
 * 
 * @param {Array<string>} textLines - Array de líneas de texto
 * @returns {Array} - Array de objetos con pregunta y respuesta
 */
function processTextLines(textLines) {
  // Limpiar líneas vacías y espacios
  const cleanedLines = textLines.filter(line => 
    line && typeof line === 'string' && line.trim() !== ''
  );
  
  // Verificar si las líneas tienen formato "Pregunta: Respuesta"
  const hasQuestionFormat = cleanedLines.some(line => 
    line.includes('Pregunta:') && line.includes('Respuesta:')
  );
  
  if (hasQuestionFormat) {
    // Extraer pregunta y respuesta de cada línea
    return cleanedLines.map(line => {
      const questionMatch = line.match(/Pregunta:\s*(.*?)(?:,\s*Respuesta:|$)/i);
      const answerMatch = line.match(/Respuesta:\s*(.*)/i);
      
      if (questionMatch) {
        return {
          question: questionMatch[1].trim(),
          answer: answerMatch ? answerMatch[1].trim() : ""
        };
      }
      return null;
    }).filter(item => item !== null);
  }
  
  // Si no tienen formato estándar, intentar mapear a preguntas por contexto
  return mapLinesToQuestions(cleanedLines);
}

/**
 * Intenta mapear líneas de texto a preguntas por contexto
 * 
 * @param {Array<string>} lines - Líneas de texto
 * @returns {Array} - Array de objetos con pregunta y respuesta
 */
function mapLinesToQuestions(lines) {
  // Definir patrones para identificar temas de respuestas
  const patterns = [
    { question: "¿Cuál es tu objetivo principal de entrenamiento?", 
      patterns: [/objetivo/i, /meta/i, /quieres conseguir/i, /hipertrofia/i, /fuerza/i, /resistencia/i] },
    { question: "¿Cuál es tu nivel de experiencia con el entrenamiento?", 
      patterns: [/experiencia/i, /nivel/i, /principiante/i, /avanzado/i, /intermedio/i] },
    { question: "¿Cómo describirías tu condición física actual?", 
      patterns: [/condición física/i, /forma física/i, /sedentari/i, /activ/i] },
    { question: "¿Dónde sueles entrenar?", 
      patterns: [/gimnasio/i, /casa/i, /aire libre/i, /donde entreno/i, /lugar/i] },
    { question: "¿Cuántos días a la semana puedes entrenar?", 
      patterns: [/días/i, /días por semana/i, /frecuencia/i, /veces por semana/i] },
    { question: "¿Cuánto tiempo puedes dedicar por sesión?", 
      patterns: [/tiempo/i, /duración/i, /minutos/i, /horas/i, /sesión/i] },
    { question: "¿Has tenido alguna cirugía reciente?", 
      patterns: [/cirugía/i, /operación/i, /operado/i] },
    { question: "¿Tienes alguna lesión muscular?", 
      patterns: [/lesión/i, /muscular/i, /rotura/i, /desgarro/i] },
    { question: "¿Tienes alguna tendinopatía?", 
      patterns: [/tendino/i, /tendón/i, /tendinitis/i] },
    { question: "¿Tienes limitaciones de movilidad?", 
      patterns: [/movilidad/i, /limitación/i, /articulación/i, /articula/i] },
    { question: "¿Tienes alguna limitación al realizar ejercicios?", 
      patterns: [/ejercicios/i, /sentadilla/i, /flexión/i, /limitación/i, /salto/i] },
    { question: "¿Tienes algún problema postural?", 
      patterns: [/postura/i, /postural/i, /escoliosis/i, /cifosis/i, /lordosis/i] },
    { question: "¿Sufres de alguna condición médica?", 
      patterns: [/condición/i, /médica/i, /enfermedad/i, /diabetes/i, /hipertensión/i] },
    { question: "¿Estás tomando alguna medicación?", 
      patterns: [/medicación/i, /medicamento/i, /pastilla/i, /medicina/i] },
    { question: "¿Hay algún tipo de ejercicio que te guste?", 
      patterns: [/gusta/i, /preferido/i, /favorito/i, /disfruto/i] },
    { question: "¿Hay algún tipo de ejercicio que te desagrade?", 
      patterns: [/desagrad/i, /odio/i, /evitar/i, /no me gusta/i, /detesto/i] },
    { question: "¿Prefieres entrenamientos por grupo muscular o cuerpo completo?", 
      patterns: [/grupo muscular/i, /cuerpo completo/i, /split/i, /rutina/i, /full body/i] },
    { question: "¿Quieres usar material específico?", 
      patterns: [/material/i, /equipo/i, /máquina/i, /mancuerna/i, /barra/i, /peso/i] },
    { question: "¿Hay algo más que debamos saber?", 
      patterns: [/adicional/i, /comentario/i, /extra/i, /saber más/i, /añadir/i] }
  ];
  
  // Array para almacenar los resultados
  const results = [];
  
  // Para cada línea, intentar encontrar la pregunta más adecuada
  lines.forEach(line => {
    if (!line.trim()) return;
    
    let bestMatch = null;
    let bestScore = 0;
    
    // Probar cada patrón
    patterns.forEach(({ question, patterns }) => {
      let score = 0;
      
      // Contar cuántos patrones coinciden
      patterns.forEach(pattern => {
        if (pattern.test(line.toLowerCase())) {
          score++;
        }
      });
      
      // Si este patrón tiene mejor puntuación, actualizamos
      if (score > bestScore) {
        bestScore = score;
        bestMatch = question;
      }
    });
    
    // Si encontramos una coincidencia razonable, agregamos la respuesta
    if (bestScore > 0) {
      results.push({
        question: bestMatch,
        answer: line.trim()
      });
    } else {
      // Si no se encuentra coincidencia, simplemente usamos la línea como respuesta
      // y marcamos la pregunta como desconocida
      results.push({
        question: "Información adicional",
        answer: line.trim()
      });
    }
  });
  
  return results;
}

/**
 * Obtiene la respuesta a una pregunta específica
 * 
 * @param {string} question - Texto de la pregunta
 * @param {Array} responses - Array de respuestas
 * @returns {string} - Respuesta encontrada o cadena vacía
 */
function getAnswer(question, responses) {
  const response = responses.find(r => r.question.includes(question));
  if (response && response.answer && response.answer.trim() !== '') {
    return response.answer.trim();
  }
  return '';
}

/**
 * Construye una descripción textual del cliente
 * 
 * @param {Object} data - Datos del cliente
 * @returns {string} - Descripción del cliente
 */
function buildClientDescription(data) {
  let description = "un cliente";
  
  // GÉNERO
  if (data.gender) {
    if (data.gender.toLowerCase().includes("masculino") || 
        data.gender.toLowerCase().includes("hombre")) {
      description = "un cliente de género masculino";
    } else if (data.gender.toLowerCase().includes("femenino") || 
        data.gender.toLowerCase().includes("mujer")) {
      description = "una cliente de género femenino";
    } else {
      description = `un cliente de género ${data.gender.toLowerCase()}`;
    }
  }
  
  // EDAD - Verificar que sea realmente una edad
  if (data.age && /^\d+$/.test(data.age.trim()) || /^\d+\s*años/.test(data.age.trim())) {
    description += ` de ${data.age.trim()}`;
  } else if (data.age && data.age.trim().length < 10) {
    // Si es corto, podría ser edad mal formateada
    description += ` de ${data.age.trim()}`;
  } else {
    // Si no parece edad, omitirla
    description += "";
  }
  
  description += ". ";
  
  // CONDICIÓN FÍSICA
  if (data.fitnessLevel && !/experiencia|intermedio|principiante|avanzado/i.test(data.fitnessLevel)) {
    description += `Tiene un nivel de condición física ${data.fitnessLevel.toLowerCase()}. `;
  }
  
  // NIVEL DE EXPERIENCIA
  if (data.experienceLevel && !/condición física|activa|sedentaria|deportista/i.test(data.experienceLevel)) {
    description += `Con un nivel de experiencia ${data.experienceLevel.toLowerCase()}. `;
  }
  
  // OBJETIVO DE ENTRENAMIENTO
  if (data.trainingGoal && !/operado|lesión|dolor|tengo|cuesta/i.test(data.trainingGoal)) {
    description += `Su objetivo principal es ${data.trainingGoal.toLowerCase()}. `;
  }
  
  // LUGAR DE ENTRENAMIENTO
  if (data.trainingLocation && data.trainingLocation.toLowerCase().includes("entreno")) {
    description += `${data.trainingLocation}. `;
  } else if (data.trainingLocation) {
    description += `Entrena en ${data.trainingLocation.toLowerCase()}. `;
  }
  
  // FRECUENCIA DE ENTRENAMIENTO
  if (data.daysPerWeek && /^\d+$|^un[oa]?|^dos|^tres|^cuatro|^cinco|^seis|^siete/i.test(data.daysPerWeek.trim())) {
    description += `Puede entrenar ${data.daysPerWeek.toLowerCase()} a la semana `;
  }
  
  // DURACIÓN DE SESIÓN
  if (data.sessionTime && /minutos|hora/i.test(data.sessionTime)) {
    description += `con sesiones de ${data.sessionTime.toLowerCase()}. `;
  } else if (data.sessionTime) {
    // Si no contiene "minutos" u "horas", añadir
    const trimmedTime = data.sessionTime.trim();
    if (/^\d+$/.test(trimmedTime)) {
      // Si solo hay un número, asumir minutos
      description += `con sesiones de ${trimmedTime} minutos. `;
    } else {
      description += `con sesiones de ${trimmedTime}. `;
    }
  }
  
  // REVISAR DUPLICACIONES Y CONFLICTOS
  
  // Conjunto para evitar añadir información duplicada
  const includedInfo = new Set();
  
  // Información médica y lesiones (eliminar duplicados)
  let injuries = [];
  
  if (data.surgery && !includedInfo.has(data.surgery.toLowerCase())) {
    injuries.push(data.surgery);
    includedInfo.add(data.surgery.toLowerCase());
  }
  
  if (data.muscleInjury && !includedInfo.has(data.muscleInjury.toLowerCase())) {
    injuries.push(data.muscleInjury);
    includedInfo.add(data.muscleInjury.toLowerCase());
  }
  
  if (data.tendinopathy && !includedInfo.has(data.tendinopathy.toLowerCase())) {
    injuries.push(data.tendinopathy);
    includedInfo.add(data.tendinopathy.toLowerCase());
  }
  
  if (injuries.length > 0) {
    description += `Tiene las siguientes lesiones a considerar: ${injuries.join(", ")}. `;
  }
  
  // Condición médica
  if (data.medicalCondition && !includedInfo.has(data.medicalCondition.toLowerCase())) {
    description += `Presenta la siguiente condición médica: ${data.medicalCondition}. `;
    includedInfo.add(data.medicalCondition.toLowerCase());
  }
  
  // Medicación
  if (data.medication && !includedInfo.has(data.medication.toLowerCase())) {
    description += `Está tomando la siguiente medicación: ${data.medication}. `;
    includedInfo.add(data.medication.toLowerCase());
  }
  
  // Limitaciones físicas (eliminar duplicados con lesiones)
  let limitations = [];
  
  if (data.mobilityLimitation && !includedInfo.has(data.mobilityLimitation.toLowerCase())) {
    limitations.push(data.mobilityLimitation);
    includedInfo.add(data.mobilityLimitation.toLowerCase());
  }
  
  if (data.exerciseLimitation && !includedInfo.has(data.exerciseLimitation.toLowerCase())) {
    limitations.push(data.exerciseLimitation);
    includedInfo.add(data.exerciseLimitation.toLowerCase());
  }
  
  if (limitations.length > 0) {
    description += `Presenta estas limitaciones físicas: ${limitations.join(", ")}. `;
  }
  
  // Problema postural
  if (data.posturalProblem && !includedInfo.has(data.posturalProblem.toLowerCase())) {
    description += `Tiene el siguiente problema postural: ${data.posturalProblem}. `;
    includedInfo.add(data.posturalProblem.toLowerCase());
  }
  
  // Preferencias
  if (data.exercisePreference && 
      data.exercisePreference.toLowerCase() !== data.exerciseAvoidance?.toLowerCase() && 
      !includedInfo.has(data.exercisePreference.toLowerCase())) {
    description += `Prefiere los siguientes tipos de ejercicios: ${data.exercisePreference}. `;
    includedInfo.add(data.exercisePreference.toLowerCase());
  }
  
  // Ejercicios a evitar (verificar que no es igual a preferencia)
  if (data.exerciseAvoidance && 
      data.exerciseAvoidance.toLowerCase() !== data.exercisePreference?.toLowerCase() && 
      !includedInfo.has(data.exerciseAvoidance.toLowerCase())) {
    description += `Prefiere evitar: ${data.exerciseAvoidance}. `;
    includedInfo.add(data.exerciseAvoidance.toLowerCase());
  }
  
  // Estructura de entrenamiento
  if (data.trainingPreference && !includedInfo.has(data.trainingPreference.toLowerCase())) {
    description += `En cuanto a la estructura de entrenamiento, prefiere ${data.trainingPreference.toLowerCase()}. `;
    includedInfo.add(data.trainingPreference.toLowerCase());
  }
  
  // Material específico
  if (data.specificMaterial && !includedInfo.has(data.specificMaterial.toLowerCase())) {
    description += `Quiere entrenar con ${data.specificMaterial.toLowerCase()}. `;
    includedInfo.add(data.specificMaterial.toLowerCase());
  }
  
  // Información adicional
  if (data.additionalInfo && 
      !['no', 'nada', 'ninguno'].includes(data.additionalInfo.toLowerCase()) && 
      !includedInfo.has(data.additionalInfo.toLowerCase())) {
    description += `Información adicional: ${data.additionalInfo}. `;
  }
  
  return description;
}

/**
 * Crea el prompt para OpenAI y genera la rutina
 * 
 * @param {Array} formattedResponses - Array de respuestas formateadas
 * @param {Array} enhancedResponses - Array de objetos con todas las respuestas
 * @param {Object} options - Opciones adicionales para la generación
 * @returns {Promise<string>} - HTML de la rutina generada
 */
const createPromptAndGenerate = async (formattedResponses, enhancedResponses = [], options = {}) => {
  // Extraer información relevante del cliente
  const clientData = {
    name: getAnswer("¿Cómo te llamas?", enhancedResponses) || "el cliente",
    gender: getAnswer("género", enhancedResponses),
    age: getAnswer("edad", enhancedResponses),
    trainingGoal: getAnswer("objetivo", enhancedResponses),
    experienceLevel: getAnswer("nivel", enhancedResponses) || getAnswer("experiencia", enhancedResponses),
    fitnessLevel: getAnswer("condición física", enhancedResponses),
    trainingLocation: getAnswer("¿Dónde sueles entrenar?", enhancedResponses) || getAnswer("lugar", enhancedResponses),
    daysPerWeek: getAnswer("días", enhancedResponses) || getAnswer("semana", enhancedResponses),
    sessionTime: getAnswer("tiempo", enhancedResponses) || getAnswer("sesión", enhancedResponses),
    surgery: getAnswer("cirugía", enhancedResponses),
    muscleInjury: getAnswer("lesión muscular", enhancedResponses),
    tendinopathy: getAnswer("tendinopatía", enhancedResponses),
    mobilityLimitation: getAnswer("movilidad", enhancedResponses) || getAnswer("limitaciones", enhancedResponses),
    exerciseLimitation: getAnswer("ejercicios", enhancedResponses) || getAnswer("limitación", enhancedResponses),
    posturalProblem: getAnswer("postural", enhancedResponses),
    medicalCondition: getAnswer("condición médica", enhancedResponses),
    medication: getAnswer("medicación", enhancedResponses),
    exercisePreference: getAnswer("guste", enhancedResponses) || getAnswer("preferido", enhancedResponses) || getAnswer("favorito", enhancedResponses),
    exerciseAvoidance: getAnswer("desagrade", enhancedResponses) || getAnswer("evitar", enhancedResponses) || getAnswer("disgusten", enhancedResponses),
    trainingPreference: getAnswer("grupo muscular", enhancedResponses) || getAnswer("cuerpo completo", enhancedResponses),
    specificMaterial: getAnswer("material", enhancedResponses),
    additionalInfo: getAnswer("adicional", enhancedResponses) || getAnswer("algo más", enhancedResponses)
  };
  
  console.log("Datos del cliente extraídos:", clientData);
  
  // Limpiar datos inconsistentes
  const cleanedData = cleanClientData(clientData);
  
  // Construir descripción del cliente
  const clientDescription = buildClientDescription(cleanedData);
  
  console.log("Descripción del cliente:", clientDescription);

  // Construir el prompt
  const prompt = `
  Eres un entrenador personal elite con certificación internacional y expertise en ciencias del ejercicio, biomecánica y periodización. Tu misión es crear una rutina de entrenamiento semanal en formato HTML altamente personalizada para ${clientDescription}

  La rutina debe estar adaptada perfectamente a su perfil, considerando todas sus características, necesidades y limitaciones. Toda esta información debe reflejarse en la selección de ejercicios.

  1. PRINCIPIOS DE DISEÑO
   - Adapta la periodización específicamente al nivel del cliente (principiante, intermedio, avanzado)
   - Selecciona ejercicios con óptima relación riesgo/beneficio considerando la biomecánica individual
   - Asegura progres- Asegura progresiones lógicas tanto dentro de cada sesión como a lo largo de la semana

  2. PERFIL COMPLETO DEL CLIENTE
  ${formattedResponses.join("\n\n")}

  3. ESTRUCTURA DE LA RUTINA
  La rutina DEBE incluir suficientes ejercicios según la duración de la sesión:
- 30 minutos: 4-5 ejercicios principales
- 60 minutos: 6-8 ejercicios principales (MÍNIMO 6)
- 75 minutos: 7-9 ejercicios principales (MÍNIMO 7)
- 90 minutos: 8-10 ejercicios principales (MÍNIMO 8)
- 120 minutos: 10-12 ejercicios principales (MÍNIMO 10)

REGLA ESTRICTA: Si la sesión es de 60 minutos o más, DEBES incluir al menos el mínimo de ejercicios indicado.
La activación se realiza aparte y no se contabiliza dentro de este tiempo.

  4. FORMATO OBLIGATORIO PARA CADA DÍA
  Para cada día de entrenamiento, utiliza exactamente esta estructura de tabla HTML:

    <table>
      <tr>
        <th colspan="5">Día X: Titulo del contenido a trabajar</th>
      </tr>
      <tr class="activacion-header">
        <td colspan="5"><b>Activación</b></td>
      </tr>
      <tr>
        <th>Ejercicio</th>
        <th>Nº Series</th>
        <th>Nº de Rep</th>
        <th>Descanso</th>
        <th>Descripción</th>
      </tr>
      <tr class="rutina-header">
        <td colspan="5"><b>Rutina</b></td>
      </tr>
      <tr>
        <th>Ejercicio</th>
        <th>Nº Series</th>
        <th>Nº de Rep</th>
        <th>Int 1RM%</th>
        <th>Descripción</th>
      </tr>
    </table>

  Requisitos específicos para ejercicios:

  5. ESPECIFICACIONES PARA LA SECCIÓN DE ACTIVACIÓN
    - Propósito: Preparar fisiológicamente los tejidos y sistemas para el entrenamiento principal
    - Selección: Ejercicios específicos para los grupos musculares a trabajar ese día
    - Parámetros exactos:
      - Series: 2-3
      - Repeticiones: 8-15
      - Descanso: 30-60 segundos (especifica exactamente)
      - Descripción técnica concisa (máximo 20 palabras)
    - Progresión: Organiza ejercicios de menor a mayor intensidad/complejidad
    - Prioridades: Movilidad articular → activación muscular → estabilidad central → patrones básicos de movimientor

  6. ESPECIFICACIONES PARA LA RUTINA PRINCIPAL
    - Selección basada en evidencia científica:
     - Corresponde al objetivo específico (hipertrofia/fuerza/resistencia)
     - Adecuados al nivel de experiencia (volumen e intensidad escalados)
     - Adaptados a limitaciones articulares o lesiones previas
     - Optimizados para el equipamiento disponible
    - Parámetros técnicos preciso para cada ejercicio:
      - Nombre técnico exacto del ejercicio (incluye variante específica)
      - Material específico (kg, tipo de máquina, resistencia de bandas)
      - Series (número exacto)
      - Repeticiones (rango específico)
      - Intensidad (%1RM cuando aplique)
      - Descripción técnica de ejecución (puntos clave, máximo 20 palabras)
      - Tempo cuando sea relevante (formato 3:1:0:2 = concéntrica:pausa:excéntrica:pausa)
    - Optimización del tiempo: Máxima eficiencia según duración disponible
    - Balance: Atención a todos los grupos musculares principales según necesidades individuales
  
  7. SECCIÓN DE VARIANTES (OBLIGATORIA)
  Al final de cada día, añade variantes con este formato HTML exacto:

  <div class="side-variants-container">
    <div class="side-variants-title">Variantes para Día X</div>
    <div class="side-variant-item">
      <div class="side-variant-title">Ejercicio Original → Variante</div>
      <div class="side-variant-description">Explicación de la variante usando lenguaje directo: "Si tienes dolor en X, sustituye por Y" (no uses "usuario" o "cliente")</div>
    </div>
    <!-- Repetir side-variant-item para cada variante -->
  </div>
  
  8. RESTRICCIONES CRÍTICAS
    - Evita términos imprecisos como "peso adecuado" o "ritmo controlado"
    - No incluyas recomendaciones de calentamiento cardiovascular general
    - Omite notas o explicaciones fuera de las estructuras definidas
    - Proporciona ÚNICAMENTE el HTML puro, sin etiquetas de código markdown como \`\`\`html o \`\`\`
    - No uses términos como "usuario" o "cliente" en las variantes
    - Cada ejercicio debe tener un propósito específico (no añadas "relleno")
    - Crea progresiones lógicas entre ejercicios y entre días
    - MUY IMPORTANTE: NO INCLUYAS MARCADORES DE CÓDIGO MARKDOWN como \`\`\`html o \`\`\` en tu respuesta
    - OBLIGATORIO: Para sesiones de 60 minutos o más, incluye AL MENOS 6 ejercicios principales
    - OBLIGATORIO: Para sesiones de 90 minutos o más, incluye AL MENOS 8 ejercicios principales
    - OBLIGATORIO: Para sesiones de 120 minutos, incluye AL MENOS 10 ejercicios principales

  9. VARIANTES ADICIONALES 
  - Para cada ejercicio principal, intenta proporcionar al menos una variante alternativa
  - Las variantes deben cubrir:
    * Alternativas con equipamiento diferente
    * Modificaciones para diferentes niveles de habilidad
    * Adaptaciones para limitaciones específicas
    * Progresiones o regresiones del ejercicio
  `;

  try {
    // Establecer un timeout para la solicitud (2 minutos)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);

    // Realizar solicitud a OpenAI con timeout
    console.log("Enviando solicitud a OpenAI...");
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini", // Configurable por variable de entorno
      messages: [
        {
          role: "system",
          content: "Eres un entrenador personal especializado que crea rutinas de entrenamiento personalizadas."
        },
        { 
          role: "user", 
          content: prompt 
        }
      ],
      temperature: 0.7,     // Añadir creatividad y diversidad
      max_tokens: 15000,    // Aumentar para permitir respuestas más largas
    });
    
    // Limpiar el timeout
    clearTimeout(timeoutId);
  
    const responseMessage = completion.choices[0]?.message?.content;
  
    if (!responseMessage) {
      throw new Error("No se generó una respuesta válida");
    }

    // Registrar éxito
    console.log("Rutina generada exitosamente con OpenAI");
  
    return responseMessage;
  } catch (error) {
    // Manejar error de timeout
    if (error.name === 'AbortError') {
      throw new Error("La generación de la rutina excedió el tiempo máximo permitido");
    }
    
    // Otros errores de la API
    console.error("Error en OpenAI API:", error);
    
    if (error.status === 429) {
      throw new Error("Límite de API de OpenAI excedido. Intenta de nuevo más tarde.");
    } else if (error.status >= 500) {
      throw new Error("Error en el servicio de OpenAI. Intenta de nuevo más tarde.");
    }
    
    throw new Error(`Error generando la rutina: ${error.message}`);
  }
};

/**
 * Limpia y verifica la consistencia de los datos del cliente
 * 
 * @param {Object} clientData - Datos extraídos del cliente
 * @returns {Object} - Datos limpios y consistentes
 */
function cleanClientData(clientData) {
  const cleanedData = { ...clientData };

  // Verificar edad - debería ser un número o contener dígitos
  if (cleanedData.age && !/^\d+$|^\d+\s*años/i.test(cleanedData.age)) {
    // Si la edad contiene texto de nivel de experiencia, limpiarla
    if (/experiencia|intermedio|principiante|avanzado/i.test(cleanedData.age)) {
      cleanedData.age = "";
    }
  }
  
  // Verificar género - debe ser una opción conocida
  if (cleanedData.gender && !/masculino|femenino|hombre|mujer|prefiero no especificar|no binario/i.test(cleanedData.gender)) {
    cleanedData.gender = "";
  }
  
  // Verificar objetivo - no debe contener texto de lesiones o limitaciones
  if (cleanedData.trainingGoal && /dolor|lesion|operado|limitaci[óo]n|cuesta/i.test(cleanedData.trainingGoal)) {
    cleanedData.trainingGoal = "";
  }
  
  // Verificar que ejercicios preferidos y a evitar no son iguales
  if (cleanedData.exercisePreference && 
      cleanedData.exerciseAvoidance && 
      cleanedData.exercisePreference.toLowerCase() === cleanedData.exerciseAvoidance.toLowerCase()) {
    // Si son iguales, probablemente uno está mal asignado
    if (/evitar|no me gusta|no me gustan|no quiero|odio|detesto/i.test(cleanedData.exercisePreference)) {
      // La preferencia parece una evitación
      cleanedData.exerciseAvoidance = cleanedData.exercisePreference;
      cleanedData.exercisePreference = "";
    } else {
      // Asumir que la evitación está mal
      cleanedData.exerciseAvoidance = "";
    }
  }
  
  // Verificar días por semana (debe tener sentido como frecuencia)
  if (cleanedData.daysPerWeek && !/^\d+$|^\d+\s*días|un|dos|tres|cuatro|cinco|seis|siete/i.test(cleanedData.daysPerWeek)) {
    cleanedData.daysPerWeek = "";
  }
  
  // Verificar tiempo por sesión (debe tener sentido como duración)
  if (cleanedData.sessionTime && !/^\d+$|^\d+\s*min|hora|minutos/i.test(cleanedData.sessionTime)) {
    cleanedData.sessionTime = "";
  }
  
  return cleanedData;
}

// Exportar función principal y otras utilidades para testing
module.exports = { 
  generateRoutine,
  // Exportar funciones auxiliares para testing
  processFormFieldsObject,
  processTextLines,
  mapLinesToQuestions,
  buildClientDescription,
  getAnswer,
  cleanClientData
};