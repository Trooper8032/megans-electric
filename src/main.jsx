import { Component } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './styles.css'
class Errores extends Component {
  state = { error: null }
  static getDerivedStateFromError(error) { return { error } }
  render() {
    if (!this.state.error) return this.props.children
    return <div className="acceso"><div className="acceso-card"><h1>Algo salió mal</h1><p className="sub">No se perdió ningún dato. Vuelve a cargar la página; si sigue igual, avisa a quien te dio la aplicación.</p><button type="button" className="btn grande" onClick={() => location.reload()}>Volver a cargar</button></div></div>
  }
}
createRoot(document.getElementById('root')).render(<Errores><App /></Errores>)
if ('serviceWorker' in navigator && location.protocol !== 'file:' && import.meta.env.PROD) navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js', { scope: import.meta.env.BASE_URL }).catch(() => {})
