// Centro de voz (pantalla de Inicio): un solo 🎤 para todo. Se dice un comando de inicio y luego los datos:
// «Venta: …», «Ingreso: …», «Cobrar: …», «Consulta: …», «Ir a: …», «Devolución: …», «Agregar a la venta 45: …».
// Mientras una venta está abierta se puede seguir hablando («agregar 2 cintas», «quitar los focos», «cerrar venta»).
// NADA se guarda sin la revisión y el botón Confirmar. Las devoluciones quedan pendientes hasta que la administradora las aprueba.
import { useState } from 'react'
import { useApp } from './contexto.js'
import Microfono from './Microfono.jsx'
import { Icono } from './Iconos.jsx'
import { Chip, Campo } from './ui.jsx'
import { entenderComando, buscarUsuario } from '../lib/voz.js'
import { responder, buscarVentas } from '../lib/asistente.js'
import { crearVenta, crearAdicional, solicitarDevolucion, ingresarVarios, cobrarPendiente, saldoDe, ventaPorNumero, ultimaVentaDe, vendedoresPara, aprobarDevolucion, rechazarDevolucion } from '../lib/dominio.js'
import { RUTAS } from '../lib/permisos.js'
import { MEDIOS, MEDIOS_CAJA, MOTIVOS_DEVOLUCION } from '../config/app.config.js'
import { soles } from '../lib/dinero.js'
import { fechaISO, fechaCorta } from '../lib/fechas.js'

const NOMBRE_RUTA = { inicio: 'Inicio', vender: 'Nueva venta', ventas: 'Ventas', inventario: 'Inventario', tiendas: 'Tiendas', caja: 'Caja', cuaderno: 'Cuaderno', conciliacion: 'Conciliación de pagos', etiquetas: 'Etiquetas y escaneo', mas: 'Más' }
const COMANDOS_AYUDA = ['Venta: 2 interruptores simples, cliente Juan, efectivo', 'Agregar a la venta 45: 1 caja de 2 polos', 'Devolución: 1 interruptor simple de la venta 45', 'Consulta: ¿quién me debe?', 'Ir a: inventario']
const aLinea = l => ({ productoId: l.productoId, nombre: l.nombre, cantidad: l.cantidad, ...(l.precio ? { precio: l.precio } : {}), duda: l.duda, opciones: l.opciones || [], encontrado: l.encontrado, nombreDicho: l.nombreDicho })
const sumarLineas = (base, nuevas) => {
  const r = base.map(x => ({ ...x }))
  for (const l of nuevas) { const ex = l.encontrado && r.find(x => x.encontrado && x.productoId === l.productoId && !x.precio && !l.precio); if (ex) ex.cantidad += l.cantidad; else r.push(aLinea(l)) }
  return r
}

export default function CentroVoz() {
  const { vista: db, sesion, rol, can, ir, run, aviso } = useApp()
  const [b, setB] = useState(null) // borrador abierto: { modo: 'venta'|'adicional'|'devolucion'|'ingreso', ... }
  const [r, setR] = useState(null) // respuesta a consultas, cobros, ir a, avisos
  const [err, setErr] = useState('')
  const hoy = fechaISO(new Date()), yo = db.usuarios.find(u => u.id === sesion.id)
  const set = c => { setErr(''); setB(x => ({ ...x, ...c })) }

  const atender = texto => {
    setErr('')
    const o = entenderComando(texto, db.productos, { usuarios: db.usuarios, abierta: !!b && ['venta', 'adicional', 'ingreso'].includes(b.modo) })
    if (o.tipo === 'cerrar') { if (b) return confirmarB(); return setR({ o, aviso: 'No hay ninguna venta abierta.' }) }
    if (o.tipo === 'cancelar') { setB(null); return setR({ o, aviso: 'Listo, se descartó. No se guardó nada.' }) }
    if (o.tipo === 'agregar' && b) { setR(null); return set({ lineas: sumarLineas(b.lineas, o.venta.lineas), ...(o.venta.medio ? { medio: o.venta.medio } : {}), ...(o.venta.cliente && b.modo === 'venta' ? { cliente: o.venta.cliente } : {}), oido: [...b.oido, texto] }) }
    if (o.tipo === 'quitar' && b) {
      setR(null); let lineas = b.lineas.map(x => ({ ...x }))
      for (const q of o.lineas) { const i = lineas.findIndex(x => x.productoId && x.productoId === q.productoId); if (i < 0) continue; if (q.cantidadDicha && lineas[i].cantidad > q.cantidad) lineas[i].cantidad -= q.cantidad; else lineas.splice(i, 1) }
      return set({ lineas, oido: [...b.oido, texto] })
    }
    if (o.tipo === 'venta') {
      if (!can('vender')) return setR({ o, no: 'Tu usuario no puede vender.' })
      const v = o.venta; let vendedorId = sesion.id, avisoV = ''
      if (o.vendedor) { if (!can('elegirVendedor')) avisoV = 'Solo la administración puede registrar ventas a nombre de otra persona. Queda a tu nombre.'; else if (o.vendedor.id) vendedorId = o.vendedor.id; else avisoV = `No encontré al vendedor «${o.vendedor.dicho}». Elígelo abajo.` }
      setR(null); return setB({ modo: 'venta', lineas: sumarLineas([], v.lineas), cliente: v.cliente, medio: v.medio || '', operacion: v.operacion || '', vendedorId, avisoV, oido: [texto] })
    }
    if (o.tipo === 'adicional') {
      if (!can('vender')) return setR({ o, no: 'Tu usuario no puede vender.' })
      const orig = o.numero ? ventaPorNumero(db, o.numero) : ultimaVentaDe(db, o.cliente)
      if (!orig) return setR({ o, aviso: o.numero ? `No encontré la venta ${o.numero}${rol === 'vendedor' ? ' entre tus ventas' : ''}.` : `No encontré ventas de «${o.cliente}».` })
      setR(null); return setB({ modo: 'adicional', orig, lineas: sumarLineas([], o.venta.lineas), medio: o.venta.medio || '', operacion: o.venta.operacion || '', vendedorId: orig.vendedorId, oido: [texto] })
    }
    if (o.tipo === 'devolucion') {
      const orig = o.numero ? ventaPorNumero(db, o.numero) : o.cliente ? ultimaVentaDe(db, o.cliente) : null
      if (!orig) return setR({ o, aviso: 'Di el número de la venta. Ej.: «Devolución: 1 interruptor simple de la venta 45».' })
      const lineas = o.lineas.map(l => { const enV = orig.items.find(x => x.productoId === l.productoId); return { ...aLinea(l), enVenta: !!enV, precio: enV?.precio } })
      setR(null); return setB({ modo: 'devolucion', orig, lineas, motivo: o.motivo || '', nota: '', oido: [texto] })
    }
    if (o.tipo === 'ingreso') {
      if (!can('ingresarStock')) return setR({ o, no: 'El ingreso de mercadería lo hace la administración.' })
      setR(null); return setB({ modo: 'ingreso', lineas: sumarLineas([], o.lineas), oido: [texto] })
    }
    if (o.tipo === 'pregunta') return setR({ o, resp: responder(db, sesion, o, hoy) })
    if (o.tipo === 'cobrar') return setR({ o, ventas: can('cobrarPendiente') ? buscarVentas(db, sesion, o, { soloPorCobrar: true }) : [], medio: o.medio && o.medio !== 'Pendiente' ? o.medio : '', operacion: o.operacion || '' })
    if (o.tipo === 'ir') { if (RUTAS[o.ruta]?.includes(rol)) { ir(o.ruta); return } return setR({ o, no: 'Tu usuario no tiene permiso para ver esa página.' }) }
    if (o.tipo === 'buscar') return setR({ o, ventas: buscarVentas(db, sesion, o) })
    if (o.tipo === 'bloqueado') return setR({ o, aviso: 'Anular, borrar o reabrir se hace a mano desde la guía, con su motivo.' })
    setR({ o, nada: true })
  }

  const listas = () => b.lineas.filter(l => l.encontrado && l.productoId && !l.duda)
  async function confirmarB() {
    if (!b) return
    const ls = listas(), dudas = b.lineas.filter(l => l.duda || !l.encontrado)
    if (dudas.length) return setErr('Hay productos por elegir o que no están en el catálogo. Elige el correcto o quítalos.')
    if (!ls.length) return setErr('No hay productos para guardar.')
    if (b.modo === 'venta' || b.modo === 'adicional') {
      if (!b.medio) return setErr('Elige cómo pagó.')
      if (b.modo === 'venta' && String(b.cliente || '').trim().length < 2) return setErr('Escribe el nombre del cliente.')
      if (['Yape', 'Plin'].includes(b.medio) && !/^[0-9A-Za-z-]{4,20}$/.test(String(b.operacion).replace(/\s/g, ''))) return setErr(`Escribe el número de operación de ${b.medio}.`)
      const items = ls.map(l => ({ productoId: l.productoId, cantidad: l.cantidad, ...(l.precio ? { precio: l.precio } : {}) }))
      const datos = { medio: b.medio, items, vendedorId: b.vendedorId, operacion: b.operacion }
      const x = b.modo === 'venta' ? await run(crearVenta, { ...datos, cliente: b.cliente }) : await run(crearAdicional, b.orig.id, datos)
      if (x) { aviso(b.modo === 'venta' ? `Venta ${x.ref} guardada.` : `Venta ${x.ref} guardada como adicional de la venta ${b.orig.id}.`); setB(null); setR({ hecho: x.ref, adicional: b.modo === 'adicional' ? b.orig.id : null }) }
    } else if (b.modo === 'devolucion') {
      if (ls.some(l => !l.enVenta)) return setErr('Hay productos que no están en esa venta. Quítalos.')
      if (!b.motivo) return setErr('Elige el motivo de la devolución.')
      const x = await run(solicitarDevolucion, { ventaId: b.orig.id, items: ls.map(l => ({ productoId: l.productoId, cantidad: l.cantidad })), motivo: b.motivo, nota: b.nota })
      if (x) { aviso(`Devolución ${x.ref} enviada. Queda pendiente hasta que la administradora la apruebe.`); setB(null); setR({ hecho: x.ref, dev: true }) }
    } else if (b.modo === 'ingreso') {
      const x = await run(ingresarVarios, ls.map(l => ({ productoId: l.productoId, cantidad: l.cantidad })), 'Ingreso por voz')
      if (x) { aviso('Ingreso guardado. El stock ya se actualizó.'); setB(null); setR({ hecho: 'ingreso' }) }
    }
  }
  const cobrar = async v => {
    if (!r.medio) return setR({ ...r, err: 'Elige con qué pagó.' })
    if (['Yape', 'Plin'].includes(r.medio) && !/^[0-9A-Za-z-]{4,20}$/.test(r.operacion.replace(/\s/g, ''))) return setR({ ...r, err: `Escribe el número de operación de ${r.medio}.` })
    const x = await run(cobrarPendiente, v.id, r.medio, new Date(), { operacion: r.operacion })
    if (x) { aviso(`Guía ${v.id} cobrada con ${r.medio}.`); setR({ ...r, cobrada: v.id }) }
  }
  const total = b ? b.lineas.filter(l => l.encontrado).reduce((s, l) => s + l.cantidad * (l.precio ?? db.productos.find(p => p.id === l.productoId)?.precio ?? 0), 0) : 0
  const titulo = { venta: 'Revisa la venta', adicional: 'Venta adicional', devolucion: 'Devolución (necesita aprobación)', ingreso: 'Revisa el ingreso' }

  return (
    <section className="centro-voz no-imprimir" aria-label="Centro de voz">
      <div className="cv-cab"><h2><Icono n="microfono" />Habla con la app</h2><p>Di primero <b>qué quieres hacer</b> y luego los datos. Ej.: «<b>Venta:</b> 3 interruptores simples, cliente Juan, efectivo».</p></div>
      <Microfono clase="cv-mic" etiqueta={b ? 'Seguir hablando' : 'Tocar y hablar'} ejemplo={b ? (b.modo === 'devolucion' ? 'Puedes decir «cancelar».' : 'Puedes decir «agregar 2 cintas», «quitar los focos», «cerrar venta» o «cancelar».') : 'Comandos: Venta · Ingreso · Cobrar · Consulta · Ir a · Devolución · Agregar a la venta N'} onTexto={atender} />
      {!b && !r && <div className="acciones-fila cv-ejemplos">{COMANDOS_AYUDA.map(e => <button key={e} type="button" className="btn suave chico" onClick={() => atender(e)}>«{e}»</button>)}</div>}

      {b && <div className="ia-res cv-borrador" role="region" aria-label={titulo[b.modo]}>
        <h3>{titulo[b.modo]} {b.modo !== 'ingreso' && <Chip tono="ambar">Sin guardar</Chip>}</h3>
        <p className="ia-escuche">Escuché: {b.oido.map((t, i) => <span key={i}>«{t}» </span>)}</p>
        {b.modo === 'adicional' && <p className="alerta azul"><Icono n="archivo" /><span>Adicional de la venta <b>{b.orig.id}</b> ({b.orig.cliente}, {fechaCorta(b.orig.fecha)}). La venta original no cambia; se cobra solo lo nuevo.</span></p>}
        {b.modo === 'devolucion' && <p className="alerta ambar"><Icono n="alerta" /><span>Venta <b>{b.orig.id}</b> · {b.orig.cliente}. No se mueve stock ni dinero hasta que la administradora la apruebe.</span></p>}
        <ul className="ia-lineas">{b.lineas.map((l, i) => <li key={i} className={`ia-l ${l.encontrado && !l.duda ? 'ok' : 'elegir'}`}>
          {l.encontrado && !l.duda ? <><Chip tono={b.modo === 'devolucion' && !l.enVenta ? 'rojo' : 'verde'} icono="check">{b.modo === 'devolucion' && !l.enVenta ? 'No está en la venta' : 'Listo'}</Chip>
            <span className="cv-cant"><button type="button" className="icono-btn" aria-label={`Menos ${l.nombre}`} onClick={() => set({ lineas: b.lineas.map((x, j) => j === i ? { ...x, cantidad: Math.max(1, x.cantidad - 1) } : x) })}>−</button><b>{l.cantidad}</b><button type="button" className="icono-btn" aria-label={`Más ${l.nombre}`} onClick={() => set({ lineas: b.lineas.map((x, j) => j === i ? { ...x, cantidad: x.cantidad + 1 } : x) })}>+</button></span>
            <span>× <b>{l.nombre}</b>{l.precio || db.productos.find(p => p.id === l.productoId)?.precio ? ` · ${soles(l.cantidad * (l.precio ?? db.productos.find(p => p.id === l.productoId).precio))}` : ''}</span></>
            : <><Chip tono={l.encontrado || l.opciones.length ? 'ambar' : 'rojo'} icono="alerta">{l.encontrado || l.opciones.length ? '¿Cuál es?' : 'No está en el catálogo'}</Chip><span>«{l.nombreDicho}» ({l.cantidad})</span>
              <span className="ia-opciones">{l.opciones.map(o => <button key={o.id} type="button" className="btn suave chico" onClick={() => set({ lineas: b.lineas.map((x, j) => j === i ? { ...x, productoId: o.id, nombre: o.nombre, encontrado: true, duda: false, enVenta: b.modo === 'devolucion' ? b.orig.items.some(y => y.productoId === o.id) : x.enVenta, precio: b.modo === 'devolucion' ? b.orig.items.find(y => y.productoId === o.id)?.precio : x.precio } : x) })}>{o.nombre}</button>)}</span></>}
          <button type="button" className="enlace" onClick={() => set({ lineas: b.lineas.filter((_, j) => j !== i) })}>Quitar</button>
        </li>)}</ul>
        {!b.lineas.length && <p className="alerta ambar"><Icono n="alerta" />Aún no hay productos. Di «agregar 2 interruptores simples».</p>}
        {(b.modo === 'venta' || b.modo === 'adicional' || b.modo === 'devolucion') && <p className="cv-total">Total: <b>{soles(total)}</b></p>}
        {b.modo === 'venta' && <Campo etiqueta="Cliente" id="cv-cli"><input id="cv-cli" value={b.cliente} maxLength={60} onChange={e => set({ cliente: e.target.value })} /></Campo>}
        {(b.modo === 'venta' || b.modo === 'adicional') && <>
          <div className="medios" role="radiogroup" aria-label="Cómo pagó">{MEDIOS.map(m => <button key={m} type="button" role="radio" aria-checked={b.medio === m} className={`medio m-${m.toLowerCase()} ${b.medio === m ? 'on' : ''}`} onClick={() => set({ medio: m })}>{b.medio === m && <Icono n="check" tam={18} />}{m}</button>)}</div>
          {['Yape', 'Plin'].includes(b.medio) && <Campo etiqueta={`Número de operación de ${b.medio}`} id="cv-op"><input id="cv-op" inputMode="numeric" value={b.operacion} maxLength={20} onChange={e => set({ operacion: e.target.value })} /></Campo>}
          {b.modo === 'venta' && (can('elegirVendedor') ? <Campo etiqueta="Vendedor" id="cv-ven"><select id="cv-ven" value={b.vendedorId} onChange={e => set({ vendedorId: e.target.value, avisoV: '' })}>{vendedoresPara(db, yo).map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}</select></Campo> : <p className="sub-t">Vendedor: <b>{sesion.nombre}</b></p>)}
          {b.avisoV && <p className="alerta ambar"><Icono n="alerta" />{b.avisoV}</p>}</>}
        {b.modo === 'devolucion' && <><Campo etiqueta="Motivo" id="cv-mot"><select id="cv-mot" value={b.motivo} onChange={e => set({ motivo: e.target.value })}><option value="">Elige…</option>{MOTIVOS_DEVOLUCION.map(m => <option key={m}>{m}</option>)}</select></Campo>
          <Campo etiqueta="Nota (opcional)" id="cv-nota"><input id="cv-nota" value={b.nota} maxLength={160} onChange={e => set({ nota: e.target.value })} /></Campo></>}
        {err && <p className="error" role="alert">{err}</p>}
        <div className="acciones-fila">
          <button type="button" className="btn grande" onClick={confirmarB}><Icono n="check" />{b.modo === 'devolucion' ? 'Enviar para aprobación' : b.modo === 'ingreso' ? 'Confirmar ingreso' : 'Confirmar y guardar'}</button>
          <button type="button" className="btn suave" onClick={() => { setB(null); setErr('') }}>Cancelar</button>
        </div>
      </div>}

      {r && <div className="ia-res" role="status" aria-live="polite">
        {r.o && <p className="ia-escuche">Escuché: «{r.o.texto}»</p>}
        {r.hecho && <p className="alerta verde"><Icono n="check" /><span>{r.dev ? `Devolución ${r.hecho} enviada. La administradora debe aprobarla.` : r.hecho === 'ingreso' ? 'Ingreso guardado.' : <>Venta <b>{r.hecho}</b> guardada{r.adicional ? ` como adicional de ${r.adicional}` : ''}. <button type="button" className="enlace" onClick={() => ir('ventas', r.hecho)}>Ver guía</button></>}</span></p>}
        {r.no && <div className="ia-respuesta no"><h3>Tu usuario no puede hacer esto</h3><p>{r.no}</p></div>}
        {r.aviso && <p className="alerta ambar"><Icono n="alerta" />{r.aviso}</p>}
        {r.resp && <div className={`ia-respuesta ${r.resp.ok ? '' : 'no'}`}><h3>{r.resp.titulo}</h3><p className="ia-grande">{r.resp.texto}</p>{r.resp.lineas?.length > 0 && <ul>{r.resp.lineas.map((l, i) => <li key={i}>{l}</li>)}</ul>}</div>}
        {r.o?.tipo === 'cobrar' && r.ventas && <div className="ia-respuesta"><h3>Cobrar</h3>{!r.ventas.length ? <p>No encontré ventas por cobrar{r.o.cliente ? ` de «${r.o.cliente}»` : ''}.</p> : <>
          <div className="medios" role="radiogroup" aria-label="Con qué pagó">{MEDIOS_CAJA.map(m => <button key={m} type="button" role="radio" aria-checked={r.medio === m} className={`medio m-${m.toLowerCase()} ${r.medio === m ? 'on' : ''}`} onClick={() => setR({ ...r, medio: m, err: '' })}>{m}</button>)}</div>
          {['Yape', 'Plin'].includes(r.medio) && <Campo etiqueta={`Número de operación de ${r.medio}`} id="cv-cop"><input id="cv-cop" value={r.operacion} maxLength={20} onChange={e => setR({ ...r, operacion: e.target.value, err: '' })} /></Campo>}
          {r.err && <p className="error" role="alert">{r.err}</p>}
          <ul className="ia-ventas">{r.ventas.map(v => <li key={v.id}><span><b>{v.id}</b> · {v.cliente}<small>Falta {soles(saldoDe(v))}</small></span>{r.cobrada === v.id ? <Chip tono="verde" icono="check">Cobrada</Chip> : <button type="button" className="btn chico" onClick={() => cobrar(v)}>Cobrar {soles(saldoDe(v))}</button>}</li>)}</ul></>}</div>}
        {r.o?.tipo === 'buscar' && <ul className="ia-ventas">{r.ventas.map(v => <li key={v.id}><span><b>{v.id}</b> · {v.cliente}</span><button type="button" className="btn suave chico" onClick={() => ir('ventas', v.id)}>Abrir guía</button></li>)}</ul>}
        {r.nada && <div className="ia-respuesta no"><h3>No entendí</h3><p>Empieza con un comando: {COMANDOS_AYUDA.slice(0, 3).map(e => `«${e}»`).join(' · ')}</p></div>}
        <button type="button" className="enlace" onClick={() => setR(null)}>Cerrar</button>
      </div>}
    </section>
  )
}

// Para la administradora: devoluciones que esperan aprobación manual.
export function DevolucionesPendientes() {
  const { vista: db, can, run, aviso, confirmar, ir } = useApp()
  const [medio, setMedio] = useState({})
  const pend = (db.solicitudesDev || []).filter(s => s.estado === 'Pendiente')
  if (!can('devolver') || !pend.length) return null
  const aprobar = async s => {
    const v = db.ventas.find(x => x.id === s.ventaId), deuda = v ? saldoDe(v) : 0
    const m = medio[s.id] || 'Efectivo'
    const c = await confirmar({ titulo: '¿Aprobar la devolución?', lineas: [`${s.id} · venta ${s.ventaId} · ${s.cliente}`, s.items.map(i => `${i.cantidad} × ${i.nombre}`).join(', '), deuda > 0 ? `Se rebaja de la deuda hasta ${soles(Math.min(deuda, s.monto))}${s.monto > deuda ? ` y se devuelven ${soles(s.monto - deuda)} en ${m}` : ''}.` : `Se devuelven ${soles(s.monto)} en ${m}.`, 'Los productos vuelven al stock.'], boton: 'Sí, aprobar' })
    if (!c.ok) return
    const x = await run(aprobarDevolucion, s.id, { medio: m, reingresa: true })
    if (x) aviso(`Devolución ${s.id} aprobada. El stock y la caja ya se ajustaron.`)
  }
  const rechazar = async s => { const c = await confirmar({ titulo: '¿Rechazar la devolución?', lineas: [`${s.id} · venta ${s.ventaId}`], boton: 'Sí, rechazar' }); if (c.ok && await run(rechazarDevolucion, s.id, 'Rechazada por la administradora')) aviso(`Devolución ${s.id} rechazada.`) }
  return (
    <section className="dev-pend no-imprimir" aria-label="Devoluciones por aprobar">
      <h2 className="sub-t"><Icono n="alerta" />Devoluciones por aprobar <Chip tono="ambar">{pend.length}</Chip></h2>
      <ul className="lista">{pend.map(s => <li key={s.id} className="tarjeta dev-item">
        <p><b>{s.id}</b> · venta <button type="button" className="enlace" onClick={() => ir('ventas', s.ventaId)}>{s.ventaId}</button> · {s.cliente} · {s.motivo}{s.nota ? ` · ${s.nota}` : ''}</p>
        <p>{s.items.map(i => `${i.cantidad} × ${i.nombre}`).join(', ')} · <b>{soles(s.monto)}</b> · pidió {db.usuarios.find(u => u.id === s.solicitadoPor)?.nombre || '—'}</p>
        <div className="acciones-fila"><label className="cv-medio">Devolver dinero en <select value={medio[s.id] || 'Efectivo'} onChange={e => setMedio({ ...medio, [s.id]: e.target.value })}>{MEDIOS_CAJA.map(m => <option key={m}>{m}</option>)}</select></label>
          <button type="button" className="btn chico" onClick={() => aprobar(s)}><Icono n="check" />Aprobar</button><button type="button" className="btn suave chico" onClick={() => rechazar(s)}>Rechazar</button></div>
      </li>)}</ul>
    </section>
  )
}
