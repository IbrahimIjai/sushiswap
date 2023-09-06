import { getChainIdAddressFromId } from '@sushiswap/format'
import { erc20ABI } from '@wagmi/core'
import { multichainMulticall } from 'src/helpers/multichainMulticall.js'
import { Address, PublicClient } from 'viem'

import { getSteerVaultsReserves } from './getSteerVaultReserves.js'

interface GetSteerAccountPositions {
  clients: PublicClient[]
  account: Address
  vaultIds: string[]
}

async function getSteerAccountPositions({ clients, account, vaultIds }: GetSteerAccountPositions) {
  const accountBalancesP = multichainMulticall({
    clients,
    params: {
      allowFailure: true,
      contracts: vaultIds.map((id) => {
        const { chainId, address } = getChainIdAddressFromId(id)

        return {
          abi: erc20ABI,
          chainId,
          address,
          args: [account] as const,
          functionName: 'balanceOf' as const,
        }
      }),
    },
  })

  const totalSuppliesP = multichainMulticall({
    clients,
    params: {
      allowFailure: true,
      contracts: vaultIds.map((id) => {
        const { chainId, address } = getChainIdAddressFromId(id)

        return {
          abi: erc20ABI,
          chainId,
          address,
          functionName: 'totalSupply' as const,
        }
      }),
    },
  })

  const vaultReservesP = getSteerVaultsReserves({ clients, vaultIds })

  const [accountBalances, totalSupplies, vaultReserves] = await Promise.all([
    accountBalancesP,
    totalSuppliesP,
    vaultReservesP,
  ])

  return vaultIds.map((_, i) => {
    const accountBalance = accountBalances[i].result
    const totalSupply = totalSupplies[i].result
    const vaultReserve = vaultReserves[i]

    if (typeof accountBalance === 'undefined' || typeof totalSupply === 'undefined' || vaultReserve === null)
      return null

    const token0Balance = (vaultReserve.reserve0 * accountBalance) / totalSupply
    const token1Balance = (vaultReserve.reserve1 * accountBalance) / totalSupply

    return {
      steerTokenBalance: accountBalance,
      steerTokenSupply: totalSupply,
      token0Balance,
      token1Balance,
    }
  })
}

interface GetSteerAccountPosition {
  client: PublicClient
  account: Address
  vaultId: string
}

async function getSteerAccountPosition({ client, account, vaultId }: GetSteerAccountPosition) {
  return (await getSteerAccountPositions({ clients: [client], account, vaultIds: [vaultId] }))[0]
}

export { getSteerAccountPosition, getSteerAccountPositions }
