export function calculateTargets({ gender = 'male', weight, height, age, activityLevel = 'sedentary', fitnessGoal = 'maintenance' }) {
  const w = parseFloat(weight) || 70;
  const h = parseFloat(height) || 175;
  const a = parseInt(age) || 30;
  const g = (gender || '').toLowerCase();

  // 1. Mifflin-St Jeor BMR Equation
  let bmr = 0;
  if (g === 'male') {
    bmr = (10 * w) + (6.25 * h) - (5 * a) + 5;
  } else if (g === 'female') {
    bmr = (10 * w) + (6.25 * h) - (5 * a) - 161;
  } else {
    bmr = (10 * w) + (6.25 * h) - (5 * a) - 78; // Midpoint
  }

  // 2. Standard Activity Multipliers for TDEE
  let activityMult = 1.2;
  switch (activityLevel) {
    case 'sedentary':
      activityMult = 1.2;
      break;
    case 'lightly_active':
      activityMult = 1.375;
      break;
    case 'moderately_active':
      activityMult = 1.55;
      break;
    case 'very_active':
      activityMult = 1.725;
      break;
    case 'extra_active':
    case 'extremely_active':
      activityMult = 1.9;
      break;
    default:
      activityMult = 1.2;
  }
  const tdee = bmr * activityMult;

  // 3. Goal-specific Calorie, Protein & Fat Adjustments
  let calorieMult = 1.0;
  let proteinFactor = 1.7; // g/kg
  let fatRatio = 0.25;      // 25% of calories

  switch (fitnessGoal) {
    case 'fat_loss':
      calorieMult = 0.80; // 20% deficit
      proteinFactor = 2.2;
      fatRatio = 0.25;
      break;
    case 'body_recomp':
      calorieMult = 0.95; // 5% deficit
      proteinFactor = 2.2;
      fatRatio = 0.25;
      break;
    case 'lean_gain':
      calorieMult = 1.075; // 7.5% surplus
      proteinFactor = 2.0;
      fatRatio = 0.25;
      break;
    case 'muscle_building':
      calorieMult = 1.125; // 12.5% surplus
      proteinFactor = 2.1;
      fatRatio = 0.25;
      break;
    case 'clean_bulk':
      calorieMult = 1.15; // 15% surplus
      proteinFactor = 1.9;
      fatRatio = 0.25;
      break;
    case 'aggressive_bulk':
      calorieMult = 1.225; // 22.5% surplus
      proteinFactor = 1.8;
      fatRatio = 0.25;
      break;
    case 'maintenance':
      calorieMult = 1.0; // Maintenance
      proteinFactor = 1.7;
      fatRatio = 0.25;
      break;
    case 'athletic':
      calorieMult = 1.05; // 5% surplus
      proteinFactor = 1.9;
      fatRatio = 0.25;
      break;
    case 'endurance':
      calorieMult = 1.05; // 5% surplus
      proteinFactor = 1.7;
      fatRatio = 0.20; // 20% fat to maximize carbs
      break;
    default:
      calorieMult = 1.0;
      proteinFactor = 1.7;
      fatRatio = 0.25;
  }

  // Calculate final targets
  let dailyCalorieTarget = Math.round(tdee * calorieMult);
  if (dailyCalorieTarget < 1200) dailyCalorieTarget = 1200;

  let dailyProteinTarget = Math.round(w * proteinFactor);

  const fatCalories = dailyCalorieTarget * fatRatio;
  let dailyFatTarget = Math.round(fatCalories / 9);

  const proteinCalories = dailyProteinTarget * 4;
  const totalFatCalories = dailyFatTarget * 9;
  const remainingCarbCalories = Math.max(0, dailyCalorieTarget - (proteinCalories + totalFatCalories));
  let dailyCarbsTarget = Math.round(remainingCarbCalories / 4);

  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    dailyCalorieTarget,
    dailyProteinTarget,
    dailyFatTarget,
    dailyCarbsTarget
  };
}
