// Ingreso de mercadería con IA: por voz («Llegaron 50 interruptores simples») o con la foto de la factura / guía del
// proveedor. Siempre se muestra una tabla editable y se pide confirmación. Solo para roles con permiso «ingresarStock»;
// la capa de datos (ingresarVarios) vuelve a revisar el permiso y guarda el movimiento con autor y fecha.
import { useEffect, useRef, useState } from 'react'
import { useApp } from './contexto.js'
import Microfono, { Progreso } from './Microfono.jsx'
import { Icono } from './Iconos.jsx'
import { Chip, Tabs } from './ui.jsx'
import { entenderIngreso } from '../lib/voz.js'
import { parsearFactura } from '../lib/ocr.js'
import { ingresarVarios, guardarProducto, ID_OTROS } from '../lib/dominio.js'
import { soles } from '../lib/dinero.js'
import { leerFoto, medidas } from '../ia/motor.js'
import { tomarPendiente, alPendiente } from '../ia/pendiente.js'

export default function IngresoIA({ inicial = 'voz' }) {
  const { vista: db, can, run, aviso, confirmar } = useApp()
  const [modo, setModo] = useState(inicial), [filas, setFilas] = useState(null), [origen, setOrigen] = useState(null), [estado, setEstado] = useState(null), [err, setErr] = useState(''), [costos, setCostos] = useState(false), [img, setImg] = useState(null)
  const foto = useRef(null), cam = useRef(null)
  const productos = db.productos.filter(p => p.id !== ID_OTROS && p.activo !== false)
  const verCosto = can('verCostos')
  const aFilas = ls => ls.map(l => ({ productoId: l.productoId || '', cantidad: String(l.cantidad), costo: l.costo != null ? String(l.costo) : '', dicho: l.nombreDicho || l.descripcion || '', duda: l.duda, opciones: l.opciones || [], usar: !!l.productoId && (l.usar ?? true) }))
  const porVoz = texto => { const r = entenderIngreso(texto, productos); setOrigen({ tipo: 'voz', texto }); setFilas(aFilas(r.lineas)); setErr(r.lineas.length ? '' : 'No reconocimos productos. Di la cantidad y el nombre: «Llegaron 50 interruptores simples».') }
  const ref = useRef(null); ref.current = () => { const p = tomarPendiente('ingreso'); if (p) { porVoz(p.texto); setModo('voz') } }
  useEffect(() => { ref.current(); return alPendiente(() => ref.current()) }, [])
  const porFoto = async f => {
    setErr(''); setFilas(null); setImg(URL.createObjectURL(f))
    try {
      const t0 = performance.now(); let tx = await leerFoto(f, (texto, pct) => setEstado({ texto, pct }))
      let r = parsearFactura(tx, productos)
      if (!r.filas.length) { tx += '\n' + await leerFoto(f, (texto, pct) => setEstado({ texto: 'Leyendo otra vez…', pct }), { invertir: true }); r = parsearFactura(tx, productos) }
      medidas.facturaMs = performance.now() - t0; medidas.facturaTexto = tx
      setEstado(null); setOrigen({ tipo: 'factura', doc: r.doc, suma: r.suma, cuadra: r.cuadra, muestra: /MUESTRA/i.test(tx) }); setFilas(aFilas(r.filas))
      if (!r.filas.length) setErr('No encontramos productos en la foto. Prueba con más luz, de frente y sin sombras.')
    } catch (e) { console.error(e); setEstado(null); setErr('No pudimos leer la foto. Inténtalo otra vez.') }
  }
  const cambia = (i, k, v) => setFilas(fs => fs.map((f, j) => j === i ? { ...f, [k]: v, ...(k === 'productoId' ? { usar: !!v, duda: false } : {}) } : f))
  const elegidas = (filas || []).filter(f => f.usar && f.productoId)
  const guardar = async () => {
    setErr('')
    const lineas = []
    for (const f of elegidas) { const c = Number(f.cantidad); if (!Number.isInteger(c) || c <= 0) return setErr(`Revisa la cantidad de ${productos.find(p => p.id === f.productoId)?.nombre}: debe ser un número entero mayor que cero.`); lineas.push({ productoId: f.productoId, cantidad: c }) }
    if (!lineas.length) return setErr('Marca al menos un producto con su cantidad.')
    const juntas = Object.values(lineas.reduce((m, l) => { m[l.productoId] = { productoId: l.productoId, cantidad: (m[l.productoId]?.cantidad || 0) + l.cantidad }; return m }, {}))
    const nombre = id => productos.find(p => p.id === id)?.nombre
    const doc = origen?.doc?.numero ? ` ${origen.doc.numero}` : ''
    const motivo = origen?.tipo === 'factura' ? `Ingreso con foto de factura/guía${doc}${origen.doc?.proveedor ? ` · ${origen.doc.proveedor}` : ''}` : 'Ingreso por voz'
    const r = await confirmar({ titulo: '¿Ingresar esta mercadería?', texto: `Se sumará al stock y quedará en los movimientos a tu nombre (${motivo}).`, lineas: juntas.map(l => `${l.cantidad} × ${nombre(l.productoId)}`), boton: `Sí, ingresar ${juntas.reduce((s, l) => s + l.cantidad, 0)} unidades` })
    if (!r.ok) return
    if (!await run(ingresarVarios, juntas, motivo.slice(0, 120))) return
    let nc = 0
    if (verCosto && costos) for (const f of elegidas) { const p = db.productos.find(x => x.id === f.productoId), c = Number(String(f.costo).replace(',', '.')); if (p && c > 0 && Math.abs(c - p.costo) > 0.004 && await run(guardarProducto, { id: p.id, nombre: p.nombre, minimo: p.minimo, costo: c })) nc++ }
    aviso(`Entraron ${juntas.reduce((s, l) => s + l.cantidad, 0)} unidades.${nc ? ` Se actualizó el costo de ${nc} producto(s).` : ''}`); setFilas(null); setOrigen(null); setImg(null)
  }
  if (!can('ingresarStock')) return null
  return (
    <section className="tarjeta ia-tarjeta" aria-label="Ingreso de mercadería con IA">
      <div className="ia-cab"><h2><Icono n="microfono" />Ingreso de mercadería por voz o foto <span className="chip azul">Nuevo</span></h2></div>
      <Tabs etiqueta="Cómo ingresar" valor={modo} onCambio={m => { setModo(m); setErr('') }} opciones={[{ id: 'voz', texto: 'Dictar' }, { id: 'factura', texto: 'Foto de la factura o guía' }]} />
      {modo === 'voz' ? <Microfono etiqueta="Dictar el ingreso" ejemplo="Ej.: «Llegaron cincuenta interruptores simples y veinte cajas de dos polos»." onTexto={porVoz} />
        : <div className="ia-mic-caja"><div className="acciones-fila"><button type="button" className="btn grande" onClick={() => cam.current?.click()}><Icono n="camara" />Tomar foto de la factura</button><button type="button" className="btn suave" onClick={() => foto.current?.click()}><Icono n="subir" />Subir foto</button></div>
          <p className="ia-ejemplo"><Icono n="foco" tam={16} />Foto de frente, con buena luz y toda la tabla de productos. Se lee en este equipo, no se sube a ningún lado.</p>
          <input ref={cam} className="oculto-input" type="file" accept="image/*" capture="environment" tabIndex={-1} aria-hidden="true" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) porFoto(f) }} />
          <input ref={foto} className="oculto-input" type="file" accept="image/*" tabIndex={-1} aria-hidden="true" data-prueba="subir-factura" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) porFoto(f) }} />
          <Progreso estado={estado} /></div>}
      {err && <p className="error" role="alert">{err}</p>}
      {filas && filas.length > 0 && <div className="ia-res">
        {origen?.tipo === 'voz' && <p className="ia-escuche">Escuché: «{origen.texto}»</p>}
        {origen?.tipo === 'factura' && <div className="ia-doc">{img && <img src={img} alt="Foto de la factura leída" />}<p>{origen.doc?.numero && <Chip tono="azul">Documento {origen.doc.numero}</Chip>} {origen.doc?.proveedor && <Chip tono="azul">{origen.doc.proveedor}</Chip>} {origen.doc?.fecha && <Chip tono="azul">Fecha {origen.doc.fecha.split('-').reverse().join('/')}</Chip>}
          {verCosto && origen.doc?.total != null && (origen.cuadra ? <Chip tono="verde" icono="check">La suma cuadra con el total ({soles(origen.doc.total)})</Chip> : <Chip tono="ambar" icono="alerta">La suma leída ({soles(origen.suma)}) no cuadra con el total ({soles(origen.doc.total)}): revisa las filas</Chip>)}
          {origen.muestra && <Chip tono="ambar">Documento de MUESTRA</Chip>}</p></div>}
        <p className="sub-t">Revisa cada fila. Corrige el producto o la cantidad si hace falta.</p>
        <div className="tabla-wrap" tabIndex="0" role="region" aria-label="Productos que entran"><table className="ia-tabla"><caption className="solo-lectores">Productos que entran</caption><thead><tr><th scope="col">Usar</th><th scope="col">Lo que {origen?.tipo === 'voz' ? 'escuché' : 'leímos'}</th><th scope="col">Producto del catálogo</th><th scope="col">Cantidad</th>{verCosto && <th scope="col">Costo unit. (S/)</th>}</tr></thead>
          <tbody>{filas.map((f, i) => <tr key={i} className={f.productoId ? (f.duda ? 'duda' : '') : 'falta'}>
            <td><input type="checkbox" aria-label={`Usar fila ${i + 1}`} checked={f.usar} disabled={!f.productoId} onChange={e => cambia(i, 'usar', e.target.checked)} /></td>
            <td>{f.dicho}{!f.productoId ? <small className="rojo-t"> · no está en el catálogo, elige uno</small> : f.duda ? <small className="ambar-t"> · revisa</small> : null}</td>
            <td><label className="oculto" htmlFor={`ip-${i}`}>Producto de la fila {i + 1}</label><select id={`ip-${i}`} value={f.productoId} onChange={e => cambia(i, 'productoId', e.target.value)}><option value="">— Elegir —</option>{f.opciones.length > 0 && <optgroup label="Parecidos">{f.opciones.map(o => <option key={'o' + o.id} value={o.id}>{o.nombre}</option>)}</optgroup>}<optgroup label="Todo el catálogo">{productos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}</optgroup></select></td>
            <td><label className="oculto" htmlFor={`iq-${i}`}>Cantidad de la fila {i + 1}</label><input id={`iq-${i}`} className="ia-num" inputMode="numeric" value={f.cantidad} onChange={e => cambia(i, 'cantidad', e.target.value.replace(/[^\d]/g, '').slice(0, 5))} /></td>
            {verCosto && <td><label className="oculto" htmlFor={`ik-${i}`}>Costo de la fila {i + 1}</label><input id={`ik-${i}`} className="ia-num" inputMode="decimal" value={f.costo} onChange={e => cambia(i, 'costo', e.target.value.replace(/[^\d.,]/g, '').slice(0, 9))} /></td>}
          </tr>)}</tbody></table></div>
        {verCosto && origen?.tipo === 'factura' && <label className="check-fila"><input type="checkbox" checked={costos} onChange={e => setCostos(e.target.checked)} /><span>Actualizar el costo de los productos con los de la factura (solo la administradora)</span></label>}
        <div className="acciones-fila"><button type="button" className="btn" onClick={guardar}><Icono n="check" />Revisar e ingresar {elegidas.reduce((s, f) => s + (Number(f.cantidad) || 0), 0)} unidades</button><button type="button" className="btn suave" onClick={() => { setFilas(null); setOrigen(null); setImg(null) }}>Descartar</button></div>
      </div>}
    </section>
  )
}
