"""Pack processed fal.ai art into the atlases the game loads (assets/sprites/index.json).

Conventions (everything optional, missing art falls back to placeholders in-game):
  assets/generated/<formId>/base_sel_proc/frames   chosen anchor, single frame -> 'idle'
  assets/generated/<formId>/walk_proc/frames       walk strip frames
  assets/generated/<formId>/attack_proc/frames     attack strip frames
  assets/generated/monsters/grid{1,2}_proc/frames  4x4 grids -> 32 monster cells (row-major)
  assets/generated/bosses/grid_proc/frames         3x3 grid -> 9 boss cells
  assets/generated/items/grid{1,2}_proc/frames     4x4 grids -> 32 item icon cells
  assets/generated/bg/<biome>_far.png / <biome>_near_keyed.png

usage: python tools/build_sprites.py
"""
import json, shutil, subprocess, sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
GEN = ROOT / 'assets' / 'generated'
OUT = ROOT / 'assets' / 'sprites'
TOOLS = Path.home() / '.claude' / 'skills' / 'fal-game-assets' / 'scripts' / 'sprite_tools.py'


def frames_in(d):
    return sorted(d.glob('*.png')) if d.is_dir() else []


def body_height(paths):
    hs = []
    for p in paths:
        im = Image.open(p).convert('RGBA')
        bb = im.getchannel('A').getbbox()
        if bb: hs.append(bb[3] - bb[1])
    return max(hs) if hs else None


def build_form(form_dir):
    anims = {}
    for name, sub in (('idle', 'base_sel_proc'), ('walk', 'walk_proc'), ('attack', 'attack_proc')):
        fr = frames_in(form_dir / sub / 'frames')
        if fr: anims[name] = form_dir / sub / 'frames'
    if not anims: return None
    out = OUT / 'forms' / f'{form_dir.name}.png'
    out.parent.mkdir(parents=True, exist_ok=True)
    cmd = [sys.executable, str(TOOLS), 'pack', '--out', str(out)]
    for n, d in anims.items(): cmd += ['--anim', f'{n}={d}']
    subprocess.run(cmd, check=True, capture_output=True)
    meta = json.loads(out.with_suffix('.json').read_text())
    rects = {n: [[meta['frames'][f]['frame'][k] for k in 'xywh'] for f in fl] for n, fl in meta['animations'].items()}
    # Reference height = the character's body in idle/walk frames, so attack poses that reach higher don't shrink it.
    ref = body_height(frames_in(anims.get('walk', anims.get('idle')))) or meta['meta']['cell']['h']
    # Cells are bottom-anchored but may have padding above; scale is by body height, draw by cell.
    cell_h = meta['meta']['cell']['h']
    for f in ('json',): out.with_suffix('.json').unlink(missing_ok=True)
    for extra in out.parent.glob(f'{form_dir.name}_preview*.png'): extra.unlink()
    return {'src': f'forms/{out.name}', 'h': ref, 'cellH': cell_h, 'anims': rects}


def build_grid(name, dirs, expected):
    cells = []
    for d in dirs: cells += frames_in(d)
    if not cells: return None
    ims = [Image.open(p).convert('RGBA') for p in cells]
    W = sum(i.width for i in ims) + len(ims)
    H = max(i.height for i in ims)
    sheet = Image.new('RGBA', (W, H))
    rects, x = [], 0
    for im in ims:
        sheet.paste(im, (x, H - im.height)); rects.append([x, H - im.height, im.width, im.height]); x += im.width + 1
    sheet.save(OUT / f'{name}.png')
    if len(cells) != expected: print(f'  ! {name}: {len(cells)} cells, expected {expected}')
    return {'src': f'{name}.png', 'cells': rects}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    idx = {'forms': {}, 'grids': {}, 'bg': {}}
    for d in sorted(GEN.iterdir()):
        if d.is_dir() and d.name not in ('monsters', 'bosses', 'items', 'bg'):
            f = build_form(d)
            if f: idx['forms'][d.name] = f; print('form', d.name, {k: len(v) for k, v in f['anims'].items()})
    for name, subs, n in (('monsters', ['grid1_proc', 'grid2_proc'], 32), ('bosses', ['grid_proc'], 9), ('items', ['grid1_proc', 'grid2_proc'], 32)):
        g = build_grid(name, [GEN / name / s / 'frames' for s in subs], n)
        if g: idx['grids'][name] = g; print('grid', name, len(g['cells']))
    bgd = GEN / 'bg'
    if bgd.is_dir():
        (OUT / 'bg').mkdir(exist_ok=True)
        for far in bgd.glob('*_far.png'):
            biome = far.stem[:-4]
            e = idx['bg'].setdefault(biome, {})
            shutil.copy(far, OUT / 'bg' / far.name); e['far'] = f'bg/{far.name}'
            near = bgd / f'{biome}_near_keyed.png'
            if near.exists(): shutil.copy(near, OUT / 'bg' / f'{biome}_near.png'); e['near'] = f'bg/{biome}_near.png'
            print('bg', biome, list(e))
    (OUT / 'index.json').write_text(json.dumps(idx, separators=(',', ':')))
    print('wrote', OUT / 'index.json')


if __name__ == '__main__':
    main()
