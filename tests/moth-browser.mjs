// Authored late-game scene setup only; encounter verbs use real DOM inputs.
// Wave timer and already-cleared zone beats are staged for isolation; no god
// mode, enemy phase/reward setters or paint shortcuts in the encounter journey.
// Injected freeze/root and lethal damage are explicitly cleanup fixtures.
import assert from 'node:assert/strict';
import path from 'node:path';
export async function mothBrowser({page,tick,out,report}) {
  const signatures = await page.evaluate(async () => {
    const {drawEnemy,spawnEnemy}=await import('./src/enemies.js');
    const {makeTuning}=await import('./src/logic.js');
    const c=document.createElement('canvas'); c.width=400;c.height=240;
    const ctx=c.getContext('2d',{willReadFrequently:true}), e=spawnEnemy('moth',140,130,makeTuning({},[],'normal',0));
    e._seed=1;e.mothDX=1;e.mothDY=0;e.mothT=.4;
    const result=[];
    for(const phase of ['approach','tell','dash','settle']) {
      e.mothPhase=phase;e.mothSettled=phase==='settle';ctx.clearRect(0,0,400,240); drawEnemy(ctx,e,10);
      const data=ctx.getImageData(0,0,400,240).data; let hash=2166136261;
      for(const n of data) hash=Math.imul(hash^n,16777619)>>>0;
      result.push(hash);
    }
    return result;
  });
  assert.equal(new Set(signatures).size,4,'moth approach/tell/dash/settled silhouettes differ at fixed time');
  report.push({mothPosePixels:signatures});
  await page.evaluate(() => {
    const g=window.__game; g.save.ngCycle=0;g.save.flags.heronDefeated=true;g.save.flags.reedsVictory=false;
    g.options.wander=false;g.options.shake=false;g._beginExpedition(false,{reeds:true});g.spawnT=999;g._zoneI=2;g.weatherZoneI=2;
    g.player.x=2650;g.player.y=550;g.cam.x=2650;g.cam.y=550;
    window.mothSounds=[]; const sound=g.sfx.bind(g);g.sfx=(name,opt)=>{window.mothSounds.push(name);sound(name,opt);};
  });
  const flowerPixels=await page.evaluate(()=>{
    const w=window.__game.world, c=document.createElement('canvas');c.width=600;c.height=550;
    const ctx=c.getContext('2d',{willReadFrequently:true}); const result=[];
    if(typeof w.drawMothFlower!=='function') return result;
    for(const green of [false,true]) {
      w.mothFlower.green=green; ctx.clearRect(0,0,c.width,c.height);ctx.save();ctx.translate(300-2650,130-300);
      w.drawMothFlower(ctx,10,2650,350);ctx.restore(); let hash=2166136261;
      for(const n of ctx.getImageData(0,0,c.width,c.height).data) hash=Math.imul(hash^n,16777619)>>>0;
      result.push(hash);
    }
    w.mothFlower.green=false;return result;
  });
  assert.equal(flowerPixels.length,2,'visible dormant and green flower renderer exists');
  assert.notEqual(flowerPixels[0],flowerPixels[1],'green bloom visibly changes the flower');
  report.push({mothFlowerPixels:flowerPixels});
  const state=()=>page.evaluate(()=>{
    const g=window.__game,e=g.enemies.find(e=>e.kind==='moth');
    return {px:g.player.x,py:g.player.y,hp:g.player.hp,max:g.player.maxHp,alive:g.player.alive,state:g.state,phase:e?.mothPhase,t:e?.mothT,ex:e?.x,ey:e?.y,dx:e?.mothDX,dy:e?.mothDY,settled:!!e?.mothSettled,rewarded:!!e?.mothRewarded,green:g.world.mothFlower?.green,started:g.world.mothFlower?.started,collected:g.collected.blue};
  });
  const aim=async(x,y)=>{
    const point=await page.evaluate(({x,y})=>{const g=window.__game,v=g._view(),r=g.canvas.getBoundingClientRect();return {x:r.left+(x-v.x)*v.scale*r.width/g.cw,y:r.top+(y-v.y)*v.scale*r.height/g.ch};},{x,y});
    await page.mouse.move(point.x,point.y);
  };
  const move=async(key,n)=>{await page.keyboard.down(key);await tick(n);await page.keyboard.up(key);};
  const walk=async(x,y)=>{
    for(let i=0;i<240;i++) {
      const s=await state();if(Math.hypot(s.px-x,s.py-y)<8) break;
      const keys=[];if(Math.abs(s.px-x)>5)keys.push(s.px<x?'d':'a');if(Math.abs(s.py-y)>5)keys.push(s.py<y?'s':'w');
      for(const k of keys)await page.keyboard.down(k);await tick(2);for(const k of keys)await page.keyboard.up(k);
    }
    const s=await state();assert(Math.hypot(s.px-x,s.py-y)<12,`actual input walk reaches ${x},${y}: ${JSON.stringify(s)}`);
  };
  await page.evaluate(()=>{const g=window.__game;g.player.x=2450;g.player.y=750;g.cam.x=2450;g.cam.y=750;});
  await walk(2850,750);assert.equal((await state()).started,false,'ordinary corridor traversal never activates the optional encounter');
  await page.evaluate(()=>{const g=window.__game;g._beginExpedition(false,{reeds:true});g.spawnT=999;g._zoneI=2;g.weatherZoneI=2;g.player.x=2650;g.player.y=550;g.cam.x=2650;g.cam.y=550;});
  await tick(260); // late-game staging: opening banner has already faded on arrival
  await tick(1);await page.screenshot({path:path.join(out,'16-moth-nook.png')});
  assert.equal((await state()).started,false);
  await page.keyboard.down('w');
  for(let i=0;i<80 && !(await state()).started;i++)await tick(1);
  const approach=await state();assert.equal(approach.phase,'approach');
  await tick(8);const guided=await state();assert(guided.ex<approach.ex && guided.ey>approach.ey,'moth follows actual carried player light');
  await page.screenshot({path:path.join(out,'17-moth-approach.png')});
  for(let i=0;i<80 && (await state()).phase!=='tell';i++)await tick(1);
  await page.keyboard.up('w'); const tell=await state();assert.equal(tell.phase,'tell');
  const readableHint=await page.evaluate(()=>{const g=window.__game,v=g._view(),f=g.world.mothFlower,x=Math.round((f.x-v.x-300)*v.scale),y=Math.round((f.y-v.y-116)*v.scale),data=g.ctx.getImageData(x,y,600,72).data;let bright=0;for(let i=0;i<data.length;i+=4)if(data[i]>180 && data[i+1]>180 && data[i+2]>160)bright++;return bright;});
  assert(readableHint>100,'flower instructions retain readable bright pixels above the darkness mask');
  await page.screenshot({path:path.join(out,'18-moth-tell.png')});
  await page.keyboard.press('p');await tick(1);const paused=await state();await tick(90);
  assert.deepEqual(await state(),paused,'pause owns clock and moth state');
  await page.keyboard.press('p');await tick(1);
  await page.keyboard.down('a');await tick(10);const locked=await state();
  assert.equal(locked.phase,'tell');assert.equal(locked.dx,tell.dx);assert.equal(locked.dy,tell.dy);assert.equal(locked.hp,tell.hp);
  await tick(5);await page.keyboard.up('a'); // commit a sideways dodge, stay within the lamp's falloff
  let warningFrames=16;
  for(let i=0;i<60 && (await state()).phase==='tell';i++){await tick(1);warningFrames++;}
  const dash=await state();assert.equal(dash.phase,'dash');assert(warningFrames>=36,'at least 600ms visible simulation warning');
  await page.screenshot({path:path.join(out,'19-moth-dash.png')});
  await tick(24);await page.keyboard.up('a');assert.equal((await state()).hp,tell.hp,'actual sideways dodge avoids committed dash');
  await walk(2650,750);await tick(60);assert.equal((await state()).hp,tell.hp,'can leave the optional nook safely');
  report.push({mothActualGuideLockedTellPauseDodgeLeave:{approach,guided,tell,dash,warningFrames}});
  // Fresh authored scene for the counter. No direct mutation of enemy phase,
  // pigment, flower or reward; green/blue are selected with real keyboard input.
  await page.evaluate(()=>{const g=window.__game;g._beginExpedition(false,{reeds:true});g.spawnT=999;g._zoneI=2;g.weatherZoneI=2;g.player.x=2650;g.player.y=550;g.cam.x=2650;g.cam.y=550;});
  await tick(260);
  await walk(2680,335);
  await aim(2650,300);await page.keyboard.press('3');await tick(1);await page.mouse.down();await tick(1);await page.mouse.up();
  assert.equal((await state()).green,true,'real green swipe blooms the authored flower');
  await tick(16);const beforeBlue=await state();await aim(beforeBlue.ex,beforeBlue.ey);await page.keyboard.press('2');await tick(1);
  await page.mouse.down();await tick(1);await page.mouse.up();const interrupted=await state();
  assert.equal(interrupted.phase,'settle','real blue swipe interrupts the moth');
  assert.equal(interrupted.hp,interrupted.max,'counter journey never needs god mode');
  await page.screenshot({path:path.join(out,'20-moth-blue-counter.png')});
  await page.keyboard.press('l');await tick(1);
  assert.equal(await page.evaluate(()=>window.__game.lantern.lit),false,'real lantern key snuffs the lure during settlement');
  await tick(240);const settled=await state();assert.equal(settled.settled,true);assert.equal(settled.rewarded,true);
  assert.equal(settled.collected,beforeBlue.collected+2);await tick(300);assert.equal((await state()).collected,settled.collected);
  assert.equal((await state()).alive,true,'safe resting encounter remains playable: '+JSON.stringify(await page.evaluate(()=>{const g=window.__game;return {engaged:g._wyrmEngaged,intro:g.heron._intro,player:{x:g.player.x,y:g.player.y,hp:g.player.hp},enemies:g.enemies.map(e=>({kind:e.kind,hit:e._lastHit,x:e.x,y:e.y}))};})));
  assert.equal((await state()).state,'expedition','resting frame evidence is gameplay, never a defeat modal');
  assert.equal(await page.evaluate(()=>!!window.__game._wyrmEngaged),false,'Silt Wyrm waits for its actual arena');
  const framing=await page.evaluate(()=>{const g=window.__game,v=g._view(),f=g.world.mothFlower;return {playerX:(g.player.x-v.x)*v.scale,playerY:(g.player.y-v.y)*v.scale,flowerX:(f.x-v.x)*v.scale,flowerY:(f.y-v.y)*v.scale,cw:g.cw,ch:g.ch};});
  assert(framing.playerX>40 && framing.playerX<framing.cw-40 && framing.flowerX>40 && framing.flowerX<framing.cw-40,'camera keeps the optional encounter on screen after boss intro expires');
  report.push({mothFraming:framing});
  await page.keyboard.press('l');await tick(1);
  await page.screenshot({path:path.join(out,'21-moth-resting.png')});
  await page.setViewportSize({width:640,height:480});await tick(1);
  await page.screenshot({path:path.join(out,'22-moth-resting-640.png')});
  await page.setViewportSize({width:1280,height:820});await tick(1);
  report.push({mothActualGreenBlueSettle:{beforeBlue,interrupted,settled}});
  assert.equal(await page.evaluate(()=>window.mothSounds.includes('moth-tell') && window.mothSounds.includes('moth-settle')),true,'live encounter emits warning and settlement SFX');
  const effects=await page.evaluate(()=>{const g=window.__game;return {particles:g.particles.pool.length,droplets:g.paint.droplets.length,wet:g.paint.wet.length,ink:g.paint.ink.length,wakes:g.studio.wakes?.length||0};});
  assert(effects.particles<=240 && effects.droplets<=48 && effects.wet<=120 && effects.ink<=40 && effects.wakes<=24);
  const resetNear=()=>page.evaluate(()=>{const g=window.__game;g._beginExpedition(false,{reeds:true});g.spawnT=999;g._zoneI=2;g.weatherZoneI=2;g.player.x=2650;g.player.y=350;g.cam.x=2650;g.cam.y=350;});
  await resetNear();await tick(1);assert.equal((await state()).phase,'tell');
  await page.keyboard.press('l');await tick(1);assert.equal((await state()).phase,'approach');
  await tick(90);assert.equal((await state()).phase,'approach','dark moth never arms an attack');
  await page.keyboard.press('l');await tick(1);assert.equal((await state()).phase,'tell');assert.equal((await state()).t,.6,'relighting gives a fresh full tell');
  for(const type of ['freeze','root']) {
    await resetNear();await tick(1);
    await page.evaluate(type=>{window.__game.enemies.find(e=>e.kind==='moth').status={type,t:.2};},type);
    const before=await state();await tick(5);const held=await state();assert.equal(held.phase,'settle');assert.equal(held.ex,before.ex);assert.equal(held.ey,before.ey);
    await tick(108);assert.equal((await state()).phase,'tell',`${type} expiry recovers to a new warning`);
  }
  await resetNear();await tick(1);
  await page.evaluate(()=>{const g=window.__game,e=g.enemies.find(e=>e.kind==='moth');e.hp=0;});await tick(1);
  assert.equal((await state()).phase,undefined);assert.equal((await state()).collected,0,'moth death never pays settlement reward');
  await tick(60);assert.equal((await state()).phase,undefined,'a killed introduction never respawns');
  await resetNear();await tick(1);
  await page.evaluate(()=>{const g=window.__game;g.player.hurt(99999,g.tuning);});await tick(180);
  assert.equal(await page.evaluate(()=>window.__game.endKind),'defeat');
  await page.keyboard.press('Escape');await tick(1);await page.keyboard.press('Enter');await tick(1);
  assert.equal((await state()).alive,true);assert.equal((await state()).phase,undefined);assert.equal((await state()).collected,0);
  await resetNear();
  assert.equal((await state()).green,false);assert.equal((await state()).started,false,'fresh Reeds restart has no pending flower/reward/status');
  report.push({mothCleanup:'actual L snuff/relight, freeze/root fixtures and expiry, death/removal, player defeat + input restart, fresh Reeds reset',effects});
  await page.evaluate(()=>{const g=window.__game;g.player.x=g.world.w-930;g.player.y=750;g.cam.x=g.player.x;g.cam.y=750;g._zoneI=3;});
  await move('d',20);
  assert.equal(await page.evaluate(()=>!!window.__game._wyrmEngaged),true,'actual arena entry still engages Silt Wyrm after deferral');
  report.push('Silt Wyrm waits during nook exploration and still engages on actual-input arena entry');
  const audio=await page.evaluate(async()=>{
    const {AudioSys}=await import('./src/audio.js'), clips=[];
    for(const name of ['moth-tell','moth-settle']) {
      const au=new AudioSys();au.ctx=new OfflineAudioContext(1,44100,44100);au.sfxBus=au.ctx.createGain();au.sfxBus.connect(au.ctx.destination);au.sfx(name);
      const rendered=await au.ctx.startRendering(),samples=rendered.getChannelData(0);
      let peak=0,sum=0,last=0;for(let i=0;i<samples.length;i++){peak=Math.max(peak,Math.abs(samples[i]));sum+=samples[i]*samples[i];if(Math.abs(samples[i])>.0002)last=i;}
      const wav=new ArrayBuffer(44+samples.length*2),view=new DataView(wav);const text=(o,s)=>{for(let i=0;i<s.length;i++)view.setUint8(o+i,s.charCodeAt(i));};
      text(0,'RIFF');view.setUint32(4,wav.byteLength-8,true);text(8,'WAVE');text(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,44100,true);view.setUint32(28,88200,true);view.setUint16(32,2,true);view.setUint16(34,16,true);text(36,'data');view.setUint32(40,samples.length*2,true);
      for(let i=0;i<samples.length;i++)view.setInt16(44+i*2,Math.round(Math.max(-1,Math.min(1,samples[i]))*32767),true);
      let binary='';for(const b of new Uint8Array(wav))binary+=String.fromCharCode(b);
      clips.push({name,peak,rms:Math.sqrt(sum/samples.length),audibleSeconds:last/44100,wav:btoa(binary)});
    }
    return clips;
  });
  const fs=await import('node:fs/promises');
  for(const clip of audio){assert(clip.peak>.001 && clip.peak<.15 && clip.audibleSeconds<.6);await fs.writeFile(path.join(out,clip.name+'.wav'),Buffer.from(clip.wav,'base64'));delete clip.wav;}
  report.push({mothOfflineAudio:audio});
}

// Standalone focused iteration; the same function is also in both gated journeys.
if (process.argv[1]?.replaceAll('\\','/').endsWith('/moth-browser.mjs')) {
  const {chromium}=await import('playwright-core');
  const {createServer,ROOT}=await import('../scripts/dev.mjs');
  const {browserPath}=await import('../scripts/browser.mjs');
  const fs=await import('node:fs/promises');
  const server=createServer(ROOT);await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const browser=await chromium.launch({executablePath:browserPath(),headless:true});
  try {
    const page=await browser.newPage({viewport:{width:1280,height:820}}),errors=[],report=[];
    page.on('pageerror',e=>errors.push(String(e)));
    await page.addInitScript(()=>{window.requestAnimationFrame=()=>0; let seed=8941; Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};});
    await page.goto(`http://127.0.0.1:${server.address().port}/`);await page.waitForFunction(()=>window.__game,null,{polling:50,timeout:5000});
    const tick=n=>page.evaluate(n=>{const g=window.__game;for(let i=0;i<n;i++)g._frame(g.last+1000/60);},n);
    const out=path.join(ROOT,'tests','.out','moth');await fs.mkdir(out,{recursive:true});
    await mothBrowser({page,tick,out,report});assert.deepEqual(errors,[]);
    await fs.writeFile(path.join(out,'report.json'),JSON.stringify({report,errors},null,2));console.log(JSON.stringify(report,null,2));
    console.log('MOTH BROWSER CHECKS PASSED');
  } finally {await browser.close();await new Promise(r=>server.close(r));}
}
