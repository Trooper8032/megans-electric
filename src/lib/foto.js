// Comprime una foto en el navegador (como el Apps Script): JPEG, lado mayor 900 px, calidad que baja hasta entrar en el límite.
import { FOTO_MAX } from './dominio.js'
export function comprimirFoto(file, { max = 900, limite = FOTO_MAX } = {}) {
  return new Promise((resolve, reject) => {
    if (!file || !String(file.type || '').startsWith('image/')) return reject(new Error('Elige una foto (imagen).'))
    if (file.size > 25 * 1024 * 1024) return reject(new Error('La foto es demasiado grande. Prueba con otra.'))
    const url = URL.createObjectURL(file), img = new Image()
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer la foto.')) }
    img.onload = () => {
      URL.revokeObjectURL(url)
      let lado = max, q = 0.72, dato = ''
      for (let intento = 0; intento < 8; intento++) {
        const sc = Math.min(1, lado / Math.max(img.width || 1, img.height || 1)), w = Math.max(1, Math.round(img.width * sc)), h = Math.max(1, Math.round(img.height * sc))
        const c = document.createElement('canvas'); c.width = w; c.height = h
        const ctx = c.getContext('2d'); ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h); ctx.drawImage(img, 0, 0, w, h)
        dato = c.toDataURL('image/jpeg', q)
        if (dato.length <= limite) return resolve(dato)
        if (q > 0.45) q = Math.round((q - 0.1) * 100) / 100; else lado = Math.round(lado * 0.8)
      }
      reject(new Error('La foto pesa demasiado aun comprimida. Prueba con otra.'))
    }
    img.src = url
  })
}
