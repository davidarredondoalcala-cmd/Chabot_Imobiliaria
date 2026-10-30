import { Body, Controller, Get, HttpCode, Param, Post, Query, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ErrorFirma } from '../firmas/errores';
import { Public } from '../auth/public.decorator';
import { ImagenesStorage, subirOpciones } from './storage';

@Controller()
export class ImagenesController {
  constructor(private readonly almacen: ImagenesStorage) {}

  // Subida genérica de imágenes (fotos de casas, hoteles, etc.)
  // multipart/form-data: campo "imagen" (obligatorio) + campo "tipo" (casa | hotel | otro, opcional)
  @Post('api/imagenes/subir')
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('imagen', subirOpciones as any))
  async subir(@UploadedFile() file: any, @Body() body: any) {
    if (!file) throw new ErrorFirma(400, 'Falta la imagen (campo "imagen")');
    try {
      const { nombre } = await this.almacen.procesar(file.buffer, body?.tipo);
      return { nombre, url: `/archivos/${nombre}`, tipo: String(body?.tipo || 'otro') };
    } catch (e: any) {
      throw new ErrorFirma(400, e.message || 'No se pudo procesar la imagen');
    }
  }

  // Listado (filtro opcional ?tipo=casa|hotel|otro)
  @Get('api/imagenes')
  listar(@Query('tipo') tipo?: string) {
    return this.almacen.listar(tipo);
  }

  // Sirve la imagen guardada en Mongo. Público: los <img> del navegador no
  // envían el token de sesión (antes lo servía express.static sin auth).
  @Public()
  @Get('archivos/:nombre')
  async archivo(@Param('nombre') nombre: string, @Res() res: any) {
    if (!/^[a-zA-Z0-9_.-]+$/.test(nombre)) throw new ErrorFirma(400, 'Nombre no válido');
    const img: any = await this.almacen.obtener(nombre);
    if (!img) throw new ErrorFirma(404, 'Imagen no encontrada');
    const bin = img.buffer;
    const buf = Buffer.isBuffer(bin) ? bin : Buffer.from(bin?.buffer || bin?.value || bin);
    res.setHeader('Content-Type', img.contentType || 'application/octet-stream');
    res.setHeader('Content-Length', String(buf.length));
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.end(buf);
  }
}
