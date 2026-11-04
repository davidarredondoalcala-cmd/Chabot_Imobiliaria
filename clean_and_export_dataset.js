const fs = require('fs');
const path = require('path');
const csv = require('./backend/node_modules/csv-parser');

const CSV_PATH = 'c:\\Users\\david\\Documents\\Universidad\\6to smestre\\SIstemas Inteligentes\\co_properties.csv\\co_properties.csv';
const OUTPUT_PATH = path.join(__dirname, 'backend', 'src', 'inmuebles', 'co_inmuebles_clean.json');

// Curated pool of high resolution real estate photos for Casas and Apartamentos
const FOTOS_CASAS = [
  'https://images.unsplash.com/photo-1518780664697-55e3ad937233?auto=format&fit=crop&w=1000&q=80',
  'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1000&q=80',
  'https://images.unsplash.com/photo-1598228723793-52759bba239c?auto=format&fit=crop&w=1000&q=80',
  'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=1000&q=80',
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1000&q=80',
  'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1000&q=80',
  'https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=1000&q=80',
  'https://images.unsplash.com/photo-1570129477492-45c003edd2be?auto=format&fit=crop&w=1000&q=80',
  'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=1000&q=80',
  'https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?auto=format&fit=crop&w=1000&q=80',
];

const FOTOS_APTOS = [
  'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1000&q=80',
  'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1000&q=80',
  'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=1000&q=80',
  'https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=1000&q=80',
  'https://images.unsplash.com/photo-1534349762230-e0cadf78f5da?auto=format&fit=crop&w=1000&q=80',
  'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1000&q=80',
  'https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=1000&q=80',
  'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1000&q=80',
  'https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1000&q=80',
  'https://images.unsplash.com/photo-1502005229762-ee1b2b81e4b5?auto=format&fit=crop&w=1000&q=80',
];

function stripEmojis(str) {
  if (!str) return '';
  return str.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '').trim();
}

function stripHtml(str) {
  if (!str) return '';
  return str.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
}

function toTitleCase(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// Clean and normalize city
function normalizeCity(raw) {
  if (!raw) return '';
  let c = stripHtml(stripEmojis(raw)).trim();
  if (c.toLowerCase().startsWith('bogot')) return 'Bogotá';
  if (c.toLowerCase().startsWith('medell')) return 'Medellín';
  if (c.toLowerCase().startsWith('ibagu')) return 'Ibagué';
  if (c.toLowerCase().startsWith('cali')) return 'Cali';
  if (c.toLowerCase().startsWith('barranquilla')) return 'Barranquilla';
  if (c.toLowerCase().startsWith('bucaramanga')) return 'Bucaramanga';
  if (c.toLowerCase().startsWith('cartagena')) return 'Cartagena';
  if (c.toLowerCase().startsWith('pereira')) return 'Pereira';
  if (c.toLowerCase().startsWith('manizales')) return 'Manizales';
  if (c.toLowerCase().startsWith('cucuta') || c.toLowerCase().startsWith('cúcuta')) return 'Cúcuta';
  if (c.toLowerCase().startsWith('santa marta')) return 'Santa Marta';
  if (c.toLowerCase().startsWith('armenia')) return 'Armenia';
  if (c.toLowerCase().startsWith('popayan') || c.toLowerCase().startsWith('popayán')) return 'Popayán';
  if (c.toLowerCase().startsWith('envigado')) return 'Envigado';
  if (c.toLowerCase().startsWith('chia') || c.toLowerCase().startsWith('chía')) return 'Chía';
  return toTitleCase(c);
}

async function run() {
  console.log('Extracting and cleaning dataset from CSV...');

  const results = [];
  const TARGET_TOTAL = 1000; // 1,000 properties = 20 pages of 50
  let scanned = 0;
  let casaIdx = 0;
  let aptoIdx = 0;

  // Track counts per city and type to maintain high diversity across Colombia
  const countsPerCityType = {};

  let stream;
  return new Promise((resolve, reject) => {
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      if (stream) stream.destroy();
      
      // Also integrate the Ibagué reference properties from seed
      try {
        const seedPath = path.join(__dirname, 'backend', 'src', 'chatbot', 'seed.ts');
        const seedContent = fs.readFileSync(seedPath, 'utf8');
        // Extract basic Ibagué properties
        const matches = [...seedContent.matchAll(/titulo:\s*'([^']+)',[\s\S]*?barrio:\s*'([^']+)',[\s\S]*?precio:\s*(\d+),[\s\S]*?area_m2:\s*(\d+),[\s\S]*?habitaciones:\s*(\d+),[\s\S]*?banos:\s*(\d+),[\s\S]*?operacion:\s*'([^']+)',[\s\S]*?tipo:\s*'([^']+)'/g)];
        for (const m of matches) {
          const [_, titulo, barrio, precio, area, hab, ban, op, tipo] = m;
          const propTipo = tipo.toLowerCase() === 'apartamento' ? 'Apartamento' : 'Casa';
          results.unshift({
            tipo: propTipo,
            nombre: titulo,
            ciudad: 'Ibagué',
            barrio: barrio,
            dir: `Sector ${barrio}`,
            valor: Number(precio),
            estado: op === 'venta' ? 'Para la venta' : 'Sin arrendar',
            venc: '',
            diaPago: 5,
            habitaciones: Number(hab),
            banos: Number(ban),
            area: Number(area),
            descripcion: `Inmueble tipo ${propTipo.toLowerCase()} ubicado en el sector ${barrio} de Ibagué.`,
            lind: `Norte: Vía pública, Sur: Predio privado, Oriente y Occidente: Predios colindantes en ${barrio}.`,
            foto: propTipo === 'Casa' ? FOTOS_CASAS[0] : FOTOS_APTOS[0],
            contratos: [],
          });
        }
        console.log(`Added ${matches.length} reference Ibagué properties.`);
      } catch (e) {
        console.warn('Could not read seed.ts:', e.message);
      }

      console.log(`Scan completed. Total collected: ${results.length}`);
      fs.writeFileSync(OUTPUT_PATH, JSON.stringify(results, null, 2), 'utf8');
      console.log(`Cleaned dataset successfully saved to: ${OUTPUT_PATH}`);

      // Summary stats
      const citySummary = {};
      const typeSummary = {};
      const stateSummary = {};
      for (const item of results) {
        citySummary[item.ciudad] = (citySummary[item.ciudad] || 0) + 1;
        typeSummary[item.tipo] = (typeSummary[item.tipo] || 0) + 1;
        stateSummary[item.estado] = (stateSummary[item.estado] || 0) + 1;
      }
      console.log('Types:', typeSummary);
      console.log('States:', stateSummary);
      console.log('Top Cities:', Object.entries(citySummary).sort((a,b) => b[1] - a[1]));
      resolve(results);
    };

    stream = fs.createReadStream(CSV_PATH)
      .pipe(csv())
      .on('data', (row) => {
        scanned++;
        if (results.length >= TARGET_TOTAL) {
          finish();
          return;
        }

        const propType = (row.property_type || '').trim();
        if (propType !== 'Casa' && propType !== 'Apartamento') return;

        const price = Number(row.price);
        const currency = (row.currency || '').trim();
        if (!price || isNaN(price) || price <= 0 || (currency && currency !== 'COP')) return;

        const city = normalizeCity(row.l3);
        if (!city) return;

        const opType = (row.operation_type || '').trim();
        if (opType !== 'Venta' && opType !== 'Arriendo' && opType !== 'Arriendo temporal') return;

        // Realistic price range filters
        if (opType === 'Venta') {
          if (price < 40000000 || price > 5000000000) return;
        } else {
          if (price < 300000 || price > 25000000) return;
        }

        const cityTypeKey = `${city}_${propType}_${opType === 'Venta' ? 'Venta' : 'Arriendo'}`;
        // Cap any individual city-type-op combination at 40 items so all regions get represented
        if ((countsPerCityType[cityTypeKey] || 0) >= 35) return;

        countsPerCityType[cityTypeKey] = (countsPerCityType[cityTypeKey] || 0) + 1;

        // Clean barrio
        let barrio = stripHtml(stripEmojis(row.l4 || row.l5 || '')).trim();
        if (!barrio || barrio.length < 2) barrio = 'Sector Residencial';
        else barrio = toTitleCase(barrio);

        // Address
        const dir = `Sector ${barrio}`;

        // Clean title
        let rawTitle = stripHtml(stripEmojis(row.title || '')).trim();
        if (rawTitle.length < 5 || rawTitle.toLowerCase().includes('inmueble') && rawTitle.length < 15) {
          rawTitle = `${propType} en ${barrio}, ${city}`;
        } else {
          // If all caps, title case it
          if (rawTitle === rawTitle.toUpperCase() && rawTitle.length > 5) {
            rawTitle = toTitleCase(rawTitle);
          }
        }
        // Ensure title is clean and no more than 60 chars
        let nombre = rawTitle.slice(0, 60).trim();

        // Bedrooms / Bathrooms / Area
        let habitaciones = Number(row.bedrooms || row.rooms);
        if (!habitaciones || isNaN(habitaciones) || habitaciones <= 0 || habitaciones > 12) {
          habitaciones = propType === 'Casa' ? 3 : 2;
        }

        let banos = Number(row.bathrooms);
        if (!banos || isNaN(banos) || banos <= 0 || banos > 10) {
          banos = propType === 'Casa' ? 2 : 1;
        }

        let area = Number(row.surface_covered || row.surface_total);
        if (!area || isNaN(area) || area <= 10 || area > 1000) {
          area = propType === 'Casa' ? 120 : 65;
        }

        // Clean description
        let desc = stripHtml(stripEmojis(row.description || '')).trim();
        if (desc.length < 25) {
          desc = `Excelente ${propType.toLowerCase()} con excelente iluminación y distribución en ${barrio}, ${city}. Cuenta con ${habitaciones} habitaciones, ${banos} baños y ${area} m² de área privada en un sector con fácil acceso y tranquilidad.`;
        } else {
          desc = desc.slice(0, 350).trim();
        }

        // Estado: 'Para la venta' / 'Sin arrendar' / 'Arrendada'
        let estado = 'Sin arrendar';
        let venc = '';
        let diaPago = 5;
        let contratos = [];

        if (opType === 'Venta') {
          estado = 'Para la venta';
        } else {
          // Make ~20% of rentals currently 'Arrendada' for realistic admin management
          if (results.length % 5 === 0) {
            estado = 'Arrendada';
            venc = '2026-12-30';
            diaPago = 5;
            contratos = [
              {
                tipo: 'Arriendo',
                vig: true,
                fecha: '2025-12-30',
                firm: ['Carlos Rodríguez', 'Habitat Capital S.A.S.'],
              },
            ];
          } else {
            estado = 'Sin arrendar';
          }
        }

        // Photo
        const foto = propType === 'Casa'
          ? FOTOS_CASAS[casaIdx++ % FOTOS_CASAS.length]
          : FOTOS_APTOS[aptoIdx++ % FOTOS_APTOS.length];

        results.push({
          tipo: propType,
          nombre,
          ciudad: city,
          barrio,
          dir,
          valor: price,
          estado,
          venc,
          diaPago,
          habitaciones,
          banos,
          area,
          descripcion: desc,
          lind: `Norte: Calle pública, Sur: Predio privado, Oriente y Occidente: Predios colindantes en ${barrio}.`,
          foto,
          contratos,
        });

        if (results.length % 100 === 0) {
          console.log(`Gathered ${results.length} clean properties (scanned ${scanned} rows)...`);
        }
      })
      .on('end', () => {
        finish();
      })
      .on('error', (err) => {
        console.error('Error parsing:', err);
        reject(err);
      });
  });
}

run().catch(console.error);
