import sys, re, os, subprocess
sys.path.insert(0, os.path.dirname(__file__))
from comun import *
from playwright.sync_api import sync_playwright
fallas = []
def chk(c, m):
    if not c: fallas.append(m); print('FALLA', m)
def S(p, n, full=False): shot(p, 'v3-' + n, full)
def run(pw):
    b = pw.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'])
    for nombre, vp, mob in VP:
        pre = 'esc' if nombre == 'escritorio' else 'cel'
        c, p = nuevo(b, vp, mob); c.grant_permissions(['camera'], origin=URL)
        entrar(p, 'admin')
        # 1) buscador desplegable
        ir(p, 'vender'); inp = p.get_by_label('Buscar producto por nombre'); inp.click(); p.wait_for_timeout(300)
        S(p, f'{pre}-01-selector-favoritos')
        inp.fill('caja'); p.wait_for_timeout(300); n = p.locator('.combo-op').count(); chk(0 < n <= 8, f'{pre}: combobox {n}')
        S(p, f'{pre}-02-selector-filtrando')
        inp.press('ArrowDown'); inp.press('Enter'); p.wait_for_timeout(300)
        chk(p.locator('.linea-carro').count() == 1, f'{pre}: Enter agrega')
        # 2) cantidad
        q = p.locator('.linea-carro input[aria-label^="Cantidad de"]').first; q.click(); q.press('Backspace'); p.wait_for_timeout(200)
        chk(p.locator('.linea-carro').count() == 1, f'{pre}: borrar no quita el producto'); q.type('12'); p.wait_for_timeout(200)
        S(p, f'{pre}-03-cantidad-escribiendo')
        q.press('Enter'); p.wait_for_timeout(200); chk(q.input_value() == '12', f'{pre}: cantidad 12')
        q.click(); q.press('Backspace'); q.press('Backspace'); q.type('0'); q.press('Tab'); p.wait_for_timeout(200)
        chk(q.input_value() == '12' and p.locator('.linea-carro').count() == 1, f'{pre}: 0 vuelve al valor anterior')
        p.locator('.carro').scroll_into_view_if_needed(); p.wait_for_timeout(300); p.locator('.carro').screenshot(path=f'{OUT}/v3-{pre}-04-cantidad-validada.png')
        # 3) inventario escaner
        ir(p, 'inventario'); S(p, f'{pre}-05-inventario-boton-escanear')
        p.get_by_role('button', name='Escanear con cámara').click(); p.wait_for_timeout(1500); S(p, f'{pre}-06-inventario-camara')
        p.get_by_role('button', name='Cerrar cámara').first.click()
        cod = p.evaluate("()=>{const d=JSON.parse(Object.entries(localStorage).find(([k,v])=>v.includes('\"productos\"'))[1]); return d.productos.find(x=>x.codigo&&x.id!=='PRD-999').codigo}")
        bus = p.get_by_label('Buscar producto'); bus.fill(cod); bus.press('Enter'); p.wait_for_timeout(400)
        chk(p.locator('.leido button', has_text='Ingresar').count() == 1, f'{pre}: escaneo encuentra producto'); S(p, f'{pre}-07-inventario-escaneado')
        p.locator('.leido').get_by_role('button', name='Cerrar').click()
        bus.fill('7759999999999'); bus.press('Enter'); p.wait_for_timeout(400)
        S(p, f'{pre}-08-inventario-codigo-nuevo')
        p.get_by_role('button', name='Crear producto con este código').click(); p.wait_for_timeout(400); S(p, f'{pre}-09-crear-con-codigo')
        p.keyboard.press('Escape'); p.wait_for_timeout(300)
        # 6) costo solo en editar (admin)
        p.get_by_role('button', name=re.compile('^Editar ')).first.click(); p.wait_for_timeout(400); chk(p.get_by_label(re.compile('^Costo')).count() == 1, f'{pre}: admin ve costo'); S(p, f'{pre}-10-admin-editar-con-costo')
        p.keyboard.press('Escape')
        # 4/5) guía sin QR ni firma
        ir(p, 'ventas'); p.locator('.fila-tarjeta').first.click(); p.wait_for_timeout(600)
        txt = p.inner_text('#principal'); chk('irma' not in txt and p.locator('.guia-qr').count() == 0, f'{pre}: guía sin firma/QR'); S(p, f'{pre}-11-guia-sin-qr-ni-firma', full=True)
        if pre == 'esc':
            with p.expect_download() as d: p.get_by_role('button', name=re.compile('^Descargar guía en PDF')).click()
            r = d.value.path(); t = subprocess.run(['pdftotext', '-layout', r, '-'], capture_output=True, text=True).stdout
            chk('Firma' not in t and 'Conformidad' not in t and 'VERIFICACIÓN' in t, 'pdf guía'); subprocess.run(['pdftoppm', '-png', '-r', '70', '-f', '1', '-l', '1', '-singlefile', r, f'{OUT}/v3-pdf-guia'])
        # 7) tiendas
        ir(p, 'tiendas'); S(p, f'{pre}-12-tiendas-lista')
        p.locator('.fila-tarjeta').first.click(); p.wait_for_timeout(500); S(p, f'{pre}-13-tienda-detalle', full=True)
        p.get_by_role('button', name=re.compile('Nuevo envío')).click(); p.wait_for_timeout(300)
        si = p.locator('.modal input[aria-label="Buscar producto por nombre"]'); si.fill('caja'); p.wait_for_timeout(300); si.press('Enter'); p.wait_for_timeout(200)
        p.get_by_label('Pago del envío').select_option('Parcial'); p.get_by_label('Monto pagado (S/)').fill('1'); p.get_by_label('Pagó con').select_option('Yape')
        p.locator('.modal').evaluate('m=>m.scrollTop=m.scrollHeight'); p.wait_for_timeout(300); S(p, f'{pre}-14-nuevo-envio-lleva-y-pago')
        p.get_by_role('button', name='Crear envío').click(); p.get_by_role('button', name=re.compile('^Sí, crear envío')).click(); p.wait_for_timeout(700)
        chk('Parcial' in p.inner_text('#principal'), f'{pre}: chip Parcial'); p.locator('.envio-t').first.scroll_into_view_if_needed(); p.wait_for_timeout(300); p.locator('.envio-t').first.screenshot(path=f'{OUT}/v3-{pre}-15-envio-con-chip-y-pago.png')
        p.get_by_role('button', name='Registrar pago de este envío').first.click(); p.wait_for_timeout(300); S(p, f'{pre}-16-registrar-pago-envio')
        p.keyboard.press('Escape'); p.wait_for_timeout(200)
        if pre == 'esc':
            with p.expect_download() as d: p.get_by_role('button', name=re.compile('Hoja de envío')).first.click()
            r = d.value.path(); t = subprocess.run(['pdftotext', '-layout', r, '-'], capture_output=True, text=True).stdout
            chk('Lo lleva' in t.replace('LO LLEVA', 'Lo lleva') and 'Entrega:' not in t and 'PARCIAL' in t, 'pdf envío: ' + t[:300]); subprocess.run(['pdftoppm', '-png', '-r', '70', '-f', '1', '-l', '1', '-singlefile', r, f'{OUT}/v3-pdf-hoja-envio'])
            with p.expect_download() as d:
                ir(p, 'cuaderno'); p.get_by_role('button', name=re.compile('PDF')).first.click()
            t = subprocess.run(['pdftotext', '-layout', d.value.path(), '-'], capture_output=True, text=True).stdout; chk('firma' not in t.lower(), 'pdf caja sin firma')
        c.close()
        # coadmin: sin costo ni utilidad
        c, p = nuevo(b, vp, mob); entrar(p, 'coadmin')
        chk('Utilidad' not in p.inner_text('#principal'), f'{pre}: coadmin sin utilidad'); S(p, f'{pre}-17-coadmin-inicio-sin-utilidad', full=True)
        ir(p, 'inventario'); p.get_by_role('button', name=re.compile('^Editar ')).first.click(); p.wait_for_timeout(400)
        chk(p.get_by_label(re.compile('^Costo')).count() == 0, f'{pre}: coadmin no ve costo'); S(p, f'{pre}-18-coadmin-editar-sin-costo'); c.close()
        # vendedor: mis envíos
        c, p = nuevo(b, vp, mob); entrar(p, 'vendedor1'); ir(p, 'misenvios')
        chk('Mis envíos' in p.inner_text('#principal') and p.locator('.envio-t').count() > 0 and p.get_by_role('button', name=re.compile('Registrar pago')).count() == 0, f'{pre}: vendedor mis envíos')
        S(p, f'{pre}-19-vendedor-mis-envios', full=True)
        if mob: ir(p, 'mas'); S(p, f'{pre}-20-vendedor-mas-acceso', full=True)
        c.close()
    b.close()
with sync_playwright() as pw: run(pw)
print('errores consola:', [e for e in errores if 'camera' not in e.lower()][:10]); print('desbordes:', desbordes); print('FALLAS', fallas)
