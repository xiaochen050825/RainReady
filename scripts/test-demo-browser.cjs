// Run with Playwright installed, or set RAINREADY_PLAYWRIGHT to its module path.
const {chromium}=require(process.env.RAINREADY_PLAYWRIGHT||'@playwright/test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const origin=process.env.RAINREADY_TEST_ORIGIN||'http://127.0.0.1:5185';
const key='rainready-personal-demo:v2';
const results=[];
async function check(name,fn){await fn();results.push(name);console.log('PASS '+name);}
async function saved(page){await page.waitForFunction(k=>{const x=localStorage.getItem(k);return x&&[...document.querySelectorAll('.cloud-account [role=status]')].some(e=>e.textContent==='Saved in this browser only');},key);}
async function plan(page){return page.evaluate(k=>JSON.parse(JSON.parse(localStorage.getItem(k)).values['rainready-planning:v1']),key);}
(async()=>{
 const baseline=await (await fetch(origin+'/api/workspace')).json();
 const browser=await chromium.launch({headless:true});
 const contexts=await Promise.all([browser.newContext({viewport:{width:1440,height:1000}}),browser.newContext({viewport:{width:1440,height:1000}})]);
 const a=await contexts[0].newPage(),b=await contexts[1].newPage();const errors=[],writes=[];
 for(const p of [a,b]){p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(r.url().includes('/api/workspace')&&r.method()!=='GET')writes.push(r.method());});}
 try{
  await check('homepage choice opens the identical plan in the workspace',async()=>{
   await a.goto(origin);await a.getByRole('button',{name:'1 crew',exact:true}).click();
   const count=await a.locator('.example-result strong').innerText();
   await a.getByRole('button',{name:'Try this plan',exact:false}).click();await a.getByRole('button',{name:'Use this example',exact:true}).click();
   await a.waitForFunction(()=>document.querySelector('.stepper output')?.textContent==='1');await saved(a);
   assert.equal((await plan(a)).crewCount,1);assert.equal((await plan(a)).rain,64);assert.ok((await a.locator('.plan-counts').innerText()).includes(count+' scheduled'));
  });
  await check('independent visitor keeps baseline while the first visitor edits and reloads',async()=>{
   await b.goto(origin+'/#plan');await saved(b);assert.equal((await plan(b)).crewCount,2);
   await a.getByRole('button',{name:'Add one crew',exact:true}).click();await a.getByRole('button',{name:'Add one crew',exact:true}).click();await saved(a);
   await a.reload();await saved(a);assert.equal((await plan(a)).crewCount,3);await b.reload();await saved(b);assert.equal((await plan(b)).crewCount,2);
  });
  await check('four sample reports use distinct report IDs with real asset links',async()=>{
   await a.goto(origin+'/#inspections');await a.locator('.report-list button').first().waitFor();
   assert.equal(await a.locator('.report-list button').count(),4);
   for(let i=0;i<4;i++){await a.locator('.report-list button').nth(i).click();const id='RR-'+String(i*6+1).padStart(3,'0');assert.equal(await a.getByLabel('Linked asset ID',{exact:true}).inputValue(),id);assert.ok((await a.locator('.report-crumb').innerText()).includes('Report INS-00'+(i+1)));}
   await a.locator('.report-list button').first().click();
   await a.getByLabel('Inspector notes',{exact:true}).fill('Visitor A private inspection note');await a.getByRole('button',{name:'Save inspection',exact:true}).click();await saved(a);
   await a.reload();await a.getByLabel('Inspector notes',{exact:true}).waitFor();assert.equal(await a.getByLabel('Inspector notes',{exact:true}).inputValue(),'Visitor A private inspection note');
   await b.goto(origin+'/#inspections');await b.getByLabel('Inspector notes',{exact:true}).waitFor();assert.equal(await b.getByLabel('Inspector notes',{exact:true}).inputValue(),'');
  });
  await check('new report association persists immediately without a separate Save click',async()=>{
   await a.getByRole('button',{name:'New inspection',exact:false}).click();await a.getByLabel('New inspection asset',{exact:true}).selectOption('RR-027');await a.getByRole('button',{name:'Create for this asset',exact:true}).click();await saved(a);
   await a.reload();await a.getByLabel('Linked asset ID',{exact:true}).waitFor();assert.equal(await a.getByLabel('Linked asset ID',{exact:true}).inputValue(),'RR-027');assert.equal(await a.locator('.report-list button').count(),5);
  });
  let backup;
  await check('backup export contains the personal changes',async()=>{
   const downloadEvent=a.waitForEvent('download');await a.getByRole('button',{name:'Download Backup',exact:true}).last().click();const download=await downloadEvent;backup=await fs.readFile(await download.path(),'utf8');assert.ok(backup.includes('Visitor A private inspection note'));
  });
  await check('reset only resets the current visitor and restore only restores their copy',async()=>{
   await a.getByRole('button',{name:'Reset Demo',exact:true}).last().click();await a.getByRole('button',{name:'Reset my demo',exact:true}).click();await a.waitForLoadState('domcontentloaded');await a.locator('.report-list button').first().waitFor();assert.equal(await a.locator('.report-list button').count(),4);
   await a.getByLabel('Workspace backup file',{exact:true}).last().setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(backup)});await a.getByRole('button',{name:'Restore This Backup',exact:true}).click();await a.waitForLoadState('domcontentloaded');await a.locator('.report-list button').first().waitFor();assert.equal(await a.locator('.report-list button').count(),5);
   await b.reload();await b.locator('.report-list button').first().waitFor();assert.equal(await b.locator('.report-list button').count(),4);
  });
  await check('mobile workspace fits the screen and keeps the demo controls available',async()=>{
   await b.setViewportSize({width:390,height:844});await b.goto(origin+'/#plan');await b.getByRole('button',{name:'Tasks',exact:true}).click();assert.equal(await b.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await b.locator('.mobile-cloud summary').click();await b.locator('.mobile-cloud').getByRole('button',{name:'Reset Demo',exact:true}).waitFor({state:'visible'});
  });
  await check('browser actions produce no cloud writes and leave the baseline unchanged',async()=>{assert.deepEqual(writes,[]);assert.deepEqual(await (await fetch(origin+'/api/workspace')).json(),baseline);assert.deepEqual(errors,[]);});
  if(process.env.RAINREADY_QA_DIR){await fs.mkdir(process.env.RAINREADY_QA_DIR,{recursive:true});await a.screenshot({path:process.env.RAINREADY_QA_DIR+'/inspections.png',fullPage:true});await fs.writeFile(process.env.RAINREADY_QA_DIR+'/browser-results.json',JSON.stringify({origin,checks:results,errors,writes},null,2));}
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
