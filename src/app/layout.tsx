import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

import { SearchCommand } from "@/components/layout/search-command";


import AppShell from "@/components/layout/app-shell";

export const metadata: Metadata = {
    title: "The CAM-DEN",
    description: "Club Management Hub",
    icons: {
        icon: "/logo-2.jpeg",
    }
};

export const viewport: Viewport = {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
};

import { ClubProvider } from "@/context/club-context";

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body className={inter.className}>
                <ClubProvider>
                    <AppShell>
                        {children}
                        <SearchCommand />
                    </AppShell>
                </ClubProvider>
                <script src="https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js"></script>
            </body>
        </html>
    );
}
