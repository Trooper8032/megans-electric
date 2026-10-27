export const r2 = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100
export const soles = n => 'S/ ' + Number(n || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const numero = n => Number(n ?? 0).toLocaleString('es-PE')
export const aMonto = t => { const s = String(t ?? '').trim().replace(',', '.'); if (!/^\d+(\.\d{1,2})?$/.test(s)) return null; return r2(parseFloat(s)) }
