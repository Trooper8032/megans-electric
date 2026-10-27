# E2E de las decisiones de Sandro (etapas A–E): venta delegada en tiempo real, guía con historial y pagos parciales,
# conciliación con verificación y duplicados, colores de pago, etiquetas Code128 en PDF, venta e ingreso por escaneo
# (lector USB = escribir + Enter; cámara falsa de Chrome con un código real → decodificador local).
# Capturas nuevo-<vista>-NN en capturas/ a 390 y 1440, con axe AA. Requiere la vista previa en el puerto 4328.
import re, sys, os, json, subprocess
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from comun import *

fallos = []
def chk(cond, msg):
    if not cond: fallos.append(msg); print('FALLA:', msg)
    return cond
DATOS = "()=>JSON.parse(localStorage.getItem('megans-electric-v2:datos'))"
VISTAS = [('celular', {'width': 390, 'height': 844}, True), ('escritorio', {'width': 1440, 'height': 900}, False)]
def si(p): p.get_by_role('dialog').last.get_by_role('button', name=re.compile('^Sí')).click(); p.wait_for_timeout(500)
def cobrar(p): p.get_by_role('button', name=re.compile(r'^Cobrar S.')).click(); p.wait_for_selector('text=¡Venta registrada!', timeout=8000); return p.locator('.exito strong').first.inner_text()
def prod_ok(d, excl=()): return next(x for x in d['productos'] if x['id'] != 'PRD-999' and x['activo'] and x['stock'] > 20 and x['precio'] > 0 and x['codigo'] and x['id'] not in excl)

def flujo(b, vista, vp, mob):
    pre = f'nuevo-{vista}'
    c, A = nuevo(b, vp, mob)
    B = c.new_page(); B.on('pageerror', lambda e: errores.append('pageerror: ' + str(e)))
    entrar(A, 'admin')
    # segunda pestaña del mismo navegador (comparte el almacenamiento): la sesión de la administradora se cambia por la del vendedor
    B.goto(URL); B.evaluate("localStorage.removeItem('megans-electric-v2:sesion')"); entrar(B, 'vendedor1'); ir(B, 'ventas')
    d = A.evaluate(DATOS); pr = prod_ok(d)
    # --- Etapa E: venta por escaneo con lector USB (escribe el código y Enter) + Etapa C: asignada a Vendedor 1 ---
    ir(A, 'vender'); A.get_by_label('Buscar producto por nombre').fill(pr['codigo']); A.get_by_label('Buscar producto por nombre').press('Enter'); A.wait_for_timeout(300)
    chk(f"Agregado: {pr['nombre']}" in A.inner_text('#principal'), f'{pre}: el lector (código + Enter) debe agregar el producto al carrito')
    A.get_by_label(re.compile('^Nombre del cliente')).fill('Obra Los Pinos'); A.get_by_label('Vendedor').select_option('U-V01')
    A.get_by_role('radio', name='Yape').click(); A.wait_for_timeout(200)
    chk('le aparecerá al instante' in A.inner_text('#principal'), f'{pre}: aviso de venta asignada')
    cobrar_btn = A.get_by_role('button', name=re.compile(r'^Cobrar S.')); cobrar_btn.click(); A.wait_for_timeout(250)
    chk('número de operación de yape' in A.inner_text('#principal').lower(), f'{pre}: Yape sin número de operación debe pedirlo')
    A.get_by_label(re.compile('^Número de operación de Yape')).fill('70112233')
    shot(A, f'{pre}-01-colores-pago-venta-asignada', full=True); axe(A, f'{pre}-vender-asignada')
    A.evaluate("()=>{const h=document.getElementById('t-medio'); window.scrollTo(0, h.getBoundingClientRect().top + window.scrollY - 90)}"); A.wait_for_timeout(600); A.screenshot(path=f'{OUT}/{pre}-01b-colores-pago-detalle.png')
    vid = cobrar(A)
    # el vendedor la ve sin recargar
    try: B.wait_for_selector('text=Nueva venta asignada', timeout=9000); ok = True
    except Exception: ok = False
    chk(ok, f'{pre}: el vendedor debe recibir el aviso de la venta asignada sin recargar')
    chk(B.locator(f'text=Obra Los Pinos').count() >= 1, f'{pre}: la venta asignada debe aparecer en "Mis ventas" del vendedor')
    B.wait_for_timeout(300); shot(B, f'{pre}-02-venta-delegada-vendedor', full=True); axe(B, f'{pre}-delegada')
    v = next(x for x in B.evaluate(DATOS)['ventas'] if x['id'] == vid)
    chk(v['vendedorId'] == 'U-V01' and v['registradoPor'] == 'U-ADM' and v['pagos'][0]['operacion'] == '70112233', f'{pre}: datos de la venta delegada')
    # --- vendedor: Yape por verificar y un número de operación repetido ---
    for i in range(2):
        ir(B, 'vender'); (B.locator('.exito').get_by_role('button', name='Nueva venta').click() if B.locator('.exito').count() else None); B.locator('.rapido:not([disabled])').first.click(timeout=8000); B.get_by_label(re.compile('^Nombre del cliente')).fill(f'Cliente Yape {i + 1}')
        B.get_by_role('radio', name='Yape').click(); B.get_by_label(re.compile('^Número de operación de Yape')).fill('55667788'); cobrar(B)
    dB = B.evaluate(DATOS); ys = [x for x in dB['ventas'] if x['cliente'].startswith('Cliente Yape')][-2:]
    chk(all(x['pagos'][0]['estado'] == 'Por verificar' for x in ys) and ys[-1]['pagos'][0]['duplicado'], f'{pre}: Yape del vendedor queda por verificar y el repetido se marca')
    # --- Etapa B: guía con historial, pago parcial, producto agregado después y pago con comprobante ---
    ir(A, 'vender'); (A.locator('.exito').get_by_role('button', name='Nueva venta').click() if A.locator('.exito').count() else None); A.locator('.rapido:not([disabled])').first.click(); A.get_by_label(re.compile('^Nombre del cliente')).fill('Taller Sol')
    A.get_by_role('radio', name='Pendiente').click(); gid = cobrar(A)
    A.get_by_role('button', name=re.compile('^Ver guía')).click(); A.wait_for_selector(f'h1:has-text("{gid}")')
    A.get_by_role('button', name='Cobrar con Efectivo').click(); A.get_by_label('Monto del pago (S/)').fill('1'); A.get_by_role('button', name='Registrar pago con Efectivo').click(); si(A)
    chk('Pago parcial' in A.inner_text('#principal'), f'{pre}: la guía debe mostrar pago parcial')
    A.get_by_role('button', name='Agregar productos a esta venta').click(); A.locator('.pos').last.get_by_role('button', name=re.compile(r'Quedan')).first.click()
    A.get_by_role('button', name='Agregar a la venta').click(); si(A)
    A.get_by_role('button', name='Cobrar con Yape').click(); A.get_by_label(re.compile('^Número de operación de Yape')).fill('99001122')
    A.locator('.cobrar-pend input[data-prueba="subir-foto-linea"]').set_input_files(FOTO); A.wait_for_selector('.cobrar-pend .foto-prev img', timeout=8000)
    A.get_by_role('button', name='Registrar pago con Yape').click(); si(A)
    g = next(x for x in A.evaluate(DATOS)['ventas'] if x['id'] == gid)
    chk(len(g['pagos']) == 2 and g['estadoCobro'] == 'Cobrado' and g['pagos'][1]['foto'] and g['version'] == 2, f'{pre}: guía con 2 pagos, comprobante y agregado')
    hist = ' '.join(h['que'] for h in g['historial']); chk('Pago de S/ 1.00 con Efectivo' in hist and 'Agregó' in hist and 'operación 99001122' in hist, f'{pre}: historial completo en la guía')
    A.wait_for_timeout(3800); shot(A, f'{pre}-03-guia-historial', full=True); axe(A, f'{pre}-guia')
    sec(A, 'section[aria-label="Historial de cambios"]', f'{pre}-03b-guia-historial-detalle')
    if vista == 'escritorio':
        with A.expect_download() as dl: A.get_by_role('button', name='Descargar guía en PDF').click()
        ruta = f'/tmp/guia-{gid}.pdf'; dl.value.save_as(ruta); t = subprocess.run(['pdftotext', '-layout', ruta, '-'], capture_output=True, text=True).stdout
        chk('Historial de la guía' in t and '99001122' in t and 'Agregó' in t, f'{pre}: el PDF de la guía trae el historial y los pagos')
        subprocess.run(['pdftoppm', '-png', '-r', '70', '-f', '2', '-l', '2', ruta, f'{OUT}/nuevo-guia-pdf-historial'])
    # --- Etapa D: conciliación y verificación ---
    ir(A, 'conciliacion'); txt = A.inner_text('#principal')
    chk('repetido' in txt and '55667788' in txt, f'{pre}: la conciliación alerta el número de operación repetido')
    chk('Pagos por verificar' in txt and 'Pendientes sin cobrar' in txt, f'{pre}: secciones de la conciliación')
    A.wait_for_timeout(3800); shot(A, f'{pre}-04-conciliacion', full=True); axe(A, f'{pre}-conciliacion'); shot(A, f'{pre}-04b-conciliacion-pantalla')
    n0 = len(A.evaluate(f"()=>{DATOS[4:]}.ventas.flatMap(v=>v.pagos||[]).filter(p=>p.estado==='Verificado')"))
    A.locator('.pagos-lista').first.get_by_role('button', name='Verificar').first.click(); si(A)
    n1 = len(A.evaluate(f"()=>{DATOS[4:]}.ventas.flatMap(v=>v.pagos||[]).filter(p=>p.estado==='Verificado')"))
    chk(n1 == n0 + 1, f'{pre}: verificar un pago desde la conciliación ({n0} → {n1})')
    ir(A, 'caja'); chk('solo pagos verificados' in A.inner_text('#principal'), f'{pre}: la caja indica que cuadra solo con verificados')
    A.wait_for_timeout(3800); shot(A, f'{pre}-05-caja-verificados', full=True); axe(A, f'{pre}-caja')
    # el vendedor no ve conciliación ni etiquetas
    B.evaluate("location.hash='#/conciliacion'"); B.wait_for_timeout(600); chk('Conciliación de pagos' not in B.inner_text('#principal'), f'{pre}: el vendedor no entra a conciliación')
    # --- Etapa E: etiquetas e ingreso por escaneo ---
    ir(A, 'etiquetas'); A.locator('.etq-fila input[type=checkbox]').nth(0).check(); A.locator('.etq-fila input[type=checkbox]').nth(1).check()
    A.get_by_label('Copias').first.fill('3')
    st0 = next(x for x in A.evaluate(DATOS)['productos'] if x['id'] == pr['id'])['stock']
    for _ in range(2): A.get_by_label('Código escaneado').fill(pr['codigo']); A.get_by_label('Código escaneado').press('Enter'); A.wait_for_timeout(150)
    A.get_by_label('Código escaneado').fill('NOEXISTE1'); A.get_by_label('Código escaneado').press('Enter'); A.wait_for_timeout(150)
    chk('No hay ningún producto' in A.inner_text('#principal'), f'{pre}: código desconocido avisa')
    A.wait_for_timeout(3800); shot(A, f'{pre}-06-etiquetas-escaneo', full=True); axe(A, f'{pre}-etiquetas'); sec(A, 'section[aria-label="Ingreso de mercadería por escaneo"]', f'{pre}-06b-ingreso-por-escaneo')
    A.get_by_role('button', name='Ingresar 2 unidades').click(); si(A)
    st1 = next(x for x in A.evaluate(DATOS)['productos'] if x['id'] == pr['id'])['stock']; chk(st1 == st0 + 2, f'{pre}: ingreso por escaneo suma stock ({st0} → {st1})')
    if vista == 'escritorio':
        with A.expect_download() as dl: A.get_by_role('button', name=re.compile('^Descargar etiquetas en PDF')).click()
        ruta = '/tmp/etiquetas.pdf'; dl.value.save_as(ruta); t = subprocess.run(['pdftotext', ruta, '-'], capture_output=True, text=True).stdout
        chk(t.count('MEG') >= 4 and 'S/' in t, f'{pre}: el PDF de etiquetas trae códigos y precios')
        subprocess.run(['pdftoppm', '-png', '-r', '60', '-f', '1', '-l', '1', ruta, f'{OUT}/nuevo-etiquetas-pdf'])
    c.close()
    return pr

def camara_panel(pw):
    # cámara falsa sin código (patrón de prueba de Chrome): muestra el panel del escáner abierto, buscando
    b = pw.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'])
    for vista, vp, mob in VISTAS:
        c = b.new_context(viewport=vp, is_mobile=mob, has_touch=mob, locale='es-PE', permissions=['camera'], bypass_csp=True)
        p = c.new_page(); p.on('pageerror', lambda e: errores.append('pageerror: ' + str(e)))
        entrar(p, 'admin'); ir(p, 'vender'); p.get_by_role('button', name='Escanear código con la cámara').click()
        p.wait_for_selector('.escaner video', timeout=8000); p.wait_for_timeout(1500)
        p.locator('.escaner').scroll_into_view_if_needed(); p.wait_for_timeout(400); p.screenshot(path=f'{OUT}/nuevo-{vista}-07-escaneo-camara.png'); axe(p, f'nuevo-{vista}-camara-abierta')
        c.close()
    b.close()

def camara(pw, codigo, nombre):
    subprocess.run(['node', os.path.join(AQUI, 'video_codigo.mjs'), codigo, '/tmp/cod.pgm'], check=True, timeout=30)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-loop', '1', '-i', '/tmp/cod.pgm', '-t', '6', '-r', '10', '-pix_fmt', 'yuv420p', '/tmp/cod.y4m'], check=True, timeout=60)
    b = pw.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--use-file-for-fake-video-capture=/tmp/cod.y4m'])
    for vista, vp, mob in VISTAS:
        pre = f'nuevo-{vista}'
        c = b.new_context(viewport=vp, is_mobile=mob, has_touch=mob, locale='es-PE', permissions=['camera'], bypass_csp=True)
        p = c.new_page(); p.on('pageerror', lambda e: errores.append('pageerror: ' + str(e)))
        entrar(p, 'admin'); ir(p, 'vender')
        p.get_by_role('button', name='Escanear código con la cámara').click(); p.wait_for_timeout(350)
        try: p.wait_for_selector(f'text=Agregado: {nombre}', timeout=12000); ok = True
        except Exception: ok = False
        chk(ok, f'{pre}: la cámara (decodificador local) debe leer {codigo} y agregarlo al carrito')
        shot(p, f'{pre}-08-escaneo-agregado'); axe(p, f'{pre}-escaneo')
        c.close()
    b.close()

with sync_playwright() as pw:
    b = lanzar(pw); pr = None
    for vista, vp, mob in VISTAS: pr = flujo(b, vista, vp, mob)
    b.close()
    camara(pw, pr['codigo'], pr['nombre'])
    camara_panel(pw)

malos = [(n, r) for n, r in axe_res if r]
print('ERRORES CONSOLA:', len([e for e in errores if 'pageerror' in e]), [e for e in errores if 'pageerror' in e][:5])
print('DESBORDES:', desbordes)
print('AXE violaciones:', sum(len(r) for _, r in malos), 'en', len(axe_res), 'pantallas', json.dumps(malos, ensure_ascii=False)[:1500])
print('FALLOS:', len(fallos))
sys.exit(1 if fallos or malos else 0)
