import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WatchParty",
  description: "Real-Time YouTube Watch Party System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
