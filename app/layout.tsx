import type { Metadata } from "next"
import { Inter, Anuphan } from "next/font/google"
import "./globals.css"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/sonner"
import {
    APP_METADATA_TEMPLATE,
    APP_METADATA_TITLE,
    APP_TAGLINE,
} from "@/lib/brand"

const inter = Inter({
    variable: "--font-inter",
    subsets: ["latin"],
})

const anuphan = Anuphan({
    variable: "--font-anuphan",
    subsets: ["thai", "latin"],
})

export const metadata: Metadata = {
    title: {
        default: APP_METADATA_TITLE,
        template: APP_METADATA_TEMPLATE,
    },
    description: APP_TAGLINE,
    keywords: ["Smart Electronic", "Dashboard", "Sales", "LINE", "AI"],
}

export const viewport = {
    width: "device-width",
    initialScale: 1,
    maximumScale: 5,
    viewportFit: "cover",
}

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode
}>) {
    return (
        <html lang="th" suppressHydrationWarning>
            <body className={`${inter.variable} ${anuphan.variable} font-sans antialiased`}>
                <TooltipProvider>{children}</TooltipProvider>
                <Toaster />
            </body>
        </html>
    )
}
