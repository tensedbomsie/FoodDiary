import { mealKcal, type Meal } from './types'

export function buildExportText(meals: Meal[]) {
  if (meals.length === 0) return 'ยังไม่มีบันทึกมื้ออาหารเลย'

  const groups = meals.reduce<Record<string, Meal[]>>((acc, meal) => {
    const day = new Date(meal.eaten_at).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long',
    })
    acc[day] = acc[day] ?? []
    acc[day].push(meal)
    return acc
  }, {})

  const lines: string[] = ['# Food Diary', '']
  for (const [day, dayMeals] of Object.entries(groups)) {
    const dayKcal = dayMeals.reduce((sum, m) => sum + mealKcal(m), 0)
    lines.push(`## ${day}${dayKcal > 0 ? ` — รวม ${Math.round(dayKcal)} kcal` : ''}`)
    for (const meal of dayMeals) {
      const time = new Date(meal.eaten_at).toLocaleTimeString('th-TH', {
        hour: '2-digit',
        minute: '2-digit',
      })
      const foodNames = (meal.meal_foods ?? [])
        .map((mf) => `${mf.food?.name}${mf.quantity !== 1 ? ` x${mf.quantity}` : ''}`)
        .join(', ')
      const kcal = mealKcal(meal)
      const tags = meal.tags?.length ? ` [${meal.tags.join(', ')}]` : ''
      const ratings: string[] = []
      if (meal.hunger) ratings.push(`หิว ${meal.hunger}/5`)
      if (meal.fullness) ratings.push(`อิ่ม ${meal.fullness}/5`)
      const ratingText = ratings.length ? ` (${ratings.join(', ')})` : ''
      const kcalText = kcal > 0 ? ` — ${Math.round(kcal)} kcal` : ''
      lines.push(
        `- [${time}] ${meal.meal_type}: ${foodNames || meal.description}${kcalText}${tags}${ratingText}`,
      )
      if (meal.description && foodNames) lines.push(`  โน้ต: ${meal.description}`)
      if (meal.image_url) lines.push(`  รูป: ${meal.image_url}`)
    }
    lines.push('')
  }

  return lines.join('\n').trim()
}
