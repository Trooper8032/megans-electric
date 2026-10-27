// Foto de la venta o devolución: tomar con la cámara o subir; se comprime antes de guardarse.
import { useId, useRef, useState } from 'react'
import { Icono } from './Iconos.jsx'
import { comprimirFoto } from '../lib/foto.js'
import MejorarFoto from './MejorarFoto.jsx'

export default function Foto({ valor, onCambio, onOcupado = null, compacta = false, mejorar = false, etiqueta = 'Foto de la venta (opcional)', alt = 'Foto de la venta' }) {
  const id = useId(), cam = useRef(null), sub = useRef(null), [ocupado, setOcupado] = useState(false), [err, setErr] = useState(''), [mej, setMej] = useState(false)
  const elegir = async e => {
    const f = e.target.files?.[0]; e.target.value = ''
    if (!f) return
    setErr(''); setOcupado(true); onOcupado?.(true)
    try { onCambio(await comprimirFoto(f)) } catch (x) { setErr(x.message || 'No se pudo leer la foto.') }
    setOcupado(false); onOcupado?.(false)
  }
  return (
    <div className={`foto-campo ${compacta ? 'compacta' : ''}`} role="group" aria-labelledby={id}>
      <span id={id} className="foto-t">{etiqueta}</span>
      {valor ? <div className="foto-prev"><img src={valor} alt={alt} /><button type="button" className="enlace" onClick={() => onCambio(null)}>Quitar foto</button></div> : null}
      {valor && mejorar && <button type="button" className={`btn suave ${compacta ? 'chico' : ''} ia-mejorar`} onClick={() => setMej(true)}><Icono n="varita" />Mejorar foto (quitar fondo)</button>}
      {mej && <MejorarFoto foto={valor} onCerrar={() => setMej(false)} onUsar={f => { setMej(false); onCambio(f) }} />}
      <div className="acciones-fila">
        <button type="button" className={`btn suave ${compacta ? 'chico' : ''}`} disabled={ocupado} onClick={() => cam.current?.click()}><Icono n="camara" />{ocupado ? 'Preparando foto…' : valor ? 'Tomar otra' : 'Tomar foto'}</button>
        <button type="button" className={`btn suave ${compacta ? 'chico' : ''}`} disabled={ocupado} onClick={() => sub.current?.click()}><Icono n="subir" />Subir foto</button>
      </div>
      <input ref={cam} className="oculto-input" type="file" accept="image/*" capture="environment" tabIndex={-1} aria-hidden="true" onChange={elegir} />
      <input ref={sub} className="oculto-input" type="file" accept="image/*" tabIndex={-1} aria-hidden="true" data-prueba={compacta ? "subir-foto-linea" : "subir-foto"} onChange={elegir} />
      {err && <p className="error" role="alert">{err}</p>}
    </div>
  )
}
