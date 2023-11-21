import "./globals.css"
// Added to prevent fontawesome icons flashing huge
// https://fontawesome.com/v6/docs/web/use-with/react/use-with#getting-font-awesome-css-to-work
import { config } from "@fortawesome/fontawesome-svg-core"
import "@fortawesome/fontawesome-svg-core/styles.css"

config.autoAddCss = false

export default function MyApp({ Component, pageProps }) {
  return (
    <Component {...pageProps} />
  )
}