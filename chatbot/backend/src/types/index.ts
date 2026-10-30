export type Operacion = 'venta' | 'arriendo';
export type TipoInmueble = 'casa' | 'apartamento';

export interface Property {
  id: string;
  codigo: string;
  operacion: Operacion;
  tipo: TipoInmueble;
  titulo: string;
  descripcion: string;
  ciudad: string;
  barrio: string;
  direccion_aproximada?: string;
  lat?: number;
  lng?: number;
  precio: number;
  area_m2: number;
  habitaciones: number;
  banos: number;
  parqueaderos: number;
  estrato: number;
  amenidades: string[];
  disponible: boolean;
  url_ficha?: string;
  embedding?: number[];
  similarity?: number;
}

export interface Conversation {
  id: string;
  created_at: Date;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: Date;
  metadata?: Record<string, any>;
}

export interface CriteriosDuros {
  tipo?: TipoInmueble | null;
  ciudad?: string | null;
  barrios?: string[] | null;
  precio_min?: number | null;
  precio_max?: number | null;
  habitaciones_min?: number | null;
  banos_min?: number | null;
  area_min?: number | null;
  parqueaderos_min?: number | null;
  estrato?: number | null;
  orden_precio?: 'asc' | 'desc' | null;
}

export interface ConversationCriterios extends CriteriosDuros {
  operacion?: Operacion | null;
  criterios_blandos?: string | null;
  turnos_aclaracion?: number;
  turnos_presupuesto?: number;
}

export interface ConversationState {
  conversation_id: string;
  criterios: ConversationCriterios;
  ultimo_listado_ids: string[];
  updated_at: Date;
}

export interface ExtractedUnderstanding {
  intencion: 'buscar' | 'detalle_inmueble' | 'hablar_con_asesor' | 'saludo_o_otro';
  operacion: Operacion | null;
  criterios_duros: CriteriosDuros;
  criterios_blandos: string | null;
  codigo_inmueble_mencionado?: string | null;
  solicita_asesor?: boolean;
  tipo_no_soportado?: string | null;
}
