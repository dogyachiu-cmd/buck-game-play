import { joystickVector } from './state.js';

// Keep pointer ownership separate from the game so interruption and multi-finger
// behavior can be regression-tested without changing a player's saved progress.
export function bindGameControls({ joystick, stick, action, isActive, onMove,
  onAction, onGesture = () => {}, onReset = () => {},
  windowTarget = window, documentTarget = document }) {
  let pointer = null;
  function reset() {
    const previous = pointer;
    pointer = null;
    onMove({ x: 0, y: 0 });
    stick.style.translate = '0px 0px';
    if (previous !== null && joystick.hasPointerCapture(previous)) {
      joystick.releasePointerCapture(previous);
    }
    onReset();
  }
  function move(event) {
    const bounds = joystick.getBoundingClientRect();
    const radius = Math.max(1, (bounds.width - stick.offsetWidth) / 2 - 2);
    const vector = joystickVector(event.clientX - bounds.left - bounds.width / 2,
      event.clientY - bounds.top - bounds.height / 2, radius);
    onMove(vector);
    stick.style.translate = `${vector.knobX}px ${vector.knobY}px`;
  }
  const primaryButton = event => event.button === undefined || event.button === 0;
  joystick.addEventListener('pointerdown', event => {
    if (pointer !== null || !isActive() || !primaryButton(event)) return;
    event.preventDefault();
    pointer = event.pointerId;
    joystick.setPointerCapture(pointer);
    onGesture();
    move(event);
  });
  joystick.addEventListener('pointermove', event => {
    if (pointer !== event.pointerId) return;
    if (!isActive()) { reset(); return; }
    event.preventDefault();
    move(event);
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    joystick.addEventListener(type, event => { if (pointer === event.pointerId) reset(); });
  }
  action.addEventListener('pointerdown', event => {
    if (!isActive() || !primaryButton(event)) return;
    event.preventDefault();
    onGesture();
    onAction();
  });
  // A held touch also produces a click on release, even after the cooldown.
  // Only non-pointer clicks (keyboard / assistive activation) act here.
  action.addEventListener('click', event => {
    if (event.detail !== 0 || !isActive()) return;
    onGesture();
    onAction();
  });
  windowTarget.addEventListener('blur', reset);
  documentTarget.addEventListener('visibilitychange', reset);
  return { reset };
}
