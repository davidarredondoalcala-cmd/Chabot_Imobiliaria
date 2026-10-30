import { Body, Controller, Get, HttpCode, Param, Post, Query, Req, Res } from '@nestjs/common';
import { FirmasService } from './firmas.service';
import { AuthService } from '../auth/auth.service';
import { Public } from '../auth/public.decorator';

@Controller('api/firmas')
export class FirmasController {
  constructor(private readonly svc: FirmasService, private readonly auth: AuthService) {}

  // Crear acuerdo (desde el formulario de contrato del frontend)
  @Post('acuerdos')
  @HttpCode(200)
  crear(@Body() body: any) {
    const { inmueble, tipo, datos, firmantes } = body || {};
    return this.svc.crearAcuerdo({ inmueble, tipo, datos, firmantes });
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

  // PDF de un contrato en borrador (sin firmas). Requiere sesión de administrador.
  @Post('borrador/pdf')
  @HttpCode(200)
  async pdfBorrador(@Body() body: any, @Req() req: any, @Res() res: any) {
    const esAdmin = !!(await this.auth.usuarioDe(req));
    if (!esAdmin) return res.status(401).json({ error: 'Debes iniciar sesión' });
    const { tipo, datos } = body || {};
    const buffer = await this.svc.pdfBorrador(tipo, datos);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="borrador-${tipo}.pdf"`);
    return res.send(buffer);
  }

  // PDF final (contrato + firmas + anexo de evidencia).
  // Se descarga desde un <a href>, que no puede mandar cabecera Authorization:
  // se acepta ?token= bien sea la sesión del administrador o el token del firmante.
  @Public()
  @Get('acuerdos/:id/pdf')
  async pdf(@Param('id') id: string, @Query('token') token: string, @Req() req: any, @Res() res: any) {
    // Sesión de administrador: por cabecera Authorization (fetch) o como ?token= (enlace directo)
    const esAdmin = !!(await this.auth.usuarioDe(req))
      || (token ? !!(await this.auth.usuarioDe({ headers: { authorization: `Bearer ${token}` } })) : false);
    const esFirmante = token ? await this.svc.tieneToken(id, token) : false;
    if (!esAdmin && !esFirmante) {
      return res.status(401).json({ error: 'Debes iniciar sesión' });
    }
    const buffer = await this.svc.pdfDe(id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="contrato-${id}.pdf"`);
    return res.send(buffer);
  }
}
