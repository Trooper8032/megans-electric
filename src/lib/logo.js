// Carga el logo (PNG transparente) como data URL para los PDF, sin canvas.
let memo = null
export async function logoDataUrl() {
  if (memo) return memo
  try {
    const r = await fetch(import.meta.env.BASE_URL + 'img/logo-640.png'); if (!r.ok) return null
    const b = new Uint8Array(await r.arrayBuffer()); let s = ''
    for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode(...b.subarray(i, i + 8192))
    memo = 'data:image/png;base64,' + btoa(s); return memo
  } catch { return null }
}
