import { useEffect, useRef, useState, useId } from 'react'
import { Icono } from './Iconos.jsx'
import { config } from '../config/app.config.js'

export const Marca = ({ pequena = false }) => <span className={`marca ${pequena ? 'pq' : ''}`}><img src={import.meta.env.BASE_URL + "img/logo-640.png"} alt={config.nombre} width="120" height="41" /></span>
export const Pie = () => <footer className="pie"><span>{config.nombre} · {config.lema}</span><span className="credito">{config.credito}</span></footer>
export const Chip = ({ tono = 'azul', children, icono }) => <span className={`chip ${tono}`}>{icono && <Icono n={icono} tam={14} />}{children}</span>
export const Vacio = ({ icono = 'caja', titulo, texto, children }) => <div className="vacio"><Icono n={icono} tam={44} /><h3>{titulo}</h3>{texto && <p>{texto}</p>}{children}</div>
export const Campo = ({ etiqueta, error, ayuda, children, id }) => (
  <div className={`campo ${error ? 'con-error' : ''}`}>
    <label htmlFor={id}>{etiqueta}</label>{children}
    {ayuda && !error && <small className="ayuda">{ayuda}</small>}
    {error && <small className="error" role="alert">{error}</small>}
  </div>
)
export function Tabs({ valor, onCambio, opciones, etiqueta }) {
  return <div className="tabs" role="tablist" aria-label={etiqueta}>{opciones.map(o => <button key={o.id} role="tab" type="button" aria-selected={valor === o.id} className={`tab ${valor === o.id ? 'on' : ''}`} onClick={() => onCambio(o.id)}>{o.texto}{o.cuenta ? <span className="contador" aria-label={`${o.cuenta} pendientes`}>{o.cuenta}</span> : null}</button>)}</div>
}
export const ChipMedio = ({ medio, children }) => <span className={`chip m-${String(medio).toLowerCase()}`}>{children || medio}</span>
export const Kpi = ({ etiqueta, valor, tono = '', sub, icono }) => (
  <div className={`kpi-card ${tono}`}>{icono && <Icono n={icono} tam={22} />}<span className="kpi-et">{etiqueta}</span><strong className="kpi-val">{valor}</strong>{sub && <small>{sub}</small>}</div>
)
// Cuadro de diálogo accesible con foco atrapado. Se cierra con Escape.
export function Modal({ titulo, onCerrar, children, ancho = false }) {
  const ref = useRef(null), id = useId()
  useEffect(() => {
    const prev = document.activeElement, el = ref.current
    el?.querySelector('[data-foco]')?.focus() || el?.querySelector('input,select,textarea,button')?.focus()
    const tecla = e => {
      if (e.key === 'Escape') { e.stopPropagation(); onCerrar() }
      if (e.key === 'Tab') { const f = [...el.querySelectorAll('button:not([disabled]),input:not([disabled]),select,textarea,a[href]')]; if (!f.length) return; const a = f[0], b = f[f.length - 1]; if (e.shiftKey && document.activeElement === a) { e.preventDefault(); b.focus() } else if (!e.shiftKey && document.activeElement === b) { e.preventDefault(); a.focus() } }
    }
    document.addEventListener('keydown', tecla); document.body.classList.add('con-modal')
    return () => { document.removeEventListener('keydown', tecla); document.body.classList.remove('con-modal'); prev?.focus?.() }
  }, []) // eslint-disable-line
  return (
    <div className="modal-fondo" onMouseDown={e => { if (e.target === e.currentTarget) onCerrar() }}>
      <div className={`modal ${ancho ? 'ancho' : ''}`} role="dialog" aria-modal="true" aria-labelledby={id} ref={ref}>
        <div className="modal-cab"><h2 id={id}>{titulo}</h2><button type="button" className="icono-btn" aria-label="Cerrar" onClick={onCerrar}><Icono n="cerrar" /></button></div>
        {children}
      </div>
    </div>
  )
}
export function Confirmar({ datos, onResolver }) {
  const [motivo, setMotivo] = useState(''), [err, setErr] = useState('')
  const ok = () => { if (datos.pideMotivo && motivo.trim().length < (datos.minimo || 5)) { setErr(`Escribe el motivo (mínimo ${datos.minimo || 5} letras).`); return } onResolver({ ok: true, motivo: motivo.trim() }) }
  return (
    <Modal titulo={datos.titulo} onCerrar={() => onResolver({ ok: false })}>
      {datos.texto && <p className="modal-texto">{datos.texto}</p>}
      {datos.lineas && <ul className="modal-lineas">{datos.lineas.map((l, i) => <li key={i}>{l}</li>)}</ul>}
      {datos.pideMotivo && <Campo etiqueta={datos.etiquetaMotivo || 'Motivo'} id="mot-conf" error={err}><input id="mot-conf" value={motivo} maxLength={160} onChange={e => { setMotivo(e.target.value); setErr('') }} onKeyDown={e => { if (e.key === 'Enter') ok() }} /></Campo>}
      <div className="acciones-fila fin"><button type="button" className="btn suave" onClick={() => onResolver({ ok: false })}>{datos.cancelar || 'No, volver'}</button><button type="button" data-foco className={`btn ${datos.peligro ? 'peligro' : ''}`} onClick={ok}>{datos.boton || 'Sí, confirmar'}</button></div>
    </Modal>
  )
}
export const Tabla = ({ titulo, cabeceras, children, clase = '' }) => (
  <div className="tabla-wrap" tabIndex="0" role="region" aria-label={titulo}><table className={clase}><caption className="solo-lectores">{titulo}</caption><thead><tr>{cabeceras.map((c, i) => <th key={i} scope="col" className={c.der ? 'der' : ''}>{c.t ?? c}</th>)}</tr></thead><tbody>{children}</tbody></table></div>
)
