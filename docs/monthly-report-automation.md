# Monthly SEO reports

The client/package setting `monthlyReportEnabled` is a strict boolean exposed as
Monthly SEO report: Yes / No in the client editor. Existing services, amounts and
billing cycles are independent. Initially enabled for Sierra Electrical, Shift
Physiotherapy, Oatley Vigmond, Melissa Jean Art, GBT Logistics and Davis Window & Door.

The Codex heartbeat automation `create-monthly-client-seo-reports` is scheduled for
08:00 America/New_York on the first of each month. It runs the deployed deterministic
generator over SSH. It is a Codex automation, not a webserver cron task.

```sh
node /opt/sites/leannedigital/scripts/generate-monthly-reports.mjs --apply --publish-root=/home/leannedigital.com/public_html
```

Without `--apply`, the generator is a dry run. `--month=YYYY-MM` can select an earlier
completed month; the current or a future month is rejected. It reads the work-log
database configured by the existing source `.env`, using the same location as MCP.
Only active, shared clients with the monthly flag set to true are generated.

The shared renderer supplies the existing report layout and client-specific heading,
description and project cover. Completed database entries populate categorized work
tables. Pending and awaiting-client work populates Next steps, retaining status.
Previous-month results, metrics, screenshots and downloads are not carried forward.
Missing monthly audit, keyword and ads assets stay explicitly pending. Each new report
includes a source work-log snapshot and automation metadata for review.

Reports already present by month or canonical slug are preserved, including manually
edited reports and older custom slugs. A directory lock prevents overlapping runs.
An interrupted build can resume from its incomplete automation record once a stale
lock has been investigated. Never remove a lock while another generator is running.
Only new report files are rendered/published: historical pages and the workspace
are not rebuilt. Report registry updates expose the new report in Client reports.

Work-log category is now required for new entries. The MCP tool description instructs
the assistant to clarify ambiguous categories and split mixed work when appropriate.
Categories include Content creation, AEO, GEO, Technical SEO, Site updates, Website
development, Marketing, Strategy, Bug fixes, Internal linking, Paid ads, Conversion
tracking, Analytics, Site maintenance, Graphic design, Consultation and Other.
Legacy entries retain their data and display Needs categorization. They are never
silently reclassified or omitted from completed-work reporting.

For deployments with the separately installed Google Platforms connector, run
`node scripts/update-google-work-categories.mjs /opt/sites/leannedigital` to add the
same required category to its verified-work logging tool. It does not change Google
account configuration, campaigns or operations.

Validation: `node tests/monthly-reports.test.mjs` uses an isolated temporary dataset.
It checks validation, categories, pending-work separation, HTML escaping, billing
preservation, toggles, idempotency, existing reports, publication and year/timezone
rollover. Browser checks cover the saved Yes/No field, mobile layout, categorized
Client Work and JSON export. The initial October 2026 production run preserved all
six existing reports. The first new scheduled reporting month is November 2026,
generated on December 1, 2026.
