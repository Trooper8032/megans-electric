// Conciliación diaria de pagos (solo la administradora): por medio, lo registrado vs lo verificado,
// números de operación repetidos y ventas pendientes sin cobrar. La caja cuadra solo con pagos verificados.
import { useState } from 'react'
import { useApp } from '../components/contexto.js'
import { Campo, Chip, ChipMedio, Tabla, Vacio } from '../components/ui.jsx'
import { Icono } from '../components/Iconos.jsx'
import RevisarCaptura from '../components/RevisarCaptura.jsx'
import { conciliacion, verificarPago } from '../lib/dominio.js'
import { soles } from '../lib/dinero.js'
import { fechaISO, fechaLarga, fechaHora, sumarDias } from '../lib/fechas.js'

const nombreDe = (db, id) => db.usuarios.find(u => u.id === id)?.nombre || '—'
export default function Conciliacion() {
  const { vista: db, run, ir, confirmar, aviso } = useApp()
  const hoy = fechaISO(new Date()), [fecha, setFecha] = useState(hoy), [revisar, setRevisar] = useState(null)
  const c = conciliacion(db, fecha)
  const verificar = async p => { const r = await confirmar({ titulo: '¿Verificar este pago?', texto: `${soles(p.monto)} con ${p.medio}${p.operacion ? `, operación ${p.operacion}` : ''} (guía ${p.ventaId}). Confírmalo solo si lo ves en tu aplicativo o en la caja.`, boton: 'Sí, verificado' }); if (r.ok && await run(verificarPago, p.ventaId, p.id)) aviso('Pago verificado.') }
  const viejos = c.pendientes.filter(p => p.dias >= 3)
  return (
    <div className="pagina">
      <div className="titulo-fila"><div><h1>Conciliación de pagos</h1><p className="sub">{fechaLarga(fecha)} · la caja cuadra solo con pagos verificados</p></div></div>
      <section className="tarjeta" aria-label="Elegir día"><div className="rejilla"><Campo etiqueta="Día" id="cf"><input id="cf" type="date" max={hoy} value={fecha} onChange={e => e.target.value && setFecha(e.target.value)} /></Campo></div>
        <div className="acciones-fila"><button type="button" className="btn suave chico" onClick={() => setFecha(sumarDias(fecha, -1))}>Día anterior</button><button type="button" className="btn suave chico" disabled={fecha >= hoy} onClick={() => setFecha(sumarDias(fecha, 1))}>Día siguiente</button><button type="button" className="btn suave chico" disabled={fecha === hoy} onClick={() => setFecha(hoy)}>Hoy</button></div></section>

      {(c.duplicados.length > 0 || viejos.length > 0 || c.porVerificar.length > 0) && <section className="tarjeta" aria-label="Alertas"><h2>Alertas</h2>
        {c.duplicados.length > 0 && <p className="alerta rojo" role="alert"><Icono n="alerta" />{c.duplicados.length} número(s) de operación repetido(s): {c.duplicados.map(g => `${g[0].medio} ${g[0].operacion} (${g.map(x => x.ventaId).join(', ')})`).join(' · ')}. Revisa que no sea el mismo comprobante usado dos veces.</p>}
        {c.porVerificar.length > 0 && <p className="alerta ambar"><Icono n="reloj" />{c.porVerificar.length} pago(s) por verificar este día por {soles(c.porVerificar.reduce((s, p) => s + p.monto, 0))}.</p>}
        {viejos.length > 0 && <p className="alerta rojo"><Icono n="alerta" />{viejos.length} venta(s) pendiente(s) sin cobrar hace 3 días o más, por {soles(viejos.reduce((s, p) => s + p.saldo, 0))}.</p>}
      </section>}

      <section className="tarjeta" aria-label="Resumen por medio de pago"><h2>Por medio de pago</h2>
        <Tabla titulo="Esperado contra verificado por medio" cabeceras={['Medio', { t: 'Pagos', der: true }, { t: 'Registrado (esperado)', der: true }, { t: 'Verificado', der: true }, { t: 'Por verificar', der: true }, 'Estado']}>
          {c.filas.map(f => <tr key={f.medio}><td><ChipMedio medio={f.medio} /></td><td className="der">{f.n}</td><td className="der">{soles(f.esperado)}</td><td className="der">{soles(f.verificado)}</td><td className="der">{soles(f.porVerificar)}</td><td>{f.porVerificar > 0 ? <Chip tono="ambar" icono="reloj">Falta verificar</Chip> : <Chip tono="verde" icono="check">Conciliado</Chip>}</td></tr>)}
          <tr><td><strong>Total</strong></td><td className="der">{c.filas.reduce((s, f) => s + f.n, 0)}</td><td className="der"><strong>{soles(c.filas.reduce((s, f) => s + f.esperado, 0))}</strong></td><td className="der"><strong>{soles(c.filas.reduce((s, f) => s + f.verificado, 0))}</strong></td><td className="der"><strong>{soles(c.filas.reduce((s, f) => s + f.porVerificar, 0))}</strong></td><td /></tr>
        </Tabla></section>

      <section className="tarjeta" aria-label="Pagos por verificar"><h2>Pagos por verificar <Chip tono={c.porVerificar.length ? 'ambar' : 'verde'}>{c.porVerificar.length}</Chip></h2>
        {!c.porVerificar.length ? <p className="mut">No hay pagos por verificar en este día.</p> :
          <ul className="pagos-lista">{c.porVerificar.map(p => <li key={p.id}><ChipMedio medio={p.medio} /><span><strong>{p.operacion || 'sin operación'}</strong> · {p.cliente} · guía {p.ventaId} · cobró {nombreDe(db, p.quien)} · {fechaHora(p.cuando)}</span>{p.duplicado && <Chip tono="rojo">Operación repetida</Chip>}{p.foto && <img className="foto-mini" src={p.foto} alt={`Comprobante de ${p.medio} de ${p.cliente}`} />}<span className="monto">{soles(p.monto)}</span>
            <button type="button" className="btn chico" onClick={() => verificar(p)}><Icono n="check" />Verificar</button>{['Yape', 'Plin'].includes(p.medio) && <button type="button" className="btn suave chico" onClick={() => setRevisar(p)}><Icono n="camara" />Revisar captura</button>}<button type="button" className="btn suave chico" onClick={() => ir('ventas', p.ventaId)}>Ver guía</button></li>)}</ul>}</section>
      {revisar && <RevisarCaptura pago={revisar} onCerrar={() => setRevisar(null)} />}

      <section className="tarjeta" aria-label="Pagos verificados"><details><summary className="enlace">Ver pagos verificados del día ({c.pagos.length - c.porVerificar.length})</summary>
        <ul className="pagos-lista">{c.pagos.filter(p => p.estado === 'Verificado').map(p => <li key={p.id}><ChipMedio medio={p.medio} /><span>{p.operacion ? <strong>{p.operacion}</strong> : null} {p.cliente} · {p.ventaId} · verificó {nombreDe(db, p.verificadoPor)}</span><span className="monto">{soles(p.monto)}</span></li>)}</ul></details></section>

      <section className="tarjeta" aria-label="Pendientes sin cobrar"><h2>Pendientes sin cobrar <Chip tono={c.pendientes.length ? 'rojo' : 'verde'}>{c.pendientes.length}</Chip></h2>
        {!c.pendientes.length ? <Vacio icono="check" titulo="Todo cobrado" texto="No hay ventas pendientes hasta este día." /> :
          <Tabla titulo="Ventas con saldo por cobrar" cabeceras={['Guía', 'Cliente', 'Vendedor', 'Antigüedad', { t: 'Falta', der: true }, '']}>{c.pendientes.slice(0, 30).map(p => <tr key={p.id}><td>{p.id}</td><td>{p.cliente}</td><td>{nombreDe(db, p.vendedorId)}</td><td>{p.dias === 0 ? 'Hoy' : `${p.dias} día(s)`}{p.dias >= 3 && <> <Chip tono="rojo">Atrasado</Chip></>}</td><td className="der">{soles(p.saldo)}</td><td><button type="button" className="btn suave chico" onClick={() => ir('ventas', p.id)} aria-label={`Abrir guía ${p.id}`}>Abrir</button></td></tr>)}</Tabla>}</section>
    </div>)
}
