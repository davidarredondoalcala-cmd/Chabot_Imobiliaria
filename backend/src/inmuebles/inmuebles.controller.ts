import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { InmueblesService } from './inmuebles.service';

@Controller('inmuebles')
export class InmueblesController {
  constructor(private readonly service: InmueblesService) {}

  @Get() listar() { return this.service.findAll(); }

  @Post() crear(@Body() body: any) { return this.service.crear(body); }

  @Post(':id/contratos') crearContrato(@Param('id') id: string, @Body() body: any) {
    return this.service.crearContrato(id, body);
  }

  @Post(':id/foto') setFoto(@Param('id') id: string, @Body() body: any) {
    return this.service.setFoto(id, body?.foto);
  }
}
