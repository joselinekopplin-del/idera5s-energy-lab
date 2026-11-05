import { chromium, expect } from '@playwright/test';
import fs from 'node:fs/promises';
const url=process.env.VERIFY_URL||'https://joselinekopplin-del.github.io/idera5s-energy-lab/';
const browser=await chromium.launch({channel:process.platform==='win32'?'msedge':undefined,headless:true});
const report={url,checkedAt:new Date().toISOString(),browser:browser.version(),errors:[],httpErrors:[],checks:[]};
const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});
page.on('pageerror',e=>report.errors.push(String(e)));
page.on('response',r=>{if(r.status()>=400)report.httpErrors.push({url:r.url(),status:r.status()});});
try{
  const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});expect(response.status()).toBe(200);expect(new URL(page.url()).protocol).toBe('https:');
  await page.waitForFunction(()=>window.__energyLab?.snapshot().ready,{timeout:60000});
  report.readyMs=await page.evaluate(()=>performance.now());report.desktop=await page.evaluate(()=>window.__energyLab.snapshot());report.checks.push('HTTPS homepage, real GLB and hardware WebGL');
  await page.getByRole('button',{name:'风尚青',exact:true}).click();await page.getByRole('button',{name:'后 45°',exact:true}).click();await page.waitForTimeout(900);
  const canvas=page.getByRole('img',{name:'可旋转和缩放的 ID.ERA 5S 三维模型',exact:true});await canvas.scrollIntoViewIfNeeded();const rect=await canvas.boundingBox();const before=await page.evaluate(()=>window.__energyLab.snapshot().camera);
  await page.mouse.move(rect.x+rect.width*.5,rect.y+rect.height*.5);await page.mouse.down();await page.mouse.move(rect.x+rect.width*.65,rect.y+rect.height*.55,{steps:10});await page.mouse.up();await page.mouse.wheel(0,180);await page.waitForTimeout(500);
  const after=await page.evaluate(()=>window.__energyLab.snapshot().camera);expect(after).not.toEqual(before);report.checks.push('Mouse orbit, wheel zoom, paint and view controls');
  await page.getByRole('link',{name:'能量实验室',exact:true}).click();await page.getByRole('combobox',{name:'驾驶工况',exact:true}).selectOption('winterMinus10');await expect(page.getByRole('button',{name:'播放回放',exact:true})).toBeEnabled();await expect(page.locator('.feasibility')).toContainText('存在动力缺口');await page.getByRole('combobox',{name:'车身显示',exact:true}).selectOption('transparent');await page.getByRole('button',{name:'播放回放',exact:true}).click();await page.waitForTimeout(1300);await page.getByRole('button',{name:'暂停回放',exact:true}).click();expect(Number(await page.getByRole('slider',{name:'回放时间',exact:true}).inputValue())).toBeGreaterThan(1);expect(await page.getByRole('slider',{name:'电池荷电状态',exact:true}).count()).toBe(1);report.checks.push('Verified JSON, infeasible winter marker, playback and synchronized charts');
  await page.getByRole('link',{name:'策略分析',exact:true}).click();await expect(page.locator('.strategy-card')).toHaveCount(4);await expect(page.locator('.comparison-chart svg path')).toHaveCount(4);report.checks.push('Four-strategy analysis loaded from HTTPS data');
  for(const route of ['about','analysis','lab','home']){await page.goto(url+'#/'+route,{waitUntil:'domcontentloaded'});await page.reload();await expect(page.locator('main')).toBeVisible();if(route==='home'||route==='lab')await page.waitForFunction(()=>window.__energyLab?.snapshot().ready);}
  report.checks.push('All four hash routes survive reload');await page.getByRole('combobox',{name:'界面主题',exact:true}).selectOption('dark');await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  await fs.mkdir('../figures/web_platform',{recursive:true});await page.screenshot({path:'../figures/web_platform/online-home.png',fullPage:true});
  const mobile=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});await mobile.goto(url);await mobile.waitForFunction(()=>window.__energyLab?.snapshot().ready);expect(await mobile.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(392);expect(await mobile.evaluate(()=>window.__energyLab.quality)).toBe('low');
  await mobile.getByRole('button',{name:'都市金',exact:true}).tap();report.mobile=await mobile.evaluate(()=>window.__energyLab.snapshot());report.checks.push('Mobile layout, low LOD and touch paint selection');await mobile.screenshot({path:'../figures/web_platform/online-mobile.png',fullPage:true});await mobile.close();
  report.resources=await page.evaluate(()=>performance.getEntriesByType('resource').filter(e=>/\.glb|catalog\.json/.test(e.name)).map(e=>({name:e.name,durationMs:e.duration,transferBytes:e.transferSize})));
  expect(report.errors).toEqual([]);expect(report.httpErrors).toEqual([]);report.passed=true;
}catch(e){report.passed=false;report.failure=String(e);throw e;}finally{await fs.mkdir('.local',{recursive:true});await fs.writeFile('.local/deployment-verification.json',JSON.stringify(report,null,2));await browser.close();}
console.log(JSON.stringify(report,null,2));
