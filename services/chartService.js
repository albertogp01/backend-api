const puppeteer = require('puppeteer');

/**
 * Analyzes the routine HTML to calculate training component scores
 * @param {string} routineHtml - The HTML content of the generated routine
 * @returns {Object} - Scores for each training component (0-100)
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
    // Default balanced profile
    return {
      fuerza: 60,
      hipertrofia: 60,
      movilidad: 60,
      potencia: 60,
      tecnica: 60,
      cardio: 60
    };
  }

  // Keywords for each training component
  const keywords = {
    fuerza: ['fuerza', 'strength', 'carga', 'peso', 'resistencia', 'weight', 'sentadilla', 'squat', 'press', 'deadlift', 'peso muerto', 'power', 'potencia', 'rm', '1rm', 'máxima', 'maximales', 'intensidad alta'],
    hipertrofia: ['hipertrofia', 'hypertrophy', 'volumen', 'volume', 'muscle', 'músculo', 'muscular', 'growth', 'crecimiento', 'tamaño', 'size', 'bodybuilding', 'culturismo', 'series', 'repeticiones', 'reps'],
    movilidad: ['movilidad', 'mobility', 'flexibility', 'flexibilidad', 'stretching', 'estiramiento', 'range', 'motion', 'rango', 'articular', 'joint', 'rom', 'elasticidad', 'elongación'],
    potencia: ['potencia', 'power', 'explosiv', 'explosión', 'velocidad', 'speed', 'fast', 'rápido', 'salto', 'jump', 'plyometric', 'pliometría', 'reactiv', 'sprint', 'lanzamiento', 'throw', 'tiempo', 'time'],
    tecnica: ['técnica', 'technique', 'form', 'forma', 'skill', 'habilidad', 'balance', 'equilibrio', 'coordination', 'coordinación', 'control', 'pattern', 'patrón', 'motor', 'stability', 'estabilidad'],
    cardio: ['cardio', 'cardiovascular', 'aeróbico', 'aerobic', 'resistencia', 'endurance', 'stamina', 'interval', 'intervalos', 'hiit', 'heart', 'rate', 'ritmo', 'cardiac', 'cardíaco', 'vo2', 'máximo']
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

  // Analyze the HTML content for each component
  Object.keys(keywords).forEach(component => {
    keywords[component].forEach(keyword => {
      // Create a case-insensitive regular expression with word boundaries
      const regex = new RegExp(`\\b${keyword}\\w*\\b`, 'gi');
      const matches = routineHtml.match(regex) || [];
      counts[component] += matches.length;
    });
  });

  // Additional analysis for exercise types
  const strengthSets = (routineHtml.match(/(\d+-\d+|<\d+)\s*reps/gi) || []).length;
  const hypertrophySets = (routineHtml.match(/(\d+-\d+)\s*reps/gi) || []).length;
  const highReps = (routineHtml.match(/(1[5-9]|[2-9][0-9])\s*reps/gi) || []).length;
  const lowReps = (routineHtml.match(/([1-6])\s*reps/gi) || []).length;
  
  // Add to counts based on rep ranges
  counts.fuerza += lowReps * 2;
  counts.hipertrofia += hypertrophySets * 1.5;
  counts.cardio += highReps;

  // Look for intensity indicators
  const intensityPatterns = {
    fuerza: [/alta\s+intensidad/gi, /high\s+intensity/gi, /pesado/gi, /heavy/gi, /\b[7-9][0-9]%/g, /\b1?[0-9][0-9]% ?(1|de)? ?RM/gi],
    potencia: [/explosiv/gi, /veloc[a-z]*\s+máxima/gi, /max[a-z]*\s+speed/gi, /rápido/gi, /fast/gi, /\btempo\b.*\b[xX]\b/gi],
    cardio: [/interval/gi, /hiit/gi, /sprint/gi, /aer[óo]bic/gi, /cardio/gi, /cardíaco/gi, /cardiac/gi],
    tecnica: [/estabilidad/gi, /stability/gi, /control/gi, /balance/gi, /equilibrio/gi, /coordinación/gi, /coordination/gi],
    movilidad: [/estirar/gi, /stretch/gi, /flex[a-z]*\b/gi, /rom/gi, /rango/gi, /range/gi, /joint/gi, /articular/gi]
  };

  // Apply intensity analysis
  Object.keys(intensityPatterns).forEach(component => {
    intensityPatterns[component].forEach(pattern => {
      const matches = routineHtml.match(pattern) || [];
      counts[component] += matches.length * 2; // Give more weight to intensity indicators
    });
  });

  // Get maximum count for normalization
  const maxCount = Math.max(...Object.values(counts), 1); // Avoid division by zero

  // Calculate normalized scores (0-100)
  Object.keys(counts).forEach(component => {
    scores[component] = Math.min(Math.round((counts[component] / maxCount) * 100), 100);
  });

  // Minimum threshold to ensure all components have some representation
  const minThreshold = 20;
  Object.keys(scores).forEach(component => {
    if (scores[component] < minThreshold) {
      scores[component] = minThreshold;
    }
  });

  return scores;
}

/**
 * Generates radar chart HTML for the cover page
 * @param {Object} scores - Training component scores
 * @param {string} clientName - Name of the client
 * @returns {string} - HTML for the radar chart cover page
 */
function generateRadarChartHtml(scores, clientName = 'Cliente') {
  return `
  <div class="cover-page">
    <div class="cover-header">
      <div class="logo-container">
        <img class="cover-logo" src="LOGO_BASE_64_PLACEHOLDER" alt="Logo">
      </div>
      <div class="client-info">
        <h2>${clientName || 'Cliente'}</h2>
        <p>Plan de Entrenamiento Personalizado</p>
        <p class="date">${new Date().toLocaleDateString('es-ES', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })}</p>
      </div>
    </div>
    
    <div class="cover-title">Perfil de Entrenamiento</div>
    
    <div class="radar-chart-container">
      <canvas id="radarChart" width="500" height="400"></canvas>
    </div>
    
    <div class="cover-description">
      <p>Este perfil muestra la distribución de los componentes clave en tu rutina de entrenamiento personalizada. Cada eje representa un aspecto importante de tu programa.</p>
    </div>
    
    <div class="components-legend">
      <div class="component-item">
        <div class="component-dot fuerza-color"></div>
        <div class="component-label">Fuerza: <span>${scores.fuerza}%</span></div>
      </div>
      <div class="component-item">
        <div class="component-dot hipertrofia-color"></div>
        <div class="component-label">Hipertrofia: <span>${scores.hipertrofia}%</span></div>
      </div>
      <div class="component-item">
        <div class="component-dot movilidad-color"></div>
        <div class="component-label">Movilidad: <span>${scores.movilidad}%</span></div>
      </div>
      <div class="component-item">
        <div class="component-dot potencia-color"></div>
        <div class="component-label">Potencia: <span>${scores.potencia}%</span></div>
      </div>
      <div class="component-item">
        <div class="component-dot tecnica-color"></div>
        <div class="component-label">Técnica: <span>${scores.tecnica}%</span></div>
      </div>
      <div class="component-item">
        <div class="component-dot cardio-color"></div>
        <div class="component-label">Cardio: <span>${scores.cardio}%</span></div>
      </div>
    </div>
  </div>
  `;
}

/**
 * Generates CSS styles for the radar chart cover page
 * @returns {string} - CSS styles
 */
function getRadarChartStyles() {
  return `
    /* Radar Chart Cover Page Styles */
    .cover-page {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      min-height: 100vh;
      padding: 40px;
      page-break-after: always;
      background: linear-gradient(180deg, #f8fafc 0%, #edf2f7 100%);
    }
    
    .cover-header {
      width: 100%;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 50px;
    }
    
    .logo-container {
      flex: 0 0 150px;
    }
    
    .cover-logo {
      width: 140px;
      height: auto;
    }
    
    .client-info {
      text-align: right;
    }
    
    .client-info h2 {
      font-size: 24px;
      font-weight: 700;
      color: var(--primary-color);
      margin: 0 0 8px 0;
    }
    
    .client-info p {
      margin: 0 0 5px 0;
      color: var(--text-color);
      font-size: 16px;
    }
    
    .client-info .date {
      color: var(--medium-gray);
      font-size: 14px;
    }
    
    .cover-title {
      font-size: 36px;
      font-weight: 800;
      color: var(--primary-color);
      margin-bottom: 40px;
      text-align: center;
      letter-spacing: 0.5px;
      position: relative;
    }
    
    .cover-title:after {
      content: '';
      display: block;
      width: 80px;
      height: 4px;
      background: linear-gradient(90deg, var(--primary-color) 0%, transparent 100%);
      position: absolute;
      bottom: -15px;
      left: 50%;
      transform: translateX(-50%);
      border-radius: 2px;
    }
    
    .radar-chart-container {
      width: 500px;
      height: 400px;
      margin: 0 auto 40px;
      background-color: white;
      border-radius: 12px;
      padding: 25px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
      position: relative;
    }
    
    .cover-description {
      max-width: 600px;
      text-align: center;
      color: var(--dark-gray);
      font-size: 16px;
      line-height: 1.7;
      margin-bottom: 40px;
    }
    
    .components-legend {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 20px;
      max-width: 700px;
      margin: 0 auto;
    }
    
    .component-item {
      display: flex;
      align-items: center;
      gap: 10px;
      background-color: white;
      padding: 8px 15px;
      border-radius: 50px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
    }
    
    .component-dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
    }
    
    .fuerza-color { background-color: rgba(49, 130, 206, 1); }
    .hipertrofia-color { background-color: rgba(72, 187, 120, 1); }
    .movilidad-color { background-color: rgba(246, 173, 85, 1); }
    .potencia-color { background-color: rgba(237, 100, 166, 1); }
    .tecnica-color { background-color: rgba(159, 122, 234, 1); }
    .cardio-color { background-color: rgba(246, 224, 94, 1); }
    
    .component-label {
      font-size: 14px;
      font-weight: 500;
      color: var(--dark-gray);
    }
    
    .component-label span {
      font-weight: 700;
      color: var(--primary-color);
    }
    
    /* Ensure the canvas takes the full container size */
    #radarChart {
      width: 100%;
      height: 100%;
    }
  `;
}

/**
 * Generates Chart.js initialization script for the radar chart
 * @param {Object} scores - Training component scores
 * @returns {string} - JavaScript code for initializing the chart
 */
function getRadarChartScript(scores) {
  return `
    <script src="https://cdn.jsdelivr.net/npm/chart.js@3.7.1"></script>
    <script>
      // Function to initialize the radar chart
      function initRadarChart() {
        const ctx = document.getElementById('radarChart').getContext('2d');
        
        // Training component scores calculated from routine analysis
        const scores = {
          fuerza: ${scores.fuerza},
          hipertrofia: ${scores.hipertrofia},
          movilidad: ${scores.movilidad},
          potencia: ${scores.potencia},
          tecnica: ${scores.tecnica},
          cardio: ${scores.cardio}
        };
        
        // Chart.js configuration
        const radarChart = new Chart(ctx, {
          type: 'radar',
          data: {
            labels: ['Fuerza', 'Hipertrofia', 'Movilidad', 'Potencia', 'Técnica', 'Cardio'],
            datasets: [{
              label: 'Perfil de Entrenamiento',
              data: [scores.fuerza, scores.hipertrofia, scores.movilidad, scores.potencia, scores.tecnica, scores.cardio],
              backgroundColor: 'rgba(49, 130, 206, 0.2)',
              borderColor: 'rgba(49, 130, 206, 1)',
              borderWidth: 2,
              pointBackgroundColor: 'rgba(49, 130, 206, 1)',
              pointBorderColor: '#fff',
              pointHoverBackgroundColor: '#fff',
              pointHoverBorderColor: 'rgba(49, 130, 206, 1)'
            }]
          },
          options: {
            scales: {
              r: {
                angleLines: {
                  display: true,
                  color: 'rgba(0, 0, 0, 0.1)'
                },
                suggestedMin: 0,
                suggestedMax: 100,
                ticks: {
                  stepSize: 20,
                  backgroundColor: 'rgba(0, 0, 0, 0.1)'
                },
                pointLabels: {
                  font: {
                    size: 14,
                    weight: 'bold'
                  }
                }
              }
            },
            plugins: {
              legend: {
                display: false
              },
              tooltip: {
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                titleFont: {
                  size: 14
                },
                bodyFont: {
                  size: 13
                },
                padding: 10
              }
            },
            responsive: true,
            maintainAspectRatio: false
          }
        });
      }
      
      // Call chart initialization after page load
      document.addEventListener('DOMContentLoaded', initRadarChart);
    </script>
  `;
}

/**
 * Creates a complete radar chart cover page with scores calculated from routine HTML
 * @param {string} routineHtml - The HTML content of the routine
 * @param {string} clientName - Name of the client
 * @param {string} logoBase64 - Base64 encoded logo image
 * @returns {string} - Complete HTML for the radar chart cover page
 */
function createRadarChartCoverPage(routineHtml, clientName, logoBase64) {
  // Calculate scores based on the routine content
  const scores = calculateTrainingComponentScores(routineHtml);
  
  // Generate HTML for the cover page
  let coverPageHtml = generateRadarChartHtml(scores, clientName);
  
  // Replace logo placeholder with actual base64 image
  if (logoBase64) {
    coverPageHtml = coverPageHtml.replace('LOGO_BASE_64_PLACEHOLDER', logoBase64);
  }
  
  // Add styles and scripts
  const styles = getRadarChartStyles();
  const script = getRadarChartScript(scores);
  
  return { coverPageHtml, styles, script, scores };
}

module.exports = {
  calculateTrainingComponentScores,
  createRadarChartCoverPage
};