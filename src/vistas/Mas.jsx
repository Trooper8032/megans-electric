import { useRef, useState } from 'react'
import { useApp } from '../components/contexto.js'
import { Campo, Chip, Tabla } from '../components/ui.jsx'
import { Icono } from '../components/Iconos.jsx'
import { config } from '../config/app.config.js'
import { NOMBRE_ROL, navPara } from '../lib/permisos.js'
import { descargar } from '../lib/descarga.js'
import { verificarGuia } from '../lib/verificacion.js'
import { dbCompleta, exportarRespaldo, restaurarRespaldo, restablecerDemo, repo } from '../data/index.js'
import { fechaISO, fechaHora, diasEntre } from '../lib/fechas.js'
import { MAX_RESPALDO_BYTES } from '../lib/respaldo.js'

export default function Mas() {
  const { vista: db, sesion, rol, can, ir, aviso, confirmar, salir, tema, setTema, recargar } = useApp()
  const [v, setV] = useState({ id: '', codigo: '' }), [res, setRes] = useState(null), [ocupado, setOcupado] = useState(false), arch = useRef(null)
  const otras = navPara(rol).filter(n => !['inicio', 'vender', 'ventas', 'caja', 'mas'].includes(n.ruta))
  const excel = async hoja => { try { const { bytesLibro, bytesHoja } = await import('../lib/excel.js'); const bd = await dbCompleta(sesion, 'exportar'); const bytes = hoja ? bytesHoja(bd, rol, hoja) : bytesLibro(bd, rol); descargar(bytes, `MEGANS-${hoja ? hoja.toLowerCase().replace(/ /g, '-') : 'todo'}-${fechaISO(new Date())}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); aviso('Excel descargado.') } catch (e) { aviso(e.message || 'No se pudo exportar.', 'error') } }
  const respaldar = async () => { try { const r = await exportarRespaldo(sesion); descargar(new TextEncoder().encode(JSON.stringify(r)), `Respaldo-MEGANS-${fechaISO(new Date())}.json`, 'application/json'); aviso('Respaldo descargado. Guárdalo en un lugar seguro.'); await recargar() } catch (e) { aviso(e.message || 'No se pudo crear el respaldo.', 'error') } }
  const importar = async e => {
    const f = e.target.files?.[0]; e.target.value = ''; if (!f) return
    if (f.size > MAX_RESPALDO_BYTES) return aviso('Ese archivo es demasiado grande para ser un respaldo.', 'error')
    try {
      const texto = await f.text()
      const c = await confirmar({ titulo: '¿Restaurar este respaldo?', texto: 'Reemplaza TODOS los datos actuales por los del archivo. Te recomendamos descargar un respaldo nuevo antes.', boton: 'Sí, restaurar', peligro: true }); if (!c.ok) return
      setOcupado(true); const r = await restaurarRespaldo(sesion, texto); aviso(`Respaldo restaurado: ${r.resumen.ventas} ventas y ${r.resumen.productos} productos.`); await recargar()
    } catch (er) { aviso(er.message || 'No se pudo restaurar.', 'error') }
    setOcupado(false)
  }
  const reset = async () => { const c = await confirmar({ titulo: '¿Restablecer la demostración?', texto: 'Se borran los cambios que hiciste y vuelven los datos de ejemplo. Esto solo existe en la demostración.', boton: 'Sí, restablecer', peligro: true }); if (!c.ok) return; setOcupado(true); try { await restablecerDemo(sesion); await recargar(); aviso('Demostración restablecida.') } catch (e) { aviso(e.message, 'error') } setOcupado(false) }
  const verificar = async e => { e.preventDefault(); setRes(verificarGuia(await dbCompleta(sesion), v.id, v.codigo)) }
  const uso = Math.round(repo.espacioUsado() / 1024)
  const ult = db.ultimoRespaldo, hace = ult ? diasEntre(ult.slice(0, 10), fechaISO(new Date())) : null
  return (
    <div className="pagina">
      <h1>Más opciones</h1><p className="sub">{sesion.nombre} · {NOMBRE_ROL[rol]}</p>
      {otras.length > 0 && <section className="tarjeta solo-celular" aria-label="Otras secciones"><h2>Otras secciones</h2><div className="acciones-col">{otras.map(n => <button key={n.ruta} type="button" className="btn suave grande" onClick={() => ir(n.ruta)}><Icono n={n.icono} />{n.texto}</button>)}</div></section>}
      {can('exportar') && <section className="tarjeta" aria-label="Exportar a Excel"><h2>Exportar a Excel</h2><p className="sub">Todo lo que ves en la aplicación, en archivos de Excel que puedes guardar o imprimir.</p>
        <div className="acciones-fila"><button type="button" className="btn" onClick={() => excel()}><Icono n="bajar" />Todo en un solo Excel</button>
          {['Ventas', 'Stock', 'Tiendas', 'Caja'].map(h => <button key={h} type="button" className="btn suave" onClick={() => excel(h)}>Solo {h.toLowerCase()}</button>)}</div></section>}
      {can('respaldar') && <section className="tarjeta" aria-label="Respaldo"><h2>Respaldo en un clic</h2>
        <p className="sub">{ult ? <>Último respaldo: {fechaHora(ult)} (hace {hace === 0 ? 'hoy' : hace + ' día(s)'}). </> : <><Chip tono="ambar" icono="alerta">Sin respaldo todavía</Chip> </>}Descarga una copia completa de tus datos en un archivo.</p>
        <div className="acciones-fila"><button type="button" className="btn" onClick={respaldar}><Icono n="copia" />Descargar respaldo ahora</button>
          <button type="button" className="btn suave" disabled={ocupado} onClick={() => arch.current?.click()}><Icono n="subir" />Restaurar desde un archivo</button><input ref={arch} type="file" accept="application/json,.json" className="solo-lectores" tabIndex={-1} aria-label="Elegir archivo de respaldo" onChange={importar} /></div></section>}
      <section className="tarjeta" aria-label="Verificar una guía"><h2>Verificar una guía de venta</h2><p className="sub">Escribe el número y el código que aparece junto al QR de la guía.</p>
        <form onSubmit={verificar} className="rejilla" noValidate><Campo etiqueta="Número de guía" id="vg-n"><input id="vg-n" value={v.id} placeholder="G001-000123" onChange={e => setV({ ...v, id: e.target.value })} /></Campo><Campo etiqueta="Código de verificación" id="vg-c"><input id="vg-c" value={v.codigo} placeholder="XXXX-XXXX-XXXX" onChange={e => setV({ ...v, codigo: e.target.value })} /></Campo>
          <div className="acciones-fila"><button type="submit" className="btn suave"><Icono n="escudo" />Verificar</button></div></form>
        {res && <p className={res.ok ? 'verde-t' : 'rojo-t'} role="status">{res.mensaje}</p>}</section>
      {can('verUsuarios') && <section className="tarjeta" aria-label="Usuarios"><h2>Usuarios y qué puede hacer cada uno</h2>
        <Tabla titulo="Usuarios y permisos" cabeceras={['Usuario', 'Nombre', 'Rol', 'Puede']}>
          {db.usuarios.map(u => <tr key={u.id}><td>{u.usuario}</td><td>{u.nombre}</td><td>{NOMBRE_ROL[u.rol]}</td><td>{{ admin: 'Todo: precios, anular, devolver, reabrir cajas, respaldos.', coadmin: 'Ve y edita (incluye costos y utilidad). No borra, no anula, no cambia precios.', vendedor: 'Solo vende, agrega a sus ventas del día y cierra su caja. No ve costos.' }[u.rol]}</td></tr>)}</Tabla></section>}
      <section className="tarjeta" aria-label="Apariencia y sesión"><h2>Apariencia y sesión</h2>
        <div className="acciones-fila"><button type="button" className="btn suave" onClick={() => setTema(tema === 'oscuro' ? 'claro' : 'oscuro')}><Icono n={tema === 'oscuro' ? 'sol' : 'luna'} />{tema === 'oscuro' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}</button><button type="button" className="btn suave" onClick={() => salir()}><Icono n="salir" />Cerrar sesión</button></div>
        <p className="ayuda">Por seguridad, la sesión se cierra sola tras {config.vencimientoSesionMin} minutos sin usar.</p></section>
      {can('restablecerDemo') && <section className="tarjeta" aria-label="Demostración"><h2>Demostración</h2><p className="sub">Datos de ejemplo guardados solo en este navegador (usando unos {uso} KB de los ~5 MB disponibles).</p>
        <div className="acciones-fila"><button type="button" className="btn peligro" disabled={ocupado} onClick={reset}>Restablecer datos de demostración</button></div></section>}
    </div>)
}
