import { randomBytes, timingSafeEqual } from 'node:crypto';
import { getOAuth } from './oauth/auth.mjs';
import { isOAuthStaffEmail } from './oauth/staff.mjs';
import { getUserByEmail, getUserById, publicUser, createSession, cookieHeader } from './auth.mjs';
import { hasMfa, startMfa, limitAuth } from './login-security.mjs';
const flows = new Map();
const origin = 'https://leannedigital.com';
const cookieName = 'ld_workspace_google';
const cookie = (value, age = 600) => `${cookieName}=${value}; Path=/api/auth/google; Secure; HttpOnly; SameSite=Lax; Max-Age=${age}`;
const error = (message, status = 403) => Object.assign(new Error(message), { status });
function json(res, status, body, headers = {}) { res.writeHead(status, { 'Content-Type':'application/json', 'Cache-Control':'no-store', ...headers });res.end(JSON.stringify(body));return true; }
function flowFrom(req, token) {
    const saved = String(req.headers.cookie || '').match(/(?:^|;\s*)ld_workspace_google=([a-f0-9]{64})(?:;|$)/)?.[1];
    if (!saved || !/^[a-f0-9]{64}$/.test(token || '') || !timingSafeEqual(Buffer.from(saved),Buffer.from(token))) throw error('Google sign-in expired. Start again from the login page.');
    const flow = flows.get(token);
    if (!flow || flow.expires < Date.now()) throw error('Google sign-in expired. Start again from the login page.');
    return flow;
}
export async function handleGoogleLogin(req,res,runtime = getOAuth()) {
    const url = new URL(req.url, origin);
    if (!url.pathname.startsWith('/api/auth/google/')) return false;
    if (url.pathname === '/api/auth/google/status' && req.method === 'GET') return json(res,200,{enabled:Boolean(runtime?.googleEnabled)});
    if (!runtime?.googleEnabled) throw error('Google sign-in is not available. Please use your email and password.',503);
    if (url.pathname === '/api/auth/google/start' && req.method === 'POST') {
        limitAuth(req,'google');
        for (const [id,f] of flows) if(f.expires < Date.now())flows.delete(id);
        if(flows.size > 1000)throw error('Please try again shortly.',429);
        const token = randomBytes(32).toString('hex');
        const response = await runtime.auth.api.signInSocial({body:{provider:'google',disableRedirect:true,callbackURL:`${origin}/api/auth/google/callback?flow=${token}`,errorCallbackURL:`${origin}/login/?google=error`},headers:runtime.fromNodeHeaders(req.headers),asResponse:true});
        const payload = await response.json();
        if(!response.ok || !payload.url || new URL(payload.url).origin !== 'https://accounts.google.com')throw error('Could not start Google sign-in. Please try again.',502);
        flows.set(token,{expires:Date.now()+600000});
        return json(res,200,{url:payload.url},{'Set-Cookie':[...response.headers.getSetCookie(),cookie(token)]});
    }
    if (url.pathname === '/api/auth/google/callback' && req.method === 'GET') {
        try {
            const token=url.searchParams.get('flow'), flow=flowFrom(req,token);
            if(flow.userId)throw error('Google sign-in has already been used.');
            const session = await runtime.auth.api.getSession({headers:runtime.fromNodeHeaders(req.headers)});
            const identity=session?.user;
            if(!identity || identity.emailVerified !== true || !isOAuthStaffEmail(identity.email))throw error('This Google account is not approved for the workspace.');
            const user=getUserByEmail(identity.email);
            if(!user || user.role !== 'staff')throw error('This Google account does not have a workspace account.');
            flow.userId=user.id;flow.passwordHash=user.passwordHash;
            res.writeHead(303,{'Location':'/login/?google=complete','Cache-Control':'no-store'});res.end();return true;
        } catch {
            res.writeHead(303,{'Location':'/login/?google=error','Cache-Control':'no-store','Set-Cookie':cookie('',0)});res.end();return true;
        }
    }
    if (url.pathname === '/api/auth/google/complete' && req.method === 'POST') {
        limitAuth(req,'google');
        const token=String(req.headers.cookie || '').match(/(?:^|;\s*)ld_workspace_google=([a-f0-9]{64})(?:;|$)/)?.[1];
        const flow=flowFrom(req,token);const user=getUserById(flow.userId);
        if(!user || user.role!=='staff' || user.passwordHash!==flow.passwordHash || !isOAuthStaffEmail(user.email))throw error('Google sign-in expired. Please try again.');
        flows.delete(token);
        if(hasMfa(user.id))return json(res,200,startMfa(user),{'Set-Cookie':cookie('',0)});
        const session=createSession(user.id);
        return json(res,200,{user:publicUser(user)},{'Set-Cookie':[cookieHeader(session.id),cookie('',0)]});
    }
    return json(res,405,{error:'Method not allowed'});
}
