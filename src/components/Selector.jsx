// Selector de productos con carrito (venta, agregar a una venta y envío a tienda). Letra grande, pocas opciones.
// Flujo rápido: 1) escribe y elige del desplegable (filtra mientras escribes)  2) ajusta la cantidad  3) Cobrar.
import { useEffect, useMemo, useState } from 'react'
import Foto from './Foto.jsx'
import Escaner from './Escaner.jsx'
import { Icono } from './Iconos.jsx'
import { Campo } from './ui.jsx'
import { soles } from '../lib/dinero.js'
import { ID_OTROS } from '../lib/dominio.js'
import { raiz } from '../lib/voz.js'

// Precio de una línea del carrito: el editado (descuento de mostrador) o el de lista.
export const precioLinea = (i, productos) => i.productoId === ID_OTROS ? Number(i.precio) || 0 : (i.precio !== undefined && i.precio !== '' && Number(String(i.precio).replace(',', '.')) > 0 ? Number(String(i.precio).replace(',', '.')) : (productos.find(p => p.id === i.productoId)?.precio || 0))
export const totalCarro = (items, productos) => Math.round(items.reduce((s, i) => s + i.cantidad * precioLinea(i, productos), 0) * 100) / 100
// Búsqueda por palabras, en cualquier orden, sin tildes ni plurales: «caja 8 polos» encuentra «Caja de 8 polos».
const IGNORAR = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'con', 'para', 'y', 'x'])
export const palabras = t => normalizar(t).replace(/[^a-z0-9ñ.\/ ]+/g, ' ').split(/\s+/).filter(w => w && !IGNORAR.has(w)).map(raiz)
export function coincide(q, p) {
  const qs = palabras(q); if (!qs.length) return true
  const ws = palabras(`${p.nombre} ${p.categoria} ${p.codigo || ''}`), cod = normalizar(p.codigo || '')
  if (cod && normalizar(q.trim()) === cod) return true
  return qs.every(x => ws.some(w => /^\d/.test(x) ? w === x : w.startsWith(x)))
}
export const normalizar = t => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

export default function Selector({ productos, items, onCambio, permitirOtros = true, titulo = 'Productos', editarPrecio = false, fotoLinea = false, rapidos = [], favoritos = null, onFavorito = null, children = null, clase = '' }) {
  const [q, setQ] = useState(''), [cat, setCat] = useState('Todas'), [otro, setOtro] = useState({ detalle: '', precio: '', cantidad: '1' }), [errO, setErrO] = useState(''), [camara, setCamara] = useState(false), [leido, setLeido] = useState('')
  const cats = useMemo(() => ['Todas', ...[...new Set(productos.filter(p => p.id !== ID_OTROS).map(p => p.categoria))]], [productos])
  const nq = normalizar(q.trim())
  const lista = productos.filter(p => p.activo !== false && p.id !== ID_OTROS && (cat === 'Todas' || p.categoria === cat) && coincide(q, p))
  const enCarro = id => items.filter(i => i.productoId === id).reduce((s, i) => s + i.cantidad, 0)
  const idxDe = id => items.findIndex(i => i.productoId === id)
  const agregar = p => { const ex = items.find(i => i.productoId === p.id); if (ex) onCambio(items.map(i => i === ex ? { ...i, cantidad: i.cantidad + 1 } : i)); else onCambio([...items, { productoId: p.id, cantidad: 1 }]) }
  const decimalDe = it => !!productos.find(p => p.id === it.productoId)?.decimales
  const poner = (idx, c) => { const crudo = Number(String(c).replace(',', '.')) || 0, n = Math.max(0, Math.min(9999, decimalDe(items[idx]) ? Math.round(crudo * 1000) / 1000 : Math.floor(crudo))); if (n > 0) onCambio(items.map((it, i) => i === idx ? { ...it, cantidad: n } : it)) }
  const quitar = idx => onCambio(items.filter((_, i) => i !== idx))
  const menos = idx => { const it = items[idx], paso = 1; if (it.cantidad - paso > 0) poner(idx, it.cantidad - paso) }
  const ponerPrecio = (idx, v) => onCambio(items.map((it, i) => i === idx ? { ...it, precio: v.replace(/[^\d.,]/g, '').slice(0, 9) } : it))
  const agregarOtro = () => {
    const precio = Number(String(otro.precio).replace(',', '.')), cantidad = Math.floor(Number(otro.cantidad))
    if (otro.detalle.trim().length < 2) return setErrO('Escribe qué se vendió.')
    if (!(precio > 0)) return setErrO('Escribe el precio.')
    if (!(cantidad > 0)) return setErrO('La cantidad debe ser 1 o más.')
    onCambio([...items, { productoId: ID_OTROS, cantidad, precio, detalle: otro.detalle.trim() }]); setOtro({ detalle: '', precio: '', cantidad: '1' }); setErrO('')
  }
  const nombreDe = i => i.productoId === ID_OTROS ? `Otros: ${i.detalle}` : productos.find(p => p.id === i.productoId)?.nombre
  const listaDe = i => i.productoId === ID_OTROS ? Number(i.precio) : productos.find(p => p.id === i.productoId)?.precio
  const disponible = p => p.activo !== false && p.precio > 0 && p.stock - enCarro(p.id) > 0
  // Venta por escaneo: el lector USB/Bluetooth escribe el código y presiona Enter; la cámara usa el mismo camino.
  const porCodigo = txt => {
    const c = String(txt || '').trim().replace(/\s+/g, '').toUpperCase(), p = c && productos.find(x => x.activo !== false && x.id !== ID_OTROS && String(x.codigo || '').toUpperCase() === c)
    if (!p) { setLeido(`No hay producto con el código «${txt}».`); return false }
    if (!disponible(p)) { setLeido(`${p.nombre}: sin stock o sin precio.`); return true }
    agregar(p); setLeido(`Agregado: ${p.nombre}.`); setQ(''); return true
  }
  const rap = rapidos.map(id => productos.find(p => p.id === id)).filter(p => p && p.activo !== false && p.id !== ID_OTROS && (cat === 'Todas' || p.categoria === cat))
  // Lista siempre visible (no se cierra ni se borra al tocar). Sin texto: favoritos y más vendidos primero.
  const [ver, setVer] = useState(12), [ultimo, setUltimo] = useState(null)
  const visibles = nq ? lista : [...rap, ...lista.filter(p => !rap.includes(p))]
  const opciones = visibles.slice(0, ver)
  useEffect(() => { setVer(12) }, [q, cat])
  const elegir = p => { if (!p || !disponible(p)) return; agregar(p); setLeido(`Agregado: ${p.nombre}.`); setUltimo(p.id) }
  const sumarUno = p => { const i = idxDe(p.id); if (i < 0) return elegir(p); if (disponible(p)) poner(i, items[i].cantidad + 1) }
  const restarUno = p => { const i = idxDe(p.id); if (i < 0) return; if (items[i].cantidad > 1) poner(i, items[i].cantidad - 1); else quitar(i) }
  const alTecla = e => {
    if (e.key === 'Enter' && q.trim()) { e.preventDefault(); const c = q.trim(); if (/^[A-Za-z]{0,4}\d{3,}$/.test(c) && porCodigo(c)) return; if (opciones.length === 1) elegir(opciones[0]) }
  }
  const idLista = `lista-${titulo.replace(/\W+/g, '')}`
  return (
    <div className={`pos ${clase}`}>
      <section aria-label={`Elegir ${titulo.toLowerCase()}`} className="sel">
        <div className="buscador-fila"><div className="buscador"><Icono n="buscar" /><input type="search" aria-controls={idLista} aria-label="Buscar producto por nombre o código" placeholder="Buscar: caja 8 polos, interruptor…" value={q} onChange={e => setQ(e.target.value)} onKeyDown={alTecla} autoComplete="off" enterKeyHint="search" />{q && <button type="button" className="icono-btn limpiar" aria-label="Borrar búsqueda" onClick={() => setQ('')}>×</button>}</div>
          <button type="button" className="btn suave escanear" onClick={() => setCamara(c => !c)} aria-expanded={camara} aria-label={camara ? 'Cerrar cámara' : 'Escanear código con la cámara'}><Icono n="escaner" /><span className="solo-ancho">{camara ? 'Cerrar' : 'Escanear'}</span></button></div>
        <div className="sel-cats" role="group" aria-label="Filtrar por categoría">{cats.map(c => <button key={c} type="button" aria-pressed={cat === c} className={`cat ${cat === c ? 'on' : ''}`} onClick={() => setCat(c)}>{c}</button>)}</div>
        <ul className="sel-lista" id={idLista} aria-label={nq ? 'Productos que coinciden' : 'Productos'}>
          {!nq && rap.length > 0 && <li className="sel-t">Favoritos y más vendidos primero</li>}
          {!opciones.length && <li className="combo-vacio">No hay productos con «{q}»{permitirOtros ? '. Prueba otra palabra o usa “Otros”' : ''}.</li>}
          {opciones.map(p => { const en = enCarro(p.id), quedan = p.stock - en, ok = disponible(p)
            return <li key={p.id} className={`sel-fila ${en ? 'en' : ''} ${ok || en ? '' : 'off'} ${ultimo === p.id ? 'recien' : ''}`}>
              <button type="button" className="sel-prod" disabled={!ok && !en} onClick={() => sumarUno(p)} aria-label={`${p.nombre}, ${p.precio > 0 ? soles(p.precio) : 'sin precio'}, ${quedan > 0 ? `quedan ${quedan}` : 'sin stock'}. Tocar para agregar`}>
                <span className="sel-nom">{favoritos?.includes(p.id) && <Icono n="estrella" tam={13} />}{p.nombre}<small>{p.categoria}{p.codigo ? ` · ${p.codigo}` : ''}</small></span>
                <span className="sel-pre">{p.precio > 0 ? soles(p.precio) : 'Sin precio'}<small className={p.stock <= p.minimo ? 'rojo-t' : ''}>{quedan > 0 ? `Stock ${quedan}` : 'Sin stock'}</small></span>
              </button>
              {en > 0 ? <span className="sel-cant" aria-label={`${en} en la venta`}><button type="button" aria-label={`Quitar uno de ${p.nombre}`} onClick={() => restarUno(p)}><Icono n="menos" tam={16} /></button><b>{en}</b><button type="button" aria-label={`Agregar uno de ${p.nombre}`} disabled={!ok} onClick={() => sumarUno(p)}><Icono n="mas" tam={16} /></button></span>
                : <button type="button" className="sel-mas" disabled={!ok} aria-label={`Agregar ${p.nombre}`} onClick={() => sumarUno(p)}><Icono n="mas" tam={18} /></button>}
            </li> })}
          {visibles.length > ver && <li><button type="button" className="btn suave chico sel-vermas" onClick={() => setVer(v => v + 20)}>Ver {Math.min(20, visibles.length - ver)} más de {visibles.length - ver}</button></li>}
        </ul>
        {camara && <Escaner onCodigo={t => { porCodigo(t); setCamara(false) }} onCerrar={() => setCamara(false)} />}
        {leido && <p className="sub-t" role="status">{leido}</p>}
        {permitirOtros && productos.some(p => p.id === ID_OTROS) && (
          <details className="tarjeta otros"><summary className="enlace">Vender algo que no está en la lista (Otros, no mueve stock)</summary>
            <div className="rejilla tres">
              <Campo etiqueta="¿Qué se vendió?" id="o-det"><input id="o-det" value={otro.detalle} maxLength={80} onChange={e => setOtro({ ...otro, detalle: e.target.value })} /></Campo>
              <Campo etiqueta="Precio (S/)" id="o-pre"><input id="o-pre" inputMode="decimal" value={otro.precio} onChange={e => setOtro({ ...otro, precio: e.target.value })} /></Campo>
              <Campo etiqueta="Cantidad" id="o-can"><input id="o-can" inputMode="numeric" value={otro.cantidad} onChange={e => setOtro({ ...otro, cantidad: e.target.value })} /></Campo>
            </div>
            {errO && <p className="error" role="alert">{errO}</p>}
            <div className="acciones-fila"><button type="button" className="btn suave" onClick={agregarOtro}>Agregar “Otros” a la venta</button></div>
          </details>)}
      </section>
      <section className="tarjeta carro" aria-label="Lo que se va a vender">
        <h2>{titulo} elegidos {items.length > 0 && <span className="contador-carro">{items.reduce((s, i) => s + i.cantidad, 0)}</span>}</h2>
        {!items.length ? <p className="mut">Todavía no elegiste nada. Escribe el nombre del producto arriba y elígelo.</p> :
          <div>{items.map((it, idx) => {
            const nom = nombreDe(it), pl = precioLinea(it, productos), lista0 = listaDe(it), editado = it.productoId !== ID_OTROS && pl !== lista0, fav = favoritos?.includes(it.productoId)
            return (
              <div className="linea-carro" key={idx}>
                <strong>{nom}</strong><span className="der"><b>{soles(it.cantidad * pl)}</b><small> ({soles(pl)} c/u)</small></span>
                <span className="cant"><button type="button" aria-label={`Quitar uno de ${nom}`} disabled={it.cantidad <= 1} onClick={() => menos(idx)}><Icono n="menos" tam={18} /></button>
                  <CantidadInput etiqueta={`Cantidad de ${nom}`} decimal={decimalDe(it)} valor={it.cantidad} onListo={v => poner(idx, v)} />
                  <button type="button" aria-label={`Agregar uno de ${nom}`} onClick={() => poner(idx, it.cantidad + 1)}><Icono n="mas" tam={18} /></button></span>
                {fotoLinea && <div className="foto-linea"><Foto valor={it.foto || null} onCambio={f => onCambio(items.map((x, i) => i === idx ? { ...x, foto: f } : x))} etiqueta={`Foto de ${nom} (opcional)`} alt={`Foto de ${nom}`} compacta mejorar /></div>}
                <span className="linea-acc">
                  {onFavorito && it.productoId !== ID_OTROS && <button type="button" className={`fav-btn ${fav ? 'on' : ''}`} aria-pressed={!!fav} onClick={() => onFavorito(it.productoId)}><Icono n="estrella" tam={18} />{fav ? 'Favorito' : 'Marcar favorito'}</button>}
                  <button type="button" className="enlace" onClick={() => quitar(idx)}>Quitar</button></span>
                {editarPrecio && it.productoId !== ID_OTROS && <div className="precio-edit">
                  <label htmlFor={`pr-${idx}`}>Precio c/u (S/)</label>
                  <input id={`pr-${idx}`} inputMode="decimal" value={it.precio ?? lista0.toFixed(2)} onChange={e => ponerPrecio(idx, e.target.value)} onBlur={e => { if (!(Number(e.target.value.replace(',', '.')) > 0)) ponerPrecio(idx, lista0.toFixed(2)) }} />
                  {editado ? <small className="precio-dsc"><Icono n="etiqueta" tam={14} />Precio de lista {soles(lista0)} · {pl < lista0 ? `descuento ${soles((lista0 - pl) * it.cantidad)}` : `recargo ${soles((pl - lista0) * it.cantidad)}`}</small> : <small className="mut">Precio de lista. Puedes cambiarlo (descuento de mostrador).</small>}
                </div>}
              </div>)
          })}</div>}
        <div className="total-grande"><span>Total</span><span>{soles(totalCarro(items, productos))}</span></div>
        {children}
      </section>
    </div>
  )
}

// Casilla de cantidad: guarda lo que se escribe y valida al salir o con Enter.
// Vacío o 0 vuelve al valor anterior (el producto no se quita); solo "Quitar" lo saca.
export function CantidadInput({ valor, onListo, decimal = false, etiqueta }) {
  const [txt, setTxt] = useState(String(valor)), [foco, setFoco] = useState(false)
  useEffect(() => { if (!foco) setTxt(String(valor)) }, [valor, foco])
  const confirmar = () => { const n = Number(String(txt).replace(',', '.')); const ok = Number.isFinite(n) && n > 0 && (decimal || Number.isInteger(n)); if (ok) onListo(n); else setTxt(String(valor)) }
  return <input aria-label={etiqueta} inputMode={decimal ? 'decimal' : 'numeric'} value={txt}
    onFocus={e => { setFoco(true); e.target.select() }} onChange={e => setTxt(e.target.value.replace(decimal ? /[^\d.,]/g : /\D/g, '').slice(0, 8))}
    onBlur={() => { setFoco(false); confirmar() }} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); confirmar(); e.currentTarget.blur() } else if (e.key === 'Escape') { setTxt(String(valor)); e.currentTarget.blur() } }} />
}
