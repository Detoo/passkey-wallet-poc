"use client"

import "reflect-metadata" // this shim is required
import { Container } from "typedi"
import { useEffect, useMemo, useState } from "react"
import Big from "big.js"
import utilStyles from "../styles/utils.module.css"
import {
  Address,
  formatUnits,
  getAddress, Hash,
  isAddress
} from "viem"
import { useDebounce } from "use-debounce"
import { PasskeyAccountService, UserInfo } from "@/lib/service/passkey-account/PasskeyAccountService"
import Message from "@/components/message"

const DEBOUNCE_DELAY_MS = 500

export default function Home() {
  async function fetchAndSetUserInfo(userId: string) {
    if (userId.length > 0) {
      const accountService = Container.get(PasskeyAccountService)
      const newUserInfo = await accountService.getAccountInfo(userId)
      setUserInfo(newUserInfo)
    } else {
      setUserInfo(undefined)
    }
  }

  async function fetchAndSetUserAddress(userInfo: UserInfo | undefined, setter: any) {
    const accountService = Container.get(PasskeyAccountService)
    if (userInfo && userInfo.credentialId !== "0x") {
      const userAddress = await accountService.getAccountAddress(userInfo)
      setter(userAddress)
    } else {
      setter(undefined)
    }
  }

  async function fetchAndSetUserBalance(address: Address | undefined, setter: any) {
    if (!address) {
      setter(undefined)
      return
    }

    const accountService = Container.get(PasskeyAccountService)
    const balance = await accountService.testToken.read.balanceOf([address])
    const decimals = await accountService.testToken.read.decimals()

    setter(Big(formatUnits(balance, decimals)))
  }

  const useCreateAccount = (
    userId: string | undefined,
    onSuccess?: (userId: string, txHash: Hash) => void,
    onMutate?: () => void,
    onError?: (e: any) => void
  ) => {
    const write = useMemo(() => {
      if (userId) {
        async function helper() {
          const accountService = Container.get(PasskeyAccountService)
          try {
            if (onMutate) {
              onMutate()
            }
            const { txHash } = await accountService.createAccount(userId!)
            if (onSuccess) {
              onSuccess(userId!, txHash)
            }
          } catch (e: any) {
            if (onError) {
              console.error({ error: e })
              onError(e)
            }
          }
        }

        return () => helper().catch(e => console.error("[useCreateAccount] Unexpected error:", e))
      } else {
        return undefined
      }
    }, [userId, onSuccess, onMutate, onError])

    return { write }
  }

  const useTransfer = (
    userInfo: UserInfo | undefined,
    destAddress: Address | undefined,
    amount: Big | undefined,
    onSuccess?: (from: Address, to: Address, txHash: Hash) => void,
    onMutate?: () => void,
    onError?: (e: any) => void
  ) => {
    const write = useMemo(() => {
      if (userInfo && destAddress && amount) {
        async function helper() {
          const accountService = Container.get(PasskeyAccountService)
          try {
            if (onMutate) {
              onMutate()
            }
            const { from, to, txHash } = await accountService.transfer(userInfo!, destAddress!, amount!)
            if (onSuccess) {
              onSuccess(from, to, txHash)
            }
          } catch (e: any) {
            if (onError) {
              console.error({ error: e })
              onError(e)
            }
          }
        }

        return () => helper().catch(e => console.error("[useTransfer] Unexpected error:", e))
      } else {
        return undefined
      }
    }, [userInfo, destAddress, amount, onSuccess, onMutate, onError])

    return { write }
  }

  function parseSigningError(e: any) {
    if (e.cause.message.includes("Invalid UserOp signature")) {
      return { body: `🙅 Invalid signature. Did you choose the correct passkey?` }
    } else if (e.cause.message.includes("AA31 paymaster deposit too low")) {
      return { body: `⛽️ Uh we're out of gas. It should be refilled in a few minutes. Please try again later.` }
    } else {
      return { body: `Unexpected failure, reason: ${e.toString()}` }
    }
  }

  const [userInfo, setUserInfo] = useState<UserInfo | undefined>(undefined)
  const [userId, setUserId] = useState<string>("")
  const [userAddress, setUserAddress] = useState<Address | undefined>(undefined)
  const [userBalance, setUserBalance] = useState<Big | undefined>(undefined)
  const [destKey, setDestKey] = useState<string>("")
  const [destAddress, setDestAddress] = useState<Address | undefined>(undefined)
  const [destBalance, setDestBalance] = useState<Big | undefined>(undefined)
  const [amountStr, setAmountStr] = useState<string>("")
  const [message, setMessage] = useState<{
    body: string,
    link?: string,
    showActivityIndicator?: boolean
  } | undefined>(undefined)

  const [debouncedUserId] = useDebounce(userId, DEBOUNCE_DELAY_MS)
  const [debouncedDestKey] = useDebounce(destKey, DEBOUNCE_DELAY_MS)

  const amount = useMemo(() => {
    try {
      return Big(amountStr)
    } catch {
      return undefined
    }
  }, [amountStr])

  const { write: createAccount } = useCreateAccount(
    userInfo?.id,
    (userId, txHash) => {
      fetchAndSetUserInfo(userId).finally()
      setMessage({ body: "Tx written on block!", link: `https://goerli.basescan.org/tx/${txHash}` })
    },
    () => setMessage({ body: "Pending...", showActivityIndicator: true }),
    (e: any) => setMessage(parseSigningError(e))
  )
  const { write: transfer } = useTransfer(
    userInfo, destAddress, amount,
    (from, to, txHash) => {
      fetchAndSetUserBalance(from, setUserBalance).finally()
      fetchAndSetUserBalance(to, setDestBalance).finally()
      setMessage({ body: "Tx written on block!", link: `https://goerli.basescan.org/tx/${txHash}` })
    },
    () => setMessage({ body: "Pending...", showActivityIndicator: true }),
    (e: any) => setMessage(parseSigningError(e))
  )

  // Update user account info
  useEffect(() => {
    fetchAndSetUserInfo(debouncedUserId).catch(e => console.error("Unable to check user account created:", e))
  }, [debouncedUserId])

  // Update user address
  useEffect(() => {
    fetchAndSetUserAddress(userInfo, setUserAddress).catch(e => console.error("Unable to update user address", e))
  }, [userInfo])

  // Update dest user address
  useEffect(() => {
    async function helper() {
      if (isAddress(debouncedDestKey)) {
        setDestAddress(getAddress(debouncedDestKey))
      } else {
        const accountService = Container.get(PasskeyAccountService)
        const destUserInfo = await accountService.getAccountInfo(debouncedDestKey)
        await fetchAndSetUserAddress(destUserInfo, setDestAddress)
      }
    }

    helper().catch(e => console.error("Unable to update dest user address", e))
  }, [debouncedDestKey])

  useEffect(() => {
    fetchAndSetUserBalance(userAddress, setUserBalance).catch(e => console.error("Error fetching user balance:", e))
  }, [userAddress])

  useEffect(() => {
    fetchAndSetUserBalance(destAddress, setDestBalance).catch(e => console.error("Error fetching dest user balance:", e))
  }, [destAddress])

  useEffect(() => {
    let unwatch: any
    if (userAddress) {
      const accountService = Container.get(PasskeyAccountService)
      unwatch = accountService.testToken.watchEvent.Transfer(
        { to: userAddress },
        {
          onLogs: logs => {
            fetchAndSetUserBalance(userAddress, setUserBalance).catch(e => console.error("Error fetching user balance:", e))
          }
        }
      )
    }

    return () => {
      if (unwatch) {
        unwatch()
      }
    }
  }, [userAddress])

  return (
    <main>
      {!userInfo || userInfo.credentialId === "0x" ? (
        <div className={`flex min-h-screen flex-col items-center justify-between ${utilStyles.inputForm}`}>
          <input type="text" placeholder="User ID" value={userId}
                 onChange={e => setUserId(e.target.value)} />
          <button disabled={!userInfo} onClick={createAccount}>
            Create Account
          </button>
          <Message message={message} />
        </div>
      ) : (
        <div className={`flex min-h-screen flex-col items-center justify-between ${utilStyles.inputForm}`}>
          <input type="text" placeholder="User ID" value={userId}
                 onChange={e => setUserId(e.target.value)} />
          <div>
            <p>{userAddress ?? "unknown"}</p>
            <p>has {userBalance ? userBalance.toFixed() : "n/a"} tokens</p>
          </div>
          <input type="text" placeholder="Send to" value={destKey}
                 onChange={e => setDestKey(e.target.value)} />
          <div>
            <p>{destAddress ?? "unknown"}</p>
            <p>has {destBalance ? destBalance.toFixed() : "n/a"} tokens</p>
          </div>
          <input type="text" placeholder="Amount" value={amountStr}
                 onChange={e => setAmountStr(e.target.value)} />
          <button disabled={!transfer} onClick={transfer}>
            Send
          </button>
          <Message message={message} />
        </div>
      )}
    </main>
  )
}
