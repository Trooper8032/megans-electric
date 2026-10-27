import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../components/contexto.js'
import Selector, { totalCarro } from '../components/Selector.jsx'
import Foto from '../components/Foto.jsx'
import { Campo, Chip, ChipMedio, Vacio, Tabla } from '../components/ui.jsx'
import { Icono } from '../components/Iconos.jsx'
import { MEDIOS_CAJA, MOTIVOS_DEVOLUCION, AVISO_GUIA, config } from '../config/app.config.js'
import { agregarAVenta, anularVenta, guardarFotoVenta, guardarFotoLinea, registrarDevolucion, cantidadDevuelta, cajaBloqueada, estadoCobro, saldoDe, pagadoDe, registrarPago, verificarPago, guardarFotoPago, MEDIOS_CON_OPERACION } from '../lib/dominio.js'
import { soles } from '../lib/dinero.js'
import { fechaISO, sumarDias, fechaLarga, fechaHora } from '../lib/fechas.js'
import { codigoGuia } from '../lib/verificacion.js'
import { enlaceWhatsApp, mensajeGuia } from '../lib/whatsapp.js'
import { descargar } from '../lib/descarga.js'

const nombreDe = (db, id) => db.usuarios.find(u => u.id === id)?.nombre || '—'
export default function Ventas({ id }) { return id ? <Detalle id={id} /> : <Lista /> }

function Lista() {
  const { vista: db, rol, ir, can } = useApp()
  const hoy = fechaISO(new Date()), [fecha, setFecha] = useState(hoy), [q, setQ] = useState(''), [solo, setSolo] = useState('todas')
  const del = db.ventas.filter(v => v.fecha === fecha).sort((a, b) => b.numero - a.numero)
  const filtrado = del.filter(v => (solo === 'todas' || (solo === 'pendientes' ? v.estado === 'Activa' && saldoDe(v) > 0 : solo === 'anuladas' ? v.estado === 'Anulada' : true)) && (!q.trim() || `${v.id} ${v.cliente} ${v.items.map(l => l.nombre).join(' ')}`.toLowerCase().includes(q.trim().toLowerCase())))
  const pendTodas = db.ventas.filter(v => v.estado === 'Activa' && saldoDe(v) > 0)
  const total = filtrado.filter(v => v.estado === 'Activa').reduce((s, v) => s + v.total, 0)
  return (
    <div className="pagina">
      <div className="titulo-fila"><div><h1>{rol === 'vendedor' ? 'Mis ventas' : 'Ventas del día'}</h1><p className="sub">{fechaLarga(fecha)}</p></div>
        <button type="button" className="btn" onClick={() => ir('vender')}><Icono n="carrito" />Nueva venta</button></div>
      <section className="tarjeta" aria-label="Buscar ventas">
        <div className="rejilla">
          <Campo etiqueta="Día" id="dia"><input id="dia" type="date" max={hoy} value={fecha} onChange={e => e.target.value && setFecha(e.target.value)} /></Campo>
          <Campo etiqueta="Buscar por número, cliente o producto" id="bq"><input id="bq" value={q} onChange={e => setQ(e.target.value)} placeholder="Ej.: G001-0001 o Juan" /></Campo>
        </div>
        <div className="acciones-fila">
          <button type="button" className="btn suave chico" onClick={() => setFecha(sumarDias(fecha, -1))}>Día anterior</button>
          <button type="button" className="btn suave chico" disabled={fecha >= hoy} onClick={() => setFecha(sumarDias(fecha, 1))}>Día siguiente</button>
          <button type="button" className="btn suave chico" disabled={fecha === hoy} onClick={() => setFecha(hoy)}>Hoy</button>
        </div>
        <div className="cats" role="group" aria-label="Filtrar">{[['todas', 'Todas'], ['pendientes', `Pendientes de cobro (${pendTodas.length})`], ['anuladas', 'Anuladas']].map(([k, t]) => <button key={k} type="button" className={`cat ${solo === k ? 'on' : ''}`} aria-pressed={solo === k} onClick={() => { setSolo(k); if (k === 'pendientes') setFecha(fecha) }}>{t}</button>)}</div>
      </section>
      {solo === 'pendientes' && pendTodas.length > 0 && <section className="tarjeta"><h2>Todas las ventas pendientes de cobro</h2>
        <ul className="lista">{pendTodas.sort((a, b) => a.numero - b.numero).map(v => <li key={v.id}><button type="button" className="fila-tarjeta" onClick={() => ir('ventas', v.id)}><span className="datos"><strong>{v.cliente}</strong><small>{v.id} · {v.fecha} · {nombreDe(db, v.vendedorId)}</small></span><span className="monto">falta {soles(saldoDe(v))}</span></button></li>)}</ul></section>}
      <p className="sub"><strong>{filtrado.length}</strong> venta(s) · total válido <strong>{soles(total)}</strong></p>
      {!filtrado.length ? <Vacio icono="archivo" titulo="No hay ventas con esos datos" texto={del.length ? 'Prueba quitando el filtro o la búsqueda.' : 'Ese día no se registraron ventas.'} /> :
        <ul className="lista">{filtrado.map(v => (
          <li key={v.id}><button type="button" className="fila-tarjeta" onClick={() => ir('ventas', v.id)}>
            <span className="oculto">Abrir venta </span><span className="datos"><strong>{v.cliente}</strong><small>{v.id} · {v.hora} · {nombreDe(db, v.vendedorId)} · {v.items.length} producto(s)</small></span>
            <ChipsCobro v={v} />
            {v.version > 1 && <Chip tono="calido">Con agregados</Chip>}
            <span className="monto">{soles(v.total)}</span></button></li>))}</ul>}
    </div>
  )
}

function Detalle({ id }) {
  const { vista: db, sesion, rol, run, ir, can, confirmar, aviso } = useApp()
  const v = db.ventas.find(x => x.id === id)
  const [agregando, setAgregando] = useState(false), [extra, setExtra] = useState([]), [dev, setDev] = useState(null), [trabajando, setTrabajando] = useState(false), [pago, setPago] = useState(null)
  useEffect(() => { setAgregando(false); setExtra([]); setDev(null); setPago(null) }, [id])
  if (!v) return <div className="pagina"><button type="button" className="btn suave chico" onClick={() => ir('ventas')}>Volver a ventas</button><Vacio icono="archivo" titulo="No se encontró esa venta" texto="Puede que sea de otro vendedor o que el número esté mal escrito." /></div>
  const hoy = fechaISO(new Date()), activa = v.estado === 'Activa'
  const bloqueada = cajaBloqueada(db, v.fecha, v.vendedorId)
  const puedeAgregar = activa && !bloqueada && (rol !== 'vendedor' || (v.vendedorId === sesion.id && v.fecha === hoy))
  const vend = nombreDe(db, v.vendedorId)
  const pdf = async () => {
    setTrabajando(true)
    try { const [{ pdfGuia, bytesPdf }, { logoDataUrl }] = await Promise.all([import('../lib/pdf.js'), import('../lib/logo.js')]); const doc = await pdfGuia(v, { vendedor: vend, logo: await logoDataUrl(), nombre: x => nombreDe(db, x), devoluciones: db.devoluciones.filter(d => d.ventaId === v.id) }); descargar(bytesPdf(doc), `Guia-${v.id}.pdf`, 'application/pdf'); aviso('Guía en PDF descargada.') }
    catch { aviso('No se pudo crear el PDF. Inténtalo otra vez.', 'error') }
    setTrabajando(false)
  }
  const agregar = async () => {
    if (!extra.length) return aviso('Elige al menos un producto para agregar.', 'error')
    const c = await confirmar({ titulo: '¿Agregar a esta venta?', lineas: [...extra.map(i => `${i.cantidad} × ${i.productoId === 'PRD-999' ? 'Otros: ' + i.detalle : db.productos.find(p => p.id === i.productoId).nombre}`), `Total nuevo: ${soles(v.total + totalCarro(extra, db.productos))}`, 'Quedará anotado quién lo agregó y a qué hora.'], boton: 'Sí, agregar' })
    if (!c.ok) return
    if (await run(agregarAVenta, v.id, extra)) { setAgregando(false); setExtra([]); aviso('Productos agregados. La guía quedó actualizada.') }
  }
  const saldo = saldoDe(v)
  const cobrar = async () => {
    if (!pago) return
    const monto = Number(String(pago.monto).replace(',', '.'))
    if (!(monto > 0 && monto <= saldo + 0.001)) return aviso(`El monto debe ser mayor que cero y hasta ${soles(saldo)}.`, 'error')
    if (MEDIOS_CON_OPERACION.includes(pago.medio) && !/^[0-9A-Za-z-]{4,20}$/.test(pago.operacion.replace(/\s/g, ''))) return aviso(`Escribe el número de operación de ${pago.medio}.`, 'error')
    const c = await confirmar({ titulo: '¿Registrar el pago?', texto: `${soles(monto)} con ${pago.medio}${pago.operacion ? ` (operación ${pago.operacion})` : ''}. ${monto >= saldo - 0.001 ? 'La venta queda Cobrada.' : `Quedará faltando ${soles(saldo - monto)}.`}`, boton: 'Sí, registrar pago' })
    if (c.ok && await run(registrarPago, v.id, { medio: pago.medio, monto, operacion: pago.operacion, foto: pago.foto })) { setPago(null); aviso(monto >= saldo - 0.001 ? 'Pago registrado. La venta quedó Cobrada.' : 'Pago parcial registrado.') }
  }
  const verificar = async pg => { const c = await confirmar({ titulo: '¿Verificar este pago?', texto: `${soles(pg.monto)} con ${pg.medio}${pg.operacion ? `, operación ${pg.operacion}` : ''}. Confírmalo solo si lo viste en tu ${pg.medio === 'Efectivo' ? 'caja' : 'aplicativo'}.`, boton: 'Sí, verificado' }); if (c.ok && await run(verificarPago, v.id, pg.id)) aviso('Pago verificado.') }
  const fotoVenta = async f => { if (await run(guardarFotoVenta, v.id, f)) aviso(f ? 'Foto guardada.' : 'Foto quitada.') }
  const anular = async () => { const c = await confirmar({ titulo: '¿Anular esta venta?', texto: 'La venta no se borra: queda marcada como anulada y el stock vuelve al inventario.', pideMotivo: true, etiquetaMotivo: 'Motivo de la anulación', boton: 'Sí, anular', peligro: true }); if (c.ok && await run(anularVenta, v.id, c.motivo)) aviso('Venta anulada. Quedó registrada.') }
  const devolver = async () => {
    const lineaDev = v.items.find(l => l.productoId === dev.productoId); if (!lineaDev) return aviso('Elige un producto.', 'error')
    const c = await confirmar({ titulo: '¿Registrar la devolución?', lineas: [`${dev.cantidad} × ${lineaDev.nombre}`, `Devuelves ${soles(Number(dev.cantidad) * lineaDev.precio)} (${dev.medio || 'mismo medio'})`, dev.reingresa ? 'El producto vuelve al stock.' : 'El producto NO vuelve al stock.'], boton: 'Sí, registrar' })
    if (c.ok && await run(registrarDevolucion, { ventaId: v.id, productoId: dev.productoId, cantidad: Number(dev.cantidad), motivo: dev.motivo, reingresa: dev.reingresa, medio: dev.medio || undefined, foto: dev.foto || undefined })) { setDev(null); aviso('Devolución registrada.') }
  }
  const devueltas = v.items.map(l => cantidadDevuelta(db, v.id, l.productoId))
  return (
    <div className="pagina">
      <button type="button" className="btn suave chico no-imprimir" onClick={() => ir('ventas')}>Volver a ventas</button>
      <div className="titulo-fila sub-t"><div><h1>Guía {v.id}</h1><p className="sub">{fechaLarga(v.fecha)} · {v.hora} · atendió {vend}{v.registradoPor && v.registradoPor !== v.vendedorId ? ` · registró ${nombreDe(db, v.registradoPor)}` : ''} · estado: {estadoCobro(v)}</p></div>
        <div><ChipsCobro v={v} /> {v.version > 1 && <Chip tono="calido">Se agregaron productos ({v.version - 1})</Chip>}</div></div>

      <article className="guia" aria-label={`Vista de la guía de venta ${v.id}`}>
        <div className="guia-cab"><img src={import.meta.env.BASE_URL + "img/logo-640.png"} alt={config.nombre} width="143" height="48" /><div className="tit"><strong>GUÍA DE VENTA</strong><span>N.º {v.id}</span><small>{fechaLarga(v.fecha)} · {v.hora}</small></div></div>
        <p><strong>Cliente:</strong> {v.cliente}{v.telefono && <> · <strong>Celular:</strong> {v.telefono}</>}</p>
        <Tabla titulo="Productos de la guía" cabeceras={['Cant.', 'Producto', { t: 'P. unitario', der: true }, { t: 'Subtotal', der: true }]}>
          {v.items.map((l, i) => <tr key={i}><td>{l.cantidad}</td><td>{l.nombre}{l.agregadoEn && l.agregadoEn !== v.creadoEn && <small> · agregado por {nombreDe(db, l.agregadoPor)} ({fechaHora(l.agregadoEn)})</small>}{devueltas[i] > 0 && <small className="rojo-t"> · devueltos {devueltas[i]}</small>}{l.foto && <img className="foto-mini" src={l.foto} alt={`Foto de ${l.nombre}`} />}</td><td className="der">{soles(l.precio)}{l.precioEditado && <small className="tachado"> lista {soles(l.precioLista)}</small>}</td><td className="der">{soles(l.cantidad * l.precio)}</td></tr>)}
          <tr><td colSpan={3} className="der"><strong>TOTAL</strong></td><td className="der"><strong>{soles(v.total)}</strong></td></tr>
        </Tabla>
        <h3 className="sub-t">Pagos</h3>
        {(v.pagos || []).length ? <ul className="pagos-lista">{v.pagos.map(pg => <li key={pg.id}><ChipMedio medio={pg.medio} /><span>{fechaHora(pg.cuando)} · cobró {nombreDe(db, pg.quien)}{pg.operacion && <> · operación <strong>{pg.operacion}</strong></>}</span>
          {pg.estado === 'Verificado' ? <Chip tono="verde" icono="check">Verificado</Chip> : <Chip tono="ambar" icono="reloj">Por verificar</Chip>}{pg.duplicado && <Chip tono="rojo">Operación repetida</Chip>}
          <span className="monto">{soles(pg.monto)}</span>
          {pg.foto && <img className="foto-mini" src={pg.foto} alt={`Comprobante del pago con ${pg.medio}`} />}
          {can('verificarPago') && pg.estado !== 'Verificado' && activa && <button type="button" className="btn chico no-imprimir" onClick={() => verificar(pg)}>Verificar pago</button>}
          {!pg.foto && activa && (rol !== 'vendedor' || v.vendedorId === sesion.id) && <span className="no-imprimir"><Foto valor={null} onCambio={f => run(guardarFotoPago, v.id, pg.id, f)} etiqueta="Agregar foto del comprobante" alt="Comprobante" compacta /></span>}</li>)}</ul> : <p className="mut">Sin pagos todavía.</p>}
        <p><strong>Pagado:</strong> {soles(pagadoDe(v))} · <strong>Falta cobrar:</strong> {soles(saldo)}</p>
        {db.devoluciones.some(d => d.ventaId === v.id) && <><h3 className="sub-t">Devoluciones</h3><ul className="pagos-lista">{db.devoluciones.filter(d => d.ventaId === v.id).map(d => <li key={d.id}><span>{fechaHora(d.cuando)} · {nombreDe(db, d.quien)} · {d.cantidad} × {d.nombre} · {d.motivo}{d.reingresa ? ' · volvió al stock' : ''}</span><span className="monto">−{soles(d.monto)}</span></li>)}</ul></>}
        <div className="guia-pie">
          <div className="guia-cod"><span>Código de verificación</span><strong>{codigoGuia(v)}</strong></div>
        </div>
        <p className="aviso-sunat">{AVISO_GUIA} La emisión de comprobantes SUNAT queda para una etapa posterior.</p>
      </article>

      <section className="tarjeta no-imprimir" aria-label="Enviar la guía"><h2>Enviar la guía</h2>
        <p className="sub">1) Descarga el PDF. 2) Abre WhatsApp y adjunta el archivo. El mensaje ya sale escrito; tú lo envías.</p>
        <div className="acciones-fila"><button type="button" className="btn" disabled={trabajando} onClick={pdf}><Icono n="bajar" />{trabajando ? 'Creando PDF…' : 'Descargar guía en PDF'}</button>
          <a className="btn wa" href={enlaceWhatsApp(v.telefono, mensajeGuia(v))} target="_blank" rel="noopener noreferrer"><Icono n="chat" />Abrir WhatsApp con el mensaje</a>
          <button type="button" className="btn suave" onClick={() => window.print()}><Icono n="imprimir" />Imprimir</button></div>
        {!v.telefono && <p className="ayuda">Esta venta no tiene celular: WhatsApp se abrirá para que elijas el contacto.</p>}
      </section>

      {activa && <section className="tarjeta no-imprimir" aria-label="Acciones sobre la venta"><h2>Acciones</h2>
        {bloqueada && <p className="alerta ambar"><Icono n="candado" />La caja de ese día está cerrada: no se puede cambiar esta venta.</p>}
        {saldo > 0 && (rol !== 'vendedor' || v.vendedorId === sesion.id) && !cajaBloqueada(db, hoy, sesion.id) && <div className="cobrar-pend" role="group" aria-labelledby="t-cp"><h3 id="t-cp">Registrar pago (falta cobrar {soles(saldo)})</h3>
          <div className="medios tres">{MEDIOS_CAJA.map(m => <button key={m} type="button" aria-pressed={pago?.medio === m} className={`medio m-${m.toLowerCase()} ${pago?.medio === m ? 'on' : ''}`} onClick={() => setPago({ medio: m, monto: String(saldo), operacion: pago?.operacion || '', foto: pago?.foto || null })}>Cobrar con {m}</button>)}</div>
          {pago && <div className="rejilla">
            <Campo etiqueta="Monto del pago (S/)" id="pg-m" ayuda="Puedes cobrar solo una parte"><input id="pg-m" inputMode="decimal" value={pago.monto} onChange={e => setPago({ ...pago, monto: e.target.value })} /></Campo>
            {MEDIOS_CON_OPERACION.includes(pago.medio) && <Campo etiqueta={`Número de operación de ${pago.medio} (obligatorio)`} id="pg-o"><input id="pg-o" inputMode="numeric" maxLength={20} value={pago.operacion} onChange={e => setPago({ ...pago, operacion: e.target.value })} /></Campo>}
          </div>}
          {pago && <Foto valor={pago.foto} onCambio={f => setPago({ ...pago, foto: f })} etiqueta="Foto del comprobante (opcional)" alt="Comprobante de pago" compacta />}
          {pago && <div className="acciones-fila"><button type="button" className={`btn m-${pago.medio.toLowerCase()}`} onClick={cobrar}><Icono n="check" />Registrar pago con {pago.medio}</button></div>}
        </div>}
        <div className="acciones-fila">
          {puedeAgregar && <button type="button" className="btn calido" onClick={() => setAgregando(a => !a)} aria-expanded={agregando}><Icono n="mas" />{agregando ? 'Cancelar agregado' : 'Agregar productos a esta venta'}</button>}
          {can('devolver') && <button type="button" className="btn suave" onClick={() => setDev(d => d ? null : { productoId: v.items[0].productoId, cantidad: '1', motivo: MOTIVOS_DEVOLUCION[0], reingresa: true, medio: '', foto: null })}>Registrar devolución</button>}
          {can('anular') && <button type="button" className="btn peligro" onClick={anular}>Anular venta</button>}
        </div>
        {dev && <div className="tarjeta" role="group" aria-label="Datos de la devolución"><h3>Devolución</h3>
          <div className="rejilla"><Campo etiqueta="Producto" id="dv-p"><select id="dv-p" value={dev.productoId} onChange={e => setDev({ ...dev, productoId: e.target.value })}>{[...new Map(v.items.map(l => [l.productoId, l])).values()].map(l => <option key={l.productoId} value={l.productoId}>{l.nombre}</option>)}</select></Campo>
            <Campo etiqueta="Cantidad" id="dv-c"><input id="dv-c" inputMode="numeric" value={dev.cantidad} onChange={e => setDev({ ...dev, cantidad: e.target.value })} /></Campo>
            <Campo etiqueta="Motivo" id="dv-m"><select id="dv-m" value={dev.motivo} onChange={e => setDev({ ...dev, motivo: e.target.value })}>{MOTIVOS_DEVOLUCION.map(m => <option key={m}>{m}</option>)}</select></Campo>
            <Campo etiqueta="Devolver el dinero en" id="dv-d"><select id="dv-d" value={dev.medio} onChange={e => setDev({ ...dev, medio: e.target.value })}><option value="">Igual que se pagó</option>{MEDIOS_CAJA.map(m => <option key={m}>{m}</option>)}</select></Campo></div>
          <label className="check-fila"><input type="checkbox" checked={dev.reingresa} onChange={e => setDev({ ...dev, reingresa: e.target.checked })} />El producto vuelve al stock (reingreso)</label>
          <Foto valor={dev.foto} onCambio={f => setDev({ ...dev, foto: f })} etiqueta="Foto del producto devuelto (opcional)" alt="Foto de la devolución" />
          <div className="acciones-fila"><button type="button" className="btn" onClick={devolver}>Registrar devolución</button></div></div>}
        {agregando && <div><h3 className="sub-t">Productos que se agregan</h3><Selector productos={db.productos} items={extra} onCambio={setExtra} titulo="Agregados" /><div className="acciones-fila"><button type="button" className="btn" onClick={agregar}><Icono n="check" />Agregar a la venta</button></div></div>}
      </section>}

      {activa && (rol !== 'vendedor' || v.vendedorId === sesion.id) && <section className="tarjeta no-imprimir" aria-label="Fotos por producto"><h2>Fotos por producto (opcional)</h2>
        <p className="sub">Además de la foto general, cada producto puede tener su foto. Se pueden agregar después.</p>
        <div className="fotos-lineas">{v.items.map((l, i) => <Foto key={i + (l.foto ? 'f' : 'n')} valor={l.foto || null} onCambio={f => run(guardarFotoLinea, v.id, i, f)} etiqueta={`${l.cantidad} × ${l.nombre}`} alt={`Foto de ${l.nombre}`} compacta mejorar />)}</div></section>}

      {(v.foto || (activa && (rol !== 'vendedor' || v.vendedorId === sesion.id))) && <section className="tarjeta no-imprimir" aria-label="Foto de la venta"><h2>Foto de la venta</h2>
        {activa && (rol !== 'vendedor' || v.vendedorId === sesion.id) ? <Foto key={v.id + (v.foto ? 'f' : 'n')} valor={v.foto} onCambio={fotoVenta} etiqueta="Foto del producto o del cliente (opcional)" mejorar /> : <div className="foto-prev"><img src={v.foto} alt="Foto de la venta" /></div>}</section>}

      <section className="tarjeta" aria-label="Historial de cambios"><h2>Historial de cambios</h2>
        <p className="sub">Nada se borra: aquí queda quién hizo cada cosa y cuándo.</p>
        <ol className="hist">{v.historial.map((h, i) => <li key={i}><strong>{nombreDe(db, h.quien)}</strong> · <small>{fechaHora(h.cuando)}</small><br />{h.que}</li>)}</ol>
      </section>
    </div>
  )
}

function ChipsCobro({ v }) {
  const e = estadoCobro(v), med = [...new Set((v.pagos || []).map(p => p.medio))]
  if (e === 'Anulada') return <Chip tono="rojo">Anulada</Chip>
  return <>{e === 'Pendiente' ? <ChipMedio medio="Pendiente">Pendiente de cobro</ChipMedio> : e === 'Parcial' ? <Chip tono="ambar" icono="reloj">Pago parcial · falta {soles(saldoDe(v))}</Chip> : null}{med.map(m => <ChipMedio key={m} medio={m} />)}{(v.pagos || []).some(p => p.estado === 'Por verificar') && <Chip tono="ambar">Por verificar</Chip>}</>
}
