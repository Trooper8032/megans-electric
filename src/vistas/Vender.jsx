import { useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../components/contexto.js'
import Selector, { totalCarro, precioLinea } from '../components/Selector.jsx'
import Foto from '../components/Foto.jsx'
import VozVenta from '../components/VozVenta.jsx'
import { Campo, Chip } from '../components/ui.jsx'
import { Icono } from '../components/Iconos.jsx'
import { MEDIOS } from '../config/app.config.js'
import { crearVenta, cajaBloqueada, favoritosDe, masVendidos, marcarFavorito, vendedoresPara, ID_OTROS, estadoCobro, saldoDe } from '../lib/dominio.js'
import { NOMBRE_ROL } from '../lib/permisos.js'
import { soles } from '../lib/dinero.js'
import { fechaISO } from '../lib/fechas.js'

// Nueva venta (los 3 roles venden igual). Flujo rápido: producto → cantidad → Cobrar. El medio arranca en Efectivo.
export default function Vender() {
  const { vista: db, sesion, run, ir, can, aviso } = useApp()
  const [items, setItems] = useState([]), [cliente, setCliente] = useState(''), [telefono, setTelefono] = useState(''), [medio, setMedio] = useState('Efectivo'), [notas, setNotas] = useState(''), [foto, setFoto] = useState(null), [operacion, setOperacion] = useState(''), [abono, setAbono] = useState(''), [fotoPago, setFotoPago] = useState(null)
  const [vendedorId, setVendedorId] = useState(sesion.id), [err, setErr] = useState(''), [hecha, setHecha] = useState(null), [guardando, setGuardando] = useState(false), [fotoOcupada, setFotoOcupada] = useState(false)
  const refErr = useRef(null)
  useEffect(() => { if (err) refErr.current?.scrollIntoView?.({ block: 'center', behavior: 'smooth' }) }, [err])
  const hoy = fechaISO(new Date()), bloqueada = cajaBloqueada(db, hoy, vendedorId)
  const total = totalCarro(items, db.productos)
  const favs = favoritosDe(db, sesion.id)
  const rapidos = useMemo(() => [...new Set([...favs, ...masVendidos(db, hoy, 30, 10)])].slice(0, 10), [db, hoy]) // eslint-disable-line
  const vendedores = vendedoresPara(db, { ...sesion, rol: sesion.rol })
  const limpiar = () => { setHecha(null); setItems([]); setCliente(''); setTelefono(''); setMedio('Efectivo'); setNotas(''); setFoto(null); setOperacion(''); setAbono(''); setFotoPago(null); setVendedorId(sesion.id); setErr('') }
  const cobrar = async () => {
    setErr('')
    if (fotoOcupada) return setErr('Espera a que la foto termine de prepararse.')
    if (!items.length) return setErr('Elige al menos un producto: tócalo en la lista.')
    if (!medio) return setErr('Elige cómo pagó el cliente.')
    if (cliente.trim().length < 2) return setErr('Escribe el nombre del cliente (obligatorio en todas las ventas).')
    if (items.some(i => i.productoId !== ID_OTROS && i.precio !== undefined && !(Number(String(i.precio).replace(',', '.')) > 0))) return setErr('Revisa el precio: debe ser mayor que cero.')
    if (['Yape', 'Plin'].includes(medio) && !/^[0-9A-Za-z-]{4,20}$/.test(operacion.replace(/\s/g, ''))) return setErr(`Escribe el número de operación de ${medio} (obligatorio).`)
    const montoAhora = abono.trim() ? Number(abono.replace(',', '.')) : null
    if (montoAhora !== null && medio !== 'Pendiente' && !(montoAhora > 0 && montoAhora <= total)) return setErr(`El monto que paga ahora debe ser mayor que cero y hasta ${soles(total)}.`)
    if (telefono && !/^(51)?9\d{8}$/.test(telefono.replace(/\D/g, ''))) return setErr('El celular debe tener 9 dígitos y empezar con 9 (o déjalo vacío).')
    setGuardando(true)
    const envio = items.map(i => i.productoId === ID_OTROS ? i : { productoId: i.productoId, cantidad: i.cantidad, ...(i.foto ? { foto: i.foto } : {}), ...(i.precio !== undefined ? { precio: precioLinea(i, db.productos) } : {}) })
    const r = await run(crearVenta, { cliente, telefono, medio, items: envio, notas, vendedorId, foto, ...(medio !== 'Pendiente' ? { operacion, fotoPago, ...(montoAhora !== null ? { monto: montoAhora } : {}) } : {}) })
    setGuardando(false)
    if (r) { const v = r.vista.ventas.find(x => x.id === r.ref); setHecha(v || { id: r.ref, total, medio, items: [], cliente }) }
  }
  const favorito = async id => { if (await run(marcarFavorito, id)) aviso(favs.includes(id) ? 'Quitado de favoritos.' : 'Agregado a favoritos.') }
  if (hecha) return <Confirmacion v={hecha} db={db} onOtra={limpiar} ir={ir} />
  return (
    <div className="pagina ancha venta">
      <div className="titulo-fila"><div><h1>Nueva venta</h1><p className="sub pasos"><span><b>1</b> Toca el producto</span><span><b>2</b> Ajusta la cantidad</span><span><b>3</b> Cobrar</span></p></div>
        {can('verTodasLasVentas') && <span className="chip azul"><Icono n="usuario" tam={14} />Vendes como {NOMBRE_ROL[sesion.rol]}</span>}</div>
      {bloqueada && <p className="alerta rojo" role="alert"><Icono n="candado" />{vendedorId === sesion.id ? 'Tu caja de hoy ya está cerrada.' : 'La caja de ese vendedor ya está cerrada hoy.'} No se pueden registrar más ventas; la administradora puede reabrirla.</p>}
      {!bloqueada && <VozVenta productos={db.productos} items={items} setItems={i => { setItems(i); setErr('') }} setMedio={setMedio} setCliente={setCliente} setOperacion={setOperacion} cliente={cliente} />}
      <Selector clase="pos-venta" productos={db.productos} items={items} onCambio={i => { setItems(i); setErr('') }} editarPrecio={can('editarPrecioVenta')} fotoLinea rapidos={rapidos} favoritos={favs} onFavorito={favorito}>
        <div className="cobro" aria-label="Cobro">
          <h2 id="t-medio">¿Cómo pagó?</h2>
          <div className="medios" role="radiogroup" aria-labelledby="t-medio">{MEDIOS.map(m => <button key={m} type="button" role="radio" aria-checked={medio === m} className={`medio m-${m.toLowerCase()} ${medio === m ? 'on' : ''}`} onClick={() => { setMedio(m); setErr('') }}>{medio === m && <Icono n="check" tam={18} />}{m}</button>)}</div>
          {['Yape', 'Plin'].includes(medio) && <Campo etiqueta={`Número de operación de ${medio} (obligatorio)`} id="op" ayuda="Está en el comprobante del cliente"><input id="op" inputMode="numeric" value={operacion} maxLength={20} autoComplete="off" required aria-required="true" onChange={e => { setOperacion(e.target.value); setErr('') }} /></Campo>}
          {medio !== 'Pendiente' && <details className="mas-datos"><summary className="enlace">¿Paga solo una parte o tiene comprobante?</summary>
            <Campo etiqueta="Monto que paga ahora (S/)" id="abono" ayuda={`Vacío = paga todo (${soles(total)}). El resto queda pendiente.`}><input id="abono" inputMode="decimal" value={abono} onChange={e => { setAbono(e.target.value); setErr('') }} /></Campo>
            <Foto valor={fotoPago} onCambio={setFotoPago} onOcupado={setFotoOcupada} etiqueta="Foto del comprobante de pago (opcional)" alt="Comprobante de pago" compacta />
          </details>}
          <p className="estado-cobro">Estado: {medio === 'Pendiente' ? <Chip tono="rojo" icono="reloj">Pendiente (por cobrar)</Chip> : abono.trim() && Number(abono.replace(',', '.')) < total ? <Chip tono="ambar" icono="reloj">Pago parcial</Chip> : <Chip tono="verde" icono="check">Cobrado</Chip>}{['Yape', 'Plin'].includes(medio) && sesion.rol !== 'admin' && <small> El pago queda «Por verificar» hasta que la administradora lo confirme.</small>}{medio === 'Pendiente' && <small> No entra a la caja hasta que se cobre.</small>}</p>
          <Campo etiqueta="Nombre del cliente (obligatorio)" id="cli"><input id="cli" value={cliente} maxLength={60} autoComplete="off" required aria-required="true" onChange={e => { setCliente(e.target.value); setErr('') }} placeholder="Ej.: Juan Pérez" /></Campo>
          {can('elegirVendedor') && <Campo etiqueta="Vendedor" id="vend" ayuda="Por defecto, quien está en sesión"><select id="vend" value={vendedorId} onChange={e => setVendedorId(e.target.value)}>{vendedores.map(u => <option key={u.id} value={u.id}>{u.nombre}{u.id === sesion.id ? ' (yo)' : ''}</option>)}</select></Campo>}
          {can('elegirVendedor') && vendedorId !== sesion.id && <p className="alerta azul"><Icono n="usuario" />Venta asignada: le aparecerá al instante a {vendedores.find(u => u.id === vendedorId)?.nombre} en su app.</p>}
          {can('elegirVendedor') ? null
            : <p className="sub-t mut">Vendedor: <strong>{sesion.nombre}</strong></p>}
          <details className="mas-datos"><summary className="enlace">Más datos: celular, nota y foto</summary>
            <Campo etiqueta="Celular (para enviar la guía)" id="tel" ayuda="9 dígitos, empieza con 9"><input id="tel" inputMode="tel" value={telefono} maxLength={14} onChange={e => setTelefono(e.target.value)} /></Campo>
            <Campo etiqueta="Nota (opcional)" id="nota"><input id="nota" value={notas} maxLength={160} onChange={e => setNotas(e.target.value)} /></Campo>
            <Foto valor={foto} onCambio={setFoto} onOcupado={setFotoOcupada} mejorar />
          </details>
          {foto && <p className="sub-t"><Chip tono="verde" icono="camara">Foto lista</Chip></p>}
          {err && <p className="error" role="alert" ref={refErr}>{err}</p>}
        </div>
      </Selector>
      <div className="barra-fija barra-cobro"><span className="tot">Total <strong>{soles(total)}</strong><small>{items.reduce((s, i) => s + i.cantidad, 0)} und · {medio}</small></span>
        <button type="button" className="btn grande cobrar" disabled={guardando || bloqueada} onClick={cobrar}><Icono n="check" />{guardando ? 'Guardando…' : `Cobrar ${soles(total)}`}</button></div>
    </div>
  )
}

function Confirmacion({ v, db, onOtra, ir }) {
  const est = estadoCobro(v), pend = est !== 'Cobrado'
  const vend = db.usuarios.find(u => u.id === v.vendedorId)?.nombre
  return (
    <div className="pagina"><div className="exito tarjeta" role="status">
      <span className="gran-check"><Icono n="check" tam={44} /></span>
      <h1>¡Venta registrada!</h1>
      <p className="sub">Guía <strong>{v.id}</strong> por {soles(v.total)} · {v.medio} · {pend ? <Chip tono={est === 'Parcial' ? 'ambar' : 'rojo'} icono="reloj">{est === 'Parcial' ? `Parcial · falta ${soles(saldoDe(v))}` : 'Pendiente'}</Chip> : <Chip tono="verde" icono="check">Cobrado</Chip>}{(v.pagos || []).some(p => p.estado === 'Por verificar') && <Chip tono="ambar">Pago por verificar</Chip>}</p>
      {v.items?.length > 0 && <ul className="resumen-venta">{v.items.map((l, i) => <li key={i}><span>{l.cantidad} × {l.nombre}{l.precioEditado && <small> (lista {soles(l.precioLista)})</small>}</span><b>{soles(l.cantidad * l.precio)}</b></li>)}</ul>}
      <p className="mut">{v.cliente}{vend ? ` · vendió ${vend}` : ''}{v.foto ? ' · con foto' : ''}. El stock ya se descontó.</p>
      <div className="acciones-col"><button type="button" className="btn grande" onClick={onOtra} autoFocus><Icono n="carrito" />Nueva venta</button>
        <button type="button" className="btn suave grande" onClick={() => ir('ventas', v.id)}><Icono n="archivo" />Ver guía y enviar por WhatsApp</button></div>
    </div></div>)
}
