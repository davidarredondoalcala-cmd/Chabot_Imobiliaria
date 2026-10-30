import { Body, Controller, ForbiddenException, Get, HttpCode, Param, Post, Query, Req, Res } from '@nestjs/common';
import { FirmasService } from './firmas.service';
import { AuthService } from '../auth/auth.service';
import { Public } from '../auth/public.decorator';

@Controller('api/firmas')
export class FirmasController {
  constructor(private readonly svc: FirmasService, private readonly auth: AuthService) {}

  // Crear acuerdo (desde el formulario de contrato del frontend)
  @Post('acuerdos')
  @HttpCode(200)
  async crear(@Body() body: any, @Req() req: any) {
    const usuario = await this.auth.usuarioDe(req);
    if (!usuario?.admin) {
      throw new ForbiddenException('Solo los administradores pueden generar acuerdos de firma');
    }
    const { inmueble, tipo, datos, firmantes, frontendUrl } = body || {};
    const origin = frontendUrl || req?.headers?.origin || req?.headers?.referer;
    return this.svc.crearAcuerdo({ inmueble, tipo, datos, firmantes, frontendUrl: origin });
  }

  // Estado del acuerdo (panel administrativo)
  @Get('acuerdos/:id')
  obtener(@Param('id') id: string) {
    return this.svc.obtenerAcuerdo(id);
  }

  // Datos públicos para la pantalla de firma (contrato, turno, rol)
  // Público: el firmante externo llega por enlace privado, sin sesión de administrador.
  @Public()
  @Get('t/:token')
  porToken(@Param('token') token: string) {
    return this.svc.obtenerPorToken(token);
  }

  // Registrar firma (valida el turno en el servidor)
  @Public()
  @Post('t/:token/firmar')
  @HttpCode(200)
  firmar(@Param('token') token: string, @Body() body: any, @Req() req: any) {
    return this.svc.firmar(token, { ...(body || {}), req });
  }

  // Rechazo del administrativo con observaciones
  @Public()
  @Post('t/:token/rechazar')
  @HttpCode(200)
  rechazar(@Param('token') token: string, @Body() body: any, @Req() req: any) {
    return this.svc.rechazar(token, { ...(body || {}), req });
  }

  // Verificación de integridad (recomputa hashes — validez Ley 527)
  @Get('acuerdos/:id/verificar')
  verificar(@Param('id') id: string) {
    return this.svc.verificar(id);
  }

  // PDF de un contrato en borrador (sin firmas). Accesible para administradores o firmantes con token válido.
  @Public()
  @Post('borrador/pdf')
  @HttpCode(200)
  async pdfBorrador(@Body() body: any, @Query('token') queryToken: string, @Req() req: any, @Res() res: any) {
    const usuario = req.usuario || (await this.auth.usuarioDe(req));
    const token = body?.token || queryToken;
    let esFirmante = false;
    if (token) {
      esFirmante = await this.svc.validarTokenFirmante(token);
    }
    if (!usuario?.admin && !esFirmante) {
      return res.status(403).json({ error: 'Solo los administradores o firmantes autorizados pueden generar y descargar borradores de contratos' });
    }
    const { tipo, datos } = body || {};
    const buffer = await this.svc.pdfBorrador(tipo, datos);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="borrador-${tipo}.pdf"`);
    return res.send(buffer);
  }

  // PDF final (contrato + firmas + anexo de evidencia).
  // Solo accesible para administradores o para el firmante que cuente con su token privado de firma.
  @Public()
  @Get('acuerdos/:id/pdf')
  async pdf(@Param('id') id: string, @Query('token') token: string, @Req() req: any, @Res() res: any) {
    const usuario = req.usuario || (await this.auth.usuarioDe(req))
      || (token ? await this.auth.usuarioDe({ headers: { authorization: `Bearer ${token}` } }) : null);
    const esAdmin = !!usuario?.admin;
    const esFirmante = token ? await this.svc.tieneToken(id, token) : false;
    if (!esAdmin && !esFirmante) {
      return res.status(403).json({ error: 'No tienes permisos para descargar este contrato' });
    }
    const buffer = await this.svc.pdfDe(id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="contrato-${id}.pdf"`);
    return res.send(buffer);
  }
}
