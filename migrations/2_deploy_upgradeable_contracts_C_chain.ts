import { Network } from './types';
import { deployProxy, admin } from '@openzeppelin/truffle-upgrades';
import {
    NFTMarketplaceUpgradeableInstance,
    VestingVaultUpgradeableInstance,
    PFTStakingUpgradeableInstance,
    USDPUpgradeableInstance,
    TokenVaultExternalUpgradeableInstance,
    PorbleONFTExternalUpgradeableInstance,
    OPFTExternalUpgradeableInstance,
    HeroONFTExternalUpgradeableInstance,
    ArchitectONFTExternalUpgradeableInstance,
    GeneralONFTsExternalUpgradeableInstance,
} from '../types/truffle-contracts';

// @NOTE: Remember to reinstate any commented out deployment scripts if you're going to run the corresponding test suite for that contract
// Otherwise the contract state won't be reset after each run and tests will likely fail!

const LZ_ENDPOINT_C_CHAIN = '0x93f54D755A063cE7bB9e6Ac47Eccc8e33411d706';

module.exports = (artifacts: Truffle.Artifacts, web3: Web3) => {
    return async (deployer: Truffle.Deployer, network: Network, accounts: string[]) => {
        const multiSigWallet = artifacts.require('MultiSigWallet');
        const owners = [accounts[0], accounts[1], accounts[2]];
        const requiredThreshold = 2;
        await deployer.deploy(multiSigWallet, owners, requiredThreshold);
        const multiSigWalletInstance = await multiSigWallet.deployed();

        const PFTUpgradeable = artifacts.require('OPFTExternalUpgradeable');
        const PFTUpgradeableTransparentProxyInstance = (await deployProxy(PFTUpgradeable as any, [LZ_ENDPOINT_C_CHAIN], {
            deployer: deployer as any,
            initializer: 'initialize',
        })) as OPFTExternalUpgradeableInstance;
        await PFTUpgradeableTransparentProxyInstance.transferOwnership(multiSigWalletInstance.address);

        const TokenVault = artifacts.require('TokenVaultExternalUpgradeable');
        const TokenVaultExternalUpgradeableTransparentProxyInstance = (await deployProxy(TokenVault as any, [accounts[1]], {
            deployer: deployer as any,
            initializer: 'initialize',
        })) as TokenVaultExternalUpgradeableInstance;
        await TokenVaultExternalUpgradeableTransparentProxyInstance.transferOwnership(multiSigWalletInstance.address);

        // @TODO: Only including the staking contract here because we're testing indexing on the C-chain. Can remove this when the indexer is set up for the PF-chain
        // const PFTStaking = artifacts.require('PFTStakingUpgradeable');
        // const PFTStakingUpgradeableTransparentProxyInstance = (await deployProxy(PFTStaking as any, ['1000'], {
        //     deployer: deployer as any,
        //     initializer: 'initialize',
        // })) as PFTStakingUpgradeableInstance;
        // await PFTStakingUpgradeableTransparentProxyInstance.transferOwnership(multiSigWalletInstance.address);

        const USDPUpgradeable = artifacts.require('USDPUpgradeable');
        const USDPUpgradeableTransparentProxyInstance = (await deployProxy(USDPUpgradeable as any, [], {
            deployer: deployer as any,
            initializer: 'initialize',
        })) as USDPUpgradeableInstance;
        await USDPUpgradeableTransparentProxyInstance.transferOwnership(multiSigWalletInstance.address);

        const heroUpgradeable = artifacts.require('HeroONFTExternalUpgradeable');
        const heroUpgradeableTransparentProxyInstance = (await deployProxy(
            heroUpgradeable as any,
            [TokenVaultExternalUpgradeableTransparentProxyInstance.address, LZ_ENDPOINT_C_CHAIN],
            {
                deployer: deployer as any,
                initializer: 'initialize',
            }
        )) as HeroONFTExternalUpgradeableInstance;
        await heroUpgradeableTransparentProxyInstance.transferOwnership(multiSigWalletInstance.address);

        const architectUpgradeable = artifacts.require('ArchitectONFTExternalUpgradeable');
        const architectUpgradeableTransparentProxyInstance = (await deployProxy(
            architectUpgradeable as any,
            [TokenVaultExternalUpgradeableTransparentProxyInstance.address, LZ_ENDPOINT_C_CHAIN],
            {
                deployer: deployer as any,
                initializer: 'initialize',
            }
        )) as ArchitectONFTExternalUpgradeableInstance;
        await architectUpgradeableTransparentProxyInstance.transferOwnership(multiSigWalletInstance.address);

        const generalNFTsUpgradeable = artifacts.require('GeneralONFTsExternalUpgradeable');
        const generalNFTsUpgradeableTransparentProxyInstance = (await deployProxy(
            generalNFTsUpgradeable as any,
            [TokenVaultExternalUpgradeableTransparentProxyInstance.address, LZ_ENDPOINT_C_CHAIN],
            {
                deployer: deployer as any,
                initializer: 'initialize',
            }
        )) as GeneralONFTsExternalUpgradeableInstance;
        await generalNFTsUpgradeableTransparentProxyInstance.transferOwnership(multiSigWalletInstance.address);

        const porbleUpgradeable = artifacts.require('PorbleONFTExternalUpgradeable');
        const porbleUpgradeableTransparentProxyInstance = (await deployProxy(
            porbleUpgradeable as any,
            [TokenVaultExternalUpgradeableTransparentProxyInstance.address, LZ_ENDPOINT_C_CHAIN],
            {
                deployer: deployer as any,
                initializer: 'initialize',
            }
        )) as PorbleONFTExternalUpgradeableInstance;
        await porbleUpgradeableTransparentProxyInstance.transferOwnership(multiSigWalletInstance.address);

        // @TODO: Only including the marketplace contract because we're testing indexing on the C-chain. Can remove this when the indexer is set up for the PF-chain
        const NFTMarketplaceUpgradeable = artifacts.require('NFTMarketplaceUpgradeable');
        const NFTMarketplaceUpgradeableTransparentProxyInstance = (await deployProxy(NFTMarketplaceUpgradeable as any, [USDPUpgradeableTransparentProxyInstance.address], {
            deployer: deployer as any,
            initializer: 'initialize',
        })) as NFTMarketplaceUpgradeableInstance;
        await NFTMarketplaceUpgradeableTransparentProxyInstance.updateCollectionsWhitelist(heroUpgradeableTransparentProxyInstance.address, true);
        await NFTMarketplaceUpgradeableTransparentProxyInstance.updateCollectionsWhitelist(architectUpgradeableTransparentProxyInstance.address, true);
        await NFTMarketplaceUpgradeableTransparentProxyInstance.updateCollectionsWhitelist(porbleUpgradeableTransparentProxyInstance.address, true);
        await NFTMarketplaceUpgradeableTransparentProxyInstance.updateCollectionsWhitelist(generalNFTsUpgradeableTransparentProxyInstance.address, true);
        await NFTMarketplaceUpgradeableTransparentProxyInstance.transferOwnership(multiSigWalletInstance.address);

        const VestingVaultUpgradeable = artifacts.require('VestingVaultUpgradeable');
        const vestingVaultUpgradeableTransparentProxyInstance = (await deployProxy(VestingVaultUpgradeable as any, [(PFTUpgradeableTransparentProxyInstance as any).address], {
            deployer: deployer as any,
            initializer: 'initialize',
        })) as VestingVaultUpgradeableInstance;
        await vestingVaultUpgradeableTransparentProxyInstance.transferOwnership(multiSigWalletInstance.address);

        // Transfer proxy admin ownership to the MultiSigWallet so that upgrades can only be done via a multisig
        // Not running in local test environments in order to prevent the tests from breaking (since the tests repeatedly call this function)
        if (network !== 'development' && network !== 'developmentGanache') {
            await admin.transferProxyAdminOwnership(multiSigWallet.address);
        }
    };
};
