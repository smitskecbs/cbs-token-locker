/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SOLANA_NETWORK?: string
  readonly VITE_SOLANA_RPC_DEVNET?: string
  readonly VITE_SOLANA_RPC_MAINNET?: string
  readonly VITE_HELIUS_DEVNET_RPC?: string
  readonly VITE_HELIUS_MAINNET_RPC?: string
  readonly VITE_ENABLE_CLMM_LOCKING?: string
  readonly HELIUS_DEVNET_API_KEY?: string
  readonly HELIUS_MAINNET_API_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
