// All menu screens: main menu, Bung Control Centre (pause), Rebar Exchange
// (shop), Deployment Board (map select), Trolley Calibration (settings),
// Portal Rush results, game over, and victory.
import { state, bus, SaveSystem } from '../core/state.js';
import { UPGRADES, SHOP_CATEGORIES } from '../systems/ShopSystem.js';
import { ZONE_INFO } from '../world/zones.js';

export class Menus {
  constructor(game) {
    this.game = game;
    this.root = document.getElementById('menus');
    this.current = null;
    this.shopCat = 'BUNG';
  }

  _screen(html, transparent = false) {
    this.close();
    const div = document.createElement('div');
    div.className = `menu-screen${transparent ? ' transparent' : ''}`;
    div.innerHTML = html;
    // Hover sounds on every interactive element (delegated, one listener)
    div.addEventListener('mouseover', (e) => {
      if (e.target.closest('.mbtn:not(.disabled), .buy-btn, .deploy-card, .shop-cat')) {
        this.game.audio.sfx('hover');
      }
    });
    this.root.appendChild(div);
    this.current = div;
    return div;
  }

  close() {
    if (this.current) { this.current.remove(); this.current = null; }
  }

  get isOpen() { return !!this.current; }

  // ============ MAIN MENU ============
  showMain() {
    const hasSave = SaveSystem.hasSave();
    const s = this._screen(`
      <div class="game-title">
        <div class="t-small">OPERATION REBAR: BLUE TO RED</div>
        <div class="t-big">BUNG BUNTY</div>
        <div class="t-sub">REBAR WORLD</div>
        <div class="t-tag">A 3D COMEDY ACTION-PLATFORMER · TROLLEY-CERTIFIED · 100% BUNG-APPROVED</div>
      </div>
      <div class="menu-btns">
        <button class="mbtn gold" id="btn-new">NEW GAME</button>
        <button class="mbtn ${hasSave ? '' : 'disabled'}" id="btn-continue" ${hasSave ? '' : 'disabled'}>CONTINUE</button>
        <button class="mbtn" id="btn-settings">TROLLEY CALIBRATION</button>
        <button class="mbtn" id="btn-controls">CONTROLS</button>
      </div>
      <div class="hint-line" id="tip-line">CLICK A BUTTON TO START — AUDIO POWERED BY PURE REBAR ENERGY</div>
      <div class="version-tag">v2.0 — DOUBLE REBAR REVAMP · BUNG INDUSTRIES PTY LTD</div>
    `);
    s.querySelector('#btn-new').onclick = () => this.game.startGame(true);
    if (hasSave) s.querySelector('#btn-continue').onclick = () => this.game.startGame(false);
    s.querySelector('#btn-settings').onclick = () => this.showSettings(() => this.showMain());
    s.querySelector('#btn-controls').onclick = () => this.showControls(() => this.showMain());

    // Rotating loading tips, certified Bung-approved
    const tips = [
      'TIP: DO NOT QUESTION THE TROLLEY.',
      'TIP: REAL WEALTH IS MEASURED IN REBARS.',
      'TIP: GOLDEN TROLLEY MODE IS NOT LEGALLY RECOGNISED AVIATION.',
      'TIP: REBAR CHAIN UNSTABLE. KEEP SENDING IT.',
      'TIP: OPERATION REBAR REQUIRES UNNECESSARY CONFIDENCE.',
      'TIP: NEARBY REBARS RESPECT BUNG\'S AUTHORITY.',
      'TIP: PHYSICS HAS ENTERED NEGOTIATIONS.',
      'TIP: A CRASH IS JUST TACTICAL PARKING AT SPEED.',
      'WARNING: GABOR SCOOTER ACTIVITY DETECTED.',
      'TIP: HOLD SHIFT ON THE TROLLEY TO CONVERT FUEL INTO PROBLEMS.',
    ];
    let ti = Math.floor(Math.random() * tips.length);
    clearInterval(this._tipTimer);
    this._tipTimer = setInterval(() => {
      const el = s.querySelector('#tip-line');
      if (!el) { clearInterval(this._tipTimer); return; }
      ti = (ti + 1) % tips.length;
      el.textContent = tips[ti];
    }, 4200);
  }

  // ============ PAUSE — BUNG CONTROL CENTRE ============
  showPause() {
    const s = this._screen(`
      <div class="panel" style="max-width:460px;text-align:center;">
        <h2>BUNG CONTROL CENTRE</h2>
        <div class="panel-sub">OPERATION PAUSED. THE REBAR WAITS FOR NO ONE (EXCEPT NOW).</div>
        <div class="menu-btns" style="width:100%;">
          <button class="mbtn gold" id="btn-resume">RESUME OPERATION</button>
          <button class="mbtn" id="btn-shop">REBAR EXCHANGE</button>
          <button class="mbtn" id="btn-deploy">DEPLOYMENT BOARD</button>
          <button class="mbtn" id="btn-settings">TROLLEY CALIBRATION</button>
          <button class="mbtn" id="btn-controls">CONTROLS</button>
          <button class="mbtn" id="btn-save">SAVE PROGRESS</button>
          <button class="mbtn danger" id="btn-quit">QUIT TO MAIN MENU</button>
        </div>
      </div>
    `, true);
    s.querySelector('#btn-resume').onclick = () => this.game.resume();
    s.querySelector('#btn-shop').onclick = () => this.openShop(true);
    s.querySelector('#btn-deploy').onclick = () => this.openDeploy(true);
    s.querySelector('#btn-settings').onclick = () => this.showSettings(() => this.showPause());
    s.querySelector('#btn-controls').onclick = () => this.showControls(() => this.showPause());
    s.querySelector('#btn-save').onclick = () => { SaveSystem.save(); this.game.toast('PROGRESS SAVED', 'blue'); };
    s.querySelector('#btn-quit').onclick = () => { SaveSystem.save(); location.reload(); };
  }

  // ============ REBAR EXCHANGE (SHOP) ============
  openShop(fromPause = false) {
    this.game.pauseForMenu();
    const shop = this.game.shop;
    const render = () => {
      const items = UPGRADES.filter((u) => u.cat === this.shopCat);
      const s = this._screen(`
        <div class="panel">
          <h2>REBAR EXCHANGE</h2>
          <div class="panel-sub">"REAL WEALTH IS MEASURED IN REBARS." — B. BUNTY · SCORE SELLS AT 10:1</div>
          <div class="shop-wallet">REBAR COINS: ${state.coins.toLocaleString()} &nbsp;·&nbsp; BUNG SCORE: ${state.score.toLocaleString()}</div>
          <div class="shop-cats">
            ${SHOP_CATEGORIES.map((c) => `<div class="shop-cat${c === this.shopCat ? ' active' : ''}" data-cat="${c}">${c}</div>`).join('')}
            <div class="shop-cat" id="sell-score" style="border-color:rgba(255,201,64,.6);color:var(--gold);">SELL SCORE</div>
          </div>
          <div class="shop-grid">
            ${items.map((u) => {
              const lvl = state.upgrades[u.id] || 0;
              const cost = shop.costOf(u);
              const maxed = !u.consumable && (lvl >= (u.max || 1) || (u.mapUnlock && state.unlockedZones.includes(u.mapUnlock)));
              const afford = state.coins >= cost;
              return `<div class="shop-item">
                <div>
                  <div class="si-name">${u.name}</div>
                  <div class="si-desc">${u.desc}</div>
                  ${!u.consumable && u.max > 1 ? `<div class="si-lvl">LEVEL ${lvl}/${u.max}</div>` : ''}
                </div>
                <button class="buy-btn" data-id="${u.id}" ${maxed || !afford ? 'disabled' : ''}>
                  ${maxed ? 'OWNED' : `${cost} ¢`}
                </button>
              </div>`;
            }).join('')}
          </div>
          <div class="menu-btns" style="margin-top:18px;width:100%;">
            <button class="mbtn" id="btn-close">${fromPause ? 'BACK' : 'CLOSE'}</button>
          </div>
        </div>
      `, true);
      s.querySelectorAll('.shop-cat[data-cat]').forEach((el) => {
        el.onclick = () => { this.shopCat = el.dataset.cat; render(); };
      });
      s.querySelector('#sell-score').onclick = () => { shop.sellScore(); render(); };
      s.querySelectorAll('.buy-btn').forEach((el) => {
        el.onclick = () => { shop.buy(el.dataset.id); render(); };
      });
      s.querySelector('#btn-close').onclick = () => fromPause ? this.showPause() : this.game.resume();
    };
    render();
  }

  // ============ DEPLOYMENT BOARD (MAP SELECT) ============
  openDeploy(fromPause = false) {
    this.game.pauseForMenu();
    const zones = ['mansion', 'brisbane', 'sydney', 'hongkong', 'shenzhen', 'void'];
    const s = this._screen(`
      <div class="panel">
        <h2>DEPLOYMENT BOARD</h2>
        <div class="panel-sub">OPERATION REBAR: BLUE TO RED — SELECT DEPLOYMENT ZONE</div>
        <div class="deploy-grid">
          ${zones.map((z) => {
            const info = ZONE_INFO[z];
            const unlocked = state.unlockedZones.includes(z);
            const current = state.currentZone === z;
            const red = info.mode === 'RED MODE';
            return `<div class="deploy-card${unlocked ? '' : ' locked'}${red ? ' red-mode' : ''}${current ? ' current' : ''}" data-zone="${z}"
              style="background:linear-gradient(150deg, ${red ? 'rgba(70,10,25,.6)' : 'rgba(10,35,60,.6)'}, rgba(5,8,14,.9));">
              <div class="dc-mode" style="color:${red ? 'var(--neon-red)' : 'var(--neon-blue)'}">${info.mode}</div>
              <div class="dc-name">${info.name}</div>
              <div class="dc-desc">${info.desc}</div>
              ${unlocked ? (current ? '<div class="dc-lock" style="color:var(--gold)">CURRENT ZONE</div>' : '') : '<div class="dc-lock">LOCKED — progress Operation Rebar or buy access at the Exchange</div>'}
            </div>`;
          }).join('')}
        </div>
        <div class="menu-btns" style="margin-top:18px;width:100%;">
          <button class="mbtn" id="btn-close">${fromPause ? 'BACK' : 'CLOSE'}</button>
        </div>
      </div>
    `, true);
    s.querySelectorAll('.deploy-card').forEach((el) => {
      el.onclick = () => {
        const z = el.dataset.zone;
        if (!state.unlockedZones.includes(z)) { this.game.audio.sfx('denied'); return; }
        if (z === state.currentZone) { this.game.resume(); return; }
        this.game.resume();
        this.game.loadZone(z);
      };
    });
    s.querySelector('#btn-close').onclick = () => fromPause ? this.showPause() : this.game.resume();
  }

  // ============ SETTINGS — TROLLEY CALIBRATION ============
  showSettings(back) {
    const s = this._screen(`
      <div class="panel" style="max-width:520px;">
        <h2>TROLLEY CALIBRATION</h2>
        <div class="panel-sub">FINE-TUNE THE BUNG EXPERIENCE</div>
        <div class="settings-row"><label>MUSIC VOLUME</label><input type="range" id="set-music" min="0" max="1" step="0.05" value="${state.settings.music}"></div>
        <div class="settings-row"><label>SFX VOLUME</label><input type="range" id="set-sfx" min="0" max="1" step="0.05" value="${state.settings.sfx}"></div>
        <div class="settings-row"><label>MOUSE SENSITIVITY</label><input type="range" id="set-sens" min="0.3" max="2.5" step="0.1" value="${state.settings.sensitivity}"></div>
        <div class="menu-btns" style="margin-top:18px;width:100%;">
          <button class="mbtn gold" id="btn-back">BACK</button>
        </div>
      </div>
    `, true);
    s.querySelector('#set-music').oninput = (e) => { state.settings.music = +e.target.value; this.game.audio.applyVolumes(); };
    s.querySelector('#set-sfx').oninput = (e) => { state.settings.sfx = +e.target.value; this.game.audio.applyVolumes(); };
    s.querySelector('#set-sens').oninput = (e) => { state.settings.sensitivity = +e.target.value; };
    s.querySelector('#btn-back').onclick = back;
  }

  // ============ CONTROLS ============
  showControls(back) {
    const s = this._screen(`
      <div class="panel" style="max-width:640px;">
        <h2>CONTROLS</h2>
        <div class="panel-sub">CERTIFIED BUNG-COMPATIBLE INPUT SCHEME</div>
        <div class="controls-list">
          <div><b>WASD</b> Move / steer trolley</div>
          <div><b>MOUSE</b> Camera (click game to lock)</div>
          <div><b>SPACE</b> Jump / trolley drift</div>
          <div><b>SHIFT</b> Sprint / trolley boost</div>
          <div><b>E</b> Interact / mount / dismount</div>
          <div><b>T</b> Summon / dismiss trolley</div>
          <div><b>Q</b> Rebar Chain Grapple</div>
          <div><b>F</b> Belly Bounce attack</div>
          <div><b>G</b> Rebar Pulse (25 energy)</div>
          <div><b>ESC</b> Bung Control Centre</div>
        </div>
        <div class="menu-btns" style="margin-top:18px;width:100%;">
          <button class="mbtn gold" id="btn-back">BACK</button>
        </div>
      </div>
    `, true);
    s.querySelector('#btn-back').onclick = back;
  }

  // ============ RESULTS (Portal Rush) ============
  showResults(scoreGained, portals) {
    this.game.pauseForMenu();
    const s = this._screen(`
      <div class="results-big">PORTAL RUSH COMPLETE</div>
      <div class="results-rows">
        <div class="rr"><span>SCORE EARNED</span><span>${scoreGained.toLocaleString()}</span></div>
        <div class="rr"><span>PORTALS CLEARED</span><span>${portals}</span></div>
        <div class="rr"><span>BEST REBAR CHAIN</span><span>x${Math.min(10, state.bestCombo)}</span></div>
        <div class="rr"><span>BUNG VERDICT</span><span>${scoreGained > 5000 ? 'ABSOLUTELY BUNG-APPROVED' : scoreGained > 2000 ? 'DECENT, MATE' : 'THE TROLLEY IS DISAPPOINTED'}</span></div>
      </div>
      <div class="menu-btns">
        <button class="mbtn gold" id="btn-ok">CARRY ON</button>
      </div>
    `, true);
    s.querySelector('#btn-ok').onclick = () => this.game.resume();
  }

  // ============ GAME OVER ============
  showGameOver() {
    const s = this._screen(`
      <div class="gameover-title">BUNG DESTABILISED</div>
      <div class="gameover-sub">"This is not a defeat. This is a tactical nap." — Bung Bunty</div>
      <div class="menu-btns">
        <button class="mbtn gold" id="btn-respawn">RESPAWN (KEEP EVERYTHING)</button>
        <button class="mbtn danger" id="btn-menu">QUIT TO MENU</button>
      </div>
    `);
    s.querySelector('#btn-respawn').onclick = () => this.game.respawn();
    s.querySelector('#btn-menu').onclick = () => location.reload();
  }

  // ============ VICTORY ============
  showVictory() {
    this.game.pauseForMenu();
    const s = this._screen(`
      <div class="game-title">
        <div class="t-small">OPERATION REBAR: BLUE TO RED</div>
        <div class="t-big">REBAR WORLD</div>
        <div class="t-sub">SAVED. ACCIDENTALLY. AS USUAL.</div>
        <div class="t-tag">THE MEGA FOREHEAD REBAR MACHINE HAS BEEN SHUT DOWN.<br><br>
        GABOR FLED ON A SLIGHTLY DAMAGED SCOOTER, YELLING ABOUT STRATEGY.<br>
        CHING HAS ALREADY FILED THE PAPERWORK. BUNG IS EATING A REBAR DELUXE ON THE ROOF.<br><br>
        FREE ROAM CONTINUES — PORTALS, UPGRADES, AND THE REBAR VOID AWAIT.</div>
      </div>
      <div class="menu-btns">
        <button class="mbtn gold" id="btn-continue">KEEP PLAYING (FREE ROAM)</button>
      </div>
    `);
    s.querySelector('#btn-continue').onclick = () => this.game.resume();
  }
}
