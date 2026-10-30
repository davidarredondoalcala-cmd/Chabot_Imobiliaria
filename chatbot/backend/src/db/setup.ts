import { initDatabase } from './init.js';
import { seedProperties } from './seed.js';
import { generateAllEmbeddings } from './generate_embeddings.js';

export async function runFullSetup() {
  console.log('=== INICIANDO SETUP COMPLETO DE BASE DE DATOS ===');
  console.log('1. Inicializando esquema DDL y extensiones...');
  await initDatabase();

  console.log('\n2. Insertando 40 propiedades de prueba en Ibagué...');
  await seedProperties();

  console.log('\n3. Generando y guardando embeddings vectoriales...');
  await generateAllEmbeddings();

  console.log('\n=== SETUP COMPLETADO EXITOSAMENTE ===');
}

if (process.argv[1] && process.argv[1].endsWith('setup.ts')) {
  runFullSetup()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Error en setup:', err);
      process.exit(1);
    });
}
