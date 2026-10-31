import { processUserMessage } from './orchestrator';

async function runTests() {
  console.log('=== Iniciando verificación del Chatbot Habitat Capital ===\n');
  let passed = 0;
  let total = 0;

  function assert(condition: boolean, name: string, detail?: string) {
    total++;
    if (condition) {
      console.log(`✓ [PASS] ${name}`);
      passed++;
    } else {
      console.error(`✗ [FAIL] ${name}${detail ? ` -> ${detail}` : ''}`);
    }
  }

  // Test 1: Compra de casa con 10 millones
  const r1 = await processUserMessage('test-1', 'compra de casa con un presupuesto de 10 millones');
  assert(
    r1.properties.length === 0 && r1.reply.includes('300.000.000') && r1.reply.includes('casas en venta') && r1.reply.includes('empiezan desde'),
    'Compra casa con 10M indica que empiezan desde $300.000.000 COP',
    r1.reply
  );

  // Test 2: Compra de apartamento con 50 millones
  const r2 = await processUserMessage('test-2', 'compra de apartamento con presupuesto de 50 millones');
  assert(
    r2.properties.length === 0 && r2.reply.includes('210.000.000') && r2.reply.includes('apartamentos en venta'),
    'Compra apartamento con 50M indica que empiezan desde $210.000.000 COP',
    r2.reply
  );

  // Test 3: Compra general con 10 millones
  const r3 = await processUserMessage('test-3', 'compra con presupuesto de 10 millones');
  assert(
    r3.properties.length === 0 && r3.reply.includes('210.000.000') && r3.reply.includes('en venta'),
    'Compra general con 10M indica que empiezan desde $210.000.000 COP',
    r3.reply
  );

  // Test 4: Arriendo casa con 500 mil
  const r4 = await processUserMessage('test-4', 'arriendo de casa con presupuesto de 500 mil');
  assert(
    r4.properties.length === 0 && r4.reply.includes('900.000') && r4.reply.includes('casas en arriendo'),
    'Arriendo casa con 500k indica que empiezan desde $900.000 COP al mes',
    r4.reply
  );

  // Test 5: Arriendo apartamento con 500 mil
  const r5 = await processUserMessage('test-5', 'arriendo de apartamento con presupuesto de 500 mil');
  assert(
    r5.properties.length === 0 && r5.reply.includes('850.000') && r5.reply.includes('apartamentos en arriendo'),
    'Arriendo apartamento con 500k indica que empiezan desde $850.000 COP al mes',
    r5.reply
  );

  // Test 6: Preguntar por presupuesto antes de compra
  const r6 = await processUserMessage('test-6', 'Hola, quiero comprar una casa');
  assert(
    r6.properties.length === 0 && r6.reply.toLowerCase().includes('presupuesto') && r6.reply.toLowerCase().includes('casa'),
    'Antes de dar opciones de compra debe preguntar por el presupuesto',
    r6.reply
  );

  // Test 7: Sector específico sin operación
  const r7 = await processUserMessage('test-7', 'Un apartamento en el vergel');
  assert(
    r7.reply.includes('El Vergel') && r7.reply.includes('apartamento') && r7.reply.includes('arriendo o para comprar'),
    'Preguntar por El Vergel sin operación nombra el sector y pregunta arriendo o comprar',
    r7.reply
  );

  // Test 8: Saludo y reinicio
  const r8 = await processUserMessage('test-8', 'Hola');
  assert(
    r8.reply.includes('Habitat Capital') && r8.reply.includes('arriendo o para comprar'),
    'Saludo inicial da bienvenida oficial',
    r8.reply
  );

  // Test 9: Búsqueda con resultado (arriendo en El Vergel con 2.5 millones)
  const r9 = await processUserMessage('test-9', 'busco apartamento en arriendo en el vergel por 2.5 millones');
  assert(
    r9.properties.length > 0 && r9.properties.some(p => p.barrio.toLowerCase().includes('vergel')),
    'Búsqueda exitosa devuelve propiedades y cards',
    `Found ${r9.properties.length} props`
  );

  // Test 10: Asesor por WhatsApp
  const r10 = await processUserMessage('test-10', 'quiero hablar con un asesor');
  assert(
    r10.needsHuman && Boolean(r10.whatsappUrl) && r10.whatsappUrl.includes('wa.me'),
    'Solicitud de asesor genera deep-link de WhatsApp',
    r10.whatsappUrl
  );

  // Test 11: Ciudad fuera de la cobertura (solo Ibagué)
  const r11 = await processUserMessage('test-11', 'quiero arrendar una casa en Bogotá');
  assert(
    r11.properties.length === 0 && r11.reply.toLowerCase().includes('ibagué'),
    'Buscar en Bogotá responde que solo hay inmuebles en Ibagué',
    r11.reply
  );

  // Test 11b: variante corta con otra ciudad
  const r11b = await processUserMessage('test-11b', 'arriendo en medellin');
  assert(
    r11b.properties.length === 0 && r11b.reply.toLowerCase().includes('ibagué'),
    'Arriendo en Medellín responde que solo hay inmuebles en Ibagué',
    r11b.reply
  );

  // Test 11c: variante sin palabra "busco/arriendo" explícita
  const r11c = await processUserMessage('test-11c', 'casa en medellin');
  assert(
    r11c.properties.length === 0 && r11c.reply.toLowerCase().includes('ibagué'),
    'Casa en Medellín responde que solo hay inmuebles en Ibagué',
    r11c.reply
  );

  // Test 11d: mencionar otra ciudad NO bloquea si el usuario busca en Ibagué
  const r11d = await processUserMessage('test-11d', 'soy de Medellín pero busco casa en Ibagué');
  assert(
    !r11d.reply.includes('nuestro catálogo vive 100%'),
    'Soy de Medellín pero busco en Ibagué NO genera rechazo por ciudad',
    `props=${r11d.properties.length} reply=${r11d.reply}`
  );

  // Test 12: Pregunta fuera del tema inmobiliario
  const r12 = await processUserMessage('test-12', 'cuanto es 2x2');
  assert(
    r12.properties.length === 0 && r12.reply.toLowerCase().includes('inmobiliaria'),
    'Pregunta matemática responde que solo responde temas de la inmobiliaria',
    r12.reply
  );

  // Test 12b: presupuesto con unidades absurdas (sin cifra válida en pesos)
  const r12b = await processUserMessage('test-12b', 'tengo una mandarina como presupuesto');
  assert(
    r12b.properties.length === 0 && r12b.reply.toLowerCase().includes('pesos'),
    'Presupuesto "mandarina" pide presupuesto válido en pesos, sin celebrar',
    r12b.reply
  );

  // Test 12c: monto real de presupuesto sigue el flujo normal
  const r12c = await processUserMessage('test-12c', 'quiero arriendo con 2.5 millones');
  assert(
    r12c.properties.length > 0 && !r12c.reply.toLowerCase().includes('mandarina'),
    'Presupuesto real de arriendo devuelve opciones normales',
    `props=${r12c.properties.length} reply=${r12c.reply}`
  );

  // Test 13: Barrio explícito sin stock no cae a otros barrios
  const r13 = await processUserMessage('test-13', 'busco casa en arriendo en el vergel con presupuesto de 300 mil');
  assert(
    r13.properties.length === 0 &&
      r13.reply.includes('El Vergel') &&
      r13.reply.toLowerCase().includes('otras'),
    'Barrio sin stock se explica sin tarjetas de otros barrios',
    `props=${r13.properties.length} reply=${r13.reply}`
  );

  // Test 13b: aceptar otras zonas elimina el barrio acumulado y devuelve opciones
  const r13b = await processUserMessage('test-13', 'sí, muéstrame otras zonas con presupuesto de 1.5 millones');
  assert(
    r13b.properties.length > 0,
    'Al aceptar otras zonas se limpia el barrio y devuelve opciones realmente disponibles',
    `props=${r13b.properties.length}`
  );

  console.log(`\n=== Resultado de pruebas: ${passed}/${total} superadas (${Math.round((passed/total)*100)}%) ===\n`);
  if (passed !== total) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Error ejecutando pruebas:', err);
  process.exit(1);
});
