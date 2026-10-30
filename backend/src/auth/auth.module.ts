import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { NOMBRE_SESION, NOMBRE_USUARIO, SesionSchema, UsuarioSchema } from './model';



@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: NOMBRE_USUARIO, schema: UsuarioSchema },
      { name: NOMBRE_SESION, schema: SesionSchema },
    ]),
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthGuard],
  exports: [AuthService, AuthGuard],
})
export class AuthModule {}
