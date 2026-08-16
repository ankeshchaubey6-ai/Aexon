import registryJson from "./components.json";
import { aliases } from "./aliases";

import type { ComponentMeta, ComponentRegistry } from "./types";

type LegacyRegistry = {
  version: string;
  generated?: string;
  categories: Record<string, string[]>;
  siteTypes: Record<string, { required: string[]; optional: string[] }>;
};

const legacyRegistry = registryJson as LegacyRegistry;

const semanticCategoryByComponent: Record<string, string> = {
  Navbar: "nav",
  NavbarCentered: "nav",
  NavbarMinimal: "nav",
  NavbarWithCTA: "nav",
  MegaMenu: "nav",
  SidebarNav: "nav",
  Hero: "hero",
  HeroSplit: "hero",
  HeroCentered: "hero",
  HeroWithImage: "hero",
  HeroWithVideo: "hero",
  HeroAnimated: "hero",
  Features: "features",
  FeaturesGrid: "features",
  FeaturesIcons: "features",
  FeaturesAlternating: "features",
  FeaturesTabs: "features",
  Pricing: "pricing",
  PricingCards: "pricing",
  PricingTable: "pricing",
  PricingToggle: "pricing",
  PricingComparison: "pricing",
  Testimonials: "testimonials",
  TestimonialsGrid: "testimonials",
  TestimonialsCarousel: "testimonials",
  TestimonialsWall: "testimonials",
  CTA: "cta",
  CTABanner: "cta",
  CTACentered: "cta",
  CTANewsletter: "cta",
  CTAWithImage: "cta",
  ContactForm: "form",
  LeadCaptureForm: "form",
  NewsletterForm: "form",
  MultiStepForm: "form",
  SurveyForm: "form",
  Gallery: "gallery",
  GalleryMasonry: "gallery",
  GalleryCarousel: "gallery",
  ImageLightbox: "gallery",
  Blog: "blog-list",
  BlogGrid: "blog-list",
  BlogList: "blog-list",
  BlogPost: "blog-list",
  FAQ: "faq",
  FAQAccordion: "faq",
  FAQSearch: "faq",
  Team: "team",
  TeamGrid: "team",
  TeamCarousel: "team",
  Stats: "stats",
  StatsGrid: "stats",
  StatsAnimated: "stats",
  CounterSection: "stats",
  Dashboard: "custom",
  DashboardSidebar: "custom",
  DashboardHeader: "custom",
  StatsCards: "stats",
  Footer: "footer",
  FooterSimple: "footer",
  FooterMultiColumn: "footer",
  FooterDark: "footer",
};

function inferSemanticCategory(name: string): string {
  return semanticCategoryByComponent[name] ?? "custom";
}

function humanize(name: string): string {
  return name.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
}

function buildComponentMeta(name: string, category: string): ComponentMeta {
  const semanticCategory = inferSemanticCategory(name);

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
    version: legacyRegistry.version,
  };
}

function buildRegistry(): ComponentRegistry {
  const components = Object.entries(legacyRegistry.categories).flatMap(
    ([category, names]) => names.map((name) => buildComponentMeta(name, category))
  );

  return {
    version: legacyRegistry.version,
    generatedAt: legacyRegistry.generated ?? "restored-from-components-json",
    components,
  };
}

const registry = buildRegistry();

export function loadRegistry(): ComponentRegistry {
  return registry;
}

export function getRegistryVersion(): string {
  return registry.version;
}

export function getComponentsByCategory(category: string): ComponentMeta[] {
  return registry.components.filter(
    (component) =>
      component.semanticCategory === category ||
      component.category === category ||
      component.tags.includes(category)
  );
}

export function resolveComponent(name: string): string {
  return (aliases as Record<string, string>)[name.toLowerCase().trim()] ?? name;
}

export function getSiteTemplate(type: string) {
  return legacyRegistry.siteTypes[type] ?? null;
}

export function getCategory(category: string): string[] {
  return legacyRegistry.categories[category] ?? [];
}

export function hasComponent(name: string): boolean {
  const resolved = resolveComponent(name);
  return registry.components.some((component) => component.name === resolved);
}

export default registry;
