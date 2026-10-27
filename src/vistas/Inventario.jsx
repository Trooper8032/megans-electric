import { useMemo, useState } from 'react'
import { useApp } from '../components/contexto.js'
import { Campo, Chip, Tabs, Vacio, Tabla, Modal } from '../components/ui.jsx'
import { Icono } from '../components/Iconos.jsx'
import { guardarProducto, activarProducto, ajustarStock, ingresarStock, iniciarConteo, guardarConteo, cerrarConteo, productoPorCodigo, ID_OTROS } from '../lib/dominio.js'
import Escaner from '../components/Escaner.jsx'
import IngresoIA from '../components/IngresoIA.jsx'
import { soles, aMonto } from '../lib/dinero.js'
import { fechaCorta, fechaHora } from '../lib/fechas.js'

const nombreDe = (db, id) => db.usuarios.find(u => u.id === id)?.nombre || '—'
export default function Inventario({ id }) {
  const { vista: db, can } = useApp(), [tab, setTab] = useState(id === 'ingreso' || id === 'factura' ? 'ingreso' : 'productos')
  const bajos = db.productos.filter(p => p.activo !== false && p.id !== ID_OTROS && p.stock <= p.minimo).length
  return (
    <div className="pagina ancha"><h1>Inventario</h1><p className="sub">El stock baja solo con cada venta. Aquí lo revisas, lo cuentas y lo corriges con motivo.</p>
      <Tabs etiqueta="Secciones del inventario" valor={tab} onCambio={setTab} opciones={[{ id: 'productos', texto: 'Productos', cuenta: bajos }, ...(can('ingresarStock') ? [{ id: 'ingreso', texto: 'Ingreso por voz o foto' }] : []), { id: 'conteo', texto: 'Conteo semanal' }, { id: 'movimientos', texto: 'Movimientos' }]} />
      {tab === 'ingreso' && <IngresoIA inicial={id === 'factura' ? 'factura' : 'voz'} />}{tab === 'productos' && <Productos />}{tab === 'conteo' && <Conteo />}{tab === 'movimientos' && <Movimientos />}
    </div>
  )
}

function Productos() {
  const { vista: db, run, can, confirmar, aviso } = useApp()
  const [q, setQ] = useState(''), [cat, setCat] = useState('Todas'), [soloBajo, setSoloBajo] = useState(false), [modal, setModal] = useState(null), [camara, setCamara] = useState(false), [leido, setLeido] = useState(null)
  const cats = useMemo(() => ['Todas', ...new Set(db.productos.filter(p => p.id !== ID_OTROS).map(p => p.categoria))], [db.productos])
  const lista = db.productos.filter(p => p.id !== ID_OTROS && (cat === 'Todas' || p.categoria === cat) && (!soloBajo || (p.activo !== false && p.stock <= p.minimo)) && (`${p.nombre} ${p.codigo || ''}`).toLowerCase().includes(q.trim().toLowerCase()))
  const porCodigo = txt => { const c = String(txt || '').trim(); setCamara(false); if (!c) return; const p = productoPorCodigo(db, c); setLeido(p ? { p } : { codigo: c.replace(/\s+/g, '').toUpperCase() }) }
  return (
    <>
      <div className="rejilla"><div className="buscador"><Icono n="buscar" /><input aria-label="Buscar producto" placeholder="Buscar producto o escribir código…" value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && /^[A-Za-z]{0,4}\d{3,}$/.test(q.trim())) { e.preventDefault(); porCodigo(q); setQ('') } }} /></div>
        <div className="acciones-fila"><button type="button" className="btn calido" aria-expanded={camara} onClick={() => setCamara(c => !c)}><Icono n="escaner" />{camara ? 'Cerrar cámara' : 'Escanear con cámara'}</button><button type="button" className={`btn ${soloBajo ? '' : 'suave'}`} aria-pressed={soloBajo} onClick={() => setSoloBajo(!soloBajo)}><Icono n="alerta" />Solo stock bajo</button><button type="button" className="btn suave" onClick={() => setModal({ tipo: 'nuevo' })}><Icono n="mas" />Nuevo producto</button></div></div>
      {camara && <Escaner titulo="Escanear producto del inventario" onCodigo={porCodigo} onCerrar={() => setCamara(false)} />}
      {leido && <section className="tarjeta leido" role="status" aria-label="Producto escaneado">{leido.p ? <>
        <div className="fila-sb"><div><h3>{leido.p.nombre}</h3><small>Código {leido.p.codigo} · {leido.p.categoria} · stock <strong>{leido.p.stock}</strong> · precio {soles(leido.p.precio)}</small></div><button type="button" className="btn suave chico" onClick={() => setLeido(null)}><Icono n="cerrar" tam={16} />Cerrar</button></div>
        <div className="acciones-fila"><button type="button" className="btn" onClick={() => { setModal({ tipo: 'ingreso', p: leido.p }); setLeido(null) }}>Ingresar</button><button type="button" className="btn suave" onClick={() => { setModal({ tipo: 'ajuste', p: leido.p }); setLeido(null) }}>Ajustar</button><button type="button" className="btn suave" onClick={() => { setModal({ tipo: 'editar', p: leido.p }); setLeido(null) }}><Icono n="lapiz" tam={18} />Editar</button></div></> : <>
        <div className="fila-sb"><div><h3>No hay ningún producto con el código «{leido.codigo}»</h3><small>Puedes crearlo ahora con ese código.</small></div><button type="button" className="btn suave chico" onClick={() => setLeido(null)}><Icono n="cerrar" tam={16} />Cerrar</button></div>
        <div className="acciones-fila"><button type="button" className="btn" onClick={() => { setModal({ tipo: 'nuevo', codigo: leido.codigo }); setLeido(null) }}><Icono n="mas" />Crear producto con este código</button></div></>}</section>}
      <div className="rejilla filtro-cat"><Campo etiqueta="Categoría" id="inv-cat"><select id="inv-cat" value={cat} onChange={e => setCat(e.target.value)}>{cats.map(c => <option key={c} value={c}>{c === 'Todas' ? 'Todas las categorías' : c}</option>)}</select></Campo></div>
      {!lista.length ? <Vacio icono="caja" titulo="No hay productos con esos datos" texto="Cambia la búsqueda o el filtro." /> :
        <div className="tarjeta"><Tabla titulo="Productos y stock" cabeceras={['Producto', 'Categoría', { t: 'Precio', der: true }, { t: 'Stock', der: true }, { t: 'Mínimo', der: true }, 'Acciones']}>
          {lista.map(p => { const bajo = p.activo !== false && p.stock <= p.minimo
            return <tr key={p.id} className={bajo ? 'fila-rojo' : ''}><td><strong>{p.nombre}</strong>{p.activo === false && <> <Chip tono="gris">Desactivado</Chip></>}<br /><small>{p.id}</small></td><td>{p.categoria}</td>
              <td className="der">{p.precio > 0 ? soles(p.precio) : <span className="rojo-t">Sin precio</span>}</td>
              <td className="der"><strong className={bajo ? 'dif-rojo' : ''}>{p.stock}</strong> {bajo && <Chip tono="rojo" icono="alerta">{p.stock === 0 ? 'Agotado' : 'Bajo'}</Chip>}</td><td className="der">{p.minimo}</td>
              <td><div className="acciones-fila fila-mini"><button type="button" className="btn suave chico" aria-label={`Editar ${p.nombre}`} onClick={() => setModal({ tipo: 'editar', p })}><Icono n="lapiz" tam={18} />Editar</button>
                <button type="button" className="btn suave chico" aria-label={`Ingresar mercadería de ${p.nombre}`} onClick={() => setModal({ tipo: 'ingreso', p })}>Ingresar</button>
                <button type="button" className="btn suave chico" aria-label={`Ajustar stock de ${p.nombre}`} onClick={() => setModal({ tipo: 'ajuste', p })}>Ajustar</button></div></td></tr> })}
        </Tabla></div>}
      {modal && <FormProducto modal={modal} onCerrar={() => setModal(null)} />}
    </>
  )
}
function FormProducto({ modal, onCerrar }) {
  const { run, can, aviso, confirmar } = useApp(), p = modal.p
  const [f, setF] = useState({ nombre: p?.nombre || '', categoria: p?.categoria || '', minimo: String(p?.minimo ?? 5), precio: p ? String(p.precio) : '', costo: p ? String(p.costo) : '', cantidad: '', nuevo: String(p?.stock ?? ''), motivo: '', unidad: p?.unidad || 'und', decimales: !!p?.decimales }), [err, setErr] = useState('')
  const cambiaPrecio = can('cambiarPrecio')
  const enviar = async e => {
    e.preventDefault(); setErr('')
    if (modal.tipo === 'ingreso') { const n = Number(f.cantidad); if (!Number.isInteger(n) || n <= 0) return setErr('Escribe cuántas unidades entran (número entero).'); if (await run(ingresarStock, p.id, n, f.motivo || 'Compra o reposición')) { aviso(`Entraron ${n} unidades de ${p.nombre}.`); onCerrar() } return }
    if (modal.tipo === 'ajuste') { const n = Number(f.nuevo); if (!Number.isInteger(n) || n < 0 || f.nuevo === '') return setErr('Escribe el stock correcto (número entero, cero o más).'); if (f.motivo.trim().length < 4) return setErr('Escribe el motivo del ajuste.'); if (n === p.stock) return setErr('Ese ya es el stock actual.'); const c = await confirmar({ titulo: '¿Cambiar el stock?', texto: `${p.nombre}: de ${p.stock} a ${n}. Quedará anotado con tu nombre y el motivo.`, boton: 'Sí, ajustar' }); if (c.ok && await run(ajustarStock, p.id, n, f.motivo)) { aviso('Stock ajustado.'); onCerrar() } return }
    const minimo = Number(f.minimo); if (f.nombre.trim().length < 2) return setErr('Escribe el nombre del producto.'); if (!Number.isInteger(minimo) || minimo < 0) return setErr('El stock mínimo debe ser un número entero.')
    const datos = { id: p?.id, nombre: f.nombre, categoria: f.categoria, minimo, unidad: f.unidad, decimales: f.decimales, codigo: modal.codigo || undefined }
    if (cambiaPrecio) { const pr = aMonto(f.precio || '0'), co = aMonto(f.costo || '0'); if (pr === null || co === null) return setErr('Precio y costo deben ser montos válidos, como 12.50.'); datos.precio = pr; datos.costo = co }
    if (await run(guardarProducto, datos)) { aviso(p ? 'Producto actualizado.' : 'Producto creado.'); onCerrar() }
  }
  const titulo = { nuevo: modal.codigo ? `Nuevo producto (código ${modal.codigo})` : 'Nuevo producto', editar: `Editar ${p?.nombre}`, ingreso: `Ingresar mercadería: ${p?.nombre}`, ajuste: `Ajustar stock: ${p?.nombre}` }[modal.tipo]
  return (
    <Modal titulo={titulo} onCerrar={onCerrar}>
      <form onSubmit={enviar} noValidate>
        {(modal.tipo === 'nuevo' || modal.tipo === 'editar') && <>
          <Campo etiqueta="Nombre" id="pn"><input id="pn" value={f.nombre} maxLength={70} onChange={e => setF({ ...f, nombre: e.target.value })} /></Campo>
          <div className="rejilla"><Campo etiqueta="Categoría" id="pc"><input id="pc" value={f.categoria} maxLength={30} onChange={e => setF({ ...f, categoria: e.target.value })} /></Campo><Campo etiqueta="Stock mínimo (alerta)" id="pm"><input id="pm" inputMode="numeric" value={f.minimo} onChange={e => setF({ ...f, minimo: e.target.value })} /></Campo>
            <Campo etiqueta="Precio de venta (S/)" id="pp" ayuda={cambiaPrecio ? undefined : 'Solo la administradora cambia precios'}><input id="pp" inputMode="decimal" disabled={!cambiaPrecio} value={f.precio} onChange={e => setF({ ...f, precio: e.target.value })} /></Campo>
            {can('verCostos') && <Campo etiqueta="Costo (S/) · solo lo ves tú" id="pk"><input id="pk" inputMode="decimal" value={f.costo} onChange={e => setF({ ...f, costo: e.target.value })} /></Campo>}
            <Campo etiqueta="Unidad de venta" id="pu" ayuda="Ej.: und, metro, rollo"><input id="pu" value={f.unidad} maxLength={12} onChange={e => setF({ ...f, unidad: e.target.value })} /></Campo></div>
          <label className="check-fila"><input type="checkbox" checked={f.decimales} onChange={e => setF({ ...f, decimales: e.target.checked })} />Permite decimales en la venta (por ejemplo, 2.5 metros). Desactivado: solo cantidades enteras.</label></>}
        {modal.tipo === 'ingreso' && <div className="rejilla"><Campo etiqueta="¿Cuántas unidades entran?" id="ic"><input id="ic" inputMode="numeric" value={f.cantidad} onChange={e => setF({ ...f, cantidad: e.target.value })} /></Campo><Campo etiqueta="Nota (opcional)" id="im"><input id="im" value={f.motivo} maxLength={120} onChange={e => setF({ ...f, motivo: e.target.value })} placeholder="Compra o reposición" /></Campo></div>}
        {modal.tipo === 'ajuste' && <><p>Stock actual en el sistema: <strong>{p.stock}</strong></p><div className="rejilla"><Campo etiqueta="Stock correcto" id="an"><input id="an" inputMode="numeric" value={f.nuevo} onChange={e => setF({ ...f, nuevo: e.target.value })} /></Campo><Campo etiqueta="Motivo del ajuste" id="am"><input id="am" value={f.motivo} maxLength={120} onChange={e => setF({ ...f, motivo: e.target.value })} placeholder="Ej.: se rompieron 2" /></Campo></div></>}
        {err && <p className="error" role="alert">{err}</p>}
        <div className="acciones-fila fin">{modal.tipo === 'editar' && can('desactivarProducto') && <button type="button" className="btn peligro" onClick={async () => { if (await run(activarProducto, p.id, p.activo === false)) { aviso(p.activo === false ? 'Producto activado.' : 'Producto desactivado (no se borra).'); onCerrar() } }}>{p.activo === false ? 'Activar' : 'Desactivar'}</button>}
          <button type="button" className="btn suave" onClick={onCerrar}>Cancelar</button><button type="submit" className="btn">Guardar</button></div>
      </form>
    </Modal>
  )
}

function Conteo() {
  const { vista: db, run, aviso, confirmar } = useApp()
  const abierto = db.conteos.find(c => c.estado === 'Abierto'), cerrados = db.conteos.filter(c => c.estado === 'Cerrado').sort((a, b) => b.fecha.localeCompare(a.fecha))
  const [vals, setVals] = useState({}), [mots, setMots] = useState({}), [err, setErr] = useState('')
  const ini = async () => { const r = await run(iniciarConteo); if (r) { setVals({}); setMots({}) } }
  if (!abierto) return (
    <>
      <section className="tarjeta"><h2>Conteo rápido semanal</h2><p>Una vez por semana cuentas con la vista unos 12 productos que la aplicación te sugiere (los de stock bajo y los que hace más tiempo no se cuentan). Si hay diferencia, la ves en rojo y la corriges con un motivo.</p>
        <div className="acciones-fila"><button type="button" className="btn grande" onClick={ini}><Icono n="check" />Empezar el conteo de esta semana</button></div></section>
      <HistorialConteos cerrados={cerrados} db={db} />
    </>)
  const stockActual = id => db.productos.find(p => p.id === id)?.stock ?? 0
  const valor = l => vals[l.productoId] ?? (l.contado ?? '')
  const motivo = l => mots[l.productoId] ?? l.motivo
  const dif = l => { const v = valor(l); return v === '' ? null : Number(v) - stockActual(l.productoId) }
  const guardar = async (silencioso = false) => { const r = await run(guardarConteo, abierto.id, vals, mots); if (r && !silencioso) aviso('Avance guardado.'); return r }
  const cerrar = async () => {
    setErr('')
    const sinContar = abierto.lineas.filter(l => valor(l) === ''); if (sinContar.length) return setErr(`Falta contar ${sinContar.length} producto(s). Escribe 0 si no hay ninguno.`)
    const malos = abierto.lineas.filter(l => !/^\d+$/.test(String(valor(l)))); if (malos.length) return setErr(`Revisa "${malos[0].nombre}": escribe un número entero, cero o más.`)
    const sinMotivo = abierto.lineas.filter(l => dif(l) !== 0 && motivo(l).trim().length < 4); if (sinMotivo.length) return setErr(`Escribe el motivo de la diferencia en "${sinMotivo[0].nombre}".`)
    const ndif = abierto.lineas.filter(l => dif(l) !== 0).length
    const c = await confirmar({ titulo: '¿Cerrar el conteo?', texto: ndif ? `Hay ${ndif} diferencia(s). El stock se corregirá y quedará anotado con tu nombre.` : 'Todo coincide. No hay nada que corregir.', boton: 'Sí, cerrar conteo' }); if (!c.ok) return
    if (await guardar(true) && await run(cerrarConteo, abierto.id)) { setVals({}); setMots({}); aviso('Conteo cerrado.') }
  }
  return (
    <>
      <section className="tarjeta"><h2>Conteo de la semana ({fechaCorta(abierto.fecha)})</h2><p className="sub">Cuenta cada producto y escribe lo que ves. Las diferencias salen en rojo.</p>
        <div className="conteo-t"><Tabla titulo="Conteo rápido" cabeceras={['Producto', { t: 'En el sistema', der: true }, { t: 'Contaste', der: true }, { t: 'Diferencia', der: true }, 'Motivo']}>
          {abierto.lineas.map(l => { const d = dif(l)
            return <tr key={l.productoId} className={d ? 'fila-rojo' : ''}><td className="c-nom"><strong>{l.nombre}</strong></td><td className="der" data-et="En el sistema">{stockActual(l.productoId)}</td>
              <td className="der" data-et="Contaste"><input aria-label={`Contaste de ${l.nombre}`} inputMode="numeric" value={valor(l)} onChange={e => setVals({ ...vals, [l.productoId]: e.target.value })} /></td>
              <td data-et="Diferencia" className={`der ${d ? 'dif-rojo' : d === 0 ? 'dif-ok' : ''}`}>{d === null ? '—' : d === 0 ? 'Cuadra' : (d > 0 ? '+' : '') + d}</td>
              <td data-et="Motivo" className="c-mot">{d ? <input aria-label={`Motivo de la diferencia en ${l.nombre}`} value={motivo(l)} maxLength={120} placeholder="¿Qué pasó?" onChange={e => setMots({ ...mots, [l.productoId]: e.target.value })} /> : <span className="mut">—</span>}</td></tr> })}
        </Tabla></div>
        {err && <p className="error" role="alert">{err}</p>}
        <div className="acciones-fila"><button type="button" className="btn suave" onClick={() => guardar()}>Guardar avance</button><button type="button" className="btn" onClick={cerrar}><Icono n="check" />Cerrar conteo y corregir stock</button></div></section>
      <HistorialConteos cerrados={cerrados} db={db} />
    </>)
}
function HistorialConteos({ cerrados, db }) {
  if (!cerrados.length) return null
  return <section className="tarjeta"><h2>Conteos anteriores</h2><Tabla titulo="Conteos anteriores" cabeceras={['Fecha', 'Hecho por', { t: 'Productos', der: true }, { t: 'Con diferencia', der: true }, 'Detalle']}>
    {cerrados.slice(0, 6).map(c => { const d = c.lineas.filter(l => l.diferencia); return <tr key={c.id}><td>{fechaCorta(c.fecha)}</td><td>{nombreDe(db, c.cerradoPor)}</td><td className="der">{c.lineas.length}</td><td className={`der ${d.length ? 'dif-rojo' : 'dif-ok'}`}>{d.length || 'Ninguna'}</td><td>{d.map(l => `${l.nombre}: ${l.diferencia > 0 ? '+' : ''}${l.diferencia} (${l.motivo})`).join('; ') || '—'}</td></tr> })}</Tabla></section>
}

function Movimientos() {
  const { vista: db } = useApp(), [q, setQ] = useState(''), [tipo, setTipo] = useState('todos')
  const nom = id => db.productos.find(p => p.id === id)?.nombre || id
  const lista = [...db.movimientos].reverse().filter(m => (tipo === 'todos' || m.tipo === tipo) && nom(m.productoId).toLowerCase().includes(q.trim().toLowerCase())).slice(0, 150)
  const tipos = [...new Set(db.movimientos.map(m => m.tipo))]
  return (
    <>
      <div className="rejilla"><div className="buscador"><Icono n="buscar" /><input aria-label="Buscar producto en los movimientos" placeholder="Buscar producto…" value={q} onChange={e => setQ(e.target.value)} /></div>
        <Campo etiqueta="Tipo de movimiento" id="tm"><select id="tm" value={tipo} onChange={e => setTipo(e.target.value)}><option value="todos">Todos</option>{tipos.map(t => <option key={t}>{t}</option>)}</select></Campo></div>
      {!lista.length ? <Vacio icono="reloj" titulo="No hay movimientos con esos datos" /> : <div className="tarjeta"><p className="sub">Se muestran los últimos {lista.length}. Cada cambio de stock queda con quién y cuándo.</p>
        <Tabla titulo="Movimientos de stock" cabeceras={['Fecha y hora', 'Producto', 'Tipo', { t: 'Cantidad', der: true }, { t: 'Stock después', der: true }, 'Quién', 'Motivo o referencia']}>
          {lista.map(m => <tr key={m.id}><td>{fechaHora(m.cuando)}</td><td>{nom(m.productoId)}</td><td><Chip tono={m.cantidad < 0 ? 'azul' : 'verde'}>{m.tipo}</Chip></td><td className={`der ${m.tipo === 'ajuste' || m.tipo === 'conteo' ? 'dif-rojo' : ''}`}>{m.cantidad > 0 ? '+' : ''}{m.cantidad}</td><td className="der">{m.stockDespues}</td><td>{nombreDe(db, m.quien)}</td><td>{m.motivo || m.ref}</td></tr>)}</Tabla></div>}
    </>)
}
