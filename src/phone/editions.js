export const EDITIONS = [
  ['titanium', '01', 'Titanium Original', '#e0ba98', '#262a32'],
  ['rebar', '02', 'Blue Rebar', '#78baff', '#123876'],
  ['concrete', '05', 'Gabor Concrete', '#ffad76', '#463b35'],
  ['girder', '04', 'Sir Girderface', '#ffd27e', '#4e3823'],
  ['james', '07', 'James Rebar', '#ffacb6', '#701f3a'],
  ['night', '06', 'Chung · Hong Kong Night', '#f4a0ff', '#441e66'],
  ['emerald', '03', 'Emerald Compass', '#8aefb7', '#124e42'],
  ['mcrebar', '10', 'McRebar · Queen Street', '#ffce52', '#862e24'],
  ['transition', '08', 'Operation Blue to Red', '#9bcaff', '#50233a'],
  ['yard', '09', 'Yard Prototype', '#d6f95d', '#414638'],
].map(([id, number, name, accent, color]) => ({ id, number, name, accent, color }));

export const editionFor = id => EDITIONS.find(e => e.id === id) || EDITIONS[0];
export const editionImage = edition => new URL('../../assets/s24/' + edition.id + '.jpg', import.meta.url).href;
