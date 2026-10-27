// Compara lo que Whisper escuchó (transcripciones.json) con lo esperado (corpus.json). Datos fuera del repo.
import fs from 'node:fs'
import { entenderOrden, entenderVenta, sinTilde } from '../src/lib/voz.js'
import { CATALOGO } from '../src/data/catalogo.js'
const D = process.env.PRUEBAS || '/workspace/megans-ia-pruebas'
const productos = CATALOGO.map(([id, nombre, categoria, precio]) => ({ id, nombre, categoria, precio, activo: true }))
const corpus = Object.fromEntries(JSON.parse(fs.readFileSync(`${D}/corpus.json`)).map(c => [c.id, c]))
const tr = JSON.parse(fs.readFileSync(`${D}/transcripciones.json`))
const nom = l => l.nombre ?? null
const res = {}, fallos = []
const lineasOk = (got, exp) => exp.length === got.length && exp.every(([q, n], i) => got[i].cantidad === q && (n === null || (n.startsWith('?') ? (nom(got[i]) === n.slice(1) || (got[i].opciones || []).some(o => o.nombre === n.slice(1))) : nom(got[i]) === n)))
for (const { archivo, escuchado, ms } of tr) {
  const [id, voz] = archivo.split('-'), e = corpus[id]; const cat = id[0]
  let o = entenderOrden(escuchado, productos); if (o.tipo === 'venta' || cat === 'v') o = { ...o, ...entenderVenta(escuchado, productos), tipo: o.tipo }
  const ok = [o.tipo === e.tipo || (e.tipo === 'venta' && o.tipo === 'venta')]
  if (e.lineas) ok.push(lineasOk(o.lineas || [], e.lineas))
  if (e.que) ok.push(o.que === e.que)
  if (e.producto) ok.push(o.producto?.nombre === e.producto || o.producto?.producto?.nombre === e.producto)
  if (e.medio) ok.push(o.medio === e.medio)
  if (e.cliente) ok.push(sinTilde(o.cliente || '').includes(sinTilde(e.cliente).split(' ')[0]))
  if (e.numero) ok.push(o.numero === e.numero)
  const bien = ok.every(Boolean); const k = `${cat}-${voz}`
  res[k] ??= { bien: 0, total: 0, ms: [] }; res[k].total++; res[k].ms.push(ms); if (bien) res[k].bien++
  else fallos.push(`${archivo}: «${escuchado}» → ${o.tipo} ${JSON.stringify({ que: o.que, medio: o.medio, cliente: o.cliente, lineas: (o.lineas || []).map(l => [l.cantidad, nom(l), l.duda ? 'duda' : ''].join(' ')) })}`)
}
const N = { v: 'Venta', i: 'Ingreso', q: 'Pregunta', c: 'Comando' }
for (const [k, r] of Object.entries(res).sort()) console.log(`${N[k[0]]} ${k.slice(2)}: ${r.bien}/${r.total}  (mediana ${r.ms.sort((a, b) => a - b)[r.ms.length >> 1]} ms)`)
const t = Object.values(res); console.log(`TOTAL: ${t.reduce((a, r) => a + r.bien, 0)}/${t.reduce((a, r) => a + r.total, 0)}`)
console.log('\nFallos:\n' + fallos.join('\n'))
