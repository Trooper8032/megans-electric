import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Ctx } from './components/contexto.js'
import { Icono } from './components/Iconos.jsx'
import { Marca, Pie, Confirmar } from './components/ui.jsx'
import { config } from './config/app.config.js'
import { repo, ejecutar, leer, autenticar, CLAVE_SESION } from './data/index.js'
import { ErrorApp } from './lib/dominio.js'
import { leerSesion, borrarSesion, guardarSesion, tocar, vencida, MENSAJE_VENCIDA } from './lib/sesion.js'
import { NOMBRE_ROL, navPara, puede, resolverRuta, hashDe } from './lib/permisos.js'
import Acceso from './vistas/Acceso.jsx'
import Inicio from './vistas/Inicio.jsx'
import Vender from './vistas/Vender.jsx'
import Ventas from './vistas/Ventas.jsx'
import Inventario from './vistas/Inventario.jsx'
import Tiendas from './vistas/Tiendas.jsx'
import Caja from './vistas/Caja.jsx'
import Cuaderno from './vistas/Cuaderno.jsx'
import Mas from './vistas/Mas.jsx'
import Conciliacion from './vistas/Conciliacion.jsx'
import Etiquetas from './vistas/Etiquetas.jsx'
import { MisEnvios } from './vistas/Tiendas.jsx'
import Asistente from './components/Asistente.jsx'

const CLAVE_TEMA = `${config.clave}:tema`
const MOVIL = ['inicio', 'ventas', 'vender', 'caja', 'mas']
const PANTALLAS = { inicio: Inicio, vender: Vender, ventas: Ventas, inventario: Inventario, tiendas: Tiendas, caja: Caja, cuaderno: Cuaderno, conciliacion: Conciliacion, etiquetas: Etiquetas, misenvios: MisEnvios, mas: Mas }

export default function App() {
  const [listo, setListo] = useState(false), [sesion, setSesion] = useState(null), [vista, setVista] = useState(null)
  const [hash, setHash] = useState(location.hash), [avisos, setAvisos] = useState([]), [conf, setConf] = useState(null), [aviso0, setAviso0] = useState('')
  const [asis, setAsis] = useState(false)
  const [tema, setTemaE] = useState(() => { try { return localStorage.getItem(CLAVE_TEMA) || '' } catch { return '' } })
  const ultimoToque = useRef(0)
  const setTema = t => { setTemaE(t); try { localStorage.setItem(CLAVE_TEMA, t) } catch { /* nada */ } }
  useEffect(() => { const r = document.documentElement; if (tema) r.setAttribute('data-tema', tema); else r.removeAttribute('data-tema') }, [tema])
  const temaActual = tema || (matchMedia('(prefers-color-scheme: dark)').matches ? 'oscuro' : 'claro')

  const aviso = useCallback((texto, tipo = 'ok') => { const id = Math.random(); setAvisos(a => [...a, { id, texto, tipo }]); setTimeout(() => setAvisos(a => a.filter(x => x.id !== id)), tipo === 'error' ? 6500 : 3500) }, [])
  const confirmar = useCallback(datos => new Promise(res => setConf({ datos, res })), [])
  const resolver = r => { conf.res(r); setConf(null) }

  const salir = useCallback((mensaje = '') => { borrarSesion(localStorage, CLAVE_SESION); setSesion(null); setVista(null); setAviso0(mensaje); location.hash = '' }, [])
  // arranque: base de datos + sesión guardada
  useEffect(() => {
    (async () => {
      try {
        await repo.cargar()
        const { sesion: s, motivo } = leerSesion(localStorage, CLAVE_SESION)
        if (s) { try { setVista(await leer(s)); setSesion(s) } catch { borrarSesion(localStorage, CLAVE_SESION) } } else if (motivo === 'vencida') setAviso0(MENSAJE_VENCIDA)
      } catch (e) { setAviso0(e.message || 'No se pudo preparar la aplicación.') }
      setListo(true)
    })()
  }, [])
  useEffect(() => { const f = () => setHash(location.hash); addEventListener('hashchange', f); return () => removeEventListener('hashchange', f) }, [])
  // vencimiento por inactividad
  useEffect(() => {
    if (!sesion) return
    const actividad = () => { const t = Date.now(); if (t - ultimoToque.current > 5000) { ultimoToque.current = t; setSesion(s => { if (!s) return s; const n = tocar(s, t); guardarSesion(localStorage, CLAVE_SESION, n); return n }) } }
    const ev = ['pointerdown', 'keydown']; ev.forEach(e => addEventListener(e, actividad))
    const iv = setInterval(() => { const { sesion: s } = leerSesion(localStorage, CLAVE_SESION, Date.now(), config.vencimientoSesionMin * 60000); if (!s) salir(MENSAJE_VENCIDA) }, 15000)
    return () => { ev.forEach(e => removeEventListener(e, actividad)); clearInterval(iv) }
  }, [!!sesion]) // eslint-disable-line

  const run = useCallback(async (fn, ...args) => {
    try { const r = await ejecutar(fn, sesion, ...args); setVista(r.vista); return r } catch (e) {
      aviso(e instanceof ErrorApp || e?.name === 'ErrorApp' ? e.message : 'Ocurrió un problema inesperado. Tus datos no se perdieron; inténtalo otra vez.', 'error')
      if (/sesión no es válida/.test(e?.message || '')) salir('Tu sesión ya no es válida. Ingresa de nuevo.')
      return null
    }
  }, [sesion, aviso, salir])
  const recargar = useCallback(async () => { setVista(await leer(sesion)) }, [sesion])
  // Ventas asignadas por la administradora: aparecen al instante en la app del vendedor (storage + sondeo; Realtime en Supabase).
  const vistos = useRef(null)
  useEffect(() => {
    if (!sesion || !repo.suscribir) return
    vistos.current = null
    return repo.suscribir(async () => {
      try {
        const v = await leer(sesion); setVista(v)
        const nuevas = v.ventas.filter(x => x.vendedorId === sesion.id && x.registradoPor && x.registradoPor !== sesion.id && !(vistos.current || new Set()).has(x.id))
        if (vistos.current && nuevas.length) aviso(`Nueva venta asignada: ${nuevas.map(x => `${x.id} (${x.cliente})`).join(', ')}.`)
        vistos.current = new Set(v.ventas.map(x => x.id))
      } catch { /* sesión ya no válida: el control de sesión se encarga */ }
    })
  }, [sesion?.id]) // eslint-disable-line
  useEffect(() => { if (vista && sesion && !vistos.current) vistos.current = new Set(vista.ventas.map(x => x.id)) }, [vista, sesion])
  const entrar = async (u, c) => { const r = await autenticar(u, c); if (r.ok) { setAviso0(''); setSesion(r.sesion); setVista(await leer(r.sesion)); location.hash = '#/inicio' } return r }
  const ir = useCallback((ruta, id) => { location.hash = hashDe(ruta, id) }, [])

  const rol = sesion?.rol
  const ruta = useMemo(() => sesion ? resolverRuta(sesion, hash) : { permitido: false }, [sesion, hash])
  useEffect(() => { if (sesion && !ruta.permitido && ruta.destino) { aviso(ruta.mensaje, 'error'); location.hash = hashDe(ruta.destino) } }, [ruta, sesion, aviso])
  useEffect(() => { if (sesion) { const t = document.getElementById('principal'); t?.focus?.({ preventScroll: true }); window.scrollTo(0, 0) } }, [ruta.ruta, ruta.id, !!sesion]) // eslint-disable-line

  const ctx = useMemo(() => ({ sesion, vista, rol, run, recargar, aviso, confirmar, ir, salir, tema: temaActual, setTema, can: a => puede(rol, a), hoy: new Date() }), [sesion, vista, rol, run, recargar, aviso, confirmar, ir, salir, temaActual]) // eslint-disable-line

  if (!listo) return <div className="cargando" role="status">Preparando la aplicación…</div>
  const zonaAvisos = <div className="toast-zona" role="status" aria-live="polite">{avisos.map(a => <div key={a.id} className={`toast ${a.tipo === 'error' ? 'error' : ''}`} role={a.tipo === 'error' ? 'alert' : undefined}>{a.texto}</div>)}</div>
  if (!sesion || !vista) return <Ctx.Provider value={ctx}><Acceso onEntrar={entrar} mensaje={aviso0} />{zonaAvisos}</Ctx.Provider>
  if (!ruta.permitido && !ruta.ruta) return <div className="cargando" role="status">Cargando…</div>
  const Pantalla = PANTALLAS[ruta.ruta] || Inicio
  const navs = navPara(rol), movil = MOVIL.map(r => navs.find(n => n.ruta === r)).filter(Boolean)
  const BotonNav = ({ n }) => <button type="button" className={`${ruta.ruta === n.ruta ? 'on' : ''} ${n.destacado ? 'destacado' : ''}`} aria-current={ruta.ruta === n.ruta ? 'page' : undefined} onClick={() => ir(n.ruta)}><Icono n={n.icono} />{n.texto}</button>
  return (
    <Ctx.Provider value={ctx}>
      <div className="app">
        <a className="salto" href="#principal" onClick={e => { e.preventDefault(); document.getElementById('principal')?.focus() }}>Saltar al contenido</a>
        <header className="cab"><Marca pequena /><div className="cab-acc"><button type="button" className="icono-btn voz-btn" aria-label="Asistente de voz" onClick={() => setAsis(true)}><Icono n="microfono" /></button><button type="button" className="icono-btn" aria-label={temaActual === 'oscuro' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'} onClick={() => setTema(temaActual === 'oscuro' ? 'claro' : 'oscuro')}><Icono n={temaActual === 'oscuro' ? 'sol' : 'luna'} /></button><button type="button" className="icono-btn" aria-label="Cerrar sesión" onClick={() => salir()}><Icono n="salir" /></button></div></header>
        <aside className="lateral"><Marca /><button type="button" className="btn asis-lat" onClick={() => setAsis(true)}><Icono n="microfono" />Asistente de voz</button><nav aria-label="Secciones principales">{navs.map(n => <BotonNav key={n.ruta} n={n} />)}</nav>
          <div className="yo"><p>{sesion.nombre}<small>{NOMBRE_ROL[rol]}</small></p>
            <button type="button" className="btn suave chico" onClick={() => setTema(temaActual === 'oscuro' ? 'claro' : 'oscuro')}><Icono n={temaActual === 'oscuro' ? 'sol' : 'luna'} />{temaActual === 'oscuro' ? 'Modo claro' : 'Modo oscuro'}</button>
            <button type="button" className="btn suave chico" onClick={() => salir()}><Icono n="salir" />Cerrar sesión</button></div></aside>
        <main id="principal" tabIndex="-1"><Pantalla id={ruta.id} /></main>
        <nav className="nav-mov" aria-label="Secciones principales (celular)">{movil.map(n => <BotonNav key={n.ruta} n={n} />)}</nav>
        <Pie />
      </div>
      {asis && <Asistente onCerrar={() => setAsis(false)} />}
      {conf && <Confirmar datos={conf.datos} onResolver={resolver} />}
      {zonaAvisos}
    </Ctx.Provider>
  )
}
