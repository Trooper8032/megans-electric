// Revisar la captura de Yape / Plin de un pago «Por verificar»: lee monto, fecha y número de operación y los compara con
// lo registrado, incluido si ese número ya está en otra venta. ES SOLO UNA SUGERENCIA: no verifica ni cambia nada.
import { useEffect, useRef, useState } from 'react'
import { useApp } from './contexto.js'
import { Modal, Chip } from './ui.jsx'
import { Icono } from './Iconos.jsx'
import { Progreso } from './Microfono.jsx'
import { parsearPago, compararPago } from '../lib/ocr.js'
import { soles } from '../lib/dinero.js'
import { fechaCorta } from '../lib/fechas.js'
import { leerFoto, dataUrlABlob, medidas } from '../ia/motor.js'

export default function RevisarCaptura({ pago, onCerrar }) {
  const { vista } = useApp()
  const [img, setImg] = useState(pago.foto || null), [estado, setEstado] = useState(null), [res, setRes] = useState(null), [err, setErr] = useState('')
  const sub = useRef(null)
  const leer = async archivo => {
    setErr(''); setRes(null)
    try {
      const t0 = performance.now(); let tx = await leerFoto(archivo, (texto, pct) => setEstado({ texto, pct }), { max: 1600 }); let l = parsearPago(tx)
      if (l.monto == null || !l.operacion) { tx += '\n' + await leerFoto(archivo, (texto, pct) => setEstado({ texto: 'Leyendo otra vez…', pct }), { invertir: true, max: 1600 }); l = parsearPago(tx) }
      medidas.pagoMs = performance.now() - t0; medidas.pagoTexto = tx
      setEstado(null); setRes({ l, c: compararPago(l, pago, vista) })
    } catch (e) { console.error(e); setEstado(null); setErr('No pudimos leer la captura. Prueba con otra imagen.') }
  }
  useEffect(() => { if (pago.foto) leer(dataUrlABlob(pago.foto)) }, []) // eslint-disable-line
  const fila = (k, v, ok) => <tr><th scope="row">{k}</th><td>{v || '—'}</td><td>{ok == null ? '' : ok ? <Chip tono="verde" icono="check">Cuadra</Chip> : <Chip tono="ambar" icono="alerta">Revisar</Chip>}</td></tr>
  return (
    <Modal titulo={`Revisar captura de ${pago.medio}`} onCerrar={onCerrar}>
      <p className="modal-texto">Guía <b>{pago.ventaId}</b> · {pago.cliente} · registrado <b>{soles(pago.monto)}</b>{pago.operacion ? <> · operación <b>{pago.operacion}</b></> : null}</p>
      {!pago.foto && <div className="acciones-fila"><button type="button" className="btn" onClick={() => sub.current?.click()}><Icono n="subir" />Elegir la captura de {pago.medio}</button></div>}
      <input ref={sub} className="oculto-input" type="file" accept="image/*" tabIndex={-1} aria-hidden="true" data-prueba="subir-captura" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) { setImg(URL.createObjectURL(f)); leer(f) } }} />
      <Progreso estado={estado} />
      {err && <p className="error" role="alert">{err}</p>}
      {res && <div className="ia-captura" role="status">
        {img && <img src={img} alt={`Captura de ${pago.medio} de ${pago.cliente}`} />}
        <div><p className="ia-grande">{res.c.estado === 'Coincide' ? <Chip tono="verde" icono="check">Coincide</Chip> : <Chip tono="ambar" icono="alerta">Revisar</Chip>}</p>
          <table className="ia-tabla mini"><caption className="solo-lectores">Lo que se leyó en la captura</caption><tbody>
            {fila('Monto', res.l.monto != null ? soles(res.l.monto) : '', res.c.chk.monto || false)}
            {fila('Fecha', res.l.fecha ? fechaCorta(res.l.fecha) : '', res.c.chk.fecha || false)}
            {fila('Hora', res.l.hora)}
            {fila('N.º de operación', res.l.operacion, res.c.chk.operacion || false)}
            {fila('App', res.l.app || '')}
          </tbody></table></div>
        {res.c.motivos.length > 0 && <ul className="alerta ambar ia-motivos">{res.c.motivos.map((m, i) => <li key={i}>{m}</li>)}</ul>}
      </div>}
      <p className="sub-t"><Icono n="escudo" tam={16} /> Es solo una ayuda. Una captura se puede falsificar: verifica el pago solo si lo ves en tu app de {pago.medio}. Esta revisión no cambia nada.</p>
      <div className="acciones-fila fin"><button type="button" className="btn suave" onClick={onCerrar}>Cerrar</button></div>
    </Modal>
  )
}
