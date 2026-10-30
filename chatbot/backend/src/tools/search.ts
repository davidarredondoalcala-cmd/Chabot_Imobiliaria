import { query } from '../db/index.js';
import { Property, Operacion, TipoInmueble, CriteriosDuros } from '../types/index.js';
import { getEmbedding } from '../services/embedding.js';
import { generateStructuredJSON } from '../services/llm.js';
import { SEED_PROPERTIES } from '../db/seed.js';

export interface SearchInmueblesParams extends CriteriosDuros {
  operacion?: Operacion | null;
  criterios_blandos?: string | null;
  excluir_codigos?: string[];
}

export interface SearchResultItem {
  inmueble: Property;
  razon?: string;
  similitud?: number;
}

export interface SearchResponse {
  inmuebles: SearchResultItem[];
  criterio_relajado?: string | null;
  total_candidatos: number;
}

/**
 * Reordena candidatos con el LLM según ajuste a la solicitud del usuario
 */
async function rerankCandidatesWithLLM(
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

  const promptUserCriteria = JSON.stringify({
    operacion: criterios.operacion,
    tipo: criterios.tipo,
    barrios: criterios.barrios,
    presupuesto_max: criterios.precio_max,
    criterios_blandos: criterios.criterios_blandos,
  });

  const candidatesSummary = candidates.slice(0, 20).map(c => ({
    codigo: c.codigo,
    tipo: c.tipo,
    barrio: c.barrio,
    precio: c.precio,
    area_m2: c.area_m2,
    habitaciones: c.habitaciones,
    amenidades: c.amenidades,
    descripcion_corta: c.descripcion.slice(0, 150)
  }));

  try {
    const result = await generateStructuredJSON<{
      top_3: { codigo: string; razon: string }[];
    }>({
      messages: [
        {
          role: 'system',
          content: `Eres un asistente inmobiliario en Ibagué. Tu tarea es seleccionar estrictamente los 3 MEJORES inmuebles de la lista proporcionada que mejor se ajusten a lo pedido por el usuario (sin suponer condiciones que el usuario no mencionó). Devuelve un JSON con el campo "top_3", donde cada elemento tenga "codigo" y "razon" (máximo 25 palabras explicando por qué encaja).`
        },
        {
          role: 'user',
          content: `Criterios del usuario:\n${promptUserCriteria}\n\nCandidatos disponibles:\n${JSON.stringify(candidatesSummary)}`
        }
      ],
      fallbackFactory: () => {
        return {
          top_3: candidates.slice(0, 3).map(c => ({
            codigo: c.codigo,
            razon: `Opción destacada en ${c.barrio} con ${c.habitaciones} habitaciones por $${Number(c.precio).toLocaleString('es-CO')}.`
          }))
        };
      }
    });

    const chosenItems: SearchResultItem[] = [];
    for (const item of result.top_3 || []) {
      const match = candidates.find(c => c.codigo.toUpperCase() === item.codigo.toUpperCase());
      if (match) {
        chosenItems.push({
          inmueble: match,
          razon: item.razon,
        });
      }
    }

    if (chosenItems.length > 0) {
      return chosenItems.slice(0, 3);
    }
  } catch (err) {
    console.warn('[Rerank] Error llamando a LLM para re-ranking, usando ranking top por similitud/precio:', err);
  }

  // Fallback seguro: tomar los primeros 3
  return candidates.slice(0, 3).map(c => ({
    inmueble: c,
    razon: `Excelente opción de ${c.tipo} en ${c.barrio} con área de ${c.area_m2} m².`
  }));
}

/**
 * Búsqueda filtrada en base de datos PostgreSQL con pgvector
 */
async function executeDbSearch(
  criterios: SearchInmueblesParams,
  queryVector: number[] | null
): Promise<Property[]> {
  const conditions: string[] = ['disponible = true'];
  const values: any[] = [];
  let paramIndex = 1;

  if (criterios.operacion) {
    conditions.push(`operacion = $${paramIndex++}`);
    values.push(criterios.operacion.toLowerCase());
  }

  if (criterios.tipo) {
    conditions.push(`tipo = $${paramIndex++}`);
    values.push(criterios.tipo.toLowerCase());
  }

  if (criterios.barrios && criterios.barrios.length > 0) {
    const barrioConditions = criterios.barrios.map(b => {
      values.push(`%${b}%`);
      return `barrio ILIKE $${paramIndex++}`;
    });
    conditions.push(`(${barrioConditions.join(' OR ')})`);
  }

  if (criterios.precio_min != null && criterios.precio_min > 0) {
    conditions.push(`precio >= $${paramIndex++}`);
    values.push(criterios.precio_min);
  }

  if (criterios.precio_max != null && criterios.precio_max > 0) {
    conditions.push(`precio <= $${paramIndex++}`);
    values.push(criterios.precio_max);
  }

  if (criterios.habitaciones_min != null && criterios.habitaciones_min > 0) {
    conditions.push(`habitaciones >= $${paramIndex++}`);
    values.push(criterios.habitaciones_min);
  }

  if (criterios.banos_min != null && criterios.banos_min > 0) {
    conditions.push(`banos >= $${paramIndex++}`);
    values.push(criterios.banos_min);
  }

  if (criterios.parqueaderos_min != null && criterios.parqueaderos_min > 0) {
    conditions.push(`parqueaderos >= $${paramIndex++}`);
    values.push(criterios.parqueaderos_min);
  }

  if (criterios.estrato != null && criterios.estrato > 0) {
    conditions.push(`estrato = $${paramIndex++}`);
    values.push(criterios.estrato);
  }

  if (criterios.area_min != null && criterios.area_min > 0) {
    conditions.push(`area_m2 >= $${paramIndex++}`);
    values.push(criterios.area_min);
  }

  if (criterios.excluir_codigos && criterios.excluir_codigos.length > 0) {
    conditions.push(`codigo NOT IN (${criterios.excluir_codigos.map(() => `$${paramIndex++}`).join(',')})`);
    values.push(...criterios.excluir_codigos.map(c => c.toUpperCase()));
  }

  let orderBy = criterios.orden_precio === 'desc' ? 'ORDER BY precio DESC' : 'ORDER BY precio ASC';
  if (queryVector && queryVector.length > 0 && !criterios.orden_precio) {
    const vectorParam = `$${paramIndex++}`;
    values.push(`[${queryVector.join(',')}]`);
    orderBy = `ORDER BY (embedding <=> ${vectorParam}::vector) ASC`;
  }

  const sql = `
    SELECT id, codigo, operacion, tipo, titulo, descripcion, ciudad, barrio,
           direccion_aproximada, lat, lng, precio, area_m2, habitaciones,
           banos, parqueaderos, estrato, amenidades, disponible, url_ficha
    FROM properties
    WHERE ${conditions.join(' AND ')}
    ${orderBy}
    LIMIT 20;
  `;

  const res = await query(sql, values);
  return res.rows as Property[];
}

/**
 * Búsqueda filtrada en memoria (fallback en caso de desconexión o pruebas locales rápidas)
 */
function executeMemorySearch(
  criterios: SearchInmueblesParams
): Property[] {
  let list = SEED_PROPERTIES.map(p => ({ ...p, id: `seed-${p.codigo}` } as Property));

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
  if (criterios.banos_min != null && criterios.banos_min > 0) {
    list = list.filter(p => p.banos >= criterios.banos_min!);
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

  // Ordenar por precio según orden_precio solicitado
  if (criterios.orden_precio === 'desc') {
    list.sort((a, b) => b.precio - a.precio);
  } else {
    list.sort((a, b) => a.precio - b.precio);
  }
  return list.slice(0, 20);
}

/**
 * Función principal de búsqueda híbrida con relajación controlada
 */
export async function buscarInmuebles(params: SearchInmueblesParams): Promise<SearchResponse> {
  let queryVector: number[] | null = null;
  if (params.criterios_blandos && params.criterios_blandos.trim().length > 0) {
    try {
      queryVector = await getEmbedding(params.criterios_blandos);
    } catch (e) {
      console.warn('[Search] No se pudo generar embedding de criterios blandos:', e);
    }
  }

  // Intento 1: Búsqueda estricta con todos los criterios
  let candidates: Property[] = [];
  try {
    candidates = await executeDbSearch(params, queryVector);
  } catch (dbErr) {
    if (process.env.NODE_ENV !== 'test') {
      console.warn('[Search] Falló búsqueda en BD, ejecutando fallback en memoria:', dbErr);
    }
    candidates = executeMemorySearch(params);
  }

  if (candidates.length > 0) {
    const reranked = await rerankCandidatesWithLLM(candidates, params);
    return {
      inmuebles: reranked,
      criterio_relajado: null,
      total_candidatos: candidates.length,
    };
  }


  // Sin resultados dentro del presupuesto. Solo se relaja la ZONA (el presupuesto NO se amplía).
  console.log('[Search] 0 resultados iniciales. Verificando zona alternativa dentro del mismo presupuesto...');

  if (params.barrios && params.barrios.length > 0) {
    const paramsSinBarrio: SearchInmueblesParams = { ...params, barrios: undefined };
    try {
      candidates = await executeDbSearch(paramsSinBarrio, queryVector);
    } catch {
      candidates = executeMemorySearch(paramsSinBarrio);
    }

    if (candidates.length > 0) {
      const reranked = await rerankCandidatesWithLLM(candidates, paramsSinBarrio);
      return {
        inmuebles: reranked,
        criterio_relajado: `No encontré disponibilidad exacta en ${params.barrios.join(', ')} dentro de tu presupuesto, pero te comparto alternativas en otros sectores de Ibagué que sí lo cumplen:`,
        total_candidatos: candidates.length,
      };
    }
  }

  // Nada dentro del presupuesto: NO se listan inmuebles; solo se informa desde qué valor empiezan los registrados.
  const hayPresupuesto = (params.precio_max != null && params.precio_max > 0) || (params.precio_min != null && params.precio_min > 0);
  if (hayPresupuesto) {
    const minimo = await getCatalogMinPrice(params.operacion, params.tipo);
    if (minimo) {
      return {
        inmuebles: [],
        criterio_relajado: buildBelowBudgetMessage(params, minimo),
        total_candidatos: 0,
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
 * Inmueble disponible más económico del catálogo para una operación/tipo dada.
 * Consulta la base de datos y, si no está disponible, el catálogo en memoria.
 */
export async function getCatalogMinPrice(
  operacion?: Operacion | null,
  tipo?: TipoInmueble | null
): Promise<{ precio: number; operacion: Operacion; tipo: TipoInmueble } | null> {
  let rows: Property[] = [];
  try {
    const conds: string[] = ['disponible = true'];
    const vals: any[] = [];
    if (operacion) { vals.push(operacion.toLowerCase()); conds.push(`operacion = $${vals.length}`); }
    if (tipo) { vals.push(tipo.toLowerCase()); conds.push(`tipo = $${vals.length}`); }
    const res = await query(
      `SELECT operacion, tipo, precio FROM properties WHERE ${conds.join(' AND ')} ORDER BY precio ASC LIMIT 1`,
      vals
    );
    rows = res.rows as Property[];
  } catch {
    rows = [];
  }

  if (rows.length === 0) {
    rows = SEED_PROPERTIES
      .filter(p => p.disponible !== false)
      .filter(p => !operacion || p.operacion === operacion)
      .filter(p => !tipo || p.tipo === tipo)
      .sort((a, b) => a.precio - b.precio)
      .slice(0, 1) as Property[];
  }

  if (rows.length === 0) return null;
  const r = rows[0];
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
