import test from 'node:test';import assert from 'node:assert/strict';
const origin=process.env.RAINREADY_TEST_ORIGIN||'http://127.0.0.1:5174';
test('public APIs require valid route requests and reject cross-origin submissions without asking for login',async()=>{
 const headers={'content-type':'application/json',origin};
 for(const endpoint of ['road-route','road-times']){
  const invalid=await fetch(origin+'/api/'+endpoint,{method:'POST',headers,body:'{"points":[]}'});assert.equal(invalid.status,400,await invalid.text());
  const cross=await fetch(origin+'/api/'+endpoint,{method:'POST',headers:{...headers,origin:'https://elsewhere.example'},body:'{"points":[]}'});assert.equal(cross.status,403);
 }
 const missing=await fetch(origin+'/api/environmental-context');assert.equal(missing.status,400);
});
test('public site serves the homepage, readable captions, local font and complete product film',async()=>{
 const page=await fetch(origin+'/');assert.equal(page.status,200);const html=await page.text();assert.match(html,/A clearer plan/);assert.doesNotMatch(html,/Sign in to save plans/);
 const captions=await fetch(origin+'/design-media/rainready-en.vtt');assert.equal(captions.status,200);assert.match(await captions.text(),/WEBVTT/);
 const movie=await fetch(origin+'/design-media/rainready-web-v1.mp4',{headers:{Range:'bytes=0-2047'}});assert.ok([200,206].includes(movie.status));const bytes=new Uint8Array(await movie.arrayBuffer());assert.equal(new TextDecoder().decode(bytes.slice(4,8)),'ftyp');
 const font=await fetch(origin+'/design-media/fonts/InterVariable.woff2');assert.equal(font.status,200);
});
