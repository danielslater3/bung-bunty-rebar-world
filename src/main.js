// BUNG BUNTY: REBAR WORLD — entry point.
import { Game } from './core/Game.js';

const game = new Game();
window.BUNG = game; // handy for debugging in the console

// Build the mansion behind the main menu for a living backdrop.
game.loadZone('mansion', true);
game.player.mesh.visible = true;
game.mode = 'menu';
game.menus.showMain();
