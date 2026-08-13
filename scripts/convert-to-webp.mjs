import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ASSETS = path.join(ROOT, 'assets');
const SKIP_DIRS = new Set(['icons']);
const EXT = new Set(['.png', '.jpg', '.jpeg']);
const MAX_WIDTH = 1920;

function walk(dir, out = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name.startsWith('.')) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (SKIP_DIRS.has(entry.name)) continue;
            walk(full, out);
        } else if (EXT.has(path.extname(entry.name).toLowerCase())) {
            out.push(full);
        }
    }
    return out;
}

function rewriteText(text) {
    return text.replace(
        /(\/?assets\/(?:images|clients)\/[^"'?\s)]+)\.(png|jpe?g)/gi,
        '$1.webp',
    );
}

function walkTextFiles(dir, out = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name.startsWith('.')) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (['node_modules', '_import', 'assets', '.git'].includes(entry.name)) continue;
            walkTextFiles(full, out);
        } else if (/\.(html|css|mjs|js|json)$/i.test(entry.name)) {
            out.push(full);
        }
    }
    return out;
}

async function convertFile(file) {
    const dest = file.replace(/\.(png|jpe?g)$/i, '.webp');
    const image = sharp(file);
    const meta = await image.metadata();
    let pipeline = image;
    if (meta.width && meta.width > MAX_WIDTH) {
        pipeline = pipeline.resize({ width: MAX_WIDTH, withoutEnlargement: true });
    }
    await pipeline.webp({ quality: 82, effort: 4, alphaQuality: 90 }).toFile(dest);
    const before = fs.statSync(file).size;
    const after = fs.statSync(dest).size;
    return { file, dest, before, after };
}

async function main() {
    const rasters = walk(ASSETS);
    let converted = 0;
    let saved = 0;
    for (const file of rasters) {
        const dest = file.replace(/\.(png|jpe?g)$/i, '.webp');
        if (path.normalize(dest) === path.normalize(file)) continue;
        try {
            const result = await convertFile(file);
            converted += 1;
            saved += Math.max(0, result.before - result.after);
            const kb = (result.after / 1024).toFixed(1);
            const from = (result.before / 1024).toFixed(1);
            console.log(`webp ${path.relative(ROOT, dest)} (${from} → ${kb} KiB)`);
        } catch (error) {
            console.error(`skip ${path.relative(ROOT, file)}: ${error.message}`);
        }
    }

    let rewritten = 0;
    for (const file of walkTextFiles(ROOT)) {
        const before = fs.readFileSync(file, 'utf8');
        const after = rewriteText(before);
        if (after !== before) {
            fs.writeFileSync(file, after, 'utf8');
            rewritten += 1;
        }
    }

    console.log(
        `Converted ${converted} images (saved ${(saved / 1024 / 1024).toFixed(1)} MiB). Rewrote ${rewritten} files.`,
    );
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
