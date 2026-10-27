import { describe, it, expect } from 'vitest'
import { demo, S, AHORA, quien } from './ayuda.js'
import { numerosATexto, tokens, buscarProducto, entenderVenta, entenderIngreso, entenderOrden, cantidadInicial, partirItems } from '../src/lib/voz.js'
import { responder, buscarVentas, tiendaDe } from '../src/lib/asistente.js'
import { vistaPara, ingresarVarios, cobrarPendiente, crearVenta, saldoDe } from '../src/lib/dominio.js'
import { fechaISO } from '../src/lib/fechas.js'
const HOY = fechaISO(AHORA)

describe('números dictados', () => {
  it('convierte palabras a cifras', () => {
    expect(numerosATexto('cuarenta y cinco')).toBe('45')
    expect(numerosATexto('dos cables y un toma')).toBe('2 cables y 1 toma')
    expect(numerosATexto('ciento veinte unidades')).toBe('120 unidades')
    expect(numerosATexto('mil doscientos')).toBe('1200')
    expect(numerosATexto('media docena de enchufes')).toBe('6 de enchufes')
    expect(numerosATexto('diez por diez por siete')).toBe('10 por 10 por 7')
  })
  it('no junta números seguidos que son cosas distintas', () => { expect(numerosATexto('dos tres')).toBe('2 3') })
  it('cantidad al inicio, pero "24 polos" es parte del nombre', () => {
    expect(cantidadInicial('3 cajas de 2 polos')).toMatchObject({ cantidad: 3, resto: 'cajas de 2 polos' })
    expect(cantidadInicial('caja de 24 polos')).toMatchObject({ cantidad: 1, dicha: false })
    expect(cantidadInicial('una docena de enchufes').cantidad).toBe(12)
    expect(cantidadInicial('un par de sockets').cantidad).toBe(2)
  })
  it('separa productos por comas y por "y" seguido de cantidad, sin romper nombres con "y"', () => {
    expect(partirItems('2 enchufes trifásico y monofásico y 3 adaptadores negro y color')).toEqual(['2 enchufes trifásico y monofásico', '3 adaptadores negro y color'])
  })
})

describe('búsqueda en el catálogo (sin tildes, plurales, sinónimos)', async () => {
  const db = await demo(), P = db.productos
  const id = t => buscarProducto(t, P).producto?.nombre
  it('encuentra con plurales y sin tildes', () => {
    expect(id('interruptores simples')).toBe('Interruptor simple')
    expect(id('enchufe multiple de colores')).toBe('Enchufe múltiple de colores')
    expect(id('caja medidor monofasico grande')).toBe('Caja medidor monofásico grande')
    expect(id('tomacorrientes dobles empotrados')).toBe('Toma corriente doble empotrado')
    expect(id('soquet wall loza')).toBe('Socket Wall loza')
    expect(id('caja de paso de diez por diez por siete'.replace(/diez/g, '10').replace('siete', '7'))).toBe('Caja de pase 10x10x7')
  })
  it('los números del nombre deben coincidir (2 polos ≠ 24 polos)', () => {
    expect(id('caja de 24 polos')).toBe('Caja de 24 polos')
    expect(id('caja de 2 polos')).toBe('Caja de 2 polos')
    expect(id('toma corriente simple por 4')).toBe('Toma corriente simple x4')
  })
  it('si hay dos parecidos, marca duda y da opciones', () => {
    const b = buscarProducto('tomacorriente doble', P)
    expect(b.duda).toBe(true); expect(b.opciones.map(o => o.nombre)).toEqual(expect.arrayContaining(['Toma corriente doble empotrado', 'Toma corriente doble con línea tierra']))
  })
  it('lo que no está en el catálogo no se inventa', () => { expect(buscarProducto('cable número 12', P).producto).toBeNull(); expect(buscarProducto('foco led', P).producto).toBeNull() })
  it('tokens ignoran palabras de relleno', () => { expect(tokens('Piramidal c/ tapa')).toEqual(['piramidal', 'tapa']) })
})

describe('venta por voz', async () => {
  const db = await demo(), P = db.productos
  it('ejemplo de Sandro: cable no existe (se marca), tomacorriente doble pide elegir, Yape y cliente', () => {
    const v = entenderVenta('Dos cables número 12 y un tomacorriente doble, Yape, cliente Juan', P)
    expect(v.medio).toBe('Yape'); expect(v.cliente).toBe('Juan')
    expect(v.lineas).toHaveLength(2)
    expect(v.lineas[0]).toMatchObject({ cantidad: 2, encontrado: false })
    expect(v.lineas[1]).toMatchObject({ cantidad: 1, encontrado: true, duda: true })
  })
  it('varios productos, efectivo y cliente de dos palabras', () => {
    const v = entenderVenta('Tres cajas de dos polos y una caja de veinticuatro polos, efectivo, cliente María López', P)
    expect(v.lineas.map(l => [l.cantidad, l.nombre, l.duda])).toEqual([[3, 'Caja de 2 polos', false], [1, 'Caja de 24 polos', false]])
    expect(v).toMatchObject({ medio: 'Efectivo', cliente: 'María López' })
  })
  it('pendiente / fiado, a nombre de, operación de Plin y precio dicho', () => {
    expect(entenderVenta('cinco interruptores simples, fiado, a nombre de Constructora Santa Rosa', P)).toMatchObject({ medio: 'Pendiente', cliente: 'Constructora Santa Rosa' })
    const v = entenderVenta('dos sockets wall loza a 4 soles, plin operación 12345678, cliente Pedro', P)
    expect(v).toMatchObject({ medio: 'Plin', operacion: '12345678', cliente: 'Pedro' }); expect(v.lineas[0]).toMatchObject({ cantidad: 2, nombre: 'Socket Wall loza', precio: 4 })
  })
  it('producto que no existe se marca con lo dicho y nunca se agrega; ambiguo trae opciones', () => {
    const v = entenderVenta('tres focos led y un tomacorriente doble, efectivo', P)
    expect(v.lineas[0]).toMatchObject({ cantidad: 3, encontrado: false }); expect(v.lineas[0].nombreDicho).toMatch(/foco/)
    expect(v.lineas[0].productoId ?? null).toBeNull()
    expect(v.lineas[1].duda).toBe(true); expect(v.lineas[1].opciones.length).toBeGreaterThan(1)
  })
  it('sin medio dicho no inventa uno', () => { expect(entenderVenta('un interruptor doble', P).medio).toBeNull() })
})

describe('ingreso por voz', async () => {
  const db = await demo(), P = db.productos
  it('"Llegaron 50 interruptores simples"', () => {
    const r = entenderIngreso('Llegaron 50 interruptores simples', P)
    expect(r.lineas).toEqual([expect.objectContaining({ cantidad: 50, nombre: 'Interruptor simple', duda: false })])
  })
  it('varias líneas en palabras', () => {
    const r = entenderIngreso('Entraron cincuenta interruptores simples y veinte cajas de dos polos', P)
    expect(r.lineas.map(l => [l.cantidad, l.nombre])).toEqual([[50, 'Interruptor simple'], [20, 'Caja de 2 polos']])
  })
  it('el vendedor NO puede ingresar aunque lo dicte (capa de datos)', () => {
    const r = entenderIngreso('Llegaron 50 interruptores simples', P)
    expect(quien(() => ingresarVarios(db, S.v1, r.lineas.map(l => ({ productoId: l.productoId, cantidad: l.cantidad })), 'Ingreso por voz', AHORA))).toMatch(/permiso/)
    const ok = ingresarVarios(db, S.coadmin, [{ productoId: r.lineas[0].productoId, cantidad: 50 }], 'Ingreso por voz', AHORA)
    const m = ok.db.movimientos.at(-1); expect(m).toMatchObject({ tipo: 'ingreso', cantidad: 50, quien: 'U-COA', motivo: 'Ingreso por voz' })
  })
})

describe('órdenes: preguntas, comandos y acciones bloqueadas', async () => {
  const db = await demo(), P = db.productos
  const t = s => entenderOrden(s, P)
  it('clasifica', () => {
    expect(t('¿Cuántos interruptores dobles quedan?')).toMatchObject({ tipo: 'pregunta', que: 'stock', producto: { producto: { nombre: 'Interruptor doble' } } })
    expect(t('cuánto vendí hoy')).toMatchObject({ que: 'ventas', ayer: false })
    expect(t('cuánto vendimos ayer')).toMatchObject({ que: 'ventas', ayer: true })
    expect(t('¿Cómo va la caja?').que).toBe('caja')
    expect(t('qué productos están por acabarse').que).toBe('stockBajo')
    expect(t('cuánto debe la tienda uno')).toMatchObject({ que: 'deuda', tienda: '1' })
    expect(t('cuál es la ganancia de hoy').que).toBe('utilidad')
    expect(t('cuánto me costó el interruptor simple')).toMatchObject({ que: 'costo', producto: { producto: { nombre: 'Interruptor simple' } } })
    expect(t('precio del enchufe reversible')).toMatchObject({ que: 'precio', producto: { producto: { nombre: 'Enchufe reversible' } } })
    expect(t('quiénes me deben').que).toBe('pendientes')
    expect(t('Llegaron 50 interruptores simples').tipo).toBe('ingreso')
    expect(t('Juan ya pagó su pendiente en efectivo')).toMatchObject({ tipo: 'cobrar', cliente: 'juan', medio: 'Efectivo' })
    expect(t('marca como cobrada la venta 123 con yape')).toMatchObject({ tipo: 'cobrar', numero: 123, medio: 'Yape' })
    expect(t('busca la venta de Juan')).toMatchObject({ tipo: 'buscar', cliente: 'juan' })
    expect(t('ir a inventario')).toMatchObject({ tipo: 'ir', ruta: 'inventario' })
    expect(t('dos interruptores simples, yape, cliente Ana').tipo).toBe('venta')
  })
  it('anular, devolver, borrar o reabrir nunca se ejecutan por voz', () => {
    for (const s of ['anula la venta 45', 'devuelve dos enchufes de la venta 12', 'borra el producto interruptor', 'reabre la caja de ayer', 'restablecer la demostración']) expect(t(s).tipo).toBe('bloqueado')
  })
})

describe('respuestas según el rol (solo la vista del rol)', async () => {
  const db = await demo()
  const ses = { admin: { id: 'U-ADM', rol: 'admin' }, coadmin: { id: 'U-COA', rol: 'coadmin' }, v1: { id: 'U-V01', rol: 'vendedor' } }
  const R = (k, s) => responder(vistaPara(db, ses[k]), ses[k], entenderOrden(s, db.productos), HOY)
  it('utilidad y costos: solo la administradora', () => {
    expect(R('admin', 'utilidad de hoy').ok).toBe(true)
    expect(R('coadmin', 'utilidad de hoy').ok).toBe(false)
    expect(R('v1', 'cuál es la ganancia de hoy').ok).toBe(false)
    expect(R('admin', 'cuánto me costó el interruptor simple').texto).toMatch(/Costo: S\//)
    const v = R('v1', 'cuánto me costó el interruptor simple'); expect(v.ok).toBe(false); expect(JSON.stringify(v)).not.toMatch(/Costo: S/)
  })
  it('la vista del vendedor no trae costos aunque se pregunte otra cosa', () => { expect(vistaPara(db, ses.v1).productos.every(p => p.costo === undefined)).toBe(true) })
  it('ventas de hoy: el vendedor solo ve las suyas', () => {
    const tot = (k, id) => vistaPara(db, ses[k]).ventas.filter(v => v.fecha === HOY && v.estado === 'Activa' && (!id || v.vendedorId === id)).reduce((s, v) => s + v.total, 0)
    expect(R('v1', 'cuánto vendí hoy').texto).toContain(tot('v1', 'U-V01').toFixed(2))
    expect(R('admin', 'cuánto se vendió hoy').texto).toContain(tot('admin').toFixed(2))
  })
  it('stock bajo y deudas de tiendas: solo administración', () => {
    expect(R('coadmin', 'qué productos están por acabarse').ok).toBe(true)
    expect(R('v1', 'stock bajo').ok).toBe(false)
    expect(R('admin', 'cuánto debe la tienda 1').texto).toMatch(/^Debe S\//)
    expect(R('v1', 'cuánto debe la tienda 1').ok).toBe(false)
  })
  it('stock de un producto: todos', () => { expect(R('v1', 'cuántos interruptores simples quedan').texto).toMatch(/Quedan|No queda/) })
  it('caja: vendedor la suya, administración el día', () => { expect(R('v1', 'cómo va mi caja').titulo).toMatch(/Tu caja/); expect(R('coadmin', 'cómo va la caja').titulo).toMatch(/Caja del día/) })
  it('tiendaDe entiende "tienda uno" y nombres', () => { const v = vistaPara(db, ses.admin); expect(tiendaDe(v.tiendas, 'uno').id).toBe(v.tiendas[0].id); expect(tiendaDe(v.tiendas, '2').id).toBe(v.tiendas[1].id) })
})

describe('cobrar pendiente por voz respeta permisos', async () => {
  const base = await demo()
  const ses = { admin: { id: 'U-ADM', rol: 'admin' }, v1: { id: 'U-V01', rol: 'vendedor' }, v2: { id: 'U-V02', rol: 'vendedor' } }
  const p = base.productos.find(x => x.stock > 5 && x.precio > 0 && x.id !== 'PRD-999')
  const db = crearVenta(base, S.v1, { cliente: 'Juan Quispe', medio: 'Pendiente', items: [{ productoId: p.id, cantidad: 1 }] }, AHORA).db
  it('el vendedor solo encuentra sus pendientes', () => {
    const o = entenderOrden('Juan Quispe ya pagó su pendiente en efectivo', db.productos)
    expect(buscarVentas(vistaPara(db, ses.v1), ses.v1, o, { soloPorCobrar: true }).some(v => v.cliente === 'Juan Quispe')).toBe(true)
    expect(buscarVentas(vistaPara(db, ses.v2), ses.v2, o, { soloPorCobrar: true }).some(v => v.cliente === 'Juan Quispe')).toBe(false)
  })
  it('y la capa de datos impide cobrar la venta de otro vendedor', () => {
    const v = db.ventas.find(x => x.cliente === 'Juan Quispe')
    expect(quien(() => cobrarPendiente(db, S.v2, v.id, 'Efectivo', AHORA))).toMatch(/propias/)
    const r = cobrarPendiente(db, S.v1, v.id, 'Efectivo', AHORA); expect(saldoDe(r.venta)).toBe(0)
  })
})

describe('corregirOido (errores reales de Whisper medidos)', () => {
  it('arregla medios y palabras mal oídas', async () => {
    const { corregirOido, entenderOrden } = await import('../src/lib/voz.js')
    expect(corregirOido('ya pe, quidente Juan')).toMatch(/yape\s*,? cliente Juan/)
    expect(entenderOrden('Juan, él apagó su pendiente inefectivo.').tipo).toBe('cobrar')
    expect(entenderOrden('Quienes medeben.').que).toBe('pendientes')
    expect(entenderOrden('Anuna la venta 45.').tipo).toBe('bloqueado')
  })
})
