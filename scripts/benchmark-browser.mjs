import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import os from 'node:os';
const exec=promisify(execFile);
const base=process.env.BENCHMARK_URL||'http://127.0.0.1:4173/idera5s-energy-lab/';
const output=process.env.BENCHMARK_OUTPUT||'.local/browser-benchmark.json';
const browser=await chromium.launch({channel:process.platform==='win32'?'msedge':undefined,headless:true});
const session=await browser.newBrowserCDPSession();
async function cpu(){const {processInfo}=await session.send('SystemInfo.getProcessInfo');return processInfo.reduce((n,p)=>n+p.cpuTime,0);}
async function gpu(){try{const {stdout}=await exec('nvidia-smi',['--query-gpu=name,driver_version,memory.total,memory.used,utilization.gpu,utilization.memory,power.draw','--format=csv,noheader,nounits'],{windowsHide:true});return stdout.trim();}catch{return 'unavailable';}}
async function state(page){return page.evaluate(()=>{const e=window.__energyLab,s=e.snapshot(),sorted=[...e.frames].sort((a,b)=>a-b);return {...s,frameMsP95:sorted[Math.floor(sorted.length*.95)],sampleTime_s:e.sample.Time_s,elapsedPageMs:performance.now()};});}
async function ready(page){await page.waitForFunction(()=>window.__energyLab?.snapshot().ready);}
const result={date:new Date().toISOString(),base,browser:browser.version(),os:os.type()+' '+os.release(),cpu:os.cpus()[0].model,logicalProcessors:os.cpus().length,ramBytes:os.totalmem(),method:'Headless Edge using real hardware WebGL, capped at 60 rendered frames/s. Frame intervals measure scheduled rendered frames including UI overhead. CPU is this browser process tree. nvidia-smi is whole-device sampling, not per-tab GPU load. Mobile viewport emulation is not physical-phone testing.',cases:[],longReplay:[]};
try{
  const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});
  await page.goto(base);await ready(page);result.navigationReadyMs=await page.evaluate(()=>performance.now());
  result.initialResources=await page.evaluate(()=>performance.getEntriesByType('resource').filter(e=>/\.glb|catalog\.json/.test(e.name)).map(e=>({name:e.name.split('/').pop(),durationMs:e.duration,transferBytes:e.transferSize,decodedBytes:e.decodedBodySize})));
  for(const quality of ['standard','high','low']){await page.getByRole('combobox',{name:'画质',exact:true}).selectOption(quality);await page.waitForFunction(q=>window.__energyLab.quality===q&&window.__energyLab.snapshot().ready,quality);await page.waitForTimeout(2500);const c0=await cpu(),t0=performance.now();await page.getByRole('switch',{name:'自动旋转',exact:true}).click();await page.waitForTimeout(8000);const c1=await cpu(),elapsed=(performance.now()-t0)/1000;result.cases.push({name:'desktop-'+quality,viewport:[1440,1000],...(await state(page)),cpuOneCorePercent:100*(c1-c0)/elapsed,cpuMachinePercent:100*(c1-c0)/elapsed/os.cpus().length,gpu:await gpu()});await page.getByRole('switch',{name:'自动旋转',exact:true}).click();console.log('Measured desktop '+quality);}
  await page.getByRole('combobox',{name:'画质',exact:true}).selectOption('standard');await page.getByRole('link',{name:'能量实验室',exact:true}).click();await page.getByRole('combobox',{name:'驾驶工况',exact:true}).selectOption('longTrip');await page.getByRole('button',{name:'播放回放',exact:true}).waitFor();await page.waitForFunction(()=>window.__energyLab.sample.Time_s===0&&window.__energyLab.sample.SOC!==undefined);await page.getByRole('combobox',{name:'车身显示',exact:true}).selectOption('transparent');await page.getByRole('combobox',{name:'播放速度',exact:true}).selectOption('20');
  const cdp=await page.context().newCDPSession(page);await cdp.send('HeapProfiler.collectGarbage');await page.getByRole('button',{name:'播放回放',exact:true}).click();await page.waitForTimeout(4000);const c0=await cpu(),t0=performance.now();result.longReplay.push({elapsed_s:0,...await state(page),gpu:await gpu()});
  for(let i=1;i<=12;i++){await page.waitForTimeout(10000);result.longReplay.push({elapsed_s:(performance.now()-t0)/1000,...await state(page),gpu:await gpu()});console.log('Long replay '+i*10+' s');}
  const elapsed=(performance.now()-t0)/1000;result.longReplayCpuOneCorePercent=100*((await cpu())-c0)/elapsed;
  await page.getByRole('button',{name:'暂停回放',exact:true}).click();await cdp.send('HeapProfiler.collectGarbage');result.longReplayAfterGC=await state(page);await page.close();
  const mobile=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});await mobile.goto(base);await ready(mobile);await mobile.getByRole('switch',{name:'自动旋转',exact:true}).click();const mc0=await cpu(),mt0=performance.now();await mobile.waitForTimeout(10000);result.cases.push({name:'mobile-emulated-auto',viewport:[390,844],...await state(mobile),cpuOneCorePercent:100*((await cpu())-mc0)/((performance.now()-mt0)/1000),gpu:await gpu()});await mobile.close();
}finally{await fs.mkdir(new URL('../.local/',import.meta.url),{recursive:true});await fs.writeFile(output,JSON.stringify(result,null,2));await browser.close();}
console.log('Saved '+output);
