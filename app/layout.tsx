import type { Metadata } from "next";



import "./workspace.css";
import "./product.css";


export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://rainready-kc-junction.steady-hub-2026.workers.dev"),
  title: "RainReady — A clearer plan before the rain.",
  description: "RainReady turns visible street evidence and changing conditions into explainable inspection priorities, then verifies whether cleanup worked.",
  applicationName: "RainReady",
  keywords: ["environmental technology", "climate tech", "storm drains", "computer vision", "waterway protection", "smart cities"],
  authors: [{ name: "Team KC Junction" }],
  alternates: { canonical: "/" },
  openGraph: {
    title: "RainReady",
    description: "Identify blocked, litter-filled drains, add rainfall and waterway context, and verify cleanup with evidence.",
    type: "website",
    url: "/",
    images: [{ url: "/rainready-social.png", width: 1200, height: 630, alt: "RainReady — Smarter drainage decisions before the storm" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "RainReady",
    description: "Which drain should your crew inspect before the storm? Detect, prioritize, allocate, act, and verify cleanup with evidence.",
    images: ["/rainready-social.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
