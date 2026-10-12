import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppShell } from "@/components/app-shell";
import { PrefsProvider, themeBootScript } from "@/components/prefs";
import { SheetsProvider } from "@/components/sheets";
import { FinanceProvider } from "@/store/finance-store";

export const metadata: Metadata = {
  title: "NexVyra Finance",
  description: "Controle financeiro pessoal: saldo, cartões e previsão.",
  applicationName: "NexVyra Finance",
  appleWebApp: { capable: true, title: "NexVyra", statusBarStyle: "black-translucent" },
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#0b0c0f",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body className="antialiased">
        <PrefsProvider>
          <FinanceProvider>
            <SheetsProvider>
              <AppShell>{children}</AppShell>
            </SheetsProvider>
          </FinanceProvider>
        </PrefsProvider>
      </body>
    </html>
  );
}
