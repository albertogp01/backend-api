/**
 * chartService.js
 * Servicio para calcular datos y generar el HTML de la portada del informe PDF.
 */

// --- Funciones de Cálculo de Datos ---

/**
 * Analiza el HTML de la rutina para calcular las puntuaciones de los componentes de entrenamiento.
 * (Esta es la función que proporcionaste originalmente, con algunas adaptaciones menores si fueran necesarias)
 * @param {string} routineHtml - El contenido HTML de la rutina generada.
 * @returns {Object} - Puntuaciones para cada componente (0-100) y componentes principales.
 */
function calculateTrainingComponentScores(routineHtml) {
    // Inicializar puntuaciones
    const scores = {
        fuerza: 0, hipertrofia: 0, movilidad: 0,
        potencia: 0, tecnica: 0, cardio: 0
    };

    // Si no hay HTML, devolver puntuaciones predeterminadas
    if (!routineHtml || routineHtml.trim() === '') {
        console.warn("routineHtml vacío o inválido en calculateTrainingComponentScores. Devolviendo valores predeterminados.");
        return {
            fuerza: 50, hipertrofia: 50, movilidad: 50,
            potencia: 50, tecnica: 50, cardio: 50,
            mainComponents: [], mainComponentsDisplay: 'Equilibrado'
        };
    }

    // Palabras clave (igual que en tu código original)
    const keywords = {
        fuerza: ['fuerza', 'strength', 'carga', 'peso', 'resistencia', 'weight', 'sentadilla', 'squat', 'press', 'deadlift', 'peso muerto', 'power', 'potencia', 'rm', '1rm', 'máxima', 'maximales', 'intensidad alta', 'pesado', 'heavy'],
        hipertrofia: ['hipertrofia', 'hypertrophy', 'volumen', 'volume', 'muscle', 'músculo', 'muscular', 'growth', 'crecimiento', 'tamaño', 'size', 'bodybuilding', 'culturismo', 'series', 'repeticiones', 'reps', 'rir'],
        movilidad: ['movilidad', 'mobility', 'flexibility', 'flexibilidad', 'stretching', 'estiramiento', 'range', 'motion', 'rango', 'articular', 'joint', 'rom', 'elasticidad', 'elongación', 'estirar', 'stretch'],
        potencia: ['potencia', 'power', 'explosiv', 'explosi[oó]n', 'velocidad', 'speed', 'fast', 'rápido', 'salto', 'jump', 'plyometric', 'pliometría', 'reactiv', 'sprint', 'lanzamiento', 'throw', 'tiempo', 'time', 'tempo.*[xX]'],
        tecnica: ['técnica', 'technique', 'form', 'forma', 'skill', 'habilidad', 'balance', 'equilibrio', 'coordination', 'coordinación', 'control', 'pattern', 'patrón', 'motor', 'stability', 'estabilidad'],
        cardio: ['cardio', 'cardiovascular', 'aeróbico', 'aerobic', 'resistencia', 'endurance', 'stamina', 'interval', 'intervalos', 'hiit', 'heart', 'rate', 'ritmo', 'cardiac', 'cardíaco', 'vo2', 'máximo', 'correr', 'run', 'nadar', 'swim']
    };

    const counts = {
        fuerza: 0, hipertrofia: 0, movilidad: 0,
        potencia: 0, tecnica: 0, cardio: 0
    };

    // Contar palabras clave
    Object.keys(keywords).forEach(component => {
        keywords[component].forEach(keyword => {
            try {
                const regex = new RegExp(`\\b${keyword}\\w*\\b`, 'gi');
                const matches = routineHtml.match(regex) || [];
                counts[component] += matches.length;
            } catch (e) {
                console.warn(`Expresión regular inválida para la palabra clave: ${keyword}`, e);
            }
        });
    });

    // --- Heurísticas Adicionales (igual que tu original) ---
    // 1. Rangos de Repeticiones
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
     counts.fuerza += lowRepSets * 1.5;
     counts.hipertrofia += midRepSets * 1.5;
     counts.cardio += highRepSets * 0.5;

    // 2. Ejercicios Específicos
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
                 const regex = new RegExp(ex.replace(/\s+/g, '\\s+'), 'gi');
                 const matches = routineHtml.match(regex) || [];
                 counts[component] += matches.length * 2;
             } catch(e) {
                 console.warn(`Expresión regular inválida para el ejercicio: ${ex}`, e);
             }
         });
     });

    // 3. Indicadores de Intensidad/Tempo
     if (routineHtml.match(/RIR\s+[0-2]/gi)) counts.hipertrofia += 5;
     if (routineHtml.match(/RIR\s+[3-4]/gi)) counts.hipertrofia += 2;
     if (routineHtml.match(/tempo.*[xX]/gi)) counts.potencia += 5;
     if (routineHtml.match(/tempo\s+\d{3,}/gi)) counts.tecnica += 3;

    // --- Normalización y Ajustes (igual que tu original) ---
    const totalCount = Object.values(counts).reduce((sum, count) => sum + count, 0);

    if (totalCount === 0) {
        console.warn("totalCount es 0 en calculateTrainingComponentScores. Devolviendo valores predeterminados.");
        return {
            fuerza: 50, hipertrofia: 50, movilidad: 50,
            potencia: 50, tecnica: 50, cardio: 50,
            mainComponents: [], mainComponentsDisplay: 'Equilibrado'
        };
    }

    Object.keys(counts).forEach(component => {
        scores[component] = Math.round((counts[component] / totalCount) * 100);
    });

    // --- Suavizado y Umbral ---
     const minThreshold = 10;
     Object.keys(scores).forEach(component => {
         if (counts[component] > 0 && scores[component] < minThreshold) {
             scores[component] = minThreshold;
         }
         scores[component] = Math.min(scores[component], 100); // Limitar a 100
     });

     // Re-normalizar para que sumen (aproximadamente) 100 si se aplicó umbral
     // Esto es opcional y puede ser complejo, una alternativa es simplemente mostrar los valores ajustados.
     // Por simplicidad, omitiremos la re-normalización compleja aquí.

    // Encontrar componentes principales
    let maxScore = 0;
    let mainComponents = [];
    Object.entries(scores).forEach(([component, score]) => {
        if (score > maxScore) {
            maxScore = score;
            mainComponents = [component];
        } else if (score === maxScore && score > minThreshold) { // Solo añadir si es igual Y supera el umbral
            mainComponents.push(component);
        }
    });

    scores.mainComponents = mainComponents;
    scores.mainComponentsDisplay = mainComponents.length > 0
        ? mainComponents.map(c => c.charAt(0).toUpperCase() + c.slice(1)).join(', ')
        : 'Equilibrado'; // Mensaje si no hay un componente claramente dominante

    // console.log("Puntuaciones Calculadas:", scores); // Descomentar para depuración
    return scores;
}

/**
 * Calcula (o simula) el volumen de entrenamiento por día de la semana.
 * @param {string} routineHtml - El contenido HTML de la rutina generada.
 * @returns {number[]} - Array con 7 números representando el volumen (Lun-Dom).
 */
function calculateWeeklyVolume(routineHtml) {
    // --- IMPLEMENTACIÓN REAL (Ejemplo Conceptual) ---
    // const weeklyVolume = [0, 0, 0, 0, 0, 0, 0]; // [Lun, Mar, Mié, Jue, Vie, Sáb, Dom]
    // 1. Buscar patrones que indiquen días (ej: "Día 1: Lunes", "Día 2: Miércoles")
    // 2. Para cada día encontrado:
    //    - Analizar el contenido de ese día (ej: contar nº de ejercicios, nº total de series).
    //    - Asignar el valor calculado al índice correspondiente del array `weeklyVolume`.
    // Ejemplo simplificado: Contar ocurrencias de nombres de días
    // const daysRegex = /Día\s+\d+:\s*(Lunes|Martes|Miércoles|Jueves|Viernes|Sábado|Domingo)/gi;
    // let match;
    // while ((match = daysRegex.exec(routineHtml)) !== null) {
    //    const dayName = match[1].toLowerCase();
    //    const dayIndex = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'].indexOf(dayName);
    //    if (dayIndex !== -1) {
    //        // Aquí iría una lógica más compleja para estimar el volumen de esa sección
    //        weeklyVolume[dayIndex] = (weeklyVolume[dayIndex] || 0) + 10; // Ejemplo: sumar 10 por cada día mencionado
    //    }
    // }
    // return weeklyVolume;
    // --- FIN IMPLEMENTACIÓN REAL ---

    // --- SIMULACIÓN (Mientras desarrollas la lógica real) ---
    console.warn("Usando datos SIMULADOS para calculateWeeklyVolume.");
    // Ejemplo: Lunes=15, Miércoles=18, Viernes=16
    return [15, 0, 18, 0, 16, 0, 0];
    // --- FIN SIMULACIÓN ---
}


// --- Funciones Generadoras de HTML/CSS/Script ---

/**
 * Genera el HTML para la sección principal (Radar Chart y Leyenda).
 * @param {object} scores - Objeto con las puntuaciones calculadas.
 * @param {string} clientName - Nombre del cliente.
 * @returns {string} - String HTML de la sección principal.
 */
function generateMainSectionHtml(scores, clientName) {
    // Generar descripción dinámica
    let description = `Hola ${clientName}, este gráfico visualiza el enfoque de tu nuevo plan de entrenamiento. `;
    if (scores.mainComponentsDisplay && scores.mainComponentsDisplay !== 'Equilibrado') {
        description += `Hemos puesto énfasis en **${scores.mainComponentsDisplay}** para ayudarte a alcanzar tus objetivos.`;
    } else {
        description += `Está diseñado para proporcionarte un desarrollo equilibrado en todas las áreas clave.`;
    }
    // Reemplazar ** con <strong> para HTML
    const descriptionHtml = description.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    return `
        <div class="cover-main-new">
            <div class="cover-text-content">
                <h2>Tu Hoja de Ruta Fitness</h2>
                <p class="cover-description-new">${descriptionHtml}</p>
                <div class="components-legend-new">
                    <div class="legend-column">
                        <div class="component-item-new">
                            <img src="https://unpkg.com/lucide-static@latest/icons/dumbbell.svg" alt="Fuerza" class="legend-icon">
                            <div class="component-dot-new fuerza-color"></div>
                            <div class="component-label-new">Fuerza: <span>${scores.fuerza}%</span></div>
                        </div>
                        <div class="component-item-new">
                            <img src="https://unpkg.com/lucide-static@latest/icons/barbell.svg" alt="Hipertrofia" class="legend-icon">
                            <div class="component-dot-new hipertrofia-color"></div>
                            <div class="component-label-new">Hipertrofia: <span>${scores.hipertrofia}%</span></div>
                        </div>
                        <div class="component-item-new">
                            <img src="https://unpkg.com/lucide-static@latest/icons/move.svg" alt="Movilidad" class="legend-icon">
                            <div class="component-dot-new movilidad-color"></div>
                            <div class="component-label-new">Movilidad: <span>${scores.movilidad}%</span></div>
                        </div>
                    </div>
                    <div class="legend-column">
                        <div class="component-item-new">
                            <img src="https://unpkg.com/lucide-static@latest/icons/zap.svg" alt="Potencia" class="legend-icon">
                            <div class="component-dot-new potencia-color"></div>
                            <div class="component-label-new">Potencia: <span>${scores.potencia}%</span></div>
                        </div>
                        <div class="component-item-new">
                            <img src="https://unpkg.com/lucide-static@latest/icons/target.svg" alt="Técnica" class="legend-icon">
                            <div class="component-dot-new tecnica-color"></div>
                            <div class="component-label-new">Técnica: <span>${scores.tecnica}%</span></div>
                        </div>
                        <div class="component-item-new">
                            <img src="https://unpkg.com/lucide-static@latest/icons/heart-pulse.svg" alt="Cardio" class="legend-icon">
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
    `;
}

/**
 * Genera el HTML para la sección del gráfico de volumen semanal.
 * @returns {string} - String HTML de la sección de volumen.
 */
function generateVolumeChartSectionHtml() {
    return `
        <div class="volume-chart-section">
             <h2>Distribución Semanal del Volumen</h2>
             <div class="volume-chart-container">
                 <canvas id="volumeChart"></canvas>
             </div>
        </div>
    `;
}

/**
 * Genera los estilos CSS para toda la portada.
 * @returns {string} - String con las reglas CSS.
 */
function generateCoverPageStyles() {
    // Copiar todos los estilos del <style> del HTML final anterior
    return `
        /* Estilos Mejorados Portada Gráfico Radar */
        :root {
            --primary-color: #0a2a5e; --secondary-color: #1e477e;
            --accent-color: #3498db; --border-radius: 10px;
            --text-dark: #333; --text-medium: #555;
            --background-light-blue: #e0f2ff; --background-lighter-blue: #f0f9ff;
            --chart-background: rgba(255, 255, 255, 0.98);
            --legend-background: rgba(10, 42, 94, 0.04);
            --border-color-light: rgba(10, 42, 94, 0.08);
            --border-color-medium: rgba(10, 42, 94, 0.12);
        }
        /* Reset básico para asegurar consistencia */
        body, html { margin: 0; padding: 0; box-sizing: border-box; }
        *, *:before, *:after { box-sizing: inherit; }

        body {
            font-family: 'Inter', 'Arial', sans-serif;
            background-color: #fff; /* Fondo blanco para Puppeteer */
            -webkit-print-color-adjust: exact; /* Necesario para imprimir fondos en Chrome/Puppeteer */
            print-color-adjust: exact;
        }

        /* Textura sutil de ruido (aplicada a la portada) */
        .noise-texture::before {
            content: ""; position: absolute; top: 0; left: 0;
            width: 100%; height: 100%;
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='4' height='4' viewBox='0 0 4 4'%3E%3Cpath fill='%239C92AC' fill-opacity='0.05' d='M1 3h1v1H1V3zm2-2h1v1H3V1z'%3E%3C/path%3E%3C/svg%3E");
            opacity: 0.5; pointer-events: none; z-index: 0;
            border-radius: var(--border-radius);
        }

        .cover-page-new {
            position: relative; display: flex; flex-direction: column;
            width: 100%; /* Ocupa el ancho del viewport de Puppeteer */
            max-width: 100%;
            min-height: 100vh; /* Asegura altura completa para PDF */
            padding: 45px 55px;
            background: linear-gradient(140deg, var(--background-light-blue) 0%, var(--background-lighter-blue) 100%);
            color: var(--text-dark); box-sizing: border-box;
            border-radius: 0; /* Sin bordes redondeados en la página completa */
            box-shadow: none; /* Sin sombra en la página completa */
            overflow: hidden; z-index: 1;
            page-break-after: always; /* Importante para PDF */
        }

        .cover-content-wrapper {
             position: relative; z-index: 2; display: flex;
             flex-direction: column; flex-grow: 1;
             width: 100%; height: 100%; /* Ocupar todo el espacio de la página */
        }

        .cover-header-new {
            width: 100%; display: flex; justify-content: space-between;
            align-items: flex-start; margin-bottom: 40px;
            border-bottom: 1px solid var(--border-color-medium);
            padding-bottom: 25px;
        }
        .cover-logo-new { width: 125px; height: auto; opacity: 0.95; }
        .client-info-new { text-align: right; }
        .client-info-new h1 {
            font-size: 32px; font-weight: 700; color: var(--primary-color);
            margin: 0 0 8px 0; line-height: 1.15;
        }
        .client-info-new p { margin: 0; color: rgba(10, 42, 94, 0.8); font-size: 15px; }

        .cover-main-new {
            display: flex; flex-wrap: wrap; align-items: center;
            justify-content: space-between; gap: 45px; width: 100%;
            margin-bottom: 30px;
        }
        .cover-text-content { flex: 1 1 45%; min-width: 280px; }
        .cover-text-content h2 {
            font-size: 28px; font-weight: 700; color: var(--primary-color);
            margin-bottom: 25px; line-height: 1.25; position: relative; display: inline-block;
        }
        .cover-text-content h2::after {
            content: ''; position: absolute; bottom: -10px; left: 0;
            width: 65px; height: 3.5px; background-color: var(--accent-color); border-radius: 3px;
        }
        .cover-description-new {
            font-size: 16px; color: rgba(10, 42, 94, 0.9); line-height: 1.75;
            margin-bottom: 35px; font-weight: 400;
        }
        .cover-description-new strong { color: var(--primary-color); font-weight: 600; }

        .components-legend-new {
            display: flex; flex-wrap: wrap; gap: 30px;
            background-color: var(--legend-background); padding: 25px;
            border-radius: var(--border-radius); border: 1px solid var(--border-color-light);
        }
        .legend-column { display: flex; flex-direction: column; gap: 15px; min-width: 150px; }
        .component-item-new { display: flex; align-items: center; gap: 12px; }
        .legend-icon { width: 16px; height: 16px; opacity: 0.7; margin-right: 4px; vertical-align: middle; }
        .component-dot-new { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
        .fuerza-color { background-color: #3498db; } .hipertrofia-color { background-color: #2ecc71; }
        .movilidad-color { background-color: #f1c40f; } .potencia-color { background-color: #e74c3c; }
        .tecnica-color { background-color: #9b59b6; } .cardio-color { background-color: #e67e22; }
        .component-label-new { font-size: 14px; font-weight: 500; color: rgba(10, 42, 94, 0.95); display: inline-flex; align-items: center; }
        .component-label-new span { font-weight: 700; color: var(--primary-color); margin-left: 5px; }

        .radar-chart-container-new {
            flex: 1 1 45%; min-width: 280px; max-width: 450px; height: 380px;
            background-color: var(--chart-background); border-radius: var(--border-radius);
            padding: 25px; box-shadow: 0 10px 28px rgba(0, 0, 0, 0.1);
            display: flex; align-items: center; justify-content: center; margin: 0 auto;
        }
        #radarChart { max-width: 100%; max-height: 100%; }

        .volume-chart-section {
            width: 100%; margin-top: 40px; padding-top: 30px;
            border-top: 1px solid var(--border-color-medium);
        }
        .volume-chart-section h2 {
            font-size: 24px; font-weight: 600; color: var(--primary-color);
            margin-bottom: 25px; text-align: center; position: relative;
        }
        .volume-chart-section h2::after {
            content: ''; position: absolute; bottom: -8px; left: 50%;
            transform: translateX(-50%); width: 50px; height: 3px;
            background-color: var(--accent-color); border-radius: 3px;
        }
        .volume-chart-container {
            width: 100%; max-width: 700px; height: 300px;
            background-color: var(--chart-background); border-radius: var(--border-radius);
            padding: 20px 25px; box-shadow: 0 8px 25px rgba(0, 0, 0, 0.08);
            margin: 0 auto;
        }
        #volumeChart { max-width: 100%; max-height: 100%; }

        .cover-footer-new {
            width: 100%; text-align: center; padding-top: 25px;
            margin-top: auto; /* Empujar al fondo del wrapper */
            border-top: 1px solid var(--border-color-medium);
            font-size: 11px; color: rgba(10, 42, 94, 0.75);
        }

        /* Media Queries (simplificadas para PDF - A4 aprox 794px ancho) */
        /* Puedes ajustar esto si necesitas optimizar para viewport específicos antes de PDF */
        @media (max-width: 800px) {
            .cover-page-new { padding: 30px 35px; }
            .cover-main-new { gap: 30px; }
            .cover-text-content, .radar-chart-container-new { flex-basis: 100%; max-width: 550px; margin: 0 auto; }
            .radar-chart-container-new { order: -1; height: 340px; }
            .components-legend-new { justify-content: center; }
            .volume-chart-container { padding: 15px 20px; height: 280px; }
        }
         @media (max-width: 500px) {
             .cover-page-new { padding: 25px 20px; }
             .client-info-new h1 { font-size: 28px; }
             .cover-text-content h2 { font-size: 24px; }
             .cover-description-new { font-size: 15px; }
             .radar-chart-container-new { height: 300px; }
             .volume-chart-section h2 { font-size: 22px; }
             .volume-chart-container { height: 250px; }
         }
    `;
}

/**
 * Genera el script JS para inicializar ambos gráficos.
 * @param {object} scores - Objeto con las puntuaciones del radar chart.
 * @param {number[]} weeklyVolumeData - Array con los datos de volumen semanal.
 * @returns {string} - String con el código JavaScript.
 */
function generateChartScripts(scores, weeklyVolumeData) {
    const radarChartData = [
        scores.fuerza, scores.hipertrofia, scores.movilidad,
        scores.potencia, scores.tecnica, scores.cardio
    ];
    const daysOfWeekLabels = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
    const fullDaysOfWeek = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];


    // Convertir los datos a JSON strings para inyectarlos de forma segura en el script
    const radarDataJson = JSON.stringify(radarChartData);
    const volumeDataJson = JSON.stringify(weeklyVolumeData);
    const daysLabelsJson = JSON.stringify(daysOfWeekLabels);
    const fullDaysJson = JSON.stringify(fullDaysOfWeek);


    return `
        <script src="https://cdn.jsdelivr.net/npm/chart.js@3.7.1/dist/chart.min.js"><\/script>
        <script>
            // Datos inyectados desde el servidor
            const radarChartData = ${radarDataJson};
            const weeklyVolumeData = ${volumeDataJson};
            const daysOfWeekLabels = ${daysLabelsJson};
            const fullDaysOfWeek = ${fullDaysJson};

            function initRadarChart() {
                const ctx = document.getElementById('radarChart');
                if (!ctx) { console.error("Canvas #radarChart no encontrado"); return; }
                const chartContext = ctx.getContext('2d');
                if (!chartContext) { console.error("Fallo al obtener contexto 2D para radar"); return; }

                new Chart(chartContext, {
                    type: 'radar',
                    data: {
                        labels: ['Fuerza', 'Hipertrofia', 'Movilidad', 'Potencia', 'Técnica', 'Cardio'],
                        datasets: [{
                            label: 'Perfil de Entrenamiento', data: radarChartData,
                            backgroundColor: 'rgba(10, 42, 94, 0.25)', borderColor: 'rgba(10, 42, 94, 0.85)',
                            borderWidth: 2.5, pointBackgroundColor: 'rgba(10, 42, 94, 1)',
                            pointBorderColor: '#fff', pointHoverBackgroundColor: '#fff',
                            pointHoverBorderColor: 'rgba(10, 42, 94, 1)', pointRadius: 4, pointHoverRadius: 6
                        }]
                    },
                    options: { /* Opciones del radar chart */
                        scales: { r: {
                            angleLines: { display: true, color: 'rgba(0, 0, 0, 0.08)' },
                            suggestedMin: 0, suggestedMax: 100,
                            grid: { color: 'rgba(0, 0, 0, 0.08)' },
                            ticks: { stepSize: 20, color: 'rgba(0, 0, 0, 0.5)', backdropColor: 'rgba(255, 255, 255, 0.7)', padding: 10 },
                            pointLabels: { font: { size: 13, weight: '600' }, color: 'rgba(0, 0, 0, 0.8)' }
                        }},
                        plugins: { legend: { display: false }, tooltip: {
                            enabled: true, backgroundColor: 'rgba(0, 0, 0, 0.85)',
                            titleFont: { size: 14, weight: 'bold' }, bodyFont: { size: 13 },
                            padding: 12, boxPadding: 5, cornerRadius: 4
                        }},
                        responsive: true, maintainAspectRatio: false
                    }
                });
            }

            function initVolumeChart() {
                const ctx = document.getElementById('volumeChart');
                if (!ctx) { console.error("Canvas #volumeChart no encontrado"); return; }
                const chartContext = ctx.getContext('2d');
                if (!chartContext) { console.error("Fallo al obtener contexto 2D para volumen"); return; }

                new Chart(chartContext, {
                    type: 'bar',
                    data: {
                        labels: daysOfWeekLabels,
                        datasets: [{
                            label: 'Volumen Estimado', data: weeklyVolumeData,
                            backgroundColor: 'rgba(52, 152, 219, 0.6)', borderColor: 'rgba(52, 152, 219, 1)',
                            borderWidth: 1, borderRadius: 4, hoverBackgroundColor: 'rgba(52, 152, 219, 0.8)'
                        }]
                    },
                    options: { /* Opciones del bar chart */
                        scales: {
                            y: { beginAtZero: true, title: { display: true, text: 'Volumen (ej: nº series)', font: { size: 12, weight: '500' }, color: 'rgba(0, 0, 0, 0.6)' }, grid: { color: 'rgba(0, 0, 0, 0.05)' } },
                            x: { grid: { display: false } }
                        },
                        plugins: { legend: { display: false }, tooltip: {
                            enabled: true, backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            titleFont: { size: 13, weight: 'bold' }, bodyFont: { size: 12 },
                            padding: 10, cornerRadius: 4,
                            callbacks: {
                                title: function(tooltipItems) {
                                    const dayIndex = tooltipItems[0].dataIndex;
                                    return fullDaysOfWeek[dayIndex] || ''; // Usar array de días completos
                                },
                                label: function(context) {
                                    let label = context.dataset.label || '';
                                    if (label) { label += ': '; }
                                    if (context.parsed.y !== null) { label += context.parsed.y; }
                                    if (context.parsed.y === 0) { label += ' (Descanso)'; }
                                    return label;
                                }
                            }
                        }},
                        responsive: true, maintainAspectRatio: false
                    }
                });
            }

            // Inicializar gráficos cuando el DOM esté listo
            // Usar window.onload para asegurar que todo (incluyendo imágenes) esté cargado,
            // lo cual es más seguro para Puppeteer.
            window.onload = function() {
                try {
                    initRadarChart();
                    initVolumeChart();
                } catch (error) {
                    console.error("Error inicializando gráficos:", error);
                }
            };
        <\/script>
    `;
}


// --- Función Principal de Ensamblaje ---

/**
 * Crea el HTML completo y dinámico para la portada.
 * @param {string} clientName - Nombre del cliente.
 * @param {string} routineHtml - HTML de la rutina para análisis.
 * @param {string} logoBase64 - String Base64 de la imagen del logo.
 * @returns {string} - String HTML completo de la portada.
 */
function createDynamicCoverPage(clientName = 'Cliente', routineHtml = '', logoBase64 = '') {
    // 1. Calcular datos específicos del cliente
    const scores = calculateTrainingComponentScores(routineHtml);
    const weeklyVolumeData = calculateWeeklyVolume(routineHtml);

    // 2. Generar las partes HTML/CSS/Script
    const styles = generateCoverPageStyles();
    const mainSectionHtml = generateMainSectionHtml(scores, clientName);
    const volumeChartSectionHtml = generateVolumeChartSectionHtml();
    const scripts = generateChartScripts(scores, weeklyVolumeData); // Pasar datos a los scripts

    // 3. Ensamblar el HTML completo
    const currentYear = new Date().getFullYear();
    const currentDate = new Date().toLocaleDateString('es-ES', {
        year: 'numeric', month: 'long', day: 'numeric'
    });

    // Usar un placeholder seguro para el logo si no se proporciona
    const logoSrc = logoBase64 || `https://placehold.co/125x42/0a2a5e/ffffff?text=Logo&font=inter`;
    const logoImgTag = `<img class="cover-logo-new" src="${logoSrc}" alt="Logo Fitform" onerror="this.style.display='none'">`; // Ocultar si falla

    const fullHtml = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Portada de Rutina - ${clientName}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
        ${styles}
    </style>
</head>
<body>
    <div class="cover-page-new noise-texture">
        <div class="cover-content-wrapper">
            <div class="cover-header-new">
                ${logoImgTag}
                <div class="client-info-new">
                    <h1>${clientName}</h1>
                    <p>${currentDate}</p>
                </div>
            </div>

            ${mainSectionHtml}

            ${volumeChartSectionHtml}

            <div class="cover-footer-new">
                <p>© ${currentYear} Fitform - Todos los derechos reservados</p>
            </div>
        </div>
    </div>
    ${scripts}
</body>
</html>`;

    return fullHtml;
}

// Exportar la función principal para usarla en otros módulos (ej: pdfService.js)
module.exports = {
    createDynamicCoverPage,
    // Opcionalmente exportar otras funciones si necesitas usarlas individualmente
    calculateTrainingComponentScores,
    calculateWeeklyVolume
};
