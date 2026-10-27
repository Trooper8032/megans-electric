# Mide la precisión de la voz con audios sintéticos (piper) que están FUERA del repositorio (/workspace/megans-ia-pruebas).
# 1) En Chrome (CSP real, sin bypass) sube cada audio al asistente y guarda lo que Whisper escuchó y cuánto tardó.
# 2) node scripts/eval_voz.mjs compara lo entendido con lo esperado.
import sys, os, json, time, glob
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from comun import *
D = os.environ.get('PRUEBAS', '/workspace/megans-ia-pruebas')
res = []
with sync_playwright() as pw:
    b = lanzar(pw); c, p = nuevo(b, {'width': 1440, 'height': 900}, False, bypass=False)
    entrar(p, 'admin'); p.get_by_role('button', name='Asistente de voz').first.click(); p.wait_for_timeout(300)
    for f in sorted(glob.glob(f'{D}/audios/*.wav')):
        n = os.path.basename(f)[:-4]; p.reload(); p.wait_for_timeout(800)
        p.get_by_role('button', name='Asistente de voz').first.click(); p.wait_for_timeout(300)
        t0 = time.time(); p.locator('[data-prueba=subir-audio]').set_input_files(f)
        p.wait_for_selector('.ia-escuche', timeout=120000); ms = round((time.time() - t0) * 1000)
        p.wait_for_timeout(200)
        txt = p.locator('.ia-escuche').inner_text().replace('Escuché: «', '').rstrip('»')
        res.append({'archivo': n, 'escuchado': txt, 'ms': ms}); print(n, ms, txt, flush=True)
    b.close()
json.dump(res, open(f'{D}/transcripciones.json', 'w'), ensure_ascii=False, indent=1)
