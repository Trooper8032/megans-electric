# Pruebas de extremo a extremo por rol + capturas (escritorio 1440 y celular 390) + axe en claro y oscuro.
# Requiere la vista previa en el puerto 4328:  npm run build && npm run preview
import json, re, subprocess, sys, os, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from comun import *

fallos = []
def chk(cond, msg):
    if not cond: fallos.append(msg); print('FALLA:', msg)
    return cond
def si(p, n): return p.get_by_role('button', name=re.compile(n))
def confirmar(p, texto='^Sí,'):
    d = p.get_by_role('dialog').last; d.wait_for(timeout=5000); d.get_by_role('button', name=re.compile(texto)).first.click(); p.wait_for_timeout(500)
def firmar(p):
    c0 = p.locator('#firma-venta'); c0.scroll_into_view_if_needed(); bb = c0.bounding_box()
    p.mouse.move(bb['x'] + bb['width'] * .1, bb['y'] + bb['height'] * .6); p.mouse.down()
    for i in range(1, 30): p.mouse.move(bb['x'] + bb['width'] * (.1 + i * .028), bb['y'] + bb['height'] * (.5 + .25 * ((i % 6) - 3) / 3))
    p.mouse.up(); p.wait_for_timeout(200)
def producto(p, nombre): p.get_by_role('button', name=re.compile('^' + re.escape(nombre) + r'\s+(Quedan|Sin)')).first.click(); p.wait_for_timeout(200)
def buscar(p, t): p.get_by_label('Buscar producto por nombre').fill(t); p.wait_for_timeout(200)
def pdf_a_png(ruta_pdf, nombre, pagina=1):
    subprocess.run(['pdftoppm', '-png', '-r', '70', '-f', str(pagina), '-l', str(pagina), '-singlefile', ruta_pdf, f'{OUT}/{nombre}'], check=True)
def texto_pdf(ruta): return subprocess.run(['pdftotext', '-layout', ruta, '-'], capture_output=True, text=True).stdout
def descarga(p, boton):
    with p.expect_download(timeout=20000) as d: boton.click()
    ruta = f'/tmp/megans-e2e-{int(time.time()*1000)}-{d.value.suggested_filename}'; d.value.save_as(ruta); return ruta, d.value.suggested_filename

def flujo_admin(p, pre, movil):
    entrar(p, 'admin')
    chk(p.locator('svg.grafico').count() >= 6, f'{pre}: el panel debe tener al menos 6 gráficos')
    chk('Ventas por día' in p.inner_text('#principal'), f'{pre}: panel sin "Ventas por día"')
    shot(p, f'{pre}-02-panel', full=True); axe(p, f'{pre}-panel')
    # ---- vender
    ir(p, 'vender'); buscar(p, 'Caja de 2 polos'); producto(p, 'Caja de 2 polos'); producto(p, 'Caja de 2 polos'); buscar(p, 'Interruptor doble'); producto(p, 'Interruptor doble')
    p.get_by_label('Buscar producto por nombre').fill(''); p.get_by_role('radio', name='Yape').click(); p.get_by_label(re.compile('^Número de operación de Yape')).fill('48151623'); p.get_by_label(re.compile('^Nombre del cliente')).fill('Cliente de prueba E2E'); p.locator('summary', has_text='Más datos').click(); p.get_by_label('Celular (para enviar la guía)').fill('987654321')
    shot(p, f'{pre}-03-venta', full=True); axe(p, f'{pre}-venta')
    p.get_by_role('button', name=re.compile(r'^Cobrar S.')).click()
    p.wait_for_selector('text=¡Venta registrada!'); vid = p.locator('.exito strong').inner_text(); chk(re.match(r'G001-\d{6}', vid), f'{pre}: correlativo de guía'); shot(p, f'{pre}-04-venta-registrada')
    # ---- buscar la venta del día y agregar productos
    ir(p, 'ventas'); p.get_by_label('Buscar por número, cliente o producto').fill(vid); p.wait_for_timeout(300)
    chk(p.get_by_role('button', name=re.compile(vid)).count() == 1, f'{pre}: no se encontró la venta del día {vid}')
    shot(p, f'{pre}-05-ventas-del-dia', full=True); p.get_by_role('button', name=re.compile(vid)).first.click(); p.wait_for_selector(f'h1:has-text("{vid}")')
    p.get_by_role('button', name=re.compile('^Agregar productos a esta venta')).click()
    buscar(p, 'Toma corriente simple x3'); producto(p, 'Toma corriente simple x3'); shot(p, f'{pre}-06-agregar-a-venta', full=True)
    p.get_by_role('button', name='Agregar a la venta', exact=True).click(); confirmar(p, '^Sí, agregar'); p.wait_for_timeout(600)
    chk('Agregó 1 ×' in p.inner_text('#principal'), f'{pre}: el historial debe mostrar lo agregado')
    chk('Se agregaron productos' in p.inner_text('#principal'), f'{pre}: la venta debe marcar "Se agregaron productos"')
    firmar(p); p.get_by_role('button', name='Guardar firma').click(); p.wait_for_timeout(500)
    chk(p.locator('.guia-firma img').count() == 1, f'{pre}: la firma debe verse en la guía')
    p.evaluate('window.scrollTo(0,0)'); shot(p, f'{pre}-07-guia-en-pantalla', full=True); axe(p, f'{pre}-guia')
    ruta, nom = descarga(p, p.get_by_role('button', name=re.compile('^Descargar guía en PDF')))
    t = texto_pdf(ruta); chk(vid in t and 'GUÍA DE VENTA' in t and 'NO es una guía de remisión' in t and 'Interruptor doble' in t and 'Toma corriente simple x3' in t, f'{pre}: contenido del PDF de la guía'); chk('Yape' in t and 'Cliente de prueba E2E' in t and 'Verificación' in t, f'{pre}: PDF sin medio de pago, cliente o verificación')
    pdf_a_png(ruta, f'{pre}-08-guia-pdf'); chk(subprocess.run(['pdfimages', '-list', ruta], capture_output=True, text=True).stdout.count('\n') >= 4, f'{pre}: el PDF debe incluir logo y firma')
    href = p.get_by_role('link', name=re.compile('Abrir WhatsApp')).get_attribute('href'); chk(href.startswith('https://wa.me/51987654321?text=') and vid in __import__('urllib.parse', fromlist=['x']).unquote(href), f'{pre}: enlace de WhatsApp')
    # ---- inventario + conteo
    ir(p, 'inventario'); shot(p, f'{pre}-09-inventario', full=True); axe(p, f'{pre}-inventario')
    p.get_by_role('tab', name=re.compile('Conteo semanal')).click(); p.get_by_role('button', name=re.compile('^Empezar el conteo')).click(); p.wait_for_selector('text=Conteo de la semana')
    ins = p.locator('input[aria-label^="Contaste de"]'); n = ins.count(); chk(10 <= n <= 15, f'{pre}: conteo sugiere {n} productos (10 a 15)')
    p.get_by_role('button', name='Cerrar conteo y corregir stock').click(); chk('Falta contar' in p.inner_text('#principal'), f'{pre}: debe exigir contar todo')
    filas = p.locator('tbody tr')
    for i in range(n):
        sis = int(filas.nth(i).locator('td').nth(1).inner_text()); ins.nth(i).fill(str(sis - 2 if i == 0 else sis))
    p.wait_for_timeout(300); chk(p.locator('tr.fila-rojo').count() == 1, f'{pre}: la diferencia debe verse en rojo')
    p.get_by_role('button', name='Cerrar conteo y corregir stock').click(); chk('motivo de la diferencia' in p.inner_text('#principal'), f'{pre}: debe exigir motivo')
    p.locator('input[aria-label^="Motivo de la diferencia"]').first.fill('Se rompieron dos'); shot(p, f'{pre}-10-conteo', full=True); axe(p, f'{pre}-conteo')
    p.get_by_role('button', name='Cerrar conteo y corregir stock').click(); confirmar(p, '^Sí, cerrar'); p.wait_for_selector('text=Conteos anteriores'); chk('Se rompieron dos' in p.inner_text('#principal'), f'{pre}: conteo cerrado debe quedar en el historial')
    p.get_by_role('tab', name='Movimientos').click(); chk('conteo' in p.inner_text('#principal'), f'{pre}: movimiento de conteo con autor')
    # ---- tiendas
    ir(p, 'tiendas'); shot(p, f'{pre}-11-tiendas', full=True); axe(p, f'{pre}-tiendas')
    p.get_by_role('button', name=re.compile('Ferretería La Esquina')).click(); p.wait_for_selector('h1:has-text("La Esquina")')
    p.get_by_role('button', name=re.compile('Nuevo envío de stock')).click(); buscar(p, 'Caja de 3 polos'); producto(p, 'Caja de 3 polos'); producto(p, 'Caja de 3 polos'); buscar(p, 'Interruptor simple'); producto(p, 'Interruptor simple')
    p.get_by_role('button', name='Crear envío', exact=True).click(); confirmar(p, '^Sí, crear'); p.wait_for_timeout(600)
    chk('Por confirmar recepción' in p.inner_text('#principal'), f'{pre}: envío nuevo por confirmar')
    p.get_by_role('button', name=re.compile('^Confirmar recepción')).first.click(); p.get_by_label('Recibió de Interruptor simple').fill('0'); p.wait_for_timeout(200); chk(p.locator('.modal tr.fila-rojo').count() == 1, f'{pre}: recepción con diferencia en rojo')
    shot(p, f'{pre}-12-recepcion'); p.get_by_role('dialog').last.get_by_role('button', name='Confirmar recepción', exact=True).click(); confirmar(p, '^Sí, confirmar'); p.wait_for_timeout(600)
    chk('Con diferencias' in p.inner_text('#principal'), f'{pre}: envío con diferencias')
    ruta, nom = descarga(p, p.get_by_role('button', name=re.compile('^Hoja de envío')).first); t = texto_pdf(ruta); chk('HOJA DE ENVÍO' in t and 'H001-' in t and 'NO es una guía de remisión' in t, f'{pre}: PDF de hoja de envío'); pdf_a_png(ruta, f'{pre}-13-hoja-envio-pdf')
    p.get_by_role('button', name=re.compile('Registrar pago')).click(); p.get_by_label('Monto pagado (S/)').fill('999999'); p.get_by_role('dialog').last.get_by_role('button', name='Registrar pago', exact=True).click(); chk('mayor que la deuda' in p.inner_text('.modal'), f'{pre}: pago mayor que la deuda')
    p.get_by_label('Monto pagado (S/)').fill('100'); p.get_by_role('dialog').last.get_by_role('button', name='Registrar pago', exact=True).click(); confirmar(p, '^Sí, registrar'); p.wait_for_timeout(600)
    chk('Pago' in p.inner_text('#principal') and 'PAG-' in p.inner_text('#principal'), f'{pre}: pago en la cuenta corriente')
    p.evaluate('window.scrollTo(0,0)'); shot(p, f'{pre}-14-tienda-cuenta-corriente', full=True); axe(p, f'{pre}-tienda')
    # ---- caja
    ir(p, 'caja'); shot(p, f'{pre}-15-caja', full=True)
    for m, v in [('Efectivo', '1'), ('Yape', '1'), ('Plin', '1')]: p.get_by_label(f'Contado en {m} (S/)').fill(v)
    p.wait_for_timeout(200); chk(p.locator('.medio-caja.con-dif').count() == 3, f'{pre}: diferencias de caja en rojo'); shot(p, f'{pre}-16-caja-con-diferencia', full=True); axe(p, f'{pre}-caja')
    p.get_by_role('button', name='Cerrar caja', exact=True).click(); chk('Explica el motivo' in p.inner_text('#principal'), f'{pre}: la diferencia exige nota')
    p.get_by_label(re.compile('^Nota')).fill('Prueba de cierre con diferencia'); p.get_by_role('button', name='Cerrar caja', exact=True).click(); confirmar(p, '^Sí, cerrar'); p.wait_for_timeout(600)
    chk('Cerrada por' in p.inner_text('#principal'), f'{pre}: caja cerrada'); shot(p, f'{pre}-17-caja-cerrada', full=True)
    ir(p, 'vender'); chk(si(p, r'^Cobrar S.').is_disabled(), f'{pre}: con la caja cerrada no se debe vender'); chk('ya está cerrada' in p.inner_text('#principal'), f'{pre}: aviso de caja cerrada')
    ir(p, 'caja'); p.get_by_role('button', name='Reabrir caja').click(); d = p.get_by_role('dialog').last; d.get_by_role('button', name=re.compile('^Sí, reabrir')).click(); chk('Escribe el motivo' in d.inner_text(), f'{pre}: reapertura exige motivo')
    d.get_by_label('Motivo de la reapertura').fill('Falta anotar una venta de la tarde'); d.get_by_role('button', name=re.compile('^Sí, reabrir')).click(); p.wait_for_timeout(700)
    chk(p.get_by_role('button', name='Cerrar caja', exact=True).count() == 1, f'{pre}: la caja debe quedar reabierta')
    # ---- cuaderno
    ir(p, 'cuaderno'); shot(p, f'{pre}-18-cuaderno', full=True); axe(p, f'{pre}-cuaderno')
    ruta, nom = descarga(p, p.get_by_role('button', name=re.compile('Descargar en PDF'))); t = texto_pdf(ruta); chk('CUADERNO DEL' in t and 'Resumen del día' in t, f'{pre}: PDF del cuaderno'); pdf_a_png(ruta, f'{pre}-19-cuaderno-pdf')
    # ---- más: excel, respaldo, verificación
    ir(p, 'mas'); shot(p, f'{pre}-20-mas', full=True)
    ruta, nom = descarga(p, p.get_by_role('button', name='Todo en un solo Excel')); chk(nom.endswith('.xlsx'), f'{pre}: Excel de todo')
    z = subprocess.run(['python3', '-c', f"import zipfile;print(','.join(n for n in zipfile.ZipFile('{ruta}').namelist() if 'sheet' in n))"], capture_output=True, text=True).stdout; chk(z.count('worksheets/sheet') >= 6, f'{pre}: el Excel debe tener 6 hojas o más')
    ruta, nom = descarga(p, p.get_by_role('button', name='Descargar respaldo ahora')); j = json.load(open(ruta)); chk(j['app'] == 'megans-v2' and len(j['datos']['productos']) == 68 and len(j['datos']['ventas']) > 400, f'{pre}: respaldo JSON completo')
    # la guía verificada
    p.get_by_label('Número de guía').fill(vid); p.get_by_label('Código de verificación').fill('AAAA-BBBB-CCCC'); p.get_by_role('button', name='Verificar', exact=True).click(); chk('no coincide' in p.inner_text('#principal'), f'{pre}: código malo debe rechazarse')
    return vid

def flujo_restaurar(p, pre):
    ir(p, 'mas')
    ruta = [f for f in sorted(os.listdir('/tmp')) if f.startswith('megans-e2e-') and f.endswith('.json') and 'malo' not in f][-1]
    p.locator('input[type=file]').set_input_files('/tmp/' + ruta); confirmar(p, '^Sí, restaurar'); p.wait_for_timeout(900); chk('estaur' in p.inner_text('.toast-zona'), 'restaurar el respaldo debe confirmarse')
    bad = '/tmp/megans-e2e-malo.json'; open(bad, 'w').write('{"app":"otra","datos":{}}')
    p.locator('input[type=file]').set_input_files(bad); confirmar(p, '^Sí, restaurar'); p.wait_for_timeout(700); chk('no es una copia' in p.inner_text('.toast-zona'), f'{pre}: un respaldo ajeno debe rechazarse')

def flujo_coadmin(p, pre):
    entrar(p, 'coadmin'); chk('Utilidad de hoy' in p.inner_text('#principal'), f'{pre}: el co-administrador ve la utilidad')
    ir(p, 'inventario'); p.get_by_role('button', name=re.compile('^Editar Caja de 4 polos')).click(); chk(p.get_by_label('Precio de venta (S/)').is_disabled() and p.get_by_label('Costo (S/)').is_disabled(), f'{pre}: coadmin no cambia precios')
    shot(p, f'{pre}-21-coadmin-editar-producto'); p.keyboard.press('Escape')
    ir(p, 'ventas'); p.get_by_role('button', name=re.compile('^Abrir venta')).first.click(); p.wait_for_selector('h1:has-text("Guía")')
    chk(p.get_by_role('button', name='Anular venta').count() == 0, f'{pre}: coadmin no anula'); chk(p.get_by_role('button', name='Registrar devolución').count() == 0, f'{pre}: coadmin no registra devoluciones (solo la administradora)')
    ir(p, 'caja'); chk(p.get_by_role('button', name='Reabrir caja').count() == 0, f'{pre}: coadmin no reabre cajas')
    ir(p, 'mas'); chk(p.get_by_role('button', name='Descargar respaldo ahora').count() == 0 and p.get_by_role('button', name='Todo en un solo Excel').count() == 1, f'{pre}: coadmin exporta pero no respalda')

def flujo_vendedor(p, pre, movil):
    entrar(p, 'vendedor1'); txt = p.inner_text('body')
    chk('Costo' not in txt and 'Utilidad' not in txt, f'{pre}: el vendedor no debe ver costos ni utilidad')
    chk(p.locator('nav:visible button').count() == 5 or movil, f'{pre}: el vendedor tiene pocas opciones')
    shot(p, f'{pre}-22-vendedor-inicio', full=True); axe(p, f'{pre}-vendedor-inicio')
    p.evaluate("location.hash='#/inventario'"); p.wait_for_timeout(800); chk('#/inicio' in p.url, f'{pre}: ruta de inventario bloqueada para vendedor')
    ir(p, 'vender'); buscar(p, 'Caja de 5 polos'); producto(p, 'Caja de 5 polos'); p.get_by_role('radio', name='Pendiente').click(); p.get_by_label(re.compile('^Nombre del cliente')).fill('Cliente que debe'); p.get_by_role('button', name=re.compile(r'^Cobrar S.')).click(); p.wait_for_selector('text=¡Venta registrada!'); vid = p.locator('.exito strong').inner_text()
    p.get_by_role('button', name=re.compile('^Ver guía')).click(); p.wait_for_selector('h1:has-text("Guía")'); chk(p.get_by_role('button', name='Anular venta').count() == 0, f'{pre}: vendedor no anula')
    chk('Pendiente de cobro' in p.inner_text('#principal'), f'{pre}: venta pendiente')
    ir(p, 'ventas'); chk(p.get_by_role('button', name=re.compile('^Abrir venta')).count() >= 1, f'{pre}: el vendedor ve sus ventas')
    ir(p, 'caja'); shot(p, f'{pre}-23-vendedor-caja', full=True)
    # el vendedor no puede ver ventas ajenas por URL
    ajena = p.evaluate("()=>{const d=JSON.parse(localStorage.getItem('megans-electric-v2:datos'));const me=d.usuarios.find(u=>u.usuario==='vendedor1').id;return d.ventas.find(v=>v.vendedorId!==me).id}"); p.evaluate(f"location.hash='#/ventas/{ajena}'"); p.wait_for_timeout(700); chk('No se encontró esa venta' in p.inner_text('#principal'), f'{pre}: vendedor no abre ventas de otros')

def bloqueo(p):
    a_login(p)
    for i in range(5):
        p.get_by_label('Usuario').fill('vendedor2'); p.get_by_label('Contraseña', exact=True).fill('mal' + str(i)); p.get_by_role('button', name='Entrar').click(); p.wait_for_timeout(250)
    p.get_by_label('Usuario').fill('vendedor2'); p.get_by_label('Contraseña', exact=True).fill('vendedor2'); p.get_by_role('button', name='Entrar').click(); p.wait_for_timeout(300)
    chk('Demasiados intentos' in p.inner_text('.acceso-card'), 'bloqueo tras 5 intentos fallidos'); p.reload(); p.wait_for_timeout(600)
    p.get_by_label('Usuario').fill('vendedor2'); p.get_by_label('Contraseña', exact=True).fill('vendedor2'); p.get_by_role('button', name='Entrar').click(); p.wait_for_timeout(300)
    chk('Demasiados intentos' in p.inner_text('.acceso-card'), 'el bloqueo sobrevive a recargar la página')

def temas_oscuro(p, pre):
    entrar(p, 'admin'); tema(p, True)
    for r, n in [('inicio', 'panel'), ('vender', 'venta'), ('inventario', 'inventario'), ('tiendas', 'tiendas'), ('caja', 'caja'), ('cuaderno', 'cuaderno'), ('mas', 'mas')]:
        ir(p, r); tema(p, True); axe(p, f'{pre}-oscuro-{n}')
        if n in ('panel', 'caja'): shot(p, f'{pre}-30-oscuro-{n}', full=True)
    ir(p, 'ventas'); p.get_by_role('button', name=re.compile('^Abrir venta')).first.click(); p.wait_for_selector('h1:has-text("Guía")'); tema(p, True); axe(p, f'{pre}-oscuro-guia')

def flujo_pantallas_nuevas(p, pre):
    # Conciliación (solo admin) y Etiquetas y escaneo (admin y coadmin), con axe AA en claro y oscuro; escaneo por teclado
    entrar(p, 'admin')
    ir(p, 'conciliacion'); t = p.inner_text('#principal'); chk('Pagos por verificar' in t and 'Pendientes sin cobrar' in t, f'{pre}: pantalla de conciliación'); axe(p, f'{pre}-conciliacion')
    ir(p, 'etiquetas'); axe(p, f'{pre}-etiquetas'); tema(p, True); axe(p, f'{pre}-oscuro-etiquetas'); tema(p, False)
    cod = p.evaluate("()=>JSON.parse(localStorage.getItem('megans-electric-v2:datos')).productos.find(x=>x.codigo&&x.activo).codigo")
    p.get_by_label('Código escaneado').fill(cod); p.get_by_label('Código escaneado').press('Enter'); p.wait_for_timeout(200)
    chk(p.get_by_role('button', name='Ingresar 1 unidades').count() + p.get_by_role('button', name='Ingresar 1 unidad').count() >= 1, f'{pre}: el escaneo por teclado suma al ingreso')
    ir(p, 'conciliacion'); tema(p, True); axe(p, f'{pre}-oscuro-conciliacion'); tema(p, False)
    p.evaluate("localStorage.removeItem('megans-electric-v2:sesion')"); p.reload(); entrar(p, 'coadmin')
    ir(p, 'etiquetas'); chk('Etiquetas' in p.locator('#principal h1').inner_text(), f'{pre}: el coadmin usa etiquetas')
    p.evaluate("location.hash='#/conciliacion'"); p.wait_for_timeout(600); chk('Conciliación' not in p.locator('#principal h1').inner_text(), f'{pre}: el coadmin no verifica pagos')

if __name__ == '__main__':
    with sync_playwright() as pw:
        b = lanzar(pw)
        c, p = nuevo(b, VP[0][1], False, bypass=False); a_login(p); shot(p, 'escritorio-01-acceso'); bloqueo(p); entrar(p, 'admin'); ir(p, 'vender'); ir(p, 'mas'); c.close()
        c, p = nuevo(b, VP[0][1], False); a_login(p); axe(p, 'escritorio-acceso'); c.close()
        c, p = nuevo(b, VP[1][1], True); a_login(p); shot(p, 'celular-01-acceso'); axe(p, 'celular-acceso'); c.close()
        for nombre, vp, mob in VP:
            pre = 'escritorio' if nombre == 'escritorio' else 'celular'
            c, p = nuevo(b, vp, mob); flujo_admin(p, pre, mob)
            if pre == 'escritorio': flujo_restaurar(p, pre)
            c.close()
            c, p = nuevo(b, vp, mob); flujo_coadmin(p, pre); c.close()
            c, p = nuevo(b, vp, mob); flujo_vendedor(p, pre, mob); c.close()
            c, p = nuevo(b, vp, mob); flujo_pantallas_nuevas(p, pre); c.close()
        for nombre, vp, mob in VP:
            c, p = nuevo(b, vp, mob, tema='dark'); temas_oscuro(p, nombre); c.close()
        b.close()
    n = reporte(); print('FALLOS FUNCIONALES:', len(fallos)); [print(' -', f) for f in fallos]
    sys.exit(1 if (n or fallos) else 0)
