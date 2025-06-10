/**
 * Cleans and structures client data from responses
 * @param {Array<object>} responses - Clean array of responses with question, answer, field
 * @returns {Object} - Structured client data
 */
function cleanClientData(responses) {
  // Find session time first for exclusion purposes
  const sessionTime = findSessionTime(responses);
  console.log(`Tiempo de sesión identificado: ${sessionTime || 'No especificado'}`);

  // Now get weight and height EXCLUDING session time
  const weight = getWeightExcludingSession(responses, sessionTime);
  const height = getHeightExcludingSession(responses, sessionTime);
  console.log(`Peso identificado: ${weight || 'No especificado'}`);
  console.log(`Altura identificada: ${height || 'No especificado'}`);

  // Structured data extraction
  const cleanData = {
    name: getAnswer('nombre', responses) || getAnswer('cómo te llamas', responses) || 'No especificado',
    age: getAnswer('edad', responses) || getAnswer('cuál es tu edad', responses) || '',
    gender: getAnswer('género', responses) || getAnswer('genero', responses) || getAnswer('cuál es tu género', responses) || '',
    email: getAnswer('email', responses) || getAnswer('correo electrónico', responses) || '',
    weight: weight || '',
    height: height || '',
    trainingGoal: getAnswer('objetivo', responses) || getAnswer('objetivo principal', responses) || '',
    experienceLevel: getAnswer('nivel', responses) || getAnswer('experiencia', responses) || '',
    physicalCondition: getAnswer('condición física', responses) || getAnswer('condicion_fisica', responses) || '',
    trainingLocation: getAnswer('lugar', responses) || getAnswer('dónde', responses) || getAnswer('lugar_entrenamiento', responses) || '',
    trainingDays: getAnswer('días', responses) || getAnswer('cuántos días', responses) || getAnswer('dias_entrenamiento', responses) || '',
    sessionTime: sessionTime || '',
    surgery: getAnswer('cirugía', responses) || getAnswer('cirugia_reciente', responses) || 'No',
    muscleInjury: getAnswer('lesión muscular', responses) || getAnswer('lesion_muscular', responses) || 'No',
    tendinopathy: getAnswer('tendinopatía', responses) || getAnswer('tendinopatia', responses) || 'No',
    mobilityLimitation: getAnswer('limitación', responses) || getAnswer('limitacion_articular', responses) || 'No',
    posturalProblem: getAnswer('postural', responses) || getAnswer('problema_postural', responses) || 'No',
    medicalCondition: getAnswer('condición médica', responses) || getAnswer('condicion_medica', responses) || 'No',
    medication: getAnswer('medicación', responses) || getAnswer('medicacion', responses) || 'No',
    favoriteExercises: getAnswer('favoritos', responses) || getAnswer('ejercicios_favoritos', responses) || '',
    exercisesToAvoid: getAnswer('evitar', responses) || getAnswer('ejercicios_evitar', responses) || '',
    trainingPreference: getAnswer('tipo', responses) || getAnswer('tipo_entrenamiento', responses) || '',
    specificEquipment: getAnswer('material', responses) || getAnswer('material_especifico', responses) || '',
    additionalInfo: getAnswer('adicional', responses) || getAnswer('info_adicional', responses) || ''
  };

  // Calculate BMI if weight and height are available
  cleanData.imc = calculateBMI(cleanData.weight, cleanData.height);

  // Log structured data for debugging
  console.log("Datos del cliente estructurados:", {
    ...cleanData,
    email: '***' // Hide email in logs
  });

  return cleanData;
}

/**
 * Calculates BMI from weight and height
 * @param {string} weight - Weight string (e.g., "75 kg", "165 lb")
 * @param {string} height - Height string (e.g., "175 cm", "1.75 m", "5.8 ft")
 * @returns {string} - BMI value or empty string
 */
function calculateBMI(weight, height) {
  if (!weight || !height) return '';

  try {
    // Extract numeric values and units
    const weightMatch = weight.match(/(\d+(?:[.,]\d+)?)\s*(kg|lb|libras)?/i);
    const heightMatch = height.match(/(\d+(?:[.,]\d+)?)\s*(cm|m|metros|ft|pies)?/i);

    if (!weightMatch || !heightMatch) return '';

    let weightKg = parseFloat(weightMatch[1].replace(',', '.'));
    const weightUnit = (weightMatch[2] || 'kg').toLowerCase();

    let heightM = parseFloat(heightMatch[1].replace(',', '.'));
    const heightUnit = (heightMatch[2] || 'cm').toLowerCase();

    // Convert weight to kg if needed
    if (weightUnit === 'lb' || weightUnit === 'libras') {
      weightKg = weightKg * 0.453592;
    }

    // Convert height to meters if needed
    if (heightUnit === 'cm') {
      heightM = heightM / 100;
    } else if (heightUnit === 'ft' || heightUnit === 'pies') {
      heightM = heightM * 0.3048;
    }

    // Calculate BMI
    const bmi = weightKg / (heightM * heightM);
    return bmi.toFixed(1);
  } catch (error) {
    console.error("Error calculating BMI:", error);
    return '';
  }
}

/**
 * Creates the prompt for OpenAI and generates the routine
 * @param {Array<string>} formattedResponses - Formatted responses for the prompt
 * @param {Array<object>} responses - Clean array of responses for data extraction
 * @param {Object} options - Additional options
 * @returns {Promise<string>} - Generated HTML routine
 */
async function createPromptAndGenerate(formattedResponses, responses, options = {}) {
  try {
    // Clean and structure client data
    const clientData = cleanClientData(responses);
    
    // Load knowledge base if available
    let knowledgeBase = [];
    try {
      const knowledgeBaseData = require('../knowledge_base.json');
      knowledgeBase = Array.isArray(knowledgeBaseData) ? knowledgeBaseData : [];
      console.log(`Base de conocimiento cargada con ${knowledgeBase.length} entradas`);
    } catch (error) {
      console.warn("No se pudo cargar knowledge_base.json:", error.message);
    }

    // Find relevant guidelines using improved mapping
    const relevantGuidelines = findRelevantGuidelines(clientData, knowledgeBase);
    
    // Get specific parameters for top conditions
    let specificParameters = [];
    if (relevantGuidelines.length > 0) {
      // Take top 3 most relevant conditions
      const topConditions = relevantGuidelines.slice(0, 3);
      
      topConditions.forEach(guideline => {
        const parsed = parseInputString(guideline.input);
        if (parsed.condition && parsed.capacity) {
          const params = getTrainingParameters(
            parsed.condition, 
            parsed.capacity, 
            parsed.loadContext
          );
          const formatted = formatParametersForPrompt(params);
          specificParameters.push(`Para ${parsed.condition} - ${parsed.capacity}: ${formatted}`);
        }
      });
    }

    // Build specific recommendations
    let specificRecommendations = '';
    if (relevantGuidelines.length > 0) {
      specificRecommendations = '\n\n**Recomendaciones Específicas Basadas en tu Perfil:**\n';
      relevantGuidelines.slice(0, 5).forEach((guideline, index) => {
        specificRecommendations += `${index + 1}. ${guideline.output}\n`;
      });
    }

    // Add specific training parameters
    if (specificParameters.length > 0) {
      specificRecommendations += "\n\n**Parámetros Específicos de Entrenamiento:**\n";
      specificParameters.forEach(param => {
        specificRecommendations += `- ${param}\n`;
      });
    }

    // Determine priority capacities for the client
    const mainCondition = clientData.medicalCondition || 'adultos sanos';
    const priorityCapacities = getPriorityCapacities(mainCondition);
    
    // Build the final prompt
    const systemPrompt = `Eres un entrenador personal experto y especialista en prescripción de ejercicio físico para la salud. 
Tu tarea es crear una rutina de entrenamiento personalizada basada en las respuestas del cliente al cuestionario.

IMPORTANTE: Debes seguir ESTRICTAMENTE los parámetros de entrenamiento basados en evidencia científica para cada condición médica o población especial.

**Capacidades prioritarias para este cliente:** ${priorityCapacities.join(', ')}

${specificRecommendations}

La rutina debe incluir:

1. **Resumen del Cliente**
   - Datos básicos (edad, género, IMC si está disponible)
   - Objetivo principal
   - Condiciones médicas o limitaciones
   - Nivel de experiencia

2. **Plan de Entrenamiento Semanal**
   - Distribución de días según disponibilidad
   - Duración de sesiones según tiempo disponible
   - Tipo de entrenamiento por día
   - Progresión mensual

3. **Ejercicios Específicos por Sesión**
   - Nombre del ejercicio
   - Series x Repeticiones (o tiempo si aplica)
   - Intensidad (% 1RM, RPE, velocidad)
   - Descanso entre series
   - Notas técnicas importantes

4. **Consideraciones Especiales**
   - Adaptaciones por condiciones médicas
   - Ejercicios contraindicados
   - Señales de alarma para detener el ejercicio
   - Recomendaciones de calentamiento y vuelta a la calma

5. **Progresión y Ajustes**
   - Cómo progresar en las próximas 4-8 semanas
   - Indicadores de que es momento de aumentar la carga
   - Ajustes según la respuesta al entrenamiento

Formato de salida: HTML bien estructurado con secciones claras, tablas para los ejercicios, y resaltado de información importante.`;

    const userPrompt = `Aquí están las respuestas del cliente al cuestionario:

${formattedResponses.join('\n\n')}

Por favor, genera una rutina de entrenamiento personalizada siguiendo las pautas proporcionadas y los parámetros específicos para las condiciones del cliente.`;

    console.log("Generando rutina con OpenAI...");
    
    const response = await openai.chat.completions.create({
      model: options.model || "gpt-4",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: options.temperature || 0.7,
      max_tokens: options.maxTokens || 6783,
    });

    const generatedRoutine = response.choices[0]?.message?.content;
    
    if (!generatedRoutine) {
      throw new Error("No se recibió respuesta de OpenAI");
    }

    console.log("Rutina generada exitosamente");
    return generatedRoutine;

  } catch (error) {
    console.error("Error en createPromptAndGenerate:", error);
    throw error;
  }
}

/**
 * Encuentra directrices relevantes de la base de conocimiento basándose en datos del cliente.
 * VERSIÓN MEJORADA: Mapeo más preciso según las tablas PDF proporcionadas
 * @param {Object} clientData - Datos limpios del cliente.
 * @param {Array<object>} knowledgeBase - Array de entradas de la base de conocimiento {input, output}.
 * @returns {Array<object>} - Array ordenado de directrices relevantes {input, output, score}.
 */
function findRelevantGuidelines(clientData, knowledgeBase) {
  const relevantGuidelines = [];
  const addedInputs = new Set();

  // Normalizar datos del cliente
  const safeLowerCase = (val) => String(val || '').toLowerCase().trim();
  
  // Recopilar todas las condiciones del cliente
  const clientConditionsInput = [
    clientData.medicalCondition, 
    clientData.surgery, 
    clientData.muscleInjury,
    clientData.tendinopathy, 
    clientData.mobilityLimitation, 
    clientData.posturalProblem,
    clientData.medication
  ].map(safeLowerCase).filter(c => c && !/^(no|nada|ningun[ao])$/i.test(c));

  // Mapeos expandidos y mejorados según las tablas
  const conditionMappings = {
    // APARATO CARDIOVASCULAR
    "arritmia": ["arritmias"],
    "arritmias": ["arritmias"],
    "corazón": ["cardiopatía isquémica", "insuficiencia cardíaca", "arritmias", "miocardiopatías", "valvulopatías"],
    "infarto": ["cardiopatía isquémica"],
    "angina": ["cardiopatía isquémica"],
    "isquemia": ["cardiopatía isquémica"],
    "hipertensión": ["hipertensión arterial"],
    "tensión alta": ["hipertensión arterial"],
    "presión alta": ["hipertensión arterial"],
    "insuficiencia cardíaca": ["insuficiencia cardíaca"],
    "insuficiencia venosa": ["insuficiencia venosa"],
    "varices": ["insuficiencia venosa"],
    "arterial periférica": ["enfermedad arterial periférica"],
    "claudicación": ["enfermedad arterial periférica"],
    "miocardiopatía": ["miocardiopatías"],
    "marcapasos": ["portador de marcapasos"],
    "válvula": ["valvulopatías"],
    
    // APARATO LOCOMOTOR
    "amputación": ["amputaciones"],
    "artritis juvenil": ["artritis idiopática juvenil"],
    "artritis": ["artrosis y artritis", "artritis idiopática juvenil"],
    "artrosis": ["artrosis y artritis"],
    "desgaste articular": ["artrosis y artritis"],
    "cervicalgia": ["cervicalgia"],
    "dolor cuello": ["cervicalgia"],
    "dolor cervical": ["cervicalgia"],
    "escoliosis": ["escoliosis"],
    "desviación columna": ["escoliosis"],
    "hombro doloroso": ["hombro doloroso"],
    "dolor hombro": ["hombro doloroso"],
    "manguito rotador": ["hombro doloroso"],
    "lesión rodilla": ["lesiones ligamentos rodilla"],
    "ligamento rodilla": ["lesiones ligamentos rodilla"],
    "lca": ["lesiones ligamentos rodilla"],
    "lesión tobillo": ["lesiones ligamentos tobillo"],
    "esguince tobillo": ["lesiones ligamentos tobillo"],
    "tendinitis": ["tendinopatía"],
    "tendinopatía": ["tendinopatía"],
    "tendinosis": ["tendinopatía"],
    "lumbalgia": ["lumbalgia"],
    "dolor espalda": ["lumbalgia"],
    "dolor lumbar": ["lumbalgia"],
    "osteoporosis": ["osteoporosis"],
    "huesos débiles": ["osteoporosis"],
    "prótesis rodilla": ["prótesis rodilla/tobillo"],
    "prótesis tobillo": ["prótesis rodilla/tobillo"],
    "prótesis cadera": ["prótesis de cadera"],
    
    // APARATO RESPIRATORIO
    "asma": ["asma bronquial"],
    "bronquiectasia": ["bronquiectasia"],
    "fibrosis quística": ["fibrosis quística"],
    "epoc": ["epoc"],
    "enfisema": ["epoc"],
    "bronquitis crónica": ["epoc"],
    
    // APARATO URINARIO
    "incontinencia": ["incontinencia urinaria"],
    "pérdida orina": ["incontinencia urinaria"],
    "insuficiencia renal": ["insuficiencia renal crónica"],
    "riñón": ["insuficiencia renal crónica"],
    "diálisis": ["insuficiencia renal crónica"],
    
    // APARATO DIGESTIVO
    "alergia alimentaria": ["alergia alimentaria"],
    "estreñimiento": ["estreñimiento crónico"],
    
    // CONDICIONES METABÓLICAS
    "diabetes": ["diabetes mellitus tipo 2"],
    "azúcar alto": ["diabetes mellitus tipo 2"],
    "obesidad": ["obesidad"],
    "sobrepeso": ["sobrepeso"],
    
    // POBLACIONES ESPECIALES
    "embarazo": ["embarazo"],
    "embarazada": ["embarazo"],
    "posparto": ["posparto"],
    "postparto": ["posparto"],
    "menopausia": ["menopausia"],
    "mayor": ["personas mayores"],
    "anciano": ["personas mayores"],
    "tercera edad": ["personas mayores"],
    "sarcopenia": ["sarcopenia"],
    "fragilidad": ["fragilidad"],
    "caídas": ["caídas (prevención)"],
    
    // CONDICIONES NEUROLÓGICAS/DOLOR
    "fibromialgia": ["fibromialgia"],
    "dolor crónico": ["fibromialgia"],
    
    // GENERAL
    "sano": ["adultos sanos"],
    "ninguna": ["adultos sanos"]
  };

  // Mapeos de objetivos mejorados
  const goalMappings = {
    "fuerza": ["fuerza", "fuerza máxima"],
    "ganar fuerza": ["fuerza", "fuerza máxima"],
    "hipertrofia": ["hipertrofia", "musculación deportiva"],
    "ganar músculo": ["hipertrofia", "musculación deportiva"],
    "masa muscular": ["hipertrofia", "musculación deportiva"],
    "volumen": ["hipertrofia", "musculación deportiva"],
    "estética": ["hipertrofia", "musculación estética"],
    "definición": ["hipertrofia", "musculación estética"],
    "resistencia": ["resistencia", "resistencia aeróbica"],
    "cardio": ["resistencia", "cardio"],
    "aguantar": ["resistencia", "resistencia a la velocidad"],
    "perder peso": ["resistencia", "pérdida de peso"],
    "adelgazar": ["resistencia", "pérdida de peso"],
    "quemar grasa": ["resistencia", "pérdida de peso"],
    "potencia": ["potencia", "fuerza rápida", "fuerza velocidad"],
    "velocidad": ["velocidad", "fuerza rápida"],
    "explosividad": ["potencia", "fuerza rápida"],
    "técnica": ["técnica de ejecución"],
    "aprender": ["técnica de ejecución"],
    "salud": ["salud", "adultos sanos"],
    "bienestar": ["salud", "adultos sanos"],
    "acondicionamiento": ["adaptación anatómica", "acondicionamiento general"]
  };

  // Mapeos de nivel de experiencia
  const experienceMappings = {
    "principiante": ["técnica de ejecución", "adaptación anatómica"],
    "novato": ["técnica de ejecución", "adaptación anatómica"],
    "nuevo": ["técnica de ejecución", "adaptación anatómica"],
    "intermedio": ["musculación deportiva", "fuerza"],
    "avanzado": ["fuerza máxima", "potencia", "musculación estética"],
    "experto": ["fuerza máxima", "potencia", "métodos avanzados"]
  };

  // Expandir condiciones del cliente usando mapeos
  let clientConditionsMapped = [...clientConditionsInput];
  
  clientConditionsInput.forEach(cond => {
    Object.keys(conditionMappings).forEach(key => {
      if (cond.includes(key) || key.includes(cond)) {
        const mapped = conditionMappings[key];
        clientConditionsMapped = clientConditionsMapped.concat(mapped);
      }
    });
  });

  // Añadir condiciones basadas en datos adicionales
  const clientAge = parseInt(clientData.age, 10) || null;
  const clientImc = parseFloat(clientData.imc) || null;
  const clientGender = safeLowerCase(clientData.gender);

  if (clientAge >= 65) {
    clientConditionsMapped.push("personas mayores", "sarcopenia", "caídas (prevención)");
  }
  
  if (clientImc) {
    if (clientImc >= 30) clientConditionsMapped.push("obesidad");
    else if (clientImc >= 25) clientConditionsMapped.push("sobrepeso");
  }
  
  if (clientGender === 'femenino') {
    // Podría añadir condiciones específicas según otros datos
    if (clientData.additionalInfo && clientData.additionalInfo.includes("menopausia")) {
      clientConditionsMapped.push("menopausia");
    }
  }

  // Si no hay condiciones específicas, asumir adulto sano
  if (clientConditionsMapped.length === 0) {
    clientConditionsMapped.push("adultos sanos");
  }

  const uniqueClientConditions = [...new Set(clientConditionsMapped.map(c => c.toLowerCase()))];

  // Procesar objetivos del cliente
  const clientGoal = safeLowerCase(clientData.trainingGoal);
  let clientGoalsMapped = [clientGoal];
  
  Object.keys(goalMappings).forEach(key => {
    if (clientGoal.includes(key)) {
      clientGoalsMapped = clientGoalsMapped.concat(goalMappings[key]);
    }
  });
  
  const uniqueClientGoals = [...new Set(clientGoalsMapped.map(g => g.toLowerCase()))];

  // Procesar nivel de experiencia
  const clientExperience = safeLowerCase(clientData.experienceLevel);
  let clientExperienceMapped = [clientExperience];
  
  Object.keys(experienceMappings).forEach(key => {
    if (clientExperience.includes(key)) {
      clientExperienceMapped = clientExperienceMapped.concat(experienceMappings[key]);
    }
  });
  
  const uniqueClientExperience = [...new Set(clientExperienceMapped.map(e => e.toLowerCase()))];

  // Iterar por la base de conocimiento y calcular puntuaciones
  knowledgeBase.forEach(entry => {
    if (!entry || !entry.input || !entry.output) return;

    const parsedInput = parseInputString(entry.input);
    let score = 0;
    
    const kbCondition = safeLowerCase(parsedInput.condition);
    const kbObjective = safeLowerCase(parsedInput.objective);
    const kbPhase = safeLowerCase(parsedInput.phase);
    const kbCapacity = safeLowerCase(parsedInput.capacity);
    const kbLoadContext = safeLowerCase(parsedInput.loadContext);

    // Puntuación por condición (máxima prioridad)
    if (kbCondition) {
      if (uniqueClientConditions.some(clientCond => 
        kbCondition === clientCond || 
        kbCondition.includes(clientCond) || 
        clientCond.includes(kbCondition)
      )) {
        score += 10; // Puntuación alta para coincidencia de condición
        
        // Bonus si también coincide la carga específica
        if (kbLoadContext && clientData.additionalInfo && 
            clientData.additionalInfo.toLowerCase().includes(kbLoadContext)) {
          score += 3;
        }
      }
    }

    // Puntuación por objetivo
    if (kbObjective || kbCapacity) {
      if (uniqueClientGoals.some(goal => 
        (kbObjective && kbObjective.includes(goal)) || 
        (kbCapacity && kbCapacity.includes(goal))
      )) {
        score += 5;
      }
    }

    // Puntuación por fase/experiencia
    if (kbPhase) {
      if (uniqueClientExperience.some(exp => kbPhase.includes(exp))) {
        score += 3;
      }
    }

    // Bonus por múltiples coincidencias
    const matches = [
      kbCondition && uniqueClientConditions.some(c => kbCondition.includes(c)),
      (kbObjective || kbCapacity) && uniqueClientGoals.some(g => 
        (kbObjective && kbObjective.includes(g)) || 
        (kbCapacity && kbCapacity.includes(g))
      ),
      kbPhase && uniqueClientExperience.some(e => kbPhase.includes(e))
    ].filter(Boolean).length;
    
    if (matches >= 2) score += 2; // Bonus por múltiples aspectos coincidentes

    // Añadir si es relevante
    if (score > 0 && !addedInputs.has(entry.input)) {
      relevantGuidelines.push({ 
        input: entry.input, 
        output: entry.output, 
        score: score,
        matches: {
          condition: kbCondition && uniqueClientConditions.some(c => kbCondition.includes(c)),
          goal: (kbObjective || kbCapacity) && uniqueClientGoals.some(g => 
            (kbObjective && kbObjective.includes(g)) || 
            (kbCapacity && kbCapacity.includes(g))
          ),
          experience: kbPhase && uniqueClientExperience.some(e => kbPhase.includes(e))
        }
      });
      addedInputs.add(entry.input);
    }
  });

  // Ordenar por puntuación descendente
  relevantGuidelines.sort((a, b) => b.score - a.score);

  console.log(`[Mapeo Mejorado] Se encontraron ${relevantGuidelines.length} directrices relevantes.`);
  console.log(`[Mapeo Mejorado] Top 5 directrices:`, relevantGuidelines.slice(0, 5).map(g => ({
    input: g.input,
    score: g.score,
    matches: g.matches
  })));

  return relevantGuidelines;
}

/**
 * Función auxiliar mejorada para parsear el string de entrada de la base de conocimiento
 * @param {string} inputStr - String de entrada de knowledge_base.json
 * @returns {object} - Componentes parseados { condition, capacity, phase, objective, loadContext, raw }
 */
function parseInputString(inputStr) {
  const parts = { 
    condition: null, 
    capacity: null, 
    phase: null, 
    objective: null, 
    loadContext: null, 
    raw: inputStr 
  };
  
  if (!inputStr || typeof inputStr !== 'string') return parts;

  const inputLower = inputStr.toLowerCase().trim();
  
  // Buscar patrones con prefijos explícitos
  const patterns = [
    { prefix: 'condición:', key: 'condition' },
    { prefix: 'capacidad:', key: 'capacity' },
    { prefix: 'fase:', key: 'phase' },
    { prefix: 'objetivo:', key: 'objective' },
    { prefix: 'carga:', key: 'loadContext' },
    { prefix: 'método:', key: 'method' }
  ];

  patterns.forEach(({ prefix, key }) => {
    const regex = new RegExp(`${prefix}\\s*([^,]+?)(?:,|$)`, 'i');
    const match = inputStr.match(regex);
    if (match) {
      parts[key] = match[1].trim();
    }
  });

  // Si no se encontraron prefijos, intentar inferir por palabras clave
  if (!parts.condition && !parts.objective && !parts.phase) {
    // Lista expandida de condiciones médicas
    const medicalConditions = [
      'hipertensión', 'diabetes', 'asma', 'epoc', 'cardiopatía', 'arritmia',
      'insuficiencia', 'artritis', 'artrosis', 'lumbalgia', 'cervicalgia',
      'osteoporosis', 'tendinopatía', 'lesión', 'prótesis', 'embarazo',
      'menopausia', 'personas mayores', 'obesidad', 'fibromialgia',
      'incontinencia', 'escoliosis', 'amputación', 'sarcopenia'
    ];
    
    // Verificar si contiene alguna condición médica
    if (medicalConditions.some(cond => inputLower.includes(cond))) {
      parts.condition = inputLower;
    }
    // Verificar objetivos de entrenamiento
    else if (/\b(fuerza|hipertrofia|potencia|resistencia|técnica|adaptación)\b/i.test(inputLower)) {
      parts.objective = inputLower;
    }
  }

  return parts;
}

/**
 * Obtiene los parámetros de entrenamiento específicos para una condición y capacidad
 * @param {string} condition - Condición médica o población especial
 * @param {string} capacity - Capacidad a entrenar (fuerza, resistencia, etc.)
 * @param {string} loadContext - Contexto de carga específico (opcional)
 * @returns {object} - Parámetros de entrenamiento
 */
function getTrainingParameters(condition, capacity, loadContext = '') {
  const conditionLower = condition.toLowerCase();
  const capacityLower = capacity.toLowerCase();
  const loadLower = loadContext.toLowerCase();

  // Base de parámetros por condición-capacidad
  const parameterMap = {
    // APARATO CARDIOVASCULAR
    'arritmias': {
      'fuerza': {
        frecuencia: '2-3 ses/sem',
        intensidad: '50-60% 1RM',
        repeticiones: '10-20',
        series: '3-5',
        descanso: '60-90s',
        notas: 'Evitar Valsalva, movimientos controlados, monitorizar síntomas'
      },
      'resistencia': {
        frecuencia: '2-5 ses/sem',
        intensidad: '40-70% VO₂ máx, 40-80% FCM',
        duracion: '20-40 min',
        metodo: 'Circuito preferible',
        notas: 'Actividades rítmicas, grandes grupos musculares'
      }
    },
    
    'hipertensión arterial': {
      'fuerza': {
        frecuencia: '2-7 ses/sem',
        intensidad: '25-50% 1RM',
        repeticiones: '6-12',
        series: '1-5',
        descanso: '30-120s',
        notas: 'EVITAR ISOMÉTRICOS INTENSOS Y VALSALVA, ejercicios dinámicos'
      },
      'resistencia': {
        frecuencia: '3-7 ses/sem (preferible diario)',
        intensidad: '40-70% FCR',
        volumen: '150-300 min/sem',
        notas: 'Aeróbico continuo (caminar, nadar, bici)'
      }
    },
    
    'insuficiencia cardíaca': {
      'fuerza': {
        frecuencia: '2 ses/sem',
        intensidad: '30-40% 1RM',
        repeticiones: '10-25',
        series: '1-3',
        descanso: '60s',
        notas: 'Cargas muy ligeras, evitar Valsalva, monitorizar fatiga/disnea'
      },
      'resistencia': {
        frecuencia: '2-5 ses/sem',
        intensidad: '60-80% FCM',
        duracion: '10-40 min (progresivo)',
        notas: 'Puede usar intervalos, aeróbico bajo impacto'
      }
    },
    
    // APARATO LOCOMOTOR
    'lumbalgia': {
      'fuerza': {
        frecuencia: '2-3 ses/sem',
        intensidad: '50-60% 1RM',
        repeticiones: '10-15',
        series: '2-3',
        notas: 'ESTABILIZACIÓN CORE (transverso, oblicuos, multífidos), control motor'
      },
      'resistencia': {
        frecuencia: '2-5 ses/sem',
        intensidad: '50-70% VO₂ máx',
        duracion: '45-60 min',
        notas: 'Caminar, nadar, elíptica con buena postura'
      },
      'neuromuscular': {
        frecuencia: '2-3 ses/sem',
        duracion: '30 min/ses',
        notas: 'Control motor, propiocepción, activación muscular'
      }
    },
    
    'osteoporosis': {
      'fuerza': {
        estructural: {
          frecuencia: '2-3 ses/sem',
          intensidad: '50-80% 1RM',
          repeticiones: '8-20',
          series: '1-3',
          notas: 'Carga axial/apendicular, evitar flexión/torsión espinal brusca'
        },
        impactos: {
          frecuencia: '2-3 ses/sem',
          notas: 'Actividades con impacto controlado progresivo'
        }
      },
      'resistencia': {
        frecuencia: '3-7 ses/sem',
        intensidad: '50-85% FCM',
        duracion: '30-60 min',
        notas: 'Actividades CON CARGA (caminar), evitar riesgo caída'
      }
    },
    
    'tendinopatía': {
      'fuerza': {
        isometria: {
          frecuencia: 'Diario',
          duracion: '30-45s contracción',
          intensidad: '70% CVM',
          series: '3-5',
          notas: 'Isométricos en rango medio para analgesia'
        },
        hsr: {
          frecuencia: '3 ses/sem',
          intensidad: '70-85% 1RM',
          repeticiones: '6-10',
          series: '3-4',
          velocidad: 'Lenta (3s CON, 3s ECC)',
          notas: 'Carga pesada y lenta del tendón'
        }
      }
    },
    
    // POBLACIONES ESPECIALES
    'embarazo': {
      'fuerza': {
        frecuencia: '≥2 ses/sem',
        intensidad: '30-70% 1RM',
        repeticiones: '6-12',
        series: '1-3',
        descanso: '1-3 min',
        notas: 'Evitar Valsalva, supino prolongado >T1, impacto/riesgo caída'
      },
      'resistencia': {
        frecuencia: '3-4 ses/sem',
        volumen: '>150 min/sem',
        intensidad: '65-95% FCM moderada',
        notas: 'Caminar, nadar, bici estática, test conversación'
      }
    },
    
    'personas mayores': {
      'fuerza': {
        frecuencia: '≥3 ses/sem',
        intensidad: '60-80% 1RM',
        repeticiones: '8-12',
        series: '1-3',
        descanso: '60-90s',
        notas: 'Ejercicios funcionales AVD'
      },
      'neuromuscular': {
        frecuencia: '≥3 ses/sem',
        duracion: '10-15 min',
        notas: 'Equilibrio estático/dinámico, Tai Chi, prevención caídas'
      }
    },
    
    'adultos sanos': {
      'fuerza': {
        frecuencia: '≥2 ses/sem',
        intensidad: '50-80% 1RM',
        repeticiones: '8-12',
        series: '1-3',
        descanso: '40-90s',
        notas: '6-8 ejercicios grandes grupos, equilibrar empuje/tracción'
      },
      'resistencia': {
        frecuencia: '3-5 ses/sem',
        volumen: '150-300 min/sem moderado o 75-150 vigoroso',
        notas: 'Variedad de modalidades aeróbicas'
      }
    }
  };

  // Buscar parámetros específicos
  if (parameterMap[conditionLower]) {
    if (parameterMap[conditionLower][capacityLower]) {
      // Si hay contexto de carga específico
      if (loadLower && parameterMap[conditionLower][capacityLower][loadLower]) {
        return parameterMap[conditionLower][capacityLower][loadLower];
      }
      return parameterMap[conditionLower][capacityLower];
    }
  }

  // Parámetros por defecto si no se encuentra coincidencia específica
  return getDefaultParameters(capacityLower);
}

/**
 * Obtiene parámetros por defecto según la capacidad
 * @param {string} capacity - Capacidad a entrenar
 * @returns {object} - Parámetros por defecto
 */
function getDefaultParameters(capacity) {
  const defaults = {
    'fuerza': {
      frecuencia: '2-3 ses/sem',
      intensidad: '60-80% 1RM',
      repeticiones: '8-12',
      series: '3-4',
      descanso: '60-90s',
      notas: 'Técnica correcta, progresión gradual'
    },
    'resistencia': {
      frecuencia: '3-5 ses/sem',
      intensidad: '60-70% FCM',
      duracion: '30-45 min',
      notas: 'Progresión gradual en volumen'
    },
    'flexibilidad': {
      frecuencia: '2-7 ses/sem',
      duracion: '15-30s por estiramiento',
      series: '2-3',
      notas: 'Estiramientos estáticos suaves'
    },
    'neuromuscular': {
      frecuencia: '2-3 ses/sem',
      duracion: '10-15 min',
      notas: 'Equilibrio, coordinación, propiocepción'
    }
  };

  return defaults[capacity] || defaults['fuerza'];
}

/**
 * Formatea los parámetros para incluirlos en el prompt de OpenAI
 * @param {object} parameters - Objeto con parámetros de entrenamiento
 * @returns {string} - String formateado para el prompt
 */
function formatParametersForPrompt(parameters) {
  let formatted = [];
  
  if (parameters.frecuencia) formatted.push(`Frecuencia: ${parameters.frecuencia}`);
  if (parameters.intensidad) formatted.push(`Intensidad: ${parameters.intensidad}`);
  if (parameters.repeticiones) formatted.push(`Repeticiones: ${parameters.repeticiones}`);
  if (parameters.series) formatted.push(`Series: ${parameters.series}`);
  if (parameters.descanso) formatted.push(`Descanso: ${parameters.descanso}`);
  if (parameters.duracion) formatted.push(`Duración: ${parameters.duracion}`);
  if (parameters.volumen) formatted.push(`Volumen: ${parameters.volumen}`);
  if (parameters.velocidad) formatted.push(`Velocidad: ${parameters.velocidad}`);
  if (parameters.metodo) formatted.push(`Método: ${parameters.metodo}`);
  if (parameters.notas) formatted.push(`Consideraciones: ${parameters.notas}`);
  
  return formatted.join('. ');
}

/**
 * Determina las capacidades prioritarias según la condición
 * @param {string} condition - Condición médica
 * @returns {array} - Array de capacidades prioritarias ordenadas
 */
function getPriorityCapacities(condition) {
  const conditionLower = condition.toLowerCase();
  
  const priorities = {
    // Cardiovascular: priorizar resistencia aeróbica
    'hipertensión arterial': ['resistencia', 'fuerza', 'flexibilidad'],
    'cardiopatía isquémica': ['resistencia', 'fuerza', 'flexibilidad'],
    'insuficiencia cardíaca': ['resistencia', 'fuerza', 'flexibilidad'],
    
    // Musculoesquelético: priorizar fuerza/estabilización
    'lumbalgia': ['fuerza', 'neuromuscular', 'flexibilidad', 'resistencia'],
    'osteoporosis': ['fuerza', 'resistencia', 'neuromuscular'],
    'sarcopenia': ['fuerza', 'resistencia', 'neuromuscular'],
    'artritis': ['flexibilidad', 'fuerza', 'resistencia'],
    
    // Metabólico: equilibrio fuerza-resistencia
    'diabetes': ['resistencia', 'fuerza', 'flexibilidad'],
    'obesidad': ['resistencia', 'fuerza', 'flexibilidad'],
    
    // Respiratorio: resistencia con precaución
    'asma': ['resistencia', 'fuerza', 'flexibilidad'],
    'epoc': ['resistencia', 'fuerza', 'flexibilidad'],
    
    // Poblaciones especiales
    'embarazo': ['resistencia', 'fuerza', 'flexibilidad', 'neuromuscular'],
    'personas mayores': ['fuerza', 'neuromuscular', 'resistencia', 'flexibilidad'],
    
    // Por defecto
    'default': ['fuerza', 'resistencia', 'flexibilidad', 'neuromuscular']
  };
  
  return priorities[conditionLower] || priorities['default'];
}

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
    console.warn("Formato de líneas no estándar. Usando mapeo contextual.");
    
    // Try to map lines to known questions based on keywords
    const mappedResults = cleanedLines.map(line => {
        // Check if the line matches any of our known questions
        const matchingQuestion = FORM_FIELD_QUESTIONS.find(q => 
            line.toLowerCase().includes(q.text.toLowerCase()) ||
            q.text.toLowerCase().includes(line.toLowerCase())
        );
        
        if (matchingQuestion) {
            return { question: matchingQuestion.text, answer: line };
        }
        
        // Otherwise, try to detect what type of data it is
        if (/^\d+$/.test(line) && parseInt(line) > 10 && parseInt(line) < 100) {
            return { question: "¿Cuál es tu edad?", answer: line };
        }
        if (/^\d+([.,]\d+)?\s*(kg|kilos)$/i.test(line)) {
            return { question: "¿Cuánto pesas?", answer: line };
        }
        if (/^\d+([.,]\d+)?\s*(cm|m|metros)$/i.test(line)) {
            return { question: "¿Cuál es tu altura?", answer: line };
        }
        if (/^(masculino|femenino|hombre|mujer|otro)$/i.test(line)) {
            return { question: "¿Cuál es tu género?", answer: line };
        }
        if (/^[\w\.\-]+@[\w\.\-]+\.\w+$/.test(line)) {
            return { question: "¿Cuál es tu dirección de correo electrónico?", answer: line };
        }
        
        
        return { question: "¿Hay algo más que debamos saber?", answer: line };
    });
    
    return mappedResults.filter(r => r.question && r.answer);
}

module.exports = {
  generateRoutine,
  findRelevantGuidelines,
  getTrainingParameters,
  getDefaultParameters,
  formatParametersForPrompt,
  getPriorityCapacities
};