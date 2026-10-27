import { useState } from 'react'
import { useApp } from '../components/contexto.js'
import { Campo, Chip, Tabla } from '../components/ui.jsx'
import { Icono } from '../components/Iconos.jsx'
import { cuadernoDelDia, reporteCuadre } from '../lib/cuaderno.js'
import { soles } from '../lib/dinero.js'
import { fechaISO, sumarDias, fechaLarga, fechaCorta } from '../lib/fechas.js'
import { descargar } from '../lib/descarga.js'

export default function Cuaderno() {
  const { vista: db, aviso } = useApp(), hoy = fechaISO(new Date()), [fecha, setFecha] = useState(hoy)
  const c = cuadernoDelDia(db, fecha), rc = reporteCuadre(db, fecha, 7)
  const pdf = async () => { try { const [{ pdfCuaderno, bytesPdf }, { logoDataUrl }] = await Promise.all([import('../lib/pdf.js'), import('../lib/logo.js')]); descargar(bytesPdf(await pdfCuaderno(c, { logo: await logoDataUrl() })), `Cuaderno-${fecha}.pdf`, 'application/pdf'); aviso('Cuaderno en PDF descargado.') } catch { aviso('No se pudo crear el PDF.', 'error') } }
  return (
    <div className="pagina ancha">
      <h1>Cuaderno del día (modo paralelo)</h1>
      <p className="sub">Para quien sigue escribiendo en su cuaderno: aquí ves el día igual que en una hoja, lo imprimes y comparas a mano con lo que anotaste.</p>
      <section className="tarjeta no-imprimir"><div className="rejilla"><Campo etiqueta="Día" id="cu-d"><input id="cu-d" type="date" max={hoy} value={fecha} onChange={e => e.target.value && setFecha(e.target.value)} /></Campo>
        <div className="acciones-fila"><button type="button" className="btn suave chico" onClick={() => setFecha(sumarDias(fecha, -1))}>Día anterior</button><button type="button" className="btn suave chico" disabled={fecha >= hoy} onClick={() => setFecha(sumarDias(fecha, 1))}>Día siguiente</button></div></div>
        <div className="acciones-fila"><button type="button" className="btn" onClick={() => window.print()}><Icono n="imprimir" />Imprimir cuaderno</button><button type="button" className="btn suave" onClick={pdf}><Icono n="bajar" />Descargar en PDF</button></div>
        <details className="demo-ayuda"><summary>¿Cómo comparo con mi cuaderno?</summary><ol><li>Imprime este cuaderno al terminar el día.</li><li>Pon tu cuaderno al lado y marca cada venta que coincide.</li><li>Compara los totales por Efectivo, Yape y Plin de abajo.</li><li>Si algo no coincide, mira la guía de esa venta: ahí está quién la hizo y a qué hora.</li></ol></details></section>
      <article className="cuaderno" aria-label={`Cuaderno del ${fechaLarga(fecha)}`}>
        <h2>MEGANS ELECTRIC · {fechaLarga(fecha)}</h2>
        {!c.filas.length ? <p>No hubo ventas este día.</p> : <Tabla titulo="Ventas del día" cabeceras={['Hora', 'N.º', 'Cliente', 'Detalle', 'Pago', { t: 'Total', der: true }]}>
          {c.filas.map(f => <tr key={f.id} className={f.estado !== 'Activa' ? 'anulada' : ''}><td>{f.hora}</td><td>{f.id.slice(-6)}</td><td>{f.cliente}<br /><small>{f.vendedor}</small></td><td>{f.detalle}{f.agregados && <small> (se agregaron productos)</small>}</td><td>{f.medio}</td><td className="der">{f.estado === 'Activa' ? soles(f.total) : <span className="rojo-t">ANULADA</span>}</td></tr>)}</Tabla>}
        <h3 className="sub-t">Resumen del día</h3>
        <Tabla titulo="Resumen por medio de pago" cabeceras={['Concepto', { t: 'Monto', der: true }]}>
          <tr><td><strong>Total vendido</strong></td><td className="der"><strong>{soles(c.totalDia)}</strong></td></tr>
          {Object.entries(c.porMedio).map(([m, v]) => <tr key={m}><td>{m === 'Pendiente' ? 'Pendiente por cobrar' : m}</td><td className="der">{soles(v)}</td></tr>)}
          <tr><td>Devoluciones del día</td><td className="der">{soles(c.caja.devoluciones)}</td></tr>
        </Tabla>
        <h3 className="sub-t">Caja del día: esperado y contado</h3>
        <Tabla titulo="Caja esperada y contada" cabeceras={['Medio', { t: 'Esperado', der: true }, { t: 'Contado', der: true }, { t: 'Diferencia', der: true }]}>
          {Object.entries(c.caja.esperado).map(([m, v]) => { const d = c.cierre?.diferencia?.[m]; return <tr key={m}><td>{m}</td><td className="der">{soles(v)}</td><td className="der">{c.cierre?.contado ? soles(c.cierre.contado[m]) : '—'}</td><td className={`der ${d ? 'rojo-t' : ''}`}>{c.cierre?.contado ? (d ? soles(d) : 'Cuadra') : 'Sin cerrar'}</td></tr> })}</Tabla>
      </article>
      <section className="tarjeta" aria-label="Reporte de cuadre"><h2>Reporte de cuadre (7 días hasta {fechaCorta(fecha)})</h2>
        <Tabla titulo="Reporte de cuadre de caja" cabeceras={['Día', { t: 'Esperado', der: true }, { t: 'Contado', der: true }, { t: 'Diferencia', der: true }, 'Estado']}>
          {rc.map(f => <tr key={f.fecha} className={f.diferencia ? 'fila-rojo' : ''}><td>{f.etiqueta}</td><td className="der">{soles(f.esperado)}</td><td className="der">{f.contado === null ? '—' : soles(f.contado)}</td><td className={`der ${f.diferencia ? 'dif-rojo' : ''}`}>{f.diferencia === null ? '—' : f.diferencia === 0 ? 'Cuadra' : soles(f.diferencia)}</td><td>{f.estado === 'Cerrada' ? <Chip tono="verde">Cerrada</Chip> : <Chip tono="ambar">{f.estado}</Chip>}</td></tr>)}</Tabla></section>
    </div>)
}
