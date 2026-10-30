import { BadRequestException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Inmueble, InmuebleDoc } from './inmueble.schema';

const F = ['Pepito', 'Juanito', 'Andres'];
const SEMILLA = [
  { tipo: 'Casa', nombre: 'Casa Piedra Pintada', habitaciones: 3, banos: 2, area: 110, estado: 'Arrendada', venc: '2026-12-30', diaPago: 5, valor: 1000000, dir: 'Cll 10 # 5 - 20', barrio: 'Piedra Pintada', lind: 'Al norte la calle, al sur la casa #, al este el edificio rojo, al oeste la casa de don Juan.', contratos: [{ tipo: 'Arriendo', vig: true, fecha: '2025-12-30', firm: F }, { tipo: 'Arriendo', vig: false, fecha: '2024-12-30', firm: F }] },
  { tipo: 'Casa', nombre: 'Casa El Vergel', habitaciones: 4, banos: 3, area: 140, estado: 'Arrendada', venc: '2027-03-15', diaPago: 5, valor: 1200000, dir: 'Cll 12 # 8 - 14', barrio: 'El Vergel', lind: '', contratos: [{ tipo: 'Arriendo', vig: true, fecha: '2026-03-15', firm: ['Maria', 'Luis'] }] },
  { tipo: 'Casa', nombre: 'Casa Jordán', habitaciones: 3, banos: 2, area: 95, estado: 'Sin arrendar', valor: 900000, dir: 'Cra 3 # 4 - 10', barrio: 'Jordán', lind: '' },
  { tipo: 'Casa', nombre: 'Casa Interlaken', habitaciones: 4, banos: 3, area: 180, estado: 'Para la venta', valor: 300000000, dir: 'Cll 20 # 1 - 5', barrio: 'Interlaken', lind: '' },
  { tipo: 'Apartamento', nombre: 'Apto Torres del Parque 302', habitaciones: 2, banos: 2, area: 68, estado: 'Arrendada', venc: '2026-11-20', diaPago: 10, valor: 850000, dir: 'Cra 5 # 30 - 12 Apto 302', barrio: 'La Pola', lind: '', contratos: [{ tipo: 'Arriendo', vig: true, fecha: '2025-11-20', firm: ['Carlos', 'Ana'] }] },
  { tipo: 'Apartamento', nombre: 'Apto Mirador 601', habitaciones: 3, banos: 2, area: 85, estado: 'Sin arrendar', valor: 1100000, dir: 'Cll 60 # 4 - 55 Apto 601', barrio: 'Ambalá', lind: '' },
  { tipo: 'Apartamento', nombre: 'Apto Central 204', habitaciones: 2, banos: 1, area: 55, estado: 'Para la venta', valor: 210000000, dir: 'Cll 11 # 3 - 40 Apto 204', barrio: 'Centro', lind: '' },
];

@Injectable()
export class InmueblesService implements OnModuleInit {
  constructor(@InjectModel(Inmueble.name) private model: Model<InmuebleDoc>) {}

  // Si la colección está vacía, carga datos de ejemplo
  async onModuleInit() {
    if ((await this.model.estimatedDocumentCount()) === 0) await this.model.insertMany(SEMILLA);
    // Bases ya creadas: completa habitaciones, baños y área en los inmuebles de ejemplo
    for (const s of SEMILLA) {
      await this.model.updateOne(
        { nombre: s.nombre, habitaciones: { $exists: false } },
        { $set: { habitaciones: s.habitaciones, banos: s.banos, area: s.area } },
      );
    }
  }

  findAll() {
    return this.model.find().sort({ createdAt: 1 }).lean();
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
      dir: b.dir.trim(), barrio: b.barrio?.trim() || '', lind: b.lind?.trim() || '',
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
    if (b.modo === 'arriendo') {
      i.contratos.forEach((c) => (c.vig = false));
      i.contratos.unshift({ tipo: 'Arriendo', vig: true, fecha, firm });
      const v = new Date();
      v.setMonth(v.getMonth() + Number(b.dur || 12));
      i.estado = 'Arrendada';
      i.venc = v.toISOString().slice(0, 10);
      i.diaPago = Number(b.dia || 5);
    } else {
      i.contratos.unshift({ tipo: 'Compraventa', vig: false, fecha, firm });
      i.estado = 'Vendida';
      i.venc = '';
    }
    Object.assign(i, { valor: Number(b.val), dir: b.dir, barrio: b.bar, lind: b.lin, foto: b.foto?.trim() || i.foto });
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
