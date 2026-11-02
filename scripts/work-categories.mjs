export const WORK_CATEGORIES = {
 'content-creation':'Content creation', aeo:'AEO', geo:'GEO', 'technical-seo':'Technical SEO',
 'site-updates':'Site updates', 'website-development':'Website development', marketing:'Marketing',
 strategy:'Strategy', 'bug-fixes':'Bug fixes', 'internal-linking':'Internal linking',
 'paid-ads':'Paid ads', 'conversion-tracking':'Conversion tracking', analytics:'Analytics',
 'site-maintenance':'Site maintenance', 'graphic-design':'Graphic design', consultation:'Consultation', other:'Other'
};
export const categoryLabel = value => WORK_CATEGORIES[value] || 'Needs categorization';
export function monthlyReportFlag(value) {
 if(typeof value!=='boolean')throw Object.assign(new Error('Monthly report must be Yes or No'),{status:400});
 return value;
}
