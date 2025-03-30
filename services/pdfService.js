const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");
const os = require("os");

/**
 * Genera un archivo PDF a partir de contenido HTML, formateado como una rutina de entrenamiento.
 * @param {string} htmlContent El contenido HTML principal (generalmente tablas de ejercicios).
 * @param {string} [clientName="Cliente"] El nombre del cliente para mostrar en el PDF.
 * @returns {Promise<string>} Una promesa que se resuelve con la ruta al archivo PDF generado.
 */
async function generatePDF(htmlContent, clientName = "Cliente") {
  return new Promise(async (resolve, reject) => {
    let browser;

    try {
      console.log(`Iniciando generación de PDF para: ${clientName}`);
      const sanitizedName = clientName.replace(/[^a-zA-Z0-9]/g, "_");
      const fileName = `rutina_${sanitizedName}_${Date.now()}.pdf`;
      const tempDir = os.tmpdir();
      const filePath = path.join(tempDir, fileName);
      console.log(`Archivo PDF se guardará temporalmente en: ${filePath}`);

      // --- Preparación del Logo ---
      const logoPath = path.resolve(__dirname, "../assets/logo.png"); // Ajusta si tu estructura es diferente
      let logoBase64 = "";
      // Placeholder simple si no hay logo (SVG inline)
      const placeholderLogo = 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="40" viewBox="0 0 100 40"><rect width="100" height="40" fill="#cccccc"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#555555" font-size="10" font-family="Arial">LOGO</text></svg>').toString('base64');

      if (fs.existsSync(logoPath)) {
        logoBase64 = `data:image/png;base64,${fs.readFileSync(logoPath).toString("base64")}`;
        console.log("Logo cargado correctamente.");
      } else {
        console.warn("Advertencia: No se encontró el archivo del logo en:", logoPath, ". Usando placeholder.");
        logoBase64 = placeholderLogo; // Usar placeholder si no existe
      }

      // --- Fechas ---
      const creationDate = new Date().toLocaleDateString("es-ES", {
        year: "numeric", month: "long", day: "numeric",
      });
      const currentYear = new Date().getFullYear();

       // --- Procesamiento del HTML de Entrada ---
      // 1. Añadir espaciadores entre tablas para que el JS pueda separarlas mejor
      let modifiedHtml = htmlContent.replace(/<\/table>\s*<table>/g, "</table><div class='table-spacer'></div><table>");

      // 2. Extraer títulos de día (<th>) y convertirlos en <h2>
      // Tratar Día 1 específicamente si es el inicio absoluto
      if (modifiedHtml.startsWith("<table>")) {
        // Busca la cabecera de Día 1, permitiendo atributos y variaciones en el tag th
        const firstDayMatch = modifiedHtml.match(/<th[^>]*colspan=["']?5["']?[^>]*>(Día\s+1:.*?)(?:<\/th>|<\/tr>)/i);
        if (firstDayMatch && firstDayMatch[1]) {
           // Eliminar la fila completa (<tr>...</tr>) que contiene la cabecera del día 1
           modifiedHtml = modifiedHtml.replace(/<tr>\s*<th[^>]*colspan=["']?5["']?[^>]*>Día\s+1:.*?<\/th>\s*<\/tr>/i, '');
           // Añadir el H2 antes del contenido restante
           modifiedHtml = `<h2 class="day-title first-day-title">${firstDayMatch[1].trim()}</h2>` + modifiedHtml;
         }
      }
      // Procesar el resto de los días (Día 2, Día 3, ...)
      modifiedHtml = modifiedHtml.replace(
         // Busca filas que contengan una cabecera de día (distinto de 1)
         /<tr>\s*<th[^>]*colspan=["']?5["']?[^>]*>(Día\s+\d+:.*?)<\/th>\s*<\/tr>/gi,
         // Reemplaza la fila por un cierre de tabla anterior (si aplica), el nuevo H2 y apertura de tabla
        (match, p1) => `</table><h2 class="day-title">${p1.trim()}</h2><table>`
      );


      // --- Construcción del HTML Completo con Estilos "Next Level" ---
      const styledHtml = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Rutina de Entrenamiento - ${clientName}</title>
  <style>
    /* --- Importación de Fuentes --- */
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');

    /* --- Variables CSS (Paleta Refinada) --- */
    :root {
      /* Colores Base */
      --primary-color: #0D3D6F; /* Azul más profundo */
      --secondary-color: #1E5A97; /* Azul secundario más vibrante */
      --accent-color: #4FC3F7; /* Azul claro acento (Light Blue A200) */
      --highlight-color: #FFD54F; /* Amarillo para highlights (Amber 300) */

      /* Colores Funcionales */
      --routine-color: #1A4C80; /* Azul oscuro para rutina */
      --activation-color: #297CC5; /* Azul medio para activación */
      --variant-bg: #FFF9C4; /* Amarillo muy pálido para fondo variantes (Yellow 100) */
      --variant-border: #FFEE58; /* Amarillo borde variantes (Yellow 400) */
      --variant-text: #4E4A3A; /* Texto más oscuro para variantes */
      --variant-accent: #FFC107; /* Acento amarillo principal (Amber 500) */

      /* Tonos Neutrales */
      --text-main: #263238; /* Gris azulado muy oscuro para texto (Blue Grey 900) */
      --text-light: #546E7A; /* Gris azulado medio (Blue Grey 600) */
      --border-color: #CFD8DC; /* Gris azulado claro para bordes (Blue Grey 100) */
      --bg-light: #F5F7FA; /* Fondo muy claro, casi blanco */
      --bg-white: #FFFFFF;

      /* Estilos UI */
      --border-radius-sm: 4px;
      --border-radius-md: 8px;
      --shadow-soft: 0 3px 8px rgba(0, 0, 0, 0.06);
      --shadow-medium: 0 6px 15px rgba(0, 0, 0, 0.08);
      --gradient-primary: linear-gradient(140deg, var(--primary-color) 0%, var(--secondary-color) 100%);
      --gradient-accent: linear-gradient(140deg, var(--accent-color) 0%, #81D4FA 100%); /* Ligero gradiente en acento */
    }

    /* --- Reset Básico y Configuración Global --- */
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    html {
      font-size: 100%; /* Base para REMs si se usaran */
      scroll-behavior: smooth;
    }

    body {
      font-family: 'Inter', 'Helvetica Neue', Arial, sans-serif;
      color: var(--text-main);
      background-color: var(--bg-white); /* Fondo blanco base */
      font-size: 12px; /* Tamaño base aumentado */
      line-height: 1.65; /* Interlineado mejorado */
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      /* Propiedades para mejor flujo de texto en saltos de página */
      widows: 3;
      orphans: 3;
    }

    /* --- Contenedor Principal y Página --- */
    @page {
      size: A4;
      margin: 0;
    }

    .page-wrapper {
      padding-top: 85px; /* Espacio exacto para header (80px + 5px margen) */
      padding-bottom: 65px; /* Espacio exacto para footer (60px + 5px margen) */
      background-color: var(--bg-light); /* Fondo general muy sutil */
    }

    .content-wrapper {
      padding: 30px 35px; /* Mayor padding horizontal */
      max-width: 842px; /* Ancho A4 menos márgenes aprox. */
      margin: 0 auto; /* Centrar contenido si es más estrecho */
      background-color: var(--bg-white); /* Fondo blanco para el contenido */
      box-shadow: 0 0 25px rgba(0, 0, 0, 0.05); /* Sombra sutil al contenedor */
      min-height: calc(1123px - 85px - 65px); /* Altura A4 menos header/footer */
    }

    /* --- Header Fijo con Mejoras --- */
    .header {
      position: fixed;
      top: 0; left: 0; width: 100%;
      height: 80px;
      background: var(--gradient-primary);
      color: var(--bg-white);
      display: flex;
      align-items: center;
      padding: 0 35px;
      z-index: 1000;
      border-bottom: 5px solid; /* Borde más grueso */
      border-image: var(--gradient-accent) 1; /* Borde con gradiente */
      box-shadow: var(--shadow-medium);
      /* Patrón sutil de fondo con gradiente CSS */
      background-image: var(--gradient-primary),
                        linear-gradient(45deg, rgba(255,255,255,0.03) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.03) 50%, rgba(255,255,255,0.03) 75%, transparent 75%, transparent);
      background-size: cover, 30px 30px; /* Tamaño del patrón */
    }
    .header-content {
      display: flex;
      justify-content: space-between;
      align-items: center;
      width: 100%;
    }
    .header img {
      max-height: 45px;
      width: auto;
      filter: brightness(0) invert(1); /* Logo blanco */
      opacity: 0.95;
    }
    .header .info {
      text-align: right;
      font-size: 11.5px;
      line-height: 1.5;
      letter-spacing: 0.3px;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2); /* Sombra sutil al texto */
    }
    .header .info p { margin: 3px 0; }
    .header .info strong { font-weight: 600; }

    /* --- Footer Fijo con Mejoras --- */
    .footer {
      position: fixed;
      bottom: 0; left: 0; width: 100%;
      height: 60px;
      background: var(--gradient-primary);
      color: rgba(255, 255, 255, 0.85); /* Texto ligeramente menos brillante */
      font-size: 10px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0 35px;
      z-index: 1000;
      border-top: 5px solid;
      border-image: var(--gradient-accent) 1;
      box-shadow: 0 -3px 15px rgba(0, 0, 0, 0.08);
       /* Mismo patrón que el header */
      background-image: var(--gradient-primary),
                        linear-gradient(45deg, rgba(255,255,255,0.03) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.03) 50%, rgba(255,255,255,0.03) 75%, transparent 75%, transparent);
      background-size: cover, 30px 30px;
    }
    .footer-left img {
      max-height: 20px;
      width: auto;
      filter: brightness(0) invert(1);
      opacity: 0.8;
    }
    .footer-center { /* Puede usarse para paginación si se implementa */
        text-align: center;
        flex-grow: 1;
        font-style: italic;
    }
    .footer-right {
        text-align: right;
        letter-spacing: 0.4px;
    }

    /* --- Disclaimer Mejorado --- */
    .disclaimer-container {
      background-color: var(--bg-white);
      border-radius: var(--border-radius-md);
      padding: 25px 30px;
      margin-bottom: 40px; /* Mayor separación */
      border: 1px solid var(--border-color);
      border-left: 5px solid var(--accent-color);
      page-break-inside: avoid;
      position: relative;
      overflow: hidden;
      box-shadow: var(--shadow-soft);
    }
     /* Línea decorativa superior */
    .disclaimer-container::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 3px;
      background: var(--gradient-accent);
      opacity: 0.6;
    }
    .disclaimer-title {
      font-weight: 700;
      color: var(--primary-color);
      font-size: 16px;
      margin-bottom: 20px;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      position: relative;
      display: inline-block;
    }
    /* Subrayado decorativo */
    .disclaimer-title::after {
      content: '';
      position: absolute;
      left: 0;
      bottom: -5px;
      width: 60%;
      height: 2.5px;
      background-color: var(--highlight-color);
      border-radius: 2px;
    }
    .disclaimer-content {
      font-size: 11.5px;
      color: var(--text-light);
      line-height: 1.7;
    }
    .disclaimer-content p { margin-bottom: 12px; }
    .disclaimer-content strong { color: var(--text-main); font-weight: 600; }
    .disclaimer-content ul {
      padding-left: 0; /* Quitar padding default */
      margin: 15px 0;
      list-style: none; /* Quitar bullets default */
    }
    .disclaimer-content li {
      margin-bottom: 10px;
      padding-left: 25px; /* Espacio para el icono */
      position: relative;
    }
    /* Icono personalizado para la lista */
    .disclaimer-content li::before {
      content: '➤'; /* O usar '✓', '•', etc. */
      position: absolute;
      left: 0;
      top: 1px;
      color: var(--accent-color);
      font-weight: 600;
      font-size: 14px;
    }
    .disclaimer-footer {
      margin-top: 20px;
      padding-top: 15px;
      border-top: 1px dashed var(--border-color); /* Línea discontinua */
      font-style: italic;
      font-size: 10px;
      color: var(--text-light);
      opacity: 0.8;
    }

    /* --- Títulos de Día (H2) Mejorados --- */
    .day-title {
      font-size: 20px; /* Más grande */
      font-weight: 700; /* Más peso */
      color: var(--primary-color);
      margin: 45px 0 25px 0; /* Mayor margen vertical */
      padding-bottom: 10px;
      position: relative; /* Para pseudo-elemento */
      text-transform: uppercase;
      letter-spacing: 1px; /* Mayor espaciado */
      page-break-after: avoid;
      page-break-inside: avoid;
      display: block; /* Asegurar que ocupe línea completa */
      border-bottom: none; /* Quitar borde anterior */
    }
    /* Línea decorativa inferior con gradiente */
    .day-title::after {
        content: '';
        position: absolute;
        left: 0;
        bottom: 0;
        width: 100%; /* Ocupa todo el ancho */
        height: 3px;
        background: linear-gradient(90deg, var(--secondary-color) 0%, var(--accent-color) 70%, transparent 100%);
        border-radius: 2px;
    }
    .first-day-title { margin-top: 10px; } /* Menor margen para el primero */

    /* --- Estilos de Tabla "Next Level" --- */
    .table-spacer { height: 15px; } /* Espaciador un poco más grande */

    table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      margin-bottom: 25px;
      font-size: 11px; /* Ligeramente más pequeño para caber más info */
      border-radius: var(--border-radius-md);
      overflow: hidden;
      box-shadow: var(--shadow-medium);
      border: 1px solid var(--border-color);
      background-color: var(--bg-white);
      page-break-inside: auto; /* Permitir romper si es muy grande */
    }

    /* Aplicar thead y tbody si no vienen en el HTML de entrada */
    table:not(:has(thead)) > tr:first-child th {
      /* Estilos de cabecera principal si no hay thead */
      background: linear-gradient(180deg, #fdfdfe, #f0f2f5);
      color: var(--primary-color);
      font-size: 10px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.8px; border-bottom: 2px solid var(--secondary-color);
    }
     table:not(:has(tbody)) > tr:not(:first-child) {
         /* Estilos de fila si no hay tbody */
         page-break-inside: avoid;
     }
     table:not(:has(tbody)) > tr:nth-child(even):not(:first-child) td { background-color: rgba(245, 247, 250, 0.5); }
     table:not(:has(tbody)) > tr:nth-child(odd):not(:first-child) td { background-color: var(--bg-white); }
     table:not(:has(tbody)) > tr:last-child td { border-bottom: none; }


    th, td {
      padding: 12px 15px; /* Mayor padding */
      text-align: left;
      border-bottom: 1px solid var(--border-color);
      vertical-align: middle; /* Alinear verticalmente */
      word-wrap: break-word; /* Romper palabras largas */
    }

    /* --- Cabeceras de Tabla Mejoradas --- */
    thead tr:first-child th { /* Cabecera principal (Ejercicio, Series...) */
      background: linear-gradient(180deg, #fdfdfe, #f0f2f5); /* Gradiente sutil gris */
      color: var(--primary-color);
      font-size: 10px;
      font-weight: 700; /* Más peso */
      text-transform: uppercase;
      letter-spacing: 0.8px;
      border-bottom: 2px solid var(--secondary-color);
      position: sticky; /* Puede no funcionar en PDF pero bueno tenerlo */
      top: 0;
      z-index: 1;
    }
    thead tr:first-child th:first-child { border-top-left-radius: var(--border-radius-md); }
    thead tr:first-child th:last-child { border-top-right-radius: var(--border-radius-md); }

    /* Cabeceras de Sección (Activación / Rutina) */
    .activation-header td,
    .routine-header td {
      color: var(--bg-white) !important;
      font-weight: 600;
      text-align: center;
      font-size: 12px; /* Ligeramente más grande */
      padding: 14px 15px; /* Mayor padding vertical */
      letter-spacing: 0.8px;
      text-transform: uppercase;
      border: none;
      text-shadow: 0 1px 1px rgba(0, 0, 0, 0.2);
      position: relative;
    }
    .activation-header td { background: var(--activation-color) !important; }
    .routine-header td { background: var(--routine-color) !important; }

    /* Línea sutil debajo de cabeceras de sección */
     .activation-header td::after,
     .routine-header td::after {
         content: '';
         position: absolute;
         bottom: 0; left: 0; right: 0;
         height: 2px;
         background: rgba(255, 255, 255, 0.2);
     }

    /* --- Filas y Celdas Mejoradas --- */
    tbody tr { page-break-inside: avoid; /* Intentar mantener filas juntas */ }
    tbody tr:last-child td { border-bottom: none; }

    /* Striping sutil y hover (hover solo visible en HTML) */
    tbody tr:nth-child(even) td { background-color: rgba(245, 247, 250, 0.5); } /* bg-light con transparencia */
    tbody tr:nth-child(odd) td { background-color: var(--bg-white); }
    tbody tr:hover td { background-color: var(--light-accent); } /* Solo para depuración en navegador */

    /* Columna de Ejercicio (primera) - Más destacada */
    tbody td:first-child {
      font-weight: 600; /* Más peso */
      color: var(--primary-color); /* Color principal */
      background-color: transparent !important; /* Quitar fondo de striping */
      border-right: 1px solid var(--border-color);
    }
    /* Asegurar que el striping no afecte a la primera celda */
    tbody tr:nth-child(even) td:first-child { background-color: transparent !important; }


    /* --- Secciones de Variantes "Next Level" --- */
    .variants-container, .side-variants-container {
      background-color: var(--bg-white); /* Fondo blanco */
      border-radius: var(--border-radius-md);
      padding: 20px 25px;
      margin-top: 15px;
      margin-bottom: 30px;
      border: 1px solid var(--variant-border); /* Borde amarillo */
      border-left: 6px solid var(--variant-accent); /* Borde izquierdo más grueso y color principal */
      page-break-inside: avoid;
      position: relative;
      box-shadow: var(--shadow-soft);
      overflow: hidden; /* Necesario para que el ::before no se salga */
    }
    /* Sello decorativo */
    .variants-container::before, .side-variants-container::before {
       content: 'VARIACIONES';
       position: absolute;
       top: 10px; right: -30px; /* Ajustar posición según sea necesario */
       background: var(--variant-accent);
       color: var(--bg-white);
       font-size: 9px;
       font-weight: 700;
       padding: 3px 30px;
       transform: rotate(45deg);
       letter-spacing: 0.5px;
       text-transform: uppercase;
       text-shadow: 0 1px 1px rgba(0,0,0,0.1);
       z-index: 1; /* Asegurar que esté encima */
    }
    /* Título General de la sección de variantes (si existe en el HTML) */
    .variants-container > .variants-title,
    .side-variants-container > .side-variants-title {
      font-weight: 700;
      color: var(--variant-text);
      font-size: 14px; /* Más grande */
      margin: 0 0 18px 0;
      letter-spacing: 0.6px;
      text-transform: uppercase;
      position: relative;
      padding-bottom: 5px;
      border-bottom: 2px solid var(--variant-border);
      display: inline-block;
       z-index: 2; /* Encima del sello */
    }

    /* Items individuales dentro de la sección de variantes */
    .variant-item, .side-variant-item {
      margin-bottom: 12px;
      padding-bottom: 12px;
      border-bottom: 1px dotted var(--variant-border); /* Separador punteado */
      page-break-inside: avoid;
       position: relative; z-index: 2; /* Encima del sello */
    }
    .variant-item:last-child, .side-variant-item:last-child {
      margin-bottom: 0; padding-bottom: 0; border-bottom: none;
    }

    /* Título de cada variante individual */
    .variant-title, .side-variant-title {
      font-weight: 600;
      color: var(--text-main); /* Texto principal */
      font-size: 12px;
      margin-bottom: 5px;
      display: flex;
      align-items: center;
      position: relative;
      padding-left: 20px; /* Espacio para icono */
       z-index: 2; /* Encima del sello */
    }
    /* Icono personalizado para variante */
    .variant-title::before, .side-variant-title::before {
      content: '💡'; /* O usar un icono SVG como data URI */
      position: absolute;
      left: 0;
      top: 1px;
      font-size: 14px;
      color: var(--variant-accent);
    }
    /* Descripción de la variante */
    .variant-description, .side-variant-description {
      font-size: 11px;
      color: var(--text-light);
      line-height: 1.6;
      padding-left: 20px; /* Alinear con título */
       z-index: 2; /* Encima del sello */
    }
    /* Flecha entre ejercicios en la variante */
    .arrow-right {
      color: var(--secondary-color);
      margin: 0 8px;
      font-weight: 700;
      font-size: 14px;
    }

    /* --- Control de Paginación y Estructura --- */
    .training-day-container {
        page-break-inside: avoid; /* Intentar mantener día junto */
        margin-bottom: 30px;
        padding-bottom: 10px; /* Pequeño padding inferior */
    }
    .page-break {
      page-break-before: always;
      height: 0;
      display: block;
      clear: both;
    }

    /* --- Clases de Utilidad --- */
    .text-center { text-align: center; }
    .text-bold { font-weight: 700; }

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

  <div class="page-wrapper">
    <div class="content-wrapper">
      <div class="disclaimer-container">
        <div class="disclaimer-title">Información Importante</div>
        <div class="disclaimer-content">
           <p>Este programa de entrenamiento ha sido diseñado específicamente para ti (${clientName}). Para maximizar tus resultados y garantizar tu seguridad, lee atentamente:</p>
           <p><strong>Consulta médica:</strong> Indispensable antes de iniciar, especialmente con condiciones preexistentes.</p>
           <p><strong>Interpretación visual:</strong></p>
           <ul>
             <li><span style="color: var(--activation-color); font-weight: bold;">Azul Medio:</span> Ejercicios de activación/calentamiento.</li>
             <li><span style="color: var(--routine-color); font-weight: bold;">Azul Oscuro:</span> Ejercicios principales de la rutina.</li>
             <li><span style="color: var(--variant-accent); font-weight: bold;">Amarillo:</span> Variantes o alternativas sugeridas.</li>
           </ul>
           <p><strong>Progresión:</strong> Adapta la intensidad gradualmente. Respeta descansos y técnica.</p>
           <p><strong>Técnica > Peso:</strong> Prioriza siempre la forma correcta. Consulta si tienes dudas.</p>
           <p><strong>Escucha tu cuerpo:</strong> Detente si sientes dolor agudo, mareos o dificultad respiratoria anormal.</p>
          <div class="disclaimer-footer">
            Programa confidencial para uso exclusivo de ${clientName}. © ${currentYear}. Prohibida su distribución.
          </div>
        </div>
      </div>

      <div class="dynamic-content">${modifiedHtml}</div>

    </div> </div> <div class="footer">
    <div class="footer-left">
      <img src="${logoBase64}" alt="Logo" />
    </div>
    <div class="footer-center">
        ${clientName} - Plan Personalizado
    </div>
    <div class="footer-right">© ${currentYear}</div>
  </div>

</body>
</html>`;

      // --- Lanzar Puppeteer ---
      console.log("Lanzando navegador headless...");
      browser = await puppeteer.launch({
        headless: true,
        args: [
          "--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage",
          "--disable-gpu", "--font-render-hinting=none" // Puede ayudar con fuentes
        ],
      });

      const page = await browser.newPage();
      console.log("Página abierta.");
      // Establecer viewport ayuda a la consistencia antes de generar PDF A4
      await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 1 });

      console.log("Estableciendo contenido HTML en la página...");
      await page.setContent(styledHtml, { waitUntil: "networkidle0", timeout: 60000 }); // Esperar carga completa de red (fuentes)
      console.log("Contenido HTML cargado.");

      // --- Script para Organizar el Contenido Antes de Imprimir ---
      // Este script es VITAL para agrupar correctamente los elementos por día
      // y asegurar que el CSS de page-break funcione como se espera.
      console.log("Ejecutando script de organización de contenido en la página...");
      await page.evaluate(() => {
        const contentArea = document.querySelector('.dynamic-content');
        if (!contentArea) {
          console.error("No se encontró el contenedor .dynamic-content");
          return;
        }

        // 1. Identificar elementos relevantes directamente dentro de .dynamic-content
        const elements = Array.from(contentArea.children);
        const variantContainers = elements.filter(el => el.matches('.variants-container, .side-variants-container'));

        // 2. Asignar data-day-number a las variantes basado en su contenido
        variantContainers.forEach((variant) => {
            // Busca 'Día X' en CUALQUIER parte del innerHTML de la variante
            const dayMatch = variant.innerHTML.match(/D[íi]a\s+(\d+)/i);
            if (dayMatch && dayMatch[1]) {
                variant.dataset.dayNumber = dayMatch[1];
            } else {
                console.warn("No se pudo determinar el día para la variante:", variant.id || variant.outerHTML.substring(0, 50));
                // Considerar asignarle un día por defecto o marcarla de alguna forma si es un error
                 variant.dataset.dayNumber = 'undefined'; // Marcarla si no se encuentra día
            }
        });

        // 3. Reestructurar: Crear contenedores por día y mover elementos
        let currentDayContainer = null;
        const finalStructure = document.createDocumentFragment(); // Usar fragmento para eficiencia

        elements.forEach((el) => {
             // Ignorar las variantes aquí, se moverán después
             if (el.matches('.variants-container, .side-variants-container')) {
                 return; // Saltar variante en esta pasada
             }

            if (el.matches('.day-title')) {
                // Iniciar un nuevo contenedor de día
                currentDayContainer = document.createElement('div');
                currentDayContainer.className = 'training-day-container';

                // Añadir page-break *antes* de este contenedor, excepto si es el primero
                if (finalStructure.children.length > 0) {
                    const pageBreak = document.createElement('div');
                    pageBreak.className = 'page-break';
                    finalStructure.appendChild(pageBreak);
                }

                finalStructure.appendChild(currentDayContainer);
                currentDayContainer.appendChild(el); // Mover el título h2

                // Extraer número de día del título para asociar variantes más tarde
                const dayNumberMatch = el.textContent.match(/D[íi]a\s+(\d+)/i);
                if (dayNumberMatch && dayNumberMatch[1]) {
                    currentDayContainer.dataset.dayNumber = dayNumberMatch[1];
                } else {
                     console.warn("Título de día sin número reconocible:", el.textContent);
                     currentDayContainer.dataset.dayNumber = 'unknown';
                }

            } else if (el.matches('table') || el.matches('.table-spacer')) {
                // Mover tabla o espaciador al contenedor del día actual (si existe)
                if (currentDayContainer) {
                    currentDayContainer.appendChild(el);
                } else {
                     // Elemento huérfano antes del primer título de día? (poco probable con la lógica previa)
                     console.warn("Elemento tabla/espaciador encontrado antes del primer título de día:", el.tagName);
                     finalStructure.appendChild(el); // Añadir directamente al fragmento
                }
            } else {
                 // Mover cualquier otro elemento inesperado al contenedor actual o al fragmento
                 console.warn("Elemento inesperado encontrado:", el.tagName, el.className);
                 if (currentDayContainer) {
                     currentDayContainer.appendChild(el);
                 } else {
                    finalStructure.appendChild(el);
                 }
            }
        });

         // 4. Mover las variantes (que se saltaron antes) al final de su contenedor de día correspondiente
        variantContainers.forEach(variant => {
            const dayNum = variant.dataset.dayNumber;
            if (dayNum && dayNum !== 'undefined' && dayNum !== 'unknown') {
                // Buscar el contenedor de día correspondiente en la nueva estructura (finalStructure)
                const targetContainer = finalStructure.querySelector(`.training-day-container[data-day-number="${dayNum}"]`);
                if (targetContainer) {
                    // Eliminar espaciador extra justo antes si el último elemento es un espaciador
                    if (targetContainer.lastElementChild && targetContainer.lastElementChild.matches('.table-spacer')) {
                        targetContainer.lastElementChild.remove();
                    }
                     // Crear un pequeño espacio antes de la variante para separarla de la tabla
                     const variantSpacer = document.createElement('div');
                     variantSpacer.style.height = '10px'; // Espacio consistente
                     targetContainer.appendChild(variantSpacer);

                    targetContainer.appendChild(variant); // Mover la variante al final del contenedor
                } else {
                    console.warn(`No se encontró contenedor para el día ${dayNum} en la estructura final.`);
                    // Decidir qué hacer: añadir al final general, error, etc.
                    finalStructure.appendChild(variant); // Opción: añadir al final del documento
                }
            } else {
                // Variante sin día asignado o con día inválido, añadir al final del documento
                 console.warn("Variante sin día válido, añadiendo al final:", variant.id || variant.outerHTML.substring(0,50));
                 finalStructure.appendChild(variant);
            }
        });


        // 5. Reemplazar el contenido original con la nueva estructura organizada
        contentArea.innerHTML = ''; // Limpiar contenido original
        contentArea.appendChild(finalStructure); // Añadir la estructura organizada
      });
      console.log("Script de organización completado.");

      // --- Generar PDF ---
      console.log("Generando el archivo PDF...");
      await page.pdf({
        path: filePath,
        format: 'A4',
        printBackground: true, // ¡Esencial para fondos y colores!
        margin: { // Márgenes cero porque usamos header/footer fijos y padding
          top: '0px',
          right: '0px',
          bottom: '0px',
          left: '0px',
        },
        displayHeaderFooter: false, // No usar header/footer de puppeteer
        preferCSSPageSize: true, // Usar el @page size
        timeout: 90000 // Timeout más largo (90s) por si el CSS es complejo
      });

      console.log("PDF 'Next Level' generado con éxito en:", filePath);
      resolve(filePath); // Devolver la ruta del archivo

    } catch (error) {
      console.error("Error detallado durante la generación del PDF:", error);
      if (browser) {
        try { await browser.close(); console.log("Navegador cerrado tras error."); }
        catch (closeError) { console.error("Error al cerrar navegador tras error:", closeError); }
      }
      reject(new Error(`Falló la generación del PDF: ${error.message}`));

    } finally {
      // Asegurarse de cerrar el navegador si aún está abierto y no hubo error previo
      if (browser && browser.process() && !browser.process().killed) {
          try { await browser.close(); console.log("Navegador cerrado correctamente al finalizar."); }
          catch(closeError) { console.error("Error al cerrar navegador en finally:", closeError); }
      } else if (browser && (!browser.process() || browser.process().killed)) {
          console.log("El navegador ya estaba cerrado o no se pudo acceder al proceso.");
      }
    }
  });
}

module.exports = { generatePDF };