export const getFunnelUrl = (subDomainName: string, pathName?: string | null) => {
  const path = pathName ? `/${pathName.replace(/^\/+/, "")}` : "/";
  const isValidValue = (value?: string) => Boolean(
    value && !["undefined", "null", "your-domain.com"].includes(value.trim().toLowerCase())
  );

  if (typeof window !== "undefined") {
    const configuredDomain = isValidValue(process.env.NEXT_PUBLIC_DOMAIN)
      ? process.env.NEXT_PUBLIC_DOMAIN
      : undefined;
    const configuredScheme = isValidValue(process.env.NEXT_PUBLIC_SCHEME)
      ? process.env.NEXT_PUBLIC_SCHEME
      : undefined;
    const currentHost = window.location.hostname;
    const baseDomain = configuredDomain && configuredDomain !== "undefined"
      ? configuredDomain
      : currentHost.endsWith(".localhost")
        ? "localhost"
        : currentHost.split(".").length > 2
          ? currentHost.split(".").slice(1).join(".")
          : currentHost;
    const protocol = configuredDomain && configuredScheme
      ? `${configuredScheme}:`
      : window.location.protocol;
    const port = baseDomain === "localhost" && window.location.port
      ? `:${window.location.port}`
      : "";

    if (currentHost.endsWith(".vercel.app")) {
      return `${window.location.origin}/${subDomainName}${path}`;
    }

    if (baseDomain.endsWith(".vercel.app")) {
      return `${protocol}//${baseDomain}/${subDomainName}${path}`;
    }

    return `${protocol}//${subDomainName}.${baseDomain}${port}${path}`;
  }

  const scheme = (isValidValue(process.env.NEXT_PUBLIC_SCHEME)
    ? process.env.NEXT_PUBLIC_SCHEME
    : undefined) ?? "https";
  const domain = (isValidValue(process.env.NEXT_PUBLIC_DOMAIN)
    ? process.env.NEXT_PUBLIC_DOMAIN
    : undefined) ?? "localhost";
  const port = domain === "localhost" ? ":3000" : "";

  if (domain.endsWith(".vercel.app")) {
    return `${scheme}://${domain}/${subDomainName}${path}`;
  }

  return `${scheme}://${subDomainName}.${domain}${port}${path}`;
};

export const getFunnelPageHref = (href: string) => {
  if (typeof window === "undefined") return href || "/";

  const normalized = href ? (href.startsWith("/") ? href : `/${href}`) : "/";
  if (!window.location.hostname.endsWith(".vercel.app")) return normalized;

  const funnelSlug = window.location.pathname.split("/").filter(Boolean)[0];
  if (!funnelSlug) return normalized;

  return normalized === "/"
    ? `/${funnelSlug}/`
    : normalized.startsWith(`/${funnelSlug}/`) || normalized === `/${funnelSlug}`
      ? normalized
      : `/${funnelSlug}${normalized}`;
};
