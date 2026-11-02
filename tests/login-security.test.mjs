import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { pathToFileURL } from 'node:url';
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ld-login-security-'));
for (const dir of ['server', 'scripts']) fs.cpSync(dir, path.join(root, dir), { recursive: true });
fs.symlinkSync(path.resolve('node_modules'), path.join(root, 'node_modules'), 'junction');
fs.writeFileSync(path.join(root, 'package.json'), '{"type":"module"}');
fs.mkdirSync(path.join(root, 'data'), { recursive: true });
for (const file of ['clients', 'portal-clients', 'client-projects', 'portfolio-projects']) fs.writeFileSync(path.join(root, 'data', file + '.json'), '[]');
process.env.PRIVATE_CLIENT_PUBLIC_GUARD = '1';
process.env.CLIENT_WORK_LOG_DB_PATH = path.join(root, 'data/work.sqlite');
process.env.PORTAL_API_KEY = 'fixture-only-key';
const security = await import(pathToFileURL(path.join(root, 'server/login-security.mjs')));
const auth = await import(pathToFileURL(path.join(root, 'server/auth.mjs')));
// RFC 6238 SHA1 test vector, independent of this implementation.
const secret = security.encodeSecret(Buffer.from('12345678901234567890'));
assert.equal(security.totp(secret, 1, 8), '94287082');
assert.equal(security.totp(secret, Math.floor(1111111109 / 30), 8), '07081804');
assert.equal(security.totp(secret, Math.floor(20000000000 / 30), 8), '65353130');
security.consumeLimit('fixture', 2, 1000, 100);
security.consumeLimit('fixture', 2, 1000, 100);
assert.throws(() => security.consumeLimit('fixture', 2, 1000, 101), { status: 429 });
security.consumeLimit('fixture', 2, 1000, 1101);
assert.equal(security.clientIp({ socket: {remoteAddress:'127.0.0.1'}, headers:{'x-forwarded-for':'fake, 203.0.113.1'} }), '203.0.113.1');
assert.equal(security.clientIp({ socket: {remoteAddress:'203.0.113.2'}, headers:{'x-forwarded-for':'fake'} }), '203.0.113.2');
const staff = await auth.createUser({email:'staff@fixture.test',password:'test-password-123',role:'staff'});
const client = await auth.createUser({email:'client@fixture.test',password:'test-password-123',role:'client'});
await assert.rejects(auth.login('staff@fixture.test','bad'),{status:401});
await assert.rejects(auth.login('absent@fixture.test','bad'),{status:401});
const passwordOnly=await auth.login(staff.email,'test-password-123');
assert.ok(passwordOnly.session);
assert.ok(auth.getSessionUser({headers:{cookie:'ld_portal='+passwordOnly.session.id}}).user);
let challenge = await auth.login(staff.email,'test-password-123',{enrollMfa:true});
assert.equal(challenge.setupRequired,true); assert.equal(challenge.session,undefined);
assert.equal(JSON.parse(fs.readFileSync(path.join(root,'data/portal-sessions.json'))).length,1);
assert.throws(()=>auth.verifyLoginMfa(challenge.challenge,'bad'),{status:401});
let verified=auth.verifyLoginMfa(challenge.challenge,security.totp(challenge.secret));
assert.equal(verified.user.id,staff.id); assert.equal(verified.recoveryCodes.length,10);
assert.throws(()=>auth.verifyLoginMfa(challenge.challenge,security.totp(challenge.secret)),{status:401});
const stored=fs.readFileSync(path.join(root,'data/login-security/mfa.json'),'utf8');
assert.ok(!stored.includes(challenge.secret)); assert.ok(!stored.includes(verified.recoveryCodes[0]));
const recovery=verified.recoveryCodes[0]; const oldSecret=challenge.secret;
challenge=await auth.login(staff.email,'test-password-123');
assert.equal(challenge.setupRequired,false);assert.equal(challenge.secret,undefined);
assert.throws(()=>auth.verifyLoginMfa(challenge.challenge,security.totp(oldSecret)),{status:401});
verified=auth.verifyLoginMfa(challenge.challenge,recovery);assert.ok(verified.session);
challenge=await auth.login(staff.email,'test-password-123');
assert.throws(()=>auth.verifyLoginMfa(challenge.challenge,recovery),{status:401});
await auth.changePassword(staff.id,{currentPassword:'test-password-123',password:'new-test-password-123'});
assert.throws(()=>auth.verifyLoginMfa(challenge.challenge,'123456'),{status:401});
assert.ok((await auth.login(client.email,'test-password-123')).session);
assert.match(auth.cookieHeader('fixture'),/; Secure; HttpOnly;/);
const oldSession=auth.createSession(staff.id);
assert.equal(auth.getSessionUser({headers:{cookie:'ld_portal='+oldSession.id}}).user,null);
assert.ok(auth.getSessionUser({headers:{cookie:'ld_portal='+verified.session.id}}).user);

// Google bridge: validate provider identity and existing account; never auto-provision.
const {handleGoogleLogin}=await import(pathToFileURL(path.join(root,'server/google-login.mjs')));
const googleUser=await auth.createUser({email:'gary@leannedigital.com',password:'fixture-google-password',role:'staff'});
let identity={email:googleUser.email,emailVerified:true};
const runtime={googleEnabled:true,fromNodeHeaders:h=>h,auth:{api:{
    signInSocial:async()=>new Response(JSON.stringify({url:'https://accounts.google.com/o/oauth2/v2/auth?fixture=1'}),{headers:{'Content-Type':'application/json','Set-Cookie':'fixture-state=1; Secure; HttpOnly'}}),
    getSession:async()=>({user:identity})
}}};
async function googleCall(route,method='POST',cookies='') {
    const req={url:route,method,headers:{cookie:cookies},socket:{remoteAddress:'203.0.113.5'}};
    const res={writeHead(status,headers){this.status=status;this.headers=headers;},end(body){this.body=body;}};
    await handleGoogleLogin(req,res,runtime);return res;
}
async function googleFlow() {
    const start=await googleCall('/api/auth/google/start');assert.equal(start.status,200);
    return start.headers['Set-Cookie'].find(c=>c.startsWith('ld_workspace_google=')).split(';')[0];
}
let flowCookie=await googleFlow();let token=flowCookie.split('=')[1];
let response=await googleCall('/api/auth/google/callback?flow='+token,'GET','wrong=1');assert.match(response.headers.Location,/google=error/);
identity={email:googleUser.email,emailVerified:false};
response=await googleCall('/api/auth/google/callback?flow='+token,'GET',flowCookie);assert.match(response.headers.Location,/google=error/);
identity={email:'intruder@example.test',emailVerified:true};
response=await googleCall('/api/auth/google/callback?flow='+token,'GET',flowCookie);assert.match(response.headers.Location,/google=error/);
identity={email:'leanne@leannedigital.com',emailVerified:true};
response=await googleCall('/api/auth/google/callback?flow='+token,'GET',flowCookie);assert.match(response.headers.Location,/google=error/);
identity={email:googleUser.email,emailVerified:true};
response=await googleCall('/api/auth/google/callback?flow='+token,'GET',flowCookie);assert.match(response.headers.Location,/google=complete/);
response=await googleCall('/api/auth/google/complete','POST',flowCookie);assert.equal(JSON.parse(response.body).user.id,googleUser.id);assert.ok(response.headers['Set-Cookie'].some(c=>c.startsWith('ld_portal=')));
await assert.rejects(googleCall('/api/auth/google/complete','POST',flowCookie),{status:403});
const enrollment=await auth.login(googleUser.email,'fixture-google-password',{enrollMfa:true});
auth.verifyLoginMfa(enrollment.challenge,security.totp(enrollment.secret));
flowCookie=await googleFlow();token=flowCookie.split('=')[1];
await googleCall('/api/auth/google/callback?flow='+token,'GET',flowCookie);
response=await googleCall('/api/auth/google/complete','POST',flowCookie);assert.equal(JSON.parse(response.body).mfaRequired,true);
assert.ok(!String(response.headers['Set-Cookie']).includes('ld_portal='));

const {createPortalServer}=await import(pathToFileURL(path.join(root,'server/api.mjs')));
const server=createPortalServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`;
const post=(route,body,headers={})=>fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
try {
    assert.equal((await post('/api/auth/login',{email:client.email,password:'test-password-123'},{Origin:'https://evil.example'})).status,403);
    assert.equal((await fetch(base+'/api/auth/login',{method:'POST',body:'email=x'})).status,415);
    let response=await post('/api/auth/login',{email:client.email,password:'test-password-123'});
    assert.equal(response.status,200);assert.match(response.headers.get('set-cookie'),/Secure/);
    response=await post('/api/auth/login',{email:staff.email,password:'new-test-password-123'});
    assert.equal((await response.json()).mfaRequired,true); assert.equal(response.headers.get('set-cookie'),null);
    for(let i=0;i<10;i++) assert.equal((await post('/api/auth/login',{email:'nobody@fixture.test',password:'wrong'})).status,401);
    response=await post('/api/auth/login',{email:'nobody@fixture.test',password:'wrong'}); assert.equal(response.status,429);assert.ok(Number(response.headers.get('retry-after'))>0);
    for(let i=0;i<3;i++) assert.equal((await post('/api/auth/forgot',{email:'absent@fixture.test'})).status,200);
    assert.equal((await post('/api/auth/forgot',{email:'absent@fixture.test'})).status,429);
    assert.equal((await post('/api/auth/reset',{token:'bad',password:'long-enough-password'})).status,400);
    assert.equal((await post('/api/auth/login',{email:'x',password:'a'.repeat(9000)})).status,413);
    assert.equal((await post('/api/auth/logout',{})).status,200);
    if (process.env.LOGIN_BROWSER_TEST === '1') {
    const { chromium } = await import('../tmp/shift-preview-tools/node_modules/playwright/index.mjs');
    const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
    try {
        for (const width of [1440,390]) {
            const email=`browser-${width}@fixture.test`;
            await auth.createUser({email,password:'browser-test-password',role:'staff'});
            const page=await browser.newPage({viewport:{width,height:1000}});
            await page.route('**/*',async route=>{
                const u=new URL(route.request().url());
                if(u.origin!==base)return route.abort();
                if(u.pathname.startsWith('/api/'))return route.continue();
                if(u.pathname==='/login/') {
                    let html=fs.readFileSync('login/index.html','utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
                    html=html.replace('</body>','<script src="/js/portal-auth.js"></script></body>');
                    return route.fulfill({contentType:'text/html',body:html});
                }
                const file=u.pathname==='/js/portal-auth.js' ? 'js/portal-auth.js' : '.'+u.pathname;
                if(fs.existsSync(file)&&fs.statSync(file).isFile())return route.fulfill({path:file});
                return route.abort();
            });
            await page.goto(base+'/login/');
            await page.fill('[name=email]',email);await page.fill('[name=password]','browser-test-password');
            await page.check('[name=enrollMfa]');
            await page.click('button[type=submit]');
            await page.locator('#mfa-code').waitFor();
            const setup=await page.locator('form code').textContent();
            assert.ok(setup); assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
            await page.fill('#mfa-code',security.totp(setup));
            const mfaResponse=page.waitForResponse(r=>r.url().endsWith('/api/auth/mfa'));
            await page.click('button[type=submit]');
            const mfaResult=await mfaResponse;assert.equal(mfaResult.status(),200,await mfaResult.text());
            await page.locator('form pre').waitFor();
            assert.equal((await page.locator('form pre').textContent()).trim().split('\n').length,10);
            assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
            await page.close();
        }
    } finally {await browser.close();}
    }
    console.log('PASS: RFC vectors, MFA enrollment/login/replay/recovery, password binding, secure cookies, origin checks, payload limits, account/reset throttling. Isolated fixture: '+root);
} finally {await new Promise(r=>server.close(r));}

