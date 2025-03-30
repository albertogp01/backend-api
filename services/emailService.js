const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Cargar variables de entorno
dotenv.config();

// Conjunto para realizar seguimiento de correos ya enviados con ID único
const processedEmails = new Set();

/**
 * Envía un correo electrónico con la rutina personalizada adjunta
 * 
 * @param {string} email - Dirección de correo electrónico del destinatario
 * @param {string} clientName - Nombre del cliente para personalizar el correo
 * @param {string} pdfPath - Ruta al archivo PDF con la rutina
 * @param {string} requestId - Identificador único de la solicitud
 * @returns {Promise<void>}
 */

const sendEmail = async (email, clientName, pdfPath, requestId = null) => {
  // Si tenemos un ID de solicitud, verificamos si ya procesamos este ID
  if (requestId) {
    const emailKey = `${requestId}:${email}`;
    if (processedEmails.has(emailKey)) {
      console.warn(`Intento de reenvío detectado. El correo a ${email} para el ID ${requestId} ya fue enviado.`);
      return; // Evita reenvíos de un mismo formulario
    }
    
    // Marcar este email como procesado para este ID de solicitud
    processedEmails.add(emailKey);
    
    // Mantener el conjunto en un tamaño razonable (eliminamos entradas antiguas)
    if (processedEmails.size > 1000) {
      const itemsToDelete = Array.from(processedEmails).slice(0, 100);
      itemsToDelete.forEach(item => processedEmails.delete(item));
    }
  }

  // Verificar que el archivo PDF existe
  if (!fs.existsSync(pdfPath)) {
    throw new Error(`Archivo no encontrado: ${pdfPath}`);
  }

  // Verificar configuración de correo
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    // CAMBIO CRÍTICO: Si no hay credenciales en producción, usar valores de respaldo
    if (process.env.NODE_ENV === 'production') {
      process.env.EMAIL_USER = process.env.EMAIL_USER || 'routinas@fitform.coach';
      process.env.EMAIL_PASS = process.env.EMAIL_PASS || 'rutinas2024';
    } else {
      throw new Error('Configuración de correo incompleta');
    }
  }

  try {
    // Configurar transportador de correo
    let transporter;
    
    // Diferentes configuraciones según el servicio de correo
    if (process.env.EMAIL_SERVICE === 'gmail') {
      transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      });
    } else if (process.env.EMAIL_HOST) {
      // Configuración SMTP personalizada
      transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT || 587,
        secure: process.env.EMAIL_SECURE === 'true',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      });
    } else {
      // Por defecto, usar Gmail
      transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      });
    }

    // Configurar opciones del correo
    const mailOptions = {
      from: `"FitForm Coach" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: '✅ Tu rutina personalizada de entrenamiento está lista',
      text: 'Aquí tienes tu rutina personalizada de entrenamiento. Si tienes alguna duda, no dudes en contactarnos.',
      html: `
            <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 650px; margin: 0 auto; padding: 25px; color: #333; line-height: 1.6; border: 1px solid #e0e0e0; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
        <div style="text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #f2f2f2;">
          <h1 style="color: #0a2a5e; margin-bottom: 8px; font-size: 26px;">Tu rutina personalizada está lista</h1>
          <p style="color: #666; font-size: 16px; margin-top: 0;">Gracias por confiar en nosotros</p>
        </div>
        
        <p>Hola ${clientName || 'atleta'},</p>
        
        <p>Nos complace entregarte tu rutina de entrenamiento personalizada, diseñada específicamente según las respuestas que has proporcionado en nuestro formulario.</p>
        
        <p>En el PDF adjunto encontrarás:</p>
        <ul style="padding-left: 20px; margin-bottom: 20px;">
          <li style="margin-bottom: 8px;">Una rutina adaptada a tu nivel y objetivos</li>
          <li style="margin-bottom: 8px;">Ejercicios específicos con series, repeticiones y descansos</li>
          <li style="margin-bottom: 8px;">Variantes y alternativas para cada ejercicio</li>
          <li style="margin-bottom: 8px;">Recomendaciones técnicas para maximizar tus resultados</li>
        </ul>
        
        <div style="background-color: #fff9e6; padding: 18px; border-radius: 6px; margin: 25px 0; border-left: 4px solid #ffc107;">
          <p style="margin: 0; font-weight: bold; font-size: 16px;">📋 Fase de prototipo - ¡Tu opinión es valiosa!</p>
          <p style="margin-top: 8px;">Gracias por completar nuestro primer formulario. Lo que has visto hasta ahora es un prototipo en el que seguimos trabajando activamente. Semanalmente trataremos de actualizar el código para que las respuestas sean cada vez más precisas.</p>
          <p>Por eso, nos encantaría que nos ayudaras con un último paso: completar un segundo cuestionario que nos permitirá ajustar y perfeccionar nuestro servicio.</p>
          <p style="margin-bottom: 5px;">Puedes acceder al cuestionario aquí:</p>
          <div style="text-align: center; margin: 15px 0;">
            <a href="http://fitform.coach/cuestionario" style="background-color: #0a2a5e; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">Completar cuestionario</a>
          </div>
          <p style="font-size: 13px; color: #666; margin-top: 10px;">O copia y pega este enlace: <a href="http://fitform.coach/cuestionario" style="color: #0a2a5e;">http://fitform.coach/cuestionario</a></p>
        </div>
        
        <p>Si tienes alguna duda sobre los ejercicios o necesitas ajustes adicionales, no dudes en contactarnos respondiendo a este correo.</p>
        
        <p>¡Te deseamos mucho éxito en tu camino fitness!</p>
        
        <div style="margin-top: 25px;">
          <p style="margin-bottom: 5px;">Saludos cordiales,</p>
          <p style="margin-top: 0; font-weight: bold; color: #0a2a5e;">El equipo de FitForm</p>
        </div>
        
        <div style="border-top: 1px solid #eee; margin-top: 35px; padding-top: 20px; font-size: 13px; color: #777; text-align: center;">
          <p style="margin-bottom: 10px;">Si necesitas ayuda adicional, contáctanos en <a href="mailto:soporte@fitform.coach" style="color: #0a2a5e; text-decoration: none; border-bottom: 1px dotted #0a2a5e;">soporte@fitform.coach</a></p>
          <p style="margin: 0; font-size: 12px;">© 2025 FitForm. Todos los derechos reservados.</p>
        </div>
      </div>
      `,
      attachments: [
        {
          filename: `Rutina_Personalizada_${clientName ? clientName.replace(/\s+/g, '_') : 'FitForm'}_${Date.now()}.pdf`,
          path: pdfPath,
        },
      ],
    };

    const info = await transporter.sendMail(mailOptions);

    // Elimina el archivo PDF después del envío solo si se envió correctamente
    try {
      fs.unlinkSync(pdfPath);
    } catch (unlinkError) {
      // No relanzamos este error para no interrumpir el flujo principal
    }

    return info; // Devolver información del envío
  } catch (error) {
    // Si falla el envío, eliminamos la entrada del conjunto para permitir reintentos
    if (requestId) {
      processedEmails.delete(`${requestId}:${email}`);
    }
    
    // Intento alternativo con un transportador diferente
    try {
      // Crear un transportador alternativo
      const backupTransporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: 'notifications@fitform.coach', // Correo alternativo
          pass: 'fitform2024notifications', // Contraseña alternativa
        },
      });
      
      // Configuración básica del correo para el reintento
      const fallbackMailOptions = {
        from: '"FitForm Notifications" <notifications@fitform.coach>',
        to: email,
        subject: '✅ Tu rutina personalizada de entrenamiento está lista',
        text: `Hola ${clientName || 'atleta'}, Aquí tienes tu rutina personalizada de entrenamiento. Si tienes alguna duda, no dudes en contactarnos.`,
        attachments: [
          {
            filename: `Rutina_Personalizada_${Date.now()}.pdf`,
            path: pdfPath,
          },
        ],
      };
      
      // Enviar correo de respaldo
      const backupInfo = await backupTransporter.sendMail(fallbackMailOptions);
      
      // Eliminar PDF después del envío exitoso
      try {
        fs.unlinkSync(pdfPath);
      } catch (unlinkError) {
        // No interrumpimos el flujo
      }
      
      return backupInfo; // Devolver información del envío alternativo
    } catch (backupError) {
      throw error; // Relanzar el error original si ambos métodos fallan
    }
  }
};

module.exports = { sendEmail };