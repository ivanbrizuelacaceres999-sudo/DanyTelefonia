// ============================================================
// Script de importación de inventario a Supabase
// Uso: node scripts/import-inventory.mjs
// ============================================================
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envRaw = readFileSync(join(__dirname, '..', '.env'), 'utf-8');
const env = Object.fromEntries(
  envRaw.split('\n').filter(l => l.includes('=')).map(l => {
    const idx = l.indexOf('=');
    return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
  })
);

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

// ── Limpiar nombre de producto ────────────────────────────────
function clean(name) {
  return name
    .replace(/\s*\[⚠️ DUPLICADO\]/g, '')
    .replace(/\s*\[⚠️ PROBABLE DUPLICADO\]/g, '')
    .replace(/\s*\[⚠️ ver duplicados\]/g, '')
    .trim();
}

// ── Datos del inventario ──────────────────────────────────────
const INV = {
  'ECOPOWER': {
    'Cables Carga Rápida': ['EP-6016 (Tiene CB)','EP-6024 (Tiene CB)','EP-6004 Tipo C','EP-6027 Tipo C','EP-6039 Tipo C','EP-6013 iPhone Tipo C','EP-6021'],
    'Cargadores Tipo C': ['EP-7040 45W (Tiene CB)','EP-7025 65W (Tiene CB)','EP-7050 20W','EP-7034'],
    'Cargadores iPhone / Tipo C': ['EP-7052 2.1A (Tiene CB)','EP-7058 2.1A (Tiene CB)'],
    'Sin CB': ['USB-C-35 Power Adapter Cabezal','S6-16 Pro Max','120W Adapter Suit – Cargador Carga Rápida Xiaomi'],
    'Auriculares (Punta Tipo C)': ['EP-H108 (Tiene CB)','EP-H107 (Tiene CB)','EP-H113','EP-H132 Wireless Portable Stereo Headphone'],
    'Cargador para Auto': ['EP-9028 (CB)','EP-7036 – viene con cable (CB)'],
    'USB': ['EP-R003 S (CB)'],
    'Adaptadores iPhone': ['Audio Adapter para iPhone (SCO)','iPhone USB-C to Lightning 20W Cable 1m (SCO)','Lightning to Headphone Jack (7/XR) GL-6A (SCO)'],
    'Cables y Cargadores (mostrador)': ['Ecopower Fast Charge Data Cable Charge (varios)','20W USB-C Power Adapter + Lightning Cable'],
    'Parlantes': ['EP-2360 Speaker Bluetooth Mini','EP-2369 B-Tooth Speaker Multifunctional Karaoke','EP-2338 Speaker Bluetooth','EP-2359 Speaker Bluetooth 20W','EP-2332 Speaker Bluetooth 6400W PMPO','EP-2301 Speaker Bluetooth Music','EP-2301 Speaker Bluetooth (arriba, grande)'],
    'Power Bank': ['EP-C870 Power Bank Smart Charge 12000mAh','EP-C819 Power Bank Smart Charge 12000mAh'],
    'Radio': ['EP-F504 AM/FM/SW 3 Bandas Radio con USB/TF – Music Rabicho'],
  },
  'JBL': {
    'Auriculares / Earbuds': ['Auricular JBL con CB','Auricular Tune Flex 2 JBL','Wave Beam 2 JBL','Buds 2 JBL','Wave Buds 2 JBL','Tune S20 3 JBL','JBL Wave 200','JBL Wave Deep Bass (Pure Fun)','AirPods Pro (ANC)'],
    'Parlantes': ['Flip 2 JBL','Comedog Suction Stand Charge 6 JBL','JBL Go Essential (negro)','JBL Go Essential (azul)'],
  },
  'PANTALLAS – HONOR': {
    'Modelos': ['Honor X7d','Honor Magic 7 Lite','Honor X7C S/A','Honor X5C Plus','Honor X7 Pro Ori S/A'],
  },
  'PANTALLAS – SAMSUNG': {
    'Serie A': [
      'A06 S/A','A06 C/A','A06 S/H','CA A06',
      'A03 Core S/A','A03 Core C/A','A03C S/A','A03 CO S/A','A03 Core SA Inc.','A03S C/A','A03S Aro','A035 Aro','A035 C/A',
      'A04E Aro','A04 EA Aro','A03 C/M',
      'A025 C/A','A025" C/A','A025 S/A','A023 S/A',
      'A015 / A035 / A04E S/H','D02 A03J',
      'A10 C/A','A10 S/N','A10 Aro','A10E','A10S Aro','A10S S/A',
      'A11 S/A','A11 C/A','A11 Aro','A11 S/H',
      'A12 C/A','A12 Aro','A12 C/H',
      'A13 C/A','A13 16','A127 S/A','Galaxy A13',
      'A14 S/A','A14 C/A','A14 S/H',
      'A15 Ori S/H','A15 Ori S/A','A15 OLED C/A','A15 Ori C/A','A15 W/Frame',
      'A16 OLED C/A','A16 4G In','A17 W/F',
      'A20 Ori S/A','A20 OLED','A20 Inc','A20 Zinc',
      'A20S S/A','A20S 15/16 In','A20S VEZR','A205 S/A','A203 S/A',
      'A21S S/A','A21 4G',
      'A22 5G C/A','A22 4G W/F','A22 4G C/A Golden',
      'A23 S/A','A23 S/H',
      'A24 Gold','A24 Ori S/A','A24C S/A',
      'A25 5G C/A Ori','A25 Ori S/A','A25 W/Frame','A25 W/F',
      'A26 A55 Ori C/A','A26 Ori PLC',
      'A30 OLED','A30 C/A OLED','A30 Ori C/A','A30S Ori C/A','A30 / A50','A31',
      'A32 / S20 Fe','A32 / A72',
      'A33 C/A Ori','A33 / A53',
      'A34 4G/5G OLED Golden','A34 / A54',
      'A35 Inc','A35 Ori','A36/56 OLED S/A',
      'A51 OLED C/A',
      'A52 God Edition','A52 Gold','A52S OLED','Ori A52 / A52 C/A',
      'A53 Ori Avo','A53 Ori C/A','A53 5G OLED',
      'A54 OLED','A54 OLED S/A','A54 W/F','A54 Ori S/A',
      'A55 / A56 A36 Ori S/A',
      'A71 OLED C/A','A72 OLED 4G/5G Golden C/A',
      'A70 C/A PLC','A70 Golden','A70 Big',
      'M52 Ori','P36 Big Ori C/A',
    ],
    'Serie S / Note': [
      'Note 10','Note 10 Plus',
      'S9 Plus Inc C/A','S10 Plus Incel','S10 Plus','S10 In C/A',
      'S20 Fe Gold','S20 Fe Golden','S20 Ultra Golden','S20 Ultra',
      'S21 Fe','S21 Fe OLED N','S21 Fe OLED C/A','S21 Fe W/F','S21 Normal','S21 Ultra Ori','S21U Golden',
      'S22 Ultra W/F','S22 Plus','S22U Golden',
      'S23 Ultra OLED','S23 Ultra Ol C/A','S23 Ultra Golden','S23 Fe Gol','S23 Fe A/o','S23 P Golden C/A','S23 P Golden',
      'S24 Plus W/F','S24 Ul Golden','S24 Fe W/F',
    ],
    'Serie J': [
      'J4 Ori N','J4 Ori D',
      'J7 Pro Ori','J7 Pro 1S','J7 Pro In','J7 Pro D',
      'J710 Ori V','J710 Ori B',
      'J2 Kia Ori','J416 Plus In','J56 Plus In',
      'J5 Pro N','J510 OLED','J510 Ori',
    ],
  },
  'PANTALLAS – iPHONE': {
    'Serie 7 / 8': ['iPhone 7G N','iPhone 7 N','iPhone 7P Golden N','iPhone 7P Black','iPhone 7P N','iPhone 7P 86 B/N','iPhone 8P Golden N','iPhone 8P Got-B'],
    'Serie X': ['iPhone X In','iPhone X OLED','iPhone XS','iPhone XS V','iPhone XS 8','iPhone XS FHD','iPhone XR','iPhone XS Max','iPhone XS Max V'],
    'Serie 11': ['iPhone 11 Inc','iPhone 11','iPhone 11 Pro','iPhone 11 Pro Golden','iPhone 11 Pro OLED','iPhone 11 Pro Golden Dom','X11'],
    'Serie 12': ['iPhone 12 Ori','iPhone 12 Mini Ori','iPhone 12 Pro Ori','iPhone 12/12 Pro In','iPhone 12 Pro Max Golden','iPhone 12 PM In','iPhone 12 PM Ori','iPhone 12 Pro Max Diag','iPhone 12 PM','iPhone 12 PM Dia','iPhone 12 Pro JCID Dia'],
    'Serie 13': ['iPhone 13 Mini','iPhone 13 In','iPhone 13 OLED Gold','iPhone 13 OLED','iPhone 13 Ori','iPhone 13 Pro Gold','iPhone 13 Pro In','iPhone 13 Pro Ori','iPhone 13 PM Golden','iPhone 13 Pro Max','iPhone 13 Pro OLED','iPhone 13 PM Global','iPhone 13 Pro Max OLED','iPhone 13 PM Ori','iPhone 13 PM Incel','iPhone 13 Pro JCID Diag','iPhone 13 Pro D','iPhone 13 PM'],
    'Serie 14': ['iPhone 14 OLED','iPhone 14 Pro Diag','iPhone 14 Pro Incel','iPhone 14 PM Ori','iPhone 14 PM OLED','iPhone 14 PM','iPhone 14 Pro','iPhone 14 Dia','iPhone 14 PM Dia','iPhone 14 PM 128GB 65%','iPhone 14 PM 128GB 84%','iPhone 14M 128GB 46%','iPhone 14 128GB 91%','iPhone 14 Pro Ori'],
    'Serie 15': ['iPhone 15 PM OLED','iPhone 15 PM Global','iPhone 15 Pro Max Incel','iPhone 15 128GB 85%','iPhone 15 124GB 95%','iPhone 15 PM','iPhone 15 Pro','iPhone 15 Pro Max','iPhone 15 Dia'],
    'Serie 16': ['iPhone 16 Ori Gold','iPhone 16 Pro','iPhone 16 Dia'],
    'Con % batería': ['iPhone 13 PM 128GB 85%','iPhone 13 Pro 128GB','iPhone 13 Pro 128GB 100%','iPhone 13 Pro 256GB 40%','iPhone 13 Pro Max 512GB 100%','iPhone 13 Pro Max 512GB 84%','iPhone 13 Pro Max 512GB 94%','iPhone 13 Pro Max 256GB 94%','iPhone 13 Pro 512GB 84%','iPhone 13 256GB 100%','iPhone 13 PM 256GB 93%','iPhone 12 PM 256GB 93%','iPhone 12 PM 256GB 44%','iPhone 11 Pro 64GB 87%','iPhone 11 Pro 256GB 100%'],
  },
  'PANTALLAS – XIAOMI / REDMI': {
    'Poco': ['Poco M3','Poco M3 W/F','Poco X3','Poco X3 Gold','Poco X6 Pro','Poco 12/13'],
    'Redmi Note': [
      'Redmi Note 7 Aro','Redmi Note 8 W/F','Redmi N8 Pro C/A','Redmi 8 Pro S/A',
      'Redmi Note 9S Original','Redmi Note 9S W/F','Redmi Note 9S S4','Redmi Note 9S S/A','Redmi Note 9S Pro','Redmi Note 9 Sh','Redmi Note S1S',
      'Redmi Note 10 4G OLED S/A','Redmi Note 10 Ori CA','Redmi Note 10 Ori SA','Redmi Note 10 / N10S','Redmi N10 Ori BA','Redmi N10S Ori',
      'Redmi Note 10 Pro 4G OLED S/A','Redmi Note 10 Pro 4G Oled',
      'Redmi Note 11 Ori S/A','Redmi Note 11 OLED 4G S/A','Redmi Note 11, 11S, 12S Ori',
      'Redmi Note 12 In C/A','Redmi Note 12 In Aro','Redmi N12 601 Ori',
      'Redmi Note 12 Pro 5G Ori','Redmi Note 12 Pro Ori 5G',
      'Redmi Note 13 Pro Ori','Redmi Note 13 Pro 4G OLED','Redmi Note 13 Pro 5G','Redmi Note 13 M S/A','Redmi Note 13 Ori S/A',
      'Redmi Note 14 Pro 4G OLED','Redmi Note 14 Pro 5G OLED','Redmi Note 14 / N7 Pro',
    ],
    'Redmi': ['Redmi 9 C/A (VEZR)','Redmi RM9','Redmi 10C C/A','Redmi 10C Aro','Redmi 10C','Redmi 12C S/A','Redmi 13C S/A','Redmi 13C C/A','Redmi 14C Aro','Redmi 14C C/A','Redmi 14C S/A','Redmi 15C S/A','Redmi 15C C/A','Redmi C55 S/A'],
    'Xiaomi': ['Xiaomi A1 C/A','Xiaomi A2 S/A','Xiaomi A1/A2 S/A','Xiaomi A3','Xiaomi A3 C/A','Xiaomi A5 S/A','Xiaomi A5 C/A','Xiaomi A5 5G','Xiaomi R10 5G S/A','Xiaomi 9A S/A','Xiaomi Mi 12 Pro Ori','Xiaomi 11T Pro Ori','Xiaomi 13T Pro 5G','Xiaomi 14 Pro 5G Ori','Xiaomi X4 Pro In','Xiaomi X6 Pro Ori','Xiaomi 9A Pro 65','Xiaomi Mi Note 10'],
  },
  'PANTALLAS – MOTOROLA': {
    'Serie E': ['Moto E20','Moto E22 / E22S','Moto E30','Moto E6S S/A','Moto E7L','Moto E22 22C (VEZR)','Moto E05 S/A','Moto E2 Plus'],
    'Serie G': ['Moto G15','Moto G34 Aro','Moto G42 OLED','Moto G421 OLED','Moto G54 Aro','Moto G521 / G821 M50G','Moto G60','Moto G61 Play','Moto G68 Play','Moto G68 Power','Moto G6 Power','Moto G7','Moto G7 Plus','Moto G606 / G06','Moto G84 5G (VEZR Battery)'],
    'Serie C': ['C21','C21 Plus 4G','C21Y','C55 CS3'],
  },
  'PANTALLAS – HUAWEI': {
    'Modelos': ['Huawei Y7A','Huawei Y7','Huawei Y90','Huawei Y9H','Huawei Y9A','Huawei Y9S 140','Huawei Y95 14','Huawei Nova 9SE','Huawei Smart 2021','Huawei C33','Huawei Y83','Huawei Y6S'],
  },
  'PANTALLAS – TCL': {
    'Modelos': ['TCL 203C'],
  },
  'BATERÍAS': {
    'iPhone': ['Batería iPhone 6S','Batería iPhone 6S Plus','Batería iPhone 7G','Batería iPhone 7S','Batería iPhone 8G','Batería iPhone 8 Plus (Gold Edition)','Batería iPhone Original (Gold Edition)'],
    'Samsung': ['Baterías Samsung Serie J (J2 Prime, J2 Core, J3, J5, J2)','Baterías Samsung Serie A (varios modelos)'],
    'Xiaomi / Redmi': ['VEZR Battery A3','Xiaomi Mi A3 (Maximus Gold Edition)','Poco X3','Poco X3 Gold','R10 (Redmi 10)','X3 / X3 Pro','AN5A (Redmi Note 10 5G / A07 / Note 5)','R14C','Poco C75','Poco C65','R13C','R12C / Poco C65','N11 Pro C6 / Poco X4','Redmi Note 12 Pro / XS Pro / Note 12T / Note 13 Pro / X5 Pro','N12 Pro','N12 4G','N12 46','Note 10 / Poco M5S','N13 Pro 5G','N13 12','Note 14 / N7 Pro','Note 13','Note 12','Note 11 / Note 11S','Note 11 4G','Note 13 Pro / A6 5G','N7 / N7 Pro','10A / 10C','R9 Pro','P9 Pro','Note 8','8/8A','Baterías Xiaomi Version Note (varios)','BP-46 Original Battery'],
  },
  'ACCESORIOS Y REPUESTOS': {
    'Tapas Traseras iPhone': ['Tapas iPhone 8 Plus','Tapas iPhone 8G / 6G','Tapas iPhone X / XS','Tapas iPhone XR / XS Max','Tapas iPhone 11 Normal','Tapas iPhone 11 Pro / 12 Pro','Tapas iPhone 11 Pro Max / 12 Pro Max','Tapas iPhone 12 Normal','Tapas iPhone 13 Normal','Tapas iPhone 13 Pro','Tapas iPhone 13 Pro Max','Tapas iPhone 14 Normal','Tapas iPhone 14 Pro','Tapas iPhone 14 Pro Max','Tapas iPhone 15 / 15 Pro / 15 Pro Max','Tapas iPhone 16 Normal / 16 Pro','Tapa iPhone 16 PM','Visor de Cámara iPhone'],
    'Tapas Traseras Samsung': ['Tapa Samsung A02','Tapas Samsung A02S / A03S','Tapas Samsung A03 Core / A03 Nor','Tapa Samsung A04E','Tapas Samsung A04 / A04C / A04S','Tapas Samsung A04 / A05 / A05S','Tapa Samsung A02S (grande)','Tapas Samsung A11 / A12 / A13','Tapas Samsung A14 4G / A16 4G','Tapas Samsung A14 / A15 / A16','Tapas Samsung A22 4G y 5G / A23 / A24','Tapas Samsung A30S / A31 / A32 / A33 / A34','Tapas Samsung A51 / A52 / A53 / A54 / A55 / A72','Tapas Samsung A20 / A21S / A205 / A50','Tapas Samsung A01 / A01 Core / A02','Visor de Cámara Samsung','Marco para Samsung','Tapas Samsung S10 / S10 Ultra / S21 Ultra / S22 / S22 Ultra / S23 / S24 / S24U / S11','Tapas Samsung Serie S (S20 / S20 FK / S21 / S21 FK / S22 / S23 / S24)'],
    'Tapas Traseras Xiaomi / Redmi': ['Tapas Xiaomi N10 Lite / Mi Note 10','Tapas Xiaomi N8 Normal','Tapas Xiaomi N9S / N9 Pro','Tapas Redmi R10 / R12','Tapas Redmi R10 / N10 / N10S','Tapas Redmi Miar / N11 / N10 / N12 / N12 Pro / N13 / X5 Pro / Mi N10','Tapas Redmi R12C / R13 / R13C / R14C','Tapas Xiaomi N13 / N13 Pro / N9 / X6 Pro','Tapas Xiaomi P30 Lite / P20 Lite','Tapas Xiaomi N7 / N8 Pro / N12 / N12 Pro / Mi Note 10 Pro','Flex de Carga Xiaomi (Y Serie A)','Visor de Cámara Xiaomi'],
    'Plaquitas de Carga Samsung': ['Plaquita de Carga A10 / A10S / A11 / A12 / A13 / A14 / A15','Plaquita de Carga A20 / A20S / A21S / A22 / A23 / A24 / A25 / A26','Plaquita de Carga A30 / A31 / A32 / A33 / A305','Plaquita de Carga A33 / A34 / A70 / A71 / A72','Plaquitas VEZR A24 / A15 / A31','Plaquitas VEZR A10 / A16 / A12','Plaquitas VEZR A20 / A20S / A25 / A16 / A52','Plaquita de Carga A01 / A02 / A03 / A04 / A03 Core / A05','Plaquita de Carga A50 / A51 / A52 / A53 / A54 / A55 / S20 FE / S23 Ultra','Plaquita de Carga N8/N8 Pro/N9/N9S/N10/N10 5G/N10S/N11/N11S/N12/N13/R8A/R10C/13C/Tecno 23-24','Flex de Carga A50 / A53 / A72'],
    'Repuestos iPhone': ['Cámara Frontal y Trasera iPhone 7 Plus / Samsung 8 Plus Redmi','Tower Sensor / Speaker / Face ID iPhone','Parlante Arriba iPhone 16 / 16 Pro / 16 PM / 15 / 15 PM','Flex Power / Volumen / Flash iPhone 8 Plus / 12 / 13','Flex de Flash iPhone (Spikes)','Flex de Carga iPhone X / XS / XR / XS Max','Flex de Carga iPhone 11/11 Pro/11 PM/12/12 Pro/12 PM/13/13 Pro/13 PM/14 Pro/12 Mini','Flex de Carga iPhone 6 / 6S / 7G / 7G Plus / 8G / 8 Plus','Flex de Carga iPhone VEZR (varios modelos)','Partes Originales iPhone (varios)','Cámara Trasera y Frontal iPhone 11/11 Pro/11 PM/12/12 Pro/12 PM/13/13 Pro/13 PM/14 Pro/15 PM','Cámara Frontal y Trasera iPhone X / XS / XS Max','FPC (conectores flex)','Flexboard Flash iPhone','Spare Parts iPhone 11 Pro Max Go Black'],
    'Repuestos Samsung': ['Conectores Samsung','Flex de Carga Serie A y S Samsung','Spare Parts Note 9 (Insell)','Spare Parts Samsung (B4SA2S / B4SAT / BAC1 / 10AF / 10C3 – 10 pcs)','Spare Parts (FSA50WF – 10 pcs)','Spare Parts (AC1NO / A01UA025 / A040M2 / JA04 – 10 pcs)','Spare Parts (H65RM Note 10 4G – 10 pcs)','Spare Parts (modelo OL – 10 pcs)'],
    'Carcasas': ['Carcasa para iPhone 11 / 11 Pro / 11 PM / 12 / 12 Pro / 12 PM','Carcasa para iPhone 13 / 13 Pro / 13 PM / 14 / 14 Pro / 14 PM / 15 Pro / 15 PM','Visor de Cámara Redmi (A30/A30S/A31/A32/A13/N13C/N11C)'],
    'Otros Repuestos': ['Micrófonos (varios)','Porta Chip Samsung e iPhone','Botón Huella / Flex Volumen','Conectores (varios)','Cámara Serie A Samsung','Flex de Carga Serie A Samsung'],
  },
  'VISOR OCA': {
    'Samsung': ['Samsung A20/A20S/A21S/A23/N31/A22','Samsung A70/A71/A72/A80/A20S/A4 Plus/J6','Samsung J8/J2 Core','Samsung Serie S (S10/S10 Plus/S20 FK/S20/S21/S22/S23/S24)','Samsung A10/A10S/A11/A12/A13/A14/A15/A16','Samsung 15P/16P/14/A5P/17P/15 PM/16 PM/17 PM/15 Plus/16 Plus','Samsung A01 Core/A02S/A03S/A04S/A03/A03 Core/A04/A05/A06','Samsung A30/A30S/A31/A32/A33/A34/A24','Samsung A51/A52/A53/A54/A55','Samsung J7/J7 Prime/J5/J310'],
    'iPhone': ['iPhone 8 Plus/XR/XS/11 Pro Max/12 Mini/12 Pro/13 Mini/13/13 Pro/14 PM'],
    'Xiaomi / Redmi': ['Xiaomi 10C/12C/A4/14C/A2/N10 5G/N10/N11/N12S/N13/X5 Pro/N12 Pro','Xiaomi Redmi 9A/R9/N8/N8 Pro/N9/N9S/N7/R9T'],
    'Motorola / Huawei': ['Motorola E20/G20/One Fusion/Moto G Lite/Y95/E7 Plus/Y9 19/E71/P30/P30 Lite/P40 Lite','Huawei (mismos modelos)'],
    'Frontal GE (Gold Edition)': ['Frontal GE (varios modelos – cajas de 5 unidades)','Baterías Gold Edition Frontal GE (varios modelos)'],
  },
  'CELULARES': {
    'Vitrinas': ['iPhone 16 128GB','iPhone 16 128GB 100%','iPhone 16','iPhone 16 128GB (azul)','iPhone 15 Pro 128GB (rosa)','iPhone 15 Pro (negro)','Samsung S23 FC 5G 256GB','Samsung S25 128GB','Samsung Galaxy A07 128GB','Samsung Galaxy A07 64GB','Samsung Galaxy A06'],
    'Nuevos en caja': ['Infinix HOT 60 Pro 256GB','Infinix HOT 60 Pro+ 256GB','Oukitel (modelo a verificar)','Nokia 106 4G'],
  },
  'HERRAMIENTAS': {
    'Equipos': ['TBK 850 – Destornillador eléctrico ajustable','Sunlors (pantalla completa – caja grande)'],
  },
};

// ── Importación ───────────────────────────────────────────────
async function main() {
  console.log('🚀 Iniciando importación de inventario...\n');
  let totalCats = 0, totalProds = 0, errors = 0;

  for (const [catName, subcats] of Object.entries(INV)) {
    // Insertar categoría
    const { data: cat, error: catErr } = await supabase
      .from('categories')
      .insert({ name: catName, warranty_days: 2 })
      .select('id')
      .single();

    if (catErr) {
      console.error(`✗ Categoría "${catName}": ${catErr.message}`);
      errors++;
      continue;
    }
    console.log(`✓ Categoría: ${catName}`);
    totalCats++;

    // Armar lista de productos de todas las subcategorías
    const products = [];
    for (const items of Object.values(subcats)) {
      for (const item of items) {
        const model = clean(item);
        if (model) {
          products.push({
            model,
            category_id: cat.id,
            quantity: 0,
            purchased_quantity: 0,
            cost_price: 0,
            sale_price: 0,
          });
        }
      }
    }

    // Insertar en lotes de 50
    for (let i = 0; i < products.length; i += 50) {
      const batch = products.slice(i, i + 50);
      const { error: prodErr } = await supabase.from('products').insert(batch);
      if (prodErr) {
        console.error(`  ✗ Error insertando productos: ${prodErr.message}`);
        errors++;
      } else {
        totalProds += batch.length;
      }
    }
    console.log(`  → ${products.length} productos insertados\n`);
  }

  console.log('─'.repeat(40));
  console.log(`✅ Finalizado: ${totalCats} categorías, ${totalProds} productos`);
  if (errors) console.log(`⚠️  ${errors} errores — revisá los mensajes de arriba`);
}

main().catch(err => { console.error('Error fatal:', err); process.exit(1); });
