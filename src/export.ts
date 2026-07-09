import type { Meal } from './types'

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
    lines.push(`## ${day}`)
    for (const meal of dayMeals) {
      const time = new Date(meal.eaten_at).toLocaleTimeString('th-TH', {
        hour: '2-digit',
        minute: '2-digit',
      })
      lines.push(`- [${time}] ${meal.meal_type}: ${meal.description}`)
    }
    lines.push('')
  }

  return lines.join('\n').trim()
}
