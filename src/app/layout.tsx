import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = "https://watch.shawnkanungo.com";
const TITLE = "Watch | Shawn Kanungo";
const DESCRIPTION =
  "Watch every keynote talk, AI demo, and behind-the-scenes video from Shawn Kanungo — US & Global Innovation Keynote Speaker.";
// Reuses the main site's existing headshot so social previews stay
// consistent with shawnkanungo.com rather than introducing a new image.
const OG_IMAGE =
  "http://static1.squarespace.com/static/63cf6dd541b6963c2bdb514b/t/63d030397f28e55cef72e4a0/1674588217611/_NV93167.JPG?format=1500w";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: "Shawn Kanungo",
    type: "website",
    images: [{ url: OG_IMAGE, width: 1500, height: 1000 }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: [OG_IMAGE],
  },
};

export const viewport: Viewport = {
  themeColor: "#141414",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
