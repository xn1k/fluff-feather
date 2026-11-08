"""Phase 2 generation: 27 T2 forms. usage: python tools/gen_phase2.py base|anims [formIds...]
Costs money (fal). Skips outputs that already exist, so re-running never re-bills finished images."""
import subprocess, sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
GEN = ROOT / 'assets' / 'generated'
P = GEN / '_prompts'
FAL = Path.home() / '.claude' / 'skills' / 'fal-game-assets' / 'scripts' / 'fal_generate.py'
stage = sys.argv[1]
forms = sys.argv[2:] or [f'{a}_{b}{i}' for a in ('kitten', 'chick', 'panda') for b in 'psm' for i in (1, 2, 3)]
jobs = []
for f in forms:
    out = GEN / f
    if stage == 'base':
        jobs.append((f, 'base', GEN / f[:-1] / 'base.png', '1:1'))
    else:
        for n in ('walk', 'attack'): jobs.append((f, n, out / 'base.png', '4:1'))
jobs = [j for j in jobs if not (GEN / j[0] / f'{j[1]}.png').exists()]
def run(j):
    f, name, ref, aspect = j
    r = subprocess.run([sys.executable, str(FAL), '--image', str(ref), '--aspect', aspect, '--out', str(GEN / f),
                        '--name', name, '--prompt-file', str(P / f'{f}_{name}.txt'), '--quiet'], capture_output=True, text=True)
    ok = (GEN / f / f'{name}.png').exists()
    print(f, name, 'OK' if ok else 'FAILED ' + (r.stderr or r.stdout)[-300:], flush=True)
print(len(jobs), 'calls', flush=True)
with ThreadPoolExecutor(9) as ex: list(ex.map(run, jobs))
