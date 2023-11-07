import utilStyles from "../styles/utils.module.css"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faCircleNotch, faExternalLink } from "@fortawesome/free-solid-svg-icons"

export default function Message({ message }: {
  message?: { body: string, link?: string, showActivityIndicator?: boolean }
}) {
  return (
    <div>
      {message
        ? (
          <div>
            {message.showActivityIndicator
              ?
              <span className={utilStyles.messageActivityIndicator}><FontAwesomeIcon icon={faCircleNotch} spin /></span>
              : ""
            }
            <span className={utilStyles.messageBody}>{message.body}</span>
            {message.link
              ?
              <a href={message.link} target="_blank" rel="noopener noreferrer"><FontAwesomeIcon icon={faExternalLink} /></a>
              : ""
            }
          </div>
        )
        : "🚀"
      }
    </div>
  )
}
