import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Reservo — Book better",
  description: "A simpler way to discover and book great local services.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
