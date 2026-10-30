import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ _id: false })
export class Contrato {
  @Prop() tipo: string; // Arriendo | Compraventa
  @Prop() vig: boolean; // contrato vigente
  @Prop() fecha: string;
  @Prop([String]) firm: string[];
}
export const ContratoSchema = SchemaFactory.createForClass(Contrato);

@Schema({ timestamps: true })
export class Inmueble {
  @Prop({ required: true, enum: ['Casa', 'Apartamento'] }) tipo: string;
  @Prop({ required: true }) nombre: string;
  @Prop({ default: 'Sin arrendar' }) estado: string; // Arrendada | Sin arrendar | Para la venta | Vendida
  @Prop() venc: string;
  @Prop() diaPago: number;
  @Prop() valor: number;
  @Prop() dir: string;
  @Prop() barrio: string;
  @Prop() lind: string;
  @Prop() habitaciones: number;
  @Prop() banos: number;
  @Prop() area: number; // metros cuadrados
  @Prop() foto: string; // URL pública de la foto (opcional)
  @Prop({ type: [ContratoSchema], default: [] }) contratos: Contrato[];
}
export type InmuebleDoc = HydratedDocument<Inmueble>;
export const InmuebleSchema = SchemaFactory.createForClass(Inmueble);
