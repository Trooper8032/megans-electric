// Qué motor de voz usar. 'auto' (recomendado): el dictado propio del celular si existe (iPhone/Android: rápido y
// preciso, usa el servicio de voz de Apple/Google); si no, Whisper base en el equipo.
// 'rapida' = Whisper base (78 MB, en el equipo). 'precisa' = Whisper small (235 MB, en el equipo, más lento).
import { config } from '../config/app.config.js'
const K = `${config.clave}:motor-voz`
export const MOTORES = [
  ['auto', 'Automático (recomendado)', 'Usa el dictado del celular si está disponible; si no, la voz rápida.'],
  ['rapida', 'Rápida, en el equipo', 'Whisper base · descarga 78 MB la 1.ª vez · funciona sin internet.'],
  ['precisa', 'Precisa, en el equipo', 'Whisper small · descarga 235 MB la 1.ª vez · más lenta (puede tardar 10 s o más en celulares).']
]
export const motorVoz = () => { try { const v = localStorage.getItem(K); return MOTORES.some(m => m[0] === v) ? v : 'auto' } catch { return 'auto' } }
export const ponerMotorVoz = v => { try { localStorage.setItem(K, v) } catch { /* nada */ } }
export const ReconocimientoNativo = () => (typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)) || null
export const usaNativo = () => motorVoz() === 'auto' && !!ReconocimientoNativo()
