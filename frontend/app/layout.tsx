import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
// Added to prevent fontawesome icons flashing huge
// https://fontawesome.com/v6/docs/web/use-with/react/use-with#getting-font-awesome-css-to-work
import { config } from "@fortawesome/fontawesome-svg-core"
import "@fortawesome/fontawesome-svg-core/styles.css"

config.autoAddCss = false

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Passkey Wallet PoC",
  description: "Sign Ethereum VM transactions gas-less with mobile phones"
}

export default function RootLayout({
                                     children
                                   }: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
    <body className={inter.className}>{children}</body>
    </html>
  )
}
