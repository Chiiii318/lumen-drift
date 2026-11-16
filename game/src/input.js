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

  // Touch controls (phones and tablets): the first finger is a floating joystick — drag
  // and the keeper drifts the way you drag; a second finger aims the lantern and lights
  // the beam for as long as it is held. A tap counts as a click for the menus.
  const touches = { move: null, beam: null };
  function onTouchStart(event) {
    event.preventDefault();
    input.pressed.add('enter'); // a tap starts and restarts, like a click
    for (const t of event.changedTouches) {
      const p = toField(t);
      if (touches.move === null) touches.move = { id: t.identifier, sx: p.x, sy: p.y, x: p.x, y: p.y };
      else if (touches.beam === null) {
        touches.beam = { id: t.identifier };
        input.aimX = p.x;
        input.aimY = p.y;
        input.beam = true;
      }
    }
  }
  function onTouchMove(event) {
    event.preventDefault();
    for (const t of event.changedTouches) {
      const p = toField(t);
      if (touches.move && t.identifier === touches.move.id) {
        touches.move.x = p.x;
        touches.move.y = p.y;
        const dx = p.x - touches.move.sx;
        const dy = p.y - touches.move.sy;
        const d = Math.hypot(dx, dy);
        if (d > 12) {
          input.moveX = dx / d;
          input.moveY = dy / d;
        } else {
          input.moveX = 0;
          input.moveY = 0;
        }
        input.aimX = p.x;
        input.aimY = p.y;
      }
      if (touches.beam && t.identifier === touches.beam.id) {
        input.aimX = p.x;
        input.aimY = p.y;
      }
    }
  }
  function onTouchEnd(event) {
    event.preventDefault();
    for (const t of event.changedTouches) {
      if (touches.move && t.identifier === touches.move.id) {
        touches.move = null;
        input.moveX = 0;
        input.moveY = 0;
      }
      if (touches.beam && t.identifier === touches.beam.id) {
        touches.beam = null;
        input.beam = false;
      }
    }
  }

  function attach() {
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd, { passive: false });
    canvas.addEventListener('touchcancel', onTouchEnd, { passive: false });
  }
  function detach() {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', onBlur);
    canvas.removeEventListener('mousemove', onMouseMove);
    canvas.removeEventListener('mousedown', onMouseDown);
    window.removeEventListener('mouseup', onMouseUp);
    canvas.removeEventListener('touchstart', onTouchStart);
    canvas.removeEventListener('touchmove', onTouchMove);
    canvas.removeEventListener('touchend', onTouchEnd);
    canvas.removeEventListener('touchcancel', onTouchEnd);
  }
  return input;
}
