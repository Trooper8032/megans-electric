# Ayudas compartidas por e2e.py y capturas.py (Playwright + Chrome local, con la vista previa en el puerto 4328).
import os, re
from playwright.sync_api import sync_playwright
URL = os.environ.get('URL', 'http://127.0.0.1:4328')
AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.abspath(os.path.join(AQUI, '..'))
OUT = os.path.join(RAIZ, 'capturas')
AXE = os.path.join(RAIZ, 'node_modules', 'axe-core', 'axe.min.js')
FOTO = os.environ.get('FOTO', '/tmp/foto-prueba.jpg')
VP = [('escritorio', {'width': 1440, 'height': 900}, False), ('celular', {'width': 390, 'height': 844}, True)]
errores, desbordes, axe_res = [], [], []

def lanzar(pw):
    return pw.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])

def nuevo(b, vp, mob, bypass=True, tema='light', sw='allow'):
    c = b.new_context(viewport=vp, device_scale_factor=1, is_mobile=mob, has_touch=mob, accept_downloads=True, locale='es-PE',
                      bypass_csp=bypass, color_scheme=tema, permissions=[], service_workers=sw)
    p = c.new_page()
    p.on('console', lambda m: errores.append(f'{m.type}: {m.text}') if m.type in ('error', 'warning') else None)
    p.on('pageerror', lambda e: errores.append('pageerror: ' + str(e)))
    return c, p

def desborde(p, n):
    w = p.evaluate('()=>[document.documentElement.scrollWidth, window.innerWidth]')
    if w[0] > w[1] + 1: desbordes.append((n, w))

def shot(p, n, full=False):
    p.evaluate('window.scrollTo(0,0)')
    p.wait_for_timeout(900); p.screenshot(path=f'{OUT}/{n}.png', full_page=full); desborde(p, n)

def sec(p, sel, n):
    p.locator(sel).first.scroll_into_view_if_needed(); p.wait_for_timeout(700); p.locator(sel).first.screenshot(path=f'{OUT}/{n}.png')

def nav(p, nombre):
    p.locator('nav:visible').get_by_role('button', name=nombre, exact=True).click(); p.wait_for_timeout(450)

def axe(p, nombre):
    p.wait_for_timeout(900); p.add_script_tag(path=AXE)
    r = p.evaluate("()=>axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}}).then(r=>r.violations.map(v=>({id:v.id,impact:v.impact,n:v.nodes.length,ej:v.nodes[0].target.join(' '),res:v.help})))")
    axe_res.append((nombre, r)); desborde(p, 'axe-' + nombre)

def a_login(p):
    p.goto(URL); p.wait_for_timeout(500)

def entrar(p, usuario, clave=None, espera='h1'):
    a_login(p); p.get_by_label('Usuario').fill(usuario); p.get_by_label('Contraseña', exact=True).fill(clave or usuario)
    p.get_by_role('button', name='Entrar').click(); p.wait_for_selector('#principal h1', timeout=15000); p.wait_for_timeout(500)

def ir(p, ruta):
    p.evaluate(f"location.hash='#/{ruta}'"); p.wait_for_timeout(500); p.wait_for_selector('#principal h1', timeout=8000)

def tema(p, oscuro):
    p.evaluate("(o)=>{const r=document.documentElement; r.setAttribute('data-tema', o?'oscuro':'claro')}", oscuro); p.wait_for_timeout(300)

def axe(p, nombre):
    p.wait_for_timeout(900); p.add_script_tag(path=AXE)
    r = p.evaluate("()=>axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}}).then(r=>r.violations.map(v=>({id:v.id,impact:v.impact,n:v.nodes.length,ej:v.nodes[0].target.join(' '),res:v.help})))")
    axe_res.append((nombre, r)); desborde(p, 'axe-' + nombre)

def reporte():
    print('ERRORES CONSOLA:', len(errores)); [print('  ', e) for e in sorted(set(errores))[:10]]
    print('DESBORDES:', desbordes)
    tot = 0
    for n, r in axe_res:
        for v in r: tot += 1; print('AXE', n, v)
    print('AXE violaciones:', tot, 'en', len(axe_res), 'pantallas')
    return len(errores) + len(desbordes) + tot
