# Codex implementation prompt: Leanne Digital conversational website editor

Implement and verify this project in the existing Leanne Digital website and existing MCP server. This is an implementation request, not just an architecture proposal. Inspect the repositories, applicable AGENTS.md instructions, content storage, rendering, authentication, MCP tools, media storage, and deployment workflow first. Reuse existing infrastructure where suitable. Do not assume the existing client/hosting database is already suitable for public website content. Preserve all client records, hosting fees, existing tools, and site behaviour.

## Goal

Use our own website as the first working implementation of a reusable conversational CMS for future client handoffs. Authorized users should be able to edit content, presentation, sections, media, and blog posts through natural-language requests resolved into precise MCP operations. Deliver working code, migrations, documentation, and verified examples. Do not claim that an MCP alone provides a user interface, language understanding, scheduling, or deployment: implement the necessary supporting services and identify the assistant's role.

## Content model and targeting

- Give pages, section instances, and editable blocks stable unique IDs independent of wording and position. Store readable labels, block types, ordering, editable fields, and allowed values.
- Provide tools to list pages, read their ordered section/block trees, search content, and inspect a target's current values, permissions, and revision.
- Return enough neighbouring context to identify a paragraph or button accurately. Resolve references such as “the paragraph under Our Services” and “fourth paragraph from the bottom” against the current page tree. Define counting rules explicitly; exclude header/footer by default when counting main-content paragraphs or sections.
- If a target or scope remains ambiguous, return candidates with existing text and request clarification before mutation. Do not silently choose between shared and instance styles.
- Keep IDs stable across moves and text edits. Adding copies creates new instance IDs. If practical, expose IDs in the rendered DOM for a future click-to-select editor.
- Use structured, validated content and style fields. Do not expose arbitrary code execution, raw SQL, unrestricted filesystem writes, or arbitrary CSS/JavaScript to client editing tools.

## Required editing capabilities

1. Update headings, paragraphs, lists, button labels, links, contact details, and other existing visible content. Support rich text through a defined safe schema.
2. Change semantic heading levels H1–H6 independently of visual typography. Support “change this H1 to H3”; preview heading hierarchy and accessibility/SEO implications rather than secretly changing unrelated headings.
3. Move whole sections before/after another section or to an explicit main-content position, including “second from the bottom.” Preserve section content, IDs, responsive behaviour, and anchored links. Prevent moves into incompatible regions.
4. Add, duplicate, hide/show, and remove supported predefined sections. Provide recoverable deletion. Start with existing site section types and document which templates support each operation.
5. Update foreground/text colours, background colours, button backgrounds, borders, and normal/hover/focus states. Use named brand tokens with exact stored values. Distinguish one component from all components using a shared style; global updates require explicit global scope.
6. Change text alignment left/centre/right and separately change container/content alignment where supported. Distinguish text alignment from flex/grid positioning. Support desktop/mobile overrides without accidental changes to other breakpoints.
7. Swap inline and featured images; update background images, focal point, crop/position, overlays, image fit, captions, and alt text where applicable. Preserve existing assets until no longer referenced. Decorative images must be representable without misleading alt text.
8. Expose approved font families, sizes, weights, line heights, spacing, padding, border radius, and supported layout variants through validated controls. Load fonts correctly; preserve responsive defaults.
9. Edit page SEO titles/descriptions and supported social images. Treat slug changes separately, with redirect handling and link/sitemap updates.

## Media and blog workflow

- Reuse existing media infrastructure, or add authenticated asset ingestion with type/size validation, safe filenames, metadata, and an asset picker/list/search capability. Support assistant-supplied uploads or accessible asset references; explain any attachment-transfer limitation instead of pretending to access files.
- Create a blog post from supplied title/body and multiple assets. Support featured image selection, ordered body blocks, exact image placement, captions/alt text, excerpt, author, categories/tags, slug, SEO fields, and social image.
- Save new posts as drafts by default. Support editing, preview, publishing, unpublishing, recoverable deletion, and scheduling only when a durable scheduler is implemented and verified. Store timezone-aware publish times; use America/Toronto for our default authoring timezone.
- Reuse the existing blog template or build one consistent with the site. Ensure published posts appear in listings and sitemaps; keep drafts private and out of public search indexes. Handle static builds/cache invalidation if applicable.

## Safe mutations, preview, publishing, and undo

- Implement read/inspect → prepare validated change set → preview diff/render → explicitly publish workflow. Draft updates may be immediate; production publication must be a distinct operation.
- Show before/after text, targets, scope, style changes, moves, and affected pages. Bind publication to the exact reviewed change set and revision, preventing stale preview publication.
- Use revision checks to prevent concurrent overwrites, idempotency keys for retryable writes, and atomic updates for related operations. Return structured errors without partial silent success.
- Record actor, timestamp, target, before/after values, revision, and publish state. Provide history, undo, and restoration of a selected revision. Undo must detect conflicts and must not overwrite somebody else's newer work silently.
- Enforce authentication, site scoping, and per-operation permissions server-side. Prepare for future client isolation. Clients must never access our internal client/hosting records through the website-editor tools.
- Validate rendered output and readable foreground/background contrast for changed states. Flag issues specifically and suggest fixes. Avoid breaking navigation, forms, tracking, accessibility, or responsive layout.
- Use the existing deployment architecture: content may update dynamically or require a build. Report success only after the actual publish/build/cache work succeeds. Retain a recoverable previous version.

## Discoverable client menu and handoff guide

- Provide a capabilities tool generated from the same registry/schemas/permission rules that implement the tools. Return only actions enabled for the current user and site, with allowed targets, restrictions, and example prompts.
- Group the client-facing menu into Text and headings; Images and backgrounds; Buttons and links; Colours and typography; Alignment and spacing; Page sections; Blog posts; SEO; Preview and publish; History and undo.
- Enable the assistant to answer “What can I change on my website?” from current capability data. Do not rely only on a static document that can drift from implementation.
- Produce a concise handoff guide with examples and a clear explanation of drafts versus live changes. If the site already has a suitable authenticated dashboard, add the menu there with example actions. Do not build a separate chat application solely to satisfy this prototype.

## Implementation approach

Inspect first, then make the smallest coherent implementation that covers the requested editing categories. Migrate existing content without visual regressions. Do not replace the entire site, redesign it, or rebuild the existing MCP unnecessarily. If content is hardcoded, introduce a typed editable model and rendering adapters incrementally. Keep layout code and approved section templates under developer control.

Suggested logical tools (adapt names to existing conventions): editor_capabilities, list_pages, get_page_structure, find_content, inspect_target, list_assets, ingest_asset, prepare_changes, preview_changes, apply_draft_changes, publish_changes, list_revisions, restore_revision, create_blog_draft, update_blog_post, schedule_blog_post. Prefer a small coherent surface with explicit operation schemas over dozens of overlapping tools. Define the lifecycle so preparing, saving drafts, previewing, and publishing have unambiguous meanings.

Complete work in a branch or isolated checkout and use a private preview/staging deployment for the prototype. Do not publish test edits to the live site or expose drafts publicly. Ask only for genuinely missing access or an unresolved consequential decision after exhausting available repository context. If production deployment needs approval, finish the reviewable implementation and preview first.

## Acceptance scenarios

Exercise through the actual MCP interface with authenticated calls and verify the rendered preview, not only database writes:

- Update homepage hero heading and the first introductory paragraph.
- Change a selected heading from H1 to H3; verify the HTML tag and independent visual style.
- Resolve a paragraph by relative position and show the exact target; exercise ambiguous-target clarification.
- Move testimonials to second from the bottom of main content; verify order and stable IDs.
- Change one button to brand red, then set a white hover background with readable red text and a visible keyboard focus state; verify other buttons remain unchanged.
- Swap an image, replace a section background, and update alt text/focal point.
- Set a supported section's text alignment left, centre, then right; verify desktop/mobile behaviour and explain the scope.
- Create a draft blog post containing three supplied/test assets, set one as featured, and move a body image below a specified heading.
- Preview and publish only in an isolated test environment; verify the post listing and sitemap. If scheduling is implemented, verify the durable scheduling path with a controlled test.
- Undo an edit, reject a stale revision, retry a request without duplication, and reject an unauthorized cross-site or internal-record access attempt.
- Verify the capability menu matches implemented actions and user permissions.

Run appropriate unit/integration checks for validation, authorization, ordering, revisions, and publication. Perform desktop/mobile browser checks of changed pages and check existing forms/navigation/tracking for regressions. Keep test content out of production.

## Deliverables and completion report

Provide implemented code and migrations; MCP tool schemas and examples; a concise client handoff guide; developer notes on adding section types/fields; a reviewable preview; validation results; and exact limitations or blockers. Clearly distinguish implemented and verified capabilities from proposed future features. Include where persistent content/media live, whether publishing requires a rebuild, how rollback works, and what is needed to connect the assistant to the updated MCP. Do not estimate that this is trivial solely because an MCP already exists.
