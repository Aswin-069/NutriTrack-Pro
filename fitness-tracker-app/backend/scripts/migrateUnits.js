import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

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

async function main() {
  console.log('Migrating existing database food items default units...');
  const foods = await prisma.food.findMany();
  let count = 0;
  for (const food of foods) {
    const defaults = inferUnitDefaults(food.name, food.category);
    if (defaults.servingUnit !== food.servingUnit || defaults.pieceWeight !== food.pieceWeight) {
      await prisma.food.update({
        where: { id: food.id },
        data: {
          servingUnit: defaults.servingUnit,
          pieceWeight: defaults.pieceWeight
        }
      });
      count++;
    }
  }
  console.log(`Successfully migrated ${count} food items!`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
