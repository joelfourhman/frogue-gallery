// Actual Web Audio rendering: exercises the live transport against the audio
// clock, not merely score data. Generated WAV previews are local test evidence.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

export async function musicBrowser({page,out,report}) {
  const scenes=await page.evaluate(async()=>{
    const {CLEARING}=await import('./src/logic.js');
    const g=window.__game, result=[];
    g.audio.ensure();g.audio.setMuted(false);
    const step=()=>{g._frame(g.last+1000/60);g._frame(g.last+1000/60);result.push(g.audio._score.current?.id);};
    g._quitToTitle();step();
    for(let floor=0;floor<4;floor++) {
      g._beginExpedition(false,{campaignFloor:floor});step();
      g.heron._intro=0;step();
    }
    g._beginExpedition();g.player.x=CLEARING.x-50;g.player.y=CLEARING.y;
    if(!g.encounter.onStroke({kind:'swipe',pigment:'blue',x:CLEARING.x-50,y:CLEARING.y,range:70,a:0}))throw Error('Music fixture did not ring the clearing bell');step();
    g.state='camp';step();
    g.state='end';g.endKind='defeat';step();
    g.endKind='victory';step();
    const current=g.audio._score.current;
    g._frame(g.last+1000/60);
    return {ids:result,same:g.audio._score.current===current,
      layers:g.audio._score.layers.length,voices:g.audio._score.voices.length};
  });
  assert.deepEqual(scenes.ids,['title','swamp','gray','reeds','silt','sanctuary','warden','blackReeds','umbral','clearing','rest','defeat','victory']);
  assert(scenes.same);assert(scenes.layers<=3);assert(scenes.voices<=64);
  report.push({actualGameMusicScenes:scenes});

  const rendered=await page.evaluate(async()=>{
    const {MusicPlayer}=await import('./src/music.js');
    const {SCORE}=await import('./src/score.js');
    const {_MIX}=await import('./src/audio.js');
    const results=[];
    for(const id of Object.keys(SCORE)) {
      const rate=22050, duration=12;
      const ctx=new OfflineAudioContext(2,rate*duration,rate);
      const bus=ctx.createGain();bus.gain.value=_MIX.melodyLevel*.6*.7;bus.connect(ctx.destination);
      const player=new MusicPlayer(ctx,bus);player.setTrack(id);player.tick();
      let wait=ctx.suspend(.1);
      const rendering=ctx.startRendering();
      let maxVoices=0;
      for(let t=.1;t<duration-.1;t+=.1) {
        await wait;player.tick();maxVoices=Math.max(maxVoices,player.voices.length);
        if(t+.1<duration-.1)wait=ctx.suspend(t+.1);
        await ctx.resume();
      }
      const buffer=await rendering;
      let peak=0,sum=0,invalid=0,stereo=0,jump=0;
      const left=buffer.getChannelData(0),right=buffer.getChannelData(1);
      for(let i=0;i<left.length;i++) {
        const v=left[i]; if(!Number.isFinite(v)||!Number.isFinite(right[i]))invalid++;
        peak=Math.max(peak,Math.abs(v),Math.abs(right[i]));sum+=v*v;
        stereo+=Math.abs(v-right[i]);if(i)jump=Math.max(jump,Math.abs(v-left[i-1]));
      }
      let wav=null;
      if(['title','swamp','umbral','victory'].includes(id)) {
        const bytes=new Uint8Array(44+left.length*4),view=new DataView(bytes.buffer);
        const text=(offset,s)=>{for(let i=0;i<s.length;i++)view.setUint8(offset+i,s.charCodeAt(i));};
        text(0,'RIFF');view.setUint32(4,bytes.length-8,true);text(8,'WAVE');text(12,'fmt ');
        view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,2,true);
        view.setUint32(24,rate,true);view.setUint32(28,rate*4,true);view.setUint16(32,4,true);view.setUint16(34,16,true);
        text(36,'data');view.setUint32(40,left.length*4,true);
        for(let i=0;i<left.length;i++){view.setInt16(44+i*4,Math.max(-1,Math.min(1,left[i]))*32767,true);view.setInt16(46+i*4,Math.max(-1,Math.min(1,right[i]))*32767,true);}
        let binary='';for(let offset=0;offset<bytes.length;offset+=8192)binary+=String.fromCharCode(...bytes.subarray(offset,offset+8192));
        wav=btoa(binary);
      }
      results.push({id,peak,rms:Math.sqrt(sum/left.length),stereo:stereo/left.length,jump,invalid,maxVoices,wav});
      player.dispose();
    }
    return results;
  });
  for(const r of rendered) {
    assert.equal(r.invalid,0,`${r.id}: finite stereo PCM`);
    assert(r.peak>.015&&r.peak<.9,`${r.id}: audible with headroom (${r.peak})`);
    assert(r.rms>.003&&r.rms<.25,`${r.id}: useful signal level (${r.rms})`);
    assert(r.stereo>.00001,`${r.id}: stereo arrangement`);
    assert(r.jump<.15,`${r.id}: no large sample discontinuities`);
    assert(r.maxVoices<64,`${r.id}: voice budget`);
    if(r.wav)await fs.writeFile(path.join(out,`music-${r.id}.wav`),Buffer.from(r.wav,'base64'));
    delete r.wav;
  }
  report.push({renderedSoundtrack:rendered});
  await fs.writeFile(path.join(out,'music-render.json'),JSON.stringify(rendered,null,2));
}
