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

export interface LLMProviderConfig {
  name: 'gemini' | 'groq' | 'openai' | 'custom';
  apiKey: string;
  baseURL: string;
  model: string;
  client: OpenAI;
}

const clientCache = new Map<string, OpenAI>();

function getOrCreateClient(apiKey: string, baseURL: string): OpenAI {
  const cacheKey = `${apiKey}@@${baseURL}`;
  let client = clientCache.get(cacheKey);
  if (!client) {
    client = new OpenAI({
      apiKey,
      baseURL,
    });
    clientCache.set(cacheKey, client);
  }
  return client;
}

/**
 * Obtiene la lista ordenada de proveedores de LLM configurados.
 * Prioriza Google Gemini como motor principal de alto rendimiento y Groq como respaldo activo.
 */
export function getConfiguredProviders(): LLMProviderConfig[] {
  const providers: LLMProviderConfig[] = [];
  const explicitProvider = process.env.LLM_PROVIDER?.toLowerCase();

  // 1. Google Gemini (Motor Principal de Alto Rendimiento)
  const geminiKey = process.env.GEMINI_API_KEY || (explicitProvider === 'gemini' ? process.env.LLM_API_KEY : '');
  if (geminiKey && !geminiKey.startsWith('mock')) {
    const baseURL = process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/openai/';
    const model = process.env.GEMINI_MODEL || process.env.LLM_MODEL || 'gemini-3.5-flash';
    providers.push({
      name: 'gemini',
      apiKey: geminiKey,
      baseURL,
      model,
      client: getOrCreateClient(geminiKey, baseURL),
    });
  }

  // 2. Groq (Motor Secundario / Respaldo Ultrarrápido)
  const groqKey = process.env.GROQ_API_KEY || (explicitProvider === 'groq' ? process.env.LLM_API_KEY : '');
  if (groqKey && !groqKey.startsWith('mock')) {
    const baseURL = process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1';
    const model = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
    providers.push({
      name: 'groq',
      apiKey: groqKey,
      baseURL,
      model,
      client: getOrCreateClient(groqKey, baseURL),
    });
  }

  // 3. OpenAI / Endpoint Personalizado
  const openAIKey = process.env.OPENAI_API_KEY || (explicitProvider === 'openai' ? process.env.LLM_API_KEY : '');
  if (openAIKey && !openAIKey.startsWith('mock')) {
    const baseURL = process.env.OPENAI_BASE_URL || process.env.LLM_BASE_URL || 'https://api.openai.com/v1';
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    providers.push({
      name: 'openai',
      apiKey: openAIKey,
      baseURL,
      model,
      client: getOrCreateClient(openAIKey, baseURL),
    });
  }

  // Si se configuró LLM_PROVIDER explícito y no es el primero, reordenar
  if (explicitProvider && providers.length > 1) {
    const idx = providers.findIndex((p) => p.name === explicitProvider);
    if (idx > 0) {
      const [fav] = providers.splice(idx, 1);
      providers.unshift(fav);
    }
  }

  return providers;
}

/**
 * Obtiene la configuración del proveedor principal para compatibilidad e inspección.
 */
export function getLLMConfig() {
  const providers = getConfiguredProviders();
  if (providers.length > 0) {
    const p = providers[0];
    return { apiKey: p.apiKey, baseURL: p.baseURL, model: p.model, provider: p.name };
  }

  return {
    apiKey: '',
    baseURL: undefined,
    model: 'gemini-3.5-flash',
    provider: 'gemini',
  };
}

/**
 * Capa de abstracción para llamadas a LLM que garantiza salida JSON estructurada,
 * con conmutación por error automática entre Gemini y Groq.
 */
export async function generateStructuredJSON<T>(options: StructuredLLMOptions<T>): Promise<T> {
  const { messages, temperature = 0.1, fallbackFactory } = options;
  const providers = getConfiguredProviders();

  if (!providers.length) {
    if (fallbackFactory) {
      return fallbackFactory();
    }
    throw new Error('LLM en modo mock sin fallback implementado');
  }

  let lastError: any = null;

  for (const provider of providers) {
    try {
      const response = await provider.client.chat.completions.create({
        model: provider.model,
        messages: messages as any,
        temperature,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content || '{}';
      return JSON.parse(content) as T;
    } catch (error: any) {
      lastError = error;
      console.warn(
        `[Chatbot LLM] Proveedor ${provider.name} (${provider.model}) no pudo procesar JSON: ${error?.message || error}. Intentando respaldo...`
      );
    }
  }

  if (fallbackFactory) {
    return fallbackFactory();
  }
  throw lastError || new Error('Todos los proveedores LLM configurados fallaron');
}

/**
 * Capa de abstracción para generación de texto libre con el LLM,
 * con conmutación por error automática entre Gemini y Groq.
 */
export async function generateText(messages: LLMMessage[], temperature: number = 0.3): Promise<string> {
  const providers = getConfiguredProviders();

  if (!providers.length) {
    return '';
  }

  for (const provider of providers) {
    try {
      const response = await provider.client.chat.completions.create({
        model: provider.model,
        messages: messages as any,
        temperature,
      });

      const text = response.choices[0]?.message?.content || '';
      if (text.trim()) {
        return text;
      }
    } catch (error: any) {
      console.warn(
        `[Chatbot LLM] Proveedor ${provider.name} (${provider.model}) falló en generateText: ${error?.message || error}. Probando siguiente proveedor...`
      );
    }
  }

  return '';
}
