// Modified version of the relevant parts of pdfService.js

const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");
const os = require("os");

// Importar la función principal de chartService.js
const { createCoverPage } = require('./chartService');

async function generatePDF(htmlContent, clientName = "Cliente", tempDir = "", requestId = "") {
  return new Promise(async (resolve, reject) => {
    let browser = null;  // Declare browser at the outer scope so it's accessible in the finally block
    
    try {
      console.log("Generando PDF para:", clientName);
      const sanitizedName = clientName.replace(/[^a-zA-Z0-9]/g, "_");
      const fileName = `rutina_${sanitizedName}_${Date.now()}.pdf`;
     
      // Usar el directorio temporal del sistema operativo si no se proporciona uno
      if (!tempDir) {
        tempDir = os.tmpdir();
      }
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
     
      // Mantener tu lógica de procesamiento para el contenido de la rutina
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
      const creationDate = new Date().toLocaleDateString("es-ES", {
        year: "numeric", month: "long", day: "numeric"
      });
     
      // --- Generar HTML de la Portada Dinámica ---
      console.log("Generando HTML de la portada...");
      // Utilizar el nombre correcto de la función y manejar su retorno correctamente
      console.log(`[DEBUG PDF] Llamando a createCoverPage con clientName: ${clientName}, htmlContent length: ${htmlContent?.length || 0}, logoBase64 disponible: ${!!logoBase64}`);
      const { coverPageHtml, styles, script, scores } = createCoverPage(htmlContent, clientName, logoBase64);
      
      // Combinar los componentes en un solo string HTML
      const coverPageHtmlString = `
        <style>${styles}</style>
        ${coverPageHtml}
        ${script}
      `;

      // --- Ensamblar el HTML COMPLETO para TODO el PDF ---
      const fullPdfHtml = `
${coverPageHtmlString}

<div style="page-break-before: always;"></div>

<!DOCTYPE html> <html lang="es">
<head>
<meta charset="UTF-8">
<title>Rutina - ${clientName}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<style>
/* --- ESTILOS SOLO PARA LAS PÁGINAS DE LA RUTINA --- */
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
    -webkit-print-color-adjust: exact; /* Importante para Puppeteer */
    print-color-adjust: exact;
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
</style>
</head>
<body>
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
      browser = await puppeteer.launch({
        headless: true, // Usar true en lugar de "new" para mayor compatibilidad
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
          "--js-flags=--max-old-space-size=2048", // Aumentar memoria disponible
          "--disable-web-security"                // Evitar problemas CORS
        ]
      });

      const page = await browser.newPage();
     
      // Configurar viewport para A4
      await page.setViewport({
        width: 794,
        height: 1123,
        deviceScaleFactor: 1
      });
     
      // +++ BLOQUE NUEVO RECOMENDADO (REEMPLAZO) +++

      // *** PASO CLAVE: Cargar contenido y ESPERAR ***
      console.log("Estableciendo contenido y esperando...");
      // Carga TODO el HTML (portada + rutina + estilos + scripts) de una vez
      // y espera a que la red se calme (importante para CDN de Chart.js y logo)
      await page.setContent(fullPdfHtml, {
          waitUntil: 'networkidle0', // Espera a que la red se calme
          timeout: 90000 // Timeout generoso
      });

      // Opcional: Añadir una pequeña espera fija adicional si 'networkidle0'
      // a veces no es suficiente para que el gráfico termine de animarse/renderizarse.
      // await page.waitForTimeout(1000); // Ejemplo: 1 segundo extra

      // Opcional: Esperar a que el elemento del gráfico exista y sea visible
      // try {
      //     await page.waitForSelector('#radarChart', { visible: true, timeout: 10000 });
      //     console.log("Canvas del gráfico radar encontrado y visible.");
      // } catch (waitError) {
      //     console.warn("No se pudo encontrar el canvas del gráfico radar o no era visible:", waitError.message);
      //     // Puedes decidir si continuar o fallar aquí
      // }


      // --- Generar PDF ---
      console.log("Generando PDF...");
      // Ahora la llamada a page.pdf() ocurre DESPUÉS de que la página
      // (incluyendo scripts y estilos) ha tenido tiempo de cargarse y ejecutarse.
      const pdfBuffer = await page.pdf({
          path: filePath,
          format: 'A4',
          margin: { top: '0', right: '0', bottom: '0', left: '0' },
          printBackground: true,
          preferCSSPageSize: true, // Usa el @page size del CSS si está definido
          timeout: 90000
      });

      console.log("PDF generado correctamente en:", filePath);
      await browser.close(); // Cierra el navegador DESPUÉS de generar el PDF
      console.log("Navegador cerrado correctamente");
      resolve(filePath); // Resuelve la promesa con la ruta del archivo

// +++ FIN DEL BLOQUE NUEVO RECOMENDADO +++
    } catch (error) {
      console.error("Error en generatePDF:", error);
      if (browser) {
        try {
          await browser.close();
          console.log("Navegador cerrado después de error general");
        } catch (closeError) {
          console.error("Error al cerrar el navegador:", closeError.message);
        }
      }
      reject(error);
    }
  });
}

module.exports = { generatePDF };