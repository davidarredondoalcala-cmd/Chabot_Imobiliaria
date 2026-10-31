import { Property, Operacion, TipoInmueble, CriteriosDuros, SearchResultItem, SearchResponse } from './types';
import { SEED_PROPERTIES } from './seed';
import { generateStructuredJSON } from './llm';

export interface SearchInmueblesParams extends CriteriosDuros {
  operacion?: Operacion | null;
  criterios_blandos?: string | null;
  excluir_codigos?: string[];
}

export function getAllCatalogProperties(extraProperties?: Property[]): Property[] {
  const seedList: Property[] = SEED_PROPERTIES.map(p => ({
    ...p,
    id: `seed-${p.codigo}`,
  } as Property));

  if (extraProperties && extraProperties.length > 0) {
    return extraProperties;
  }
  return seedList;
}

/**
 * Búsqueda filtrada en memoria en el catálogo (MongoDB + Semilla)
 */
export function executeFilterSearch(
  criterios: SearchInmueblesParams,
  catalog: Property[]
): Property[] {
  let list = [...catalog].filter(p => p.disponible !== false);

  if (criterios.operacion) {
    list = list.filter(p => p.operacion.toLowerCase() === criterios.operacion?.toLowerCase());
  }
  if (criterios.tipo) {
    list = list.filter(p => p.tipo.toLowerCase() === criterios.tipo?.toLowerCase());
  }
  if (criterios.barrios && criterios.barrios.length > 0) {
    list = list.filter(p =>
      criterios.barrios!.some(b => p.barrio.toLowerCase().includes(b.toLowerCase()))
    );
  }
  if (criterios.precio_min != null && criterios.precio_min > 0) {
    list = list.filter(p => p.precio >= criterios.precio_min!);
  }
  if (criterios.precio_max != null && criterios.precio_max > 0) {
    list = list.filter(p => p.precio <= criterios.precio_max!);
  }
  if (criterios.habitaciones_min != null && criterios.habitaciones_min > 0) {
    list = list.filter(p => p.habitaciones >= criterios.habitaciones_min!);
  }
  if (criterios.habitaciones_max != null && criterios.habitaciones_max > 0) {
    list = list.filter(p => p.habitaciones <= criterios.habitaciones_max!);
  }
  if (criterios.banos_min != null && criterios.banos_min > 0) {
    list = list.filter(p => p.banos >= criterios.banos_min!);
  }
  if (criterios.banos_max != null && criterios.banos_max > 0) {
    list = list.filter(p => p.banos <= criterios.banos_max!);
  }
  if (criterios.parqueaderos_min != null && criterios.parqueaderos_min > 0) {
    list = list.filter(p => p.parqueaderos >= criterios.parqueaderos_min!);
  }
  if (criterios.estrato != null && criterios.estrato > 0) {
    list = list.filter(p => p.estrato === criterios.estrato);
  }
  if (criterios.area_min != null && criterios.area_min > 0) {
    list = list.filter(p => p.area_m2 >= criterios.area_min!);
  }
  if (criterios.excluir_codigos && criterios.excluir_codigos.length > 0) {
    const set = new Set(criterios.excluir_codigos.map(c => c.toUpperCase()));
    list = list.filter(p => !set.has(p.codigo.toUpperCase()));
  }

  if (criterios.orden_precio === 'desc') {
    list.sort((a, b) => b.precio - a.precio);
  } else {
    list.sort((a, b) => a.precio - b.precio);
  }

  return list.slice(0, 20);
}

/**
 * Reordena candidatos con LLM o fallback determinista
 */
async function rerankCandidates(
  candidates: Property[],
  criterios: SearchInmueblesParams
): Promise<SearchResultItem[]> {
  if (candidates.length <= 3 || criterios.orden_precio) {
    return candidates.slice(0, 3).map(c => ({
      inmueble: c,
      razon: criterios.orden_precio === 'desc'
        ? `Propiedad de alta gama en ${c.barrio} por valor de COP $${Number(c.precio).toLocaleString('es-CO')}.`
        : (criterios.orden_precio === 'asc'
          ? `Opción de máxima economía en ${c.barrio} por valor de COP $${Number(c.precio).toLocaleString('es-CO')}.`
          : `Cumple con ${c.tipo} en ${c.barrio} por valor de COP $${Number(c.precio).toLocaleString('es-CO')}.`)
    }));
  }

  try {
    const candidatesSummary = candidates.slice(0, 15).map(c => ({
      codigo: c.codigo,
      tipo: c.tipo,
      barrio: c.barrio,
      precio: c.precio,
      area_m2: c.area_m2,
      habitaciones: c.habitaciones,
    }));

    const result = await generateStructuredJSON<{
      top_3: { codigo: string; razon: string }[];
    }>({
      messages: [
        {
          role: 'system',
          content: 'Selecciona estrictamente los 3 MEJORES inmuebles en formato JSON {"top_3":[{"codigo":"...","razon":"..."}]}.'
        },
        {
          role: 'user',
          content: `Criterios: ${JSON.stringify(criterios)}\nCandidatos: ${JSON.stringify(candidatesSummary)}`
        }
      ],
      fallbackFactory: () => ({
        top_3: candidates.slice(0, 3).map(c => ({
          codigo: c.codigo,
          razon: `Opción destacada en ${c.barrio} por $${Number(c.precio).toLocaleString('es-CO')}.`
        }))
      })
    });

    const chosen: SearchResultItem[] = [];
    for (const item of result.top_3 || []) {
      const match = candidates.find(c => c.codigo.toUpperCase() === item.codigo.toUpperCase());
      if (match) {
        chosen.push({ inmueble: match, razon: item.razon });
      }
    }
    if (chosen.length > 0) return chosen.slice(0, 3);
  } catch {
    // fallback
  }

  return candidates.slice(0, 3).map(c => ({
    inmueble: c,
    razon: `Excelente opción de ${c.tipo} en ${c.barrio} con área de ${c.area_m2} m².`
  }));
}

/**
 * Función principal de búsqueda en catálogo con relajación controlada
 */
export async function buscarInmuebles(
  params: SearchInmueblesParams,
  extraProperties?: Property[]
): Promise<SearchResponse> {
  const catalog = getAllCatalogProperties(extraProperties);

  // Intento 1: Búsqueda estricta
  let candidates = executeFilterSearch(params, catalog);

  if (candidates.length > 0) {
    const reranked = await rerankCandidates(candidates, params);
    return {
      inmuebles: reranked,
      criterio_relajado: null,
      total_candidatos: candidates.length,
    };
  }

  // Intento 2: barrio estricto. Si el usuario nombró zonas y no hay nada, NO caemos
  // a otros barrios: se explica y se le invita a pedir opciones de otras zonas.
  if (params.barrios && params.barrios.length > 0) {
    return {
      inmuebles: [],
      criterio_relajado: mensajeZonaSinResultados(params, catalog),
      total_candidatos: 0,
    };
  }

  // Nada dentro del presupuesto: informar desde qué valor empiezan los registrados SOLO si el presupuesto está por debajo del mínimo
  const hayPresupuesto = (params.precio_max != null && params.precio_max > 0) || (params.precio_min != null && params.precio_min > 0);
  if (hayPresupuesto) {
    const minimo = getCatalogMinPrice(params.operacion, params.tipo, catalog);
    if (minimo && params.precio_max != null && params.precio_max < minimo.precio) {
      return {
        inmuebles: [],
        criterio_relajado: buildBelowBudgetMessage(params, minimo),
        total_candidatos: 0,
      };
    }
  }

  // Si no hay resultados por habitaciones u otros filtros duros, intentar relajar habitaciones
  if (params.habitaciones_min != null || params.habitaciones_max != null) {
    const sinHabitaciones = executeFilterSearch({
      ...params,
      habitaciones_min: null,
      habitaciones_max: null,
    }, catalog);

    if (sinHabitaciones.length > 0) {
      const reranked = await rerankCandidates(sinHabitaciones, params);
      const habDesc = params.habitaciones_max != null
        ? `con hasta ${params.habitaciones_max} habitaciones`
        : `con ${params.habitaciones_min} habitaciones`;
      return {
        inmuebles: reranked,
        criterio_relajado: `No encontré inmuebles exactos ${habDesc}, pero te comparto estas excelentes opciones disponibles en el catálogo:`,
        total_candidatos: sinHabitaciones.length,
      };
    }
  }

  return {
    inmuebles: [],
    criterio_relajado: 'No encontramos inmuebles con esos criterios exactos en nuestro catálogo actual.',
    total_candidatos: 0,
  };
}

/**
 * Mensaje único cuando el usuario pidió barrios concretos y no hay nada que encaje:
 * se aclara, se da el piso mínimo del catálogo si hay presupuesto y se invita a otras zonas.
 */
export function mensajeZonaSinResultados(
  params: SearchInmueblesParams,
  catalog?: Property[]
): string {
  const cop = (n: number) => `$${Math.round(n).toLocaleString('es-CO')} COP`;
  const zona = params.barrios!.join(', ');
  const sujeto = params.tipo === 'casa' ? 'casas' : params.tipo === 'apartamento' ? 'apartamentos' : 'casas y apartamentos';
  const accion = params.operacion === 'venta' ? 'para comprar' : params.operacion === 'arriendo' ? 'en arriendo' : 'disponibles';

  let mensaje = `Miré con calma nuestro catálogo y, por el momento, no tenemos ${sujeto} ${accion} en **${zona}**. 🏘️`;

  const hayPresupuesto = (params.precio_max != null && params.precio_max > 0) || (params.precio_min != null && params.precio_min > 0);
  if (hayPresupuesto) {
    const minimo = getCatalogMinPrice(params.operacion, params.tipo, catalog);
    if (minimo) {
      const periodo = minimo.operacion === 'arriendo' ? ' al mes' : '';
      mensaje += `\n\nTen en cuenta que en Ibagué los ${sujeto} ${accion} parten desde ${cop(minimo.precio)}${periodo}.`;
    }
  }

  mensaje += `\n\n**¿Quieres que te muestre opciones en otras zonas de Ibagué?** Dime “sí, otras zonas” y con mucho gusto te las traigo.`;
  return mensaje;
}

/**
 * Inmueble disponible más económico del catálogo para una operación/tipo dada.
 */
export function getCatalogMinPrice(
  operacion?: Operacion | null,
  tipo?: TipoInmueble | null,
  catalog?: Property[]
): { precio: number; operacion: Operacion; tipo: TipoInmueble } | null {
  const list = (catalog || getAllCatalogProperties())
    .filter(p => p.disponible !== false)
    .filter(p => !operacion || p.operacion.toLowerCase() === operacion.toLowerCase())
    .filter(p => !tipo || p.tipo.toLowerCase() === tipo.toLowerCase())
    .sort((a, b) => a.precio - b.precio);

  if (list.length === 0) return null;
  const r = list[0];
  return { precio: Number(r.precio), operacion: r.operacion, tipo: r.tipo };
}

/**
 * Mensaje único cuando no hay inmuebles dentro del presupuesto.
 */
export function buildBelowBudgetMessage(
  params: SearchInmueblesParams,
  minimo: { precio: number; operacion: Operacion; tipo: TipoInmueble }
): string {
  const cop = (n: number) => `$${Math.round(n).toLocaleString('es-CO')} COP`;
  const sujeto = params.tipo === 'casa' ? 'casas' : params.tipo === 'apartamento' ? 'apartamentos' : 'casas y apartamentos';
  const accion = minimo.operacion === 'venta' ? 'en venta' : 'en arriendo';
  const periodo = minimo.operacion === 'arriendo' ? ' al mes' : '';
  return `Los inmuebles registrados (${sujeto} ${accion}) empiezan desde ${cop(minimo.precio)}${periodo}. Con tu presupuesto no tenemos opciones disponibles en este momento.`;
}
