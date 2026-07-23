import { z } from 'zod';

// Strong password regex: min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#.])[A-Za-z\d@$!%*?&#.]{8,}$/;

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().trim().toLowerCase().email('Invalid email format'),
  password: z.string().min(8, 'Password must contain at least 8 characters').regex(
    passwordRegex,
    'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&#.)'
  ),
  height: z.union([z.number(), z.string()]).transform((val) => parseFloat(val)).refine((val) => val > 30 && val < 300, 'Height must be between 30cm and 300cm'),
  weight: z.union([z.number(), z.string()]).transform((val) => parseFloat(val)).refine((val) => val > 10 && val < 700, 'Weight must be between 10kg and 700kg'),
  age: z.union([z.number(), z.string()]).transform((val) => parseInt(val)).refine((val) => val >= 1 && val <= 120, 'Age must be between 1 and 120'),
  gender: z.enum(['male', 'female', 'other']),
  fitnessGoal: z.enum([
    'fat_loss', 'body_recomp', 'lean_gain', 'muscle_building', 
    'clean_bulk', 'aggressive_bulk', 'maintenance', 'athletic', 'endurance'
  ]),
  activityLevel: z.enum([
    'sedentary', 'lightly_active', 'moderately_active', 'very_active', 'extra_active', 'extremely_active'
  ])
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email format'),
  password: z.string().min(1, 'Password is required')
});

export const logEntrySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  mealSlot: z.enum(['breakfast', 'lunch', 'pre_workout', 'post_workout', 'dinner']),
  foodName: z.string().trim().min(1, 'Food name is required').max(200),
  quantity: z.union([z.number(), z.string()]).transform((val) => parseFloat(val)).refine((val) => val > 0, 'Quantity must be positive'),
  unit: z.string().trim().min(1, 'Unit is required').max(50),
  calories: z.union([z.number(), z.string()]).transform((val) => parseFloat(val)).refine((val) => val >= 0, 'Calories cannot be negative'),
  protein: z.union([z.number(), z.string()]).transform((val) => parseFloat(val)).refine((val) => val >= 0, 'Protein cannot be negative'),
  carbs: z.union([z.number(), z.string()]).transform((val) => parseFloat(val)).refine((val) => val >= 0, 'Carbohydrates cannot be negative'),
  fat: z.union([z.number(), z.string()]).transform((val) => parseFloat(val)).refine((val) => val >= 0, 'Fat cannot be negative'),
  gramEquivalent: z.union([z.number(), z.string()]).transform((val) => parseFloat(val)).optional()
});

export const foodCacheSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  category: z.string().nullable().optional(),
  cuisineRegion: z.string().nullable().optional(),
  servingSize: z.union([z.number(), z.string()]).transform((val) => parseFloat(val)).refine((val) => val > 0, 'Serving size must be positive'),
  servingUnit: z.string().trim().min(1, 'Serving unit is required').max(50),
  calories: z.union([z.number(), z.string()]).transform((val) => parseFloat(val)).refine((val) => val >= 0, 'Calories cannot be negative'),
  protein: z.union([z.number(), z.string()]).transform((val) => parseFloat(val)).refine((val) => val >= 0, 'Protein cannot be negative'),
  carbs: z.union([z.number(), z.string()]).transform((val) => parseFloat(val)).refine((val) => val >= 0, 'Carbohydrates cannot be negative'),
  fat: z.union([z.number(), z.string()]).transform((val) => parseFloat(val)).refine((val) => val >= 0, 'Fat cannot be negative'),
  fiber: z.union([z.number(), z.string()]).transform((val) => parseFloat(val)).refine((val) => val >= 0, 'Fiber cannot be negative').optional(),
  sourceType: z.enum(['FDC', 'OFF', 'COMPOSITE', 'CUSTOM']),
  sourceId: z.string().trim().min(1, 'Source ID is required').max(100),
  dataQuality: z.enum(['VERIFIED_FDC', 'VERIFIED_OFF', 'COMPOSITE_ESTIMATED']).optional()
});

// Express validation helper middleware
export const validate = (schema) => (req, res, next) => {
  try {
    req.body = schema.parse(req.body);
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues || error.errors || [];
      const firstErrorMessage = issues.length > 0 ? issues[0].message : 'Validation error';
      return res.status(400).json({ error: firstErrorMessage });
    }
    next(error);
  }
};
