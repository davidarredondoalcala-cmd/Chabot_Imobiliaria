import { ExtractedUnderstanding, Operacion, TipoInmueble } from '../types/index.js';
import { generateStructuredJSON } from '../services/llm.js';
import { normalizeColombianMoney } from './normalizer.js';

const SYSTEM_NLU_PROMPT = `
Eres un módulo de NLU especializado en el mercado inmobiliario colombiano (específicamente Ibagué, Tolima).
Tu tarea es analizar el mensaje del usuario y el historial reciente para extraer datos estructurados con precisión quirúrgica.

Reglas obligatorias:
1. "intencion":
   - "buscar": si busca propiedades, pide opciones, pregunta qué hay disponible, o da criterios de búsqueda.
   - "detalle_inmueble": si pregunta detalles específicos (precio, área, amenidades, fotos) de un código de inmueble específico o del listado previo.
   - "hablar_con_asesor": si pide expresamente hablar con una persona/humano, asesor, negociar precio, trámites legales/notaría, agendar visita.
   - "saludo_o_otro": saludos ("hola", "buenas"), agradecimientos ("gracias"), despedidas o comentarios generales.
2. "operacion": 'venta' | 'arriendo' | null.
   - Si el usuario dice "compra", "comprar", "compro", "comprarme", "adquirir", "venta", "en venta": pon ESTRICTAMENTE 'venta', SIN IMPORTAR el monto del presupuesto (incluso si dice 10 millones o 5 millones).
   - Si el usuario dice "arriendo", "arrendar", "alquiler", "alquilar", "arrendo": pon ESTRICTAMENTE 'arriendo'.
   - Si NO especifica compra ni arriendo: montos hasta 20M COP sugieren arriendo mensual; montos desde 40M COP sugieren venta.
3. "criterios_duros":
   - tipo: 'casa' | 'apartamento' | null (IMPORTANTE: Nuestro catálogo se especializa única y exclusivamente en casas y apartamentos residenciales).
   - ciudad: ej. 'Ibagué'
   - barrios: array con nombres de barrios mencionados (ej. ["El Vergel", "Cádiz"]) o null
   - precio_min, precio_max: en pesos colombianos (COP numérico entero)
   - habitaciones_min, banos_min, parqueaderos_min, area_min, estrato: números enteros o null
   - NUNCA inventes criterios duros que el usuario no dijo explícitamente.
4. "criterios_blandos": texto libre con descriptores subjetivos o vagos (ej. "tranquilo", "cerca de transporte", "iluminado", "familiar"). Lo vago va aquí.
5. "codigo_inmueble_mencionado": si menciona un código como "IBG-0001", extráelo aquí.
6. "tipo_no_soportado": si el usuario pide local, lote, oficina, bodega, finca, etc.

Devuelve estrictamente un objeto JSON con el siguiente esquema:
{
  "intencion": "buscar" | "detalle_inmueble" | "hablar_con_asesor" | "saludo_o_otro",
  "operacion": "venta" | "arriendo" | null,
  "criterios_duros": {
    "tipo": "casa" | "apartamento" | null,
    "ciudad": string | null,
    "barrios": string[] | null,
    "precio_min": number | null,
    "precio_max": number | null,
    "habitaciones_min": number | null,
    "banos_min": number | null,
    "parqueaderos_min": number | null,
    "area_min": number | null,
    "estrato": number | null
  },
  "criterios_blandos": string | null,
  "codigo_inmueble_mencionado": string | null,
  "solicita_asesor": boolean,
  "tipo_no_soportado": string | null
}
`;

/**
 * Extractor heurístico / regex para modo offline, testing y fallback determinista
 */
export function extractHeuristicUnderstanding(userMessage: string): ExtractedUnderstanding {
  const lower = userMessage.toLowerCase();
  
  // Detección de código de inmueble (ej. IBG-0001)
  const codeMatch = userMessage.match(/\b(IBG-\d{4})\b/i);
  const codigo = codeMatch ? codeMatch[1].toUpperCase() : null;

  // Detección de intención
  let intencion: ExtractedUnderstanding['intencion'] = 'saludo_o_otro';
  const solicitaAsesor = /asesor|humano|persona|agendar|visita|negociar|descuento|escritura|notar[ií]a|abogado/i.test(lower);

  // Normalización de dinero temprana
  const money = normalizeColombianMoney(userMessage, null);

  if (solicitaAsesor) {
    intencion = 'hablar_con_asesor';
  } else if (codigo || (/qu[eé] precio tiene|cu[aá]nto vale|d[oó]nde queda|qu[eé] amenidades|m[aá]s informaci[oó]n de (?:la|el)/i.test(lower) && !/busco|quiero/i.test(lower))) {
    intencion = 'detalle_inmueble';
  } else if (/busco|arrendar|arriendo|alquilar|comprar|venta|casa|apartamento|apto|local|lote|oficina|inmueble|habitacion|barrio|presupuesto|mill[oó]n|millones|palos?|\bmil\b|\b\d+k\b/i.test(lower) || money.max != null || money.min != null) {
    intencion = 'buscar';
  } else if (/hola|buenos d[ií]as|buenas tardes|buenas noches|quiubo|buenas|c[oó]mo est[aá]s|que tal|reiniciar|inicio/i.test(lower)) {
    intencion = 'saludo_o_otro';
  }

  // Operación (prioridad absoluta a palabras clave explícitas)
  let operacion: Operacion | null = null;
  const isArriendo = /\b(arriendos?|arrendar|alquiler(?:es)?|alquilar|arrendo)\b/i.test(lower);
  const isVenta = /\b(comprar?|compras?|compro|comprarme|adquirir|adquisici[oó]n|ventas?|vender)\b/i.test(lower);

  if (isVenta && !isArriendo) {
    operacion = 'venta';
  } else if (isArriendo && !isVenta) {
    operacion = 'arriendo';
  } else if (!isArriendo && !isVenta && (money.max != null || money.min != null)) {
    // Inferencia contextual solo si no se mencionó explícitamente compra o arriendo
    const refMonto = money.max || money.min || 0;
    if (refMonto <= 20_000_000) {
      operacion = 'arriendo';
    } else if (refMonto >= 40_000_000) {
      operacion = 'venta';
    }
  }

  // Tipo de inmueble (estrictamente residencial: casa o apartamento)
  let tipo: TipoInmueble | null = null;
  let tipo_no_soportado: string | null = null;
  if (/apartamento|apto|apartaestudio/i.test(lower)) {
    tipo = 'apartamento';
  } else if (/casa/i.test(lower)) {
    tipo = 'casa';
  } else if (/\blocal(?:es)?\b/i.test(lower)) {
    tipo_no_soportado = 'local comercial';
  } else if (/\blote(?:s)?\b|\bterreno(?:s)?\b/i.test(lower)) {
    tipo_no_soportado = 'lote o terreno';
  } else if (/\boficina(?:s)?\b|\bconsultorio(?:s)?\b/i.test(lower)) {
    tipo_no_soportado = 'oficina';
  } else if (/\bbodega(?:s)?\b/i.test(lower)) {
    tipo_no_soportado = 'bodega';
  } else if (/\bfinca(?:s)?\b/i.test(lower)) {
    tipo_no_soportado = 'finca';
  }

  // Barrios y sectores conocidos en Ibagué
  const knownBarrios = [
    'El Vergel', 'Cádiz', 'La Macarena', 'Piedra Pintada', 'Jordán',
    'Calambeo', 'Interlaken', 'Prados del Norte', 'El Salado', 'Santa Helena',
    'La Pola', 'Campestre', 'Santa Ana', 'Picaleña', 'Centro', 'Arkacentro',
    'El Totumo', 'Mirolindo', 'Ambalá', 'Belén', 'Topacio', 'Varsovia',
    'Valparaíso', 'La Floresta', 'Santa Bárbara', 'Ibagué 2000'
  ];

  const stripAccents = (str: string) =>
    str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  const detectedBarrios: string[] = [];
  const cleanUserMessage = stripAccents(userMessage);

  for (const b of knownBarrios) {
    const cleanB = stripAccents(b);
    const regex = new RegExp(`(^|\\W)${cleanB.replace(/\s+/g, '\\s+')}($|\\W)`, 'i');
    if (regex.test(cleanUserMessage)) {
      detectedBarrios.push(b);
    }
  }

  // Detección complementaria de sectores mencionados explícitamente ("en el sector de X", "en el barrio X", "por el sector de X")
  const sectorPattern = /\b(?:en\s+el\s+sector(?:\s+de)?|en\s+el\s+barrio(?:\s+de)?|sector(?:\s+de)?|barrio(?:\s+de)?|por\s+el\s+sector(?:\s+de)?)\s+([a-záéíóúñ0-9\s]{3,30})/i;
  const matchSector = userMessage.match(sectorPattern);
  if (matchSector) {
    const candidate = matchSector[1].trim();
    if (!/^(arriendo|venta|comprar|alquiler|casa|apartamento|inmueble)/i.test(candidate)) {
      const words = candidate.split(/\s+/).filter(Boolean);
      const formatted = words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
      if (!detectedBarrios.some(b => stripAccents(b) === stripAccents(formatted))) {
        detectedBarrios.push(formatted);
      }
    }
  }

  // Normalización de dinero refinada con la operación inferida
  const finalMoney = normalizeColombianMoney(userMessage, operacion);

  // Habitaciones
  let habitaciones_min: number | null = null;
  const habMatch = lower.match(/(\d+)\s*(?:habitaci(?:on|ones|ón)|alcobas?|piezas?|cuartos?)/i);
  if (habMatch) {
    habitaciones_min = parseInt(habMatch[1], 10);
  }

  // Baños
  let banos_min: number | null = null;
  const banosMatch = lower.match(/(\d+)\s*(?:ba[ñn]os?)/i);
  if (banosMatch) {
    banos_min = parseInt(banosMatch[1], 10);
  }

  // Estrato
  let estrato: number | null = null;
  const estratoMatch = lower.match(/estrato\s*(\d)/i);
  if (estratoMatch) {
    estrato = parseInt(estratoMatch[1], 10);
  }

  // Criterios blandos
  const softKeywords = [
    'cómodo', 'comodo', 'tranquilo', 'seguro', 'fresco', 'amplio',
    'iluminado', 'cerca del centro', 'cerca a la 5ta', 'familiar',
    'buena vista', 'piscina', 'balcón', 'balcon', 'bonito', 'económico', 'economico'
  ];
  const foundSoft: string[] = [];
  for (const kw of softKeywords) {
    if (lower.includes(kw)) {
      foundSoft.push(kw);
    }
  }

  // Detección de orden por precio (superlativos: más caros vs más baratos)
  let orden_precio: 'asc' | 'desc' | null = null;
  if (/m[aá]s car[oa]s?|m[aá]s costos[oa]s?|mayor precio|mayor valor|exclusiv[oa]s?|lujos[oa]s?|los m[aá]s altos?/i.test(lower)) {
    orden_precio = 'desc';
    intencion = 'buscar';
  } else if (/m[aá]s barat[oa]s?|m[aá]s econ[oó]mic[oa]s?|menor precio|menor valor|los m[aá]s baj[oa]s?|m[aá]s accesibles?|barat[oa]s?|econ[oó]mic[oa]s?/i.test(lower)) {
    orden_precio = 'asc';
    intencion = 'buscar';
  }

  return {
    intencion,
    operacion,
    criterios_duros: {
      tipo,
      ciudad: 'Ibagué',
      barrios: detectedBarrios.length > 0 ? detectedBarrios : null,
      precio_min: finalMoney.min || null,
      precio_max: finalMoney.max || null,
      habitaciones_min,
      banos_min,
      parqueaderos_min: null,
      area_min: null,
      estrato,
      orden_precio,
    },
    criterios_blandos: foundSoft.length > 0 ? foundSoft.join(', ') : null,
    codigo_inmueble_mencionado: codigo,
    solicita_asesor: solicitaAsesor,
    tipo_no_soportado,
  };
}

/**
 * Comprende el mensaje del usuario llamando al LLM y aplicando el normalizador de dinero
 */
export async function understandUserMessage(
  userMessage: string,
  historyContext: string = ''
): Promise<ExtractedUnderstanding> {
  const heuristic = extractHeuristicUnderstanding(userMessage);

  try {
    const llmResult = await generateStructuredJSON<ExtractedUnderstanding>({
      messages: [
        { role: 'system', content: SYSTEM_NLU_PROMPT },
        {
          role: 'user',
          content: `Historial de contexto reciente:\n${historyContext || 'Ninguno'}\n\nÚltimo mensaje del usuario:\n"${userMessage}"`
        }
      ],
      fallbackFactory: () => heuristic,
    });

    // Enriquecer con el normalizador colombiano determinista de dinero si el LLM omitió montos
    const moneyParsed = normalizeColombianMoney(userMessage, llmResult.operacion || heuristic.operacion);
    if (!llmResult.criterios_duros.precio_max && moneyParsed.max) {
      llmResult.criterios_duros.precio_max = moneyParsed.max;
    }
    if (!llmResult.criterios_duros.precio_min && moneyParsed.min) {
      llmResult.criterios_duros.precio_min = moneyParsed.min;
    }

    return llmResult;
  } catch (err) {
    return heuristic;
  }
}
