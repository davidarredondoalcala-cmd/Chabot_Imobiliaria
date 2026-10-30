import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { InmueblesController } from './inmuebles.controller';
import { InmueblesService } from './inmuebles.service';
import { Inmueble, InmuebleSchema } from './inmueble.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: Inmueble.name, schema: InmuebleSchema }])],
  controllers: [InmueblesController],
  providers: [InmueblesService],
  exports: [InmueblesService],
})
export class InmueblesModule {}
