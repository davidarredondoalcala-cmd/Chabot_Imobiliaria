import { Body, Controller, ForbiddenException, Get, Param, Post, Req } from '@nestjs/common';
import { InmueblesService } from './inmuebles.service';

@Controller('inmuebles')
export class InmueblesController {
  constructor(private readonly service: InmueblesService) {}

  @Get()
  listar() {
    return this.service.findAll();
  }

  @Post()
  crear(@Body() body: any, @Req() req: any) {
    if (!req.usuario?.admin) {
      throw new ForbiddenException('Solo los administradores pueden registrar nuevos inmuebles');
    }
    return this.service.crear(body);
  }

  @Post(':id/contratos')
  crearContrato(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    if (!req.usuario?.admin) {
      throw new ForbiddenException('Solo los administradores pueden generar contratos');
    }
    return this.service.crearContrato(id, body);
  }

  @Post(':id/foto')
  setFoto(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    if (!req.usuario?.admin) {
      throw new ForbiddenException('Solo los administradores pueden cambiar fotos de inmuebles');
    }
    return this.service.setFoto(id, body?.foto);
  }
}
