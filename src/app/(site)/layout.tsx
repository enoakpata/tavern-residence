import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Cormorant_Garamond, Inter } from "next/font/google";
import "./guest.css";

const primaryFont = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-primary",
  fallback: ["Georgia", "serif"],
});

const secondaryFont = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-secondary",
});

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`guest-site ${primaryFont.variable} ${secondaryFont.variable}`}>
      <Header />
      <div id="main-content" className="site-content flex-1">
        {children}
      </div>
      <Footer />
    </div>
  );
}
