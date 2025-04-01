// const puppeteer = require('puppeteer'); // Keep if needed by the calling script, but not used directly here.
// Consider using a DOM parsing library like cheerio if available for more robust HTML parsing.
// const cheerio = require('cheerio');

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
                // Use word boundaries (\b) and case-insensitive flag (i)
                // Escape special regex characters in keyword if necessary (though current keywords seem safe)
                const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
                const matches = routineHtml.match(regex) || [];
                counts[component] += matches.length;
            } catch (e) {
                console.warn(`Invalid regex for keyword: ${keyword}`, e);
            }
        });
    });

    // --- Additional Heuristics ---

    // 1. Rep Range Analysis (More weight to sets x reps patterns)
    // Matches like "3x10", "4 x 8-12", "5 sets de 5 reps"
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
                else if (maxReps <= 15) midRepSets += numSets; // Adjusted range for hypertrophy/general fitness
                else highRepSets += numSets;
            }
        }
    });

    // Simple rep mentions (less reliable)
    const simpleRepMatches = routineHtml.match(/(\d+)\s+reps?/gi) || [];
     simpleRepMatches.forEach(match => {
         const repNumbers = match.match(/\d+/g);
         if (repNumbers) {
             const maxReps = Math.max(...repNumbers.map(Number));
             // Add less weight compared to sets x reps
             if (maxReps <= 6) lowRepSets += 0.5;
             else if (maxReps <= 15) midRepSets += 0.5;
             else highRepSets += 0.5;
         }
     });


    counts.fuerza += lowRepSets * 2; // Boost strength for low reps
    counts.hipertrofia += midRepSets * 1.5; // Boost hypertrophy for mid reps
    counts.cardio += highRepSets * 1; // Boost cardio/endurance for high reps

    // 2. Specific Exercise Keywords (Increased Weight)
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
                const regex = new RegExp(ex.replace(/\s+/g, '\\s+'), 'gi'); // Match exercise name case-insensitively
                const matches = routineHtml.match(regex) || [];
                counts[component] += matches.length * 2.5; // Give more weight to specific exercises
            } catch (e) {
                console.warn(`Invalid regex for exercise: ${ex}`, e);
            }
        });
    });

    // 3. Intensity/Tempo Indicators
    if (routineHtml.match(/RIR\s+[0-2]/gi)) { counts.fuerza += 3; counts.hipertrofia += 5; } // High intensity -> Strength/Hypertrophy
    if (routineHtml.match(/RIR\s+[3-4]/gi)) { counts.hipertrofia += 3; } // Moderate intensity
    if (routineHtml.match(/RPE\s+[8-9]/gi)) { counts.fuerza += 2; counts.hipertrofia += 4; } // High RPE
    if (routineHtml.match(/RPE\s+[6-7]/gi)) { counts.hipertrofia += 2; } // Moderate RPE
    if (routineHtml.match(/tempo.*[xX]/gi)) { counts.potencia += 6; } // Explosive tempo
    if (routineHtml.match(/tempo\s+\d{4,}/gi)) { counts.tecnica += 3; counts.hipertrofia += 2; } // Controlled tempo (e.g., 4010) -> Technique/Hypertrophy
    if (routineHtml.match(/descanso\s+(corto|30s|45s|60s)/gi)) { counts.hipertrofia += 1; counts.cardio += 1; } // Shorter rest
    if (routineHtml.match(/descanso\s+(largo|90s|120s|2-3\s*min)/gi)) { counts.fuerza += 2; } // Longer rest

    // --- Normalization ---
    const totalCount = Object.values(counts).reduce((sum, count) => sum + Math.max(0, count), 0); // Ensure counts are non-negative

    if (totalCount === 0) {
        console.warn("Total count for normalization is zero, returning default balanced scores.");
        // Return default balanced scores if no relevant keywords/heuristics found
        return {
            fuerza: 50, hipertrofia: 50, movilidad: 50,
            potencia: 50, tecnica: 50, cardio: 50,
            mainComponents: [], mainComponentsDisplay: 'Equilibrado'
        };
    }

    // Calculate normalized scores (0-100)
    Object.keys(counts).forEach(component => {
        scores[component] = Math.round((Math.max(0, counts[component]) / totalCount) * 100);
    });

    // --- Smoothing and Thresholding ---
    // Apply a minimum threshold to avoid zero scores if *any* count was registered
    const minThreshold = 5; // Reduced threshold
    let totalScore = 0;
    Object.keys(scores).forEach(component => {
        if (counts[component] > 0 && scores[component] < minThreshold) {
            scores[component] = minThreshold;
        }
        // Ensure scores don't exceed 100 (can happen with thresholding)
         scores[component] = Math.min(scores[component], 100);
         totalScore += scores[component];
    });

    // Optional: Re-normalize if the total score significantly deviates from 100 due to thresholding
    if (totalScore > 0 && Math.abs(totalScore - 100) > 10) { // Only re-normalize if significantly off
        const scaleFactor = 100 / totalScore;
        Object.keys(scores).forEach(component => {
            scores[component] = Math.round(scores[component] * scaleFactor);
            // Re-apply min threshold carefully if needed, or just cap at 100
             scores[component] = Math.max( (counts[component] > 0 ? minThreshold : 0) , Math.min(scores[component], 100));
        });
    }

     // Final check to ensure total is roughly 100 (adjust largest if needed)
     let finalTotal = Object.values(scores).reduce((sum, score) => sum + score, 0);
     if (finalTotal !== 100 && finalTotal > 0) {
         let diff = 100 - finalTotal;
         let maxComp = Object.keys(scores).reduce((a, b) => scores[a] > scores[b] ? a : b);
         scores[maxComp] = Math.min(100, Math.max(0, scores[maxComp] + diff)); // Adjust largest score
     }


    // --- Determine Main Components ---
    let maxScore = 0;
    let mainComponents = [];
    Object.entries(scores).forEach(([component, score]) => {
        // Consider a component "main" if it's above a certain threshold AND close to the max
        if (score >= 25) { // Example threshold for being considered significant
             if (score > maxScore) {
                 maxScore = score;
                 mainComponents = [component];
             } else if (score === maxScore) {
                 mainComponents.push(component);
             }
         }
    });
     // If multiple components share the max score, include them
     Object.entries(scores).forEach(([component, score]) => {
         if (score === maxScore && !mainComponents.includes(component)) {
              mainComponents.push(component);
         }
     });


    scores.mainComponents = mainComponents;
    scores.mainComponentsDisplay = mainComponents.length > 0
        ? mainComponents.map(c => c.charAt(0).toUpperCase() + c.slice(1)).join(', ')
        : 'Equilibrado'; // Default if no clear main component

    console.log("Calculated Scores:", scores);
    return scores;
}


/**
 * Calculates approximate weekly volume (total sets) per muscle group from routine HTML.
 * NOTE: This is a simplified approach using regex. A DOM parser would be more robust.
 * @param {string} routineHtml - The HTML content of the generated routine.
 * @returns {Object} - An object with muscle groups as keys and total weekly sets as values.
 */
function calculateWeeklyVolume(routineHtml) {
    const volume = {
        Pecho: 0, Espalda: 0, Hombro: 0, // Changed from 'Hombros'
        Biceps: 0, Triceps: 0, Pierna: 0, // Changed from 'Piernas'
        Gluteo: 0, // Changed from 'Glúteos'
        Abdomen: 0, // Changed from 'Abdominales'
        Cardio: 0, // Added Cardio sets/sessions
        Otro: 0 // Catch-all
    };

    if (!routineHtml || routineHtml.trim() === '') {
        console.warn("No routine HTML provided for volume calculation.");
        return volume;
    }

    // --- Muscle Group Keywords ---
    // Map keywords/exercises to muscle groups
    const muscleGroupKeywords = {
        Pecho: ['pecho', 'chest', 'press de banca', 'bench press', 'aperturas', 'flyes', 'flexiones', 'push-up'],
        Espalda: ['espalda', 'back', 'remo', 'row', 'dominadas', 'pull-up', 'chin-up', 'pulldown', 'peso muerto', 'deadlift', 'dorsal'], // DL hits back
        Hombro: ['hombro', 'shoulder', 'press militar', 'overhead press', 'elevaciones laterales', 'lateral raise', 'elevaciones frontales', 'front raise', 'pájaros', 'rear delt fly'],
        Biceps: ['biceps', 'bíceps', 'curl'],
        Triceps: ['triceps', 'tríceps', 'extensiones', 'extension', 'fondos', 'dips', 'press francés', 'french press'],
        Pierna: ['pierna', 'leg', 'cuádriceps', 'quadriceps', 'femoral', 'hamstring', 'gemelo', 'calf', 'sentadilla', 'squat', 'prensa', 'leg press', 'zancadas', 'lunges', 'leg curl', 'leg extension'],
        Gluteo: ['glúteo', 'glute', 'hip thrust', 'puente de glúteo', 'glute bridge', 'patada de glúteo', 'kickback'],
        Abdomen: ['abdomen', 'abdominales', 'abs', 'core', 'plancha', 'plank', 'crunches', 'elevaciones de piernas', 'leg raise'],
        Cardio: ['cardio', 'correr', 'run', 'bicicleta', 'bike', 'cinta', 'treadmill', 'eliptica', 'elliptical', 'nadar', 'swim', 'remar', 'rowing', 'hiit', 'intervalos']
    };

    // --- Parsing Logic (using Regex - simplified) ---
    // Find sections likely representing exercises (e.g., list items, table rows, paragraphs with specific patterns)
    // This regex is a guess and highly dependent on the HTML structure
    const exerciseBlocks = routineHtml.match(/<(li|tr|p)[^>]*>.*?(\d+)\s*x\s*(\d+(?:-\d+)?).*?</gis) || [];

    if (exerciseBlocks.length === 0) {
         console.warn("Could not find clear exercise blocks (e.g., '<li>... 3x10 ...</li>'). Volume calculation might be inaccurate.");
         // Basic fallback: Count mentions of set numbers? Very unreliable.
    }

    exerciseBlocks.forEach(block => {
        // Extract sets (e.g., the '3' from '3x10')
        const setMatch = block.match(/(\d+)\s*x\s*\d+/i); // Find the first number before 'x'
        const sets = setMatch ? parseInt(setMatch[1], 10) : 0;

        if (sets > 0) {
            let assigned = false;
            // Check keywords within the block to assign to a muscle group
            for (const group in muscleGroupKeywords) {
                for (const keyword of muscleGroupKeywords[group]) {
                    try {
                        const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
                        if (regex.test(block)) {
                            volume[group] += sets;
                            assigned = true;
                            break; // Assign to the first matching group found in this block
                        }
                    } catch (e) {
                        console.warn(`Invalid regex for volume keyword: ${keyword}`, e);
                    }
                }
                if (assigned) break; // Move to next block once assigned
            }
            // If no specific keyword found, assign to 'Otro'
            if (!assigned) {
                volume.Otro += sets;
            }
        }
    });

     // Simple count for cardio sessions if not captured by sets x reps
     let cardioSessionCount = 0;
     muscleGroupKeywords.Cardio.forEach(keyword => {
         try {
             const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
             const matches = routineHtml.match(regex) || [];
             cardioSessionCount += matches.length;
         } catch (e) {
             // ignore
         }
     });
     // Avoid double counting if cardio exercises had sets (e.g., HIIT intervals)
     if (volume.Cardio === 0 && cardioSessionCount > 0) {
         volume.Cardio = Math.max(1, Math.round(cardioSessionCount / 3)); // Estimate sessions
     }


    console.log("Calculated Weekly Volume (Sets per Group):", volume);
    // Filter out groups with 0 sets for cleaner table display
    const filteredVolume = {};
    for(const group in volume) {
        if (volume[group] > 0) {
            filteredVolume[group] = volume[group];
        }
    }
    return filteredVolume;
}

/**
 * Generates HTML for the weekly volume table.
 * @param {Object} volumeData - Object with muscle groups and their total weekly sets.
 * @returns {string} - HTML string for the volume table.
 */
function generateVolumeTableHtml(volumeData) {
    if (Object.keys(volumeData).length === 0) {
        return '<p class="volume-no-data">No se pudo calcular el volumen semanal detallado.</p>';
    }

    let tableHtml = `
    <div class="volume-table-container">
      <h3 class="volume-table-title">Volumen Semanal Estimado (Series)</h3>
      <table class="volume-table">
        <thead>
          <tr>
            <th>Grupo Muscular</th>
            <th>Series Totales</th>
          </tr>
        </thead>
        <tbody>
  `;

    // Sort for consistency (optional)
    const sortedGroups = Object.keys(volumeData).sort();

    sortedGroups.forEach(group => {
        tableHtml += `
        <tr>
          <td>${group}</td>
          <td>${volumeData[group]}</td>
        </tr>
      `;
    });

    tableHtml += `
        </tbody>
      </table>
    </div>
  `;
    return tableHtml;
}

/**
 * Genera el HTML del gráfico radar y la tabla de volumen para la portada.
 * @param {Object} scores - Puntuaciones de componentes de entrenamiento.
 * @param {Object} volumeData - Datos de volumen semanal por grupo muscular.
 * @param {string} clientName - Nombre del cliente.
 * @returns {string} - HTML para la portada.
 */
function generateCoverPageHtml(scores, volumeData, clientName = 'Cliente') {
    const date = new Date().toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    // Dynamic description based on main components
    let description = `Hola ${clientName}, este es un resumen de tu nuevo plan de entrenamiento. `;
    if (scores.mainComponents && scores.mainComponents.length > 0) {
        description += `El enfoque principal está en **${scores.mainComponentsDisplay}** para ayudarte a alcanzar tus objetivos. El gráfico y la tabla a continuación detallan la distribución del enfoque y el volumen semanal estimado.`;
    } else {
        description += `Está diseñado para proporcionarte un desarrollo equilibrado. El gráfico y la tabla a continuación detallan la distribución del enfoque y el volumen semanal estimado.`;
    }

    // Generate volume table HTML
    const volumeTableHtmlContent = generateVolumeTableHtml(volumeData);

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
                <div class="legend-column">
                    <div class="component-item-new">
                        <div class="component-dot-new fuerza-color"></div>
                        <div class="component-label-new">Fuerza: <span>${scores.fuerza}%</span></div>
                    </div>
                    <div class="component-item-new">
                        <div class="component-dot-new hipertrofia-color"></div>
                        <div class="component-label-new">Hipertrofia: <span>${scores.hipertrofia}%</span></div>
                    </div>
                    <div class="component-item-new">
                        <div class="component-dot-new movilidad-color"></div>
                        <div class="component-label-new">Movilidad: <span>${scores.movilidad}%</span></div>
                    </div>
                </div>
                <div class="legend-column">
                    <div class="component-item-new">
                        <div class="component-dot-new potencia-color"></div>
                        <div class="component-label-new">Potencia: <span>${scores.potencia}%</span></div>
                    </div>
                    <div class="component-item-new">
                        <div class="component-dot-new tecnica-color"></div>
                        <div class="component-label-new">Técnica: <span>${scores.tecnica}%</span></div>
                    </div>
                    <div class="component-item-new">
                        <div class="component-dot-new cardio-color"></div>
                        <div class="component-label-new">Cardio: <span>${scores.cardio}%</span></div>
                    </div>
                </div>
            </div>
        </div>
        <div class="cover-visuals-content">
             <div class="radar-chart-container-new">
               <canvas id="radarChart"></canvas>
             </div>
             ${volumeTableHtmlContent}
        </div>
      </div>

      <div class="cover-footer-new">
          <p>© ${new Date().getFullYear()} Fitform - Todos los derechos reservados</p>
      </div>
    </div>
    `;
}


/**
 * Genera estilos CSS para la portada (incluyendo gráfico y tabla de volumen).
 * @returns {string} - Estilos CSS.
 */
function getCoverPageStyles() {
    // Combined and refined styles for cover page elements
    return `
    /* Estilos Mejorados Portada Completa */
    :root {
        /* Define color variables (adjust as needed) */
        --primary-color: #0a2a5e; /* Dark Blue */
        --secondary-color: #1e477e; /* Medium Blue */
        --accent-color: #3498db;   /* Bright Blue */
        --text-light: #ffffff;
        --text-medium: rgba(255, 255, 255, 0.85);
        --text-dark: rgba(0, 0, 0, 0.85);
        --border-light: rgba(255, 255, 255, 0.15);
        --border-dark: rgba(0, 0, 0, 0.1);
        --background-light-accent: rgba(255, 255, 255, 0.06);
        --background-chart-container: rgba(255, 255, 255, 0.98);
        --border-radius: 8px;
        --border-radius-large: 10px;
    }

    .cover-page-new {
        position: relative;
        display: flex;
        flex-direction: column;
        min-height: 100vh; /* Ensure full page height for PDF rendering */
        width: 100%;
        padding: 45px 55px; /* Adjusted padding */
        background: linear-gradient(140deg, var(--primary-color) 0%, var(--secondary-color) 100%);
        color: var(--text-light);
        box-sizing: border-box;
        font-family: 'Inter', 'Arial', sans-serif;
        page-break-after: always; /* Ensure it's on its own page in PDF */
        overflow: hidden; /* Prevent potential overflow issues */
    }

    .cover-header-new {
        width: 100%;
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 35px; /* Reduced margin */
        border-bottom: 1px solid var(--border-light);
        padding-bottom: 20px;
    }

    .cover-logo-new {
        width: 130px; /* Slightly smaller logo */
        height: auto;
        filter: brightness(0) invert(1); /* Ensure logo is white */
        opacity: 0.9;
    }

    .client-info-new {
        text-align: right;
    }

    .client-info-new h1 {
        font-size: 30px; /* Adjusted size */
        font-weight: 700;
        color: var(--text-light);
        margin: 0 0 6px 0;
        line-height: 1.2;
    }

    .client-info-new p {
        margin: 0;
        color: var(--text-medium);
        font-size: 15px;
        font-weight: 400;
    }

    .cover-main-new {
        flex-grow: 1; /* Allow main content to fill space */
        display: flex;
        align-items: stretch; /* Align items to stretch vertically */
        justify-content: space-between;
        gap: 45px; /* Adjusted gap */
        width: 100%;
        margin-bottom: 40px; /* Space above footer */
        overflow: hidden; /* Prevent content overflow */
    }

    .cover-text-content {
        flex: 1 1 45%; /* Flex basis 45%, allow grow/shrink */
        max-width: 45%;
        display: flex;
        flex-direction: column;
        justify-content: center; /* Center text vertically */
    }

     .cover-visuals-content {
        flex: 1 1 50%; /* Flex basis 50% */
        max-width: 50%;
        display: flex;
        flex-direction: column;
        gap: 25px; /* Space between chart and table */
        justify-content: center; /* Center visuals vertically */
    }

    .cover-text-content h2 {
        font-size: 28px; /* Adjusted size */
        font-weight: 700;
        color: var(--text-light);
        margin-bottom: 20px;
        line-height: 1.3;
        position: relative;
        display: inline-block; /* For ::after positioning */
        padding-bottom: 8px; /* Space for underline */
    }

    .cover-text-content h2::after {
        content: '';
        position: absolute;
        bottom: 0;
        left: 0;
        width: 60px;
        height: 3px;
        background-color: var(--accent-color);
        border-radius: 3px;
    }

    .cover-description-new {
        font-size: 16px; /* Adjusted size */
        color: var(--text-medium);
        line-height: 1.7;
        margin-bottom: 30px;
        font-weight: 400;
    }

    .cover-description-new strong {
        color: var(--text-light);
        font-weight: 600;
    }

    .components-legend-new {
        display: flex;
        gap: 30px;
        background-color: var(--background-light-accent);
        padding: 20px;
        border-radius: var(--border-radius);
        border: 1px solid var(--border-light);
        margin-top: auto; /* Push legend towards bottom if text is short */
    }

    .legend-column {
        display: flex;
        flex-direction: column;
        gap: 12px; /* Adjusted gap */
    }

    .component-item-new {
        display: flex;
        align-items: center;
        gap: 10px;
    }

    .component-dot-new {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        flex-shrink: 0;
        border: 1px solid rgba(255, 255, 255, 0.3);
    }

    /* Component Colors */
    .fuerza-color { background-color: #3498db; }
    .hipertrofia-color { background-color: #2ecc71; }
    .movilidad-color { background-color: #f1c40f; }
    .potencia-color { background-color: #e74c3c; }
    .tecnica-color { background-color: #9b59b6; }
    .cardio-color { background-color: #e67e22; }

    .component-label-new {
        font-size: 14px; /* Adjusted size */
        font-weight: 500;
        color: var(--text-medium);
    }

    .component-label-new span {
        font-weight: 700;
        color: var(--text-light);
        margin-left: 4px;
    }

    .radar-chart-container-new {
        /* flex: 1 1 auto; Allow shrinking but prioritize height */
        height: 300px; /* Fixed height for chart container */
        max-height: 300px; /* Ensure it doesn't grow too tall */
        background-color: var(--background-chart-container);
        border-radius: var(--border-radius-large);
        padding: 20px; /* Reduced padding */
        box-shadow: 0 8px 25px rgba(0, 0, 0, 0.08);
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden; /* Prevent canvas overflow */
    }

    #radarChart {
        max-width: 100%;
        max-height: 100%;
    }

    /* Volume Table Styles */
    .volume-table-container {
       /* flex: 0 1 auto; /* Don't grow, allow shrinking, auto basis */
       background-color: rgba(255, 255, 255, 0.1); /* Semi-transparent background */
       border-radius: var(--border-radius);
       padding: 15px 20px;
       border: 1px solid var(--border-light);
       max-height: 200px; /* Max height for the table container */
       overflow-y: auto; /* Add scroll if content exceeds max-height */
       color: var(--text-light); /* Ensure text is light */
    }

     .volume-table-title {
        font-size: 16px;
        font-weight: 600;
        margin: 0 0 12px 0;
        color: var(--text-light);
        text-align: center;
     }

    .volume-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 13px; /* Smaller font for table */
    }

    .volume-table th, .volume-table td {
        text-align: left;
        padding: 8px 10px; /* Adjusted padding */
        border-bottom: 1px solid var(--border-light);
    }

     .volume-table th {
        font-weight: 600;
        color: var(--text-medium);
     }

     .volume-table tbody tr:last-child td {
         border-bottom: none;
     }

     .volume-table td:last-child {
         text-align: right;
         font-weight: 600;
     }

     .volume-no-data {
         font-size: 14px;
         color: var(--text-medium);
         text-align: center;
         padding: 20px;
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
 * @returns {string} - Código JavaScript para inicializar el gráfico.
 */
function getRadarChartScript(scores) {
    // Convert scores object to array in the correct order for Chart.js
    const chartData = [
        scores.fuerza, scores.hipertrofia, scores.movilidad,
        scores.potencia, scores.tecnica, scores.cardio
    ];

    // Chart.js initialization script
    return `
    <script src="https://cdn.jsdelivr.net/npm/chart.js@3.7.1/dist/chart.min.js"></script>
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
           console.error("Failed to get 2D context from canvas.");
           return;
        }

        // Chart.js Configuration - Adjusted for better display on light background
        try {
            const radarChart = new Chart(ctx, {
              type: 'radar',
              data: {
                labels: ['Fuerza', 'Hipertrofia', 'Movilidad', 'Potencia', 'Técnica', 'Cardio'],
                datasets: [{
                  label: 'Perfil de Entrenamiento',
                  data: ${JSON.stringify(chartData)}, // Use data array
                  backgroundColor: 'rgba(10, 42, 94, 0.25)', // Primary color with adjusted alpha
                  borderColor: 'rgba(10, 42, 94, 0.85)',     // Darker, more opaque border
                  borderWidth: 2, // Slightly thinner border
                  pointBackgroundColor: 'rgba(10, 42, 94, 1)', // Solid points
                  pointBorderColor: '#fff',                 // White border around points
                  pointHoverBackgroundColor: '#fff',
                  pointHoverBorderColor: 'rgba(10, 42, 94, 1)',
                  pointRadius: 3.5, // Adjusted point radius
                  pointHoverRadius: 5.5 // Adjusted hover radius
                }]
              },
              options: {
                scales: {
                  r: { // Radial axis (spokes)
                    angleLines: { // Lines radiating from the center
                      display: true,
                      color: 'rgba(0, 0, 0, 0.1)' // Light gray lines
                    },
                    suggestedMin: 0,
                    suggestedMax: 100,
                    grid: { // Lines forming the web
                      color: 'rgba(0, 0, 0, 0.1)' // Light gray lines
                    },
                    ticks: { // Numbers on the axis (0, 20, 40...)
                      stepSize: 20,
                      color: 'rgba(0, 0, 0, 0.6)', // Darker gray for numbers
                      backdropColor: 'rgba(255, 255, 255, 0.75)', // Semi-transparent white backdrop for ticks
                      padding: 8 // Adjusted padding
                    },
                    pointLabels: { // Labels around the edge (Strength, Cardio...)
                      font: {
                        size: 12.5, // Adjusted label size
                        weight: '600' // Semi-bold
                      },
                      color: 'rgba(0, 0, 0, 0.85)' // Dark text for labels
                    }
                  }
                },
                plugins: {
                  legend: {
                    display: false // Legend is handled separately in HTML
                  },
                  tooltip: {
                    enabled: true,
                    backgroundColor: 'rgba(0, 0, 0, 0.85)', // Dark tooltip
                    titleFont: { size: 13, weight: 'bold' },
                    bodyFont: { size: 12 },
                    padding: 10, // Adjusted padding
                    boxPadding: 4,
                    cornerRadius: 4 // Rounded corners for tooltip
                  }
                },
                responsive: true,
                maintainAspectRatio: false // Crucial for fitting container
              }
            });
        } catch (error) {
             console.error("Error initializing Chart.js:", error);
        }
      }

      // Ensure chart initializes after DOM is ready,
      // especially important when content is dynamically set by Puppeteer.
      if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', initRadarChart);
      } else {
          // DOMContentLoaded has already fired
          initRadarChart();
      }
    </script>
    `;
}


/**
 * Creates a complete cover page including radar chart and volume table.
 * @param {string} routineHtml - The HTML content of the routine.
 * @param {string} clientName - The client's name.
 * @param {string} logoBase64 - Base64 encoded logo image.
 * @returns {object} - Object containing fullCoverPageHtml, styles, script, scores, and volumeData.
 */
function createCoverPage(routineHtml, clientName, logoBase64) {
    // 1. Calculate component scores
    const scores = calculateTrainingComponentScores(routineHtml);

    // 2. Calculate weekly volume
    const volumeData = calculateWeeklyVolume(routineHtml);

    // 3. Generate cover page HTML (including chart canvas and volume table placeholder)
    let fullCoverPageHtml = generateCoverPageHtml(scores, volumeData, clientName);

    // 4. Replace logo placeholder
    if (logoBase64 && logoBase64.startsWith('data:image')) {
        fullCoverPageHtml = fullCoverPageHtml.replace('LOGO_BASE_64_PLACEHOLDER', logoBase64);
    } else {
        // Remove the img tag if no valid logo is provided
        fullCoverPageHtml = fullCoverPageHtml.replace(/<img class="cover-logo-new".*?>/g, '');
        console.warn("Valid Logo Base64 not provided or invalid format. Removing logo element.");
    }

    // 5. Get combined CSS styles
    const styles = getCoverPageStyles();

    // 6. Get Chart.js initialization script
    const script = getRadarChartScript(scores);

    return {
        fullCoverPageHtml, // The complete HTML for the page
        styles,            // CSS styles for the page
        script,            // JavaScript for the radar chart
        scores,            // Calculated component scores
        volumeData         // Calculated volume data
    };
}

// Export the main function and potentially others if needed elsewhere
module.exports = {
    calculateTrainingComponentScores, // Keep if used independently
    calculateWeeklyVolume,           // Keep if used independently
    createCoverPage
};


