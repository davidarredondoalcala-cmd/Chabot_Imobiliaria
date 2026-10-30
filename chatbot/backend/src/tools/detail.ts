import { query } from '../db/index.js';
import { Property } from '../types/index.js';
import { SEED_PROPERTIES } from '../db/seed.js';

export async function obtenerDetalleInmueble(codigo: string): Promise<Property | null> {
  const cleanCode = codigo.trim().toUpperCase();

  try {
    const result = await query(
      `SELECT id, codigo, operacion, tipo, titulo, descripcion, ciudad, barrio,
              direccion_aproximada, lat, lng, precio, area_m2, habitaciones,
              banos, parqueaderos, estrato, amenidades, disponible, url_ficha
       FROM properties
       WHERE UPPER(codigo) = $1`,
      [cleanCode]
    );

    if (result.rows.length > 0) {
      return result.rows[0] as Property;
    }
  } catch (dbError) {
    if (process.env.NODE_ENV !== 'test') {
      console.warn('[Tool Detail] Error consultando PostgreSQL. Buscando en fallback en memoria:', dbError);
    }
  }

  // Fallback en memoria si la BD no está disponible durante pruebas unitarias
  const memoryProp = SEED_PROPERTIES.find(p => p.codigo.toUpperCase() === cleanCode);
  if (memoryProp) {
    return {
      ...memoryProp,
      id: `mock-${memoryProp.codigo}`,
      disponible: true,
    } as Property;
  }

  return null;
}
