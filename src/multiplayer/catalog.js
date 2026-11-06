// Shared, versioned rules. These anchors use the existing Brisbane metre grid.
export const PROTOCOL = 1,
  MAX_PLAYERS = 10;
export const SPAWN = { x: 5, y: 12, z: 80 };
export const GAMES = [
  {
    id: 'tictactoe',
    name: 'Rebars & Burgers',
    tag: 'TIC-TAC-TOE',
    icon: '🍔',
    min: 2,
    max: 2,
    help: 'Take turns. Rebar vs burger. Three in a row wins.',
  },
  {
    id: 'connect',
    name: 'Four in a Grill',
    tag: 'CONNECT FOUR',
    icon: '▥',
    min: 2,
    max: 2,
    help: 'Drop rebar or burger tokens into seven columns. Connect four.',
  },
  {
    id: 'memory',
    name: 'Rebar Memory',
    tag: 'MATCH THE LOOT',
    icon: '🔩',
    min: 2,
    max: 10,
    help: 'Turn over two cards. A match earns a point and another turn.',
  },
  {
    id: 'reaction',
    name: 'Burger Buzzer',
    tag: 'REACTION RACE',
    icon: '⚡',
    min: 2,
    max: 10,
    help: 'Wait for SERVED. Press F or the buzzer. Jump early and you burn your burger.',
  },
  {
    id: 'rhythm',
    name: 'Bolt Beat',
    tag: 'EIGHT-BAR CYPHER',
    icon: '🎵',
    min: 2,
    max: 10,
    help: 'F or tap on eight gold beats. Shared clock, individual scores.',
  },
  {
    id: 'feint',
    name: 'Forehead Feint',
    tag: 'REBAR · BURGER · GOGGLES',
    icon: '🥽',
    min: 2,
    max: 2,
    help: 'Rebar breaks goggles. Goggles spot burgers. Burgers defeat rebar hunger. First to three.',
  },
  {
    id: 'stack',
    name: 'Burger Stack',
    tag: 'BALANCE THE BUN',
    icon: '🥪',
    min: 2,
    max: 10,
    help: 'Drop each moving layer with F. Overlap keeps your burger standing. Twelve layers maximum.',
  },
  {
    id: 'code',
    name: 'Rebar Codebreak',
    tag: 'CRACK SEB’S LOCK',
    icon: '🔐',
    min: 2,
    max: 10,
    help: 'Find four different steel colours. Gold = exact; silver = right colour, wrong slot. Eight guesses.',
  },
  {
    id: 'slide',
    name: 'Singlet Shuffle',
    tag: 'SLIDING PUZZLE',
    icon: '🧩',
    min: 2,
    max: 10,
    help: 'Slide a neighbouring tile into the gap. Put the eight icons in order.',
  },
  {
    id: 'rally',
    name: 'Brisbane Rebar Rally',
    tag: 'CITY CHECKPOINT RACE',
    icon: '🏁',
    min: 2,
    max: 10,
    help: 'Race through ordered Brisbane checkpoints. Walk or use the trolley. F claims a nearby checkpoint.',
  },
];
export const SYMBOLS = ['🔩', '🍔', '🥽', '📱', '🛒', '👕', '⚡', '🏆'];
export const RALLY = [
  { x: 173.1, z: 81.5, label: 'Queen Street Mall' },
  { x: 196.5, z: 67.7, label: 'Apple approach' },
  { x: 155.6, z: 95.9, label: 'Queen Street return' },
  { x: 5, z: 80, label: 'City Hall finish' },
];
export const ROLES = [
  'Rebar Captain',
  'Burger Marshal',
  'Bolt Engineer',
  'Trolley Scout',
];
export const QUEST_STAGES = [
  {
    title: 'SEB’S EMERGENCY',
    text: 'Four rebars, four enormous legends. Each role collects its marked crate at City Hall.',
    points: [
      [-3, 80],
      [5, 88],
      [13, 80],
      [5, 72],
    ],
  },
  {
    title: 'QUEEN STREET DELIVERY',
    text: 'Carry the steel to your own Queen Street marker. Every delivery counts.',
    points: [
      [155.6, 95.9],
      [168.9, 84.7],
      [179.8, 78.3],
      [196.5, 67.7],
    ],
  },
  {
    title: 'SOUTH BANK RELAY',
    text: 'Cross the city together. Stand on all four South Bank pads, then each press F.',
    points: [
      [-194, 774],
      [-190, 774],
      [-194, 778],
      [-190, 778],
    ],
  },
  {
    title: 'CITY HALL REBAR RESCUE',
    text: 'Return the four stabilisers to City Hall. Four deliveries end the conspiracy’s afternoon.',
    points: [
      [-3, 80],
      [5, 88],
      [13, 80],
      [5, 72],
    ],
  },
];
export const COLORS = [
  '#ffce36',
  '#2ee6ff',
  '#ef8db7',
  '#9ed886',
  '#bda1f4',
  '#ff9c65',
  '#6bb8ff',
  '#e9deba',
  '#dc766f',
  '#70d2bd',
];
export const gameDefinition = (id) => GAMES.find((g) => g.id === id);

// Cosmetic identities only: everyone keeps the same movement and collision rules.
export const CHARACTERS = [
  {
    id: 'bung',
    name: 'Bung Bunty',
    model: 'bung',
    detail: 'Four rebar hairs. Unlimited burger ambition.',
    colors: ['#f4f1ea', '#7a5230', '#2266cc', '#d9d4c4'],
  },
  {
    id: 'ching',
    name: 'Ching / Chung',
    model: 'ching',
    detail: 'Mission control, trolley royalty.',
    colors: ['#1fb8c9', '#23262e', '#eeeeee', '#2ee6ff'],
  },
  {
    id: 'gabor',
    name: 'Gabor Mihala',
    model: 'gabor',
    detail: 'Unlimited forehead strategy.',
    colors: ['#3d2a52', '#2a1d3a', '#242834', '#8f1fff'],
  },
  {
    id: 'seb',
    name: 'Seb Daly',
    model: 'person',
    detail: 'The Big Boss of Brisbane.',
    colors: ['#e07a12', '#343b49', '#242834', '#ffce36'],
  },
  {
    id: 'girder',
    name: 'Sir Girderface',
    model: 'girder',
    detail: 'The Rebar Overlord, in city-sized form.',
    colors: ['#3a404c', '#2a3038', '#242834', '#ff8936'],
  },
  {
    id: 'rebar-man',
    name: 'Rebar Man',
    model: 'bung',
    detail: 'Bung’s workshop alter ego.',
    colors: ['#9aa3ad', '#39414d', '#ffce36', '#2ee6ff'],
  },
  {
    id: 'ching-mum',
    name: 'Ching’s Mother',
    model: 'person',
    detail: 'The mansion’s ground-floor authority.',
    colors: ['#1fb8c9', '#29384b', '#eeeeee', '#ffcf5e'],
  },
  {
    id: 'ching-dad',
    name: 'Ching’s Father',
    model: 'person',
    detail: 'The family has arrived.',
    colors: ['#39414d', '#23262e', '#242834', '#2ee6ff'],
  },
  {
    id: 'bung-mum',
    name: 'Bung’s Mother',
    model: 'person',
    detail: 'Top floor. First-class rebar opinions.',
    colors: ['#f2c14b', '#593b46', '#80482c', '#f9e6be'],
  },
  {
    id: 'bung-dad',
    name: 'Bung’s Father',
    model: 'person',
    detail: 'The singlet runs in the family.',
    colors: ['#6d543c', '#39414d', '#242834', '#ffce36'],
  },
  {
    id: 'guard',
    name: 'Collector’s Guard',
    model: 'gabor',
    detail: 'Paid too little to question the singlet.',
    colors: ['#39414d', '#23262e', '#242834', '#e0b15b'],
  },
  {
    id: 'judge',
    name: 'The Court',
    model: 'person',
    detail: 'Ten thousand dollars. Case closed.',
    colors: ['#23262e', '#23262e', '#242834', '#f4f1ea'],
  },
  {
    id: 'james',
    name: 'James Rebar',
    model: 'trolley',
    detail: 'Not a man. A golden motorised standard.',
    colors: ['#ffc94d', '#c0392b', '#242834', '#ff2e5f'],
  },
  {
    id: 'drone',
    name: 'Gabor Drone',
    model: 'enemy',
    detail: 'A flying pest, now on your side.',
    colors: ['#8f1fff', '#343b49', '#242834', '#ff2e5f'],
  },
  {
    id: 'gremlin',
    name: 'Scooter Gremlin',
    model: 'enemy',
    detail: 'Small wheels. Big rebar energy.',
    colors: ['#44b04a', '#343b49', '#242834', '#6c1fb8'],
  },
  {
    id: 'leech',
    name: 'Portal Leech',
    model: 'enemy',
    detail: 'Cosmetic mischief. No stolen combo.',
    colors: ['#d14fd1', '#343b49', '#242834', '#ffce36'],
  },
  {
    id: 'blob',
    name: 'Typhoon Blob',
    model: 'enemy',
    detail: 'A walking weather warning.',
    colors: ['#3fa7d9', '#343b49', '#242834', '#ffce36'],
  },
  {
    id: 'bug',
    name: 'Cyber Rebar Bug',
    model: 'enemy',
    detail: 'Red Mode’s tiniest menace.',
    colors: ['#ff2e5f', '#343b49', '#242834', '#8f1fff'],
  },
  {
    id: 'bandit',
    name: 'Burger Bandit',
    model: 'enemy',
    detail: 'Bring your own burger hat.',
    colors: ['#c98a38', '#343b49', '#242834', '#e8a755'],
  },
];
export const characterDefinition = (id) =>
  CHARACTERS.find((c) => c.id === id) || CHARACTERS[0];
export function normalizeAppearance(value) {
  const v = value && typeof value === 'object' ? value : {};
  const character = characterDefinition(v.character);
  const colors = character.colors.map((fallback, i) =>
    typeof v.colors?.[i] === 'string' && /^#[0-9a-f]{6}$/i.test(v.colors[i])
      ? v.colors[i].toLowerCase()
      : fallback,
  );
  return { character: character.id, colors };
}
