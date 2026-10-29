// Canonical Bung Bunty facts used by dialogue, the archive, the map and collectibles.
// This is the game's identity layer — not a claim that every system below is finished.
import { state, bus } from '../core/state.js';
import { BRISBANE_GEO } from '../world/geo/brisbane.data.js';
import { HONGKONG_GEO } from '../world/geo/hongkong.data.js';
import { SYDNEY_GEO } from '../world/geo/sydney.data.js';

const B = BRISBANE_GEO.landmarks;
const H = HONGKONG_GEO.landmarks;
const S = SYDNEY_GEO.landmarks;

export const REBAR_TYPES = {
  rebar:        { name: 'Standard Rebar', value: 0, color: 0xb35c2a, archive: 'rebar-rebar' },
  reinforced:   { name: 'Reinforced Rebar', value: 18, color: 0x9aa3ad, archive: 'rebar-reinforced' },
  goldenrebar:  { name: 'Golden Rebar', value: 40, color: 0xffc94d, archive: 'rebar-golden' },
  radioactive:  { name: 'Radioactive Rebar', value: 55, color: 0x7dff4a, archive: 'rebar-radio' },
  james:        { name: 'James Rebar', value: 90, color: 0xffe7a0, archive: 'rebar-james' },
  bent:         { name: 'Bent Rebar', value: 12, color: 0x6a5344, archive: 'rebar-bent' },
  forbidden:    { name: 'Forbidden Rebar', value: 140, color: 0x8f1fff, archive: 'rebar-forbidden' },
  obsidian:     { name: 'Obsidian Rebar', value: 220, color: 0x140814, archive: 'rebar-obsidian' },
};

export const DISTRICTS = [
  { zone: 'mansion', name: 'Bung Mansion', detail: 'Three floors. Middle floor is Bung and Chung. Family upstairs. Chung\'s family down.', x: 0, y: 0.7, z: 22 },
  { zone: 'mansion', name: 'James Rebar Garage', detail: 'The golden trolley lives here. Do not question it.', x: -30, y: 0.6, z: -4 },
  { zone: 'mansion', name: 'Rebar Cricket Pitch', detail: 'Where bombs were allegedly stopped. The pitch remembers.', x: 0, y: 0.5, z: 48 },
  { zone: 'brisbane', name: 'Queen Street Mall', detail: 'Real pedestrian centreline. McRebar is the shop Bung brought with him.', x: B.queenMall.x, y: B.queenMall.ya ?? B.queenMall.y, z: B.queenMall.z },
  { zone: 'brisbane', name: 'Story Bridge', detail: 'OSM outline. Deck follows the published river clearance on the 2019 DEM.', x: B.storyBridge.x, y: B.storyBridge.ya ?? B.storyBridge.y, z: B.storyBridge.z },
  { zone: 'brisbane', name: 'South Bank Parklands', detail: 'The park polygon south of the Brisbane River.', x: B.southBank.x, y: B.southBank.ya ?? B.southBank.y, z: B.southBank.z },
  { zone: 'brisbane', name: 'Parliament House', detail: 'Real footprint. The $10,000 plaque is not.', x: B.parliament.x, y: B.parliament.ya ?? B.parliament.y, z: B.parliament.z },
  { zone: 'brisbane', name: 'Brisbane City Hall', detail: 'The local origin of the metre grid.', x: B.cityHall.x, y: B.cityHall.ya ?? B.cityHall.y, z: B.cityHall.z },
  { zone: 'brisbane', name: 'Davies Park', detail: 'West End. OSM park. The riverbank west of longitude 153.000 is outside this compile.', x: B.daviesPark.x, y: B.daviesPark.ya ?? B.daviesPark.y, z: B.daviesPark.z },
  { zone: 'brisbane', name: 'Raymond Park', detail: 'Park on the Kangaroo Point peninsula. Cliffs come from the 2019 LiDAR survey.', x: B.raymondPark.x, y: B.raymondPark.ya ?? B.raymondPark.y, z: B.raymondPark.z },
  { zone: 'brisbane', name: 'Kangaroo Point Bridge', detail: 'OSM outline. Deck follows the published river clearance on the 2019 DEM.', x: B.kangarooBridge.x, y: B.kangarooBridge.ya ?? B.kangarooBridge.y, z: B.kangarooBridge.z },
  { zone: 'sydney', name: 'International Terminal T1', detail: 'OSM way 1338678861, about 94 by 140 metres. The interior is not a measured plan.', x: S.terminal.x, y: S.terminal.y, z: S.terminal.z },
  { zone: 'sydney', name: 'Runway 16R/34L', detail: 'Mapped runway centre. Width uses the OSM width tag where that tag exists.', x: S.rwy16R34L.cx, y: 0.5, z: S.rwy16R34L.cz },
  { zone: 'hongkong', name: 'Two International Finance Centre', detail: 'Grid origin. Height 415.8 m is the OSM height tag on way 25589595.', x: H.twoIfc.x, y: H.twoIfc.y, z: H.twoIfc.z },
  { zone: 'hongkong', name: 'Central Star Ferry Pier', detail: 'Chung waits on the landward side of the pier. The harbour is the mapped coastline.', x: H.starFerry.x, y: H.starFerry.y, z: H.starFerry.z },
  { zone: 'hongkong', name: 'Tsim Sha Tsui Clock Tower', detail: 'Across Victoria Harbour from Two IFC. The tower footprint is OSM way 37664321.', x: H.clockTower.x, y: H.clockTower.y, z: H.clockTower.z },
  { zone: 'shenzhen', name: 'Cyber Rebar Core', detail: 'The monopoly\'s ugly heart. Forehead energy critical.', x: 0, y: 0.5, z: 0 },
];

export const ARCHIVE = [
  { id: 'bung', title: 'Bung Bunty', body: 'Born 3 March 1977. Brisbane. Stained singlet, brown boxers, four rebar hairs, a ten-hair goatee. Became a billionaire by treating falling bombs like a cricket delivery. Has no idea this is unusual.' },
  { id: 'ching', title: 'Chung', body: 'Met Bung while he was travelling in China. Moved to Brisbane. Shares the rebar obsession, owns the second golden James Rebar trolley, and is the reason the mansion has not been condemned.' },
  { id: 'gabor', title: 'Gabor Mihala', body: 'Wiry. Enormous forehead. Small orange beard. Scooter. Jealous of Bung, interested in Chung, and now trying to monopolise the international rebar supply. The Parliament House lawsuit was $10,000 and somehow made him prouder.' },
  { id: 'james', title: 'James Rebar', body: 'Not a man so much as a standard. The golden motorised trolley, the workshop, and every serious piece of rebar engineering answers to this name.' },
  { id: 'seb', title: 'Seb Daly', body: 'Big Boss of Brisbane. If a shipment moves through the CBD without a receipt, Seb already knows the colour of the truck.' },
  { id: 'girderface', title: 'Sir Girderface', body: 'The Rebar Overlord. Ten eyes. Obsidian segments. A molten-girder trail. Originally a Rebar Simulator legend. Waking it is a terrible idea that Bung will do anyway.' },
  { id: 'virus', title: 'Rebar Attack Virus', body: 'Bung insists molten rebar attacks left him dramatically afflicted. Chung insists he ate four burgers and then stood too close to a grinder.' },
  { id: 'tour', title: 'The Great World Tour', body: 'China, Japan, airports, luxury hotels, and at least one rebar catastrophe per city. Sydney to Hong Kong is the chapter the trolley still talks about.' },
  { id: 'bombs', title: 'The Billionaire Incident', body: 'Newspapers still run the photo: a round man, a length of rebar, and a sky that used to contain bombs. The Botanic Gardens plaque understates it on purpose.' },
  { id: 'conspiracy', title: 'The Global Rebar Conspiracy', body: 'Gabor\'s scooters, Brisbane warehouses, a Sydney departure, and a Hong Kong night market of illegal steel. One supply chain. One forehead.' },
  { id: 'cricket', title: 'Rebar Cricket', body: 'Three deliveries. Hit the sweet spot. The pitch at the mansion is regulation-Bung, which means it is not regulation.' },
  { id: 'golden-mini', title: 'Golden Mini Rebar', body: 'One in a hundred thousand McRebar meals. Gabor tried to see it through the box. Bung saw him instead.' },
  { id: 'platinum-diamond', title: 'Platinum Diamond Rebar', body: 'The McRebar Max prize. One in a million. It arrived after a spoon was removed from the axle and Big Boy Mode was installed.' },
  { id: 'emerald-mini', title: 'Emerald Rebar', body: 'One in a hundred million. It left a South Bank collector lawn inside a singlet, which is not a recognised transport category.' },
  { id: 'ching-arrives', title: 'Ching Arrives', body: 'The visa cleared into Brisbane. Ching walked Queen Street with Bung. Gabor brought a bicycle and was not invited to keep it.' },
  { id: 'scooter-feud', title: 'The Scooter', body: 'Gabor retired the bicycle. The scooter was jealousy with a throttle. The trolley stayed with it through the city.' },
  { id: 'rap-battle', title: 'The First Rap Battle', body: 'King George Square. Bars on the beat. The singlet took the applause.' },
  { id: 'samsung', title: 'The Blue Rebar Edition', body: 'A Samsung S24 Ultra, Rebar Edition, blue. Gabor turned it into evidence. The photograph survived.' },
  { id: 'court-win', title: 'Ten Thousand Dollars', body: 'A fictional sitting on the Parliament lawn. The right exhibit for each question. The court wrote $10,000.' },
  { id: 'w-brisbane', title: 'The Victory Lawn', body: 'The W Brisbane night, played on a riverside lawn because the hotel is not in this map. The song survived Gabor.' },
  { id: 'rebar-cricket', title: 'Davies Park', body: 'Four balls. Three catches. The scorebook still says Satisfactory, against everybody\'s advice.' },
  { id: 'meteor-save', title: 'The First Save', body: 'Three meteors over South Bank. Bung was under them at the right second.' },
  { id: 'bomb-save', title: 'The Second Save', body: 'Two cartoon bombs by Victoria Bridge. They swayed. He did not miss twice in a row.' },
  { id: 'third-save', title: 'The Third Save', body: 'A rebar satellite over King George Square. It only counted because the trolley was moving.' },
  { id: 'three-billion', title: 'Three Billion', body: 'A fictional cheque with too many zeroes. Brisbane said his name in three places first.' },
  { id: 'rebar-mansion', title: 'The Rebar Mansion', body: 'Three storeys in West End. Ching\'s family below. Bung and Ching in the middle. Bung\'s family on top.' },
  { id: 'tornado', title: 'The Tornado Machine', body: 'Gabor\'s critique of the mansion, installed on a South Bank lawn and switched off in person.' },
  { id: 'rebar-expo', title: 'The Rebar Expo', body: 'A self-heating kebab, a flash Ching would not retake, and a booth that stayed standing.' },
  { id: 'brisbane-snow', title: 'The Snow', body: 'A metre of it, briefly, from West End to the CBD. It melted when the piles did.' },
  { id: 'seb-daly', title: 'Seb Daly', body: 'Three standard rebars. Three addresses. The trolley was not a suggestion.' },
  { id: 'rebar-man', title: 'Rebar Man', body: 'Scraps in order, then a workshop behind the house, then the poses.' },
  { id: 'showdown', title: 'The Showdown', body: 'Scooter, over, and a last rap. Gabor parked all three.' },
  { id: 'bung-legend', title: 'The Legend', body: 'The floors, the Queen Street rings, and a suitcase that stays shut. The rest of the world is later.' },
  { id: 'rebar-rebar', title: 'Standard Rebar', body: 'The everyday miracle. Sells, builds, and gets sniffed.' },
  { id: 'rebar-reinforced', title: 'Reinforced Rebar', body: 'Thicker. Ruder. Worth more at the yard.' },
  { id: 'rebar-golden', title: 'Golden Rebar', body: 'Ceremonial. The trolley considers it family.' },
  { id: 'rebar-radio', title: 'Radioactive Rebar', body: 'Glows. Do not put it in the burger.' },
  { id: 'rebar-james', title: 'James Rebar', body: 'Workshop grade. Finding one is a small religion.' },
  { id: 'rebar-bent', title: 'Bent Rebar', body: 'Someone asked it to be straight. It declined.' },
  { id: 'rebar-forbidden', title: 'Forbidden Rebar', body: 'Gabor\'s catalogue. Purple, illegal, and extremely his.' },
  { id: 'rebar-obsidian', title: 'Obsidian Rebar', body: 'Sir Girderface\'s calling card. Offer it to the river if you enjoy consequences.' },
  { id: 'storybridge', title: 'Story Bridge', body: 'OSM ways 502370129 and 507264554. The deck sits on the real outline. Its height is the layer-tag convention, not a measured clearance above the river.' },
  { id: 'southbank', title: 'South Bank', body: 'South Bank Parklands, relation 532905. Lawns on the real polygon, and a wheel prop at the ticket-office footprint.' },
  { id: 'parliament', title: 'Parliament House', body: 'Way 8040447. Cream stone in the data, a fictional $10,000 plaque on the footpath outside.' },
  { id: 'flight', title: 'Rebar Pacific RP100', body: 'The Sydney–Hong Kong night flight. Bung\'s booking note says CX100. The board, sensibly, does not.' },
];

export function migrateState() {
  if (!state.stock || typeof state.stock !== 'object') state.stock = {};
  if (!Array.isArray(state.archive)) state.archive = ['bung', 'ching', 'gabor', 'james', 'conspiracy'];
  for (const id of ['bung', 'ching', 'gabor', 'james', 'conspiracy']) {
    if (!state.archive.includes(id)) state.archive.push(id);
  }
}

export function unlockArchive(id) {
  migrateState();
  if (!ARCHIVE.some((e) => e.id === id)) return;
  if (state.archive.includes(id)) return;
  state.archive.push(id);
  bus.emit('hud');
}

export function yardCount() {
  migrateState();
  return Object.values(state.stock).reduce((n, v) => n + (v || 0), 0);
}
