/** Anchor account discriminator for `TokenLock`. */
export const TOKEN_LOCK_ACCOUNT_DISCRIMINATOR = new Uint8Array([
  0x49, 0xe4, 0x90, 0xf1, 0x9a, 0x2c, 0x5d, 0xee,
])

/** Anchor instruction discriminator for `create_lock`. */
export const CREATE_LOCK_DISCRIMINATOR = new Uint8Array([
  0xab, 0xd8, 0x5c, 0xa7, 0xa5, 0x08, 0x99, 0x5a,
])

/** Anchor instruction discriminator for `unlock`. */
export const UNLOCK_DISCRIMINATOR = new Uint8Array([
  0x65, 0x9b, 0x28, 0x15, 0x9e, 0xbd, 0x38, 0xcb,
])
