/**
 * seedIndianFoods.js — Comprehensive Indian Foods database seeder
 *
 * Phases:
 *   1. Open Food Facts (OFF) — Browse by Country: India (world.openfoodfacts.org/country/india)
 *   2. OFF Category Browse — indian-foods, indian-snacks, indian-sweets, indian-breads
 *   3. USDA FoodData Central (FDC) — targeted Indian search terms
 *   4. Composite Recipes — 40 classic Indian dishes with estimated macros, marked as COMPOSITE_ESTIMATED
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const FDC_API_KEY = process.env.FDC_API_KEY;
const FDC_BASE = 'https://api.nal.usda.gov/fdc/v1';
const OFF_BASE = 'https://world.openfoodfacts.org';

if (!FDC_API_KEY) {
  console.error('\n❌ FDC_API_KEY is not set in your .env file.');
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Counters
let fdcAdded = 0;
let offAdded = 0;
let compositeAdded = 0;
let duplicatesSkipped = 0;
let errorsCount = 0;

// Category tracking for final summary
const categoryCounts = {};

function incrementCategory(catName) {
  const normalized = catName || 'Other / Uncategorized';
  categoryCounts[normalized] = (categoryCounts[normalized] || 0) + 1;
}

// Helper to determine serving sizes and normalize them
function normalizeFoodEntry(name, category, cuisineRegion, servingSize, servingUnit, calories, protein, carbs, fat, fiber, sourceType, sourceId, dataQuality) {
  // Clean names
  let cleanName = name.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  
  // Ensure we don't have crazy long titles or weird symbols
  if (cleanName.length > 150) {
    cleanName = cleanName.substring(0, 147) + '...';
  }

  // Capitalize properly
  cleanName = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);

  return {
    name: cleanName,
    category: category || 'Other',
    cuisineRegion: cuisineRegion || 'Pan-Indian',
    servingSize: parseFloat(servingSize) || 100,
    servingUnit: servingUnit || 'g',
    calories: Math.max(0, Math.round(parseFloat(calories) * 10) / 10) || 0,
    protein: Math.max(0, Math.round(parseFloat(protein) * 10) / 10) || 0,
    carbs: Math.max(0, Math.round(parseFloat(carbs) * 10) / 10) || 0,
    fat: Math.max(0, Math.round(parseFloat(fat) * 10) / 10) || 0,
    fiber: Math.max(0, Math.round(parseFloat(fiber) * 10) / 10) || 0,
    sourceType,
    sourceId: String(sourceId),
    dataQuality
  };
}

// DB helper
async function saveFood(food) {
  try {
    const existing = await prisma.food.findUnique({
      where: {
        sourceType_sourceId: {
          sourceType: food.sourceType,
          sourceId: food.sourceId
        }
      }
    });

    if (existing) {
      duplicatesSkipped++;
      return;
    }

    await prisma.food.create({ data: food });
    incrementCategory(food.category);

    if (food.sourceType === 'FDC') fdcAdded++;
    else if (food.sourceType === 'OFF') offAdded++;
    else if (food.sourceType === 'COMPOSITE') compositeAdded++;
  } catch (err) {
    // Check if unique constraint error occurred
    if (err.code === 'P2002' || err.message.includes('Unique constraint')) {
      duplicatesSkipped++;
    } else {
      console.error(`  ⚠ Failed to insert "${food.name}":`, err.message);
      errorsCount++;
    }
  }
}

// Global state for OFF offline/rate-limit bypass
let offSkippedRemaining = false;
let offErrorsConsecutive = 0;

// ─── Phase 1 & 2: OFF Imports ──────────────────────────────────────────────
async function fetchOFFPage(url, cuisineRegion, customCategory) {
  if (offSkippedRemaining) return [];

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'FitAppNutritionTracker - Node - Version 1.0 - contact@fitappnutrition.org' }
    });

    if (res.status === 429 || res.status === 503) {
      console.log('⏱ Rate limited/unavailable on OFF.');
      offErrorsConsecutive++;
      if (offErrorsConsecutive >= 3) {
        console.log('\n  ⚠ Open Food Facts API is returning 503/429. Skipping remaining OFF pages to save time...\n');
        offSkippedRemaining = true;
      } else {
        await sleep(3000);
      }
      return [];
    }

    if (!res.ok) {
      console.log(`✗ HTTP ${res.status}`);
      offErrorsConsecutive++;
      if (offErrorsConsecutive >= 3) {
        offSkippedRemaining = true;
      }
      return [];
    }

    offErrorsConsecutive = 0; // reset on success
    const data = await res.json();
    const products = data.products || [];
    const parsed = [];

    for (const prod of products) {
      const nut = prod.nutriments || {};
      const name = (prod.product_name || prod.product_name_en || '').trim();
      if (!name) continue;

      // Extract details
      const cals = nut['energy-kcal_100g'] || nut['energy-kcal'] || 0;
      const prot = nut['proteins_100g'] || nut['proteins'] || 0;
      const carb = nut['carbohydrates_100g'] || nut['carbohydrates'] || 0;
      const fats = nut['fat_100g'] || nut['fat'] || 0;
      const fib = nut['fiber_100g'] || nut['fiber'] || 0;

      // Don't save empty/useless nutrition cards
      if (cals === 0 && prot === 0 && carb === 0 && fats === 0) continue;

      // Categorize
      let category = customCategory;
      if (!category) {
        // Attempt to auto-categorize based on OFF categories
        const tags = (prod.categories_tags || []).join(' ').toLowerCase();
        if (tags.includes('bread') || tags.includes('roti') || tags.includes('paratha')) {
          category = 'Indian Breads';
        } else if (tags.includes('snack') || tags.includes('chips') || tags.includes('namkeen')) {
          category = 'Indian Snacks';
        } else if (tags.includes('sweet') || tags.includes('dessert') || tags.includes('confectionery')) {
          category = 'Indian Sweets';
        } else if (tags.includes('lentil') || tags.includes('pulse') || tags.includes('dal') || tags.includes('bean')) {
          category = 'Dal & Pulses';
        } else if (tags.includes('dairy') || tags.includes('cheese') || tags.includes('paneer') || tags.includes('yogurt')) {
          category = 'Indian Dairy';
        } else if (tags.includes('rice') || tags.includes('grain')) {
          category = 'Grains & Staples';
        } else {
          category = 'Branded Indian Products';
        }
      }

      // Detect region tags if any
      let region = cuisineRegion || 'Pan-Indian';
      const nameLower = name.toLowerCase();
      if (nameLower.includes('south indian') || nameLower.includes('dosa') || nameLower.includes('idli') || nameLower.includes('sambar') || nameLower.includes('rasam')) {
        region = 'South Indian';
      } else if (nameLower.includes('punjabi') || nameLower.includes('paneer') || nameLower.includes('dal makhani') || nameLower.includes('chole')) {
        region = 'Punjabi';
      } else if (nameLower.includes('bengali') || nameLower.includes('rasgulla') || nameLower.includes('sandesh')) {
        region = 'Bengali';
      } else if (nameLower.includes('gujarati') || nameLower.includes('dhokla') || nameLower.includes('thepla') || nameLower.includes('khakhra')) {
        region = 'Gujarati';
      } else if (nameLower.includes('maharashtrian') || nameLower.includes('poha') || nameLower.includes('misal') || nameLower.includes('vada pav')) {
        region = 'Mumbai / Street Food';
      }

      const food = normalizeFoodEntry(
        name,
        category,
        region,
        100,
        'g',
        cals,
        prot,
        carb,
        fats,
        fib,
        'OFF',
        prod.id || prod.code || String(Math.random()),
        'VERIFIED_OFF'
      );
      parsed.push(food);
    }
    return parsed;
  } catch (err) {
    console.log(`✗ Error: ${err.message}`);
    errorsCount++;
    return [];
  }
}

async function seedOFFCountryIndia() {
  console.log('\n━━━ Phase 1: Open Food Facts India Country Browse ━━━');
  const totalPages = 50; 
  for (let page = 1; page <= totalPages; page++) {
    process.stdout.write(`  Browsing OFF Country India: Page [${page}/${totalPages}] ... `);
    const url = `${OFF_BASE}/country/india/${page}.json`;
    const foods = await fetchOFFPage(url, 'Pan-Indian', null);
    
    let addedCount = 0;
    for (const food of foods) {
      const before = fdcAdded + offAdded + compositeAdded;
      await saveFood(food);
      const after = fdcAdded + offAdded + compositeAdded;
      if (after > before) addedCount++;
    }
    console.log(`✓ Added ${addedCount} products`);
    await sleep(1200); // Respectful sleep to avoid 503
  }
}

async function seedOFFCategories() {
  console.log('\n━━━ Phase 2: OFF Category Browse ━━━');
  const categories = [
    { tag: 'indian-snacks', category: 'Indian Snacks' },
    { tag: 'indian-sweets', category: 'Indian Sweets' },
    { tag: 'indian-breads', category: 'Indian Breads' },
    { tag: 'paneer', category: 'Indian Dairy' }
  ];

  for (const item of categories) {
    console.log(`  Browsing Category: "${item.tag}"`);
    for (let page = 1; page <= 3; page++) {
      process.stdout.write(`    Page [${page}/3] ... `);
      const url = `${OFF_BASE}/category/${item.tag}/${page}.json`;
      const foods = await fetchOFFPage(url, 'Pan-Indian', item.category);
      
      let addedCount = 0;
      for (const food of foods) {
        const before = fdcAdded + offAdded + compositeAdded;
        await saveFood(food);
        const after = fdcAdded + offAdded + compositeAdded;
        if (after > before) addedCount++;
      }
      console.log(`✓ Added ${addedCount} products`);
      await sleep(1200);
    }
  }
}

// ─── Phase 3: FDC Indian Searches ──────────────────────────────────────────
const FDC_INDIAN_SEARCH_TERMS = [
  // Pan-Indian Staples
  { term: 'atta flour', category: 'Grains & Staples', region: 'Pan-Indian' },
  { term: 'whole wheat flour', category: 'Grains & Staples', region: 'Pan-Indian' },
  { term: 'maida flour', category: 'Grains & Staples', region: 'Pan-Indian' },
  { term: 'suji semolina', category: 'Grains & Staples', region: 'Pan-Indian' },
  { term: 'rava semolina', category: 'Grains & Staples', region: 'Pan-Indian' },
  { term: 'besan gram', category: 'Grains & Staples', region: 'Pan-Indian' },
  { term: 'chickpea flour', category: 'Grains & Staples', region: 'Pan-Indian' },
  { term: 'rice flour', category: 'Grains & Staples', region: 'Pan-Indian' },
  { term: 'sago sabudana', category: 'Grains & Staples', region: 'Pan-Indian' },
  { term: 'ragi millet', category: 'Grains & Staples', region: 'South Indian' },
  { term: 'finger millet', category: 'Grains & Staples', region: 'South Indian' },
  { term: 'jowar sorghum', category: 'Grains & Staples', region: 'Pan-Indian' },
  { term: 'sorghum flour', category: 'Grains & Staples', region: 'Pan-Indian' },
  { term: 'bajra millet', category: 'Grains & Staples', region: 'Pan-Indian' },
  { term: 'pearl millet', category: 'Grains & Staples', region: 'Pan-Indian' },

  // Dal & Legumes
  { term: 'toor dal', category: 'Dal & Pulses', region: 'Pan-Indian' },
  { term: 'arhar dal', category: 'Dal & Pulses', region: 'Pan-Indian' },
  { term: 'pigeon peas', category: 'Dal & Pulses', region: 'Pan-Indian' },
  { term: 'chana dal', category: 'Dal & Pulses', region: 'Pan-Indian' },
  { term: 'split chickpea', category: 'Dal & Pulses', region: 'Pan-Indian' },
  { term: 'urad dal', category: 'Dal & Pulses', region: 'Pan-Indian' },
  { term: 'black gram dal', category: 'Dal & Pulses', region: 'Pan-Indian' },
  { term: 'masoor dal', category: 'Dal & Pulses', region: 'Pan-Indian' },
  { term: 'red lentil dal', category: 'Dal & Pulses', region: 'Pan-Indian' },
  { term: 'moong dal', category: 'Dal & Pulses', region: 'Pan-Indian' },
  { term: 'mung bean split', category: 'Dal & Pulses', region: 'Pan-Indian' },
  { term: 'rajma red kidney', category: 'Dal & Pulses', region: 'Punjabi' },
  { term: 'chana kabuli chickpea', category: 'Dal & Pulses', region: 'Pan-Indian' },
  { term: 'garbanzo chickpea', category: 'Dal & Pulses', region: 'Pan-Indian' },
  { term: 'horsegram', category: 'Dal & Pulses', region: 'South Indian' },

  // Soya Chunks & TVP
  { term: 'soya chunks', category: 'Proteins - Plant', region: 'Pan-Indian' },
  { term: 'soy chunks', category: 'Proteins - Plant', region: 'Pan-Indian' },
  { term: 'nutrela', category: 'Proteins - Plant', region: 'Pan-Indian' },
  { term: 'textured vegetable protein', category: 'Proteins - Plant', region: 'Pan-Indian' },
  { term: 'tvp', category: 'Proteins - Plant', region: 'Pan-Indian' },
  { term: 'meal maker', category: 'Proteins - Plant', region: 'South Indian' },

  // Indian Dairy
  { term: 'paneer cheese', category: 'Indian Dairy', region: 'Pan-Indian' },
  { term: 'ghee butterfat', category: 'Indian Dairy', region: 'Pan-Indian' },
  { term: 'shrikhand', category: 'Indian Dairy', region: 'Gujarati' },
  { term: 'khoya mawa', category: 'Indian Dairy', region: 'Pan-Indian' },

  // Indian Vegetables
  { term: 'fenugreek methi', category: 'Indian Vegetables', region: 'Pan-Indian' },
  { term: 'bittergourd karela', category: 'Indian Vegetables', region: 'Pan-Indian' },
  { term: 'bottlegourd lauki', category: 'Indian Vegetables', region: 'Pan-Indian' },
  { term: 'drumstick moringa', category: 'Indian Vegetables', region: 'South Indian' },
  { term: 'colocasia arbi', category: 'Indian Vegetables', region: 'Pan-Indian' },

  // South Indian
  { term: 'idli mix', category: 'South Indian Dishes', region: 'South Indian' },
  { term: 'dosa mix', category: 'South Indian Dishes', region: 'South Indian' },
  { term: 'uttapam mix', category: 'South Indian Dishes', region: 'South Indian' },
  { term: 'sambar powder', category: 'South Indian Dishes', region: 'South Indian' },
  { term: 'rasam powder', category: 'South Indian Dishes', region: 'South Indian' },

  // Indian Breads
  { term: 'naan flatbread', category: 'Indian Breads', region: 'North Indian' },
  { term: 'roti chapati', category: 'Indian Breads', region: 'Pan-Indian' },
  { term: 'paratha', category: 'Indian Breads', region: 'North Indian' },
  { term: 'papadum poppadom', category: 'Indian Breads', region: 'Pan-Indian' },

  // Indian Snacks
  { term: 'sev snack', category: 'Indian Snacks', region: 'Pan-Indian' },
  { term: 'chivda snack', category: 'Indian Snacks', region: 'Pan-Indian' },
  { term: 'samosa', category: 'Indian Snacks', region: 'Pan-Indian' },
  { term: 'pakora fritter', category: 'Indian Snacks', region: 'Pan-Indian' },
  { term: 'bhajiya', category: 'Indian Snacks', region: 'Pan-Indian' },
  { term: 'dhokla khaman', category: 'Indian Snacks', region: 'Gujarati' },

  // Indian Sweets
  { term: 'gulab jamun', category: 'Indian Sweets', region: 'Pan-Indian' },
  { term: 'rasgulla', category: 'Indian Sweets', region: 'Bengali' },
  { term: 'barfi sweet', category: 'Indian Sweets', region: 'Pan-Indian' },
  { term: 'ladoo laddoo', category: 'Indian Sweets', region: 'Pan-Indian' },
  { term: 'halwa sweet', category: 'Indian Sweets', region: 'Pan-Indian' },
  { term: 'kheer rice pudding', category: 'Indian Sweets', region: 'Pan-Indian' },

  // Branded Searches
  { term: 'Haldiram', category: 'Branded Indian Products', region: 'Pan-Indian' },
  { term: 'MTR food', category: 'Branded Indian Products', region: 'Pan-Indian' },
  { term: 'Amul dairy', category: 'Branded Indian Products', region: 'Pan-Indian' },
  { term: 'Britannia biscuit', category: 'Branded Indian Products', region: 'Pan-Indian' },
  { term: 'Britannia digestive', category: 'Branded Indian Products', region: 'Pan-Indian' },
  { term: 'Patanjali ghee', category: 'Branded Indian Products', region: 'Pan-Indian' },
  { term: 'Patanjali biscuit', category: 'Branded Indian Products', region: 'Pan-Indian' }
];

async function seedFDCIndian() {
  console.log('\n━━━ Phase 3: USDA FoodData Central Indian Searches ━━━');
  
  for (let i = 0; i < FDC_INDIAN_SEARCH_TERMS.length; i++) {
    const { term, category, region } = FDC_INDIAN_SEARCH_TERMS[i];
    process.stdout.write(`  [${i + 1}/${FDC_INDIAN_SEARCH_TERMS.length}] FDC Search: "${term}" ... `);

    try {
      const url = `${FDC_BASE}/foods/search?query=${encodeURIComponent(term)}&pageSize=25&api_key=${FDC_API_KEY}`;
      const res = await fetch(url);

      if (res.status === 429) {
        console.log('⏱ Rate limited — sleeping 30s...');
        await sleep(30000);
        i--;
        continue;
      }

      if (!res.ok) {
        console.log(`✗ HTTP ${res.status}`);
        errorsCount++;
        await sleep(500);
        continue;
      }

      const data = await res.json();
      const foods = data.foods || [];
      let addedCount = 0;

      for (const f of foods) {
        // Parse nutrients
        const n = f.foodNutrients || [];
        const byId = (id) => n.find((x) => x.nutrientId === id)?.value || 0;
        const byName = (frag) => n.find((x) => x.nutrientName?.toLowerCase().includes(frag))?.value || 0;

        const calories = byId(1008) || byId(2047) || byName('energy') || 0;
        const protein = byId(1003) || byName('protein') || 0;
        const carbs = byId(1005) || byName('carbohydrate') || 0;
        const fat = byId(1004) || byName('lipid') || byName('fat') || 0;
        const fiber = byId(1079) || byName('fiber') || 0;

        if (calories === 0 && protein === 0 && carbs === 0 && fat === 0) continue;

        const food = normalizeFoodEntry(
          f.description,
          category,
          region,
          100,
          'g',
          calories,
          protein,
          carbs,
          fat,
          fiber,
          'FDC',
          String(f.fdcId),
          'VERIFIED_FDC'
        );

        const before = fdcAdded + offAdded + compositeAdded;
        await saveFood(food);
        const after = fdcAdded + offAdded + compositeAdded;
        if (after > before) addedCount++;
      }

      console.log(`✓ Added ${addedCount} entries`);
    } catch (err) {
      console.log(`✗ Error: ${err.message}`);
      errorsCount++;
    }

    await sleep(400); // 400ms rate compliance
  }
}

// ─── Phase 4: Composite Homestyle Recipes ──────────────────────────────────
const COMPOSITE_RECIPES = [
  // === North Indian / Punjabi ===
  { name: 'Dal Makhani (Cooked)', category: 'North Indian Dishes', cuisineRegion: 'Punjabi', calories: 130, protein: 5.0, carbs: 12.0, fat: 7.0, fiber: 4.0 },
  { name: 'Dal Tadka (Cooked)', category: 'North Indian Dishes', cuisineRegion: 'Pan-Indian', calories: 110, protein: 6.0, carbs: 15.0, fat: 3.0, fiber: 4.0 },
  { name: 'Palak Paneer (Cooked)', category: 'North Indian Dishes', cuisineRegion: 'Punjabi', calories: 140, protein: 7.0, carbs: 6.0, fat: 10.0, fiber: 2.5 },
  { name: 'Matar Paneer (Cooked)', category: 'North Indian Dishes', cuisineRegion: 'Punjabi', calories: 150, protein: 7.5, carbs: 10.0, fat: 9.0, fiber: 2.8 },
  { name: 'Sarson Ka Saag (Cooked)', category: 'North Indian Dishes', cuisineRegion: 'Punjabi', calories: 90, protein: 3.0, carbs: 6.0, fat: 6.5, fiber: 3.2 },
  { name: 'Rajma Masala (Cooked)', category: 'North Indian Dishes', cuisineRegion: 'Punjabi', calories: 120, protein: 5.5, carbs: 16.0, fat: 4.0, fiber: 5.0 },
  { name: 'Chole Masala (Cooked)', category: 'North Indian Dishes', cuisineRegion: 'Punjabi', calories: 150, protein: 6.0, carbs: 20.0, fat: 5.0, fiber: 5.5 },
  { name: 'Kadhi Pakoda (Cooked)', category: 'North Indian Dishes', cuisineRegion: 'North Indian', calories: 130, protein: 4.5, carbs: 14.0, fat: 6.5, fiber: 1.5 },
  
  // === Soya Chunks / Plant Protein ===
  { name: 'Soya Chunks (Dry / Raw)', category: 'Proteins - Plant', cuisineRegion: 'Pan-Indian', calories: 345, protein: 52.0, carbs: 33.0, fat: 0.5, fiber: 13.0 },
  { name: 'Soya Chunks (Cooked / Rehydrated)', category: 'Proteins - Plant', cuisineRegion: 'Pan-Indian', calories: 115, protein: 17.3, carbs: 11.0, fat: 0.2, fiber: 4.3 },

  // === South Indian ===
  { name: 'Sambar (Cooked)', category: 'South Indian Dishes', cuisineRegion: 'South Indian', calories: 70, protein: 3.0, carbs: 10.0, fat: 2.0, fiber: 3.0 },
  { name: 'Rasam (Cooked)', category: 'South Indian Dishes', cuisineRegion: 'South Indian', calories: 35, protein: 1.0, carbs: 5.0, fat: 1.5, fiber: 0.8 },
  { name: 'Pongal (Cooked)', category: 'South Indian Dishes', cuisineRegion: 'South Indian', calories: 180, protein: 4.5, carbs: 25.0, fat: 7.0, fiber: 2.2 },
  { name: 'Upma (Cooked)', category: 'South Indian Dishes', cuisineRegion: 'South Indian', calories: 140, protein: 3.0, carbs: 22.0, fat: 4.5, fiber: 2.0 },
  { name: 'Idli (Cooked)', category: 'South Indian Dishes', cuisineRegion: 'South Indian', calories: 120, protein: 3.5, carbs: 26.0, fat: 0.5, fiber: 1.5 },
  { name: 'Dosa (Plain, Cooked)', category: 'South Indian Dishes', cuisineRegion: 'South Indian', calories: 160, protein: 4.0, carbs: 32.0, fat: 2.0, fiber: 1.8 },
  { name: 'Uttapam (Plain, Cooked)', category: 'South Indian Dishes', cuisineRegion: 'South Indian', calories: 150, protein: 4.0, carbs: 28.0, fat: 3.0, fiber: 2.0 },
  { name: 'Medu Vada (Fried)', category: 'South Indian Dishes', cuisineRegion: 'South Indian', calories: 280, protein: 7.0, carbs: 25.0, fat: 18.0, fiber: 4.0 },
  { name: 'Avial (Cooked)', category: 'South Indian Dishes', cuisineRegion: 'South Indian', calories: 110, protein: 2.0, carbs: 8.0, fat: 8.0, fiber: 3.0 },

  // === Gujarati & Western ===
  { name: 'Thepla (Cooked)', category: 'Indian Breads', cuisineRegion: 'Gujarati', calories: 270, protein: 7.0, carbs: 42.0, fat: 8.0, fiber: 4.5 },
  { name: 'Khaman Dhokla (Steamed)', category: 'Indian Snacks', cuisineRegion: 'Gujarati', calories: 160, protein: 6.0, carbs: 24.0, fat: 4.0, fiber: 2.0 },
  { name: 'Khandvi', category: 'Indian Snacks', cuisineRegion: 'Gujarati', calories: 180, protein: 5.5, carbs: 18.0, fat: 9.5, fiber: 2.5 },

  // === Mumbai / Street Food ===
  { name: 'Pav Bhaji (Cooked, Excluding Pav)', category: 'North Indian Dishes', cuisineRegion: 'Mumbai / Street Food', calories: 110, protein: 2.5, carbs: 15.0, fat: 5.0, fiber: 3.0 },
  { name: 'Vada Pav (Standard Assembly)', category: 'Indian Snacks', cuisineRegion: 'Mumbai / Street Food', calories: 225, protein: 5.0, carbs: 32.0, fat: 8.0, fiber: 2.5 },

  // === Rice Varieties & Mains ===
  { name: 'Khichdi (Cooked)', category: 'North Indian Dishes', cuisineRegion: 'Pan-Indian', calories: 120, protein: 4.0, carbs: 20.0, fat: 3.0, fiber: 2.0 },
  { name: 'Poha (Cooked)', category: 'South Indian Dishes', cuisineRegion: 'Pan-Indian', calories: 180, protein: 3.5, carbs: 32.0, fat: 4.5, fiber: 1.8 },
  { name: 'Chicken Biryani (Cooked)', category: 'North Indian Dishes', cuisineRegion: 'Pan-Indian', calories: 160, protein: 9.0, carbs: 20.0, fat: 5.0, fiber: 1.2 },
  { name: 'Veg Biryani (Cooked)', category: 'North Indian Dishes', cuisineRegion: 'Pan-Indian', calories: 140, protein: 3.5, carbs: 22.0, fat: 4.5, fiber: 2.0 },
  { name: 'Veg Pulao (Cooked)', category: 'North Indian Dishes', cuisineRegion: 'Pan-Indian', calories: 130, protein: 3.0, carbs: 22.0, fat: 3.5, fiber: 1.8 },
  { name: 'Mutton Curry (Cooked)', category: 'North Indian Dishes', cuisineRegion: 'Pan-Indian', calories: 180, protein: 14.0, carbs: 5.0, fat: 11.0, fiber: 1.0 },
  { name: 'Chicken Curry (Cooked)', category: 'North Indian Dishes', cuisineRegion: 'Pan-Indian', calories: 150, protein: 13.0, carbs: 4.0, fat: 9.0, fiber: 0.8 },
  { name: 'Fish Curry (Coastal Cooked)', category: 'South Indian Dishes', cuisineRegion: 'South Indian', calories: 130, protein: 12.0, carbs: 5.0, fat: 7.0, fiber: 1.0 },
  { name: 'Egg Curry (Cooked)', category: 'North Indian Dishes', cuisineRegion: 'Pan-Indian', calories: 125, protein: 7.0, carbs: 5.0, fat: 8.5, fiber: 0.8 },
  
  // === Indian Breads ===
  { name: 'Roti / Chapati (Plain Wheat, 1 serving)', category: 'Indian Breads', cuisineRegion: 'Pan-Indian', calories: 290, protein: 6.0, carbs: 45.0, fat: 10.0, fiber: 4.0 },
  { name: 'Aloo Paratha (Cooked with Ghee)', category: 'Indian Breads', cuisineRegion: 'Punjabi', calories: 240, protein: 5.0, carbs: 40.0, fat: 7.0, fiber: 3.5 },
  { name: 'Poori (Deep Fried Wheat)', category: 'Indian Breads', cuisineRegion: 'Pan-Indian', calories: 320, protein: 6.5, carbs: 48.0, fat: 12.0, fiber: 4.0 },
  { name: 'Bhatura (Deep Fried, Leaven)', category: 'Indian Breads', cuisineRegion: 'Punjabi', calories: 340, protein: 7.5, carbs: 52.0, fat: 11.0, fiber: 2.5 },
  { name: 'Bajra Roti (Pearl Millet Flatbread, Cooked)', category: 'Indian Breads', cuisineRegion: 'Pan-Indian', calories: 290, protein: 7.5, carbs: 54.0, fat: 4.5, fiber: 7.5 },
  { name: 'Bajra Flour (Pearl Millet Flour, Raw)', category: 'Grains & Staples', cuisineRegion: 'Pan-Indian', calories: 378, protein: 11.0, carbs: 72.0, fat: 4.8, fiber: 8.5 },

  // === Desserts ===
  { name: 'Gulab Jamun (Cooked in Sugar Syrup)', category: 'Indian Sweets', cuisineRegion: 'Pan-Indian', calories: 320, protein: 4.0, carbs: 56.0, fat: 9.0, fiber: 0.5 },
  { name: 'Rasgulla (in Sugar Syrup)', category: 'Indian Sweets', cuisineRegion: 'Bengali', calories: 186, protein: 4.0, carbs: 40.0, fat: 1.0, fiber: 0.2 },
  { name: 'Aloo Gobi (Cooked Dry Curry)', category: 'North Indian Dishes', cuisineRegion: 'Pan-Indian', calories: 90, protein: 2.0, carbs: 11.0, fat: 4.5, fiber: 2.5 },
  { name: 'Aloo Matar (Cooked)', category: 'North Indian Dishes', cuisineRegion: 'Pan-Indian', calories: 100, protein: 2.5, carbs: 14.0, fat: 4.0, fiber: 3.0 }
];

async function seedComposite() {
  console.log('\n━━━ Phase 4: Composite / Homestyle Indian Recipes ━━━');
  let addedCount = 0;

  for (const item of COMPOSITE_RECIPES) {
    const slug = item.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const food = normalizeFoodEntry(
      item.name,
      item.category,
      item.cuisineRegion,
      100,
      'g',
      item.calories,
      item.protein,
      item.carbs,
      item.fat,
      item.fiber,
      'COMPOSITE',
      slug,
      'COMPOSITE_ESTIMATED'
    );

    const before = fdcAdded + offAdded + compositeAdded;
    await saveFood(food);
    const after = fdcAdded + offAdded + compositeAdded;
    if (after > before) addedCount++;
  }

  console.log(`✓ Added ${addedCount} composite recipe entries`);
}

// ─── Main Seeder Sequence ──────────────────────────────────────────────────
async function main() {
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║   Fitness Tracker — Indian Food Seeder ║');
  console.log('╚════════════════════════════════════════╝');
  console.log('  Targeting comprehensive coverage of Indian foods & brands');
  console.log('  Database: PostgreSQL via Prisma Client\n');

  const beforeCount = await prisma.food.count();
  console.log(`  Total foods in DB before seeding: ${beforeCount}`);

  // 1. OFF country scan
  await seedOFFCountryIndia();

  // 2. OFF Categories
  await seedOFFCategories();

  // 3. FDC specific search lists
  await seedFDCIndian();

  // 4. Recipe composites
  await seedComposite();

  const afterCount = await prisma.food.count();

  // Report Summary
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ Indian Seeding Completed Successfully!');
  console.log(`   Total FDC items added  : ${fdcAdded}`);
  console.log(`   Total OFF items added  : ${offAdded}`);
  console.log(`   Total Composite added  : ${compositeAdded}`);
  console.log(`   Duplicates skipped     : ${duplicatesSkipped}`);
  console.log(`   Errors encountered     : ${errorsCount}`);
  console.log(`   Total foods in DB now  : ${afterCount}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('━━━ Category Coverage Breakdown ━━━');
  for (const [cat, count] of Object.entries(categoryCounts)) {
    console.log(`  - ${cat.padEnd(28)}: ${count} items`);
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main()
  .catch((e) => {
    console.error('\n❌ Seeder script failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
