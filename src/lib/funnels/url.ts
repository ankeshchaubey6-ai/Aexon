export const getFunnelUrl = (subDomainName: string, pathName?: string | null) => {
  const path = pathName ? `/${pathName.replace(/^\/+/, "")}` : "/";

  if (typeof window !== "undefined") {
    const configuredDomain = process.env.NEXT_PUBLIC_DOMAIN;
    const currentHost = window.location.hostname;
    const baseDomain = configuredDomain && configuredDomain !== "undefined"
      ? configuredDomain
      : currentHost.endsWith(".localhost")
        ? "localhost"
        : currentHost.split(".").length > 2
          ? currentHost.split(".").slice(1).join(".")
          : currentHost;
    const protocol = configuredDomain && process.env.NEXT_PUBLIC_SCHEME
      ? `${process.env.NEXT_PUBLIC_SCHEME}:`
      : window.location.protocol;
    const port = baseDomain === "localhost" && window.location.port
      ? `:${window.location.port}`
      : "";

    return `${protocol}//${subDomainName}.${baseDomain}${port}${path}`;
  }

  const scheme = process.env.NEXT_PUBLIC_SCHEME || "https";
  const domain = process.env.NEXT_PUBLIC_DOMAIN || "localhost";
  const port = domain === "localhost" ? ":3000" : "";
  return `${scheme}://${subDomainName}.${domain}${port}${path}`;
};
