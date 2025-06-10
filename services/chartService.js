/**
 * services/chartService.js (Versión 3.0 - Lógica de Análisis Robusta y Diseño Mejorado)
 *
 * Servicio de élite para analizar rutinas HTML, extraer métricas precisas y generar
 * una portada con gráficos dinámicos, informativos y visualmente impactantes.
 */
const fs = require('fs');
const path = require('path');

// --- LÓGICA DE ANÁLISIS DE RUTINA (REDISEÑADA) ---

/**
 * Analiza el HTML de la rutina de forma robusta, dividiéndolo por días para garantizar la precisión.
 * @param {string} routineHtml - El contenido HTML de la rutina.
 * @returns {{scores: object, dailyVolume: object, mainFocus: string}} - Datos extraídos y calculados.
 */
function analyzeRoutine(routineHtml) {
    const scores = { fuerza: 0, hipertrofia: 0, resistencia: 0, potencia: 0, movilidad: 0, tecnica: 0 };
    const dailyVolume = {};

    if (!routineHtml || typeof routineHtml !== 'string') {
        return { scores, dailyVolume, mainFocus: 'Indefinido' };
    }

    // DIVIDIR el HTML por los títulos de los días. Es la clave para la robustez.
    // La expresión regular captura el título del día para que no se pierda en el split.
    const daySplitRegex = /(<th colspan="5">Día \d+:.+?<\/th>|<h[1-4][^>]*>.*?D[íi]a\s+\d+.*?<\/h[1-4]>)/i;
    const parts = routineHtml.split(daySplitRegex).filter(p => p && p.trim() !== '');

    for (let i = 0; i < parts.length; i += 2) {
        const titleHtml = parts[i];
        const contentHtml = parts[i + 1];

        if (!titleHtml || !contentHtml) continue;

        const dayTitleMatch = titleHtml.match(/D[íi]a\s+\d+/i);
        if (!dayTitleMatch) continue;

        const currentDay = dayTitleMatch[0];
        if (!dailyVolume[currentDay]) {
            dailyVolume[currentDay] = 0;
        }

        // Analizar todas las tablas DENTRO del contenido de este día
        const tableRegex = /<table[\s\S]*?<\/table>/gi;
        const tables = contentHtml.match(tableRegex) || [];

        tables.forEach(tableHtml => {
            const rowRegex = /<tr[\s\S]*?<\/tr>/gi;
            const rows = tableHtml.match(rowRegex) || [];
            let headers = {};

            rows.forEach(rowHtml => {
                const cellRegex = /<(?:td|th)[\s\S]*?<\/(?:td|th)>/gi;
                const cells = rowHtml.match(cellRegex) || [];
                if (cells.length === 0) return;

                const cellTexts = cells.map(cell => cell.replace(/<[^>]+>/g, ' ').trim().toLowerCase());
                const isHeaderRow = /<th/i.test(rowHtml);

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
                
                // Procesar solo si tenemos una cabecera y una fila de datos válida
                if (Object.keys(headers).length === 0 || /<td[^>]+colspan/i.test(rowHtml)) return;

                const seriesText = cellTexts[headers.series] || '0';
                const seriesMatch = seriesText.match(/(\d+)/);
                if (seriesMatch) {
                    dailyVolume[currentDay] += parseInt(seriesMatch[1], 10);
                }

                const repsText = cellTexts[headers.reps] || '';
                const restText = cellTexts[headers.rest] || '';
                const combinedText = `${cellTexts[headers.exercise] || ''} ${cellTexts[headers.notes] || ''}`;
                
                const repMatch = repsText.match(/(\d+)(?:[ -]+(\d+))?/);
                const repMax = repMatch ? parseInt(repMatch[2] || repMatch[1], 10) : 0;
                if (repMax > 0) {
                    if (repMax <= 6) scores.fuerza += 2;
                    if (repMax >= 6 && repMax <= 15) scores.hipertrofia++;
                    if (repMax > 15) scores.resistencia += 2;
                    if (repMax <= 8) scores.potencia++;
                }

                const restMatch = restText.match(/(\d+)/);
                const restSeconds = restMatch ? parseInt(restMatch[1], 10) : 0;
                if (restSeconds > 0) {
                    if (restSeconds >= 120) scores.fuerza++;
                    if (restSeconds >= 60 && restSeconds < 120) scores.hipertrofia++;
                    if (restSeconds < 60) scores.resistencia++;
                }

                if (/explosivo|salto|pliométrico|balístico|máxima velocidad/i.test(combinedText)) scores.potencia += 3;
                if (/movilidad|estiramiento|yoga|rango de movimiento|flexibilidad/i.test(combinedText)) scores.movilidad += 3;
                if (/controlado|lento|isométrico|técnica|tempo/i.test(combinedText)) scores.tecnica += 2;
            });
        });
    }

    const totalScore = Object.values(scores).reduce((sum, value) => sum + value, 0);
    if (totalScore > 0) {
        Object.keys(scores).forEach(key => {
            scores[key] = Math.round((scores[key] / totalScore) * 100);
        });
    }
    
    let currentTotal = Object.values(scores).reduce((a, b) => a + b, 0);
    if (currentTotal > 0 && currentTotal !== 100) {
        let diff = 100 - currentTotal;
        let sortedKeys = Object.keys(scores).sort((a, b) => scores[b] - scores[a]);
        scores[sortedKeys[0]] += diff;
    }

    const mainFocus = Object.entries(scores)
        .filter(([, score]) => score >= 20)
        .sort((a, b) => b[1] - a[1])
        .map(([name]) => name.charAt(0).toUpperCase() + name.slice(1))
        .join(' + ') || 'Equilibrado';

    return { scores, dailyVolume, mainFocus };
}


// --- GENERACIÓN DE LA PORTADA (HTML, CSS, JS) ---

function generateCoverPageHtml(clientName, mainFocus, logoBase64) {
    const date = new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
    return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <title>Plan de Entrenamiento - ${clientName}</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
        <style>${getCoverPageStyles()}</style>
    </head>
    <body>
        <div class="page">
            <header class="header">
                ${logoBase64 ? `<img src="${logoBase64}" alt="Logo" class="logo">` : '<h1>FitForm Coach</h1>'}
                <div class="header-info">
                    <span>Plan de Entrenamiento Personalizado</span>
                </div>
            </header>
            
            <main class="main-content">
                <div class="info-panel">
                    <div class="info-item">
                        <span class="info-label">Cliente</span>
                        <span class="info-value">${clientName}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Fecha</span>
                        <span class="info-value">${date}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Enfoque Principal</span>
                        <span class="info-value focus">${mainFocus}</span>
                    </div>
                </div>
                
                <div class="charts-grid">
                    <div class="chart-container">
                        <h2>Distribución de Estímulos</h2>
                        <canvas id="focusDonutChart"></canvas>
                    </div>
                    <div class="chart-container">
                        <h2>Volumen Semanal por Día</h2>
                        <canvas id="volumeBarChart"></canvas>
                    </div>
                </div>
            </main>
            
            <footer class="footer">
                <p>© ${new Date().getFullYear()} FitForm Coach. Este es el comienzo de tu transformación.</p>
            </footer>
        </div>
    </body>
    </html>`;
}

function getCoverPageStyles() {
    return `
        :root {
            --font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            --primary: #0a2a5e; --secondary: #2c4b7c; --accent: #2196f3;
            --text-dark: #2c3e50; --text-light: #8492a6; --background: #f8f9fa; --white: #ffffff;
            --border-color: #e9ecef; --shadow: 0 4px 6px rgba(0,0,0,0.04), 0 5px 15px rgba(0,0,0,0.08);
        }
        body { margin: 0; font-family: var(--font-family); background-color: #ccc; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .page { display: flex; flex-direction: column; width: 210mm; height: 297mm; background: var(--white); margin: 0 auto; box-sizing: border-box; padding: 25mm; page-break-after: always; }
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid var(--border-color); padding-bottom: 20px; }
        .logo { max-height: 45px; }
        .header h1 { color: var(--primary); font-size: 24px; margin: 0; }
        .header-info span { font-size: 14px; color: var(--text-light); font-weight: 500; }
        .main-content { flex-grow: 1; padding-top: 25mm; }
        .info-panel { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; background: var(--background); padding: 20px; border-radius: 12px; margin-bottom: 25mm; }
        .info-item { display: flex; flex-direction: column; gap: 4px; }
        .info-label { font-size: 12px; color: var(--text-light); font-weight: 500; text-transform: uppercase; }
        .info-value { font-size: 18px; color: var(--text-dark); font-weight: 600; }
        .info-value.focus { color: var(--primary); }
        .charts-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 25mm; align-items: start; }
        .chart-container { background: var(--white); padding: 25px; border-radius: 12px; box-shadow: var(--shadow); }
        .chart-container h2 { font-size: 16px; color: var(--text-dark); margin: 0 0 20px; text-align: center; font-weight: 600; }
        .footer { text-align: center; padding-top: 20px; margin-top: auto; border-top: 1px solid var(--border-color); color: var(--text-light); font-size: 12px; }
    `;
}

function getChartsScript(scores, dailyVolume) {
    const focusData = {
        labels: ['Fuerza', 'Hipertrofia', 'Resistencia', 'Potencia', 'Movilidad', 'Técnica'],
        values: [scores.fuerza, scores.hipertrofia, scores.resistencia, scores.potencia, scores.movilidad, scores.tecnica],
        colors: ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6', '#1abc9c']
    };
    const volumeData = {
        labels: Object.keys(dailyVolume).sort((a, b) => (a.match(/\d+/)?.[0] || 0) - (b.match(/\d+/)?.[0] || 0)),
        values: Object.values(dailyVolume)
    };
    return `
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.0.0"></script>
    <script>
      function initCharts() {
        try {
          Chart.register(ChartDataLabels);
          const commonOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } };

          const focusCtx = document.getElementById('focusDonutChart')?.getContext('2d');
          if (focusCtx) {
            new Chart(focusCtx, {
              type: 'doughnut',
              data: {
                labels: ${JSON.stringify(focusData.labels)},
                datasets: [{
                  data: ${JSON.stringify(focusData.values)},
                  backgroundColor: ${JSON.stringify(focusData.colors)},
                  borderWidth: 2, borderColor: '#fff'
                }]
              },
              options: { ...commonOptions, plugins: { legend: { position: 'bottom', labels: { padding: 15, font: { size: 11 } } }, datalabels: {
                formatter: (value) => value > 5 ? value + '%' : '', color: '#fff', font: { weight: 'bold' }
              }}}
            });
          }

          const volumeCtx = document.getElementById('volumeBarChart')?.getContext('2d');
          if (volumeCtx) {
            new Chart(volumeCtx, {
              type: 'bar',
              data: {
                labels: ${JSON.stringify(volumeData.labels)},
                datasets: [{
                  label: 'Series Totales',
                  data: ${JSON.stringify(volumeData.values)},
                  backgroundColor: '#3498db',
                  borderRadius: 4
                }]
              },
              options: { ...commonOptions, scales: { y: { beginAtZero: true, grace: '5%' } }, plugins: { datalabels: {
                anchor: 'end', align: 'end', color: '#555', font: { weight: 'bold' },
                formatter: (value) => value > 0 ? value : ''
              }}}
            });
          }
          
          window.chartsReady = true; // Señal para Puppeteer
        } catch (e) {
          console.error('Error al inicializar gráficos:', e);
          window.chartsReady = false;
        }
      }
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initCharts);
      else initCharts();
    </script>
    `;
}

// --- FUNCIÓN PRINCIPAL EXPORTADA ---

/**
 * Orquesta la creación de la portada completa.
 * @param {string} routineHtml - HTML de la rutina.
 * @param {string} clientName - Nombre del cliente.
 * @returns {object} Objeto con HTML, datos de scores y volumen.
 */
function createCoverPage(routineHtml, clientName) {
    const { scores, dailyVolume, mainFocus } = analyzeRoutine(routineHtml);
    console.log("[ChartService] Análisis completado. Días encontrados:", Object.keys(dailyVolume).join(', ') || 'Ninguno');
    console.log("[ChartService] Volumen por día:", JSON.stringify(dailyVolume));
    console.log("[ChartService] Enfoque principal:", mainFocus);

    const logoPath = path.resolve(__dirname, "../assets/logo.png");
    const logoBase64 = fs.existsSync(logoPath) ? `data:image/png;base64,${fs.readFileSync(logoPath).toString("base64")}` : "";

    let fullCoverPageHtml = generateCoverPageHtml(clientName, mainFocus, logoBase64);
    const script = getChartsScript(scores, dailyVolume);
    
    // Incrustar el script justo antes de cerrar el </body>
    fullCoverPageHtml = fullCoverPageHtml.replace('</body>', `${script}</body>`);

    return {
        fullCoverPageHtml,
        scores,
        volumeData: dailyVolume
    };
}

module.exports = { createCoverPage };