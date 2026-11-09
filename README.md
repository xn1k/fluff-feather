# Fluff & Feather

A cozy 16-bit idle adventure for phones (installable PWA). Pick a kitten, chick or panda cub,
tap and auto-battle your way right through stages and bosses, evolve along a 1 → 3 → 9 branching
path, find loot, recruit a pal, grow a talent tree with rare skill points, pick run blessings after big bosses, use active skills, pop gift balloons, finish quests and prestige for Stardust.

- `index.html`, `style.css`, `js/` – the game (plain ES modules, no build step)
- `js/data.js` – animals, evolution trees, monsters, upgrades, perks, loot tables
- `js/core.js` – all game logic and formulas (DOM-free; `TUNE` holds the balance knobs)
- `tools/sim.mjs` – balance bot: `node tools/sim.mjs <hours> <taps/s> '{"hpGrowth":1.6}'`
- `tools/build_sprites.py` – packs processed fal.ai art into `assets/sprites/`

Run locally: `python -m http.server 8931` and open http://127.0.0.1:8931/
