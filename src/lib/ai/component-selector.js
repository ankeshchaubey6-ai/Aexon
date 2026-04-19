import { resolveComponent, getSiteTemplate, hasComponent } from "../../lib/component-pool/registry/index.js";

/**
 * Given a user prompt, returns the list of components and layout to use.
 * This is called by the stream pipeline before generating code.
 */
export async function selectComponents(prompt) {
  const lower = prompt.toLowerCase();

  // Detect site type
  let siteType = "landing";
  if (/dashboard|admin|analytics|back[\s-]?office/.test(lower))   siteType = "dashboard";
  else if (/e[\s-]?commerce|shop|store|product|cart|checkout/.test(lower)) siteType = "ecommerce";
  else if (/blog|article|news|publication/.test(lower))            siteType = "blog";
  else if (/portfolio|showcase|personal/.test(lower))              siteType = "portfolio";
  else if (/saas|software|platform|subscription/.test(lower))      siteType = "saas";
  else if (/auth|sign[\s-]?in|login|register|sign[\s-]?up/.test(lower)) siteType = "auth";
  else if (/docs|documentation|knowledge[\s-]?base|guide/.test(lower))  siteType = "docs";
  else if (/startup|waitlist|coming[\s-]?soon/.test(lower))        siteType = "startup";

  const template = getSiteTemplate(siteType) ?? { required: ["Navbar","Hero","Footer"], optional: [] };

  // Extract any explicitly mentioned components
  const mentioned = [];
  for (const keyword of Object.keys({})) {
    if (lower.includes(keyword.toLowerCase())) {
      const resolved = resolveComponent(keyword);
      if (hasComponent(resolved)) mentioned.push(resolved);
    }
  }

  return {
    siteType,
    layout: siteType === "dashboard" ? "DashboardLayout" : siteType === "auth" ? "AuthLayout" : "LandingPage",
    required:  [...new Set([...template.required, ...mentioned])],
    optional:  template.optional,
    theme:     /dark|night|dark[\s-]?mode/.test(lower) ? "dark" : "light",
    colorScheme: /blue|indigo/.test(lower) ? "blue" : /green|emerald/.test(lower) ? "green" : /violet|purple/.test(lower) ? "violet" : "blue",
  };
}
