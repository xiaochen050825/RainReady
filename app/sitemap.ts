import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [{
    url: (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
    lastModified: new Date("2026-08-15"),
    changeFrequency: "weekly",
    priority: 1,
  }];
}
