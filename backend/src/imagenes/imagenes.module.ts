import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ImagenesController } from './imagenes.controller';
import { ImagenesStorage } from './storage';
import { Imagen, ImagenSchema } from './imagen.model';

@Module({
  imports: [MongooseModule.forFeature([{ name: Imagen.name, schema: ImagenSchema }])],
  controllers: [ImagenesController],
  providers: [ImagenesStorage],
})
export class ImagenesModule {}
