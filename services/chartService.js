// chartService.js (Fondo Blanco y Texto Negro v14 - Detección Enfoque Mejorada)

/**
 * Calculates training component scores based on routine HTML structure, parameters, and keywords.
 * VERSION 2: More precise analysis based on table structure and parameters.
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
        cardio: 0 // Includes general endurance/conditioning
    };

    // Default balanced profile if no HTML is provided
    if (!routineHtml || typeof routineHtml !== 'string' || routineHtml.trim() === '') {
        console.warn("[Scores Calc v2] No routine HTML provided, returning default balanced scores.");
        return {
            fuerza: 50, hipertrofia: 50, movilidad: 50,
            potencia: 50, tecnica: 50, cardio: 50,
            mainComponents: [], mainComponentsDisplay: 'Equilibrado'
        };
    }
     if (!/<table/i.test(routineHtml)) {
         console.warn("[Scores Calc v2] Input HTML does not contain any '<table>' tags. Returning default scores.");
         return {
            fuerza: 50, hipertrofia: 50, movilidad: 50,
            potencia: 50, tecnica: 50, cardio: 50,
            mainComponents: [], mainComponentsDisplay: 'Equilibrado'
        };
     }

    // --- Configuration ---
    const weights = {
        paramMatch: 5,       // Base weight for matching rep/rest parameters
        keywordGeneral: 1,   // Weight for general keywords
        keywordSpecificEx: 2,// Weight for specific exercise names
        keywordNotes: 1.5,   // Weight for keywords in notes
        tempoName: 3,        // Weight for tempo found in exercise name
        activationSection: 2 // Extra weight for mobility/technique in activation
    };

    // Keywords (Refined and potentially reduced reliance)
    const keywords = {
        fuerza: ['fuerza', 'strength', 'carga', 'pesado', 'heavy', 'maximal', 'máxima'], // More specific
        hipertrofia: ['hipertrofia', 'hypertrophy', 'volumen', 'muscular', 'culturismo', 'bodybuilding', 'crecimiento', 'tamaño'], // More specific
        movilidad: ['movilidad', 'mobility', 'flexibilidad', 'flexibility', 'stretching', 'estiramiento', 'rango', 'rom', 'yoga', 'pilates', 'elongación', 'estirar'],
        potencia: ['potencia', 'power', 'explosiv', 'velocidad', 'speed', 'salto', 'jump', 'pliometría', 'plyometric', 'lanzamiento', 'throw', 'kettlebell swing', 'clean', 'jerk', 'snatch'],
        tecnica: ['técnica', 'technique', 'forma', 'form', 'skill', 'habilidad', 'balance', 'equilibrio', 'coordinación', 'control', 'patrón', 'motor', 'estabilidad', 'stability', 'aprendizaje', 'drills', 'isométrico', 'isometric'],
        cardio: ['cardio', 'cardiovascular', 'aeróbico', 'aerobic', 'resistencia', 'endurance', 'intervalos', 'interval', 'hiit', 'correr', 'run', 'nadar', 'swim', 'bicicleta', 'bike', 'burpee', 'jumping jack', 'remo', 'rowing'] // Includes endurance
    };
     // Keywords specifically for "Notas Clave" column (error prevention / technique focus)
     const notesKeywords = {
        tecnica: ['controla', 'estable', 'alineado', 'neutra', 'retracción', 'core', 'activado', 'lento', 'cadera', 'rodilla', 'hombro', 'codo', 'muñeca', 'tobillo', 'evita', 'no arquear', 'sin impulso', 'completo'],
        movilidad: ['rango completo', 'profundo', 'estira', 'movilidad'],
        fuerza: ['empuja fuerte', 'tira fuerte', 'contrae'], // Less common in notes now
        hipertrofia: ['conexión mente-músculo', 'aprieta', 'sensación'], // Less common
        potencia: ['explosivo', 'rápido'] // Less common
     };

    // Counts for keyword occurrences and parameter matches
    const counts = {
        fuerza: 0, hipertrofia: 0, movilidad: 0,
        potencia: 0, tecnica: 0, cardio: 0
    };

    // --- HTML Parsing and Analysis ---
    const tableRegex = /<table[\s\S]*?<\/table>/gi;
    const rowRegex = /<tr[\s\S]*?<\/tr>/gi;
    const cellRegex = /<(?:th|td)[\s\S]*?<\/\1>/gi; // Matches <th>...</th> or <td>...</td>
    const cleanText = (html) => html ? html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase() : '';

    const tables = routineHtml.match(tableRegex) || [];

    tables.forEach((tableHtml) => {
        let columnIndices = { exercise: -1, series: -1, reps: -1, rest: -1, notes: -1 };
        let foundHeader = false;
        let inActivationSection = false; // Flag for warmup/activation rows

        const rows = tableHtml.match(rowRegex) || [];
        rows.forEach((rowHtml) => {
            const cells = rowHtml.match(cellRegex) || [];
            const cellTexts = cells.map(cleanText);

            // Check for Activation Section Header
            if (cellTexts.some(text => /calentamiento|activación específica/i.test(text))) {
                inActivationSection = true;
                return; // Skip this header row
            }
            // Check for Main Routine Header (to potentially reset activation flag, though usually it's per table)
            if (cellTexts.some(text => /rutina principal/i.test(text))) {
                inActivationSection = false;
                return; // Skip this header row
            }

            // Find Header Row and Column Indices
            if (!foundHeader && cells[0]?.toLowerCase().startsWith('<th')) {
                cellTexts.forEach((text, index) => {
                    if (/^ejercicio$/i.test(text)) columnIndices.exercise = index;
                    else if (/^series$/i.test(text)) columnIndices.series = index;
                    else if (/^reps$/i.test(text)) columnIndices.reps = index;
                    else if (/^descanso$/i.test(text)) columnIndices.rest = index;
                    else if (/^notas clave$/i.test(text)) columnIndices.notes = index;
                });
                // Check if we likely found the header row
                if (columnIndices.exercise !== -1 || columnIndices.series !== -1 || columnIndices.reps !== -1 || columnIndices.rest !== -1 || columnIndices.notes !== -1) {
                    foundHeader = true;
                    // console.log("[Scores Calc v2] Found header indices:", columnIndices);
                    return; // Skip header row from data processing
                }
            }

            // Process Data Row (if header found and it's likely a data row - starts with <td>)
            if (foundHeader && cells[0]?.toLowerCase().startsWith('<td')) {
                const exerciseText = columnIndices.exercise !== -1 ? cellTexts[columnIndices.exercise] : '';
                const repsText = columnIndices.reps !== -1 ? cellTexts[columnIndices.reps] : '';
                const restText = columnIndices.rest !== -1 ? cellTexts[columnIndices.rest] : '';
                const notesText = columnIndices.notes !== -1 ? cellTexts[columnIndices.notes] : '';

                // 1. Parameter Analysis (Reps & Rest) - HIGHEST PRIORITY
                let repMax = NaN;
                let restSeconds = NaN;

                // Parse Reps
                if (repsText) {
                    const repMatch = repsText.match(/(\d+)(?:-(\d+))?/); // Matches "10" or "8-12"
                    if (repMatch) {
                        repMax = parseInt(repMatch[2] || repMatch[1], 10); // Use upper range or single value
                    } else if (/\d+\s*seg|\d+s|al fallo|amrap/i.test(repsText)) {
                         // Time-based reps or AMRAP - might indicate cardio/endurance or technique (isometrics)
                         counts.cardio += weights.paramMatch * 0.5;
                         if (/iso|mantener|hold/i.test(exerciseText) || /iso|mantener|hold/i.test(notesText)) {
                            counts.tecnica += weights.paramMatch * 0.5;
                         }
                    }
                }

                // Parse Rest
                if (restText) {
                    const restMatch = restText.match(/(\d+)\s*(?:s|seg|sec)/i); // Match seconds
                    if (restMatch) {
                        restSeconds = parseInt(restMatch[1], 10);
                    } else {
                         const minMatch = restText.match(/(\d+)\s*(?:min)/i); // Match minutes
                         if (minMatch) {
                             restSeconds = parseInt(minMatch[1], 10) * 60;
                         }
                    }
                }

                // Apply scoring based on Reps/Rest combination
                if (!isNaN(repMax) && !isNaN(restSeconds)) {
                    if (repMax <= 6 && restSeconds >= 100) { // Low Reps, Long Rest -> Fuerza
                        counts.fuerza += weights.paramMatch;
                    } else if (repMax >= 6 && repMax <= 15 && restSeconds >= 50 && restSeconds <= 130) { // Mid Reps, Mod Rest -> Hipertrofia
                        counts.hipertrofia += weights.paramMatch;
                    } else if (repMax >= 12 && restSeconds <= 80) { // High Reps, Short/Mod Rest -> Cardio/Endurance
                        counts.cardio += weights.paramMatch;
                         // Slightly boost hipertrofia too for higher reps if rest isn't super short
                         if (restSeconds >= 45) counts.hipertrofia += weights.paramMatch * 0.2;
                    } else {
                        // Less clear combinations - give smaller boosts based on individual params
                        if (repMax <= 8) counts.fuerza += weights.paramMatch * 0.3;
                        if (repMax >= 6 && repMax <= 18) counts.hipertrofia += weights.paramMatch * 0.3;
                        if (repMax >= 12) counts.cardio += weights.paramMatch * 0.3;
                        if (restSeconds >= 90) counts.fuerza += weights.paramMatch * 0.3;
                        if (restSeconds <= 75) counts.cardio += weights.paramMatch * 0.3;
                    }
                } else if (!isNaN(repMax)) { // Only Reps info
                     if (repMax <= 8) counts.fuerza += weights.paramMatch * 0.5;
                     if (repMax >= 6 && repMax <= 18) counts.hipertrofia += weights.paramMatch * 0.5;
                     if (repMax >= 12) counts.cardio += weights.paramMatch * 0.5;
                } else if (!isNaN(restSeconds)) { // Only Rest info
                     if (restSeconds >= 90) counts.fuerza += weights.paramMatch * 0.5;
                     if (restSeconds <= 75) counts.cardio += weights.paramMatch * 0.5;
                     if (restSeconds >= 50 && restSeconds <= 130) counts.hipertrofia += weights.paramMatch * 0.2;
                }

                // 2. Tempo in Exercise Name Analysis
                if (exerciseText) {
                    if (/tempo\s+\d{4,}/i.test(exerciseText)) { // Controlled tempo (e.g., Tempo 3110)
                        counts.tecnica += weights.tempoName;
                        counts.hipertrofia += weights.tempoName * 0.5; // TUT benefits hypertrophy
                    }
                    if (/tempo.*[xX]/i.test(exerciseText)) { // Explosive tempo (e.g., Tempo 20X1)
                        counts.potencia += weights.tempoName;
                    }
                }

                // 3. General Keyword Analysis (Exercise Name + Notes)
                const combinedText = exerciseText + ' ' + notesText;
                Object.keys(keywords).forEach(component => {
                    keywords[component].forEach(keyword => {
                        try {
                            const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
                            const matches = combinedText.match(regex) || [];
                            counts[component] += matches.length * weights.keywordGeneral;
                        } catch (e) { /* Ignore regex errors */ }
                    });
                });

                 // 4. Specific Exercise Name Analysis (Higher weight)
                 Object.keys(keywords).forEach(component => { // Re-using keywords structure for specific exercises
                    keywords[component].forEach(exKeyword => { // Check if any part of the exercise name matches a keyword
                        if (exerciseText.includes(exKeyword)) {
                           // Check if it's a specific exercise match from a predefined list (optional, could reuse logic from v1)
                           // For simplicity here, just give a boost based on keyword match in name
                           counts[component] += weights.keywordSpecificEx * 0.5; // Smaller boost than full specific match
                        }
                    });
                 });
                 // Add back specific exercise list check if needed for higher accuracy


                // 5. Notes Keyword Analysis (Focus on Technique/Error Prevention)
                 if (notesText) {
                    Object.keys(notesKeywords).forEach(component => {
                        notesKeywords[component].forEach(keyword => {
                            try {
                                const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
                                const matches = notesText.match(regex) || [];
                                counts[component] += matches.length * weights.keywordNotes;
                            } catch (e) { /* Ignore regex errors */ }
                        });
                    });
                 }

                 // 6. Boost for Activation Section
                 if (inActivationSection) {
                    counts.movilidad += weights.activationSection;
                    counts.tecnica += weights.activationSection * 0.5; // Often involves control
                 }
            }
        }); // End row loop
    }); // End table loop

    // --- Normalization and Smoothing ---
    const totalCount = Object.values(counts).reduce((sum, count) => sum + Math.max(0, count), 0);

    if (totalCount === 0) {
        console.warn("[Scores Calc v2] Total count for normalization is zero, returning default balanced scores.");
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

    // Apply minimum threshold and cap at 100
    const minThreshold = 5;
    let currentTotal = 0;
    Object.keys(scores).forEach(component => {
        if (counts[component] > 0 && scores[component] < minThreshold) {
            scores[component] = minThreshold;
        }
        scores[component] = Math.min(scores[component], 100);
        currentTotal += scores[component];
    });

    // Re-normalize to ensure sum is exactly 100
    if (currentTotal !== 100 && currentTotal > 0) {
        const diff = 100 - currentTotal;
        let sortedComponents = Object.keys(scores).sort((a, b) => scores[b] - scores[a]);

        // Distribute difference proportionally (or just adjust largest)
        // Simple adjustment to largest component(s)
        const numLargest = sortedComponents.filter(c => scores[c] === scores[sortedComponents[0]]).length;
        const adjustment = Math.round(diff / numLargest); // Distribute among ties
        let remainder = diff % numLargest;

        for (let i = 0; i < numLargest; i++) {
            let currentAdjustment = adjustment + (remainder > 0 ? 1 : (remainder < 0 ? -1 : 0));
             scores[sortedComponents[i]] = Math.min(100, Math.max(0, scores[sortedComponents[i]] + currentAdjustment));
             if (remainder !==0) remainder > 0 ? remainder-- : remainder++;
        }

        // Final check and force sum to 100 if needed (due to rounding)
        currentTotal = Object.values(scores).reduce((sum, score) => sum + score, 0);
        if (currentTotal !== 100 && currentTotal > 0) {
             let finalDiff = 100 - currentTotal;
             scores[sortedComponents[0]] = Math.min(100, Math.max(0, scores[sortedComponents[0]] + finalDiff));
        }
    }
     // Ensure no negative scores after adjustments
     Object.keys(scores).forEach(component => {
        scores[component] = Math.max(0, scores[component]);
     });


    // --- Determine Main Components ---
    let maxScore = 0;
    let mainComponents = [];
    const significanceThreshold = 25; // Threshold to be considered a "main" component

    // Sort scores descending to find main components
    let sortedScores = Object.entries(scores)
        .filter(([key]) => ['fuerza', 'hipertrofia', 'movilidad', 'potencia', 'tecnica', 'cardio'].includes(key)) // Ensure only valid components
        .sort(([, scoreA], [, scoreB]) => scoreB - scoreA);

    if (sortedScores.length > 0) {
        maxScore = sortedScores[0][1];
        if (maxScore >= significanceThreshold) {
            // Include all components with score >= threshold AND close to maxScore (e.g., within 10 points)
            const thresholdMax = Math.max(significanceThreshold, maxScore - 10);
             mainComponents = sortedScores
                .filter(([, score]) => score >= thresholdMax)
                .map(([component]) => component);
        } else if (maxScore > 0) {
            // If no score reaches threshold, take the highest score(s)
             mainComponents = sortedScores
                .filter(([, score]) => score === maxScore)
                .map(([component]) => component);
        }
    }

    scores.mainComponents = mainComponents;
    scores.mainComponentsDisplay = mainComponents.length > 0
        ? mainComponents.map(c => c.charAt(0).toUpperCase() + c.slice(1)).join(' + ') // Use ' + ' for multiple main components
        : 'Equilibrado'; // Default if no clear focus or all scores are 0

    console.log("[Scores Calc v2] Final Calculated Scores:", scores);
    return scores;
}


/**
 * Calculates approximate daily volume (total sets) from routine HTML using structural analysis.
 * VERSION 10: Parses based on column index identified by "SERIES" header.
 * @param {string} routineHtml - The HTML content of the generated routine.
 * @returns {Object} - An object with day identifiers as keys and total daily sets as values.
 */
function calculateDailyVolume(routineHtml) {
    // Use v10 logic - no changes needed here as it correctly identifies sets now
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
    const tableMatches = routineHtml.match(tableRegex) || []; // Ensure it's an array
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
             let isActivationHeader = false; // Flag for activation section header

            if (headerCells && (setsColumnIndex === -1 || repsColumnIndex === -1)) { // Find indices if not already found for this day
                headerCells.forEach((cellHtml, index) => {
                    const cellText = cellHtml.replace(/<[^>]+>/g, '').trim();
                     if (/calentamiento|activación específica/i.test(cellText)) {
                        isActivationHeader = true; // Identify activation header
                    }
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
                if (isLikelyHeaderRow || isActivationHeader) {
                    // console.log(`[Volume Debug v10] Identified Row ${rowIndex + 1} as column or activation header row.`);
                    return;
                }
            }


            // 3. Process Data Row (if it's not a header and we know the sets column index)
            if (!isLikelyHeaderRow && !isActivationHeader && setsColumnIndex !== -1 && rowHtml.toLowerCase().startsWith('<tr')) { // Ensure it's a data row (often starts with <tr><td>...)
                 const dataCellsRegex = /<td[\s\S]*?<\/td>/gi; // Look specifically for <td> in data rows
                 const dataCells = rowHtml.match(dataCellsRegex);

                 if (dataCells && dataCells.length > setsColumnIndex) {
                     const setsCellHtml = dataCells[setsColumnIndex];
                     const setsText = setsCellHtml.replace(/<[^>]+>/g, '').trim();
                     // console.log(`[Volume Debug v10] Row ${rowIndex + 1} (Day ${currentDay}): Text in Sets Column (${setsColumnIndex}): "${setsText}"`); // Log text found

                     // Attempt to parse the sets text as a number
                     let setsFound = 0;
                     if (setsText !== '') {
                         const potentialSets = parseInt(setsText, 10);
                         if (!isNaN(potentialSets) && potentialSets > 0 && potentialSets < 50) { // Sanity check
                             setsFound = potentialSets;
                             // console.log(`[Volume Debug v10] Row ${rowIndex + 1}: Parsed Sets: ${setsFound}`);

                             // Optional: Check if REPS column indicates time (like Plancha) for logging/confirmation
                             if (repsColumnIndex !== -1 && dataCells.length > repsColumnIndex) {
                                 const repsText = dataCells[repsColumnIndex].replace(/<[^>]+>/g, '').trim();
                                 if (timeDurationRegex.test(repsText)) {
                                     // console.log(`[Volume Debug v10] Row ${rowIndex + 1}: Detected time-based exercise in Reps column ("${repsText}") with ${setsFound} sets.`);
                                 }
                             }

                         } else {
                             // console.log(`[Volume Debug v10] Row ${rowIndex + 1}: Text in sets column is not a valid set number: "${setsText}"`);
                         }
                     } else {
                         // console.log(`[Volume Debug v10] Row ${rowIndex + 1}: Sets column (${setsColumnIndex}) is empty.`);
                     }


                     // Add valid sets found to the daily total
                     if (setsFound > 0 && !isNaN(setsFound)) {
                         dailyVolume[currentDay] += setsFound;
                     } else {
                         // console.log(`[Volume Debug v10] Row ${rowIndex + 1}: No valid sets added for this row.`);
                     }

                 } else {
                     // This row doesn't seem to have enough data cells or structure is unexpected
                     // console.log(`[Volume Debug v10] Row ${rowIndex + 1} (Day ${currentDay}): Skipping row, couldn't find enough <td> elements or structure mismatch.`);
                 }
             } else if (!isLikelyHeaderRow && !isActivationHeader && setsColumnIndex === -1) {
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
    if (scores.mainComponents && scores.mainComponents.length > 0 && scores.mainComponentsDisplay !== 'Equilibrado') {
        description += `Nos enfocaremos principalmente en **${scores.mainComponentsDisplay}** para ayudarte a alcanzar tus metas. Los gráficos a continuación detallan la distribución del enfoque y el volumen semanal estimado por día de entrenamiento. ¡A darle con todo!`;
    } else {
        description += `Este plan está diseñado para ofrecerte un desarrollo equilibrado en todas las áreas clave. Los gráficos muestran la distribución del enfoque y el volumen semanal estimado por día de entrenamiento. ¡Disfruta del proceso!`;
    }

    // HTML Structure - COMMENT FULLY REMOVED
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
 * **MODIFICADO: Fondo blanco, texto negro.**
 * @returns {string} - Estilos CSS.
 */
function getCoverPageStyles() {
    // Styles modified for white background and black text
    return `
    /* Estilos Mejorados Portada Completa v4 - Fondo Blanco */
    :root {
        /* Define color variables */
        --primary-color: #000000; /* Black for main headers/strong text */
        --secondary-color: #333333; /* Dark Gray for body text */
        --accent-color: #3498db;   /* Bright Blue for accents (like underlines, maybe chart elements) */
        --background-color: #ffffff; /* White background */
        --text-light: #ffffff;     /* White text (e.g., for buttons if added) */
        --text-dark: #000000;       /* Black for main text */
        --text-medium-dark: #555555; /* Medium dark gray for less important text */
        --text-light-gray: #888888; /* Lighter gray for footer */
        --border-light: rgba(0, 0, 0, 0.15); /* Slightly darker/more visible border on white */
        --border-medium: #cccccc; /* Medium gray border */
        --background-light-accent: rgba(0, 0, 0, 0.03); /* Very subtle gray accent for legend */
        --background-chart-container: #ffffff; /* White background for charts */
        --border-radius: 8px;
        --border-radius-large: 12px;
        --box-shadow-light: 0 4px 15px rgba(0, 0, 0, 0.08); /* Adjusted shadow for white */
        --box-shadow-medium: 0 6px 20px rgba(0, 0, 0, 0.1); /* Adjusted shadow for white */

        /* Component Colors (Keep these vibrant for the charts/legend) */
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
        /* White Background */
        background-color: var(--background-color);
        color: var(--text-dark); /* Main text color set to black */
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
        border-bottom: 1px solid var(--border-light); /* Use defined light border */
        padding-bottom: 15px;
        flex-shrink: 0; /* Prevent header from shrinking */
    }

    .cover-logo-new {
        width: 100px; /* Further adjusted size */
        height: auto;
        opacity: 0.9;
        /* Logo should be visible on white, remove filter if it was for dark bg */
        /* filter: brightness(0) invert(1); */
    }

    .client-info-new {
        text-align: right;
    }

    .client-info-new h1 {
        font-size: 24px; /* Adjusted size */
        font-weight: 700;
        color: var(--primary-color); /* Use primary text color (black) */
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
        color: var(--primary-color); /* Black */
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
        background-color: var(--accent-color); /* Keep accent color */
        border-radius: 3px;
    }

    .cover-description-new {
        font-size: 13px; /* Adjusted size */
        color: var(--secondary-color); /* Use secondary dark color (dark gray) */
        line-height: 1.5; /* Adjusted */
        margin-bottom: 20px; /* Adjusted margin */
        font-weight: 400;
        max-width: 100%;
    }

    .cover-description-new strong {
        color: var(--primary-color); /* Black for emphasis */
        font-weight: 600;
    }

    .components-legend-new {
        background-color: var(--background-light-accent); /* Subtle gray accent */
        padding: 15px 20px; /* Adjusted padding */
        border-radius: var(--border-radius);
        border: 1px solid var(--border-light);
    }

    .components-legend-new h3 {
        font-size: 14px; /* Adjusted size */
        font-weight: 600;
        color: var(--primary-color); /* Black */
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
        border: 1px solid rgba(0, 0, 0, 0.4); /* Slightly darker border for dots on white */
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
        color: var(--secondary-color); /* Dark Gray */
    }

    .component-label-new span {
        font-weight: 700;
        color: var(--primary-color); /* Black */
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
    }

    .chart-container-new {
        background-color: var(--background-chart-container); /* White */
        border-radius: var(--border-radius-large);
        padding: 15px 20px 20px 20px; /* Adjusted padding */
        box-shadow: var(--box-shadow-medium); /* Use updated shadow */
        border: 1px solid var(--border-medium); /* Use medium border */
        display: flex;
        flex-direction: column;
        height: auto; /* Let height be determined by content and available space */
        min-height: 250px; /* Minimum height to ensure chart visibility */
        max-height: 300px; /* **Adjust this value as needed** Maximum height per chart */
        flex-shrink: 1; /* Allow charts to shrink if needed */
        flex-grow: 1; /* Allow charts to grow to fill space */
    }


     .chart-title {
        font-size: 13px; /* Adjusted size */
        font-weight: 600;
        color: var(--text-dark); /* Black */
        margin: 0 0 10px 0; /* Adjusted margin */
        text-align: center;
        flex-shrink: 0; /* Prevent title from shrinking */
    }

    #radarChart, #volumeLineChart {
        max-width: 100%;
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
        border-top: 1px solid var(--border-light); /* Use light border */
        font-size: 10px; /* Adjusted size */
        color: var(--text-light-gray); /* Light gray */
        flex-shrink: 0; /* Prevent footer from shrinking */
    }
    `;
}

/**
 * Genera el script de inicialización de Chart.js para el gráfico radar.
 * **MODIFICADO: Ajustes menores de color para fondo blanco.**
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
                         backgroundColor: 'rgba(52, 152, 219, 0.2)', // Use accent color with transparency
                         borderColor: 'rgba(52, 152, 219, 0.8)',   // Use accent color, slightly less opaque
                         borderWidth: 1.5,
                         pointBackgroundColor: 'rgba(52, 152, 219, 1)', // Solid accent color
                         pointBorderColor: '#fff', // White border for points
                         pointHoverBackgroundColor: '#fff',
                         pointHoverBorderColor: 'rgba(52, 152, 219, 1)',
                         pointRadius: 3,
                         pointHoverRadius: 5
                     }]
                 },
                 options: {
                     scales: {
                         r: { // Radial axis
                             angleLines: { display: true, color: 'rgba(0, 0, 0, 0.1)' }, // Slightly darker lines on white
                             suggestedMin: 0,
                             suggestedMax: 100,
                             grid: { color: 'rgba(0, 0, 0, 0.1)' }, // Slightly darker grid on white
                             ticks: {
                                 stepSize: 25,
                                 color: 'rgba(0, 0, 0, 0.6)', // Darker ticks for readability
                                 backdropColor: 'rgba(255, 255, 255, 0.75)', // White backdrop
                                 padding: 5,
                                 font: { size: 9 }
                             },
                             pointLabels: { // Labels around the edge
                                 font: { size: 11, weight: '500' },
                                 color: 'rgba(0, 0, 0, 0.85)' // Darker labels for readability
                             }
                         }
                     },
                     plugins: {
                         legend: { display: false },
                         tooltip: {
                             enabled: true,
                             backgroundColor: 'rgba(0, 0, 0, 0.8)', // Keep dark tooltip
                             titleFont: { size: 12, weight: 'bold' },
                             bodyFont: { size: 11 },
                             padding: 8,
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
 * **MODIFICADO: Ajustes menores de color para fondo blanco.**
 * @param {Object} dailyVolumeData - Datos de volumen diario (ej. {'Día 1': 20, 'Día 2': 18}).
 * @returns {string} - Código JavaScript para inicializar el gráfico de líneas.
 */
function getVolumeLineChartScript(dailyVolumeData) {
    // Extraer etiquetas (Día 1, Día 2...) y datos (total series)
    const sortedDays = Object.keys(dailyVolumeData).sort((a, b) => {
        const numA = parseInt(a.match(/\d+/)?.[0] || 0);
        const numB = parseInt(b.match(/\d+/)?.[0] || 0);
        return numA - numB;
    });

    const labels = sortedDays;
    const data = sortedDays.map(day => dailyVolumeData[day]);

    const displayLabels = labels.length > 0 ? labels : ['No Data'];
    const displayData = data.length > 0 ? data : [0];
    const noDataAvailable = (Object.keys(dailyVolumeData).length === 0 || data.every(v => v === 0));
    console.log(`[Volume Script - Daily v11] Generating script. No data available: ${noDataAvailable}`);
    console.log(`[Volume Script - Daily v11] dailyVolumeData for script: ${JSON.stringify(dailyVolumeData)}`);
    console.log(`[Volume Script - Daily v11] Labels for chart: ${JSON.stringify(displayLabels)}`);
    console.log(`[Volume Script - Daily v11] Data for chart: ${JSON.stringify(displayData)}`);


    const lineChartColors = {
        // Using the same accent blue
        main: 'rgba(52, 152, 219, 1)', // var(--accent-color) as solid
        areaFill: 'rgba(52, 152, 219, 0.2)', // Lighter fill
        pointBorder: '#ffffff',
        pointHoverBackground: '#ffffff',
        datalabelColor: '#333333' // Dark gray for data labels
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
            console.log("[Volume Script - Daily v11] No data flag is true, displaying message on canvas.");
             if (window.myVolumeChart) {
                  window.myVolumeChart.destroy();
                  window.myVolumeChart = null;
             }
            ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
            canvasElement.width = canvasElement.offsetWidth;
            canvasElement.height = canvasElement.offsetHeight;
            ctx.font = "14px 'Inter', sans-serif";
            ctx.fillStyle = '#777'; // Keep gray for placeholder text
            ctx.textAlign = 'center';
            const centerX = canvasElement.width / 2;
            const centerY = canvasElement.height / 2;
            ctx.fillText("No se pudo calcular el volumen.", centerX, centerY);
            console.warn("No volume data to display in line chart.");
            return;
        } else {
             console.log("[Volume Script - Daily v11] Data is available, proceeding with chart initialization.");
        }


        // Chart.js Configuration with DataLabels plugin
        try {
             if (window.myVolumeChart) {
                 console.log("[Volume Script - Daily v11] Destroying existing volume chart instance.");
                 window.myVolumeChart.destroy();
             }
             console.log("[Volume Script - Daily v11] Creating new Chart instance.");
             window.myVolumeChart = new Chart(ctx, {
                 type: 'line',
                 plugins: [ChartDataLabels], // Register plugin for this chart instance
                 data: {
                     labels: ${JSON.stringify(displayLabels)},
                     datasets: [{
                         label: 'Series Totales por Día',
                         data: ${JSON.stringify(displayData)},
                         fill: true,
                         backgroundColor: '${lineChartColors.areaFill}', // Use defined color
                         borderColor: '${lineChartColors.main}', // Use defined color
                         borderWidth: 2.5,
                         pointBackgroundColor: '${lineChartColors.main}',
                         pointBorderColor: '${lineChartColors.pointBorder}',
                         pointBorderWidth: 1.5,
                         pointHoverBackgroundColor: '${lineChartColors.pointHoverBackground}',
                         pointHoverBorderColor: '${lineChartColors.main}',
                         pointRadius: 4.5,
                         pointHoverRadius: 6.5,
                         tension: 0.2
                     }]
                 },
                 options: {
                     scales: {
                         y: {
                             beginAtZero: true,
                             title: {
                                 display: true,
                                 text: 'Número Total de Series',
                                 font: { size: 11 },
                                 color: '#555555', // Darker gray axis title
                                 padding: { top: 0, bottom: 5 }
                             },
                             ticks: {
                                 color: 'rgba(0, 0, 0, 0.7)', // Darker ticks
                                 precision: 0,
                                 font: { size: 10 }
                             },
                              grid: {
                                  color: 'rgba(0, 0, 0, 0.1)' // Slightly darker grid
                              }
                         },
                         x: {
                              title: {
                                  display: true,
                                  text: 'Día de Entrenamiento',
                                  font: { size: 11 },
                                  color: '#555555', // Darker gray axis title
                                  padding: { top: 5, bottom: 0 }
                              },
                              ticks: {
                                  color: 'rgba(0, 0, 0, 0.8)', // Darker ticks
                                  font: { size: 10 }
                              },
                              grid: {
                                  display: false
                              }
                         }
                     },
                     plugins: {
                         legend: {
                             display: false,
                         },
                         tooltip: { // Keep tooltips for hover details
                             enabled: true,
                             backgroundColor: 'rgba(0, 0, 0, 0.8)',
                             titleFont: { size: 12, weight: 'bold' },
                             bodyFont: { size: 11 },
                             padding: 8,
                             boxPadding: 3,
                             cornerRadius: 3,
                              callbacks: {
                                  title: function(tooltipItems) {
                                       return tooltipItems[0]?.label || '';
                                  },
                                  label: function(context) {
                                       let label = context.dataset.label || '';
                                       if (label) { label += ': '; }
                                       if (context.parsed.y !== null) {
                                           label += context.parsed.y + ' series';
                                       }
                                       return label;
                                  }
                              }
                         },
                         datalabels: { // Configuration for chartjs-plugin-datalabels
                             display: false, // Keep hidden by default, enable if needed
                             anchor: 'end',
                             align: 'top',
                             color: '${lineChartColors.datalabelColor}', // Label text color
                             font: {
                                 size: 10,
                                 weight: '600'
                             },
                             formatter: (value, context) => {
                                 return value;
                             },
                         }
                     },
                     responsive: true,
                     maintainAspectRatio: false
                 }
             });
              console.log("[Volume Script - Daily v11] Volume chart initialized successfully with datalabels.");
        } catch (error) {
              console.error("[Volume Script - Daily v11] Error initializing Volume Line Chart:", error);
        }
      }

      // Initialize chart when the DOM is ready
      if (document.readyState === 'loading') {
           document.addEventListener('DOMContentLoaded', initVolumeLineChart);
      } else {
           // Delay slightly if DOM is already loaded
           setTimeout(initVolumeLineChart, 50);
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
    // 1. Calculate component scores using the improved function
    const scores = calculateTrainingComponentScores(routineHtml); // Use v2

    // 2. Calculate DAILY volume using the revised function
    const dailyVolumeData = calculateDailyVolume(routineHtml); // Use v10
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

    // 5. Get CSS styles (with white background modifications)
    const styles = getCoverPageStyles();

    // 6. Get Chart.js initialization scripts (with color adjustments for white bg)
    const radarScript = getRadarChartScript(scores);
    const volumeScript = getVolumeLineChartScript(dailyVolumeData);

    // 7. Combine scripts (including Chart.js AND the datalabels plugin)
    const combinedScript = `
        <script src="https://cdn.jsdelivr.net/npm/chart.js@3.7.1/dist/chart.min.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.0.0"></script>
        <script> Chart.register(ChartDataLabels); </script>{/* Register plugin globally */}
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
    calculateTrainingComponentScores, // Export v2
    calculateDailyVolume, // Export v10
    createCoverPage,
    // Keep other exports if they were needed for testing/other modules
    generateCoverPageHtml,
    getCoverPageStyles,
    getRadarChartScript,
    getVolumeLineChartScript // Export v11
};
