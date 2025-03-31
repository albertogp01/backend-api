const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");
const os = require("os");
const chartService = require('./chartService');

/**
 * Genera un PDF con portada (incluyendo gráfico radar) y contenido de la rutina.
 * @param {string} htmlContent - Contenido HTML de la rutina (tablas, etc.).
 * @param {string} [clientName="Cliente"] - Nombre del cliente.
 * @param {object} [userProfile={}] - Objeto con datos del perfil del usuario (e.g., { trainingGoal, experienceLevel }).
 * @returns {Promise<string>} - Promesa que resuelve con la ruta al archivo PDF generado.
 */
async function generatePDF(htmlContent, clientName = "Cliente", userProfile = {}) { // *** MODIFICADO: Añadido userProfile ***
    // Definir chartImagePath y chartDataUri fuera del try para que estén disponibles en el finally/cleanup
    let chartImagePath = null;
    let chartDataUri = null;
  
    return new Promise(async (resolve, reject) => {
      try {
      console.log("Generando PDF para:", clientName);
      const sanitizedName = clientName.replace(/[^a-zA-Z0-9]/g, "_");
      const fileName = `rutina_${sanitizedName}_${Date.now()}.pdf`;

      // Usar el directorio temporal del sistema operativo
      const tempDir = os.tmpdir();
      const filePath = path.join(tempDir, fileName);

      console.log(`Usando directorio temporal: ${tempDir}`);

      try {
        // Pasar el HTML *original* de la rutina y el perfil del usuario
        chartImagePath = await chartService.generateRadarChartImage(htmlContent, userProfile);

        // Leer el archivo de imagen generado y convertirlo a Data URI
        const imageBuffer = await fs.readFile(chartImagePath);
        chartDataUri = `data:image/png;base64,${imageBuffer.toString('base64')}`;
        console.log("Chart image generated and converted to Data URI.");
      } catch (chartError) {
        console.error("Error generando gráfico radar (se continuará sin él):", chartError);
        // No rechazar la promesa principal, solo registrar el error. chartDataUri permanecerá null.
        chartDataUri = null;
      }
      
      // Preparar logo
      const logoPath = path.resolve(__dirname, "../assets/logo.png");
      let logoBase64 = "";
      if (fs.existsSync(logoPath)) {
        logoBase64 = `data:image/png;base64,${fs.readFileSync(logoPath).toString("base64")}`;
      } else {
        console.error("Error: El archivo del logo no existe en la ruta:", logoPath);
      }

      const creationDate = new Date().toLocaleDateString("es-ES", {
        year: "numeric", month: "long", day: "numeric"
      });

      // Procesar HTML - CORREGIDO: Mejorado el manejo del primer día
      let modifiedHtml = htmlContent.replace(/<\/table>\s*<table>/g, "</table><div class='table-spacer'></div><table>");

      // Corregir el primer día especialmente para evitar problemas
      if (modifiedHtml.startsWith("<table>")) {
        const firstDayMatch = modifiedHtml.match(/<th colspan="5">(Día 1:.+?)<\/th>/);
        if (firstDayMatch) {
          modifiedHtml = `<h2 class="day-title first-day-title">${firstDayMatch[1]}</h2>${modifiedHtml}`;
          modifiedHtml = modifiedHtml.replace(/<th colspan="5">Día 1:.+?<\/th>/, '');
        }
      }

      // Procesar el resto de los días
      modifiedHtml = modifiedHtml.replace(
        /<th colspan="5">(Día \d+:.+?)<\/th>/g,
        '</table><h2 class="day-title">$1</h2><table>'
      );

      const currentYear = new Date().getFullYear();

      // *** NUEVO: Radar chart data placeholder (needs actual calculation logic) ***
      // This data should be calculated based on the generated routine
      const radarChartData = {
        labels: ['Fuerza', 'Hipertrofia', 'Movilidad', 'Potencia', 'Técnica', 'Cardio'],
        values: [75, 60, 80, 65, 70, 50] // Example values (0-100 scale)
      };
      // *** FIN NUEVO ***

      // Crear HTML con estilos
      const styledHtml = `<html>
  <head>
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');

    :root {
        --primary-color: #0a2a5e;
        --secondary-color: #2c4b7c;
        --accent-color: #2196f3;
        --routine-color: #1565c0;
        --activation-color: #42a5f5;
        --light-accent: #e3f2fd;
        --light-gray: #f5f7fa;
        --dark-gray: #37474f;
        --medium-gray: #b0bec5;
        --day-color: #e1f5fe;
        --day-text: #01579b;
        --row-even: #f5f9ff;
        --row-odd: #ffffff;
        --border-radius: 8px;
        --box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
        --variant-bg: #fffde7;
        --variant-border: #ffee58;
        --variant-text: #333333;
        --variant-accent: #ffd600;
    }

    body {
        font-family: 'Inter', 'Arial', sans-serif;
        color: var(--dark-gray);
        line-height: 1.6;
        margin: 0;
        padding: 0;
        font-size: 11px;
        position: relative;
        width: 100%;
        background-color: white;
        min-height: 100vh;
        letter-spacing: 0.3px;
    }

    /* *** NUEVO: Styles for Cover Page *** */
    .cover-page {
        width: 100%;
        height: 100vh; /* Use viewport height */
        display: flex;
        flex-direction: column;
        justify-content: center; /* Center vertically */
        align-items: center; /* Center horizontally */
        text-align: center;
        padding: 50px;
        box-sizing: border-box;
        background: linear-gradient(145deg, var(--primary-color) 0%, var(--secondary-color) 100%);
        color: white;
        page-break-after: always; /* Ensure it's on its own page */
        position: relative; /* For absolute positioning of logo */
    }

    .cover-page .logo {
        position: absolute;
        top: 40px; /* Adjust as needed */
        left: 50%;
        transform: translateX(-50%);
        width: 180px; /* Larger logo for cover */
        height: auto;
        filter: brightness(0) invert(1);
    }

    .cover-page h1 {
        font-size: 28px; /* Larger title */
        font-weight: 700;
        margin-top: 100px; /* Space below logo */
        margin-bottom: 15px;
        letter-spacing: 1px;
        color: white;
    }

    .cover-page .client-info {
        font-size: 16px;
        font-weight: 500;
        margin-bottom: 10px;
        color: rgba(255, 255, 255, 0.9);
    }

    .cover-page .date-info {
        font-size: 14px;
        font-weight: 400;
        margin-bottom: 40px; /* Space above chart */
        color: rgba(255, 255, 255, 0.8);
    }

    .radar-chart-container {
        width: 350px; /* Adjust size as needed */
        height: 350px; /* Adjust size as needed */
        background-color: rgba(255, 255, 255, 0.1); /* Subtle background */
        border-radius: 50%; /* Make it circular */
        display: flex;
        justify-content: center;
        align-items: center;
        position: relative;
        border: 1px solid rgba(255, 255, 255, 0.2);
        box-shadow: 0 5px 25px rgba(0, 0, 0, 0.15);
    }

     /* Placeholder text style */
    .radar-chart-placeholder {
        font-size: 14px;
        font-style: italic;
        color: rgba(255, 255, 255, 0.7);
        padding: 20px;
        text-align: center;
        line-height: 1.4;
    }

     /* Styles for the actual chart (if using SVG or Canvas) */
     /* Example: #radarChart { max-width: 100%; max-height: 100%; } */

    .radar-labels {
        position: absolute;
        top: 0; left: 0;
        width: 100%; height: 100%;
        pointer-events: none; /* Allow clicks through */
    }

    .radar-label {
        position: absolute;
        font-size: 10px;
        font-weight: 600;
        color: white;
        background-color: var(--accent-color);
        padding: 2px 6px;
        border-radius: 4px;
        transform: translate(-50%, -50%); /* Center the label on its point */
    }
    /* *** FIN NUEVO *** */


    .header {
        /* Styles unchanged */
        background: linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%);
        padding: 15px 0;
        margin: 0;
        display: flex;
        justify-content: space-between;
        align-items: center;
        color: white;
        border-bottom: 4px solid var(--accent-color);
        width: 100%;
        position: relative;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.12);
    }

    .header-content {display: flex; justify-content: space-between; width: 100%; padding: 0 30px; align-items: center;}

    .header img {
        /* Styles unchanged */
        width: 140px;
        height: auto;
        padding: 6px;
        border-radius: calc(var(--border-radius) + 2px);
        filter: brightness(0) invert(1);
        transition: all 0.3s ease;
    }

    .header .info {
        /* Styles unchanged */
        text-align: right;
        font-size: 13px;
        padding: 8px 18px;
        background-color: rgba(255, 255, 255, 0.18);
        border-radius: var(--border-radius);
        backdrop-filter: blur(10px);
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.08);
        border-left: 3px solid rgba(255, 255, 255, 0.5);
    }

    .header .info p {margin: 5px 0; font-weight: 500; letter-spacing: 0.4px;}
    .header .info strong {font-weight: 600; letter-spacing: 0.5px;}

    .content-wrapper {
        padding: 30px;
        width: 100%;
        box-sizing: border-box;
        padding-bottom: 80px; /* Footer height + space */
        background-color: #ffffff;
        /* Remove min-height from wrapper as body handles it */
    }

    /* Disclaimer styling unchanged */
    .disclaimer-container {
        background-color: transparent;
        border-radius: var(--border-radius);
        padding: 25px 30px;
        margin-bottom: 35px;
        position: relative;
        overflow: hidden;
        border-left: none;
        box-shadow: none;
        page-break-inside: avoid;
        text-align: center;
    }

    .disclaimer-title {
        font-weight: 700;
        color: var(--primary-color);
        font-size: 16px;
        margin-bottom: 20px;
        letter-spacing: 0.8px;
        text-transform: uppercase;
        position: relative;
        padding-left: 0;
        display: inline-block;
    }

    .disclaimer-title::after {
        content: "";
        position: absolute;
        bottom: -5px;
        left: 0;
        width: 100%;
        height: 2px;
        background: linear-gradient(90deg, var(--accent-color) 0%, rgba(33, 150, 243, 0.3) 100%);
        border-radius: 2px;
    }

    .disclaimer-content {
        font-size: 11px;
        color: #000000; /* Changed from var(--dark-gray) to black */
        line-height: 1.7;
        text-align: left; /* Alinear el contenido a la izquierda */
        max-width: 800px; /* Opcional: limitar el ancho máximo */
        margin: 0 auto;
    }

    .disclaimer-content p {
        margin-bottom: 12px;
    }

    .disclaimer-content strong {
        color: var(--primary-color);
        font-weight: 600;
    }

    .disclaimer-content ul {
        padding-left: 20px;
        margin: 15px 0;
        /* Centrado de la lista */
        display: inline-block;
        text-align: left;
    }

    .disclaimer-content li {
        margin-bottom: 8px;
    }

    .disclaimer-footer {
        margin-top: 20px;
        padding-top: 15px;
        border-top: 1px solid #e3e8f0;
        font-style: italic;
        font-size: 10px;
        color: var(--medium-gray);
    }

    /* Table styling unchanged */
     .table-spacer {
        height: 12px;
        width: 100%;
    }

    table + * { /* Prevents unwanted margins after tables */
        margin-top: 0 !important;
        padding-top: 0 !important;
    }


    table {
        width: 100%;
        border-collapse: separate; /* Needed for border-radius */
        border-spacing: 0;
        margin-bottom: 0 !important; /* Tighten spacing */
        font-size: 10px;
        page-break-inside: auto;
        border-radius: var(--border-radius);
        overflow: hidden; /* Clip content to rounded borders */
        box-shadow: var(--box-shadow);
        border: 1px solid #e0e0e0; /* Outline border */
        background-color: white;
        position: relative;
    }

    /* Subtle gradient overlay for right edge */
    table::after {
        content: '';
        position: absolute;
        top: 0;
        right: 0;
        width: 8px;
        height: 100%;
        background: linear-gradient(90deg, rgba(33,150,243,0) 0%, rgba(33,150,243,0.06) 100%);
        pointer-events: none;
        border-top-right-radius: var(--border-radius);
        border-bottom-right-radius: var(--border-radius);
    }

    th, td {
        padding: 12px 14px;
        text-align: left;
        word-wrap: break-word;
        border: none; /* Remove default borders */
        border-bottom: 1px solid #e3e8f0; /* Horizontal separator */
        border-right: 1px solid #e3e8f0; /* Vertical separator */
        position: relative;
        vertical-align: middle;
        transition: background-color 0.2s ease;
    }
    th:last-child, td:last-child { border-right: none; } /* Remove right border on last cell */
    tr:last-child td { border-bottom: none; } /* Remove bottom border on last row */


    .day-title {
        font-size: 18px;
        font-weight: 700;
        color: var(--primary-color);
        margin: 30px 0 20px 0;
        padding-bottom: 10px;
        position: relative;
        letter-spacing: 0.6px;
        padding-left: 15px; /* Indent title */
        max-width: 80%; /* Prevent overly long titles */
        display: inline-block;
        text-transform: uppercase;
    }

    /* Special adjustment for first day title if needed */
    .first-day-title {
        /* No specific margin needed now with cover page */
         margin-top: 0; /* Reset any previous adjustment */
    }

    .day-title::before { display: none; } /* Remove potential pseudo-elements */

    /* Underline effect for day titles */
    .day-title::after {
        content: "";
        position: absolute;
        bottom: 0;
        left: 15px; /* Match padding */
        width: calc(100% - 15px); /* Adjust width */
        height: 2px;
        background: linear-gradient(90deg, var(--accent-color) 0%, rgba(255,255,255,0) 100%);
        border-radius: 1px;
    }

    /* Styling for activation/routine headers within tables */
    .activacion-header td,
    .rutina-header td {
        color: white !important; /* Ensure text is white */
        font-weight: 600;
        text-align: center;
        font-size: 11px;
        padding: 14px 15px;
        letter-spacing: 0.6px;
        position: relative;
        text-transform: uppercase;
    }

    .activacion-header td {
        background-color: var(--activation-color) !important;
        border-bottom: 2px solid #1e88e5; /* Darker shade for border */
    }

    .rutina-header td {
        background-color: var(--routine-color) !important;
        border-bottom: 2px solid #0d47a1; /* Darker shade for border */
    }

    /* Subtle line effect below activation/routine headers */
    .activacion-header td::after,
    .rutina-header td::after {
        content: '';
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        height: 1px;
        background: rgba(255, 255, 255, 0.2);
    }

    /* Table header cells (Exercise, Series, etc.) */
    th:not([colspan]) {
        background-color: var(--secondary-color);
        color: white;
        font-size: 10px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.8px;
        padding: 13px 14px;
        position: relative;
    }

    /* Subtle line effect below table header cells */
    th:not([colspan])::after {
        content: '';
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        height: 1px;
        background: rgba(255, 255, 255, 0.2);
    }

    /* Row striping */
    tr:nth-child(even) td { background-color: var(--row-even); }
    tr:nth-child(odd) td { background-color: var(--row-odd); }

    /* Hover effect for rows */
    td:hover { background-color: rgba(33, 150, 243, 0.07) !important; }

    /* Styling for the first cell (Exercise name) */
    tr td:first-child {
        border-left: none; /* No left border needed */
        font-weight: 500;
        background-color: var(--day-color); /* Specific background */
        color: var(--day-text); /* Specific text color */
        border-right: 2px solid #e3f2fd; /* Slightly stronger separator */
    }

    tr td:last-child { border-right: none; } /* Ensure no right border on last cell */

    /* Apply border radius to corners respecting table structure */
    tr:last-child td:first-child { border-bottom-left-radius: calc(var(--border-radius) - 1px); }
    tr:last-child td:last-child { border-bottom-right-radius: calc(var(--border-radius) - 1px); }
    /* Top radius is handled by overflow:hidden on table */

    /* Header cell spanning columns (usually Day X title, now moved) */
    th[colspan] {
        /* This might still be used if AI generates titles inside tables */
        text-align: center;
        padding: 15px;
        background-color: var(--accent-color);
        color: white;
        font-weight: 600;
        letter-spacing: 0.7px;
        text-transform: uppercase;
        position: relative;
        border-bottom: 2px solid #1976d2;
    }

    th[colspan]::after {
        content: '';
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        height: 1px;
        background: rgba(255, 255, 255, 0.2);
    }

    /* Variants container styling */
    .variants-container, .side-variants-container {
        background-color: white; /* Use var(--variant-bg) for yellowish */
        border-radius: var(--border-radius);
        position: relative;
        overflow: hidden;
        border-left: none; /* Remove potential border */
        box-shadow: none; /* Remove potential shadow */
        page-break-inside: avoid; /* Try to keep variants together */
    }

    .variants-container {
        padding: 15px 25px;
        margin-bottom: 25px;
        margin-top: 5px; /* Space after table */
    }
    .side-variants-container {
        padding: 15px 22px;
        margin-top: 5px; /* Space after table */
        margin-bottom: 25px;
    }
     .variants-container::after, .side-variants-container::after {
         display: none; /* Hide potential pseudo-elements */
    }

    /* Title for the variants section */
    .variants-title, .side-variants-title {
        font-weight: 700;
        color: #333333; /* Use var(--variant-text) for consistency */
        font-size: 14px;
        margin-bottom: 12px;
        letter-spacing: 0.8px;
        text-transform: uppercase;
        position: relative;
        padding-left: 0;
        display: inline-block;
    }

    /* Underline effect for variants title */
    .variants-title::after, .side-variants-title::after {
        content: "";
        position: absolute;
        bottom: -5px;
        left: 0;
        width: 100%;
        height: 2px;
        background: linear-gradient(90deg, var(--variant-accent) 0%, rgba(255, 214, 0, 0.3) 100%);
        border-radius: 2px;
    }


    /* Individual variant item */
    .variant-item, .side-variant-item {
        margin-bottom: 8px;
        padding-bottom: 8px;
        border-bottom: none; /* Remove separator line if not desired */
        position: relative;
    }
    .variant-item:last-child, .side-variant-item:last-child {
        margin-bottom: 0;
        padding-bottom: 0;
        border-bottom: none;
    }

    /* Title within each variant item (e.g., Exercise -> Variant) */
    .variant-title, .side-variant-title {
        font-weight: 600;
        color: #333333;
        font-size: 11px;
        margin-bottom: 7px;
        letter-spacing: 0.4px;
        position: relative;
        padding-left: 12px; /* Indent text */
    }
     .side-variant-title { display: flex; align-items: center; }

    /* Bullet point for variant title */
    .variant-title::before, .side-variant-title::before {
        content: '•';
        position: absolute;
        left: 0;
        top: 0; /* Adjust alignment */
        color: var(--variant-accent);
        font-size: 14px;
        font-weight: bold;
    }

    /* Description text for the variant */
    .variant-description, .side-variant-description {
        font-size: 10px;
        color: #333333; /* Use var(--variant-text) */
        line-height: 1.4;
        padding-left: 12px; /* Match title indent */
    }


    /* Arrow symbol if used */
    .arrow-right {
        color: var(--accent-color);
        margin: 0 5px;
        font-weight: 600;
    }

    /* Page setup */
    @page {
        margin: 0; /* Remove default browser margins */
        size: A4;
    }
    /* Remove top margin on first page, handled by cover/header */
    @page :first { margin-top: 0; }
    /* Subsequent pages might need top margin if header isn't repeated */
    @page :not(:first) {
       /* margin-top: 60px; /* Adjust if header is not repeated per page */
       margin-top: 0; /* Assuming header/footer logic handles spacing */
    }

    /* Container for a full day's content */
    .training-day-container {
        page-break-inside: avoid; /* Try to keep day content together */
        margin-bottom: 35px; /* Space between days */
        position: relative;
    }

    /* Ensure elements within a day container try to stay together */
    .training-day-container table,
    .training-day-container .variants-container,
    .training-day-container .side-variants-container {
        page-break-inside: avoid;
    }

    /* Explicit page break element */
    .page-break {
        page-break-before: always;
        display: block;
        height: 0;
        width: 100%;
    }

    /* Wrapper for content on pages after the first to maintain padding */
    .page-content {
        padding-top: 30px; /* Adjust as needed */
    }


    /* Footer styling */
    .footer {
        position: fixed;
        bottom: 0;
        left: 0;
        width: 100%;
        height: 55px; /* Footer height */
        background: linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%);
        color: white;
        font-size: 10px;
        border-top: 3px solid var(--accent-color);
        display: flex;
        justify-content: space-between;
        align-items: center;
        z-index: 1000; /* Ensure it's above content */
        box-shadow: 0 -4px 15px rgba(0, 0, 0, 0.1);
    }

    .footer-left, .footer-center, .footer-right {
        flex: 1;
        padding: 0 25px;
    }

    .footer-left {
        text-align: left;
        display: flex;
        align-items: center;
    }

    .footer-left img { /* Logo in footer */
        height: 15px;
        width: auto;
        filter: brightness(0) invert(1);
    }

    .footer-center { text-align: center; }
    .footer-right { text-align: right; font-weight: 400; letter-spacing: 0.5px; }

    /* Spacer to prevent content from overlapping footer */
    .content-spacer { height: 60px; width: 100%; }


    /* Loading message animation */
    @keyframes pulse {
        0% { opacity: 0.6; }
        50% { opacity: 1; }
        100% { opacity: 0.6; }
    }

    .loading-message {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background-color: rgba(255, 255, 255, 0.9);
        padding: 20px 30px;
        border-radius: var(--border-radius);
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
        z-index: 9999;
        animation: pulse 2s infinite ease-in-out;
        text-align: center;
        font-weight: 500;
    }
    </style>
  </head>
  <body>
    <div class="cover-page">
      <img src="${logoBase64}" alt="Logo" class="logo" />
      <h1>Plan de Entrenamiento Personalizado</h1>
      <div class="client-info">${clientName}</div>
      <div class="date-info">Generado el ${creationDate}</div>
      <div class="radar-chart-container">
        <canvas id="radarChart" width="300" height="300"></canvas>
        <div class="radar-chart-placeholder" style="display: none;">Radar Chart Placeholder</div>
         <div class="radar-labels"></div>
      </div>
    </div>
    <div class="header">
      <div class="header-content">
        <img src="${logoBase64}" alt="Logo" />
        <div class="info">
          <p><strong>Cliente:</strong> ${clientName}</p>
          <p><strong>Fecha:</strong> ${creationDate}</p>
        </div>
      </div>
    </div>

    <div class="content-wrapper">
      <div class="disclaimer-container">
        <div class="disclaimer-title">INFORMACIÓN IMPORTANTE</div>
        <div class="disclaimer-content">
           <p>Este programa de entrenamiento ha sido diseñado específicamente para ti a través del formulario que has respondido. Para maximizar tus resultados y garantizar tu seguridad, lee atentamente las siguientes recomendaciones:</p>
           <p><strong>Consulta médica:</strong> Antes de comenzar cualquier programa de ejercicio, especialmente si tiene condiciones médicas preexistentes, se recomienda consultar con un profesional de la salud.</p>
           <p><strong>Interpretación del programa:</strong> Este documento utiliza un sistema de colores para facilitar la comprensión:</p>
           <ul>
             <li><strong>Azul claro:</strong> Indica los ejercicios de activación, diseñados para preparar el cuerpo para el entrenamiento.</li>
             <li><strong>Azul oscuro:</strong> Señala los ejercicios principales que conforman su rutina.</li>
             <li><strong>Amarillo:</strong> Muestra variantes o alternativas para adaptar los ejercicios según sea necesario.</li>
           </ul>
           <p><strong>Progresión gradual:</strong> Comienza con intensidades moderadas y aumenta gradualmente según tu adaptación. Respeta los descansos indicados y las series recomendadas.</p>
           <p><strong>Técnica correcta:</strong> Prioriza siempre la ejecución adecuada de los movimientos sobre el peso o la intensidad. En caso de duda, consulta con un entrenador.</p>
           <p><strong>Escucha a tu cuerpo:</strong> Si experimentas dolor (distinto a la incomodidad normal del ejercicio), mareos o dificultad para respirar, detén el entrenamiento y ves al médico.</p>
           <div class="disclaimer-footer">
             Este programa es propiedad intelectual de Fitform y está destinado únicamente para uso personal del cliente. Queda prohibida su reproducción o distribución sin autorización.
           </div>
        </div>
      </div>

      <div class="content">${modifiedHtml}</div>

      <div class="content-spacer"></div>
    </div>

    <div class="footer">
      <div class="footer-left"><img src="${logoBase64}" alt="Logo" /></div>
      <div class="footer-center">Rutina Personalizada</div>
      <div class="footer-right">© ${currentYear} FitForm. Todos los derechos reservados</div>
    </div>

     <script>
     function drawRadarPlaceholder() {
        const canvas = document.getElementById('radarChart');
        const placeholderDiv = document.querySelector('.radar-chart-placeholder');
        const labelsContainer = document.querySelector('.radar-labels');
        const data = ${JSON.stringify(radarChartData)}; // Inject data

        if (!canvas || !data || !data.labels || !data.values || !labelsContainer) {
            if(placeholderDiv) placeholderDiv.style.display = 'block'; // Show text placeholder if canvas fails
            console.error('Radar chart elements or data missing.');
            return;
        }

        const ctx = canvas.getContext('2d');
        if (!ctx) {
             if(placeholderDiv) placeholderDiv.style.display = 'block';
             console.error('Could not get 2D context for radar chart.');
             return;
        }

        // Basic drawing (replace with actual chart library logic)
        const width = canvas.width;
        const height = canvas.height;
        const centerX = width / 2;
        const centerY = height / 2;
        const radius = Math.min(centerX, centerY) * 0.75; // Chart radius
        const numAxes = data.labels.length;
        const angleStep = (2 * Math.PI) / numAxes;

        ctx.clearRect(0, 0, width, height);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1;
        ctx.fillStyle = 'rgba(33, 150, 243, 0.3)'; // Fill color for data shape

        // Draw grid lines (simplified hexagons)
        for (let i = 1; i <= 5; i++) { // 5 levels
            const levelRadius = radius * (i / 5);
            ctx.beginPath();
            for (let j = 0; j < numAxes; j++) {
                const angle = j * angleStep - Math.PI / 2; // Start at top
                const x = centerX + levelRadius * Math.cos(angle);
                const y = centerY + levelRadius * Math.sin(angle);
                if (j === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.stroke();
        }

        // Draw axes lines
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
         for (let j = 0; j < numAxes; j++) {
             const angle = j * angleStep - Math.PI / 2;
             const x = centerX + radius * Math.cos(angle);
             const y = centerY + radius * Math.sin(angle);
             ctx.beginPath();
             ctx.moveTo(centerX, centerY);
             ctx.lineTo(x, y);
             ctx.stroke();
         }

         // Draw data shape
         ctx.beginPath();
         data.values.forEach((value, index) => {
             const valueRatio = Math.max(0, Math.min(1, value / 100)); // Clamp 0-1
             const angle = index * angleStep - Math.PI / 2;
             const x = centerX + radius * valueRatio * Math.cos(angle);
             const y = centerY + radius * valueRatio * Math.sin(angle);
             if (index === 0) ctx.moveTo(x, y);
             else ctx.lineTo(x, y);
         });
         ctx.closePath();
         ctx.fill(); // Fill the shape
         ctx.strokeStyle = 'rgba(33, 150, 243, 0.8)'; // Border color
         ctx.lineWidth = 2;
         ctx.stroke(); // Draw the border

        // Position labels HTML (relative to the container)
        labelsContainer.innerHTML = ''; // Clear previous labels
        const labelRadius = radius * 1.15; // Position labels slightly outside the main radius
        data.labels.forEach((label, index) => {
            const angle = index * angleStep - Math.PI / 2;
            const labelX = centerX + labelRadius * Math.cos(angle);
            const labelY = centerY + labelRadius * Math.sin(angle);

            const labelEl = document.createElement('div');
            labelEl.className = 'radar-label';
            labelEl.textContent = label;
            labelEl.style.left = \`\${labelX}px\`;
            labelEl.style.top = \`\${labelY}px\`;
            labelsContainer.appendChild(labelEl);
        });
     }
     // Attempt to draw when content is loaded
     // Note: In Puppeteer, this runs *after* initial render,
     // so it might flash or not appear if PDF generation is too fast.
     // A better approach is server-side chart generation or injecting Chart.js.
     window.addEventListener('load', drawRadarPlaceholder);
     // Also call directly in case 'load' event is missed or too late for Puppeteer
     try { drawRadarPlaceholder(); } catch(e) { console.error("Direct draw failed:", e); }
     </script>
     </body>
</html>`;

      // Lanzar navegador con opciones optimizadas
      const browser = await puppeteer.launch({
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
           "--font-render-hinting=none" // May improve font rendering in some environments
        ]
      });

      const page = await browser.newPage();

      // Configurar viewport para A4 (approx pixels)
      // Using common A4 pixel dimensions at 96 DPI
      await page.setViewport({
        width: 794,
        height: 1123,
        deviceScaleFactor: 1 // Use 1 for consistency, higher values for higher res PDF (but larger file size)
      });

      // Set content - wait until network idle to ensure fonts etc. load
      await page.setContent(styledHtml, { waitUntil: "networkidle0" });

       // Give fonts and scripts a bit more time to settle if needed
       await new Promise(resolve => setTimeout(resolve, 100)); // e.g., 100ms wait


      // --- PDF Generation Options ---
      const pdfOptions = {
        path: filePath,
        format: 'A4',
        margin: { top: '0', right: '0', bottom: '0', left: '0' }, // Margins handled by HTML/CSS
        printBackground: true, // Crucial for background colors/gradients
        preferCSSPageSize: true, // Use @page size defined in CSS
        timeout: 90000 // Increased timeout (90 seconds) for potentially complex pages
      };

      // Evaluate page structure and adjust layout (original logic retained)
       await page.evaluate(() => {
           // Helper function to check if an element is visible
           const isElementVisible = (el) => {
               if (!el) return false;
               const style = window.getComputedStyle(el);
               return style.display !== 'none' && style.visibility !== 'hidden' && parseFloat(style.opacity) > 0;
           };

           // Helper function to get element height
            const getElementHeight = (el) => {
                if (!el || !isElementVisible(el)) return 0;
                // Use scrollHeight for potentially overflowing content, or offsetHeight for visible box
                 return el.offsetHeight;
            };


           // Group content by day including tables and variants
            const dayTitles = document.querySelectorAll('.day-title');
            dayTitles.forEach((title, index) => {
                const dayContainer = document.createElement('div');
                dayContainer.className = 'training-day-container';

                 // Add day number data attribute if possible
                 const dayMatch = title.textContent.match(/Día\s*(\d+)/i);
                 if (dayMatch) dayContainer.dataset.dayNumber = dayMatch[1];

                // Insert container before the title and move title into it
                title.parentNode.insertBefore(dayContainer, title);
                dayContainer.appendChild(title);

                // Move subsequent tables and variant blocks into this container
                let currentElement = dayContainer.nextElementSibling;
                while (currentElement && (currentElement.tagName === 'TABLE' || currentElement.classList.contains('variants-container') || currentElement.classList.contains('side-variants-container') || currentElement.classList.contains('table-spacer'))) {
                    const next = currentElement.nextElementSibling; // Store next before moving
                    dayContainer.appendChild(currentElement);
                    currentElement = next;
                }

                // Remove empty spacers that might be left inside
                dayContainer.querySelectorAll('.table-spacer').forEach(spacer => {
                     if (!spacer.previousElementSibling || !spacer.nextElementSibling || spacer.previousElementSibling.tagName !== 'TABLE' || spacer.nextElementSibling.tagName !== 'TABLE') {
                          spacer.remove();
                     }
                });

                 // Add page break before day containers (except the first one)
                 // This logic is now less critical due to cover page, but keep for structure
                 if (index > 0) {
                     const pageBreak = document.createElement('div');
                     pageBreak.className = 'page-break';
                     dayContainer.parentNode.insertBefore(pageBreak, dayContainer);

                     // Add wrapper for consistent padding on new pages
                     const pageContent = document.createElement('div');
                     pageContent.className = 'page-content'; // Uses CSS for padding
                     dayContainer.parentNode.insertBefore(pageContent, dayContainer);
                     pageContent.appendChild(dayContainer); // Move day container inside padded wrapper
                 }
            });

             // Rename variant titles for clarity
            document.querySelectorAll('.variants-container .variants-title, .side-variants-container .side-variants-title').forEach(title => {
                // Check if it's the main title of the variant section, not the item title
                if (title.parentElement.classList.contains('variants-container') || title.parentElement.classList.contains('side-variants-container')) {
                    title.textContent = "VARIANTES Y PROGRESIONES";
                }
            });

            // Final check for orphan elements (unlikely now but safe)
            document.querySelectorAll('body > table, body > .variants-container, body > .side-variants-container').forEach(orphan => {
                 if (!orphan.closest('.training-day-container') && !orphan.closest('.cover-page') && !orphan.closest('.header') && !orphan.closest('.footer')) {
                     console.warn('Orphan element found, appending to last day:', orphan);
                     const lastDay = document.querySelector('.training-day-container:last-of-type');
                     if(lastDay) lastDay.appendChild(orphan);
                 }
            });
       });
       // --- End Page Evaluation ---

      // Generate PDF
      const pdfBuffer = await page.pdf(pdfOptions);

      await browser.close();
      console.log("PDF generado correctamente en:", filePath);
      resolve(filePath);
    } catch (error) {
        console.error("Error en generatePDF:", error);
        reject(error); // Rechaza la promesa si hay un error grave
      } finally {
        // --- *** NUEVO: Limpiar archivo de gráfico temporal *** ---
        if (chartImagePath) {
          try {
            await fs.unlink(chartImagePath); // Usar fs.promises.unlink
            console.log(`Temporary chart file deleted: ${chartImagePath}`);
          } catch (unlinkError) {
            // Loggear error pero no rechazar la promesa principal por esto
            console.error(`Error deleting temporary chart file ${chartImagePath}:`, unlinkError);
          }
        }
        // --- *** FIN NUEVO *** ---
      }
    });
  }

module.exports = { generatePDF };