import Header from "@/components/Header";
import Footer from "@/components/Footer";
import "./guest.css";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="guest-site">
      <Header />
      {/* Hero pages reclaim this clearance; other pages start below the floating nav. */}
      <div id="main-content" className="site-content flex-1 pt-14 md:pt-16">
        {children}
      </div>
      <Footer />
    </div>
  );
}
