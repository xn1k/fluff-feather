// Writes fal.ai prompt files for every form to assets/generated/_prompts/<formId>_{base,walk,attack}.txt
// usage: node tools/prompts.mjs
import { FORMS } from '../js/data.js';
import { mkdirSync, writeFileSync } from 'node:fs';

const OUT = new URL('../assets/generated/_prompts/', import.meta.url);
mkdirSync(OUT, { recursive: true });

const PIXEL = 'Cute 16-bit SNES-era pixel art game sprite. Crisp hard-edged pixels, limited palette, dark 1px outline, no anti-aliasing, no blur.';
const BG = 'Perfectly flat solid magenta #FF00FF background. No shadows, no ground line, no text, no frame numbers, no borders.';
const SAME = 'Using the character in the reference image exactly (same design, colours, outfit, proportions and pixel size)';

const prompts = {};
for (const f of Object.values(FORMS)) {
  if (f.tier === 0 && f.animal !== 'kitten') {
    prompts[`${f.id}_base`] = `${PIXEL} Using the reference image ONLY as the art style guide (same 16-bit pixel style, same chibi proportions, same pixel size, same outline, same 3/4 view facing right, same standing pose and framing), draw a NEW character: an anthropomorphic ${f.look}, the starting hero of a cozy idle RPG. Chibi proportions (big head, small body), standing upright on two legs, full body, 3/4 view facing right. Single character only, centered. ${BG}`;
  }
  if (f.tier >= 1) {
    const older = f.tier === 1 ? 'its next, slightly older and stronger evolution' : 'its final, most powerful and impressive evolution';
    prompts[`${f.id}_base`] = `${PIXEL} Evolve the character in the first reference image into ${older}: an anthropomorphic ${f.look}. Keep the same species, fur/feather colours and face so it is clearly the same character grown up, ${f.tier === 1 ? 'slightly taller' : 'taller and more heroic'}, still cute chibi proportions. Match the art style, pixel size and outline of the references exactly. Full body, standing pose, 3/4 view facing right. Single character only, centered. ${BG}`;
  }
  prompts[`${f.id}_walk`] = `${PIXEL} ${SAME}, draw a 6-frame walk cycle sprite strip: exactly 6 frames in a single horizontal row, evenly spaced, each frame the same size with clear empty space between frames, feet on the same baseline. The character walks to the right (3/4 view like the reference), holding its weapon. Poses in order: contact, down, passing, up, contact with the other leg forward, passing. ${BG}`;
  prompts[`${f.id}_attack`] = `${PIXEL} ${SAME}, draw a 4-frame attack animation sprite strip: exactly 4 frames in a single horizontal row, evenly spaced, each frame the same size with clear empty space between frames, feet on the same baseline, facing right (3/4 view like the reference). Frames: 1 wind-up with the weapon pulled back, 2 swinging forward, 3 strike with a small white swoosh arc touching the weapon, 4 follow-through recovering. Kid-friendly, no blood. ${BG}`;
}
for (const [k, v] of Object.entries(prompts)) writeFileSync(new URL(`${k}.txt`, OUT), v);
console.log(Object.keys(prompts).length, 'prompt files');
