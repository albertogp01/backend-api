// chartService.js (Mejorado)

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
    const volume = {
        Pecho: 0, Espalda: 0, Hombro: 0,
        Biceps: 0, Triceps: 0, Pierna: 0,
        Gluteo: 0, Abdomen: 0, Cardio: 0, Otro: 0
    };

    if (!routineHtml || routineHtml.trim() === '') {
        console.warn("No routine HTML provided for volume calculation.");
        return volume; // Return empty volume if no HTML
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
    // Looks for <li>, <tr>, or <p> tags containing 'X sets', 'X series', 'NxM', etc.
    const exerciseBlockRegex = /<(li|tr|p)[^>]*>([\s\S]*?)<\/\1>/gi;
    const setRepRegex = /(\d+)\s*(?:sets?|series?)\s*x\s*(\d+(?:-\d+)?)\s*(?:reps?|repeticiones?)?/i; // e.g., 3 sets x 8-12 reps
    const simpleSetRepRegex = /(\d+)\s*x\s*(\d+(?:-\d+)?)/i; // e.g., 3x10
    const timeBasedRegex = /(\d+)\s*(?:min|seg|seconds?)/i; // e.g., 30 min, 60 sec

    let match;
    while ((match = exerciseBlockRegex.exec(routineHtml)) !== null) {
        const blockContent = match[2]; // Content within the tag
        let sets = 0;
        let isCardioSession = false;

        // Try to find sets x reps patterns
        const setRepMatch = blockContent.match(setRepRegex) || blockContent.match(simpleSetRepRegex);
        if (setRepMatch && setRepMatch.length >= 2) {
            sets = parseInt(setRepMatch[1], 10) || 0;
        }

        // Check for time-based exercises (likely cardio) if no sets found
        if (sets === 0 && timeBasedRegex.test(blockContent)) {
           isCardioSession = true;
           sets = 1; // Count as one session/set for volume chart simplicity
        }


        if (sets > 0) {
            let assigned = false;
            for (const group in muscleGroupKeywords) {
                for (const keyword of muscleGroupKeywords[group]) {
                    try {
                        const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
                        if (regex.test(blockContent)) {
                            // If it's a cardio keyword OR a cardio session identified by time
                            if (group === 'Cardio' || isCardioSession) {
                                volume.Cardio += sets;
                            } else {
                                volume[group] += sets;
                            }
                            assigned = true;
                            break; // Assign to first matching group
                        }
                    } catch (e) {
                        console.warn(`Invalid regex for volume keyword: ${keyword}`, e);
                    }
                }
                if (assigned) break;
            }
            if (!assigned && !isCardioSession) { // Don't assign pure time-based to 'Otro'
                volume.Otro += sets;
            }
        }
    }

     // Simple count for overall cardio mentions if volume.Cardio is still 0
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
             // Estimate sessions based on mentions (very rough)
             volume.Cardio = Math.max(1, Math.round(cardioMentions / 3));
         }
     }


    console.log("Calculated Weekly Volume (Sets per Group):", volume);

    // Filter out groups with 0 sets for cleaner chart display
    const filteredVolume = {};
    for (const group in volume) {
        if (volume[group] > 0) {
            filteredVolume[group] = volume[group];
        }
    }
    // Ensure Cardio is present if it was calculated, even if 0 initially but added later
    if (volume.Cardio > 0 && !filteredVolume.Cardio) {
        filteredVolume.Cardio = volume.Cardio;
    }


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

    // Note: volumeTableHtmlContent is removed, replaced by volume chart canvas

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
    /* Estilos Mejorados Portada Completa v2 */
    :root {
        /* Define color variables */
        --primary-color: #0a2a5e; /* Dark Blue */
        --secondary-color: #1e477e; /* Medium Blue */
        --accent-color: #3498db;   /* Bright Blue */
        --light-blue-bg: #f0f4f8; /* Very light blue for chart background */
        --text-light: #ffffff;
        --text-medium: rgba(255, 255, 255, 0.85);
        --text-dark: #333333; /* Darker text for charts */
        --text-dark-medium: #555555;
        --border-light: rgba(255, 255, 255, 0.15);
        --border-medium: #e0e0e0; /* Border for chart containers */
        --border-dark: rgba(0, 0, 0, 0.1);
        --background-light-accent: rgba(255, 255, 255, 0.08); /* Slightly more visible */
        --background-chart-container: #ffffff; /* White background for charts */
        --border-radius: 8px;
        --border-radius-large: 12px; /* Slightly larger radius */
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

    .cover-page-new {
        position: relative;
        display: flex;
        flex-direction: column;
        min-height: 100vh; /* Ensure full page height */
        width: 100%;
        /* Softer Gradient Background */
        background: linear-gradient(145deg, #1e477e 0%, #0a2a5e 100%);
        color: var(--text-light);
        box-sizing: border-box;
        font-family: 'Inter', 'Arial', sans-serif;
        page-break-after: always; /* Ensure it's on its own page in PDF */
        overflow: hidden; /* Prevent potential overflow issues */
        padding: 40px 50px; /* Slightly adjusted padding */
    }

    .cover-header-new {
        width: 100%;
        display: flex;
        justify-content: space-between;
        align-items: center; /* Center items vertically */
        margin-bottom: 40px; /* Increased margin */
        border-bottom: 1px solid var(--border-light);
        padding-bottom: 20px;
    }

    .cover-logo-new {
        width: 120px; /* Slightly smaller */
        height: auto;
        filter: brightness(0) invert(1); /* Ensure logo is white */
        opacity: 0.95;
    }

    .client-info-new {
        text-align: right;
    }

    .client-info-new h1 {
        font-size: 28px; /* Slightly smaller */
        font-weight: 700;
        color: var(--text-light);
        margin: 0 0 5px 0;
        line-height: 1.2;
    }

    .client-info-new p {
        margin: 0;
        color: var(--text-medium);
        font-size: 14px; /* Slightly smaller */
        font-weight: 400;
    }

    .cover-main-new {
        flex-grow: 1;
        display: flex;
        flex-direction: column; /* Stack text and visuals vertically */
        gap: 35px; /* Space between text and visuals */
        width: 100%;
        margin-bottom: 30px; /* Space above footer */
    }

    .cover-text-content {
        /* Takes full width in the new column layout */
    }

    .cover-text-content h2 {
        font-size: 26px; /* Adjusted size */
        font-weight: 700;
        color: var(--text-light);
        margin-bottom: 15px;
        line-height: 1.3;
        position: relative;
        display: inline-block;
        padding-bottom: 8px;
    }

    .cover-text-content h2::after {
        content: '';
        position: absolute;
        bottom: 0;
        left: 0;
        width: 50px; /* Shorter underline */
        height: 3px;
        background-color: var(--accent-color);
        border-radius: 3px;
    }

    .cover-description-new {
        font-size: 15px; /* Adjusted size */
        color: var(--text-medium);
        line-height: 1.65;
        margin-bottom: 30px;
        font-weight: 400;
        max-width: 90%; /* Limit width for better readability */
    }

    .cover-description-new strong {
        color: var(--text-light);
        font-weight: 600;
    }

    .components-legend-new {
        background-color: var(--background-light-accent);
        padding: 20px 25px;
        border-radius: var(--border-radius);
        border: 1px solid var(--border-light);
    }

    .components-legend-new h3 {
        font-size: 16px;
        font-weight: 600;
        color: var(--text-light);
        margin: 0 0 15px 0;
        text-align: left;
    }

    .legend-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr); /* Two columns */
        gap: 10px 20px; /* Row gap, Column gap */
    }


    .component-item-new {
        display: flex;
        align-items: center;
        gap: 10px;
    }

    .component-dot-new {
        width: 11px; /* Slightly larger dots */
        height: 11px;
        border-radius: 50%;
        flex-shrink: 0;
        border: 1px solid rgba(255, 255, 255, 0.4);
    }

    /* Component Colors */
    .fuerza-color { background-color: var(--fuerza-color); }
    .hipertrofia-color { background-color: var(--hipertrofia-color); }
    .movilidad-color { background-color: var(--movilidad-color); }
    .potencia-color { background-color: var(--potencia-color); }
    .tecnica-color { background-color: var(--tecnica-color); }
    .cardio-color { background-color: var(--cardio-color); }

    .component-label-new {
        font-size: 13.5px; /* Adjusted size */
        font-weight: 500;
        color: var(--text-medium);
    }

    .component-label-new span {
        font-weight: 700;
        color: var(--text-light);
        margin-left: 4px;
    }

    .cover-visuals-content {
        display: flex;
        gap: 30px; /* Space between the two charts */
        width: 100%;
        align-items: stretch; /* Make charts equal height */
    }

    .chart-container-new {
        flex: 1; /* Each chart takes equal space */
        background-color: var(--background-chart-container);
        border-radius: var(--border-radius-large);
        padding: 20px 25px 25px 25px; /* More padding */
        box-shadow: var(--box-shadow-medium);
        display: flex;
        flex-direction: column;
        min-width: 0; /* Prevent flex item overflow */
        height: 380px; /* Fixed height for chart containers */
        max-height: 380px;
    }

     .chart-title {
        font-size: 15px; /* Slightly smaller chart titles */
        font-weight: 600;
        color: var(--text-dark-medium);
        margin: 0 0 15px 0;
        text-align: center;
    }

    .radar-chart-container-new,
    .volume-chart-container-new {
       /* Styles already defined in .chart-container-new */
    }

    /* Canvas elements need relative positioning potentially for Chart.js tooltips */
    #radarChart, #volumeLineChart {
        max-width: 100%;
        max-height: calc(100% - 30px); /* Adjust based on title height and padding */
        margin: auto; /* Center canvas if container is larger */
        display: block;
    }

    .cover-footer-new {
        width: 100%;
        text-align: center;
        padding-top: 20px;
        margin-top: auto; /* Push footer to bottom */
        border-top: 1px solid var(--border-light);
        font-size: 12px;
        color: var(--text-medium);
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
            const radarChart = new Chart(ctx, {
                type: 'radar',
                data: {
                    labels: ${JSON.stringify(labels)},
                    datasets: [{
                        label: 'Enfoque (%)', // Updated label
                        data: ${JSON.stringify(chartData)},
                        backgroundColor: 'rgba(10, 42, 94, 0.3)', // Adjusted alpha
                        borderColor: 'rgba(10, 42, 94, 0.9)',
                        borderWidth: 2,
                        pointBackgroundColor: 'rgba(10, 42, 94, 1)',
                        pointBorderColor: '#fff',
                        pointHoverBackgroundColor: '#fff',
                        pointHoverBorderColor: 'rgba(10, 42, 94, 1)',
                        pointRadius: 3.5,
                        pointHoverRadius: 5.5
                    }]
                },
                options: {
                    scales: {
                        r: { // Radial axis
                            angleLines: { display: true, color: 'rgba(0, 0, 0, 0.1)' },
                            suggestedMin: 0,
                            suggestedMax: 100,
                            grid: { color: 'rgba(0, 0, 0, 0.1)' },
                            ticks: {
                                stepSize: 20,
                                color: 'rgba(0, 0, 0, 0.6)',
                                backdropColor: 'rgba(255, 255, 255, 0.75)',
                                padding: 8,
                                font: { size: 10 } // Smaller ticks
                            },
                            pointLabels: { // Labels around the edge
                                font: { size: 12, weight: '500' }, // Adjusted label size/weight
                                color: 'rgba(0, 0, 0, 0.85)'
                            }
                        }
                    },
                    plugins: {
                        legend: { display: false }, // Legend is in HTML
                        tooltip: {
                            enabled: true,
                            backgroundColor: 'rgba(0, 0, 0, 0.85)',
                            titleFont: { size: 13, weight: 'bold' },
                            bodyFont: { size: 12 },
                            padding: 10,
                            boxPadding: 4,
                            cornerRadius: 4,
                            callbacks: { // Add % sign to tooltip
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
                    maintainAspectRatio: false // Crucial for fitting container
                }
            });
        } catch (error) {
             console.error("Error initializing Radar Chart:", error);
        }
      }

      // Initialize chart when the DOM is ready
      if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', initRadarChart);
      } else {
          initRadarChart();
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

    // Colores base para el gráfico de líneas (puedes personalizarlos)
    const lineChartColors = {
        backgroundColor: 'rgba(52, 152, 219, 0.2)', // Light blue area fill
        borderColor: 'rgba(52, 152, 219, 1)',     // Solid blue line
        pointBackgroundColor: 'rgba(52, 152, 219, 1)',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: 'rgba(52, 152, 219, 1)',
    };

    return `
    <script>
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

        // Chart.js Configuration
        try {
            const volumeChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: ${JSON.stringify(labels)},
                    datasets: [{
                        label: 'Series Semanales',
                        data: ${JSON.stringify(data)},
                        fill: true, // Fill area under the line
                        backgroundColor: '${lineChartColors.backgroundColor}',
                        borderColor: '${lineChartColors.borderColor}',
                        borderWidth: 2.5, // Slightly thicker line
                        pointBackgroundColor: '${lineChartColors.pointBackgroundColor}',
                        pointBorderColor: '${lineChartColors.pointBorderColor}',
                        pointHoverBackgroundColor: '${lineChartColors.pointHoverBackgroundColor}',
                        pointHoverBorderColor: '${lineChartColors.pointHoverBorderColor}',
                        pointRadius: 4, // Slightly larger points
                        pointHoverRadius: 6,
                        tension: 0.1 // Slight curve to the line
                    }]
                },
                options: {
                    scales: {
                        y: { // Y-axis (Number of Sets)
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: 'Número de Series',
                                font: { size: 12 },
                                color: '${'#666'}' // Darker gray for axis title
                            },
                            ticks: {
                                color: 'rgba(0, 0, 0, 0.7)', // Darker gray for ticks
                                precision: 0 // Ensure whole numbers for sets
                            },
                             grid: {
                                color: 'rgba(0, 0, 0, 0.08)' // Lighter grid lines
                            }
                        },
                        x: { // X-axis (Muscle Groups)
                             ticks: {
                                color: 'rgba(0, 0, 0, 0.7)',
                                font: { size: 11 } // Slightly smaller font if needed
                            },
                             grid: {
                                display: false // Hide vertical grid lines if desired
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            display: true, // Show legend or set to false if title is enough
                            position: 'bottom',
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
                    maintainAspectRatio: false
                }
            });
        } catch (error) {
             console.error("Error initializing Volume Line Chart:", error);
        }
      }

      // Initialize chart when the DOM is ready
      if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', initVolumeLineChart);
      } else {
          initVolumeLineChart();
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
    const volumeData = calculateWeeklyVolume(routineHtml);

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
    const volumeScript = getVolumeLineChartScript(volumeData);

    // 7. Combine scripts
    const combinedScript = `
        <script src="https://cdn.jsdelivr.net/npm/chart.js@3.7.1/dist/chart.min.js"></script>
        ${radarScript}
        ${volumeScript}
    `;


    return {
        fullCoverPageHtml, // The complete HTML structure for the page
        styles,            // CSS styles for the page
        script: combinedScript, // Combined JavaScript for BOTH charts
        scores,            // Calculated component scores
        volumeData         // Calculated volume data (used for volume chart)
    };
}

// Export the main function and potentially others if needed elsewhere
module.exports = {
    calculateTrainingComponentScores, // Keep if used independently
    calculateWeeklyVolume,            // Keep if used independently
    createCoverPage
};


