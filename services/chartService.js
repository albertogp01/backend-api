/**
 * services/chartService.js (Versión 2.0 - Reescrita y Mejorada)
 *
 * Servicio robusto para analizar una rutina de entrenamiento en HTML, extraer datos clave
 * y generar una portada visualmente atractiva con gráficos funcionales para PDF.
 */
const fs = require('fs');
const path = require('path');

// --- FUNCIONES DE CÁLCULO DE DATOS ---

/**
 * Analiza el HTML de la rutina para extraer las variables clave del entrenamiento (series, repeticiones, etc.)
 * y calcular las puntuaciones de los componentes del entrenamiento.
 *
 * @param {string} routineHtml - El contenido HTML de la rutina generada por la IA.
 * @returns {{scores: object, dailyVolume: object}} - Un objeto con las puntuaciones normalizadas y el volumen diario.
 */
function analyzeRoutine(routineHtml) {
    const scores = { fuerza: 0, hipertrofia: 0, resistencia: 0, potencia: 0, movilidad: 0, tecnica: 0 };
    const dailyVolume = {};

    if (!routineHtml || typeof routineHtml !== 'string') {
        return { scores, dailyVolume };
    }

    // Expresión regular para encontrar las tablas de entrenamiento
    const tableRegex = /<table[\s\S]*?<\/table>/gi;
    const tables = routineHtml.match(tableRegex) || [];
    let currentDay = 'Día 1'; // Día por defecto si no se encuentra un título

    tables.forEach(tableHtml => {
        // Buscar un título de día justo antes de la tabla
        const precedingHtml = routineHtml.substring(0, routineHtml.indexOf(tableHtml));
        const dayTitleMatch = precedingHtml.match(/<h[1-4][^>]*>.*?(D[íi]a\s+\d+).*?<\/h[1-4]>/i);
        if (dayTitleMatch && dayTitleMatch[1]) {
            currentDay = dayTitleMatch[1].trim();
        }

        if (!dailyVolume[currentDay]) {
            dailyVolume[currentDay] = 0;
        }

        const rowRegex = /<tr[\s\S]*?<\/tr>/gi;
        const cellRegex = /<(?:td|th)[\s\S]*?<\/(?:td|th)>/gi;
        const rows = tableHtml.match(rowRegex) || [];

        let headers = {};
        rows.forEach(rowHtml => {
            const cells = rowHtml.match(cellRegex) || [];
            if (cells.length === 0) return;

            const isHeaderRow = /<th/i.test(cells[0]);
            const cellTexts = cells.map(cell => cell.replace(/<[^>]+>/g, ' ').trim().toLowerCase());

            // Mapear los índices de las columnas desde la cabecera
            if (isHeaderRow) {
                cellTexts.forEach((text, index) => {
                    if (/ejercicio/i.test(text)) headers.exercise = index;
                    if (/series/i.test(text)) headers.series = index;
                    if (/reps|repeticiones/i.test(text)) headers.reps = index;
                    if (/descanso/i.test(text)) headers.rest = index;
                    if (/notas/i.test(text)) headers.notes = index;
                });
                return;
            }

            // Procesar filas de datos
            const exercise = cellTexts[headers.exercise] || '';
            const seriesText = cellTexts[headers.series] || '0';
            const repsText = cellTexts[headers.reps] || '';
            const restText = cellTexts[headers.rest] || '';
            const notes = cellTexts[headers.notes] || '';
            const combinedText = `${exercise} ${notes}`;

            // 1. Calcular Volumen Diario (Total de Series)
            const seriesMatch = seriesText.match(/(\d+)/);
            if (seriesMatch) {
                dailyVolume[currentDay] += parseInt(seriesMatch[1], 10);
            }

            // 2. Calcular Puntuaciones de Componentes
            const repMatch = repsText.match(/(\d+)(?:[ -]+(\d+))?/);
            const repMax = repMatch ? parseInt(repMatch[2] || repMatch[1], 10) : 0;
            const restMatch = restText.match(/(\d+)/);
            const restSeconds = restMatch ? parseInt(restMatch[1], 10) : 0;

            // Puntuación por Repeticiones
            if (repMax > 0) {
                if (repMax <= 6) scores.fuerza += 2;
                if (repMax >= 6 && repMax <= 15) scores.hipertrofia++;
                if (repMax > 15) scores.resistencia += 2;
                if (repMax <= 8) scores.potencia++; // Solapamiento intencionado
            }

            // Puntuación por Descanso
            if (restSeconds > 0) {
                if (restSeconds >= 120) scores.fuerza++;
                if (restSeconds >= 60 && restSeconds < 120) scores.hipertrofia++;
                if (restSeconds < 60) scores.resistencia++;
            }

            // Puntuación por Palabras Clave
            if (/explosivo|salto|pliométrico|balístico|máxima velocidad/i.test(combinedText)) scores.potencia += 3;
            if (/movilidad|estiramiento|yoga|rango de movimiento|flexibilidad/i.test(combinedText)) scores.movilidad += 3;
            if (/controlado|lento|isométrico|técnica|tempo/i.test(combinedText)) scores.tecnica += 2;
        });
    });

    // Normalizar puntuaciones a un total de 100%
    const totalScore = Object.values(scores).reduce((sum, value) => sum + value, 0);
    if (totalScore > 0) {
        for (const key in scores) {
            scores[key] = Math.round((scores[key] / totalScore) * 100);
        }
    }
    
    // Ajuste final para que la suma sea exactamente 100
    let currentTotal = Object.values(scores).reduce((a, b) => a + b, 0);
    if (currentTotal > 0 && currentTotal !== 100) {
        let diff = 100 - currentTotal;
        let sorted = Object.keys(scores).sort((a, b) => scores[b] - scores[a]);
        scores[sorted[0]] += diff;
    }

    return { scores, dailyVolume };
}

// --- FUNCIONES DE GENERACIÓN DE HTML, CSS Y JS ---

/**
 * Genera el HTML de la portada.
 * @param {string} clientName - Nombre del cliente.
 * @param {object} scores - Puntuaciones de los componentes.
 * @param {string} logoBase64 - Logo en formato Base64.
 * @returns {string} - El HTML completo de la portada.
 */
function generateCoverPageHtml(clientName, scores, logoBase64) {
    const date = new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
    
    // Determinar los componentes principales (puntuación > 20%)
    const mainComponents = Object.entries(scores)
        .filter(([, score]) => score >= 20)
        .sort((a, b) => b[1] - a[1])
        .map(([name]) => name.charAt(0).toUpperCase() + name.slice(1));
    
    const focusText = mainComponents.length > 0 ? mainComponents.join(' + ') : 'Equilibrado';

    return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <title>Plan de Entrenamiento - ${clientName}</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
        <style>${getCoverPageStyles()}</style>
    </head>
    <body>
        <div class="cover-page">
            <header class="cover-header">
                ${logoBase64 ? `<img src="${logoBase64}" alt="Logo" class="logo">` : ''}
                <h1>Plan de Entrenamiento Personalizado</h1>
            </header>
            
            <main class="cover-main">
                <div class="client-info">
                    <p><strong>Cliente:</strong> ${clientName}</p>
                    <p><strong>Fecha:</strong> ${date}</p>
                    <p><strong>Enfoque Principal:</strong> <span class="focus-highlight">${focusText}</span></p>
                </div>
                
                <div class="charts-container">
                    <div class="chart-wrapper">
                        <h3>Distribución del Enfoque</h3>
                        <canvas id="radarChart"></canvas>
                    </div>
                    <div class="chart-wrapper">
                        <h3>Volumen Semanal (Series por Día)</h3>
                        <canvas id="volumeBarChart"></canvas>
                    </div>
                </div>
            </main>
            
            <footer class="cover-footer">
                <p>© ${new Date().getFullYear()} FitForm Coach - Tu hoja de ruta hacia el éxito.</p>
            </footer>
        </div>
    </body>
    </html>`;
}

/**
 * Devuelve los estilos CSS para la portada.
 * @returns {string} - Una cadena con todo el CSS.
 */
function getCoverPageStyles() {
    return `
        :root {
            --primary-text: #2c3e50;
            --secondary-text: #7f8c8d;
            --background: #ffffff;
            --panel-bg: #f8f9fa;
            --border-color: #e9ecef;
            --accent-color: #3498db;
            --font-family: 'Inter', sans-serif;
        }
        body { margin: 0; font-family: var(--font-family); -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .cover-page { display: flex; flex-direction: column; width: 100%; height: 100vh; background: var(--background); padding: 50px; box-sizing: border-box; page-break-after: always; }
        .cover-header { display: flex; align-items: center; gap: 20px; padding-bottom: 25px; border-bottom: 2px solid var(--border-color); }
        .logo { max-width: 150px; max-height: 50px; }
        .cover-header h1 { font-size: 28px; color: var(--primary-text); font-weight: 700; margin: 0; }
        .cover-main { flex-grow: 1; padding: 40px 0; }
        .client-info { background: var(--panel-bg); padding: 20px; border-radius: 8px; margin-bottom: 40px; border: 1px solid var(--border-color); }
        .client-info p { margin: 0 0 10px; font-size: 16px; color: var(--secondary-text); }
        .client-info p:last-child { margin-bottom: 0; }
        .client-info strong { color: var(--primary-text); }
        .focus-highlight { color: var(--accent-color); font-weight: 600; }
        .charts-container { display: grid; grid-template-columns: 1fr 1.2fr; gap: 40px; align-items: flex-start; }
        .chart-wrapper { border: 1px solid var(--border-color); padding: 25px; border-radius: 8px; background: #fff; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
        .chart-wrapper h3 { text-align: center; margin: 0 0 20px; font-size: 16px; color: var(--primary-text); font-weight: 600; }
        canvas { max-width: 100%; }
        .cover-footer { text-align: center; padding-top: 25px; border-top: 1px solid var(--border-color); margin-top: auto; color: var(--secondary-text); font-size: 12px; }
    `;
}

/**
 * Genera el script de Chart.js para ambos gráficos.
 * @param {object} scores - Puntuaciones de los componentes.
 * @param {object} dailyVolume - Datos de volumen diario.
 * @returns {string} - El código JavaScript para renderizar los gráficos.
 */
function getChartsScript(scores, dailyVolume) {
    const radarData = [scores.fuerza, scores.hipertrofia, scores.resistencia, scores.potencia, scores.movilidad, scores.tecnica];
    const radarLabels = ['Fuerza', 'Hipertrofia', 'Resistencia', 'Potencia', 'Movilidad', 'Técnica'];
    
    const volumeLabels = Object.keys(dailyVolume).sort((a, b) => (a.match(/\d+/)?.[0] || 0) - (b.match(/\d+/)?.[0] || 0));
    const volumeData = volumeLabels.map(day => dailyVolume[day]);

    return `
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script>
      function initCharts() {
        try {
          const radarCtx = document.getElementById('radarChart')?.getContext('2d');
          if (radarCtx) {
            new Chart(radarCtx, {
              type: 'radar',
              data: {
                labels: ${JSON.stringify(radarLabels)},
                datasets: [{
                  label: 'Enfoque %',
                  data: ${JSON.stringify(radarData)},
                  backgroundColor: 'rgba(52, 152, 219, 0.2)',
                  borderColor: 'rgba(52, 152, 219, 1)',
                  borderWidth: 2,
                  pointBackgroundColor: 'rgba(52, 152, 219, 1)'
                }]
              },
              options: {
                responsive: true,
                maintainAspectRatio: true,
                scales: { r: { beginAtZero: true, suggestedMax: 50 } },
                plugins: { legend: { display: false } }
              }
            });
          }

          const volumeCtx = document.getElementById('volumeBarChart')?.getContext('2d');
          if (volumeCtx) {
            new Chart(volumeCtx, {
              type: 'bar',
              data: {
                labels: ${JSON.stringify(volumeLabels)},
                datasets: [{
                  label: 'Series Totales',
                  data: ${JSON.stringify(volumeData)},
                  backgroundColor: 'rgba(46, 204, 113, 0.6)',
                  borderColor: 'rgba(46, 204, 113, 1)',
                  borderWidth: 1
                }]
              },
              options: {
                responsive: true,
                maintainAspectRatio: true,
                scales: { y: { beginAtZero: true, ticks: { stepSize: 5 } } },
                plugins: { legend: { display: false } }
              }
            });
          }
          
          // Señal para Puppeteer: los gráficos se han inicializado
          window.chartsReady = true;

        } catch (e) {
          console.error('Error al inicializar gráficos:', e);
          window.chartsReady = false; // Señal de fallo
        }
      }

      // Esperar a que el DOM esté listo para ejecutar el script
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initCharts);
      } else {
        initCharts();
      }
    </script>
    `;
}

// --- FUNCIÓN PRINCIPAL EXPORTADA ---

/**
 * Orquesta la creación de la portada, combinando datos y elementos visuales.
 * @param {string} routineHtml - HTML completo de la rutina.
 * @param {string} clientName - Nombre del cliente.
 * @returns {object} - Objeto que contiene el HTML completo de la portada con sus scripts.
 */
function createCoverPage(routineHtml, clientName) {
    // 1. Analizar la rutina para obtener datos
    const { scores, dailyVolume } = analyzeRoutine(routineHtml);
    console.log("[ChartService] Puntuaciones calculadas:", scores);
    console.log("[ChartService] Volumen diario calculado:", dailyVolume);

    // 2. Cargar el logo
    const logoPath = path.resolve(__dirname, "../assets/logo.png");
    let logoBase64 = "";
    if (fs.existsSync(logoPath)) {
        logoBase64 = `data:image/png;base64,${fs.readFileSync(logoPath).toString("base64")}`;
    } else {
        console.warn("Logo no encontrado en:", logoPath);
    }

    // 3. Generar el HTML y el Script
    let fullCoverPageHtml = generateCoverPageHtml(clientName, scores, logoBase64);
    const script = getChartsScript(scores, dailyVolume);
    
    // 4. Incrustar el script en el HTML
    fullCoverPageHtml += script;

    return {
        fullCoverPageHtml, // Este es el HTML completo, renderizable, con <style> y <script>
        scores,
        volumeData: dailyVolume
    };
}

module.exports = { createCoverPage };