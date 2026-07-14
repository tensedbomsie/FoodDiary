import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import type { Food } from './types'

const CATEGORIES = [
  'นม',
  'ผลไม้',
  'อาหารบ้าน',
  'Fast Food',
  'อาหารจานเดียว',
  'ของกินเล่น',
  'เครื่องดื่ม',
  'วัตถุดิบ',
]

const emptyForm = () => ({
  name: '',
  category: CATEGORIES[0],
  kcal: '',
  protein: '',
})

export default function FoodLibrary({ session }: { session: Session }) {
  const [foods, setFoods] = useState<Food[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editKcal, setEditKcal] = useState('')
  const [editProtein, setEditProtein] = useState('')

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('foods').select('*').order('name')
    setFoods((data as Food[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const addFood = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return
    await supabase.from('foods').insert({
      owner: session.user.id,
      name: form.name,
      category: form.category,
      kcal: form.kcal === '' ? null : Number(form.kcal),
      protein: form.protein || null,
    })
    setForm(emptyForm())
    setShowForm(false)
    load()
  }

  const deleteFood = async (id: string) => {
    if (!window.confirm('ลบอาหารนี้ออกจากลิสต์ใช่ไหม?')) return
    await supabase.from('foods').delete().eq('id', id)
    setFoods((f) => f.filter((x) => x.id !== id))
  }

  const startEdit = (f: Food) => {
    setEditingId(f.id)
    setEditKcal(f.kcal != null ? String(f.kcal) : '')
    setEditProtein(f.protein ?? '')
  }

  const cancelEdit = () => {
    setEditingId(null)
  }

  const saveEdit = async (id: string) => {
    const kcal = editKcal === '' ? null : Number(editKcal)
    const protein = editProtein || null
    await supabase.from('foods').update({ kcal, protein }).eq('id', id)
    setFoods((fs) => fs.map((f) => (f.id === id ? { ...f, kcal, protein } : f)))
    setEditingId(null)
  }

  const filtered = foods.filter((f) => f.name.toLowerCase().includes(search.toLowerCase()))
  const groups = CATEGORIES.map((cat) => ({
    category: cat,
    items: filtered.filter((f) => f.category === cat),
  })).filter((g) => g.items.length > 0)

  return (
    <div>
      <div className="page-header">
        <h1>Foods</h1>
        <button className="btn btn-primary" onClick={() => setShowForm((s) => !s)}>
          {showForm ? 'ปิดฟอร์ม' : '+ เพิ่มอาหารใหม่'}
        </button>
      </div>

      {showForm && (
        <form className="card food-form" onSubmit={addFood}>
          <div className="form-grid">
            <input
              placeholder="ชื่ออาหาร *"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <input
              type="number"
              placeholder="kcal"
              value={form.kcal}
              onChange={(e) => setForm({ ...form, kcal: e.target.value })}
            />
            <input
              placeholder="Protein (เช่น 30g)"
              value={form.protein}
              onChange={(e) => setForm({ ...form, protein: e.target.value })}
            />
          </div>
          <button type="submit" className="btn btn-primary">
            บันทึกอาหารใหม่
          </button>
        </form>
      )}

      <input
        className="search-input"
        placeholder="ค้นหาอาหาร..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {loading && <p className="diary-loading">กำลังโหลด...</p>}

      {groups.map((group) => (
        <div key={group.category}>
          <h2 className="section-title">{group.category}</h2>
          <div className="food-grid">
            {group.items.map((f) =>
              editingId === f.id ? (
                <div key={f.id} className="card food-card">
                  <div className="food-card-top">
                    <span className="exercise-name">{f.name}</span>
                    <button className="set-delete" onClick={() => deleteFood(f.id)}>
                      ×
                    </button>
                  </div>
                  <div className="form-grid">
                    <input
                      type="number"
                      placeholder="kcal"
                      value={editKcal}
                      onChange={(e) => setEditKcal(e.target.value)}
                    />
                    <input
                      placeholder="Protein (เช่น 30g)"
                      value={editProtein}
                      onChange={(e) => setEditProtein(e.target.value)}
                    />
                  </div>
                  <div className="meal-card-actions">
                    <button className="btn btn-primary" onClick={() => saveEdit(f.id)}>บันทึก</button>
                    <button className="btn" onClick={cancelEdit}>ยกเลิก</button>
                  </div>
                </div>
              ) : (
                <div key={f.id} className="card food-card">
                  <div className="food-card-top">
                    <span className="exercise-name">{f.name}</span>
                    <button className="set-delete" onClick={() => deleteFood(f.id)}>
                      ×
                    </button>
                  </div>
                  <div className="exercise-tags">
                    {f.kcal != null && <span className="chip">{f.kcal} kcal</span>}
                    {f.protein && <span className="chip">Protein {f.protein}</span>}
                    <button className="chip food-edit-btn" onClick={() => startEdit(f)}>✎ แก้ไข</button>
                  </div>
                </div>
              ),
            )}
          </div>
        </div>
      ))}

      {!loading && filtered.length === 0 && <p className="diary-empty">ไม่พบอาหาร</p>}
    </div>
  )
}
