import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface StructuredLLMOptions<T> {
  messages: LLMMessage[];
  temperature?: number;
  responseSchema?: Record<string, any>;
  fallbackFactory?: () => T;
}

const LLM_PROVIDER = process.env.LLM_PROVIDER || 'openai';
const LLM_MODEL = process.env.LLM_MODEL || 'gpt-4o-mini';
const LLM_API_KEY = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || '';

let client: OpenAI | null = null;
if (LLM_API_KEY && (LLM_PROVIDER === 'openai' || LLM_PROVIDER === 'openrouter')) {
  client = new OpenAI({
    apiKey: LLM_API_KEY,
    baseURL: process.env.LLM_BASE_URL || undefined,
  });
}

/**
 * Capa de abstracción para llamadas a LLM que garantiza salida JSON estructurada.
 */
export async function generateStructuredJSON<T>(options: StructuredLLMOptions<T>): Promise<T> {
  const { messages, temperature = 0.1, fallbackFactory } = options;

  if (LLM_PROVIDER === 'mock' || !client || !LLM_API_KEY || LLM_API_KEY.startsWith('mock')) {
    if (fallbackFactory) {
      return fallbackFactory();
    }
    throw new Error('LLM en modo mock sin fallback implementado');
  }

  try {
    const response = await client.chat.completions.create({
      model: LLM_MODEL,
      messages: messages as any,
      temperature,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content || '{}';
    return JSON.parse(content) as T;
  } catch (error: any) {
    console.warn(`[LLM Abstraction] Error en proveedor ${LLM_PROVIDER}: ${error?.message || error}. Usando fallback.`);
    if (fallbackFactory) {
      return fallbackFactory();
    }
    throw error;
  }
}

/**
 * Capa de abstracción para generación de texto libre con el LLM.
 */
export async function generateText(messages: LLMMessage[], temperature: number = 0.3): Promise<string> {
  if (LLM_PROVIDER === 'mock' || !client || !LLM_API_KEY || LLM_API_KEY.startsWith('mock')) {
    return '';
  }

  try {
    const response = await client.chat.completions.create({
      model: LLM_MODEL,
      messages: messages as any,
      temperature,
    });

    return response.choices[0]?.message?.content || '';
  } catch (error: any) {
    console.warn(`[LLM Abstraction] Error en generación de texto: ${error?.message || error}.`);
    throw error;
  }
}
