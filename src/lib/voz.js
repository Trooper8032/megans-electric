// Entender lo que se dicta (o se lee en una foto) y relacionarlo con el catálogo. Funciones puras, sin navegador:
// se prueban con Vitest. Reutiliza el enfoque de RiverMarket (ia.js): números en palabras → cifras y reglas simples.
// Nada de aquí cambia datos: solo propone. Los cambios pasan siempre por dominio.js (permisos en la capa de datos).
import { ID_OTROS } from './dominio.js'

export const sinTilde = s => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

// ---------- Números en español → cifras ("cuarenta y cinco" → 45) ----------
const NUM = { cero: 0, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19, veinte: 20, veintiun: 21, veintiuno: 21, veintiuna: 21, veintidos: 22, veintitres: 23, veinticuatro: 24, veinticinco: 25, veintiseis: 26, veintisiete: 27, veintiocho: 28, veintinueve: 29, treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90, cien: 100, ciento: 100, doscientos: 200, doscientas: 200, trescientos: 300, trescientas: 300, cuatrocientos: 400, cuatrocientas: 400, quinientos: 500, quinientas: 500, seiscientos: 600, seiscientas: 600, setecientos: 700, setecientas: 700, ochocientos: 800, ochocientas: 800, novecientos: 900, novecientas: 900, mil: 1000 }
// Errores típicos de Whisper al oír frases de tienda (medidos con audios de prueba). Solo corrige palabras sueltas muy específicas.
const OIDO = [
  [/\b(?:ya|y\s*a)\s*(?:pe|p|ve|be|per?)\b'?|\bjp\b|\bdi?ope\b|\byapé\b/gi, ' yape '],
  [/\b(?:a|lo?s\s+a)?plink?\b/gi, ' plin '],
  [/\b(?:qui[dl]+ente|quillente|tienta|clente|cliendte)\b/gi, ' cliente '], [/\bper\s*cliente\b|\bpercliente\b/gi, ' yape cliente '],
  [/\binefectivo\b/gi, 'en efectivo'], [/,?\s*(?:él\s+)?\bapag[oó](?![a-z])/gi, ' ya pagó'], [/\bme\s*deben\b|\bmedeben\b|\bmi deben\b/gi, 'me deben'],
  [/\btienes\s+me deben\b/gi, 'quienes me deben'], [/\bdebes la tienda\b/gi, 'debe la tienda'], [/\bhabre\b/gi, 'abre'], [/\banuna\b/gi, 'anula'],
  [/\bmaca como\b/gi, 'marca como'], [/\bcobra da\b/gi, 'cobrada'], [/\ben\s+chuf\w*/gi, ' enchufe'], [/\bdosenchufe/gi, 'dos enchufe'],
  [/\b(\d+)\.(?=\s+[a-záéíóúñ])/gi, '$1'],
]
export const corregirOido = t => OIDO.reduce((a, [re, r]) => a.replace(re, r), String(t ?? '')).replace(/[ \t]+/g, ' ')
export function numerosATexto(t) {
  t = corregirOido(t)
  t = String(t ?? '').replace(/\b(\d+)\s*y\s*medi[oa]\b/gi, (m, n) => String(+n + 0.5)).replace(/\bmedia\s+docena\b/gi, '6')
  const tk = t.split(/(\s+|[,.;:!?¿¡])/), out = []; let i = 0
  while (i < tk.length) {
    const k = sinTilde(tk[i])
    if (k in NUM) {
      let total = 0, cur = 0, j = i, ult = i
      while (j < tk.length) {
        const w = sinTilde(tk[j])
        if (/^\s+$/.test(tk[j]) || tk[j] === '') { j++; continue }
        if (w in NUM) { const v = NUM[w]; if (v === 1000) { cur = (cur || 1) * 1000; total += cur; cur = 0 } else if (v === 100 && cur > 0 && cur < 10) cur *= 100; else if (v < 10 && cur % 10 !== 0) break; else cur += v; ult = j; j++; continue }
        if (w === 'y' && cur >= 20 && cur % 10 === 0) { let n = j + 1; while (n < tk.length && /^\s*$/.test(tk[n])) n++; if (n < tk.length && sinTilde(tk[n]) in NUM && NUM[sinTilde(tk[n])] < 10) { j = n; continue } }
        break
      }
      out.push(String(total + cur)); i = ult + 1; continue
    }
    out.push(tk[i]); i++
  }
  return out.join('')
}

// ---------- Normalización para comparar con el catálogo ----------
const SINONIMOS = [
  [/\btoma\s*corrientes?\b|\btomacorrientes?\b|\btomacorriente\b/g, 'toma corriente'],
  [/\b(?:sockets?|soquets?|soquetes?|sokets?|zoquets?|zocalos?|socates?|socate)\b/g, 'socket'],
  [/\b(?:apagadores?|interuptor(?:es)?|interrutor(?:es)?|interruptores)\b/g, 'interruptor'],
  [/\b(?:sencillos?|sencillas?)\b/g, 'simple'],
  [/\bcajas? de paso\b/g, 'caja de pase'], [/\bpase?s\b/g, 'pase'],
  [/\bc\s*\/\s*/g, 'con '], [/\bplafones\b/g, 'plafon'], [/\bmega\s+luz\b/g, 'megaluz'], [/\be\s*pen\b/g, 'epen'],
  [/\bpolo\b/g, 'polos'], [/\b(\d+)\s*polo\b/g, '$1 polos']
]
const STOP = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'con', 'y', 'en', 'para', 'por', 'un', 'una', 'x', 'a', 'numero', 'nro', 'n', 'no', 'num', 'tipo', 'marca', 'modelo', 'color', 'und', 'unid', 'unidad', 'unidades', 'pza', 'pzas', 'piezas', 'pieza', 'cj'])
// raíz simple: quita plural y género para que "interruptores simples" = "Interruptor simple", "empotrada" = "empotrado"
export const raiz = w => {
  w = sinTilde(w).replace(/[^a-z0-9ñ]/g, '')
  if (/^\d/.test(w)) return w
  if (w.length > 3 && w.endsWith('s')) w = w.slice(0, -1)
  if (/[aeiou]re$/.test(w) && w.length > 5) w = w.slice(0, -1)
  if (w.length >= 5 && /[ao]$/.test(w)) w = w.slice(0, -1)
  return w
}
export function tokens(texto) {
  let t = sinTilde(texto)
  for (const [re, r] of SINONIMOS) t = t.replace(re, r)
  t = t.replace(/(\d)\s*[x×*]\s*(?=\d)/g, '$1 ').replace(/\bx\s*(?=\d)/g, ' ').replace(/(\d+)\s+por\s+(?=\d)/g, '$1 ').replace(/[^a-z0-9ñ.]+/g, ' ').replace(/\.(?!\d)/g, ' ')
  return t.split(/\s+/).filter(Boolean).map(raiz).filter(w => w && !STOP.has(w))
}
function lev(a, b) {
  if (a === b) return 0; const m = a.length, n = b.length; if (!m || !n) return Math.max(m, n)
  let prev = Array.from({ length: n + 1 }, (_, j) => j)
  for (let i = 1; i <= m; i++) { const cur = [i]; for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = cur }
  return prev[n]
}
const esNum = w => /^\d/.test(w)
export function parecido(a, b) {
  if (a === b) return 1
  if (esNum(a) || esNum(b)) return 0
  if (Math.min(a.length, b.length) >= 4 && (a.startsWith(b) || b.startsWith(a))) return 0.85
  const r = 1 - lev(a, b) / Math.max(a.length, b.length)
  return r >= 0.72 ? r : 0
}
// Puntaje 0..1 entre lo dicho y un nombre del catálogo. Los números (2 polos, x3, 10x10x7) deben coincidir.
export function puntaje(qTok, pTok) {
  const qn = qTok.filter(w => !esNum(w)), qd = qTok.filter(esNum), pn = pTok.filter(w => !esNum(w)), pd = pTok.filter(esNum)
  if (!qn.length || !pn.length) return 0
  const mejor = (w, lista) => lista.reduce((s, x) => Math.max(s, parecido(w, x)), 0)
  const prec = qn.reduce((s, w) => s + mejor(w, pn), 0) / qn.length, rec = pn.reduce((s, w) => s + mejor(w, qn), 0) / pn.length
  let f = 1
  if (qd.length) { const resto = [...pd]; let ok = 0; for (const d of qd) { const k = resto.indexOf(d); if (k >= 0) { ok++; resto.splice(k, 1) } } f = ok === qd.length ? 1 : 0.25 + 0.35 * ok / qd.length }
  else if (pd.length) f = 0.93
  return Math.round((0.65 * prec + 0.35 * rec) * f * 1000) / 1000
}
const tokCache = new WeakMap()
const tokDe = p => { let t = tokCache.get(p); if (!t) { t = tokens(p.nombre); tokCache.set(p, t) } return t }
// Busca un producto. Devuelve el mejor, las opciones parecidas y si hay duda.
export function buscarProducto(texto, productos, { minimo = 0.6 } = {}) {
  const q = tokens(texto)
  const lista = productos.filter(p => p.id !== ID_OTROS && p.activo !== false).map(p => ({ p, s: puntaje(q, tokDe(p)) })).filter(x => x.s >= 0.45).sort((a, b) => b.s - a.s)
  const top = lista[0]
  if (!top || top.s < minimo) return { producto: null, puntaje: top?.s || 0, opciones: lista.slice(0, 3).map(x => ({ id: x.p.id, nombre: x.p.nombre, puntaje: x.s })), duda: false }
  const cerca = lista.filter(x => x.s >= top.s - 0.06)
  return { producto: top.p, puntaje: top.s, opciones: (cerca.length > 1 ? cerca : lista).slice(0, 4).map(x => ({ id: x.p.id, nombre: x.p.nombre, puntaje: x.s })), duda: cerca.length > 1 || top.s < 0.72 }
}

// ---------- Partes comunes de una orden ----------
const MEDIO_RE = /\b(yape(?:o|a|ó|aron)?|yapearon|plin(?:eo|ea|eó)?|efectivo|al contado|contado|cash|sencillo en mano|pendiente|fiado|al fiado|a cuenta|por cobrar|me debe|le debe|queda debiendo|credito)\b/gi
export function medioDe(t) {
  const m = [...sinTilde(t).matchAll(new RegExp(MEDIO_RE.source.replace('ó', 'o').replace('eó', 'eo'), 'gi'))].pop()
  if (!m) return null
  const w = m[1]
  return /^yap/.test(w) ? 'Yape' : /^plin/.test(w) ? 'Plin' : /efectivo|contado|cash|mano/.test(w) ? 'Efectivo' : 'Pendiente'
}
const capNombre = s => s.toLowerCase().replace(/(^|\s)(\p{L})/gu, (m, a, b) => a + b.toUpperCase())
function sacarCliente(t) {
  const re = /\b(?:cliente|clienta|a nombre de|para (?:el|la) (?:senor|señor|senora|señora|sr\.?|sra\.?)|para (?:don|dona|doña))\s*[:,]?\s*([^,.;\n]+)/i
  const m = re.exec(t); if (!m) return { cliente: '', resto: t }
  let n = m[1].replace(/\b(?:paga|pago|pagó|pagando|con|en|por|yape\w*|plin\w*|efectivo|al contado|contado|pendiente|fiado|operaci[oó]n\b.*|y)\b.*$/i, '').replace(/[^\p{L}\s'.-]/gu, ' ').replace(/\s+/g, ' ').trim()
  if (n.split(' ').length > 4) n = n.split(' ').slice(0, 4).join(' ')
  return { cliente: n.length >= 2 ? capNombre(n) : '', resto: t.slice(0, m.index) + ' , ' + t.slice(m.index + m[0].length) }
}
function sacarOperacion(t) {
  const m = /\b(?:n[uú]mero de\s+)?(?:operaci[oó]n|op\.?|c[oó]digo de operaci[oó]n)\s*(?:n[uú]mero|nro\.?|n\.?[º°o]?)?\s*[:#]?\s*((?:\d[\s-]?){4,20})/i.exec(t)
  return m ? { operacion: m[1].replace(/[\s-]/g, ''), resto: t.replace(m[0], ' , ') } : { operacion: '', resto: t }
}
const VERBOS = /^(?:(?:vende(?:r|me)?|venta(?: de)?|vendo|vendi|vendí|agrega(?:r|me)?|anota(?:r)?|pon(?:er|me)?|dame|deme|quiero|llevo|lleva|se lleva|son|es|registra(?:r)?|cobra(?:r)?|necesito|me da|me das|y|tambien|también|ademas|además)\s+)+/i
const UNIDAD = /^(?:unidades?|und|unid|piezas?|pzas?|cajas? de\s+(?=\d)|paquetes? de)\s+(?:de\s+)?/i
export function cantidadInicial(seg) {
  let s = seg.trim().replace(VERBOS, ''), cantidad = null
  let m = /^(\d+(?:[.,]\d+)?)\s+(?:docenas?|doc)\s+(?:de\s+)?/i.exec(s); if (m) { cantidad = Number(m[1].replace(',', '.')) * 12; s = s.slice(m[0].length) }
  if (cantidad === null && (m = /^(?:una|1)?\s*docenas?\s+(?:de\s+)?/i.exec(s)) && m[0].trim()) { cantidad = 12; s = s.slice(m[0].length) }
  if (cantidad === null && (m = /^(?:un\s+)?par(?:es)?\s+(?:de\s+)?/i.exec(s))) { cantidad = 2; s = s.slice(m[0].length) }
  if (cantidad === null && (m = /^(\d+(?:[.,]\d+)?)\s+(?=\D)/.exec(s))) {
    // "24 polos" sin palabra antes es nombre (caja de 24 polos dicho a medias): solo es cantidad si no sigue "polos" o una medida
    if (!/^\d+(?:[.,]\d+)?\s+(?:polos?|x\s*\d|por\s+\d)/i.test(s)) { cantidad = Number(m[1].replace(',', '.')); s = s.slice(m[0].length) }
  }
  s = s.replace(UNIDAD, '').replace(VERBOS, '')
  return { cantidad: cantidad ?? 1, dicha: cantidad !== null, resto: s.trim() }
}
function sacarPrecio(seg) {
  const m = /\b(?:a|en|por|precio(?: de)?|cada uno a|cada una a)\s+(?:s\/\.?\s*)?(\d+(?:[.,]\d{1,2})?)\s*(?:soles|sol|lucas)\b(?:\s*cada\s*(?:uno|una))?/i.exec(seg) || /\b(?:a|en)\s+s\/\.?\s*(\d+(?:[.,]\d{1,2})?)/i.exec(seg)
  return m ? { precio: Number(m[1].replace(',', '.')), resto: seg.replace(m[0], ' ') } : { precio: null, resto: seg }
}
export function partirItems(t) {
  return t.split(/\s*(?:[,;]|\.(?!\d)|\by\s+(?:tambi[eé]n|adem[aá]s)\b|\badem[aá]s\b|\bm[aá]s\b(?=\s+\d))\s*|\s+y\s+(?=\d|una?\b|docena|par\b)/i).map(s => s.trim()).filter(s => /[a-zñáéíóú]{3,}/i.test(s))
}
function lineasDe(texto, productos, { precios = false } = {}) {
  return partirItems(texto).map(seg => {
    const pr = precios ? sacarPrecio(seg) : { precio: null, resto: seg }
    const { cantidad, dicha, resto } = cantidadInicial(pr.resto)
    if (!/[a-zñáéíóú]{3,}/i.test(resto)) return null
    const b = buscarProducto(resto, productos)
    const p = b.producto, stockOk = p ? p.stock : null
    return { texto: seg, nombreDicho: resto, cantidad, cantidadDicha: dicha, productoId: p?.id || null, nombre: p?.nombre || '', puntaje: b.puntaje, opciones: b.opciones, duda: !p || b.duda, encontrado: !!p, stock: stockOk, ...(pr.precio ? { precio: pr.precio } : {}) }
  }).filter(Boolean)
}

// ---------- 1) Venta por voz ----------
// "Dos cables número 12 y un tomacorriente doble, Yape, cliente Juan"
export function entenderVenta(texto, productos) {
  let t = numerosATexto(' ' + String(texto || '').replace(/\s+/g, ' ') + ' ')
  const cl = sacarCliente(t); t = cl.resto
  const op = sacarOperacion(t); t = op.resto
  const medio = medioDe(t)
  t = t.replace(/\b(?:(?:y\s+)?(?:paga|pago|pagó|pagaron|pagando|pagará|cancela|cancelo|canceló)(?:\s+(?:con|en|por|al))?)\b/gi, ' , ').replace(MEDIO_RE, ' , ').replace(/\b(?:con|en|por)\s*(?=,)/gi, ' ')
  const lineas = lineasDe(t, productos, { precios: true })
  return { texto: String(texto || '').trim(), lineas, medio, cliente: cl.cliente, operacion: op.operacion }
}

// ---------- 2) Ingreso de mercadería por voz ----------
const VERBO_INGRESO = /^\s*(?:(?:ya\s+)?(?:llegaron|lleg[oó]|llegan|ingresa(?:r|ron)?|ingres[eé]|ingreso(?: de)?|entraron|entr[oó]|entra(?:n)?|recib[ií](?:mos)?|compr[eé]|compramos|agrega(?:r)? al stock|suma(?:r)?(?: al stock)?|mete(?:r)?(?: al stock)?|reponer|repon(?:go|emos)?|lleg[oó] mercader[ií]a(?: de)?)\b[\s:,]*)+/i
export const esIngreso = t => VERBO_INGRESO.test(sinTilde(t).replace(/^\s*(?:oye|ya|bueno|ok|okey)\s*,?\s*/, ''))
export function entenderIngreso(texto, productos) {
  let t = numerosATexto(' ' + String(texto || '').replace(/\s+/g, ' ') + ' ').replace(/^\s*(?:oye|ya|bueno|ok|okey)\s*,?\s*/i, '')
  t = t.replace(VERBO_INGRESO, '').replace(/\b(?:al stock|al almac[eé]n|a la tienda|para la tienda|del proveedor[^,.;]*|de parte de[^,.;]*)\b/gi, ' ')
  const lineas = lineasDe(t, productos)
  return { texto: String(texto || '').trim(), lineas }
}

// ---------- 3) y 4) Preguntas y comandos ----------
const RUTAS_VOZ = [[/nueva venta|vender/, 'vender'], [/inventario|stock completo|productos/, 'inventario'], [/(?:mis\s+)?ventas(?: del dia)?|guias/, 'ventas'], [/caja/, 'caja'], [/tiendas?/, 'tiendas'], [/cuaderno/, 'cuaderno'], [/conciliacion|verificar pagos/, 'conciliacion'], [/etiquetas|escaneo/, 'etiquetas'], [/inicio|panel|principal/, 'inicio'], [/mas opciones|ajustes|respaldo/, 'mas']]
const refVenta = t => { const m = /\b(?:g\s*0*0?1\s*[-\s]?\s*)?(?:venta|guia|gu[ií]a|numero|n[uú]mero|nro)?\s*(?:numero|n[uú]mero|nro)?\s*0*(\d{1,6})\b/.exec(t); return m ? Number(m[1]) : null }
export function entenderOrden(texto, productos = []) {
  const crudo = String(texto || '').trim(), t = sinTilde(numerosATexto(crudo)).replace(/[¿?¡!]/g, ' ').replace(/[.;]+\s*$/, '').replace(/\s+/g, ' ').trim()
  if (!t) return { tipo: 'nada', texto: crudo }
  if (/\b(anula\w*|devuelv\w*|devolu\w*|devolver|elimina\w*|borra\w*|reabr\w*|restaur\w*|restablec\w*|desactiva\w*)\b/.test(t)) return { tipo: 'bloqueado', texto: crudo, accion: /anul/.test(t) ? 'anular' : /devol|devuel/.test(t) ? 'devolver' : 'otra', ref: refVenta(t) }
  if (esIngreso(crudo)) return { tipo: 'ingreso', texto: crudo, ...entenderIngreso(crudo, productos) }
  if (/\b(cobra\w*|marca\w* .*cobrad\w*|ya pag[oó]|pag[oó] (?:su|el|la|lo)|cancel[oó] (?:su|el|la)|ya cancel[oó]|ya me pag[oó])\b/.test(t) && !/\bcuanto\b/.test(t)) {
    const n = refVenta(t.replace(/\b(?:operacion|op)\s*\d+/g, '')), medio = medioDe(t.replace(/\bpendiente\b/g, ''))
    const op = sacarOperacion(t).operacion
    const antes = /^(?:(?:el|la|don|dona|senor|senora|cliente)\s+)?([a-zñ]+(?:\s+(?!ya\b|me\b)[a-zñ]+)?)\s+(?:ya\s+)?(?:me\s+)?(?:pago|cancelo)\b/.exec(t)
    if (antes && !/^(ya|me|se|el|la|marca|cobra)/.test(antes[1])) return { tipo: 'cobrar', texto: crudo, numero: n, medio, operacion: op, cliente: antes[1] }
    const cli = /(?:de|a|cliente|clienta)\s+(?:la\s+|el\s+|don\s+|dona\s+|senor\s+|senora\s+)?([a-zñ]+(?:\s+[a-zñ]+)?)(?=\s+(?:con|en|por|que|ya|y)\b|$)/.exec(t.replace(/\b(?:venta|guia|pendiente|cobrado|cobrada|deuda|cuenta)\b/g, ' ').replace(/\s+/g, ' ').replace(/\b(?:yape\w*|plin\w*|efectivo|operacion\s*\d+)\b/g, ' ').trim())
    return { tipo: 'cobrar', texto: crudo, numero: n, medio, operacion: op, cliente: cli && !/^\d/.test(cli[1]) && !['la', 'el', 'su', 'lo', 'mi', 'venta'].includes(cli[1]) ? cli[1] : '' }
  }
  if (/\b(busca\w*|encuentra|muestra\w*|abre|abrir|ver|ensena\w*)\b.*\b(venta|guia|ventas|guias)\b/.test(t) && !/nueva venta/.test(t)) {
    const n = refVenta(t), cli = /\b(?:de|del cliente|de la clienta|cliente)\s+(?:la\s+|el\s+|don\s+|dona\s+)?([a-zñ]+(?:\s+[a-zñ]+)?)\s*$/.exec(t)
    return { tipo: 'buscar', texto: crudo, numero: n, cliente: cli && !/^(hoy|ayer)$/.test(cli[1]) ? cli[1] : '' }
  }
  if (/^(?:ir a|ve a|vamos a|llevame a|abre|abrir|muestrame|ensename|quiero ver)\b/.test(t)) { const r = RUTAS_VOZ.find(([re]) => re.test(t)); if (r) return { tipo: 'ir', texto: crudo, ruta: r[1] } }
  const ayer = /\bayer\b/.test(t)
  if (/\b(utilidad|ganancia|gane|ganamos|ganado)\b/.test(t)) return { tipo: 'pregunta', que: 'utilidad', ayer, texto: crudo }
  if (/\b(stock bajo|poco stock|por acabarse|se (?:estan|esta) acabando|se acaban|falta comprar|hay que comprar|reponer|por reponer|agotad\w*|sin stock)\b/.test(t)) return { tipo: 'pregunta', que: 'stockBajo', texto: crudo }
  if (/\btienda\b/.test(t) && /\b(debe|deben|deuda|adeuda|saldo|cuenta)\b/.test(t)) { const m = /\btienda\s+([a-z0-9ñ]+(?:\s+[a-z0-9ñ]+)?)/.exec(t); return { tipo: 'pregunta', que: 'deuda', tienda: m ? m[1] : '', texto: crudo } }
  if (/\b(pendientes|por cobrar|me deben|nos deben|quien(?:es)? (?:me |nos )?debe\w*|fiados?)\b/.test(t)) return { tipo: 'pregunta', que: 'pendientes', texto: crudo }
  if (/\bcaja\b/.test(t) && !/\bcajas?\s+(?:de|medidor|pase|piramidal)\b/.test(t)) return { tipo: 'pregunta', que: 'caja', ayer, texto: crudo }
  if (/\b(costo|costa|costaba|costo|me cuesta comprar|precio de compra)\b/.test(t) && !/\bcuesta\b/.test(t.replace('me cuesta comprar', ''))) return { tipo: 'pregunta', que: 'costo', producto: productoDe(t, productos, /.*\b(?:costo|cuesta comprar|precio de compra)\b\s*(?:del|de|las|los|la|el)?\s*/), texto: crudo }
  if (/\b(precio|cuesta|cuestan|vale|valen|a como|a cuanto)\b/.test(t)) return { tipo: 'pregunta', que: 'precio', producto: productoDe(t, productos, /.*\b(?:precio|cuestan?|valen?|a como (?:esta|estan|es|son)?|a cuanto (?:esta|estan|es|son)?)\b\s*(?:del|de|las|los|la|el)?\s*/), texto: crudo }
  if (/\b(vend\w*|ventas)\b/.test(t)) return { tipo: 'pregunta', que: 'ventas', ayer, texto: crudo }
  if (/\b(cuant[oa]s?|stock|hay|quedan?|tenemos|tengo|queda)\b/.test(t)) {
    const resto = t.replace(/^.*?\b(?:cuant[oa]s?|stock(?: de)?|hay|quedan?|tenemos|tengo)\b\s*/, '').replace(/\b(?:quedan?|hay|tenemos|tengo|en stock|todavia|aun|ahora|en la tienda)\b/g, ' ').replace(/^\s*(?:de|del)\s+/, '').trim()
    return { tipo: 'pregunta', que: 'stock', producto: productoDe(resto, productos, null), texto: crudo }
  }
  // ¿parece una venta dictada aquí? (cantidad + producto)
  const v = productos.length ? entenderVenta(crudo, productos) : null
  if (v && v.lineas.some(l => l.encontrado)) return { tipo: 'venta', texto: crudo, venta: v }
  return { tipo: 'nada', texto: crudo }
}
function productoDe(t, productos, corte) {
  const q = (corte ? t.replace(corte, '') : t).replace(/\b(?:hoy|ahora|cada uno|cada una|la unidad|unidad|soles)\b/g, ' ').trim()
  if (!q || !productos.length) return { dicho: q, producto: null, opciones: [] }
  const b = buscarProducto(q, productos, { minimo: 0.55 })
  return { dicho: q, producto: b.producto ? { id: b.producto.id, nombre: b.producto.nombre } : null, opciones: b.opciones, duda: b.duda }
}
