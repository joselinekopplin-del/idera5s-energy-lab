// Decode the delivered recording in Edge; save actual video frames for QA.
import {chromium} from '@playwright/test';
import {createServer} from 'node:http';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const project=fileURLToPath(new URL('../..',import.meta.url));
const bytes=await readFile(path.join(project,'videos/IDERA5S_EnergyLab_web_demo.webm'));
const server=createServer((req,res)=>{if(req.url==='/video.webm'){const match=/bytes=(\d+)-(\d*)/.exec(req.headers.range||'');const start=match?+match[1]:0,end=match&&match[2]?Math.min(+match[2],bytes.length-1):bytes.length-1;res.writeHead(match?206:200,{'Content-Type':'video/webm','Accept-Ranges':'bytes','Content-Length':end-start+1,...(match?{'Content-Range':`bytes ${start}-${end}/${bytes.length}`}:{})});res.end(bytes.subarray(start,end+1));return;}res.setHeader('Content-Type','text/html');res.end('<html><body style="margin:0;background:#111"><video controls preload="auto" style="display:block;width:1920px;height:1080px" src="/video.webm"></video></body></html>');});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:1920,height:1080}});await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForFunction(()=>document.querySelector('video').readyState>=2);
  const metadata=await page.locator('video').evaluate(v=>({duration_s:v.duration,width:v.videoWidth,height:v.videoHeight,readyState:v.readyState,error:v.error?.message||null,canPlayVP9:v.canPlayType('video/webm; codecs="vp9"')}));
  for(const time of [3,13,18,24]){await page.locator('video').evaluate((v,t)=>new Promise(resolve=>{v.addEventListener('seeked',resolve,{once:true});v.currentTime=t;}),time);await page.screenshot({path:path.join(project,`figures/web_platform/video_sample_${time}s.png`)});}
  await writeFile(path.join(project,'figures/web_platform/video_verification.json'),JSON.stringify(metadata,null,2));console.log(JSON.stringify(metadata,null,2));
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
