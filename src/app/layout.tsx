import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HardWord - Live Word Game",
  description: "Real-time word guessing game. Host creates events, players compete to guess words fastest!",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#0a0a0f] antialiased">
        <div className="min-h-screen flex flex-col">
          {children}
        </div>
      </body>
    </html>
  );
}
