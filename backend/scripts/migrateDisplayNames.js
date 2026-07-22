import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

function cleanFoodName(name) {
  if (!name) return 'Unknown Food';
  if (name !== name.toUpperCase() && name.includes(' ')) {
    return name;
  }

  let clean = name.toUpperCase();
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

async function main() {
  console.log('Migrating existing food displayNames...');
  const foods = await prisma.food.findMany();
  let count = 0;
  for (const food of foods) {
    const clean = cleanFoodName(food.name);
    await prisma.food.update({
      where: { id: food.id },
      data: { displayName: clean }
    });
    count++;
  }
  console.log(`Successfully migrated ${count} food displayNames!`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
