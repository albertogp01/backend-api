const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");
const os = require("os");
// 1. Modificar la Importación (Línea 5 aprox.)
// Importar la NUEVA función principal de chartService.js
const { createDynamicCoverPage } = require('./services/chartService'); // Ajusta la ruta si es necesario

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
            const logoPath = path.resolve(__dirname, "../assets/logo.png"); // Asegúrate que la ruta al logo sea correcta
            let logoBase64 = "";
            if (fs.existsSync(logoPath)) {
                logoBase64 = `data:image/png;base64,${fs.readFileSync(logoPath).toString("base64")}`;
            } else {
                console.error("Error: El archivo del logo no existe en la ruta:", logoPath);
                // Considera si quieres lanzar un error o usar un placeholder
            }

            // --- Generar HTML de la Portada Dinámica --- (Paso 2)
            console.log("Generando HTML de la portada...");
            // Pasamos htmlContent (la rutina) para análisis interno en chartService (si es necesario)
            // y logoBase64 para que la portada pueda usarlo.
            const coverPageHtmlString = createDynamicCoverPage(clientName, htmlContent, logoBase64);
            console.log("HTML de la portada generado.");


            // --- Mantener tu lógica de procesamiento para el contenido de la rutina ---
            // Procesar HTML - CORREGIDO: Mejorado el manejo del primer día
            let modifiedHtml = htmlContent.replace(/<\/table>\s*<table>/g, "</table><div class='table-spacer'></div><table>");

            // Corregir el primer día especialmente para evitar problemas
            if (modifiedHtml.startsWith("<table>")) {
                const firstDayMatch = modifiedHtml.match(/<th colspan="5">(Día 1:.+?)<\/th>/);
                if (firstDayMatch) {
                    // Añadir clase first-day-title para el margen especial
                    modifiedHtml = `<h2 class="day-title first-day-title">${firstDayMatch[1]}</h2>${modifiedHtml}`;
                    // Eliminar el th original del día 1
                    modifiedHtml = modifiedHtml.replace(/<thead>\s*<tr[^>]*>\s*<th colspan="5">Día 1:.+?<\/th>\s*<\/tr>\s*<\/thead>/i, ''); // Más robusto
                }
            }

            // Procesar el resto de los días
            modifiedHtml = modifiedHtml.replace(
                /<thead>\s*<tr[^>]*>\s*<th colspan="5">(Día \d+:.+?)<\/th>\s*<\/tr>\s*<\/thead>/gi, // Más robusto y global
                (match, dayTitle) => `</table><h2 class="day-title">${dayTitle}</h2><table>` // No añade <thead> aquí
            );
             // Eliminar tablas vacías que pueden quedar al inicio o por los reemplazos
            modifiedHtml = modifiedHtml.replace(/<table>\s*<\/table>/g, '');
            modifiedHtml = modifiedHtml.replace(/^<div class='table-spacer'><\/div>/, ''); // Eliminar spacer inicial si queda

            const currentYear = new Date().getFullYear();
            const creationDate = new Date().toLocaleDateString("es-ES", {
                year: "numeric", month: "long", day: "numeric"
            });


            // --- Ensamblar el HTML COMPLETO para TODO el PDF --- (Paso 3)
            const fullPdfHtml = `
                ${coverPageHtmlString}

                <div style="page-break-before: always;"></div>

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
                        /* Copia aquí TODOS los estilos CSS que tenías dentro del bloque */
                        /* 'styledHtml' original, EXCEPTO los que eran específicos */
                        /* de la portada (clases .cover-page, etc.) */

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
                            --variant-bg: #fffde7; /* Mantener para consistencia si se usa */
                            --variant-border: #ffee58; /* Mantener para consistencia si se usa */
                            --variant-text: #333333; /* Mantener para consistencia si se usa */
                            --variant-accent: #ffd600;
                        }

                        body {
                            font-family: 'Inter', 'Arial', sans-serif;
                            color: var(--dark-gray);
                            line-height: 1.6;
                            margin: 0;
                            padding: 0;
                            font-size: 11px; /* Ajustado de 10px a 11px como en el original */
                            position: relative;
                            width: 100%;
                            background-color: white;
                            min-height: 100vh; /* Usar min-height */
                            letter-spacing: 0.3px;
                            -webkit-print-color-adjust: exact; /* Importante para Puppeteer */
                            print-color-adjust: exact; /* Estándar */
                        }

                        .header { /* Estilo del header para páginas de rutina */
                            background: linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%);
                            padding: 15px 0;
                            margin: 0;
                            display: flex; /* Mantener flex */
                            justify-content: space-between;
                            align-items: center;
                            color: white;
                            border-bottom: 4px solid var(--accent-color);
                            width: 100%;
                            position: relative; /* Puede que no sea necesario fixed si no está en @page */
                            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.12);
                            box-sizing: border-box; /* Asegurar que padding no añada tamaño */
                            /* ¡¡ASEGÚRATE DE COPIAR TODOS TUS ESTILOS ORIGINALES AQUÍ!! */
                        }

                        .header-content {
                            display: flex;
                            justify-content: space-between;
                            width: 100%;
                            padding: 0 30px; /* Padding dentro del contenedor */
                            align-items: center;
                            box-sizing: border-box;
                        }

                        .header img {
                            width: 140px;
                            height: auto;
                            padding: 6px; /* Añadido padding */
                            border-radius: calc(var(--border-radius) + 2px);
                            filter: brightness(0) invert(1);
                            transition: all 0.3s ease; /* Transición original */
                        }

                        .header .info {
                            text-align: right;
                            font-size: 13px; /* Ajustado tamaño */
                            padding: 8px 18px; /* Padding original */
                            background-color: rgba(255, 255, 255, 0.18); /* Fondo original */
                            border-radius: var(--border-radius);
                            backdrop-filter: blur(10px); /* Efecto original */
                            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.08); /* Sombra original */
                            border-left: 3px solid rgba(255, 255, 255, 0.5); /* Borde original */
                        }
                        .header .info p { margin: 5px 0; font-weight: 500; letter-spacing: 0.4px; }
                        .header .info strong { font-weight: 600; letter-spacing: 0.5px; }


                        .content-wrapper {
                            padding: 30px;
                            width: 100%; /* Asegurar ancho completo */
                            box-sizing: border-box; /* Importante para padding */
                            padding-bottom: 80px; /* Espacio para el footer fijo */
                            background-color: #ffffff; /* Fondo blanco */
                        }

                        /* Estilos para el disclaimer - CENTRADO Y TEXTO NEGRO */
                        .disclaimer-container {
                            background-color: transparent; /* Fondo transparente como en el original */
                            border-radius: var(--border-radius);
                            padding: 25px 30px;
                            margin-bottom: 35px;
                            position: relative;
                            overflow: hidden;
                            border-left: none; /* Sin borde izquierdo */
                            box-shadow: none; /* Sin sombra */
                            page-break-inside: avoid; /* Evitar corte */
                            text-align: center; /* Centrar el contenedor del título */
                        }

                        .disclaimer-title {
                            font-weight: 700;
                            color: var(--primary-color);
                            font-size: 16px;
                            margin-bottom: 20px;
                            letter-spacing: 0.8px;
                            text-transform: uppercase;
                            position: relative;
                            padding-left: 0; /* Sin padding izquierdo */
                            display: inline-block; /* Para que ::after funcione bien */
                        }

                        .disclaimer-title::after {
                            content: "";
                            position: absolute;
                            bottom: -5px;
                            left: 0; /* Alinear a la izquierda del título */
                            width: 100%; /* Ancho completo del título */
                            height: 2px;
                            background: linear-gradient(90deg, var(--accent-color) 0%, rgba(33, 150, 243, 0.3) 100%);
                            border-radius: 2px;
                        }

                        .disclaimer-content {
                            font-size: 11px; /* Tamaño original */
                            color: #000000; /* Texto negro */
                            line-height: 1.7;
                            text-align: left; /* Alinear el contenido a la izquierda */
                            max-width: 800px; /* Limitar ancho si es necesario */
                            margin: 0 auto; /* Centrar el bloque de contenido */
                        }

                        .disclaimer-content p { margin-bottom: 12px; }
                        .disclaimer-content strong { color: var(--primary-color); font-weight: 600; }
                        .disclaimer-content ul {
                             padding-left: 20px;
                             margin: 15px 0;
                             /* Para centrar la lista como bloque si es necesario */
                             /* display: inline-block; */
                             /* text-align: left; */
                             /* Si no, quitar display y text-align */
                         }
                        .disclaimer-content li { margin-bottom: 8px; }

                        .disclaimer-footer {
                             margin-top: 20px;
                             padding-top: 15px;
                             border-top: 1px solid #e3e8f0;
                             font-style: italic;
                             font-size: 10px;
                             color: var(--medium-gray);
                             text-align: center; /* Centrar texto del footer del disclaimer */
                         }

                        /* Resto de estilos de la rutina... */
                        .table-spacer { height: 12px; width: 100%; } /* Espaciador entre tablas */

                        /* Evitar que elementos <p> o <div> después de table tengan margen */
                        table + * {
                           margin-top: 0 !important;
                           padding-top: 0 !important;
                        }
                        /* Ocultar br que a veces se añaden */
                        table + br, .table-spacer + br { display: none; }

                        table {
                            width: 100%;
                            border-collapse: separate; /* Usar separate para border-radius */
                            border-spacing: 0;
                            margin-bottom: 0 !important; /* Quitar margen inferior para controlar con spacer */
                            font-size: 10px; /* Tamaño fuente tabla */
                            page-break-inside: auto; /* Permitir corte si es necesario, JS lo gestionará */
                            border-radius: var(--border-radius);
                            overflow: hidden; /* Para que border-radius funcione */
                            box-shadow: var(--box-shadow);
                            border: 1px solid #e0e0e0;
                            background-color: white; /* Fondo blanco explícito */
                            position: relative; /* Para pseudo-elementos */
                         }

                        /* Pseudo-elemento decorativo opcional */
                        table::after {
                           content: '';
                           position: absolute;
                           top: 0; right: 0;
                           width: 8px; height: 100%;
                           background: linear-gradient(90deg, rgba(33,150,243,0) 0%, rgba(33,150,243,0.06) 100%);
                           pointer-events: none;
                           border-top-right-radius: var(--border-radius);
                           border-bottom-right-radius: var(--border-radius);
                        }

                        th, td {
                            padding: 12px 14px;
                            text-align: left;
                            word-wrap: break-word;
                            border: none; /* Quitar borde por defecto */
                            border-bottom: 1px solid #e3e8f0;
                            border-right: 1px solid #e3e8f0;
                            position: relative; /* Para pseudo-elementos */
                            vertical-align: middle;
                            transition: background-color 0.2s ease;
                        }

                        th:last-child, td:last-child { border-right: none; } /* Quitar borde derecho de la última celda */
                        tr:last-child td { border-bottom: none; } /* Quitar borde inferior de la última fila */

                        .day-title {
                            font-size: 18px;
                            font-weight: 700;
                            color: var(--primary-color);
                            margin: 30px 0 20px 0; /* Margen original */
                            padding-bottom: 10px; /* Espacio para la línea */
                            position: relative;
                            letter-spacing: 0.6px;
                            padding-left: 15px; /* Padding izquierdo original */
                            /* max-width: 80%; No necesario si no es inline-block */
                            /* display: inline-block; No usar inline-block para que ocupe ancho */
                            text-transform: uppercase;
                            border-bottom: 2px solid transparent; /* Espacio reservado */
                        }

                        /* Ajuste especial para el primer día en la primera página de rutina */
                         .first-day-title {
                            margin-top: 0; /* Sin margen superior extra si ya hay disclaimer */
                         }


                        /* Línea decorativa bajo el título */
                        .day-title::after {
                            content: "";
                            position: absolute;
                            bottom: 0;
                            left: 15px; /* Alineado con el padding */
                            width: calc(100% - 15px); /* Ancho relativo al padding */
                            height: 2px;
                            background: linear-gradient(90deg, var(--accent-color) 0%, rgba(255,255,255,0) 100%);
                            border-radius: 1px;
                        }

                        /* Estilos para cabeceras de Activación y Rutina (dentro de <tbody>) */
                        .activacion-header td,
                        .rutina-header td {
                            color: white !important; /* Forzar color blanco */
                            font-weight: 600;
                            text-align: center;
                            font-size: 11px;
                            padding: 14px 15px; /* Padding original */
                            letter-spacing: 0.6px;
                            position: relative;
                            text-transform: uppercase;
                            border-bottom: 2px solid transparent; /* Espacio para borde inferior real */
                        }

                        .activacion-header td {
                            background-color: var(--activation-color) !important;
                            border-bottom-color: #1e88e5; /* Borde inferior color */
                        }

                        .rutina-header td {
                            background-color: var(--routine-color) !important;
                            border-bottom-color: #0d47a1; /* Borde inferior color */
                        }

                         /* Línea sutil dentro de las cabeceras */
                        .activacion-header td::after,
                        .rutina-header td::after {
                           content: '';
                           position: absolute;
                           bottom: 0; left: 0; right: 0;
                           height: 1px;
                           background: rgba(255, 255, 255, 0.2);
                        }

                        /* Estilos para cabeceras de tabla estándar (<th> fuera de <tbody>) */
                        thead th { /* Asumiendo que TH está en THEAD ahora */
                            background-color: var(--secondary-color);
                            color: white;
                            font-size: 10px; /* Tamaño original */
                            font-weight: 600;
                            text-transform: uppercase;
                            letter-spacing: 0.8px;
                            padding: 13px 14px;
                            position: relative;
                             border-bottom: 1px solid rgba(255, 255, 255, 0.2); /* Borde sutil */
                        }

                        /* Estilo alterno de filas */
                        tbody tr:nth-child(even) td { background-color: var(--row-even); }
                        tbody tr:nth-child(odd) td { background-color: var(--row-odd); }

                        /* Hover en celdas */
                        tbody tr td:hover { background-color: rgba(33, 150, 243, 0.07) !important; }

                        /* Estilo primera celda de datos (Ejercicio) */
                        tbody tr td:first-child {
                            /* border-left: none; Quitado borde izquierdo */
                            font-weight: 500;
                            background-color: var(--day-color); /* Fondo diferente */
                            color: var(--day-text);
                            border-right: 2px solid #e3f2fd; /* Borde derecho más grueso */
                        }

                         /* Redondeo de esquinas inferiores */
                         tbody tr:last-child td:first-child { border-bottom-left-radius: calc(var(--border-radius) - 1px); }
                         tbody tr:last-child td:last-child { border-bottom-right-radius: calc(var(--border-radius) - 1px); }
                         /* Redondeo de esquinas superiores (si no hay thead) - Ajustar si se usa thead */
                         /* tbody tr:first-child td:first-child { border-top-left-radius: calc(var(--border-radius) - 1px); } */
                         /* tbody tr:first-child td:last-child { border-top-right-radius: calc(var(--border-radius) - 1px); } */


                        /* Estilos variantes */
                        .variants-container, .side-variants-container {
                           background-color: white; /* Fondo blanco */
                           border-radius: var(--border-radius);
                           position: relative;
                           overflow: hidden; /* Para border-radius */
                           border-left: none; /* Sin borde */
                           box-shadow: none; /* Sin sombra */
                           page-break-inside: avoid; /* Evitar cortes */
                           margin-top: 8px; /* Reducido de 5px para pegar más a la tabla */
                           margin-bottom: 25px; /* Margen inferior */
                           padding: 15px 25px; /* Padding general */
                           border: 1px solid #e0e0e0; /* Borde sutil similar a la tabla */
                         }

                        .side-variants-container { padding: 15px 22px; }

                        .variants-container::after, .side-variants-container::after { display: none; }

                        .variants-title, .side-variants-title {
                            font-weight: 700;
                            color: #333333; /* Color oscuro */
                            font-size: 14px; /* Tamaño título variantes */
                            margin-bottom: 12px;
                            letter-spacing: 0.8px;
                            text-transform: uppercase;
                            position: relative;
                            padding-left: 0; /* Sin padding */
                            display: inline-block; /* Para línea inferior */
                        }
                        .side-variants-title { display: flex; align-items: center; }

                         /* Línea decorativa bajo el título de variantes */
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

                         /* Estilos de items de variantes */
                         .variant-item, .side-variant-item {
                            margin-bottom: 8px;
                            padding-bottom: 8px;
                            border-bottom: 1px dashed #eee; /* Separador sutil */
                            position: relative;
                         }
                        .variant-item:last-child, .side-variant-item:last-child {
                            margin-bottom: 0;
                            padding-bottom: 0;
                            border-bottom: none; /* Sin línea en el último */
                         }

                        /* Título de cada variante individual */
                        .variant-title, .side-variant-title {
                            font-weight: 600;
                            color: #333333; /* Color oscuro */
                            font-size: 11px; /* Tamaño fuente */
                            margin-bottom: 7px;
                            letter-spacing: 0.4px;
                            position: relative;
                            padding-left: 12px; /* Espacio para el bullet */
                         }
                        .side-variant-title { display: flex; align-items: center; } /* Reaplicar flex */

                         /* Bullet decorativo */
                        .variant-title::before, .side-variant-title::before {
                             content: '•';
                             position: absolute;
                             left: 0;
                             top: 0px; /* Ajustar verticalmente */
                             color: var(--variant-accent);
                             font-size: 14px;
                             font-weight: bold;
                         }

                        /* Descripción de la variante */
                        .variant-description, .side-variant-description {
                            font-size: 10px;
                            color: #555; /* Gris un poco más claro */
                            line-height: 1.4;
                            padding-left: 12px; /* Alinear con el título */
                         }

                        .arrow-right {
                             color: var(--accent-color);
                             margin: 0 5px;
                             font-weight: 600;
                         }

                        /* Footer Fijo */
                        .footer {
                            position: fixed; /* Fijo en la parte inferior */
                            bottom: 0;
                            left: 0;
                            width: 100%;
                            height: 55px; /* Altura fija */
                            background: linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%);
                            color: white;
                            font-size: 10px;
                            border-top: 3px solid var(--accent-color);
                            display: flex;
                            justify-content: space-between;
                            align-items: center;
                            padding: 0 30px; /* Padding horizontal */
                            box-sizing: border-box; /* Incluir padding en width */
                            z-index: 1000; /* Asegurar que esté encima */
                            box-shadow: 0 -4px 15px rgba(0, 0, 0, 0.1); /* Sombra superior */
                        }

                         .footer-left, .footer-center, .footer-right {
                             flex: 1;
                             display: flex; /* Usar flex para alinear contenido */
                             align-items: center; /* Centrar verticalmente */
                         }

                         .footer-left { justify-content: flex-start; } /* Alinear contenido a la izquierda */
                         .footer-left img {
                             height: 15px;
                             width: auto;
                             filter: brightness(0) invert(1);
                             margin-right: 10px; /* Espacio si hay texto */
                         }

                        .footer-center {
                            justify-content: center; /* Centrar contenido */
                            /* Puedes añadir contenido aquí, como número de página */
                            /* Ejemplo: <span class="page-number"></span> */
                         }

                         .footer-right {
                            justify-content: flex-end; /* Alinear contenido a la derecha */
                             font-weight: 400;
                             letter-spacing: 0.5px;
                         }

                        /* Contenedor para lógica de page-break-inside */
                         .training-day-container {
                             page-break-inside: avoid; /* Intentar mantener todo el día junto */
                             margin-bottom: 35px; /* Espacio entre días */
                             position: relative;
                         }
                         /* Asegurar que elementos dentro del día queden juntos si es posible */
                        .training-day-container table,
                        .training-day-container .variants-container,
                        .training-day-container .side-variants-container {
                             page-break-inside: avoid;
                         }

                        /* Clase para forzar salto de página */
                        .page-break {
                            page-break-before: always;
                            display: block;
                            height: 0;
                            width: 100%;
                            margin: 0; padding: 0; border: 0;
                         }

                        /* Contenedor para añadir margen superior en páginas nuevas */
                        .page-content {
                            /* padding-top: 50px; El script de evaluate lo añadirá dinámicamente si es necesario */
                        }

                        /* Espaciador al final del contenido principal para no solapar con footer */
                        .content-spacer { height: 80px; width: 100%; } /* Aumentado para asegurar espacio */


                        /* Estilos específicos de impresión y @page */
                        @page {
                            margin: 0; /* Sin márgenes por defecto, controlados por header/footer/padding */
                            size: A4;
                         }
                        /* @page :first { margin-top: 0; } No necesario si la portada es HTML separado */
                        @page :not(:first) { /* Estilos para páginas después de la portada */
                             /* Se puede definir margin-top/bottom aquí si no se usa header/footer fijo */
                             /* margin-top: 80px; Ejemplo */
                             /* margin-bottom: 70px; Ejemplo */
                         }

                        /* Mensaje de carga (si se usa) */
                         @keyframes pulse {
                             0% {opacity: 0.6;}
                             50% {opacity: 1;}
                             100% {opacity: 0.6;}
                         }
                        .loading-message {
                             position: fixed; top: 50%; left: 50%;
                             transform: translate(-50%, -50%);
                             background-color: rgba(255, 255, 255, 0.9);
                             padding: 20px 30px;
                             border-radius: var(--border-radius);
                             box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
                             z-index: 9999;
                             animation: pulse 2s infinite ease-in-out;
                             text-align: center; font-weight: 500;
                         }
                    </style>
                </head>
                <body>
                    <div class="main-content-wrapper"> <div class="header">
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

                            <div class="content">
                                ${modifiedHtml} </div>
                            <div class="content-spacer"></div> </div>

                        <div class="footer">
                            <div class="footer-left"><img src="${logoBase64}" alt="Logo" /></div>
                            <div class="footer-center">
                                </div>
                            <div class="footer-right">© ${currentYear} Fitform. Todos los derechos reservados</div>
                        </div>
                    </div> </body>
                </html>
            `;


            // Lanzar navegador con opciones optimizadas
            const browser = await puppeteer.launch({
                headless: true, // Mantener true para compatibilidad
                args: [
                    "--no-sandbox",
                    "--disable-setuid-sandbox",
                    "--disable-dev-shm-usage", // Importante en entornos limitados
                    "--disable-gpu" // A menudo innecesario para renderizado de HTML/CSS
                ]
            });

            const page = await browser.newPage();

            // Configurar viewport para A4 (aproximado en píxeles a 96 DPI)
            // Es mejor confiar en page.pdf({ format: 'A4' }) pero esto puede ayudar al renderizado inicial
            await page.setViewport({
                width: 794,  // ~210mm a 96 DPI
                height: 1123, // ~297mm a 96 DPI
                deviceScaleFactor: 1 // O 2 para simular alta resolución si es necesario
            });

            // 4. Actualizar page.setContent
            console.log("Estableciendo contenido COMPLETO en Puppeteer...");
            // Usar 'load' o 'domcontentloaded' puede ser más rápido si no hay recursos externos críticos
            // 'networkidle0' espera a que no haya conexiones de red durante 500ms
            await page.setContent(fullPdfHtml, { waitUntil: 'networkidle0', timeout: 60000 }); // Aumentar timeout
            console.log("Contenido establecido.");


            // 5. Mantener page.evaluate (Ejecutar script para organizar días/variantes en el NAVEGADOR)
            console.log("Ejecutando script de evaluación en la página...");
            // Este script ahora opera sobre el HTML de la rutina (después del page-break)
            await page.evaluate(() => {
                 // --- Lógica de Organización del DOM (adaptada del original) ---

                 // Añadir IDs a las variantes para referencia si aún no los tienen
                document.querySelectorAll('.variants-container, .side-variants-container').forEach((variant, idx) => {
                    if (!variant.id) {
                         variant.id = 'variant-' + idx;
                    }
                     // Extraer el número del día al que pertenece esta variante (si es posible del HTML)
                    const dayMatch = variant.innerHTML.match(/Día\s+(\d+)/i); // Buscar 'Día X' dentro del HTML de la variante
                     if (dayMatch && !variant.dataset.dayNumber) {
                         variant.dataset.dayNumber = dayMatch[1];
                     }
                 });

                 // Organizar contenido por día en contenedores '.training-day-container'
                 const contentDiv = document.querySelector('.content'); // El div que contiene modifiedHtml
                 if (contentDiv) {
                    const dayTitles = contentDiv.querySelectorAll('.day-title');
                    const allElements = Array.from(contentDiv.childNodes); // Todos los nodos hijos directos
                    let currentDayContainer = null;
                    let currentDayNumber = null;

                    allElements.forEach(element => {
                        if (element.nodeType === Node.ELEMENT_NODE) {
                            if (element.classList.contains('day-title')) {
                                // Iniciar nuevo contenedor de día
                                currentDayContainer = document.createElement('div');
                                currentDayContainer.className = 'training-day-container';
                                const dayNumberMatch = element.textContent.match(/Día\s+(\d+)/i);
                                if (dayNumberMatch) {
                                    currentDayNumber = dayNumberMatch[1];
                                    currentDayContainer.dataset.dayNumber = currentDayNumber;
                                }
                                contentDiv.appendChild(currentDayContainer); // Añadir el contenedor al DOM
                                currentDayContainer.appendChild(element); // Mover el título al contenedor
                            } else if (currentDayContainer) {
                                // Mover tablas, spacers y variantes al contenedor del día actual
                                if (element.tagName === 'TABLE' || element.classList.contains('table-spacer') || element.classList.contains('variants-container') || element.classList.contains('side-variants-container')) {
                                    // Asociar variantes con el día si no lo están ya
                                    if ((element.classList.contains('variants-container') || element.classList.contains('side-variants-container')) && !element.dataset.dayNumber && currentDayNumber) {
                                         element.dataset.dayNumber = currentDayNumber;
                                    }
                                    currentDayContainer.appendChild(element);
                                } else {
                                    // Si encontramos algo que no es título, tabla, spacer o variante, podría indicar fin de día
                                    // O simplemente moverlo si pertenece lógicamente
                                    // currentDayContainer.appendChild(element); // Opcional: mover otros elementos
                                }
                            }
                        } else if (element.nodeType === Node.TEXT_NODE && element.textContent.trim() !== '') {
                            // Manejar nodos de texto inesperados si es necesario
                             // if (currentDayContainer) currentDayContainer.appendChild(element.cloneNode(true));
                        }
                    });
                 }


                // Renombrar títulos de variantes si es necesario
                 document.querySelectorAll('.variants-container .variants-title, .side-variants-container .side-variants-title').forEach(titleEl => {
                    // Solo cambiar si NO es el título individual de la variante (evitar sobreescribir "Curl Bíceps:")
                    // Esta lógica puede necesitar ajuste dependiendo de tu HTML exacto
                    if (titleEl.textContent.toLowerCase().includes('día')) { // Asumiendo que el título general contiene "Día"
                       titleEl.textContent = "VARIANTES";
                    }
                 });

                // --- Lógica de Saltos de Página y Colocación de Variantes (MEJORADA) ---
                const pageHeight = 1123; // Altura A4 aproximada en px (ajustar si es necesario)
                const footerHeight = 55; // Altura del footer fijo
                const headerHeight = 70; // Altura estimada del header
                const topMargin = 50; // Margen superior deseado en páginas nuevas
                const bottomSafetyMargin = 75; // Margen de seguridad sobre el footer (footerHeight + un poco más)
                const effectivePageHeight = pageHeight - bottomSafetyMargin - headerHeight - topMargin; // Espacio útil estimado

                document.querySelectorAll('.training-day-container').forEach((dayContainer, dayIndex) => {
                     const dayElements = Array.from(dayContainer.children);
                     let currentHeight = 0;
                     let needsPageBreak = dayIndex > 0; // Añadir page-break antes de cada día excepto el primero

                    if (needsPageBreak) {
                        const pageBreak = document.createElement('div');
                        pageBreak.className = 'page-break';
                        dayContainer.before(pageBreak); // Insertar antes del contenedor del día

                        // Añadir padding superior al contenedor del día para simular margen
                        dayContainer.style.paddingTop = `${topMargin}px`;
                        currentHeight += topMargin; // Contar el padding como altura usada
                    } else {
                        // El primer día no necesita page-break, pero sí podría necesitar padding si no hay disclaimer
                         // O si el disclaimer es corto. Ajustar según diseño.
                         dayContainer.style.paddingTop = `${topMargin / 2}px`; // Menos padding para el primer día
                         currentHeight += topMargin / 2;
                    }

                    let lastElement = null;
                     dayElements.forEach((element, elIndex) => {
                         const elementHeight = element.getBoundingClientRect().height;
                         const elementTop = element.getBoundingClientRect().top; // Posición actual

                        // Calcular dónde estaría si estuviera en la página actual tras elementos anteriores
                        const projectedPosition = currentHeight + elementHeight;

                        // Comprobar si el elemento cabe en el espacio restante de la página actual
                        if (projectedPosition > effectivePageHeight + (needsPageBreak ? 0 : headerHeight)) { // Si se pasa del espacio útil
                             // Necesita salto de página ANTES de este elemento
                            const pageBreak = document.createElement('div');
                            pageBreak.className = 'page-break';

                            // Insertar el salto antes del elemento actual
                            element.before(pageBreak);

                            // Crear contenedor para padding top en la nueva página
                             const pageContentWrapper = document.createElement('div');
                             pageContentWrapper.style.paddingTop = `${topMargin}px`; // Margen superior
                             element.before(pageContentWrapper); // Insertar wrapper antes del elemento
                             pageContentWrapper.appendChild(element); // Mover el elemento dentro del wrapper

                             // Resetear altura para la nueva página (altura del elemento + padding)
                            currentHeight = elementHeight + topMargin;
                             needsPageBreak = false; // Ya hemos hecho el break
                         } else {
                             // El elemento cabe, añadir su altura
                             currentHeight += elementHeight;
                             // Añadir pequeño margen si es tabla o variante (simula table-spacer)
                            if ((element.tagName === 'TABLE' || element.classList.contains('variants-container') || element.classList.contains('side-variants-container')) && elIndex < dayElements.length -1) {
                                currentHeight += 12; // Simular table-spacer
                            }
                         }
                         lastElement = element;
                     });

                     // Añadir espacio final si no es el último día para evitar que el siguiente día empiece pegado
                     if (dayIndex < document.querySelectorAll('.training-day-container').length - 1) {
                         const finalSpacer = document.createElement('div');
                         finalSpacer.style.height = '30px'; // Espacio extra al final del día
                         dayContainer.appendChild(finalSpacer);
                     }
                 });

                 // Eliminar table-spacers explícitos ya que la lógica anterior añade espacio
                  document.querySelectorAll('.table-spacer').forEach(spacer => spacer.remove());

            }); // Fin de page.evaluate
            console.log("Script de evaluación ejecutado.");


            // Generar PDF
            console.log("Generando buffer PDF...");
            const pdfBuffer = await page.pdf({
                // path: filePath, // Generar buffer en memoria en lugar de guardar directamente
                format: 'A4',
                margin: { top: '0', right: '0', bottom: '0', left: '0' }, // Sin márgenes de Puppeteer
                printBackground: true, // Esencial para colores y fondos
                preferCSSPageSize: true, // Usar tamaño definido en @page
                timeout: 120000 // Aumentar timeout a 120 segundos para renderizados complejos
            });
            console.log("Buffer PDF generado.");

            await browser.close();
            console.log("Navegador cerrado.");

            // Guardar el buffer en el archivo
            fs.writeFileSync(filePath, pdfBuffer);
            console.log("PDF guardado correctamente en:", filePath);

            resolve(filePath); // Resolver la promesa con la ruta del archivo

        } catch (error) {
            console.error("Error detallado en generatePDF:", error);
            reject(error); // Rechazar la promesa con el error
        }
    });
}

module.exports = { generatePDF };