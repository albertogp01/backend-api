const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");
const os = require("os");
const { createFullPdfHtml } = require('./services/chartService'); // Ajusta la ruta y el nombre si es necesario

async function generatePDF(htmlContent, clientName = "Cliente") {
  return new Promise(async (resolve, reject) => {
    try {
      console.log("Generando PDF para:", clientName);
      const sanitizedName = clientName.replace(/[^a-zA-Z0-9]/g, "_");
      const fileName = `rutina_${sanitizedName}_${Date.now()}.pdf`;
      
      // Usar el directorio temporal del sistema operativo
      const tempDir = os.tmpdir();
      const filePath = path.join(tempDir, fileName);
      
      console.log(`Usando directorio temporal: ${tempDir}`);
      
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
      
      // Generate radar chart cover page
      const { coverPageHtml, styles: chartStyles, script: chartScript, scores } = createRadarChartCoverPage(
        htmlContent, 
        clientName, 
        logoBase64
      );
      
      const currentYear = new Date().getFullYear();
      
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
    
    .header {
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
        width: 140px;
        height: auto;
        padding: 6px;
        border-radius: calc(var(--border-radius) + 2px);
        filter: brightness(0) invert(1);
        transition: all 0.3s ease;
    }
    
    .header .info {
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
        padding-bottom: 80px;
        background-color: #ffffff;
    }
    
    /* Estilos para el disclaimer - CENTRADO Y TEXTO NEGRO */
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
        color: #000000;
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
    
    .table-spacer {
        height: 12px;
        width: 100%;
    }
    
    table + * {
    margin: 0 !important;
    padding: 0 !important;
    display: block;
    height: 0 !important;
    }

    table {
        width: 100%;
        border-collapse: separate;
        border-spacing: 0;
        margin-bottom: 0 !important;
        font-size: 10px;
        page-break-inside: auto;
        border-radius: var(--border-radius);
        overflow: hidden;
        box-shadow: var(--box-shadow);
        border: 1px solid #e0e0e0;
        background-color: white;
        position: relative;
    }
    
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
        border: none;
        border-bottom: 1px solid #e3e8f0;
        border-right: 1px solid #e3e8f0;
        position: relative;
        vertical-align: middle;
        transition: background-color 0.2s ease;
    }
    
    th:last-child, td:last-child {border-right: none;}
    tr:last-child td {border-bottom: none;}
    
    .day-title {
        font-size: 18px;
        font-weight: 700;
        color: var(--primary-color);
        margin: 30px 0 20px 0;
        padding-bottom: 10px;
        position: relative;
        letter-spacing: 0.6px;
        padding-left: 15px;
        max-width: 80%;
        display: inline-block;
        text-transform: uppercase;
    }
    
    /* Ajuste especial para el primer día */
    .first-day-title {
        margin-top: 50px; /* Aumentar el margen superior solo para el primer día */
    }
    
    .day-title::before {display: none;}
    
    .day-title::after {
        content: "";
        position: absolute;
        bottom: 0;
        left: 15px;
        width: calc(100% - 15px);
        height: 2px;
        background: linear-gradient(90deg, var(--accent-color) 0%, rgba(255,255,255,0) 100%);
        border-radius: 1px;
    }
    
    .activacion-header td,
    .rutina-header td {
        color: white !important;
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
        border-bottom: 2px solid #1e88e5;
    }
    
    .rutina-header td {
        background-color: var(--routine-color) !important;
        border-bottom: 2px solid #0d47a1;
    }
    
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
    
    th:not([colspan])::after {
        content: '';
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        height: 1px;
        background: rgba(255, 255, 255, 0.2);
    }
    
    tr:nth-child(even) td {background-color: var(--row-even);}
    tr:nth-child(odd) td {background-color: var(--row-odd);}
    
    td:hover {background-color: rgba(33, 150, 243, 0.07) !important;}
    
    tr td:first-child {
        border-left: none;
        font-weight: 500;
        background-color: var(--day-color);
        color: var(--day-text);
        border-right: 2px solid #e3f2fd;
    }
    
    tr td:last-child {border-right: none;}
    
    tr:last-child td:first-child {border-bottom-left-radius: calc(var(--border-radius) - 1px);}
    tr:last-child td:last-child {border-bottom-right-radius: calc(var(--border-radius) - 1px);}
    tr:first-child td:first-child:not(th) {border-top-left-radius: calc(var(--border-radius) - 1px);}
    tr:first-child td:last-child:not(th) {border-top-right-radius: calc(var(--border-radius) - 1px);}
    
    th[colspan] {
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
    
    .variants-container, .side-variants-container {
        background-color: white;
        border-radius: var(--border-radius);
        position: relative;
        overflow: hidden;
        border-left: none;
        box-shadow: none;
        page-break-inside: avoid;
    }
    
    .variants-container {
        padding: 15px 25px;
        margin-bottom: 25px;
        margin-top: 5px;
    }
    
    .side-variants-container {
        padding: 15px 22px;
        margin-top: 5px;
        margin-bottom: 25px;
    }
    
    .variants-container::after, .side-variants-container::after {
         display: none;
    }

    .variants-title, .side-variants-title {
        font-weight: 700;
        color: #333333;
        font-size: 14px;
        margin-bottom: 12px;
        letter-spacing: 0.8px;
        text-transform: uppercase;
        position: relative;
        padding-left: 0;
        display: inline-block;
    }
    
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
    
    

    .variant-item, .side-variant-item {
        margin-bottom: 8px;
        padding-bottom: 8px;
        border-bottom: none;
        position: relative;
    }

    .variant-item:last-child, .side-variant-item:last-child {
        margin-bottom: 0;
        padding-bottom: 0;
        border-bottom: none;
    }

    .variant-title, .side-variant-title {
        font-weight: 600;
        color: #333333;
        font-size: 11px;
        margin-bottom: 7px;
        letter-spacing: 0.4px;
        position: relative;
        padding-left: 12px;
    }
    
    .side-variant-title {display: flex; align-items: center;}
    
    .variant-title::before, .side-variant-title::before {
        content: '•';
        position: absolute;
        left: 0;
        top: 0;
        color: var(--variant-accent);
        font-size: 14px;
        font-weight: bold;
    }

    .variant-description, .side-variant-description {
        font-size: 10px;
        color: #333333;
        line-height: 1.4;
        padding-left: 12px;
    }

    .arrow-right {
        color: var(--accent-color);
        margin: 0 5px;
        font-weight: 600;
    }
    
    @page {
        margin: 0;
        size: A4;
    }
    
    @page :first {
        margin-top: 0;
    }
    
    @page :not(:first) {
        margin-top: 0;
    }
    
    .training-day-container {
        page-break-inside: avoid;
        margin-bottom: 35px;
        position: relative;
    }
    
    /* Asegurar que los elementos dentro de un contenedor queden juntos */
    .training-day-container table,
    .training-day-container .variants-container,
    .training-day-container .side-variants-container {
        page-break-inside: avoid;
    }
    
    /* Elemento con margen superior para saltos de página */
    .page-break-spacer {
        height: 50px;
        width: 100%;
        display: block;
    }
    
    .footer {
        position: fixed;
        bottom: 0;
        left: 0;
        width: 100%;
        height: 55px;
        background: linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%);
        color: white;
        font-size: 10px;
        border-top: 3px solid var(--accent-color);
        display: flex;
        justify-content: space-between;
        align-items: center;
        z-index: 1000;
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
    
    .footer-left img {
        height: 15px;
        width: auto;
        filter: brightness(0) invert(1);
    }
    
    .footer-left::before {display: none;}
    .footer-center {text-align: center;}
    .footer-right {text-align: right; font-weight: 400; letter-spacing: 0.5px;}
    
    .content-spacer {height: 60px; width: 100%;}
    .page-break {
        page-break-before: always;
        display: block;
        height: 0;
        width: 100%;
    }
    
    /* Clase para preservar los márgenes en los saltos de página */
    .page-content {
        padding-top: 50px;
    }
    
    @keyframes pulse {
        0% {opacity: 0.6;}
        50% {opacity: 1;}
        100% {opacity: 0.6;}
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
     </style>
     // <-- ESTA LÍNEA SE HA ELIMINADO/COMENTADO
     ${chartScript} // Se mantiene esta línea, ya que chartScript ahora incluye la carga de Chart.js y el código de inicialización
   </head>
   <body>
     ${coverPageHtml}
     <div class="page-break"></div>
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
      <!-- Nuevo elemento de disclaimer -->
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
      <div class="footer-center"></div>
      <div class="footer-right">© ${currentYear} Todos los derechos reservados</div>
    </div>
  </body>
</html>`;

      // Lanzar navegador con opciones optimizadas para entornos sin interfaz gráfica
      const browser = await puppeteer.launch({
        headless: true, // Usar true en lugar de "new" para mayor compatibilidad
        args: [
          "--no-sandbox", 
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu"
        ]
      });

      const page = await browser.newPage();
      
      // Configurar viewport para A4
      await page.setViewport({
        width: 794,
        height: 1123,
        deviceScaleFactor: 1
      });
      
      // Mostrar mensaje de carga
      await page.setContent('<div class="loading-message">Generando rutina de entrenamiento...</div>', {
        waitUntil: "networkidle0"
      });
      
      await page.setContent(styledHtml, { waitUntil: "networkidle0" });
      
      // Script para organizar días y variantes - MEJORADO
      await page.evaluate(() => {
        // Primero, asegurarnos de que todos los elementos de variante tengan un ID para facilitar su manipulación
        document.querySelectorAll('.variants-container, .side-variants-container').forEach((variant, idx) => {
          variant.id = 'variant-' + idx;
          
          // Extraer el número del día al que pertenece esta variante
          const dayMatch = variant.innerHTML.match(/Día\s+(\d+)/i);
          if (dayMatch) {
            variant.dataset.dayNumber = dayMatch[1];
          }
        });
        
        // Organizar días y variantes en contenedores
        const dayTitles = document.querySelectorAll('.day-title');
        
        dayTitles.forEach((title, index) => {
          const dayContainer = document.createElement('div');
          dayContainer.className = 'training-day-container';
          
          // Extraer el número de día del título
          const dayNumberMatch = title.textContent.match(/Día\s+(\d+)/i);
          if (dayNumberMatch) {
            dayContainer.dataset.dayNumber = dayNumberMatch[1];
          }
          
          title.parentNode.insertBefore(dayContainer, title);
          dayContainer.appendChild(title);
          
          let nextElement = dayContainer.nextElementSibling;
          while (nextElement && (nextElement.tagName === 'TABLE' || nextElement.classList.contains('table-spacer'))) {
            const currentElement = nextElement;
            nextElement = nextElement.nextElementSibling;
            dayContainer.appendChild(currentElement);
          }
          
          // Solo añadir salto de página para días posteriores al primer día
          if (index > 0) {
            const pageBreak = document.createElement('div');
            pageBreak.className = 'page-break';
            
            // Añadir un wrapper para contener el día y mantener márgenes consistentes
            const pageContent = document.createElement('div');
            pageContent.className = 'page-content';
            pageContent.style.paddingTop = '50px'; // Padding-top constante para mantener márgenes consistentes
            
            // Envolver el dayContainer en pageContent para mantener márgenes consistentes
            dayContainer.parentNode.insertBefore(pageBreak, dayContainer);
            dayContainer.parentNode.insertBefore(pageContent, dayContainer);
            pageContent.appendChild(dayContainer);
          }
        });
        
        // Cambiar título de variantes principales
        document.querySelectorAll('.variants-container').forEach(container => {
          const titleEl = container.querySelector('.variants-title');
          if (titleEl) titleEl.textContent = "VARIANTES";
        });
        
        // MEJORA: Función para comprobar si una variante es pequeña (pocos items)
        function isSmallVariant(variant) {
          const items = variant.querySelectorAll('.variant-item, .side-variant-item');
          return items.length <= 3;
        }
        
        // MEJORA: Función para calcular el espacio disponible después de un elemento
        function getAvailableSpace(element) {
          if (!element) return 0;
          
          const rect = element.getBoundingClientRect();
          const viewportHeight = window.innerHeight;
          const footerHeight = 55;
          
          return viewportHeight - rect.bottom - footerHeight;
        }
        
        // MEJORA: Función para determinar si un elemento está cerca del footer
        function isNearFooter(element, safetyMargin = 90) { // Reducido de 120px a 90px
          if (!element) return false;
          
          const rect = element.getBoundingClientRect();
          const viewportHeight = window.innerHeight;
          const footerThreshold = viewportHeight - safetyMargin;
          return rect.bottom > footerThreshold;
        }
        
        // MEJORADO: Algoritmo para mover variantes a sus contenedores de día
        document.querySelectorAll('.training-day-container').forEach(dayContainer => {
          const dayNumber = dayContainer.dataset.dayNumber;
          if (!dayNumber) return;
          
          // Encontrar todas las variantes que pertenecen a este día
          document.querySelectorAll('.variants-container, .side-variants-container').forEach(variant => {
            const titleEl = variant.querySelector('.variants-title, .side-variants-title');
            if (titleEl) titleEl.textContent = "VARIANTES";
            
            const variantDayMatch = variant.innerHTML.match(/Día\s+(\d+)/i);
            if (variantDayMatch && variantDayMatch[1] === dayNumber) {
              // Esta variante pertenece a este día
              
              // Obtener la última tabla del día
              const tables = dayContainer.querySelectorAll('table');
              if (tables.length === 0) return;
              
              const lastTable = tables[tables.length - 1];
              
              // Eliminar cualquier espaciador existente después de la tabla
              if (lastTable.nextElementSibling && lastTable.nextElementSibling.className === 'table-spacer') {
                lastTable.nextElementSibling.remove();
              }
              
              // Crear un espaciador personalizado más pequeño
              const smallSpacer = document.createElement('div');
              smallSpacer.style.height = '8px'; // Espaciador reducido
              lastTable.after(smallSpacer);
              
              // Verificar si podemos mantener la variante en la misma página
              const isSmall = isSmallVariant(variant);
              const availableSpace = getAvailableSpace(lastTable);
              const variantHeight = isSmall ? 100 : 200; // Estimación aproximada
              
              if (isSmall && availableSpace > variantHeight) {
                // Variante pequeña y hay espacio, mantenerla en la misma página
                smallSpacer.after(variant);
              } else if (isNearFooter(lastTable)) {
                // No hay suficiente espacio, crear salto de página
                const pageBreak = document.createElement('div');
                pageBreak.className = 'page-break';
                
                const pageContent = document.createElement('div');
                pageContent.className = 'page-content';
                pageContent.style.paddingTop = '50px';
                
                dayContainer.appendChild(pageBreak);
                dayContainer.appendChild(pageContent);
                pageContent.appendChild(variant);
              } else {
                // Hay espacio pero la variante es grande, mantenerla en la misma página
                smallSpacer.after(variant);
              }
            }
          });
        });
        
        // Optimizar la colocación de variantes sin crear saltos innecesarios
        document.querySelectorAll('.training-day-container').forEach(container => {
          // Obtener la última tabla en el contenedor del día
          const tables = container.querySelectorAll('table');
          if (tables.length === 0) return;
          
          const lastTable = tables[tables.length - 1];
          
          // Obtener todas las variantes en este contenedor de día
          const variants = container.querySelectorAll('.variants-container, .side-variants-container');
          
          if (variants.length > 0) {
            // Mover todas las variantes después de la última tabla
            variants.forEach(variant => {
              // Eliminar cualquier salto de página existente antes de la variante
              if (variant.previousElementSibling && variant.previousElementSibling.classList.contains('page-break')) {
                variant.previousElementSibling.remove();
              }
              
              // Calcular el espacio disponible después de la última tabla
              const availableSpace = getAvailableSpace(lastTable);
              const variantHeight = variant.getBoundingClientRect().height;
              
              // Crear un salto de página solo si realmente no hay suficiente espacio
              if (variantHeight > availableSpace && isNearFooter(lastTable, 90)) {
                // Crear salto de página antes de la variante
                const pageBreak = document.createElement('div');
                pageBreak.className = 'page-break';
                
                // Crear un contenedor con margen para la variante
                const pageContent = document.createElement('div');
                pageContent.className = 'page-content';
                
                // Insertar los elementos en el orden correcto
                container.insertBefore(pageBreak, variant);
                container.insertBefore(pageContent, variant);
                pageContent.appendChild(variant);
              }
            });
          }
        });
        
        // Eliminar cualquier salto de página innecesario
        document.querySelectorAll('.page-break').forEach(pageBreak => {
          const nextElement = pageBreak.nextElementSibling;
          if (!nextElement || nextElement.classList.contains('page-break')) {
            pageBreak.remove();
          }
        });
        
        // Asegurar que haya espacio suficiente al final de cada día para evitar solapamiento con el footer
        document.querySelectorAll('.training-day-container').forEach(container => {
          const spacer = document.createElement('div');
          spacer.className = 'content-spacer';
          spacer.style.height = '60px'; // Espacio suficiente para evitar el footer
          container.appendChild(spacer);
        });
      });

      // Generar PDF
      const pdfBuffer = await page.pdf({
        path: filePath,
        format: 'A4',
        margin: { top: '0', right: '0', bottom: '0', left: '0' },
        printBackground: true,
        preferCSSPageSize: true,
        timeout: 60000 // Aumentar timeout a 60 segundos para archivos grandes
      });

      await browser.close();
      console.log("PDF generado correctamente en:", filePath);
      resolve(filePath);
    } catch (error) {
      console.error("Error en generatePDF:", error);
      reject(error);
    }
  });
}

module.exports = { generatePDF };