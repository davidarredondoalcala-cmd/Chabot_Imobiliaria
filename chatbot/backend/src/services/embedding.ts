import OpenAI from 'openai';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

const EMBEDDING_PROVIDER = process.env.EMBEDDING_PROVIDER || 'openai';
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'text-embedding-3-small';
const EMBEDDING_DIMENSION = parseInt(process.env.EMBEDDING_DIMENSION || '1536', 10);
const API_KEY = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || '';

let openaiClient: OpenAI | null = null;
if (API_KEY && (EMBEDDING_PROVIDER === 'openai' || EMBEDDING_PROVIDER === 'openrouter')) {
  openaiClient = new OpenAI({
    apiKey: API_KEY,
    baseURL: process.env.LLM_BASE_URL || undefined,
  });
}

/**
 * Genera un vector determinista unitario de longitud N basado en un hash SHA-256.
 * Sirve como fallback offline (mock) o cuando no hay API key configurada.
 */
function generateDeterministicVector(text: string, dimension: number = EMBEDDING_DIMENSION): number[] {
  const clean = text.toLowerCase().trim();
  const vector: number[] = new Array(dimension).fill(0);
  
  // Usar hash criptográfico para generar números pseudo-aleatorios consistentes
  const words = clean.split(/\s+/);
  for (const word of words) {
    if (!word) continue;
    const hash = crypto.createHash('sha256').update(word).digest();
    for (let i = 0; i < dimension; i++) {
      const byte = hash[i % hash.length];
      const sign = (byte % 2 === 0) ? 1 : -1;
      const weight = (byte / 255) * sign;
      vector[i] += weight;
    }
  }

  // Normalizar vector a norma L2 = 1 para similitud coseno
  const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0)) || 1;
  return vector.map(val => Number((val / norm).toFixed(6)));
}

/**
 * Obtiene el embedding de un texto usando el proveedor configurado o fallback.
 */
export async function getEmbedding(text: string): Promise<number[]> {
  const normalizedText = text.replace(/\n+/g, ' ').trim();
  if (!normalizedText) {
    return new Array(EMBEDDING_DIMENSION).fill(0);
  }

  if (EMBEDDING_PROVIDER === 'mock' || !API_KEY || !openaiClient) {
    return generateDeterministicVector(normalizedText, EMBEDDING_DIMENSION);
  }

  try {
    const response = await openaiClient.embeddings.create({
      model: EMBEDDING_MODEL,
      input: normalizedText,
      dimensions: EMBEDDING_DIMENSION,
    });
    return response.data[0].embedding;
  } catch (error: any) {
    console.warn(`[Embedding] Error con proveedor ${EMBEDDING_PROVIDER}: ${error?.message || error}. Usando fallback determinista.`);
    return generateDeterministicVector(normalizedText, EMBEDDING_DIMENSION);
  }
}

/**
 * Obtiene embeddings en lote (batch)
 */
export async function getBatchEmbeddings(texts: string[]): Promise<number[][]> {
  if (EMBEDDING_PROVIDER === 'mock' || !API_KEY || !openaiClient) {
    return texts.map(t => generateDeterministicVector(t, EMBEDDING_DIMENSION));
  }

  try {
    const cleanTexts = texts.map(t => t.replace(/\n+/g, ' ').trim() || 'propiedad');
    const response = await openaiClient.embeddings.create({
      model: EMBEDDING_MODEL,
      input: cleanTexts,
      dimensions: EMBEDDING_DIMENSION,
    });
    return response.data.map(d => d.embedding);
  } catch (error: any) {
    console.warn(`[Batch Embedding] Error con proveedor ${EMBEDDING_PROVIDER}. Usando fallback determinista.`);
    return texts.map(t => generateDeterministicVector(t, EMBEDDING_DIMENSION));
  }
}
