import { Controller, Get } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { Public } from '../auth/public.decorator';

// Salud del servicio (misma respuesta que tenía la API Express)
@Controller('api')
export class SaludController {
  constructor(@InjectConnection() private readonly conn: Connection) {}

  @Public()
  @Get('salud')
  async salud() {
    const dbName = this.conn.name;
    const countAcuerdos = await this.conn.collection('acuerdofirmas').countDocuments().catch(() => -1);
    const countInmuebles = await this.conn.collection('inmuebles').countDocuments().catch(() => -1);
    return {
      ok: true,
      servicio: 'habitat-capital-api',
      dbName,
      countAcuerdos,
      countInmuebles,
    };
  }
}

