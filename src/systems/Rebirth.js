// Ultimate Rebirth foundation: companion, weather, empire income, photo mode.
// These systems are real and small on purpose. They do not pretend to be a GIS city.
import * as THREE from 'three';
import { state, addCoins } from '../core/state.js';
import { buildChing } from '../entities/models.js';

export class Rebirth {
  constructor(game) {
    this.game = game;
    this.incomeT = 0;
    this.weatherT = 0;
    this.weather = 'sun';
    this.follower = null;
    this._target = new THREE.Vector3();
  }

  ensureFollower() {
    if (this.follower) return;
    this.follower = buildChing();
    this.follower.visible = false;
    this.game.scene.add(this.follower);
  }

  update(dt) {
    this.ensureFollower();
    const g = this.game;
    const withYou = !!state.flags.chingWithYou && g.mode === 'playing' && !g.photo;
    this.follower.visible = withYou;
    if (withYou) {
      const back = g.player.facing + Math.PI;
      this._target.set(
        g.player.pos.x + Math.sin(back) * 1.7,
        g.player.pos.y,
        g.player.pos.z + Math.cos(back) * 1.7,
      );
      this.follower.position.lerp(this._target, 1 - Math.exp(-4 * dt));
      this.follower.position.y = g.player.pos.y;
      this.follower.rotation.y = Math.atan2(
        g.player.pos.x - this.follower.position.x,
        g.player.pos.z - this.follower.position.z,
      );
      this.follower.position.y += Math.abs(Math.sin(g.elapsed * 8)) * 0.03;
    }

    if (state.flags.warehouse) {
      this.incomeT += dt;
      const pay = state.flags.hkdesk ? 28 : 12;
      if (this.incomeT > 30) {
        this.incomeT = 0;
        addCoins(pay);
        if (Math.random() < 0.35) g.toast(`REBAR EMPIRE PAID ${pay} BUNGBUCKS`, 'blue');
      }
    }

    this.weatherT += dt;
    const zone = state.currentZone;
    const outdoor = zone === 'brisbane' || zone === 'mansion';
    const phase = this.weatherT % 110;
    const next = !outdoor ? 'clear' : phase < 55 ? 'sun' : phase < 85 ? 'haze' : 'storm';
    if (next !== this.weather) {
      this.weather = next;
      if (next === 'storm') g.toast('BRISBANE STORM — THE SINGLET IS NOT WEATHERPROOF', 'blue');
      if (next === 'sun' && outdoor) g.toast('SUN\'S OUT. REBARS OUT.', 'blue');
    }
    const exposure = { sun: 1.12, haze: 0.96, storm: 0.78, clear: 1.02 }[this.weather] || 1.05;
    g.renderer.toneMappingExposure += (exposure - g.renderer.toneMappingExposure) * Math.min(1, dt * 0.8);
    const tint = document.getElementById('weather-tint');
    if (tint) {
      tint.className = outdoor ? this.weather : '';
    }
  }
}
