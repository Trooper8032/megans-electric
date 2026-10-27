// Mejorar foto: quita el fondo (U-2-Netp, en este equipo) y pone un fondo de color, centrado y con sombra suave.
// La persona elige el color y decide si la usa. La foto no se sube a ningún lado.
import { useEffect, useState } from 'react'
import { Modal } from './ui.jsx'
import { Icono } from './Iconos.jsx'
import { Progreso } from './Microfono.jsx'
import { quitarFondo, componer, dataUrlABlob, COLORES_FONDO } from '../ia/motor.js'
import { FOTO_MAX } from '../lib/dominio.js'

export default function MejorarFoto({ foto, onUsar, onCerrar }) {
  const [estado, setEstado] = useState(null), [res, setRes] = useState(null), [color, setColor] = useState('#ffffff'), [nueva, setNueva] = useState(null), [err, setErr] = useState('')
  useEffect(() => { (async () => { try { const r = await quitarFondo(dataUrlABlob(foto), (texto, pct) => setEstado({ texto, pct })); setEstado(null); setRes(r) } catch (e) { console.error(e); setEstado(null); setErr('No se pudo mejorar la foto en este equipo.') } })() }, []) // eslint-disable-line
  useEffect(() => { if (!res) return; (async () => { let lado = 900, q = 0.82, u = await componer(res.png, res.caja, color, lado, q); while (u.length > FOTO_MAX && lado > 400) { q = Math.max(0.5, q - 0.1); if (q <= 0.5) lado = Math.round(lado * 0.8); u = await componer(res.png, res.caja, color, lado, q) } setNueva(u) })() }, [res, color])
  return (
    <Modal titulo="Mejorar foto" onCerrar={onCerrar}>
      <div className="ia-antes-despues"><figure><img src={foto} alt="Foto original" /><figcaption>Antes</figcaption></figure><figure><img src={nueva || foto} alt="Foto mejorada" style={nueva ? undefined : { opacity: 0.35 }} /><figcaption>Después</figcaption></figure></div>
      <Progreso estado={estado} />
      {err && <p className="error" role="alert">{err}</p>}
      <div className="ia-colores" role="radiogroup" aria-label="Color de fondo"><span className="sub-t">Color de fondo:</span>{COLORES_FONDO.map(([c, n]) => <button key={c} type="button" role="radio" aria-checked={color === c} aria-label={n} title={n} className={`ia-color ${color === c ? 'on' : ''}`} style={{ background: c }} onClick={() => setColor(c)} />)}</div>
      <p className="sub-t"><Icono n="candado" tam={16} /> Se procesa en este equipo. Tu foto no se sube a ningún lado.</p>
      <div className="acciones-fila fin"><button type="button" className="btn suave" onClick={onCerrar}>Cancelar</button><button type="button" className="btn" disabled={!nueva} onClick={() => onUsar(nueva)}><Icono n="check" />Usar esta foto</button></div>
    </Modal>
  )
}
