import { useMemo } from 'react'
import { useApp } from '../components/contexto.js'
import { Icono } from '../components/Iconos.jsx'
import { Kpi, Chip, Vacio } from '../components/ui.jsx'
import { TarjetaGrafico, BarrasV, BarrasH, Linea, Cuadre } from '../components/Graficos.jsx'
import { soles, numero } from '../lib/dinero.js'
import { fechaISO, fechaLarga } from '../lib/fechas.js'
import { alertas, ventasPorDia, ventasPorMes, ranking, deudasTiendas, cuadreCaja, stockBajoLista, resumenDia } from '../lib/metricas.js'
import { calcularCaja, cajaBloqueada } from '../lib/dominio.js'

const corto = v => Math.abs(v) >= 1000 ? `${Math.round(v / 100) / 10}k` : String(Math.round(v * 10) / 10)
export default function Inicio() {
  const { vista: db, sesion, rol, ir, can } = useApp()
  const hoy = fechaISO(new Date())
  if (rol === 'vendedor') return <InicioVendedor db={db} sesion={sesion} hoy={hoy} ir={ir} />
  const d = useMemo(() => ({
    res: resumenDia(db, hoy), dias: ventasPorDia(db, hoy, 14), meses: ventasPorMes(db, hoy, 4), rank: ranking(db, hoy, 30, 8), deudas: deudasTiendas(db), cuadre: cuadreCaja(db, hoy, 7), bajos: stockBajoLista(db), al: alertas(db, hoy), caja: calcularCaja(db, hoy, null)
  }), [db, hoy])
  const deudaTotal = d.deudas.reduce((s, x) => s + x.deuda, 0)
  return (
    <div className="pagina ancha">
      <h1>Hola, {sesion.nombre}</h1>
      <p className="sub">{fechaLarga(hoy)}. Así va tu negocio hoy.</p>
      <NuevaVentaHero ir={ir} bloqueada={cajaBloqueada(db, hoy, sesion.id)} />
      {d.al.length > 0 && <ul className="alertas" aria-label="Alertas">{d.al.map((a, i) => <li key={i} className={`alerta ${a.tono}`}><Icono n="alerta" />{a.texto}<button type="button" className="btn suave chico" onClick={() => ir(a.ruta)}>Ver</button></li>)}</ul>}
      <div className="kpis">
        <Kpi icono="billete" etiqueta="Vendido hoy" valor={soles(d.res.total)} sub={`${d.res.cantidad} venta(s)`} />
        {can('verUtilidad') && <Kpi icono="grafico" etiqueta="Utilidad de hoy" valor={soles(d.res.utilidad)} sub="Precio menos costo" />}
        <Kpi icono="caja" etiqueta="Stock bajo" valor={numero(d.bajos.length)} tono={d.bajos.length ? 'rojo' : ''} sub="productos por reponer" />
        <Kpi icono="tienda" etiqueta="Deben las tiendas" valor={soles(deudaTotal)} tono={deudaTotal > 0 ? 'ambar' : ''} sub={`${d.deudas.length} tiendas externas`} />
      </div>
      <div className="acciones-fila no-imprimir">
        <button type="button" className="btn suave" onClick={() => ir('ventas')}><Icono n="archivo" />Ventas del día</button>
        <button type="button" className="btn suave" onClick={() => ir('caja')}><Icono n="billete" />Caja de hoy</button>
      </div>
      <h2 className="sub-t">Gráficos</h2>
      <div className="rejilla-graf">
        <TarjetaGrafico titulo="Ventas por día" sub="Últimos 14 días (número de día), en soles" cabeceras={['Día', 'Vendido']} filas={d.dias.map(x => [x.etiqueta, soles(x.valor)])}><BarrasV datos={d.dias.map(x => ({ etiqueta: x.fecha.slice(8), valor: x.valor }))} formato={corto} /></TarjetaGrafico>
        <TarjetaGrafico titulo="Ventas por mes" sub="Últimos 4 meses, en soles" cabeceras={['Mes', 'Ventas', 'Vendido']} filas={d.meses.map(x => [x.etiqueta, x.ventas, soles(x.valor)])}><BarrasV datos={d.meses.map(x => ({ etiqueta: x.etiqueta, valor: x.valor }))} formato={corto} /></TarjetaGrafico>
        {can('verUtilidad') && <TarjetaGrafico titulo="Utilidad por mes" sub="Lo que queda después de los costos" cabeceras={['Mes', 'Utilidad']} filas={d.meses.map(x => [x.etiqueta, soles(x.utilidad)])}><Linea datos={d.meses.map(x => ({ etiqueta: x.etiqueta, valor: x.utilidad }))} formato={corto} /></TarjetaGrafico>}
        <TarjetaGrafico titulo="Productos más vendidos" sub="Unidades en los últimos 30 días" cabeceras={['Producto', 'Unidades', 'Monto']} filas={d.rank.map(x => [x.nombre, x.unidades, soles(x.monto)])}><BarrasH datos={d.rank.map(x => ({ nombre: x.nombre, valor: x.unidades }))} unidad=" und" /></TarjetaGrafico>
        <TarjetaGrafico titulo="Stock bajo" sub="Productos en o bajo su mínimo (los más urgentes)" cabeceras={['Producto', 'Stock', 'Mínimo']} filas={d.bajos.map(x => [x.nombre, x.stock, x.minimo])}>
          {d.bajos.length ? <BarrasH datos={d.bajos.slice(0, 7).map(x => ({ nombre: `${x.nombre} (mín. ${x.minimo})`, valor: x.stock }))} unidad=" und" /> : <Vacio icono="check" titulo="Todo en orden" texto="Ningún producto está bajo su mínimo." />}</TarjetaGrafico>
        <TarjetaGrafico titulo="Cuadre de caja" sub="Diferencia de cada cierre de los últimos 7 días (S/)" cabeceras={['Día', 'Diferencia']} filas={d.cuadre.map(x => [x.etiqueta, x.diferencia === null ? 'Sin cerrar' : x.diferencia === 0 ? 'Cuadra' : soles(x.diferencia)])}><Cuadre datos={d.cuadre} formato={corto} /></TarjetaGrafico>
        <TarjetaGrafico titulo="Deuda de las tiendas" sub="Enviado menos pagado y devuelto" cabeceras={['Tienda', 'Enviado', 'Pagado', 'Devuelto', 'Deuda']} filas={d.deudas.map(x => [x.nombre, soles(x.enviado), soles(x.pagado), soles(x.devuelto), soles(x.deuda)])}><BarrasH datos={d.deudas.map(x => ({ nombre: x.nombre.replace(' (ejemplo)', ''), valor: x.deuda }))} formato={v => 'S/ ' + Math.round(v)} /></TarjetaGrafico>
      </div>
    </div>
  )
}
function InicioVendedor({ db, sesion, hoy, ir }) {
  const mias = db.ventas.filter(v => v.fecha === hoy).sort((a, b) => b.numero - a.numero), res = resumenDia(db, hoy, sesion.id), caja = calcularCaja(db, hoy, sesion.id)
  const cerrada = db.cierres.find(c => c.fecha === hoy && c.vendedorId === sesion.id && c.estado === 'Cerrada')
  return (
    <div className="pagina">
      <h1>Hola, {sesion.nombre}</h1>
      <p className="sub">{fechaLarga(hoy)}</p>
      <NuevaVentaHero ir={ir} bloqueada={cajaBloqueada(db, hoy, sesion.id)} />
      <div className="kpis"><Kpi icono="billete" etiqueta="Vendiste hoy" valor={soles(res.total)} sub={`${res.cantidad} venta(s)`} /><Kpi icono="reloj" etiqueta="Pendientes por cobrar" valor={soles(caja.pendientes.monto)} tono={caja.pendientes.cantidad ? 'ambar' : ''} sub={`${caja.pendientes.cantidad} venta(s)`} /></div>
      <div className="acciones-col">
        <button type="button" className="btn suave grande" onClick={() => ir('ventas')}><Icono n="archivo" />Mis ventas de hoy</button>
        <button type="button" className="btn suave grande" onClick={() => ir('caja')}><Icono n="billete" />{cerrada ? 'Mi caja (cerrada)' : 'Cerrar mi caja'}</button>
      </div>
      {cerrada && <p className="sub-t"><Chip tono="verde" icono="candado">Tu caja de hoy ya está cerrada</Chip></p>}
      <h2 className="sub-t">Últimas ventas de hoy</h2>
      {!mias.length ? <Vacio icono="carrito" titulo="Todavía no vendiste hoy" texto="Toca “Nueva venta” para empezar." /> :
        <ul className="lista">{mias.slice(0, 5).map(v => <li key={v.id}><button type="button" className="fila-tarjeta" onClick={() => ir('ventas', v.id)}><span className="datos"><strong>{v.cliente}</strong><small>{v.id} · {v.hora} · {v.medio}</small></span>{v.estado !== 'Activa' && <Chip tono="rojo">Anulada</Chip>}<span className="monto">{soles(v.total)}</span></button></li>)}</ul>}
    </div>
  )
}

// Acceso directo y destacado a vender: igual para administradora, co-administrador y vendedores.
function NuevaVentaHero({ ir, bloqueada }) {
  return (
    <div className="venta-hero no-imprimir">
      <button type="button" className="btn venta-hero-btn" onClick={() => ir('vender')} disabled={bloqueada}>
        <span className="vh-ico"><Icono n="carrito" tam={34} /></span>
        <span className="vh-txt"><strong>Nueva venta</strong><small>{bloqueada ? 'Tu caja de hoy está cerrada' : 'Producto, cantidad y Cobrar: 3 toques'}</small></span>
        <Icono n="flecha" tam={26} />
      </button>
    </div>)
}
