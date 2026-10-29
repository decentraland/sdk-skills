---
name: nft-blockchain
description: "NFTs and Web3 in Decentraland scenes: NftShape picture frames, wallet and token-gating checks, MANA/ERC20/NFT payments and marketplace orders (dcl-crypto-toolkit), and smart-contract calls (eth-connect). Use for anything wallet, token or chain related."
---

# NFT and Blockchain in Decentraland

## Display NFT Artwork

Use `NftShape` to show an NFT in a decorative picture frame. Provide the NFT URN and choose a frame style. The image is loaded automatically from the NFT's metadata (fetched through Decentraland's OpenSea proxy, `opensea.decentraland.org`) — any NFT that OpenSea supports can be displayed, across multiple chains.

**NFT URN format:** `urn:decentraland:<chain>:<contractStandard>:<contractAddress>:<tokenId>`
- Example: `urn:decentraland:ethereum:erc721:0x06012c8cf97bead5deae237070f9587f8e7a266d:558536`
- `<chain>` supported values (forwarded verbatim to the OpenSea v2 API; unrecognized chains are rejected): `ethereum`, `matic`, `klaytn`, `bsc`, `arbitrum`, `arbitrum_nova`, `avalanche`, `optimism`, `solana`, `base`, `blast`, `zora`.
- `<contractStandard>` is typically `erc721`. The image is served from the OpenSea response, so contracts OpenSea indexes as `erc1155` also resolve.

Frame styles: `NftFrameType.*` (classic, baroque, gold, metal, wood, minimal, pins, tape, canvas, none…). Code and the full enum: `{baseDir}/references/blockchain-patterns.md` → Display NFT.

## Check Player Wallet

Use `getPlayer()` from `@dcl/sdk/src/players` to get the player's Ethereum address via `player.userId`. Always check `isGuest` before any blockchain interaction -- guest players don't have a connected wallet. Code: `{baseDir}/references/blockchain-patterns.md` → Check Player Wallet.

## Signed Requests

Authenticated backend calls: `signedFetch` / `getHeaders` (**scene-runtime** → HTTP). A POST-and-parse example: `{baseDir}/references/blockchain-patterns.md` → Signed Requests.

## Smart Contract Interaction

For direct smart contract calls, use `eth-connect` with `createEthereumProvider` from `@dcl/sdk/ethereum-provider`. Store ABIs in separate files, create a contract instance via `ContractFactory`, then call read (no gas) or write (requires gas, prompts user to sign) functions. Code: `{baseDir}/references/blockchain-patterns.md` → Smart Contracts (setup, write, read).

```bash
npm install eth-connect
```

Wrap all async blockchain calls in `executeTask(async () => { ... })` with a `try`/`catch`: the player can reject, gas can run short, the network can fail.

## Gas Price and Balance

Use `requestManager.eth_gasPrice()` and `requestManager.eth_getBalance()` from `eth-connect` to check current gas prices and account ETH balances (`{baseDir}/references/blockchain-patterns.md` → Gas Price and Balance).

## Custom RPC Calls

Use `sendAsync` from `~system/EthereumController` for low-level Ethereum RPC calls not covered by eth-connect helpers (`{baseDir}/references/blockchain-patterns.md` → Custom RPC Calls).

## Opening External URLs / NFT Dialogs

`openExternalUrl` and `openNftDialog` are restricted actions (**scene-runtime** → *Restricted Actions*).

## Testing with Sepolia

Develop against Sepolia; contract addresses differ between mainnet and Sepolia.

## dcl-crypto-toolkit (Higher-Level API)

For common blockchain operations, use `dcl-crypto-toolkit` instead of raw `eth-connect`. It provides a cleaner API for the most frequent tasks.

```bash
npm install dcl-crypto-toolkit
```

Import: `import * as crypto from 'dcl-crypto-toolkit'`. Modules: `ethereum`, `mana`, `currency`, `nft`, `marketplace`, `services`, `wearable`, `contract`. There is NO top-level `crypto.signMessage`.

Code for every row below: `{baseDir}/references/blockchain-patterns.md` → dcl-crypto-toolkit Examples.

## Token Gating

**By NFT ownership:** Use `crypto.nft.checkTokens(contractAddress, tokenIds?)` — returns whether the player holds tokens of that contract. Omit `tokenIds` to check any token of the contract. Grant or deny access on the result. Code: `{baseDir}/references/blockchain-patterns.md` → Token Gating Patterns.

**By MANA balance:** Check `crypto.mana.myBalance()` (or `crypto.currency.balance(contractAddress, address)` for other ERC20 tokens) to gate access based on holdings.

### Quick Decision Guide

| Task | Use |
|---|---|
| Send MANA | `crypto.mana.send()` |
| Check own MANA balance | `crypto.mana.myBalance()` |
| Check any address's MANA balance | `crypto.mana.balance(address)` |
| Send any ERC20 token | `crypto.currency.send()` |
| Check ERC20 balance | `crypto.currency.balance(contract, address)` |
| ERC20 allowance | `crypto.currency.*` (check / set allowance) |
| Transfer an NFT, manage approvals | `crypto.nft.transfer()`, `crypto.nft.*` |
| Check NFT ownership / token gating | `crypto.nft.checkTokens()` |
| Buy from marketplace | `crypto.marketplace.executeOrder()` |
| List NFT for sale | `crypto.marketplace.createOrder()` |
| Cancel a listing, check authorization | `crypto.marketplace.cancelOrder()`, `crypto.marketplace.*` |
| Sign a message (EIP-712 typed data with the player's wallet) | `crypto.ethereum.signMessageAdvanced()` |
| Custom smart contract | `eth-connect` (see above) |
| Authenticated API call | `signedFetch` (**scene-runtime**) |
| Tip jar | `{baseDir}/references/blockchain-patterns.md` → Recipes |

## Example scenes

Engine-team test scenes exercising these APIs against the real runtime:

- https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/5,90-scene-bounds-check — `NftShape.create()` with a live `urn:decentraland:ethereum:erc721:<contract>:<tokenId>` URN, mounted on a moving platform that carries it across the parcel boundary (so it also shows an NFT frame being culled out of bounds).
- https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/80,-4-restricted-actions — `openNftDialog({ urn })` and `openExternalUrl` driven from React-ECS buttons, alongside every other RestrictedAction. Note the scene declares neither `OPEN_EXTERNAL_LINK` nor an NFT permission in `requiredPermissions` and both still run.
- https://github.com/decentraland/sdk7-test-scenes/tree/main/scenes/66,6-signed-fetch — `signedFetch` on click; reads `response.ok`/`.status`/`.body` and inspects the auto-added signature headers, with an empty `requiredPermissions`.
