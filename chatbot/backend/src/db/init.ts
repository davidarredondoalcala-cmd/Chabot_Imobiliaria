import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from './index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function initDatabase() {
  console.log('[DB Init] Conectando a PostgreSQL y aplicando schema.sql...');
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(schemaSql);
    await client.query('COMMIT');
    console.log('[DB Init] Esquema aplicado con éxito.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[DB Init] Error aplicando esquema:', error);
    throw error;
  } finally {
    client.release();
  }
}

if (process.argv[1] && process.argv[1].endsWith('init.ts')) {
  initDatabase()
    .then(() => {
      console.log('[DB Init] Base de datos inicializada correctamente.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[DB Init] Falló la inicialización:', err);
      process.exit(1);
    });
}
