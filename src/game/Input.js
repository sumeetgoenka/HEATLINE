export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set();
    this.mouse = { dx: 0, dy: 0 };
    this.pointerLocked = false;
    this.enabled = false;
    this.blockedKeys = new Set([
      'KeyW', 'KeyA', 'KeyS', 'KeyD',
      'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
      'Space', 'ShiftLeft', 'ShiftRight',
      'KeyF', 'KeyC', 'KeyR', 'KeyM', 'Backquote'
    ]);

    this.handleKeyDown = (event) => {
      if (!this.enabled) {
        return;
      }
      if (this.blockedKeys.has(event.code)) {
        event.preventDefault();
      }
      if (!this.keys.has(event.code)) {
        this.pressed.add(event.code);
      }
      this.keys.add(event.code);
    };

    this.handleKeyUp = (event) => {
      if (this.blockedKeys.has(event.code)) {
        event.preventDefault();
      }
      this.keys.delete(event.code);
    };

    this.handleMouseMove = (event) => {
      if (this.pointerLocked) {
        this.mouse.dx += event.movementX;
        this.mouse.dy += event.movementY;
      }
    };

    this.handlePointerChange = () => {
      this.pointerLocked = document.pointerLockElement === this.canvas;
    };

    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('mousemove', this.handleMouseMove);
    document.addEventListener('pointerlockchange', this.handlePointerChange);
  }

  enable() {
    this.enabled = true;
  }

  disable() {
    this.enabled = false;
    this.keys.clear();
    this.pressed.clear();
  }

  requestPointerLock() {
    try {
      this.canvas?.requestPointerLock();
    } catch (error) {
      return false;
    }
    return true;
  }

  isDown(code) {
    return this.keys.has(code);
  }

  wasPressed(code) {
    if (this.pressed.has(code)) {
      this.pressed.delete(code);
      return true;
    }
    return false;
  }

  consumeMouse() {
    const delta = { dx: this.mouse.dx, dy: this.mouse.dy };
    this.mouse.dx = 0;
    this.mouse.dy = 0;
    return delta;
  }

  dispose() {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('pointerlockchange', this.handlePointerChange);
  }
}
