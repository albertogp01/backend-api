// services/chartService.js (Versión Mejorada)

/**
 * Calcula las puntuaciones de los componentes del entrenamiento basándose en parámetros y palabras clave.
 * Lógica mejorada para dar prioridad a los parámetros numéricos (reps, descanso, intensidad).
 * @param {string} routineHtml - El contenido HTML de la rutina generada.
 * @returns {Object} - Puntuaciones de cada componente (0-100) y componentes principales.
 */
function calculateTrainingComponentScores(routineHtml) {
    const scores = {
        fuerza: 0, hipertrofia: 0, movilidad: 0,
        potencia: 0, tecnica: 0, cardio: 0
    };

    if (!routineHtml || typeof routineHtml !== 'string' || !/<table/i.test(routineHtml)) {
        console.warn("[Scores Calc] HTML inválido o sin tablas. Devolviendo valores por defecto.");
        return { ...scores, mainComponents: [], mainComponentsDisplay: 'Equilibrado' };
    }

    const weights = {
        paramRep: 8,      // AUMENTADO: Mucho más peso a las repeticiones.
        paramRest: 6,     // AUMENTADO: Mucho más peso al descanso.
        paramIntensity: 10, // NUEVO: Máximo peso a la intensidad (RPE, %RM).
        keywordExercise: 1.5, // Reducido: Peso moderado para palabras en el nombre del ejercicio.
        keywordNotes: 2,  // Peso para palabras clave en notas (ej. "controlado", "explosivo").
        tempo: 4,         // Peso para la notación de tempo.
        activation: 3     // Peso para ejercicios en sección de activación.
    };

    const counts = { fuerza: 0, hipertrofia: 0, movilidad: 0, potencia: 0, tecnica: 0, cardio: 0 };

    const tableRegex = /<table[\s\S]*?<\/table>/gi;
    const rowRegex = /<tr[\s\S]*?<\/tr>/gi;
    const cellRegex = /<(?:th|td)[\s\S]*?<\/\1>/gi;
    const cleanText = (html) => html ? html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase() : '';

    const tables = routineHtml.match(tableRegex) || [];
    tables.forEach(tableHtml => {
        let headers = {};
        let inActivationSection = false;

        const rows = tableHtml.match(rowRegex) || [];
        rows.forEach(rowHtml => {
            const cells = rowHtml.match(cellRegex) || [];
            const cellTexts = cells.map(cleanText);

            if (cells.length > 0 && cells[0].toLowerCase().startsWith('<th')) {
                cellTexts.forEach((text, index) => {
                    if (/ejercicio/i.test(text)) headers.exercise = index;
                    if (/series/i.test(text)) headers.series = index;
                    if (/repeticiones|reps/i.test(text)) headers.reps = index;
                    if (/descanso/i.test(text)) headers.rest = index;
                    if (/intensidad/i.test(text)) headers.intensity = index; // NUEVO
                    if (/notas/i.test(text)) headers.notes = index;
                });
                return;
            }

            if (cellTexts.some(text => /calentamiento|activación/i.test(text))) {
                inActivationSection = true;
            }

            if (Object.keys(headers).length > 0 && cells.length > 0 && cells[0].toLowerCase().startsWith('<td')) {
                const exercise = cellTexts[headers.exercise] || '';
                const reps = cellTexts[headers.reps] || '';
                const rest = cellTexts[headers.rest] || '';
                const intensity = cellTexts[headers.intensity] || '';
                const notes = cellTexts[headers.notes] || '';
                const combinedText = `${exercise} ${notes}`;

                // --- 1. Análisis de Parámetros (Máxima Prioridad) ---
                const repMatch = reps.match(/(\d+)(?:[ -]+(\d+))?/);
                const repMax = repMatch ? parseInt(repMatch[2] || repMatch[1], 10) : null;

                const restMatch = rest.match(/(\d+)/);
                const restSeconds = restMatch ? parseInt(restMatch[1], 10) : null;
                
                if (repMax) {
                    if (repMax <= 6) counts.fuerza += weights.paramRep;
                    if (repMax >= 6 && repMax <= 15) counts.hipertrofia += weights.paramRep;
                    if (repMax > 15) counts.cardio += weights.paramRep; // Cardio/Resistencia muscular
                    if (repMax >= 4 && repMax <= 8) counts.potencia += weights.paramRep * 0.5; // Rango de potencia
                }

                if (restSeconds) {
                    if (restSeconds >= 90) counts.fuerza += weights.paramRest;
                    if (restSeconds >= 45 && restSeconds < 90) counts.hipertrofia += weights.paramRest;
                    if (restSeconds < 45) counts.cardio += weights.paramRest;
                }

                // --- 2. Análisis de Intensidad (NUEVO y muy preciso) ---
                const intensityText = `${intensity} ${notes}`;
                if (/(rpe|rm|rir)/i.test(intensityText)) {
                    const intensityValueMatch = intensityText.match(/(?:rpe|rm|rir)\s*[:\s-]*(\d+)/i);
                    const value = intensityValueMatch ? parseInt(intensityValueMatch[1]) : 0;
                    
                    if (/(rm|rir\s*[0-2])/i.test(intensityText) || /rpe\s*[8-9-10]/i.test(intensityText)) {
                         counts.fuerza += weights.paramIntensity;
                    } else if (/rpe\s*[6-8]/i.test(intensityText) || /rir\s*[2-4]/i.test(intensityText)) {
                         counts.hipertrofia += weights.paramIntensity;
                    }
                }

                // --- 3. Análisis de Palabras Clave y Contexto (Ajuste Fino) ---
                if (/tempo.*[xX]/i.test(exercise) || /explosivo|pliométrico|salto|balístico/i.test(combinedText)) {
                    counts.potencia += weights.tempo;
                }
                if (/tempo\s*\d{4}/i.test(exercise) || /controlado|lento|isométrico|estabilidad/i.test(combinedText)) {
                    counts.tecnica += weights.tempo;
                }
                if (/movilidad|estiramiento|yoga|pilates|flexibilidad/i.test(combinedText)) {
                    counts.movilidad += weights.keywordExercise;
                }
                if (inActivationSection) {
                    counts.movilidad += weights.activation;
                    counts.tecnica += weights.activation;
                }
            }
        });
    });

    // --- Normalización ---
    const totalCount = Object.values(counts).reduce((sum, count) => sum + count, 0);
    if (totalCount === 0) return { ...scores, mainComponents: [], mainComponentsDisplay: 'Equilibrado' };

    Object.keys(scores).forEach(component => {
        scores[component] = Math.round((counts[component] / totalCount) * 100);
    });

    // Re-normalizar para sumar 100 y determinar componentes principales
    let currentTotal = Object.values(scores).reduce((a, b) => a + b, 0);
    if (currentTotal > 0) {
        let diff = 100 - currentTotal;
        let sorted = Object.keys(scores).sort((a, b) => scores[b] - scores[a]);
        scores[sorted[0]] += diff;
    }
    
    Object.keys(scores).forEach(k => scores[k] = Math.max(0, Math.min(100, scores[k])));
    
    let sortedScores = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    scores.mainComponents = sortedScores.filter(s => s[1] >= 25).map(s => s[0]);
    if (scores.mainComponents.length === 0 && sortedScores.length > 0) {
        scores.mainComponents = [sortedScores[0][0]];
    }
    scores.mainComponentsDisplay = scores.mainComponents.length > 0 ? scores.mainComponents.map(c => c.charAt(0).toUpperCase() + c.slice(1)).join(' + ') : 'Equilibrado';

    console.log("[Scores Calc] Puntuaciones finales:", scores);
    return scores;
}

/**
 * Calcula el volumen diario aproximado (series totales) a partir del HTML de la rutina.
 * Lógica mejorada para manejar rangos de series (ej. "3-4").
 * @param {string} routineHtml - El contenido HTML de la rutina generada.
 * @returns {Object} - Objeto con días como claves y total de series como valores.
 */
function calculateDailyVolume(routineHtml) {
    const dailyVolume = {};
    if (!routineHtml || typeof routineHtml !== 'string' || !/<table/i.test(routineHtml)) {
        return {};
    }

    // Busca cabeceras de día (ej. <h2>Día 1: Pecho y Tríceps</h2>) para agrupar tablas
    const dayHeaderRegex = /<h[1-6][^>]*>.*?(D[íi]a\s+\d+).*?<\/h[1-6]>/i;
    const tableRegex = /<table[\s\S]*?<\/table>/gi;
    const tables = routineHtml.match(tableRegex) || [];
    let currentDay = "Día 1"; // Asumir un día por defecto si no se encuentra cabecera

    tables.forEach(tableHtml => {
        const dayMatch = tableHtml.match(dayHeaderRegex);
        if (dayMatch && dayMatch[1]) {
            currentDay = dayMatch[1].trim();
        }
        if (!dailyVolume[currentDay]) {
            dailyVolume[currentDay] = 0;
        }

        let setsColumnIndex = -1;
        const rows = tableHtml.match(/<tr[\s\S]*?<\/tr>/gi) || [];

        // Encontrar la columna de "Series"
        const headerRow = rows.find(r => /<th/i.test(r));
        if (headerRow) {
            const headers = headerRow.match(/<th[\s\S]*?<\/th>/gi) || [];
            headers.forEach((h, i) => {
                if (/series/i.test(h)) setsColumnIndex = i;
            });
        }
        if (setsColumnIndex === -1) return; // No se puede continuar sin la columna de series

        rows.forEach(rowHtml => {
            if (!/<td/i.test(rowHtml)) return; // Saltar filas de cabecera

            const cells = rowHtml.match(/<td[\s\S]*?<\/td>/gi) || [];
            if (cells.length > setsColumnIndex) {
                const setsText = cells[setsColumnIndex].replace(/<[^>]+>/g, '').trim();
                
                // MEJORADO: Maneja "3" y rangos como "3-4" o "3x5"
                const setsMatch = setsText.match(/(\d+)(?:[x\s-]*(\d+))?/);
                if (setsMatch) {
                    // Usar el valor más alto del rango, o el único valor encontrado
                    const setsValue = parseInt(setsMatch[2] || setsMatch[1], 10);
                    if (!isNaN(setsValue)) {
                        dailyVolume[currentDay] += setsValue;
                    }
                }
            }
        });
    });

    console.log("[Volume Calc] Volumen diario final:", dailyVolume);
    return dailyVolume;
}

/**
 * Genera la estructura HTML para la portada.
 * @param {Object} scores - Puntuaciones de los componentes.
 * @param {string} clientName - Nombre del cliente.
 * @returns {string} - Estructura HTML de la portada.
 */
function generateCoverPageHtml(scores, clientName) {
    const date = new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
    let description = `¡Hola ${clientName}! Aquí tienes un resumen visual de tu nuevo plan de entrenamiento. `;
    if (scores.mainComponentsDisplay !== 'Equilibrado') {
        description += `Nos enfocaremos principalmente en **${scores.mainComponentsDisplay}** para ayudarte a alcanzar tus metas. Los gráficos a continuación detallan la distribución del enfoque y el volumen semanal estimado. ¡A darle con todo!`;
    } else {
        description += `Este plan está diseñado para ofrecerte un desarrollo equilibrado. Los gráficos muestran la distribución del enfoque y el volumen estimado por día. ¡Disfruta del proceso!`;
    }

    return `
    <div class="cover-page-new">
        <div class="cover-header-new">
            <img class="cover-logo-new" src="LOGO_BASE_64_PLACEHOLDER" alt="Logo" onerror="this.style.display='none'">
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
                        <div class="component-item-new"><div class="component-dot-new fuerza-color"></div><div class="component-label-new">Fuerza: <span>${scores.fuerza}%</span></div></div>
                        <div class="component-item-new"><div class="component-dot-new potencia-color"></div><div class="component-label-new">Potencia: <span>${scores.potencia}%</span></div></div>
                        <div class="component-item-new"><div class="component-dot-new hipertrofia-color"></div><div class="component-label-new">Hipertrofia: <span>${scores.hipertrofia}%</span></div></div>
                        <div class="component-item-new"><div class="component-dot-new tecnica-color"></div><div class="component-label-new">Técnica: <span>${scores.tecnica}%</span></div></div>
                        <div class="component-item-new"><div class="component-dot-new movilidad-color"></div><div class="component-label-new">Movilidad: <span>${scores.movilidad}%</span></div></div>
                        <div class="component-item-new"><div class="component-dot-new cardio-color"></div><div class="component-label-new">Cardio: <span>${scores.cardio}%</span></div></div>
                    </div>
                </div>
            </div>
            <div class="cover-visuals-content">
                <div class="chart-container-new">
                    <h3 class="chart-title">Distribución del Enfoque</h3>
                    <canvas id="radarChart"></canvas>
                </div>
                <div class="chart-container-new">
                    <h3 class="chart-title">Volumen Estimado por Día (Series)</h3>
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
 * Genera los estilos CSS para la portada.
 * @returns {string} - Estilos CSS.
 */
function getCoverPageStyles() {
    return `
    :root {
        --primary-text: #1a202c; /* Negro más suave */
        --secondary-text: #4a5568; /* Gris oscuro */
        --light-text: #a0aec0; /* Gris claro para pies de página */
        --background: #ffffff;
        --panel-background: #f7fafc; /* Fondo muy sutil para paneles */
        --border-color: #e2e8f0; /* Borde suave */
        --accent-blue: #3182ce;
        --border-radius: 12px;
        --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);

        /* Colores de componentes para gráficos */
        --fuerza-color: #3182ce;      /* Azul */
        --hipertrofia-color: #38a169; /* Verde */
        --movilidad-color: #d69e2e;   /* Amarillo/Dorado */
        --potencia-color: #e53e3e;    /* Rojo */
        --tecnica-color: #805ad5;    /* Púrpura */
        --cardio-color: #dd6b20;     /* Naranja */
    }
    body {
        margin: 0;
        font-family: 'Inter', 'Helvetica Neue', Arial, sans-serif;
        background-color: var(--background);
        color: var(--secondary-text);
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
    }
    .cover-page-new {
        display: flex;
        flex-direction: column;
        height: 100vh;
        width: 100%;
        box-sizing: border-box;
        padding: 40px;
        page-break-after: always;
    }
    .cover-header-new {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding-bottom: 20px;
        border-bottom: 1px solid var(--border-color);
        flex-shrink: 0;
    }
    .cover-logo-new { width: 120px; }
    .client-info-new { text-align: right; }
    .client-info-new h1 {
        font-size: 28px;
        font-weight: 700;
        color: var(--primary-text);
        margin: 0;
    }
    .client-info-new p {
        font-size: 14px;
        color: var(--secondary-text);
        margin: 4px 0 0;
    }
    .cover-main-new {
        flex-grow: 1;
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 30px;
        padding: 30px 0;
        width: 100%;
    }
    .cover-text-content h2 {
        font-size: 24px;
        font-weight: 600;
        color: var(--primary-text);
        margin: 0 0 15px;
    }
    .cover-description-new {
        font-size: 14px;
        line-height: 1.6;
        margin-bottom: 25px;
    }
    .components-legend-new {
        background: var(--panel-background);
        border: 1px solid var(--border-color);
        border-radius: var(--border-radius);
        padding: 20px;
    }
    .components-legend-new h3 {
        font-size: 16px;
        font-weight: 600;
        color: var(--primary-text);
        margin: 0 0 15px;
    }
    .legend-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
    }
    .component-item-new { display: flex; align-items: center; gap: 8px; }
    .component-dot-new { width: 10px; height: 10px; border-radius: 50%; }
    .component-label-new { font-size: 13px; font-weight: 500; }
    .component-label-new span { font-weight: 600; color: var(--primary-text); }
    .fuerza-color { background-color: var(--fuerza-color); }
    .hipertrofia-color { background-color: var(--hipertrofia-color); }
    .movilidad-color { background-color: var(--movilidad-color); }
    .potencia-color { background-color: var(--potencia-color); }
    .tecnica-color { background-color: var(--tecnica-color); }
    .cardio-color { background-color: var(--cardio-color); }

    .cover-visuals-content { display: flex; flex-direction: column; gap: 25px; }
    .chart-container-new {
        background: var(--background);
        border: 1px solid var(--border-color);
        padding: 20px;
        border-radius: var(--border-radius);
        box-shadow: var(--shadow-md);
        flex-grow: 1;
        display: flex;
        flex-direction: column;
    }
    .chart-title { font-size: 14px; font-weight: 600; text-align: center; margin: 0 0 15px; color: var(--primary-text); }
    .chart-container-new canvas { max-height: 250px; } /* Limitar altura máxima */
    .cover-footer-new {
        text-align: center;
        padding-top: 20px;
        margin-top: auto;
        border-top: 1px solid var(--border-color);
        font-size: 11px;
        color: var(--light-text);
        flex-shrink: 0;
    }
    `;
}

/**
 * Genera el script de Chart.js para el gráfico radar.
 * @param {Object} scores - Puntuaciones de los componentes.
 * @returns {string} - Código JavaScript para el gráfico.
 */
function getRadarChartScript(scores) {
    const chartData = [scores.fuerza, scores.hipertrofia, scores.movilidad, scores.potencia, scores.tecnica, scores.cardio];
    const labels = ['Fuerza', 'Hipertrofia', 'Movilidad', 'Potencia', 'Técnica', 'Cardio'];

    return `
    <script>
      function initRadarChart() {
        const ctx = document.getElementById('radarChart')?.getContext('2d');
        if (!ctx) return;
        new Chart(ctx, {
            type: 'radar',
            data: {
                labels: ${JSON.stringify(labels)},
                datasets: [{
                    label: 'Enfoque (%)',
                    data: ${JSON.stringify(chartData)},
                    backgroundColor: 'rgba(49, 130, 206, 0.2)',
                    borderColor: 'rgba(49, 130, 206, 1)',
                    borderWidth: 2,
                    pointBackgroundColor: 'rgba(49, 130, 206, 1)',
                    pointBorderColor: '#fff',
                    pointHoverRadius: 6,
                    pointRadius: 4,
                }]
            },
            options: {
                scales: {
                    r: {
                        angleLines: { color: '#e2e8f0' },
                        suggestedMin: 0,
                        suggestedMax: 100,
                        grid: { color: '#e2e8f0' },
                        ticks: { display: false },
                        pointLabels: {
                            font: { size: 12, weight: '500' },
                            color: '#4a5568'
                        }
                    }
                },
                plugins: { legend: { display: false } },
                responsive: true,
                maintainAspectRatio: false
            }
        });
      }
      setTimeout(initRadarChart, 100);
    </script>
    `;
}

/**
 * Genera el script de Chart.js para el gráfico de líneas de volumen.
 * @param {Object} dailyVolumeData - Datos de volumen diario.
 * @returns {string} - Código JavaScript para el gráfico.
 */
function getVolumeLineChartScript(dailyVolumeData) {
    const sortedDays = Object.keys(dailyVolumeData).sort((a, b) => (a.match(/\d+/) || [0])[0] - (b.match(/\d+/) || [0])[0]);
    const labels = sortedDays;
    const data = sortedDays.map(day => dailyVolumeData[day]);
    const noData = data.length === 0 || data.every(v => v === 0);

    return `
    <script>
      function initVolumeLineChart() {
        const canvas = document.getElementById('volumeLineChart');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        if (${noData}) {
            ctx.font = "14px 'Inter'";
            ctx.fillStyle = '#a0aec0';
            ctx.textAlign = 'center';
            ctx.fillText("Volumen no disponible.", canvas.width / 2, canvas.height / 2);
            return;
        }

        new Chart(ctx, {
            type: 'line',
            data: {
                labels: ${JSON.stringify(labels)},
                datasets: [{
                    label: 'Series Totales',
                    data: ${JSON.stringify(data)},
                    fill: 'start',
                    backgroundColor: (context) => {
                        const g = context.chart.ctx.createLinearGradient(0, 0, 0, context.chart.height);
                        g.addColorStop(0, 'rgba(49, 130, 206, 0.4)');
                        g.addColorStop(1, 'rgba(49, 130, 206, 0.05)');
                        return g;
                    },
                    borderColor: '#3182ce',
                    borderWidth: 2.5,
                    pointBackgroundColor: '#3182ce',
                    pointBorderColor: '#fff',
                    pointHoverRadius: 7,
                    pointRadius: 5,
                    tension: 0.3 // Curva suave
                }]
            },
            options: {
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { drawBorder: false },
                        ticks: { precision: 0, color: '#718096' }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: '#718096' }
                    }
                },
                plugins: {
                    legend: { display: false },
                    datalabels: {
                        anchor: 'end',
                        align: 'top',
                        color: '#1a202c',
                        font: { weight: '600' },
                        formatter: (value) => value > 0 ? value : ''
                    }
                },
                responsive: true,
                maintainAspectRatio: false
            },
            plugins: [ChartDataLabels]
        });
      }
      setTimeout(initVolumeLineChart, 100);
    </script>
    `;
}

/**
 * Función principal que orquesta la creación de la portada.
 * @param {string} routineHtml - HTML de la rutina.
 * @param {string} clientName - Nombre del cliente.
 * @param {string} logoBase64 - Logo en Base64.
 * @returns {object} - Objeto con el HTML, estilos y script de la portada.
 */
function createCoverPage(routineHtml, clientName, logoBase64) {
    const scores = calculateTrainingComponentScores(routineHtml);
    const dailyVolumeData = calculateDailyVolume(routineHtml);

    let fullCoverPageHtml = generateCoverPageHtml(scores, clientName);
    if (logoBase64 && logoBase64.startsWith('data:image')) {
        fullCoverPageHtml = fullCoverPageHtml.replace('LOGO_BASE_64_PLACEHOLDER', logoBase64);
    } else {
        fullCoverPageHtml = fullCoverPageHtml.replace(/<img class="cover-logo-new".*?>/g, '');
    }

    const styles = getCoverPageStyles();
    const radarScript = getRadarChartScript(scores);
    const volumeScript = getVolumeLineChartScript(dailyVolumeData);

    const combinedScript = `
        <script src="https://cdn.jsdelivr.net/npm/chart.js@3.7.1/dist/chart.min.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.0.0"></script>
        <script>Chart.register(ChartDataLabels);</script>
        ${radarScript}
        ${volumeScript}
    `;

    return {
        fullCoverPageHtml,
        styles,
        script: combinedScript,
        scores,
        volumeData: dailyVolumeData
    };
}

module.exports = {
    createCoverPage,
    calculateTrainingComponentScores,
    calculateDailyVolume
};