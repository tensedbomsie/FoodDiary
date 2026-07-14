import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import {
  FOOD_TAGS,
  MEAL_TYPES,
  mealKcal,
  mealProtein,
  type Food,
  type FoodTag,
  type Meal,
  type MealType,
} from './types'
import { buildExportText } from './export'
import StarRating from './StarRating'
import FoodPicker, { type SelectedFood } from './FoodPicker'

const toLocalInputValue = (date: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const emptyForm = () => ({
  eatenAt: toLocalInputValue(new Date()),
  mealType: 'อื่นๆ' as MealType,
  description: '',
  fullness: null as number | null,
  hunger: null as number | null,
  tags: [] as FoodTag[],
  file: null as File | null,
  foods: [] as SelectedFood[],
})

function TagPicker({
  value,
  onChange,
}: {
  value: FoodTag[]
  onChange: (tags: FoodTag[]) => void
}) {
  const toggle = (tag: FoodTag) => {
    onChange(value.includes(tag) ? value.filter((t) => t !== tag) : [...value, tag])
  }
  return (
    <div className="tag-picker">
      {FOOD_TAGS.map((tag) => (
        <button
          key={tag}
          type="button"
          className={`tag-chip${value.includes(tag) ? ' selected' : ''}`}
          onClick={() => toggle(tag)}
        >
          {tag}
        </button>
      ))}
    </div>
  )
}

export default function Diary({ session }: { session: Session }) {
  const [meals, setMeals] = useState<Meal[]>([])
  const [foods, setFoods] = useState<Food[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState(emptyForm())
  const [exportText, setExportText] = useState<string | null>(null)
  const [copyStatus, setCopyStatus] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    const [{ data: mealData }, { data: foodData }] = await Promise.all([
      supabase
        .from('meals')
        .select('*, meal_foods(*, food:foods(*))')
        .order('eaten_at', { ascending: false }),
      supabase.from('foods').select('*').order('name'),
    ])
    setMeals((mealData as Meal[]) ?? [])
    setFoods((foodData as Food[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const uploadImage = async (file: File) => {
    const path = `${session.user.id}/${Date.now()}-${file.name}`
    const { error } = await supabase.storage.from('meal-images').upload(path, file)
    if (error) return null
    const { data } = supabase.storage.from('meal-images').getPublicUrl(path)
    return data.publicUrl
  }

  const syncMealFoods = async (mealId: string, selected: SelectedFood[]) => {
    await supabase.from('meal_foods').delete().eq('meal_id', mealId)
    if (selected.length === 0) return
    await supabase.from('meal_foods').insert(
      selected.map((s) => ({
        meal_id: mealId,
        food_id: s.food.id,
        quantity: s.quantity,
      })),
    )
  }

  const addMeal = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    let imageUrl: string | null = null
    if (form.file) imageUrl = await uploadImage(form.file)
    const { data: inserted } = await supabase
      .from('meals')
      .insert({
        owner: session.user.id,
        eaten_at: new Date(form.eatenAt).toISOString(),
        meal_type: form.mealType,
        description: form.description,
        fullness: form.fullness,
        hunger: form.hunger,
        tags: form.tags,
        image_url: imageUrl,
      })
      .select('id')
      .single()
    if (inserted) await syncMealFoods(inserted.id, form.foods)
    setForm(emptyForm())
    setSaving(false)
    load()
  }

  const startEdit = (meal: Meal) => {
    setEditingId(meal.id)
    setEditForm({
      eatenAt: toLocalInputValue(new Date(meal.eaten_at)),
      mealType: meal.meal_type,
      description: meal.description,
      fullness: meal.fullness,
      hunger: meal.hunger,
      tags: meal.tags ?? [],
      file: null,
      foods: (meal.meal_foods ?? [])
        .filter((mf) => mf.food)
        .map((mf) => ({ food: mf.food as Food, quantity: mf.quantity })),
    })
  }

  const saveEdit = async (id: string) => {
    let imageUrl: string | undefined
    if (editForm.file) {
      const uploaded = await uploadImage(editForm.file)
      if (uploaded) imageUrl = uploaded
    }
    await supabase
      .from('meals')
      .update({
        eaten_at: new Date(editForm.eatenAt).toISOString(),
        meal_type: editForm.mealType,
        description: editForm.description,
        fullness: editForm.fullness,
        hunger: editForm.hunger,
        tags: editForm.tags,
        ...(imageUrl ? { image_url: imageUrl } : {}),
      })
      .eq('id', id)
    await syncMealFoods(id, editForm.foods)
    setEditingId(null)
    load()
  }

  const deleteMeal = async (id: string) => {
    if (!window.confirm('ลบรายการนี้ใช่ไหม?')) return
    await supabase.from('meals').delete().eq('id', id)
    load()
  }

  const openExport = (mealsToExport: Meal[] = meals) => {
    setCopyStatus(null)
    setExportText(buildExportText(mealsToExport))
  }

  const copyExport = async () => {
    if (!exportText) return
    try {
      await navigator.clipboard.writeText(exportText)
      setCopyStatus('คัดลอกแล้ว!')
    } catch {
      setCopyStatus('คัดลอกอัตโนมัติไม่ได้ กรุณาเลือกข้อความแล้วกด Ctrl+C เอง')
    }
  }

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

  const addFoodTo = (target: 'form' | 'edit', food: Food) => {
    const setter = target === 'form' ? setForm : setEditForm
    setter((f) => ({ ...f, foods: [...f.foods, { food, quantity: 1 }] }))
  }
  const removeFoodFrom = (target: 'form' | 'edit', index: number) => {
    const setter = target === 'form' ? setForm : setEditForm
    setter((f) => ({ ...f, foods: f.foods.filter((_, i) => i !== index) }))
  }
  const changeQtyIn = (target: 'form' | 'edit', index: number, quantity: number) => {
    const setter = target === 'form' ? setForm : setEditForm
    setter((f) => ({
      ...f,
      foods: f.foods.map((s, i) => (i === index ? { ...s, quantity } : s)),
    }))
  }

  return (
    <div className="diary-page">
      <div className="page-header">
        <h1>Diary</h1>
        <button className="btn btn-primary" onClick={() => openExport()}>
          Export
        </button>
      </div>

      <form className="meal-form" onSubmit={addMeal}>
        <div className="meal-form-row">
          <input
            type="datetime-local"
            value={form.eatenAt}
            onChange={(e) => setForm({ ...form, eatenAt: e.target.value })}
            required
          />
          <select
            value={form.mealType}
            onChange={(e) => setForm({ ...form, mealType: e.target.value as MealType })}
          >
            {MEAL_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <FoodPicker
          foods={foods}
          selected={form.foods}
          onAdd={(f) => addFoodTo('form', f)}
          onRemove={(i) => removeFoodFrom('form', i)}
          onQuantityChange={(i, q) => changeQtyIn('form', i, q)}
        />

        <textarea
          placeholder="โน้ตเพิ่มเติม (ถ้ามี)..."
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
        <TagPicker value={form.tags} onChange={(tags) => setForm({ ...form, tags })} />
        <div className="meal-form-row rating-row">
          <div className="rating-field">
            <span>ความหิวก่อนกิน</span>
            <StarRating value={form.hunger} onChange={(v) => setForm({ ...form, hunger: v })} />
          </div>
          <div className="rating-field">
            <span>ความอิ่มหลังกิน</span>
            <StarRating
              value={form.fullness}
              onChange={(v) => setForm({ ...form, fullness: v })}
            />
          </div>
        </div>
        <div className="meal-form-row">
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setForm({ ...form, file: e.target.files?.[0] ?? null })}
          />
          <button type="submit" disabled={saving}>
            {saving ? 'กำลังบันทึก...' : '+ บันทึกมื้ออาหาร'}
          </button>
        </div>
      </form>

      {loading && <p className="diary-loading">กำลังโหลด...</p>}

      <div className="diary-list">
        {Object.entries(groups).map(([day, dayMeals]) => {
          const dayKcal = dayMeals.reduce((sum, m) => sum + mealKcal(m), 0)
          const dayProtein = dayMeals.reduce((sum, m) => sum + mealProtein(m), 0)
          return (
            <div key={day} className="diary-day">
              <div className="diary-day-header">
                <h2>{day}</h2>
                <div className="diary-day-header-actions">
                  {dayKcal > 0 && <span className="kcal-badge">🔥 {Math.round(dayKcal)} kcal</span>}
                  {dayProtein > 0 && <span className="protein-badge">🥩 {Math.round(dayProtein)}g</span>}
                  <button className="day-export-btn" onClick={() => openExport(dayMeals)}>
                    Export วันนี้
                  </button>
                </div>
              </div>
              {dayMeals.map((meal) =>
                editingId === meal.id ? (
                  <div key={meal.id} className="meal-card meal-card-editing">
                    <div className="meal-form-row">
                      <input
                        type="datetime-local"
                        value={editForm.eatenAt}
                        onChange={(e) => setEditForm({ ...editForm, eatenAt: e.target.value })}
                      />
                      <select
                        value={editForm.mealType}
                        onChange={(e) =>
                          setEditForm({ ...editForm, mealType: e.target.value as MealType })
                        }
                      >
                        {MEAL_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>
                    <FoodPicker
                      foods={foods}
                      selected={editForm.foods}
                      onAdd={(f) => addFoodTo('edit', f)}
                      onRemove={(i) => removeFoodFrom('edit', i)}
                      onQuantityChange={(i, q) => changeQtyIn('edit', i, q)}
                    />
                    <textarea
                      placeholder="โน้ตเพิ่มเติม (ถ้ามี)..."
                      value={editForm.description}
                      onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    />
                    <TagPicker
                      value={editForm.tags}
                      onChange={(tags) => setEditForm({ ...editForm, tags })}
                    />
                    <div className="meal-form-row rating-row">
                      <div className="rating-field">
                        <span>ความหิวก่อนกิน</span>
                        <StarRating
                          value={editForm.hunger}
                          onChange={(v) => setEditForm({ ...editForm, hunger: v })}
                        />
                      </div>
                      <div className="rating-field">
                        <span>ความอิ่มหลังกิน</span>
                        <StarRating
                          value={editForm.fullness}
                          onChange={(v) => setEditForm({ ...editForm, fullness: v })}
                        />
                      </div>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) =>
                        setEditForm({ ...editForm, file: e.target.files?.[0] ?? null })
                      }
                    />
                    <div className="meal-card-actions">
                      <button onClick={() => saveEdit(meal.id)}>บันทึก</button>
                      <button onClick={() => setEditingId(null)}>ยกเลิก</button>
                    </div>
                  </div>
                ) : (
                  <div key={meal.id} className="meal-card">
                    {meal.image_url && (
                      <img className="meal-image" src={meal.image_url} alt="" />
                    )}
                    <div className="meal-card-body">
                      <div className="meal-card-header">
                        <span className="meal-type-tag">{meal.meal_type}</span>
                        <span className="meal-time">
                          {new Date(meal.eaten_at).toLocaleTimeString('th-TH', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        {mealKcal(meal) > 0 && (
                          <span className="kcal-badge">{Math.round(mealKcal(meal))} kcal</span>
                        )}
                        {mealProtein(meal) > 0 && (
                          <span className="protein-badge">🥩 {Math.round(mealProtein(meal))}g</span>
                        )}
                      </div>
                      {meal.meal_foods && meal.meal_foods.length > 0 && (
                        <div className="meal-food-readout">
                          {meal.meal_foods.map((mf) => (
                            <span key={mf.id} className="chip">
                              {mf.food?.name}
                              {mf.quantity !== 1 ? ` ×${mf.quantity}` : ''}
                            </span>
                          ))}
                        </div>
                      )}
                      {meal.description && (
                        <p className="meal-description">{meal.description}</p>
                      )}
                      {meal.tags?.length > 0 && (
                        <div className="meal-tags">
                          {meal.tags.map((tag) => (
                            <span key={tag} className="tag-chip readonly">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                      {(meal.hunger || meal.fullness) && (
                        <div className="meal-ratings">
                          {meal.hunger && (
                            <span className="meal-rating-readout">
                              หิว: {'★'.repeat(meal.hunger)}
                              {'☆'.repeat(5 - meal.hunger)}
                            </span>
                          )}
                          {meal.fullness && (
                            <span className="meal-rating-readout">
                              อิ่ม: {'★'.repeat(meal.fullness)}
                              {'☆'.repeat(5 - meal.fullness)}
                            </span>
                          )}
                        </div>
                      )}
                      <div className="meal-card-actions">
                        <button onClick={() => startEdit(meal)}>แก้ไข</button>
                        <button onClick={() => deleteMeal(meal.id)}>ลบ</button>
                      </div>
                    </div>
                  </div>
                ),
              )}
            </div>
          )
        })}
        {!loading && meals.length === 0 && <p className="diary-empty">ยังไม่มีบันทึกมื้ออาหารเลย</p>}
      </div>

      {exportText !== null && (
        <div className="export-modal-backdrop" onClick={() => setExportText(null)}>
          <div className="export-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Export food diary</h2>
            <p>คัดลอกข้อความนี้ไปวางให้ ChatGPT หรือ Claude ช่วยดูภาพรวมการกินได้เลย</p>
            <textarea readOnly value={exportText} onFocus={(e) => e.target.select()} />
            <div className="export-modal-actions">
              {copyStatus && <span className="export-status">{copyStatus}</span>}
              <span className="spacer" />
              <button onClick={copyExport}>คัดลอก</button>
              <button onClick={() => setExportText(null)}>ปิด</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
