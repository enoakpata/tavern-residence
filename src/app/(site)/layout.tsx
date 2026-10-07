import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Abril_Fatface, IM_Fell_French_Canon } from "next/font/google";
import "./guest.css";

const primaryFont = Abril_Fatface({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  variable: "--font-primary",
  fallback: ["Georgia", "serif"],
});

const secondaryFont = IM_Fell_French_Canon({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-secondary",
});

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`guest-site ${primaryFont.variable} ${secondaryFont.variable}`}>
      <Header />
      {/* Hero pages reclaim this clearance; other pages start below the floating nav. */}
      <div id="main-content" className="site-content flex-1 pt-14 md:pt-16">
        {children}
      </div>
      <Footer />
    </div>
  );
}
