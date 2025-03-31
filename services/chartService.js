const puppeteer = require('puppeteer');

/**
 * Analiza el HTML de la rutina para calcular las puntuaciones de los componentes de entrenamiento.
 * @param {string} routineHtml - El contenido HTML de la rutina generada.
 * @returns {Object} - Puntuaciones para cada componente de entrenamiento (0-100).
 */
function calculateTrainingComponentScores(routineHtml) {
  // Inicializar puntuaciones
  const scores = {
    fuerza: 0,
    hipertrofia: 0,
    movilidad: 0,
    potencia: 0,
    tecnica: 0,
    cardio: 0
  };

  // Si no hay HTML, devolver puntuaciones predeterminadas
  if (!routineHtml || routineHtml.trim() === '') {
    // Perfil equilibrado predeterminado si no hay datos
    return {
      fuerza: 50,
      hipertrofia: 50,
      movilidad: 50,
      potencia: 50,
      tecnica: 50,
      cardio: 50
    };
  }

  // Palabras clave para cada componente de entrenamiento
  const keywords = {
    fuerza: ['fuerza', 'strength', 'carga', 'peso', 'resistencia', 'weight', 'sentadilla', 'squat', 'press', 'deadlift', 'peso muerto', 'power', 'potencia', 'rm', '1rm', 'máxima', 'maximales', 'intensidad alta', 'pesado', 'heavy'],
    hipertrofia: ['hipertrofia', 'hypertrophy', 'volumen', 'volume', 'muscle', 'músculo', 'muscular', 'growth', 'crecimiento', 'tamaño', 'size', 'bodybuilding', 'culturismo', 'series', 'repeticiones', 'reps', 'rir'],
    movilidad: ['movilidad', 'mobility', 'flexibility', 'flexibilidad', 'stretching', 'estiramiento', 'range', 'motion', 'rango', 'articular', 'joint', 'rom', 'elasticidad', 'elongación', 'estirar', 'stretch'],
    potencia: ['potencia', 'power', 'explosiv', 'explosi[oó]n', 'velocidad', 'speed', 'fast', 'rápido', 'salto', 'jump', 'plyometric', 'pliometría', 'reactiv', 'sprint', 'lanzamiento', 'throw', 'tiempo', 'time', 'tempo.*[xX]'],
    tecnica: ['técnica', 'technique', 'form', 'forma', 'skill', 'habilidad', 'balance', 'equilibrio', 'coordination', 'coordinación', 'control', 'pattern', 'patrón', 'motor', 'stability', 'estabilidad'],
    cardio: ['cardio', 'cardiovascular', 'aeróbico', 'aerobic', 'resistencia', 'endurance', 'stamina', 'interval', 'intervalos', 'hiit', 'heart', 'rate', 'ritmo', 'cardiac', 'cardíaco', 'vo2', 'máximo', 'correr', 'run', 'nadar', 'swim']
  };

  // Contar ocurrencias de palabras clave
  const counts = {
    fuerza: 0,
    hipertrofia: 0,
    movilidad: 0,
    potencia: 0,
    tecnica: 0,
    cardio: 0
  };

  // Analizar el contenido HTML para cada componente usando palabras clave
  Object.keys(keywords).forEach(component => {
    keywords[component].forEach(keyword => {
      // Crear una expresión regular insensible a mayúsculas/minúsculas con límites de palabra
      // Maneja acentos y variaciones para algunas palabras clave implícitamente si comparten raíces
      try {
        const regex = new RegExp(`\\b${keyword}\\w*\\b`, 'gi');
        const matches = routineHtml.match(regex) || [];
        counts[component] += matches.length;
      } catch (e) {
        console.warn(`Expresión regular inválida para la palabra clave: ${keyword}`, e);
      }
    });
  });

  // --- Heurísticas Adicionales ---

  // 1. Análisis de Rangos de Repeticiones
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

  counts.fuerza += lowRepSets * 1.5; // Impulsar fuerza para bajas repeticiones
  counts.hipertrofia += midRepSets * 1.5; // Impulsar hipertrofia para repeticiones medias
  counts.cardio += highRepSets * 0.5; // Impulsar ligeramente cardio/resistencia para altas repeticiones

  // 2. Palabras Clave de Ejercicios Específicos
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
        const regex = new RegExp(ex.replace(/\s+/g, '\\s+'), 'gi'); // Coincidir nombre de ejercicio insensible a mayúsculas/minúsculas
        const matches = routineHtml.match(regex) || [];
        counts[component] += matches.length * 2; // Dar mayor peso a ejercicios específicos
      } catch(e) {
         console.warn(`Expresión regular inválida para el ejercicio: ${ex}`, e);
      }
    });
  });

  // 3. Indicadores de Intensidad/Tempo
  if (routineHtml.match(/RIR\s+[0-2]/gi)) counts.hipertrofia += 5; // Alta intensidad -> Hipertrofia/Fuerza
  if (routineHtml.match(/RIR\s+[3-4]/gi)) counts.hipertrofia += 2; // Intensidad moderada
  if (routineHtml.match(/tempo.*[xX]/gi)) counts.potencia += 5; // Tempo explosivo
  if (routineHtml.match(/tempo\s+\d{3,}/gi)) counts.tecnica += 3; // Tempo controlado -> Técnica/Hipertrofia

  // --- Normalización ---

  // Calcular el conteo total para puntuación relativa
  const totalCount = Object.values(counts).reduce((sum, count) => sum + count, 0);

  // Si totalCount es 0, devolver puntuaciones equilibradas predeterminadas
  if (totalCount === 0) {
    return { fuerza: 50, hipertrofia: 50, movilidad: 50, potencia: 50, tecnica: 50, cardio: 50 };
  }

  // Calcular puntuaciones normalizadas (0-100) basadas en la proporción
  Object.keys(counts).forEach(component => {
    scores[component] = Math.round((counts[component] / totalCount) * 100);
  });

  // --- Suavizado y Umbral ---

  // Asegurar que las puntuaciones sumen aproximadamente 100 después de los ajustes (opcional, puede llevar a una redistribución compleja)
  // Por simplicidad, solo aplicaremos un umbral mínimo.

  // Aplicar un umbral mínimo para evitar puntuaciones de cero si un componente está presente
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

  // Opcional: Redistribuir puntos restantes si es necesario, pero puede volverse complejo.
  // En su lugar, limitaremos las puntuaciones a 100.
   Object.keys(scores).forEach(component => {
       scores[component] = Math.min(scores[component], 100);
   });


  // Encontrar el(los) componente(s) con la puntuación más alta para uso potencial en la descripción
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

  // Añadir componentes principales al objeto de puntuaciones para pasarlo fácilmente
  scores.mainComponents = mainComponents;
  // Capitalizar nombres de componentes para mostrar
  scores.mainComponentsDisplay = mainComponents.map(c => c.charAt(0).toUpperCase() + c.slice(1)).join(', ');


  console.log("Puntuaciones Calculadas:", scores); // Registrar puntuaciones para depuración
  return scores;
}


/**
 * Genera el HTML del gráfico radar para la portada (Diseño Mejorado).
 * @param {Object} scores - Puntuaciones de componentes de entrenamiento incluyendo mainComponentsDisplay.
 * @param {string} clientName - Nombre del cliente.
 * @returns {string} - HTML para la portada del gráfico radar.
 */
function generateRadarChartHtml(scores, clientName = 'Cliente') {
  const date = new Date().toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Generar descripción dinámica basada en los componentes principales
  let description = `Hola ${clientName}, este gráfico visualiza el enfoque de tu nuevo plan de entrenamiento. `;
  if (scores.mainComponents && scores.mainComponents.length > 0) {
      description += `Hemos puesto énfasis en **${scores.mainComponentsDisplay}** para ayudarte a alcanzar tus objetivos.`;
  } else {
      description += `Está diseñado para proporcionarte un desarrollo equilibrado en todas las áreas clave.`;
  }

  // **Nota:** Se ha mantenido la estructura HTML original ya que proporciona
  // los ganchos necesarios para aplicar los estilos CSS mejorados.
  // Las clases '-new' se mantienen para coherencia con el código original.
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
 * Genera estilos CSS para la portada del gráfico radar mejorada.
 * @returns {string} - Estilos CSS.
 */
function getRadarChartStyles() {
  // **CSS Mejorado:** Se han refinado los estilos para una estética superior,
  // manteniendo la estructura y las variables de color implícitas del original.
  // Se asume la existencia de --primary-color, --secondary-color, --accent-color, --border-radius.
  return `
    /* Estilos Mejorados Portada Gráfico Radar */
    :root {
        /* Definición de variables de color de ejemplo si no están definidas globalmente */
        --primary-color: #0a2a5e; /* Azul oscuro */
        --secondary-color: #1e477e; /* Azul medio */
        --accent-color: #3498db; /* Azul brillante (usado para subrayado) */
        --border-radius: 8px; /* Radio de borde estándar */
    }

    .cover-page-new {
      position: relative;
      display: flex;
      flex-direction: column;
      min-height: 100vh; /* Asegura altura completa de página */
      width: 100%;
      /* Padding ajustado para mejor equilibrio visual */
      padding: 55px 65px;
      /* Gradiente sutil y profesional */
      background: linear-gradient(140deg, var(--primary-color) 0%, var(--secondary-color) 100%);
      color: #ffffff; /* Color de texto predeterminado sobre fondo oscuro */
      box-sizing: border-box; /* Incluye padding y border en el tamaño total */
      font-family: 'Inter', 'Arial', sans-serif; /* Fuente limpia y moderna */
      page-break-after: always; /* Asegura que esté en su propia página (para PDF) */
    }

    .cover-header-new {
      width: 100%;
      display: flex;
      justify-content: space-between;
      align-items: flex-start; /* Alinear items arriba */
      margin-bottom: 45px; /* Espacio incrementado bajo la cabecera */
      border-bottom: 1px solid rgba(255, 255, 255, 0.15); /* Separador más sutil */
      padding-bottom: 25px; /* Padding incrementado */
    }

    .cover-logo-new {
      width: 140px; /* Tamaño de logo ligeramente aumentado */
      height: auto;
      filter: brightness(0) invert(1); /* Asegura logo blanco */
      opacity: 0.95; /* Opacidad ligeramente aumentada */
    }

    .client-info-new {
      text-align: right;
    }

    .client-info-new h1 {
      font-size: 34px; /* Nombre de cliente más prominente */
      font-weight: 700; /* Negrita */
      color: #ffffff;
      margin: 0 0 8px 0; /* Espacio ajustado bajo el nombre */
      line-height: 1.15; /* Interlineado ajustado */
    }

    .client-info-new p {
      margin: 0;
      color: rgba(255, 255, 255, 0.8); /* Blanco ligeramente transparente para la fecha */
      font-size: 16px; /* Tamaño de fuente de fecha aumentado */
      font-weight: 400; /* Peso normal */
    }

    .cover-main-new {
        flex-grow: 1; /* Permite que el contenido principal llene el espacio */
        display: flex;
        align-items: center; /* Centrar verticalmente gráfico y texto */
        justify-content: space-between;
        gap: 60px; /* Espacio aumentado entre texto/leyenda y gráfico */
        width: 100%;
        margin-bottom: 50px; /* Espacio aumentado sobre el pie de página */
    }

    .cover-text-content {
        flex: 1; /* Tomar espacio disponible */
        max-width: 48%; /* Ancho máximo ajustado */
    }

    .cover-text-content h2 {
      font-size: 30px; /* Tamaño de título aumentado */
      font-weight: 700;
      color: #ffffff;
      margin-bottom: 25px; /* Espacio aumentado bajo el título */
      line-height: 1.25; /* Interlineado ajustado */
      position: relative;
      display: inline-block; /* Para que el ::after funcione correctamente */
    }

    /* Subrayado refinado para el título */
    .cover-text-content h2::after {
      content: '';
      position: absolute;
      bottom: -10px; /* Posición ajustada */
      left: 0;
      width: 70px; /* Ancho aumentado */
      height: 3.5px; /* Grosor ligeramente aumentado */
      background-color: var(--accent-color); /* Usar color de acento */
      border-radius: 3px; /* Bordes redondeados */
    }


    .cover-description-new {
      font-size: 17px; /* Tamaño de fuente aumentado para legibilidad */
      color: rgba(255, 255, 255, 0.9); /* Mayor opacidad para mejor contraste */
      line-height: 1.75; /* Interlineado generoso */
      margin-bottom: 35px; /* Espacio aumentado */
      font-weight: 400;
    }

    .cover-description-new strong {
        color: #ffffff; /* Blanco puro para énfasis */
        font-weight: 600; /* Semi-negrita */
    }

    .components-legend-new {
      display: flex;
      gap: 35px; /* Espacio aumentado entre columnas */
      background-color: rgba(255, 255, 255, 0.06); /* Fondo de leyenda más sutil */
      padding: 25px; /* Padding aumentado */
      border-radius: var(--border-radius); /* Usar radio de borde estándar */
      border: 1px solid rgba(255, 255, 255, 0.1); /* Borde muy sutil */
    }

    .legend-column {
        display: flex;
        flex-direction: column;
        gap: 15px; /* Espacio aumentado entre items en una columna */
    }

    .component-item-new {
      display: flex;
      align-items: center;
      gap: 12px; /* Espacio aumentado entre punto y etiqueta */
    }

    .component-dot-new {
      width: 11px; /* Tamaño de punto ligeramente aumentado */
      height: 11px;
      border-radius: 50%; /* Círculo perfecto */
      flex-shrink: 0; /* Evitar que el punto se encoja */
      /* Añadir un borde sutil para definición */
      border: 1px solid rgba(255, 255, 255, 0.3);
    }

    /* Colores de puntos (mantenidos del original, son distintivos) */
    .fuerza-color { background-color: #3498db; } /* Azul */
    .hipertrofia-color { background-color: #2ecc71; } /* Verde */
    .movilidad-color { background-color: #f1c40f; } /* Amarillo */
    .potencia-color { background-color: #e74c3c; } /* Rojo */
    .tecnica-color { background-color: #9b59b6; } /* Púrpura */
    .cardio-color { background-color: #e67e22; } /* Naranja */

    .component-label-new {
      font-size: 15px; /* Tamaño de etiqueta aumentado */
      font-weight: 500; /* Peso medio */
      color: rgba(255, 255, 255, 0.95); /* Casi blanco para claridad */
    }

    .component-label-new span {
      font-weight: 700; /* Negrita para el valor porcentual */
      color: #ffffff;
      margin-left: 4px; /* Pequeño espacio antes del porcentaje */
    }

    .radar-chart-container-new {
      flex: 1; /* Tomar espacio disponible */
      max-width: 48%; /* Ancho máximo mantenido */
      height: 420px; /* Altura ligeramente aumentada */
      background-color: rgba(255, 255, 255, 0.98); /* Fondo casi opaco para máximo contraste del gráfico */
      border-radius: 10px; /* Radio de borde ligeramente mayor */
      padding: 30px; /* Padding interno aumentado */
      /* Sombra más suave y difusa */
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
      display: flex; /* Centrar canvas interior */
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
        padding-top: 25px; /* Padding superior aumentado */
        margin-top: auto; /* Empujar pie de página al fondo */
        border-top: 1px solid rgba(255, 255, 255, 0.15); /* Separador sutil */
        font-size: 12px; /* Tamaño de fuente ligeramente aumentado */
        color: rgba(255, 255, 255, 0.75); /* Opacidad ajustada */
    }
  `;
}

/**
 * Genera el script de inicialización de Chart.js para el gráfico radar (Ajustado para nuevo diseño).
 * @param {Object} scores - Puntuaciones de componentes de entrenamiento.
 * @returns {string} - Código JavaScript para inicializar el gráfico.
 */
function getRadarChartScript(scores) {
  // Convertir objeto de puntuaciones a array en el orden correcto para Chart.js
  const chartData = [
      scores.fuerza,
      scores.hipertrofia,
      scores.movilidad,
      scores.potencia,
      scores.tecnica,
      scores.cardio
  ];

  // **Nota:** La configuración del gráfico (colores, fuentes) se mantiene ya que
  // fue diseñada para funcionar sobre el fondo claro del contenedor del gráfico.
  // Los ajustes visuales principales se realizan a través del CSS.
  return `
    <script src="https://cdn.jsdelivr.net/npm/chart.js@3.7.1/dist/chart.min.js"></script>
    <script>
      // Función para inicializar el gráfico radar
      function initRadarChart() {
        const ctx = document.getElementById('radarChart');
        if (!ctx) {
            console.error("Elemento Canvas #radarChart no encontrado");
            return;
        }
        const chartContext = ctx.getContext('2d');
        if (!chartContext) {
             console.error("Fallo al obtener el contexto 2D del canvas");
            return;
        }

        // Configuración Chart.js - Ajustada para mejor visualización sobre fondo claro
        const radarChart = new Chart(chartContext, {
          type: 'radar',
          data: {
            labels: ['Fuerza', 'Hipertrofia', 'Movilidad', 'Potencia', 'Técnica', 'Cardio'],
            datasets: [{
              label: 'Perfil de Entrenamiento',
              data: ${JSON.stringify(chartData)}, // Usar array de datos
              backgroundColor: 'rgba(10, 42, 94, 0.25)', // Color primario con transparencia ajustada
              borderColor: 'rgba(10, 42, 94, 0.85)', // Borde más oscuro y opaco
              borderWidth: 2.5, // Borde ligeramente más grueso
              pointBackgroundColor: 'rgba(10, 42, 94, 1)', // Puntos sólidos
              pointBorderColor: '#fff', // Borde blanco alrededor de los puntos
              pointHoverBackgroundColor: '#fff',
              pointHoverBorderColor: 'rgba(10, 42, 94, 1)',
              pointRadius: 4, // Radio de punto
              pointHoverRadius: 6 // Radio de punto al pasar el ratón
            }]
          },
          options: {
            scales: {
              r: { // Eje radial (los radios)
                angleLines: { // Líneas que irradian desde el centro
                  display: true,
                  color: 'rgba(0, 0, 0, 0.1)' // Líneas gris claro
                },
                suggestedMin: 0,
                suggestedMax: 100,
                grid: { // Líneas formando la telaraña
                    color: 'rgba(0, 0, 0, 0.1)' // Líneas gris claro
                },
                ticks: { // Números en el eje (0, 20, 40...)
                  stepSize: 20,
                  color: 'rgba(0, 0, 0, 0.6)', // Gris más oscuro para números
                  backdropColor: 'rgba(255, 255, 255, 0.75)', // Fondo blanco semitransparente para ticks
                  padding: 10 // Padding aumentado
                },
                pointLabels: { // Etiquetas alrededor del borde (Fuerza, Cardio...)
                  font: {
                    size: 13.5, // Tamaño de etiquetas ligeramente aumentado
                    weight: '600' // Semi-negrita
                  },
                  color: 'rgba(0, 0, 0, 0.85)' // Texto oscuro para etiquetas
                }
              }
            },
            plugins: {
              legend: {
                display: false // La leyenda se maneja por separado en HTML
              },
              tooltip: {
                enabled: true,
                backgroundColor: 'rgba(0, 0, 0, 0.85)', // Tooltip oscuro
                titleFont: { size: 14, weight: 'bold' },
                bodyFont: { size: 13 },
                padding: 12, // Padding aumentado
                boxPadding: 5,
                cornerRadius: 4 // Bordes redondeados para tooltip
              }
            },
            responsive: true,
            maintainAspectRatio: false // Importante para ajustarse al contenedor
          }
        });
      }

      // Asegurar que el gráfico se inicializa después de que el DOM esté listo,
      // especialmente importante cuando el contenido es establecido dinámicamente por Puppeteer.
      if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', initRadarChart);
      } else {
          // DOMContentLoaded ya se ha disparado
          initRadarChart();
      }
    </script>
  `;
}


/**
 * Crea una portada completa de gráfico radar con puntuaciones calculadas a partir del HTML de la rutina.
 * @param {string} routineHtml - El contenido HTML de la rutina.
 * @param {string} clientName - Nombre del cliente.
 * @param {string} logoBase64 - Imagen del logo codificada en Base64.
 * @returns {object} - Objeto que contiene coverPageHtml, styles, script y scores.
 */
function createRadarChartCoverPage(routineHtml, clientName, logoBase64) {
  // Calcular puntuaciones basadas en el contenido de la rutina
  const scores = calculateTrainingComponentScores(routineHtml); // scores ahora incluye mainComponentsDisplay

  // Generar HTML para la portada usando la función mejorada
  let coverPageHtml = generateRadarChartHtml(scores, clientName);

  // Reemplazar el marcador de posición del logo con la imagen base64 real
  if (logoBase64) {
    coverPageHtml = coverPageHtml.replace('LOGO_BASE_64_PLACEHOLDER', logoBase64);
  } else {
    // Proporcionar un fallback o eliminar la etiqueta img si no hay logo
    coverPageHtml = coverPageHtml.replace(/<img class="cover-logo-new".*?>/g, ''); // Eliminar etiqueta img si no hay logo
    console.warn("Logo Base64 no proporcionado para la portada.");
  }

  // Obtener estilos y script usando las funciones mejoradas
  const styles = getRadarChartStyles();
  const script = getRadarChartScript(scores); // Pasar puntuaciones a la función de script

  return { coverPageHtml, styles, script, scores };
}

module.exports = {
  calculateTrainingComponentScores, // Exportar si se necesita en otro lugar
  createRadarChartCoverPage
};
