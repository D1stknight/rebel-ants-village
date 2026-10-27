# A phone copy of a GLB: the same file with its pictures stored smaller, nothing else touched.
#   python3 -I tools/lite-glb.py <in.glb> <out.glb> <max px> [--quality 90]
# Every picture larger than <max px> on its longer side is scaled down (Lanczos) and stored again in its own format (WebP
# lossy at --quality, alpha kept; JPEG at --quality; PNG lossless); pictures already small enough keep their bytes. The
# binary chunk is laid out again in the same order (4-byte aligned) and every other buffer view (meshes, Draco data,
# skins, moves) is copied byte for byte, so the shapes and everything worked out from them (walk tables, tree trunks,
# snow caps) stay the same. The script checks that before it writes.
import io, json, struct, sys
from PIL import Image

def read_glb(path):
    b = open(path, 'rb').read()
    magic, version, length = struct.unpack_from('<4sII', b, 0)
    if magic != b'glTF' or version != 2: raise SystemExit(f'{path}: not a glTF 2 binary')
    jl, jt = struct.unpack_from('<II', b, 12)
    if jt != 0x4E4F534A: raise SystemExit(f'{path}: the first chunk is not JSON')
    doc = json.loads(b[20:20 + jl])
    off = 20 + jl
    binary = b''
    if off < len(b):
        bl, bt = struct.unpack_from('<II', b, off)
        if bt != 0x004E4942: raise SystemExit(f'{path}: the second chunk is not BIN')
        binary = b[off + 8:off + 8 + bl]
    return doc, binary

def view_bytes(doc, binary, i):
    v = doc['bufferViews'][i]
    o = v.get('byteOffset', 0)
    return binary[o:o + v['byteLength']]

def shrink(data, mime, cap, quality):
    im = Image.open(io.BytesIO(data))
    w, h = im.size
    if max(w, h) <= cap: return None, (w, h), (w, h)
    k = cap / max(w, h)
    nw, nh = max(1, round(w * k)), max(1, round(h * k))
    alpha = im.mode in ('RGBA', 'LA', 'PA') or (im.mode == 'P' and 'transparency' in im.info)
    im = im.convert('RGBA' if alpha else 'RGB').resize((nw, nh), Image.LANCZOS)
    out = io.BytesIO()
    if mime == 'image/webp': im.save(out, 'WEBP', quality=quality, method=6, alpha_quality=100)
    elif mime == 'image/jpeg': im.convert('RGB').save(out, 'JPEG', quality=quality, optimize=True)
    elif mime == 'image/png': im.save(out, 'PNG', optimize=True)
    else: raise SystemExit(f'unknown picture type {mime}')
    return out.getvalue(), (w, h), (nw, nh)

def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if len(args) != 3: raise SystemExit(__doc__ or 'usage: lite-glb.py <in.glb> <out.glb> <max px> [--quality 90]')
    src, dst, cap = args[0], args[1], int(args[2])
    quality = 90
    for a in sys.argv[1:]:
        if a.startswith('--quality='): quality = int(a.split('=', 1)[1])
    if '--quality' in sys.argv:
        quality = int(sys.argv[sys.argv.index('--quality') + 1])
    doc, binary = read_glb(src)
    views = doc.get('bufferViews', [])
    pictures = {}
    for n, img in enumerate(doc.get('images', [])):
        if 'bufferView' not in img: continue
        data, was, now = shrink(view_bytes(doc, binary, img['bufferView']), img.get('mimeType', ''), cap, quality)
        if data is not None: pictures[img['bufferView']] = data
        print(f'  picture {n}: {was[0]}x{was[1]} -> {now[0]}x{now[1]}' + ('' if data is not None else ' (kept)'))
    order = sorted(range(len(views)), key=lambda i: views[i].get('byteOffset', 0))
    out = bytearray()
    new_views = [dict(v) for v in views]
    for i in order:
        while len(out) % 4: out.append(0)
        data = pictures.get(i, view_bytes(doc, binary, i))
        new_views[i]['byteOffset'] = len(out)
        new_views[i]['byteLength'] = len(data)
        out += data
    while len(out) % 4: out.append(0)
    doc2 = dict(doc)
    doc2['bufferViews'] = new_views
    doc2['buffers'] = [dict(doc['buffers'][0], byteLength=len(out))] + doc['buffers'][1:]
    # every buffer view that is not one of the smaller pictures: byte for byte the same
    for i in range(len(views)):
        if i in pictures: continue
        if view_bytes(doc, binary, i) != bytes(out[new_views[i]['byteOffset']:new_views[i]['byteOffset'] + new_views[i]['byteLength']]):
            raise SystemExit(f'buffer view {i} changed: not written')
    js = json.dumps(doc2, separators=(',', ':')).encode('utf8')
    while len(js) % 4: js += b' '
    total = 12 + 8 + len(js) + 8 + len(out)
    with open(dst, 'wb') as f:
        f.write(struct.pack('<4sII', b'glTF', 2, total))
        f.write(struct.pack('<II', len(js), 0x4E4F534A)); f.write(js)
        f.write(struct.pack('<II', len(out), 0x004E4942)); f.write(out)
    print(f'{src} ({len(binary)} bytes of data) -> {dst} ({len(out)} bytes), {len(pictures)} pictures smaller, the rest byte for byte')

if __name__ == '__main__':
    main()
