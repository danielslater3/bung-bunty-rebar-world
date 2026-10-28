// BUNG BUNTY: REBAR WORLD — entry point.
import { Game } from '/src/core/Game.js';

const boot = document.getElementById('boot');
try {
  const game = new Game();
  window.BUNG = game; // handy for debugging in the console
  game.mode = 'menu';
  game.menus.showMain();
  boot?.remove();
  // Mansion is the menu backdrop. A New Game click can replace it mid-load.
  game.loadZone('mansion', true).then(() => {
    if (game.mode === 'menu') game.player.mesh.visible = true;
  });
} catch (err) {
  window.bungFail(err);
}
