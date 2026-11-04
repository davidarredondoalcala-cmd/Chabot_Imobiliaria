const fs = require('fs');
const path = require('path');
const csv = require('./backend/node_modules/csv-parser');

const CSV_PATH = 'c:\\Users\\david\\Documents\\Universidad\\6to smestre\\SIstemas Inteligentes\\co_properties.csv\\co_properties.csv';
const OUTPUT_PATH = path.join(__dirname, 'backend', 'src', 'inmuebles', 'co_inmuebles_clean.json');

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

function decodeHtmlEntities(str) {
  if (!str) return '';
  return str
    .replace(/&aacute;/gi, 'á')
    .replace(/&eacute;/gi, 'é')
    .replace(/&iacute;/gi, 'í')
    .replace(/&oacute;/gi, 'ó')
    .replace(/&uacute;/gi, 'ú')
    .replace(/&ntilde;/gi, 'ñ')
    .replace(/&Aacute;/g, 'Á')
    .replace(/&Eacute;/g, 'É')
    .replace(/&Iacute;/g, 'Í')
    .replace(/&Oacute;/g, 'Ó')
    .replace(/&Uacute;/g, 'Ú')
    .replace(/&Ntilde;/g, 'Ñ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&');
}

function stripEmojis(str) {
  if (!str) return '';
  return str.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '').trim();
}

function stripHtml(str) {
  if (!str) return '';
  return decodeHtmlEntities(str).replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
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

function cleanTitle(raw, tipo, barrio, ciudad) {
  if (!raw) return `${tipo} en ${barrio}, ${ciudad}`;
  let t = stripHtml(stripEmojis(raw));
  // Remove listing reference numbers at the end (e.g. "3476093")
  t = t.replace(/\b\d{6,10}\b/g, '').trim();
  // Remove prefix like "ALQUILA " or "VENDE "
  t = t.replace(/^(alquila|vende|se arrienda|se vende)\s+/i, '').trim();
  if (t === t.toUpperCase() || t.length < 5) {
    t = toTitleCase(t);
  }
  if (t.length < 5 || /^inmueble/i.test(t)) {
    return `${tipo} en ${barrio}, ${ciudad}`;
  }
  return t.slice(0, 60).trim();
}

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
  console.log('Extracting 1,000 PURE properties strictly from co_properties.csv...');

  const results = [];
  const TARGET_TOTAL = 1000;
  let scanned = 0;
  let casaIdx = 0;
  let aptoIdx = 0;
  const countsPerCityType = {};

  let stream;
  return new Promise((resolve, reject) => {
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      if (stream) stream.destroy();

      console.log(`Scan completed. Total collected: ${results.length}`);
      fs.writeFileSync(OUTPUT_PATH, JSON.stringify(results, null, 2), 'utf8');
      console.log(`Saved clean dataset: ${OUTPUT_PATH}`);

      const citySummary = {};
      const typeSummary = {};
      for (const item of results) {
        citySummary[item.ciudad] = (citySummary[item.ciudad] || 0) + 1;
        typeSummary[item.tipo] = (typeSummary[item.tipo] || 0) + 1;
      }
      console.log('Types:', typeSummary);
      console.log('Cities distribution:', Object.entries(citySummary).sort((a,b) => b[1] - a[1]));
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
        // Strictly Casa or Apartamento
        if (propType !== 'Casa' && propType !== 'Apartamento') return;

        const price = Number(row.price);
        const currency = (row.currency || '').trim();
        if (!price || isNaN(price) || price <= 0 || (currency && currency !== 'COP')) return;

        const city = normalizeCity(row.l3);
        if (!city) return;

        const opType = (row.operation_type || '').trim();
        if (opType !== 'Venta' && opType !== 'Arriendo' && opType !== 'Arriendo temporal') return;

        // Realistic price range
        if (opType === 'Venta') {
          if (price < 40000000 || price > 5000000000) return;
        } else {
          if (price < 300000 || price > 25000000) return;
        }

        const cityTypeKey = `${city}_${propType}_${opType === 'Venta' ? 'Venta' : 'Arriendo'}`;
        // Cap any single city/type/op to ensure geographic diversity across Colombia
        if ((countsPerCityType[cityTypeKey] || 0) >= 30) return;

        countsPerCityType[cityTypeKey] = (countsPerCityType[cityTypeKey] || 0) + 1;

        let barrio = stripHtml(stripEmojis(row.l4 || row.l5 || '')).trim();
        if (!barrio || barrio.length < 2) barrio = 'Sector Residencial';
        else barrio = toTitleCase(barrio);

        const dir = `Sector ${barrio}`;
        const nombre = cleanTitle(row.title, propType, barrio, city);

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

        let desc = stripHtml(stripEmojis(row.description || '')).trim();
        if (desc.length < 25) {
          desc = `Excelente ${propType.toLowerCase()} con excelente iluminación y distribución en ${barrio}, ${city}. Cuenta con ${habitaciones} habitaciones, ${banos} baños y ${area} m² de área privada en un sector con fácil acceso y tranquilidad.`;
        } else {
          desc = desc.slice(0, 350).trim();
        }

        let estado = 'Sin arrendar';
        let venc = '';
        let diaPago = 5;
        let contratos = [];

        if (opType === 'Venta') {
          estado = 'Para la venta';
        } else {
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
          console.log(`Processed ${results.length} clean properties (scanned ${scanned} rows)...`);
        }
      })
      .on('end', () => {
        finish();
      })
      .on('error', (err) => {
        console.error('Error:', err);
        reject(err);
      });
  });
}

run().catch(console.error);
