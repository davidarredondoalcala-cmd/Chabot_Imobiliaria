import { SetMetadata, createParamDecorator, ExecutionContext } from '@nestjs/common';

// Marca una ruta como pública (el guard global no exigirá sesión).
export const ES_PUBLICA = 'esPublica';
export const Public = () => SetMetadata(ES_PUBLICA, true);

// Inyecta el usuario autenticado (lo pone el guard) en el handler.
export const UsuarioActual = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest();
  return req.usuario;
});
