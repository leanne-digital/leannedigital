// The staff issuer protects exactly one resource. Bind clients that omit RFC 8707's
// optional parameter to that resource; explicit audiences are still validated.
export async function bindStaffResource(request, resource) {
    const url = new URL(request.url);
    if (url.pathname.endsWith('/oauth2/authorize') && request.method === 'GET' && !url.searchParams.has('resource')) {
        url.searchParams.set('resource', resource);
        return new Request(url, request);
    }
    if (url.pathname.endsWith('/oauth2/token') && request.method === 'POST' && request.headers.get('content-type')?.includes('application/x-www-form-urlencoded')) {
        const form = new URLSearchParams(await request.clone().text());
        if (!form.has('resource') && ['authorization_code','refresh_token'].includes(form.get('grant_type'))) {
            form.set('resource', resource);
            const headers = new Headers(request.headers); headers.delete('content-length');
            return new Request(url, {method:'POST',headers,body:form});
        }
    }
    return request;
}
