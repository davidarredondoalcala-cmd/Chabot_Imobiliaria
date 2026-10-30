import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

export interface DatosCorreoFirma {
  destinatario: string;
  nombre: string;
  rol: string;
  tipoContrato: 'arriendo' | 'venta' | string;
  urlFirma: string;
  inmuebleNombre?: string;
  direccion?: string;
  pdfBuffer?: Buffer;
  pdfNombre?: string;
}

export interface DatosCorreoContratoCerrado {
  destinatario: string;
  nombre: string;
  rol: string;
  tipoContrato: 'arriendo' | 'venta' | string;
  inmuebleNombre?: string;
  direccion?: string;
  urlVerificacion?: string;
  pdfBuffer: Buffer;
  pdfNombre: string;
}

@Injectable()
export class CorreoService {
  private readonly logger = new Logger(CorreoService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    this.iniciarServicio();
  }

  private iniciarServicio() {
    const brevoKey = process.env.BREVO_API_KEY;
    if (brevoKey) {
      this.logger.log('Servicio de correo inicializado con API REST de Brevo (Sendinblue)');
      return;
    }

    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === 'true',
        auth: { user, pass },
      });
      this.logger.log(`Servicio de correo inicializado con servidor SMTP: ${host}`);
    } else {
      this.transporter = nodemailer.createTransport({
        streamTransport: true,
        newline: 'windows',
        buffer: true,
      });
      this.logger.log('Servicio de correo en modo simulación (configura BREVO_API_KEY en .env para envíos reales)');
    }
  }

  /**
   * Envía correo transaccional utilizando la API v3 de Brevo
   */
  private async enviarConBrevoApi(opciones: {
    destinatario: string;
    nombre: string;
    asunto: string;
    html: string;
    texto: string;
    adjunto?: { nombre: string; buffer: Buffer };
  }): Promise<{ enviado: boolean; messageId?: string; mensaje: string }> {
    const apiKey = process.env.BREVO_API_KEY;
    if (!apiKey) throw new Error('BREVO_API_KEY no está configurada');

    const remitenteEmail = process.env.BREVO_SENDER_EMAIL || process.env.SMTP_FROM_EMAIL || 'notificaciones@habitatcapital.com';
    const remitenteNombre = process.env.BREVO_SENDER_NAME || 'Habitat Capital Inmobiliaria';

    const body: Record<string, any> = {
      sender: {
        name: remitenteNombre,
        email: remitenteEmail,
      },
      to: [
        {
          email: opciones.destinatario,
          name: opciones.nombre || undefined,
        },
      ],
      subject: opciones.asunto,
      htmlContent: opciones.html,
      textContent: opciones.texto,
    };

    if (opciones.adjunto && opciones.adjunto.buffer) {
      body.attachment = [
        {
          name: opciones.adjunto.nombre,
          content: opciones.adjunto.buffer.toString('base64'),
        },
      ];
    }

    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'api-key': apiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data: any = await res.json().catch(() => ({}));

    if (!res.ok) {
      const errorMsg = data.message || `Error Brevo HTTP ${res.status}`;
      throw new Error(errorMsg);
    }

    return {
      enviado: true,
      messageId: data.messageId,
      mensaje: `Correo enviado con Brevo API a ${opciones.destinatario} (ID: ${data.messageId || 'OK'})`,
    };
  }

  /**
   * Envía automáticamente el enlace privado de firma electrónica + el contrato en PDF.
   */
  async enviarEnlaceFirma(datos: DatosCorreoFirma): Promise<{ enviado: boolean; mensaje: string }> {
    const { destinatario, nombre, rol, tipoContrato, urlFirma, inmuebleNombre, direccion, pdfBuffer, pdfNombre } = datos;

    if (!destinatario || !destinatario.includes('@')) {
      return { enviado: false, mensaje: 'Dirección de correo no válida' };
    }

    const rolFormateado = rol.charAt(0).toUpperCase() + rol.slice(1);
    const tipoTexto = tipoContrato === 'arriendo' ? 'Arrendamiento' : 'Compraventa';
    const asunto = `Habitat Capital — Enlace para firma de contrato de ${tipoTexto} (${rolFormateado})`;
    const texto = `Hola ${nombre},\n\nHas sido registrado(a) como ${rolFormateado} para firmar el contrato de ${tipoTexto}.\n\nRevisa y firma el documento aquí: ${urlFirma}\n\nSe adjunta copia en PDF del contrato para tu consulta.\n\nHabitat Capital Inmobiliaria`;

    const html = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e6decb; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06);">
        <div style="background: linear-gradient(135deg, #24160c 0%, #523720 50%, #825429 100%); padding: 26px 30px; text-align: center; color: #ffffff;">
          <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #f3d489; letter-spacing: -0.5px;">Habitat Capital</h1>
          <p style="margin: 6px 0 0; font-size: 13px; color: #e8d0af;">Gestión inmobiliaria y contratos electrónicos</p>
        </div>
        <div style="padding: 32px 30px; color: #241c15; line-height: 1.6;">
          <p style="font-size: 16px; margin: 0 0 16px;">Hola <strong>${nombre || 'estimado(a) firmante'}</strong>,</p>
          <p style="font-size: 14px; margin: 0 0 16px;">
            Has sido registrado(a) como <strong>${rolFormateado}</strong> en el contrato de <strong>${tipoTexto}</strong> para el inmueble:
          </p>
          <div style="background: #f8f5f0; border-left: 4px solid #a86e2e; padding: 14px 18px; margin: 18px 0; border-radius: 6px;">
            <p style="margin: 0; font-size: 15px; font-weight: 700; color: #241c15;">${inmuebleNombre || 'Inmueble seleccionado'}</p>
            ${direccion ? `<p style="margin: 4px 0 0; font-size: 13px; color: #6e6358;">${direccion}</p>` : ''}
          </div>
          <p style="font-size: 14px; margin: 0 0 20px;">
            En este correo encuentras adjunto el documento completo en PDF para tu revisión previa. Cuando estés listo(a), haz clic en el siguiente botón para registrar tu firma electrónica conforme a la Ley 527 de 1999:
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${urlFirma}" target="_blank" style="background: linear-gradient(135deg, #a46d2a 0%, #c9933e 50%, #d89f47 100%); color: #ffffff; padding: 14px 32px; border-radius: 10px; text-decoration: none; font-size: 15px; font-weight: 700; display: inline-block; box-shadow: 0 4px 14px rgba(201, 147, 62, 0.45);">
              Revisar y Firmar Contrato en Línea
            </a>
          </div>
          <p style="font-size: 12px; color: #8e8072; margin-top: 24px; border-top: 1px solid #f0e9dc; padding-top: 16px;">
            Si el botón no abre directamente, copia y pega este enlace seguro en tu navegador:<br />
            <a href="${urlFirma}" style="color: #a86e2e; word-break: break-all;">${urlFirma}</a>
          </p>
        </div>
        <div style="background: #f8f5f0; padding: 16px; text-align: center; font-size: 11px; color: #8e8072; border-top: 1px solid #e6decb;">
          Habitat Capital Inmobiliaria · Ibagué, Tolima · Documento legal privado y confidencial
        </div>
      </div>
    `;

    // 1. Intento por API REST de Brevo si la API KEY está definida
    if (process.env.BREVO_API_KEY) {
      try {
        const r = await this.enviarConBrevoApi({
          destinatario,
          nombre,
          asunto,
          html,
          texto,
          adjunto: pdfBuffer && pdfNombre ? { nombre: pdfNombre, buffer: pdfBuffer } : undefined,
        });
        this.logger.log(`[Brevo API] Contrato y link enviados a ${destinatario} (${rolFormateado})`);
        return r;
      } catch (err: any) {
        this.logger.warn(`Brevo API falló (${err.message}). Intentando fallback SMTP...`);
      }
    }

    // 2. Fallback SMTP (Nodemailer o simulación)
    try {
      if (!this.transporter) this.iniciarServicio();
      const remitente = process.env.SMTP_FROM || '"Habitat Capital Inmobiliaria" <notificaciones@habitatcapital.com>';

      const mailOptions: nodemailer.SendMailOptions = {
        from: remitente,
        to: destinatario,
        subject: asunto,
        text: texto,
        html,
      };

      if (pdfBuffer && pdfNombre) {
        mailOptions.attachments = [
          {
            filename: pdfNombre,
            content: pdfBuffer,
            contentType: 'application/pdf',
          },
        ];
      }

      await this.transporter!.sendMail(mailOptions);
      this.logger.log(`[Correo Fallback Enviado] A: ${destinatario} (${rolFormateado}) -> ${urlFirma}`);
      return { enviado: true, mensaje: `Correo enviado a ${destinatario}` };
    } catch (err: any) {
      this.logger.error(`Error enviando correo a ${destinatario}: ${err.message}`);
      return { enviado: false, mensaje: err.message };
    }
  }

  /**
   * Envía el contrato final firmado a todos los participantes cuando se completan las firmas.
   */
  async enviarContratoFinalFirmado(datos: DatosCorreoContratoCerrado): Promise<{ enviado: boolean; mensaje: string }> {
    const { destinatario, nombre, rol, tipoContrato, inmuebleNombre, direccion, urlVerificacion, pdfBuffer, pdfNombre } = datos;

    if (!destinatario || !destinatario.includes('@')) {
      return { enviado: false, mensaje: 'Dirección de correo no válida' };
    }

    const rolFormateado = rol.charAt(0).toUpperCase() + rol.slice(1);
    const tipoTexto = tipoContrato === 'arriendo' ? 'Arrendamiento' : 'Compraventa';
    const asunto = `Habitat Capital — Contrato de ${tipoTexto} Final Firmado y Legalizado`;
    const texto = `Hola ${nombre},\n\nTe confirmamos que el contrato de ${tipoTexto} para el inmueble ${inmuebleNombre || ''} ha sido completado y firmado por todas las partes legalmente.\n\nAdjuntamos el contrato final en formato PDF con sus estampas de tiempo y evidencias digitales.\n\nHabitat Capital Inmobiliaria`;

    const html = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e6decb; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06);">
        <div style="background: linear-gradient(135deg, #24160c 0%, #523720 50%, #825429 100%); padding: 26px 30px; text-align: center; color: #ffffff;">
          <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #f3d489; letter-spacing: -0.5px;">Habitat Capital</h1>
          <p style="margin: 6px 0 0; font-size: 13px; color: #e8d0af;">Contrato Electrónico Formalizado</p>
        </div>
        <div style="padding: 32px 30px; color: #241c15; line-height: 1.6;">
          <p style="font-size: 16px; margin: 0 0 16px;">Estimado(a) <strong>${nombre || 'firmante'}</strong> (${rolFormateado}),</p>
          <div style="background: #e8f5e9; border-left: 4px solid #2e7d32; padding: 14px 18px; margin: 18px 0; border-radius: 6px; color: #1b5e20;">
            <p style="margin: 0; font-size: 15px; font-weight: 700;">¡El contrato ha sido firmado exitosamente por todas las partes!</p>
            <p style="margin: 4px 0 0; font-size: 13px;">Todas las firmas y estampas cronológicas han sido validadas conforme a la Ley 527 de 1999.</p>
          </div>
          <p style="font-size: 14px; margin: 0 0 16px;">
            Adjunto a este correo encontrarás el documento legal definitivo en formato PDF: <strong>${pdfNombre}</strong>, listo para su almacenamiento y valor probatorio pleno.
          </p>
          ${urlVerificacion ? `
          <div style="text-align: center; margin: 26px 0;">
            <a href="${urlVerificacion}" target="_blank" style="background: linear-gradient(135deg, #24160c 0%, #523720 100%); color: #ffffff; padding: 12px 26px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600; display: inline-block;">
              Verificar Integridad Criptográfica del Contrato
            </a>
          </div>` : ''}
        </div>
        <div style="background: #f8f5f0; padding: 16px; text-align: center; font-size: 11px; color: #8e8072; border-top: 1px solid #e6decb;">
          Habitat Capital Inmobiliaria · Documento oficial archivado
        </div>
      </div>
    `;

    // 1. Envío con Brevo API
    if (process.env.BREVO_API_KEY) {
      try {
        const r = await this.enviarConBrevoApi({
          destinatario,
          nombre,
          asunto,
          html,
          texto,
          adjunto: { nombre: pdfNombre, buffer: pdfBuffer },
        });
        this.logger.log(`[Brevo API] Contrato final firmado enviado a ${destinatario}`);
        return r;
      } catch (err: any) {
        this.logger.warn(`Brevo API falló en envío de contrato final (${err.message}). Probando SMTP...`);
      }
    }

    // 2. Envío con SMTP / Simulación
    try {
      if (!this.transporter) this.iniciarServicio();
      const remitente = process.env.SMTP_FROM || '"Habitat Capital Inmobiliaria" <notificaciones@habitatcapital.com>';

      await this.transporter!.sendMail({
        from: remitente,
        to: destinatario,
        subject: asunto,
        text: texto,
        html,
        attachments: [
          {
            filename: pdfNombre,
            content: pdfBuffer,
            contentType: 'application/pdf',
          },
        ],
      });
      this.logger.log(`[Correo Fallback Enviado] Contrato final firmado a ${destinatario}`);
      return { enviado: true, mensaje: `Contrato final enviado a ${destinatario}` };
    } catch (err: any) {
      this.logger.error(`Error enviando contrato final a ${destinatario}: ${err.message}`);
      return { enviado: false, mensaje: err.message };
    }
  }
}
