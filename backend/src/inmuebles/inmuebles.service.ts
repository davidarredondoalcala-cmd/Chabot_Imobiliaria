import { BadRequestException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Inmueble, InmuebleDoc } from './inmueble.schema';

@Injectable()
export class InmueblesService implements OnModuleInit {
  constructor(@InjectModel(Inmueble.name) private model: Model<InmuebleDoc>) {}

  // Carga la base de datos limpia de propiedades desde co_properties.csv
  async onModuleInit() {
    let cleanDataset: any[] = [];
    try {
      cleanDataset = require('./co_inmuebles_clean.json');
    } catch {
      cleanDataset = [];
    }

    const currentCount = await this.model.countDocuments();
    // Si la base de datos está vacía o tiene datos antiguos, reemplaza con el dataset limpio del archivo CSV
    if (cleanDataset.length > 0 && currentCount < 500) {
      await this.model.deleteMany({});
      await this.model.insertMany(cleanDataset);
    }
  }

  async findAll(esAdmin = false) {
    const list = await this.model.find().sort({ createdAt: 1 }).lean();
    if (esAdmin) return list;
    return list.map((item: any) => ({
      ...item,
      venc: undefined,
      diaPago: undefined,
      contratos: [],
    }));
  }

  // Agregar un inmueble nuevo
  async crear(b: any) {
    const num = (v: any) => {
      if (v === undefined || v === null || v === '') return undefined;
      const x = Number(v);
      if (isNaN(x) || x < 0) throw new BadRequestException('Los valores numéricos no pueden ser negativos');
      return x;
    };
    if (!['Casa', 'Apartamento'].includes(b?.tipo) || !b.nombre?.trim() || !b.dir?.trim())
      throw new BadRequestException('Faltan datos obligatorios (tipo, nombre y dirección)');
    const valor = num(b.valor);
    if (valor === undefined) throw new BadRequestException('El valor es obligatorio');
    const estado = ['Arrendada', 'Sin arrendar', 'Para la venta'].includes(b.estado) ? b.estado : 'Sin arrendar';
    const doc: any = {
      tipo: b.tipo, nombre: b.nombre.trim(), estado, valor,
      dir: b.dir.trim(), barrio: b.barrio?.trim() || '',
      ciudad: b.ciudad?.trim() || 'Ibagué',
      lind: b.lind?.trim() || '',
      descripcion: b.descripcion?.trim() || '',
      habitaciones: num(b.habitaciones), banos: num(b.banos), area: num(b.area),
      foto: b.foto?.trim() || undefined,
    };
    if (estado === 'Arrendada') { doc.venc = b.venc || ''; doc.diaPago = num(b.dia) ?? 5; }
    return this.model.create(doc);
  }

  async crearContrato(id: string, b: any) {
    const i = await this.model.findById(id);
    if (!i) throw new NotFoundException('Inmueble no encontrado');
    const fecha = new Date().toISOString().slice(0, 10);
    const firm = (b.firmantes || []).filter(Boolean);
    const contratoData: any = {
      tipo: b.modo === 'arriendo' ? 'Arriendo' : 'Compraventa',
      vig: b.modo === 'arriendo',
      fecha,
      firm,
      acuerdoId: b.acuerdoId ? String(b.acuerdoId) : undefined,
      datos: b.datos || undefined,
      firmas: b.firmas || undefined,
    };
    if (b.modo === 'arriendo') {
      i.contratos.forEach((c) => (c.vig = false));
      i.contratos.unshift(contratoData);
      const v = new Date();
      v.setMonth(v.getMonth() + Number(b.dur || 12));
      i.estado = 'Arrendada';
      i.venc = v.toISOString().slice(0, 10);
      i.diaPago = Number(b.dia || 5);
    } else {
      contratoData.vig = false;
      i.contratos.unshift(contratoData);
      i.estado = 'Vendida';
      i.venc = '';
    }
    Object.assign(i, {
      valor: Number(b.val),
      dir: b.dir,
      barrio: b.bar,
      lind: b.lin,
      foto: b.foto?.trim() || i.foto,
      ...(b.descripcion !== undefined ? { descripcion: b.descripcion.trim() } : {}),
    });
    return i.save();
  }

  // Actualiza (o limpia) la foto del inmueble
  async setFoto(id: string, foto: string) {
    const i = await this.model.findById(id);
    if (!i) throw new NotFoundException('Inmueble no encontrado');
    i.foto = (foto || '').trim();
    return i.save();
  }
}
