export type MealType = 'เช้า' | 'กลางวัน' | 'เย็น' | 'ของว่าง' | 'อื่นๆ'

export type FoodTag = 'อาหารบ้าน' | 'Fast Food' | 'ผลไม้' | 'นม' | 'Snack'

export type Food = {
  id: string
  owner: string
  name: string
  category: string
  kcal: number | null
  protein: string | null
  created_at: string
}

export type MealFood = {
  id: string
  meal_id: string
  food_id: string
  quantity: number
  kcal_override: number | null
  created_at: string
  food?: Food
}

export type Meal = {
  id: string
  owner: string
  eaten_at: string
  meal_type: MealType
  description: string
  image_url: string | null
  fullness: number | null
  hunger: number | null
  tags: FoodTag[]
  created_at: string
  meal_foods?: MealFood[]
}

export const MEAL_TYPES: MealType[] = ['เช้า', 'กลางวัน', 'เย็น', 'ของว่าง', 'อื่นๆ']
export const FOOD_TAGS: FoodTag[] = ['อาหารบ้าน', 'Fast Food', 'ผลไม้', 'นม', 'Snack']

export function mealFoodKcal(mf: MealFood): number {
  const base = mf.kcal_override ?? mf.food?.kcal ?? 0
  return base * mf.quantity
}

export function mealKcal(meal: Meal): number {
  return (meal.meal_foods ?? []).reduce((sum, mf) => sum + mealFoodKcal(mf), 0)
}

function parseProteinGrams(protein: string | null | undefined): number {
  if (!protein) return 0
  const match = protein.match(/[\d.]+/)
  return match ? parseFloat(match[0]) : 0
}

export function mealFoodProtein(mf: MealFood): number {
  return parseProteinGrams(mf.food?.protein) * mf.quantity
}

export function mealProtein(meal: Meal): number {
  return (meal.meal_foods ?? []).reduce((sum, mf) => sum + mealFoodProtein(mf), 0)
}
