import { crearDemo } from '../src/data/seed.js'
export const AHORA = new Date(2026, 9, 18, 15, 0, 0)
let memo = null
export async function demo() { if (!memo) memo = await crearDemo(AHORA); return structuredClone(memo) }
export const S = { admin: { id: 'U-ADM' }, coadmin: { id: 'U-COA' }, v1: { id: 'U-V01' }, v2: { id: 'U-V02' } }
export const quien = (fn) => { try { fn(); return null } catch (e) { return e.message } }
export const prodConStock = (db, min = 5) => db.productos.find(p => p.id !== 'PRD-999' && p.stock >= min && p.precio > 0)
