// A paper field atlas. No simulation, persistence, assets or network access.
import { fieldAtlasSnapshot, PIGMENTS, PIGMENT_ORDER, STUDIO } from './logic.js';
import { INK, uiFont, centerText, paperPanel, paperEnd, uiButton } from './ui.js';
import { journeyLandmarks } from './journey-ui.js';

export const atlasButton = () => ({ x: 224, y: 18, w: 184, h: 34 });
export function atlasLayout(g) {
  const x = (g.cw - 1152) / 2, y = (g.ch - 696) / 2;
  return { x, y, w: 1152, h: 696, close: { x: x + 916, y: y + 24, w: 208, h: 40 },
    map: { x: x + 48, y: y + 130, w: 1056, h: 252 } };
}

export function atlasForGame(g) {
  const snapshot = fieldAtlasSnapshot({ biome: g.runBiome, width: g.world.w, height: g.world.h,
    player: g.player, studies: g.studio?.studies, remembered: g.save.studio?.completed, rests: g.world.restSpots,
    checkpoints: g._atlasCheckpoints, crossingState: g.world.crossingState,
    mothFlower: g.world.mothFlower, challenge: !!g.challenge, wander: !!g.options.wander });
  return { ...snapshot, journey: journeyLandmarks(g) };
}

export function drawFieldAtlas(g, ctx) {
  const a = atlasForGame(g), b = atlasLayout(g), m = b.map;
  ctx.save(); ctx.fillStyle = 'rgba(20,35,30,.78)'; ctx.fillRect(0, 0, g.cw, g.ch);
  const c = paperPanel(ctx, b.x, b.y, b.w, b.h, { seed: 718 });
  const text = (s, x, y, size = 18, color = INK, bold = false) => {
    c.fillStyle = color; c.font = uiFont(size, { weight: bold ? 700 : 400 }); c.textAlign = 'left'; c.textBaseline = 'alphabetic'; c.fillText(s, x, y);
  };
  text('FIELD ATLAS', b.x + 40, b.y + 48, 30, '#304b45', true);
  text(a.title + '  ·  ' + a.mode, b.x + 42, b.y + 80, 18);
  text('Our swamp. Our colors to bring home. The journey is paused.', b.x + 42, b.y + 108, 16, '#59665b');
  const r = b.close;
  uiButton(c, r.x, r.y, r.w, r.h, 'Return  [V / Esc]', g._mouseIn(r.x, r.y, r.w, r.h), false, { seed: 719, size: 18 });

  c.fillStyle = '#dce5d2'; c.fillRect(m.x, m.y, m.w, m.h);
  // Gentle topographic contours use fixed curves, not per-frame randomness.
  for (let j = 0; j < 5; j++) {
    c.beginPath(); c.moveTo(m.x, m.y + 24 + j * 48);
    c.bezierCurveTo(m.x + 260, m.y - 35 + j * 55, m.x + 650, m.y + 95 + j * 28, m.x + m.w, m.y + 25 + j * 48);
    c.strokeStyle = j % 2 ? '#b7cbb7' : '#c2d4c2'; c.lineWidth = 16; c.stroke();
  }
  const pos = p => ({ x: m.x + 20 + p.x / a.width * (m.w - 40), y: m.y + 20 + p.y / a.height * (m.h - 40) });
  c.strokeStyle = '#758c78'; c.lineWidth = 1.5; c.strokeRect(m.x, m.y, m.w, m.h);
  text('N ↑', m.x + 12, m.y + 22, 16, '#405a4d', true);
  text('E →', m.x + m.w - 48, m.y + m.h - 12, 16, '#405a4d', true);
  if (a.journey) {
    const guardian = a.journey.guardian, edge = pos(guardian), end = pos({ x: a.width, y: 750 });
    c.fillStyle = 'rgba(120,96,139,.12)'; c.fillRect(edge.x, m.y + 30, end.x - edge.x, m.h - 60);
    const x = (edge.x + end.x) / 2, y = m.y + m.h / 2;
    c.fillStyle = guardian.defeated ? '#497e61' : '#77618b';
    c.beginPath(); c.moveTo(x, y - 12); c.lineTo(x + 12, y); c.lineTo(x, y + 12); c.lineTo(x - 12, y); c.closePath(); c.fill();
    centerText(c, guardian.defeated ? '✓' : guardian.final ? '4' : '!', x, y + 1, uiFont(14, { weight: 700 }), '#fff7e5');
    centerText(c, guardian.name, x, m.y + 28, uiFont(12, { weight: 700 }), '#564565');
    centerText(c, guardian.final ? 'The color thief' : 'Guardian of the path', x, m.y + 46, uiFont(11), '#564565');
    const clearing = a.journey.clearing;
    if (clearing) {
      const q = pos(clearing); c.fillStyle = clearing.complete ? '#497e61' : '#477c96';
      c.beginPath(); c.moveTo(q.x - 8, q.y + 5); c.quadraticCurveTo(q.x - 8, q.y - 10, q.x, q.y - 10);
      c.quadraticCurveTo(q.x + 8, q.y - 10, q.x + 8, q.y + 5); c.closePath(); c.fill();
      c.beginPath(); c.arc(q.x, q.y + 8, 2, 0, Math.PI * 2); c.fill();
      centerText(c, clearing.complete ? 'Clearing restored' : 'Lily Clearing', q.x, q.y + 31, uiFont(13), '#365a4c');
    }
  }
  for (const p of a.rests) {
    const q = pos(p); c.fillStyle = '#f2d28b'; c.strokeStyle = '#83602e';
    c.beginPath(); c.arc(q.x, q.y, 5, 0, Math.PI * 2); c.fill(); c.stroke();
  }
  for (const p of a.checkpoints) {
    const q = pos(p); c.fillStyle = '#398363'; c.fillRect(q.x - 5, q.y - 5, 10, 10);
  }
  if (a.crossing) {
    const q = pos(a.crossing); c.fillStyle = '#795a3d'; c.fillRect(q.x - 10, q.y - 4, 20, 8);
    centerText(c, 'Painted crossing', q.x, q.y - 15, uiFont(15), '#4a4235');
  }
  if (a.moth) {
    const q = pos(a.moth); c.fillStyle = a.moth.resting ? '#5b8a69' : '#b07832';
    c.beginPath(); c.ellipse(q.x - 4, q.y, 7, 4, -.5, 0, Math.PI * 2); c.ellipse(q.x + 4, q.y, 7, 4, .5, 0, Math.PI * 2); c.fill();
    centerText(c, a.moth.resting ? 'A moth at rest' : 'Lantern moth nook', q.x, q.y - 15, uiFont(15), '#4a4235');
  }
  a.studies.forEach((s, i) => {
    const p = pos(s); c.fillStyle = s.complete ? '#497e61' : '#fff6df'; c.strokeStyle = '#365b49'; c.lineWidth = 2;
    c.beginPath(); c.arc(p.x, p.y, 13, 0, Math.PI * 2); c.fill(); c.stroke();
    centerText(c, s.complete ? '✓' : String(i + 1), p.x, p.y + 1, uiFont(18, { weight: 700 }), s.complete ? '#fff9e6' : INK);
  });
  const frog = pos(a.frog);
  // The frog marker sits above its study number rather than covering it.
  c.strokeStyle = '#234b45'; c.lineWidth = 2; c.beginPath(); c.moveTo(frog.x, frog.y); c.lineTo(frog.x, frog.y - 23); c.stroke();
  c.fillStyle = '#f9eed4'; c.beginPath(); c.arc(frog.x, frog.y - 29, 12, 0, Math.PI * 2); c.fill(); c.stroke();
  c.fillStyle = '#365b49'; c.beginPath(); c.arc(frog.x - 4, frog.y - 30, 2, 0, Math.PI * 2); c.arc(frog.x + 4, frog.y - 30, 2, 0, Math.PI * 2); c.fill();
  centerText(c, 'YOU', frog.x, frog.y - 47, uiFont(13, { weight: 700 }), '#234b45');

  text('○ Study / ✓ complete     ▪ Zone rest paint     ● Lantern rest     ◆ Guardian', b.x + 48, b.y + 410, 17, '#435b4c');
  const cardsY = b.y + 448;
  if (a.studies.length) {
    const cardW = (1056 - 24 * (a.studies.length - 1)) / a.studies.length;
    a.studies.forEach((s, i) => {
      const x = b.x + 48 + i * (cardW + 24);
      c.fillStyle = '#e9dfca'; c.fillRect(x, cardsY, cardW, 118);
      text(`${i + 1}  ${s.name}`, x + 14, cardsY + 27, 20, '#304b45', true);
      text(s.complete ? 'Complete this expedition' : `Stage ${s.step + 1} of 3 · ${s.coats}/${STUDIO.coats} coats`, x + 14, cardsY + 54, 17);
      if (!s.complete) {
        const label = `${PIGMENT_ORDER.indexOf(s.color) + 1} · ${s.color.toUpperCase()} · ${s.verb}`;
        text(label, x + 14, cardsY + 83, 16, '#304b45');
        for (let n = 0; n < 3; n++) {
          c.fillStyle = n < s.step ? '#497e61' : n === s.step ? PIGMENTS[s.color].color : '#c6bca8';
          c.fillRect(x + 14 + n * ((cardW - 40) / 3), cardsY + 98, (cardW - 52) / 3, 5);
        }
      } else text('A page to keep in your sketchbook.', x + 14, cardsY + 83, 16, '#496850');
      if (s.remembered) text('Remembered in your saved collection', x + 8, cardsY + 138, 15, '#5b6654');
    });
  } else {
    text('Follow your own brush.', b.x + 48, cardsY + 30, 24, '#304b45', true);
    text('This expedition has no authored field studies. Your strokes still make a postcard.', b.x + 48, cardsY + 65, 18);
  }
  text(a.next ? `Nearest unfinished study: ${a.next.name}` : a.studies.length ? 'Every study is alive. Open your sketchbook to keep the memory.' : 'Rest, explore, and continue toward the far shore.', b.x + 48, b.y + 610, 21, '#304b45', true);
  text(a.crossing ? 'Side path: paint the crossing green to open it; blue makes a current; red wakes thorns.' : a.moth ? 'Moth nook: grow a green flower, then interrupt the lantern moth with blue paint.' : 'Lantern rest stones refill your light. Checkpoints are marked after you reach their zone.', b.x + 48, b.y + 643, 17);
  text('A field sketch, not a collision map. Landmarks are optional; painting is unlimited.', b.x + 48, b.y + 674, 15, '#64665b');
  paperEnd(ctx); ctx.restore();
}
