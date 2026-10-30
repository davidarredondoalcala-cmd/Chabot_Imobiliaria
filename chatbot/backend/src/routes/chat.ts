import { Router, Request, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { processUserMessage } from '../agent/orchestrator.js';
import { query } from '../db/index.js';

export const chatRouter = Router();

const chatRequestSchema = z.object({
  conversationId: z.string().optional(),
  message: z.string().min(1, 'El mensaje no puede estar vacío').max(1000, 'El mensaje es demasiado largo'),
});

/**
 * POST /api/chat
 * Procesa un turno de conversación con el agente
 */
chatRouter.post('/chat', async (req: Request, res: Response): Promise<void> => {
  const parseResult = chatRequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      error: 'Entrada inválida',
      details: parseResult.error.format()
    });
    return;
  }

  const { message } = parseResult.data;
  const conversationId = parseResult.data.conversationId || `conv-${crypto.randomUUID()}`;

  try {
    const result = await processUserMessage(conversationId, message);
    res.json(result);
  } catch (error: any) {
    console.error(`[API /chat] Error procesando mensaje en conversación ${conversationId}:`, error);
    res.status(500).json({
      conversationId,
      reply: 'Qué pena contigo, ocurrió un inconveniente momentáneo al consultar el catálogo. Por favor inténtalo de nuevo en un instante o escríbenos directamente a WhatsApp.',
      properties: [],
      needsHuman: true,
      error: error?.message || 'Internal error'
    });
  }
});

/**
 * GET /api/conversations/:id
 * Recupera el historial cronológico de mensajes de una conversación
 */
chatRouter.get('/conversations/:id', async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  try {
    const result = await query(
      `SELECT id, role, content, created_at, metadata
       FROM messages
       WHERE conversation_id = $1
       ORDER BY created_at ASC`,
      [id]
    );

    res.json({
      conversationId: id,
      messages: result.rows,
    });
  } catch (error) {
    // Si la BD no está conectada, devolver array vacío
    res.json({
      conversationId: id,
      messages: [],
    });
  }
});
