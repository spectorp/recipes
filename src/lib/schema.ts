import { z } from 'zod'

/** Allowed ingredient units — keep in sync with schema.json */
export const recipeUnitSchema = z.union([
  z.enum([
    'g',
    'kg',
    'ml',
    'l',
    'tsp',
    'tbsp',
    'cup',
    'fl_oz',
    'oz',
    'lb',
    'pinch',
  ]),
  z.null(),
])

export const ingredientSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    amount: z.number(),
    unit: recipeUnitSchema.optional(),
    notes: z.string().optional(),
  })
  .strict()

export const stepSchema = z
  .object({
    id: z.string().min(1),
    text: z.string().min(1),
  })
  .strict()

export const categoriesSchema = z
  .object({
    method: z.array(z.string()).optional(),
    diet: z.array(z.string()).optional(),
    meal: z.array(z.string()).optional(),
    season: z.array(z.string()).optional(),
    cuisine: z.array(z.string()).optional(),
    main_ingredient: z.array(z.string()).optional(),
  })
  .strict()

export const attributionSchema = z
  .object({
    name: z.string().optional(),
    url: z.string().optional(),
  })
  .strict()
  .nullable()

/** Runtime recipe shape — keep in sync with /schema.json */
export const recipeSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    categories: categoriesSchema.optional(),
    tags: z.array(z.string()).optional(),
    servings: z.number().int().min(1).optional(),
    prep_time_minutes: z.number().int().min(0).optional(),
    cook_time_minutes: z.number().int().min(0).optional(),
    ingredients: z.array(ingredientSchema),
    steps: z.array(stepSchema),
    rating: z.number().int().min(0).max(5).nullable().optional(),
    attribution: attributionSchema.optional(),
    notes: z.string().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .strict()

export type Recipe = z.infer<typeof recipeSchema>
export type RecipeUnit = z.infer<typeof recipeUnitSchema>
export type RecipeCategories = z.infer<typeof categoriesSchema>

const vocabEntrySchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
  })
  .strict()

export const categoriesFileSchema = z
  .object({
    method: z.array(vocabEntrySchema),
    diet: z.array(vocabEntrySchema),
    meal: z.array(vocabEntrySchema),
    season: z.array(vocabEntrySchema),
    cuisine: z.array(vocabEntrySchema),
    main_ingredient: z.array(vocabEntrySchema),
  })
  .strict()

export type CategoriesFile = z.infer<typeof categoriesFileSchema>
export type CategoryKey = keyof CategoriesFile

export const tagsFileSchema = z
  .object({
    tags: z.array(vocabEntrySchema),
  })
  .strict()

export type TagsFile = z.infer<typeof tagsFileSchema>

export const CATEGORY_KEYS: CategoryKey[] = [
  'method',
  'diet',
  'meal',
  'season',
  'cuisine',
  'main_ingredient',
]
