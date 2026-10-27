// Botón grande de micrófono: graba hasta 20 s, o se sube un audio, o se escribe. Whisper se descarga solo al primer uso.
import { useEffect, useId, useRef, useState } from 'react'
import { Icono } from './Iconos.jsx'
import { transcribir } from '../ia/motor.js'

export function Progreso({ estado }) {
  if (!estado) return null
  return <div className="ia-prog" role="status"><span>{estado.texto}</span>{estado.pct != null && <span className="ia-barra" aria-hidden="true"><span style={{ width: `${Math.max(3, Math.min(100, estado.pct))}%` }} /></span>}</div>
}
export default function Microfono({ etiqueta = 'Hablar', ejemplo, onTexto, onEmpezar, ocupado = false, clase = '' }) {
  const id = useId(), [grab, setGrab] = useState(false), [seg, setSeg] = useState(0), [estado, setEstado] = useState(null), [err, setErr] = useState(''), [escribir, setEscribir] = useState(false), [txt, setTxt] = useState(''), [trabajando, setTrabajando] = useState(false)
  const rec = useRef(null), iv = useRef(null), sub = useRef(null)
  useEffect(() => () => { clearInterval(iv.current); try { rec.current?.stop() } catch { /* nada */ } }, [])
  const procesar = async blob => {
    setErr(''); setTrabajando(true); onEmpezar?.()
    try { const t = await transcribir(blob, (texto, pct) => setEstado({ texto, pct })); setEstado(null); if (!t.trim()) setErr('No escuchamos nada. Habla más cerca del celular e inténtalo otra vez.'); else onTexto(t, { voz: true }) }
    catch (e) { console.error(e); setEstado(null); setErr('No pudimos escuchar el audio. Inténtalo otra vez o escríbelo.') }
    setTrabajando(false)
  }
  const tocar = async () => {
    if (grab) { rec.current?.stop(); return }
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { setErr('Este navegador no permite grabar aquí. Sube un audio o escríbelo.'); return }
    let s; try { s = await navigator.mediaDevices.getUserMedia({ audio: true }) } catch { setErr('Necesitamos permiso para usar el micrófono. Revisa los permisos del navegador.'); return }
    const partes = [], r = new MediaRecorder(s); rec.current = r
    r.ondataavailable = e => e.data.size && partes.push(e.data)
    r.onstop = () => { s.getTracks().forEach(t => t.stop()); clearInterval(iv.current); setGrab(false); rec.current = null; procesar(new Blob(partes, { type: partes[0]?.type || 'audio/webm' })) }
    r.start(); setGrab(true); setSeg(0); setErr('')
    let n = 0; iv.current = setInterval(() => { n++; setSeg(n); if (n >= 20) r.state !== 'inactive' && r.stop() }, 1000)
  }
  const ocup = ocupado || trabajando
  return (
    <div className={`ia-mic-caja ${clase}`}>
      <div className="ia-mic-fila">
        <button type="button" className={`btn grande ia-mic ${grab ? 'grabando' : ''}`} disabled={ocup && !grab} aria-pressed={grab} aria-describedby={ejemplo ? id : undefined} onClick={tocar}><Icono n="microfono" tam={26} />{grab ? `Detener (${seg} s)` : trabajando ? 'Escuchando…' : etiqueta}</button>
        <span className="ia-mic-otros"><button type="button" className="enlace" disabled={ocup} onClick={() => sub.current?.click()}>Subir un audio</button> · <button type="button" className="enlace" aria-expanded={escribir} onClick={() => setEscribir(x => !x)}>Escribir</button></span>
      </div>
      {ejemplo && <p className="ia-ejemplo" id={id}><Icono n="foco" tam={16} />{ejemplo}</p>}
      <input ref={sub} className="oculto-input" type="file" accept="audio/*" tabIndex={-1} aria-hidden="true" data-prueba="subir-audio" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) procesar(f) }} />
      {escribir && <form className="ia-escribir" onSubmit={e => { e.preventDefault(); if (txt.trim()) { onTexto(txt.trim(), { voz: false }); setTxt('') } }}><label className="oculto" htmlFor={`${id}-t`}>Escribe lo que dirías</label><input id={`${id}-t`} value={txt} maxLength={300} onChange={e => setTxt(e.target.value)} placeholder="Escribe lo que dirías…" /><button type="submit" className="btn suave">Listo</button></form>}
      <Progreso estado={estado} />
      {err && <p className="error" role="alert">{err}</p>}
    </div>
  )
}
