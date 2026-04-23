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

Use `signedFetch` from `~system/SignedFetch` to send authenticated requests to a backend. It automatically includes a cryptographic signature proving the player's identity, which your backend can verify.

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

**Capabilities:**
- **MANA operations:** send, check balance, check/set allowance (`crypto.mana.*`)
- **ERC20 tokens:** send, check balance, check/set allowance (`crypto.currency.*`)
- **ERC721/NFT:** check ownership, transfer, approval management (`crypto.nft.*`)
- **Marketplace:** buy orders, sell orders, cancel orders, check authorization (`crypto.marketplace.*`)
- **Sign message:** sign arbitrary messages with player wallet (`crypto.signMessage()`)

## Token Gating

**By NFT ownership:** Check `crypto.nft.getBalance()` to verify the player owns a specific NFT, then grant or deny access.

**By ERC20 balance:** Check `crypto.mana.getBalance()` (or `crypto.currency.getBalance()` for other tokens) to gate access based on token holdings.

### Quick Decision Guide

| Task | Use |
|---|---|
| Send MANA | `crypto.mana.send()` |
| Check MANA balance | `crypto.mana.getBalance()` |
| Send any ERC20 token | `crypto.currency.send()` |
| Check ERC20 balance | `crypto.currency.getBalance()` |
| Transfer an NFT | `crypto.nft.transfer()` |
| Check NFT ownership | `crypto.nft.getBalance()` |
| Buy from marketplace | `crypto.marketplace.buyOrder()` |
| List NFT for sale | `crypto.marketplace.sellOrder()` |
| Sign a message | `crypto.signMessage()` |
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

For full code examples and implementation patterns, see '{baseDir}/references/blockchain-patterns.md'. For the dcl-crypto-toolkit library API, see '{baseDir}/references/crypto-library.mdc'.
