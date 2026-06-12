// Keyboard + mouse input with pointer lock for the third-person camera.
export class Input {
  constructor(canvas) {
    this.keys = {};
    this.pressed = {};       // cleared each frame — single-press detection
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.locked = false;
    this.enabled = false;    // only capture gameplay input while playing
    this.canvas = canvas;

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys[e.code] = true;
      this.pressed[e.code] = true;
      if (this.enabled && ['Space', 'Tab', 'KeyE', 'KeyQ', 'KeyF', 'KeyG', 'KeyT'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    window.addEventListener('blur', () => { this.keys = {}; });

    document.addEventListener('mousemove', (e) => {
      if (this.locked && this.enabled) {
        this.mouseDX += e.movementX;
        this.mouseDY += e.movementY;
      }
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.canvas;
    });
    canvas.addEventListener('click', () => {
      if (this.enabled && !this.locked) this.lock();
    });
  }

  lock() {
    if (!this.enabled) return;
    try {
      const p = this.canvas.requestPointerLock?.();
      if (p && p.catch) p.catch(() => {});
    } catch { /* pointer lock unavailable (e.g. headless) — camera still works via drag */ }
  }
  unlock() { if (this.locked) document.exitPointerLock?.(); }

  axis() {
    // Returns {x: strafe, y: forward}
    let x = 0, y = 0;
    if (this.keys['KeyW'] || this.keys['ArrowUp']) y += 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) y -= 1;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) x -= 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) x += 1;
    return { x, y };
  }

  consumeMouse() {
    const dx = this.mouseDX, dy = this.mouseDY;
    this.mouseDX = 0; this.mouseDY = 0;
    return { dx, dy };
  }

  endFrame() { this.pressed = {}; }
}
