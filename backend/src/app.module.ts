import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { InmueblesModule } from './inmuebles/inmuebles.module';
import { FirmasModule } from './firmas/firmas.module';
import { ImagenesModule } from './imagenes/imagenes.module';
import { AuthModule } from './auth/auth.module';
import { AuthGuard } from './auth/auth.guard';
import { FiltroApi } from './filtros';
import { ChatbotModule } from './chatbot/chatbot.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Conexión a MongoDB Atlas: se configura con la variable MONGODB_URI (.env)
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('MONGODB_URI') || 'mongodb://127.0.0.1:27017/habitat-capital',
      }),
    }),
    InmueblesModule,
    FirmasModule,
    ImagenesModule,
    AuthModule,
    ChatbotModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: FiltroApi },
    // Guard global de sesión: protege todo salvo las rutas marcadas con @Public()
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AppModule {}
