import registry from "./components.json" assert { type: "json" };
import { aliases } from "./aliases.js";

const semanticCategoryByComponent = {
  Navbar: "nav", NavbarCentered: "nav", NavbarMinimal: "nav", NavbarWithCTA: "nav", MegaMenu: "nav", SidebarNav: "nav",
  Hero: "hero", HeroSplit: "hero", HeroCentered: "hero", HeroWithImage: "hero", HeroWithVideo: "hero", HeroAnimated: "hero",
  Features: "features", FeaturesGrid: "features", FeaturesIcons: "features", FeaturesAlternating: "features", FeaturesTabs: "features",
  Pricing: "pricing", PricingCards: "pricing", PricingTable: "pricing", PricingToggle: "pricing", PricingComparison: "pricing",
  Testimonials: "testimonials", TestimonialsGrid: "testimonials", TestimonialsCarousel: "testimonials", TestimonialsWall: "testimonials",
  CTA: "cta", CTABanner: "cta", CTACentered: "cta", CTANewsletter: "cta", CTAWithImage: "cta",
  ContactForm: "form", LeadCaptureForm: "form", NewsletterForm: "form", MultiStepForm: "form", SurveyForm: "form",
  Gallery: "gallery", GalleryMasonry: "gallery", GalleryCarousel: "gallery", ImageLightbox: "gallery",
  Blog: "blog-list", BlogGrid: "blog-list", BlogList: "blog-list", BlogPost: "blog-list",
  FAQ: "faq", FAQAccordion: "faq", FAQSearch: "faq",
  Team: "team", TeamGrid: "team", TeamCarousel: "team",
  Stats: "stats", StatsGrid: "stats", StatsAnimated: "stats", CounterSection: "stats", StatsCards: "stats",
  Footer: "footer", FooterSimple: "footer", FooterMultiColumn: "footer", FooterDark: "footer",
};

function humanize(name) {
  return name.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
}

function buildComponentMeta(name, category) {
  const semanticCategory = semanticCategoryByComponent[name] ?? "custom";
  return {
    name,
    category,
    semanticCategory,
    importPath: `${category}/${name}`,
    description: `${humanize(name)} component from the Aexon component pool`,
    tags: [semanticCategory, category, ...humanize(name).split(/\s+/)],
    props: [],
    slots: [],
    variants: [],
    examples: [],
    designTokens: [],
    version: registry.version,
  };
}

const componentMetadata = Object.entries(registry.categories).flatMap(
  ([category, names]) => names.map((name) => buildComponentMeta(name, category))
);

const loadedRegistry = {
  version: registry.version,
  generatedAt: registry.generated ?? "restored-from-components.json",
  components: componentMetadata,
};

/** Resolve a component name (including aliases) to its canonical form */
export function resolveComponent(name) {
  const canonical = aliases[name.toLowerCase().trim()] ?? name;
  return canonical;
}

/** Get all components required for a given site type */
export function getSiteTemplate(type) {
  return registry.siteTypes[type] ?? null;
}

/** Get all component names in a category */
export function getCategory(cat) {
  return registry.categories[cat] ?? [];
}

/** Check if a component exists in the registry */
export function hasComponent(name) {
  const resolved = resolveComponent(name);
  return Object.values(registry.categories).flat().includes(resolved);
}

/** Load the normalized registry used by the AI Builder pipeline. */
export function loadRegistry() {
  return loadedRegistry;
}

/** Return the registry version persisted with generated projects. */
export function getRegistryVersion() {
  return loadedRegistry.version;
}

/** Find components by semantic or source registry category. */
export function getComponentsByCategory(category) {
  return loadedRegistry.components.filter(
    (component) =>
      component.semanticCategory === category ||
      component.category === category ||
      component.tags.includes(category)
  );
}

export default registry;
