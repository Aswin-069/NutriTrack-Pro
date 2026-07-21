import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const AUDIT_ITEMS = [
  // Staples
  { name: 'Basmati Rice', keywords: ['basmati', 'rice'] },
  { name: 'Wheat Flour / Atta', keywords: ['atta', 'wheat flour'] },
  { name: 'Ragi (Finger Millet)', keywords: ['ragi', 'finger millet'] },
  { name: 'Jowar (Sorghum)', keywords: ['jowar', 'sorghum'] },
  { name: 'Bajra (Pearl Millet)', keywords: ['bajra', 'pearl millet'] },
  
  // Dals & Legumes
  { name: 'Toor Dal (Pigeon Peas)', keywords: ['toor', 'pigeon pea', 'arhar'] },
  { name: 'Moong Dal (Green Gram)', keywords: ['moong', 'green gram'] },
  { name: 'Chana Dal (Split Chickpea)', keywords: ['chana dal', 'split chickpea'] },
  { name: 'Urad Dal (Black Gram)', keywords: ['urad', 'black gram'] },
  { name: 'Masoor Dal (Red Lentil)', keywords: ['masoor', 'red lentil'] },
  { name: 'Rajma (Kidney Beans)', keywords: ['rajma', 'kidney bean'] },
  { name: 'Chole (Chickpeas)', keywords: ['chole', 'chickpea', 'garbanzo'] },
  
  // Dairy
  { name: 'Paneer', keywords: ['paneer', 'cottage cheese indian'] },
  { name: 'Ghee', keywords: ['ghee', 'clarified butter'] },
  { name: 'Curd / Dahi', keywords: ['curd', 'dahi', 'yogurt'] },
  { name: 'Buttermilk / Chaas', keywords: ['buttermilk', 'chaas'] },

  // Breads
  { name: 'Roti / Chapati', keywords: ['roti', 'chapati'] },
  { name: 'Naan', keywords: ['naan'] },
  { name: 'Paratha', keywords: ['paratha'] },
  { name: 'Poori', keywords: ['poori', 'puri'] },
  { name: 'Dosa', keywords: ['dosa'] },
  { name: 'Idli', keywords: ['idli'] },
  { name: 'Uttapam', keywords: ['uttapam'] },

  // Snacks & Street Food
  { name: 'Namkeen / Sev', keywords: ['namkeen', 'sev', 'chivda'] },
  { name: 'Samosa', keywords: ['samosa'] },
  { name: 'Pakora / Bhaji', keywords: ['pakora', 'bhaji'] },
  { name: 'Pav Bhaji', keywords: ['pav bhaji'] },
  { name: 'Vada Pav', keywords: ['vada pav'] },
  { name: 'Dhokla', keywords: ['dhokla'] },

  // Sweets
  { name: 'Gulab Jamun', keywords: ['gulab jamun'] },
  { name: 'Rasgulla', keywords: ['rasgulla'] },
  { name: 'Ladoo', keywords: ['ladoo', 'laddu'] },
  { name: 'Halwa', keywords: ['halwa'] },
  { name: 'Kheer', keywords: ['kheer', 'payasam'] },

  // Regional Dishes
  { name: 'Dal Makhani', keywords: ['dal makhani', 'makhani'] },
  { name: 'Dal Tadka / Fry', keywords: ['dal tadka', 'dal fry'] },
  { name: 'Sambar', keywords: ['sambar', 'sambhar'] },
  { name: 'Rasam', keywords: ['rasam'] },
  { name: 'Poha', keywords: ['poha'] },
  { name: 'Upma', keywords: ['upma'] },
  { name: 'Biryani', keywords: ['biryani'] },
  { name: 'Palak Paneer', keywords: ['palak paneer'] },

  // Branded / Packaged
  { name: "Haldiram's", keywords: ['haldiram'] },
  { name: 'MTR', keywords: ['mtr'] },
  { name: 'Amul', keywords: ['amul'] },
  { name: 'Britannia', keywords: ['britannia'] },
  { name: 'Patanjali', keywords: ['patanjali'] },

  // Soya Chunks
  { name: 'Soya Chunks / Nutrela / TVP', keywords: ['soya chunk', 'soy chunk', 'meal maker', 'nutrela', 'textured vegetable protein', 'tvp'] }
];

async function main() {
  console.log('\n🔍 RUNNING GAP AUDIT ON CURRENT FOOD DB...');
  const allFoods = await prisma.food.findMany({
    select: { name: true, sourceType: true }
  });

  console.log(`Total foods in DB: ${allFoods.length}`);

  const results = [];
  for (const item of AUDIT_ITEMS) {
    // Check if any food in allFoods contains any keyword
    const matches = allFoods.filter(f => {
      const nameLower = f.name.toLowerCase();
      return item.keywords.some(kw => nameLower.includes(kw));
    });

    const present = matches.length > 0;
    results.push({
      name: item.name,
      present,
      matchCount: matches.length,
      sampleMatches: matches.slice(0, 3).map(m => `${m.name} (${m.sourceType})`)
    });
  }

  console.log('\n📋 AUDIT RESULTS:');
  console.log('------------------------------------------------------------');
  for (const r of results) {
    const statusSymbol = r.present ? '✅ PRESENT' : '❌ MISSING';
    console.log(`${statusSymbol.padEnd(10)} | ${r.name.padEnd(30)} | Matches: ${r.matchCount}`);
    if (r.present) {
      console.log(`           Sample: ${r.sampleMatches.join(', ')}`);
    }
  }
  console.log('------------------------------------------------------------');

  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
