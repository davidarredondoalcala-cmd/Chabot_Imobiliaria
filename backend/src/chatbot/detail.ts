import { Property } from './types';
import { getAllCatalogProperties } from './search';

export async function obtenerDetalleInmueble(
  codigo: string,
  extraProperties?: Property[]
): Promise<Property | null> {
  const catalog = getAllCatalogProperties(extraProperties);
  const cleanCode = codigo.trim().toUpperCase();

  const found = catalog.find(
    p => p.codigo.toUpperCase() === cleanCode || p.id === codigo
  );

  return found || null;
}
