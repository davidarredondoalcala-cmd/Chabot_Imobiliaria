import { BadRequestException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Inmueble, InmuebleDoc } from './inmueble.schema';
import { SEED_PROPERTIES } from '../chatbot/seed';

const F = ['Pepito', 'Juanito', 'Andres'];
const SEMILLA = [
  {
    tipo: 'Casa',
    nombre: 'Casa Piedra Pintada',
    habitaciones: 3,
    banos: 2,
    area: 110,
    estado: 'Arrendada',
    venc: '2026-12-30',
    diaPago: 5,
    valor: 1000000,
    dir: 'Cll 10 # 5 - 20',
    barrio: 'Piedra Pintada',
    lind: 'Al norte la calle, al sur la casa #, al este el edificio rojo, al oeste la casa de don Juan.',
    descripcion: 'Acogedora casa familiar con excelente distribución, tres habitaciones iluminadas, patio interior y garaje cubierto en un sector residencial tranquilo y central.',
    contratos: [{ tipo: 'Arriendo', vig: true, fecha: '2025-12-30', firm: F }, { tipo: 'Arriendo', vig: false, fecha: '2024-12-30', firm: F }],
  },
  {
    tipo: 'Casa',
    nombre: 'Casa El Vergel',
    habitaciones: 4,
    banos: 3,
    area: 140,
    estado: 'Arrendada',
    venc: '2027-03-15',
    diaPago: 5,
    valor: 1200000,
    dir: 'Cll 12 # 8 - 14',
    barrio: 'El Vergel',
    lind: '',
    descripcion: 'Espaciosa residencia de dos niveles en conjunto cerrado, con amplios ventanales, cocina integral, acabados modernos y agradable entorno campestre.',
    contratos: [{ tipo: 'Arriendo', vig: true, fecha: '2026-03-15', firm: ['Maria', 'Luis'] }],
  },
  {
    tipo: 'Casa',
    nombre: 'Casa Jordán',
    habitaciones: 3,
    banos: 2,
    area: 95,
    estado: 'Sin arrendar',
    valor: 900000,
    dir: 'Cra 3 # 4 - 10',
    barrio: 'Jordán',
    lind: '',
    descripcion: 'Cómoda vivienda sobre vía principal con fácil acceso a transporte, comercios y colegios, ideal para familias que buscan practicidad y confort.',
  },
  {
    tipo: 'Casa',
    nombre: 'Casa Interlaken',
    habitaciones: 4,
    banos: 3,
    area: 180,
    estado: 'Para la venta',
    valor: 300000000,
    dir: 'Cll 20 # 1 - 5',
    barrio: 'Interlaken',
    lind: '',
    descripcion: 'Gran casa tradicional con generosos espacios, patio de ropas independiente, jardín frontal y ubicación privilegiada en zona de alta valorización.',
  },
  {
    tipo: 'Apartamento',
    nombre: 'Apto Torres del Parque 302',
    habitaciones: 2,
    banos: 2,
    area: 68,
    estado: 'Arrendada',
    venc: '2026-11-20',
    diaPago: 10,
    valor: 850000,
    dir: 'Cra 5 # 30 - 12 Apto 302',
    barrio: 'La Pola',
    lind: '',
    descripcion: 'Apartamento moderno con linda vista al cañón del Combeima, sala-comedor ventilada, balcón privado y vigilancia permanente las 24 horas.',
    contratos: [{ tipo: 'Arriendo', vig: true, fecha: '2025-11-20', firm: ['Carlos', 'Ana'] }],
  },
  {
    tipo: 'Apartamento',
    nombre: 'Apto Mirador 601',
    habitaciones: 3,
    banos: 2,
    area: 85,
    estado: 'Sin arrendar',
    valor: 1100000,
    dir: 'Cll 60 # 4 - 55 Apto 601',
    barrio: 'Ambalá',
    lind: '',
    descripcion: 'Inmueble iluminado en piso alto con ascensor, tres alcobas con clóset, cocina semi-integral y cercanía a centros comerciales y universidades.',
  },
  {
    tipo: 'Apartamento',
    nombre: 'Apto Central 204',
    habitaciones: 2,
    banos: 1,
    area: 55,
    estado: 'Para la venta',
    valor: 210000000,
    dir: 'Cll 11 # 3 - 40 Apto 204',
    barrio: 'Centro',
    lind: '',
    descripcion: 'Apartamento funcional y bien ubicado a pasos del centro financiero, ideal para inversión o personas que buscan practicidad y bajos costos.',
  },
];

@Injectable()
export class InmueblesService implements OnModuleInit {
  constructor(@InjectModel(Inmueble.name) private model: Model<InmuebleDoc>) {}

  // Si la colección está vacía, carga datos de ejemplo y sincroniza las propiedades del chatbot
  async onModuleInit() {
    if ((await this.model.estimatedDocumentCount()) === 0) await this.model.insertMany(SEMILLA);
    // Bases ya creadas: completa habitaciones, baños, área y descripción en los inmuebles de ejemplo
    for (const s of SEMILLA) {
      await this.model.updateOne(
        { nombre: s.nombre },
        {
          $set: {
            habitaciones: s.habitaciones,
            banos: s.banos,
            area: s.area,
            ...(s.descripcion ? { descripcion: s.descripcion } : {}),
          },
        },
      );
    }

    // Sincroniza todas las propiedades del chatbot para que existan en la base de datos
    for (const sp of SEED_PROPERTIES) {
      const existe = await this.model.findOne({
        $or: [
          { nombre: sp.titulo },
          { dir: sp.direccion_aproximada },
        ],
      });
      if (!existe) {
        await this.model.create({
          tipo: (sp.tipo || 'casa').toLowerCase() === 'apartamento' ? 'Apartamento' : 'Casa',
          nombre: sp.titulo,
          descripcion: sp.descripcion || '',
          estado: sp.operacion === 'venta' ? 'Para la venta' : (sp.disponible ? 'Sin arrendar' : 'Arrendada'),
          valor: sp.precio,
          dir: sp.direccion_aproximada || `Sector ${sp.barrio}`,
          barrio: sp.barrio,
          lind: 'Al norte con predio vecino, al sur con vía pública, al oriente y occidente con propiedad privada.',
          habitaciones: sp.habitaciones || 2,
          banos: sp.banos || 2,
          area: sp.area_m2 || 75,
          contratos: [],
        });
      } else {
        // Actualiza el nombre sencillo y la descripción si estaba vacía o con el título largo previo
        const update: any = {};
        if (sp.titulo && existe.nombre !== sp.titulo && (existe.dir === sp.direccion_aproximada || sp.titulo.includes(existe.barrio || ''))) {
          update.nombre = sp.titulo;
        }
        if (sp.descripcion && (!existe.descripcion || existe.descripcion.trim() === '')) {
          update.descripcion = sp.descripcion;
        }
        if (Object.keys(update).length > 0) {
          await this.model.updateOne({ _id: existe._id }, { $set: update });
        }
      }
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
