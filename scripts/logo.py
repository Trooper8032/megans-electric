# Genera logo transparente, íconos PWA y favicon desde el original (que no se modifica). Sin deformar.
from PIL import Image
import numpy as np
SRC = '/workspace/megans_appscript/megans_electric_logo.jpg'
a = np.asarray(Image.open(SRC).convert('RGB')).astype(float)
NAVY = np.array([43, 40, 120])
# Solo el rótulo (arriba): alfa por distancia al blanco hacia el azul marino.
z = a[:560]
alfa = np.clip((255 - z.min(axis=2)) / (255 - NAVY.min()), 0, 1) ** 0.9
rgba = np.dstack([np.tile(NAVY, (z.shape[0], z.shape[1], 1)), alfa * 255]).astype('uint8')
img = Image.fromarray(rgba, 'RGBA')
bb = img.getchannel('A').point(lambda v: 255 if v > 30 else 0).getbbox()
logo = img.crop((bb[0] - 6, bb[1] - 6, bb[2] + 6, bb[3] + 6))
logo.save('public/img/logo.png', optimize=True)
w, h = logo.size
logo.resize((640, round(640 * h / w)), Image.LANCZOS).save('public/img/logo-640.png', optimize=True)
# Letra M (emblema)
M = img.crop((120, 115, 374, 350)); M = M.crop(M.getchannel('A').point(lambda v: 255 if v > 30 else 0).getbbox())
def icono(lado, margen, redondo=True):
    base = Image.new('RGBA', (lado, lado), (43, 40, 120, 255))
    mm = np.asarray(M).copy(); mm[..., :3] = 255
    m2 = Image.fromarray(mm, 'RGBA')
    k = lado * (1 - 2 * margen) / max(m2.size); m2 = m2.resize((round(m2.width * k), round(m2.height * k)), Image.LANCZOS)
    base.alpha_composite(m2, ((lado - m2.width) // 2, (lado - m2.height) // 2))
    if redondo:
        from PIL import ImageDraw
        mk = Image.new('L', (lado, lado), 0); ImageDraw.Draw(mk).rounded_rectangle((0, 0, lado - 1, lado - 1), radius=lado // 5, fill=255)
        base.putalpha(mk)
    return base
icono(192, .2).save('public/icon-192.png'); icono(512, .2).save('public/icon-512.png')
icono(512, .30, False).save('public/icon-maskable-512.png'); icono(180, .2, False).save('public/apple-touch-icon.png')
icono(64, .16).save('public/favicon.png')
Image.fromarray(np.asarray(M)).save('public/img/emblema.png')
print(logo.size, M.size)
