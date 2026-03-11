import { Inter } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import Header from "../components/Header/Header";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata = {
  title: "SpecialtyCrop Dashboard — USDA Market Prices",
  description:
    "Track specialty crop prices, market trends, and AI-powered insights from USDA data. Monitor terminal, shipping point, and retail prices for fruits, vegetables, and specialty crops.",
  keywords: [
    "specialty crops",
    "USDA",
    "crop prices",
    "market analysis",
    "agriculture",
  ],
  openGraph: {
    title: "SpecialtyCrop Dashboard",
    description: "Track specialty crop prices and market trends from USDA data.",
    type: "website",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <Providers>
          <Header />
          <main className="min-h-[calc(100dvh-var(--header-height))]">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
