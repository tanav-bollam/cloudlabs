import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CloudLabs Personalizer",
  description: "Customize packaging with real-time previews"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/line-awesome/1.3.0/line-awesome/css/line-awesome.min.css"
        />
      </head>
      <body className="min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
