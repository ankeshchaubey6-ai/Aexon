/**
 * Injects selected component code into a page template string.
 * The AI pipeline calls this after component-selector runs.
 */
export function buildPageImports(componentNames) {
  return componentNames
    .map(name => {
      const cat = getCategoryForComponent(name);
      if (!cat) return null;
      return `import { ${name} } from '@/lib/component-pool/${cat}/${name}';`;
    })
    .filter(Boolean)
    .join("\n");
}

function getCategoryForComponent(name) {
  const catMap = {
    primitives: ["Button","Badge","Input","Card","Modal","Spinner","Avatar","Toast","Select","Checkbox","Radio","Switch","Toggle","Tabs","Accordion","Pagination","Breadcrumb","Stepper","DatePicker","FileUpload","SearchInput","CommandPalette","Rating","ColorPicker"],
    blocks: ["Navbar","Hero","Features","Pricing","Testimonials","CTA","ContactForm","SignIn","SignUp","Dashboard","StatsCards","ProductGrid","Blog","Gallery","LogoCloud","Team","FAQ","Stats","Footer","EmptyState","Waitlist","Changelog","DataTable","AnalyticsChart"],
    animations: ["FadeIn","CountUp","Typewriter","Marquee","Shimmer","Stagger","ScrollReveal","Parallax"],
    layouts: ["LandingPage","DashboardLayout","AuthLayout","DocsLayout","EcommerceLayout","BlogLayout"],
  };
  for (const [cat, names] of Object.entries(catMap)) {
    if (names.includes(name)) return cat;
  }
  return null;
}
