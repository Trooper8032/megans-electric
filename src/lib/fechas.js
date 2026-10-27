const p2 = n => String(n).padStart(2, '0')
export const fechaISO = (d = new Date()) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`
export const horaHM = (d = new Date()) => `${p2(d.getHours())}:${p2(d.getMinutes())}`
export const aFecha = iso => { const [y, m, d] = String(iso).split('-').map(Number); return new Date(y, m - 1, d, 12) }
export const sumarDias = (iso, n) => { const d = aFecha(iso); d.setDate(d.getDate() + n); return fechaISO(d) }
export const esFechaISO = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s)) && fechaISO(aFecha(s)) === s
export const fechaLarga = iso => iso ? aFecha(iso).toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '—'
export const fechaCorta = iso => iso ? aFecha(String(iso).slice(0, 10)).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
export const diaCorto = iso => aFecha(iso).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })
export const mesCorto = ym => aFecha(ym + '-01').toLocaleDateString('es-PE', { month: 'short', year: '2-digit' })
export const fechaHora = iso => iso ? new Date(iso).toLocaleString('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'
export const diasEntre = (a, b) => Math.round((aFecha(b) - aFecha(a)) / 86400000)
export const semanaDe = iso => { const d = aFecha(iso); const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const dia = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - dia); const ini = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return `${t.getUTCFullYear()}-S${p2(Math.ceil(((t - ini) / 86400000 + 1) / 7))}` }
