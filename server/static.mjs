import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.pdf': 'application/pdf',
    '.zip': 'application/zip',
    '.txt': 'text/plain; charset=utf-8',
    '.xml': 'application/xml; charset=utf-8',
    '.map': 'application/json',
};

const BLOCKED = ['/data', '/server', '/scripts', '/node_modules', '/_import'];

export function requestPath(url) {
    const { pathname } = new URL(url, 'http://localhost');
    if (pathname.length > 1 && pathname.endsWith('/')) return pathname;
    return pathname;
}

export function isBlocked(pathname) {
    if (pathname.split('/').some((part) => part.startsWith('.') && part !== '.')) return true;
    return BLOCKED.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function resolvePublicFile(pathname) {
    if (isBlocked(pathname)) return null;
    const relative = pathname.replace(/^\/+/, '');
    const target = path.resolve(ROOT, relative);
    if (!target.startsWith(ROOT)) return null;
    if (fs.existsSync(target) && fs.statSync(target).isDirectory()) {
        const index = path.join(target, 'index.html');
        return fs.existsSync(index) ? index : null;
    }
    if (fs.existsSync(target) && fs.statSync(target).isFile()) return target;
    if (!path.extname(target)) {
        const index = path.join(target, 'index.html');
        if (fs.existsSync(index)) return index;
    }
    return null;
}

export function sendFile(res, filePath, extraHeaders = {}) {
    const ext = path.extname(filePath).toLowerCase();
    const type = MIME[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type, ...extraHeaders });
    fs.createReadStream(filePath).pipe(res);
}

export { ROOT };
