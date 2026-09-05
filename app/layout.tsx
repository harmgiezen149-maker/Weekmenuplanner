import type { Metadata, Viewport } from "next";
import "./globals.css";
import ServiceWorker from "@/components/ServiceWorker";
import Chat from "@/components/Chat";

export const metadata: Metadata = {
  title: "Kookboek",
  description: "Receptendatabase, weekplanning en boodschappenlijst",
  // PWA: iOS gebruikt deze instellingen bij "Zet op beginscherm"
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Kookboek",
  },
  icons: {
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#f7f7f5",
  // Zorgt dat de app netjes doorloopt achter de statusbalk/notch als PWA
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl">
      <body>
        <ServiceWorker />
        {children}
        {/* Staat buiten {children} zodat de knop op elk scherm van allebei de
            helften meekomt; hij verbergt zichzelf op het loginscherm. */}
        <Chat />
      </body>
    </html>
  );
}
