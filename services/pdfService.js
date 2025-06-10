// pdfService.js (Actualizado con Esperas para Gráficos y Footer Modificado)

const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");
const os = require("os");
const { PDFDocument } = require('pdf-lib'); // Asegúrate de tener: npm install pdf-lib

// Importar la función principal de chartService.js
const { createCoverPage } = require('./chartService'); // Asegúrate que la ruta es correcta

/**
 * Genera un archivo PDF a partir de contenido HTML, incluyendo una portada dinámica.
 * @param {string} htmlContent - El contenido HTML principal de la rutina.
 * @param {string} [clientName="Cliente"] - El nombre del cliente.
 * @param {string} [tempDir=""] - Directorio temporal para guardar el PDF. Si está vacío, usa el directorio temporal del sistema.
 * @param {string} [requestId=""] - Un ID opcional para seguimiento (no usado actualmente en la lógica principal).
 * @returns {Promise<string>} - Una promesa que resuelve con la ruta al archivo PDF generado.
 */
async function generatePDF(htmlContent, clientName = "Cliente", tempDir = "", requestId = "") {
    return new Promise(async (resolve, reject) => {
        let browser = null; // Declarar fuera para acceso en finally

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
            console.log(`Ruta del archivo PDF: ${filePath}`);

            // --- Preparar logo ---
            const logoPath = path.resolve(__dirname, "../assets/logo.png"); // Ajusta si es necesario
            let logoBase64 = "";
            if (fs.existsSync(logoPath)) {
                logoBase64 = `data:image/png;base64,${fs.readFileSync(logoPath).toString("base64")}`;
                console.log("Logo cargado correctamente.");
            } else {
                console.error("Error: El archivo del logo NO EXISTE en la ruta:", logoPath);
            }

            // --- Procesamiento del HTML de la rutina (Mantener tu lógica) ---
            let modifiedHtml = htmlContent.replace(/<\/table>\s*<table>/g, "</table><div class='table-spacer'></div><table>");
            if (modifiedHtml.startsWith("<table>")) {
                const firstDayMatch = modifiedHtml.match(/<th colspan="5">(Día 1:.+?)<\/th>/);
                if (firstDayMatch) {
                    modifiedHtml = `<h2 class="day-title first-day-title">${firstDayMatch[1]}</h2>${modifiedHtml}`;
                    modifiedHtml = modifiedHtml.replace(/<th colspan="5">Día 1:.+?<\/th>/, '');
                }
            }
            modifiedHtml = modifiedHtml.replace(
                /<th colspan="5">(Día \d+:.+?)<\/th>/g,
                '</table><h2 class="day-title">$1</h2><table>'
            );
            console.log("HTML de la rutina procesado.");


            // const currentYear = new Date().getFullYear(); // Ya no se necesita para el footer
            const creationDate = new Date().toLocaleDateString("es-ES", {
                year: "numeric", month: "long", day: "numeric"
            });

            // --- Generar HTML de la Portada Dinámica ---
            console.log("Generando HTML de la portada...");
            const { fullCoverPageHtml, styles, script, scores, volumeData } = createCoverPage(htmlContent, clientName, logoBase64);

            const coverPageCompleteHtml = `
             <!DOCTYPE html>
             <html lang="es">
             <head>
                 <meta charset="UTF-8">
                 <title>Portada - ${clientName}</title>
                 <link rel="preconnect" href="https://fonts.googleapis.com">
                 <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
                 <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
                 <style>${styles}</style>
             </head>
             <body>
                 ${fullCoverPageHtml}
                 ${script}
             </body>
             </html>
            `;
            console.log("HTML de la portada generado.");

            // --- Ensamblar el HTML COMPLETO para la RUTINA (para la segunda parte del PDF) ---
            const routinePageHtml = `
             <!DOCTYPE html>
             <html lang="es">
             <head>
                 <meta charset="UTF-8">
                 <title>Rutina - ${clientName}</title>
                 <link rel="preconnect" href="https://fonts.googleapis.com">
                 <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
                 <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
                 <style>
                     /* --- ESTILOS SOLO PARA LAS PÁGINAS DE LA RUTINA --- */
                     /* ... (Tu CSS largo para la rutina va aquí, sin cambios) ... */
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
                         padding-bottom: 80px; /* Espacio para el footer */
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
                         color: #000000; /* Texto negro */
                         line-height: 1.7;
                         text-align: left; /* Alinear el contenido a la izquierda */
                         max-width: 800px; /* Opcional: limitar el ancho máximo */
                         margin: 0 auto; /* Centrar el bloque */
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

                     /* Evitar que elementos vacíos después de table ocupen espacio */
                     table + *:not(h2):not(.variants-container):not(.side-variants-container) {
                         margin: 0 !important;
                         padding: 0 !important;
                         display: block;
                         height: 0 !important;
                         font-size: 0 !important; /* Ocultar texto residual si lo hubiera */
                         line-height: 0 !important;
                     }


                     table {
                         width: 100%;
                         border-collapse: separate;
                         border-spacing: 0;
                         margin-bottom: 0 !important; /* Quitar margen inferior */
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

                     /* Colspan para títulos de sección dentro de tabla (si se usan) */
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
                         margin-top: 15px; /* Añadir margen superior */
                         margin-bottom: 25px;
                         padding: 15px 25px;
                         border: 1px solid #eee; /* Borde sutil */
                     }

                      .variants-container::after, .side-variants-container::after {
                         display: none; /* Ocultar pseudo-elementos si no se usan */
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
                         content: '\\2022'; /* Bullet point */
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

                     /* No aplicar margen superior a la primera página (portada) */
                      @page :first {
                         margin-top: 0;
                     }
                     /* Aplicar margen superior a las páginas siguientes (rutina) */
                      @page :not(:first) {
                         margin-top: 0; /* El header/footer manejarán el espacio */
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
                         height: 55px; /* Altura fija del footer */
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

                     /* Espaciador al final del contenido para que no se solape con el footer */
                     .content-spacer {height: 60px; width: 100%; display: block;}

                     .page-break {
                         page-break-before: always;
                         display: block;
                         height: 0;
                         width: 100%;
                     }

                     /* Clase para preservar los márgenes en los saltos de página */
                     .page-content {
                          padding-top: 50px; /* Margen superior para contenido después de salto */
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
                         color: var(--dark-gray); /* Asegurar que el texto sea visible */
                     }
                 </style>
             </head>
             <body>
                 <div class="header">
                     <div class="header-content">
                         <img src="${logoBase64}" alt="Logo Fitform" onerror="this.style.display='none'" />
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
                             <p><strong>Consulta médica:</strong> Antes de comenzar cualquier programa de ejercicio, especialmente si tienes condiciones médicas preexistentes, se recomienda consultar con un profesional de la salud.</p>
                             <p><strong>Interpretación del programa:</strong> Este documento utiliza un sistema de colores para facilitar la comprensión:</p>
                             <ul>
                                 <li><strong>Azul claro:</strong> Indica los ejercicios de activación, diseñados para preparar el cuerpo para el entrenamiento.</li>
                                 <li><strong>Azul oscuro:</strong> Señala los ejercicios principales que conforman tu rutina.</li>
                                 <li><strong>Amarillo:</strong> Muestra variantes o alternativas para adaptar los ejercicios según sea necesario.</li>
                             </ul>
                             <p><strong>Progresión gradual:</strong> Comienza con intensidades moderadas y aumenta gradualmente según tu adaptación. Respeta los descansos indicados y las series recomendadas.</p>
                             <p><strong>Técnica correcta:</strong> Prioriza siempre la ejecución adecuada de los movimientos sobre el peso o la intensidad. En caso de duda, consulta con un entrenador.</p>
                             <p><strong>Escucha a tu cuerpo:</strong> Si experimentas dolor (distinto a la incomodidad normal del ejercicio), mareos o dificultad para respirar, detén el entrenamiento y consulta a un médico.</p>
                             <div class="disclaimer-footer">
                                 Este programa es propiedad intelectual de Fitform y está destinado únicamente para uso personal del cliente. Queda prohibida su reproducción o distribución sin autorización.
                             </div>
                         </div>
                     </div>

                     <div class="routine-content">${modifiedHtml}</div>

                     <div class="content-spacer"></div>
                 </div>

                 <div class="footer">
                     <div class="footer-left"><img src="${logoBase64}" alt="Logo Fitform" onerror="this.style.display='none'" /></div>
                     <div class="footer-center"></div>
                     <div class="footer-right">Todos los derechos reservados</div>
                 </div>
             </body>
             </html>
            `;
            console.log("HTML completo para PDF ensamblado.");

            // --- Lanzar Puppeteer ---
            console.log("Lanzando Puppeteer...");
            browser = await puppeteer.launch({
                headless: true,
                args: [
                    "--no-sandbox",
                    "--disable-setuid-sandbox",
                    "--disable-dev-shm-usage",
                    "--disable-gpu",
                    "--disable-web-security"
                ],
            });
            console.log("Navegador Puppeteer lanzado.");

            const page = await browser.newPage();
            console.log("Nueva página creada.");

            // Configurar viewport
            await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 1 }); // A4 aprox

            // --- Generar Portada ---
            console.log("Estableciendo contenido de la PORTADA en Puppeteer...");
            await page.setContent(coverPageCompleteHtml, { waitUntil: 'networkidle0', timeout: 90000 });
            console.log("Contenido de la portada establecido. Esperando renderizado de gráficos...");

            // --- INICIO: ESPERAS MEJORADAS PARA GRÁFICOS ---
            try {
                console.log("Esperando selectores de canvas...");
                // Espera a que los elementos canvas sean visibles en la página
                await page.waitForSelector('#radarChart', { visible: true, timeout: 30000 });
                await page.waitForSelector('#volumeLineChart', { visible: true, timeout: 30000 });
                console.log("Selectores de canvas encontrados.");

                // Espera a que la variable global del gráfico radar exista.
                // Esto indica que el script initRadarChart probablemente ha terminado.
                console.log("Esperando inicialización del gráfico radar (variable window)...");
                await page.waitForFunction(
                    'window.myRadarChart !== undefined', // Verifica si la instancia del gráfico radar existe
                    { timeout: 30000 } // Timeout para esta espera
                );
                console.log("Variable del gráfico radar encontrada.");

                // Añade una pequeña espera fija adicional para asegurar que el renderizado finalice.
                // Útil si hay animaciones o el gráfico de volumen tarda un poco más.
                console.log("Pequeña espera adicional para renderizado (2s)...");
                await page.waitForTimeout(3000); // 3 segundos

                console.log("Esperas para gráficos completadas.");

            } catch (waitError) {
                console.error("Error durante las esperas para los gráficos:", waitError.message);
                // Se decide continuar aunque haya error en la espera, pero se advierte.
                console.warn("Continuando la generación del PDF, pero los gráficos podrían faltar.");
            }
            // --- FIN: ESPERAS MEJORADAS PARA GRÁFICOS ---

            // Generar la primera página (Portada)
            const coverPagePdfBuffer = await page.pdf({
                format: 'A4',
                printBackground: true,
                margin: { top: '0', right: '0', bottom: '0', left: '0' }, // Sin márgenes para controlar todo con CSS
                preferCSSPageSize: true, // Usar el tamaño definido en @page
                timeout: 90000 // Timeout generoso
            });
            console.log("Buffer PDF de la portada generado.");

            // --- Generar Páginas de Rutina ---
            console.log("Estableciendo contenido de la RUTINA en Puppeteer...");
            // Reutilizar la misma página para la rutina
            await page.setContent(routinePageHtml, { waitUntil: 'networkidle0', timeout: 60000 });
            console.log("Contenido de la rutina establecido.");

            // Ejecutar script para organizar días/variantes en el NAVEGADOR (Puppeteer)
            // Este script es específico para la ESTRUCTURA de la rutina, no afecta la portada
            console.log("Ejecutando script de evaluación para organizar días/variantes...");
            await page.evaluate(() => {
                // --- Inicio del script de evaluación para organizar la rutina ---
                // Asegurarse de que este código SOLO se ejecute en la página de rutina
                if (document.querySelector('.routine-content')) {
                    console.log("Ejecutando lógica de organización de días/variantes...");

                    // 1. Envolver cada día en un contenedor
                    document.querySelectorAll('.day-title').forEach((title, index) => {
                        const dayContainer = document.createElement('div');
                        dayContainer.className = 'training-day-container';
                        // Extraer número de día si existe
                        const dayNumberMatch = title.textContent.match(/Día\s+(\d+)/i);
                        if (dayNumberMatch) {
                            dayContainer.dataset.dayNumber = dayNumberMatch[1];
                        }

                        // Insertar contenedor antes del título y mover título dentro
                        title.parentNode.insertBefore(dayContainer, title);
                        dayContainer.appendChild(title);

                        // Mover elementos siguientes (tablas, spacers) al contenedor del día
                        let nextElement = dayContainer.nextElementSibling;
                        while (nextElement && (nextElement.tagName === 'TABLE' || nextElement.classList.contains('table-spacer'))) {
                            const currentElement = nextElement;
                            nextElement = nextElement.nextElementSibling; // Avanzar antes de mover
                            dayContainer.appendChild(currentElement);
                        }
                    });

                    // 2. Mover variantes a su contenedor de día correspondiente
                    document.querySelectorAll('.variants-container, .side-variants-container').forEach(variant => {
                        const titleEl = variant.querySelector('.variants-title, .side-variants-title');
                         if (titleEl) {
                             // Cambiar título a "VARIANTES"
                             titleEl.textContent = "VARIANTES";
                             // Intentar encontrar el número de día dentro del contenido de la variante (menos fiable)
                             const dayMatchInVariant = variant.innerHTML.match(/Día\s+(\d+)/i);
                             const dayNumber = dayMatchInVariant ? dayMatchInVariant[1] : null;

                             if (dayNumber) {
                                 // Encontrar el contenedor del día correspondiente
                                 const targetDayContainer = document.querySelector(`.training-day-container[data-day-number="${dayNumber}"]`);
                                 if (targetDayContainer) {
                                     // Mover la variante al final del contenedor del día
                                     targetDayContainer.appendChild(variant);
                                     console.log(`Variante movida al Día ${dayNumber}`);
                                 } else {
                                     console.warn(`No se encontró contenedor para el Día ${dayNumber} para mover la variante.`);
                                 }
                             } else {
                                 console.warn("No se pudo determinar el número de día para la variante:", variant.id || variant.className);
                             }
                         } else {
                              console.warn("Elemento de variante sin título encontrado:", variant.id || variant.className);
                         }
                    });


                    // 3. Aplicar saltos de página ANTES de cada contenedor de día (excepto el primero)
                    document.querySelectorAll('.training-day-container').forEach((dayContainer, index) => {
                        if (index > 0) { // No añadir salto antes del primer día
                            const pageBreak = document.createElement('div');
                            pageBreak.className = 'page-break';
                            dayContainer.parentNode.insertBefore(pageBreak, dayContainer);

                            // Añadir padding superior al contenedor para simular margen después del salto
                            // dayContainer.style.paddingTop = '50px'; // O usar clase .page-content si se prefiere
                            // Alternativa: Envolver en .page-content
                             const pageContentWrapper = document.createElement('div');
                             pageContentWrapper.className = 'page-content'; // Asegúrate que esta clase tenga padding-top
                             dayContainer.parentNode.insertBefore(pageContentWrapper, dayContainer);
                             pageContentWrapper.appendChild(dayContainer);

                        }
                        // Añadir espaciador al final de cada día para evitar solapamiento con footer
                        const finalSpacer = document.createElement('div');
                        finalSpacer.className = 'content-spacer'; // Asegúrate que esta clase tenga altura
                        dayContainer.appendChild(finalSpacer);

                    });

                    console.log("Organización de días/variantes completada.");
                } else {
                    console.log("No se encontró '.routine-content', saltando organización de días/variantes.");
                }
                // --- Fin del script de evaluación ---
            });
            console.log("Script de evaluación ejecutado.");

            // Generar las páginas de la rutina
            const routinePagesPdfBuffer = await page.pdf({
                format: 'A4',
                printBackground: true,
                margin: { top: '0', right: '0', bottom: '0', left: '0' },
                preferCSSPageSize: true,
                timeout: 90000 // Timeout generoso
            });
            console.log("Buffer PDF de la rutina generado.");

            // --- Combinar PDFs (Requiere una librería externa como 'pdf-lib' o 'hummus-recipe') ---
            // Esta parte es más compleja y requiere instalar una dependencia adicional.
            // Ejemplo conceptual (necesitas instalar 'pdf-lib'):
            console.log("Intentando combinar PDFs...");
            try {
                const { PDFDocument } = require('pdf-lib'); // Asegúrate de instalar: npm install pdf-lib

                const finalPdfDoc = await PDFDocument.create();

                // Cargar portada
                const coverDoc = await PDFDocument.load(coverPagePdfBuffer);
                const [coverPage] = await finalPdfDoc.copyPages(coverDoc, [0]);
                finalPdfDoc.addPage(coverPage);
                console.log("Página de portada añadida al PDF final.");

                // Cargar rutina
                const routineDoc = await PDFDocument.load(routinePagesPdfBuffer);
                const routinePages = await finalPdfDoc.copyPages(routineDoc, routineDoc.getPageIndices());
                routinePages.forEach(page => finalPdfDoc.addPage(page));
                console.log(`${routinePages.length} páginas de rutina añadidas al PDF final.`);

                // Guardar el PDF combinado
                const finalPdfBytes = await finalPdfDoc.save();
                fs.writeFileSync(filePath, finalPdfBytes);
                console.log("PDF combinado guardado correctamente en:", filePath);

            } catch (mergeError) {
                 console.error("Error al combinar los PDFs:", mergeError);
                 console.warn("Guardando solo la rutina como fallback...");
                 // Fallback: guardar solo la rutina si la combinación falla
                 fs.writeFileSync(filePath, routinePagesPdfBuffer);
                 // O podrías guardar ambos por separado y notificar el error
                 reject(new Error(`Error al combinar PDFs: ${mergeError.message}. Se guardó solo la rutina.`));
                 return; // Salir para evitar cerrar el navegador antes de tiempo
            }

            // --- Limpieza ---
            console.log("Cerrando navegador Puppeteer...");
            await browser.close();
            console.log("Navegador cerrado correctamente.");

            resolve(filePath); // Resuelve con la ruta del PDF final combinado

        } catch (error) {
            console.error("Error general en generatePDF:", error);
            if (browser) {
                try {
                    console.log("Intentando cerrar navegador después de error...");
                    await browser.close();
                    console.log("Navegador cerrado después de error general.");
                } catch (closeError) {
                    console.error("Error al cerrar el navegador después de un error:", closeError.message);
                }
            }
            reject(error); // Rechaza la promesa con el error original
        }
    });
}

module.exports = { generatePDF };
