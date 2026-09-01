import type { MetadataRoute } from "next";

/** nothing here is for the public, let alone a crawler */
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", disallow: "/" } };
}
