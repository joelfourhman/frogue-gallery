// Standalone real-browser score validation and WAV preview export.
import { chromium } from 'playwright-core';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createServer,ROOT} from '../scripts/dev.mjs';
import {browserPath} from '../scripts/browser.mjs';
import {musicBrowser} from './music-browser.mjs';
const out=path.join(ROOT,'tests','.out','astra');await fs.mkdir(out,{recursive:true});
const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;
try {
  browser=await chromium.launch({executablePath:browserPath(),headless:true});
  const page=await browser.newPage();
  await page.addInitScript(()=>{window.requestAnimationFrame=()=>0;});
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.waitForFunction(()=>window.__game,null,{polling:50});
  await page.mouse.click(10,10);
  const report=[];await musicBrowser({page,out,report});console.log(JSON.stringify(report,null,2));
  console.log('BROWSER SOUNDTRACK RENDER PASSED');
} finally {await browser?.close();await new Promise(r=>server.close(r));}
