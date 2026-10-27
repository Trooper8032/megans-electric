import { useState } from 'react'
import { Campo } from '../components/ui.jsx'
import { Icono } from '../components/Iconos.jsx'
import { config } from '../config/app.config.js'

export default function Acceso({ onEntrar, mensaje }) {
  const [u, setU] = useState(''), [c, setC] = useState(''), [ver, setVer] = useState(false), [err, setErr] = useState(mensaje || ''), [cargando, setCargando] = useState(false)
  const enviar = async e => {
    e.preventDefault(); setErr('')
    if (!u.trim() || !c) return setErr('Escribe tu usuario y tu contraseña.')
    setCargando(true)
    try { const r = await onEntrar(u, c); if (!r.ok) setErr(r.error) } catch (ex) { console.error('login', ex); setErr('No se pudo ingresar. Vuelve a intentarlo.') }
    setCargando(false)
  }
  return (
    <div className="acceso">
      <main className="acceso-card" id="principal">
        <img className="logo-acceso" src={import.meta.env.BASE_URL + "img/logo-640.png"} alt={config.nombre} width="280" height="95" />
        <h1>Ingresa a tu tienda</h1>
        <p className="sub">Ventas, stock y caja claros, en un solo lugar.</p>
        <form onSubmit={enviar} noValidate>
          <Campo etiqueta="Usuario" id="usr"><input id="usr" autoComplete="username" autoCapitalize="none" value={u} onChange={e => setU(e.target.value)} /></Campo>
          <Campo etiqueta="Contraseña" id="pwd">
            <input id="pwd" type={ver ? 'text' : 'password'} autoComplete="current-password" value={c} onChange={e => setC(e.target.value)} />
          </Campo>
          <label className="check-fila"><input type="checkbox" checked={ver} onChange={e => setVer(e.target.checked)} /> Mostrar contraseña</label>
          {err && <p className="error" role="alert">{err}</p>}
          <button className="btn grande" type="submit" disabled={cargando}><Icono n="candado" />{cargando ? 'Entrando…' : 'Entrar'}</button>
        </form>
        <details className="demo-ayuda"><summary>Accesos de demostración</summary>
          <table><caption className="solo-lectores">Usuarios de demostración</caption><thead><tr><th scope="col">Usuario</th><th scope="col">Contraseña</th><th scope="col">Rol</th></tr></thead>
            <tbody><tr><td>admin</td><td>admin</td><td>Administradora</td></tr><tr><td>coadmin</td><td>coadmin</td><td>Co-administrador</td></tr><tr><td>vendedor1</td><td>vendedor1</td><td>Vendedor</td></tr><tr><td>vendedor2</td><td>vendedor2</td><td>Vendedor</td></tr></tbody></table>
          <p>Los datos de esta demostración son de ejemplo y se guardan solo en este navegador.</p></details>
        <footer className="pie"><span>{config.nombre}</span><span className="credito">{config.credito}</span></footer>
      </main>
    </div>
  )
}
