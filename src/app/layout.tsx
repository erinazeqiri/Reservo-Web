import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Reservo — Rezervo më lehtë",
  description: "Zbulo shërbime lokale dhe rezervo takimin tënd me lehtësi.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="sq"><body>{children}</body></html>;
}
