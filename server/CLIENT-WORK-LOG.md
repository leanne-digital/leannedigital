# Client work logging through MCP

The October 21 investigation reproduced 28 read-only tools with a read-only
grant. Production had `REMOTE_MCP_READ_ONLY=0`; the newest ChatGPT consent
(October 19) granted only `mcp:read`. Earlier consent granted general writes.
There was no dedicated work-log tool. A metadata refresh alone cannot expand
an OAuth grant.

`list_client_work_logs` and `get_client_report` read saved work. The separate
`mcp:worklog:write` scope enables only `append_client_work_log`. It does not
enable client, billing, project, credential or published-report mutations.
Existing `mcp:write` also permits appends. Global read-only overrides all writes.
New authentication challenges request `mcp:read mcp:worklog:write offline_access`.
No existing consent or tokens are upgraded or edited.

Reconnect ChatGPT with those three scopes and approve the consent screen.
If an older registered client rejects the new scope, create a fresh connection
so dynamic registration includes it. Refresh the connection's tool metadata,
then start a new conversation. Expect 29 read tools and one append tool for
the narrow grant; a read-only grant sees 29 read tools.

Storage is a private SQLite database: `CLIENT_WORK_LOG_DB_PATH`, or a sibling
`client-work-log/work-log.sqlite` beside `OAUTH_DATA_DIR`. Local fallback is
`runtime/client-work-log/work-log.sqlite`. Include it in private server backups;
never commit or deploy database contents. Writes are append-only and transactionally
deduplicated by client, date, normalized title and details. Records retain the
project, report slug, month, work date, status, author, and timestamp. Saving
a log does not publish or overwrite an existing client report page.

Checks: `node --test tests/client-work-log.test.mjs` and
`node scripts/test-mcp-oauth.mjs` cover duplicate handling, report data,
scope isolation, authenticated HTTP tool discovery and the global kill switch.
