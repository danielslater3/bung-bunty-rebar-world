// Ultimate Rebirth foundation: companion, weather, empire income, photo mode.
// These systems are real and small on purpose. They do not pretend to be a GIS city.
import * as THREE from 'three';
import { state, addCoins } from '../core/state.js';
import { buildChung } from '../entities/models.js';

export class Rebirth {
  constructor(game) {
    this.game = game;
    this.incomeT = 0;
    this.follower = null;
    this._target = new THREE.Vector3();
  }

  ensureFollower() {
    if (this.follower) return;
    this.follower = buildChung();
    this.follower.visible = false;
    this.game.scene.add(this.follower);
  }

  update(dt) {
    this.ensureFollower();
    const g = this.game;
    const withYou = !!state.flags.chungWithYou && g.mode === 'playing' && !g.photo;
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
        if (Math.random() < 0.35) g.toast(`REBAR EMPIRE PAID ${pay} REBAR`, 'blue');
      }
    }

    // Brisbane's weather controller owns its lighting, tint and announcements.
    if (!g.weather.zone) {
      g.renderer.toneMappingExposure += (1.05 - g.renderer.toneMappingExposure) * Math.min(1, dt * .8);
      const tint = document.getElementById('weather-tint');
      if (tint) tint.className = '';
    }
  }
}
