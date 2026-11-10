// Model colours and handling data can be used by both the room picker and the
// renderer. The server accepts only these multiplayer editions.
export const ROOM_FLEET = [
  { id: 'james', name: 'Golden James', phone: 'james', metal: 0xffc94d, trim: 0xc0392b, flag: 0xff2e5f },
  { id: 'titanium', name: 'Titanium Original', phone: 'titanium', metal: 0x969ca9, trim: 0x262a32, flag: 0xe0ba98 },
  { id: 'blue', name: 'Blue Rebar', phone: 'rebar', metal: 0x1a5fa8, trim: 0x9ad9ff, flag: 0x2e97ef },
  { id: 'concrete', name: 'Gabor Concrete', phone: 'concrete', metal: 0x828481, trim: 0xdd6a2d, flag: 0x282e36 },
  { id: 'iron', name: 'Sir Girderface', phone: 'girder', metal: 0x4a515a, trim: 0xb85a32, flag: 0xff6a2a },
  { id: 'night', name: 'Hong Kong Night', phone: 'night', metal: 0x221428, trim: 0xff3d9a, flag: 0x2ee6ff },
  { id: 'emerald', name: 'Emerald Compass', phone: 'emerald', metal: 0x168357, trim: 0xf3ca69, flag: 0x8aefb7 },
  { id: 'bun', name: 'McRebar Queen Street', phone: 'mcrebar', metal: 0xd9232a, trim: 0xf7c853, flag: 0xffe4a5 },
  { id: 'transition', name: 'Operation Blue to Red', phone: 'transition', metal: 0x284b91, trim: 0xd53145, flag: 0xeee5df },
  { id: 'yard', name: 'Yard Prototype', phone: 'yard', metal: 0xd8d4c9, trim: 0x262b2d, flag: 0xd6f95d },
];

export const roomTrolley = id => ROOM_FLEET.find(t => t.id === id) || ROOM_FLEET[0];
