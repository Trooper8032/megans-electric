// Crea una imagen PGM 640×480 con el código Code128 dado (para la cámara falsa de Chrome en las pruebas E2E).
import { writeFileSync } from 'node:fs'
import { codificar } from '../src/lib/codigoBarras.js'
const [codigo, salida] = process.argv.slice(2)
const mod = codificar(codigo, 10), esc = Math.max(2, Math.floor(600 / mod.length)), W = 640, H = 480
const px = Buffer.alloc(W * H, 235), x0 = Math.floor((W - mod.length * esc) / 2)
for (let y = 140; y < 340; y++) for (let i = 0; i < mod.length; i++) if (mod[i] === '1') for (let k = 0; k < esc; k++) px[y * W + x0 + i * esc + k] = 25
writeFileSync(salida, Buffer.concat([Buffer.from(`P5\n${W} ${H}\n255\n`), px]))
