import { useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import type { Food } from './types'

type EstimateItem = {
  name: string
  portion?: string
  kcal: number
  protein_g: number
  confidence?: 'low' | 'medium' | 'high'
  matches_known?: string
  use: boolean
}

const CONFIDENCE_LABEL: Record<string, string> = {
  low: 'ไม่ค่อยมั่นใจ',
  medium: 'ปานกลาง',
  high: 'มั่นใจ',
}

// Shrink the photo in the browser first: smaller upload, cheaper + faster AI call.
async function fileToBase64(file: File, maxSize = 1024): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.85).split(',')[1]
}

export default function MealPhotoEstimate({
  file,
  foods,
  session,
  onAddFood,
  onFoodsChanged,
}: {
  file: File
  foods: Food[]
  session: Session
  onAddFood: (food: Food) => void
  onFoodsChanged: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<EstimateItem[] | null>(null)
  const [notes, setNotes] = useState('')

  const estimate = async () => {
    setBusy(true)
    setError(null)
    setItems(null)
    try {
      const image_base64 = await fileToBase64(file)
      const known_foods = foods.map((f) => ({ name: f.name, kcal: f.kcal, protein: f.protein }))
      const { data, error: fnError } = await supabase.functions.invoke('estimate-meal', {
        body: { image_base64, mime_type: 'image/jpeg', known_foods },
      })
      if (fnError) throw fnError
      if (data?.error) throw new Error(data.error)
      setItems(((data?.items ?? []) as Omit<EstimateItem, 'use'>[]).map((i) => ({ ...i, use: true })))
      setNotes(data?.notes ?? '')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const update = (index: number, patch: Partial<EstimateItem>) =>
    setItems((cur) => (cur ? cur.map((it, i) => (i === index ? { ...it, ...patch } : it)) : cur))

  const total = (items ?? [])
    .filter((i) => i.use)
    .reduce(
      (acc, i) => ({ kcal: acc.kcal + (Number(i.kcal) || 0), protein: acc.protein + (Number(i.protein_g) || 0) }),
      { kcal: 0, protein: 0 },
    )

  const apply = async () => {
    if (!items) return
    setBusy(true)
    setError(null)
    try {
      let created = false
      for (const it of items.filter((i) => i.use)) {
        // Reuse a library food only when the user left its numbers untouched;
        // otherwise store the (edited) estimate as its own "AI ประมาณ" food.
        const known = it.matches_known ? foods.find((f) => f.name === it.matches_known) : undefined
        if (known && Math.round(known.kcal ?? -1) === Math.round(it.kcal)) {
          onAddFood(known)
          continue
        }
        const label = it.portion ? `${it.name} (${it.portion})` : it.name
        const { data, error: insertError } = await supabase
          .from('foods')
          .insert({
            owner: session.user.id,
            name: label,
            category: 'AI ประมาณ',
            kcal: Math.round(Number(it.kcal) || 0),
            protein: `~${Math.round(Number(it.protein_g) || 0)}g`,
          })
          .select('*')
          .single()
        if (insertError) throw insertError
        created = true
        onAddFood(data as Food)
      }
      if (created) onFoodsChanged()
      setItems(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="estimate-panel">
      {!items && (
        <button type="button" className="btn" onClick={estimate} disabled={busy}>
          {busy ? 'กำลังประเมิน...' : '🔍 ประเมินพลังงานจากรูป'}
        </button>
      )}
      {error && <p className="estimate-error">ประเมินไม่สำเร็จ: {error}</p>}
      {items && (
        <div className="estimate-result">
          <p className="estimate-hint">
            ผลประเมินจากรูป (ประมาณ ไม่ใช่ค่าที่แน่นอน) แก้ตัวเลขหรือติ๊กออกได้ก่อนกดเพิ่ม
          </p>
          {items.length === 0 && <p>ไม่พบอาหารในรูป ลองถ่ายใหม่ให้เห็นจานชัดขึ้น</p>}
          {items.map((it, i) => (
            <div key={i} className="estimate-row">
              <input
                type="checkbox"
                checked={it.use}
                onChange={(e) => update(i, { use: e.target.checked })}
                aria-label={`เลือก ${it.name}`}
              />
              <div className="estimate-main">
                <input
                  className="estimate-name"
                  value={it.name}
                  onChange={(e) => update(i, { name: e.target.value })}
                />
                <span className="estimate-sub">
                  {it.portion ? `${it.portion} · ` : ''}
                  {CONFIDENCE_LABEL[it.confidence ?? 'medium']}
                  {it.matches_known ? ` · ตรงกับ "${it.matches_known}"` : ''}
                </span>
              </div>
              <input
                type="number"
                className="estimate-num"
                value={it.kcal}
                onChange={(e) => update(i, { kcal: Number(e.target.value) })}
                aria-label="kcal"
              />
              <span className="estimate-unit">kcal</span>
              <input
                type="number"
                className="estimate-num"
                value={it.protein_g}
                onChange={(e) => update(i, { protein_g: Number(e.target.value) })}
                aria-label="โปรตีน (g)"
              />
              <span className="estimate-unit">g</span>
            </div>
          ))}
          {notes && <p className="estimate-hint">{notes}</p>}
          <div className="estimate-total">
            รวม <strong>{Math.round(total.kcal)}</strong> kcal · โปรตีน <strong>{Math.round(total.protein)}</strong> g
          </div>
          <div className="meal-card-actions">
            <button type="button" onClick={apply} disabled={busy || items.every((i) => !i.use)}>
              {busy ? 'กำลังเพิ่ม...' : '+ เพิ่มเข้ามื้อนี้'}
            </button>
            <button type="button" onClick={() => setItems(null)} disabled={busy}>
              ปิด
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
