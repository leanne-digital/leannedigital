export function permissionsForScopes(scopes = [], forceReadOnly = false) {
    return {
        readOnly: forceReadOnly || !scopes.includes('mcp:write'),
        credentialWrite: !forceReadOnly && scopes.includes('mcp:credentials:write'),
        workLogWrite: !forceReadOnly && (scopes.includes('mcp:worklog:write') || scopes.includes('mcp:write')),
    };
}
