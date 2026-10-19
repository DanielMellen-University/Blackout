// External pilot adapter. Desired controls enter through keyboard events or a
// standard Gamepad API fixture, then the production InputManager samples them.
const mapped = { held: new Set(), duty: {}, events: [], gearAt: -Infinity, trimAt: -Infinity, trimRequested: false, gearRequested: false }
const mappedKey = (code, down) => {
 if (mapped.held.has(code) === down) return
 if (down) mapped.held.add(code); else mapped.held.delete(code)
 window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, bubbles: true }))
 mapped.events.push({ seconds: training.seconds, code, down })
}
const mappedAxis = (name, value, positive, negative) => {
 const magnitude = Math.abs(value)
 mapped.duty[name] = (mapped.duty[name] || 0) + magnitude
 const pulse = mapped.duty[name] >= 1
 if (pulse) mapped.duty[name] -= 1
 mappedKey(positive, pulse && value > 0); mappedKey(negative, pulse && value < 0)
}
function driveMapped(c, dt) {
 const gamepad = window.__mappedDevice === 'gamepad'
 if (!mapped.trimRequested) { mapped.trimAt = training.seconds; mapped.trimRequested = true }
 if (training.stage === 'approach' && !aircraft.controls.gearDown && !mapped.gearRequested) {
  mapped.gearAt = training.seconds; mapped.gearRequested = true
 }
 if (gamepad) {
  const axis = v => Math.abs(v) < 0.001 ? 0 : Math.sign(v) * (0.14 + Math.abs(v) * 0.86)
  window.__virtualPad.axes = [axis(c.roll), -axis(c.pitch), axis(c.yaw), 0]
  const throttleError = c.throttle - aircraft.controls.throttle
  const buttons = window.__virtualPad.buttons
  for (const button of buttons) { button.value = 0; button.pressed = false }
  const set = (i, v) => { buttons[i].value = v; buttons[i].pressed = v > 0.5 }
  set(7, throttleError > .004 ? 1 : 0); set(6, throttleError < -.004 ? 1 : 0)
  set(4, c.airbrake ? 1 : 0)
  set(1, training.seconds - mapped.trimAt < .2 ? 1 : 0)
  set(2, training.seconds - mapped.gearAt < .2 ? 1 : 0)
  window.__virtualPad.timestamp = performance.now()
 } else {
  mappedAxis('pitch', c.pitch, 'KeyW', 'KeyS')
  mappedAxis('roll', c.roll, 'KeyQ', 'KeyE')
  mappedAxis('yaw', c.yaw, 'KeyD', 'KeyA')
  mappedKey('ShiftLeft', c.throttle - aircraft.controls.throttle > .004)
  mappedKey('ControlLeft', c.throttle - aircraft.controls.throttle < -.004)
  mappedKey('KeyB', c.airbrake)
  mappedKey('KeyV', training.seconds - mapped.trimAt < .1)
  mappedKey('KeyG', training.seconds - mapped.gearAt < .1)
 }
}
window.__mappedState = () => ({ device: window.__mappedDevice, inputSource: input.inputSource, eventCount: mapped.events.length, events: mapped.events.slice(-24), pad: window.__virtualPad, result: challenge.result, report: document.querySelector('#run-results').innerText, storage: { ...localStorage } })

window.__mappedEvents = () => mapped.events
