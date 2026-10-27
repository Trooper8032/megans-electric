import { useState } from 'react'
import { useApp } from '../components/contexto.js'
import Selector, { totalCarro } from '../components/Selector.jsx'
import { Campo, Chip, Vacio, Tabla, Modal } from '../components/ui.jsx'
import { Icono } from '../components/Iconos.jsx'
import { MEDIOS_CAJA } from '../config/app.config.js'
import { guardarTienda, crearEnvio, confirmarRecepcion, registrarPagoTienda, registrarDevolucionTienda, cuentaTienda, pagoEnvio } from '../lib/dominio.js'
import { soles, aMonto } from '../lib/dinero.js'
import { fechaCorta, fechaHora } from '../lib/fechas.js'
import { descargar } from '../lib/descarga.js'
import { enlaceWhatsApp, mensajeEnvio } from '../lib/whatsapp.js'

const nombreDe = (db, id) => db.usuarios.find(u => u.id === id)?.nombre || '—'
const TONO_PAGO = { Pagado: 'verde', Parcial: 'ambar', Debe: 'rojo' }
export function ChipPago({ db, e }) { const p = pagoEnvio(db, e); return <Chip tono={TONO_PAGO[p.estado]} icono={p.estado === 'Pagado' ? 'check' : p.estado === 'Parcial' ? 'reloj' : 'alerta'}>{p.estado === 'Pagado' ? `Pagado${p.medios.length ? ' (' + p.medios.join(' + ') + ')' : ''}` : p.estado === 'Parcial' ? `Parcial · falta ${soles(p.saldo)}` : `Debe ${soles(p.saldo)}`}</Chip> }
// Resumen por tienda: quién llevó qué y cuánto se debe.
function ResumenLleva({ db, envios }) {
  const por = {}; envios.forEach(e => { const k = e.llevaId || '—', p = pagoEnvio(db, e), x = por[k] || (por[k] = { n: 0, und: 0, valor: 0, debe: 0 }); x.n++; x.und += e.items.reduce((s, l) => s + l.cantidad, 0); x.valor += e.total; x.debe += p.saldo })
  const filas = Object.entries(por); if (!filas.length) return null
  return <div className="tarjeta"><Tabla titulo="Quién llevó qué" cabeceras={['Lo llevó', { t: 'Envíos', der: true }, { t: 'Unidades', der: true }, { t: 'Valor', der: true }, { t: 'Falta pagar', der: true }]}>
    {filas.map(([k, x]) => <tr key={k}><td>{k === '—' ? 'Sin asignar' : nombreDe(db, k)}</td><td className="der">{x.n}</td><td className="der">{x.und}</td><td className="der">{soles(x.valor)}</td><td className={`der ${x.debe > 0 ? 'dif-rojo' : 'dif-ok'}`}>{soles(x.debe)}</td></tr>)}</Tabla></div>
}
export default function Tiendas({ id }) { return id ? <Detalle id={id} /> : <Lista /> }

function Lista() {
  const { vista: db, ir, run, aviso } = useApp(), [nueva, setNueva] = useState(false)
  const cuentas = db.tiendas.map(t => ({ t, c: cuentaTienda(db, t.id) }))
  const total = cuentas.reduce((s, x) => s + x.c.deuda, 0)
  return (
    <div className="pagina">
      <div className="titulo-fila"><div><h1>Tiendas externas</h1><p className="sub">Lo que enviaste, quién lo llevó, lo que te pagaron y lo que te devolvieron. Puedes cambiar el nombre de cada tienda o agregar más.</p></div><button type="button" className="btn suave" onClick={() => setNueva(true)}><Icono n="mas" />Nueva tienda</button></div>
      <div className="kpis"><div className="kpi-card ambar"><span className="kpi-et">Total que te deben</span><strong className="kpi-val">{soles(total)}</strong></div></div>
      {!cuentas.length ? <Vacio icono="tienda" titulo="Todavía no hay tiendas" texto="Agrega la primera con “Nueva tienda”." /> :
        <ul className="lista">{cuentas.map(({ t, c }) => { const sinConf = db.envios.filter(e => e.tiendaId === t.id && !e.recepcion).length, difs = db.envios.filter(e => e.tiendaId === t.id && e.estado === 'Con diferencias').length
          return <li key={t.id}><button type="button" className="fila-tarjeta" onClick={() => ir('tiendas', t.id)}><Icono n="tienda" tam={28} /><span className="datos"><strong>{t.nombre}</strong><small>{t.encargado || 'Sin encargado'} · enviado {soles(c.enviado)} · pagado {soles(c.pagado)} · devuelto {soles(c.devuelto)}</small></span>
            {sinConf > 0 && <Chip tono="ambar" icono="reloj">{sinConf} sin confirmar</Chip>}{difs > 0 && <Chip tono="rojo" icono="alerta">{difs} con diferencias</Chip>}<span className={`monto ${c.deuda > 0 ? 'rojo-t' : ''}`}>{soles(c.deuda)}</span></button></li> })}</ul>}
      {nueva && <FormTienda onCerrar={() => setNueva(false)} />}
    </div>)
}
function FormTienda({ tienda, onCerrar }) {
  const { run, aviso } = useApp(), [f, setF] = useState({ nombre: tienda?.nombre || '', encargado: tienda?.encargado || '', telefono: tienda?.telefono || '' }), [err, setErr] = useState('')
  const enviar = async e => { e.preventDefault(); setErr(''); if (f.nombre.trim().length < 2) return setErr('Escribe el nombre de la tienda.'); if (f.telefono && !/^(51)?9\d{8}$/.test(f.telefono.replace(/\D/g, ''))) return setErr('El celular debe tener 9 dígitos y empezar con 9.'); if (await run(guardarTienda, { id: tienda?.id, ...f })) { aviso('Tienda guardada.'); onCerrar() } }
  return <Modal titulo={tienda ? 'Editar tienda' : 'Nueva tienda'} onCerrar={onCerrar}><form onSubmit={enviar} noValidate>
    <Campo etiqueta="Nombre de la tienda" id="tn"><input id="tn" value={f.nombre} maxLength={60} onChange={e => setF({ ...f, nombre: e.target.value })} /></Campo>
    <Campo etiqueta="Encargado(a)" id="te"><input id="te" value={f.encargado} maxLength={60} onChange={e => setF({ ...f, encargado: e.target.value })} /></Campo>
    <Campo etiqueta="Celular (WhatsApp)" id="tt"><input id="tt" inputMode="tel" value={f.telefono} maxLength={14} onChange={e => setF({ ...f, telefono: e.target.value })} /></Campo>
    {err && <p className="error" role="alert">{err}</p>}<div className="acciones-fila fin"><button type="button" className="btn suave" onClick={onCerrar}>Cancelar</button><button type="submit" className="btn">Guardar</button></div></form></Modal>
}

function Detalle({ id }) {
  const { vista: db, run, ir, can, aviso, confirmar } = useApp()
  const t = db.tiendas.find(x => x.id === id), [modal, setModal] = useState(null), [rec, setRec] = useState(null)
  if (!t) return <div className="pagina"><button type="button" className="btn suave chico" onClick={() => ir('tiendas')}>Volver a tiendas</button><Vacio icono="tienda" titulo="No se encontró esa tienda" /></div>
  const c = cuentaTienda(db, t.id), envios = db.envios.filter(e => e.tiendaId === t.id).sort((a, b) => b.numero - a.numero)
  const [pagoE, setPagoE] = useState(null)
  const pdfEnvio = async e => { try { const [{ pdfEnvio, bytesPdf }, { logoDataUrl }] = await Promise.all([import('../lib/pdf.js'), import('../lib/logo.js')]); const doc = await pdfEnvio(e, t, { logo: await logoDataUrl(), quien: nombreDe(db, e.quien), lleva: e.llevaId ? nombreDe(db, e.llevaId) : '', pago: pagoEnvio(db, e) }); descargar(bytesPdf(doc), `Hoja-de-envio-${e.id}.pdf`, 'application/pdf'); aviso('Hoja de envío descargada.') } catch { aviso('No se pudo crear el PDF.', 'error') } }
  return (
    <div className="pagina ancha">
      <button type="button" className="btn suave chico" onClick={() => ir('tiendas')}>Volver a tiendas</button>
      <div className="titulo-fila sub-t"><div><h1>{t.nombre}</h1><p className="sub">{t.encargado || 'Sin encargado'}{t.telefono ? ` · ${t.telefono}` : ''}</p></div><button type="button" className="btn suave chico" onClick={() => setModal({ tipo: 'tienda' })}><Icono n="lapiz" tam={18} />Editar tienda</button></div>
      <div className="resumen-cuenta" role="group" aria-label="Cuenta de la tienda"><div><span>Enviado</span><strong>{soles(c.enviado)}</strong></div><div><span>menos pagado</span><strong>{soles(c.pagado)}</strong></div><div><span>menos devuelto</span><strong>{soles(c.devuelto)}</strong></div><div className="deuda"><span>igual a deuda</span><strong>{soles(c.deuda)}</strong></div></div>
      {c.diferenciasPorRevisar > 0 && <p className="alerta rojo"><Icono n="alerta" />Hay {soles(c.diferenciasPorRevisar)} en mercadería que la tienda dice que no recibió. Revisa los envíos con diferencias.</p>}
      <div className="acciones-fila no-imprimir"><button type="button" className="btn" onClick={() => setModal({ tipo: 'envio' })}><Icono n="camion" />Nuevo envío de stock</button><button type="button" className="btn suave" onClick={() => setModal({ tipo: 'pago' })}><Icono n="billete" />Registrar pago</button>{can('devolverTienda') && <button type="button" className="btn suave" onClick={() => setModal({ tipo: 'devolucion' })}>Registrar devolución</button>}</div>

      <h2 className="sub-t">Quién llevó qué</h2>
      <ResumenLleva db={db} envios={envios} />
      <h2 className="sub-t">Envíos</h2>
      {!envios.length ? <Vacio icono="camion" titulo="Todavía no hay envíos a esta tienda" /> : envios.map(e => (
        <section className="tarjeta envio-t" key={e.id} aria-label={`Envío ${e.id}`}>
          <div className="fila-sb"><div><h3>{e.id} · {fechaCorta(e.fecha)}</h3><small>Preparó {nombreDe(db, e.quien)} · <strong>Lo lleva: {e.llevaId ? nombreDe(db, e.llevaId) : 'sin asignar'}</strong> · valor {soles(e.total)}</small></div>
            <span className="chips-fila"><ChipPago db={db} e={e} />{e.estado === 'Enviado' ? <Chip tono="ambar" icono="reloj">Por confirmar recepción</Chip> : e.estado === 'Con diferencias' ? <Chip tono="rojo" icono="alerta">Con diferencias</Chip> : <Chip tono="verde" icono="check">Recibido completo</Chip>}</span></div>
          <Tabla titulo={`Productos del envío ${e.id}`} cabeceras={['Producto', { t: 'Enviado', der: true }, { t: 'Recibido', der: true }, { t: 'Diferencia', der: true }, { t: 'Valor', der: true }]}>
            {e.items.map(l => { const d = l.recibido === null ? null : l.recibido - l.cantidad; return <tr key={l.productoId} className={d ? 'fila-rojo' : ''}><td>{l.nombre}</td><td className="der">{l.cantidad}</td><td className="der">{l.recibido ?? '—'}</td><td className={`der ${d ? 'dif-rojo' : ''}`}>{d === null ? '—' : d === 0 ? 'Conforme' : `Faltan ${-d}`}</td><td className="der">{soles(l.cantidad * l.precio)}</td></tr> })}</Tabla>
          {e.recepcion && <p className="sub">Recepción confirmada por {nombreDe(db, e.recepcion.quien)} el {fechaHora(e.recepcion.cuando)}</p>}
          <div className="acciones-fila no-imprimir">{!e.recepcion && <button type="button" className="btn calido" onClick={() => setRec({ e, vals: Object.fromEntries(e.items.map(l => [l.productoId, String(l.cantidad)])) })}><Icono n="check" />Confirmar recepción</button>}
            {pagoEnvio(db, e).saldo > 0 && <button type="button" className="btn" onClick={() => setPagoE(e)}><Icono n="billete" />Registrar pago de este envío</button>}
            <button type="button" className="btn suave" onClick={() => pdfEnvio(e)}><Icono n="bajar" />Hoja de envío (PDF)</button>
            <a className="btn wa" href={enlaceWhatsApp(t.telefono, mensajeEnvio(e, t))} target="_blank" rel="noopener noreferrer"><Icono n="chat" />WhatsApp</a></div>
        </section>))}

      <h2 className="sub-t">Cuenta corriente</h2>
      {!c.movimientos.length ? <Vacio icono="billete" titulo="Sin movimientos todavía" /> : <div className="tarjeta"><Tabla titulo="Cuenta corriente de la tienda" cabeceras={['Fecha', 'Tipo', 'Referencia', 'Detalle', { t: 'Monto', der: true }, { t: 'Deuda después', der: true }]}>
        {c.movimientos.map(m => <tr key={m.ref}><td>{fechaCorta(m.fecha)}</td><td><Chip tono={m.monto > 0 ? 'azul' : 'verde'}>{m.tipo}</Chip></td><td>{m.ref}</td><td>{m.detalle}</td><td className="der">{m.monto > 0 ? '+' : '-'} {soles(Math.abs(m.monto))}</td><td className="der"><strong>{soles(m.saldo)}</strong></td></tr>)}</Tabla></div>}

      {modal?.tipo === 'tienda' && <FormTienda tienda={t} onCerrar={() => setModal(null)} />}
      {modal?.tipo === 'envio' && <FormEnvio t={t} onCerrar={() => setModal(null)} />}
      {modal?.tipo === 'pago' && <FormPago t={t} deuda={c.deuda} onCerrar={() => setModal(null)} />}
      {modal?.tipo === 'devolucion' && <FormDevolucion t={t} onCerrar={() => setModal(null)} />}
      {rec && <Recepcion rec={rec} onCerrar={() => setRec(null)} />}
      {pagoE && <FormPago t={t} deuda={Math.min(c.deuda, pagoEnvio(db, pagoE).saldo)} envio={pagoE} onCerrar={() => setPagoE(null)} />}
    </div>)
}
function FormEnvio({ t, onCerrar }) {
  const { vista: db, run, aviso, confirmar } = useApp(), [items, setItems] = useState([]), [nota, setNota] = useState('')
  const personas = db.usuarios.filter(u => u.activo !== false && u.rol !== 'otro')
  const [lleva, setLleva] = useState(personas.find(u => u.rol === 'vendedor')?.id || ''), [estado, setEstado] = useState('Debe'), [medio, setMedio] = useState('Efectivo'), [monto, setMonto] = useState(''), [err, setErr] = useState('')
  const total = totalCarro(items, db.productos)
  const enviar = async () => {
    setErr('')
    if (!items.length) return setErr('Elige al menos un producto.')
    if (!lleva) return setErr('Elige quién lleva el envío.')
    let m = null; if (estado === 'Parcial') { m = aMonto(monto); if (m === null || !(m > 0) || m >= total) return setErr(`El pago parcial debe ser mayor que cero y menor que ${soles(total)}.`) }
    const c = await confirmar({ titulo: '¿Crear el envío?', lineas: [...items.map(i => `${i.cantidad} × ${db.productos.find(p => p.id === i.productoId).nombre}`), `Valor: ${soles(total)}`, `Lo lleva: ${nombreDe(db, lleva)}`, estado === 'Debe' ? 'Pago: Debe todo' : estado === 'Pagado' ? `Pago: Pagado con ${medio}` : `Pago: Parcial, ${soles(m)} con ${medio}`, 'El stock baja ahora.'], boton: 'Sí, crear envío' }); if (!c.ok) return
    if (await run(crearEnvio, { tiendaId: t.id, items, nota, llevaId: lleva, pago: { estado, medio, monto: m } })) { aviso('Envío creado. Ya puedes descargar la hoja en PDF.'); onCerrar() }
  }
  return <Modal ancho titulo={`Nuevo envío a ${t.nombre}`} onCerrar={onCerrar}><Selector productos={db.productos} items={items} onCambio={setItems} permitirOtros={false} titulo="Productos del envío" />
    <div className="rejilla">
      <Campo etiqueta="Lo lleva" id="el"><select id="el" value={lleva} onChange={e => setLleva(e.target.value)}><option value="">Elige quién lo lleva…</option>{personas.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}</select></Campo>
      <Campo etiqueta="Pago del envío" id="ep"><select id="ep" value={estado} onChange={e => setEstado(e.target.value)}><option value="Debe">Debe (no pagó)</option><option value="Parcial">Pagó una parte</option><option value="Pagado">Pagado completo</option></select></Campo>
      {estado !== 'Debe' && <Campo etiqueta="Pagó con" id="em"><select id="em" value={medio} onChange={e => setMedio(e.target.value)}>{MEDIOS_CAJA.map(m => <option key={m}>{m}</option>)}</select></Campo>}
      {estado === 'Parcial' && <Campo etiqueta="Monto pagado (S/)" id="emo"><input id="emo" inputMode="decimal" value={monto} onChange={e => setMonto(e.target.value)} /></Campo>}
    </div>
    <Campo etiqueta="Nota (opcional)" id="en"><input id="en" value={nota} maxLength={160} onChange={e => setNota(e.target.value)} /></Campo>
    {err && <p className="error" role="alert">{err}</p>}
    <div className="acciones-fila fin"><button type="button" className="btn suave" onClick={onCerrar}>Cancelar</button><button type="button" className="btn" onClick={enviar}>Crear envío</button></div></Modal>
}
function Recepcion({ rec, onCerrar }) {
  const { run, aviso, confirmar } = useApp(), [vals, setVals] = useState(rec.vals), [err, setErr] = useState('')
  const dif = l => Number(vals[l.productoId]) - l.cantidad
  const enviar = async () => {
    setErr(''); const mal = rec.e.items.find(l => !/^\d+$/.test(String(vals[l.productoId])) || Number(vals[l.productoId]) > l.cantidad); if (mal) return setErr(`Revisa "${mal.nombre}": lo recibido va de 0 a ${mal.cantidad}.`)
    const nd = rec.e.items.filter(l => dif(l) !== 0).length
    const c = await confirmar({ titulo: '¿Confirmar la recepción?', texto: nd ? `Hay ${nd} producto(s) con diferencia. Quedarán marcados en rojo.` : 'Todo llegó completo.', boton: 'Sí, confirmar' }); if (!c.ok) return
    if (await run(confirmarRecepcion, rec.e.id, vals)) { aviso('Recepción confirmada.'); onCerrar() }
  }
  return <Modal ancho titulo={`Confirmar recepción ${rec.e.id}`} onCerrar={onCerrar}><p className="sub">Cuenta con la tienda cada producto y escribe cuántos recibió.</p>
    <Tabla titulo="Recepción por producto" cabeceras={['Producto', { t: 'Enviado', der: true }, { t: 'Recibió', der: true }, { t: 'Diferencia', der: true }]}>
      {rec.e.items.map(l => <tr key={l.productoId} className={dif(l) ? 'fila-rojo' : ''}><td>{l.nombre}</td><td className="der">{l.cantidad}</td><td className="der"><input aria-label={`Recibió de ${l.nombre}`} inputMode="numeric" value={vals[l.productoId]} onChange={e => setVals({ ...vals, [l.productoId]: e.target.value })} /></td><td className={`der ${dif(l) ? 'dif-rojo' : 'dif-ok'}`}>{Number.isNaN(dif(l)) ? '—' : dif(l) === 0 ? 'Conforme' : dif(l)}</td></tr>)}</Tabla>
    {err && <p className="error" role="alert">{err}</p>}<div className="acciones-fila fin"><button type="button" className="btn suave" onClick={onCerrar}>Cancelar</button><button type="button" className="btn" onClick={enviar}>Confirmar recepción</button></div></Modal>
}
function FormPago({ t, deuda, envio = null, onCerrar }) {
  const { run, aviso, confirmar } = useApp(), [monto, setMonto] = useState(''), [medio, setMedio] = useState('Efectivo'), [nota, setNota] = useState(''), [err, setErr] = useState('')
  const enviar = async e => {
    e.preventDefault(); setErr(''); const m = aMonto(monto); if (m === null || m <= 0) return setErr('Escribe un monto válido, como 150 o 150.50.'); if (m > deuda + 0.001) return setErr(`El pago no puede ser mayor que la deuda (${soles(deuda)}).`)
    const c = await confirmar({ titulo: '¿Registrar el pago?', texto: `${t.nombre} pagó ${soles(m)} con ${medio}. La deuda baja a ${soles(deuda - m)}.`, boton: 'Sí, registrar pago' }); if (!c.ok) return
    if (await run(registrarPagoTienda, { tiendaId: t.id, monto: m, medio, nota, envioId: envio?.id || null })) { aviso('Pago registrado.'); onCerrar() }
  }
  return <Modal titulo={envio ? `Pago del envío ${envio.id}` : "Registrar pago de la tienda"} onCerrar={onCerrar}><form onSubmit={enviar} noValidate><p>{envio ? "Falta pagar de este envío" : "Deuda actual"}: <strong>{soles(deuda)}</strong></p>
    <div className="rejilla"><Campo etiqueta="Monto pagado (S/)" id="pm"><input id="pm" inputMode="decimal" value={monto} onChange={e => setMonto(e.target.value)} /></Campo><Campo etiqueta="Pagó con" id="pd"><select id="pd" value={medio} onChange={e => setMedio(e.target.value)}>{MEDIOS_CAJA.map(m => <option key={m}>{m}</option>)}</select></Campo></div>
    <Campo etiqueta="Nota (opcional)" id="pn"><input id="pn" value={nota} maxLength={100} onChange={e => setNota(e.target.value)} /></Campo>
    {err && <p className="error" role="alert">{err}</p>}<div className="acciones-fila fin"><button type="button" className="btn suave" onClick={onCerrar}>Cancelar</button><button type="submit" className="btn">Registrar pago</button></div></form></Modal>
}
function FormDevolucion({ t, onCerrar }) {
  const { vista: db, run, aviso, confirmar } = useApp()
  const recibidos = {}; db.envios.filter(e => e.tiendaId === t.id).forEach(e => e.items.forEach(l => { recibidos[l.productoId] = { nombre: l.nombre, n: (recibidos[l.productoId]?.n || 0) + (l.recibido ?? l.cantidad) } }))
  const [pid, setPid] = useState(Object.keys(recibidos)[0] || ''), [cant, setCant] = useState('1'), [motivo, setMotivo] = useState(''), [err, setErr] = useState('')
  const enviar = async e => {
    e.preventDefault(); setErr(''); if (!pid) return setErr('Elige el producto.'); if (!/^\d+$/.test(cant) || Number(cant) < 1) return setErr('La cantidad debe ser un número entero, 1 o más.'); if (motivo.trim().length < 4) return setErr('Escribe el motivo de la devolución.')
    const c = await confirmar({ titulo: '¿Registrar la devolución?', texto: `${cant} × ${recibidos[pid].nombre} vuelven a tu stock y bajan la deuda de la tienda.`, boton: 'Sí, registrar' }); if (!c.ok) return
    if (await run(registrarDevolucionTienda, { tiendaId: t.id, items: [{ productoId: pid, cantidad: Number(cant) }], motivo })) { aviso('Devolución registrada.'); onCerrar() }
  }
  return <Modal titulo="Devolución de la tienda" onCerrar={onCerrar}>{!Object.keys(recibidos).length ? <p>Esta tienda todavía no recibió productos.</p> : <form onSubmit={enviar} noValidate>
    <Campo etiqueta="Producto devuelto" id="dp"><select id="dp" value={pid} onChange={e => setPid(e.target.value)}>{Object.entries(recibidos).map(([k, v]) => <option key={k} value={k}>{v.nombre}</option>)}</select></Campo>
    <div className="rejilla"><Campo etiqueta="Cantidad" id="dc"><input id="dc" inputMode="numeric" value={cant} onChange={e => setCant(e.target.value)} /></Campo><Campo etiqueta="Motivo" id="dm"><input id="dm" value={motivo} maxLength={120} onChange={e => setMotivo(e.target.value)} /></Campo></div>
    {err && <p className="error" role="alert">{err}</p>}<div className="acciones-fila fin"><button type="button" className="btn suave" onClick={onCerrar}>Cancelar</button><button type="submit" className="btn">Registrar devolución</button></div></form>}</Modal>
}

// Vista del vendedor: solo los envíos que él lleva, sin poder cambiar nada.
export function MisEnvios() {
  const { vista: db } = useApp()
  const envios = [...db.envios].sort((a, b) => b.numero - a.numero), tienda = id => db.tiendas.find(t => t.id === id)
  const debe = envios.reduce((s, e) => s + pagoEnvio(db, e).saldo, 0)
  return (
    <div className="pagina">
      <h1>Mis envíos a tiendas</h1><p className="sub">Los envíos que tú llevas. Solo para consultar: los cambios los hace la administración.</p>
      <div className="kpis"><div className="kpi-card"><span className="kpi-et">Envíos que llevas</span><strong className="kpi-val">{envios.length}</strong></div><div className={`kpi-card ${debe > 0 ? 'ambar' : ''}`}><span className="kpi-et">Falta cobrar</span><strong className="kpi-val">{soles(debe)}</strong></div></div>
      {!envios.length ? <Vacio icono="camion" titulo="No tienes envíos asignados" texto="Cuando la administración te asigne un envío, aparecerá aquí." /> : envios.map(e => { const t = tienda(e.tiendaId)
        return <section className="tarjeta envio-t" key={e.id} aria-label={`Envío ${e.id}`}>
          <div className="fila-sb"><div><h3>{t?.nombre || 'Tienda'} · {e.id}</h3><small>{fechaCorta(e.fecha)} · {e.items.reduce((s, l) => s + l.cantidad, 0)} unidades · valor {soles(e.total)}</small></div><ChipPago db={db} e={e} /></div>
          <Tabla titulo={`Lo que llevas en ${e.id}`} cabeceras={['Producto', { t: 'Cantidad', der: true }, { t: 'Valor', der: true }]}>
            {e.items.map(l => <tr key={l.productoId}><td>{l.nombre}</td><td className="der">{l.cantidad}</td><td className="der">{soles(l.cantidad * l.precio)}</td></tr>)}</Tabla>
          {e.nota && <p className="sub">Nota: {e.nota}</p>}
        </section> })}
    </div>)
}
