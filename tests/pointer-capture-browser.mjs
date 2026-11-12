import assert from 'node:assert/strict';

// A separate page retains Chrome's actual Pointer Lock API. Other journey
// fixtures exercise the absolute-pointer fallback for their exact paint targets.
export async function pointerCaptureBrowser({page,report}) {
  const capture=await page.context().browser().newPage({viewport:{width:1280,height:820}});
  try {
    await capture.addInitScript(()=>{window.requestAnimationFrame=()=>0;});
    await capture.goto(page.url());
    await capture.waitForFunction(()=>window.__game,null,{polling:50});
    const tick=n=>capture.evaluate(n=>{const g=window.__game;for(let i=0;i<n;i++)g._frame(g.last+1000/60);},n);
    await capture.evaluate(()=>{const g=window.__game;g._beginExpedition();g.spawnT=999;g.banners=[];g._drawAll();});
    await capture.mouse.click(700,400);
    await capture.waitForFunction(()=>document.pointerLockElement===window.__game.canvas,null,{polling:20});
    const before=await capture.evaluate(()=>({...window.__game.input.mouse}));
    await capture.mouse.move(790,430);await tick(1);
    const after=await capture.evaluate(()=>({...window.__game.input.mouse}));
    assert(after.x>before.x&&after.y>before.y,'real relative mouse motion changes captured aim');
    await capture.mouse.move(2400,1600);await tick(1);
    const edge=await capture.evaluate(()=>{const g=window.__game;return {x:g.input.mouse.x,y:g.input.mouse.y,w:g.cw,h:g.ch,locked:document.pointerLockElement===g.canvas};});
    assert(edge.locked&&edge.x>=0&&edge.x<=edge.w&&edge.y>=0&&edge.y<=edge.h,'moving beyond browser bounds retains capture and bounded aim');
    await capture.mouse.move(2200,1400);await tick(1);
    assert(await capture.evaluate(()=>window.__game.input.mouse.x<window.__game.cw),'aim reverses immediately from the edge');
    await capture.keyboard.press('Escape');await tick(2);
    await capture.waitForFunction(()=>!document.pointerLockElement,null,{polling:20});
    assert(await capture.evaluate(()=>window.__game.paused),'Escape releases and pauses');
    assert(await capture.evaluate(()=>!window.__game.input.mouse.lDown&&!window.__game.input.mouse.rDown),'release clears held paint buttons');

    // Resume via keyboard, then click to recapture. Opening the book releases
    // the pointer so native menus and postcard editing remain usable.
    await capture.keyboard.press('p');await tick(2);
    await capture.mouse.click(700,400);
    await capture.waitForFunction(()=>!!document.pointerLockElement,null,{polling:20});
    await capture.keyboard.press('j');await tick(2);
    await capture.waitForFunction(()=>!document.pointerLockElement,null,{polling:20});
    assert(await capture.evaluate(()=>window.__game._bookOpen),'sketchbook opens with a free cursor');
    report.push('Native Chromium pointer capture: relative aim beyond window, edge reversal, Escape release/pause, recapture and sketchbook release passed');
  } finally {await capture.close();}
}
