import "./globals.css";
import Navigation from "@/components/Navigation";
import RealtimeToaster from "@/components/RealtimeToaster";

export const metadata = {
  title: "FlotaApp - Gestión Vehicular",
  description: "Sistema para la gestión de flota vehicular",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body className="app-layout">
        <Navigation>
          {children}
        </Navigation>
        <RealtimeToaster />
      </body>
    </html>
  );
}
