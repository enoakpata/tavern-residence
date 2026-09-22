import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      {/* Header is fixed (out of flow) everywhere, so every page needs
          this padding to clear it — pt-14/pt-16 exactly matches the
          header's own h-14/h-16 row. The homepage's hero cancels this
          back out with a matching -mt-14/-mt-16 of its own, since it
          wants the header floating transparently over its photo instead;
          every other page just needs the clearance. */}
      <div className="flex-1 pt-14 md:pt-16">{children}</div>
      <Footer />
    </>
  );
}
