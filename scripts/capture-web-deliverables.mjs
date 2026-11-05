/** Capture the real website using public UI controls. No renderer state mutation. */
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot=fileURLToPath(new URL('..',import.meta.url));
const project=path.resolve(webRoot,'..');
const figures=path.join(project,'figures/web_platform');
const videos=path.join(project,'videos');
const staging=path.join(webRoot,'.local/demo-recording');
const url=process.env.CAPTURE_URL||'http://127.0.0.1:5173/idera5s-energy-lab/';
await Promise.all([mkdir(figures,{recursive:true}),mkdir(videos,{recursive:true}),mkdir(staging,{recursive:true})]);
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'msedge',headless:true});
const checkpoints=[];let context;
const shot=async(page,name)=>{await expect(page.locator('.scene-status')).toHaveCount(0);await page.screenshot({path:path.join(figures,name+'.png'),fullPage:true});};
async function ready(page){await page.waitForFunction(()=>window.__energyLab?.snapshot().ready&&window.__energyLab.snapshot().frameCount>8,{timeout:45000});await expect(page.locator('.scene-status')).toHaveCount(0);}
async function top(page){await page.mouse.move(1890,180);await page.mouse.wheel(0,-2400);await page.waitForTimeout(300);}
async function slider(page,name,value){const el=page.getByRole('slider',{name,exact:true});await el.scrollIntoViewIfNeeded();const box=await el.boundingBox(),lo=Number(await el.getAttribute('min')),hi=Number(await el.getAttribute('max'));await el.click({position:{x:8+(box.width-16)*(value-lo)/(hi-lo),y:box.height/2}});}
try{
  context=await browser.newContext({viewport:{width:1920,height:1080},deviceScaleFactor:1,colorScheme:'light',recordVideo:{dir:staging,size:{width:1920,height:1080}}});
  const page=await context.newPage();const video=page.video();const start=Date.now();
  const mark=async(label)=>checkpoints.push({seconds:(Date.now()-start)/1000,label,url:page.url(),...(await page.evaluate(()=>window.__energyLab?.snapshot()||{}))});
  await page.goto(url);await ready(page);await page.waitForTimeout(1200);await shot(page,'overview');await mark('首页真实 GLB');
  const canvas=page.getByRole('img',{name:'可旋转和缩放的 ID.ERA 5S 三维模型',exact:true}),box=await canvas.boundingBox();
  await page.mouse.move(box.x+box.width*.50,box.y+box.height*.48);await page.mouse.down();
  for(let i=1;i<=24;i++){await page.mouse.move(box.x+box.width*(.50+.12*i/24),box.y+box.height*(.48+.025*i/24));await page.waitForTimeout(40);}
  await page.mouse.up();await page.waitForTimeout(1000);await mark('鼠标拖动旋转');
  await page.getByRole('button',{name:'风尚青',exact:true}).click();await page.waitForTimeout(1000);
  await page.getByRole('button',{name:'后 45°',exact:true}).click();await page.getByRole('combobox',{name:'灯光模式',exact:true}).selectOption('brake');await top(page);await page.waitForTimeout(1700);await mark('车漆、后视和制动灯');
  await page.getByRole('button',{name:'前 45°',exact:true}).click();await page.getByRole('button',{name:'都市金',exact:true}).click();
  await page.locator('.nav-rail').getByRole('link',{name:'能量实验室',exact:true}).click();await ready(page);
  await page.getByRole('combobox',{name:'驾驶工况',exact:true}).selectOption('acceleration');
  await page.getByRole('combobox',{name:'能量管理策略',exact:true}).selectOption('Rule_Based');await expect(page.getByRole('button',{name:'播放回放',exact:true})).toBeEnabled();
  await page.getByRole('combobox',{name:'车身显示',exact:true}).selectOption('transparent');await slider(page,'部件拆解',.38);await slider(page,'回放时间',20);await page.getByRole('combobox',{name:'播放速度',exact:true}).selectOption('1');
  await page.getByRole('button',{name:'播放回放',exact:true}).click();await top(page);await page.waitForTimeout(4400);await mark('实际加速工况：混合驱动、展开和能量流');
  await page.getByRole('button',{name:'暂停回放',exact:true}).click();await top(page);await shot(page,'lab');
  await page.getByRole('combobox',{name:'驾驶工况',exact:true}).selectOption('braking');await expect(page.getByRole('button',{name:'播放回放',exact:true})).toBeEnabled();await slider(page,'回放时间',54);await page.getByRole('button',{name:'播放回放',exact:true}).click();await top(page);await page.waitForTimeout(3500);await mark('实际制动回收：箭头反向');
  await page.getByRole('button',{name:'暂停回放',exact:true}).click();
  await page.locator('.nav-rail').getByRole('link',{name:'策略分析',exact:true}).click();await page.getByRole('combobox',{name:'驾驶工况',exact:true}).selectOption('longTrip');await expect(page.locator('.loading-block')).toHaveCount(0,{timeout:30000});await top(page);await page.waitForTimeout(2200);await shot(page,'analysis');await mark('四策略真实数据比较');
  await page.getByRole('combobox',{name:'对比曲线',exact:true}).selectOption('FuelUsed_L');await page.waitForTimeout(2200);await mark('切换累计燃油曲线');
  // Keep a short, readable recording even on fast local storage.
  const remaining=32000-(Date.now()-start);if(remaining>0)await page.waitForTimeout(remaining);
  await context.close();context=undefined;const destination=path.join(videos,'IDERA5S_EnergyLab_web_demo.webm');await video.saveAs(destination);await video.delete();
  // Additional screenshots use an unrecorded context and genuine controls.
  context=await browser.newContext({viewport:{width:1920,height:1080},deviceScaleFactor:1,colorScheme:'light'});
  const dark=await context.newPage();await dark.goto(url);await ready(dark);await dark.getByRole('combobox',{name:'界面主题',exact:true}).selectOption('dark');await dark.getByRole('combobox',{name:'摄影棚',exact:true}).selectOption('dark');await dark.getByRole('button',{name:'摩登白',exact:true}).click();await top(dark);await dark.waitForTimeout(700);await shot(dark,'dark');await context.close();context=undefined;
  context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,colorScheme:'light'});
  const mobile=await context.newPage();await mobile.goto(url);await ready(mobile);await mobile.waitForTimeout(500);
  // A real phone viewport, not a stitched full-page image with the fixed bottom
  // rail in the middle. Scroll until all configuration controls clear the rail.
  await mobile.mouse.move(380,300);await mobile.mouse.wheel(0,300);await mobile.waitForTimeout(450);
  await mobile.screenshot({path:path.join(figures,'mobile.png'),fullPage:false});await context.close();context=undefined;
  const videoInfo=await stat(destination);
  await writeFile(path.join(figures,'capture_manifest.json'),JSON.stringify({source:url,recording:'../../videos/IDERA5S_EnergyLab_web_demo.webm',recordingBytes:videoInfo.size,recordingResolution:[1920,1080],format:'Playwright WebM',interactionMethod:'Actual DOM controls and mouse gestures; diagnostic reads only, no renderer state mutation',screenshots:['overview.png','lab.png','analysis.png','dark.png','mobile.png'],checkpoints},null,2)+'\n');
  console.log(JSON.stringify({video:destination,bytes:videoInfo.size,screenshots:figures,checkpoints:checkpoints.map(c=>({seconds:c.seconds,label:c.label}))},null,2));
}finally{if(context)await context.close();await browser.close();}
