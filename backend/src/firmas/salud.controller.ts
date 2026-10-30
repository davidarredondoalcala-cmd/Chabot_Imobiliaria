import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/public.decorator';

// Salud del servicio (misma respuesta que tenía la API Express)
@Controller('api')
export class SaludController {
  @Public()
  @Get('salud')
  salud() {
    return { ok: true, servicio: 'habitat-capital-api' };
  }
}
