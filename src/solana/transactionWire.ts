import {
  compileTransaction,
  getBase64EncodedWireTransaction,
  type Base64EncodedWireTransaction,
} from '@solana/kit'
import { getTransactionDecoder, getTransactionEncoder, type Transaction } from '@solana/transactions'

export const WALLET_TRANSACTION_MESSAGE_VERSION = 'legacy' as const

export type WalletTransactionMessageVersion = typeof WALLET_TRANSACTION_MESSAGE_VERSION

export type TransactionWireInfo = {
  messageVersion: WalletTransactionMessageVersion
  wireByteLength: number
  deserializerPath: 'solkit-getTransactionDecoder'
  firstWireByte: number
}

export type CompiledTransaction = ReturnType<typeof compileTransaction>

export function getTransactionWireBytes(transaction: CompiledTransaction): Uint8Array {
  return new Uint8Array(getTransactionEncoder().encode(transaction))
}

export function getTransactionWireBase64(transaction: CompiledTransaction): Base64EncodedWireTransaction {
  return getBase64EncodedWireTransaction(transaction)
}

export function decodeSignedWireTransaction(signedBytes: Uint8Array): Transaction {
  return getTransactionDecoder().decode(signedBytes)
}

export function createTransactionWireInfo(
  wireBytes: Uint8Array,
  messageVersion: WalletTransactionMessageVersion = WALLET_TRANSACTION_MESSAGE_VERSION,
): TransactionWireInfo {
  return {
    messageVersion,
    wireByteLength: wireBytes.length,
    deserializerPath: 'solkit-getTransactionDecoder',
    firstWireByte: wireBytes[0] ?? 0,
  }
}

export function supportsSignTransactionRpcFallback(
  wireInfo: TransactionWireInfo,
): boolean {
  return wireInfo.messageVersion === 'legacy'
}

export function extractSignedWireBytes(signedResult: unknown): Uint8Array {
  if (signedResult instanceof Uint8Array) {
    return signedResult
  }

  if (typeof signedResult === 'string') {
    return Uint8Array.from(atob(signedResult), (char) => char.charCodeAt(0))
  }

  const maybeSerialize = signedResult as {
    serialize?: (options?: {
      requireAllSignatures?: boolean
      verifySignatures?: boolean
    }) => Uint8Array
  }

  if (typeof maybeSerialize.serialize === 'function') {
    const serialized = maybeSerialize.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    })

    if (serialized instanceof Uint8Array) {
      return serialized
    }
  }

  throw new Error('Wallet returned an unsupported signed transaction format.')
}

export type WalletInputType = 'serialize-wrapper' | 'uint8array'

export type InjectedWalletSerializeWrapper = {
  serialize: (options?: {
    requireAllSignatures?: boolean
    verifySignatures?: boolean
  }) => Uint8Array
}

export function createInjectedWalletSerializeWrapper(
  wireBytes: Uint8Array,
): InjectedWalletSerializeWrapper {
  return {
    serialize: () => wireBytes,
  }
}

export function getWalletInputType(walletInput: unknown): WalletInputType {
  if (walletInput instanceof Uint8Array) {
    return 'uint8array'
  }

  if (
    typeof walletInput === 'object' &&
    walletInput !== null &&
    typeof (walletInput as InjectedWalletSerializeWrapper).serialize === 'function'
  ) {
    return 'serialize-wrapper'
  }

  return 'uint8array'
}
