import {
  appendTransactionMessageInstructions,
  compileTransaction,
  createTransactionMessage,
  pipe,
  sendAndConfirmTransactionFactory,
  setTransactionMessageLifetimeUsingBlockhash,
  type Instruction,
} from '@solana/kit'
import type { Signature } from '@solana/keys'
import {
  setTransactionMessageFeePayerSigner,
  signTransactionMessageWithSigners,
  type KeyPairSigner,
} from '@solana/signers'
import type { Blockhash } from '@solana/rpc-types'
import type { TransactionWithLastValidBlockHeight } from '@solana/transaction-confirmation'
import {
  assertIsTransactionWithBlockhashLifetime,
  getSignatureFromTransaction,
  type SendableTransaction,
  type Transaction,
} from '@solana/transactions'

import {
  getTransactionWireBase64,
  WALLET_TRANSACTION_MESSAGE_VERSION,
} from '../../src/solana/transactionWire.ts'

import { getPhase0Rpc, getPhase0RpcSubscriptions, loadPhase0Signer } from './proof-env.ts'

export type Phase0BlockhashInfo = {
  blockhash: Blockhash
  lastValidBlockHeight: bigint
  fetchedAtMs: number
}

export type Phase0SendOptions = {
  commitment?: 'processed' | 'confirmed' | 'finalized'
  skipPreflight?: boolean
}

export type Phase0CompiledTransaction = {
  transactionMessage: ReturnType<typeof buildPhase0TransactionMessage>
  blockhashInfo: Phase0BlockhashInfo
}

let cachedSendAndConfirm: ReturnType<typeof sendAndConfirmTransactionFactory> | null = null

function getPhase0SendAndConfirm() {
  if (!cachedSendAndConfirm) {
    cachedSendAndConfirm = sendAndConfirmTransactionFactory({
      rpc: getPhase0Rpc(),
      rpcSubscriptions: getPhase0RpcSubscriptions(),
    })
  }

  return cachedSendAndConfirm
}

export async function fetchPhase0BlockhashInfo(): Promise<Phase0BlockhashInfo> {
  const rpc = getPhase0Rpc()
  const fetchedAtMs = Date.now()
  const { value: latestBlockhash } = await rpc
    .getLatestBlockhash({ commitment: 'confirmed' })
    .send()

  return {
    blockhash: latestBlockhash.blockhash,
    lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
    fetchedAtMs,
  }
}

function buildPhase0TransactionMessage(input: {
  signer: KeyPairSigner
  instructions: readonly Instruction[]
  blockhashInfo: Phase0BlockhashInfo
}) {
  return pipe(
    createTransactionMessage({ version: WALLET_TRANSACTION_MESSAGE_VERSION }),
    (message) => setTransactionMessageFeePayerSigner(input.signer, message),
    (message) =>
      setTransactionMessageLifetimeUsingBlockhash(
        {
          blockhash: input.blockhashInfo.blockhash,
          lastValidBlockHeight: input.blockhashInfo.lastValidBlockHeight,
        },
        message,
      ),
    (message) => appendTransactionMessageInstructions(input.instructions, message),
  )
}

export async function compilePhase0Transaction(input: {
  signer: KeyPairSigner
  instructions: readonly Instruction[]
  blockhashInfo?: Phase0BlockhashInfo
}): Promise<Phase0CompiledTransaction> {
  const blockhashInfo = input.blockhashInfo ?? (await fetchPhase0BlockhashInfo())

  return {
    transactionMessage: buildPhase0TransactionMessage({
      signer: input.signer,
      instructions: input.instructions,
      blockhashInfo,
    }),
    blockhashInfo,
  }
}

export async function signPhase0TransactionMessage(
  transactionMessage: Phase0CompiledTransaction['transactionMessage'],
) {
  return signTransactionMessageWithSigners(transactionMessage)
}

export async function signAndSendPhase0Instructions(
  instructions: readonly Instruction[],
  options: Phase0SendOptions = {},
): Promise<{ signature: Signature }> {
  const signer = await loadPhase0Signer()
  const { transactionMessage } = await compilePhase0Transaction({ signer, instructions })
  const signedTransaction = await signTransactionMessageWithSigners(transactionMessage)
  assertIsTransactionWithBlockhashLifetime(signedTransaction)
  const signature = getSignatureFromTransaction(signedTransaction)

  const sendableTransaction = signedTransaction as SendableTransaction &
    Transaction &
    TransactionWithLastValidBlockHeight

  await getPhase0SendAndConfirm()(sendableTransaction, {
    commitment: options.commitment ?? 'confirmed',
    skipPreflight: options.skipPreflight ?? false,
  })

  return { signature }
}

export async function simulatePhase0Instructions(
  instructions: readonly Instruction[],
): Promise<{
  err: unknown
  logs: string[]
  unitsConsumed?: bigint | number | null
}> {
  const signer = await loadPhase0Signer()
  const { transactionMessage } = await compilePhase0Transaction({ signer, instructions })
  const unsignedTransaction = compileTransaction(transactionMessage)
  const rpc = getPhase0Rpc()

  const simulation = await rpc
    .simulateTransaction(getTransactionWireBase64(unsignedTransaction), {
      encoding: 'base64',
      commitment: 'confirmed',
      sigVerify: false,
    })
    .send()

  return {
    err: simulation.value.err,
    logs: simulation.value.logs ?? [],
    unitsConsumed: simulation.value.unitsConsumed ?? null,
  }
}
