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
}

@Injectable()
export class CorreoService {
  private readonly logger = new Logger(CorreoService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    this.iniciarTransporter();
  }

  private async iniciarTransporter() {
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
      this.logger.log(`Servicio de correo configurado con servidor SMTP: ${host}`);
    } else {
      // Modo desarrollo / simulación: no requiere credenciales externas para funcionar
      this.transporter = nodemailer.createTransport({
        streamTransport: true,
        newline: 'windows',
        buffer: true,
      });
      this.logger.log('Servicio de correo en modo desarrollo (simulación activa en consola)');
    }
  }

  /**
   * Envía automáticamente el enlace privado de firma electrónica a un firmante o codeudor.
   */
  async enviarEnlaceFirma(datos: DatosCorreoFirma): Promise<{ enviado: boolean; mensaje: string }> {
    const { destinatario, nombre, rol, tipoContrato, urlFirma, inmuebleNombre, direccion } = datos;

    if (!destinatario || !destinatario.includes('@')) {
      return { enviado: false, mensaje: 'Dirección de correo no válida' };
    }

    const rolFormateado = rol.charAt(0).toUpperCase() + rol.slice(1);
    const tipoTexto = tipoContrato === 'arriendo' ? 'Arrendamiento' : 'Compraventa';
    const remitente = process.env.SMTP_FROM || '"Habitat Capital Inmobiliaria" <notificaciones@habitatcapital.com>';

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
          <p style="font-size: 14px; margin: 0 0 24px;">
            Por favor ingresa al siguiente enlace seguro para revisar las cláusulas completas y registrar tu firma electrónica conforme a la Ley 527 de 1999:
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${urlFirma}" target="_blank" style="background: linear-gradient(135deg, #a46d2a 0%, #c9933e 50%, #d89f47 100%); color: #ffffff; padding: 14px 30px; border-radius: 10px; text-decoration: none; font-size: 15px; font-weight: 700; display: inline-block; box-shadow: 0 4px 14px rgba(201, 147, 62, 0.45);">
              Revisar y Firmar Contrato
            </a>
          </div>
          <p style="font-size: 12px; color: #8e8072; margin-top: 24px; border-top: 1px solid #f0e9dc; paddingTop: 16px;">
            Si el botón no funciona, copia y pega este enlace directo en tu navegador:<br />
            <a href="${urlFirma}" style="color: #a86e2e; word-break: break-all;">${urlFirma}</a>
          </p>
        </div>
        <div style="background: #f8f5f0; padding: 16px; text-align: center; font-size: 11px; color: #8e8072; border-top: 1px solid #e6decb;">
          Habitat Capital Inmobiliaria · Ibagué, Tolima · Documento seguro y confidencial
        </div>
      </div>
    `;

    try {
      if (!this.transporter) await this.iniciarTransporter();
      await this.transporter!.sendMail({
        from: remitente,
        to: destinatario,
        subject: `Habitat Capital — Enlace para firma de contrato de ${tipoTexto} (${rolFormateado})`,
        text: `Hola ${nombre},\n\nHas sido registrado(a) como ${rolFormateado} para firmar el contrato de ${tipoTexto}.\n\nAccede a tu enlace de firma aquí: ${urlFirma}\n\nHabitat Capital`,
        html,
      });

      this.logger.log(`[Correo Enviado] A: ${destinatario} (${rolFormateado}) -> ${urlFirma}`);
      return { enviado: true, mensaje: `Correo enviado a ${destinatario}` };
    } catch (err: any) {
      this.logger.error(`Error enviando correo a ${destinatario}: ${err.message}`);
      return { enviado: false, mensaje: err.message };
    }
  }
}
