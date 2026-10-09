import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fireflies — Meeting workspace",
  description: "A simple meeting notes and transcript project.",
};
export default function Layout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
