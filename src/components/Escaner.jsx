// Lector de códigos con la cámara del celular. Usa BarcodeDetector si el navegador lo trae;
// si no, lee la imagen con nuestro decodificador Code128 local (src/lib/codigoBarras.js). Nada se carga de internet.
import { useEffect, useRef, useState } from 'react'
import { Icono } from './Iconos.jsx'
import { leerImagen } from '../lib/codigoBarras.js'

export default function Escaner({ onCodigo, onCerrar, titulo = 'Escanear con la cámara' }) {
  const video = useRef(null), lienzo = useRef(null), [estado, setEstado] = useState('Abriendo la cámara…'), [err, setErr] = useState('')
  useEffect(() => {
    let flujo = null, vivo = true, t = null, detector = null
    const fin = c => { if (!vivo) return; vivo = false; onCodigo(c) }
    ;(async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('Este navegador no permite usar la cámara. Usa el lector USB o escribe el código.')
        flujo = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
        if (!vivo) return flujo.getTracks().forEach(x => x.stop())
        video.current.srcObject = flujo; await video.current.play()
        if ('BarcodeDetector' in window) { try { detector = new window.BarcodeDetector({ formats: ['code_128', 'ean_13'] }) } catch { detector = null } }
        setEstado(detector ? 'Apunta al código de barras.' : 'Apunta al código de barras (lector local).')
        const ciclo = async () => {
          if (!vivo) return
          const v = video.current
          if (v && v.videoWidth) {
            try {
              if (detector) { const r = await detector.detect(v); if (r[0]?.rawValue) return fin(r[0].rawValue) }
              else { const c = lienzo.current, w = Math.min(960, v.videoWidth), h = Math.round(v.videoHeight * w / v.videoWidth); c.width = w; c.height = h; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(v, 0, 0, w, h); const txt = leerImagen(g.getImageData(0, 0, w, h)); if (txt) return fin(txt) }
            } catch { /* cuadro ilegible: se intenta el siguiente */ }
          }
          t = setTimeout(ciclo, 250)
        }
        ciclo()
      } catch (e) { setErr(e?.name === 'NotAllowedError' ? 'No diste permiso para usar la cámara. Actívalo en el navegador o usa el lector USB.' : e.message || 'No se pudo abrir la cámara.') }
    })()
    return () => { vivo = false; clearTimeout(t); flujo?.getTracks().forEach(x => x.stop()) }
  }, []) // eslint-disable-line
  return (
    <div className="escaner tarjeta" role="group" aria-label={titulo}>
      <div className="fila-sb"><h3>{titulo}</h3><button type="button" className="btn suave chico" onClick={onCerrar}><Icono n="cerrar" />Cerrar cámara</button></div>
      {err ? <p className="error" role="alert">{err}</p> : <p className="sub" aria-live="polite">{estado}</p>}
      <div className="escaner-marco"><video ref={video} muted playsInline aria-label="Vista de la cámara" /><span className="escaner-linea" aria-hidden="true" /></div>
      <canvas ref={lienzo} hidden />
    </div>)
}
