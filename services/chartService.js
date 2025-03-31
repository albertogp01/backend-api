// services/chartService.js
const { JSDOM } = require('jsdom');
const { ChartJSNodeCanvas } = require('chartjs-node-canvas');
const fs = require('fs');
const path = require('path');
// Asegúrate de requerir 'os' si no está globalmente disponible. Puede que necesites instalarlo si no es un módulo built-in en tu entorno exacto.
const os = require('os');


// --- Configuración para Generación de Gráfico ---
const width = 600; // Ancho de la imagen del gráfico
const height = 500; // Alto de la imagen del gráfico
const chartJSNodeCanvas = new ChartJSNodeCanvas({ width, height, backgroundColour: '#ffffff' });

const COMPONENTS = ['Fuerza', 'Hipertrofia', 'Movilidad', 'Potencia', 'Técnica', 'Cardio'];

/**
 * Analiza el contenido HTML de la rutina para cuantificar componentes de entrenamiento.
 * NOTA: Esta es una implementación EJEMPLO SIMPLIFICADA. Necesita heurísticas detalladas.
 *
 * @param {string} htmlContent - La cadena HTML de la rutina generada.
 * @returns {object} - Un objeto con puntuaciones para cada componente (ej., { Fuerza: 7, ... }).
 */
function analyzeRoutine(htmlContent) {
    // Inicializa puntuaciones a 0
    const scores = COMPONENTS.reduce((acc, key) => { acc[key] = 0; return acc; }, {});
    let totalExercises = 0;

    try {
        const dom = new JSDOM(htmlContent);
        const document = dom.window.document;
        // Busca todas las tablas en el documento
        const tables = document.querySelectorAll('table');

        tables.forEach(table => {
            // Identifica si es una tabla de activación o rutina principal
            const isActivation = table.querySelector('.activacion-header') !== null;
            const rows = table.querySelectorAll('tr');

            rows.forEach(row => {
                const cells = row.querySelectorAll('td');
                // Verifica si parece una fila de ejercicio (al menos 5 celdas)
                if (cells.length >= 5) {
                    const exercise = cells[0]?.textContent.trim() || '';
                    const seriesText = cells[1]?.textContent.trim() || '';
                    const repsText = cells[2]?.textContent.trim() || '';
                    const restText = cells[3]?.textContent.trim() || '';
                    const notesText = cells[4]?.textContent.trim().toLowerCase() || '';

                    // Salta cabeceras o filas inválidas
                    if (!exercise || !seriesText || isNaN(parseInt(seriesText.split(' ')[0]))) return;

                    totalExercises++;
                    const reps = parseReps(repsText); // Función auxiliar para parsear reps
                    const rest = parseRest(restText); // Función auxiliar para parsear descanso

                    // --- EJEMPLO de Heurísticas (Necesita expansión significativa) ---

                    // Fuerza: Reps bajas (1-6), descanso largo (>100s)
                    if (reps.max <= 6 && reps.min >= 1 && rest >= 100) scores.Fuerza += 2;
                    else if (reps.max <= 8 && reps.min >= 1) scores.Fuerza += 1;
                    // Considera RIR bajo en notas
                    if (notesText.includes('rir 0') || notesText.includes('rir 1') || notesText.includes('rir 2')) scores.Fuerza += 0.5;

                    // Hipertrofia: Reps medias (6-15), descanso moderado (45-100s)
                    if (reps.min >= 6 && reps.max <= 15 && rest >= 45 && rest <= 100) scores.Hipertrofia += 2;
                    else if (reps.min >= 6 && reps.max <= 20) scores.Hipertrofia += 1;
                    // Considera RIR medio en notas
                    if (notesText.includes('rir 2') || notesText.includes('rir 3')) scores.Hipertrofia += 0.5;

                    // Potencia: Palabras clave en notas o tipo de ejercicio
                    if (notesText.includes('explosivo') || notesText.includes('velocidad') || notesText.includes('plyo') || notesText.includes('salto')) scores.Potencia += 3;
                    // A menudo reps bajas/medias con descanso suficiente
                    if (reps.max <= 8 && rest >= 60) scores.Potencia += 0.5;

                    // Movilidad: Ejercicios específicos, a menudo en activación
                    if (isActivation && (exercise.toLowerCase().includes('movilidad') || exercise.toLowerCase().includes('estiramiento dinámico'))) scores.Movilidad += 2;
                    if (exercise.toLowerCase().includes('movilidad') || exercise.toLowerCase().includes('estiramiento')) scores.Movilidad += 1;

                    // Técnica: Palabras clave en notas, RIR alto
                    if (notesText.includes('técnica') || notesText.includes('control') || notesText.includes('lento') || notesText.includes('foco en forma')) scores.Técnica += 2;
                    // RIR alto a menudo indica foco en aprendizaje/técnica
                    if (notesText.includes('rir 3') || notesText.includes('rir 4')) scores.Técnica += 1;

                    // Cardio: Ejercicios específicos o reps altas/descanso bajo
                    if (exercise.toLowerCase().includes('correr') || exercise.toLowerCase().includes('bici') || exercise.toLowerCase().includes('cardio') || exercise.toLowerCase().includes('hiit') || exercise.toLowerCase().includes('burpee') || exercise.toLowerCase().includes('jumping jack')) scores.Cardio += 2;
                    // Reps altas (>20) con descanso bajo (<45s)
                    if (reps.max >= 20 && rest <= 45) scores.Cardio += 1;
                }
            });
        });

    } catch (error) {
        console.error("Error analizando HTML de la rutina:", error);
        // Devuelve ceros o maneja el error apropiadamente
        return COMPONENTS.reduce((acc, key) => { acc[key] = 0; return acc; }, {});
    }

    // --- Normalización de Puntuaciones (Ejemplo) ---
    const normalizedScores = {};
    // Factor de escala simple basado en número de ejercicios (ajustar según necesidad)
    const maxPossibleScorePerComponent = Math.max(1, totalExercises) * 1.5;
    const scaleMax = 10; // Escala final (ej. 0-10)

    for (const component of COMPONENTS) {
        let normalized = (scores[component] / maxPossibleScorePerComponent) * scaleMax;
        // Asegura que la puntuación esté entre 1 (mínimo visible) y scaleMax
        // Redondea a un decimal
        normalizedScores[component] = Math.max(1, Math.min(scaleMax, Math.round(normalized * 10) / 10));
    }
    console.log("Puntuaciones Raw:", scores);
    console.log("Puntuaciones Normalizadas:", normalizedScores);
    return normalizedScores;
}

// --- Funciones Auxiliares para Parseo ---
function parseReps(repsText) {
    // Busca rangos como "8-12"
    const rangeMatch = repsText.match(/(\d+)\s*-\s*(\d+)/);
    // Busca números únicos como "10"
    const singleMatch = repsText.match(/^\s*(\d+)\s*$/);
    let min = 0, max = 0;

    if (rangeMatch) {
        min = parseInt(rangeMatch[1]);
        max = parseInt(rangeMatch[2]);
    } else if (singleMatch) {
        min = max = parseInt(singleMatch[1]);
    // Asume rango de hipertrofia si dice "fallo" sin especificar reps
    } else if (repsText.toLowerCase().includes('fallo')) {
        min = 8; max = 15;
    }
    return { min, max };
}

function parseRest(restText) {
    // Extrae el primer número encontrado (asume segundos)
    const match = restText.match(/(\d+)/);
    // Devuelve 60s por defecto si no se puede parsear
    return match ? parseInt(match[1]) : 60;
}


/**
 * Genera una imagen de gráfico radar a partir de las puntuaciones.
 *
 * @param {object} radarData - Objeto con puntuaciones de componentes (ej., { Fuerza: 7, ... }).
 * @returns {Promise<string>} - Cadena base64 de la imagen PNG generada.
 */
async function generateRadarChart(radarData) {
    // Extrae los valores de puntuación en el orden correcto
    const dataValues = COMPONENTS.map(component => radarData[component] || 0);

    const configuration = {
        type: 'radar',
        data: {
            labels: COMPONENTS, // Ejes del gráfico
            datasets: [{
                label: 'Enfoque del Entrenamiento',
                data: dataValues, // Valores para cada eje
                fill: true,
                backgroundColor: 'rgba(10, 42, 94, 0.3)',  // Relleno azul claro semitransparente
                borderColor: 'rgb(10, 42, 94)',        // Línea azul oscuro
                pointBackgroundColor: 'rgb(10, 42, 94)', // Puntos en azul oscuro
                pointBorderColor: '#fff', // Borde blanco para puntos
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: 'rgb(10, 42, 94)'
            }]
        },
        options: {
             scales: {
                r: { // Eje radial (valores)
                     angleLines: { display: true, color: 'rgba(0, 0, 0, 0.1)' }, // Líneas hacia el centro
                     grid: { color: 'rgba(0, 0, 0, 0.1)' }, // Círculos de la cuadrícula
                     pointLabels: { // Etiquetas de los ejes (Fuerza, Hipertrofia...)
                         font: { size: 13, weight: 'bold' },
                          color: '#333'
                     },
                     suggestedMin: 0, // Empezar escala en 0
                     suggestedMax: 10, // Asumiendo normalización 0-10
                     ticks: { // Marcas numéricas en el eje
                        backdropColor: 'rgba(255, 255, 255, 0.75)', // Fondo para legibilidad
                         stepSize: 2, // Incremento de las marcas (0, 2, 4...)
                         font: { size: 10 },
                         color: '#555'
                     }
                }
            },
             plugins: {
                legend: { display: false }, // Ocultar leyenda si solo hay un dataset
                 title: { // Título del gráfico
                      display: true,
                      text: 'Visualización del Enfoque Semanal',
                      font: { size: 18, weight: 'bold' },
                      color: '#0a2a5e', // Color primario
                      padding: { top: 10, bottom: 20 }
                 }
            },
            maintainAspectRatio: true, // Mantener proporciones
            responsive: false // Necesario para chartjs-node-canvas
        }
    };

    try {
        console.log("Generando imagen del gráfico...");
        const imageBuffer = await chartJSNodeCanvas.renderToBuffer(configuration);
        // Convierte el buffer a base64
        const base64Image = `data:image/png;base64,${imageBuffer.toString('base64')}`;
        console.log("Imagen del gráfico generada (base64).");
        return base64Image;
    } catch (error) {
        console.error("Error generando gráfico radar:", error);
        throw new Error("No se pudo generar la imagen del gráfico radar.");
    }
}

module.exports = {
    analyzeRoutine,
    generateRadarChart
};