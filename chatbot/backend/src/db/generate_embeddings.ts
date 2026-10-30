import { pool } from './index.js';
import { getEmbedding } from '../services/embedding.js';

export async function generateAllEmbeddings() {
  console.log('[Embeddings] Iniciando cálculo de embeddings para propiedades...');
  const client = await pool.connect();
  try {
    const res = await client.query(
      `SELECT id, codigo, titulo, descripcion, barrio, amenidades 
       FROM properties 
       ORDER BY codigo ASC`
    );

    const properties = res.rows;
    console.log(`[Embeddings] Se procesarán ${properties.length} propiedades.`);

    let count = 0;
    for (const prop of properties) {
      // Formato solicitado: titulo + descripcion + barrio + amenidades
      const amenidadesText = Array.isArray(prop.amenidades) && prop.amenidades.length > 0
        ? prop.amenidades.join(', ')
        : 'ninguna';

      const textToEmbed = `${prop.titulo}. ${prop.descripcion}. Ubicación: Barrio ${prop.barrio}, Ibagué. Amenidades: ${amenidadesText}.`;
      
      const embedding = await getEmbedding(textToEmbed);
      const vectorSqlString = `[${embedding.join(',')}]`;

      await client.query(
        `UPDATE properties SET embedding = $1::vector WHERE id = $2`,
        [vectorSqlString, prop.id]
      );

      count++;
      if (count % 5 === 0 || count === properties.length) {
        console.log(`[Embeddings] Progreso: ${count}/${properties.length} propiedades procesadas.`);
      }
    }

    console.log('[Embeddings] Cálculo y almacenamiento de embeddings completado con éxito.');
  } catch (error) {
    console.error('[Embeddings] Error durante la generación de embeddings:', error);
    throw error;
  } finally {
    client.release();
  }
}

if (process.argv[1] && process.argv[1].endsWith('generate_embeddings.ts')) {
  generateAllEmbeddings()
    .then(() => {
      console.log('[Embeddings] Proceso finalizado.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Embeddings] Falló:', err);
      process.exit(1);
    });
}
