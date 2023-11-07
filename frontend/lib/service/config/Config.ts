import { Service } from "typedi"
import assert from "assert"

@Service()
export class Config {
  constructor(
    readonly web3EndPt: string,
    readonly pimlicoApiKey: string
  ) {
    //
    // load from env vars
    //

    assert(process.env.NEXT_PUBLIC_WEB3_ENDPT, "Environment variable not found: NEXT_PUBLIC_WEB3_ENDPT")
    this.web3EndPt = process.env.NEXT_PUBLIC_WEB3_ENDPT

    assert(process.env.NEXT_PUBLIC_PIMLICO_API_KEY, "Environment variable not found: NEXT_PUBLIC_PIMLICO_API_KEY")
    this.pimlicoApiKey = process.env.NEXT_PUBLIC_PIMLICO_API_KEY

    //
    // coded configs
    //
  }

  // Can't do this in next.js
  // getEnvVar(name: string, required = true) {
  //   if (required) {
  //     assert(process.env[name], `Environment variable not found: ${name}`)
  //   }
  //   return process.env[name]!
  // }
}
