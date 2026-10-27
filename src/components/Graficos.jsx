// Gráficos propios en SVG (sin librerías). Cada gráfico: resumen para lectores de pantalla, elementos que se
// pueden enfocar con teclado (muestran su dato en un globo) y una tabla equivalente.
import { useState, useId } from 'react'
import { Chip } from './ui.jsx'

const limpio = s => s.replace(/[^a-zA-Z0-9]/g, '')
const redondeo = max => { if (max <= 0) return 4; const e = 10 ** Math.floor(Math.log10(max)), n = max / e; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 4 ? 4 : n <= 5 ? 5 : 10) * e }

export function TarjetaGrafico({ titulo, sub, ejemplo = false, cabeceras, filas, children, ancho = false }) {
  const id = limpio(useId())
  return (
    <section className={`tarjeta graf ${ancho ? 'ancho' : ''}`} aria-labelledby={`${id}-t`}>
      <div className="graf-cab"><div><h3 id={`${id}-t`}>{titulo}</h3>{sub && <p className="sub">{sub}</p>}</div>{ejemplo && <Chip tono="calido">Datos de ejemplo</Chip>}</div>
      {children}
      <details className="graf-tabla"><summary>Ver como tabla</summary>
        <div className="tabla-wrap" tabIndex="0" role="region" aria-label={`Tabla: ${titulo}`}>
          <table><caption className="solo-lectores">{titulo}</caption>
            <thead><tr>{cabeceras.map(c => <th key={c} scope="col">{c}</th>)}</tr></thead>
            <tbody>{filas.map((f, i) => <tr key={i}>{f.map((c, j) => j === 0 ? <th key={j} scope="row">{c}</th> : <td key={j}>{c}</td>)}</tr>)}</tbody></table>
        </div>
      </details>
    </section>
  )
}
// Globo de ayuda dentro del SVG.
function Globo({ x, y, texto, ancho = 360 }) {
  const w = Math.max(60, texto.length * 6.4 + 16), px = Math.min(Math.max(x - w / 2, 2), ancho - w - 2), py = Math.max(y - 30, 2)
  return <g className="globo" pointerEvents="none"><rect x={px} y={py} width={w} height="22" rx="7" /><text x={px + w / 2} y={py + 15} textAnchor="middle">{texto}</text></g>
}
const manejadores = (i, activo, setActivo) => ({
  tabIndex: 0, onFocus: () => setActivo(i), onBlur: () => setActivo(a => (a === i ? null : a)),
  onMouseEnter: () => setActivo(i), onMouseLeave: () => setActivo(a => (a === i ? null : a))
})

export function Dona({ datos, etiquetaTotal = 'total', unidad = 'autos' }) {
  const [activo, setActivo] = useState(null)
  const total = datos.reduce((s, d) => s + d.valor, 0)
  let acc = 0
  const con = datos.filter(d => d.valor > 0)
  return (
    <div className="dona-wrap">
      <svg viewBox="0 0 120 120" className="dona" role="group" aria-label={`Gráfico de dona: ${datos.map(d => `${d.nombre} ${d.valor}`).join(', ')}`}>
        <circle cx="60" cy="60" r="40" className="dona-fondo" fill="none" strokeWidth="16" />
        {datos.map((d, i) => {
          if (d.valor <= 0) return null
          const pct = (d.valor / total) * 100, ini = acc; acc += pct
          const largo = con.length > 1 ? Math.max(pct - 1.2, 0.5) : pct
          return (
            <g key={d.id || d.nombre} role="img" aria-label={`${d.nombre}: ${d.valor} ${d.valor === 1 ? unidad.replace(/s$/, '') : unidad}`} className={`seg serie-${i} ${activo === i ? 'on' : ''}`} {...manejadores(i, activo, setActivo)}>
              <circle cx="60" cy="60" r="40" fill="none" strokeWidth={activo === i ? 19 : 16} pathLength="100" strokeDasharray={`${largo} ${100 - largo}`} strokeDashoffset={-ini} transform="rotate(-90 60 60)" />
            </g>)
        })}
        <text x="60" y="60" textAnchor="middle" className="dona-num">{total}</text>
        <text x="60" y="76" textAnchor="middle" className="dona-et">{etiquetaTotal}</text>
        {activo !== null && datos[activo] && <Globo x={60} y={44} ancho={120} texto={`${datos[activo].nombre}: ${datos[activo].valor}`} />}
      </svg>
      <ul className="leyenda">{datos.map((d, i) => <li key={d.id || d.nombre} className={activo === i ? 'on' : ''} onMouseEnter={() => setActivo(i)} onMouseLeave={() => setActivo(null)}><span className={`cuadro serie-${i}`} aria-hidden="true" /><span>{d.nombre}</span><strong>{d.valor}</strong></li>)}</ul>
    </div>
  )
}

export function BarrasV({ datos, formato = v => String(v), unidad = '', alto = 190 }) {
  const [activo, setActivo] = useState(null)
  const W = 360, ml = 34, mb = 26, mt = 18, h = alto - mb - mt, max = redondeo(Math.max(...datos.map(d => d.valor), 0))
  const paso = (W - ml - 8) / datos.length, bw = Math.min(34, paso * 0.58)
  const ticks = [0, 1, 2, 3, 4].map(i => (max / 4) * i)
  return (
    <svg viewBox={`0 0 ${W} ${alto}`} className="grafico" role="group" aria-label={`Gráfico de barras: ${datos.map(d => `${d.etiqueta} ${formato(d.valor)}${unidad}`).join(', ')}`}>
      {ticks.map(t => { const y = mt + h - (t / max) * h; return <g key={t}><line x1={ml} x2={W - 4} y1={y} y2={y} className="rejilla-l" /><text x={ml - 6} y={y + 4} textAnchor="end" className="eje">{formato(Math.round(t * 10) / 10)}</text></g> })}
      {datos.map((d, i) => {
        const bh = (d.valor / max) * h, x = ml + paso * i + (paso - bw) / 2, y = mt + h - bh
        return (
          <g key={d.etiqueta + i} role="img" aria-label={`${d.etiqueta}: ${formato(d.valor)}${unidad}`} className={`col ${activo === i ? 'on' : ''}`} {...manejadores(i, activo, setActivo)}>
            <rect x={x - 4} y={mt} width={bw + 8} height={h} className="zona" />
            <rect x={x} y={bh > 0 ? y : mt + h - 2} width={bw} height={Math.max(bh, 2)} rx="6" className="barra-v serie-0" />
            <text x={x + bw / 2} y={mt + h + 17} textAnchor="middle" className="eje">{d.etiqueta}</text>
          </g>)
      })}
      {activo !== null && datos[activo] && (() => { const d = datos[activo], bh = (d.valor / max) * h; return <Globo x={ml + paso * activo + paso / 2} y={mt + h - bh} ancho={W} texto={`${d.etiqueta}: ${formato(d.valor)}${unidad}`} /> })()}
    </svg>
  )
}

export function Linea({ datos, formato = v => String(v), alto = 190 }) {
  const [activo, setActivo] = useState(null), gid = limpio(useId())
  const W = 360, ml = 44, mb = 26, mt = 18, h = alto - mb - mt, max = redondeo(Math.max(...datos.map(d => d.valor), 0))
  const paso = (W - ml - 14) / Math.max(datos.length - 1, 1)
  const pt = (d, i) => [ml + 6 + paso * i, mt + h - (d.valor / max) * h]
  const pts = datos.map(pt), ruta = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ')
  const area = `${ruta} L${pts[pts.length - 1][0].toFixed(1)} ${mt + h} L${pts[0][0].toFixed(1)} ${mt + h} Z`
  const ticks = [0, 1, 2, 3, 4].map(i => (max / 4) * i)
  return (
    <svg viewBox={`0 0 ${W} ${alto}`} className="grafico" role="group" aria-label={`Gráfico de línea: ${datos.map(d => `${d.etiqueta} ${formato(d.valor)}`).join(', ')}`}>
      <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0" className="grad-a" /><stop offset="1" className="grad-b" /></linearGradient></defs>
      {ticks.map(t => { const y = mt + h - (t / max) * h; return <g key={t}><line x1={ml} x2={W - 4} y1={y} y2={y} className="rejilla-l" /><text x={ml - 6} y={y + 4} textAnchor="end" className="eje">{formato(t)}</text></g> })}
      <path d={area} fill={`url(#${gid})`} className="area" />
      <path d={ruta} className="linea-p" fill="none" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" pathLength="1" />
      {datos.map((d, i) => (
        <g key={d.etiqueta + i} role="img" aria-label={`${d.etiqueta}: ${formato(d.valor)}`} className={`pto ${activo === i ? 'on' : ''}`} {...manejadores(i, activo, setActivo)}>
          <circle cx={pts[i][0]} cy={pts[i][1]} r="14" className="zona" />
          <circle cx={pts[i][0]} cy={pts[i][1]} r={activo === i ? 6 : 4.5} className="punto-l" />
          <text x={pts[i][0]} y={mt + h + 17} textAnchor="middle" className="eje">{d.etiqueta}</text>
        </g>))}
      {activo !== null && <Globo x={pts[activo][0]} y={pts[activo][1] - 4} ancho={W} texto={`${datos[activo].etiqueta}: ${formato(datos[activo].valor)}`} />}
    </svg>
  )
}

export function BarrasH({ datos, formato = v => String(v), unidad = '' }) {
  const [activo, setActivo] = useState(null)
  const W = 360, fila = 38, max = Math.max(...datos.map(d => d.valor), 1), alto = datos.length * fila + 4, bx = 8, bw = W - 60
  return (
    <svg viewBox={`0 0 ${W} ${alto}`} className="grafico h" role="group" aria-label={`Gráfico de barras horizontales: ${datos.map(d => `${d.nombre} ${formato(d.valor)}${unidad}`).join(', ')}`}>
      {datos.map((d, i) => { const y = i * fila + 2, w = Math.max((d.valor / max) * bw, 4)
        return (
          <g key={d.nombre} role="img" aria-label={`${d.nombre}: ${formato(d.valor)}${unidad}`} className={`fila-h ${activo === i ? 'on' : ''}`} {...manejadores(i, activo, setActivo)}>
            <rect x="0" y={y} width={W} height={fila - 2} className="zona" />
            <text x={bx} y={y + 13} className="eje-h">{d.nombre}</text>
            <rect x={bx} y={y + 19} width={bw} height="10" rx="5" className="pista" />
            <rect x={bx} y={y + 19} width={w} height="10" rx="5" className={`barra-h serie-${i % 6}`} />
            <text x={W - 4} y={y + 28} textAnchor="end" className="valor-h">{formato(d.valor)}</text>
          </g>)
      })}
      {activo !== null && <Globo x={W / 2} y={activo * fila + 20} ancho={W} texto={`${datos[activo].nombre}: ${formato(datos[activo].valor)}${unidad}`} />}
    </svg>
  )
}

// Cuadre de caja: barras hacia arriba (sobrante) o hacia abajo (faltante) alrededor de cero.
export function Cuadre({ datos, formato = v => String(v) }) {
  const [activo, setActivo] = useState(null)
  const W = 360, ml = 34, alto = 190, mt = 16, mb = 26, h = alto - mt - mb, mid = mt + h / 2
  const max = redondeo(Math.max(...datos.map(d => Math.abs(d.diferencia || 0)), 5)), paso = (W - ml - 8) / datos.length, bw = Math.min(30, paso * 0.55)
  const texto = d => d.diferencia === null ? `${d.etiqueta}: sin cerrar` : d.diferencia === 0 ? `${d.etiqueta}: cuadra` : `${d.etiqueta}: ${d.diferencia > 0 ? 'sobra' : 'falta'} ${formato(Math.abs(d.diferencia))}`
  return (
    <svg viewBox={`0 0 ${W} ${alto}`} className="grafico" role="group" aria-label={`Cuadre de caja: ${datos.map(texto).join(', ')}`}>
      {[max, 0, -max].map(t => { const y = mid - (t / max) * (h / 2); return <g key={t}><line x1={ml} x2={W - 4} y1={y} y2={y} className={t === 0 ? 'eje-cero' : 'rejilla-l'} /><text x={ml - 6} y={y + 4} textAnchor="end" className="eje">{formato(t)}</text></g> })}
      {datos.map((d, i) => {
        const x = ml + paso * i + (paso - bw) / 2, v = d.diferencia || 0, bh = Math.abs(v) / max * (h / 2)
        return (
          <g key={d.etiqueta + i} role="img" aria-label={texto(d)} className={`col ${activo === i ? 'on' : ''}`} {...manejadores(i, activo, setActivo)}>
            <rect x={x - 4} y={mt} width={bw + 8} height={h} className="zona" />
            {d.diferencia === null ? <circle cx={x + bw / 2} cy={mid} r="4" className="cu-nulo" /> : v === 0 ? <rect x={x} y={mid - 2} width={bw} height="4" rx="2" className="cu-ok" /> : <rect x={x} y={v > 0 ? mid - bh : mid} width={bw} height={Math.max(bh, 3)} rx="5" className={v > 0 ? 'cu-pos' : 'cu-neg'} />}
            <text x={x + bw / 2} y={mt + h + 17} textAnchor="middle" className="eje">{d.etiqueta}</text>
          </g>)
      })}
      {activo !== null && <Globo x={ml + paso * activo + paso / 2} y={mid - 8} ancho={W} texto={texto(datos[activo])} />}
    </svg>
  )
}
