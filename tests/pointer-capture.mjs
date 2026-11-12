// Input-level capture contract. Native pointer lock is additionally exercised
// in Chromium; these stubs isolate CSS scaling and late/error browser events.
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { Input } from '../src/input.js';

function eventTarget() {
  const listeners = new Map();
  return {
    addEventListener(type, handler) {
      const entries = listeners.get(type) || [];
      entries.push(handler); listeners.set(type, entries);
    },
    fire(type, event = {}) {
      event.preventDefault ||= () => {};
      for (const handler of listeners.get(type) || []) handler(event);
    },
  };
}

export async function testPointerCapture() {
  const originalWindow = globalThis.window, originalDocument = globalThis.document;
  function fixture() {
    const win = eventTarget(), doc = eventTarget(), canvas = eventTarget();
    let requests = 0, exits = 0, lost = 0;
    canvas.width = 1280; canvas.height = 800;
    canvas.getBoundingClientRect = () => ({ left: 10, top: 20, width: 640, height: 400 });
    canvas.requestPointerLock = () => { requests++; };
    doc.pointerLockElement = null;
    doc.exitPointerLock = () => { exits++; doc.pointerLockElement = null; doc.fire('pointerlockchange'); };
    globalThis.window = win; globalThis.document = doc;
    const input = new Input(canvas);
    input.onCaptureLost = () => { lost++; };
    input.setView({ x: 1000, y: 500, scale: 2 });
    const click = (button = 0) => canvas.fire('mousedown', { button, clientX: 210, clientY: 120 });
    const lock = () => { doc.pointerLockElement = canvas; doc.fire('pointerlockchange'); };
    return { win, doc, canvas, input, click, lock,
      get requests() { return requests; }, get exits() { return exits; }, get lost() { return lost; } };
  }
  try {
    const f = fixture(), { input, canvas, doc, win } = f;
    f.click(); assert.equal(f.requests, 0, 'menu clicks do not capture the mouse');
    input.reset(); input.setCaptureMode(true); input.update(); input.endFrame();
    assert.equal(f.requests, 0, 'enabling gameplay alone never requests browser capture');
    f.click(); assert.equal(f.requests, 1, 'a gameplay paint gesture requests capture');
    assert.equal(input._capturePending, true);
    f.click(2); assert.equal(f.requests, 1, 'pending browser request cannot be duplicated');
    f.lock(); assert.equal(input.pointerLocked, true); assert.equal(input._capturePending, false);
    assert.equal(input.mouse.x, 400); assert.equal(input.mouse.y, 200);

    const movement = { clientX: 99999, clientY: -99999, movementX: 5, movementY: -3 };
    canvas.fire('mousemove', movement); // the bubbling canvas path must not double-count
    doc.fire('mousemove', movement);
    assert.equal(input.mouse.x, 410, 'relative movement scales from CSS to canvas pixels exactly once');
    assert.equal(input.mouse.y, 194, 'locked movement ignores fixed/irrelevant client coordinates');
    assert.equal(input.mouse.worldX, 1205); assert.equal(input.mouse.worldY, 597);
    doc.fire('mousemove', { movementX: 99999, movementY: -99999 });
    assert.equal(input.mouse.x, 1280); assert.equal(input.mouse.y, 0);
    doc.fire('mousemove', { movementX: -2, movementY: 2 });
    assert.equal(input.mouse.x, 1276); assert.equal(input.mouse.y, 4,
      'turning away from an edge responds immediately, without accumulated offscreen distance');
    const aimed = [input.mouse.x, input.mouse.y];
    f.click(); assert.deepEqual([input.mouse.x, input.mouse.y], aimed, 'locked clicks do not teleport aim');
    win.fire('mouseup', { button: 0 }); assert.equal(input.mouse.lDown, false);
    win.fire('mouseup', { button: 2 });
    assert.equal(input.mouse.rDown, false); assert.equal(input.mouse.rReleased, true);
    assert.equal(input.mouse._physR, false, 'released splash cannot remain held');

    win.fire('keydown', { key: 'w' }); f.click(); f.click(2);
    doc.pointerLockElement = null; doc.fire('pointerlockchange'); // browser Escape / focus loss
    assert.equal(f.lost, 1, 'unexpected browser release notifies the game to pause');
    assert.equal(input.pointerLocked, false);
    assert.equal(input.keys.size, 0); assert.equal(input._phys.size, 0); assert.equal(input.kb.size, 0);
    assert.equal(input.mouse.lDown, false); assert.equal(input.mouse.rDown, false);
    assert.equal(input.mouse.lPressed, false); assert.equal(input.mouse.rReleased, false,
      'capture loss clears held actions without firing a charged splash');

    f.click(); f.lock(); input.setCaptureMode(false);
    assert.equal(f.exits, 1); assert.equal(input.pointerLocked, false);
    assert.equal(f.lost, 1, 'opening a menu releases capture without an extra pause callback');
    f.click(); assert.equal(f.requests, 2, 'clicking menu UI cannot reacquire capture');

    const late = fixture(); late.input.setCaptureMode(true); late.click();
    late.input.setCaptureMode(false); late.lock();
    assert.equal(late.exits, 1, 'a late successful request is released if a menu opened meanwhile');
    assert.equal(late.input.pointerLocked, false); assert.equal(late.lost, 0);

    const denied = fixture();
    denied.canvas.requestPointerLock = () => Promise.reject(new Error('Capture denied'));
    denied.input.setCaptureMode(true); denied.click(); await Promise.resolve();
    assert.equal(denied.input._capturePending, false, 'promise rejection allows a later gesture retry');
    assert.equal(denied.input.pointerLocked, false);
    denied.canvas.fire('mousemove', { clientX: 310, clientY: 220 });
    assert.equal(denied.input.mouse.x, 600); assert.equal(denied.input.mouse.y, 400,
      'absolute mouse input remains usable when browser capture is denied');
    denied.canvas.requestPointerLock = () => { throw new Error('Unsupported request'); };
    denied.click(); assert.equal(denied.input._capturePending, false, 'synchronous browser errors are contained');
    denied.canvas.requestPointerLock = undefined; denied.click();
    assert.equal(denied.input._capturePending, false, 'unsupported browsers retain ordinary mouse input');
    return 'Pointer capture: gesture request, relative aim, reversible bounds, release/reset and failure fallback PASS';
  } finally {
    globalThis.window = originalWindow; globalThis.document = originalDocument;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  console.log(await testPointerCapture());
