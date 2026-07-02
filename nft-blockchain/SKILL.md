---
name: nft-blockchain
description: NFT display and blockchain interaction in Decentraland. NftShape (framed NFT artwork), wallet checks (getPlayer, isGuest), signedFetch (authenticated requests), smart contract interaction (eth-connect, createEthereumProvider), and RPC calls. Use when the user wants NFTs, blockchain, wallet, smart contracts, Web3, crypto, or token gating. Do NOT use for player avatar data or emotes (see player-avatar).
---

# NFT and Blockchain in Decentraland

## Display NFT Artwork

Use `NftShape` to show any Ethereum ERC-721 NFT in a decorative picture frame. Provide the NFT URN and choose a frame style. The image is loaded automatically from the NFT's metadata.

**NFT URN format:** `urn:decentraland:ethereum:erc721:<contractAddress>:<tokenId>` -- works with any ERC-721 on Ethereum mainnet.

### Available Frame Styles

```typescript
NftFrameType.NFT_CLASSIC            // Simple classic frame
NftFrameType.NFT_BAROQUE_ORNAMENT   // Ornate baroque
NftFrameType.NFT_DIAMOND_ORNAMENT   // Diamond pattern
NftFrameType.NFT_MINIMAL_WIDE       // Minimal wide border
NftFrameType.NFT_MINIMAL_GREY       // Minimal grey border
NftFrameType.NFT_BLOCKY             // Pixelated/blocky
NftFrameType.NFT_GOLD_EDGES         // Gold edge trim
NftFrameType.NFT_GOLD_CARVED        // Carved gold
NftFrameType.NFT_GOLD_WIDE          // Wide gold border
NftFrameType.NFT_GOLD_ROUNDED       // Rounded gold
NftFrameType.NFT_METAL_MEDIUM       // Medium metal
NftFrameType.NFT_METAL_WIDE         // Wide metal
NftFrameType.NFT_METAL_SLIM         // Slim metal
NftFrameType.NFT_METAL_ROUNDED      // Rounded metal
NftFrameType.NFT_PINS               // Pinned to wall
NftFrameType.NFT_MINIMAL_BLACK      // Minimal black
NftFrameType.NFT_MINIMAL_WHITE      // Minimal white
NftFrameType.NFT_TAPE               // Taped to wall
NftFrameType.NFT_WOOD_SLIM          // Slim wood
NftFrameType.NFT_WOOD_WIDE          // Wide wood
NftFrameType.NFT_WOOD_TWIGS         // Twig/branch wood
NftFrameType.NFT_CANVAS             // Canvas style
NftFrameType.NFT_NONE               // No frame
```

## Check Player Wallet

Use `getPlayer()` from `@dcl/sdk/src/players` to get the player's Ethereum address via `player.userId`. Always check `isGuest` before any blockchain interaction -- guest players don't have a connected wallet.

## Signed Requests

Use `signedFetch` from `~system/SignedFetch` to send authenticated requests to a backend. It automatically injects signed identity headers (ADR-44) that your backend verifies — you do not build or pass them yourself.

- Signature: `signedFetch({ url, init: { method?, headers?, body? } })`.
- Response is `{ ok, status, statusText, headers, body }`; **`body` is a string** — call `JSON.parse(response.body)` (there is no `.json()`).
- It does **not** require prior player interaction (unlike restricted actions).
- Need only the signed headers for a library that does its own fetching? Use `getHeaders({ url, init? })` from the same module — it returns `{ headers }`.

## Smart Contract Interaction

For direct smart contract calls, use `eth-connect` with `createEthereumProvider` from `@dcl/sdk/ethereum-provider`. Store ABIs in separate files, create a contract instance via `ContractFactory`, then call read (no gas) or write (requires gas, prompts user to sign) functions.

```bash
npm install eth-connect
```

Read operations (view/pure functions) don't require gas. Write operations prompt the player to sign and require gas.

## Gas Price and Balance

Use `requestManager.eth_gasPrice()` and `requestManager.eth_getBalance()` from `eth-connect` to check current gas prices and account ETH balances.

## Custom RPC Calls

Use `sendAsync` from `~system/EthereumController` for low-level Ethereum RPC calls not covered by eth-connect helpers.

## Opening External URLs / NFT Dialogs

Use `openExternalUrl` and `openNftDialog` from `~system/RestrictedActions` to open external links and NFT detail views.

## Testing with Sepolia

For development, use the Sepolia testnet: set MetaMask to Sepolia, get test ETH from a faucet, deploy contracts to Sepolia. Contract addresses differ between mainnet and testnet.

## dcl-crypto-toolkit (Higher-Level API)

For common blockchain operations, use `dcl-crypto-toolkit` instead of raw `eth-connect`. It provides a cleaner API for the most frequent tasks.

```bash
npm install dcl-crypto-toolkit
```

Import: `import * as crypto from 'dcl-crypto-toolkit'`. Modules: `ethereum`, `mana`, `currency`, `nft`, `marketplace`, `services`, `wearable`, `contract`. There is NO top-level `crypto.signMessage`.

**Capabilities:**
- **MANA operations:** send, check balance (`crypto.mana.send` / `.myBalance` / `.balance`)
- **ERC20 tokens:** send, check balance, check/set allowance (`crypto.currency.*`)
- **ERC721/NFT:** check tokens held (token gating), transfer, approval management (`crypto.nft.*`)
- **Marketplace:** buy (`executeOrder`), sell (`createOrder`), cancel (`cancelOrder`), check authorization (`crypto.marketplace.*`)
- **Sign message:** sign EIP-712 typed data with player wallet (`crypto.ethereum.signMessageAdvanced()`)

## Token Gating

**By NFT ownership:** Use `crypto.nft.checkTokens(contractAddress, tokenIds?)` — returns whether the player holds tokens of that contract. Omit `tokenIds` to check any token of the contract. Grant or deny access on the result.

**By MANA balance:** Check `crypto.mana.myBalance()` (or `crypto.currency.balance(contractAddress, address)` for other ERC20 tokens) to gate access based on holdings.

### Quick Decision Guide

| Task | Use |
|---|---|
| Send MANA | `crypto.mana.send()` |
| Check own MANA balance | `crypto.mana.myBalance()` |
| Check any address's MANA balance | `crypto.mana.balance(address)` |
| Send any ERC20 token | `crypto.currency.send()` |
| Check ERC20 balance | `crypto.currency.balance(contract, address)` |
| Transfer an NFT | `crypto.nft.transfer()` |
| Check NFT ownership / token gating | `crypto.nft.checkTokens()` |
| Buy from marketplace | `crypto.marketplace.executeOrder()` |
| List NFT for sale | `crypto.marketplace.createOrder()` |
| Sign a message | `crypto.ethereum.signMessageAdvanced()` |
| Custom smart contract | `eth-connect` (see above) |
| Authenticated API call | `signedFetch` (see above) |

## Best Practices

- **Always check `isGuest`** before any blockchain interaction -- guest players can't sign transactions
- Use `executeTask(async () => { ... })` for all async blockchain calls
- Store ABI files separately (e.g., `contracts/`) -- don't inline large ABIs
- Handle errors gracefully -- blockchain operations can fail (rejected by user, insufficient gas, network issues)
- `eth-connect` must be installed as a dependency: `npm install eth-connect`
- Use `signedFetch` for backend authentication instead of raw `fetch` -- it proves the player's identity
- Read operations (view/pure functions) don't require gas; write operations prompt the user to sign
- Test on Sepolia before deploying to mainnet
- NFT URNs only work with Ethereum mainnet ERC-721 tokens

For full code examples and implementation patterns, including the dcl-crypto-toolkit library API, see '{baseDir}/references/blockchain-patterns.md'.
