/**
 * @fileoverview Service for analyzing workout routine HTML, calculating metrics,
 * and generating an HTML cover page with summary charts.
 */

/**
 * Calculates training component scores based on keywords and heuristics in routine HTML.
 * Analyzes text content to determine the focus distribution (strength, hypertrophy, etc.).
 *
 * @param {string} routineHtml - The HTML content of the generated workout routine.
 * @returns {object} An object containing:
 * - scores: {fuerza: number, hipertrofia: number, ..., cardio: number} (0-100 percentages)
 * - mainComponents: string[] - Names of the components with the highest scores (above threshold).
 * - mainComponentsDisplay: string - User-friendly string listing main components.
 */
function calculateTrainingComponentScores(routineHtml) {
    // Initialize scores for each component
    const scores = {
        fuerza: 0,
        hipertrofia: 0,
        movilidad: 0,
        potencia: 0,
        tecnica: 0,
        cardio: 0
    };

    // Return default balanced scores if no HTML is provided
    if (!routineHtml || typeof routineHtml !== 'string' || routineHtml.trim() === '') {
        console.warn("calculateTrainingComponentScores: No valid routine HTML provided. Returning default balanced scores.");
        return {
            fuerza: 50, hipertrofia: 50, movilidad: 50,
            potencia: 50, tecnica: 50, cardio: 50,
            mainComponents: [], mainComponentsDisplay: 'Equilibrado'
        };
    }

    // --- Configuration: Keywords and Weights ---

    // Keywords associated with each training component. Case-insensitive matching with word boundaries.
    // Note: Some keywords might overlap (e.g., 'resistencia'). Weights help differentiate.
    const keywordsConfig = {
        fuerza: { weight: 1, list: ['fuerza', 'strength', 'carga', 'peso', 'resistencia', 'weight', 'sentadilla', 'squat', 'press', 'deadlift', 'peso muerto', 'power', 'potencia', 'rm', '1rm', 'máxima', 'maximales', 'intensidad alta', 'pesado', 'heavy'] },
        hipertrofia: { weight: 1, list: ['hipertrofia', 'hypertrophy', 'volumen', 'volume', 'muscle', 'músculo', 'muscular', 'growth', 'crecimiento', 'tamaño', 'size', 'bodybuilding', 'culturismo', 'series', 'repeticiones', 'reps', 'rir'] },
        movilidad: { weight: 1, list: ['movilidad', 'mobility', 'flexibility', 'flexibilidad', 'stretching', 'estiramiento', 'range', 'motion', 'rango', 'articular', 'joint', 'rom', 'elasticidad', 'elongación', 'estirar', 'stretch', 'yoga', 'pilates'] },
        potencia: { weight: 1, list: ['potencia', 'power', 'explosiv', 'explosi[oó]n', 'velocidad', 'speed', 'fast', 'rápido', 'salto', 'jump', 'plyometric', 'pliometría', 'reactiv', 'sprint', 'lanzamiento', 'throw', 'tiempo', 'time', 'kettlebell swing'] }, // Removed broad 'tempo.*[xX]'
        tecnica: { weight: 1, list: ['técnica', 'technique', 'form', 'forma', 'skill', 'habilidad', 'balance', 'equilibrio', 'coordination', 'coordinación', 'control', 'pattern', 'patrón', 'motor', 'stability', 'estabilidad', 'aprendizaje', 'drills'] },
        cardio: { weight: 1, list: ['cardio', 'cardiovascular', 'aeróbico', 'aerobic', 'resistencia', 'endurance', 'stamina', 'interval', 'intervalos', 'hiit', 'heart', 'rate', 'ritmo', 'cardiac', 'cardíaco', 'vo2', 'máximo', 'correr', 'run', 'nadar', 'swim', 'bicicleta', 'bike', 'cinta', 'eliptica'] }
    };

    // Specific exercises strongly indicative of a component. Higher weight than general keywords.
    const specificExercisesConfig = {
        fuerza: { weight: 2.5, list: ['press de banca', 'bench press', 'sentadilla', 'squat', 'peso muerto', 'deadlift', 'press militar', 'overhead press', 'remo con barra', 'barbell row'] },
        hipertrofia: { weight: 2.0, list: ['curl', 'elevaciones laterales', 'lateral raise', 'extensiones de triceps', 'tricep extension', 'remo con mancuernas', 'dumbbell row', 'aperturas', 'flyes', 'pulldown'] },
        movilidad: { weight: 2.5, list: ['rotaciones', 'mobility drills', 'estiramiento dinámico', 'dynamic stretch', 'foam roller', 'yoga', 'pilates'] },
        potencia: { weight: 3.0, list: ['salto al cajón', 'box jump', 'lanzamiento de balón', 'medicine ball throw', 'kettlebell swing', 'power clean', 'snatch', 'clean and jerk'] },
        tecnica: { weight: 2.5, list: ['pistol squat', 'turkish get up', 'handstand', 'equilibrio', 'coordinación', 'propiocepción', 'isométrico', 'isometric'] },
        cardio: { weight: 2.0, list: ['correr', 'running', 'burpee', 'jumping jack', 'ciclismo', 'natación', 'remo', 'rowing machine', 'assault bike'] }
    };

    // Heuristics based on Rep Ranges (Sets x Reps format)
    // Weighting favors lower reps for strength, mid reps for hypertrophy, higher reps for endurance/cardio.
    const repRangeHeuristics = {
        lowRepMax: 6,    // Reps <= this count towards strength
        midRepMax: 15,   // Reps > lowRepMax and <= this count towards hypertrophy
        // Reps > midRepMax count towards cardio/endurance
        weights: {
            fuerza: 2.0,
            hipertrofia: 1.5,
            cardio: 1.0 // Higher reps contribute slightly to cardio score
        }
    };

    // Heuristics based on Intensity/Tempo indicators (RIR, RPE, Tempo, Rest)
    const intensityHeuristics = [
        { regex: /RIR\s+[0-2]/gi, scores: { fuerza: 3, hipertrofia: 5 } },
        { regex: /RIR\s+[3-4]/gi, scores: { hipertrofia: 3 } },
        { regex: /RPE\s+[8-9]/gi, scores: { fuerza: 2, hipertrofia: 4 } },
        { regex: /RPE\s+[6-7]/gi, scores: { hipertrofia: 2 } },
        { regex: /tempo\s+\d{4,}/gi, scores: { tecnica: 3, hipertrofia: 2 } }, // 4-digit tempo
        { regex: /tempo\s+explosiv[oa]/gi, scores: { potencia: 6 } }, // Explicit explosive tempo
        { regex: /descanso\s+(corto|30s|45s|60s)/gi, scores: { hipertrofia: 1, cardio: 1 } },
        { regex: /descanso\s+(largo|90s|120s|2-3\s*min)/gi, scores: { fuerza: 2 } }
    ];

    // --- Calculation ---

    // Initialize raw counts for each component
    const counts = { fuerza: 0, hipertrofia: 0, movilidad: 0, potencia: 0, tecnica: 0, cardio: 0 };

    // 1. Keyword Analysis
    Object.entries(keywordsConfig).forEach(([component, config]) => {
        config.list.forEach(keyword => {
            try {
                // Use word boundaries (\b) to avoid partial matches (e.g., 'power' in 'powerlifting')
                const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
                const matches = routineHtml.match(regex) || [];
                counts[component] += matches.length * config.weight;
            } catch (e) {
                console.warn(`calculateTrainingComponentScores: Invalid regex for keyword '${keyword}'.`, e);
            }
        });
    });

    // 2. Specific Exercise Analysis
    Object.entries(specificExercisesConfig).forEach(([component, config]) => {
        config.list.forEach(exercise => {
            try {
                // Handle potential spaces in exercise names
                const regex = new RegExp(exercise.replace(/\s+/g, '\\s+'), 'gi');
                const matches = routineHtml.match(regex) || [];
                counts[component] += matches.length * config.weight;
            } catch (e) {
                console.warn(`calculateTrainingComponentScores: Invalid regex for exercise '${exercise}'.`, e);
            }
        });
    });

    // 3. Rep Range Analysis (e.g., "3x10", "4 x 8-12 reps")
    // Regex tries to capture "Sets x Reps" patterns, including ranges
    const setRepRegex = /(\d+)\s*x\s*(\d+(?:-\d+)?)\s*(?:reps|repeticiones|sets)?/gi;
    const setRepMatches = routineHtml.matchAll(setRepRegex); // Use matchAll for better iteration

    for (const match of setRepMatches) {
        const numSets = parseInt(match[1], 10);
        const repString = match[2];
        const repRange = repString.split('-').map(Number);
        const maxReps = Math.max(...repRange);

        if (!isNaN(numSets) && !isNaN(maxReps) && numSets > 0) {
            if (maxReps <= repRangeHeuristics.lowRepMax) {
                counts.fuerza += numSets * repRangeHeuristics.weights.fuerza;
            } else if (maxReps <= repRangeHeuristics.midRepMax) {
                counts.hipertrofia += numSets * repRangeHeuristics.weights.hipertrofia;
            } else {
                counts.cardio += numSets * repRangeHeuristics.weights.cardio;
            }
        }
    }
     // Add analysis for simple rep mentions (e.g., "15 reps") as a minor factor
     const simpleRepRegex = /\b(\d+)\s+reps?\b/gi;
     const simpleRepMatches = routineHtml.matchAll(simpleRepRegex);
     for (const match of simpleRepMatches) {
         const reps = parseInt(match[1], 10);
         if (!isNaN(reps) && reps > 0) {
             if (reps <= repRangeHeuristics.lowRepMax) counts.fuerza += 0.5; // Lower weight for simple mentions
             else if (reps <= repRangeHeuristics.midRepMax) counts.hipertrofia += 0.5;
             else counts.cardio += 0.5;
         }
     }


    // 4. Intensity/Tempo Heuristics Analysis
    intensityHeuristics.forEach(heuristic => {
        const matches = routineHtml.match(heuristic.regex) || [];
        matches.forEach(() => { // Add score for each match found
            Object.entries(heuristic.scores).forEach(([component, score]) => {
                counts[component] += score;
            });
        });
    });

    // --- Normalization and Final Score Calculation ---

    // Calculate total raw count across all components
    const totalCount = Object.values(counts).reduce((sum, count) => sum + Math.max(0, count), 0);

    // Handle case where no relevant keywords/heuristics were found
    if (totalCount === 0) {
        console.warn("calculateTrainingComponentScores: Total count for normalization is zero. Returning default balanced scores.");
        return {
            fuerza: 50, hipertrofia: 50, movilidad: 50,
            potencia: 50, tecnica: 50, cardio: 50,
            mainComponents: [], mainComponentsDisplay: 'Equilibrado'
        };
    }

    // Normalize counts to percentages (0-100)
    Object.keys(counts).forEach(component => {
        scores[component] = Math.round((Math.max(0, counts[component]) / totalCount) * 100);
    });

    // Apply a minimum threshold for components that had *some* count, prevents tiny slivers in charts
    const minThreshold = 5;
    Object.keys(scores).forEach(component => {
        if (counts[component] > 0 && scores[component] < minThreshold) {
            scores[component] = minThreshold;
        }
        // Ensure score doesn't exceed 100 (can happen due to rounding/thresholding)
        scores[component] = Math.min(scores[component], 100);
    });

    // Re-normalize if the sum is significantly off 100 after thresholding
    let currentTotalScore = Object.values(scores).reduce((sum, score) => sum + score, 0);
    if (currentTotalScore > 0 && Math.abs(currentTotalScore - 100) > 1) { // Allow small rounding diffs
        const scaleFactor = 100 / currentTotalScore;
        Object.keys(scores).forEach(component => {
            // Rescale, ensuring components with zero initial count remain zero
            if (counts[component] > 0) {
                 scores[component] = Math.round(scores[component] * scaleFactor);
                 // Re-apply min threshold and max cap after scaling
                 scores[component] = Math.max(minThreshold, Math.min(scores[component], 100));
            } else {
                scores[component] = 0;
            }
        });
    }

    // Final adjustment: Distribute any remaining difference (due to rounding) to the largest component(s)
    currentTotalScore = Object.values(scores).reduce((sum, score) => sum + score, 0);
    let diff = 100 - currentTotalScore;
    if (diff !== 0 && currentTotalScore > 0) {
         // Find all components with the maximum score
         const maxScoreValue = Math.max(...Object.values(scores));
         const maxComponents = Object.keys(scores).filter(c => scores[c] === maxScoreValue);

         // Distribute the difference evenly among the max components
         const adjustmentPerComponent = Math.round(diff / maxComponents.length);
         let remainder = diff % maxComponents.length;

         maxComponents.forEach((component, index) => {
             let adjustment = adjustmentPerComponent + (index < Math.abs(remainder) ? Math.sign(diff) : 0);
             scores[component] = Math.min(100, Math.max(0, scores[component] + adjustment));
         });

         // Final check in case rounding still caused issues (rare)
         currentTotalScore = Object.values(scores).reduce((sum, score) => sum + score, 0);
         if (currentTotalScore !== 100) {
             // As a last resort, add/remove from the first max component found
              const firstMaxComp = Object.keys(scores).reduce((a, b) => scores[a] > scores[b] ? a : b);
              scores[firstMaxComp] += (100 - currentTotalScore);
              scores[firstMaxComp] = Math.min(100, Math.max(0, scores[firstMaxComp]));
         }
    }


    // Determine Main Components (those above a certain threshold, e.g., 25%)
    const mainComponentThreshold = 25;
    let maxScoreValue = 0;
    let mainComponents = [];
    Object.entries(scores).forEach(([component, score]) => {
        if (score >= mainComponentThreshold) {
            mainComponents.push(component);
             maxScoreValue = Math.max(maxScoreValue, score); // Track max score among significant components
        } else {
             maxScoreValue = Math.max(maxScoreValue, score); // Track max score even if below threshold
        }
    });

     // If no component reached the threshold, identify the highest scoring one(s) as main
    if (mainComponents.length === 0 && maxScoreValue > 0) {
        mainComponents = Object.keys(scores).filter(c => scores[c] === maxScoreValue);
    }

    // Sort main components alphabetically for consistent display order
    mainComponents.sort();

    // Prepare results object
    const finalResult = {
        ...scores, // Include individual scores
        mainComponents: mainComponents,
        mainComponentsDisplay: mainComponents.length > 0
            ? mainComponents.map(c => c.charAt(0).toUpperCase() + c.slice(1)).join(', ')
            : 'Equilibrado' // Default if no clear focus
    };

    console.log("calculateTrainingComponentScores: Final Scores:", finalResult);
    return finalResult;
}


/**
 * Calculates approximate weekly volume (total sets) per muscle group from routine HTML.
 * Parses HTML for exercise blocks and set/rep information.
 *
 * @param {string} routineHtml - The HTML content of the generated routine.
 * @returns {object} An object with muscle groups (e.g., 'Pecho', 'Espalda') as keys
 * and the estimated total weekly sets as integer values. Returns an empty
 * object if no volume can be determined.
 */
function calculateWeeklyVolume(routineHtml) {
    console.log("calculateWeeklyVolume: Starting volume calculation...");

    // Initialize volume counts for major muscle groups
    const volume = {
        Pecho: 0, Espalda: 0, Hombro: 0,
        Biceps: 0, Triceps: 0, Pierna: 0, // Pierna includes Quads, Hams, Calves
        Gluteo: 0, Abdomen: 0, Cardio: 0, Otro: 0 // Otro for unclassified exercises
    };

    // Return empty object if no valid HTML is provided
    if (!routineHtml || typeof routineHtml !== 'string' || routineHtml.trim() === '') {
        console.warn("calculateWeeklyVolume: No valid routine HTML provided. Returning empty volume data.");
        return {};
    }

    // --- Configuration: Muscle Group Keywords ---
    // Keywords to identify exercises targeting specific muscle groups.
    // Order matters slightly for compound exercises hitting multiple groups (first match wins).
    // Consider refining this logic if more nuanced compound exercise handling is needed.
    const muscleGroupKeywords = {
        Pecho: ['pecho', 'chest', 'press de banca', 'bench press', 'aperturas', 'flyes', 'flexiones', 'push-up', 'pectoral'],
        Espalda: ['espalda', 'back', 'remo', 'row', 'dominadas', 'pull-up', 'chin-up', 'pulldown', 'peso muerto', 'deadlift', 'dorsal', 'trapecio', 'lats'], // Deadlift also here
        Hombro: ['hombro', 'shoulder', 'press militar', 'overhead press', 'ohp', 'elevaciones laterales', 'lateral raise', 'elevaciones frontales', 'front raise', 'pájaros', 'rear delt fly', 'deltoides'],
        Triceps: ['triceps', 'tríceps', 'extensiones de triceps', 'tricep extension', 'fondos', 'dips', 'press francés', 'french press', 'skullcrusher'], // Dips often hit chest too, but primarily Triceps here
        Biceps: ['biceps', 'bíceps', 'curl'],
        Gluteo: ['glúteo', 'glute', 'hip thrust', 'puente de glúteo', 'glute bridge', 'patada de glúteo', 'kickback', 'abducción'],
        Pierna: ['pierna', 'leg', 'cuádriceps', 'quadriceps', 'femoral', 'hamstring', 'gemelo', 'calf', 'sentadilla', 'squat', 'prensa', 'leg press', 'zancadas', 'lunges', 'leg curl', 'leg extension', 'adductor', 'aducción'], // Squat also here
        Abdomen: ['abdomen', 'abdominales', 'abs', 'core', 'plancha', 'plank', 'crunches', 'elevaciones de piernas', 'leg raise', 'oblicuos', 'russian twist'],
        Cardio: ['cardio', 'correr', 'run', 'bicicleta', 'bike', 'cinta', 'treadmill', 'eliptica', 'elliptical', 'nadar', 'swim', 'remar', 'rowing', 'hiit', 'intervalos', 'burpee', 'jumping jack', 'assault bike', 'stairmaster'] // Moved Burpees/Jacks here
        // Note: 'Otro' is used if no keywords match.
    };

    // --- Regex Definitions ---
    // Regex to find potential exercise blocks within common list/table/paragraph tags
    const exerciseBlockRegex = /<(li|tr|p|div)\b[^>]*>([\s\S]*?)<\/\1>/gi;
    // Regex to find "Sets x Reps" patterns (e.g., "3x10", "4 x 8-12 reps", "5 sets x 5 repeticiones")
    const setRepRegex = /(\d+)\s*(?:sets?|series?|x)\s*(\d+(?:-\d+)?)\s*(?:reps?|repeticiones?)?/i;
    // Simpler "Sets x Reps" without explicit "sets/reps" words (e.g., "3 x 10")
    const simpleSetRepRegex = /(\d+)\s*x\s*(\d+(?:-\d+)?)/i;
     // Regex to identify time-based activities (often Cardio), capturing duration and unit
    const timeBasedRegex = /(\d+)\s*(min|seg|sec|hora|hour|h)\b/i;

    // --- Calculation ---
    let match;
    let blocksFound = 0;
    let potentialExercises = [];

    // 1. Extract potential exercise blocks and their content
    while ((match = exerciseBlockRegex.exec(routineHtml)) !== null) {
        blocksFound++;
        // Basic cleaning: remove excessive whitespace and HTML tags within the block
        const blockContent = match[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        if (blockContent) {
            potentialExercises.push(blockContent);
        }
    }
    console.log(`calculateWeeklyVolume: Found ${blocksFound} potential blocks, ${potentialExercises.length} with content.`);

    // 2. Process each block to find sets and assign to muscle groups
    potentialExercises.forEach((blockContent, index) => {
        let sets = 0;
        let isCardioSession = false;
        let durationMinutes = 0; // Track duration for cardio

        // Try to extract Sets x Reps
        let setRepMatch = blockContent.match(setRepRegex) || blockContent.match(simpleSetRepRegex);
        if (setRepMatch && setRepMatch.length >= 2) {
            sets = parseInt(setRepMatch[1], 10) || 0;
        }

        // Check for time-based exercise (likely cardio)
        let timeMatch = blockContent.match(timeBasedRegex);
        if (timeMatch && timeMatch.length >= 3) {
            isCardioSession = true;
            const duration = parseInt(timeMatch[1], 10);
            const unit = timeMatch[2].toLowerCase();
            if (!isNaN(duration)) {
                if (unit.startsWith('min')) durationMinutes = duration;
                else if (unit.startsWith('seg') || unit.startsWith('sec')) durationMinutes = duration / 60;
                else if (unit.startsWith('h')) durationMinutes = duration * 60;
            }
            // If no sets were found via Sets x Reps, count time-based as 1 "set" or session
            if (sets === 0) {
                sets = 1;
            }
             // If sets *were* found (e.g., HIIT intervals like 8x30s), keep the extracted sets count.
        }

        // If sets were identified (either numeric or time-based default)
        if (sets > 0) {
            let assigned = false;
            // Iterate through muscle groups to find matching keywords
            for (const group in muscleGroupKeywords) {
                for (const keyword of muscleGroupKeywords[group]) {
                    try {
                        const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
                        if (regex.test(blockContent)) {
                            // Prioritize assigning to Cardio if it's a cardio keyword OR a time-based session was detected
                            const targetGroup = (group === 'Cardio' || isCardioSession) ? 'Cardio' : group;
                            volume[targetGroup] += sets;
                            assigned = true;
                            // console.log(`[Volume Debug] Block ${index}: Keyword '${keyword}'. Assigning ${sets} sets to group: ${targetGroup}`);
                            break; // Assign to the first matching group found for this block
                        }
                    } catch (e) {
                        console.warn(`calculateWeeklyVolume: Invalid regex for volume keyword '${keyword}'.`, e);
                    }
                }
                if (assigned) break; // Move to next block once assigned
            }

            // If no keyword matched, but sets were found, assign to 'Otro' (unless it was clearly cardio)
            if (!assigned && !isCardioSession) {
                volume.Otro += sets;
                // console.log(`[Volume Debug] Block ${index}: No specific keyword found (not time-based). Assigning ${sets} sets to group: Otro`);
            }
        } else {
             // console.log(`[Volume Debug] Block ${index}: No sets or time found.`);
        }
    });

    // Fallback: Simple count for overall cardio mentions if volume.Cardio is still 0
    // This is a rough estimate and might not be accurate.
    if (volume.Cardio === 0) {
        let cardioMentions = 0;
        muscleGroupKeywords.Cardio.forEach(keyword => {
            try {
                const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
                const matches = routineHtml.match(regex) || [];
                cardioMentions += matches.length;
            } catch (e) { /* ignore regex errors */ }
        });
        if (cardioMentions > 0) {
            // Estimate roughly 1 "set" per 3 mentions as a very basic fallback
            volume.Cardio = Math.max(1, Math.round(cardioMentions / 3));
            console.log(`calculateWeeklyVolume: Fallback - Estimated ${volume.Cardio} Cardio sets based on ${cardioMentions} mentions.`);
        }
    }

    console.log("calculateWeeklyVolume: Raw Volume Counts:", JSON.stringify(volume));

    // Filter out muscle groups with zero sets for cleaner chart display
    const filteredVolume = {};
    for (const group in volume) {
        if (volume[group] > 0) {
            filteredVolume[group] = volume[group];
        }
    }

    console.log("calculateWeeklyVolume: Final Filtered Volume:", JSON.stringify(filteredVolume));
    return filteredVolume;
}


/**
 * Generates the HTML structure for the cover page, including placeholders for charts.
 *
 * @param {object} scores - The calculated training component scores object from calculateTrainingComponentScores.
 * @param {string} [clientName='Cliente'] - The name of the client.
 * @returns {string} HTML string for the cover page.
 */
function generateCoverPageHtml(scores, clientName = 'Cliente') {
    // Format the current date in Spanish
    const date = new Date().toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    // Generate a dynamic description based on the main training components identified
    let description = `¡Hola ${clientName}! Aquí tienes un resumen visual de tu nuevo plan de entrenamiento. `;
    if (scores.mainComponents && scores.mainComponents.length > 0) {
        description += `Nos enfocaremos principalmente en **${scores.mainComponentsDisplay}** para ayudarte a alcanzar tus metas. Los gráficos a continuación detallan la distribución del enfoque y el volumen semanal estimado por grupo muscular. ¡A darle con todo!`;
    } else {
        description += `Este plan está diseñado para ofrecerte un desarrollo equilibrado en todas las áreas clave. Los gráficos muestran la distribución del enfoque y el volumen semanal estimado. ¡Disfruta del proceso!`;
    }

    // HTML structure using BEM-like class names for clarity
    return `
    <div class="CoverPage">
      <div class="CoverPage-header">
        <img class="CoverPage-logo" src="LOGO_BASE_64_PLACEHOLDER" alt="Logo Fitform" onerror="this.style.display='none'">
        <div class="CoverPage-clientInfo">
          <h1 class="CoverPage-clientName">${clientName}</h1>
          <p class="CoverPage-date">${date}</p>
        </div>
      </div>

      <div class="CoverPage-main">
        <div class="CoverPage-textContent">
          <h2 class="CoverPage-title">Tu Hoja de Ruta Fitness</h2>
          <p class="CoverPage-description">${description}</p>
          <div class="CoverPage-legend">
            <h3 class="CoverPage-legendTitle">Enfoque del Entrenamiento (%)</h3>
            <div class="LegendGrid">
              <div class="LegendItem">
                  <div class="LegendItem-dot LegendItem-dot--fuerza"></div>
                  <div class="LegendItem-label">Fuerza: <span class="LegendItem-value">${scores.fuerza}%</span></div>
              </div>
              <div class="LegendItem">
                  <div class="LegendItem-dot LegendItem-dot--potencia"></div>
                  <div class="LegendItem-label">Potencia: <span class="LegendItem-value">${scores.potencia}%</span></div>
              </div>
              <div class="LegendItem">
                  <div class="LegendItem-dot LegendItem-dot--hipertrofia"></div>
                  <div class="LegendItem-label">Hipertrofia: <span class="LegendItem-value">${scores.hipertrofia}%</span></div>
              </div>
               <div class="LegendItem">
                  <div class="LegendItem-dot LegendItem-dot--tecnica"></div>
                  <div class="LegendItem-label">Técnica: <span class="LegendItem-value">${scores.tecnica}%</span></div>
              </div>
              <div class="LegendItem">
                  <div class="LegendItem-dot LegendItem-dot--movilidad"></div>
                  <div class="LegendItem-label">Movilidad: <span class="LegendItem-value">${scores.movilidad}%</span></div>
              </div>
              <div class="LegendItem">
                  <div class="LegendItem-dot LegendItem-dot--cardio"></div>
                  <div class="LegendItem-label">Cardio: <span class="LegendItem-value">${scores.cardio}%</span></div>
              </div>
            </div>
          </div>
        </div>

        <div class="CoverPage-visualsContent">
          <div class="ChartContainer ChartContainer--radar">
            <h3 class="ChartContainer-title">Distribución del Enfoque</h3>
            <canvas id="radarChart"></canvas>
          </div>
          <div class="ChartContainer ChartContainer--volume">
            <h3 class="ChartContainer-title">Volumen Semanal Estimado (Series)</h3>
            <canvas id="volumeLineChart"></canvas>
          </div>
        </div>
      </div>

      <div class="CoverPage-footer">
          <p>© ${new Date().getFullYear()} Fitform - Todos los derechos reservados</p>
      </div>
    </div>
    `;
}


/**
 * Generates the CSS styles required for the cover page layout and charts.
 * Uses CSS variables for theming and consistency.
 *
 * @returns {string} CSS style rules as a string.
 */
function getCoverPageStyles() {
    // Using CSS variables for easier theme management and consistency
    return `
    /* --- Cover Page Styles (Improved) --- */
    :root {
        /* Color Palette */
        --color-primary: #2c3e50;       /* Dark Blue-Gray */
        --color-secondary: #34495e;    /* Lighter Blue-Gray */
        --color-accent: #3498db;       /* Bright Blue */
        --color-background-start: #e0f2f7; /* Light Sky Blue */
        --color-background-end: #b3e0f2;   /* Medium Sky Blue */
        --color-text-light: #ffffff;
        --color-text-dark: #2c3e50;
        --color-text-medium: #555;
        --color-text-muted: #95a5a6;    /* Light gray */
        --color-border-light: rgba(0, 0, 0, 0.1);
        --color-border-medium: #bdc3c7;
        --color-background-subtle: rgba(0, 0, 0, 0.04); /* Subtle dark accent on light bg */
        --color-chart-background: #ffffff;

        /* Component Colors (for legend and potentially charts) */
        --color-fuerza: #3498db;       /* Blue */
        --color-hipertrofia: #2ecc71;  /* Green */
        --color-movilidad: #f1c40f;    /* Yellow */
        --color-potencia: #e74c3c;     /* Red */
        --color-tecnica: #9b59b6;      /* Purple */
        --color-cardio: #e67e22;       /* Orange */

        /* Layout & Typography */
        --font-family-main: 'Inter', 'Arial', sans-serif;
        --border-radius-standard: 8px;
        --border-radius-large: 12px;
        --shadow-light: 0 4px 15px rgba(0, 0, 0, 0.05);
        --shadow-medium: 0 6px 20px rgba(0, 0, 0, 0.08);
        --padding-standard: 20px;
        --padding-large: 30px;
        --cover-padding-v: 40px;
        --cover-padding-h: 50px;
    }

    /* Ensure body margin is zero for PDF generation */
    body {
        margin: 0;
        font-family: var(--font-family-main);
        -webkit-print-color-adjust: exact; /* Preserve background colors in print/PDF */
        print-color-adjust: exact;
    }

    /* Main Cover Page Container */
    .CoverPage {
        position: relative; /* For footer positioning */
        display: flex;
        flex-direction: column;
        min-height: 100vh; /* Use min-height for flexibility */
        height: 100vh; /* Explicit height for single-page constraint */
        width: 100%;
        background: linear-gradient(145deg, var(--color-background-start) 0%, var(--color-background-end) 100%);
        color: var(--color-text-dark);
        box-sizing: border-box; /* Include padding in width/height */
        page-break-after: always; /* Ensure it takes a full page in print */
        overflow: hidden; /* Prevent content spill */
        padding: var(--cover-padding-v) var(--cover-padding-h);
    }

    /* Header Section */
    .CoverPage-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding-bottom: var(--padding-standard);
        margin-bottom: var(--padding-large);
        border-bottom: 1px solid var(--color-border-light);
        flex-shrink: 0; /* Prevent header from shrinking */
    }

    .CoverPage-logo {
        width: 110px; /* Maintain size */
        height: auto;
        opacity: 0.9;
        object-fit: contain; /* Ensure logo aspect ratio is maintained */
    }

    .CoverPage-clientInfo {
        text-align: right;
    }

    .CoverPage-clientName {
        font-size: 1.6rem; /* Relative units are often better */
        font-weight: 700;
        color: var(--color-primary);
        margin: 0 0 5px 0;
        line-height: 1.2;
    }

    .CoverPage-date {
        margin: 0;
        color: var(--color-text-medium);
        font-size: 0.9rem;
        font-weight: 400;
    }

    /* Main Content Area */
    .CoverPage-main {
        flex-grow: 1; /* Allow main content to fill available space */
        display: flex;
        flex-direction: column; /* Stack text and visuals vertically */
        gap: var(--padding-large);
        width: 100%;
        margin-bottom: var(--padding-standard); /* Space before footer */
        overflow: hidden; /* Prevent main content overflow */
    }

    /* Text Content Section (Title, Description, Legend) */
    .CoverPage-textContent {
       /* Takes available width */
       flex-shrink: 0; /* Prevent text content from shrinking */
    }

    .CoverPage-title {
        font-size: 1.5rem;
        font-weight: 700;
        color: var(--color-primary);
        margin: 0 0 15px 0;
        line-height: 1.3;
        position: relative;
        display: inline-block; /* Allows underline to fit content */
        padding-bottom: 8px;
    }
    /* Underline effect for the title */
    .CoverPage-title::after {
        content: '';
        position: absolute;
        bottom: 0;
        left: 0;
        width: 50px;
        height: 3px;
        background-color: var(--color-accent);
        border-radius: 3px;
    }

    .CoverPage-description {
        font-size: 0.95rem;
        color: var(--color-secondary);
        line-height: 1.6;
        margin: 0 0 var(--padding-large) 0; /* Use margin-bottom only */
        font-weight: 400;
        max-width: 100%;
    }
    .CoverPage-description strong {
        color: var(--color-primary);
        font-weight: 600;
    }

    /* Legend Section */
    .CoverPage-legend {
        background-color: var(--color-background-subtle);
        padding: var(--padding-standard);
        border-radius: var(--border-radius-standard);
        border: 1px solid var(--color-border-light);
    }
    .CoverPage-legendTitle {
        font-size: 1rem;
        font-weight: 600;
        color: var(--color-primary);
        margin: 0 0 15px 0;
        text-align: left;
    }

    /* Grid for Legend Items */
    .LegendGrid {
        display: grid;
        /* Responsive columns: fit as many as possible with min width 180px */
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 10px 20px; /* Row gap, Column gap */
    }
    .LegendItem {
        display: flex;
        align-items: center;
        gap: 8px;
    }
    .LegendItem-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        flex-shrink: 0;
        border: 1px solid rgba(0, 0, 0, 0.3); /* Darker border for visibility */
    }
    /* Applying component colors to dots */
    .LegendItem-dot--fuerza { background-color: var(--color-fuerza); }
    .LegendItem-dot--hipertrofia { background-color: var(--color-hipertrofia); }
    .LegendItem-dot--movilidad { background-color: var(--color-movilidad); }
    .LegendItem-dot--potencia { background-color: var(--color-potencia); }
    .LegendItem-dot--tecnica { background-color: var(--color-tecnica); }
    .LegendItem-dot--cardio { background-color: var(--color-cardio); }

    .LegendItem-label {
        font-size: 0.85rem;
        font-weight: 500;
        color: var(--color-secondary);
    }
    .LegendItem-value {
        font-weight: 700;
        color: var(--color-primary);
        margin-left: 4px;
    }

    /* Visuals Content Section (Charts) */
    .CoverPage-visualsContent {
        display: flex;
        flex-wrap: wrap; /* Allow charts to wrap on smaller views if needed */
        gap: var(--padding-large);
        width: 100%;
        align-items: stretch; /* Make containers same height if they wrap */
        flex-grow: 1; /* Allow this section to grow */
        min-height: 0; /* Prevent flexbox overflow issues */
    }

    /* Individual Chart Container Styling */
    .ChartContainer {
        flex: 1 1 300px; /* Grow, shrink, base width 300px */
        background-color: var(--color-chart-background);
        border-radius: var(--border-radius-large);
        padding: var(--padding-standard);
        box-shadow: var(--shadow-medium);
        border: 1px solid var(--color-border-medium);
        display: flex;
        flex-direction: column;
        min-width: 0; /* Prevent flex item overflow */
        /* Define a flexible height, max-height might be too restrictive */
         min-height: 300px; /* Minimum height for charts */
         max-height: 40vh; /* Limit height relative to viewport */
    }

    .ChartContainer-title {
        font-size: 0.9rem;
        font-weight: 600;
        color: var(--color-text-dark);
        margin: 0 0 15px 0;
        text-align: center;
        flex-shrink: 0; /* Prevent title from shrinking */
    }

    /* Canvas element styling */
    .ChartContainer canvas {
        max-width: 100%;
        flex-grow: 1; /* Allow canvas to fill container space */
        min-height: 0; /* Prevent flexbox overflow issues with canvas */
        display: block; /* Remove extra space below canvas */
    }

    /* Footer Section */
    .CoverPage-footer {
        width: 100%;
        text-align: center;
        padding-top: var(--padding-standard);
        margin-top: auto; /* Pushes footer to the bottom */
        border-top: 1px solid var(--color-border-light);
        font-size: 0.75rem;
        color: var(--color-text-muted);
        flex-shrink: 0; /* Prevent footer from shrinking */
    }
    `;
}


/**
 * Generates the Chart.js initialization script for the radar chart (Training Focus).
 *
 * @param {object} scores - The calculated training component scores object.
 * @returns {string} JavaScript code string to initialize the radar chart.
 */
function getRadarChartScript(scores) {
    // Prepare data and labels for the chart
    const chartData = [
        scores.fuerza, scores.hipertrofia, scores.movilidad,
        scores.potencia, scores.tecnica, scores.cardio
    ];
    const labels = ['Fuerza', 'Hipertrofia', 'Movilidad', 'Potencia', 'Técnica', 'Cardio'];

    // Chart.js v3 initialization script
    return `
    <script>
      /**
       * Initializes the Radar Chart for Training Focus.
       */
      function initRadarChart() {
        const canvasElement = document.getElementById('radarChart');
        if (!canvasElement) {
          console.error("initRadarChart: Canvas element #radarChart not found.");
          return;
        }
        const ctx = canvasElement.getContext('2d');
        if (!ctx) {
            console.error("initRadarChart: Failed to get 2D context from radar canvas.");
            return;
        }

        // Ensure previous chart instance is destroyed if re-initializing
        if (window.myRadarChart instanceof Chart) {
            window.myRadarChart.destroy();
        }

        try {
            window.myRadarChart = new Chart(ctx, {
                type: 'radar',
                data: {
                    labels: ${JSON.stringify(labels)},
                    datasets: [{
                        label: 'Enfoque (%)', // Legend label (though legend is hidden)
                        data: ${JSON.stringify(chartData)},
                        backgroundColor: 'rgba(44, 62, 80, 0.3)',  // Use primary color with alpha
                        borderColor: 'rgba(44, 62, 80, 0.9)',    // Use primary color darker
                        borderWidth: 2,
                        pointBackgroundColor: 'rgba(44, 62, 80, 1)',
                        pointBorderColor: '#fff', // White border for points
                        pointHoverBackgroundColor: '#fff',
                        pointHoverBorderColor: 'rgba(44, 62, 80, 1)',
                        pointRadius: 3.5,
                        pointHoverRadius: 5.5
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false, // Allow chart to fill container
                    scales: {
                        r: { // Radial axis (values)
                            angleLines: { display: true, color: 'rgba(0, 0, 0, 0.1)' }, // Lines from center to labels
                            suggestedMin: 0,
                            suggestedMax: 100, // Or calculate based on max data? 100 is good for percentage.
                            grid: { color: 'rgba(0, 0, 0, 0.1)' }, // Concentric grid lines
                            ticks: {
                                stepSize: 20, // Steps on the radial axis
                                color: 'rgba(0, 0, 0, 0.6)', // Tick label color
                                backdropColor: 'rgba(255, 255, 255, 0.75)', // Semi-transparent background for ticks
                                padding: 8,
                                font: { size: 10 }
                            },
                            pointLabels: { // Labels around the edge (Fuerza, Hipertrofia, etc.)
                                font: { size: 12, weight: '500' },
                                color: 'rgba(0, 0, 0, 0.85)' // Color of edge labels
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            display: false // Hide the default legend box
                        },
                        tooltip: {
                            enabled: true,
                            backgroundColor: 'rgba(0, 0, 0, 0.85)', // Dark tooltip background
                            titleFont: { size: 13, weight: 'bold' },
                            bodyFont: { size: 12 },
                            padding: 10,
                            boxPadding: 4, // Padding inside the tooltip box
                            cornerRadius: 4,
                            callbacks: {
                                // Custom tooltip label format
                                label: function(context) {
                                    let label = context.dataset.label || '';
                                    if (label) { label += ': '; }
                                    if (context.parsed.r !== null) {
                                        label += context.parsed.r.toFixed(0) + '%'; // Show percentage
                                    }
                                    return label;
                                }
                            }
                        }
                    }
                }
            });
        } catch (error) {
             console.error("initRadarChart: Error initializing Radar Chart:", error);
        }
      }

      // Initialize chart safely after DOM is loaded
      if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', initRadarChart);
      } else {
          // DOM is already loaded, initialize directly (or with a minimal timeout if needed)
          // setTimeout(initRadarChart, 0); // Use timeout 0 for yielding execution
          initRadarChart(); // Direct call usually works if DOM is ready
      }
    </script>
    `;
}

/**
 * Generates the Chart.js initialization script for the line chart (Weekly Volume).
 * Includes handling for cases where no volume data is available.
 *
 * @param {object} volumeData - The calculated weekly volume data { MuscleGroup: sets }.
 * @returns {string} JavaScript code string to initialize the line chart.
 */
function getVolumeLineChartScript(volumeData) {
    // Prepare labels (Muscle Groups) and data (Sets) for the chart
    const labels = Object.keys(volumeData || {});
    const data = Object.values(volumeData || {});

    // Determine if data is available for charting
    const hasData = labels.length > 0 && data.length > 0 && data.some(d => d > 0);

    // Define colors for the line chart (using CSS variables is also an option if JS can access them)
    const lineChartColors = {
        backgroundColor: 'rgba(52, 152, 219, 0.2)', // Light blue area fill (Accent color)
        borderColor: 'rgba(52, 152, 219, 1)',     // Solid blue line (Accent color)
        pointBackgroundColor: 'rgba(52, 152, 219, 1)',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: 'rgba(52, 152, 219, 1)',
    };

    return `
    <script>
      /**
       * Initializes the Line Chart for Estimated Weekly Volume.
       */
      function initVolumeLineChart() {
        const canvasElement = document.getElementById('volumeLineChart');
        if (!canvasElement) {
          console.error("initVolumeLineChart: Canvas element #volumeLineChart not found.");
          return;
        }
        const ctx = canvasElement.getContext('2d');
         if (!ctx) {
            console.error("initVolumeLineChart: Failed to get 2D context from volume canvas.");
            return;
        }

        // Ensure previous chart instance is destroyed if re-initializing
        if (window.myVolumeChart instanceof Chart) {
            window.myVolumeChart.destroy();
        }

        const hasVolumeData = ${hasData}; // Pass boolean from server-side check

        if (!hasVolumeData) {
            // Display a message directly on the canvas if no data
            ctx.clearRect(0, 0, canvasElement.width, canvasElement.height); // Clear previous drawings
            ctx.font = "16px 'Inter', sans-serif";
            ctx.fillStyle = '#888'; // Muted color for message
            ctx.textAlign = 'center';
            ctx.fillText("No se pudo calcular el volumen.", canvasElement.width / 2, canvasElement.height / 2);
            console.warn("initVolumeLineChart: No volume data to display.");
            return; // Stop chart initialization
        }

        // Proceed with chart initialization if data exists
        try {
            window.myVolumeChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: ${JSON.stringify(labels)}, // Muscle groups
                    datasets: [{
                        label: 'Series Semanales', // Legend label
                        data: ${JSON.stringify(data)}, // Set counts
                        fill: true, // Fill area under the line
                        backgroundColor: '${lineChartColors.backgroundColor}',
                        borderColor: '${lineChartColors.borderColor}',
                        borderWidth: 2.5,
                        pointBackgroundColor: '${lineChartColors.pointBackgroundColor}',
                        pointBorderColor: '${lineChartColors.pointBorderColor}',
                        pointHoverBackgroundColor: '${lineChartColors.pointHoverBackgroundColor}',
                        pointHoverBorderColor: '${lineChartColors.pointHoverBorderColor}',
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        tension: 0.1 // Slight curve to the line
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false, // Allow chart to fill container
                    scales: {
                        y: { // Vertical axis (Number of Sets)
                            beginAtZero: true, // Start axis at 0
                            title: {
                                display: true,
                                text: 'Número de Series',
                                font: { size: 12 },
                                color: '#666'
                            },
                            ticks: {
                                color: 'rgba(0, 0, 0, 0.7)',
                                precision: 0 // Show whole numbers for sets
                            },
                             grid: {
                                color: 'rgba(0, 0, 0, 0.08)' // Light grid lines
                            }
                        },
                        x: { // Horizontal axis (Muscle Groups)
                             ticks: {
                                color: 'rgba(0, 0, 0, 0.7)',
                                font: { size: 11 }
                            },
                             grid: {
                                display: false // Hide vertical grid lines
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            display: true, // Show legend
                            position: 'bottom', // Position below chart
                            labels: {
                                font: { size: 12 },
                                color: 'rgba(0, 0, 0, 0.8)'
                            }
                        },
                        tooltip: {
                            enabled: true,
                            backgroundColor: 'rgba(0, 0, 0, 0.85)',
                            titleFont: { size: 13, weight: 'bold' },
                            bodyFont: { size: 12 },
                            padding: 10,
                            boxPadding: 4,
                            cornerRadius: 4,
                             callbacks: {
                                // Custom tooltip label format
                                label: function(context) {
                                    let label = context.dataset.label || '';
                                    if (label) { label += ': '; }
                                    if (context.parsed.y !== null) {
                                        label += context.parsed.y + ' series'; // Append 'series' unit
                                    }
                                    return label;
                                }
                            }
                        }
                    }
                }
            });
        } catch (error) {
             console.error("initVolumeLineChart: Error initializing Volume Line Chart:", error);
        }
      }

      // Initialize chart safely after DOM is loaded
      if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', initVolumeLineChart);
      } else {
          // DOM is already loaded
          // setTimeout(initVolumeLineChart, 0);
           initVolumeLineChart();
      }
    </script>
    `;
}


/**
 * Creates the complete cover page package including HTML, CSS, and JS.
 * Orchestrates calls to calculate scores, volume, and generate page components.
 *
 * @param {string} routineHtml - The HTML content of the routine.
 * @param {string} clientName - The client's name.
 * @param {string} logoBase64 - Base64 encoded logo image data URI (e.g., "data:image/png;base64,...").
 * If null or invalid, the logo element will be omitted.
 * @returns {object} An object containing:
 * - fullCoverPageHtml: string - The complete HTML for the cover page.
 * - styles: string - The CSS styles.
 * - script: string - The combined JavaScript for charts (including Chart.js CDN link).
 * - scores: object - The calculated training component scores.
 * - volumeData: object - The calculated weekly volume data.
 */
function createCoverPage(routineHtml, clientName, logoBase64) {
    // 1. Calculate component scores from routine HTML
    const scores = calculateTrainingComponentScores(routineHtml);

    // 2. Calculate weekly volume from routine HTML
    const volumeData = calculateWeeklyVolume(routineHtml); // Returns filtered data

    // 3. Generate base cover page HTML structure
    let coverPageHtml = generateCoverPageHtml(scores, clientName);

    // 4. Handle logo placeholder replacement or removal
    const logoPlaceholder = 'LOGO_BASE_64_PLACEHOLDER';
    if (logoBase64 && typeof logoBase64 === 'string' && logoBase64.startsWith('data:image')) {
        coverPageHtml = coverPageHtml.replace(logoPlaceholder, logoBase64);
    } else {
        // Remove the entire <img> tag if the logo is invalid or not provided
        coverPageHtml = coverPageHtml.replace(/<img class="CoverPage-logo".*?>/g, '');
        if (logoBase64) { // Only warn if a value was provided but was invalid
             console.warn("createCoverPage: Invalid logoBase64 format provided. Logo element removed.");
        }
    }

    // 5. Get CSS styles
    const styles = getCoverPageStyles();

    // 6. Get Chart.js initialization scripts for both charts
    const radarScript = getRadarChartScript(scores);
    const volumeScript = getVolumeLineChartScript(volumeData);

    // 7. Combine scripts: Include Chart.js library via CDN, then initialization scripts
    // Ensure Chart.js library is loaded *before* the scripts that use it.
    const combinedScript = `
        <script src="https://cdn.jsdelivr.net/npm/chart.js@3.9.1/dist/chart.min.js" integrity="sha256-QodMnCTM3x8S7TTscA9L32pI6PA+wBMiPjCLYVGQcFI=" crossorigin="anonymous"></script>
        ${radarScript}
        ${volumeScript}
    `;

    // 8. Assemble the final result object
    return {
        fullCoverPageHtml: coverPageHtml,
        styles: styles,
        script: combinedScript,
        scores: scores, // Return calculated scores
        volumeData: volumeData // Return calculated volume data
    };
}

// Export the main function and potentially helpers if needed externally
module.exports = {
    calculateTrainingComponentScores,
    calculateWeeklyVolume,
    createCoverPage,
    // Potentially export generators if needed separately, though usually createCoverPage is the main entry point
    // generateCoverPageHtml,
    // getCoverPageStyles,
    // getRadarChartScript,
    // getVolumeLineChartScript
};
