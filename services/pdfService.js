const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");
const os = require("os");

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
        console.warn("Advertencia: El archivo del logo no existe en la ruta:", logoPath, "- Se usará sin logo.");
      }

      const creationDate = new Date().toLocaleDateString("es-ES", {
        year: "numeric", month: "long", day: "numeric"
      });
      const currentYear = new Date().getFullYear();

      // --- Procesamiento HTML Mejorado ---
      // 1. Eliminar espacios entre tablas y añadir un marcador temporal
      let modifiedHtml = htmlContent.replace(/<\/table>\s*<table>/g, "</table><table>");

      // 2. Extraer títulos de día y envolver tablas en divs de día
      const dayRegex = /<th colspan="5">(Día \d+:[^<]+)<\/th>/i;
      let dayCounter = 0;
      let processedHtml = "";
      let currentDayContent = "";
      let currentDayTitle = "";

      const parts = modifiedHtml.split('');

      parts.forEach((part, index) => {
          const dayMatch = part.match(dayRegex);

          if (dayMatch) {
              // Si encontramos un título de día y ya teníamos contenido del día anterior, lo cerramos
              if (currentDayContent) {
                  processedHtml += `<div class="training-day-container" data-day="${dayCounter}">
                                      <h2 class="day-title">${currentDayTitle}</h2>
                                      ${currentDayContent}
                                   </div>`;
                  currentDayContent = ""; // Reiniciar contenido para el nuevo día
              }
              // Nuevo día encontrado
              dayCounter++;
              currentDayTitle = dayMatch[1]; // Guardar el título del nuevo día
              // Añadir la tabla (sin el título th) al contenido del día actual
              currentDayContent += part.replace(dayRegex, '');
          } else {
              // Si no es un título de día, es parte del contenido del día actual (tabla, variante, etc.)
              currentDayContent += part;
          }

          // Si es la última parte, cerrar el último contenedor de día
          if (index === parts.length - 1 && currentDayContent) {
               processedHtml += `<div class="training-day-container" data-day="${dayCounter}">
                                  <h2 class="day-title">${currentDayTitle}</h2>
                                  ${currentDayContent}
                               </div>`;
          }
      });

      // --- HTML con Estilos Renovados ---
      const styledHtml = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Rutina de Entrenamiento - ${clientName}</title>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

      :root {
          --primary-color: #0D47A1; /* Azul Oscuro Principal */
          --secondary-color: #1976D2; /* Azul Medio */
          --accent-color: #42A5F5; /* Azul Claro (Énfasis) */
          --highlight-color: #FFC107; /* Amarillo/Dorado (Variantes) */
          --text-color: #263238; /* Gris Oscuro (Texto Principal) */
          --text-light: #546E7A; /* Gris Medio (Texto Secundario) */
          --bg-light: #F5F7FA; /* Gris Muy Claro (Fondo suave) */
          --white: #FFFFFF;
          --border-color: #E0E0E0; /* Borde sutil */
          --border-color-light: #EEEEEE;
          --success-color: #4CAF50;
          --warning-color: #FF9800;
          --error-color: #F44336;

          --border-radius: 6px;
          --box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
          --box-shadow-light: 0 2px 6px rgba(0, 0, 0, 0.05);

          --font-sans: 'Inter', 'Arial', sans-serif;
          --font-size-base: 10.5px;
          --font-size-sm: 9.5px;
          --font-size-lg: 14px;
          --font-size-xl: 18px;
          --line-height-base: 1.6;

          --header-height: 70px;
          --footer-height: 50px;
          --content-padding: 30px;
          --page-width: 210mm; /* A4 width */
          --page-height: 297mm; /* A4 height */
      }

      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }

      @page {
          size: A4;
          margin: 0; /* Quitamos márgenes de @page, los manejamos con padding en body/content */
      }

      body {
          font-family: var(--font-sans);
          font-size: var(--font-size-base);
          line-height: var(--line-height-base);
          color: var(--text-color);
          background-color: var(--bg-light); /* Fondo general suave */
          -webkit-print-color-adjust: exact; /* Forzar impresión de fondos y colores */
          print-color-adjust: exact;
          padding-top: var(--header-height); /* Espacio para el header fijo */
          padding-bottom: var(--footer-height); /* Espacio para el footer fijo */
          min-height: var(--page-height); /* Asegurar altura mínima */
      }

      /* --- Header --- */
      .header {
          position: fixed; /* Fijar header */
          top: 0;
          left: 0;
          width: 100%;
          height: var(--header-height);
          background: linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%);
          color: var(--white);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 var(--content-padding);
          box-shadow: 0 2px 5px rgba(0, 0, 0, 0.15);
          z-index: 1000;
          border-bottom: 3px solid var(--accent-color);
      }

      .header .logo img {
          height: 35px; /* Ajustar tamaño logo */
          width: auto;
          filter: brightness(0) invert(1); /* Logo blanco */
          vertical-align: middle;
      }
      .header .logo span { /* Nombre opcional junto al logo */
          font-size: var(--font-size-lg);
          font-weight: 600;
          margin-left: 10px;
          vertical-align: middle;
      }

      .header .info {
          text-align: right;
          font-size: var(--font-size-sm);
      }

      .header .info p {
          margin: 2px 0;
          line-height: 1.4;
      }
      .header .info strong {
          font-weight: 600;
          margin-right: 5px;
      }

      /* --- Footer --- */
      .footer {
          position: fixed; /* Fijar footer */
          bottom: 0;
          left: 0;
          width: 100%;
          height: var(--footer-height);
          background: linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%);
          color: rgba(255, 255, 255, 0.8); /* Texto ligeramente transparente */
          font-size: var(--font-size-sm);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 var(--content-padding);
          border-top: 3px solid var(--accent-color);
          z-index: 1000;
      }
      .footer-left { text-align: left; }
      .footer-center { text-align: center; font-style: italic; opacity: 0.7;} /* Mensaje opcional central */
      .footer-right { text-align: right; }

      /* --- Contenido Principal --- */
      .content-wrapper {
          padding: var(--content-padding);
          background-color: var(--white); /* Fondo blanco para el área de contenido principal */
          /* Quitar min-height de aquí, body ya tiene padding */
      }

      /* --- Disclaimer / Información Importante --- */
      .disclaimer-container {
          background-color: #E3F2FD; /* Fondo azul muy claro */
          border-left: 5px solid var(--accent-color);
          border-radius: var(--border-radius);
          padding: 20px;
          margin-bottom: 35px;
          page-break-inside: avoid; /* Intentar no romper esta sección */
          font-size: var(--font-size-sm); /* Texto ligeramente más pequeño */
          color: var(--text-light); /* Texto gris medio */
      }

      .disclaimer-title {
          font-weight: 700;
          color: var(--secondary-color); /* Azul medio */
          font-size: var(--font-size-lg);
          margin-bottom: 15px;
          display: block; /* Asegurar que ocupa todo el ancho */
          padding-bottom: 5px;
          border-bottom: 1px solid rgba(66, 165, 245, 0.3); /* Línea sutil debajo */
      }

      .disclaimer-content p {
          margin-bottom: 10px;
          line-height: 1.5;
      }
      .disclaimer-content strong {
          color: var(--primary-color); /* Azul oscuro */
          font-weight: 600;
      }
      .disclaimer-content ul {
          padding-left: 20px;
          margin: 10px 0;
          list-style: disc; /* Usar viñetas estándar */
      }
       .disclaimer-content ul li {
          margin-bottom: 5px;
       }
       /* Colores específicos para la leyenda */
       .disclaimer-content .color-activation { color: var(--accent-color); font-weight: 600; }
       .disclaimer-content .color-routine { color: var(--secondary-color); font-weight: 600; }
       .disclaimer-content .color-variant { color: var(--highlight-color); font-weight: 600; }


      .disclaimer-footer {
          margin-top: 15px;
          padding-top: 10px;
          border-top: 1px solid var(--border-color);
          font-style: italic;
          font-size: 9px;
          color: var(--text-light);
      }

      /* --- Contenedor de Día de Entrenamiento --- */
      .training-day-container {
          margin-bottom: 30px;
          page-break-inside: avoid; /* Intentar mantener el día junto */
      }

      /* Título del Día */
      .day-title {
          font-size: var(--font-size-xl);
          font-weight: 700;
          color: var(--primary-color);
          margin-bottom: 20px;
          padding-bottom: 8px;
          border-bottom: 2px solid var(--accent-color);
          display: inline-block; /* Para que el borde no ocupe todo */
          text-transform: uppercase;
          letter-spacing: 0.5px;
      }

      /* --- Tablas de Ejercicios --- */
      table {
          width: 100%;
          border-collapse: collapse; /* Bordes limpios */
          margin-bottom: 15px; /* Espacio después de cada tabla */
          font-size: var(--font-size-base);
          border: 1px solid var(--border-color);
          border-radius: var(--border-radius);
          overflow: hidden; /* Para que el border-radius afecte a las celdas */
          box-shadow: var(--box-shadow-light);
          background-color: var(--white);
          page-break-inside: auto; /* Permitir romper dentro si es necesario */
      }

       /* Encabezados de sección (Activación/Rutina) */
      .section-header td {
          font-weight: 600;
          text-align: center !important; /* Forzar centro */
          font-size: 11.5px; /* Ligeramente más grande */
          padding: 10px 15px; /* Ajustar padding */
          letter-spacing: 0.8px;
          text-transform: uppercase;
          color: var(--white) !important; /* Asegurar texto blanco */
          border-bottom: 2px solid rgba(0, 0, 0, 0.2); /* Sombra sutil */
      }
      .activacion-header td { background-color: var(--accent-color) !important; }
      .rutina-header td { background-color: var(--secondary-color) !important; }

      /* Encabezados de Columna (Ejercicio, Series, Reps, etc.) */
      thead th {
          background-color: var(--bg-light); /* Fondo gris claro */
          color: var(--text-light); /* Texto gris medio */
          font-size: var(--font-size-sm);
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          padding: 10px 12px;
          text-align: left;
          border-bottom: 2px solid var(--border-color);
      }

      /* Celdas de Datos */
      td, th {
          padding: 10px 12px; /* Padding consistente */
          text-align: left;
          word-wrap: break-word;
          border-bottom: 1px solid var(--border-color-light); /* Líneas horizontales más sutiles */
          vertical-align: middle;
      }
      /* Quitar borde inferior de la última fila */
       tbody tr:last-child td {
           border-bottom: none;
       }

       /* Estilo alternado de filas */
      tbody tr:nth-child(even) td {
          background-color: var(--bg-light);
      }
      tbody tr:nth-child(odd) td {
          background-color: var(--white);
      }
      /* Hover sutil */
      tbody tr:hover td {
         background-color: #E3F2FD; /* Azul muy claro al pasar el ratón (si es interactivo) */
      }

      /* Primera columna (Nombre del ejercicio) */
      tbody td:first-child {
         font-weight: 500; /* Ligeramente más énfasis */
         color: var(--primary-color); /* Color primario para el nombre */
      }

       /* Estilo específico para columnas (si es necesario ajustar anchos) */
       /* table td:nth-child(1) { width: 35%; } Nombre Ejercicio */
       /* table td:nth-child(2) { width: 15%; } Series */
       /* table td:nth-child(3) { width: 15%; } Reps */
       /* table td:nth-child(4) { width: 15%; } Descanso */
       /* table td:nth-child(5) { width: 20%; } Notas/RPE */


      /* --- Variantes --- */
      .variants-container, .side-variants-container {
          background-color: #FFFDE7; /* Amarillo muy pálido */
          border: 1px solid #FFF9C4; /* Borde amarillo pálido */
          border-left: 4px solid var(--highlight-color); /* Borde izquierdo resaltado */
          border-radius: var(--border-radius);
          padding: 15px 20px;
          margin-top: 10px; /* Espacio respecto a la tabla */
          margin-bottom: 20px;
          page-break-inside: avoid; /* Intentar no romper las variantes */
          box-shadow: var(--box-shadow-light);
      }

      .variants-title, .side-variants-title {
          font-weight: 700;
          color: #795548; /* Marrón oscuro para el título de variantes */
          font-size: var(--font-size-lg);
          margin-bottom: 12px;
          display: block;
          padding-bottom: 5px;
          border-bottom: 1px solid rgba(255, 193, 7, 0.3); /* Línea sutil amarilla */
          text-transform: uppercase;
          letter-spacing: 0.5px;
      }

      .variant-item, .side-variant-item {
          margin-bottom: 10px;
          padding-bottom: 10px;
          border-bottom: 1px dashed var(--border-color-light); /* Separador sutil entre variantes */
          position: relative;
          padding-left: 15px; /* Espacio para el icono/bullet */
      }
      .variant-item:last-child, .side-variant-item:last-child {
          margin-bottom: 0;
          padding-bottom: 0;
          border-bottom: none;
      }

      /* Icono/Bullet para variantes */
       .variant-item::before, .side-variant-item::before {
           content: '💡'; /* Icono de bombilla o '▶' */
           position: absolute;
           left: 0;
           top: 0;
           color: var(--highlight-color);
           font-size: 12px;
       }


      .variant-title, .side-variant-title { /* Título de CADA variante */
          font-weight: 600;
          color: var(--text-color);
          font-size: var(--font-size-base); /* Mismo tamaño que texto base */
          margin-bottom: 3px;
      }
      .side-variant-title { /* Para variantes lado a lado */
         display: inline; /* Mostrar en línea */
         margin-right: 5px;
      }

      .variant-description, .side-variant-description {
          font-size: var(--font-size-sm); /* Descripción más pequeña */
          color: var(--text-light);
          line-height: 1.4;
          padding-left: 0; /* No necesita padding extra aquí */
      }

      /* Flecha (si se usa en side-variants) */
      .arrow-right {
          color: var(--highlight-color);
          font-weight: 700;
          margin: 0 6px;
      }


      /* --- Saltos de Página y Espaciado --- */
      .page-break {
          page-break-before: always;
          height: 0;
          display: block;
          clear: both; /* Asegurar que limpie flotantes si los hubiera */
      }
       /* Contenedor para contenido después de un salto, para aplicar padding superior */
      .page-content-after-break {
          padding-top: var(--content-padding); /* Añadir padding arriba después de un salto manual */
      }


      /* --- Utilidades --- */
      .text-center { text-align: center; }
      .text-right { text-align: right; }
      .font-bold { font-weight: 700; }
      .font-semibold { font-weight: 600; }

    </style>
</head>
<body>
    <div class="header">
      <div class="logo">
          ${logoBase64 ? `<img src="${logoBase64}" alt="Logo">` : ''}
          </div>
      <div class="info">
          <p><strong>Cliente:</strong> ${clientName}</p>
          <p><strong>Fecha:</strong> ${creationDate}</p>
      </div>
    </div>

    <div class="content-wrapper">
        <div class="disclaimer-container">
            <div class="disclaimer-title">¡IMPORTANTE ANTES DE EMPEZAR!</div>
            <div class="disclaimer-content">
                <p>Esta rutina ha sido generada específicamente para ti. Para asegurar los mejores resultados y tu seguridad, por favor considera lo siguiente:</p>
                <p><strong>Consulta Profesional:</strong> Si tienes alguna condición médica preexistente o dudas, consulta con tu médico o un fisioterapeuta antes de iniciar.</p>
                <p><strong>Interpretación:</strong> Los colores te ayudan a identificar las secciones:</p>
                <ul>
                    <li><span class="color-activation">Azul Claro:</span> Ejercicios de activación/calentamiento.</li>
                    <li><span class="color-routine">Azul Oscuro:</span> Ejercicios principales de la rutina.</li>
                    <li><span class="color-variant">Amarillo:</span> Variantes o alternativas sugeridas.</li>
                </ul>
                <p><strong>Progresión:</strong> Empieza con calma y aumenta la intensidad gradualmente. Escucha a tu cuerpo y respeta los descansos.</p>
                <p><strong>Técnica:</strong> ¡La forma es clave! Prioriza una ejecución correcta sobre levantar más peso o hacer más repeticiones. Si no estás seguro, busca vídeos o consulta a un profesional.</p>
                <p><strong>Señales de Alerta:</strong> Detente si sientes dolor agudo (diferente a la fatiga muscular), mareos o dificultad para respirar.</p>
                <div class="disclaimer-footer">
                    Rutina generada por FitForm. Propiedad intelectual. Uso exclusivo para ${clientName}.
                </div>
            </div>
        </div>

        ${processedHtml}

    </div>

    <div class="footer">
        <div class="footer-left">
             ${logoBase64 ? `<img src="${logoBase64}" alt="Logo" style="height: 20px; opacity: 0.7;">` : 'FitForm'}
        </div>
        <div class="footer-center">Tu plan personalizado</div>
        <div class="footer-right">© ${currentYear} Todos los derechos reservados</div>
    </div>

</body>
</html>`;

      // --- Generación del PDF con Puppeteer ---
      const browser = await puppeteer.launch({
        headless: true, // 'true' suele ser más compatible que 'new' en algunos entornos
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage", // Importante para entornos limitados (Docker, CI)
          "--disable-gpu", // A menudo innecesario para renderizar HTML simple
          "--font-render-hinting=none" // Puede mejorar la renderización de fuentes
        ]
      });

      const page = await browser.newPage();

      // Establecer contenido HTML
      // Usar 'domcontentloaded' puede ser más rápido si no dependes de recursos externos tardíos
      await page.setContent(styledHtml, { waitUntil: 'networkidle0' }); // networkidle0 es más seguro si hay fuentes web o imágenes

      // --- Script de Evaluación Post-Renderizado (Opcional, para ajustes finos) ---
      // Añadimos saltos de página explícitos ANTES de cada día (excepto el primero)
      // y movemos las variantes para que estén DENTRO del contenedor de su día.
      await page.evaluate(() => {
          const dayContainers = document.querySelectorAll('.training-day-container');

          dayContainers.forEach((container, index) => {
              // 1. Añadir Salto de Página y Padding Superior (excepto al primero)
              if (index > 0) {
                  const pageBreak = document.createElement('div');
                  pageBreak.className = 'page-break';
                  container.parentNode.insertBefore(pageBreak, container);

                  // Envolver el contenido del día en un div para aplicar padding post-salto
                  const pageContentWrapper = document.createElement('div');
                  pageContentWrapper.className = 'page-content-after-break';
                  // Mover el título y las tablas/variantes dentro de este nuevo wrapper
                  while (container.firstChild) {
                    pageContentWrapper.appendChild(container.firstChild);
                  }
                  container.appendChild(pageContentWrapper);
               }

              // 2. Mover Variantes al final de su contenedor de día correspondiente
              const dayNumber = container.dataset.day;
              const variants = document.querySelectorAll(`.variants-container[data-day="${dayNumber}"], .side-variants-container[data-day="${dayNumber}"]`); // Asumiendo que añadimos data-day a las variantes en el HTML original o aquí

              // (Este paso es más complejo si las variantes no están ya dentro del container.
              // La lógica de procesamiento HTML anterior ya debería agruparlas.
              // Si no, necesitarías buscar variantes fuera y moverlas aquí.)
              // Por simplicidad, asumimos que el procesamiento HTML inicial ya las agrupó.
              // Si no es así, este es el lugar para encontrarlas y moverlas:
              // variants.forEach(variant => container.querySelector('.page-content-after-break, div:not(.page-content-after-break)')?.appendChild(variant)); // Añadir al final del contenido del día

          });

           // 3. Cambiar título genérico de las secciones de variantes
           document.querySelectorAll('.variants-container .variants-title, .side-variants-container .side-variants-title').forEach(titleEl => {
                // Asegurarnos de que solo cambiamos el TÍTULO de la sección, no de cada item.
                 if (titleEl.parentElement.classList.contains('variants-container') || titleEl.parentElement.classList.contains('side-variants-container')) {
                    if (titleEl.textContent.toLowerCase().includes('variantes')) { // Solo si parece ser el título general
                       titleEl.textContent = "💡 VARIANTES Y AJUSTES";
                    }
                 }
           });
      });

      // Generar PDF
      const pdfBuffer = await page.pdf({
        path: filePath,
        format: 'A4',
        printBackground: true, // ¡Esencial para que se vean los colores y fondos!
        margin: { // Márgenes CERO porque controlamos el espacio con padding y header/footer fijos
            top: '0mm',
            right: '0mm',
            bottom: '0mm',
            left: '0mm'
        },
        preferCSSPageSize: true, // Usar el tamaño A4 definido en CSS
        timeout: 90000 // Aumentar timeout a 90 segundos por si acaso
      });

      await browser.close();
      console.log("✅ PDF generado correctamente en:", filePath);
      resolve(filePath);

    } catch (error) {
      console.error("❌ Error en generatePDF:", error);
      reject(error);
    }
  });
}

module.exports = { generatePDF };