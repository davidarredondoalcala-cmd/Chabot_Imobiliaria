// Error de negocio del módulo de firmas: lleva su status HTTP
export class ErrorFirma extends Error {
  status: number;
  constructor(status: number, mensaje: string) {
    super(mensaje);
    this.status = status;
  }
}
