# E2E de voz e IA con la CSP real (bypass=False). Audios y muestras: /workspace/megans-ia-pruebas (fuera del repo).
import sys, os, time, json, subprocess
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from comun import *
D = '/workspace/megans-ia-pruebas'; A = f'{D}/audios'; T = {}; fallas = []
def ok(c, m):
    if not c: fallas.append(m); print('FALLA', m)
def asis(p): p.get_by_role('button', name='Asistente de voz').first.click(); p.wait_for_timeout(300)
def oir(p, cont, f, sel='.ia-escuche'):
    t0 = time.time(); p.locator(f'{cont} [data-prueba=subir-audio]').first.set_input_files(f); p.wait_for_selector(f'{cont} {sel}', timeout=120000); return round(time.time() - t0, 1)
def axe(p, nombre):  # con CSP real no se puede inyectar <script>; se evalúa por el protocolo de depuración
    p.wait_for_timeout(700); p.evaluate('()=>{' + open(AXE).read() + '\n;window.axe=axe}') if not p.evaluate('()=>!!window.axe') else None
    r = p.evaluate("()=>axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}}).then(r=>r.violations.map(v=>({id:v.id,impact:v.impact,n:v.nodes.length,ej:v.nodes[0].target.join(' ')})))")
    axe_res.append((nombre, r))
def entrar(p, u, _e=entrar):
    if p.url.startswith(URL) and p.locator('#principal').count():
        p.evaluate("()=>[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Cerrar sesión'))?.click()"); p.wait_for_timeout(500)
        if p.get_by_role('dialog').count(): p.get_by_role('dialog').get_by_role('button', name='Cerrar sesión', exact=False).last.click(); p.wait_for_timeout(400)
    _e(p, u)
def cerrar(p): p.keyboard.press('Escape'); p.wait_for_timeout(300)
with sync_playwright() as pw:
    b = lanzar(pw)
    for nvp, vp, mob in VP:
        P = lambda n: f'voz-{nvp}-{n}'
        c, p = nuevo(b, vp, mob, bypass=False)
        # 1) Venta por voz (vendedor)
        entrar(p, 'vendedor1'); ir(p, 'vender')
        T.setdefault('venta', []).append(oir(p, '[aria-label="Vender por voz"]', f'{A}/v2-es_MX.wav'))
        txt = p.locator('#principal').inner_text(); ok('Caja de 2 polos' in txt and 'Caja de 24 polos' in txt, 'venta voz agrega líneas')
        ok(p.get_by_role('button', name='Cobrar').count() > 0, 'botón Cobrar sigue manual'); shot(p, P('01-venta-por-voz')); axe(p, P('venta'))
        ir(p, 'vender'); oir(p, '[aria-label="Vender por voz"]', f'{A}/v1-es_MX.wav')
        ok('No está en el catálogo' in p.locator('#principal').inner_text() or '¿Cuál es?' in p.locator('#principal').inner_text(), 'venta voz marca dudas'); shot(p, P('02-venta-dudas'))
        # 2) Vendedor: sin ingreso, sin utilidad
        asis(p); oir(p, '[role=dialog]', f'{A}/q6-es_MX.wav', '.ia-respuesta'); r = p.locator('[role=dialog]').inner_text()
        ok('utilidad' not in r.lower() or 'no' in r.lower(), 'vendedor no ve utilidad'); shot(p, P('03-vendedor-utilidad-negada')); cerrar(p)
        asis(p); oir(p, '[role=dialog]', f'{A}/i1-es_MX.wav', '.ia-respuesta'); shot(p, P('04-vendedor-ingreso-negado')); cerrar(p)
        ir(p, 'inventario'); ok(p.get_by_role('tab', name='Ingreso por voz o foto').count() == 0, 'vendedor sin pestaña ingreso')
        # 3) Admin: preguntas, anular bloqueado
        entrar(p, 'admin')
        for q in ['q1', 'q6']:
            asis(p); T.setdefault('pregunta', []).append(oir(p, '[role=dialog]', f'{A}/{q}-es_MX.wav', '.ia-respuesta')); shot(p, P(f'05-pregunta-{q}')); axe(p, P('asistente-'+q)); cerrar(p)
        asis(p); oir(p, '[role=dialog]', f'{A}/c3-es_MX.wav', '.ia-respuesta'); ok('anul' in p.locator('[role=dialog]').inner_text().lower(), 'anular bloqueado'); shot(p, P('06-anular-bloqueado')); cerrar(p)
        # 4) Ingreso por voz (coadmin) y por foto (admin)
        entrar(p, 'coadmin'); ir(p, 'inventario/ingreso'); p.wait_for_timeout(500)
        T.setdefault('ingreso', []).append(oir(p, '[aria-label="Ingreso de mercadería con IA"]', f'{A}/i2-es_MX.wav', '[aria-label="Productos que entran"]'))
        ok('Costo' not in p.locator('[aria-label="Productos que entran"]').inner_text(), 'coadmin sin costo'); shot(p, P('07-ingreso-voz-coadmin')); axe(p, P('ingreso'))
        p.locator('[aria-label="Ingreso de mercadería con IA"]').get_by_role('button', name='Revisar e ingresar', exact=False).first.click(); p.wait_for_timeout(400); shot(p, P('08-ingreso-confirmar'))
        p.get_by_role('button', name='Sí, ingresar', exact=False).click(); p.wait_for_timeout(800)
        p.get_by_role('tab', name='Movimientos').click(); p.wait_for_timeout(500); mv = p.locator('#principal').inner_text()
        ok('Ingreso por voz' in mv and 'Co-administrador' in mv, 'movimiento con autor'); shot(p, P('09-movimiento-autor'))
        entrar(p, 'admin'); ir(p, 'inventario/ingreso'); p.get_by_role('tab', name='Foto de la factura o guía').click(); p.wait_for_timeout(300)
        t0 = time.time(); p.locator('[data-prueba=subir-factura]').set_input_files(f'{D}/factura-muestra-foto.jpg')
        p.wait_for_selector('[aria-label="Productos que entran"]', timeout=180000); T.setdefault('ocr', []).append(round(time.time() - t0, 1))
        filas = p.locator('[aria-label="Productos que entran"] tbody tr'); n = filas.count()
        el = p.evaluate("()=>[...document.querySelectorAll('[aria-label=\"Productos que entran\"] tbody select')].map(s=>s.selectedOptions[0]?.text||'')")
        T.setdefault('ocr_filas', []).append({'filas': n, 'productos': el}); shot(p, P('10-factura-ocr'), True)
        # 5) Conciliación: revisar captura
        ir(p, 'conciliacion'); bt = p.get_by_role('button', name='Revisar captura')
        if bt.count():
            li = bt.first.locator('xpath=ancestor::li[1]').inner_text(); T.setdefault('pago', []).append(li)
            bt.first.click(); p.wait_for_timeout(300)
            p.locator('[data-prueba=subir-captura]').set_input_files(f'{D}/captura-revisar.png'); p.wait_for_timeout(500)
            p.wait_for_selector('[role=dialog] .ia-captura', timeout=120000); shot(p, P('11-captura-revisar')); axe(p, P('captura'))
            ok('Revisar' in p.locator('[role=dialog]').inner_text(), 'captura no coincide → Revisar'); cerrar(p)
            bt.first.click(); p.wait_for_timeout(300); p.locator('[data-prueba=subir-captura]').set_input_files(f'{D}/captura-coincide.png')
            p.wait_for_selector('[role=dialog] .ia-captura', timeout=120000); ok(p.locator('[role=dialog] .ia-captura').inner_text().count('Cuadra') == 3, 'captura igual → monto, fecha y operación cuadran'); shot(p, P('11b-captura-coincide')); cerrar(p)
            ok(p.get_by_role('button', name='Revisar captura').count() == bt.count(), 'no se verificó solo')
        else: fallas.append('sin pagos Yape/Plin por verificar')
        # 6) Mejorar foto
        ir(p, 'vender'); p.get_by_text('Más datos: celular, nota y foto').click(); p.wait_for_timeout(300); p.get_by_role('group', name='Foto de la venta (opcional)').locator('input[type=file]').last.set_input_files(f'{D}/producto-mesa.jpg'); p.wait_for_timeout(800)
        mj = p.get_by_role('button', name='Mejorar foto (quitar fondo)')
        if mj.count():
            t0 = time.time(); mj.first.click(); p.wait_for_selector('[role=dialog] button:has-text("Usar"):not([disabled])', timeout=120000); T.setdefault('fondo', []).append(round(time.time() - t0, 1))
            p.locator('[role=dialog] [aria-label="Color de fondo"] [role=radio]').nth(4).click(); p.wait_for_timeout(1200); shot(p, P('12-mejorar-foto')); axe(p, P('mejorar'))
        else: fallas.append('sin botón mejorar foto')
        c.close()
    b.close()
print(json.dumps(T, ensure_ascii=False, indent=1)); print('FALLAS:', fallas); n = reporte()
