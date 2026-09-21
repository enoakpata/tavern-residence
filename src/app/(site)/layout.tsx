import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      {/* Header is fixed (out of flow) everywhere, so every page needs
          this padding to clear it — pt-16/pt-20 exactly matches the
          header's own h-16/h-20 row. The homepage's hero cancels this
          back out with a matching -mt-16/-mt-20 of its own, since it
          wants the header floating transparently over its photo instead;
          every other page just needs the clearance. */}
      <div className="flex-1 pt-16 md:pt-20">{children}</div>
      <Footer />
    </>
  );
}
