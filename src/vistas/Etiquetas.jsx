// Etiquetas con código de barras interno (Code128) e ingreso de mercadería por escaneo.
// Lector USB/Bluetooth: escribe el código y envía Enter en la casilla. Celular: botón de cámara.
import { useMemo, useRef, useState } from 'react'
import { useApp } from '../components/contexto.js'
import { Campo, Chip, Vacio } from '../components/ui.jsx'
import { Icono } from '../components/Iconos.jsx'
import Escaner from '../components/Escaner.jsx'
import { ID_OTROS, productoPorCodigo, ingresarVarios } from '../lib/dominio.js'
import { codificar, barras } from '../lib/codigoBarras.js'
import { soles } from '../lib/dinero.js'
import { descargar } from '../lib/descarga.js'

export function CodigoSvg({ codigo, alto = 44, modulo = 1.6 }) {
  const mod = useMemo(() => codificar(codigo, 8), [codigo])
  return <svg width={mod.length * modulo} height={alto} viewBox={`0 0 ${mod.length} ${alto}`} preserveAspectRatio="none" role="img" aria-label={`Código de barras ${codigo}`}>{barras(mod).map(([x, a]) => <rect key={x} x={x} y="0" width={a} height={alto} fill="#000" />)}</svg>
}

export default function Etiquetas() {
  const { vista: db, run, aviso, confirmar } = useApp()
  const productos = db.productos.filter(p => p.id !== ID_OTROS && p.activo !== false && p.codigo)
  const [q, setQ] = useState(''), [sel, setSel] = useState({}), [trabajando, setTrabajando] = useState(false)
  const lista = productos.filter(p => !q.trim() || `${p.nombre} ${p.codigo} ${p.categoria}`.toLowerCase().includes(q.trim().toLowerCase()))
  const elegidos = Object.entries(sel).filter(([, c]) => c > 0)
  const pdf = async () => {
    if (!elegidos.length) return aviso('Marca al menos un producto para imprimir etiquetas.', 'error')
    setTrabajando(true)
    try { const { pdfEtiquetas, bytesPdf } = await import('../lib/pdf.js'); const doc = await pdfEtiquetas(elegidos.map(([id, c]) => { const p = productos.find(x => x.id === id); return { nombre: p.nombre, precio: p.precio, codigo: p.codigo, copias: c } })); descargar(bytesPdf(doc), 'etiquetas-megans.pdf', 'application/pdf'); aviso('Etiquetas en PDF descargadas (A4, 24 por hoja).') }
    catch { aviso('No se pudo crear el PDF de etiquetas.', 'error') }
    setTrabajando(false)
  }
  // ---- ingreso por escaneo ----
  const [ingreso, setIngreso] = useState([]), [codigo, setCodigo] = useState(''), [camara, setCamara] = useState(false), [msg, setMsg] = useState(''), ref = useRef(null)
  const sumar = txt => {
    const p = productoPorCodigo(db, txt)
    if (!p) { setMsg(`No hay ningún producto con el código «${txt}».`); return false }
    setIngreso(l => l.some(x => x.productoId === p.id) ? l.map(x => x.productoId === p.id ? { ...x, cantidad: x.cantidad + 1 } : x) : [...l, { productoId: p.id, nombre: p.nombre, cantidad: 1 }])
    setMsg(`Leído: ${p.nombre} (+1).`); return true
  }
  const alEnter = e => { if (e.key === 'Enter') { e.preventDefault(); if (codigo.trim()) { sumar(codigo); setCodigo('') } } }
  const guardarIngreso = async () => {
    if (!ingreso.length) return aviso('Escanea al menos un producto.', 'error')
    const c = await confirmar({ titulo: '¿Ingresar esta mercadería?', lineas: [...ingreso.map(l => `${l.cantidad} × ${l.nombre}`), 'Quedará anotado con tu nombre.'], boton: 'Sí, ingresar' })
    if (c.ok && await run(ingresarVarios, ingreso.map(l => ({ productoId: l.productoId, cantidad: l.cantidad })), 'Ingreso por escaneo')) { aviso(`Entraron ${ingreso.reduce((s, l) => s + l.cantidad, 0)} unidades.`); setIngreso([]); setMsg('') }
  }
  return (
    <div className="pagina">
      <div className="titulo-fila"><div><h1>Etiquetas y escaneo</h1><p className="sub">Código de barras interno (Code128) para vender e ingresar mercadería escaneando.</p></div></div>

      <section className="tarjeta" aria-label="Ingreso de mercadería por escaneo"><h2>Ingreso de mercadería por escaneo</h2>
        <p className="sub">Con lector USB o Bluetooth: haz clic en la casilla y escanea (cada lectura suma 1). En el celular, usa la cámara.</p>
        <div className="rejilla"><Campo etiqueta="Código escaneado" id="esc-ing" ayuda="El lector escribe el código y presiona Enter solo"><input id="esc-ing" ref={ref} className="codigo-mono" value={codigo} autoComplete="off" onChange={e => setCodigo(e.target.value)} onKeyDown={alEnter} placeholder="MEG00012" /></Campo></div>
        <div className="acciones-fila"><button type="button" className="btn suave" onClick={() => setCamara(c => !c)} aria-expanded={camara}><Icono n="camara" />{camara ? 'Cerrar cámara' : 'Escanear con la cámara'}</button></div>
        {camara && <Escaner onCodigo={t => { sumar(t); setCamara(false) }} onCerrar={() => setCamara(false)} />}
        {msg && <p className="sub-t" role="status">{msg}</p>}
        {ingreso.length > 0 && <><ul className="pagos-lista">{ingreso.map(l => <li key={l.productoId}><span>{l.nombre}</span><span className="monto"><label className="oculto" htmlFor={`ci-${l.productoId}`}>Cantidad de {l.nombre}</label><input id={`ci-${l.productoId}`} type="number" min="1" value={l.cantidad} onChange={e => setIngreso(x => x.map(y => y.productoId === l.productoId ? { ...y, cantidad: Math.max(1, Math.floor(Number(e.target.value) || 1)) } : y))} /></span><button type="button" className="btn suave chico" onClick={() => setIngreso(x => x.filter(y => y.productoId !== l.productoId))}>Quitar</button></li>)}</ul>
          <div className="acciones-fila"><button type="button" className="btn" onClick={guardarIngreso}><Icono n="check" />Ingresar {ingreso.reduce((s, l) => s + l.cantidad, 0)} unidades</button></div></>}
      </section>

      <section className="tarjeta" aria-label="Generar etiquetas"><h2>Etiquetas para imprimir</h2>
        <p className="sub">Marca los productos y cuántas etiquetas quieres. El PDF A4 (24 por hoja) se arma en este equipo, sin internet.</p>
        <div className="rejilla"><Campo etiqueta="Buscar producto" id="etq-q"><input id="etq-q" value={q} onChange={e => setQ(e.target.value)} placeholder="Nombre o código" /></Campo></div>
        <div className="acciones-fila"><button type="button" className="btn" disabled={trabajando} onClick={pdf}><Icono n="bajar" />{trabajando ? 'Creando PDF…' : `Descargar etiquetas en PDF (${elegidos.reduce((s, [, c]) => s + c, 0)})`}</button>
          <button type="button" className="btn suave" onClick={() => setSel(Object.fromEntries(lista.map(p => [p.id, sel[p.id] || 1])))}>Marcar todos los de la lista</button>
          {elegidos.length > 0 && <button type="button" className="btn suave" onClick={() => setSel({})}>Desmarcar todo</button>}</div>
        {!lista.length ? <Vacio icono="buscar" titulo="Sin resultados" texto="Prueba con otro nombre o código." /> :
          <div className="etq-grid">{lista.slice(0, 40).map(p => <div key={p.id} className="etq-fila">
            <label className="check-fila"><input type="checkbox" checked={(sel[p.id] || 0) > 0} onChange={e => setSel({ ...sel, [p.id]: e.target.checked ? 1 : 0 })} /><span className="datos"><strong>{p.nombre}</strong><small className="codigo-mono">{p.codigo} · {soles(p.precio)}</small></span></label>
            {(sel[p.id] || 0) > 0 && <><label htmlFor={`cp-${p.id}`}>Copias</label><input id={`cp-${p.id}`} type="number" min="1" max="96" value={sel[p.id]} onChange={e => setSel({ ...sel, [p.id]: Math.min(96, Math.max(1, Math.floor(Number(e.target.value) || 1))) })} /></>}
            <span className="etq-prev" aria-hidden="true"><CodigoSvg codigo={p.codigo} alto={34} modulo={1.3} /><small className="codigo-mono">{p.codigo}</small></span>
          </div>)}</div>}
        {lista.length > 40 && <p className="mut">Se muestran 40 de {lista.length}. Usa el buscador.</p>}
        <p className="sub-t"><Chip tono="azul">Código interno</Chip> MEG + número del producto. No es un código EAN oficial; sirve solo dentro de la tienda.</p>
      </section>
    </div>)
}
