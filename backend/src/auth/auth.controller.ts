import { Body, Controller, Get, HttpCode, Post, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public, UsuarioActual } from './public.decorator';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}





  @Public()
  @Post('google')
  @HttpCode(200)
  google(@Body() body: any) {
    return this.auth.loginConGoogle(body?.credential);
  }


  


  @Public()
  @Get('me')
  me(@UsuarioActual() usuario: any) {
    return { usuario: usuario || null };
  }

  @Post('salir')
  @HttpCode(200)
  salir(@Req() req: any) {
    return this.auth.salir(req);
  }
}
