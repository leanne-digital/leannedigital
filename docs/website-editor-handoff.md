# Editing your website with your assistant

See [connection setup and current verification limits](website-editor-connections.md). Production/client ChatGPT activation is pending; the private protocol tests pass. Once connected, ask **“What can I change on my website?”**
The answer comes from your actual site permissions and enabled tools. Your agency can
provide viewer, editor, or publisher access. The editor connection contains website
content only, not agency client records, credentials, hosting prices, or billing.

## Things to try

| Area | Example request |
| --- | --- |
| Text | “Replace the first paragraph under Our Services with this text.” |
| Headings | “Change this H1 to H3, keeping its visual size.” |
| Lists and FAQs | “Update these bullet points” or “Add an FAQ section at the bottom.” |
| Buttons | “Change this button’s label and link. Open the link in a new tab.” |
| Images | “Use this photo here, centre the crop, and set this alt text.” |
| Backgrounds | “Replace this section’s background and add a darker overlay.” |
| Appearance | “Make only this button red, with white text and a white hover background.” |
| Mobile | “Centre this section’s text on mobile; keep desktop unchanged.” |
| Sections | “Move testimonials to second from the bottom,” “Duplicate this section,” or “Hide it.” |
| New pages | “Create a draft service page using the approved text template.” |
| Blog posts | “Create a draft article with these three photos. Use the first as the cover.” |
| Image placement | “Move this article image below the second heading.” |
| SEO | “Update this page’s search title and description.” |
| URLs | “Rename this page’s URL and redirect the old address.” |
| Undo | “Show the change history and prepare a draft restoring revision 4.” |

If several paragraphs match your request, the assistant should show the candidates
and ask which you mean. Paragraph positions count visible main-content paragraphs,
list items, quotations and FAQ summaries, from one. Header/footer content is excluded
unless you ask for that region. Section positions count direct main-content sections.

An **instance** change affects one selected item. A **shared** style change affects
all items of that type on your site (for example, every button). Ask explicitly for
a shared change only when that is what you want. Colours and fonts come from your
agency-approved list; your assistant can show the exact stored colour values.

## Drafts and publishing

1. Ask for your change. The assistant inspects the current page and prepares it.
2. Review the before/after details and private rendered preview.
3. Save it as a draft. The current live website is unaffected.
4. Review the saved draft. A publisher can explicitly publish the exact version reviewed.

**This prototype publishes to private staging only.** Your agency activates the
production serving/deployment adapter before client self-publishing goes live. The
private preview disables forms, analytics calls and external embeds so test actions
do not create customer submissions or tracking events.

New pages and posts start as drafts. To include a new page or post in a release, ask
to mark it published in the reviewed change set. Unpublishing keeps its content and
history. Deleted sections are recoverable; old images and previous releases are kept.
If someone edits while you are reviewing, publishing stops and requires a new review.

## Ask the agency for these changes

New layouts or section types, navigation structure, form fields or integrations,
checkout/payment features, scripts, new fonts, domain changes, third-party embeds,
and major site restructuring remain agency work. You can edit existing navigation
link text/destinations, but cannot rebuild the menu through this editor.

Scheduling is implemented and verified in private staging. A publisher can schedule or reschedule a reviewed saved blog post, list its schedule, or cancel it. Use America/Toronto and the correct explicit UTC offset. Editing a scheduled post requires a new review. A past displayed publication date only changes the date shown; it never publishes automatically. Past scheduled times are rejected. To take a published post back to draft, prepare that state change, review it and publish the removal. Republish through the same reviewed workflow.
Image uploads support PNG, JPEG and WebP up to 5 MB; uploads are re-encoded as WebP.
SVG, documents, arbitrary URLs and executable files are not accepted by the upload tool.
The assistant needs the actual attachment bytes or an existing site asset ID; a
filename in a chat alone does not provide upload access.

Open the authenticated **Website editor** menu for example requests, enabled pages,
and recent changes. The assistant understands your natural-language requests; the
MCP itself provides the precise, permission-checked operations.

Image editing also supports approved aspect ratios, fit and focal-point placement.
Agency-approved section templates support stacked or two-column layout variants;
custom legacy section layouts remain agency-controlled.
