/**
 * chartService.js (v3 - Layout Fix)
 * Modificado para asegurar que el contenido quepa en una página y corregir el gráfico de volumen.
 */

/**
 * Calculates training component scores based on keywords and heuristics in routine HTML.
 * @param {string} routineHtml - The HTML content of the generated routine.
 * @returns {Object} - Scores for each training component (0-100) and main components.
 */
function calculateTrainingComponentScores(routineHtml) {
    const scores = {
        fuerza: 0,
        hipertrofia: 0,
        movilidad: 0,
        potencia: 0,
        tecnica: 0,
        cardio: 0
    };

    if (!routineHtml || routineHtml.trim() === '') {
        console.warn("No routine HTML provided, returning default balanced scores.");
        return {
            fuerza: 50, hipertrofia: 50, movilidad: 50,
            potencia: 50, tecnica: 50, cardio: 50,
            mainComponents: [], mainComponentsDisplay: 'Equilibrado'
        };
    }

    const keywords = {
        fuerza: ['fuerza', 'strength', 'carga', 'peso', 'resistencia', 'weight', 'sentadilla', 'squat', 'press', 'deadlift', 'peso muerto', 'power', 'potencia', 'rm', '1rm', 'máxima', 'maximales', 'intensidad alta', 'pesado', 'heavy'],
        hipertrofia: ['hipertrofia', 'hypertrophy', 'volumen', 'volume', 'muscle', 'músculo', 'muscular', 'growth', 'crecimiento', 'tamaño', 'size', 'bodybuilding', 'culturismo', 'series', 'repeticiones', 'reps', 'rir'],
        movilidad: ['movilidad', 'mobility', 'flexibility', 'flexibilidad', 'stretching', 'estiramiento', 'range', 'motion', 'rango', 'articular', 'joint', 'rom', 'elasticidad', 'elongación', 'estirar', 'stretch', 'yoga', 'pilates'],
        potencia: ['potencia', 'power', 'explosiv', 'explosi[oó]n', 'velocidad', 'speed', 'fast', 'rápido', 'salto', 'jump', 'plyometric', 'pliometría', 'reactiv', 'sprint', 'lanzamiento', 'throw', 'tiempo', 'time', 'tempo.*[xX]', 'kettlebell swing'],
        tecnica: ['técnica', 'technique', 'form', 'forma', 'skill', 'habilidad', 'balance', 'equilibrio', 'coordination', 'coordinación', 'control', 'pattern', 'patrón', 'motor', 'stability', 'estabilidad', 'aprendizaje', 'drills'],
        cardio: ['cardio', 'cardiovascular', 'aeróbico', 'aerobic', 'resistencia', 'endurance', 'stamina', 'interval', 'intervalos', 'hiit', 'heart', 'rate', 'ritmo', 'cardiac', 'cardíaco', 'vo2', 'máximo', 'correr', 'run', 'nadar', 'swim', 'bicicleta', 'bike', 'cinta', 'eliptica']
    };

    const counts = {
        fuerza: 0, hipertrofia: 0, movilidad: 0,
        potencia: 0, tecnica: 0, cardio: 0
    };

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

    const simpleRepMatches = routineHtml.match(/(\d+)\s+reps?/gi) || [];
    simpleRepMatches.forEach(match => {
        const repNumbers = match.match(/\d+/g);
        if (repNumbers) {
            const maxReps = Math.max(...repNumbers.map(Number));
             if (maxReps <= 6) lowRepSets += 0.5; // Add fractional counts for simple rep mentions
             else if (maxReps <= 15) midRepSets += 0.5;
             else highRepSets += 0.5;
        }
    });


    counts.fuerza += lowRepSets * 2;
    counts.hipertrofia += midRepSets * 1.5;
    counts.cardio += highRepSets * 1;

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

    if (routineHtml.match(/RIR\s+[0-2]/gi)) { counts.fuerza += 3; counts.hipertrofia += 5; }
    if (routineHtml.match(/RIR\s+[3-4]/gi)) { counts.hipertrofia += 3; }
    if (routineHtml.match(/RPE\s+[8-9]/gi)) { counts.fuerza += 2; counts.hipertrofia += 4; }
    if (routineHtml.match(/RPE\s+[6-7]/gi)) { counts.hipertrofia += 2; }
    if (routineHtml.match(/tempo.*[xX]/gi)) { counts.potencia += 6; }
    if (routineHtml.match(/tempo\s+\d{4,}/gi)) { counts.tecnica += 3; counts.hipertrofia += 2; }
    if (routineHtml.match(/descanso\s+(corto|30s|45s|60s)/gi)) { counts.hipertrofia += 1; counts.cardio += 1; }
    if (routineHtml.match(/descanso\s+(largo|90s|120s|2-3\s*min)/gi)) { counts.fuerza += 2; }

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

    const minThreshold = 5;
    let totalScore = 0;
    Object.keys(scores).forEach(component => {
        if (counts[component] > 0 && scores[component] < minThreshold) {
            scores[component] = minThreshold;
        }
        scores[component] = Math.min(scores[component], 100);
        totalScore += scores[component];
    });

    if (totalScore > 0 && Math.abs(totalScore - 100) > 10) {
        const scaleFactor = 100 / totalScore;
        Object.keys(scores).forEach(component => {
            scores[component] = Math.round(scores[component] * scaleFactor);
             scores[component] = Math.max( (counts[component] > 0 ? minThreshold : 0) , Math.min(scores[component], 100));
        });
    }

    let finalTotal = Object.values(scores).reduce((sum, score) => sum + score, 0);
    if (finalTotal !== 100 && finalTotal > 0) {
        let diff = 100 - finalTotal;
        let maxComp = Object.keys(scores).reduce((a, b) => scores[a] > scores[b] ? a : b);
        scores[maxComp] = Math.min(100, Math.max(0, scores[maxComp] + diff));
    }

    let maxScore = 0;
    let mainComponents = [];
    Object.entries(scores).forEach(([component, score]) => {
        if (score >= 25) {
            if (score > maxScore) {
                maxScore = score;
                mainComponents = [component];
            } else if (score === maxScore && !mainComponents.includes(component)) {
                mainComponents.push(component);
            }
        }
    });

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
    console.log("[Volume Calculation] Starting...");
    const volume = {
        Pecho: 0, Espalda: 0, Hombro: 0,
        Biceps: 0, Triceps: 0, Pierna: 0,
        Gluteo: 0, Abdomen: 0, Cardio: 0, Otro: 0
    };

    if (!routineHtml || routineHtml.trim() === '') {
        console.warn("[Volume Calculation] No routine HTML provided.");
        return {};
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

    const exerciseBlockRegex = /<(li|tr|p|div)[^>]*>([\s\S]*?)<\/\1>/gi;
    const setRepRegex = /(\d+)\s*(?:sets?|series?)\s*x\s*(\d+(?:-\d+)?)\s*(?:reps?|repeticiones?)?/i;
    const simpleSetRepRegex = /(\d+)\s*x\s*(\d+(?:-\d+)?)/i;
    const timeBasedRegex = /(\d+)\s*(?:min|seg|seconds?)/i;

    let match;
    let blocksFound = 0;
    while ((match = exerciseBlockRegex.exec(routineHtml)) !== null) {
        blocksFound++;
        const blockContent = match[2];
        let sets = 0;
        let isCardioSession = false;

        const setRepMatch = blockContent.match(setRepRegex) || blockContent.match(simpleSetRepRegex);
        if (setRepMatch && setRepMatch.length >= 2) {
            sets = parseInt(setRepMatch[1], 10) || 0;
        }

        if (sets === 0 && timeBasedRegex.test(blockContent)) {
           isCardioSession = true;
           sets = 1;
        }

        if (sets > 0) {
            let assigned = false;
            for (const group in muscleGroupKeywords) {
                for (const keyword of muscleGroupKeywords[group]) {
                    try {
                        const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
                        if (regex.test(blockContent)) {
                            const targetGroup = (group === 'Cardio' || isCardioSession) ? 'Cardio' : group;
                            volume[targetGroup] += sets;
                            assigned = true;
                            console.log(`[Volume Debug] Keyword '${keyword}' found. Assigning ${sets} sets to group: ${targetGroup}`);
                            break;
                        }
                    } catch (e) {
                        console.warn(`[Volume Calculation] Invalid regex for volume keyword: ${keyword}`, e);
                    }
                }
                if (assigned) break;
            }
            if (!assigned && !isCardioSession) {
                volume.Otro += sets;
                console.log(`[Volume Debug] No specific keyword found (and not cardio session). Assigning ${sets} sets to group: Otro`);
            }
        }
    }
    console.log(`[Volume Calculation] Total blocks processed: ${blocksFound}`);

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
            volume.Cardio = Math.max(1, Math.round(cardioMentions / 3));
            console.log(`[Volume Debug] Fallback: Estimated ${volume.Cardio} Cardio sets based on ${cardioMentions} mentions.`);
        }
    }

    console.log("[Volume Calculation] Final Volume (Before Filter):", JSON.stringify(volume));

    const filteredVolume = {};
    for (const group in volume) {
        if (volume[group] > 0) {
            filteredVolume[group] = volume[group];
        }
    }

    console.log("[Volume Calculation] Final Filtered Volume (for chart):", JSON.stringify(filteredVolume));
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
          <p class="cover-description-new">${description.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</p> {/* Replace markdown bold */}
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
              <canvas id="volumeBarChart"></canvas> {/* Changed ID */}
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
    return `
    /* Estilos Mejorados Portada Completa v4 - Layout Fix */
    :root {
        --primary-color: #2c3e50;
        --secondary-color: #34495e;
        --accent-color: #3498db;
        --light-blue-bg: #e0f2f7;
        --medium-blue-bg: #b3e0f2;
        --text-light: #ffffff;
        --text-dark: #2c3e50;
        --text-medium-dark: #555;
        --text-light-gray: #95a5a6;
        --border-light: rgba(0, 0, 0, 0.1);
        --border-medium: #bdc3c7;
        --background-light-accent: rgba(0, 0, 0, 0.04);
        --background-chart-container: #ffffff;
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
        --otro-color: #7f8c8d; /* Added color for 'Otro' */
    }

    /* Apply margin reset to body for PDF generation */
    body {
        margin: 0;
        font-family: 'Inter', 'Arial', sans-serif;
        -webkit-print-color-adjust: exact;
         print-color-adjust: exact;
    }


    .cover-page-new {
        position: relative;
        display: flex;
        flex-direction: column;
        min-height: 98vh; /* Use min-height instead of fixed height */
        height: auto; /* Allow content to define height */
        width: 100%;
        background: linear-gradient(145deg, var(--light-blue-bg) 0%, var(--medium-blue-bg) 100%);
        color: var(--text-dark);
        box-sizing: border-box;
        page-break-after: always;
        /* overflow: hidden; REMOVED overflow hidden */
        padding: 30px 40px; /* Slightly reduced padding */
    }

    .cover-header-new {
        width: 100%;
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 25px; /* Reduced margin */
        border-bottom: 1px solid rgba(0, 0, 0, 0.1);
        padding-bottom: 15px; /* Reduced padding */
        flex-shrink: 0; /* Prevent header from shrinking */
    }

    .cover-logo-new {
        width: 100px; /* Reduced size */
        height: auto;
        opacity: 0.9;
    }

    .client-info-new {
        text-align: right;
    }

    .client-info-new h1 {
        font-size: 24px; /* Reduced size */
        font-weight: 700;
        color: var(--primary-color);
        margin: 0 0 4px 0;
        line-height: 1.2;
    }

    .client-info-new p {
        margin: 0;
        color: var(--text-medium-dark);
        font-size: 13px; /* Reduced size */
        font-weight: 400;
    }

    .cover-main-new {
        flex-grow: 1; /* Allow main content to take available space */
        display: flex;
        flex-direction: column;
        gap: 20px; /* Reduced gap */
        width: 100%;
        margin-bottom: 20px; /* Reduced margin */
    }

    .cover-text-content {
        /* Takes full width */
    }

    .cover-text-content h2 {
        font-size: 22px; /* Reduced size */
        font-weight: 700;
        color: var(--primary-color);
        margin-bottom: 12px; /* Reduced margin */
        line-height: 1.3;
        position: relative;
        display: inline-block;
        padding-bottom: 6px; /* Reduced padding */
    }

    .cover-text-content h2::after {
        content: '';
        position: absolute;
        bottom: 0;
        left: 0;
        width: 45px; /* Reduced size */
        height: 3px;
        background-color: var(--accent-color);
        border-radius: 3px;
    }

    .cover-description-new {
        font-size: 14px; /* Reduced size */
        color: var(--secondary-color);
        line-height: 1.55; /* Adjusted line height */
        margin-bottom: 20px; /* Reduced margin */
        font-weight: 400;
        max-width: 100%;
    }

     .cover-description-new strong {
        color: var(--primary-color);
        font-weight: 600;
    }


    .components-legend-new {
        background-color: var(--background-light-accent);
        padding: 15px 20px; /* Reduced padding */
        border-radius: var(--border-radius);
        border: 1px solid var(--border-light);
    }

    .components-legend-new h3 {
        font-size: 14px; /* Reduced size */
        font-weight: 600;
        color: var(--primary-color);
        margin: 0 0 12px 0; /* Reduced margin */
        text-align: left;
    }

    .legend-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); /* Adjusted minmax */
        gap: 8px 15px; /* Reduced gap */
    }


    .component-item-new {
        display: flex;
        align-items: center;
        gap: 7px; /* Reduced gap */
    }

    .component-dot-new {
        width: 9px; /* Reduced size */
        height: 9px; /* Reduced size */
        border-radius: 50%;
        flex-shrink: 0;
        border: 1px solid rgba(0, 0, 0, 0.3);
    }

    .fuerza-color { background-color: var(--fuerza-color); }
    .hipertrofia-color { background-color: var(--hipertrofia-color); }
    .movilidad-color { background-color: var(--movilidad-color); }
    .potencia-color { background-color: var(--potencia-color); }
    .tecnica-color { background-color: var(--tecnica-color); }
    .cardio-color { background-color: var(--cardio-color); }

    .component-label-new {
        font-size: 12.5px; /* Reduced size */
        font-weight: 500;
        color: var(--secondary-color);
    }

    .component-label-new span {
        font-weight: 700;
        color: var(--primary-color);
        margin-left: 4px;
    }

    .cover-visuals-content {
        display: flex;
        flex-wrap: wrap; /* Allow wrapping */
        gap: 20px; /* Reduced gap */
        width: 100%;
        align-items: stretch; /* Make containers same height if on same row */
        flex-grow: 1; /* Allow this section to grow */
    }

    .chart-container-new {
        flex: 1 1 320px; /* Allow growing and shrinking, base width */
        background-color: var(--background-chart-container);
        border-radius: var(--border-radius-large);
        padding: 15px 20px 20px 20px; /* Reduced padding */
        box-shadow: var(--box-shadow-medium);
        border: 1px solid var(--border-medium);
        display: flex;
        flex-direction: column;
        min-width: 0; /* Prevent flex overflow */
        /* height: 360px; REMOVED fixed height */
        /* max-height: 360px; REMOVED fixed height */
        min-height: 280px; /* Add a minimum height */
    }

    .chart-title {
        font-size: 13.5px; /* Reduced size */
        font-weight: 600;
        color: var(--text-dark);
        margin: 0 0 10px 0; /* Reduced margin */
        text-align: center;
        flex-shrink: 0; /* Prevent title shrinking */
    }

    /* Ensure canvas parent takes remaining space */
     .chart-container-new > canvas {
        position: relative; /* Needed for Chart.js responsiveness */
        flex-grow: 1; /* Allow canvas to grow */
        max-width: 100%;
        /* max-height: calc(100% - 30px); REMOVED max-height */
        margin: auto;
        display: block;
        min-height: 200px; /* Minimum canvas height */
    }


    .cover-footer-new {
        width: 100%;
        text-align: center;
        padding-top: 10px; /* Reduced padding */
        margin-top: auto; /* Push footer to bottom */
        border-top: 1px solid var(--border-light);
        font-size: 10.5px; /* Reduced size */
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

    return `
    <script>
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

        try {
            const radarChart = new Chart(ctx, {
                type: 'radar',
                data: {
                    labels: ${JSON.stringify(labels)},
                    datasets: [{
                        label: 'Enfoque (%)',
                        data: ${JSON.stringify(chartData)},
                        backgroundColor: 'rgba(10, 42, 94, 0.3)',
                        borderColor: 'rgba(10, 42, 94, 0.9)',
                        borderWidth: 2,
                        pointBackgroundColor: 'rgba(10, 42, 94, 1)',
                        pointBorderColor: '#fff',
                        pointHoverBackgroundColor: '#fff',
                        pointHoverBorderColor: 'rgba(10, 42, 94, 1)',
                        pointRadius: 3, // Slightly smaller points
                        pointHoverRadius: 5
                    }]
                },
                options: {
                    scales: {
                        r: {
                            angleLines: { display: true, color: 'rgba(0, 0, 0, 0.1)' },
                            suggestedMin: 0,
                            suggestedMax: 100,
                            grid: { color: 'rgba(0, 0, 0, 0.1)' },
                            ticks: {
                                stepSize: 25, // Adjusted step size
                                color: 'rgba(0, 0, 0, 0.6)',
                                backdropColor: 'rgba(255, 255, 255, 0.75)',
                                padding: 6, // Reduced padding
                                font: { size: 9 } // Smaller font
                            },
                            pointLabels: {
                                font: { size: 11, weight: '500' }, // Adjusted font size
                                color: 'rgba(0, 0, 0, 0.85)'
                            }
                        }
                    },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            enabled: true,
                            backgroundColor: 'rgba(0, 0, 0, 0.85)',
                            titleFont: { size: 12, weight: 'bold' }, // Adjusted size
                            bodyFont: { size: 11 }, // Adjusted size
                            padding: 8, // Adjusted padding
                            boxPadding: 4,
                            cornerRadius: 4,
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
                    maintainAspectRatio: false
                }
            });
        } catch (error) {
             console.error("Error initializing Radar Chart:", error);
        }
      }

      if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', initRadarChart);
      } else {
          setTimeout(initRadarChart, 50); // Reduced timeout
      }
    </script>
    `;
}

/**
 * Genera el script de inicialización de Chart.js para el gráfico de BARRAS de volumen.
 * @param {Object} volumeData - Datos de volumen semanal por grupo muscular.
 * @returns {string} - Código JavaScript para inicializar el gráfico de barras.
 */
function getVolumeBarChartScript(volumeData) { // Renamed function
    const labels = Object.keys(volumeData);
    const data = Object.values(volumeData);

    const displayLabels = labels.length > 0 ? labels : ['No Data'];
    const displayData = data.length > 0 ? data : [0];

    // Define colors for bars (using CSS variables)
    const barColors = labels.map(label => {
        switch(label.toLowerCase()) {
            case 'pecho': return 'var(--fuerza-color)';
            case 'espalda': return 'var(--hipertrofia-color)';
            case 'hombro': return 'var(--potencia-color)';
            case 'biceps': return 'var(--tecnica-color)';
            case 'triceps': return 'var(--tecnica-color)'; // Same as biceps for arm grouping
            case 'pierna': return 'var(--movilidad-color)'; // Reusing colors
            case 'gluteo': return 'var(--movilidad-color)'; // Reusing colors
            case 'abdomen': return 'var(--accent-color)'; // Use accent
            case 'cardio': return 'var(--cardio-color)';
            case 'otro': return 'var(--otro-color)';
            default: return 'var(--secondary-color)';
        }
    });

    return `
    <script>
      function initVolumeBarChart() { // Renamed function
        const canvasElement = document.getElementById('volumeBarChart'); // Changed ID
        if (!canvasElement) {
          console.error("Canvas element #volumeBarChart not found.");
          return;
        }
        const ctx = canvasElement.getContext('2d');
         if (!ctx) {
            console.error("Failed to get 2D context from volume canvas.");
            return;
        }

        const volumeLabels = ${JSON.stringify(displayLabels)};
        const volumeDataPoints = ${JSON.stringify(displayData)};
        if (volumeLabels.length === 1 && volumeLabels[0] === 'No Data') {
            ctx.font = "14px 'Inter', sans-serif"; // Adjusted size
            ctx.fillStyle = '#888';
            ctx.textAlign = 'center';
            ctx.fillText("No se pudo calcular el volumen.", canvasElement.width / 2, canvasElement.height / 2);
            console.warn("No volume data to display in bar chart.");
            return;
        }

        try {
            const volumeChart = new Chart(ctx, {
                type: 'bar', // Changed type to 'bar'
                data: {
                    labels: volumeLabels,
                    datasets: [{
                        label: 'Series Semanales',
                        data: volumeDataPoints,
                        backgroundColor: ${JSON.stringify(barColors)}, // Use dynamic colors
                        borderColor: 'rgba(0, 0, 0, 0.1)', // Optional: light border
                        borderWidth: 1
                    }]
                },
                options: {
                    scales: {
                        y: {
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: 'Número de Series',
                                font: { size: 11 }, // Adjusted size
                                color: '#666'
                            },
                            ticks: {
                                color: 'rgba(0, 0, 0, 0.7)',
                                precision: 0,
                                font: { size: 10 } // Adjusted size
                            },
                             grid: {
                                color: 'rgba(0, 0, 0, 0.08)'
                            }
                        },
                        x: {
                             ticks: {
                                color: 'rgba(0, 0, 0, 0.7)',
                                font: { size: 10 } // Adjusted size
                            },
                             grid: {
                                display: false
                            }
                        }
                    },
                    plugins: {
                        legend: {
                           display: false // Hide legend for bar chart (colors imply group)
                        },
                        tooltip: {
                            enabled: true,
                            backgroundColor: 'rgba(0, 0, 0, 0.85)',
                            titleFont: { size: 12, weight: 'bold' }, // Adjusted size
                            bodyFont: { size: 11 }, // Adjusted size
                            padding: 8, // Adjusted padding
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
             console.error("Error initializing Volume Bar Chart:", error);
        }
      }

      if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', initVolumeBarChart);
      } else {
          setTimeout(initVolumeBarChart, 50); // Reduced timeout
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
    const scores = calculateTrainingComponentScores(routineHtml);
    const volumeData = calculateWeeklyVolume(routineHtml);
    let fullCoverPageHtml = generateCoverPageHtml(scores, clientName);

    if (logoBase64 && logoBase64.startsWith('data:image')) {
        fullCoverPageHtml = fullCoverPageHtml.replace('LOGO_BASE_64_PLACEHOLDER', logoBase64);
    } else {
        fullCoverPageHtml = fullCoverPageHtml.replace(/<img class="cover-logo-new".*?>/g, '');
        console.warn("Valid Logo Base64 not provided or invalid format. Removing logo element.");
    }

    const styles = getCoverPageStyles();
    const radarScript = getRadarChartScript(scores);
    const volumeScript = getVolumeBarChartScript(volumeData); // Use bar chart script

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
        volumeData
    };
}

// Export the main function (assuming Node.js environment)
// If in browser, these functions would be globally available or attached to a namespace
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        calculateTrainingComponentScores,
        calculateWeeklyVolume,
        createCoverPage,
        // Also export generators if needed individually
        generateCoverPageHtml,
        getCoverPageStyles,
        getRadarChartScript,
        getVolumeBarChartScript
    };
}
