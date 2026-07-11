import { useState } from 'react'
import type { Food } from './types'

export type SelectedFood = { food: Food; quantity: number }

export default function FoodPicker({
  foods,
  selected,
  onAdd,
  onRemove,
  onQuantityChange,
}: {
  foods: Food[]
  selected: SelectedFood[]
  onAdd: (food: Food) => void
  onRemove: (index: number) => void
  onQuantityChange: (index: number, quantity: number) => void
}) {
  const [search, setSearch] = useState('')
  const filtered = search.trim()
    ? foods.filter((f) => f.name.toLowerCase().includes(search.toLowerCase())).slice(0, 8)
    : []

  return (
    <div>
      <div className="food-search">
        <input
          placeholder="+ เพิ่มอาหาร..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {filtered.length > 0 && (
          <div className="food-search-dropdown card">
            {filtered.map((f) => (
              <button
                key={f.id}
                type="button"
                className="food-search-item"
                onClick={() => {
                  onAdd(f)
                  setSearch('')
                }}
              >
                <span>{f.name}</span>
                <span className="chip">{f.kcal != null ? `${f.kcal} kcal` : '—'}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {selected.length > 0 && (
        <div className="meal-food-list">
          {selected.map((s, i) => (
            <div key={i} className="meal-food-row">
              <span className="meal-food-name">{s.food.name}</span>
              <input
                type="number"
                min="0.5"
                step="0.5"
                className="meal-food-qty"
                value={s.quantity}
                onChange={(e) => onQuantityChange(i, Number(e.target.value))}
              />
              <span className="meal-food-kcal">
                {s.food.kcal != null ? Math.round(s.food.kcal * s.quantity) : '—'} kcal
              </span>
              <button type="button" className="set-delete" onClick={() => onRemove(i)}>
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
