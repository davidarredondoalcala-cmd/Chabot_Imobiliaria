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

  // Test 14: Pregunta sobre deportes o personajes ajenos a la inmobiliaria
  const r14 = await processUserMessage('test-14', 'quién es Messi');
  assert(
    r14.properties.length === 0 &&
      r14.reply.includes('No puedo responder a ese tipo de peticiones') &&
      Boolean(r14.suggestionChips && r14.suggestionChips.length > 0),
    'Pregunta sobre Messi responde que no puede responder a esa petición y ofrece recomendaciones',
    r14.reply
  );

  // Test 15: Pregunta sobre recetas o cocina ajena
  const r15 = await processUserMessage('test-15', 'cómo preparar una pizza');
  assert(
    r15.properties.length === 0 &&
      r15.reply.includes('No puedo responder a ese tipo de peticiones') &&
      Boolean(r15.suggestionChips && r15.suggestionChips.length > 0),
    'Pregunta de recetas responde que no puede responder y ofrece sugerencias inmobiliarias',
    r15.reply
  );

  // Test 16: Pregunta de programación o código
  const r16 = await processUserMessage('test-16', 'escribe un script en python');
  assert(
    r16.properties.length === 0 &&
      r16.reply.includes('No puedo responder a ese tipo de peticiones'),
    'Pregunta de programación responde que no puede responder a peticiones ajenas',
    r16.reply
  );

  // Test 17: Búsqueda restringida EXCLUSIVAMENTE a la base de datos (MongoDB)
  const mockDbProperty = {
    id: 'mongo-custom-99',
    codigo: 'HC-9999',
    operacion: 'arriendo' as const,
    tipo: 'apartamento' as const,
    titulo: 'Apartamento Exclusivo BD Real Habitat',
    descripcion: 'Apartamento únicamente existente en la base de datos real de Habitat Capital.',
    ciudad: 'Ibagué',
    barrio: 'El Vergel',
    precio: 1800000,
    area_m2: 85,
    habitaciones: 3,
    banos: 2,
    parqueaderos: 1,
    estrato: 5,
    amenidades: ['ascensor', 'piscina'],
    disponible: true,
  };
  const r17 = await processUserMessage(
    'test-17',
    'apartamento en arriendo en el vergel por 1.8 millones',
    [mockDbProperty]
  );
  assert(
    r17.properties.length === 1 &&
      r17.properties[0].codigo === 'HC-9999' &&
      !r17.properties.some(p => p.id.startsWith('seed-')),
    'El chat responde SOLO con lo registrado en la base de datos (sin incluir semillas)',
    `props=${r17.properties.map(p => p.codigo).join(', ')}`
  );

  // Test 18: Corrección del bug de repetición con habitaciones (Screenshot 1 del usuario)
  // Turno 1: Presupuesto insuficiente de compra
  const r18a = await processUserMessage('test-18-repetition', 'compra de apartamento con presupuesto de 50 millones');
  assert(
    r18a.properties.length === 0 && r18a.reply.includes('210.000.000'),
    'Turno 1: Presupuesto 50M de compra explica piso mínimo',
    r18a.reply
  );
  // Turno 2: Usuario pide "Muéstrame algunos apartamentos con 4 habitaciones maximo"
  // Jarvis NO debe repetir el mensaje de 50M de presupuesto y debe mostrar apartamentos con <= 4 habitaciones
  const r18b = await processUserMessage('test-18-repetition', 'Muéstrame algunos apartamentos con 4 habitaciones maximo');
  assert(
    r18b.properties.length > 0 &&
      r18b.properties.every(p => p.habitaciones <= 4) &&
      !r18b.reply.includes('Con tu presupuesto no tenemos opciones disponibles en este momento'),
    'Turno 2: "Muéstrame apartamentos con 4 habitaciones maximo" muestra inmuebles y NO repite el error de presupuesto',
    `props=${r18b.properties.length} reply=${r18b.reply.slice(0, 80)}`
  );

  // Test 19: Corrección del bug de bucle en "Sí, otras zonas" (Screenshot 2 del usuario)
  // Turno 1: Buscar casa en arriendo en El Vergel (no hay stock)
  const r19a = await processUserMessage('test-19-otras-zonas', 'busco casa en arriendo en la macarena');
  assert(
    r19a.properties.length === 0 && r19a.reply.includes('otras zonas'),
    'Turno 1: Sin stock en La Macarena invita a ver otras zonas',
    r19a.reply
  );
  // Turno 2: Usuario responde "Sí, otras zonas"
  // Jarvis NO debe volver a preguntar por barrio o presupuesto; debe mostrar directamente casas en arriendo en Ibagué
  const r19b = await processUserMessage('test-19-otras-zonas', 'Sí, otras zonas');
  assert(
    r19b.properties.length > 0 &&
      r19b.properties.every(p => p.tipo === 'casa' && p.operacion === 'arriendo') &&
      !r19b.reply.toLowerCase().includes('algún barrio de ibagué de tu preferencia'),
    'Turno 2: "Sí, otras zonas" entrega casas en arriendo directamente sin pedir barrio en bucle',
    `props=${r19b.properties.length} reply=${r19b.reply.slice(0, 80)}`
  );

  // Test 20: Cambio de modalidad (venta a arriendo) resetea presupuesto incompatible
  const r20a = await processUserMessage('test-20-modalidad', 'quiero comprar una casa con 350 millones');
  assert(r20a.properties.length > 0, 'Turno 1: Compra con 350M encuentra casas');
  const r20b = await processUserMessage('test-20-modalidad', 'ahora prefiero ver casas en arriendo con 1.5 millones');
  assert(
    r20b.properties.length > 0 &&
      r20b.properties.every(p => p.operacion === 'arriendo') &&
      r20b.properties.some(p => p.precio < 10000000),
    'Turno 2: Cambio a arriendo limpia presupuesto de compra de 350M y entrega arriendos normales',
    `props=${r20b.properties.length}`
  );

  // Test 21: Preservación de contexto restaurado desde historial cliente
  const historyClient = [
    { role: 'user', content: 'hola, estoy interesado en comprar un apartamento' },
    { role: 'assistant', content: '¡Con gusto! ¿Tienes algún barrio en mente o presupuesto?' }
  ];
  const r21 = await processUserMessage(
    'test-21-restored',
    'en Piedra Pintada con 300 millones',
    undefined,
    historyClient
  );
  assert(
    r21.properties.length > 0 &&
      r21.properties.every(p => p.operacion === 'venta' && p.tipo === 'apartamento'),
    'Historial restaurado del cliente preserva tipo (apartamento) y operación (compra)',
    `props=${r21.properties.length}`
  );

  // Test 22: Filtro estricto de casas (nunca devuelve apartamentos)
  const r22 = await processUserMessage('test-22-casa', 'busco casas en arriendo con 1.5 millones');
  assert(
    r22.properties.length > 0 &&
      r22.properties.every(p => p.tipo === 'casa' && p.operacion === 'arriendo' && p.precio <= 1500000),
    'Filtro de casas devuelve estrictamente casas dentro del presupuesto (<= 1.5M)',
    `props=${r22.properties.map(p => `${p.codigo}:${p.tipo}:${p.precio}`).join(', ')}`
  );

  // Test 23: Filtro estricto de apartamentos (nunca devuelve casas)
  const r23 = await processUserMessage('test-23-apto', 'busco apartamentos en arriendo con 1.5 millones');
  assert(
    r23.properties.length > 0 &&
      r23.properties.every(p => p.tipo === 'apartamento' && p.operacion === 'arriendo' && p.precio <= 1500000),
    'Filtro de apartamentos devuelve estrictamente apartamentos dentro del presupuesto (<= 1.5M)',
    `props=${r23.properties.map(p => `${p.codigo}:${p.tipo}:${p.precio}`).join(', ')}`
  );

  // Test 24: Respeto estricto del presupuesto del cliente (<= 1 millón)
  const r24 = await processUserMessage('test-24-budget', 'arriendo de casa con 1 millon');
  assert(
    r24.properties.length > 0 &&
      r24.properties.every(p => p.precio <= 1000000 && p.tipo === 'casa'),
    'Presupuesto de 1M para casas devuelve solo opciones con precio <= 1.000.000 COP',
    `props=${r24.properties.map(p => `${p.codigo}:$${p.precio}`).join(', ')}`
  );

  // Test 25: Pregunta informativa sobre requisitos de arriendo
  const r25 = await processUserMessage('test-25-req', '¿Cuáles son los requisitos para arrendar?');
  assert(
    r25.reply.toLowerCase().includes('requisitos') &&
      (r25.reply.toLowerCase().includes('codeudor') || r25.reply.toLowerCase().includes('ingresos') || r25.reply.toLowerCase().includes('cédula')) &&
      r25.properties.length === 0,
    'Pregunta de requisitos de arriendo responde oportunamente con los requisitos sin desviar la conversación',
    r25.reply.slice(0, 100)
  );

  // Test 26: Pregunta informativa sobre mascotas
  const r26 = await processUserMessage('test-26-pets', '¿Aceptan mascotas en los apartamentos?');
  assert(
    r26.reply.toLowerCase().includes('mascotas') &&
      r26.reply.toLowerCase().includes('propiedad horizontal'),
    'Pregunta de mascotas responde oportunamente sobre las políticas de mascotas',
    r26.reply.slice(0, 100)
  );

  // Test 27: Pregunta sobre ubicación de oficina de la inmobiliaria
  const r27 = await processUserMessage('test-27-location', '¿Dónde queda su oficina?');
  assert(
    r27.reply.toLowerCase().includes('ibagué') &&
      r27.reply.toLowerCase().includes('horario'),
    'Pregunta de ubicación responde oportunamente con la sede y horarios en Ibagué',
    r27.reply.slice(0, 100)
  );

  // Test 28: Consulta del inmueble más barato en catálogo
  const r28 = await processUserMessage('test-28-cheapest', '¿Cuál es el apartamento más barato en arriendo?');
  assert(
    r28.properties.length === 1 &&
      r28.properties[0].codigo === 'IBG-0018' &&
      r28.reply.includes('IBG-0018'),
    'Consulta del más barato devuelve exactamente el apartamento de menor valor en el catálogo (IBG-0018)',
    `props=${r28.properties.map(p => p.codigo).join(', ')} reply=${r28.reply.slice(0, 100)}`
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
