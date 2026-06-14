var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// api/v1/locks/[lockAccount].ts
var lockAccount_exports = {};
__export(lockAccount_exports, {
  default: () => handler
});
module.exports = __toCommonJS(lockAccount_exports);
var import_kit7 = require("@solana/kit");

// api/apiErrors.ts
var import_kit = require("@solana/kit");
var RPC_RATE_LIMIT_MESSAGE = "Solana RPC is rate-limiting requests. Please wait a moment and try again.";
var RPC_FAILURE_MESSAGE = "Unable to load on-chain locks from Solana RPC.";
function getErrorMessage(error) {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  if ((0, import_kit.isSolanaError)(error)) {
    return error.message;
  }
  return "Unknown error";
}
function isRpcRateLimitError(error) {
  if ((0, import_kit.isSolanaError)(error) && error.context) {
    const context = error.context;
    if (context.statusCode === 429) {
      return true;
    }
    const message2 = context.message?.toLowerCase() ?? "";
    if (message2.includes("429") || message2.includes("too many requests") || message2.includes("rate limit")) {
      return true;
    }
  }
  const message = getErrorMessage(error).toLowerCase();
  return message.includes("429") || message.includes("too many requests") || message.includes("rate limit") || message.includes("rate-limiting");
}
function classifyApiError(error) {
  if (isRpcRateLimitError(error)) {
    return {
      status: 429,
      body: {
        error: RPC_RATE_LIMIT_MESSAGE,
        code: "RPC_RATE_LIMIT",
        details: getErrorMessage(error)
      }
    };
  }
  const message = getErrorMessage(error);
  const normalized = message.toLowerCase();
  if (normalized.includes("429") || normalized.includes("too many requests") || normalized.includes("rate limit") || normalized.includes("rate-limiting")) {
    return {
      status: 429,
      body: {
        error: RPC_RATE_LIMIT_MESSAGE,
        code: "RPC_RATE_LIMIT",
        details: message
      }
    };
  }
  return {
    status: 503,
    body: {
      error: RPC_FAILURE_MESSAGE,
      code: "RPC_ERROR",
      details: message
    }
  };
}
function invalidLockAccountResponse(details) {
  return {
    status: 400,
    body: {
      error: "Invalid lock account address.",
      code: "INVALID_LOCK_ACCOUNT",
      ...details ? { details } : {}
    }
  };
}
function invalidClusterResponse(details) {
  return {
    status: 400,
    body: {
      error: "Invalid cluster. Use cluster=devnet or cluster=mainnet.",
      code: "INVALID_CLUSTER",
      ...details ? { details } : {}
    }
  };
}

// api/fetchLock.ts
var import_kit6 = require("@solana/kit");

// api/constants.ts
var import_kit2 = require("@solana/kit");
var CBS_LOCKER_PROGRAM_ID = (0, import_kit2.address)(
  process.env.VITE_CBS_LOCKER_PROGRAM_ID?.trim() || "DA1sh6XTa13QQ23sLNdcPfCZF5SGMKXXYLxcfAJYcCmU"
);

// api/layout.ts
var import_addresses = require("@solana/addresses");

// api/discriminators.ts
var TOKEN_LOCK_ACCOUNT_DISCRIMINATOR = new Uint8Array([
  73,
  228,
  144,
  241,
  154,
  44,
  93,
  238
]);

// api/layout.ts
var addressDecoder = (0, import_addresses.getAddressDecoder)();
var MAX_PROJECT_NAME_LEN = 48;
var TOKEN_LOCK_ACCOUNT_SIZE = 220;
function decodePubkeyBytes(bytes) {
  return addressDecoder.decode(bytes);
}
function parseTokenLockAccount(data) {
  if (data.length < TOKEN_LOCK_ACCOUNT_SIZE) {
    return null;
  }
  for (let index = 0; index < TOKEN_LOCK_ACCOUNT_DISCRIMINATOR.length; index += 1) {
    if (data[index] !== TOKEN_LOCK_ACCOUNT_DISCRIMINATOR[index]) {
      return null;
    }
  }
  let offset = 8;
  const ownerBytes = data.slice(offset, offset + 32);
  offset += 32;
  const mintBytes = data.slice(offset, offset + 32);
  offset += 32;
  const vaultBytes = data.slice(offset, offset + 32);
  offset += 32;
  const amount = readU64(data, offset);
  offset += 8;
  const unlockTimestamp = readI64(data, offset);
  offset += 8;
  const createdAt = readI64(data, offset);
  offset += 8;
  const lockSeed = readU64(data, offset);
  offset += 8;
  const tokenTypeByte = data[offset];
  offset += 1;
  const isUnlocked = data[offset] === 1;
  offset += 1;
  const bump = data[offset];
  offset += 1;
  const vaultBump = data[offset];
  offset += 1;
  const tokenProgramBytes = data.slice(offset, offset + 32);
  offset += 32;
  const projectNameBytes = data.slice(offset, offset + MAX_PROJECT_NAME_LEN);
  const projectName = new TextDecoder().decode(
    projectNameBytes.slice(0, projectNameEnd(projectNameBytes))
  );
  return {
    owner: decodePubkeyBytes(ownerBytes),
    mint: decodePubkeyBytes(mintBytes),
    vault: decodePubkeyBytes(vaultBytes),
    amount,
    unlockTimestamp,
    createdAt,
    lockSeed,
    tokenType: tokenTypeByte === 1 ? "lp" : "spl",
    isUnlocked,
    bump,
    vaultBump,
    tokenProgram: decodePubkeyBytes(tokenProgramBytes),
    projectName
  };
}
function projectNameEnd(bytes) {
  let end = bytes.length;
  while (end > 0 && bytes[end - 1] === 0) {
    end -= 1;
  }
  return end;
}
function readU64(data, offset) {
  const view = new DataView(data.buffer, data.byteOffset + offset, 8);
  return view.getBigUint64(0, true);
}
function readI64(data, offset) {
  const view = new DataView(data.buffer, data.byteOffset + offset, 8);
  return Number(view.getBigInt64(0, true));
}

// api/rpc.ts
var import_kit3 = require("@solana/kit");

// api/rpcConfig.ts
var HELIUS_DEVNET_RPC_BASE = "https://devnet.helius-rpc.com/";
var HELIUS_MAINNET_RPC_BASE = "https://mainnet.helius-rpc.com/";
function readEnv(key) {
  const value = process.env[key]?.trim();
  return value || void 0;
}
function buildHeliusDevnetRpcUrl(apiKey) {
  return `${HELIUS_DEVNET_RPC_BASE}?api-key=${encodeURIComponent(apiKey)}`;
}
function buildHeliusMainnetRpcUrl(apiKey) {
  return `${HELIUS_MAINNET_RPC_BASE}?api-key=${encodeURIComponent(apiKey)}`;
}
function getRpcUrl(network = "devnet") {
  if (network === "devnet") {
    const custom = readEnv("VITE_SOLANA_RPC_DEVNET");
    if (custom) {
      return custom;
    }
    const heliusKey = readEnv("HELIUS_DEVNET_API_KEY");
    if (heliusKey) {
      return buildHeliusDevnetRpcUrl(heliusKey);
    }
    const heliusRpc = readEnv("VITE_HELIUS_DEVNET_RPC");
    if (heliusRpc) {
      return heliusRpc;
    }
    return "https://api.devnet.solana.com";
  }
  const customMainnet = readEnv("VITE_SOLANA_RPC_MAINNET");
  if (customMainnet) {
    return customMainnet;
  }
  const heliusMainnetKey = readEnv("HELIUS_MAINNET_API_KEY");
  if (heliusMainnetKey) {
    return buildHeliusMainnetRpcUrl(heliusMainnetKey);
  }
  const heliusMainnetRpc = readEnv("VITE_HELIUS_MAINNET_RPC");
  if (heliusMainnetRpc) {
    return heliusMainnetRpc;
  }
  return "https://api.mainnet-beta.solana.com";
}
function logApiRequestCluster(cluster, path) {
  console.info("[CBS Locker API Request]", {
    cluster,
    path,
    rpcUrl: getRpcUrl(cluster).replace(/([?&]api-key=)[^&]+/i, "$1***")
  });
}

// api/rpc.ts
var cache = /* @__PURE__ */ new Map();
function getSolanaRpc(network = "devnet") {
  const cached = cache.get(network);
  if (cached) {
    return cached;
  }
  const rpc = (0, import_kit3.createSolanaRpc)(getRpcUrl(network));
  cache.set(network, rpc);
  return rpc;
}

// api/verify.ts
var import_kit5 = require("@solana/kit");
var import_token = require("@solana-program/token");

// api/pda.ts
var import_kit4 = require("@solana/kit");
var addressEncoder = (0, import_kit4.getAddressEncoder)();
async function findLockAccountAddress(owner, mint, lockSeed) {
  const seedBytes = new Uint8Array(8);
  const view = new DataView(seedBytes.buffer);
  view.setBigUint64(0, lockSeed, true);
  return (0, import_kit4.getProgramDerivedAddress)({
    programAddress: CBS_LOCKER_PROGRAM_ID,
    seeds: [
      new TextEncoder().encode("lock"),
      addressEncoder.encode(owner),
      addressEncoder.encode(mint),
      seedBytes
    ]
  });
}
async function findVaultAddress(lockAccount) {
  return (0, import_kit4.getProgramDerivedAddress)({
    programAddress: CBS_LOCKER_PROGRAM_ID,
    seeds: [new TextEncoder().encode("vault"), addressEncoder.encode(lockAccount)]
  });
}

// api/verify.ts
async function verifyOnChainLock(lockAccount, network = "devnet") {
  const rpc = getSolanaRpc(network);
  const encodedAccount = await (0, import_kit5.fetchEncodedAccount)(rpc, lockAccount);
  if (!encodedAccount.exists) {
    return {
      verified: false,
      reason: "Lock account does not exist on-chain."
    };
  }
  if (encodedAccount.programAddress !== CBS_LOCKER_PROGRAM_ID) {
    return {
      verified: false,
      reason: "Account is not owned by the CBS Token Locker program."
    };
  }
  const parsed = parseTokenLockAccount(encodedAccount.data);
  if (!parsed) {
    return {
      verified: false,
      reason: "Lock account data does not match the CBS Token Locker layout."
    };
  }
  const [expectedLockAccount] = await findLockAccountAddress(
    (0, import_kit5.address)(parsed.owner),
    (0, import_kit5.address)(parsed.mint),
    parsed.lockSeed
  );
  if (expectedLockAccount !== lockAccount) {
    return {
      verified: false,
      reason: "Lock account address does not match deterministic PDA seeds."
    };
  }
  const [expectedVault] = await findVaultAddress(lockAccount);
  if (expectedVault !== parsed.vault) {
    return {
      verified: false,
      reason: "Vault address does not match deterministic PDA derivation."
    };
  }
  const vaultAccount = await (0, import_token.fetchMaybeToken)(rpc, (0, import_kit5.address)(parsed.vault));
  if (!vaultAccount.exists) {
    return {
      verified: false,
      reason: "Vault token account does not exist on-chain."
    };
  }
  if (vaultAccount.data.mint !== parsed.mint) {
    return {
      verified: false,
      reason: "Vault mint does not match the lock record."
    };
  }
  if (vaultAccount.data.owner !== lockAccount) {
    return {
      verified: false,
      reason: "Vault authority is not the lock account."
    };
  }
  if (!parsed.isUnlocked && vaultAccount.data.amount < parsed.amount) {
    return {
      verified: false,
      reason: "Vault balance is lower than the locked amount."
    };
  }
  if (parsed.isUnlocked && vaultAccount.data.amount > 0n) {
    return {
      verified: false,
      reason: `Lock is marked unlocked but vault still holds ${vaultAccount.data.amount.toString()} tokens.`
    };
  }
  return {
    verified: true,
    reason: "CBS verified on-chain"
  };
}

// api/fetchLock.ts
function toLockRecord(lockAccount, parsed, verification, createSignature) {
  return {
    lockAccount,
    owner: parsed.owner,
    mint: parsed.mint,
    vault: parsed.vault,
    amount: parsed.amount.toString(),
    unlockAt: new Date(parsed.unlockTimestamp * 1e3).toISOString(),
    createdAt: new Date(parsed.createdAt * 1e3).toISOString(),
    lockSeed: parsed.lockSeed.toString(),
    tokenType: parsed.tokenType,
    isUnlocked: parsed.isUnlocked,
    tokenProgram: parsed.tokenProgram,
    projectName: parsed.projectName,
    programId: CBS_LOCKER_PROGRAM_ID,
    onChainVerified: verification.verified,
    createSignature
  };
}
async function fetchOnChainLock(lockAccountAddress, network = "devnet") {
  try {
    (0, import_kit6.assertIsAddress)(lockAccountAddress);
  } catch {
    return null;
  }
  const lockAccount = (0, import_kit6.address)(lockAccountAddress);
  const rpc = getSolanaRpc(network);
  const encodedAccount = await (0, import_kit6.fetchEncodedAccount)(rpc, lockAccount);
  if (!encodedAccount.exists || encodedAccount.programAddress !== CBS_LOCKER_PROGRAM_ID) {
    return null;
  }
  const parsed = parseTokenLockAccount(encodedAccount.data);
  if (!parsed) {
    return null;
  }
  const verification = await verifyOnChainLock(lockAccount, network);
  return toLockRecord(lockAccount, parsed, verification);
}

// api/cluster.ts
function parseRequestCluster(value) {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  if (normalized === "devnet" || normalized === "mainnet") {
    return normalized;
  }
  return null;
}

// api/http.ts
function setCors(response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
}
function resolveRequestUrl(request) {
  const protocol = String(request.headers["x-forwarded-proto"] ?? "https");
  const host = request.headers.host ?? "localhost";
  return new URL(request.url ?? "/", `${protocol}://${host}`);
}
function resolveCluster(url) {
  const rawCluster = url.searchParams.get("cluster");
  if (rawCluster === null || rawCluster.trim() === "") {
    return { cluster: "devnet" };
  }
  const parsed = parseRequestCluster(rawCluster);
  if (!parsed) {
    return { error: invalidClusterResponse(`Received cluster=${rawCluster}`) };
  }
  return { cluster: parsed };
}
function readLockAccount(request, url) {
  const queryValue = request.query.lockAccount;
  if (typeof queryValue === "string" && queryValue.trim()) {
    return decodeURIComponent(queryValue.trim());
  }
  if (Array.isArray(queryValue) && queryValue[0]?.trim()) {
    return decodeURIComponent(queryValue[0].trim());
  }
  const match = url.pathname.match(/^\/api\/v1\/locks\/([^/]+)$/);
  if (!match) {
    return null;
  }
  return decodeURIComponent(match[1]);
}

// api/v1/locks/[lockAccount].ts
async function handler(request, response) {
  setCors(response);
  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }
  if (request.method !== "GET") {
    response.status(405).json({ error: "Method not allowed." });
    return;
  }
  const url = resolveRequestUrl(request);
  const clusterResult = resolveCluster(url);
  if ("error" in clusterResult) {
    response.status(clusterResult.error.status).json(clusterResult.error.body);
    return;
  }
  const cluster = clusterResult.cluster;
  const lockAccount = readLockAccount(request, url);
  if (!lockAccount) {
    const invalid = invalidLockAccountResponse();
    response.status(invalid.status).json(invalid.body);
    return;
  }
  logApiRequestCluster(cluster, `/api/v1/locks/${lockAccount}`);
  try {
    (0, import_kit7.assertIsAddress)(lockAccount);
  } catch (error) {
    const invalid = invalidLockAccountResponse(getErrorMessage(error));
    response.status(invalid.status).json(invalid.body);
    return;
  }
  try {
    const lock = await fetchOnChainLock(lockAccount, cluster);
    response.status(200).json({ cluster, lock });
  } catch (error) {
    const apiError = classifyApiError(error);
    response.status(apiError.status).json(apiError.body);
  }
}
