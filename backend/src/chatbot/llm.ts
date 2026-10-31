import OpenAI from 'openai';

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

/**
 * Obtiene la configuración activa del LLM a partir de variables de entorno.
 * Soporta de manera nativa OpenAI, Google Gemini, Groq, OpenRouter o cualquier endpoint OpenAI-compatible.
 */
function getLLMConfig() {
  const apiKey =
    process.env.LLM_API_KEY ||
    process.env.OPENAI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.GROQ_API_KEY ||
    '';

  const provider =
    process.env.LLM_PROVIDER ||
    (process.env.GEMINI_API_KEY
      ? 'gemini'
      : process.env.GROQ_API_KEY
        ? 'groq'
        : 'openai');

  let baseURL = process.env.LLM_BASE_URL;
  let defaultModel = 'gpt-4o-mini';

  if (!baseURL) {
    if (provider === 'gemini' || process.env.GEMINI_API_KEY) {
      baseURL = 'https://generativelanguage.googleapis.com/v1beta/openai/';
      defaultModel = 'gemini-1.5-flash';
    } else if (provider === 'groq' || process.env.GROQ_API_KEY) {
      baseURL = 'https://api.groq.com/openai/v1';
      defaultModel = 'llama-3.3-70b-versatile';
    } else if (provider === 'openrouter') {
      baseURL = 'https://openrouter.ai/api/v1';
      defaultModel = 'openai/gpt-4o-mini';
    }
  }

  const model = process.env.LLM_MODEL || defaultModel;

  return { apiKey, baseURL, model, provider };
}

let cachedClient: OpenAI | null = null;
let lastApiKey = '';
let lastBaseURL: string | undefined = undefined;

function getClient(): { client: OpenAI | null; model: string } {
  const { apiKey, baseURL, model } = getLLMConfig();

  if (!apiKey || apiKey.startsWith('mock')) {
    return { client: null, model };
  }

  if (!cachedClient || lastApiKey !== apiKey || lastBaseURL !== baseURL) {
    try {
      cachedClient = new OpenAI({
        apiKey,
        baseURL: baseURL || undefined,
      });
      lastApiKey = apiKey;
      lastBaseURL = baseURL;
    } catch {
      cachedClient = null;
    }
  }

  return { client: cachedClient, model };
}

/**
 * Capa de abstracción para llamadas a LLM que garantiza salida JSON estructurada.
 */
export async function generateStructuredJSON<T>(options: StructuredLLMOptions<T>): Promise<T> {
  const { messages, temperature = 0.1, fallbackFactory } = options;
  const { client, model } = getClient();

  if (!client) {
    if (fallbackFactory) {
      return fallbackFactory();
    }
    throw new Error('LLM en modo mock sin fallback implementado');
  }

  try {
    const response = await client.chat.completions.create({
      model,
      messages: messages as any,
      temperature,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content || '{}';
    return JSON.parse(content) as T;
  } catch (error: any) {
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
  const { client, model } = getClient();

  if (!client) {
    return '';
  }

  try {
    const response = await client.chat.completions.create({
      model,
      messages: messages as any,
      temperature,
    });

    return response.choices[0]?.message?.content || '';
  } catch (error: any) {
    return '';
  }
}
