// Estimate calories + protein of a meal from a photo using Gemini vision.
// The image arrives as base64 (the browser resizes it first). The Gemini key
// lives only here as a Supabase secret (same GEMINI_API_KEY the other apps use).
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')!
const GEMINI_MODEL = 'gemini-flash-lite-latest'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SYSTEM_INSTRUCTION = `คุณคือผู้ช่วยประเมินพลังงานและโปรตีนจากรูปอาหาร (เน้นอาหารไทยและของที่หาซื้อได้ในไทย)
กติกา:
- แยกรายการอาหาร/เครื่องดื่มที่เห็นในรูปเป็นรายการๆ (สูงสุด 8 รายการ) ถ้าเป็นจานเดียวให้แยกส่วนหลักๆ เช่น ข้าว, เนื้อสัตว์, ไข่
- ถ้าเห็นฉลากโภชนาการบนบรรจุภัณฑ์ ให้ใช้ค่าจากฉลากเป็นหลักและบอกว่า confidence = high
- ประเมินปริมาณจากขนาดภาชนะ/ช้อนส้อม/มือ ให้เขียน portion สั้นๆ เช่น "ข้าว 2 ทัพพี", "ไข่ต้ม 3 ฟอง"
- ถ้านายมีรายการ known_foods และของในรูปตรงกับรายการนั้นชัดเจน ให้ใส่ชื่อเดิมแบบตรงตัวใน matches_known (ไม่งั้นเว้นว่าง) และใช้ค่า kcal/โปรตีนของรายการนั้นคูณตามปริมาณ
- ประเมินแบบระมัดระวัง ไม่ต้องปัดขึ้นให้ดูเยอะ ถ้าไม่แน่ใจให้ confidence = low
- ตอบเป็น JSON ตาม schema เท่านั้น ชื่อรายการเป็นภาษาไทย`

const responseSchema = {
  type: 'OBJECT',
  properties: {
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' },
          portion: { type: 'STRING' },
          kcal: { type: 'NUMBER' },
          protein_g: { type: 'NUMBER' },
          confidence: { type: 'STRING', enum: ['low', 'medium', 'high'] },
          matches_known: { type: 'STRING' },
        },
        required: ['name', 'kcal', 'protein_g', 'confidence'],
      },
    },
    notes: { type: 'STRING' },
  },
  required: ['items'],
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { image_base64, mime_type, known_foods } = await req.json()
    if (!image_base64) throw new Error('missing image_base64')

    // Keep the prompt small: names + per-unit values only, capped.
    const known = Array.isArray(known_foods)
      ? known_foods
          .slice(0, 150)
          .map((f: { name: string; kcal: number | null; protein: string | null }) =>
            `${f.name} | ${f.kcal ?? '?'} kcal | ${f.protein ?? '?'}`,
          )
          .join('\n')
      : ''

    const prompt = known
      ? `ประเมินมื้อในรูปนี้\n\nknown_foods (ชื่อ | kcal ต่อหน่วย | โปรตีน):\n${known}`
      : 'ประเมินมื้อในรูปนี้'

    const body = JSON.stringify({
      contents: [{
        role: 'user',
        parts: [
          { text: prompt },
          { inlineData: { mimeType: mime_type ?? 'image/jpeg', data: image_base64 } },
        ],
      }],
      systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
      generationConfig: { responseMimeType: 'application/json', responseSchema, temperature: 0.2 },
    })

    let res: Response | null = null
    let lastErr = ''
    for (let attempt = 0; attempt < 3; attempt++) {
      res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body },
      )
      if (res.ok) break
      lastErr = await res.text()
      if (res.status !== 503 && res.status !== 429) break
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)))
    }
    if (!res!.ok) throw new Error(`Gemini API error ${res!.status}: ${lastErr}`)

    const data = await res!.json()
    const text = data.candidates?.[0]?.content?.parts?.find((p: { text?: string }) => p.text)?.text ?? '{}'
    const parsed = JSON.parse(text)

    return new Response(JSON.stringify({ items: parsed.items ?? [], notes: parsed.notes ?? '' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
