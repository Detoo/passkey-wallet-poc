import { Service } from "typedi"
import { createPublicClient, http, PublicClient } from "viem"
import { baseGoerli } from "viem/chains"
import { Config } from "@/lib/service/config/Config"

@Service()
export class ViemService {
  publicClient!: PublicClient

  constructor(readonly config: Config) {
    this.publicClient = createPublicClient({
      transport: http(config.web3EndPt),
      chain: baseGoerli
    }) as PublicClient
  }
}
