import { ExtractedUnderstanding, Operacion, TipoInmueble } from './types';
import { generateStructuredJSON } from './llm';
import { normalizeColombianMoney } from './normalizer';

const SYSTEM_NLU_PROMPT = `
Eres un módulo de NLU especializado en el mercado inmobiliario colombiano (específicamente Ibagué, Tolima).
Tu tarea es analizar el mensaje del usuario y el historial reciente para extraer datos estructurados con precisión quirúrgica.

Reglas obligatorias:
1. "intencion":
   - "buscar": si busca propiedades, pide opciones, pregunta qué hay disponible, o da criterios de búsqueda.
   - "detalle_inmueble": si pregunta detalles específicos (precio, área, amenidades, fotos) de un código de inmueble específico o del listado previo.
   - "hablar_con_asesor": si pide expresamente hablar con una persona/humano, asesor, negociar precio, trámites legales/notaría, agendar visita.
   - "saludo_o_otro": saludos ("hola", "buenas"), agradecimientos ("gracias"), despedidas o comentarios generales.
   - "fuera_de_tema": preguntas claramente ajenas al negocio inmobiliario (cálculos matemáticos tipo "cuánto es 2x2", clima, noticias, chistes, recetas, deportes, historia, cultura general, consejos no inmobiliarios). REGLA GENERAL: si el mensaje no menciona NADA relacionado con casas, apartamentos, alquilar, arrendar, comprar, vender, inmuebles, barrios, sectores, precios de propiedades, presupuesto para vivienda o citas/acuerdos de la inmobiliaria, entonces ES "fuera_de_tema". No te dejes engañar por palabras sueltas: "tengo una mandarina como regalo" es fuera de tema, pero "tengo una mandarina como presupuesto" NO es fuera de tema (habla de presupuesto => marcamos "presupuesto_invalido").
2. "fuera_de_tema": boolean. true si el mensaje pertenece a "fuera_de_tema".
3. "operacion": 'venta' | 'arriendo' | null.
   - Si el usuario dice "compra", "comprar", "compro", "comprarme", "adquirir", "venta", "en venta": pon ESTRICTAMENTE 'venta', SIN IMPORTAR el monto del presupuesto (incluso si dice 10 millones o 5 millones).
   - Si el usuario dice "arriendo", "arrendar", "alquiler", "alquilar", "arrendo": pon ESTRICTAMENTE 'arriendo'.
   - Si NO especifica compra ni arriendo: montos hasta 20M COP sugieren arriendo mensual; montos desde 40M COP sugieren venta.
4. "criterios_duros":
   - tipo: 'casa' | 'apartamento' | null (IMPORTANTE: Nuestro catálogo se especializa única y exclusivamente en casas y apartamentos residenciales).
   - ciudad: la ciudad REAL que el usuario menciona para la búsqueda, tal como la escribió con acentos correctos (ej. "Bogotá", "Medellín", "El Espinal"). Si menciona Ibagué explícitamente, usa "Ibagué". Si NINGUNA ciudad aparece en el mensaje, responde null (NUNCA asumas Ibagué aquí; ese default se decide después).
   - barrios: array con nombres de barrios mencionados (ej. ["El Vergel", "Cádiz"]) o null
   - precio_min, precio_max: en pesos colombianos (COP numérico entero)
   - habitaciones_min,
      habitaciones_max,
      banos_max, banos_min, parqueaderos_min, area_min, estrato: números enteros o null
   - NUNCA inventes criterios duros que el usuario no dijo explícitamente.
5. "criterios_blandos": texto libre con descriptores subjetivos o vagos (ej. "tranquilo", "cerca de transporte", "iluminado", "familiar"). Lo vago va aquí.
6. "codigo_inmueble_mencionado": si menciona un código como "IBG-0001" o "HC-0001", extráelo aquí.
7. "tipo_no_soportado": si el usuario pide local, lote, oficina, bodega, finca, etc.
8. "presupuesto_invalido": boolean. true SOLO cuando el usuario habla de un presupuesto/valor de vivienda pero con algo que NO es una cifra válida en pesos colombianos: objetos o animales como unidad ("presupuesto de una mandarina", "tengo tres delfines"), o unidades no monetarias ("presupuesto de 50 kilos", "presupuesto de dos horas"). NO lo marques si hay una cifra monetaria interpretable ("presupuesto de 2.5 millones") o si simplemente pide precio de un inmueble.

Devuelve estrictamente un objeto JSON con el siguiente esquema:
{
  "intencion": "buscar" | "detalle_inmueble" | "hablar_con_asesor" | "saludo_o_otro" | "fuera_de_tema",
  "fuera_de_tema": boolean,
  "operacion": "venta" | "arriendo" | null,
  "criterios_duros": {
    "tipo": "casa" | "apartamento" | null,
    "ciudad": string | null,
    "barrios": string[] | null,
    "precio_min": number | null,
    "precio_max": number | null,
    "habitaciones_min": number | null,
    "habitaciones_max": number | null,
    "banos_min": number | null,
    "parqueaderos_min": number | null,
    "area_min": number | null,
    "estrato": number | null
  },
  "criterios_blandos": string | null,
  "codigo_inmueble_mencionado": string | null,
  "solicita_asesor": boolean,
  "tipo_no_soportado": string | null,
  "presupuesto_invalido": boolean
}
`;

/**
 * Normaliza quitando acentos y pasando a minúsculas.
 */
const stripAccents = (str: string) =>
  str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/** Escapa caracteres especiales para construir una regex literal. */
const escaparRegex = (texto: string) => texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Ciudades y municipios con cobertura de búsqueda (solo Ibagué por ahora).
 * Clave: forma sin acentos con la que se detecta; valor: nombre bonito para mostrar.
 */
const CIUDADES_CONOCIDAS: Record<string, string> = {
  'bogota': 'Bogotá', 'medellin': 'Medellín', 'cali': 'Cali', 'barranquilla': 'Barranquilla',
  'cartagena': 'Cartagena', 'bucaramanga': 'Bucaramanga', 'pereira': 'Pereira',
  'manizales': 'Manizales', 'armenia': 'Armenia', 'neiva': 'Neiva', 'villavicencio': 'Villavicencio',
  'popayan': 'Popayán', 'pasto': 'Pasto', 'santa marta': 'Santa Marta', 'cucuta': 'Cúcuta',
  'tunja': 'Tunja', 'sincelejo': 'Sincelejo', 'florencia': 'Florencia', 'monteria': 'Montería',
  'palmira': 'Palmira', 'duitama': 'Duitama', 'sogamoso': 'Sogamoso', 'yopal': 'Yopal',
  'valledupar': 'Valledupar', 'riohacha': 'Riohacha', 'cartago': 'Cartago',
  'espinal': 'El Espinal', 'el espinal': 'El Espinal', 'melgar': 'Melgar', 'girardot': 'Girardot',
  'honda': 'Honda', 'chaparral': 'Chaparral', 'libano': 'Líbano', 'el libano': 'Líbano',
  'mariquita': 'Mariquita', 'fresno': 'Fresno', 'prado': 'Prado', 'ortega': 'Ortega',
  'rovira': 'Rovira', 'saldaña': 'Saldaña', 'saldana': 'Saldaña', 'coello': 'Coello',
  'carmen de apicala': 'Carmen de Apicalá', 'ibague': 'Ibagué', 'ibagüe': 'Ibagué',
};

/**
 * Detecta la ciudad REAL citada en el mensaje (patrón típico: "en <ciudad>", "de <ciudad>").
 * Si el mensaje menciona varias ciudades y una de ellas es Ibagué, prevalece Ibagué
 * (ej. "soy de Bogotá, busco casa en Ibagué" => no se debe rechazar la búsqueda).
 */
export function detectarCiudad(userMessage: string): string | null {
  const clean = stripAccents(userMessage);
  const ordenadas = [...Object.keys(CIUDADES_CONOCIDAS)].sort((a, b) => b.length - a.length);
  const encontradas: string[] = [];
  for (const ciudadKey of ordenadas) {
    const regex = new RegExp(
      `\\b(?:en|de|por|hacia)\\s+(?:el\\s+|la\\s+|ciudad\\s+de\\s+|municipio\\s+de\\s+)?${escaparRegex(ciudadKey).replace(/\s+/g, '\\s+')}\\b`,
      'i'
    );
    if (regex.test(clean)) {
      const nombre = CIUDADES_CONOCIDAS[ciudadKey];
      if (!encontradas.includes(nombre)) encontradas.push(nombre);
    }
  }
  if (encontradas.length === 0) return null;
  if (encontradas.includes('Ibagué')) return 'Ibagué';
  return encontradas[0];
}

/**
 * Detecta preguntas claramente ajenas al negocio inmobiliario (matemáticas, clima,
 * noticias, chistes, etc.). Solo se aplica cuando NO hay señales inmobiliarias.
 */
export const PATRONES_FUERA_DE_TEMA = [
  /\bcu[aá]nto(?:\s+es|\s+son)?\s*[\d(]\s*\d*\s*[x×+\-*/^=]/,
  /\b\d+\s*[x×]\s*\d+\b/,
  /\b\d+\s*[\-*/^]\s*\d+\b/,
  /\bra[íi]z\s+cuadrada/,
  /\bclima\b|\bpron[óo]stico del tiempo\b|\bva a llover\b|\blluvia\b|\btemperatura\b/,
  /\bnoticias?\b|\bnoticiero\b|\bperi[óo]dico\b/,
  /\bchistes?\b|\bm[eé]jame una risa\b|\bcu[eé]ntame un chiste\b|\badivinanza\b|\bpoema\b|\bpoes[ií]a\b/,
  /\brecetas?\b|\breceta de\b|\bc[oó]mo (?:se hace|hacer|preparar|cocinar)\b|\bingredientes\b|\bpizza\b|\bhamburguesa\b|\bpostre\b/,
  /\bf[úu]tbol\b|\bsoccer\b|\bshakira\b|\bmessi\b|\bronaldo\b|\bcristiano\b|\bkarol g\b|\bbaloncesto\b|\btenis\b|\bmundial\b|\bchampions\b/,
  /\btr[aá]duceme\b|\btrad[uú]ceme\b|\btraduce esto\b|\btranslate\b/,
  /\bhablame de\b|\bqui[eé]n es\s+(?!jarvis\b)|\bqui[eé]n fue\b|\bcu[aá]l es la capital\b/,
  /\bfilosof[ií]a\b|\bhistoria\b|\bbiolog[ií]a\b|\bqu[ií]mica\b|\bf[ií]sica\b|\bmatem[aá]ticas?\b/,
  /\bpython\b|\bjavascript\b|\btypescript\b|\bc[oó]digo\b|\bprogramar\b|\bprogramaci[oó]n\b|\balgoritmo\b/,
  /\bhazme una tarea\b|\bescribe un ensayo\b|\bresumen de\b/,
  /\bpol[ií]tica\b|\belecciones\b|\bpresidente\b|\balcalde\b/,
  /\bhor[oó]scopo\b|\bsigno zodiacal\b|\bastrolog[ií]a\b/,
  /\bmedicina\b|\bs[ií]ntomas?\b|\benfermedad\b|\bpastilla\b|\bremedio\b/,
];

export function detectarFueraDeTema(userMessage: string): boolean {
  const texto = userMessage.toLowerCase();
  return PATRONES_FUERA_DE_TEMA.some((patron) => patron.test(texto));
}

export function tieneContextoInmobiliario(
  userMessage: string,
  signals?: {
    codigo?: string | null;
    tipo?: TipoInmueble | null;
    tipo_no_soportado?: string | null;
    operacion?: Operacion | null;
    solicitaAsesor?: boolean;
    barrios?: string[] | null;
    moneyMin?: number | null;
    moneyMax?: number | null;
    presupuestoInvalido?: boolean;
  }
): boolean {
  if (signals) {
    if (signals.codigo) return true;
    if (signals.tipo) return true;
    if (signals.tipo_no_soportado) return true;
    if (signals.operacion) return true;
    if (signals.solicitaAsesor) return true;
    if (signals.barrios && signals.barrios.length > 0) return true;
    if (signals.moneyMin != null || signals.moneyMax != null) return true;
    if (signals.presupuestoInvalido) return true;
  }

  const clean = stripAccents(userMessage);

  const patronInmobiliario = /\b(casas?|apartamentos?|aptos?|apartaestudios?|inmuebles?|propiedad(?:es)?|viviendas?|habitaci(?:on|ones)|alcobas?|cuartos?|piezas?|ba[nñ]os?|estrato|garajes?|parqueaderos?|balcon(?:es)?|terrazas?|patios?|piscinas?|m2|metros?|arriendos?|arrendar|arrendo|alquiler(?:es)?|alquilar|comprar?|compras?|compro|comprarme|ventas?|vender|vendo|adquirir|adquisici(?:on|ones)|canon|inmobiliaria|inmobiliario|habitat\s+capital|catalogo|disponibles?|ofertas?|presupuesto|mill(?:on|ones)|palos?|asesor(?:a)?|asesor[ií]a|agente|visitas?|agendar|citas?|negociar|descuento|escrituras?|notar[ií]a|contratos?|lotes?|terrenos?|locales?|oficinas?|bodegas?|fincas?|consultorios?|ibague|tolima|el vergel|cadiz|la pola|calambeo|piedra pintada|jordan|belen|interlaken|picale[nñ]a|la macarena|santa helena|el salado|prados del norte|arkacentro|mirolindo|varsovia|campestre|valparaiso|otras?\s+zonas?|otras?\s+opciones?)\b/i;

  return patronInmobiliario.test(clean);
}

export function esSaludoOCortesia(userMessage: string): boolean {
  const clean = stripAccents(userMessage.trim());
  return /^\s*(hola|buen[oa]s?|buenos dias|buenas tardes|buenas noches|quiubo|qu[eé] tal|c[oó]mo estas|c[oó]mo te va|c[oó]mo andas|qui[eé]n eres|gracias|muchas gracias|mil gracias|ok|vale|perfecto|listo|reiniciar|inicio|empezar|comenzar|ayuda|qu[eé] puedes hacer)[\s\.,!¡?¿]*$/i.test(clean);
}

/**
 * Extractor heurístico / regex para modo offline, testing y fallback determinista
 */
export function extractHeuristicUnderstanding(userMessage: string): ExtractedUnderstanding {
  const lower = userMessage.toLowerCase();
  
  // Detección de código de inmueble (ej. IBG-0001 o HC-0001)
  const codeMatch = userMessage.match(/\b((?:IBG|HC)-\d{4})\b/i);
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
  } else if (/busco|arrendar|arriendo|alquilar|comprar|venta|casa|apartamento|apto|local|lote|oficina|inmueble|habitacion|barrio|presupuesto|mill[oó]n|millones|palos?|\bmil\b|\b\d+k\b|mu[eé]strame|ver\b|opciones\b|ens[eé][nñ]ame|otras?\s+zonas?/i.test(lower) || money.max != null || money.min != null) {
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
    const refMonto = money.max || money.min || 0;
    if (refMonto <= 20_000_000) {
      operacion = 'arriendo';
    } else if (refMonto >= 40_000_000) {
      operacion = 'venta';
    }
  }

  // Tipo de inmueble
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
  } else if (/\boficina(?:s)?\b|\bconsultorio(?:s)?\b/i.test(lower) && !/(?:su|la)\s+oficina|d[oó]nde\s+(?:queda|est[aá]).*oficina|oficina\s+de\s+(?:la\s+inmobiliaria|habitat)/i.test(lower)) {
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

  const detectedBarrios: string[] = [];
  const cleanUserMessage = stripAccents(userMessage);

  for (const b of knownBarrios) {
    const cleanB = stripAccents(b);
    const regex = new RegExp(`(^|\\W)${cleanB.replace(/\s+/g, '\\s+')}($|\\W)`, 'i');
    if (regex.test(cleanUserMessage)) {
      detectedBarrios.push(b);
    }
  }

  // Detección complementaria de sectores
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

  const finalMoney = normalizeColombianMoney(userMessage, operacion);

  // Habitaciones
  let habitaciones_min: number | null = null;
  let habitaciones_max: number | null = null;

  const habMaxMatch = lower.match(/(?:m[aá]ximo|hasta|a\s+lo\s+sumo)\s*(\d+)\s*(?:habitaci(?:on|ones|ón)|alcobas?|piezas?|cuartos?)|(\d+)\s*(?:habitaci(?:on|ones|ón)|alcobas?|piezas?|cuartos?)\s*(?:m[aá]ximo|como\s+m[aá]ximo|o\s+menos)/i);
  const habMinMatch = lower.match(/(?:m[ií]nimo|al\s+menos|desde)\s*(\d+)\s*(?:habitaci(?:on|ones|ón)|alcobas?|piezas?|cuartos?)|(\d+)\s*(?:habitaci(?:on|ones|ón)|alcobas?|piezas?|cuartos?)\s*(?:m[ií]nimo|o\s+m[aá]s)/i);
  const habRangeMatch = lower.match(/entre\s*(\d+)\s*(?:y|a)\s*(\d+)\s*(?:habitaci(?:on|ones|ón)|alcobas?|piezas?|cuartos?)/i);
  const habSimpleMatch = lower.match(/(\d+)\s*(?:habitaci(?:on|ones|ón)|alcobas?|piezas?|cuartos?)/i);

  if (habRangeMatch) {
    habitaciones_min = parseInt(habRangeMatch[1], 10);
    habitaciones_max = parseInt(habRangeMatch[2], 10);
  } else if (habMaxMatch) {
    habitaciones_max = parseInt(habMaxMatch[1] || habMaxMatch[2], 10);
  } else if (habMinMatch) {
    habitaciones_min = parseInt(habMinMatch[1] || habMinMatch[2], 10);
  } else if (habSimpleMatch) {
    habitaciones_min = parseInt(habSimpleMatch[1], 10);
  }

  // Baños
  let banos_min: number | null = null;
  let banos_max: number | null = null;
  const banosMaxMatch = lower.match(/(?:m[aá]ximo|hasta)\s*(\d+)\s*(?:ba[ñn]os?)|(\d+)\s*(?:ba[ñn]os?)\s*(?:m[aá]ximo|o\s+menos)/i);
  const banosMinMatch = lower.match(/(?:m[ií]nimo|al\s+menos|desde)\s*(\d+)\s*(?:ba[ñn]os?)|(\d+)\s*(?:ba[ñn]os?)\s*(?:m[ií]nimo|o\s+m[aá]s)/i);
  const banosSimpleMatch = lower.match(/(\d+)\s*(?:ba[ñn]os?)/i);

  if (banosMaxMatch) {
    banos_max = parseInt(banosMaxMatch[1] || banosMaxMatch[2], 10);
  } else if (banosMinMatch) {
    banos_min = parseInt(banosMinMatch[1] || banosMinMatch[2], 10);
  } else if (banosSimpleMatch) {
    banos_min = parseInt(banosSimpleMatch[1], 10);
  }

  // Estrato
  let estrato: number | null = null;
  const estratoMatch = lower.match(/estrato\s*(\d)/i);
  if (estratoMatch) {
    estrato = parseInt(estratoMatch[1], 10);
  }

  // Criterios blandos y amenidades específicas
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

  // Detección de amenidades buscadas
  const knownAmenities = [
    { key: 'piscina', regex: /\b(piscina|alberca)\b/i },
    { key: 'balcón', regex: /\b(balc[oó]n)\b/i },
    { key: 'terraza', regex: /\b(terraza)\b/i },
    { key: 'patio', regex: /\b(patio)\b/i },
    { key: 'parqueadero', regex: /\b(parqueadero|garaje|cochera)\b/i },
    { key: 'gimnasio', regex: /\b(gimnasio|gym)\b/i },
    { key: 'jacuzzi', regex: /\b(jacuzzi)\b/i },
    { key: 'zona bbq', regex: /\b(bbq|zona\s+bbq|asador)\b/i },
    { key: 'ascensor', regex: /\b(ascensor|elevador)\b/i },
  ];
  const detectedAmenities: string[] = [];
  for (const am of knownAmenities) {
    if (am.regex.test(lower)) {
      detectedAmenities.push(am.key);
    }
  }

  // Orden precio
  let orden_precio: 'asc' | 'desc' | null = null;
  if (/m[aá]s car[oa]s?|m[aá]s costos[oa]s?|mayor precio|mayor valor|exclusiv[oa]s?|lujos[oa]s?|los m[aá]s altos?/i.test(lower)) {
    orden_precio = 'desc';
    intencion = 'buscar';
  } else if (/m[aá]s barat[oa]s?|m[aá]s econ[oó]mic[oa]s?|menor precio|menor valor|los m[aá]s baj[oa]s?|m[aá]s accesibles?|barat[oa]s?|econ[oó]mic[oa]s?/i.test(lower)) {
    orden_precio = 'asc';
    intencion = 'buscar';
  }

  // Presupuesto mencionado pero sin cifra válida en pesos (ej. "una mandarina como presupuesto").
  // Solo se marca si el usuario habla de presupuesto y NO se pudo parsear ningún monto real.
  const mencionaPresupuesto = /presupuesto|cu[aá]nt[oa]\s+dinero|valor\s+m[aá]ximo|cu[aá]nt[oa]\s+quiero\s+gastar|de\s+cu[aá]nt[oa]\s+queda/i.test(lower);
  const presupuestoInvalido =
    mencionaPresupuesto &&
    finalMoney.min == null &&
    finalMoney.max == null &&
    !codigo;

  // Fuera de tema: se detecta por patrones explícitos o por falta total de contexto inmobiliario
  // siempre que no sea un saludo, cortesía, agradecimiento o reinicio.
  const hayContextoInmobiliario = tieneContextoInmobiliario(userMessage, {
    codigo,
    tipo,
    tipo_no_soportado,
    operacion,
    solicitaAsesor,
    barrios: detectedBarrios,
    moneyMin: finalMoney.min,
    moneyMax: finalMoney.max,
    presupuestoInvalido,
  });

  const saludoOCortesia = esSaludoOCortesia(userMessage);
  const esFueraDeTema = detectarFueraDeTema(userMessage) || (!hayContextoInmobiliario && !saludoOCortesia);
  if (esFueraDeTema) {
    intencion = 'fuera_de_tema';
  }

  // Ciudad real mencionada; el default del catálogo es Ibagué
  const ciudadDetectada = detectarCiudad(userMessage);

  return {
    intencion,
    operacion,
    criterios_duros: {
      tipo,
      ciudad: ciudadDetectada || 'Ibagué',
      barrios: detectedBarrios.length > 0 ? detectedBarrios : null,
      precio_min: finalMoney.min || null,
      precio_max: finalMoney.max || null,
      habitaciones_min,
      habitaciones_max,
      banos_min,
      banos_max,
      parqueaderos_min: null,
      area_min: null,
      estrato,
      orden_precio,
      amenidades: detectedAmenities.length > 0 ? detectedAmenities : null,
    },
    criterios_blandos: foundSoft.length > 0 ? foundSoft.join(', ') : null,
    codigo_inmueble_mencionado: codigo,
    solicita_asesor: solicitaAsesor,
    tipo_no_soportado,
    fuera_de_tema: esFueraDeTema,
    presupuesto_invalido: presupuestoInvalido,
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

    const moneyParsed = normalizeColombianMoney(userMessage, llmResult.operacion || heuristic.operacion);
    if (!llmResult.criterios_duros.precio_max && moneyParsed.max) {
      llmResult.criterios_duros.precio_max = moneyParsed.max;
    }
    if (!llmResult.criterios_duros.precio_min && moneyParsed.min) {
      llmResult.criterios_duros.precio_min = moneyParsed.min;
    }

    // Fallbacks deterministas: si el LLM no trajo ciudad, tipo, o fuera_de_tema, usamos el heurístico
    if (!llmResult.criterios_duros.ciudad && heuristic.criterios_duros.ciudad) {
      llmResult.criterios_duros.ciudad = heuristic.criterios_duros.ciudad;
    }
    if (!llmResult.criterios_duros.tipo && heuristic.criterios_duros.tipo) {
      llmResult.criterios_duros.tipo = heuristic.criterios_duros.tipo;
    }
    if (llmResult.criterios_duros.habitaciones_max == null && heuristic.criterios_duros.habitaciones_max != null) {
      llmResult.criterios_duros.habitaciones_max = heuristic.criterios_duros.habitaciones_max;
    }
    if (llmResult.criterios_duros.banos_max == null && heuristic.criterios_duros.banos_max != null) {
      llmResult.criterios_duros.banos_max = heuristic.criterios_duros.banos_max;
    }
    if (!llmResult.criterios_duros.amenidades && heuristic.criterios_duros.amenidades) {
      llmResult.criterios_duros.amenidades = heuristic.criterios_duros.amenidades;
    }
    // Si el heurístico detecta una ciudad real distinta de Ibagué, prevalece sobre el LLM
    // (evita que el LLM asuma "Ibagué" por defecto cuando el usuario cita otra ciudad)
    const ciudadHeuristica = heuristic.criterios_duros.ciudad;
    if (ciudadHeuristica && !/ibagu[ée\u00fc]/i.test(ciudadHeuristica)) {
      llmResult.criterios_duros.ciudad = ciudadHeuristica;
    }
    if (heuristic.fuera_de_tema || llmResult.fuera_de_tema) {
      llmResult.fuera_de_tema = true;
      llmResult.intencion = 'fuera_de_tema';
    }
    // Presupuesto inválido: el heurístico (menciona "presupuesto" + dinero no parseable)
    // prevalece sobre el LLM; si el LLM trajo un monto real, el heurístico no lo marca
    if (
      heuristic.presupuesto_invalido &&
      !llmResult.criterios_duros.precio_min &&
      !llmResult.criterios_duros.precio_max
    ) {
      llmResult.presupuesto_invalido = true;
    }

    return llmResult;
  } catch (err) {
    return heuristic;
  }
}
