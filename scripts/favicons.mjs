export function renderFavicons(prefix = '') {
    const base = `${prefix}assets/icons`;
    return `    <link rel="icon" href="${base}/favicon.ico" sizes="any">
    <link rel="icon" type="image/png" href="${base}/favicon-32x32.png" sizes="32x32">
    <link rel="icon" type="image/png" href="${base}/favicon-192x192.png" sizes="192x192">
    <link rel="apple-touch-icon" href="${base}/apple-touch-icon.png">`;
}
