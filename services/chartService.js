// chartService.js (Corregido para apilar gráficos verticalmente)

/**
 * Calculates training component scores based on keywords and heuristics in routine HTML.
 * @param {string} routineHtml - The HTML content of the generated routine.
 * @returns {Object} - Scores for each training component (0-100) and main components.
 */
function calculateTrainingComponentScores(routineHtml) {
    // Initialize scores
    const scores = {
        fuerza: 0,
        hipertrofia: 0,
        movilidad: 0,
        potencia: 0,
        tecnica: 0,
        cardio: 0
    };

    // Default balanced profile if no HTML is provided
    if (!routineHtml || routineHtml.trim() === '') {
        console.warn("No routine HTML provided, returning default balanced scores.");
        return {
            fuerza: 50, hipertrofia: 50, movilidad: 50,
            potencia: 50, tecnica: 50, cardio: 50,
            mainComponents: [], mainComponentsDisplay: 'Equilibrado'
        };
    }

    // Keywords for each training component
    const keywords = {
        fuerza: ['fuerza', 'strength', 'carga', 'peso', 'resistencia', 'weight', 'sentadilla', 'squat', 'press', 'deadlift', 'peso muerto', 'power', 'potencia', 'rm', '1rm', 'máxima', 'maximales', 'intensidad alta', 'pesado', 'heavy'],
        hipertrofia: ['hipertrofia', 'hypertrophy', 'volumen', 'volume', 'muscle', 'músculo', 'muscular', 'growth', 'crecimiento', 'tamaño', 'size', 'bodybuilding', 'culturismo', 'series', 'repeticiones', 'reps', 'rir'],
        movilidad: ['movilidad', 'mobility', 'flexibility', 'flexibilidad', 'stretching', 'estiramiento', 'range', 'motion', 'rango', 'articular', 'joint', 'rom', 'elasticidad', 'elongación', 'estirar', 'stretch', 'yoga', 'pilates'],
        potencia: ['potencia', 'power', 'explosiv', 'explosi[oó]n', 'velocidad', 'speed', 'fast', 'rápido', 'salto', 'jump', 'plyometric', 'pliometría', 'reactiv', 'sprint', 'lanzamiento', 'throw', 'tiempo', 'time', 'tempo.*[xX]', 'kettlebell swing'],
        tecnica: ['técnica', 'technique', 'form', 'forma', 'skill', 'habilidad', 'balance', 'equilibrio', 'coordination', 'coordinación', 'control', 'pattern', 'patrón', 'motor', 'stability', 'estabilidad', 'aprendizaje', 'drills'],
        cardio: ['cardio', 'cardiovascular', 'aeróbico', 'aerobic', 'resistencia', 'endurance', 'stamina', 'interval', 'intervalos', 'hiit', 'heart', 'rate', 'ritmo', 'cardiac', 'cardíaco', 'vo2', 'máximo', 'correr', 'run', 'nadar', 'swim', 'bicicleta', 'bike', 'cinta', 'eliptica']
    };

    // Counts for keyword occurrences
    const counts = {
        fuerza: 0, hipertrofia: 0, movilidad: 0,
        potencia: 0, tecnica: 0, cardio: 0
    };

    // --- Keyword Analysis ---
    Object.keys(keywords).forEach(component => {
        keywords[component].forEach(keyword => {
            try {
                const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
                const matches = routineHtml.match(regex) || [];
                counts[component] += matches.length;
            } catch (e) {
                console.warn(`Invalid regex for keyword: ${keyword}`, e);
            }
        });
    });

    // --- Additional Heuristics ---

    // 1. Rep Range Analysis
    const setRepMatches = routineHtml.match(/(\d+)\s*x\s*(\d+(?:-\d+)?)\s*(?:reps|repeticiones|sets)?/gi) || [];
    let lowRepSets = 0;
    let midRepSets = 0;
    let highRepSets = 0;

    setRepMatches.forEach(match => {
        const numbers = match.match(/\d+/g);
        if (numbers && numbers.length >= 2) {
            const numSets = parseInt(numbers[0], 10);
            const repRange = numbers[1].split('-').map(Number);
            const maxReps = Math.max(...repRange);
            if (!isNaN(numSets)) {
                if (maxReps <= 6) lowRepSets += numSets;
                else if (maxReps <= 15) midRepSets += numSets;
                else highRepSets += numSets;
            }
        }
    });
    // Simple rep mentions
     const simpleRepMatches = routineHtml.match(/(\d+)\s+reps?/gi) || [];
     simpleRepMatches.forEach(match => {
         const repNumbers = match.match(/\d+/g);
         if (repNumbers) {
             const maxReps = Math.max(...repNumbers.map(Number));
             if (maxReps <= 6) lowRepSets += 0.5;
             else if (maxReps <= 15) midRepSets += 0.5;
             else highRepSets += 0.5;
         }
     });

    counts.fuerza += lowRepSets * 2;
    counts.hipertrofia += midRepSets * 1.5;
    counts.cardio += highRepSets * 1;

    // 2. Specific Exercise Keywords
    const specificExercises = {
        fuerza: ['press de banca', 'bench press', 'sentadilla', 'squat', 'peso muerto', 'deadlift', 'press militar', 'overhead press', 'remo con barra', 'barbell row'],
        hipertrofia: ['curl', 'elevaciones laterales', 'lateral raise', 'extensiones de triceps', 'tricep extension', 'remo con mancuernas', 'dumbbell row', 'aperturas', 'flyes', 'pulldown'],
        movilidad: ['rotaciones', 'mobility drills', 'estiramiento dinámico', 'dynamic stretch', 'foam roller', 'yoga', 'pilates'],
        potencia: ['salto al cajón', 'box jump', 'lanzamiento de balón', 'medicine ball throw', 'kettlebell swing', 'power clean', 'snatch', 'clean and jerk'],
        tecnica: ['pistol squat', 'turkish get up', 'handstand', 'equilibrio', 'coordinación', 'propiocepción', 'isométrico', 'isometric'],
        cardio: ['correr', 'running', 'burpee', 'jumping jack', 'ciclismo', 'natación', 'remo', 'rowing machine', 'assault bike']
    };
    Object.keys(specificExercises).forEach(component => {
        specificExercises[component].forEach(ex => {
            try {
                const regex = new RegExp(ex.replace(/\s+/g, '\\s+'), 'gi');
                const matches = routineHtml.match(regex) || [];
                counts[component] += matches.length * 2.5;
            } catch (e) {
                console.warn(`Invalid regex for exercise: ${ex}`, e);
            }
        });
    });

    // 3. Intensity/Tempo Indicators
    if (routineHtml.match(/RIR\s+[0-2]/gi)) { counts.fuerza += 3; counts.hipertrofia += 5; }
    if (routineHtml.match(/RIR\s+[3-4]/gi)) { counts.hipertrofia += 3; }
    if (routineHtml.match(/RPE\s+[8-9]/gi)) { counts.fuerza += 2; counts.hipertrofia += 4; }
    if (routineHtml.match(/RPE\s+[6-7]/gi)) { counts.hipertrofia += 2; }
    if (routineHtml.match(/tempo.*[xX]/gi)) { counts.potencia += 6; }
    if (routineHtml.match(/tempo\s+\d{4,}/gi)) { counts.tecnica += 3; counts.hipertrofia += 2; }
    if (routineHtml.match(/descanso\s+(corto|30s|45s|60s)/gi)) { counts.hipertrofia += 1; counts.cardio += 1; }
    if (routineHtml.match(/descanso\s+(largo|90s|120s|2-3\s*min)/gi)) { counts.fuerza += 2; }

    // --- Normalization ---
    const totalCount = Object.values(counts).reduce((sum, count) => sum + Math.max(0, count), 0);

    if (totalCount === 0) {
        console.warn("Total count for normalization is zero, returning default balanced scores.");
        return {
            fuerza: 50, hipertrofia: 50, movilidad: 50,
            potencia: 50, tecnica: 50, cardio: 50,
            mainComponents: [], mainComponentsDisplay: 'Equilibrado'
        };
    }

    Object.keys(counts).forEach(component => {
        scores[component] = Math.round((Math.max(0, counts[component]) / totalCount) * 100);
    });

    // --- Smoothing and Thresholding ---
    const minThreshold = 5;
    let totalScore = 0;
    Object.keys(scores).forEach(component => {
        if (counts[component] > 0 && scores[component] < minThreshold) {
            scores[component] = minThreshold;
        }
        scores[component] = Math.min(scores[component], 100);
        totalScore += scores[component];
    });

    // Re-normalize if needed
    if (totalScore > 0 && Math.abs(totalScore - 100) > 10) {
        const scaleFactor = 100 / totalScore;
        Object.keys(scores).forEach(component => {
            scores[component] = Math.round(scores[component] * scaleFactor);
            scores[component] = Math.max( (counts[component] > 0 ? minThreshold : 0) , Math.min(scores[component], 100));
        });
    }

     // Final adjustment
     let finalTotal = Object.values(scores).reduce((sum, score) => sum + score, 0);
     if (finalTotal !== 100 && finalTotal > 0) {
         let diff = 100 - finalTotal;
         let maxComp = Object.keys(scores).reduce((a, b) => scores[a] > scores[b] ? a : b);
         scores[maxComp] = Math.min(100, Math.max(0, scores[maxComp] + diff));
     }

    // --- Determine Main Components ---
    let maxScore = 0;
    let mainComponents = [];
    Object.entries(scores).forEach(([component, score]) => {
         if (score >= 25) { // Threshold for significant component
              if (score > maxScore) {
                  maxScore = score;
                  mainComponents = [component];
              } else if (score === maxScore && !mainComponents.includes(component)) { // Add ties
                  mainComponents.push(component);
              }
         }
    });
      // Ensure all components with max score are included if threshold wasn't met but max exists
      if (mainComponents.length === 0 && maxScore > 0) {
         Object.entries(scores).forEach(([component, score]) => {
              if (score === maxScore) {
                  mainComponents.push(component);
              }
         });
      }


    scores.mainComponents = mainComponents;
    scores.mainComponentsDisplay = mainComponents.length > 0
        ? mainComponents.map(c => c.charAt(0).toUpperCase() + c.slice(1)).join(', ')
        : 'Equilibrado';

    console.log("Calculated Scores:", scores);
    return scores;
}


/**
 * Calculates approximate weekly volume (total sets) per muscle group from routine HTML.
 * @param {string} routineHtml - The HTML content of the generated routine.
 * @returns {Object} - An object with muscle groups as keys and total weekly sets as values.
 */
function calculateWeeklyVolume(routineHtml) {
    console.log("[Volume Calculation] Starting..."); // DEBUG
    const volume = {
        Pecho: 0, Espalda: 0, Hombro: 0,
        Biceps: 0, Triceps: 0, Pierna: 0,
        Gluteo: 0, Abdomen: 0, Cardio: 0, Otro: 0
    };

    if (!routineHtml || routineHtml.trim() === '') {
        console.warn("[Volume Calculation] No routine HTML provided.");
        return {}; // Return empty object if no HTML
    }

    const muscleGroupKeywords = {
        Pecho: ['pecho', 'chest', 'press de banca', 'bench press', 'aperturas', 'flyes', 'flexiones', 'push-up'],
        Espalda: ['espalda', 'back', 'remo', 'row', 'dominadas', 'pull-up', 'chin-up', 'pulldown', 'peso muerto', 'deadlift', 'dorsal'],
        Hombro: ['hombro', 'shoulder', 'press militar', 'overhead press', 'elevaciones laterales', 'lateral raise', 'elevaciones frontales', 'front raise', 'pájaros', 'rear delt fly'],
        Biceps: ['biceps', 'bíceps', 'curl'],
        Triceps: ['triceps', 'tríceps', 'extensiones', 'extension', 'fondos', 'dips', 'press francés', 'french press'],
        Pierna: ['pierna', 'leg', 'cuádriceps', 'quadriceps', 'femoral', 'hamstring', 'gemelo', 'calf', 'sentadilla', 'squat', 'prensa', 'leg press', 'zancadas', 'lunges', 'leg curl', 'leg extension'],
        Gluteo: ['glúteo', 'glute', 'hip thrust', 'puente de glúteo', 'glute bridge', 'patada de glúteo', 'kickback'],
        Abdomen: ['abdomen', 'abdominales', 'abs', 'core', 'plancha', 'plank', 'crunches', 'elevaciones de piernas', 'leg raise'],
        Cardio: ['cardio', 'correr', 'run', 'bicicleta', 'bike', 'cinta', 'treadmill', 'eliptica', 'elliptical', 'nadar', 'swim', 'remar', 'rowing', 'hiit', 'intervalos']
    };

    // Regex to find exercise blocks (more robust)
    const exerciseBlockRegex = /<(li|tr|p|div)[^>]*>([\s\S]*?)<\/\1>/gi; // Added 'div'
    const setRepRegex = /(\d+)\s*(?:sets?|series?)\s*x\s*(\d+(?:-\d+)?)\s*(?:reps?|repeticiones?)?/i;
    const simpleSetRepRegex = /(\d+)\s*x\s*(\d+(?:-\d+)?)/i;
    const timeBasedRegex = /(\d+)\s*(?:min|seg|seconds?)/i;

    let match;
    let blocksFound = 0; // DEBUG
    while ((match = exerciseBlockRegex.exec(routineHtml)) !== null) {
        blocksFound++; // DEBUG
        const blockContent = match[2];
        let sets = 0;
        let isCardioSession = false;
        // DEBUG: Log the block being processed
        // console.log(`[Volume Debug] Processing Block ${blocksFound}: ${blockContent.substring(0, 150).replace(/\s+/g, ' ')}...`);

        // Try to find sets x reps patterns
        const setRepMatch = blockContent.match(setRepRegex) || blockContent.match(simpleSetRepRegex);
        if (setRepMatch && setRepMatch.length >= 2) {
            sets = parseInt(setRepMatch[1], 10) || 0;
            // DEBUG: Log extracted sets
            // console.log(`[Volume Debug] Found Set/Rep Match: ${setRepMatch[0]}, Extracted Sets: ${sets}`);
        }

        // Check for time-based exercises (likely cardio) only if no sets found yet
        if (sets === 0 && timeBasedRegex.test(blockContent)) {
           isCardioSession = true;
           sets = 1; // Count as one session/set
           // DEBUG: Log cardio session detection
           // console.log(`[Volume Debug] Detected Time-Based (Cardio?) Session.`);
        }


        if (sets > 0) {
            let assigned = false;
            for (const group in muscleGroupKeywords) {
                for (const keyword of muscleGroupKeywords[group]) {
                    try {
                        // Use word boundaries for keywords to avoid partial matches
                        const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
                        if (regex.test(blockContent)) {
                            // Assign to Cardio if it's a cardio keyword OR a time-based session
                            const targetGroup = (group === 'Cardio' || isCardioSession) ? 'Cardio' : group;
                            volume[targetGroup] += sets;
                            assigned = true;
                             // DEBUG: Log assignment
                            console.log(`[Volume Debug] Keyword '${keyword}' found. Assigning ${sets} sets to group: ${targetGroup}`);
                            break; // Assign to first matching group for this block
                        }
                    } catch (e) {
                        console.warn(`[Volume Calculation] Invalid regex for volume keyword: ${keyword}`, e);
                    }
                }
                if (assigned) break; // Move to next block once assigned
            }
            // Assign to 'Otro' only if it wasn't assigned and wasn't identified as a cardio session
            if (!assigned && !isCardioSession) {
                volume.Otro += sets;
                 // DEBUG: Log assignment to 'Otro'
                 console.log(`[Volume Debug] No specific keyword found (and not cardio session). Assigning ${sets} sets to group: Otro`);
            }
        } else {
             // DEBUG: Log blocks where no sets were found
             // console.log(`[Volume Debug] No sets found in Block ${blocksFound}.`);
        }
    }
    console.log(`[Volume Calculation] Total blocks processed: ${blocksFound}`); // DEBUG

     // Simple count for overall cardio mentions if volume.Cardio is still 0
     // This is a fallback and might overestimate/underestimate
     if (volume.Cardio === 0) {
         let cardioMentions = 0;
         muscleGroupKeywords.Cardio.forEach(keyword => {
             try {
                 const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
                 const matches = routineHtml.match(regex) || [];
                 cardioMentions += matches.length;
             } catch (e) { /* ignore */ }
         });
         if (cardioMentions > 0) {
             volume.Cardio = Math.max(1, Math.round(cardioMentions / 3)); // Rough estimate
             console.log(`[Volume Debug] Fallback: Estimated ${volume.Cardio} Cardio sets based on ${cardioMentions} mentions.`); // DEBUG
         }
     }


    console.log("[Volume Calculation] Final Volume (Before Filter):", JSON.stringify(volume)); // DEBUG

    // Filter out groups with 0 sets for cleaner chart display
    const filteredVolume = {};
    for (const group in volume) {
        // Include group if it has sets OR if it's 'Cardio' and has sets (even if added by fallback)
        if (volume[group] > 0) {
            filteredVolume[group] = volume[group];
        }
    }

    console.log("[Volume Calculation] Final Filtered Volume (for chart):", JSON.stringify(filteredVolume)); // DEBUG
    return filteredVolume;
}


/**
 * Genera el HTML para la portada, incluyendo placeholders para los gráficos.
 * @param {Object} scores - Puntuaciones de componentes de entrenamiento.
 * @param {string} clientName - Nombre del cliente.
 * @returns {string} - HTML para la portada.
 */
function generateCoverPageHtml(scores, clientName = 'Cliente') {
    const date = new Date().toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    // Dynamic description based on main components
    let description = `¡Hola ${clientName}! Aquí tienes un resumen visual de tu nuevo plan de entrenamiento. `;
    if (scores.mainComponents && scores.mainComponents.length > 0) {
        description += `Nos enfocaremos principalmente en **${scores.mainComponentsDisplay}** para ayudarte a alcanzar tus metas. Los gráficos a continuación detallan la distribución del enfoque y el volumen semanal estimado por grupo muscular. ¡A darle con todo!`;
    } else {
        description += `Este plan está diseñado para ofrecerte un desarrollo equilibrado en todas las áreas clave. Los gráficos muestran la distribución del enfoque y el volumen semanal estimado. ¡Disfruta del proceso!`;
    }

    return `
    <div class="cover-page-new">
      <div class="cover-header-new">
        <img class="cover-logo-new" src="LOGO_BASE_64_PLACEHOLDER" alt="Logo Fitform" onerror="this.style.display='none'">
        <div class="client-info-new">
          <h1>${clientName}</h1>
          <p>${date}</p>
        </div>
      </div>

      <div class="cover-main-new">
        <div class="cover-text-content">
          <h2>Tu Hoja de Ruta Fitness</h2>
          <p class="cover-description-new">${description}</p>
          <div class="components-legend-new">
            <h3>Enfoque del Entrenamiento (%)</h3>
            <div class="legend-grid">
                <div class="component-item-new">
                    <div class="component-dot-new fuerza-color"></div>
                    <div class="component-label-new">Fuerza: <span>${scores.fuerza}%</span></div>
                </div>
                <div class="component-item-new">
                    <div class="component-dot-new potencia-color"></div>
                    <div class="component-label-new">Potencia: <span>${scores.potencia}%</span></div>
                </div>
                <div class="component-item-new">
                    <div class="component-dot-new hipertrofia-color"></div>
                    <div class="component-label-new">Hipertrofia: <span>${scores.hipertrofia}%</span></div>
                </div>
                 <div class="component-item-new">
                    <div class="component-dot-new tecnica-color"></div>
                    <div class="component-label-new">Técnica: <span>${scores.tecnica}%</span></div>
                </div>
                <div class="component-item-new">
                    <div class="component-dot-new movilidad-color"></div>
                    <div class="component-label-new">Movilidad: <span>${scores.movilidad}%</span></div>
                </div>
                <div class="component-item-new">
                    <div class="component-dot-new cardio-color"></div>
                    <div class="component-label-new">Cardio: <span>${scores.cardio}%</span></div>
                </div>
            </div>
          </div>
        </div>

        <div class="cover-visuals-content">
          <div class="chart-container-new radar-chart-container-new">
              <h3 class="chart-title">Distribución del Enfoque</h3>
              <canvas id="radarChart"></canvas>
          </div>
          <div class="chart-container-new volume-chart-container-new">
              <h3 class="chart-title">Volumen Semanal Estimado (Series)</h3>
              <canvas id="volumeLineChart"></canvas>
          </div>
        </div>
      </div>

      <div class="cover-footer-new">
          <p>© ${new Date().getFullYear()} Fitform - Todos los derechos reservados</p>
      </div>
    </div>
    `;
}


/**
 * Genera estilos CSS para la portada (incluyendo gráficos).
 * @returns {string} - Estilos CSS.
 */
function getCoverPageStyles() {
    // Combined and refined styles for cover page elements
    return `
    /* Estilos Mejorados Portada Completa v3 - Corregido Layout Gráficos */
    :root {
        /* Define color variables */
        --primary-color: #2c3e50; /* Dark Blue-Gray for text */
        --secondary-color: #34495e; /* Slightly lighter Blue-Gray */
        --accent-color: #3498db;   /* Bright Blue */
        --light-blue-bg: #e0f2f7; /* Light Sky Blue */
        --medium-blue-bg: #b3e0f2; /* Medium Sky Blue */
        --text-light: #ffffff;     /* White text (e.g., for buttons if added) */
        --text-dark: #2c3e50;      /* Dark Blue-Gray for main text */
        --text-medium-dark: #555;  /* Medium dark gray for less important text */
        --text-light-gray: #95a5a6; /* Light gray for footer */
        --border-light: rgba(0, 0, 0, 0.1);  /* Light border for dark on light */
        --border-medium: #bdc3c7; /* Medium border */
        --background-light-accent: rgba(0, 0, 0, 0.04); /* Subtle dark accent on light bg */
        --background-chart-container: #ffffff; /* White background for charts */
        --border-radius: 8px;
        --border-radius-large: 12px;
        --box-shadow-light: 0 4px 15px rgba(0, 0, 0, 0.05);
        --box-shadow-medium: 0 6px 20px rgba(0, 0, 0, 0.08);

        /* Component Colors */
        --fuerza-color: #3498db;
        --hipertrofia-color: #2ecc71;
        --movilidad-color: #f1c40f;
        --potencia-color: #e74c3c;
        --tecnica-color: #9b59b6;
        --cardio-color: #e67e22;
    }

    /* Apply margin reset to body for PDF generation */
    body {
        margin: 0;
        font-family: 'Inter', 'Arial', sans-serif; /* Ensure font is applied */
        -webkit-print-color-adjust: exact; /* Important for background colors in PDF */
         print-color-adjust: exact;
    }


    .cover-page-new {
        position: relative;
        display: flex;
        flex-direction: column;
        min-height: 100vh; /* Ensure full page height */
        height: 100vh; /* Try explicit height */
        width: 100%;
        /* Lighter Sky Blue Gradient Background */
        background: linear-gradient(145deg, var(--light-blue-bg) 0%, var(--medium-blue-bg) 100%);
        color: var(--text-dark); /* Main text color changed to dark */
        box-sizing: border-box;
        page-break-after: always;
        overflow: hidden; /* Prevent content spill */
        padding: 30px 40px; /* Reduced padding slightly */
    }

    .cover-header-new {
        width: 100%;
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 25px; /* Adjusted margin */
        border-bottom: 1px solid rgba(0, 0, 0, 0.1); /* Darker border on light bg */
        padding-bottom: 15px;
        flex-shrink: 0; /* Prevent header from shrinking */
    }

    .cover-logo-new {
        width: 100px; /* Further adjusted size */
        height: auto;
        opacity: 0.9;
         /* Assuming logo needs to be dark on light bg, remove invert */
         /* filter: brightness(0) invert(1); */
    }

    .client-info-new {
        text-align: right;
    }

    .client-info-new h1 {
        font-size: 24px; /* Adjusted size */
        font-weight: 700;
        color: var(--primary-color); /* Use primary dark color */
        margin: 0 0 4px 0;
        line-height: 1.2;
    }

    .client-info-new p {
        margin: 0;
        color: var(--text-medium-dark); /* Medium dark gray */
        font-size: 13px; /* Adjusted */
        font-weight: 400;
    }

    .cover-main-new {
        flex-grow: 1; /* Allow main content to take available space */
        display: flex;
        flex-direction: column;
        gap: 20px; /* Adjusted gap */
        width: 100%;
        overflow: hidden; /* Prevent inner content from overflowing the page */
        /* Removed margin-bottom to let flexbox handle space */
    }

    .cover-text-content {
       flex-shrink: 0; /* Prevent text content from shrinking too much */
       margin-bottom: 15px; /* Add some space below text */
    }

    .cover-text-content h2 {
        font-size: 22px; /* Adjusted size */
        font-weight: 700;
        color: var(--primary-color);
        margin-bottom: 10px;
        line-height: 1.3;
        position: relative;
        display: inline-block;
        padding-bottom: 6px;
    }

    .cover-text-content h2::after {
        content: '';
        position: absolute;
        bottom: 0;
        left: 0;
        width: 40px;
        height: 3px;
        background-color: var(--accent-color);
        border-radius: 3px;
    }

    .cover-description-new {
        font-size: 13px; /* Adjusted size */
        color: var(--secondary-color); /* Use secondary dark color */
        line-height: 1.5; /* Adjusted */
        margin-bottom: 20px; /* Adjusted margin */
        font-weight: 400;
        max-width: 100%;
    }

    .cover-description-new strong {
        color: var(--primary-color);
        font-weight: 600;
    }

    .components-legend-new {
        background-color: var(--background-light-accent);
        padding: 15px 20px; /* Adjusted padding */
        border-radius: var(--border-radius);
        border: 1px solid var(--border-light);
    }

    .components-legend-new h3 {
        font-size: 14px; /* Adjusted size */
        font-weight: 600;
        color: var(--primary-color);
        margin: 0 0 12px 0;
        text-align: left;
    }

    .legend-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); /* Responsive columns */
        gap: 8px 15px; /* Adjusted gap */
    }


    .component-item-new {
        display: flex;
        align-items: center;
        gap: 7px; /* Adjusted gap */
    }

    .component-dot-new {
        width: 9px; /* Adjusted */
        height: 9px; /* Adjusted */
        border-radius: 50%;
        flex-shrink: 0;
        border: 1px solid rgba(0, 0, 0, 0.3); /* Darker border for dots */
    }

    /* Component Colors remain the same */
    .fuerza-color { background-color: var(--fuerza-color); }
    .hipertrofia-color { background-color: var(--hipertrofia-color); }
    .movilidad-color { background-color: var(--movilidad-color); }
    .potencia-color { background-color: var(--potencia-color); }
    .tecnica-color { background-color: var(--tecnica-color); }
    .cardio-color { background-color: var(--cardio-color); }

    .component-label-new {
        font-size: 12px; /* Adjusted size */
        font-weight: 500;
        color: var(--secondary-color);
    }

    .component-label-new span {
        font-weight: 700;
        color: var(--primary-color);
        margin-left: 4px;
    }

    /* --- Layout Correction for Charts --- */
    .cover-visuals-content {
        display: flex; /* Use flexbox */
        flex-direction: column; /* Stack charts vertically */
        gap: 15px; /* Space between charts */
        width: 100%;
        flex-grow: 1; /* Allow this container to grow */
        overflow: hidden; /* Prevent charts from overflowing */
        /* align-items: stretch; Removed */
    }

    .chart-container-new {
        /* flex: 1 1 300px; Removed - let flex column handle sizing */
        background-color: var(--background-chart-container);
        border-radius: var(--border-radius-large);
        padding: 15px 20px 20px 20px; /* Adjusted padding */
        box-shadow: var(--box-shadow-medium);
        border: 1px solid var(--border-medium); /* Subtle border */
        display: flex;
        flex-direction: column;
        /* min-width: 0; Removed */
        height: auto; /* Let height be determined by content and available space */
        min-height: 250px; /* Minimum height to ensure chart visibility */
        max-height: 300px; /* **Adjust this value as needed** Maximum height per chart */
        flex-shrink: 1; /* Allow charts to shrink if needed */
        flex-grow: 1; /* Allow charts to grow to fill space */
        /* margin-bottom: 20px; /* Add space below each chart */
        /* Removed margin-bottom, using gap in parent instead */
    }

    /* .chart-container-new:last-child {
       margin-bottom: 0; /* Remove margin from the last chart */
    /* } */


     .chart-title {
        font-size: 13px; /* Adjusted size */
        font-weight: 600;
        color: var(--text-dark);
        margin: 0 0 10px 0; /* Adjusted margin */
        text-align: center;
        flex-shrink: 0; /* Prevent title from shrinking */
    }

    #radarChart, #volumeLineChart {
        max-width: 100%;
        /* max-height: calc(100% - 30px); /* Removed fixed calc, let flexbox manage */
        width: 100%; /* Ensure canvas tries to fill container width */
        height: 100%; /* Ensure canvas tries to fill container height */
        margin: auto;
        display: block;
        flex-grow: 1; /* Allow canvas to grow */
        min-height: 0; /* Important for flex item sizing */
    }
    /* --- End Layout Correction --- */

    .cover-footer-new {
        width: 100%;
        text-align: center;
        padding-top: 10px; /* Adjusted padding */
        margin-top: auto; /* Push footer to bottom */
        border-top: 1px solid var(--border-light);
        font-size: 10px; /* Adjusted size */
        color: var(--text-light-gray);
        flex-shrink: 0; /* Prevent footer from shrinking */
    }
    `;
}


/**
 * Genera el script de inicialización de Chart.js para el gráfico radar.
 * @param {Object} scores - Puntuaciones de componentes de entrenamiento.
 * @returns {string} - Código JavaScript para inicializar el gráfico radar.
 */
function getRadarChartScript(scores) {
    const chartData = [
        scores.fuerza, scores.hipertrofia, scores.movilidad,
        scores.potencia, scores.tecnica, scores.cardio
    ];
    const labels = ['Fuerza', 'Hipertrofia', 'Movilidad', 'Potencia', 'Técnica', 'Cardio'];

    // Chart.js initialization script
    return `
    <script>
      // Variable global para la instancia del gráfico radar
      var myRadarChart;
      // Function to initialize the radar chart
      function initRadarChart() {
        const canvasElement = document.getElementById('radarChart');
        if (!canvasElement) {
          console.error("Canvas element #radarChart not found.");
          return;
        }
        const ctx = canvasElement.getContext('2d');
        if (!ctx) {
            console.error("Failed to get 2D context from radar canvas.");
            return;
        }

        // Chart.js Configuration
        try {
            // Destruir gráfico existente si lo hay (para reinicialización)
            if (window.myRadarChart) {
                window.myRadarChart.destroy();
            }
            window.myRadarChart = new Chart(ctx, { // Asignar a la variable global
                type: 'radar',
                data: {
                    labels: ${JSON.stringify(labels)},
                    datasets: [{
                        label: 'Enfoque (%)',
                        data: ${JSON.stringify(chartData)},
                        backgroundColor: 'rgba(10, 42, 94, 0.3)', // Keep dark fill for contrast
                        borderColor: 'rgba(10, 42, 94, 0.9)',   // Keep dark border
                        borderWidth: 1.5, // Reduced border width slightly
                        pointBackgroundColor: 'rgba(10, 42, 94, 1)',
                        pointBorderColor: '#fff',
                        pointHoverBackgroundColor: '#fff',
                        pointHoverBorderColor: 'rgba(10, 42, 94, 1)',
                        pointRadius: 3, // Reduced point size
                        pointHoverRadius: 5 // Reduced hover size
                    }]
                },
                options: {
                    scales: {
                        r: { // Radial axis
                            angleLines: { display: true, color: 'rgba(0, 0, 0, 0.08)' }, // Lighter lines
                            suggestedMin: 0,
                            suggestedMax: 100,
                            grid: { color: 'rgba(0, 0, 0, 0.08)' }, // Lighter grid
                            ticks: {
                                stepSize: 25, // Adjusted step size
                                color: 'rgba(0, 0, 0, 0.5)', // Lighter ticks
                                backdropColor: 'rgba(255, 255, 255, 0.6)', // More transparent backdrop
                                padding: 5, // Reduced padding
                                font: { size: 9 } // Smaller font
                            },
                            pointLabels: { // Labels around the edge
                                font: { size: 11, weight: '500' }, // Adjusted font size
                                color: 'rgba(0, 0, 0, 0.75)' // Slightly lighter labels
                            }
                        }
                    },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            enabled: true,
                            backgroundColor: 'rgba(0, 0, 0, 0.8)', // Slightly lighter tooltip
                            titleFont: { size: 12, weight: 'bold' }, // Adjusted size
                            bodyFont: { size: 11 }, // Adjusted size
                            padding: 8, // Adjusted padding
                            boxPadding: 3,
                            cornerRadius: 3,
                            callbacks: {
                                label: function(context) {
                                    let label = context.dataset.label || '';
                                    if (label) { label += ': '; }
                                    if (context.parsed.r !== null) {
                                        label += context.parsed.r + '%';
                                    }
                                    return label;
                                }
                            }
                        }
                    },
                    responsive: true,
                    maintainAspectRatio: false // Crucial for resizing within flex container
                }
            });
            console.log("Radar chart initialized successfully."); // Confirmation log
        } catch (error) {
             console.error("Error initializing Radar Chart:", error);
        }
      }

      // Initialize chart when the DOM is ready
      if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', initRadarChart);
      } else {
          // Delay slightly if DOM is already loaded, might help rendering in some cases
          setTimeout(initRadarChart, 50); // Reduced delay
      }
    </script>
    `;
}

/**
 * Genera el script de inicialización de Chart.js para el gráfico de líneas de volumen.
 * @param {Object} volumeData - Datos de volumen semanal por grupo muscular.
 * @returns {string} - Código JavaScript para inicializar el gráfico de líneas.
 */
function getVolumeLineChartScript(volumeData) {
    const labels = Object.keys(volumeData);
    const data = Object.values(volumeData);

    // Check if data is empty and provide default if needed for display
    const displayLabels = labels.length > 0 ? labels : ['No Data'];
    const displayData = data.length > 0 ? data : [0];
    const noDataAvailable = displayLabels.length === 1 && displayLabels[0] === 'No Data';


    const lineChartColors = {
        backgroundColor: 'rgba(52, 152, 219, 0.15)', // Lighter blue area fill
        borderColor: 'rgba(52, 152, 219, 0.9)',    // Solid blue line
        pointBackgroundColor: 'rgba(52, 152, 219, 1)',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: 'rgba(52, 152, 219, 1)',
    };

    return `
    <script>
      // Variable global para la instancia del gráfico de volumen
      var myVolumeChart;
      // Function to initialize the volume line chart
      function initVolumeLineChart() {
        const canvasElement = document.getElementById('volumeLineChart');
        if (!canvasElement) {
          console.error("Canvas element #volumeLineChart not found.");
          return;
        }
        const ctx = canvasElement.getContext('2d');
         if (!ctx) {
             console.error("Failed to get 2D context from volume canvas.");
             return;
         }

        // Display message if no data
        const noData = ${noDataAvailable};
        if (noData) {
            ctx.clearRect(0, 0, canvasElement.width, canvasElement.height); // Clear previous drawings
            ctx.font = "14px 'Inter', sans-serif"; // Slightly smaller font
            ctx.fillStyle = '#777'; // Lighter gray
            ctx.textAlign = 'center';
            ctx.fillText("No se pudo calcular el volumen.", canvasElement.width / 2, canvasElement.height / 2);
            console.warn("No volume data to display in line chart.");
            return; // Stop chart initialization
        }


        // Chart.js Configuration
        try {
            // Destruir gráfico existente si lo hay
            if (window.myVolumeChart) {
                window.myVolumeChart.destroy();
            }
            window.myVolumeChart = new Chart(ctx, { // Asignar a la variable global
                type: 'line',
                data: {
                    labels: ${JSON.stringify(displayLabels)},
                    datasets: [{
                        label: 'Series Semanales',
                        data: ${JSON.stringify(displayData)},
                        fill: true,
                        backgroundColor: '${lineChartColors.backgroundColor}',
                        borderColor: '${lineChartColors.borderColor}',
                        borderWidth: 2, // Adjusted width
                        pointBackgroundColor: '${lineChartColors.pointBackgroundColor}',
                        pointBorderColor: '${lineChartColors.pointBorderColor}',
                        pointHoverBackgroundColor: '${lineChartColors.pointHoverBackgroundColor}',
                        pointHoverBorderColor: '${lineChartColors.pointHoverBorderColor}',
                        pointRadius: 3.5, // Adjusted size
                        pointHoverRadius: 5.5, // Adjusted size
                        tension: 0.2 // Slightly more tension
                    }]
                },
                options: {
                    scales: {
                        y: {
                            beginAtZero: true,
                            title: {
                                display: false, // Hide Y axis title to save space
                                // text: 'Número de Series',
                                // font: { size: 11 },
                                // color: '#666'
                            },
                            ticks: {
                                color: 'rgba(0, 0, 0, 0.6)', // Lighter ticks
                                precision: 0,
                                font: { size: 10 } // Smaller font
                            },
                             grid: {
                                 color: 'rgba(0, 0, 0, 0.06)' // Lighter grid
                            }
                        },
                        x: {
                             ticks: {
                                 color: 'rgba(0, 0, 0, 0.6)', // Lighter ticks
                                 font: { size: 10 } // Smaller font
                            },
                             grid: {
                                 display: false
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            display: false, // Hide legend to save space
                            // position: 'bottom',
                            // labels: {
                            //     font: { size: 11 },
                            //     color: 'rgba(0, 0, 0, 0.8)'
                            // }
                        },
                        tooltip: {
                            enabled: true,
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            titleFont: { size: 12, weight: 'bold' },
                            bodyFont: { size: 11 },
                            padding: 8,
                            boxPadding: 3,
                            cornerRadius: 3,
                             callbacks: {
                                 label: function(context) {
                                     let label = context.dataset.label || '';
                                     if (label) { label += ': '; }
                                     if (context.parsed.y !== null) {
                                         label += context.parsed.y + ' series';
                                     }
                                     return label;
                                 }
                            }
                        }
                    },
                    responsive: true,
                    maintainAspectRatio: false // Crucial for resizing
                }
            });
             console.log("Volume chart initialized successfully."); // Confirmation log
        } catch (error) {
             console.error("Error initializing Volume Line Chart:", error);
        }
      }

      // Initialize chart when the DOM is ready
      if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', initVolumeLineChart);
      } else {
          // Delay slightly if DOM is already loaded
          setTimeout(initVolumeLineChart, 50); // Reduced delay
      }
    </script>
    `;
}


/**
 * Creates a complete cover page including radar and volume charts.
 * @param {string} routineHtml - The HTML content of the routine.
 * @param {string} clientName - The client's name.
 * @param {string} logoBase64 - Base64 encoded logo image.
 * @returns {object} - Object containing fullCoverPageHtml, styles, combined script, scores, and volumeData.
 */
function createCoverPage(routineHtml, clientName, logoBase64) {
    // 1. Calculate component scores
    const scores = calculateTrainingComponentScores(routineHtml);

    // 2. Calculate weekly volume
    const volumeData = calculateWeeklyVolume(routineHtml); // Returns filtered data

    // 3. Generate cover page HTML (placeholders for charts)
    let fullCoverPageHtml = generateCoverPageHtml(scores, clientName);

    // 4. Replace logo placeholder
    if (logoBase64 && logoBase64.startsWith('data:image')) {
        fullCoverPageHtml = fullCoverPageHtml.replace('LOGO_BASE_64_PLACEHOLDER', logoBase64);
    } else {
        fullCoverPageHtml = fullCoverPageHtml.replace(/<img class="cover-logo-new".*?>/g, '');
        console.warn("Valid Logo Base64 not provided or invalid format. Removing logo element.");
    }

    // 5. Get CSS styles
    const styles = getCoverPageStyles();

    // 6. Get Chart.js initialization scripts
    const radarScript = getRadarChartScript(scores);
    // Pass the potentially empty filtered volume data to the script generator
    const volumeScript = getVolumeLineChartScript(volumeData);

    // 7. Combine scripts (including the main Chart.js library)
    const combinedScript = `
        <script src="https://cdn.jsdelivr.net/npm/chart.js@3.7.1/dist/chart.min.js"></script>
        ${radarScript}
        ${volumeScript}
    `;


    return {
        fullCoverPageHtml,
        styles,
        script: combinedScript,
        scores,
        volumeData // Return the calculated (possibly empty) volume data
    };
}

// Export the main function
module.exports = {
    calculateTrainingComponentScores,
    calculateWeeklyVolume,
    createCoverPage
};
