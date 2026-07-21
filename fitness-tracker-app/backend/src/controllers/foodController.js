import prisma from '../utils/prisma.js';

const FDC_API_KEY = process.env.FDC_API_KEY;
const FDC_BASE = 'https://api.nal.usda.gov/fdc/v1';

// ─── Helper: parse FDC food nutrients ───────────────────────────────────────
function parseFDCNutrients(food) {
  const nutrients = food.foodNutrients || [];
  const get = (name) => {
    const n = nutrients.find(
      (n) => n.nutrientName?.toLowerCase().includes(name.toLowerCase())
    );
    return n ? Math.round((n.value || 0) * 10) / 10 : 0;
  };

  // FDC uses various names — cover both branded and foundation foods
  const calories =
    get('Energy') ||
    get('energy') ||
    nutrients.find((n) => n.nutrientId === 1008 || n.nutrientId === 2047)?.value || 0;
  const protein = get('Protein') || get('protein');
  const carbs =
    get('Carbohydrate, by difference') ||
    get('carbohydrate') ||
    get('Total carbohydrate');
  const fat = get('Total lipid (fat)') || get('fat') || get('Total Fat');
  const fiber =
    get('Fiber, total dietary') ||
    get('dietary fiber') ||
    get('Total Dietary Fiber');

  return {
    calories: Math.round(calories * 10) / 10,
    protein: Math.round(protein * 10) / 10,
    carbs: Math.round(carbs * 10) / 10,
    fat: Math.round(fat * 10) / 10,
    fiber: Math.round(fiber * 10) / 10,
  };
}

// ─── Helper: infer default units and piece weights ───────────────────────────
function inferUnitDefaults(name, category) {
  const n = (name || '').toLowerCase();
  const c = (category || '').toLowerCase();

  // Egg products
  if (n.includes('egg') && !n.includes('eggplant') && !n.includes('noodle') && !n.includes('fried rice') && !n.includes('curry') && !n.includes('roll')) {
    if (n.includes('white')) {
      return { servingUnit: 'piece', pieceWeight: 33 };
    }
    if (n.includes('yolk')) {
      return { servingUnit: 'piece', pieceWeight: 17 };
    }
    return { servingUnit: 'piece', pieceWeight: 50 }; // Whole egg
  }

  // Fruit (piece)
  if (n.includes('banana') && !n.includes('chips') && !n.includes('shake') && !n.includes('bread')) {
    return { servingUnit: 'piece', pieceWeight: 118 };
  }
  if (n.includes('apple') && !n.includes('juice') && !n.includes('cider') && !n.includes('sauce') && !n.includes('pie')) {
    return { servingUnit: 'piece', pieceWeight: 182 };
  }
  if (n.includes('orange') && !n.includes('juice') && !n.includes('soda')) {
    return { servingUnit: 'piece', pieceWeight: 131 };
  }

  // Indian Flatbreads & Breads
  if (n.includes('roti') || n.includes('chapati') || n.includes('phulka')) {
    return { servingUnit: 'piece', pieceWeight: 40 };
  }
  if (n.includes('naan') || n.includes('paratha')) {
    return { servingUnit: 'piece', pieceWeight: 80 };
  }
  if (n.includes('idli')) {
    return { servingUnit: 'piece', pieceWeight: 40 };
  }
  if (n.includes('dosa')) {
    return { servingUnit: 'piece', pieceWeight: 50 };
  }
  if (n.includes('bread') && (n.includes('slice') || n.includes('white') || n.includes('whole wheat') || n.includes('brown') || n.includes('multigrain') || n.includes('loaf'))) {
    return { servingUnit: 'piece', pieceWeight: 25 };
  }

  // Liquids (ml)
  if (
    n.includes('milk') || 
    n.includes('juice') || 
    n.includes('oil') || 
    n.includes('buttermilk') || 
    n.includes('tea') || 
    n.includes('coffee') || 
    n.includes('soda') || 
    n.includes('water') || 
    n.includes('curd') || 
    n.includes('yogurt') || 
    c.includes('beverage') || 
    c.includes('soup')
  ) {
    return { servingUnit: 'ml', pieceWeight: null };
  }

  // Default to grams
  return { servingUnit: 'g', pieceWeight: null };
}

// ─── Helper: clean raw USDA FDC name to human-readable format ────────────────
function cleanFoodName(name) {
  if (!name) return 'Unknown Food';
  
  // If mixed case, it is likely already branded (like OFF) or relatively clean
  if (name !== name.toUpperCase() && name.includes(' ')) {
    return name;
  }

  let clean = name.toUpperCase();
  
  // Remove generic FDC markers
  let isRaw = clean.includes('RAW');
  let isCooked = clean.includes('COOKED');
  
  clean = clean.replace(/, NFS/g, '')
               .replace(/, NS/g, '')
               .replace(/, YEAR ROUND AVERAGE/g, '')
               .replace(/, MATURE SEEDS/g, '')
               .replace(/, MEAT ONLY/g, '')
               .replace(/, BONELESS/g, '')
               .replace(/, SKINLESS/g, '')
               .replace(/, BY DIFFERENCE/g, '');

  // Dictionary matching for common terms
  const dict = [
    { key: 'CEREALS, QUAKER, QUICK OATS', val: 'Quaker Quick Oats' },
    { key: 'EGGS, WHOLE, RAW', val: 'Whole Egg' },
    { key: 'EGG, WHITE, RAW', val: 'Egg White' },
    { key: 'CHICKEN, BREAST', val: 'Chicken Breast' },
    { key: 'BANANAS, RAW', val: 'Banana' },
    { key: 'APPLES, RAW', val: 'Apple' },
    { key: 'ONIONS, RAW', val: 'Onion' },
    { key: 'TOMATOES, RED, RIPE, RAW', val: 'Tomato' },
    { key: 'POTATOES, RAW', val: 'Potato' },
    { key: 'MILK, FLUID, 1% FAT', val: '1% Lowfat Milk' },
    { key: 'MILK, FLUID, 2% FAT', val: '2% Reduced Fat Milk' },
    { key: 'MILK, FLUID, WHOLE', val: 'Whole Milk' },
    { key: 'YOGURT, GREEK, PLAIN', val: 'Greek Yogurt (Plain)' },
    { key: 'RICE, WHITE, LONG-GRAIN, RECONSTITUTED', val: 'Cooked White Rice' },
    { key: 'RICE, BROWN, LONG-GRAIN, RECONSTITUTED', val: 'Cooked Brown Rice' },
    { key: 'RICE, BASMATI', val: 'Basmati Rice' },
    { key: 'OATS, RAW', val: 'Oats' },
    { key: 'SPINACH, RAW', val: 'Spinach' },
    { key: 'BROCCOLI, RAW', val: 'Broccoli' },
    { key: 'CAULIFLOWER, RAW', val: 'Cauliflower' },
    { key: 'CABBAGE, RAW', val: 'Cabbage' },
    { key: 'CARROTS, RAW', val: 'Carrot' },
    { key: 'CUCUMBER, RAW', val: 'Cucumber' },
    { key: 'GARLIC, RAW', val: 'Garlic' },
    { key: 'GINGER, RAW', val: 'Ginger' },
    { key: 'PANEER', val: 'Paneer' },
    { key: 'TOFU, RAW', val: 'Tofu' },
    { key: 'LENTILS, RAW', val: 'Lentils' },
    { key: 'CHICKPEAS, RAW', val: 'Chickpeas' },
    { key: 'ALMONDS', val: 'Almonds' },
    { key: 'WALNUTS', val: 'Walnuts' },
    { key: 'CASHEW NUTS', val: 'Cashews' },
    { key: 'PEANUTS, RAW', val: 'Peanuts' },
  ];

  for (const item of dict) {
    if (clean.includes(item.key)) {
      let finalVal = item.val;
      if (isRaw && !finalVal.toLowerCase().includes('raw') && !finalVal.toLowerCase().includes('cooked')) {
        finalVal += ' (Raw)';
      }
      if (isCooked && !finalVal.toLowerCase().includes('cooked') && !finalVal.toLowerCase().includes('raw')) {
        finalVal += ' (Cooked)';
      }
      return finalVal;
    }
  }

  // Reordering fallback
  let parts = clean.split(',').map(p => p.trim()).filter(Boolean);
  if (parts.length > 1) {
    const capitalize = (str) => str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
    let mainWord = capitalize(parts[0]);
    if (mainWord.endsWith('s') && !mainWord.endsWith('ss') && mainWord !== 'Oats') {
      mainWord = mainWord.slice(0, -1);
    }
    let subWord = capitalize(parts[1]);
    let details = parts.slice(2).map(capitalize);
    
    let base = `${subWord} ${mainWord}`.trim();
    if (details.length > 0) {
      base += ` (${details.join(', ')})`;
    }
    return base;
  }

  return clean.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

// ─── Helper: map FDC search result to Food shape ─────────────────────────────
function mapFDCFood(food) {
  const nutrients = parseFDCNutrients(food);
  const inferred = inferUnitDefaults(food.description, food.foodCategory);
  return {
    name: food.description,
    displayName: cleanFoodName(food.description),
    category: food.foodCategory || food.brandOwner || null,
    servingSize: 100,
    servingUnit: inferred.servingUnit,
    pieceWeight: inferred.pieceWeight,
    sourceType: 'FDC',
    sourceId: String(food.fdcId),
    ...nutrients,
  };
}

// ─── GET /api/foods/search?q= ─────────────────────────────────────────────
export const searchFoods = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 2) {
      return res.json({ foods: [], live: [] });
    }

    const query = q.trim();

    // 1. Full-text + trigram search in local DB
    // Use Prisma raw for pg_trgm similarity — falls back to ILIKE if extension not installed
    let dbFoods = [];
    try {
      dbFoods = await prisma.$queryRaw`
        SELECT id, name, "displayName", category, "cuisineRegion", "servingSize", "servingUnit", "pieceWeight",
               calories, protein, carbs, fat, fiber, "sourceType", "sourceId", "dataQuality"
        FROM "Food"
        WHERE name % ${query}
           OR name ILIKE ${'%' + query + '%'}
           OR "displayName" ILIKE ${'%' + query + '%'}
        ORDER BY similarity(name, ${query}) DESC
        LIMIT 25
      `;
    } catch {
      // pg_trgm not available — pure ILIKE fallback
      dbFoods = await prisma.food.findMany({
        where: {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { displayName: { contains: query, mode: 'insensitive' } }
          ]
        },
        take: 25,
        orderBy: { name: 'asc' },
      });
    }

    // 2. If DB returns fewer than 3 results and FDC key is configured → live search
    let liveFoods = [];
    if (dbFoods.length < 3 && FDC_API_KEY) {
      try {
        const url = `${FDC_BASE}/foods/search?query=${encodeURIComponent(query)}&pageSize=15&api_key=${FDC_API_KEY}`;
        const fdcRes = await fetch(url);
        if (fdcRes.ok) {
          const data = await fdcRes.json();
          liveFoods = (data.foods || []).map((f) => ({
            ...mapFDCFood(f),
            live: true,
          }));
        }
      } catch (err) {
        console.error('FDC live search error:', err.message);
      }
    }

    return res.json({ foods: dbFoods, live: liveFoods });
  } catch (error) {
    console.error('Food search error:', error);
    return res.status(500).json({ error: 'Food search failed' });
  }
};

// ─── POST /api/foods/cache ────────────────────────────────────────────────
// Cache a live FDC result into the DB so it's available offline next time
export const cacheFoodEntry = async (req, res) => {
  try {
    const { name, displayName, category, cuisineRegion, servingSize, servingUnit, pieceWeight, calories, protein, carbs, fat, fiber, sourceType, sourceId, dataQuality } = req.body;

    if (!name || !sourceType || !sourceId) {
      return res.status(400).json({ error: 'name, sourceType, and sourceId are required' });
    }

    const inferred = inferUnitDefaults(name, category);
    const finalServingUnit = servingUnit || inferred.servingUnit;
    const finalPieceWeight = pieceWeight !== undefined 
      ? (pieceWeight ? parseFloat(pieceWeight) : null) 
      : inferred.pieceWeight;
    const finalDisplayName = displayName || cleanFoodName(name);

    const food = await prisma.food.upsert({
      where: { sourceType_sourceId: { sourceType, sourceId } },
      update: {},
      create: {
        name,
        displayName: finalDisplayName,
        category: category || null,
        cuisineRegion: cuisineRegion || 'Global',
        servingSize: parseFloat(servingSize) || 100,
        servingUnit: finalServingUnit,
        pieceWeight: finalPieceWeight,
        calories: parseFloat(calories) || 0,
        protein: parseFloat(protein) || 0,
        carbs: parseFloat(carbs) || 0,
        fat: parseFloat(fat) || 0,
        fiber: parseFloat(fiber) || 0,
        sourceType,
        sourceId: String(sourceId),
        dataQuality: dataQuality || (sourceType === 'FDC' ? 'VERIFIED_FDC' : 'VERIFIED_OFF'),
      },
    });

    return res.status(201).json({ food });
  } catch (error) {
    console.error('Cache food error:', error);
    return res.status(500).json({ error: 'Failed to cache food entry' });
  }
};
