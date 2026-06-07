import "~/styles/globals.css";
import { type Metadata } from "next";
import { Providers } from "~/components/Providers";

export const metadata: Metadata = {
  title: "Article Review Workspace",
  description: "Import, review, and triage research articles.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
