import { describe, it, expect } from 'vitest';
import { SEED_PROPERTIES } from '../seed.js';
import { getEmbedding } from '../../services/embedding.js';

describe('Fase 1: Validación de Datos de Seed y Embeddings', () => {
  it('debe contener exactamente 40 propiedades verosímiles en Ibagué', () => {
    expect(SEED_PROPERTIES.length).toBe(40);
  });

  it('todos los códigos deben ser únicos y seguir el patrón IBG-XXXX', () => {
    const codigos = SEED_PROPERTIES.map(p => p.codigo);
    const setCodigos = new Set(codigos);
    expect(setCodigos.size).toBe(40);
    for (const c of codigos) {
      expect(c).toMatch(/^IBG-\d{4}$/);
    }
  });

  it('todas las operaciones deben ser "venta" o "arriendo"', () => {
    for (const p of SEED_PROPERTIES) {
      expect(['venta', 'arriendo']).toContain(p.operacion);
    }
  });

  it('todos los tipos deben ser válidos', () => {
    const validTypes = ['casa', 'apartamento', 'local', 'lote', 'oficina'];
    for (const p of SEED_PROPERTIES) {
      expect(validTypes).toContain(p.tipo);
    }
  });

  it('todas las propiedades deben tener precios y áreas coherentes en COP', () => {
    for (const p of SEED_PROPERTIES) {
      expect(p.precio).toBeGreaterThan(0);
      expect(p.area_m2).toBeGreaterThan(0);
      expect(p.barrio).toBeTruthy();
      expect(p.ciudad).toBe('Ibagué');
      expect(p.estrato).toBeGreaterThanOrEqual(1);
      expect(p.estrato).toBeLessThanOrEqual(6);
      expect(Array.isArray(p.amenidades)).toBe(true);
    }
  });

  it('el generador de embeddings debe devolver un vector de 1536 dimensiones normalizado', async () => {
    const text = 'Apartamento cómodo en El Vergel con piscina y balcón';
    const embedding = await getEmbedding(text);
    expect(embedding.length).toBe(1536);

    // Calcular norma euclidiana L2: sqrt(sum(x^2)) debe ser aproximadamente 1
    const norm = Math.sqrt(embedding.reduce((acc, val) => acc + val * val, 0));
    expect(norm).toBeCloseTo(1.0, 2);
  });
});
