// Asistente de voz: preguntas rápidas y comandos seguros. Responde SOLO con la vista del rol (sin costos ni utilidad para
// quien no puede verlos) y toda acción pasa por la capa de datos con permisos. Anular, devolver, borrar o reabrir NO se
// hacen por voz: se abre la guía para hacerlo a mano con su propia confirmación.
import { useState } from 'react'
import { useApp } from './contexto.js'
import { Modal, Chip, Campo } from './ui.jsx'
import { Icono } from './Iconos.jsx'
import Microfono from './Microfono.jsx'
import { entenderOrden, entenderVenta } from '../lib/voz.js'
import { responder, buscarVentas, EJEMPLOS } from '../lib/asistente.js'
import { cobrarPendiente, saldoDe, estadoCobro } from '../lib/dominio.js'
import { RUTAS } from '../lib/permisos.js'
import { MEDIOS_CAJA } from '../config/app.config.js'
import { soles } from '../lib/dinero.js'
import { fechaISO, fechaCorta } from '../lib/fechas.js'
import { dejarPendiente } from '../ia/pendiente.js'

const NOMBRE_RUTA = { inicio: 'Inicio', vender: 'Nueva venta', ventas: 'Ventas', inventario: 'Inventario', tiendas: 'Tiendas', caja: 'Caja', cuaderno: 'Cuaderno', conciliacion: 'Conciliación de pagos', etiquetas: 'Etiquetas y escaneo', mas: 'Más' }
export default function Asistente({ onCerrar }) {
  const { vista, sesion, rol, can, ir, run, confirmar, aviso } = useApp()
  const [r, setR] = useState(null)
  const hoy = fechaISO(new Date())
  const atender = texto => {
    const o = entenderOrden(texto, vista.productos)
    if (o.tipo === 'pregunta') return setR({ o, resp: responder(vista, sesion, o, hoy) })
    if (o.tipo === 'cobrar' || o.tipo === 'buscar') return setR({ o, ventas: buscarVentas(vista, sesion, o, { soloPorCobrar: o.tipo === 'cobrar' }), medio: o.medio && o.medio !== 'Pendiente' ? o.medio : '', operacion: o.operacion || '' })
    setR({ o })
  }
  const llevar = (tipo, ruta, id) => { dejarPendiente({ tipo, texto: r.o.texto, origen: { voz: true } }); ir(ruta, id); onCerrar() }
  const cobrar = async v => {
    if (!r.medio) return setR({ ...r, err: 'Elige con qué pagó.' })
    if (['Yape', 'Plin'].includes(r.medio) && !/^[0-9A-Za-z-]{4,20}$/.test(r.operacion.replace(/\s/g, ''))) return setR({ ...r, err: `Escribe el número de operación de ${r.medio}.` })
    const c = await confirmar({ titulo: '¿Marcar como cobrada?', lineas: [`Guía ${v.id} · ${v.cliente}`, `Cobrar ${soles(saldoDe(v))} con ${r.medio}${r.operacion ? ` (operación ${r.operacion})` : ''}`], boton: 'Sí, marcar cobrada' })
    if (!c.ok) return
    const x = await run(cobrarPendiente, v.id, r.medio, new Date(), { operacion: r.operacion })
    if (x) { aviso(`Guía ${v.id} cobrada con ${r.medio}.${['Yape', 'Plin'].includes(r.medio) && rol !== 'admin' ? ' Queda por verificar.' : ''}`); setR({ ...r, hecho: v.id }) }
  }
  const o = r?.o
  return (
    <Modal titulo="Asistente de voz" onCerrar={onCerrar} ancho>
      <Microfono etiqueta="Preguntar o pedir" ejemplo="Pregunta o pide algo en voz alta. Se entiende en este equipo." onTexto={atender} />
      {!r && <div className="ia-ejemplos"><p className="sub-t">Prueba con:</p><div className="acciones-fila">{EJEMPLOS[rol].map(e => <button key={e} type="button" className="btn suave chico" onClick={() => atender(e)}>«{e}»</button>)}</div></div>}
      {r && <div className="ia-res" role="status" aria-live="polite">
        <p className="ia-escuche">Escuché: «{o.texto}»</p>
        {o.tipo === 'pregunta' && <div className={`ia-respuesta ${r.resp.ok ? '' : 'no'}`}><h3>{r.resp.titulo}</h3><p className="ia-grande">{r.resp.texto}</p>{r.resp.lineas?.length > 0 && <ul>{r.resp.lineas.map((l, i) => <li key={i}>{l}</li>)}</ul>}
          {r.resp.duda && r.resp.opciones?.length > 1 && <p className="sub-t">¿Era otro? {r.resp.opciones.slice(1).map(x => <button key={x.id} type="button" className="btn suave chico" onClick={() => setR({ o, resp: responder(vista, sesion, { ...o, producto: { ...o.producto, producto: { id: x.id, nombre: x.nombre }, duda: false } }, hoy) })}>{x.nombre}</button>)}</p>}
          {!r.resp.ok && r.resp.opciones?.length > 0 && <p className="sub-t">¿Quisiste decir? {r.resp.opciones.map(x => <button key={x.id} type="button" className="btn suave chico" onClick={() => setR({ o, resp: responder(vista, sesion, { ...o, producto: { ...o.producto, producto: { id: x.id, nombre: x.nombre } } }, hoy) })}>{x.nombre}</button>)}</p>}</div>}
        {o.tipo === 'venta' && (can('vender') ? <div className="ia-respuesta"><h3>Parece una venta</h3><ul>{entenderVenta(o.texto, vista.productos).lineas.map((l, i) => <li key={i}>{l.cantidad} × {l.encontrado ? l.nombre : `«${l.nombreDicho}» (no está en el catálogo)`}</li>)}</ul>
          <button type="button" className="btn grande" onClick={() => llevar('venta', 'vender')}><Icono n="carrito" />Abrir Nueva venta con esto</button><p className="sub-t">Ahí revisas y tocas Cobrar.</p></div> : <Sin texto="Tu usuario no puede vender." />)}
        {o.tipo === 'ingreso' && (can('ingresarStock') ? <div className="ia-respuesta"><h3>Ingreso de mercadería</h3><ul>{o.lineas.map((l, i) => <li key={i}>{l.cantidad} × {l.encontrado ? l.nombre : `«${l.nombreDicho}» (no está en el catálogo)`}</li>)}</ul>
          <button type="button" className="btn grande" onClick={() => llevar('ingreso', 'inventario', 'ingreso')}><Icono n="caja" />Revisar y confirmar el ingreso</button><p className="sub-t">No se suma nada hasta que lo confirmes.</p></div> : <Sin texto="El ingreso de mercadería lo hace la administración (administradora o co-administrador)." />)}
        {o.tipo === 'cobrar' && (!can('cobrarPendiente') ? <Sin texto="Tu usuario no puede cobrar." /> : <div className="ia-respuesta"><h3>Marcar pendiente como cobrado</h3>
          {!r.ventas.length ? <p>No encontré ventas por cobrar{o.cliente ? ` de «${o.cliente}»` : o.numero ? ` con el número ${o.numero}` : ''}{rol === 'vendedor' ? ' entre tus ventas' : ''}.</p> : <>
            <div className="medios" role="radiogroup" aria-label="Con qué pagó">{MEDIOS_CAJA.map(m => <button key={m} type="button" role="radio" aria-checked={r.medio === m} className={`medio m-${m.toLowerCase()} ${r.medio === m ? 'on' : ''}`} onClick={() => setR({ ...r, medio: m, err: '' })}>{r.medio === m && <Icono n="check" tam={18} />}{m}</button>)}</div>
            {['Yape', 'Plin'].includes(r.medio) && <Campo etiqueta={`Número de operación de ${r.medio}`} id="as-op"><input id="as-op" inputMode="numeric" value={r.operacion} maxLength={20} onChange={e => setR({ ...r, operacion: e.target.value, err: '' })} /></Campo>}
            {r.err && <p className="error" role="alert">{r.err}</p>}
            <ul className="ia-ventas">{r.ventas.map(v => <li key={v.id}><span><b>{v.id}</b> · {v.cliente} · {fechaCorta(v.fecha)}<small>Falta {soles(saldoDe(v))} de {soles(v.total)}</small></span>{r.hecho === v.id ? <Chip tono="verde" icono="check">Cobrada</Chip> : <button type="button" className="btn chico" onClick={() => cobrar(v)}>Cobrar {soles(saldoDe(v))}</button>}</li>)}</ul></>}</div>)}
        {o.tipo === 'buscar' && <div className="ia-respuesta"><h3>Buscar venta</h3>{!r.ventas.length ? <p>No encontré ventas{o.cliente ? ` de «${o.cliente}»` : o.numero ? ` con el número ${o.numero}` : ''}. Di el nombre del cliente o el número de guía.</p>
          : <ul className="ia-ventas">{r.ventas.map(v => <li key={v.id}><span><b>{v.id}</b> · {v.cliente} · {fechaCorta(v.fecha)}<small>{soles(v.total)} · {estadoCobro(v)}</small></span><button type="button" className="btn suave chico" onClick={() => { ir('ventas', v.id); onCerrar() }}>Abrir guía</button></li>)}</ul>}</div>}
        {o.tipo === 'ir' && (RUTAS[o.ruta]?.includes(rol) ? <div className="ia-respuesta"><button type="button" className="btn grande" onClick={() => { ir(o.ruta); onCerrar() }}><Icono n="flecha" />Ir a {NOMBRE_RUTA[o.ruta]}</button></div> : <Sin texto="Tu usuario no tiene permiso para ver esa página." />)}
        {o.tipo === 'bloqueado' && <div className="ia-respuesta no"><h3>Esto no se hace por voz</h3><p>Por seguridad, anular, devolver, borrar o reabrir se hacen a mano desde la guía, con su motivo y confirmación.{(o.accion === 'anular' && !can('anular')) || (o.accion === 'devolver' && !can('devolver')) ? ' Además, solo la administradora puede hacerlo.' : ''}</p>
          {o.ref && ((o.accion === 'anular' && can('anular')) || (o.accion === 'devolver' && can('devolver'))) && buscarVentas(vista, sesion, { numero: o.ref }).slice(0, 1).map(v => <button key={v.id} type="button" className="btn suave" onClick={() => { ir('ventas', v.id); onCerrar() }}>Abrir la guía {v.id}</button>)}</div>}
        {o.tipo === 'nada' && <div className="ia-respuesta no"><h3>No entendí</h3><p>Prueba con una de estas:</p><div className="acciones-fila">{EJEMPLOS[rol].slice(0, 4).map(e => <button key={e} type="button" className="btn suave chico" onClick={() => atender(e)}>«{e}»</button>)}</div></div>}
      </div>}
    </Modal>
  )
}
const Sin = ({ texto }) => <div className="ia-respuesta no"><h3>Tu usuario no puede hacer esto</h3><p>{texto}</p></div>
