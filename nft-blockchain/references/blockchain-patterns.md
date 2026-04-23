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

### MANA Operations

```typescript
import * as crypto from 'dcl-crypto-toolkit'

executeTask(async () => {
  // Check own MANA balance
  const myBalance = await crypto.mana.getBalance()

  // Check another address's MANA balance
  const theirBalance = await crypto.mana.getBalance('0xSomeAddress')

  // Send MANA
  await crypto.mana.send('0xRecipientAddress', 10, true) // true = wait for confirmation

  // Check allowance
  const isApproved = await crypto.mana.isApproved('0xSpenderAddress', 100)

  // Set allowance
  await crypto.currency.setApproval(
    crypto.contract.mainnet.MANAToken,
    '0xSpenderContract',
    true,
    '1000000000000000000000' // amount in wei (optional, defaults to max)
  )
})
```

### ERC20 Operations

```typescript
executeTask(async () => {
  const tokenAddress = '0xTokenContractAddress'

  // Send tokens
  await crypto.currency.send(tokenAddress, '0xRecipient', 1000000000000000000, true)

  // Check balance
  const balance = await crypto.currency.getBalance(tokenAddress) // own balance
  const theirBalance = await crypto.currency.getBalance(tokenAddress, '0xOtherAddress')

  // Check and set allowance
  const allowance = await crypto.currency.allowance(tokenAddress, '0xOwner', '0xSpender')
  await crypto.currency.setApproval(tokenAddress, '0xSpender', true)
  const approved = await crypto.currency.isApproved(tokenAddress, '0xOwner', '0xSpender')
})
```

### ERC721/NFT Operations

```typescript
executeTask(async () => {
  const contractAddress = '0xNFTContractAddress'
  const tokenId = 123

  // Check ownership
  const balance = await crypto.nft.getBalance(contractAddress, tokenId)
  const ownsNFT = balance > 0

  // Transfer NFT
  await crypto.nft.transfer(contractAddress, '0xRecipient', tokenId, true)

  // Approval for all
  const isApproved = await crypto.nft.isApprovedForAll(contractAddress, '0xHolder', '0xOperator')
  await crypto.nft.setApprovalForAll(contractAddress, '0xOperator', true, true)
})
```

### Marketplace Integration

```typescript
executeTask(async () => {
  // Buy from marketplace
  await crypto.marketplace.buyOrder('0xNFTAddress', 123, '1000000000000000000')

  // Sell on marketplace
  const isAuthorized = await crypto.marketplace.isAuthorized()
  if (!isAuthorized) {
    await crypto.nft.setApprovalForAll(
      '0xNFTContractAddress',
      crypto.contract.mainnet.Marketplace,
      true, true
    )
  }
  const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
  await crypto.marketplace.sellOrder('0xNFTAddress', 123, '1000000000000000000', expiresAt.toString())

  // Cancel a listing
  await crypto.marketplace.cancelOrder('0xNFTAddress', 123)

  // Check authorization status
  const authorized = await crypto.marketplace.isAuthorized()
})
```

### Sign Message

```typescript
executeTask(async () => {
  const signature = await crypto.signMessage('Hello Decentraland!')
  console.log('Signature:', signature)
  // Send signature to your backend to verify the player's identity
})
```

## Token Gating Patterns

### Gate by NFT Ownership

```typescript
executeTask(async () => {
  const player = getPlayer()
  if (!player || player.isGuest) return

  const balance = await crypto.nft.getBalance('0xYourNFTContract', 1)
  if (balance > 0) {
    openGatedArea()
  } else {
    showAccessDenied()
  }
})
```

### Gate by ERC20 Balance

```typescript
executeTask(async () => {
  const manaBalance = await crypto.mana.getBalance()
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

      const balance = await crypto.mana.getBalance()
      if (balance < amount) { console.log('Insufficient MANA'); return }

      await crypto.mana.send(CREATOR_WALLET, amount, true)
      console.log(`Sent ${amount} MANA tip!`)
    } catch (error) {
      console.error('Tip failed:', error)
    }
  })
}
```
