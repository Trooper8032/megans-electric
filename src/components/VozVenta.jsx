// Venta por voz: entiende lo dictado, llena el carrito, el medio, el cliente y la operación. NUNCA cobra:
// la persona revisa y toca «Cobrar». Lo dudoso se pregunta y lo que no está en el catálogo se marca.
import { useEffect, useRef, useState } from 'react'
import Microfono from './Microfono.jsx'
import { Icono } from './Iconos.jsx'
import { Chip } from './ui.jsx'
import { entenderVenta } from '../lib/voz.js'
import { ID_OTROS } from '../lib/dominio.js'
import { soles } from '../lib/dinero.js'
import { medidas } from '../ia/motor.js'
import { tomarPendiente, alPendiente } from '../ia/pendiente.js'

export default function VozVenta({ productos, items, setItems, setMedio, setCliente, setOperacion, cliente }) {
  const [res, setRes] = useState(null), [otros, setOtros] = useState({})
  const enCarro = (its, id) => its.filter(i => i.productoId === id).reduce((s, i) => s + i.cantidad, 0)
  const sumar = (its, p, cant, precio) => {
    const libre = Math.max(0, p.stock - enCarro(its, p.id)), c = Math.min(cant, libre)
    if (c <= 0) return { its, puesto: 0, libre }
    const ex = its.find(i => i.productoId === p.id && i.precio === undefined)
    const nuevo = ex && precio == null ? its.map(i => i === ex ? { ...i, cantidad: i.cantidad + c } : i) : [...its, { productoId: p.id, cantidad: c, ...(precio != null ? { precio: String(precio) } : {}) }]
    return { its: nuevo, puesto: c, libre }
  }
  const entender = (texto, origen) => {
    const v = entenderVenta(texto, productos); let its = items
    const lineas = v.lineas.map(l => {
      if (!l.encontrado || l.duda) return { ...l, estado: l.encontrado ? 'elegir' : 'nuevo' }
      const p = productos.find(x => x.id === l.productoId)
      if (!p || p.activo === false || !(p.precio > 0)) return { ...l, estado: 'nuevo' }
      const r = sumar(its, p, l.cantidad, l.precio); its = r.its
      return { ...l, estado: r.puesto === l.cantidad ? 'ok' : r.puesto > 0 ? 'parcial' : 'sinstock', puesto: r.puesto }
    })
    setItems(its)
    if (v.medio) setMedio(v.medio)
    if (v.cliente) setCliente(v.cliente)
    if (v.operacion) setOperacion(v.operacion)
    setRes({ ...v, lineas, origen, ms: origen?.voz ? medidas.transcribirMs : null })
  }
  const ref = useRef(null); ref.current = () => { const p = tomarPendiente('venta'); if (p) { entender(p.texto, p.origen) } }
  useEffect(() => { ref.current(); return alPendiente(() => ref.current()) }, [])
  const elegir = (idx, id) => {
    const l = res.lineas[idx], p = productos.find(x => x.id === id); if (!p) return
    const r = sumar(items, p, l.cantidad, l.precio); setItems(r.its)
    setRes({ ...res, lineas: res.lineas.map((x, i) => i === idx ? { ...x, productoId: p.id, nombre: p.nombre, estado: r.puesto === l.cantidad ? 'ok' : r.puesto > 0 ? 'parcial' : 'sinstock', puesto: r.puesto } : x) })
  }
  const comoOtros = idx => {
    const l = res.lineas[idx], precio = Number(String(otros[idx] || '').replace(',', '.'))
    if (!(precio > 0)) return setOtros({ ...otros, ['e' + idx]: 'Escribe el precio.' })
    setItems([...items, { productoId: ID_OTROS, cantidad: Math.max(1, Math.floor(l.cantidad)), precio, detalle: l.nombreDicho.slice(0, 80) }])
    setRes({ ...res, lineas: res.lineas.map((x, i) => i === idx ? { ...x, estado: 'otros' } : x) })
  }
  return (
    <section className="tarjeta ia-tarjeta" aria-label="Vender por voz">
      <div className="ia-cab"><h2><Icono n="microfono" />Vender por voz <span className="chip azul">Nuevo</span></h2></div>
      <Microfono etiqueta="Dictar la venta" ejemplo="Di: cantidad, producto, cómo pagó y el cliente. Ej.: «Dos interruptores simples y un enchufe reversible, Yape, cliente Juan»." onTexto={entender} />
      {res && <div className="ia-res" role="status">
        <p className="ia-escuche">Escuché: «{res.texto}»</p>
        {!res.lineas.length && <p className="alerta ambar"><Icono n="alerta" />No reconocimos productos. Di la cantidad y el nombre, por ejemplo «tres cajas de dos polos».</p>}
        <ul className="ia-lineas">{res.lineas.map((l, i) => <li key={i} className={`ia-l ${l.estado}`}>
          {l.estado === 'ok' && <><Chip tono="verde" icono="check">Listo</Chip><span><b>{l.cantidad} × {l.nombre}</b>{l.precio ? ` a ${soles(l.precio)}` : ''}</span></>}
          {l.estado === 'parcial' && <><Chip tono="ambar" icono="alerta">Poco stock</Chip><span><b>{l.puesto} × {l.nombre}</b> — pediste {l.cantidad}, solo hay {l.puesto}.</span></>}
          {l.estado === 'sinstock' && <><Chip tono="rojo" icono="alerta">Sin stock</Chip><span><b>{l.nombre}</b> — no queda stock, no se agregó.</span></>}
          {l.estado === 'otros' && <><Chip tono="azul" icono="check">Como «Otros»</Chip><span><b>{l.cantidad} × {l.nombreDicho}</b></span></>}
          {l.estado === 'elegir' && <><Chip tono="ambar" icono="alerta">¿Cuál es?</Chip><span>«{l.nombreDicho}» ({l.cantidad}). Toca el correcto:</span>
            <span className="ia-opciones">{l.opciones.map(o => <button key={o.id} type="button" className="btn suave chico" onClick={() => elegir(i, o.id)}>{o.nombre}</button>)}</span></>}
          {l.estado === 'nuevo' && <><Chip tono="rojo" icono="alerta">No está en el catálogo</Chip><span>«{l.nombreDicho}» ({l.cantidad}). No se agregó.</span>
            {l.opciones.length > 0 && <span className="ia-opciones"><small>¿Quisiste decir?</small>{l.opciones.map(o => <button key={o.id} type="button" className="btn suave chico" onClick={() => elegir(i, o.id)}>{o.nombre}</button>)}</span>}
            <span className="ia-otros"><label htmlFor={`vo-${i}`}>Precio para venderlo como «Otros» (S/)</label><input id={`vo-${i}`} inputMode="decimal" value={otros[i] || ''} onChange={e => setOtros({ ...otros, [i]: e.target.value, ['e' + i]: '' })} /><button type="button" className="btn suave chico" onClick={() => comoOtros(i)}>Agregar como «Otros»</button>{otros['e' + i] && <small className="error" role="alert">{otros['e' + i]}</small>}</span></>}
        </li>)}</ul>
        <p className="ia-datos">{res.medio ? <Chip tono="azul">Pago: {res.medio}</Chip> : <Chip tono="ambar">Pago: no lo escuché, elígelo abajo</Chip>} {res.cliente ? <Chip tono="azul">Cliente: {res.cliente}</Chip> : !cliente && <Chip tono="ambar">Cliente: escríbelo abajo</Chip>} {res.operacion && <Chip tono="azul">Operación: {res.operacion}</Chip>}</p>
        <p className="sub-t"><Icono n="check" tam={16} /> Revisa el carrito y toca <b>Cobrar</b>. No se cobra nada solo.</p>
      </div>}
    </section>
  )
}
