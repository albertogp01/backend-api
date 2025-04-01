// chartService.js (Análisis Estructural Volumen por Día + Logging - CORREGIDO v10)

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
        console.warn("[Scores Calculation] No routine HTML provided, returning default balanced scores.");
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
                console.warn(`[Scores Calculation] Invalid regex for keyword: ${keyword}`, e);
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
            // Heuristic: Assume the first number is sets if it's reasonable (e.g., < 10)
            // and the second number looks like reps (e.g., > 1 or a range).
            // This is imperfect but tries to handle common "Sets x Reps" formats.
            const potentialSets = parseInt(numbers[0], 10);
            const potentialReps = numbers[1]; // Keep as string to check for range '-'
            if (!isNaN(potentialSets) && potentialSets > 0 && potentialSets < 10) { // Check if first number looks like sets
                 const repRange = potentialReps.split('-').map(Number);
                 const maxReps = Math.max(...repRange);
                 if (!isNaN(maxReps)) {
                    if (maxReps <= 6) lowRepSets += potentialSets;
                    else if (maxReps <= 15) midRepSets += potentialSets;
                    else highRepSets += potentialSets;
                 }
            }
        }
    });
    // Simple rep mentions (less reliable for sets, used for component scoring)
     const simpleRepMatches = routineHtml.match(/(\d+)\s+reps?/gi) || [];
     simpleRepMatches.forEach(match => {
         const repNumbers = match.match(/\d+/g);
         if (repNumbers) {
             const maxReps = Math.max(...repNumbers.map(Number));
             if (maxReps <= 6) lowRepSets += 0.5; // Add fractional count for scoring
             else if (maxReps <= 15) midRepSets += 0.5;
             else highRepSets += 0.5;
         }
     });

    counts.fuerza += lowRepSets * 2;
    counts.hipertrofia += midRepSets * 1.5;
    counts.cardio += highRepSets * 1; // High reps contribute a bit to cardio score

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
                const safeEx = ex.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                const regex = new RegExp(safeEx.replace(/\s+/g, '\\s+'), 'gi');
                const matches = routineHtml.match(regex) || [];
                counts[component] += matches.length * 2.5; // Weight specific exercises more
            } catch (e) {
                console.warn(`[Scores Calculation] Invalid regex for exercise: ${ex}`, e);
            }
        });
    });

    // 3. Intensity/Tempo Indicators
    if (routineHtml.match(/RIR\s+[0-2]/gi)) { counts.fuerza += 3; counts.hipertrofia += 5; }
    if (routineHtml.match(/RIR\s+[3-4]/gi)) { counts.hipertrofia += 3; }
    if (routineHtml.match(/RPE\s+[8-9]/gi)) { counts.fuerza += 2; counts.hipertrofia += 4; }
    if (routineHtml.match(/RPE\s+[6-7]/gi)) { counts.hipertrofia += 2; }
    if (routineHtml.match(/tempo.*[xX]/gi)) { counts.potencia += 6; } // Explosive tempo
    if (routineHtml.match(/tempo\s+\d{4,}/gi)) { counts.tecnica += 3; counts.hipertrofia += 2; } // Controlled tempo
    if (routineHtml.match(/descanso\s+(corto|30s|45s|60s)/gi)) { counts.hipertrofia += 1; counts.cardio += 1; }
    if (routineHtml.match(/descanso\s+(largo|90s|120s|2-3\s*min)/gi)) { counts.fuerza += 2; }

    // --- Normalization ---
    const totalCount = Object.values(counts).reduce((sum, count) => sum + Math.max(0, count), 0);

    if (totalCount === 0) {
        console.warn("[Scores Calculation] Total count for normalization is zero, returning default balanced scores.");
        // Return default balanced scores if no keywords/heuristics matched
        return {
            fuerza: 50, hipertrofia: 50, movilidad: 50,
            potencia: 50, tecnica: 50, cardio: 50,
            mainComponents: [], mainComponentsDisplay: 'Equilibrado'
        };
    }

    // Calculate initial percentage scores
    Object.keys(counts).forEach(component => {
        scores[component] = Math.round((Math.max(0, counts[component]) / totalCount) * 100);
    });

    // --- Smoothing and Thresholding ---
    const minThreshold = 5; // Minimum score if any count was found
    let totalScore = 0;
    Object.keys(scores).forEach(component => {
        // If component had counts but score is below threshold, set to threshold
        if (counts[component] > 0 && scores[component] < minThreshold) {
            scores[component] = minThreshold;
        }
        // Ensure score doesn't exceed 100
        scores[component] = Math.min(scores[component], 100);
        totalScore += scores[component];
    });

    // Re-normalize if total score significantly deviates from 100 after thresholding
    if (totalScore > 0 && Math.abs(totalScore - 100) > 10) { // Allow some tolerance
        const scaleFactor = 100 / totalScore;
        Object.keys(scores).forEach(component => {
            scores[component] = Math.round(scores[component] * scaleFactor);
             // Re-apply threshold and cap at 100
            scores[component] = Math.max( (counts[component] > 0 ? minThreshold : 0) , Math.min(scores[component], 100));
        });
    }

     // Final adjustment to ensure sum is exactly 100
     let finalTotal = Object.values(scores).reduce((sum, score) => sum + score, 0);
     if (finalTotal !== 100 && finalTotal > 0) {
         let diff = 100 - finalTotal;
         // Distribute difference starting from the component with the highest score
         let sortedComponents = Object.keys(scores).sort((a, b) => scores[b] - scores[a]);

         // Adjust the largest component(s) carefully
         scores[sortedComponents[0]] = Math.min(100, Math.max(0, scores[sortedComponents[0]] + diff));

         // Recalculate total and adjust second largest if still needed (rare)
         finalTotal = Object.values(scores).reduce((sum, score) => sum + score, 0);
         if (finalTotal !== 100) {
             let secondDiff = 100 - finalTotal;
             // Ensure there's a second component to adjust
             if (sortedComponents.length > 1) {
                scores[sortedComponents[1]] = Math.min(100, Math.max(0, scores[sortedComponents[1]] + secondDiff));
             } else {
                 // If only one component, force it to 100 (edge case)
                 scores[sortedComponents[0]] = 100;
             }
         }
     }

    // --- Determine Main Components ---
    let maxScore = 0;
    let mainComponents = [];
    const significanceThreshold = 25; // Threshold to be considered a "main" component
    Object.entries(scores).forEach(([component, score]) => {
         if (score >= significanceThreshold) {
             if (score > maxScore) {
                 maxScore = score;
                 mainComponents = [component]; // New max, reset list
             } else if (score === maxScore && !mainComponents.includes(component)) {
                 mainComponents.push(component); // Add ties
             }
         }
    });
      // If no component reached the threshold, find the highest score(s) anyway
      if (mainComponents.length === 0) {
          maxScore = Math.max(...Object.values(scores));
          if (maxScore > 0) { // Only if there are non-zero scores
            Object.entries(scores).forEach(([component, score]) => {
                if (score === maxScore) {
                    mainComponents.push(component);
                }
            });
          }
      }


    scores.mainComponents = mainComponents;
    scores.mainComponentsDisplay = mainComponents.length > 0
        ? mainComponents.map(c => c.charAt(0).toUpperCase() + c.slice(1)).join(', ')
        : 'Equilibrado'; // Default if no clear focus

    console.log("[Scores Calculation] Final Calculated Scores:", scores);
    return scores;
}


/**
 * Calculates approximate daily volume (total sets) from routine HTML using structural analysis.
 * VERSION 10: Parses based on column index identified by "SERIES" header.
 * @param {string} routineHtml - The HTML content of the generated routine.
 * @returns {Object} - An object with day identifiers as keys and total daily sets as values.
 */
function calculateDailyVolume(routineHtml) {
    console.log("[Volume Calc v10] Starting...");
    const dailyVolume = {};

    if (!routineHtml || typeof routineHtml !== 'string' || routineHtml.trim() === '') {
        console.warn("[Volume Calc v10] No valid routine HTML provided.");
        return {};
    }
    if (!/<table/i.test(routineHtml)) {
        console.warn("[Volume Calc v10] Input HTML does not contain any '<table>' tags.");
        return {};
    }

    const dayHeaderRegex = /<(?:th|td)[^>]*>.*?(\bD[Íí]a\s+\d+\b).*?<\/(?:th|td)>/i;
    // Regex to check if a string looks like a time duration (for REPS column)
    const timeDurationRegex = /\d+\s*(?:s|seg|sec|min)\b/i;

    const tableRegex = /<table[\s\S]*?<\/table>/gi;
    const tableMatches = routineHtml.match(tableRegex);
    console.log(`[Volume Calc v10] Found ${tableMatches.length} table(s).`);

    tableMatches.forEach((tableHtml, tableIndex) => {
        console.log(`\n[Volume Debug v10] Processing Table ${tableIndex + 1}`);
        let currentDay = null;
        let setsColumnIndex = -1; // Index of the "SERIES" column (0-based)
        let repsColumnIndex = -1; // Index of the "REPS" column

        const rowRegex = /<tr[\s\S]*?<\/tr>/gi;
        const rowMatches = tableHtml.match(rowRegex);

        if (!rowMatches) {
            console.log(`[Volume Debug v10] No rows found in Table ${tableIndex + 1}.`);
            return;
        }

        rowMatches.forEach((rowHtml, rowIndex) => {
            // console.log(`[Volume Debug v10] Row ${rowIndex + 1}: ${rowHtml.substring(0,100)}`);

            // 1. Check for Day Header Row
            const dayMatch = rowHtml.match(dayHeaderRegex);
            if (dayMatch && dayMatch[1]) {
                currentDay = dayMatch[1].trim(); // e.g., "Día 1"
                if (!dailyVolume[currentDay]) {
                    dailyVolume[currentDay] = 0;
                }
                setsColumnIndex = -1; // Reset column index for the new day/table
                repsColumnIndex = -1;
                console.log(`[Volume Debug v10] Found Day Header: "${currentDay}" in Row ${rowIndex + 1}`);
                return; // Skip further processing of this header row
            }

            // If we haven't found a day header yet in this table, skip
            if (!currentDay) {
                return;
            }

            // 2. Check for Column Header Row (to find "SERIES" and "REPS" index)
            // Look for <th> or <td> containing the exact words "SERIES" or "REPS"
            const headerCellsRegex = /<(th|td)[\s\S]*?<\/\1>/gi; // Match th or td correctly
            const headerCells = rowHtml.match(headerCellsRegex);
            let isLikelyHeaderRow = false; // Flag to identify the header row

            if (headerCells && (setsColumnIndex === -1 || repsColumnIndex === -1)) { // Find indices if not already found for this day
                headerCells.forEach((cellHtml, index) => {
                    const cellText = cellHtml.replace(/<[^>]+>/g, '').trim();
                    if (/^SERIES$/i.test(cellText)) {
                        setsColumnIndex = index;
                        console.log(`[Volume Debug v10] Found 'SERIES' header at index ${setsColumnIndex} in Row ${rowIndex + 1}`);
                        isLikelyHeaderRow = true;
                    }
                    if (/^REPS$/i.test(cellText)) {
                        repsColumnIndex = index;
                         console.log(`[Volume Debug v10] Found 'REPS' header at index ${repsColumnIndex} in Row ${rowIndex + 1}`);
                         isLikelyHeaderRow = true;
                    }
                    // Also check for other common header words to be sure it's a header row
                    if (/^EJERCICIO$|^DESCANSO$|^NOTAS CLAVE/i.test(cellText)) {
                        isLikelyHeaderRow = true;
                    }
                });
                 // If we identified this as the header row based on cell content, skip processing it as data
                if (isLikelyHeaderRow) {
                    console.log(`[Volume Debug v10] Identified Row ${rowIndex + 1} as column header row.`);
                    return;
                }
            }


            // 3. Process Data Row (if it's not a header and we know the sets column index)
            if (!isLikelyHeaderRow && setsColumnIndex !== -1) {
                const dataCellsRegex = /<td[\s\S]*?<\/td>/gi; // Look specifically for <td> in data rows
                const dataCells = rowHtml.match(dataCellsRegex);

                if (dataCells && dataCells.length > setsColumnIndex) {
                    const setsCellHtml = dataCells[setsColumnIndex];
                    const setsText = setsCellHtml.replace(/<[^>]+>/g, '').trim();
                    console.log(`[Volume Debug v10] Row ${rowIndex + 1} (Day ${currentDay}): Text in Sets Column (${setsColumnIndex}): "${setsText}"`); // Log text found

                    // Attempt to parse the sets text as a number
                    let setsFound = 0;
                    if (setsText !== '') {
                        const potentialSets = parseInt(setsText, 10);
                        if (!isNaN(potentialSets) && potentialSets > 0 && potentialSets < 50) { // Sanity check
                            setsFound = potentialSets;
                            console.log(`[Volume Debug v10] Row ${rowIndex + 1}: Parsed Sets: ${setsFound}`);

                            // Optional: Check if REPS column indicates time (like Plancha) for logging/confirmation
                            if (repsColumnIndex !== -1 && dataCells.length > repsColumnIndex) {
                                const repsText = dataCells[repsColumnIndex].replace(/<[^>]+>/g, '').trim();
                                if (timeDurationRegex.test(repsText)) {
                                    console.log(`[Volume Debug v10] Row ${rowIndex + 1}: Detected time-based exercise in Reps column ("${repsText}") with ${setsFound} sets.`);
                                }
                            }

                        } else {
                             console.log(`[Volume Debug v10] Row ${rowIndex + 1}: Text in sets column is not a valid set number: "${setsText}"`);
                        }
                    } else {
                         console.log(`[Volume Debug v10] Row ${rowIndex + 1}: Sets column (${setsColumnIndex}) is empty.`);
                    }


                    // Add valid sets found to the daily total
                    if (setsFound > 0 && !isNaN(setsFound)) {
                        dailyVolume[currentDay] += setsFound;
                    } else {
                         console.log(`[Volume Debug v10] Row ${rowIndex + 1}: No valid sets added for this row.`);
                    }

                } else {
                    // This row doesn't seem to have enough data cells or structure is unexpected
                     console.log(`[Volume Debug v10] Row ${rowIndex + 1} (Day ${currentDay}): Skipping row, couldn't find enough <td> elements or structure mismatch.`);
                }
            } else if (!isLikelyHeaderRow && setsColumnIndex === -1) {
                 // This case should be less common now, means we are past day header but haven't found column headers yet
                 // console.log(`[Volume Debug v10] Row ${rowIndex + 1} (Day ${currentDay}): Skipping data row, 'SERIES' column index not identified yet.`);
            }
        }); // End loop through rows

        if (currentDay) {
             console.log(`[Volume Debug v10] Finished Table ${tableIndex + 1}. Total sets for ${currentDay}: ${dailyVolume[currentDay] || 0}`);
        } else {
             console.log(`[Volume Debug v10] Finished Table ${tableIndex + 1}. No 'Día N' header found in this table.`);
        }
    }); // End loop through tables

    console.log("[Volume Calc v10] Final Daily Volume Object:", JSON.stringify(dailyVolume));

    if (Object.keys(dailyVolume).length === 0 || Object.values(dailyVolume).every(v => v === 0)) {
        console.warn("[Volume Calc v10] No sets were calculated for any day OR all days have zero sets. Returning empty object.");
        return {};
    }

    return dailyVolume;
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
        description += `Nos enfocaremos principalmente en **${scores.mainComponentsDisplay}** para ayudarte a alcanzar tus metas. Los gráficos a continuación detallan la distribución del enfoque y el volumen semanal estimado por día de entrenamiento. ¡A darle con todo!`;
    } else {
        description += `Este plan está diseñado para ofrecerte un desarrollo equilibrado en todas las áreas clave. Los gráficos muestran la distribución del enfoque y el volumen semanal estimado por día de entrenamiento. ¡Disfruta del proceso!`;
    }

    // HTML Structure
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
              {/* Título del gráfico actualizado */}
              <h3 class="chart-title">Volumen Total Estimado por Día (Series)</h3>
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
    // Styles remain the same as the previous corrected version
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
        --text-dark: #2c3e50;       /* Dark Blue-Gray for main text */
        --text-medium-dark: #555;   /* Medium dark gray for less important text */
        --text-light-gray: #95a5a6; /* Light gray for footer */
        --border-light: rgba(0, 0, 0, 0.1);   /* Light border for dark on light */
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
 * Genera el script de inicialización de Chart.js para el gráfico de líneas de volumen DIARIO.
 * @param {Object} dailyVolumeData - Datos de volumen diario (ej. {'Día 1': 20, 'Día 2': 18}).
 * @returns {string} - Código JavaScript para inicializar el gráfico de líneas.
 */
function getVolumeLineChartScript(dailyVolumeData) {
    // Extraer etiquetas (Día 1, Día 2...) y datos (total series)
    // Asegurarse de que los días estén ordenados correctamente si es necesario
    const sortedDays = Object.keys(dailyVolumeData).sort((a, b) => {
        const numA = parseInt(a.match(/\d+/)?.[0] || 0);
        const numB = parseInt(b.match(/\d+/)?.[0] || 0);
        return numA - numB;
    });

    const labels = sortedDays;
    const data = sortedDays.map(day => dailyVolumeData[day]);

    // Check if data is empty and provide default if needed for display
    const displayLabels = labels.length > 0 ? labels : ['No Data'];
    const displayData = data.length > 0 ? data : [0];
    // Determine if the chart should display the "No Data" message
    // Check if dailyVolumeData is empty OR if all values are 0
    const noDataAvailable = (Object.keys(dailyVolumeData).length === 0 || data.every(v => v === 0));
    console.log(`[Volume Script - Daily] Generating script. No data available: ${noDataAvailable}`);
    console.log(`[Volume Script - Daily] dailyVolumeData for script: ${JSON.stringify(dailyVolumeData)}`);
    console.log(`[Volume Script - Daily] Labels for chart: ${JSON.stringify(displayLabels)}`);
    console.log(`[Volume Script - Daily] Data for chart: ${JSON.stringify(displayData)}`);


    const lineChartColors = {
        backgroundColor: 'rgba(52, 152, 219, 0.15)', // Lighter blue area fill
        borderColor: 'rgba(52, 152, 219, 0.9)',     // Solid blue line
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
        const noData = ${noDataAvailable}; // Use the calculated boolean
        if (noData) {
            console.log("[Volume Script - Daily] No data flag is true, displaying message on canvas.");
            // Clear previous drawings (important if chart existed before)
             if (window.myVolumeChart) {
                 window.myVolumeChart.destroy();
                 window.myVolumeChart = null; // Clear the global variable
             }
            ctx.clearRect(0, 0, canvasElement.width, canvasElement.height); // Clear canvas
            // Ensure canvas has dimensions before drawing text
            canvasElement.width = canvasElement.offsetWidth;
            canvasElement.height = canvasElement.offsetHeight;
            ctx.font = "14px 'Inter', sans-serif"; // Slightly smaller font
            ctx.fillStyle = '#777'; // Lighter gray
            ctx.textAlign = 'center';
            // Calculate center position more reliably after setting dimensions
            const centerX = canvasElement.width / 2;
            const centerY = canvasElement.height / 2;
            ctx.fillText("No se pudo calcular el volumen.", centerX, centerY);
            console.warn("No volume data to display in line chart.");
            return; // Stop chart initialization
        } else {
             console.log("[Volume Script - Daily] Data is available, proceeding with chart initialization.");
        }


        // Chart.js Configuration
        try {
            // Destruir gráfico existente si lo hay
            if (window.myVolumeChart) {
                console.log("[Volume Script - Daily] Destroying existing volume chart instance.");
                window.myVolumeChart.destroy();
            }
            console.log("[Volume Script - Daily] Creating new Chart instance.");
            window.myVolumeChart = new Chart(ctx, { // Asignar a la variable global
                type: 'line', // Could also be 'bar' if preferred
                data: {
                    // Use sorted days as labels and total sets as data
                    labels: ${JSON.stringify(displayLabels)},
                    datasets: [{
                        label: 'Series Totales por Día', // Updated label
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
                        tension: 0.1 // Slightly less tension for potentially fewer points
                    }]
                },
                options: {
                    scales: {
                        y: {
                            beginAtZero: true,
                            title: {
                                display: true, // Show Y-axis title
                                text: 'Número Total de Series', // Updated title
                                font: { size: 11 },
                                color: '#666',
                                padding: { top: 0, bottom: 5 }
                            },
                            ticks: {
                                color: 'rgba(0, 0, 0, 0.6)', // Lighter ticks
                                precision: 0, // Ensure whole numbers for sets
                                font: { size: 10 } // Smaller font
                            },
                             grid: {
                                 color: 'rgba(0, 0, 0, 0.06)' // Lighter grid
                             }
                        },
                        x: {
                             title: { // Optional X-axis title
                                 display: true,
                                 text: 'Día de Entrenamiento',
                                 font: { size: 11 },
                                 color: '#666',
                                 padding: { top: 5, bottom: 0 }
                             },
                             ticks: {
                                 color: 'rgba(0, 0, 0, 0.6)', // Lighter ticks
                                 font: { size: 10 } // Smaller font
                             },
                             grid: {
                                 display: false // Hide vertical grid lines
                             }
                        }
                    },
                    plugins: {
                        legend: {
                            display: false, // Hide legend (only one line)
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
                                 // Show "Day X: Y series" in tooltip
                                 title: function(tooltipItems) {
                                     // tooltipItems is an array, usually with one item for line charts
                                     return tooltipItems[0]?.label || '';
                                 },
                                 label: function(context) {
                                     let label = context.dataset.label || ''; // "Series Totales por Día"
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
             console.log("[Volume Script - Daily] Volume chart initialized successfully."); // Confirmation log
        } catch (error) {
             console.error("[Volume Script - Daily] Error initializing Volume Line Chart:", error);
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

    // 2. Calculate DAILY volume using the revised function
    const dailyVolumeData = calculateDailyVolume(routineHtml); // Use the updated function (v9)
    console.log(`[createCoverPage] dailyVolumeData received: ${JSON.stringify(dailyVolumeData)}`);


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
    // Pass the DAILY volume data to the updated script generator
    const volumeScript = getVolumeLineChartScript(dailyVolumeData);

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
        scores, // Keep scores for radar chart
        volumeData: dailyVolumeData // Return the calculated daily volume data
    };
}


// Export the main function and the revised volume function name
module.exports = {
    calculateTrainingComponentScores,
    calculateDailyVolume, // Export the revised function name (v9)
    createCoverPage,
    // Keep other exports if they were needed for testing/other modules
    generateCoverPageHtml,
    getCoverPageStyles,
    getRadarChartScript,
    getVolumeLineChartScript
};

// --- END OF UNCHANGED FUNCTIONS ---






