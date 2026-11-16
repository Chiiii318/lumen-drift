// Keyboard and mouse state for the live game. The world reads a plain intent object each step:
// { moveX, moveY } in -1..1, an aim point in field coordinates, and whether the beam is held.
// Shot scenes bypass this and drive the world with their own intents.

export function createInput(canvas) {
  const keys = new Set();
  const input = {
    moveX: 0,
    moveY: 0,
    aimX: 480,
    aimY: 200,
    beam: false,
    pressed: new Set(), // one-shot keys, consumed by main each frame
    attach,
    detach,
  };

  function toField(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * 960,
      y: ((event.clientY - rect.top) / rect.height) * 540,
    };
  }

  function onKeyDown(event) {
    const key = event.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) event.preventDefault();
    if (!event.repeat) input.pressed.add(key);
    keys.add(key);
    refreshMove();
  }
  function onKeyUp(event) {
    keys.delete(event.key.toLowerCase());
    refreshMove();
  }
  function refreshMove() {
    const left = keys.has('a') || keys.has('arrowleft');
    const right = keys.has('d') || keys.has('arrowright');
    const up = keys.has('w') || keys.has('arrowup');
    const down = keys.has('s') || keys.has('arrowdown');
    input.moveX = (right ? 1 : 0) - (left ? 1 : 0);
    input.moveY = (down ? 1 : 0) - (up ? 1 : 0);
  }
  function onMouseMove(event) {
    const p = toField(event);
    input.aimX = p.x;
    input.aimY = p.y;
  }
  function onMouseDown(event) {
    if (event.button === 0) input.beam = true;
    onMouseMove(event);
  }
  function onMouseUp(event) {
    if (event.button === 0) input.beam = false;
  }
  function onBlur() {
    keys.clear();
    input.beam = false;
    refreshMove();
  }

  function attach() {
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
  }
  function detach() {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', onBlur);
    canvas.removeEventListener('mousemove', onMouseMove);
    canvas.removeEventListener('mousedown', onMouseDown);
    window.removeEventListener('mouseup', onMouseUp);
  }
  return input;
}
