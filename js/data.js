// Static game data. Adding a new animal = add an entry to ANIMALS (+ sprites).

export const VERSION = '0.2.0';

// Branch archetypes. T1 forms get the archetype bonus; T2 forms add a trait.
export const ARCH = {
  power:  { name: 'Power',  color: '#e8554e', desc: '+50% damage' },
  swift:  { name: 'Swift',  color: '#4fb3e8', desc: '+25% attack speed, +5% crit chance' },
  mystic: { name: 'Mystic', color: '#b77be8', desc: '×2 tap damage, +25% gold' },
};

export const TRAITS = {
  bossSlayer: 'Boss damage ×2.5',
  heavy:      'Damage ×1.8',
  cleave:     'Overkill damage carries to the next monster, +20% damage',
  double:     '25% chance to strike twice',
  precision:  '+12% crit chance, +150% crit damage',
  haste:      'Attack speed ×1.4',
  midas:      'Gold ×2',
  storm:      'Tap damage ×3',
  lucky:      'Loot & gem chance ×2, better rarities',
};

// `look` is used to build the image prompts for fal (see tools/prompts.mjs).
export const ANIMALS = {
  kitten: {
    name: 'Kitten', color: '#f0a040',
    passive: { text: '+5% crit chance', critChance: 0.05 },
    base: { id: 'kitten', name: 'Kitten', look: 'orange tabby kitten adventurer in a green tunic with a little red cape and a tiny wooden sword' },
    branches: [
      { id: 'kitten_p', arch: 'power', name: 'Swashbuckler', look: 'orange tabby cat swashbuckler with a feathered hat, blue coat and a rapier',
        children: [
          { id: 'kitten_p1', name: 'Musketeer', trait: 'bossSlayer', look: 'orange tabby cat musketeer with a big plumed hat, royal blue tabard with a cross, cape and a shining rapier' },
          { id: 'kitten_p2', name: 'Pirate Captain', trait: 'cleave', look: 'orange tabby cat pirate captain with a tricorn hat, eyepatch, red long coat and a cutlass' },
          { id: 'kitten_p3', name: 'Ronin', trait: 'heavy', look: 'orange tabby cat ronin samurai in a straw hat and worn indigo kimono, wielding a katana' },
        ] },
      { id: 'kitten_s', arch: 'swift', name: 'Shadow Cat', look: 'orange tabby cat rogue in a dark hooded cloak with twin daggers',
        children: [
          { id: 'kitten_s1', name: 'Ninja', trait: 'haste', look: 'orange tabby cat ninja in a black ninja outfit with a red scarf and a shuriken' },
          { id: 'kitten_s2', name: 'Phantom Thief', trait: 'double', look: 'orange tabby cat gentleman phantom thief with a top hat, domino mask, black cape and a cane sword' },
          { id: 'kitten_s3', name: 'Night Stalker', trait: 'precision', look: 'orange tabby cat night hunter in dark purple leather armor with glowing claws and a crossbow' },
        ] },
      { id: 'kitten_m', arch: 'mystic', name: 'Witch Kitten', look: 'orange tabby cat witch with a pointy purple hat and a small magic wand',
        children: [
          { id: 'kitten_m1', name: 'Moon Sorceress', trait: 'storm', look: 'orange tabby cat sorceress in silver and navy robes with a crescent moon staff' },
          { id: 'kitten_m2', name: 'Star Mage', trait: 'lucky', look: 'orange tabby cat star mage in a starry blue robe and wizard hat with a star-topped staff' },
          { id: 'kitten_m3', name: 'Bard', trait: 'midas', look: 'orange tabby cat bard with a feathered cap, colorful doublet and a golden lute' },
        ] },
    ],
  },
  chick: {
    name: 'Chick', color: '#f5d840',
    passive: { text: '+25% gold', gold: 0.25 },
    base: { id: 'chick', name: 'Chick', look: 'fluffy yellow chick adventurer with a little blue scarf, a tiny backpack and a wooden stick sword' },
    branches: [
      { id: 'chick_p', arch: 'power', name: 'Rooster Squire', look: 'young rooster squire with a red comb, dented iron helmet, small shield and short sword',
        children: [
          { id: 'chick_p1', name: 'Paladin', trait: 'bossSlayer', look: 'proud rooster paladin in shining silver and gold armor with a holy hammer' },
          { id: 'chick_p2', name: 'Brawler', trait: 'heavy', look: 'muscular rooster brawler with a headband, boxing gloves and wrestling belt' },
          { id: 'chick_p3', name: 'Phoenix Knight', trait: 'cleave', look: 'rooster knight in fiery red and orange armor with flame-tipped feathers and a flaming sword' },
        ] },
      { id: 'chick_s', arch: 'swift', name: 'Swift Feather', look: 'sleek young bird scout in a green hood with a short bow',
        children: [
          { id: 'chick_s1', name: 'Sky Archer', trait: 'precision', look: 'elegant bird archer in a green and gold ranger outfit with a longbow' },
          { id: 'chick_s2', name: 'Wind Ninja', trait: 'haste', look: 'bird ninja in a teal ninja outfit with swirling wind scarf and kunai' },
          { id: 'chick_s3', name: 'Sky Pirate', trait: 'double', look: 'bird sky pirate with aviator goggles, brown leather jacket and twin flintlock pistols' },
        ] },
      { id: 'chick_m', arch: 'mystic', name: 'Storm Hen', look: 'hen mage with a blue wizard hat and crackling lightning wand',
        children: [
          { id: 'chick_m1', name: 'Thunder Hen', trait: 'storm', look: 'hen storm wizard with a cloud-shaped hat, electric blue robes and lightning bolt staff' },
          { id: 'chick_m2', name: 'Sun Priestess', trait: 'lucky', look: 'hen priestess in white and gold robes with a sun disc halo and sun staff' },
          { id: 'chick_m3', name: 'Egg Witch', trait: 'midas', look: 'hen witch with a black pointy hat, patchwork robe and a cauldron spoon, golden eggs floating' },
        ] },
    ],
  },
  panda: {
    name: 'Panda Cub', color: '#e8e8e8',
    passive: { text: '+30% boss damage', boss: 0.3 },
    base: { id: 'panda', name: 'Panda Cub', look: 'chubby panda cub adventurer in a red vest with a bamboo stick' },
    branches: [
      { id: 'panda_p', arch: 'power', name: 'Bamboo Guard', look: 'panda guard in bamboo plate armor with a big bamboo shield and spear',
        children: [
          { id: 'panda_p1', name: 'Samurai', trait: 'bossSlayer', look: 'panda samurai in red lacquered samurai armor with a kabuto helmet and katana' },
          { id: 'panda_p2', name: 'Sumo Champion', trait: 'heavy', look: 'big panda sumo champion with a golden mawashi belt and topknot' },
          { id: 'panda_p3', name: 'Jade Golem', trait: 'cleave', look: 'panda warrior encased in carved green jade armor with a jade greatsword' },
        ] },
      { id: 'panda_s', arch: 'swift', name: 'Kung-fu Cub', look: 'panda kung-fu student in an orange gi with a headband, fists raised',
        children: [
          { id: 'panda_s1', name: 'Iron Fist', trait: 'double', look: 'panda kung-fu master with glowing golden fists, black gi and red sash' },
          { id: 'panda_s2', name: 'Bamboo Ninja', trait: 'haste', look: 'panda ninja in dark green ninja outfit with bamboo throwing darts' },
          { id: 'panda_s3', name: 'Staff Master', trait: 'precision', look: 'panda monk in a yellow robe spinning a long red and gold bo staff' },
        ] },
      { id: 'panda_m', arch: 'mystic', name: 'Mystic Panda', look: 'panda mystic in teal robes with floating paper talismans',
        children: [
          { id: 'panda_m1', name: 'Yin-Yang Sage', trait: 'lucky', look: 'elder panda sage with a long white beard, black and white robe with a glowing yin-yang orb' },
          { id: 'panda_m2', name: 'Spirit Shaman', trait: 'storm', look: 'panda shaman with a feathered spirit mask, beads and a glowing spirit totem staff' },
          { id: 'panda_m3', name: 'Lantern Monk', trait: 'midas', look: 'panda monk in saffron robes carrying a glowing golden paper lantern on a pole' },
        ] },
    ],
  },
};
export const ANIMAL_IDS = Object.keys(ANIMALS);

export const EVO_LEVELS = [25, 75];

// All forms flattened: id -> { animal, tier, name, arch, trait, parent, look }
export const FORMS = {};
for (const [aid, a] of Object.entries(ANIMALS)) {
  FORMS[a.base.id] = { ...a.base, animal: aid, tier: 0, parent: null };
  a.branches.forEach((b, bi) => {
    FORMS[b.id] = { id: b.id, name: b.name, look: b.look, animal: aid, tier: 1, arch: b.arch, parent: a.base.id, branch: bi };
    b.children.forEach((c, ci) => {
      FORMS[c.id] = { ...c, animal: aid, tier: 2, arch: b.arch, parent: b.id, branch: bi, leaf: ci };
    });
  });
}

// ---------------------------------------------------------------- world
// Monster sprite indices refer to cells in the monster grids (row-major, 2 grids of 4x4).
export const BIOMES = [
  { id: 'meadow',  name: 'Sunny Meadow',   sky: ['#8fd3ff', '#d8f3ff'], hill: '#7ccf6a', hill2: '#5aae55', ground: '#8a5a32', grass: '#5cc44c',
    monsters: [['Slimelet', '#6ee36e'], ['Angry Acorn', '#b07636'], ['Buzzbee', '#f2d23c'], ['Mushroom Puff', '#e05050'], ['Pebble Golem', '#9a9a9a'], ['Thorny Hedgehog', '#8a6248']] },
  { id: 'bamboo',  name: 'Bamboo Grove',   sky: ['#a9e0c8', '#eaf8ee'], hill: '#4fae6e', hill2: '#2e8a52', ground: '#6b4a2e', grass: '#3fa35a',
    monsters: [['Lantern Ghost', '#f07a50'], ['Bamboo Sprout', '#7ad06a'], ['Kappa Frog', '#4cbf9c'], ['Tanuki Trickster', '#9a6a3a'], ['Stone Lion Pup', '#c8b88a'], ['Ink Blob', '#3a3a5a']] },
  { id: 'desert',  name: 'Sandy Dunes',    sky: ['#ffd99a', '#fff3d6'], hill: '#e8c070', hill2: '#d0a050', ground: '#c08a48', grass: '#e0b060',
    monsters: [['Cactus Kid', '#58b050'], ['Sand Scarab', '#3a7ac8'], ['Dust Devil', '#d8c090'], ['Mummy Mouse', '#e8e0c8'], ['Scorpling', '#c84a30'], ['Sun Lizard', '#f0a030']] },
  { id: 'snow',    name: 'Frosty Peaks',   sky: ['#b8d4f0', '#f0f6ff'], hill: '#e8f0f8', hill2: '#c0d4e8', ground: '#8aa0b8', grass: '#f4f8ff',
    monsters: [['Snowball Imp', '#f0f4ff'], ['Ice Bat', '#7ac8f0'], ['Penguin Bandit', '#2a2a3a'], ['Frost Wisp', '#a0e8ff'], ['Yeti Cub', '#e0e8f0'], ['Icicle Crab', '#5aa0d8']] },
  { id: 'volcano', name: 'Ember Volcano',  sky: ['#5a2a3a', '#d86a4a'], hill: '#4a3038', hill2: '#3a2028', ground: '#3a2a2a', grass: '#e05a2a',
    monsters: [['Lava Slime', '#f06a20'], ['Ember Imp', '#e0402a'], ['Magma Snail', '#a04a2a'], ['Fire Salamander', '#f0802a'], ['Coal Golem', '#3a3a3a'], ['Flame Moth', '#f0c040']] },
];
// Special monsters (last 2 grid cells)
export const SPECIALS = {
  gemSlime: { name: 'Gem Slime', col: '#5af0e0', cell: 30 },
  mimic:    { name: 'Treasure Mimic', col: '#c89a3a', cell: 31 },
};
// Big bosses on every 10th stage, cycle through.
export const BOSSES = [
  ['King Slime', '#5ad85a'], ['Oni Drummer', '#d84a4a'], ['Pharaoh Crab', '#e0b040'], ['Frost Walrus', '#8ab8e0'], ['Dragon Whelp King', '#e06a2a'],
  ['Clockwork Knight', '#b0a080'], ['Shadow Wolf', '#4a3a6a'], ['Crystal Golem', '#9ae0f0'], ['Storm Gryphon', '#e0d070'],
];

// ---------------------------------------------------------------- upgrades (gold, reset on prestige)
export const UPGRADES = [
  { id: 'dmg',   name: 'Sharp Claws',  icon: '⚔️', desc: '+1 base damage. ×2 every 25 levels', base: 5,    growth: 1.075 },
  { id: 'speed', name: 'Quick Paws',   icon: '💨', desc: '+5% attack speed', base: 40,  growth: 1.55, max: 40 },
  { id: 'crit',  name: 'Keen Eyes',    icon: '🎯', desc: '+1% crit chance', base: 100, growth: 1.6, max: 30 },
  { id: 'critd', name: 'Mighty Blow',  icon: '💥', desc: '+15% crit damage', base: 150, growth: 1.42 },
  { id: 'tap',   name: 'Eager Taps',   icon: '👆', desc: '+15% tap damage', base: 15,   growth: 1.22 },
  { id: 'gold',  name: 'Shiny Pouch',  icon: '💰', desc: '+15% gold', base: 30,  growth: 1.5 },
];

// ---------------------------------------------------------------- stardust perks (permanent)
export const PERKS = [
  { id: 'spirit', name: 'Fierce Spirit', icon: '🔥', desc: '+50% damage', base: 1, growth: 1.35 },
  { id: 'paws',   name: 'Golden Paws',   icon: '🪙', desc: '+30% gold', base: 1, growth: 1.4 },
  { id: 'tapm',   name: 'Tap Mastery',   icon: '✨', desc: '+40% tap damage', base: 1, growth: 1.4 },
  { id: 'wise',   name: 'Wise Elder',    icon: '📜', desc: '+30% XP', base: 2, growth: 1.45 },
  { id: 'start',  name: 'Head Start',    icon: '🚀', desc: 'Start runs 5 stages further', base: 3, growth: 1.6, max: 20 },
  { id: 'nap',    name: 'Long Nap',      icon: '😴', desc: '+2h max away time', base: 2, growth: 1.7, max: 8 },
  { id: 'boss',   name: 'Patience',      icon: '⏳', desc: '+3s boss timer', base: 3, growth: 1.6, max: 10 },
  { id: 'luck',   name: 'Lucky Star',    icon: '⭐', desc: '+20% loot chance & rarity luck', base: 3, growth: 1.5, max: 25 },
  { id: 'pack',   name: 'Pack Leader',   icon: '🐾', desc: '+50% companion damage', base: 4, growth: 1.4 },
];

// ---------------------------------------------------------------- loot
export const RARITIES = [
  { id: 'common',    name: 'Common',    color: '#c8c8c8', weight: 600, mult: 1,   affixes: 0 },
  { id: 'uncommon',  name: 'Uncommon',  color: '#5ad85a', weight: 260, mult: 1.6, affixes: 1 },
  { id: 'rare',      name: 'Rare',      color: '#4fa0f0', weight: 100, mult: 2.5, affixes: 1 },
  { id: 'epic',      name: 'Epic',      color: '#c060f0', weight: 32,  mult: 4,   affixes: 2 },
  { id: 'legendary', name: 'Legendary', color: '#f0a020', weight: 8,   mult: 7,   affixes: 3 },
];

export const SLOTS = ['weapon', 'armor', 'charm'];
// icon = cell index in the item icon grids (2 grids of 4x4 = 32 cells)
export const ITEM_BASES = {
  weapon: [['Twig', 0], ['Wooden Sword', 1], ['Claw Gloves', 2], ['Bamboo Staff', 3], ['Feather Blade', 4], ['Fish Spear', 5],
           ['Moon Wand', 6], ['Kitty Rapier', 7], ['Thunder Hammer', 8], ['Star Bow', 9], ['Jade Katana', 10], ['Phoenix Lance', 11]],
  armor:  [['Cozy Scarf', 12], ['Leaf Tunic', 13], ['Acorn Helm', 14], ['Bamboo Vest', 15], ['Shell Plate', 16], ['Wizard Robe', 17],
           ['Knight Mail', 18], ['Ninja Garb', 19], ['Crystal Cape', 20], ['Dragon Scale', 21]],
  charm:  [['Lucky Clover', 22], ['Bell Collar', 23], ['Golden Egg', 24], ['Star Pebble', 25], ['Fish Bone', 26], ['Yarn Ball', 27],
           ['Moon Pendant', 28], ['Bamboo Flute', 29], ['Rainbow Feather', 30], ['Ancient Coin', 31]],
};
export const PREFIXES = ['Trusty', 'Fluffy', 'Sparkly', 'Brave', 'Sneaky', 'Mighty', 'Ancient', 'Glowing', 'Royal', 'Cosmic'];

export const AFFIXES = {
  critChance: { name: 'Crit chance',  fmt: v => `+${(v * 100).toFixed(1)}%`, roll: (il, m) => Math.min(0.15, 0.01 * m * (1 + il / 120)) },
  critDmg:    { name: 'Crit damage',  fmt: v => `+${Math.round(v * 100)}%`,  roll: (il, m) => 0.1 * m * (1 + il / 60) },
  speed:      { name: 'Attack speed', fmt: v => `+${Math.round(v * 100)}%`,  roll: (il, m) => Math.min(0.5, 0.03 * m * (1 + il / 150)) },
  tap:        { name: 'Tap damage',   fmt: v => `+${Math.round(v * 100)}%`,  roll: (il, m) => 0.15 * m * (1 + il / 25) },
  gold:       { name: 'Gold',         fmt: v => `+${Math.round(v * 100)}%`,  roll: (il, m) => 0.08 * m * (1 + il / 30) },
  xp:         { name: 'XP',           fmt: v => `+${Math.round(v * 100)}%`,  roll: (il, m) => 0.08 * m * (1 + il / 40) },
  boss:       { name: 'Boss damage',  fmt: v => `+${Math.round(v * 100)}%`,  roll: (il, m) => 0.12 * m * (1 + il / 25) },
  luck:       { name: 'Loot luck',    fmt: v => `+${Math.round(v * 100)}%`,  roll: (il, m) => Math.min(1, 0.05 * m * (1 + il / 100)) },
};

export const GEM_COSTS = { respecLeaf: 10, respecBranch: 25, chest: 15, timeWarp: 20 };
export const COMPANION_STAGE = 60;
export const PRESTIGE_STAGE = 30;
