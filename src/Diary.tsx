import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import { MEAL_TYPES, type Meal, type MealType } from './types'
import { buildExportText } from './export'

const toLocalInputValue = (date: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const emptyForm = () => ({
  eatenAt: toLocalInputValue(new Date()),
  mealType: 'อื่นๆ' as MealType,
  description: '',
  file: null as File | null,
})

export default function Diary({ session }: { session: Session }) {
  const [meals, setMeals] = useState<Meal[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState(emptyForm())
  const [exportText, setExportText] = useState<string | null>(null)
  const [copyStatus, setCopyStatus] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('meals')
      .select('*')
      .order('eaten_at', { ascending: false })
    setMeals((data as Meal[]) ?? [])
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

  const addMeal = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    let imageUrl: string | null = null
    if (form.file) imageUrl = await uploadImage(form.file)
    await supabase.from('meals').insert({
      owner: session.user.id,
      eaten_at: new Date(form.eatenAt).toISOString(),
      meal_type: form.mealType,
      description: form.description,
      image_url: imageUrl,
    })
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
      file: null,
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
        ...(imageUrl ? { image_url: imageUrl } : {}),
      })
      .eq('id', id)
    setEditingId(null)
    load()
  }

  const deleteMeal = async (id: string) => {
    if (!window.confirm('ลบรายการนี้ใช่ไหม?')) return
    await supabase.from('meals').delete().eq('id', id)
    load()
  }

  const openExport = () => {
    setCopyStatus(null)
    setExportText(buildExportText(meals))
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

  return (
    <div className="diary-page">
      <div className="toolbar">
        <h1>Food Diary</h1>
        <span className="spacer" />
        <button onClick={openExport}>Export</button>
        <span className="user-email">{session.user.email}</span>
        <button onClick={() => supabase.auth.signOut()}>ออกจากระบบ</button>
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
        <textarea
          placeholder="กินอะไรไปบ้าง..."
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          required
        />
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
        {Object.entries(groups).map(([day, dayMeals]) => (
          <div key={day} className="diary-day">
            <h2>{day}</h2>
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
                  <textarea
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  />
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
                    <img className="meal-image" src={meal.image_url} alt={meal.description} />
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
                    </div>
                    <p className="meal-description">{meal.description}</p>
                    <div className="meal-card-actions">
                      <button onClick={() => startEdit(meal)}>แก้ไข</button>
                      <button onClick={() => deleteMeal(meal.id)}>ลบ</button>
                    </div>
                  </div>
                </div>
              ),
            )}
          </div>
        ))}
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
