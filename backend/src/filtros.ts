import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import { ErrorFirma } from './firmas/errores';

// Filtro global de errores: conserva el formato { error: '...' } que espera
// el frontend del módulo de firmas (y el que usaba la API Express original).
@Catch()
export class FiltroApi implements ExceptionFilter {
  catch(e: any, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse();

    if (e instanceof ErrorFirma) return res.status(e.status).json({ error: e.message });
    if (e?.name === 'MulterError') return res.status(413).json({ error: e.message });
    if (typeof e?.status === 'number') return res.status(e.status).json({ error: e.message });

    if (e instanceof HttpException) {
      const status = e.getStatus();
      const r = e.getResponse();
      if (typeof r === 'string') return res.status(status).json({ statusCode: status, message: r, error: r });
      return res.status(status).json(r);
    }

    console.error(e);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}
