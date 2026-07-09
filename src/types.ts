export type MealType = 'เช้า' | 'กลางวัน' | 'เย็น' | 'ของว่าง' | 'อื่นๆ'

export type Meal = {
  id: string
  owner: string
  eaten_at: string
  meal_type: MealType
  description: string
  image_url: string | null
  created_at: string
}

export const MEAL_TYPES: MealType[] = ['เช้า', 'กลางวัน', 'เย็น', 'ของว่าง', 'อื่นๆ']
