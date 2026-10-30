// The Original Saga. All 24 chapters have playable steps inside Brisbane.
// Later cities stay out of this chronicle.

export const ACTS = [
  { id: 1, title: 'THE BIRTH OF A REBAR LEGEND' },
  { id: 2, title: 'CHING COMES TO BRISBANE' },
  { id: 3, title: 'THE GREATEST GABOR FEUD' },
  { id: 4, title: 'BUNG SAVES THE WORLD' },
  { id: 5, title: 'THE BILLIONAIRE MANSION ERA' },
  { id: 6, title: 'BRISBANE\'S GREATEST LEGENDS' },
];

// Landmark centroids from the compiled Brisbane map, plus two clear pads
// that sit off building footprints: the West End house and the South Bank lawn.
export const PLACE = {
  home: { x: -820, z: 900, label: "Bung's place, West End" },
  bed: { x: -820, z: 898, label: 'the bed' },
  wardrobe: { x: -824.2, z: 902.4, label: 'the wardrobe' },
  shelf: { x: -816.2, z: 902.6, label: 'the rebar shelf' },
  garage: { x: -812, z: 891, label: 'the trolley pad' },
  gate: { x: -820, z: 884, label: 'the front yard' },
  mcrebar: { x: 140.7, z: 81.1, label: 'McRebar, 130 Queen Street' },
  hall: { x: 27, z: 69, label: 'King George Square' },
  bank: { x: -200, z: 780, label: 'South Bank' },
  mallBolt: { x: 173, z: 100, label: 'the Queen Street stall' },
  event: { x: -150, z: 860, label: 'the South Bank collector lawn' },
  ring1: { x: 173, z: 100 },
  ring2: { x: 150, z: 90 },
  ring3: { x: 110, z: 55 },
  plaza: { x: 5, z: 80, label: 'King George Square' },
  court: { x: 306, z: 630.4, label: 'the Parliament lawn' },
  wlawn: { x: -80, z: 280, label: 'the W Brisbane victory lawn' },
  pitch: { x: -1900, z: 1000, label: 'Davies Park' },
  river: { x: -162.8, z: 250.8, label: 'the Victoria Bridge bank' },
  expo: { x: 40, z: 40, label: 'the Rebar Expo lawn' },
  yard: { x: -1880, z: 1080, label: "Seb Daly's yard" },
  crate: { x: -1874, z: 1080, label: "Seb's crate" },
  workshop: { x: -805.9, z: 861.9, label: 'the hidden workshop' },
  smash: { x: 173.1, z: 81.5, label: 'Queen Street Mall' },
  snow1: { x: -818, z: 860, label: 'West End snow' },
  snow2: { x: -398, z: 500, label: 'South Brisbane snow' },
  snow3: { x: 12, z: 80, label: 'King George snow' },
  snow4: { x: 160, z: 90, label: 'Queen Street snow' },
  dodgeStart: { x: -150, z: 874, label: 'the edge of the lawn' },
  clue1: { x: 22, z: 74, label: 'the first scrap' },
  clue2: { x: 168, z: 96, label: 'the second scrap' },
  clue3: { x: -206, z: 786, label: 'the third scrap' },
  drop1: { x: 22, z: 64, label: 'the square drop' },
  drop2: { x: 180, z: 100, label: 'the Queen Street drop' },
  drop3: { x: -206, z: 774, label: 'the South Bank drop' },
  receipt: { x: 198, z: 116, label: 'the McRebar receipt' },
  witness: { x: -194, z: 774, label: 'the South Bank witness' },
  gogbox: { x: 27, z: 62, label: 'the goggles box' },
  kebab: { x: 46, z: 40, label: 'the kebab booth' },
  flash: { x: 34, z: 46, label: 'the photo booth' },
  cheque: { x: 312, z: 634, label: 'the city cheque' },
  suitcase: { x: -820, z: 894, label: 'the suitcase' },
  arrival: { x: 190, z: 110, label: 'the Queen Street meeting' },
  phone: { x: -816, z: 896, label: 'the phone' },
  fcmum: { x: -822, z: 903, label: "Ching's mother" },
  fcdad: { x: -818, z: 903, label: "Ching's father" },
  fbed: { x: -820, z: 900, label: 'the middle floor' },
  fbmum: { x: -822.5, z: 904, label: "Bung's mother" },
  fbdad: { x: -817.5, z: 904, label: "Bung's father" },
};

// Queen Street mall centerline, from the McRebar door to the street in front
// of the mapped Apple Store. Samples sit clear of building footprints.
export const CHASE_PATH = [
  [151.8, 96.1],
  [155.6, 95.9],
  [162.3, 90.3],
  [168.9, 84.7],
  [175.3, 79.8],
  [179.8, 78.3],
  [189.7, 73.4],
  [196.5, 67.7],
  [203.2, 61.9],
  [210.0, 56.2],
  [217.5, 47.9],
  [223.8, 40.9],
  [227.6, 35.1],
  [231.5, 29.3],
  [235.3, 23.5],
  [239.8, 19.6],
  [245.9, 14.4],
  [252.0, 9.1],
  [258.1, 3.9],
  [264.2, -1.4],
  [270.3, -6.6],
  [276.4, -11.9],
  [282.5, -17.1],
  [288.6, -22.4],
  [294.7, -27.6],
  [300.8, -32.9],
  [307.6, -38.8],
  [314.4, -44.6],
  [321.2, -50.4],
  [328.0, -56.3],
  [331.3, -58.9],
  [336.0, -62.7],
  [343.5, -63.4],
  [350.9, -64.0],
  [358.4, -64.7],
];

// Clear polylines. Sampled so the actors stay off building footprints.
export const ESCORT_PATH = [
  [10, 80],
  [90, 10],
  [190, 110],
];

export const SCOOTER_PATH = [
  [190, 110],
  [160, 90],
  [0, 220],
  [-80, 280],
];

export function createSaga() {
  return {
    active: true,
    chapter: 0,
    step: 0,
    stepState: {},
    done: [],
    relics: [],
    introSeen: false,
    intermission: false,
    bigBoy: false,
    trolleyDamage: false,
    phone: 'intact',
    companion: false,
    evidence: [],
    fortune: 0,
    saves: 0,
    mansion: false,
    legend: false,
  };
}

const originLines = [
  ['doc', 'Brisbane, 3 March 1977. A child is born. He is already, somehow, enormous.'],
  ['doc', 'He graduates in 1995. The school still talks about the rebar he brought to assembly.'],
  ['doc', 'Years later he owns a stained singlet, four hairs of courage, and a golden trolley named after James Rebar.'],
  ['bung', 'OIIII. I live here. The burgers live nearby. Do not question the trolley.'],
];

export const CHAPTERS = [
  {
    id: 'ch1', act: 1, n: 1, playable: true, start: 'bed',
    title: 'BUNG BUNTY: THE ORIGINS',
    reward: { coins: 40 },
    steps: [
      { id: 'origin', kind: 'scene', look: 'home', text: 'Watch the opening', lines: originLines },
      { id: 'bed', kind: 'interact', at: 'bed', text: 'Get out of bed', prompt: '<b>[E]</b> Get up. Regret nothing.' },
      { id: 'clothes', kind: 'interact', at: 'wardrobe', text: 'Find the singlet and boxers', prompt: '<b>[E]</b> Deploy the uniform' },
      { id: 'shelf', kind: 'interact', at: 'shelf', text: 'Inspect the rebar collection', prompt: '<b>[E]</b> Inspect the collection' },
      { id: 'garage', kind: 'interact', at: 'garage', text: 'Prepare the golden trolley', prompt: '<b>[E]</b> Wake the James Rebar trolley' },
      { id: 'gate', kind: 'reach', at: 'gate', radius: 5, text: 'Leave the yard' },
      { id: 'mcrebar', kind: 'reach', at: 'mcrebar', radius: 3, text: 'Ride to McRebar · park, then take the mall stairs' },
      { id: 'meal', kind: 'interact', at: 'mcrebar', text: 'Buy a Rebar Deluxe', prompt: '<b>[E]</b> Order a Rebar Deluxe' },
      {
        id: 'watched', kind: 'scene', look: 'mcrebar', text: 'Notice who is watching',
        lines: [
          ['bung', 'That was a perfect meal. I give it eleven out of ten rebars.'],
          ['gabor', 'He did not even check the toy. Typical Bung. All belly, no X-ray goggles.'],
          ['doc', 'Across Queen Street, a wiry man with an enormous forehead takes notes. The rivalry has a start date.'],
        ],
      },
    ],
  },
  {
    id: 'ch2', act: 1, n: 2, playable: true, start: 'mcrebar',
    title: 'THE GOLDEN MINI REBAR INCIDENT',
    reward: { coins: 100, relic: 'Golden Mini Rebar', archive: 'golden-mini' },
    steps: [
      {
        id: 'promo', kind: 'scene', look: 'mcrebar', text: 'Watch the Golden Mini promotion',
        lines: [
          ['doc', 'Every McRebar meal hides a miniature rebar. The Golden Mini Rebar is one in a hundred thousand.'],
          ['gabor', 'I bought goggles that see through cardboard. This is legal if you do not ask anyone.'],
          ['bung', 'That forehead is loitering with intent.'],
        ],
      },
      { id: 'order', kind: 'interact', at: 'mcrebar', text: 'Order another meal', prompt: '<b>[E]</b> Order, and watch the counter' },
      { id: 'goggles', kind: 'interact', at: 'gabor', text: 'Inspect Gabor\'s goggles', prompt: '<b>[E]</b> Ask about the ridiculous goggles' },
      { id: 'follow', kind: 'follow', text: 'Down the stairs, then follow Gabor past Apple' },
      { id: 'bag', kind: 'interact', at: 'bag', text: 'Catch him at the winning meal', prompt: '<b>[E]</b> Grab the meal he is scanning' },
      {
        id: 'confront', kind: 'scene', look: 'bag', text: 'Confront Gabor',
        lines: [
          ['bung', 'Those are X-ray goggles and that is my statistical destiny.'],
          ['gabor', 'It is research. The burger was a control group.'],
          ['bung', 'Get on the scooter. I am getting on the trolley. Back down Queen Street, you walking forehead.'],
        ],
      },
      { id: 'catch', kind: 'catch', text: 'Catch Gabor on the golden trolley' },
      { id: 'relic', kind: 'interact', at: 'bag', text: 'Take the Golden Mini Rebar', prompt: '<b>[E]</b> Pocket the Golden Mini Rebar' },
    ],
  },
  {
    id: 'ch3', act: 1, n: 3, playable: true, start: 'garage',
    title: 'MCREBAR MAX: BIG BOY MODE',
    reward: { coins: 150, relic: 'Platinum Diamond Rebar', archive: 'platinum-diamond' },
    steps: [
      {
        id: 'sabotage', kind: 'scene', look: 'garage', text: 'Inspect the sabotaged trolley',
        lines: [
          ['doc', 'McRebar Max arrives. Inside it, somewhere, is a Platinum Diamond Rebar. One in a million.'],
          ['gabor', 'I have put a spoon in your axle. A decorative spoon. You will thank me never.'],
          ['bung', 'The trolley is limping. This is a hate crime against engineering.'],
        ],
      },
      { id: 'parts', kind: 'parts', text: 'Collect the three repair parts', parts: ['hall', 'bank', 'mallBolt'] },
      { id: 'install', kind: 'interact', at: 'garage', text: 'Install the parts at the trolley pad', prompt: '<b>[E]</b> Install Big Boy Mode' },
      { id: 'rings', kind: 'rings', text: 'Ride the trolley through the three Queen Street rings', rings: ['ring1', 'ring2', 'ring3'] },
      { id: 'catch', kind: 'catch', text: 'Catch Gabor before he spends the Platinum meal' },
      { id: 'relic', kind: 'interact', at: 'bag', text: 'Recover the Platinum Diamond Rebar', prompt: '<b>[E]</b> Take the Platinum Diamond Rebar' },
    ],
  },
  {
    id: 'ch4', act: 1, n: 4, playable: true, start: 'mcrebar',
    title: 'THE EMERALD REBAR HEIST',
    reward: { coins: 250, relic: 'Emerald Rebar', archive: 'emerald-mini' },
    steps: [
      {
        id: 'announce', kind: 'scene', look: 'mcrebar', text: 'Hear about the Emerald Rebar',
        lines: [
          ['doc', 'The Emerald Mini Rebar. One in a hundred million. Gabor brings a drone and a plan with no brakes.'],
          ['gabor', 'I have scanned it out of the meal and into a collector\'s tent at South Bank. Try and look employed.'],
          ['bung', 'I will dress as a janitor. Janitors are the stealth helicopters of Brisbane.'],
        ],
      },
      { id: 'goto', kind: 'reach', at: 'event', radius: 8, text: 'Reach the South Bank collector lawn' },
      { id: 'scan', kind: 'interact', at: 'scanner', text: 'Find Gabor\'s scanner', prompt: '<b>[E]</b> Inspect the scanner and the drone' },
      { id: 'disguise', kind: 'interact', at: 'mop', text: 'Put on the janitor disguise', prompt: '<b>[E]</b> Wear the mop. Become the mop.' },
      { id: 'swap', kind: 'choice', text: 'Swap the real Emerald for the decoy', correct: 'ped-left' },
      { id: 'escape', kind: 'escape', text: 'Walk the Emerald out past Gabor' },
      { id: 'home', kind: 'interact', at: 'shelf', text: 'Put the Emerald on your shelf', prompt: '<b>[E]</b> Shelve the Emerald Rebar' },
    ],
  },
  {
    id: 'ch5', act: 2, n: 5, playable: true, start: 'plaza',
    title: 'CHING\'S ARRIVAL',
    blurb: 'Walk Ching through Queen Street. If you leave her, Gabor cuts in.',
    reward: { coins: 80, archive: 'ching-arrives' },
    steps: [
      {
        id: 'landed', kind: 'scene', look: 'plaza', text: 'Meet Ching at King George Square', cast: ['ching', 'gabor'],
        lines: [
          ['doc', 'Ching\'s visa clears. She does not tour China in this chronicle. She lands in Brisbane, at the square.'],
          ['ching', 'Bung. You are larger than the photographs and exactly as warned.'],
          ['bung', 'OIIII. Queen Street does burgers. I do the escort. Stay where I can see the jacket.'],
          ['gabor', 'I brought a bicycle and a feeling. Both are unwelcome and both are here.'],
        ],
      },
      { id: 'escort', kind: 'escort', text: 'Walk Ching to McRebar without letting Gabor cut in' },
      { id: 'join', kind: 'interact', at: 'arrival', text: 'Ask Ching to stay', prompt: '<b>[E]</b> Ching' },
    ],
  },
  {
    id: 'ch6', act: 2, n: 6, playable: true, start: 'mcrebar',
    title: 'THE GABOR JEALOUSY CRISIS',
    blurb: 'His scooter is faster than his bicycle. Keep the trolley on him.',
    reward: { coins: 120, archive: 'scooter-feud' },
    steps: [
      {
        id: 'reveal', kind: 'scene', look: 'mcrebar', text: 'Watch the scooter reveal', cast: ['gabor', 'ching'],
        lines: [
          ['gabor', 'The bicycle has retired. This scooter expresses my feelings at a higher top speed.'],
          ['ching', 'Your feelings have handlebars. That is not the compliment you think it is.'],
          ['bung', 'Mount up. If he reaches the river lawn alone he will practise a speech.'],
        ],
      },
      { id: 'race', kind: 'race', text: 'Stay with Gabor\'s scooter through the city', tail: 4 },
      {
        id: 'photo-drop', kind: 'scene', look: 'wlawn', go: 'wlawn', text: 'Take the dropped photograph', cast: ['gabor'],
        lines: [
          ['gabor', 'Fine. The photograph of the two of you is yours. I only wanted the negative, and the moment, and the city.'],
          ['bung', 'You wanted a crowd. You got a trolley.'],
          ['ching', 'Frame it. Then never let him hold the frame.'],
        ],
      },
    ],
  },
  {
    id: 'ch7', act: 3, n: 7, playable: true, start: 'plaza',
    title: 'THE LEGENDARY RAP BATTLE',
    blurb: 'A real bar-for-bar battle at King George Square.',
    reward: { coins: 200, archive: 'rap-battle' },
    steps: [
      {
        id: 'mic', kind: 'scene', look: 'plaza', text: 'Take the square', cast: ['gabor', 'ching'],
        lines: [
          ['doc', 'King George Square grows a crowd, a speaker, and one forehead with a rhyme scheme.'],
          ['gabor', 'I will bury you in metaphor. The metaphor is steel and it is heavier than you, which is saying something.'],
          ['ching', 'Hit the gold, Bung. I will handle the cheering and the alibi.'],
        ],
      },
      { id: 'rap', kind: 'rhythm', text: 'Win the rap battle', notes: 10, need: 7, gap: 0.92, window: 0.09, banner: 'QUEEN STREET CYPHER' },
      {
        id: 'bow', kind: 'scene', look: 'plaza', text: 'Bow, badly', cast: ['ching'],
        lines: [
          ['doc', 'The square awards it to the singlet. Gabor\'s scooter idles through the applause like it disagrees.'],
          ['bung', 'That was poetry. It was also mostly the word rebar, used correctly.'],
          ['ching', 'Correctly and often. I am keeping the recording.'],
        ],
      },
    ],
  },
  {
    id: 'ch8', act: 3, n: 8, playable: true, start: 'home',
    title: 'THE SAMSUNG S24 ULTRA CATASTROPHE',
    blurb: 'Photograph the crime, then save the pieces from his drone.',
    reward: { coins: 40, archive: 'samsung' },
    steps: [
      {
        id: 'gift', kind: 'scene', look: 'home', text: 'Listen to Ching', cast: ['ching'],
        lines: [
          ['ching', 'Blue Rebar Edition. Do not juggle it. Do not show it to a man who owns a scooter and a grudge.'],
          ['bung', 'I will show it to exactly no foreheads.'],
        ],
      },
      { id: 'phone', kind: 'interact', at: 'phone', text: 'Take the blue Rebar Edition', prompt: '<b>[E]</b> Take the phone' },
      { id: 'mall', kind: 'reach', at: 'smash', radius: 7, text: 'Carry it to Queen Street Mall' },
      {
        id: 'snap', kind: 'photo', at: 'smash', text: 'Photograph Gabor with the phone',
        banner: 'CATCH HIM IN FRAME', help: 'Press F when the marker is in the gold. You get three tries.',
        sweet: 0.1, tries: 3, grant: 'photo',
      },
      {
        id: 'smash', kind: 'scene', look: 'smash', text: 'Watch the phone die', cast: ['gabor', 'ching'],
        lines: [
          ['gabor', 'Blue is a provocative colour. I am provoking it into several smaller colours.'],
          ['doc', 'The Rebar Edition meets the footpath. The photograph survives. The phone does not.'],
          ['ching', 'The pieces. Before his drone tidies them into his pocket.'],
        ],
      },
      { id: 'shards', kind: 'shards', at: 'smash', text: 'Grab the three shards before the drone does' },
    ],
  },
  {
    id: 'ch9', act: 3, n: 9, playable: true, start: 'home',
    title: 'THE $10,000 BRISBANE CITY COURT LAWSUIT',
    blurb: 'Bring the right exhibit to each question. The wrong one is overruled.',
    reward: { coins: 10000, archive: 'court-win' },
    steps: [
      {
        id: 'brief', kind: 'scene', look: 'home', text: 'Open the brief', cast: ['ching'],
        lines: [
          ['ching', 'Ten thousand dollars. Receipt, witness, photograph. Parliament lawn is sitting as our court, because that is where this story put the plaque.'],
          ['bung', 'I will bring the truth, the receipt, and a singlet. The singlet is not evidence. I checked.'],
        ],
      },
      {
        id: 'proof', kind: 'evidence', text: 'Collect the receipt, the witness and the goggles box',
        items: [
          { id: 'receipt', at: 'receipt', who: 'doc', line: 'The receipt says ten thousand dollars and does not apologise.' },
          { id: 'witness', at: 'witness', who: 'ching', line: 'South Bank saw the goggles and the swing. They will say so.' },
          { id: 'goggles', at: 'gogbox', who: 'gabor', line: 'That box is private. It is also on the ground, which is a kind of public.' },
        ],
      },
      {
        id: 'print', kind: 'photo', at: 'smash', text: 'Print the photograph of the smash',
        banner: 'EVIDENCE PRINT', help: 'Press F in the gold to lock the print.',
        sweet: 0.1, tries: 3, grant: 'photo',
      },
      { id: 'approach', kind: 'reach', at: 'court', radius: 8, text: 'Reach the court on the Parliament lawn' },
      {
        id: 'trial', kind: 'trial', text: 'Present the right evidence to each question',
        evidence: [
          { id: 'photo', label: 'PHOTOGRAPH' },
          { id: 'receipt', label: 'RECEIPT' },
          { id: 'goggles', label: 'GOGGLES' },
          { id: 'witness', label: 'WITNESS' },
        ],
        questions: [
          { prompt: 'What proves the phone was destroyed?', answer: 'photo', reply: 'There he is, mid-swing, and there is the blue glass.', bad: 'That does not show a broken phone.' },
          { prompt: 'What proves the value?', answer: 'receipt', reply: 'Ten thousand dollars. The court can read.', bad: 'Value is a number. Bring the number.' },
          { prompt: 'Who puts Gabor at the scene?', answer: 'witness', reply: 'South Bank saw the forehead and the follow-through.', bad: 'The court wants a person, not a gadget.' },
        ],
      },
      {
        id: 'verdict', kind: 'scene', look: 'court', text: 'Hear the verdict', cast: ['ching'],
        lines: [
          ['judge', 'Ten thousand dollars to Bung Bunty. The phone is gone. The debt is not.'],
          ['gabor', 'I will pay it in instalments of resentment.'],
          ['bung', 'I accept the money and the resentment. Only one of them spends.'],
        ],
      },
    ],
  },
  {
    id: 'ch10', act: 3, n: 10, playable: true, start: 'wlawn',
    title: 'W BRISBANE: THE VICTORY CELEBRATION',
    blurb: 'Hold the lawn while Gabor tries to break the dance.',
    reward: { coins: 500, archive: 'w-brisbane' },
    steps: [
      {
        id: 'invite', kind: 'scene', look: 'wlawn', text: 'Arrive at the victory lawn', cast: ['ching', 'gabor'],
        lines: [
          ['doc', 'The story\'s victory lawn stands in for the W Brisbane night. The hotel mesh is not in this map. The party is.'],
          ['ching', 'New phone on the table. Old song on the lawn. If he bumps you, we start the song again.'],
          ['gabor', 'I was not invited, which is why I am on time.'],
        ],
      },
      { id: 'dance', kind: 'hold', at: 'wlawn', text: 'Keep the celebration going', seconds: 8, radius: 6, help: 'Stay on the lawn. A bump from Gabor restarts the song.' },
      { id: 'newphone', kind: 'interact', at: 'wlawn', text: 'Pocket the replacement phone', prompt: '<b>[E]</b> Take the new phone' },
      {
        id: 'toast', kind: 'scene', look: 'home', go: 'home', text: 'Toast the glass that survived', cast: ['ching'],
        lines: [
          ['ching', 'Same edition. New glass. We are even with the afternoon.'],
          ['bung', 'W Brisbane can have the story. West End has the bed. I know which one holds me.'],
        ],
      },
    ],
  },
  {
    id: 'ch11', act: 4, n: 11, playable: true, start: 'pitch',
    title: 'THE REBAR CRICKET PRODIGY',
    blurb: 'Four balls at Davies Park. Three catches, or the over is struck off.',
    reward: { coins: 300, archive: 'rebar-cricket' },
    steps: [
      {
        id: 'pads', kind: 'scene', look: 'pitch', text: 'Walk out at Davies Park', cast: ['ching'],
        lines: [
          ['doc', 'Davies Park. A real lawn. An unreal technique.'],
          ['bung', 'I trained in Satisfactory, which is a game about belts, which is basically cricket if the ball is a resource and I am the factory.'],
          ['ching', 'That explanation will not be entering the scorebook. Catch the ball.'],
        ],
      },
      { id: 'over', kind: 'cricket', text: 'Catch the over', balls: 4, need: 3, sweet: 0.12 },
      {
        id: 'scorebook', kind: 'scene', look: 'pitch', text: 'Sign the absurd scorebook', cast: ['ching'],
        lines: [
          ['doc', 'Three catches. The scorebook lists the method as Satisfactory, then crosses it out, then leaves it because nobody offered a better noun.'],
          ['bung', 'The ball had a crafting time. I respected it.'],
        ],
      },
    ],
  },
  {
    id: 'ch12', act: 4, n: 12, playable: true, start: 'bank',
    title: 'THE GREAT BRISBANE METEOR CRISIS',
    blurb: 'Three meteors over South Bank. Miss three and the count restarts.',
    reward: { coins: 600, archive: 'meteor-save' },
    steps: [
      {
        id: 'alarm', kind: 'scene', look: 'bank', text: 'Hear the sky misbehave', cast: ['ching'],
        lines: [
          ['doc', 'South Bank. The sky donates three meteors and no instructions.'],
          ['ching', 'Under the shadow. F when it is low. Not when it is a theory.'],
          ['bung', 'I have caught burgers, a rival, and now geology. The set is expanding.'],
        ],
      },
      {
        id: 'meteors', kind: 'sky', at: 'bank', text: 'Catch three meteors',
        count: 3, fallRate: 0.15, swayAmp: 3.5, catchRadius: 3.8, orb: 'meteor', save: 1,
        banner: 'METEOR', miss: 'The lawn has a new rock. I am getting the next one.',
      },
      {
        id: 'saved1', kind: 'scene', look: 'bank', text: 'Let the park clap', cast: ['ching'],
        lines: [
          ['doc', 'The first world-saving catch. South Bank keeps the grass and loses the headline to a man in a singlet.'],
          ['bung', 'One. The sky is on notice.'],
        ],
      },
    ],
  },
  {
    id: 'ch13', act: 4, n: 13, playable: true, start: 'river',
    title: 'THE FALLING-BOMB INCIDENT',
    blurb: 'Slower, wider, and meaner. Catch both before they cartoon the bridge.',
    reward: { coins: 600, archive: 'bomb-save' },
    steps: [
      {
        id: 'beep', kind: 'scene', look: 'river', text: 'Spot the cartoon bombs', cast: ['ching'],
        lines: [
          ['doc', 'Victoria Bridge\'s north bank. Two bombs fall the way cartoons fall: rude, beeping, and personally.'],
          ['ching', 'They sway. Do not plant your feet and hope. Hope is not a coordinate.'],
          ['bung', 'I am a coordinate. A round one.'],
        ],
      },
      {
        id: 'bombs', kind: 'sky', at: 'river', text: 'Catch both bombs',
        count: 2, fallRate: 0.1, swayAmp: 7, sway: 1.7, catchRadius: 2.7, orb: 'bomb', save: 2,
        banner: 'BOMB', miss: 'It bounced. Cartoon bombs bounce. I do not enjoy the lesson.',
      },
      {
        id: 'watchers', kind: 'scene', look: 'river', text: 'Notice the government', cast: ['ching'],
        lines: [
          ['doc', 'Someone with a clipboard starts a file. The file\'s title is just his name and a question mark.'],
          ['ching', 'Two saves. They will ask for a third before they ask for your autograph.'],
        ],
      },
    ],
  },
  {
    id: 'ch14', act: 4, n: 14, playable: true, start: 'plaza',
    title: 'THE THIRD IMPOSSIBLE SAVE',
    blurb: 'This one only counts if the trolley is moving.',
    reward: { coins: 800, archive: 'third-save' },
    steps: [
      {
        id: 'sat', kind: 'scene', look: 'plaza', text: 'Hear the third alarm', cast: ['ching'],
        lines: [
          ['doc', 'A rebar satellite, which is not a recognised class of satellite, is coming down on King George Square.'],
          ['ching', 'Trolley. Speed. If you are standing still you are a pedestrian, and pedestrians do not catch satellites.'],
          ['bung', 'Big Boy Mode, if you are listening, this is your performance review.'],
        ],
      },
      {
        id: 'catch3', kind: 'sky', at: 'plaza', text: 'Catch the satellite twice, at speed',
        count: 2, fallRate: 0.2, swayAmp: 5, catchRadius: 4.2, orb: 'sat', save: 3, ride: true, minSpeed: 8,
        banner: 'RIDE', miss: 'Too slow or too late. The square is still a square. Again.',
      },
      {
        id: 'three', kind: 'scene', look: 'plaza', text: 'Count them', cast: ['ching'],
        lines: [
          ['doc', 'Meteor. Bomb. Satellite. Three impossible saves, all of them Brisbane, all of them his hands.'],
          ['bung', 'Tell the clipboard I am available for weddings and re-entry.'],
        ],
      },
    ],
  },
  {
    id: 'ch15', act: 4, n: 15, playable: true, start: 'plaza',
    title: 'THE THREE-BILLION-DOLLAR BUNG',
    blurb: 'The city chants, three people say his name, then the cheque.',
    reward: { coins: 3000, archive: 'three-billion' },
    steps: [
      {
        id: 'name', kind: 'scene', look: 'plaza', text: 'Hear Brisbane say it', cast: ['ching'],
        lines: [
          ['doc', 'The reward is three billion dollars. The number is fictional. The noise in the square is not a rumour.'],
          ['ching', 'They want a chant. Give them the bars. Then we collect the people who will say your name to a camera.'],
        ],
      },
      { id: 'chant', kind: 'rhythm', text: 'Lead the chant', notes: 8, need: 5, gap: 0.84, window: 0.1, banner: 'CITY CHANT' },
      {
        id: 'names', kind: 'evidence', text: 'Let three places say his name',
        items: [
          { id: 'square-name', at: 'plaza', who: 'doc', line: 'King George Square says Bung Bunty like it is a suburb.' },
          { id: 'mall-name', at: 'smash', who: 'ching', line: 'Queen Street says it between the buses.' },
          { id: 'bank-name', at: 'bank', who: 'bung', line: 'South Bank says it, then asks if the meteors are coming back. They are not.' },
        ],
      },
      { id: 'to-court', kind: 'reach', at: 'court', radius: 8, text: 'Go to the Parliament lawn for the cheque' },
      { id: 'cheque', kind: 'interact', at: 'cheque', text: 'Sign the three-billion-dollar cheque', prompt: '<b>[E]</b> Sign the cheque' },
    ],
  },
  {
    id: 'ch16', act: 5, n: 16, playable: true, start: 'home',
    title: 'THE THREE-STOREY REBAR MANSION',
    blurb: 'Climb it. Bottom floor Ching\'s family. Middle floor the two of you. Top floor Bung\'s.',
    reward: { coins: 400, archive: 'rebar-mansion' },
    steps: [
      {
        id: 'keys', kind: 'scene', look: 'home', text: 'Look up at the new house', cast: ['ching'],
        lines: [
          ['doc', 'The West End house grows two more storeys. Bottom: Ching\'s family. Middle: Bung and Ching. Top: Bung\'s family. The street is the same street.'],
          ['ching', 'Stairs on the north side. Talk to them on their own floors. Shouting up the stairwell is not a visit.'],
          ['bung', 'I own a vertical direction. I intend to use it.'],
        ],
      },
      {
        id: 'floors', kind: 'visits', text: 'Visit every floor and every parent',
        visits: [
          { id: 'f-cmum', at: 'fcmum', floor: 0, speaker: 'ching', lines: [['ching', 'Ma. This is the bottom floor. It is yours. The singlet comes with the building and cannot be removed by law.'], ['bung', 'I am the law\'s favourite exception.']] },
          { id: 'f-cdad', at: 'fcdad', floor: 0, speaker: 'ching', lines: [['ching', 'Ba, the trolley is not a pet. It is a vehicle with opinions.'], ['bung', 'Correct opinions.']] },
          { id: 'f-bed', at: 'fbed', floor: 1, speaker: 'bung', lines: [['bung', 'Middle floor. Our bed, our shelf, our ridiculous quiet.'], ['ching', 'The shelf faces the river. The relics can watch the city they came from.']] },
          { id: 'f-bmum', at: 'fbmum', floor: 2, speaker: 'bung', lines: [['bung', 'Mum. Top floor. You can see the square from here if you lean and believe.'], ['ching', 'Do not lean. We just won a court case about gravity.']] },
          { id: 'f-bdad', at: 'fbdad', floor: 2, speaker: 'bung', lines: [['bung', 'Dad. The cheque is fictional and the house is standing, which is the better engineering.'], ['doc', 'Both families are in. The mansion is no longer a punchline.']] },
        ],
      },
    ],
  },
  {
    id: 'ch17', act: 5, n: 17, playable: true, start: 'home',
    title: 'GABOR\'S BILLIONAIRE JEALOUSY',
    blurb: 'Cross the tornado lawn, shut it off, then take the second rap.',
    reward: { coins: 700, archive: 'tornado' },
    steps: [
      {
        id: 'envy', kind: 'scene', look: 'home', text: 'Hear the machine start', cast: ['gabor'],
        lines: [
          ['gabor', 'Three billion and a house with parents in it. I have built a tornado machine at South Bank. It is a critique.'],
          ['ching', 'It is a lawnmower with delusions. Switch on the far side of the lawn. Do not donate your singlet to the wind.'],
          ['bung', 'If it wants a rap battle afterwards, it can lose that too.'],
        ],
      },
      { id: 'lawn', kind: 'reach', at: 'dodgeStart', radius: 6, text: 'Reach the edge of the South Bank lawn' },
      { id: 'tornado', kind: 'dodge', at: 'event', back: 'dodgeStart', text: 'Cross the lawn and shut the machine off' },
      { id: 'rap2', kind: 'rhythm', text: 'Win the second rap battle', notes: 12, need: 9, gap: 0.74, window: 0.075, banner: 'SECOND CYPHER' },
    ],
  },
  {
    id: 'ch18', act: 6, n: 18, playable: true, start: 'expo',
    title: 'THE BRISBANE REBAR EXPO',
    blurb: 'Time the kebab, catch Gabor in the flash, then hold the booth.',
    reward: { coins: 700, archive: 'rebar-expo' },
    steps: [
      {
        id: 'gates', kind: 'scene', look: 'expo', text: 'Open the expo', cast: ['ching', 'gabor'],
        lines: [
          ['doc', 'King George Square, dressed as the Brisbane Rebar Expo. The kebab heats itself. Ching has the camera.'],
          ['gabor', 'I am a guest, a critic, and a man about to be in a photograph he did not approve.'],
        ],
      },
      {
        id: 'kebab', kind: 'photo', at: 'kebab', text: 'Time the self-heating kebab',
        banner: 'KEBAB TEMPERATURE', help: 'Press F in the narrow gold or it welds itself to the booth.',
        sweet: 0.07, tries: 3,
      },
      {
        id: 'flash', kind: 'photo', at: 'flash', text: 'Catch Gabor in Ching\'s flash',
        banner: 'CHING\'S FLASH', help: 'Press F in the gold. He will not pose twice.',
        sweet: 0.09, tries: 3, grant: 'flash',
      },
      { id: 'booth', kind: 'hold', at: 'expo', text: 'Hold the booth while he tries to break it up', seconds: 7, radius: 5.5, help: 'Stay inside the booth circle.' },
    ],
  },
  {
    id: 'ch19', act: 6, n: 19, playable: true, start: 'home',
    title: 'THE GREAT BRISBANE SNOW DISASTER',
    blurb: 'Four piles, one clock. If it runs out, the snow comes back.',
    reward: { coins: 400, archive: 'brisbane-snow' },
    steps: [
      {
        id: 'flake', kind: 'scene', look: 'home', text: 'Look at the impossible weather', cast: ['ching'],
        lines: [
          ['doc', 'A metre of snow from West End to the CBD. It is temporary. It is also extremely in the way.'],
          ['ching', 'Four piles. Clear them before I start charging the sky rent.'],
          ['bung', 'I did not pack a coat. I packed a trolley. The trolley will have to be the coat.'],
        ],
      },
      { id: 'clear', kind: 'snow', text: 'Clear four snow piles before the clock dies', seconds: 110, piles: ['snow1', 'snow2', 'snow3', 'snow4'] },
      {
        id: 'melt', kind: 'scene', look: 'plaza', go: 'plaza', text: 'Watch it melt', cast: ['ching'],
        lines: [
          ['doc', 'The snow gives up. Brisbane returns to being Brisbane, which is to say bright, loud, and unfrozen.'],
          ['bung', 'I would like the weather to file a complaint with someone else.'],
        ],
      },
    ],
  },
  {
    id: 'ch20', act: 6, n: 20, playable: true, start: 'yard',
    title: 'SEB DALY: THE BIG BOSS OF BRISBANE',
    blurb: 'Three rebars, three drops, and the trolley is not optional.',
    reward: { coins: 900, relic: 'Three Standard Rebars', archive: 'seb-daly' },
    steps: [
      { id: 'seb-meet', kind: 'interact', at: 'yard', text: 'Take the job from Seb Daly', prompt: '<b>[E]</b> Talk to Seb Daly' },
      { id: 'run', kind: 'deliver', text: 'Deliver three standard rebars', drops: ['drop1', 'drop2', 'drop3'] },
      { id: 'seb-pay', kind: 'interact', at: 'yard', text: 'Collect Seb\'s word and the rebars', prompt: '<b>[E]</b> Report back to Seb' },
    ],
  },
  {
    id: 'ch21', act: 6, n: 21, playable: true, start: 'clue1',
    title: 'REBAR MAN RISES AGAIN',
    blurb: 'The scraps only work in order. Then match him at the workshop.',
    reward: { coins: 500, archive: 'rebar-man' },
    steps: [
      {
        id: 'whisper', kind: 'scene', look: 'clue1', text: 'Hear the old name', cast: ['ching'],
        lines: [
          ['doc', 'Rebar Man is a rumour with a workshop. The scraps are numbered in the only order that does not lie.'],
          ['ching', 'Square, then Queen Street, then South Bank. Touch them out of order and the trail forgets you.'],
        ],
      },
      {
        id: 'scraps', kind: 'sequence', text: 'Read the three scraps in order',
        order: ['clue1', 'clue2', 'clue3'],
        lines: [
          'King George Square kept the first half of a map.',
          'Queen Street kept the second, under a stall that is not sorry.',
          'South Bank kept the X. The workshop is in West End, behind the house.',
        ],
      },
      { id: 'door', kind: 'reach', at: 'workshop', radius: 6, text: 'Find the hidden workshop' },
      { id: 'mirror', kind: 'rhythm', text: 'Match Rebar Man\'s poses', notes: 8, need: 6, gap: 0.8, window: 0.09, banner: 'REBAR MAN' },
    ],
  },
  {
    id: 'ch22', act: 6, n: 22, playable: true, start: 'river',
    title: 'THE AWAKENING OF SIR GIRDERFACE',
    blurb: 'Six of ten eyes, by the river, before four of them close on you.',
    reward: { coins: 800, relic: 'Obsidian Rebar', archive: 'girderface' },
    steps: [
      {
        id: 'wake', kind: 'scene', look: 'river', text: 'Wake him on purpose', cast: ['ching'],
        lines: [
          ['doc', 'Sir Girderface sleeps in the story and wakes on the Victoria Bridge bank. Ten eyes. An offering if you can meet them.'],
          ['ching', 'Run to the eye that opens. Press F while you are close. Four missed eyes and he goes back to sleep insulted.'],
          ['bung', 'I have caught worse and I have caught lunch. Eyes are a category I can add.'],
        ],
      },
      { id: 'eyes', kind: 'eyes', at: 'river', text: 'Meet six of the ten eyes' },
      { id: 'offer', kind: 'interact', at: 'river', text: 'Leave the offering', prompt: '<b>[E]</b> Offer the obsidian rebar' },
    ],
  },
  {
    id: 'ch23', act: 6, n: 23, playable: true, start: 'mcrebar',
    title: 'THE ULTIMATE GABOR SHOWDOWN',
    blurb: 'A race, an over, and a last rap. Lose a round and that round starts again.',
    reward: { coins: 2000, archive: 'showdown' },
    steps: [
      {
        id: 'call', kind: 'scene', look: 'mcrebar', text: 'Answer him', cast: ['gabor', 'ching'],
        lines: [
          ['gabor', 'Queen Street. Then the pitch in your hands. Then the mic. I am cashing in every loss at once.'],
          ['ching', 'Three rounds. I will be at your shoulder for all of them.'],
          ['bung', 'Then mount something. I am mounting the trolley.'],
        ],
      },
      { id: 'last-race', kind: 'race', text: 'Beat his scooter one last time', tail: 5 },
      { id: 'last-over', kind: 'cricket', text: 'Catch the showdown over', balls: 4, need: 3, sweet: 0.09 },
      { id: 'last-rap', kind: 'rhythm', text: 'Win the last rap battle', notes: 12, need: 10, gap: 0.68, window: 0.07, banner: 'FINAL CYPHER' },
      {
        id: 'yield', kind: 'scene', look: 'plaza', go: 'plaza', text: 'Hear him yield', cast: ['gabor', 'ching'],
        lines: [
          ['gabor', 'The scooter is parked. The rhyme is parked. I am still Gabor. I am just not winning today.'],
          ['bung', 'Today is the whole point. Come to the house when you can say it without a machine.'],
          ['ching', 'He will. Not tonight. Tonight the city is ours.'],
        ],
      },
    ],
  },
  {
    id: 'ch24', act: 6, n: 24, playable: true, start: 'home',
    title: 'THE LEGEND OF BUNG BUNTY',
    blurb: 'The floors, one last lap of Queen Street, and a suitcase that stays shut.',
    reward: { coins: 1000, archive: 'bung-legend' },
    steps: [
      {
        id: 'quiet', kind: 'scene', look: 'home', text: 'Stand in the doorway', cast: ['ching'],
        lines: [
          ['doc', 'The chronicle comes home. The relics are on the shelf. The families are upstairs and down. Brisbane is still the map.'],
          ['ching', 'Say goodbye properly. Then ride the rings once more. Then the suitcase.'],
          ['bung', 'The suitcase is for later. I am not later. I am here.'],
        ],
      },
      {
        id: 'goodbye', kind: 'visits', text: 'Say goodbye on each floor',
        visits: [
          { id: 'f-bed', at: 'fbed', floor: 1, speaker: 'ching', lines: [['ching', 'Middle floor. If the world tour ever starts, it starts from this bed, not from a loading screen.'], ['bung', 'Agreed. The bed has seniority.']] },
          { id: 'f-cmum', at: 'fcmum', floor: 0, speaker: 'ching', lines: [['ching', 'Ma, we are not flying tonight. The visa was for staying.']] },
          { id: 'f-bmum', at: 'fbmum', floor: 2, speaker: 'bung', lines: [['bung', 'Mum, the top floor keeps the view. I will be back before the kettle complains.']] },
        ],
      },
      { id: 'lap', kind: 'rings', text: 'Ride the three Queen Street rings one last time', rings: ['ring1', 'ring2', 'ring3'] },
      { id: 'suitcase', kind: 'interact', at: 'suitcase', text: 'Leave the suitcase closed', prompt: '<b>[E]</b> The suitcase' },
    ],
  },
];
