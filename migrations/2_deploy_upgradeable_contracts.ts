import { Network } from './types';
import { deployProxy, admin } from '@openzeppelin/truffle-upgrades';
import {
    ArchitectUpgradeableInstance,
    HeroUpgradeableInstance,
    NFTMarketplaceUpgradeableInstance,
    PFTUpgradeableInstance,
    PorbleUpgradeableInstance,
    VestingVaultUpgradeableInstance,
    PFTStakingUpgradeableInstance,
    GeneralNFTsUpgradeableInstance,
    USDPUpgradeableInstance,
    TokenVaultUpgradeableInstance,
} from '../types/truffle-contracts';

// @NOTE: Remember to reinstate any commented out deployment scripts if you're going to run the corresponding test suite for that contract
// Otherwise the contract state won't be reset after each run and tests will likely fail!

module.exports = (artifacts: Truffle.Artifacts, web3: Web3) => {
    return async (deployer: Truffle.Deployer, network: Network, accounts: string[]) => {
        const multiSigWallet = artifacts.require('MultiSigWallet');
        const owners = [accounts[0], accounts[1], accounts[2]];
        const requiredThreshold = 2;
        await deployer.deploy(multiSigWallet, owners, requiredThreshold);
        const multiSigWalletInstance = await multiSigWallet.deployed();

        // const LZ_ENDPOINT_C_CHAIN = '0x93f54D755A063cE7bB9e6Ac47Eccc8e33411d706';
        // const OPFTExternalUpgradeable = artifacts.require('OPFTExternalUpgradeable');
        // const OPFTExternalUpgradeableTransparentProxyInstance = (await deployProxy(OPFTExternalUpgradeable as any, [LZ_ENDPOINT_C_CHAIN], {
        //     deployer: deployer as any,
        //     initializer: 'initialize',
        // })) as PFTUpgradeableInstance;
        // await OPFTExternalUpgradeableTransparentProxyInstance.addController(multiSigWalletInstance.address);
        // await OPFTExternalUpgradeableTransparentProxyInstance.transferOwnership(multiSigWalletInstance.address);

        if (network === 'testnet') {
            const LZ_ENDPOINT_C_CHAIN = '0x93f54D755A063cE7bB9e6Ac47Eccc8e33411d706';
            const OPFTExternalUpgradeable = artifacts.require('OPFTExternalUpgradeable');
            const OPFTExternalUpgradeableTransparentProxyInstance = (await deployProxy(OPFTExternalUpgradeable as any, [LZ_ENDPOINT_C_CHAIN], {
                deployer: deployer as any,
                initializer: 'initialize',
            })) as PFTUpgradeableInstance;
            await OPFTExternalUpgradeableTransparentProxyInstance.addController(multiSigWalletInstance.address);
            await OPFTExternalUpgradeableTransparentProxyInstance.transferOwnership(multiSigWalletInstance.address);
        } else {
            const LZ_ENDPOINT_PF_CHAIN = '0xd682ECF100f6F4284138AA925348633B0611Ae21';
            const OPFTNativeUpgradeable = artifacts.require('OPFTNativeUpgradeable');
            const OPFTNativeUpgradeableTransparentProxyInstance = (await deployProxy(OPFTNativeUpgradeable as any, [LZ_ENDPOINT_PF_CHAIN], {
                deployer: deployer as any,
                initializer: 'initialize',
            })) as PFTUpgradeableInstance;
            await OPFTNativeUpgradeableTransparentProxyInstance.addController(multiSigWalletInstance.address);
            await OPFTNativeUpgradeableTransparentProxyInstance.transferOwnership(multiSigWalletInstance.address);
        }

        // const TokenVault = artifacts.require('TokenVaultUpgradeable');
        // const TokenVaultUpgradeableTransparentProxyInstance = (await deployProxy(TokenVault as any, [accounts[1]], {
        //     deployer: deployer as any,
        //     initializer: 'initialize',
        // })) as TokenVaultUpgradeableInstance;
        // await TokenVaultUpgradeableTransparentProxyInstance.transferOwnership(multiSigWalletInstance.address);

        // const PFTStaking = artifacts.require('PFTStakingUpgradeable');
        // const PFTStakingUpgradeableTransparentProxyInstance = (await deployProxy(PFTStaking as any, ['1000'], {
        //     deployer: deployer as any,
        //     initializer: 'initialize',
        // })) as PFTStakingUpgradeableInstance;
        // await PFTStakingUpgradeableTransparentProxyInstance.transferOwnership(multiSigWalletInstance.address);

        // const USDPUpgradeable = artifacts.require('USDPUpgradeable');
        // await deployer.deploy<any[]>(USDPUpgradeable, accounts[1], multiSigWalletInstance.address);
        // const USDPUpgradeableTransparentProxyInstance = (await deployProxy(USDPUpgradeable as any, [], {
        //     deployer: deployer as any,
        //     initializer: 'initialize',
        // })) as USDPUpgradeableInstance;
        // await USDPUpgradeableTransparentProxyInstance.transferOwnership(multiSigWalletInstance.address);

        // const heroUpgradeable = artifacts.require('HeroUpgradeable');
        // const heroUpgradeableTransparentProxyInstance = (await deployProxy(
        //     heroUpgradeable as any,
        //     [accounts[1], USDPUpgradeable.address, TokenVaultUpgradeableTransparentProxyInstance.address],
        //     {
        //         deployer: deployer as any,
        //         initializer: 'initialize',
        //     }
        // )) as HeroUpgradeableInstance;
        // await heroUpgradeableTransparentProxyInstance.transferOwnership(multiSigWalletInstance.address);

        // const architectUpgradeable = artifacts.require('ArchitectUpgradeable');
        // const architectUpgradeableTransparentProxyInstance = (await deployProxy(
        //     architectUpgradeable as any,
        //     [accounts[1], USDPUpgradeable.address, TokenVaultUpgradeableTransparentProxyInstance.address],
        //     {
        //         deployer: deployer as any,
        //         initializer: 'initialize',
        //     }
        // )) as ArchitectUpgradeableInstance;
        // await architectUpgradeableTransparentProxyInstance.transferOwnership(multiSigWalletInstance.address);

        // const generalNFTsUpgradeable = artifacts.require('GeneralNFTsUpgradeable');
        // const generalNFTsUpgradeableTransparentProxyInstance = (await deployProxy(
        //     generalNFTsUpgradeable as any,
        //     [accounts[1], USDPUpgradeable.address, TokenVaultUpgradeableTransparentProxyInstance.address],
        //     {
        //         deployer: deployer as any,
        //         initializer: 'initialize',
        //     }
        // )) as GeneralNFTsUpgradeableInstance;
        // await generalNFTsUpgradeableTransparentProxyInstance.transferOwnership(multiSigWalletInstance.address);

        // const porbleUpgradeable = artifacts.require('PorbleUpgradeable');
        // const porbleUpgradeableTransparentProxyInstance = (await deployProxy(porbleUpgradeable as any, [accounts[1], TokenVaultUpgradeableTransparentProxyInstance.address], {
        //     deployer: deployer as any,
        //     initializer: 'initialize',
        // })) as PorbleUpgradeableInstance;
        // await porbleUpgradeableTransparentProxyInstance.transferOwnership(multiSigWalletInstance.address);

        // const NFTMarketplaceUpgradeable = artifacts.require('NFTMarketplaceUpgradeable');
        // const NFTMarketplaceUpgradeableTransparentProxyInstance = (await deployProxy(NFTMarketplaceUpgradeable as any, [USDPUpgradeableTransparentProxyInstance.address], {
        //     deployer: deployer as any,
        //     initializer: 'initialize',
        // })) as NFTMarketplaceUpgradeableInstance;
        // await NFTMarketplaceUpgradeableTransparentProxyInstance.updateCollectionsWhitelist(heroUpgradeableTransparentProxyInstance.address, true);
        // await NFTMarketplaceUpgradeableTransparentProxyInstance.updateCollectionsWhitelist(architectUpgradeableTransparentProxyInstance.address, true);
        // await NFTMarketplaceUpgradeableTransparentProxyInstance.updateCollectionsWhitelist(porbleUpgradeableTransparentProxyInstance.address, true);
        // await NFTMarketplaceUpgradeableTransparentProxyInstance.updateCollectionsWhitelist(generalNFTsUpgradeableTransparentProxyInstance.address, true);
        // await NFTMarketplaceUpgradeableTransparentProxyInstance.transferOwnership(multiSigWalletInstance.address);

        // const VestingVaultUpgradeable = artifacts.require('VestingVaultUpgradeable');
        // const vestingVaultUpgradeableTransparentProxyInstance = (await deployProxy(
        //     VestingVaultUpgradeable as any,
        //     [(OPFTNativeUpgradeableTransparentProxyInstance as any).address],
        //     {
        //         deployer: deployer as any,
        //         initializer: 'initialize',
        //     }
        // )) as VestingVaultUpgradeableInstance;
        // await vestingVaultUpgradeableTransparentProxyInstance.transferOwnership(multiSigWalletInstance.address);

        // Transfer proxy admin ownership to the MultiSigWallet so that upgrades can only be done via a multisig
        // Not running in local test environments in order to prevent the tests from breaking (since the tests repeatedly call this function)
        if (network !== 'development' && network !== 'developmentGanache') {
            await admin.transferProxyAdminOwnership(multiSigWallet.address);
        }
    };
};
