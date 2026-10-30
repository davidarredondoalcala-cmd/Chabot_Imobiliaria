import { describe, it, expect } from 'vitest';
import { obtenerDetalleInmueble } from '../detail.js';
import { buscarInmuebles } from '../search.js';

describe('Fase 2: Herramientas de Búsqueda y Detalle', () => {
  describe('obtenerDetalleInmueble', () => {
    it('debe devolver los detalles completos de un inmueble existente (ej. IBG-0001)', async () => {
      const prop = await obtenerDetalleInmueble('IBG-0001');
      expect(prop).not.toBeNull();
      expect(prop?.codigo).toBe('IBG-0001');
      expect(prop?.tipo).toBe('apartamento');
      expect(prop?.barrio).toBe('El Vergel');
      expect(prop?.operacion).toBe('arriendo');
      expect(prop?.precio).toBe(2500000);
      expect(prop?.amenidades.length).toBeGreaterThan(0);
    });

    it('debe devolver null para un código inexistente o inventado', async () => {
      const prop = await obtenerDetalleInmueble('INVENTADO-9999');
      expect(prop).toBeNull();
    });

    it('debe manejar códigos en minúsculas sin distinción de mayúsculas/minúsculas', async () => {
      const prop = await obtenerDetalleInmueble('ibg-0002');
      expect(prop).not.toBeNull();
      expect(prop?.codigo).toBe('IBG-0002');
    });
  });

  describe('buscarInmuebles', () => {
    it('debe filtrar correctamente por tipo y presupuesto máximo', async () => {
      const result = await buscarInmuebles({
        operacion: 'arriendo',
        tipo: 'apartamento',
        precio_max: 1500000,
      });

      expect(result.inmuebles.length).toBeGreaterThan(0);
      expect(result.inmuebles.length).toBeLessThanOrEqual(3);
      for (const item of result.inmuebles) {
        expect(item.inmueble.operacion).toBe('arriendo');
        expect(item.inmueble.tipo).toBe('apartamento');
        expect(item.inmueble.precio).toBeLessThanOrEqual(1500000);
      }
    });

    it('debe excluir inmuebles indicados en excluir_codigos', async () => {
      const exclude = ['IBG-0003', 'IBG-0007'];
      const result = await buscarInmuebles({
        operacion: 'arriendo',
        tipo: 'apartamento',
        excluir_codigos: exclude,
      });

      for (const item of result.inmuebles) {
        expect(exclude).not.toContain(item.inmueble.codigo);
      }
    });

    it('debe relajar el presupuesto si inicialmente no hay resultados en el rango ajustado', async () => {
      // Precio muy ajustado en El Vergel que no existe a 2.3M (está en 2.5M)
      const result = await buscarInmuebles({
        operacion: 'arriendo',
        tipo: 'apartamento',
        barrios: ['El Vergel'],
        precio_max: 2300000,
      });

      // El presupuesto NO se amplía: sin opciones en El Vergel se buscan otros sectores dentro del mismo tope
      expect(result.inmuebles.length).toBeGreaterThan(0);
      for (const item of result.inmuebles) {
        expect(item.inmueble.precio).toBeLessThanOrEqual(2300000);
      }
      expect(result.criterio_relajado).toContain('otros sectores');
    });

    it('debe ejecutar búsqueda híbrida con criterios blandos sin fallos', async () => {
      const result = await buscarInmuebles({
        operacion: 'venta',
        tipo: 'casa',
        criterios_blandos: 'clima fresco y ambiente tranquilo para familia',
      });

      expect(result.inmuebles.length).toBeGreaterThan(0);
      expect(result.inmuebles[0].inmueble.tipo).toBe('casa');
      expect(result.inmuebles[0].inmueble.operacion).toBe('venta');
    });
  });
});
