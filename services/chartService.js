const fs = require('fs');
const path = require('path');
const os = require('os');
const cheerio = require('cheerio'); // For parsing HTML
const { ChartJSNodeCanvas } = require('chart.js-node-canvas'); // For generating chart images
const Chart = require('chart.js'); // Required by chart.js-node-canvas

// --- Configuration ---
const chartWidth = 400; // Pixels
const chartHeight = 400; // Pixels
const chartLabels = ['Fuerza', 'Hipertrofia', 'Movilidad', 'Potencia', 'Técnica', 'Cardio'];
const chartBackgroundColor = 'rgba(33, 150, 243, 0.3)'; // Example blue fill
const chartBorderColor = 'rgba(33, 150, 243, 0.8)'; // Example blue border

// --- Basic Exercise Categorization (Needs Significant Expansion) ---
// This is a VERY simplified mapping based on keywords.
// A real implementation would need a much larger database or more sophisticated rules.
const exerciseCategories = {
    FUERZA: ['squat', 'sentadilla', 'deadlift', 'peso muerto', 'bench', 'press banca', 'press militar', 'overhead press', 'row', 'remo', 'pull-up', 'dominada', 'dip', 'fondos'],
    HIPERTROFIA: ['curl', 'fly', 'apertura', 'extension', 'raise', 'elevación', 'pulldown', 'jalón', 'pushdown'], // Often overlaps with Fuerza
    MOVILIDAD: ['stretch', 'estiramiento', 'mobility', 'movilidad', 'yoga', 'foam roll'],
    POTENCIA: ['jump', 'salto', 'throw', 'lanzamiento', 'olympic lift', 'clean', 'jerk', 'snatch', 'swing', 'kettlebell swing', 'plyo'],
    TECNICA: [], // Harder to identify via keywords alone, might rely on notes or user level
    CARDIO: ['run', 'carrera', 'bike', 'bicicleta', 'rowing', 'remo maquina', 'elliptical', 'elíptica', 'burpee', 'circuit', 'circuito', 'hiit', 'interval'],
};

/**
 * Parses the routine HTML to extract exercise details.
 * @param {string} routineHtml - The HTML content of the routine.
 * @returns {Array<object>} - Array of exercises with details { name, sets, reps, notes }.
 */
function parseRoutineHtml(routineHtml) {
    const $ = cheerio.load(routineHtml);
    const exercises = [];

    // Find all tables assumed to contain routine data
    $('table').each((_, table) => {
        // Find rows, skipping header rows (th or specific classes)
        $(table).find('tr').each((_, row) => {
            const cells = $(row).find('td');
            // Basic check: Ensure it looks like an exercise row (e.g., has multiple cells)
            // And doesn't belong to header classes like 'activacion-header' or 'rutina-header'
            if (cells.length >= 4 && !$(row).hasClass('activacion-header') && !$(row).hasClass('rutina-header')) {
                const exerciseData = {
                    name: $(cells[0]).text().trim(),
                    sets: $(cells[1]).text().trim(),
                    reps: $(cells[2]).text().trim(),
                    notes: $(cells[4]).text().trim(), // Assuming notes are in the 5th cell (index 4)
                };
                // Basic validation
                if (exerciseData.name && exerciseData.sets && exerciseData.reps) {
                    exercises.push(exerciseData);
                }
            }
        });
    });
    console.log(`Parsed ${exercises.length} exercises from HTML.`);
    return exercises;
}

/**
 * Categorizes an exercise based on keywords. (Simplified)
 * @param {string} exerciseName - The name of the exercise.
 * @returns {Array<string>} - Array of categories (e.g., ['FUERZA', 'HIPERTROFIA']).
 */
function categorizeExercise(exerciseName) {
    const categories = new Set();
    const lowerName = exerciseName.toLowerCase();

    for (const category in exerciseCategories) {
        for (const keyword of exerciseCategories[category]) {
            if (lowerName.includes(keyword)) {
                categories.add(category);
                // Avoid adding Hipertrofia if a clear Fuerza keyword is present unless explicitly needed
                if (category === 'FUERZA' && exerciseCategories['HIPERTROFIA'].some(hkw => lowerName.includes(hkw))) {
                     // Keep both if both keywords match
                } else if (category === 'HIPERTROFIA' && exerciseCategories['FUERZA'].some(fkw => lowerName.includes(fkw))) {
                     // If a strong fuerza keyword matched, maybe prioritize Fuerza? (heuristic decision)
                     // For now, let's add both if keywords overlap
                }
            }
        }
    }

    // Default HACK: If it's not Cardio/Movilidad/Potencia, assume it contributes to Fuerza/Hipertrofia
     if (categories.size === 0 && !exerciseCategories['CARDIO'].some(kw => lowerName.includes(kw)) && !exerciseCategories['MOVILIDAD'].some(kw => lowerName.includes(kw)) && !exerciseCategories['POTENCIA'].some(kw => lowerName.includes(kw))) {
         categories.add('FUERZA');
         categories.add('HIPERTROFIA');
     }


    return Array.from(categories);
}

/**
 * Calculates scores for each training component based on parsed exercises and user profile.
 * @param {Array<object>} exercises - Array of parsed exercises.
 * @param {object} userProfile - User profile data (e.g., { trainingGoal, experienceLevel }).
 * @returns {object} - Object with raw scores for each component.
 */
function calculateScores(exercises, userProfile = {}) {
    const rawScores = {
        FUERZA: 0,
        HIPERTROFIA: 0,
        MOVILIDAD: 0,
        POTENCIA: 0,
        TECNICA: 0,
        CARDIO: 0,
    };

    // --- Scoring Weights (Adjustable Heuristics) ---
    const pointsPerSet = 1;
    const basePointsPerRep = 0.1;
    const goalMultiplier = 1.5; // Increase score if component matches goal
    const beginnerTechBonus = 5; // Add points to Tecnica for beginners per exercise

    exercises.forEach(ex => {
        const categories = categorizeExercise(ex.name);
        if (categories.length === 0) return; // Skip uncategorized

        // --- Parse Sets & Reps (Handle ranges, e.g., "3-4", "8-12") ---
        let avgSets = 0;
        const setMatch = String(ex.sets).match(/(\d+)/); // Get first number
        if (setMatch) avgSets = parseInt(setMatch[1], 10);
        if (isNaN(avgSets) || avgSets <= 0) avgSets = 1; // Default to 1 set if parsing fails

        let avgReps = 0;
        const repMatch = String(ex.reps).match(/(\d+)(?:-(\d+))?/); // Get first number and optional second number
        if (repMatch) {
            const rep1 = parseInt(repMatch[1], 10);
            const rep2 = repMatch[2] ? parseInt(repMatch[2], 10) : rep1;
            avgReps = (rep1 + rep2) / 2;
        }
         if (isNaN(avgReps) || avgReps <= 0) {
             // Handle non-numeric reps like "AMRAP", "Al fallo" -> assign moderate rep value?
             if (/amrap|fallo/i.test(String(ex.reps))) avgReps = 10;
             else avgReps = 8; // Default reps if parsing fails
         }

        // --- Calculate Base Score ---
        const exerciseBaseScore = avgSets * pointsPerSet * (1 + avgReps * basePointsPerRep);

        // --- Distribute Score based on Category & Reps ---
        categories.forEach(cat => {
            let scoreMultiplier = 1.0;

            // Rep-based adjustments
            if (cat === 'FUERZA' && avgReps < 7) scoreMultiplier *= 1.3; // Bonus for low reps
            if (cat === 'HIPERTROFIA' && avgReps >= 6 && avgReps <= 15) scoreMultiplier *= 1.2; // Bonus for hypertrophy range
            if (cat === 'POTENCIA' && avgReps < 8) scoreMultiplier *= 1.3; // Bonus for low-rep power work
            if (cat === 'CARDIO' && avgReps > 15) scoreMultiplier *= 1.2; // Bonus for high-rep cardio/conditioning
            if (cat === 'MOVILIDAD') scoreMultiplier *= 0.8; // Generally lower score contribution unless specific focus
            if (cat === 'TECNICA') scoreMultiplier *= 0.7; // Base technique score is lower, boosted by notes/level

            // Apply Goal Multiplier (Simplified: check if category name is in goal string)
            if (userProfile.trainingGoal && userProfile.trainingGoal.toLowerCase().includes(cat.toLowerCase())) {
                scoreMultiplier *= goalMultiplier;
            }

            rawScores[cat] += exerciseBaseScore * scoreMultiplier;
        });

        // --- Technique Bonus/Notes ---
        if (userProfile.experienceLevel && userProfile.experienceLevel.toLowerCase().includes('principiante')) {
            rawScores.TECNICA += beginnerTechBonus;
        }
        if (ex.notes && /técnica|forma|control|lento/i.test(ex.notes)) {
            rawScores.TECNICA += exerciseBaseScore * 0.5; // Add technique points based on notes
        }
         // Reduce other scores slightly if technique is the main focus? (complex heuristic)
         if (rawScores.TECNICA > 0 && categories.length > 1) {
             // Optional: slightly decrease other scores if technique is emphasized
         }
    });

    console.log("Raw Scores:", rawScores);
    return rawScores;
}

/**
 * Normalizes scores to a 0-100 scale.
 * @param {object} rawScores - Object with raw scores for each component.
 * @returns {object} - Object with normalized scores (0-100).
 */
function normalizeScores(rawScores) {
    const normalizedScores = {};
    const scoresArray = Object.values(rawScores);

    // Find max score achieved in this routine
    const maxScore = Math.max(...scoresArray);

    // Avoid division by zero if all scores are 0
    if (maxScore === 0) {
        chartLabels.forEach(label => {
            normalizedScores[label.toUpperCase()] = 0;
        });
        return normalizedScores;
    }

    // Normalize each score relative to the max score
    chartLabels.forEach(label => {
        const key = label.toUpperCase();
        const score = rawScores[key] || 0;
        // Scale score relative to max, ensure it's between 0 and 100
        normalizedScores[key] = Math.max(0, Math.min(100, Math.round((score / maxScore) * 100)));
    });

    console.log("Normalized Scores:", normalizedScores);
    return normalizedScores;
}

/**
 * Creates the radar chart image using ChartJSNodeCanvas.
 * @param {object} normalizedScores - Object with normalized scores (0-100).
 * @returns {Promise<string>} - Promise resolving with the file path of the generated PNG image.
 */
async function createChartImage(normalizedScores) {
    const chartJSNodeCanvas = new ChartJSNodeCanvas({ width: chartWidth, height: chartHeight, backgroundColour: 'transparent' }); // Use transparent background

    const scoreData = chartLabels.map(label => normalizedScores[label.toUpperCase()] || 0);

    const configuration = {
        type: 'radar',
        data: {
            labels: chartLabels,
            datasets: [{
                label: 'Enfoque Semanal', // Weekly Focus
                data: scoreData,
                backgroundColor: chartBackgroundColor,
                borderColor: chartBorderColor,
                borderWidth: 2,
                pointBackgroundColor: chartBorderColor,
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: chartBorderColor,
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
             // Ensure scales is defined
             scales: {
                r: { // Options for the radial axis (the spokes)
                    angleLines: {
                        display: true,
                        color: 'rgba(255, 255, 255, 0.3)' // Light lines for dark bg assumed on cover
                    },
                    suggestedMin: 0,
                    suggestedMax: 100,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.3)' // Grid lines
                    },
                    pointLabels: {
                        font: {
                            size: 11, // Adjust label font size
                            weight: 'bold'
                        },
                        color: '#FFFFFF' // White labels for dark bg assumed on cover
                    },
                    ticks: {
                        display: false, // Hide the numeric ticks on the spokes if desired
                        // color: 'rgba(255, 255, 255, 0.7)',
                         backdropColor: 'transparent', // Make tick background transparent
                        // stepSize: 20 // Control tick frequency
                    }
                }
            },
            plugins: {
                legend: {
                    display: false // Hide the legend ('Enfoque Semanal')
                },
                tooltip: {
                    enabled: false // Disable tooltips on hover
                }
            },
            // Maintain aspect ratio might not be needed for radar
             maintainAspectRatio: true, // Try setting to true
             responsive: false // Ensure it uses the defined width/height
        },
         // Define fallback fonts if needed, though chart.js-node-canvas usually handles this
         plugins: [{
             id: 'backgroundColour',
             beforeDraw: (chart) => {
                 const ctx = chart.ctx;
                 ctx.save();
                 ctx.fillStyle = 'transparent'; // Ensure canvas background itself is transparent
                 ctx.fillRect(0, 0, chart.width, chart.height);
                 ctx.restore();
             }
         }]
    };

    try {
        const imageBuffer = await chartJSNodeCanvas.renderToBuffer(configuration, 'image/png');

        // Save buffer to a temporary file
        const tempDir = os.tmpdir();
        const fileName = `radar_chart_${Date.now()}.png`;
        const filePath = path.join(tempDir, fileName);

        await fs.promises.writeFile(filePath, imageBuffer);
        console.log(`Radar chart image saved to: ${filePath}`);
        return filePath;

    } catch (error) {
        console.error("Error generating chart image:", error);
        throw new Error("Failed to generate radar chart image.");
    }
}

/**
 * Main function to generate the radar chart image for a given routine.
 * @param {string} routineHtml - The HTML content of the weekly routine.
 * @param {object} userProfile - User profile data (e.g., { trainingGoal, experienceLevel }).
 * @returns {Promise<string>} - Promise resolving with the file path of the generated PNG image.
 */
async function generateRadarChartImage(routineHtml, userProfile) {
    if (!routineHtml) {
        throw new Error("Routine HTML content is required.");
    }

    try {
        // 1. Parse HTML
        const exercises = parseRoutineHtml(routineHtml);
        if (exercises.length === 0) {
             console.warn("No exercises found in routine HTML. Cannot generate chart.");
             // Return a path to a default/placeholder image or throw error?
             // For now, let's throw an error.
             throw new Error("No exercises parsed from routine HTML.");
        }

        // 2. Calculate Raw Scores
        const rawScores = calculateScores(exercises, userProfile);

        // 3. Normalize Scores
        const normalizedScores = normalizeScores(rawScores);

        // 4. Create Chart Image
        const imagePath = await createChartImage(normalizedScores);

        return imagePath;

    } catch (error) {
        console.error("Error in generateRadarChartImage:", error);
        // Rethrow the error to be handled by the caller
        throw error;
    }
}

module.exports = {
    generateRadarChartImage,
    // Expose helper functions for potential testing or direct use if needed
    parseRoutineHtml,
    calculateScores,
    normalizeScores,
    createChartImage
};
