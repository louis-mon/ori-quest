"""Détoure un PNG RGBA sur sa boîte alpha, le réduit, et le réécrit.

Pas de dépendance : ni Pillow ni ImageMagick sur cette machine, et `sips` ne
sait pas rogner à un offset arbitraire. Le PNG de l'artiste est en RGBA 8 bits
non entrelacé, ce qui tient en une centaine de lignes.

La moyenne des couleurs est **pondérée par l'alpha** : sans ça, les pixels
transparents (souvent noirs) tirent les bords du sujet vers le sombre et le
détourage se voit comme un liseré.
"""
import struct, sys, zlib


def lire(path):
    d = open(path, 'rb').read()
    assert d[:8] == b'\x89PNG\r\n\x1a\n', 'pas un PNG'
    i, idat, w, h, bd, ct = 8, b'', None, None, None, None
    while i < len(d):
        ln = struct.unpack('>I', d[i:i + 4])[0]
        typ, data = d[i + 4:i + 8], d[i + 8:i + 8 + ln]
        i += 12 + ln
        if typ == b'IHDR':
            w, h, bd, ct, comp, filt, inter = struct.unpack('>IIBBBBB', data)
            assert (bd, ct, inter) == (8, 6, 0), 'attendu RGBA 8 bits non entrelacé'
        elif typ == b'IDAT':
            idat += data
        elif typ == b'IEND':
            break
    raw, stride, lignes = zlib.decompress(idat), w * 4, []
    prev, p = bytearray(stride), 0
    for _ in range(h):
        f = raw[p]; p += 1
        line = bytearray(raw[p:p + stride]); p += stride
        if f == 1:
            for x in range(4, stride): line[x] = (line[x] + line[x - 4]) & 255
        elif f == 2:
            for x in range(stride): line[x] = (line[x] + prev[x]) & 255
        elif f == 3:
            for x in range(stride):
                a = line[x - 4] if x >= 4 else 0
                line[x] = (line[x] + ((a + prev[x]) >> 1)) & 255
        elif f == 4:
            for x in range(stride):
                a = line[x - 4] if x >= 4 else 0
                c = prev[x - 4] if x >= 4 else 0
                b = prev[x]
                pa, pb, pc = abs(b - c), abs(a - c), abs(a + b - 2 * c)
                pr = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                line[x] = (line[x] + pr) & 255
        lignes.append(bytes(line)); prev = line
    return w, h, lignes


def boite_alpha(w, h, lignes, seuil=8):
    x0, y0, x1, y1 = w, h, -1, -1
    for y in range(h):
        row = lignes[y]
        for x in range(w):
            if row[x * 4 + 3] > seuil:
                x0, x1 = min(x0, x), max(x1, x)
                y0, y1 = min(y0, y), max(y1, y)
    return x0, y0, x1 + 1, y1 + 1


def reduire(lignes, x0, y0, x1, y1, cible):
    sw, sh = x1 - x0, y1 - y0
    k = cible / max(sw, sh)
    dw, dh = max(1, round(sw * k)), max(1, round(sh * k))
    out = []
    for dy in range(dh):
        sy0, sy1 = y0 + dy * sh // dh, max(y0 + dy * sh // dh + 1, y0 + (dy + 1) * sh // dh)
        row = bytearray()
        for dx in range(dw):
            sx0, sx1 = x0 + dx * sw // dw, max(x0 + dx * sw // dw + 1, x0 + (dx + 1) * sw // dw)
            sr = sg = sb = sa = poids = 0
            for sy in range(sy0, sy1):
                src = lignes[sy]
                for sx in range(sx0, sx1):
                    o = sx * 4
                    a = src[o + 3]
                    sr += src[o] * a; sg += src[o + 1] * a; sb += src[o + 2] * a
                    sa += a; poids += 1
            if sa:
                row += bytes((sr // sa, sg // sa, sb // sa, sa // poids))
            else:
                row += b'\x00\x00\x00\x00'
        out.append(bytes(row))
    return dw, dh, out


def ecrire(path, w, h, lignes):
    brut = b''.join(b'\x00' + l for l in lignes)
    def bloc(typ, data):
        return (struct.pack('>I', len(data)) + typ + data
                + struct.pack('>I', zlib.crc32(typ + data) & 0xffffffff))
    png = (b'\x89PNG\r\n\x1a\n'
           + bloc(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0))
           + bloc(b'IDAT', zlib.compress(brut, 9))
           + bloc(b'IEND', b''))
    open(path, 'wb').write(png)


src, dst, cible = sys.argv[1], sys.argv[2], int(sys.argv[3])
w, h, lignes = lire(src)
x0, y0, x1, y1 = boite_alpha(w, h, lignes)
dw, dh, out = reduire(lignes, x0, y0, x1, y1, cible)
ecrire(dst, dw, dh, out)
print('%s -> %s  %dx%d (détouré de %dx%d)' % (src.split('/')[-1], dst, dw, dh, x1 - x0, y1 - y0))
