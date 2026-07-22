/**
 * seedFoods.js — One-shot food database seeder
 *
 * Sources:
 *   1. USDA FoodData Central (FDC) — Foundation, SR Legacy, FNDDS data types
 *   2. Open Food Facts (OFF) — global branded / Indian packaged foods
 *
 * Usage:
 *   node scripts/seedFoods.js
 *
 * Requires:
 *   FDC_API_KEY in backend/.env
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const FDC_API_KEY = process.env.FDC_API_KEY;
const FDC_BASE = 'https://api.nal.usda.gov/fdc/v1';
const OFF_BASE = 'https://world.openfoodfacts.org';

if (!FDC_API_KEY) {
  console.error('\n❌ FDC_API_KEY is not set in your .env file.');
  console.error('   1. Sign up at: https://fdc.nal.usda.gov/api-key-signup');
  console.error('   2. Add to backend/.env: FDC_API_KEY=your_key_here');
  console.error('   3. Re-run: node scripts/seedFoods.js\n');
  process.exit(1);
}

// ─── Sleep helper ─────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─── Stats counters ───────────────────────────────────────────────────────────
let fdcInserted = 0;
let offInserted = 0;
let skipped = 0;
let errors = 0;

// ─── FDC search terms — short reliable terms (1-2 words work best) ──────────
const FDC_SEARCH_TERMS = [
  // === GRAINS & STAPLES ===
  { term: 'basmati', category: 'Grains & Staples' },
  { term: 'brown rice', category: 'Grains & Staples' },
  { term: 'white rice', category: 'Grains & Staples' },
  { term: 'oats', category: 'Grains & Staples' },
  { term: 'chapati', category: 'Grains & Staples' },
  { term: 'roti', category: 'Grains & Staples' },
  { term: 'noodles', category: 'Grains & Staples' },
  { term: 'quinoa', category: 'Grains & Staples' },
  { term: 'millet', category: 'Grains & Staples' },
  { term: 'bajra', category: 'Grains & Staples' },
  { term: 'jowar', category: 'Grains & Staples' },
  { term: 'semolina', category: 'Grains & Staples' },
  { term: 'poha', category: 'Grains & Staples' },
  { term: 'cornmeal', category: 'Grains & Staples' },
  { term: 'barley', category: 'Grains & Staples' },
  { term: 'buckwheat', category: 'Grains & Staples' },
  { term: 'tortilla', category: 'Grains & Staples' },
  { term: 'pasta', category: 'Grains & Staples' },
  { term: 'spaghetti', category: 'Grains & Staples' },
  { term: 'bread', category: 'Grains & Staples' },
  { term: 'pita', category: 'Grains & Staples' },
  { term: 'idli', category: 'Indian Foods' },
  { term: 'dosa', category: 'Indian Foods' },
  { term: 'upma', category: 'Indian Foods' },
  { term: 'vermicelli', category: 'Grains & Staples' },
  { term: 'maize', category: 'Grains & Staples' },
  { term: 'wheat', category: 'Grains & Staples' },

  // === ANIMAL PROTEINS ===
  { term: 'chicken breast', category: 'Proteins - Animal' },
  { term: 'chicken thigh', category: 'Proteins - Animal' },
  { term: 'chicken leg', category: 'Proteins - Animal' },
  { term: 'turkey', category: 'Proteins - Animal' },
  { term: 'egg', category: 'Proteins - Animal' },
  { term: 'salmon', category: 'Proteins - Animal' },
  { term: 'tuna', category: 'Proteins - Animal' },
  { term: 'tilapia', category: 'Proteins - Animal' },
  { term: 'codfish', category: 'Proteins - Animal' },
  { term: 'mackerel', category: 'Proteins - Animal' },
  { term: 'sardine', category: 'Proteins - Animal' },
  { term: 'shrimp', category: 'Proteins - Animal' },
  { term: 'beef', category: 'Proteins - Animal' },
  { term: 'lamb', category: 'Proteins - Animal' },
  { term: 'pork', category: 'Proteins - Animal' },
  { term: 'rohu', category: 'Proteins - Animal' },
  { term: 'catfish', category: 'Proteins - Animal' },

  // === PLANT PROTEINS ===
  { term: 'paneer', category: 'Proteins - Plant' },
  { term: 'tofu', category: 'Proteins - Plant' },
  { term: 'tempeh', category: 'Proteins - Plant' },
  { term: 'lentils', category: 'Proteins - Plant' },
  { term: 'chickpeas', category: 'Proteins - Plant' },
  { term: 'rajma', category: 'Proteins - Plant' },
  { term: 'edamame', category: 'Proteins - Plant' },
  { term: 'moong', category: 'Proteins - Plant' },
  { term: 'dal', category: 'Proteins - Plant' },
  { term: 'soybean', category: 'Proteins - Plant' },
  { term: 'peas', category: 'Proteins - Plant' },

  // === SUPPLEMENTS ===
  { term: 'whey', category: 'Supplements' },
  { term: 'casein', category: 'Supplements' },
  { term: 'creatine', category: 'Supplements' },
  { term: 'protein bar', category: 'Supplements' },

  // === DAIRY ===
  { term: 'milk', category: 'Dairy' },
  { term: 'yogurt', category: 'Dairy' },
  { term: 'curd', category: 'Dairy' },
  { term: 'cheese', category: 'Dairy' },
  { term: 'ghee', category: 'Dairy' },
  { term: 'butter', category: 'Dairy' },
  { term: 'cream', category: 'Dairy' },
  { term: 'buttermilk', category: 'Dairy' },
  { term: 'kefir', category: 'Dairy' },

  // === FRUITS ===
  { term: 'banana', category: 'Fruits' },
  { term: 'apple', category: 'Fruits' },
  { term: 'mango', category: 'Fruits' },
  { term: 'orange', category: 'Fruits' },
  { term: 'papaya', category: 'Fruits' },
  { term: 'watermelon', category: 'Fruits' },
  { term: 'grapes', category: 'Fruits' },
  { term: 'pomegranate', category: 'Fruits' },
  { term: 'guava', category: 'Fruits' },
  { term: 'pineapple', category: 'Fruits' },
  { term: 'strawberry', category: 'Fruits' },
  { term: 'blueberry', category: 'Fruits' },
  { term: 'kiwi', category: 'Fruits' },
  { term: 'avocado', category: 'Fruits' },
  { term: 'pear', category: 'Fruits' },
  { term: 'peach', category: 'Fruits' },
  { term: 'plum', category: 'Fruits' },
  { term: 'fig', category: 'Fruits' },
  { term: 'dates', category: 'Fruits' },
  { term: 'raisins', category: 'Fruits' },
  { term: 'lychee', category: 'Fruits' },
  { term: 'jackfruit', category: 'Fruits' },
  { term: 'coconut', category: 'Fruits' },
  { term: 'sapodilla', category: 'Fruits' },

  // === VEGETABLES ===
  { term: 'spinach', category: 'Vegetables' },
  { term: 'kale', category: 'Vegetables' },
  { term: 'broccoli', category: 'Vegetables' },
  { term: 'cauliflower', category: 'Vegetables' },
  { term: 'cabbage', category: 'Vegetables' },
  { term: 'tomato', category: 'Vegetables' },
  { term: 'onion', category: 'Vegetables' },
  { term: 'garlic', category: 'Vegetables' },
  { term: 'ginger', category: 'Vegetables' },
  { term: 'potato', category: 'Vegetables' },
  { term: 'carrot', category: 'Vegetables' },
  { term: 'cucumber', category: 'Vegetables' },
  { term: 'capsicum', category: 'Vegetables' },
  { term: 'okra', category: 'Vegetables' },
  { term: 'eggplant', category: 'Vegetables' },
  { term: 'zucchini', category: 'Vegetables' },
  { term: 'mushroom', category: 'Vegetables' },
  { term: 'beetroot', category: 'Vegetables' },
  { term: 'radish', category: 'Vegetables' },
  { term: 'pumpkin', category: 'Vegetables' },
  { term: 'karela', category: 'Vegetables' },
  { term: 'lauki', category: 'Vegetables' },
  { term: 'moringa', category: 'Vegetables' },
  { term: 'fenugreek', category: 'Vegetables' },
  { term: 'coriander', category: 'Vegetables' },
  { term: 'celery', category: 'Vegetables' },
  { term: 'asparagus', category: 'Vegetables' },

  // === NUTS & SEEDS ===
  { term: 'almonds', category: 'Nuts & Seeds' },
  { term: 'walnuts', category: 'Nuts & Seeds' },
  { term: 'cashews', category: 'Nuts & Seeds' },
  { term: 'peanuts', category: 'Nuts & Seeds' },
  { term: 'pistachio', category: 'Nuts & Seeds' },
  { term: 'flaxseed', category: 'Nuts & Seeds' },
  { term: 'chia', category: 'Nuts & Seeds' },
  { term: 'sunflower seeds', category: 'Nuts & Seeds' },
  { term: 'sesame', category: 'Nuts & Seeds' },
  { term: 'hemp seeds', category: 'Nuts & Seeds' },
  { term: 'tahini', category: 'Nuts & Seeds' },
  { term: 'peanut butter', category: 'Nuts & Seeds' },
  { term: 'almond butter', category: 'Nuts & Seeds' },

  // === OILS & FATS ===
  { term: 'olive oil', category: 'Oils & Fats' },
  { term: 'coconut oil', category: 'Oils & Fats' },
  { term: 'mustard oil', category: 'Oils & Fats' },
  { term: 'canola oil', category: 'Oils & Fats' },

  // === BEVERAGES ===
  { term: 'tea', category: 'Beverages' },
  { term: 'coffee', category: 'Beverages' },
  { term: 'coconut water', category: 'Beverages' },

  // === INDIAN DISHES ===
  { term: 'biryani', category: 'Indian Foods' },
  { term: 'sambar', category: 'Indian Foods' },
  { term: 'khichdi', category: 'Indian Foods' },
  { term: 'rasam', category: 'Indian Foods' },
  { term: 'pongal', category: 'Indian Foods' },
  { term: 'uttapam', category: 'Indian Foods' },
  { term: 'paratha', category: 'Indian Foods' },
  { term: 'halwa', category: 'Indian Foods' },
  { term: 'korma', category: 'Indian Foods' },
  { term: 'tikka', category: 'Indian Foods' },
  { term: 'saag', category: 'Indian Foods' },
  { term: 'kadhi', category: 'Indian Foods' },
  { term: 'kheer', category: 'Indian Foods' },
];

// ─── Open Food Facts terms (for Indian branded/packaged foods) ─────────────
const OFF_SEARCH_TERMS = [
  { term: 'idli mix', category: 'Indian Foods' },
  { term: 'dosa batter', category: 'Indian Foods' },
  { term: 'chappati roti', category: 'Indian Foods' },
  { term: 'poha', category: 'Indian Foods' },
  { term: 'upma mix', category: 'Indian Foods' },
  { term: 'paratha', category: 'Indian Foods' },
  { term: 'aloo paratha', category: 'Indian Foods' },
  { term: 'paneer', category: 'Dairy' },
  { term: 'amul butter', category: 'Dairy' },
  { term: 'amul milk', category: 'Dairy' },
  { term: 'greek yogurt', category: 'Dairy' },
  { term: 'protein bar india', category: 'Supplements' },
  { term: 'whey protein india', category: 'Supplements' },
  { term: 'muesli india', category: 'Grains & Staples' },
  { term: 'peanut butter india', category: 'Nuts & Seeds' },
  { term: 'marie biscuit', category: 'Snacks' },
  { term: 'digestive biscuit', category: 'Snacks' },
  { term: 'fox nuts makhana', category: 'Snacks' },
  { term: 'chana roasted', category: 'Snacks' },
  { term: 'trail mix nuts', category: 'Nuts & Seeds' },
  { term: 'soymilk', category: 'Dairy' },
  { term: 'oat milk', category: 'Dairy' },
  { term: 'almond milk', category: 'Dairy' },
  { term: 'sambar powder', category: 'Indian Foods' },
  { term: 'rasam powder', category: 'Indian Foods' },
];

// ─── FDC nutrient parser ───────────────────────────────────────────────────
function parseFDCFood(food, category) {
  const n = food.foodNutrients || [];

  // Nutrient IDs: 1008=Energy kcal, 1003=Protein, 1005=Carbs, 1004=Fat, 1079=Fiber
  const byId = (id) => n.find((x) => x.nutrientId === id)?.value || 0;
  // Also match by name fragment for search results format
  const byName = (frag) =>
    n.find((x) => x.nutrientName?.toLowerCase().includes(frag))?.value || 0;

  const calories = byId(1008) || byId(2047) || byName('energy') || 0;
  const protein = byId(1003) || byName('protein');
  const carbs = byId(1005) || byName('carbohydrate');
  const fat = byId(1004) || byName('lipid') || byName('fat');
  const fiber = byId(1079) || byName('fiber');

  // Skip foods with zero calories and zero macros — likely incomplete data
  if (calories === 0 && protein === 0 && carbs === 0 && fat === 0) return null;

  return {
    name: food.description?.trim() || 'Unknown',
    category: category || food.foodCategory || null,
    servingSize: 100,
    servingUnit: 'g',
    calories: Math.round(calories * 10) / 10,
    protein: Math.round(protein * 10) / 10,
    carbs: Math.round(carbs * 10) / 10,
    fat: Math.round(fat * 10) / 10,
    fiber: Math.round(fiber * 10) / 10,
    sourceType: 'FDC',
    sourceId: String(food.fdcId),
  };
}

// ─── OFF nutrient parser ───────────────────────────────────────────────────
function parseOFFProduct(product, category) {
  const n = product.nutriments || {};
  const name = (product.product_name || product.product_name_en || '').trim();
  if (!name) return null;

  const calories = n['energy-kcal_100g'] || n['energy-kcal'] || 0;
  const protein = n['proteins_100g'] || n['proteins'] || 0;
  const carbs = n['carbohydrates_100g'] || n['carbohydrates'] || 0;
  const fat = n['fat_100g'] || n['fat'] || 0;
  const fiber = n['fiber_100g'] || n['fiber'] || 0;

  if (calories === 0 && protein === 0 && carbs === 0 && fat === 0) return null;

  return {
    name,
    category: category || null,
    servingSize: 100,
    servingUnit: 'g',
    calories: Math.round(calories * 10) / 10,
    protein: Math.round(protein * 10) / 10,
    carbs: Math.round(carbs * 10) / 10,
    fat: Math.round(fat * 10) / 10,
    fiber: Math.round(fiber * 10) / 10,
    sourceType: 'OFF',
    sourceId: product.id || product.code || String(Date.now()),
  };
}

// ─── Upsert a food into DB ─────────────────────────────────────────────────
async function upsertFood(food) {
  try {
    const existing = await prisma.food.findUnique({
      where: { sourceType_sourceId: { sourceType: food.sourceType, sourceId: food.sourceId } },
    });
    if (existing) {
      skipped++;
      return;
    }
    await prisma.food.create({ data: food });
    if (food.sourceType === 'FDC') fdcInserted++;
    else offInserted++;
  } catch (err) {
    if (!err.message.includes('Unique constraint')) {
      console.error(`  ⚠ Insert failed for "${food.name}": ${err.message}`);
      errors++;
    } else {
      skipped++;
    }
  }
}

// ─── Seed from FDC ─────────────────────────────────────────────────────────
async function seedFromFDC() {
  console.log('\n━━━ Phase 1: USDA FoodData Central ━━━');

  for (let i = 0; i < FDC_SEARCH_TERMS.length; i++) {
    const { term, category } = FDC_SEARCH_TERMS[i];
    process.stdout.write(`  [${i + 1}/${FDC_SEARCH_TERMS.length}] Searching: "${term}" ... `);

    try {
      const url =
        `${FDC_BASE}/foods/search` +
        `?query=${encodeURIComponent(term)}` +
        `&pageSize=30` +
        `&api_key=${FDC_API_KEY}`;

      const res = await fetch(url);

      if (res.status === 429) {
        console.log('⏱ Rate limited — waiting 60s...');
        await sleep(60000);
        i--; // retry same term
        continue;
      }

      if (!res.ok) {
        console.log(`✗ HTTP ${res.status}`);
        errors++;
        await sleep(400);
        continue;
      }

      const data = await res.json();
      const foods = data.foods || [];
      let batch = 0;

      for (const food of foods) {
        const parsed = parseFDCFood(food, category);
        if (parsed) {
          await upsertFood(parsed);
          batch++;
        }
      }

      console.log(`✓ ${batch} foods`);
    } catch (err) {
      console.log(`✗ Error: ${err.message}`);
      errors++;
    }

    // Respectful rate limiting: 350ms between requests (~2.8 req/s, well under 1000/hr)
    await sleep(350);
  }
}

// ─── Seed from Open Food Facts ─────────────────────────────────────────────
async function seedFromOFF() {
  console.log('\n━━━ Phase 2: Open Food Facts ━━━');

  for (let i = 0; i < OFF_SEARCH_TERMS.length; i++) {
    const { term, category } = OFF_SEARCH_TERMS[i];
    process.stdout.write(`  [${i + 1}/${OFF_SEARCH_TERMS.length}] Searching: "${term}" ... `);

    try {
      const url =
        `${OFF_BASE}/cgi/search.pl` +
        `?search_terms=${encodeURIComponent(term)}` +
        `&json=1&page_size=20` +
        `&fields=id,code,product_name,product_name_en,nutriments,categories_tags`;

      const res = await fetch(url, {
        headers: { 'User-Agent': 'FitnessTracker/1.0 (food database seeder)' },
      });

      if (!res.ok) {
        console.log(`✗ HTTP ${res.status}`);
        errors++;
        await sleep(500);
        continue;
      }

      const data = await res.json();
      const products = data.products || [];
      let batch = 0;

      for (const product of products) {
        const parsed = parseOFFProduct(product, category);
        if (parsed) {
          await upsertFood(parsed);
          batch++;
        }
      }

      console.log(`✓ ${batch} foods`);
    } catch (err) {
      console.log(`✗ Error: ${err.message}`);
      errors++;
    }

    await sleep(500); // OFF is free but be polite
  }
}

// ─── Install pg_trgm and create GIN index ─────────────────────────────────
async function setupSearchIndex() {
  console.log('\n━━━ Setting up trigram search index ━━━');
  try {
    await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
    console.log('  ✓ pg_trgm extension enabled');
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS foods_name_trgm_idx ON "Food" USING GIN (name gin_trgm_ops)`
    );
    console.log('  ✓ GIN trigram index created on Food.name');
  } catch (err) {
    console.warn(`  ⚠ Index setup warning (may already exist): ${err.message}`);
  }
}

// ─── Main ──────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║   Fitness Tracker — Food DB Seeder     ║');
  console.log('╚════════════════════════════════════════╝');
  console.log(`  Sources: USDA FoodData Central + Open Food Facts`);
  console.log(`  Terms:   ${FDC_SEARCH_TERMS.length} FDC + ${OFF_SEARCH_TERMS.length} OFF`);
  console.log(`  Est. time: 5–10 minutes\n`);

  const startCount = await prisma.food.count();
  console.log(`  Foods in DB before seeding: ${startCount}`);

  await setupSearchIndex();
  await seedFromFDC();
  await seedFromOFF();

  const endCount = await prisma.food.count();
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ Seeding complete!');
  console.log(`   FDC foods inserted : ${fdcInserted}`);
  console.log(`   OFF foods inserted : ${offInserted}`);
  console.log(`   Duplicates skipped : ${skipped}`);
  console.log(`   Errors             : ${errors}`);
  console.log(`   Total in DB now    : ${endCount}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main()
  .catch((e) => {
    console.error('\n❌ Seeder crashed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
