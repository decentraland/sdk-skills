# Blockchain & NFT Patterns

## Display NFT

```typescript
import { engine, Transform, NftShape, NftFrameType } from '@dcl/sdk/ecs'
import { Vector3, Quaternion, Color4 } from '@dcl/sdk/math'

const nftFrame = engine.addEntity()
Transform.create(nftFrame, {
	position: Vector3.create(8, 2, 8),
	rotation: Quaternion.fromEulerDegrees(0, 0, 0),
})

NftShape.create(nftFrame, {
	urn: 'urn:decentraland:ethereum:erc721:0x06012c8cf97bead5deae237070f9587f8e7a266d:558536',
	color: Color4.White(),
	style: NftFrameType.NFT_CLASSIC,
})
```

## Check Player Wallet

```typescript
import { getPlayer } from '@dcl/sdk/src/players'

function checkWallet() {
	const player = getPlayer()
	if (player && !player.isGuest) {
		console.log('Player wallet address:', player.userId)
		// userId is the Ethereum wallet address
	} else {
		console.log('Player is guest (no wallet)')
	}
}
```

## Signed Requests

```typescript
import { signedFetch } from '~system/SignedFetch'

executeTask(async () => {
	try {
		const response = await signedFetch({
			url: 'https://example.com/api/action',
			init: {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'claimReward',
					amount: 100,
				}),
			},
		})

		if (!response.ok) {
			console.error('HTTP error:', response.status)
			return
		}
		const result = JSON.parse(response.body)
		console.log('Result:', result)
	} catch (error) {
		console.log('Request failed:', error)
	}
})
```

## Smart Contracts

### Setup (ABI + Instance)

Store ABI in a separate file:

```typescript
// contracts/myContract.ts
export default [
	{
		constant: true,
		inputs: [{ name: '_owner', type: 'address' }],
		name: 'balanceOf',
		outputs: [{ name: 'balance', type: 'uint256' }],
		type: 'function',
	},
	// ... rest of ABI
]
```

Create contract instance:

```typescript
import { RequestManager, ContractFactory } from 'eth-connect'
import { createEthereumProvider } from '@dcl/sdk/ethereum-provider'
import { abi } from '../contracts/myContract'

executeTask(async () => {
	try {
		// Create web3 provider
		const provider = createEthereumProvider()
		const requestManager = new RequestManager(provider)

		// Create contract at a specific address
		const factory = new ContractFactory(requestManager, abi)
		const contract = (await factory.at(
			'0x2a8fd99c19271f4f04b1b7b9c4f7cf264b626edb'
		)) as any

		// Read data (no gas required)
		const balance = await contract.balanceOf('0x123...abc')
		console.log('Balance:', balance)
	} catch (error) {
		console.log('Contract interaction failed:', error)
	}
})
```

### Write Operations

```typescript
executeTask(async () => {
	try {
		const userData = getPlayer()
		if (userData.isGuest) return

		// Write operation — prompts the player to sign the transaction
		const writeResult = await contract.transfer('0xRecipientAddress', 100, {
			from: userData.userId,
			gas: 100000,
			gasPrice: await requestManager.eth_gasPrice(),
		})
		console.log('Transaction hash:', writeResult)
	} catch (error) {
		console.log('Transaction failed:', error)
	}
})
```

### Read Operations

Read operations (view/pure functions) use the same contract instance but don't require gas:

```typescript
const balance = await contract.balanceOf('0x123...abc')
const name = await contract.name()
```

### Custom RPC Calls

Use `sendAsync` for low-level Ethereum RPC calls not covered by eth-connect helpers:

```typescript
import { sendAsync } from '~system/EthereumController'

const result = await sendAsync({ method: 'eth_blockNumber', params: [] })
console.log('Current block:', result.body)
```

## Gas Price and Balance

```typescript
import { RequestManager } from 'eth-connect'
import { createEthereumProvider } from '@dcl/sdk/ethereum-provider'

executeTask(async () => {
	const provider = createEthereumProvider()
	const requestManager = new RequestManager(provider)

	const gasPrice = await requestManager.eth_gasPrice()
	console.log('Current gas price:', gasPrice)

	const balance = await requestManager.eth_getBalance('0x123...abc', 'latest')
	console.log('Account balance:', balance)
})
```

## Opening External URLs / NFT Dialogs

```typescript
import { openExternalUrl, openNftDialog } from '~system/RestrictedActions'

openExternalUrl({ url: 'https://opensea.io/collection/...' })
openNftDialog({
	urn: 'urn:decentraland:ethereum:erc721:0x06012c8cf97BEaD5deAe237070F9587f8E7A266d:558536',
})
```

## dcl-crypto-toolkit Examples

Import: `import * as crypto from 'dcl-crypto-toolkit'`. Modules: `ethereum`, `mana`, `currency`, `nft`, `marketplace`, `services`, `wearable`, `contract`. All calls are async; wrap in `executeTask`.

### MANA Operations

```typescript
import * as crypto from 'dcl-crypto-toolkit'

executeTask(async () => {
  // Own MANA balance (number, in MANA)
  const myBalance = await crypto.mana.myBalance()

  // Another address's MANA balance
  const theirBalance = await crypto.mana.balance('0xSomeAddress')

  // Send MANA — send(toAddress, amount, waitConfirm = false)
  await crypto.mana.send('0xRecipientAddress', 10, true)
})
```

### ERC20 Operations

```typescript
executeTask(async () => {
  const tokenAddress = '0xTokenContractAddress'

  // Send tokens — send(contractAddress, toAddress, amount, waitConfirm = false)
  await crypto.currency.send(tokenAddress, '0xRecipient', 1000000000000000000, true)

  // Balance — balance(contractAddress, address); BOTH args required
  const balance = await crypto.currency.balance(tokenAddress, '0xOwner')

  // Allowance / approval
  const allowance = await crypto.currency.allowance(tokenAddress, '0xOwner', '0xSpender')
  const approved = await crypto.currency.isApproved(tokenAddress, '0xOwner', '0xSpender')
  // setApproval(contractAddress, spender, waitConfirm = false, amount?) — amount defaults to max
  await crypto.currency.setApproval(tokenAddress, '0xSpender', true)
})
```

### ERC721/NFT Operations

```typescript
executeTask(async () => {
  const contractAddress = '0xNFTContractAddress'

  // Does the player hold tokens of this contract? Token-gating primitive.
  // checkTokens(contractAddress, tokenIds?) — omit tokenIds to check any token of the contract
  const hasToken = await crypto.nft.checkTokens(contractAddress)
  const hasSpecific = await crypto.nft.checkTokens(contractAddress, [123])

  // Transfer — transfer(contractAddress, toAddress, tokenId, waitConfirm?)
  await crypto.nft.transfer(contractAddress, '0xRecipient', 123, true)

  // Operator approval
  const isApproved = await crypto.nft.isApprovedForAll(contractAddress, '0xHolder', '0xOperator')
  // setApprovalForAll(contractAddress, operator, approved?, waitConfirm?)
  await crypto.nft.setApprovalForAll(contractAddress, '0xOperator', true, true)
})
```

### Marketplace Integration

```typescript
executeTask(async () => {
  const nftAddress = '0xNFTAddress'
  const price = '1000000000000000000' // wei

  // Buy — executeOrder(nftAddress, assetId, price)
  // Gate on authorization + balance first
  if (await crypto.marketplace.isAuthorizedAndHasBalance(price)) {
    await crypto.marketplace.executeOrder(nftAddress, 123, price)
  }

  // Sell — createOrder(nftAddress, assetId, price, expireAt = now + 30d)
  if (!(await crypto.marketplace.isAuthorizedAll())) {
    await crypto.nft.setApprovalForAll(nftAddress, crypto.contract.mainnet.Marketplace, true, true)
  }
  await crypto.marketplace.createOrder(nftAddress, 123, price)

  // Cancel a listing
  await crypto.marketplace.cancelOrder(nftAddress, 123)
})
```

### Sign Message

`crypto.ethereum.signMessageAdvanced` is the only signing export (EIP-712 typed data).

```typescript
executeTask(async () => {
  const signature = await crypto.ethereum.signMessageAdvanced(
    messageToSign, // the data object to sign
    messageName,   // primary type name
    messageType,   // EIP-712 type definition
    domainData     // EIP-712 domain
  )
  // Send signature to your backend to verify the player's identity
})
```

### Custom Contract

`crypto.contract.getContract(contractAddress, abi)` — abi is REQUIRED. Constant address maps: `crypto.contract.mainnet` / `.ropsten` / `.kovan` / `.rinkeby` (infrastructure: MANAToken, Marketplace, LANDRegistry, EstateRegistry, ERC721Bid, DCLRegistrar; plus pre-2021 collection constants only).

```typescript
executeTask(async () => {
  const contract = await crypto.contract.getContract(crypto.contract.mainnet.MANAToken, manaAbi)
  const balance = await contract.balanceOf('0xOwner')
})
```

### Wearable Data

`crypto.wearable.getListOfWearables(filters)` — `filters` requires at least one of `collectionIds` / `wearableIds` / `textSearch`.

```typescript
executeTask(async () => {
  const wearables = await crypto.wearable.getListOfWearables({
    collectionIds: ['urn:decentraland:ethereum:collections-v1:mf_sammichgamer'],
    textSearch: 'sammich',
  })
})
```

## Token Gating Patterns

### Gate by NFT Ownership

```typescript
executeTask(async () => {
  const player = getPlayer()
  if (!player || player.isGuest) return

  // checkTokens returns whether the player holds a token of the contract
  if (await crypto.nft.checkTokens('0xYourNFTContract')) {
    openGatedArea()
  } else {
    showAccessDenied()
  }
})
```

### Gate by MANA Balance

```typescript
executeTask(async () => {
  const manaBalance = await crypto.mana.myBalance()
  if (manaBalance >= 100) {
    grantVIPAccess()
  }
})
```

## Recipes

### Tip Jar

```typescript
import * as crypto from 'dcl-crypto-toolkit'

const CREATOR_WALLET = '0xYourWalletAddress'

function sendTip(amount: number) {
  executeTask(async () => {
    try {
      const player = getPlayer()
      if (!player || player.isGuest) return

      const balance = await crypto.mana.myBalance()
      if (balance < amount) { console.log('Insufficient MANA'); return }

      await crypto.mana.send(CREATOR_WALLET, amount, true)
      console.log(`Sent ${amount} MANA tip!`)
    } catch (error) {
      console.error('Tip failed:', error)
    }
  })
}
```
