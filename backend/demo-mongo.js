// Lanzador TEMPORAL de MongoDB en memoria para demo local (puerto 27017).
// No es parte del entregable: borra este archivo cuando conectes tu Atlas real.
const { MongoMemoryServer } = require('mongodb-memory-server');

(async () => {
  const mongod = await MongoMemoryServer.create({
    instance: { port: 27017, dbName: 'habitat-capital' },
  });
  console.log('DEMO-MONGO listo en', mongod.getUri());
  // Se queda vivo hasta que se cierre la consola
  process.on('SIGINT', async () => { await mongod.stop(); process.exit(0); });
  setInterval(() => {}, 1 << 30);
})();
