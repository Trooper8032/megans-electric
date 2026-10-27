import { useState } from 'react'
import { useApp } from '../components/contexto.js'
import { Campo, Chip, Tabs, Tabla } from '../components/ui.jsx'
import { Icono } from '../components/Iconos.jsx'
import { MEDIOS_CAJA } from '../config/app.config.js'
import { calcularCaja, cierreDe, cerrarCaja, reabrirCaja, ventasDe, saldoDe } from '../lib/dominio.js'
import { soles, aMonto, r2 } from '../lib/dinero.js'
import { fechaISO, sumarDias, fechaLarga, fechaHora, fechaCorta } from '../lib/fechas.js'
import { enlaceWhatsApp, textoResumenDia } from '../lib/whatsapp.js'
import { descargar } from '../lib/descarga.js'

const nombreDe = (db, id) => db.usuarios.find(u => u.id === id)?.nombre || '—'
export default function Caja() {
  const { vista: db, sesion, rol, ir } = useApp(), hoy = fechaISO(new Date()), [fecha, setFecha] = useState(hoy), [tab, setTab] = useState('dia')
  const vendedores = db.usuarios.filter(u => u.rol === 'vendedor' || u.id === sesion.id || db.ventas.some(v => v.fecha === fecha && v.vendedorId === u.id))
  const esVend = rol === 'vendedor'
  return (
    <div className="pagina ancha">
      <h1>{esVend ? 'Mi caja' : 'Caja y conciliación'}</h1><p className="sub">{fechaLarga(fecha)}. Cuenta lo que hay y compáralo con lo que el sistema espera.</p>
      <section className="tarjeta no-imprimir" aria-label="Elegir día"><div className="rejilla"><Campo etiqueta="Día de la caja" id="cd"><input id="cd" type="date" max={hoy} value={fecha} onChange={e => e.target.value && setFecha(e.target.value)} /></Campo>
        <div className="acciones-fila"><button type="button" className="btn suave chico" onClick={() => setFecha(sumarDias(fecha, -1))}>Día anterior</button><button type="button" className="btn suave chico" disabled={fecha >= hoy} onClick={() => setFecha(sumarDias(fecha, 1))}>Día siguiente</button><button type="button" className="btn suave chico" disabled={fecha === hoy} onClick={() => setFecha(hoy)}>Hoy</button></div></div></section>
      {esVend ? <CajaCard key={fecha + sesion.id} fecha={fecha} vendedorId={sesion.id} titulo="Mi caja del día" /> : <>
        <Tabs etiqueta="Tipo de caja" valor={tab} onCambio={setTab} opciones={[{ id: 'dia', texto: 'Caja de todo el día' }, { id: 'vend', texto: 'Caja por vendedor' }]} />
        {tab === 'dia' ? <CajaCard key={fecha + 'dia'} fecha={fecha} vendedorId={null} titulo="Todo el día (todos los vendedores, devoluciones y pagos de tiendas)" /> :
          vendedores.map(v => <CajaCard key={fecha + v.id} fecha={fecha} vendedorId={v.id} titulo={`Caja de ${v.nombre}`} />)}</>}
      <Pendientes />
    </div>)
}
function Pendientes() {
  const { vista: db, ir } = useApp(), lista = db.ventas.filter(v => v.estado === 'Activa' && saldoDe(v) > 0).sort((a, b) => a.numero - b.numero)
  return <section className="tarjeta" aria-label="Pendientes por cobrar"><h2>Pendientes por cobrar <Chip tono={lista.length ? 'ambar' : 'verde'}>{lista.length}</Chip></h2>
    {!lista.length ? <p className="mut">No hay ventas pendientes de cobro. Todo está cobrado.</p> : <><p className="sub">Total por cobrar: <strong>{soles(lista.reduce((s, v) => s + saldoDe(v), 0))}</strong>. No entran a la caja hasta que se cobran.</p>
      <Tabla titulo="Ventas pendientes de cobro" cabeceras={['Guía', 'Fecha', 'Cliente', 'Vendedor', { t: 'Monto', der: true }, '']}>{lista.slice(0, 15).map(v => <tr key={v.id}><td>{v.id}</td><td>{fechaCorta(v.fecha)}</td><td>{v.cliente}</td><td>{nombreDe(db, v.vendedorId)}</td><td className="der">{soles(saldoDe(v))}</td><td><button type="button" className="btn suave chico" aria-label={`Cobrar la venta ${v.id}`} onClick={() => ir('ventas', v.id)}>Cobrar</button></td></tr>)}</Tabla></>}</section>
}
function CajaCard({ fecha, vendedorId, titulo }) {
  const { vista: db, sesion, rol, run, can, confirmar, aviso } = useApp()
  const calc = calcularCaja(db, fecha, vendedorId), cierre = cierreDe(db, fecha, vendedorId), cerrada = cierre?.estado === 'Cerrada'
  const [cont, setCont] = useState({ Efectivo: '', Yape: '', Plin: '' }), [nota, setNota] = useState(''), [err, setErr] = useState('')
  const permitido = vendedorId === sesion.id ? can('cerrarCajaPropia') : can('cerrarCajaDia')
  const valor = m => cerrada ? cierre.contado[m] : cont[m] === '' ? null : aMonto(cont[m])
  const dif = m => { const v = valor(m); return v === null || v === undefined ? null : r2(v - calc.esperado[m]) }
  const esperadoVis = m => cerrada ? cierre.esperado[m] : calc.esperado[m]
  const hayDif = MEDIOS_CAJA.some(m => dif(m) && Math.abs(dif(m)) >= 0.005)
  const dayClosed = vendedorId && cierreDe(db, fecha, null)?.estado === 'Cerrada'
  const nVentas = ventasDe(db, fecha, vendedorId).length
  const resumen = () => textoResumenDia({ fecha, titulo, calc, ventas: ventasDe(db, fecha, vendedorId), cerrada, nombreDe: vendedorId ? null : id => nombreDe(db, id) })
  const cerrar = async () => {
    setErr('')
    for (const m of MEDIOS_CAJA) if (cont[m] === '' || aMonto(cont[m]) === null) return setErr(`Escribe cuánto contaste en ${m} (si no hay, escribe 0).`)
    if (hayDif && nota.trim().length < 4) return setErr('Hay diferencia. Explica el motivo en la nota antes de cerrar.')
    const c = await confirmar({ titulo: '¿Cerrar esta caja?', lineas: [...MEDIOS_CAJA.map(m => `${m}: contaste ${soles(aMonto(cont[m]))} · esperado ${soles(calc.esperado[m])}${dif(m) ? ` · diferencia ${soles(dif(m))}` : ''}`), 'Después de cerrar no se podrán registrar ni cambiar ventas de este día. Solo la administradora puede reabrirla.'], boton: 'Sí, cerrar caja', cancelar: 'No, revisar' }); if (!c.ok) return
    if (await run(cerrarCaja, { fecha, vendedorId, contado: Object.fromEntries(MEDIOS_CAJA.map(m => [m, aMonto(cont[m])])), nota })) aviso('Caja cerrada.')
  }
  const reabrir = async () => { const c = await confirmar({ titulo: '¿Reabrir esta caja?', texto: 'Se podrán volver a registrar o cambiar ventas de ese día. Quedará anotado quién la reabrió y por qué.', pideMotivo: true, etiquetaMotivo: 'Motivo de la reapertura', boton: 'Sí, reabrir', peligro: true }); if (c.ok && await run(reabrirCaja, cierre.id, c.motivo)) aviso('Caja reabierta. Quedó registrado el motivo.') }
  return (
    <section className="tarjeta" aria-label={titulo}>
      <div className="fila-sb"><h2>{titulo}</h2>{cerrada ? <span className="cerrada-sello"><Icono n="candado" tam={18} />Cerrada por {nombreDe(db, cierre.cerradoPor)}, {fechaHora(cierre.cerradoEn)}</span> : cierre?.estado === 'Reabierta' ? <Chip tono="ambar">Reabierta</Chip> : dayClosed ? <Chip tono="verde" icono="candado">Cerrada con el día</Chip> : <Chip tono="azul">Abierta</Chip>}</div>
      <p className="sub">{calc.nVentas} venta(s) válidas · vendido {soles(calc.ventasTotal)}{calc.devoluciones ? ` · devoluciones ${soles(calc.devoluciones)}` : ''}{calc.cobrosPendientes ? ` · cobros de pendientes ${soles(calc.cobrosPendientes)}` : ''}{calc.cobrosTiendas ? ` · pagos de tiendas ${soles(calc.cobrosTiendas)}` : ''}</p>
      <div className="caja-grid">{MEDIOS_CAJA.map(m => { const d = dif(m), id = `c-${vendedorId || 'dia'}-${m}`
        return <div key={m} className={`medio-caja ${d ? 'con-dif' : ''}`}><strong><span className={`chip m-${m.toLowerCase()}`}>{m}</span></strong><span className="mut">El sistema espera (solo pagos verificados)</span><span className="esperado">{soles(esperadoVis(m))}</span>{!cerrada && calc.porVerificar?.[m] > 0 && <span className="ambar-t">Por verificar: {soles(calc.porVerificar[m])} (no cuenta hasta que la administradora lo verifique)</span>}
          {cerrada ? <><span className="mut">Se contó</span><span className="esperado">{soles(cierre.contado[m])}</span></> : <Campo etiqueta={`Contado en ${m} (S/)`} id={id}><input id={id} inputMode="decimal" disabled={!permitido || dayClosed} value={cont[m]} onChange={e => setCont({ ...cont, [m]: e.target.value })} /></Campo>}
          <span className={`dif ${d ? 'dif-rojo' : d === 0 ? 'dif-ok' : 'mut'}`} aria-live="polite">{d === null ? 'Diferencia: escribe lo contado' : d === 0 ? 'Cuadra' : `${d > 0 ? 'Sobran' : 'Faltan'} ${soles(Math.abs(d))}`}</span></div> })}</div>
      <div className="acciones-fila no-imprimir compartir"><a className="btn suave chico" href={enlaceWhatsApp('', resumen())} target="_blank" rel="noopener noreferrer"><Icono n="chat" />Compartir resumen por WhatsApp</a>
        <button type="button" className="btn suave chico" onClick={() => { descargar(resumen(), `cierre-${fecha}${vendedorId ? '-' + vendedorId : ''}.txt`, 'text/plain;charset=utf-8'); aviso('Resumen descargado.') }}><Icono n="bajar" />Descargar resumen</button></div>
      <p className="sub-t">Pendientes por cobrar{vendedorId ? ' de este vendedor' : ''}: <strong>{calc.pendientes.cantidad}</strong> venta(s) por {soles(calc.pendientes.monto)} (no cuentan en esta caja).</p>
      {cerrada ? (<>{cierre.nota && <p><strong>Nota:</strong> {cierre.nota}</p>}{cierre.diferenciaTotal !== 0 && <p className="dif-rojo">Cerró con diferencia total de {soles(cierre.diferenciaTotal)}.</p>}
        <details><summary className="enlace">Ver historial de esta caja</summary><ol className="hist">{cierre.historial.map((h, i) => <li key={i}><strong>{nombreDe(db, h.quien)}</strong> · <small>{fechaHora(h.cuando)}</small><br />{h.que}</li>)}</ol></details>
        {can('reabrirCaja') && <div className="acciones-fila"><button type="button" className="btn peligro" onClick={reabrir}>Reabrir caja</button></div>}</>) :
        permitido && !dayClosed ? (<><Campo etiqueta={hayDif ? 'Nota (obligatoria: explica la diferencia)' : 'Nota (opcional)'} id={`n-${vendedorId || 'dia'}`}><input id={`n-${vendedorId || 'dia'}`} value={nota} maxLength={200} onChange={e => setNota(e.target.value)} /></Campo>
          {err && <p className="error" role="alert">{err}</p>}<div className="acciones-fila"><button type="button" className="btn grande" onClick={cerrar}><Icono n="candado" />Cerrar caja</button></div></>) :
        <p className="mut">{dayClosed ? 'El día completo ya fue cerrado por administración.' : 'Solo administración cierra esta caja.'}</p>}
    </section>)
}
