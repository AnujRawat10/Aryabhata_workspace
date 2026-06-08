import "~/styles/globals.css";
import { type Metadata } from "next";
import { Providers } from "~/components/Providers";
import { Footer } from "~/components/Footer";

export const metadata: Metadata = {
  title: "Aryabhata Workspace",
  description: "Import, review, and triage research articles for systematic reviews.",
  icons: { icon: "/logo_Aryabhattaapp.png" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          {/* App-wide book decoration sitting behind all content. */}
          <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
            <img
              src="/open-book.png"
              alt=""
              className="absolute -bottom-12 -left-12 w-64 opacity-[0.12] md:w-96"
            />
            <img
              src="/digital-library.png"
              alt=""
              className="absolute -right-12 top-24 w-64 opacity-[0.12] md:w-96"
            />
          </div>

          <div className="flex min-h-screen flex-col">
            {/* Saffron (bhagwa) brand accent. */}
            <div className="h-1.5 w-full bg-saffron-500" />
            <div className="flex flex-1 flex-col">{children}</div>
            <Footer />
          </div>
        </Providers>
      </body>
    </html>
  );
}
