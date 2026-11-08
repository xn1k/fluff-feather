"""Turn raw fal.ai generations in assets/generated into processed frames (free, local).
usage: python tools/process_art.py [only-these-dirs...]
Then: python tools/build_sprites.py
"""
import json, subprocess, sys
from pathlib import Path
import numpy as np
from PIL import Image

GEN = Path(__file__).resolve().parent.parent / 'assets' / 'generated'
ST = Path.home() / '.claude' / 'skills' / 'fal-game-assets' / 'scripts' / 'sprite_tools.py'
only = set(sys.argv[1:])


def st(*args):
    r = subprocess.run([sys.executable, str(ST), *map(str, args)], capture_output=True, text=True)
    if r.returncode: print('  !', r.stderr[-400:])
    return r.stdout + r.stderr


def px_of(img):
    out = st('info', img)
    try: return json.loads(out[out.index('{'):out.rindex('}') + 1])['estimated_pixel_size']
    except Exception: return None


def fg_height(img):
    a = np.array(Image.open(img).convert('RGB')).astype(int)
    fg = ~((a[..., 0] > 190) & (a[..., 1] < 90) & (a[..., 2] > 190))
    rows = np.where(fg.mean(axis=1) > 0.002)[0]
    return rows[-1] - rows[0] + 1 if len(rows) else None


TARGET = {0: 62, 1: 68, 2: 74}  # native sprite height per evolution tier


def nframes(d):
    return len(list((d / 'frames').glob('*.png')))


for d in sorted(GEN.iterdir()):
    if not d.is_dir() or d.name.startswith('_') or (only and d.name not in only): continue
    if d.name in ('monsters', 'items'):
        for g in ('grid1', 'grid2'):
            if (d / f'{g}.png').exists():
                st('pipeline', d / f'{g}.png', d / f'{g}_proc', '--grid', '4x4')
                print(d.name, g, nframes(d / f'{g}_proc'), 'cells')
    elif d.name == 'bosses':
        st('pipeline', d / 'grid.png', d / 'grid_proc', '--grid', '3x3')
        print('bosses', nframes(d / 'grid_proc'), 'cells')
    elif d.name == 'bg':
        for far in d.glob('*_far.png'):
            im = np.array(Image.open(far).convert('RGB')).astype(int)
            # crop the plain ground band at the bottom: rows whose colour variance is tiny
            var = im.std(axis=1).mean(axis=1)
            cut = len(var)
            while cut > len(var) * 0.5 and var[cut - 1] < 6: cut -= 1
            crop = far.with_name(far.stem + '_crop.png')
            Image.open(far).convert('RGB').crop((0, 0, im.shape[1], cut)).save(crop)
            st('pixelate', crop, far.with_name(far.stem.replace('_far', '_far_px') + '.png'), '--px', 7)
            print('bg far', far.stem, 'cropped at', cut, '/', len(var))
        for near in d.glob('*_near.png'):
            # pixelate first (on magenta), then key globally so enclosed gaps (between bamboo etc.) go too
            px = near.with_name(near.stem + '_px.png')
            st('pixelate', near, px, '--px', 7)
            out = near.with_name(near.stem + '_keyed.png')
            st('chroma', px, out, '--mode', 'global', '--tol', '90', '--despill', '2')
            a = np.array(Image.open(out).convert('RGBA')); r, g, b_ = (a[..., i].astype(int) for i in range(3))
            a[(r > 150) & (b_ > 150) & (g < 120) & (r - g > 60) & (b_ - g > 60), 3] = 0
            Image.fromarray(a).save(out)
            print('bg near', near.stem)
    else:  # a character form
        if (d / 'base.png').exists() and not (d / 'base_sel_proc').exists():
            st('pipeline', d / 'base.png', d / 'base_sel_proc', '--expect', '1')
        tier = d.name.count('_') and (2 if d.name[-1].isdigit() else 1)
        px = max(2, round(fg_height(d / 'walk.png') / TARGET[tier])) if (d / 'walk.png').exists() else None
        if (d / 'walk.png').exists():
            st('pipeline', d / 'walk.png', d / 'walk_proc', '--grid', '6x1', '--px', px)
        if (d / 'attack.png').exists():
            st('pipeline', d / 'attack.png', d / 'attack_proc', '--expect', '4', '--px', px)
            if nframes(d / 'attack_proc') != 4:  # frames touching -> fixed grid
                import shutil; shutil.rmtree(d / 'attack_proc')
                st('pipeline', d / 'attack.png', d / 'attack_proc', '--grid', '4x1', '--px', px)
        print('form', d.name, 'px', px, 'walk', nframes(d / 'walk_proc') if (d / 'walk_proc').exists() else '-',
              'attack', nframes(d / 'attack_proc') if (d / 'attack_proc').exists() else '-')
