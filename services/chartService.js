const puppeteer = require('puppeteer');

/**
 * Analyzes the routine HTML to calculate training component scores.
 * @param {string} routineHtml - The HTML content of the generated routine.
 * @returns {Object} - Scores for each training component (0-100).
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

  // If no HTML, return default scores
  if (!routineHtml || routineHtml.trim() === '') {
    // Default balanced profile if no data
    return {
      fuerza: 50,
      hipertrofia: 50,
      movilidad: 50,
      potencia: 50,
      tecnica: 50,
      cardio: 50
    };
  }

  // Keywords for each training component
  const keywords = {
    fuerza: ['fuerza', 'strength', 'carga', 'peso', 'resistencia', 'weight', 'sentadilla', 'squat', 'press', 'deadlift', 'peso muerto', 'power', 'potencia', 'rm', '1rm', 'máxima', 'maximales', 'intensidad alta', 'pesado', 'heavy'],
    hipertrofia: ['hipertrofia', 'hypertrophy', 'volumen', 'volume', 'muscle', 'músculo', 'muscular', 'growth', 'crecimiento', 'tamaño', 'size', 'bodybuilding', 'culturismo', 'series', 'repeticiones', 'reps', 'rir'],
    movilidad: ['movilidad', 'mobility', 'flexibility', 'flexibilidad', 'stretching', 'estiramiento', 'range', 'motion', 'rango', 'articular', 'joint', 'rom', 'elasticidad', 'elongación', 'estirar', 'stretch'],
    potencia: ['potencia', 'power', 'explosiv', 'explosi[oó]n', 'velocidad', 'speed', 'fast', 'rápido', 'salto', 'jump', 'plyometric', 'pliometría', 'reactiv', 'sprint', 'lanzamiento', 'throw', 'tiempo', 'time', 'tempo.*[xX]'],
    tecnica: ['técnica', 'technique', 'form', 'forma', 'skill', 'habilidad', 'balance', 'equilibrio', 'coordination', 'coordinación', 'control', 'pattern', 'patrón', 'motor', 'stability', 'estabilidad'],
    cardio: ['cardio', 'cardiovascular', 'aeróbico', 'aerobic', 'resistencia', 'endurance', 'stamina', 'interval', 'intervalos', 'hiit', 'heart', 'rate', 'ritmo', 'cardiac', 'cardíaco', 'vo2', 'máximo', 'correr', 'run', 'nadar', 'swim']
  };

  // Count occurrences of keywords
  const counts = {
    fuerza: 0,
    hipertrofia: 0,
    movilidad: 0,
    potencia: 0,
    tecnica: 0,
    cardio: 0
  };

  // Analyze the HTML content for each component using keywords
  Object.keys(keywords).forEach(component => {
    keywords[component].forEach(keyword => {
      // Create a case-insensitive regular expression with word boundaries
      // Handles accents and variations for some keywords implicitly if they share roots
      try {
        const regex = new RegExp(`\\b${keyword}\\w*\\b`, 'gi');
        const matches = routineHtml.match(regex) || [];
        counts[component] += matches.length;
      } catch (e) {
        console.warn(`Invalid regex for keyword: ${keyword}`, e);
      }
    });
  });

  // --- Additional Heuristics ---

  // 1. Rep Ranges Analysis
  const repMatches = routineHtml.match(/(\d+)\s*-\s*(\d+)\s+reps?/gi) || routineHtml.match(/(\d+)\s+reps?/gi) || [];
  let lowRepSets = 0;
  let midRepSets = 0;
  let highRepSets = 0;

  repMatches.forEach(match => {
    const repNumbers = match.match(/\d+/g);
    if (repNumbers) {
        const maxReps = Math.max(...repNumbers.map(Number));
        if (maxReps <= 6) lowRepSets++;
        else if (maxReps <= 12) midRepSets++;
        else highRepSets++;
    }
  });

  counts.fuerza += lowRepSets * 1.5; // Boost strength for low reps
  counts.hipertrofia += midRepSets * 1.5; // Boost hypertrophy for mid reps
  counts.cardio += highRepSets * 0.5; // Slightly boost cardio/endurance for high reps

  // 2. Specific Exercise Keywords
  const specificExercises = {
    fuerza: ['press de banca', 'sentadilla', 'peso muerto', 'press militar'],
    hipertrofia: ['curl', 'elevaciones laterales', 'extensiones de triceps', 'remo con mancuernas'],
    movilidad: ['rotaciones', 'puente de glúteos', 'estiramiento'],
    potencia: ['salto', 'lanzamiento', 'swing'],
    tecnica: ['equilibrio', 'pistol squat', 'turkish get up'],
    cardio: ['correr', 'burpee', 'jumping jack']
  };

  Object.keys(specificExercises).forEach(component => {
    specificExercises[component].forEach(ex => {
      try {
        const regex = new RegExp(ex.replace(/\s+/g, '\\s+'), 'gi'); // Match exercise name case-insensitively
        const matches = routineHtml.match(regex) || [];
        counts[component] += matches.length * 2; // Give higher weight to specific exercises
      } catch(e) {
         console.warn(`Invalid regex for exercise: ${ex}`, e);
      }
    });
  });

  // 3. Intensity/Tempo Indicators
  if (routineHtml.match(/RIR\s+[0-2]/gi)) counts.hipertrofia += 5; // High intensity -> Hypertrophy/Strength
  if (routineHtml.match(/RIR\s+[3-4]/gi)) counts.hipertrofia += 2; // Moderate intensity
  if (routineHtml.match(/tempo.*[xX]/gi)) counts.potencia += 5; // Explosive tempo
  if (routineHtml.match(/tempo\s+\d{3,}/gi)) counts.tecnica += 3; // Controlled tempo -> Technique/Hypertrophy

  // --- Normalization ---

  // Calculate total count for relative scoring
  const totalCount = Object.values(counts).reduce((sum, count) => sum + count, 0);

  // If totalCount is 0, return default balanced scores
  if (totalCount === 0) {
    return { fuerza: 50, hipertrofia: 50, movilidad: 50, potencia: 50, tecnica: 50, cardio: 50 };
  }

  // Calculate normalized scores (0-100) based on proportion
  Object.keys(counts).forEach(component => {
    scores[component] = Math.round((counts[component] / totalCount) * 100);
  });

  // --- Smoothing and Thresholding ---

  // Ensure scores sum roughly to 100 after adjustments (optional, can lead to complex redistribution)
  // For simplicity, we'll just apply a minimum threshold.

  // Apply a minimum threshold to avoid zero scores if a component is present at all
  const minThreshold = 10;
  let belowThresholdCount = 0;
  let totalAboveThreshold = 0;

  Object.keys(scores).forEach(component => {
    if (counts[component] > 0 && scores[component] < minThreshold) {
      scores[component] = minThreshold;
    }
    if (scores[component] < minThreshold) {
        belowThresholdCount++;
    } else {
        totalAboveThreshold += scores[component];
    }
  });

  // Optional: Redistribute remaining points if needed, but can get complex.
  // Let's cap scores at 100 instead.
   Object.keys(scores).forEach(component => {
      scores[component] = Math.min(scores[component], 100);
   });


  // Find the component(s) with the highest score for potential use in description
  let maxScore = 0;
  let mainComponents = [];
  Object.entries(scores).forEach(([component, score]) => {
    if (score > maxScore) {
      maxScore = score;
      mainComponents = [component];
    } else if (score === maxScore) {
      mainComponents.push(component);
    }
  });

  // Add main components to the scores object to pass it easily
  scores.mainComponents = mainComponents;
  // Capitalize component names for display
  scores.mainComponentsDisplay = mainComponents.map(c => c.charAt(0).toUpperCase() + c.slice(1)).join(', ');


  console.log("Calculated Scores:", scores); // Log scores for debugging
  return scores;
}


/**
 * Generates radar chart HTML for the cover page (Improved Design).
 * @param {Object} scores - Training component scores including mainComponentsDisplay.
 * @param {string} clientName - Name of the client.
 * @returns {string} - HTML for the radar chart cover page.
 */
function generateRadarChartHtml(scores, clientName = 'Cliente') {
  const date = new Date().toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Generate dynamic description based on main components
  let description = `Hola ${clientName}, este gráfico visualiza el enfoque de tu nuevo plan de entrenamiento. `;
  if (scores.mainComponents && scores.mainComponents.length > 0) {
      description += `Hemos puesto énfasis en **${scores.mainComponentsDisplay}** para ayudarte a alcanzar tus objetivos.`;
  } else {
      description += `Está diseñado para proporcionarte un desarrollo equilibrado en todas las áreas clave.`;
  }

  return `
  <div class="cover-page-new">
    <div class="cover-header-new">
      <img class="cover-logo-new" src="LOGO_BASE_64_PLACEHOLDER" alt="Logo Fitform">
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
      <div class="radar-chart-container-new">
        <canvas id="radarChart"></canvas>
      </div>
    </div>

    <div class="cover-footer-new">
        <p>© ${new Date().getFullYear()} Fitform - Todos los derechos reservados</p>
    </div>
  </div>
  `;
}

/**
 * Generates CSS styles for the improved radar chart cover page.
 * @returns {string} - CSS styles.
 */
function getRadarChartStyles() {
  // Using the same color variables defined in pdfService.js
  return `
    /* Improved Radar Chart Cover Page Styles */
    .cover-page-new {
      position: relative;
      display: flex;
      flex-direction: column;
      min-height: 100vh; /* Ensure it takes full page height */
      width: 100%;
      padding: 50px 60px; /* Generous padding */
      background: linear-gradient(145deg, var(--primary-color) 0%, var(--secondary-color) 100%); /* Use brand gradient */
      color: #ffffff; /* Default text color on dark background */
      box-sizing: border-box;
      font-family: 'Inter', 'Arial', sans-serif;
      page-break-after: always; /* Ensure it's on its own page */
    }

    .cover-header-new {
      width: 100%;
      display: flex;
      justify-content: space-between;
      align-items: flex-start; /* Align items to the top */
      margin-bottom: 40px; /* Space below header */
      border-bottom: 1px solid rgba(255, 255, 255, 0.2); /* Subtle separator */
      padding-bottom: 20px;
    }

    .cover-logo-new {
      width: 130px; /* Slightly smaller logo */
      height: auto;
      filter: brightness(0) invert(1); /* Make logo white */
      opacity: 0.9;
    }

    .client-info-new {
      text-align: right;
    }

    .client-info-new h1 {
      font-size: 32px; /* Larger client name */
      font-weight: 700;
      color: #ffffff;
      margin: 0 0 5px 0;
      line-height: 1.2;
    }

    .client-info-new p {
      margin: 0;
      color: rgba(255, 255, 255, 0.8); /* Slightly transparent white for date */
      font-size: 15px;
      font-weight: 400;
    }

    .cover-main-new {
        flex-grow: 1; /* Allow main content to fill space */
        display: flex;
        align-items: center; /* Vertically center chart and text */
        justify-content: space-between;
        gap: 50px; /* Space between text/legend and chart */
        width: 100%;
        margin-bottom: 40px; /* Space above footer */
    }

    .cover-text-content {
        flex: 1; /* Take available space */
        max-width: 45%; /* Limit width */
    }

    .cover-text-content h2 {
      font-size: 28px; /* Title size */
      font-weight: 700;
      color: #ffffff;
      margin-bottom: 20px;
      line-height: 1.3;
      position: relative;
      display: inline-block;
    }

     /* Optional: Underline for the title */
    .cover-text-content h2::after {
       content: '';
       position: absolute;
       bottom: -8px;
       left: 0;
       width: 60px;
       height: 3px;
       background-color: var(--accent-color); /* Use accent color for underline */
       border-radius: 2px;
    }


    .cover-description-new {
      font-size: 16px;
      color: rgba(255, 255, 255, 0.85);
      line-height: 1.7;
      margin-bottom: 30px;
      font-weight: 400;
    }

    .cover-description-new strong {
        color: #ffffff;
        font-weight: 600;
    }

    .components-legend-new {
      display: flex;
      gap: 30px; /* Space between columns */
      background-color: rgba(255, 255, 255, 0.08); /* Subtle background for legend */
      padding: 20px;
      border-radius: var(--border-radius);
      border: 1px solid rgba(255, 255, 255, 0.15);
    }

    .legend-column {
        display: flex;
        flex-direction: column;
        gap: 12px; /* Space between items in a column */
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
    }

    /* Use distinct, bright colors for dots on dark background */
    .fuerza-color { background-color: #3498db; } /* Blue */
    .hipertrofia-color { background-color: #2ecc71; } /* Green */
    .movilidad-color { background-color: #f1c40f; } /* Yellow */
    .potencia-color { background-color: #e74c3c; } /* Red */
    .tecnica-color { background-color: #9b59b6; } /* Purple */
    .cardio-color { background-color: #e67e22; } /* Orange */

    .component-label-new {
      font-size: 14px;
      font-weight: 500;
      color: rgba(255, 255, 255, 0.9);
    }

    .component-label-new span {
      font-weight: 700;
      color: #ffffff;
    }

    .radar-chart-container-new {
      flex: 1; /* Take available space */
      max-width: 48%; /* Limit width */
      height: 400px; /* Fixed height */
      background-color: rgba(255, 255, 255, 0.95); /* Almost white background for contrast */
      border-radius: 12px;
      padding: 25px;
      box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
      display: flex; /* Center canvas inside */
      align-items: center;
      justify-content: center;
    }

    #radarChart {
      max-width: 100%;
      max-height: 100%;
    }

    .cover-footer-new {
        width: 100%;
        text-align: center;
        padding-top: 20px;
        margin-top: auto; /* Push footer to the bottom */
        border-top: 1px solid rgba(255, 255, 255, 0.2); /* Subtle separator */
        font-size: 11px;
        color: rgba(255, 255, 255, 0.7);
    }
  `;
}

/**
 * Generates Chart.js initialization script for the radar chart (Adjusted for new design).
 * @param {Object} scores - Training component scores.
 * @returns {string} - JavaScript code for initializing the chart.
 */
function getRadarChartScript(scores) {
  // Convert scores object to array in the correct order for Chart.js
  const chartData = [
      scores.fuerza,
      scores.hipertrofia,
      scores.movilidad,
      scores.potencia,
      scores.tecnica,
      scores.cardio
  ];

  return `
    <script src="https://cdn.jsdelivr.net/npm/chart.js@3.7.1/dist/chart.min.js"></script>
    <script>
      // Function to initialize the radar chart
      function initRadarChart() {
        const ctx = document.getElementById('radarChart');
        if (!ctx) {
            console.error("Canvas element #radarChart not found");
            return;
        }
        const chartContext = ctx.getContext('2d');
        if (!chartContext) {
             console.error("Failed to get 2D context from canvas");
            return;
        }

        // Chart.js configuration - Adjusted for better visuals on light background
        const radarChart = new Chart(chartContext, {
          type: 'radar',
          data: {
            labels: ['Fuerza', 'Hipertrofia', 'Movilidad', 'Potencia', 'Técnica', 'Cardio'],
            datasets: [{
              label: 'Perfil de Entrenamiento',
              data: ${JSON.stringify(chartData)}, // Use data array
              backgroundColor: 'rgba(10, 42, 94, 0.2)', // Use primary color with transparency
              borderColor: 'rgba(10, 42, 94, 0.8)', // Darker border
              borderWidth: 2,
              pointBackgroundColor: 'rgba(10, 42, 94, 1)', // Solid points
              pointBorderColor: '#fff', // White border around points
              pointHoverBackgroundColor: '#fff',
              pointHoverBorderColor: 'rgba(10, 42, 94, 1)'
            }]
          },
          options: {
            scales: {
              r: { // Radial axis (the spokes)
                angleLines: { // Lines radiating from the center
                  display: true,
                  color: 'rgba(0, 0, 0, 0.1)' // Light grey lines
                },
                suggestedMin: 0,
                suggestedMax: 100,
                grid: { // Lines forming the web
                    color: 'rgba(0, 0, 0, 0.1)' // Light grey lines
                },
                ticks: { // Numbers on the axis (0, 20, 40...)
                  stepSize: 20,
                  color: 'rgba(0, 0, 0, 0.5)', // Darker grey for numbers
                  backdropColor: 'rgba(255, 255, 255, 0.7)', // Semi-transparent white background for ticks
                  padding: 8
                },
                pointLabels: { // Labels around the edge (Fuerza, Cardio...)
                  font: {
                    size: 13, // Slightly smaller labels
                    weight: '600' // Bolder
                  },
                  color: 'rgba(0, 0, 0, 0.8)' // Dark text for labels
                }
              }
            },
            plugins: {
              legend: {
                display: false // Legend is handled separately in HTML
              },
              tooltip: {
                enabled: true,
                backgroundColor: 'rgba(0, 0, 0, 0.8)', // Dark tooltip
                titleFont: { size: 14 },
                bodyFont: { size: 13 },
                padding: 10,
                boxPadding: 4
              }
            },
            responsive: true,
            maintainAspectRatio: false // Important to fit container
          }
        });
      }

      // Ensure chart initializes after the DOM is ready,
      // especially important when content is set dynamically by Puppeteer.
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
 * Creates a complete radar chart cover page with scores calculated from routine HTML.
 * @param {string} routineHtml - The HTML content of the routine.
 * @param {string} clientName - Name of the client.
 * @param {string} logoBase64 - Base64 encoded logo image.
 * @returns {object} - Object containing coverPageHtml, styles, script, and scores.
 */
function createRadarChartCoverPage(routineHtml, clientName, logoBase64) {
  // Calculate scores based on the routine content
  const scores = calculateTrainingComponentScores(routineHtml); // scores now includes mainComponentsDisplay

  // Generate HTML for the cover page using the improved function
  let coverPageHtml = generateRadarChartHtml(scores, clientName);

  // Replace logo placeholder with actual base64 image
  if (logoBase64) {
    coverPageHtml = coverPageHtml.replace('LOGO_BASE_64_PLACEHOLDER', logoBase64);
  } else {
     // Provide a fallback or remove the img tag if no logo
     coverPageHtml = coverPageHtml.replace('<img class="cover-logo-new" src="LOGO_BASE_64_PLACEHOLDER" alt="Logo Fitform">', '');
     console.warn("Logo Base64 not provided for cover page.");
  }

  // Get styles and script using the improved functions
  const styles = getRadarChartStyles();
  const script = getRadarChartScript(scores); // Pass scores to script function

  return { coverPageHtml, styles, script, scores };
}

module.exports = {
  calculateTrainingComponentScores, // Export if needed elsewhere
  createRadarChartCoverPage
};
