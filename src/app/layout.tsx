import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    title: "Ashera",
    description: "Mystical Health & Astrology Tracker",
    icons: {
        icon: "/icon.png",
        apple: "/icon.png",
    },
    manifest: "/manifest.json",
};

export const viewport = {
    themeColor: "#000000",
};

import { AuthProvider } from "@/context/AuthContext";

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" suppressHydrationWarning>
            <head>
                {/* Visual Cache Buster: User can see if they are on old version easily */}
                <meta name="version" content="v0.0.42" />
                {/* Aggressive Cache Control for Static Exports */}
                <meta httpEquiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
                <meta httpEquiv="Pragma" content="no-cache" />
                <meta httpEquiv="Expires" content="0" />
            </head>
            <body className={cn(inter.className, "min-h-screen bg-background antialiased")}>
                <AuthProvider>
                    {children}
                </AuthProvider>
            </body>
        </html>
    );
}
