import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

// Imagen guardada en Mongo (colección "imagenes"). Persiste aunque Render se
// duerma o redeploye, a diferencia del disco efímero del contenedor.
@Schema({ timestamps: true, collection: 'imagenes' })
export class Imagen {
  @Prop({ required: true, unique: true, index: true }) nombre: string;
  @Prop() tipo: string; // casa | apartamento | hotel | otro
  @Prop() contentType: string; // image/png | image/jpeg | image/webp
  @Prop() width: number;
  @Prop() height: number;
  @Prop({ type: Buffer }) buffer: Buffer;
}

export type ImagenDoc = HydratedDocument<Imagen>;
export const ImagenSchema = SchemaFactory.createForClass(Imagen);
