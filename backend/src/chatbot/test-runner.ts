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
    r1.properties.length === 0 && r1.reply.includes('45.000.000') && r1.reply.includes('casas en venta') && r1.reply.includes('empiezan desde'),
    'Compra casa con 10M indica que empiezan desde $45.000.000 COP',
    r1.reply
  );

  // Test 2: Compra de apartamento con 50 millones
  const r2 = await processUserMessage('test-2', 'compra de apartamento con presupuesto de 50 millones');
  assert(
    r2.properties.length === 0 && r2.reply.includes('68.000.000') && r2.reply.includes('apartamentos en venta'),
    'Compra apartamento con 50M indica que empiezan desde $68.000.000 COP',
    r2.reply
  );

  // Test 3: Compra general con 10 millones
  const r3 = await processUserMessage('test-3', 'compra con presupuesto de 10 millones');
  assert(
    r3.properties.length === 0 && r3.reply.includes('45.000.000') && r3.reply.includes('en venta'),
    'Compra general con 10M indica que empiezan desde $45.000.000 COP',
    r3.reply
  );

  // Test 4: Arriendo casa con 200 mil
  const r4 = await processUserMessage('test-4', 'arriendo de casa con presupuesto de 200 mil');
  assert(
    r4.properties.length === 0 && r4.reply.includes('300.000') && r4.reply.includes('casas en arriendo'),
    'Arriendo casa con 200k indica que empiezan desde $300.000 COP al mes',
    r4.reply
  );

  // Test 5: Arriendo apartamento con 200 mil
  const r5 = await processUserMessage('test-5', 'arriendo de apartamento con presupuesto de 200 mil');
  assert(
    r5.properties.length === 0 && r5.reply.includes('350.000') && r5.reply.includes('apartamentos en arriendo'),
    'Arriendo apartamento con 200k indica que empiezan desde $350.000 COP al mes',
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
  const r7 = await processUserMessage('test-7', 'Un apartamento en Ciudad Jardín');
  assert(
    r7.reply.includes('Ciudad Jardín') && r7.reply.includes('apartamento') && r7.reply.includes('arriendo o para comprar'),
    'Preguntar por Ciudad Jardín sin operación nombra el sector y pregunta arriendo o comprar',
    r7.reply
  );

  // Test 8: Saludo y reinicio
  const r8 = await processUserMessage('test-8', 'Hola');
  assert(
    r8.reply.includes('Habitat Capital') && r8.reply.includes('arriendo o para comprar'),
    'Saludo inicial da bienvenida oficial',
    r8.reply
  );

  // Test 9: Búsqueda con resultado (arriendo en Cali con 2.5 millones)
  const r9 = await processUserMessage('test-9', 'busco apartamento en arriendo en cali por 2.5 millones');
  assert(
    r9.properties.length > 0 && r9.properties.some(p => p.ciudad.toLowerCase().includes('cali')),
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

  // Test 11: Ciudad fuera de la cobertura del catálogo
  const r11 = await processUserMessage('test-11', 'quiero arrendar una casa en Pasto');
  assert(
    r11.properties.length === 0 && r11.reply.includes('Pasto') && r11.reply.includes('no tenemos'),
    'Buscar en Pasto responde oportunamente que aún no hay inmuebles en esa ciudad y ofrece catálogo disponible',
    r11.reply
  );

  // Test 11b: Búsqueda en Medellín devuelve resultados
  const r11b = await processUserMessage('test-11b', 'arriendo en medellin');
  assert(
    r11b.properties.length > 0 && r11b.properties.every(p => p.ciudad.toLowerCase().includes('medell')),
    'Arriendo en Medellín devuelve inmuebles reales de Medellín',
    `props=${r11b.properties.length}`
  );

  // Test 11c: Búsqueda de casa en Medellín devuelve casas de Medellín
  const r11c = await processUserMessage('test-11c', 'casa en medellin');
  assert(
    r11c.properties.length > 0 && r11c.properties.every(p => p.ciudad.toLowerCase().includes('medell') && p.tipo === 'casa'),
    'Casa en Medellín devuelve casas de Medellín',
    `props=${r11c.properties.length}`
  );

  // Test 11d: mencionar otra ciudad de origen NO bloquea si el usuario busca en ciudad con catálogo
  const r11d = await processUserMessage('test-11d', 'soy de Pasto pero busco casa en Cali');
  assert(
    r11d.properties.length > 0 && r11d.properties.every(p => p.ciudad.toLowerCase().includes('cali')),
    'Soy de Pasto pero busco en Cali entrega inmuebles de Cali sin rechazo',
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
    r18a.properties.length === 0 && r18a.reply.includes('68.000.000'),
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
    'en Medellín con 300 millones',
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
      r28.properties[0].codigo === 'HC-0777' &&
      r28.reply.includes('HC-0777'),
    'Consulta del más barato devuelve exactamente el apartamento de menor valor en el catálogo (HC-0777)',
    `props=${r28.properties.map(p => p.codigo).join(', ')} reply=${r28.reply.slice(0, 100)}`
  );

  // Test 29: El saludo de Jarvis nunca debe inyectar sus barrios de ejemplo al usuario (Screenshot del usuario)
  const conv29 = 'test-29-saludo-barrios-' + Date.now();
  await processUserMessage(conv29, 'hola');
  const r29 = await processUserMessage(conv29, 'dime que apto coste como maximo 900k en arriendo');
  assert(
    r29.properties.length > 0 &&
      r29.properties.every(p => p.tipo === 'apartamento' && p.operacion === 'arriendo' && p.precio <= 900000) &&
      !r29.reply.includes('no tenemos apartamentos en arriendo en El Vergel, Cádiz') &&
      !r29.reply.includes('Favorito'),
    'Tras el saludo, búsqueda "apto como maximo 900k en arriendo" entrega apartamentos sin inventar filtros de barrios',
    `props=${r29.properties.map(p => `${p.codigo}:$${p.precio}`).join(', ')} reply=${r29.reply.slice(0, 100)}`
  );

  // Test 30: Reconocimiento de '900k' y variantes con 'k' como miles
  const r30 = await processUserMessage('test-30-k', 'Busco apartamento en arriendo que cueste como maximo 900k en ibague');
  assert(
    r30.properties.length > 0 &&
      r30.properties.every(p => p.tipo === 'apartamento' && p.operacion === 'arriendo' && p.precio <= 900000),
    'Notación 900k se interpreta correctamente como $900.000 COP y filtra inmuebles <= 900k',
    `props=${r30.properties.map(p => `${p.codigo}:$${p.precio}`).join(', ')}`
  );

  // Test 31: Modismos colombianos de miles ('lucas' y 'barras')
  const r31 = await processUserMessage('test-31-lucas', 'arriendo de apartamento hasta 900 lucas');
  assert(
    r31.properties.length > 0 &&
      r31.properties.every(p => p.tipo === 'apartamento' && p.operacion === 'arriendo' && p.precio <= 900000),
    'Modismo "900 lucas" se interpreta correctamente como $900.000 COP',
    `props=${r31.properties.map(p => `${p.codigo}:$${p.precio}`).join(', ')}`
  );

  // Test 32: Notación 'M' para millones (ej. 350M en venta)
  const r32 = await processUserMessage('test-32-m', 'busco casa en venta de hasta 350M');
  assert(
    r32.properties.length > 0 &&
      r32.properties.every(p => p.tipo === 'casa' && p.operacion === 'venta' && p.precio <= 350000000),
    'Notación "350M" se interpreta correctamente como $350.000.000 COP',
    `props=${r32.properties.map(p => `${p.codigo}:$${p.precio}`).join(', ')}`
  );

  // Test 33: Cifras escritas en palabras ("novecientos mil")
  const r33 = await processUserMessage('test-33-words', 'arriendo de apartamento con presupuesto de novecientos mil');
  assert(
    r33.properties.length > 0 &&
      r33.properties.every(p => p.tipo === 'apartamento' && p.operacion === 'arriendo' && p.precio <= 900000),
    'Palabras "novecientos mil" se interpreta correctamente como $900.000 COP',
    `props=${r33.properties.map(p => `${p.codigo}:$${p.precio}`).join(', ')}`
  );

  // Test 34: Modismo colombiano de millones ("palos")
  const r34 = await processUserMessage('test-34-palos', 'arriendo de casa hasta un palo');
  assert(
    r34.properties.length > 0 &&
      r34.properties.every(p => p.tipo === 'casa' && p.operacion === 'arriendo' && p.precio <= 1000000),
    'Modismo "un palo" se interpreta correctamente como $1.000.000 COP',
    `props=${r34.properties.map(p => `${p.codigo}:$${p.precio}`).join(', ')}`
  );

  // Test 35: Consulta simultánea de arriendo o venta entrega opciones de AMBAS modalidades
  const r35 = await processUserMessage('test-35-ambas', '¿Tienen en arriendo o en venta en Cali?');
  assert(
    r35.properties.length >= 2 &&
      r35.properties.some(p => p.operacion === 'arriendo') &&
      r35.properties.some(p => p.operacion === 'venta') &&
      r35.reply.toLowerCase().includes('arriendo') &&
      r35.reply.toLowerCase().includes('venta') &&
      !r35.reply.includes('¿Estás buscando en **arriendo o para comprar**?'),
    'Preguntar por "en arriendo o en venta" entrega opciones de ambas modalidades simultáneamente',
    `props=${r35.properties.map(p => `${p.codigo}:${p.operacion}`).join(', ')} reply=${r35.reply.slice(0, 100)}`
  );

  // Test 36: Multi-turno: pasar de arriendo exclusivo a "en arriendo o en venta" no se queda bloqueado en arriendo
  const conv36 = 'test-36-multiturn-ambas';
  const r36a = await processUserMessage(conv36, 'busco apartamento en arriendo en cali con 2.5 millones');
  assert(
    r36a.properties.length > 0 && r36a.properties.every(p => p.operacion === 'arriendo'),
    'Turno 1: Búsqueda exclusiva en arriendo devuelve arriendos',
    `props=${r36a.properties.map(p => `${p.codigo}:${p.operacion}`).join(', ')}`
  );
  const r36b = await processUserMessage(conv36, '¿tienen en arriendo o en venta?');
  assert(
    r36b.properties.length >= 2 &&
      r36b.properties.some(p => p.operacion === 'arriendo') &&
      r36b.properties.some(p => p.operacion === 'venta') &&
      r36b.reply.toLowerCase().includes('arriendo') &&
      r36b.reply.toLowerCase().includes('venta'),
    'Turno 2: Al preguntar "en arriendo o en venta" se desbloquea arriendo y entrega ambas modalidades',
    `props=${r36b.properties.map(p => `${p.codigo}:${p.operacion}`).join(', ')} reply=${r36b.reply.slice(0, 100)}`
  );

  // Test 37: Tolerancia a typo en ciudad ("Celi" -> "Cali") según requerimiento exacto del usuario
  const r37 = await processUserMessage('test-37-celi', 'quiero que busques casas en Celi');
  assert(
    r37.properties.length > 0 &&
      r37.properties.every(p => p.ciudad.toLowerCase().includes('cali') && p.tipo === 'casa') &&
      r37.reply.includes('Cali') &&
      r37.reply.includes('¿Te referías a **Cali**?'),
    'Typo "en Celi" se detecta como Cali, pregunta amablemente confirmando y entrega casas de Cali',
    `props=${r37.properties.length} reply=${r37.reply.slice(0, 120)}`
  );

  // Test 38: Tolerancia a typo en barrio ("el pobaldo" -> "El Poblado")
  const r38 = await processUserMessage('test-38-pobaldo', 'apartamento en el pobaldo');
  assert(
    r38.properties.length > 0 &&
      r38.properties.some(p => p.barrio.toLowerCase().includes('poblado')) &&
      r38.properties.every(p => p.tipo === 'apartamento') &&
      r38.reply.includes('El Poblado') &&
      r38.reply.includes('¿Te referías a **El Poblado**?'),
    'Typo "el pobaldo" se detecta como El Poblado, confirma cordialmente y entrega apartamentos de El Poblado',
    `props=${r38.properties.length} reply=${r38.reply.slice(0, 120)}`
  );

  // Test 39: Tolerancia a typo en ciudad no soportada ("Pastoo" -> "Pasto")
  const r39 = await processUserMessage('test-39-pastoo', 'arriendo en Pastoo');
  assert(
    r39.properties.length === 0 &&
      r39.reply.includes('Pasto') &&
      r39.reply.includes('¿Te referías a **Pasto**?'),
    'Typo "Pastoo" se detecta como Pasto y responde oportunamente sobre la cobertura',
    `reply=${r39.reply.slice(0, 120)}`
  );

  // Test 40: Múltiples typos combinados ("caza en ariendo en Medelin")
  const r40 = await processUserMessage('test-40-combo', 'caza en ariendo en Medelin');
  assert(
    r40.properties.length > 0 &&
      r40.properties.every(p => p.tipo === 'casa' && p.operacion === 'arriendo' && p.ciudad.toLowerCase().includes('medell')) &&
      r40.reply.includes('Medellín'),
    'Combinación "caza en ariendo en Medelin" se interpreta correctamente como casa en arriendo en Medellín',
    `props=${r40.properties.length} reply=${r40.reply.slice(0, 120)}`
  );

  // Test 41: Seguimiento elíptico de zona ("y en villa del prado")
  // Mantiene compra + casa + presupuesto del turno anterior y cambia solo la zona
  await processUserMessage('test-41-villaprado', 'compra de casa con presupuesto de 260 millones');
  const r41 = await processUserMessage('test-41-villaprado', 'y en villa del prado');
  const esVillaDelPrado = (p: any) =>
    [p.barrio, p.titulo, p.direccion_aproximada, p.descripcion]
      .join(' ')
      .toLowerCase()
      .includes('villa del prado');
  assert(
    r41.properties.length > 0 &&
      r41.properties.every(esVillaDelPrado) &&
      r41.properties.every(p => p.operacion === 'venta' && p.tipo === 'casa'),
    'Seguimiento "y en villa del prado" muestra casas en venta en Villa del Prado (no lo rechaza ni ignora la zona)',
    `props=${r41.properties.length} reply=${r41.reply.slice(0, 120)}`
  );

  // Test 42: Seguimiento elíptico de precio ("y más baratas?")
  // Mantiene compra de apartamentos y ordena los resultados de menor a mayor precio
  await processUserMessage('test-42-baratas', 'compra de apartamento con presupuesto de 150 millones');
  const r42 = await processUserMessage('test-42-baratas', 'y más baratas?');
  const preciosAsc = r42.properties.map(p => p.precio);
  const estaOrdenado = preciosAsc.every((v, i) => i === 0 || preciosAsc[i - 1] <= v);
  assert(
    r42.properties.length > 0 &&
      r42.properties.every(p => p.operacion === 'venta' && p.tipo === 'apartamento') &&
      estaOrdenado,
    'Seguimiento "y más baratas?" ordena ascendentemente manteniendo compra de apartamentos',
    `props=${r42.properties.length} precios=${preciosAsc.slice(0, 5).join(',')}`
  );

  // Test 43: Seguimiento elíptico de habitaciones ("¿y con 3 habitaciones?")
  // Mantiene arriendo de apartamento y filtra por 3+ habitaciones
  await processUserMessage('test-43-hab', 'busco apartamento en arriendo con presupuesto de 2.5 millones');
  const r43 = await processUserMessage('test-43-hab', 'y con 3 habitaciones?');
  assert(
    r43.properties.length > 0 &&
      r43.properties.every(p => p.habitaciones >= 3) &&
      r43.properties.every(p => p.operacion === 'arriendo' && p.tipo === 'apartamento'),
    'Seguimiento "y con 3 habitaciones?" filtra apartamentos en arriendo con 3+ habitaciones',
    `props=${r43.properties.length} reply=${r43.reply.slice(0, 120)}`
  );

  // Test 44: Reclamo del usuario con reintento del último pedido
  // Disculpa formal + resultados con los criterios corregidos, sin volver a lo rechazado
  await processUserMessage('test-44-reclamo', 'busco casa en arriendo en Manizales con presupuesto de 300 mil');
  const r44 = await processUserMessage('test-44-reclamo', 'no, eso es un error, yo pedi casas en Cali en venta con presupuesto de 200 millones');
  assert(
    /disculpa/i.test(r44.reply) &&
      r44.properties.length > 0 &&
      r44.properties.every(p => p.operacion === 'venta' && p.tipo === 'casa') &&
      !/manizales/i.test(r44.reply),
    'Reclamo genera disculpa formal y reintenta con los criterios corregidos (casas en venta en Cali, no arriendo en Manizales)',
    `props=${r44.properties.length} reply=${r44.reply.slice(0, 160)}`
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
