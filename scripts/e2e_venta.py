# E2E de la VENTA por rol: admin, coadmin y vendedor1 completan una venta en 3 toques (producto → cantidad → Cobrar)
# en celular 390 y escritorio 1440, con capturas venta-<rol>-<vista>-NN y axe AA. Además prueba lo recuperado del Apps Script:
# precio editado, "Otros" sin stock, foto, Pendiente → Cobrado, devolución con reingreso, anular solo la administradora.
# Requiere la vista previa en el puerto 4328:  npm run build && npm run preview
import re, sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from comun import *

fallos = []
def chk(cond, msg):
    if not cond: fallos.append(msg); print('FALLA:', msg)
    return cond
DATOS = "()=>JSON.parse(localStorage.getItem('megans-electric-v2:datos'))"
ROLES = [('admin', 'admin', 'U-ADM'), ('coadmin', 'coadmin', 'U-COA'), ('vendedor', 'vendedor1', 'U-V01')]
VISTAS = [('celular', {'width': 390, 'height': 844}, True), ('escritorio', {'width': 1440, 'height': 900}, False)]
toques = {}

def venta_3_toques(p, rol, usuario, uid, vista, movil):
    pre = f'venta-{rol}-{vista}'
    entrar(p, usuario)
    hero = p.locator('.venta-hero-btn'); chk(hero.count() == 1 and hero.is_visible(), f'{pre}: falta el botón grande "Nueva venta" en el inicio')
    nav_venta = p.locator('nav:visible').get_by_role('button', name='Nueva venta'); chk(nav_venta.count() == 1, f'{pre}: falta "Nueva venta" en el menú')
    chk(nav_venta.first.get_attribute('class').find('destacado') >= 0, f'{pre}: "Nueva venta" del menú debe estar destacado')
    shot(p, f'{pre}-01-inicio'); axe(p, f'{pre}-inicio')
    hero.click(); p.wait_for_selector('h1:has-text("Nueva venta")')
    antes = p.evaluate(DATOS); n0 = len(antes['ventas'])
    # Toque 1: producto (botón rápido de favoritos / más vendidos, sin escribir nada)
    rap = p.locator('.rapido:not([disabled])').first; chk(rap.count() == 1, f'{pre}: faltan los botones de más vendidos')
    nombre = rap.locator('span').first.inner_text(); rap.click(); p.wait_for_timeout(150)
    # Toque 2: cantidad +
    p.get_by_role('button', name=f'Agregar uno de {nombre}').first.click(); p.wait_for_timeout(150)
    chk(p.locator('.prod-cant output, .linea-carro input').first.count() >= 1, f'{pre}: no se ve la cantidad')
    # capturas del buscador + carrito y del cobro (sin tocar nada más)
    p.get_by_label('Buscar producto por nombre').fill(nombre.split(' ')[0]); p.wait_for_timeout(250)
    shot(p, f'{pre}-02-buscador-carrito'); axe(p, f'{pre}-buscador')
    p.get_by_label('Buscar producto por nombre').fill(''); p.wait_for_timeout(200)
    p.locator('.cobro').scroll_into_view_if_needed(); p.wait_for_timeout(500)
    p.screenshot(path=f'{OUT}/{pre}-03-cobro.png'); desborde(p, f'{pre}-03-cobro')
    # sin nombre del comprador no se registra (obligatorio en todas las ventas)
    p.get_by_role('button', name=re.compile(r'^Cobrar S.')).click(); p.wait_for_timeout(250)
    chk('escribe el nombre del cliente' in p.inner_text('#principal').lower(), f'{pre}: sin nombre debe pedir el cliente')
    p.get_by_label(re.compile('^Nombre del cliente')).fill(f'Cliente {rol}')
    # Toque 3: Cobrar (Efectivo por defecto)
    p.get_by_role('button', name=re.compile(r'^Cobrar S.')).click()
    p.wait_for_selector('text=¡Venta registrada!', timeout=8000); p.wait_for_timeout(300)
    toques[pre] = 3
    shot(p, f'{pre}-04-confirmacion'); axe(p, f'{pre}-confirmacion')
    d = p.evaluate(DATOS); v = d['ventas'][-1]
    chk(len(d['ventas']) == n0 + 1, f'{pre}: no se guardó la venta')
    chk(v['vendedorId'] == uid and v['registradoPor'] == uid, f'{pre}: vendedor por defecto debe ser el usuario en sesión')
    chk(v['medio'] == 'Efectivo' and v['estadoCobro'] == 'Cobrado' and v['items'][0]['cantidad'] == 2, f'{pre}: medio/estado/cantidad de la venta')
    pid = v['items'][0]['productoId']; s0 = next(x for x in antes['productos'] if x['id'] == pid)['stock']; s1 = next(x for x in d['productos'] if x['id'] == pid)['stock']
    chk(s1 == s0 - 2, f'{pre}: el stock debe bajar en 2 ({s0} → {s1})')
    # el vendedor no ve costos ni puede anular
    if rol == 'vendedor':
        p.get_by_role('button', name=re.compile('^Ver guía')).click(); p.wait_for_selector('h1:has-text("Guía")')
        chk(p.get_by_role('button', name='Anular venta').count() == 0, f'{pre}: el vendedor no debe ver Anular')
        chk('Costo' not in p.inner_text('body') and 'Utilidad' not in p.inner_text('body'), f'{pre}: el vendedor no debe ver costos')
        chk(p.get_by_role('button', name='Registrar devolución').count() == 0, f'{pre}: solo la administradora registra devoluciones')
    return v

def bondades_admin(p):
    pre = 'venta-admin-extra'
    entrar(p, 'admin'); ir(p, 'vender')
    # precio editado + Otros + Pendiente con cliente + foto + vendedor de la lista
    p.get_by_label('Buscar producto por nombre').fill('caja de 4'); p.wait_for_timeout(200)
    p.get_by_role('button', name=re.compile(r'^Caja de 4 polos\s+Quedan')).first.click()
    p.get_by_label('Precio c/u (S/)').first.fill('1.50'); p.wait_for_timeout(150)
    chk('Precio de lista' in p.inner_text('.carro'), f'{pre}: debe mostrar el precio de lista al editar')
    p.locator('summary', has_text='Otros').click(); p.get_by_label('¿Qué se vendió?').fill('Cinta aislante 3M'); p.get_by_label('Precio (S/)').fill('4.5'); p.get_by_role('button', name=re.compile('Agregar “Otros”')).click()
    p.get_by_role('radio', name='Pendiente').click(); p.get_by_role('button', name=re.compile(r'^Cobrar S.')).click(); p.wait_for_timeout(300)
    chk('escribe el nombre del cliente' in p.inner_text('#principal').lower(), f'{pre}: Pendiente sin nombre debe pedir el cliente')
    p.get_by_label(re.compile('^Nombre del cliente')).fill('Ferretería Don Luis'); p.get_by_label('Vendedor').select_option('U-V02')
    p.locator('summary', has_text='Más datos').click(); p.locator('input[data-prueba="subir-foto"]').set_input_files(FOTO); p.wait_for_selector('.foto-prev img', timeout=8000)
    shot(p, f'{pre}-01-precio-otros-foto', full=True); axe(p, f'{pre}-carrito')
    otros_stock0 = next(x for x in p.evaluate(DATOS)['productos'] if x['id'] == 'PRD-999')['stock']
    p.get_by_role('button', name=re.compile(r'^Cobrar S.')).click(); p.wait_for_selector('text=¡Venta registrada!')
    d = p.evaluate(DATOS); v = d['ventas'][-1]
    chk(v['medio'] == 'Pendiente' and v['estadoCobro'] == 'Pendiente', f'{pre}: venta pendiente')
    chk(v['vendedorId'] == 'U-V02' and v['registradoPor'] == 'U-ADM', f'{pre}: vendedor elegido de la lista')
    l0 = v['items'][0]; chk(l0['precio'] == 1.5 and l0['precioEditado'] and l0['precioLista'] > 1.5, f'{pre}: precio editado con precio original')
    chk(v['items'][1]['nombre'] == 'Otros: Cinta aislante 3M' and next(x for x in d['productos'] if x['id'] == 'PRD-999')['stock'] == otros_stock0, f'{pre}: Otros no mueve stock')
    chk(str(v.get('foto') or '').startswith('data:image/jpeg') and len(v['foto']) < 360000, f'{pre}: foto comprimida guardada')
    chk(any('Precio de mostrador' in h['que'] for h in v['historial']), f'{pre}: historial del precio editado')
    # pendiente → cobrado
    p.get_by_role('button', name=re.compile('^Ver guía')).click(); p.wait_for_selector('h1:has-text("Guía")')
    p.get_by_role('button', name='Cobrar con Yape').click(); p.get_by_label(re.compile('^Número de operación de Yape')).fill('90807060'); p.get_by_role('button', name='Registrar pago con Yape').click(); p.get_by_role('dialog').last.get_by_role('button', name=re.compile('^Sí')).click(); p.wait_for_timeout(500)
    v2 = p.evaluate(DATOS)['ventas'][-1]; chk(v2['estadoCobro'] == 'Cobrado' and v2['cobro']['medio'] == 'Yape', f'{pre}: pendiente → cobrado')
    # devolución con reingreso
    pid = l0['productoId']; st0 = next(x for x in p.evaluate(DATOS)['productos'] if x['id'] == pid)['stock']
    p.get_by_role('button', name='Registrar devolución').click(); p.get_by_label('Cantidad', exact=True).fill('1')
    p.get_by_role('group', name='Datos de la devolución').get_by_role('button', name='Registrar devolución').click(); p.get_by_role('dialog').last.get_by_role('button', name=re.compile('^Sí')).click(); p.wait_for_timeout(500)
    st1 = next(x for x in p.evaluate(DATOS)['productos'] if x['id'] == pid)['stock']; chk(st1 == st0 + 1, f'{pre}: la devolución reingresa stock ({st0} → {st1})')
    shot(p, f'{pre}-02-guia-cobrada-devolucion', full=True); axe(p, f'{pre}-guia')
    # anular (solo admin) sin borrar, en otra venta
    ir(p, 'vender'); p.locator('.rapido:not([disabled])').first.click(); p.get_by_label(re.compile('^Nombre del cliente')).fill('Cliente a anular'); p.get_by_role('button', name=re.compile(r'^Cobrar S.')).click(); p.wait_for_selector('text=¡Venta registrada!')
    vid = p.locator('.exito strong').first.inner_text(); p.get_by_role('button', name=re.compile('^Ver guía')).click(); p.wait_for_selector(f'h1:has-text("{vid}")')
    p.get_by_role('button', name='Anular venta').click(); dlg = p.get_by_role('dialog').last; dlg.get_by_label('Motivo de la anulación').fill('Prueba de anulación E2E'); dlg.get_by_role('button', name=re.compile('^Sí')).click(); p.wait_for_timeout(500)
    d = p.evaluate(DATOS); va = next(x for x in d['ventas'] if x['id'] == vid); chk(va['estado'] == 'Anulada', f'{pre}: anulada y sigue guardada (no se borra)')
    # cierre del día: resumen para compartir
    ir(p, 'caja'); chk(p.get_by_role('link', name='Compartir resumen por WhatsApp').count() >= 1, f'{pre}: falta compartir el resumen del día')
    href = p.get_by_role('link', name='Compartir resumen por WhatsApp').first.get_attribute('href'); chk('Total%20de%20ventas' in href, f'{pre}: el resumen trae totales')

def coadmin_no_anula(p):
    entrar(p, 'coadmin'); ir(p, 'ventas'); p.get_by_role('button', name=re.compile('^Abrir venta')).first.click(); p.wait_for_selector('h1:has-text("Guía")')
    chk(p.get_by_role('button', name='Anular venta').count() == 0, 'coadmin: no debe ver Anular'); chk(p.get_by_role('button', name='Registrar devolución').count() == 0, 'coadmin: no registra devoluciones')

def flujos_nuevos(b, vp, mob, vista):
    # Decisiones de Sandro: escaneo por teclado (lector USB = código + Enter), Yape exige operación y queda "Por verificar"
    # para el vendedor, venta delegada por la administradora, verificación en Conciliación, etiquetas solo admin/coadmin.
    pre = f'venta-nuevos-{vista}'
    c, p = nuevo(b, vp, mob); entrar(p, 'vendedor1'); ir(p, 'vender')
    d = p.evaluate(DATOS); pr = next(x for x in d['productos'] if x['activo'] and x['stock'] > 5 and x['precio'] > 0 and x.get('codigo') and x['id'] != 'PRD-999')
    q = p.get_by_label('Buscar producto por nombre'); q.fill(pr['codigo']); q.press('Enter'); p.wait_for_timeout(300)
    chk(f"Agregado: {pr['nombre']}" in p.inner_text('#principal'), f'{pre}: escaneo por teclado agrega {pr["codigo"]}')
    p.get_by_label(re.compile('^Nombre del cliente')).fill('Cliente escaneo'); p.get_by_role('radio', name='Yape').click()
    p.get_by_role('button', name=re.compile(r'^Cobrar S.')).click(); p.wait_for_timeout(250)
    chk('número de operación de yape' in p.inner_text('#principal').lower(), f'{pre}: Yape pide número de operación')
    p.get_by_label(re.compile('^Número de operación de Yape')).fill('31415926'); axe(p, f'{pre}-escaneo-yape')
    p.get_by_role('button', name=re.compile(r'^Cobrar S.')).click(); p.wait_for_selector('text=¡Venta registrada!', timeout=8000)
    v = p.evaluate(DATOS)['ventas'][-1]
    chk(v['items'][0]['productoId'] == pr['id'] and v['pagos'][0]['estado'] == 'Por verificar', f'{pre}: venta escaneada con Yape por verificar')
    p.evaluate("location.hash='#/etiquetas'"); p.wait_for_timeout(600); chk('Etiquetas' not in p.locator('#principal h1').inner_text(), f'{pre}: el vendedor no entra a etiquetas')
    p.evaluate("location.hash='#/conciliacion'"); p.wait_for_timeout(600); chk('Conciliación' not in p.locator('#principal h1').inner_text(), f'{pre}: el vendedor no entra a conciliación')
    # administradora (mismo navegador, mismos datos): delega una venta a Vendedor 1 y verifica el Yape en Conciliación
    p.evaluate("localStorage.removeItem('megans-electric-v2:sesion')"); p.reload(); entrar(p, 'admin'); ir(p, 'vender')
    p.locator('.rapido:not([disabled])').first.click(); p.get_by_label(re.compile('^Nombre del cliente')).fill('Obra delegada'); p.get_by_label('Vendedor').select_option('U-V01')
    p.get_by_role('button', name=re.compile(r'^Cobrar S.')).click(); p.wait_for_selector('text=¡Venta registrada!', timeout=8000)
    vd = p.evaluate(DATOS)['ventas'][-1]; chk(vd['vendedorId'] == 'U-V01' and vd['registradoPor'] == 'U-ADM', f'{pre}: venta delegada al vendedor')
    ir(p, 'conciliacion'); chk('31415926' in p.inner_text('#principal'), f'{pre}: el Yape por verificar aparece en Conciliación')
    fila = p.locator('.pagos-lista li, .pagos-lista tr', has_text='31415926').first
    (fila.get_by_role('button', name='Verificar') if fila.count() else p.locator('.pagos-lista').first.get_by_role('button', name='Verificar').first).click()
    p.get_by_role('dialog').last.get_by_role('button', name=re.compile('^Sí')).click(); p.wait_for_timeout(500)
    pg = next(x for x in p.evaluate(DATOS)['ventas'] if x['id'] == v['id'])['pagos'][0]
    chk(pg['estado'] == 'Verificado' and pg.get('verificadoPor'), f'{pre}: la administradora verifica el pago')
    axe(p, f'{pre}-conciliacion')
    # vendedor: ve la venta delegada en sus ventas
    p.evaluate("localStorage.removeItem('megans-electric-v2:sesion')"); p.reload(); entrar(p, 'vendedor1'); ir(p, 'ventas')
    chk('Obra delegada' in p.inner_text('#principal'), f'{pre}: la venta delegada aparece al vendedor'); c.close()

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    with sync_playwright() as pw:
        b = lanzar(pw)
        for vista, vp, mob in VISTAS:
            for rol, usuario, uid in ROLES:
                c, p = nuevo(b, vp, mob); venta_3_toques(p, rol, usuario, uid, vista, mob); c.close()
            # oscuro: la venta del admin también debe pasar axe
            c, p = nuevo(b, vp, mob, tema='dark'); entrar(p, 'admin'); ir(p, 'vender'); p.locator('.rapido:not([disabled])').first.click(); axe(p, f'venta-oscuro-{vista}'); c.close()
        for vista, vp, mob in VISTAS: flujos_nuevos(b, vp, mob, vista)
        c, p = nuevo(b, VISTAS[1][1], False); bondades_admin(p); c.close()
        c, p = nuevo(b, VISTAS[0][1], True); coadmin_no_anula(p); c.close()
        b.close()
    print('VENTAS EN 3 TOQUES:', json.dumps(toques))
    malos = reporte()
    print('FALLOS:', len(fallos)); [print('  -', f) for f in fallos]
    sys.exit(1 if fallos or malos else 0)
