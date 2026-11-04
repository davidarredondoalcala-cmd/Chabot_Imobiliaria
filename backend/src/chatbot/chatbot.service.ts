import { Injectable, Optional } from '@nestjs/common';
import { InmueblesService } from '../inmuebles/inmuebles.service';
import { Property, ChatResponse } from './types';
import { processUserMessage } from './orchestrator';
import { getConversationMessages } from './state';

@Injectable()
export class ChatbotService {
  constructor(
    @Optional() private readonly inmueblesService?: InmueblesService
  ) {}

  private mapMongoToProperties(mongoList: any[]): Property[] {
    if (!Array.isArray(mongoList)) return [];

    return mongoList.map((m, idx) => {
      const isVenta = m.estado === 'Para la venta' || m.estado === 'Vendida';
      const operacion: 'venta' | 'arriendo' = isVenta ? 'venta' : 'arriendo';
      const codigo = `HC-${String(idx + 1).padStart(4, '0')}`;
      const tipo: 'casa' | 'apartamento' = (m.tipo || 'Casa').toLowerCase() === 'apartamento' ? 'apartamento' : 'casa';
      const ciudad = m.ciudad || 'Colombia';
      const barrio = m.barrio || 'Sector residencial';
      const dir = m.dir || `${barrio}, ${ciudad}`;

      return {
        id: String(m._id || codigo),
        codigo,
        operacion,
        tipo,
        titulo: m.nombre || `${m.tipo} en ${barrio}, ${ciudad}`,
        descripcion: m.descripcion || `${m.tipo} ubicada en ${barrio}, ${ciudad}. Dirección: ${dir}. Linderos: ${m.lind || 'Sector tranquilo con excelentes vías de acceso'}.`,
        ciudad,
        barrio,
        direccion_aproximada: dir,
        precio: Number(m.valor) || 0,
        area_m2: Number(m.area) || 75,
        habitaciones: Number(m.habitaciones) || 2,
        banos: Number(m.banos) || 2,
        parqueaderos: 1,
        estrato: 4,
        amenidades: ['servicios públicos', 'iluminación natural', 'excelente ubicación'],
        disponible: m.estado === 'Sin arrendar' || m.estado === 'Para la venta',
        url_ficha: `/propiedades/${codigo}`,
        foto: m.foto,
      };
    });
  }

  async processMessage(conversationId: string, message: string, history?: Array<{ role: string; content: string }>): Promise<ChatResponse> {
    let mongoProperties: Property[] = [];
    try {
      if (this.inmueblesService) {
        const raw = await this.inmueblesService.findAll();
        mongoProperties = this.mapMongoToProperties(raw);
      }
    } catch {
      mongoProperties = [];
    }

    return await processUserMessage(conversationId, message, mongoProperties, history);
  }

  async getMessages(conversationId: string) {
    return await getConversationMessages(conversationId);
  }
}
