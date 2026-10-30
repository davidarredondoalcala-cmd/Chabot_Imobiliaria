import * as path from 'path';
import * as fs from 'fs';
import crypto from 'crypto';
import multer from 'multer';
import sharp from 'sharp';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Imagen, ImagenDoc } from './imagen.model';

const MAX = Number(process.env.MAX_IMAGEN_BYTES || 10485760); // 10 MB
const TIPOS: any = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

// Guarda en memoria; sharp valida de verdad que sea una imagen (magic bytes)
export const subirOpciones = {
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX },
  fileFilter: (req: any, file: any, cb: any) => {
    if (!TIPOS[file.mimetype]) {
      const e: any = new Error('Formato no permitido (solo PNG, JPG o WEBP)');
      e.status = 400;
      return cb(e);
    }
    cb(null, true);
  },
};

// Carpeta antigua de disco (solo para migrar lo que ya existía localmente).
function dirDisco() {
  return path.resolve(process.cwd(), 'uploads/imagenes');
}

const CONTENT_TYPE: any = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };

@Injectable()
export class ImagenesStorage implements OnModuleInit {
  constructor(@InjectModel(Imagen.name) private model: Model<ImagenDoc>) {}

  // Al arrancar, migra a Mongo las imágenes que sigan en el disco local (una sola vez).
  async onModuleInit() {
    try {
      const dir = dirDisco();
      if (!fs.existsSync(dir)) return;
      const archivos = fs.readdirSync(dir).filter((f) => !f.startsWith('.'));
      for (const nombre of archivos) {
        const ya = await this.model.exists({ nombre });
        if (ya) continue;
        try {
          const buffer = fs.readFileSync(path.join(dir, nombre));
          const meta = await sharp(buffer).metadata();
          const ext = meta.format === 'jpeg' ? 'jpg' : meta.format === 'png' ? 'png' : meta.format === 'webp' ? 'webp' : null;
          if (!ext) continue;
          await this.model.create({
            nombre,
            tipo: nombre.split('-')[0] || 'otro',
            contentType: CONTENT_TYPE[ext],
            width: meta.width,
            height: meta.height,
            buffer,
          });
        } catch {
          // archivo ilegible/corrupto: se ignora
        }
      }
    } catch {
      // si no hay disco accesible, no hay nada que migrar
    }
  }

  // Valida, redimensiona (≤2048 px) y guarda el binario en Mongo. Devuelve metadatos.
  async procesar(buffer: Buffer, tipoCampo: any) {
    const meta = await sharp(buffer).metadata(); // lanza si no es imagen real
    if (!meta.width || !meta.height) throw new Error('Archivo corrupto');

    const ext = meta.format === 'jpeg' ? 'jpg' : meta.format === 'png' ? 'png' : meta.format === 'webp' ? 'webp' : null;
    if (!ext) throw new Error('Formato no soportado');

    const tipo = String(tipoCampo || 'otro').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 20) || 'otro';
    const nombre = `${tipo}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`;

    const redim = await sharp(buffer)
      .resize({ width: 2048, height: 2048, fit: 'inside', withoutEnlargement: true })
      .toBuffer({ resolveWithObject: true });

    await this.model.create({
      nombre,
      tipo,
      contentType: CONTENT_TYPE[ext],
      width: redim.info.width,
      height: redim.info.height,
      buffer: redim.data,
    });

    return { nombre, width: redim.info.width, height: redim.info.height };
  }

  async listar(tipo?: string) {
    const filtro = tipo ? { tipo } : {};
    const docs = await this.model.find(filtro).sort({ createdAt: -1 }).lean();
    return docs.map((d: any) => ({ nombre: d.nombre, url: `/archivos/${d.nombre}`, tipo: d.tipo }));
  }

  async obtener(nombre: string) {
    return this.model.findOne({ nombre }).lean();
  }
}
