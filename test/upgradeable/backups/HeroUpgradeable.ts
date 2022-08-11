import { deployProxy, upgradeProxy } from '@openzeppelin/truffle-upgrades';
import bigInt from 'big-integer';
import { localExpect } from '../../lib/test-libraries';
import { HeroUpgradeableInstance, USDPUpgradeableInstance, MultiSigWalletInstance, HeroUpgradeableTestInstance } from '../../../types/truffle-contracts';
import HERO_UPGRADEABLE_JSON from '../../../build/contracts/HeroUpgradeable.json';
import USDP_UPGRADEABLE_JSON from '../../../build/contracts/USDPUpgradeable.json';
import Web3 from 'web3';
import { AbiItem } from 'web3-utils';
import { getTxIdFromMultiSigWallet } from '../../lib/test-helpers';

const ethers = require('ethers');
const testAccountsData = require('../../../test/data/test-accounts-data').testAccountsData;
const config = require('../../../config').config;

const heroUpgradeable = artifacts.require('HeroUpgradeable');
const USDPUpgradeable = artifacts.require('USDPUpgradeable');
const multiSigWallet = artifacts.require('MultiSigWallet');
const heroUpgradeableTest = artifacts.require('HeroUpgradeableTest');

const web3 = new Web3(new Web3.providers.HttpProvider(config.AVAX.localSubnetHTTP));
const HERO_UPGRADEABLE_ABI = HERO_UPGRADEABLE_JSON.abi as AbiItem[];
const USDP_UPGRADEABLE_ABI = USDP_UPGRADEABLE_JSON.abi as AbiItem[];

const rpcEndpoint = config.AVAX.localSubnetHTTP;
const provider = new ethers.providers.JsonRpcProvider(rpcEndpoint);
const signer = new ethers.Wallet(testAccountsData[1].privateKey, provider);

contract.skip('HeroUpgradeable.sol', ([owner, account1, account2, account3, account4, account5, account6, account7, account8, account9]) => {
    let heroUpgradeableInstance: HeroUpgradeableInstance;
    let USDPUpgradeableInstance: USDPUpgradeableInstance;
    let multiSigWalletInstance: MultiSigWalletInstance;
    let heroUpgradeableTestInstance: HeroUpgradeableTestInstance;
    let heroUpgradeableContract: any;
    let USDPUpgradeableContract: any;

    beforeEach(async () => {
        // Require 2 signatures for multiSig
        multiSigWalletInstance = await multiSigWallet.new([owner, account1, account2], 2);
        USDPUpgradeableInstance = (await deployProxy(USDPUpgradeable as any, [], {
            initializer: 'initialize',
        })) as USDPUpgradeableInstance;
        heroUpgradeableInstance = (await deployProxy(heroUpgradeable as any, [account1, USDPUpgradeableInstance.address, account9], {
            initializer: 'initialize',
        })) as HeroUpgradeableInstance;
        await USDPUpgradeableInstance.transferOwnership(multiSigWalletInstance.address);
        await heroUpgradeableInstance.transferOwnership(multiSigWalletInstance.address);

        heroUpgradeableContract = new web3.eth.Contract(HERO_UPGRADEABLE_ABI, heroUpgradeableInstance.address);
        USDPUpgradeableContract = new web3.eth.Contract(USDP_UPGRADEABLE_ABI, USDPUpgradeableInstance.address);
    });

    it("has token name set to 'Portal Fantasy Hero'", async () => {
        const tokenName = await heroUpgradeableInstance.name();
        expect(tokenName).to.equal('Portal Fantasy Hero');
    });

    it("has token symbol set to 'PHRO'", async () => {
        const tokenSymbol = await heroUpgradeableInstance.symbol();
        expect(tokenSymbol).to.equal('PHRO');
    });

    it('can only be paused/unpaused by the owner (multiSigWallet)', async () => {
        let isPaused = await heroUpgradeableInstance.paused();
        expect(isPaused).to.be.false;

        // Non-owner account attempting to pause should fail
        await localExpect(heroUpgradeableInstance.setPaused(true, { from: account1 })).to.be.rejected;

        let data = heroUpgradeableContract.methods.setPaused(true).encodeABI();
        await multiSigWalletInstance.submitTransaction(heroUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        isPaused = await heroUpgradeableInstance.paused();
        expect(isPaused).to.be.true;

        // Non-owner account attempting to unpause should fail
        await localExpect(heroUpgradeableInstance.setPaused(false, { from: account1 })).to.be.rejected;

        data = heroUpgradeableContract.methods.setPaused(false).encodeABI();
        await multiSigWalletInstance.submitTransaction(heroUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        isPaused = await heroUpgradeableInstance.paused();
        expect(isPaused).to.be.false;
    });

    it('allows a hero token to be minted if the signature is successfully verified. With payment in USDP', async () => {
        const types = {
            HeroMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenIds', type: 'uint256[]' },
                { name: 'tokenPrices', type: 'uint256[]' },
            ],
        };

        const tokenIds = ['1'];
        const tokenPrices = [web3.utils.toWei('1', 'ether')];
        const heroMintConditions = { minter: testAccountsData[1].address, tokenIds, tokenPrices };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: heroUpgradeableInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, heroMintConditions);

        const initialUSDPAmountMintedToBuyer = web3.utils.toWei('1000000000', 'ether');

        // Add controller for USDP
        let data = USDPUpgradeableContract.methods.addController(multiSigWalletInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Mint USDP
        data = USDPUpgradeableContract.methods.mint(account1, initialUSDPAmountMintedToBuyer).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        const USDPAmountToApprove = tokenPrices.reduce((acc, tokenPrice) => bigInt(acc).add(tokenPrice).toString());
        await USDPUpgradeableInstance.approve(heroUpgradeableInstance.address, USDPAmountToApprove, { from: account1 });

        // The tokenId and tx sender must match those that have been signed for
        await localExpect(heroUpgradeableInstance.safeMintTokens(signature, ['1'], tokenPrices, { from: testAccountsData[1].address })).to.eventually.be.fulfilled;
        expect(await heroUpgradeableInstance.ownerOf('1')).to.equal(testAccountsData[1].address);

        const balanceOfUSDPVault = (await USDPUpgradeableInstance.balanceOf(account9)).toString();
        expect(balanceOfUSDPVault).to.equal(USDPAmountToApprove);
    });

    it('allows multiple hero tokens to be minted at different prices, if the signature is successfully verified. With payment in USDP', async () => {
        const types = {
            HeroMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenIds', type: 'uint256[]' },
                { name: 'tokenPrices', type: 'uint256[]' },
            ],
        };

        const tokenIds = ['1', '100', '1234'];
        const tokenPrices = [web3.utils.toWei('1', 'ether'), web3.utils.toWei('2', 'ether'), web3.utils.toWei('3', 'ether')];
        const heroMintConditions = { minter: testAccountsData[1].address, tokenIds, tokenPrices };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: heroUpgradeableInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, heroMintConditions);

        const initialUSDPAmountMintedToBuyer = web3.utils.toWei('1000000000', 'ether');

        // Add controller for USDP
        let data = USDPUpgradeableContract.methods.addController(multiSigWalletInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Mint USDP
        data = USDPUpgradeableContract.methods.mint(account1, initialUSDPAmountMintedToBuyer).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        const USDPAmountToApprove = tokenPrices.reduce((acc, tokenPrice) => bigInt(acc).add(tokenPrice).toString());
        await USDPUpgradeableInstance.approve(heroUpgradeableInstance.address, USDPAmountToApprove, { from: account1 });

        // The tokenId and tx sender must match those that have been signed for
        await localExpect(heroUpgradeableInstance.safeMintTokens(signature, tokenIds, tokenPrices, { from: testAccountsData[1].address })).to.eventually.be.fulfilled;
        expect(await heroUpgradeableInstance.ownerOf('1')).to.equal(testAccountsData[1].address);
        expect(await heroUpgradeableInstance.ownerOf('100')).to.equal(testAccountsData[1].address);
        expect(await heroUpgradeableInstance.ownerOf('1234')).to.equal(testAccountsData[1].address);

        const balanceOfUSDPVault = (await USDPUpgradeableInstance.balanceOf(account9)).toString();
        expect(balanceOfUSDPVault).to.equal(USDPAmountToApprove);
    });

    it('only allows the owner (multiSigWallet) to change the USDP contract address', async () => {
        const newUSDPUpgradeableInstance = (await deployProxy(USDPUpgradeable as any, [], {
            initializer: 'initialize',
        })) as USDPUpgradeableInstance;

        // Should fail since caller is not the owner
        await localExpect(heroUpgradeableInstance.setUSDP(newUSDPUpgradeableInstance.address, { from: account1 })).to.eventually.be.rejected;

        const data = heroUpgradeableContract.methods.setUSDP(newUSDPUpgradeableInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(heroUpgradeableInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        const contractUSDPAddress = (await heroUpgradeableInstance.USDP()).toString();
        expect(contractUSDPAddress).to.equal(newUSDPUpgradeableInstance.address);
    });

    it('only allows the owner (multiSigWallet) to change the USDP vault', async () => {
        // Should fail since caller is not the owner
        await localExpect(heroUpgradeableInstance.setVault(account2, { from: account1 })).to.eventually.be.rejected;

        const data = heroUpgradeableContract.methods.setVault(account2).encodeABI();
        await multiSigWalletInstance.submitTransaction(heroUpgradeableInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        const contractUSDPVault = (await heroUpgradeableInstance.vault()).toString();
        expect(contractUSDPVault).to.equal(account2);
    });

    // @TODO: Update this test when we have the final base URI implemented in the contract
    it('generates a valid token URI', async () => {
        const types = {
            HeroMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenIds', type: 'uint256[]' },
                { name: 'tokenPrices', type: 'uint256[]' },
            ],
        };

        const tokenIds = ['1'];
        const priceOfHeroInUSDP = web3.utils.toWei('1', 'ether');
        const tokenPrices = [priceOfHeroInUSDP];
        const heroMintConditions = { minter: testAccountsData[1].address, tokenIds, tokenPrices };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: heroUpgradeableInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, heroMintConditions);

        const initialUSDPAmountMintedToOwner = web3.utils.toWei('1000000000', 'ether');

        // Add controller for USDP
        let data = USDPUpgradeableContract.methods.addController(multiSigWalletInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Mint USDP
        data = USDPUpgradeableContract.methods.mint(account1, initialUSDPAmountMintedToOwner).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        await USDPUpgradeableInstance.approve(heroUpgradeableInstance.address, priceOfHeroInUSDP, { from: account1 });
        await heroUpgradeableInstance.safeMintTokens(signature, tokenIds, tokenPrices, { from: account1 });

        const tokenURI = await heroUpgradeableInstance.tokenURI('1');
        expect(tokenURI).to.equal('https://www.portalfantasy.io/1');
    });

    it('allows only the owner (multiSigWallet) to change the base URI', async () => {
        const types = {
            HeroMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenIds', type: 'uint256[]' },
                { name: 'tokenPrices', type: 'uint256[]' },
            ],
        };

        const tokenIds = ['1'];
        const tokenPrices = [web3.utils.toWei('1', 'ether')];
        const heroMintConditions = { minter: testAccountsData[1].address, tokenIds, tokenPrices };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: heroUpgradeableInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, heroMintConditions);

        const initialUSDPAmountMintedToOwner = web3.utils.toWei('1000000000', 'ether');

        // Add controller for USDP
        let data = USDPUpgradeableContract.methods.addController(multiSigWalletInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Mint USDP
        data = USDPUpgradeableContract.methods.mint(account1, initialUSDPAmountMintedToOwner).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        const USDPAmountToApprove = tokenPrices.reduce((acc, tokenPrice) => bigInt(acc).add(tokenPrice).toString());
        await USDPUpgradeableInstance.approve(heroUpgradeableInstance.address, USDPAmountToApprove, { from: account1 });
        await heroUpgradeableInstance.safeMintTokens(signature, tokenIds, tokenPrices, { from: account1 });

        let tokenURI = await heroUpgradeableInstance.tokenURI('1');
        expect(tokenURI).to.equal('https://www.portalfantasy.io/1');

        // Expect this to fail, as only the owner can change the base URI
        await localExpect(heroUpgradeableInstance.setBaseURIString('https://www.foo.com/', { from: account1 })).to.eventually.be.rejected;

        data = heroUpgradeableContract.methods.setBaseURIString('https://www.bar.com/').encodeABI();
        await multiSigWalletInstance.submitTransaction(heroUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        tokenURI = await heroUpgradeableInstance.tokenURI('1');
        expect(tokenURI).to.equal('https://www.bar.com/1');
    });

    it('allows only the owner (multiSigWallet) to change the contract URI', async () => {
        let contractURI = await heroUpgradeableInstance.contractURI();
        expect(contractURI).to.equal('https://www.portalfantasy.io/hero/');

        // Expect this to fail, as only the owner can change the base URI
        await localExpect(heroUpgradeableInstance.setContractURIString('https://www.foo.com/hero/', { from: account1 })).to.eventually.be.rejected;

        const data = heroUpgradeableContract.methods.setContractURIString('https://www.bar.com/hero/').encodeABI();
        await multiSigWalletInstance.submitTransaction(heroUpgradeableInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        contractURI = await heroUpgradeableInstance.contractURI();
        expect(contractURI).to.equal('https://www.bar.com/hero/');
    });

    it('applies the default royalty correctly', async () => {
        const types = {
            HeroMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenIds', type: 'uint256[]' },
                { name: 'tokenPrices', type: 'uint256[]' },
            ],
        };

        const tokenIds = ['1'];
        const priceOfHeroInUSDP = web3.utils.toWei('1', 'ether');
        const tokenPrices = [priceOfHeroInUSDP];
        const heroMintConditions = { minter: testAccountsData[1].address, tokenIds, tokenPrices };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: heroUpgradeableInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, heroMintConditions);

        const initialUSDPAmountMintedToOwner = web3.utils.toWei('1000000000', 'ether');

        // Add controller for USDP
        let data = USDPUpgradeableContract.methods.addController(multiSigWalletInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Mint USDP
        data = USDPUpgradeableContract.methods.mint(account1, initialUSDPAmountMintedToOwner).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        const USDPAmountToApprove = tokenPrices.reduce((acc, tokenPrice) => bigInt(acc).add(tokenPrice).toString());
        await USDPUpgradeableInstance.approve(heroUpgradeableInstance.address, USDPAmountToApprove, { from: account1 });
        await heroUpgradeableInstance.safeMintTokens(signature, tokenIds, tokenPrices, { from: account1 });

        // Assert expected royalty parameters
        let defaultRoyaltyInfo = await heroUpgradeableInstance.royaltyInfo('0', priceOfHeroInUSDP);
        const royaltyRecipient = defaultRoyaltyInfo[0];
        const royaltyFee = defaultRoyaltyInfo[1];
        const expectedRoyalFeeNumeratorBips = 400;
        expect(royaltyRecipient).to.equal(account9);
        expect(royaltyFee.toString()).to.equal(bigInt(priceOfHeroInUSDP).multiply(expectedRoyalFeeNumeratorBips).divide(10000).toString());
    });

    it('allows only the owner to change the default royalty fee', async () => {
        const types = {
            HeroMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenIds', type: 'uint256[]' },
                { name: 'tokenPrices', type: 'uint256[]' },
            ],
        };

        const tokenIds = ['1'];
        const priceOfHeroInUSDP = web3.utils.toWei('1', 'ether');
        const tokenPrices = [priceOfHeroInUSDP];
        const heroMintConditions = { minter: testAccountsData[1].address, tokenIds, tokenPrices };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: heroUpgradeableInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, heroMintConditions);

        const initialUSDPAmountMintedToOwner = web3.utils.toWei('1000000000', 'ether');

        // Add controller for USDP
        let data = USDPUpgradeableContract.methods.addController(multiSigWalletInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Mint USDP
        data = USDPUpgradeableContract.methods.mint(account1, initialUSDPAmountMintedToOwner).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        const USDPAmountToApprove = tokenPrices.reduce((acc, tokenPrice) => bigInt(acc).add(tokenPrice).toString());
        await USDPUpgradeableInstance.approve(heroUpgradeableInstance.address, USDPAmountToApprove, { from: account1 });
        await heroUpgradeableInstance.safeMintTokens(signature, tokenIds, tokenPrices, { from: account1 });

        // Expect this to fail, as only the owner can change the base URI
        await localExpect(heroUpgradeableInstance.setDefaultRoyalty(300, { from: account1 })).to.eventually.be.rejected;

        const updatedRoyaltyFeeBips = 100;
        data = heroUpgradeableContract.methods.setDefaultRoyalty(updatedRoyaltyFeeBips).encodeABI();
        await multiSigWalletInstance.submitTransaction(heroUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        // Assert expected royalty parameters
        let defaultRoyaltyInfo = await heroUpgradeableInstance.royaltyInfo('0', priceOfHeroInUSDP);
        const royaltyRecipient = defaultRoyaltyInfo[0];
        const royaltyFee = defaultRoyaltyInfo[1];
        expect(royaltyRecipient).to.equal(account9);
        expect(royaltyFee.toString()).to.equal(bigInt(priceOfHeroInUSDP).multiply(updatedRoyaltyFeeBips).divide(10000).toString());
    });

    it('allows only the owner to change the token custom royalty fee', async () => {
        const types = {
            HeroMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenIds', type: 'uint256[]' },
                { name: 'tokenPrices', type: 'uint256[]' },
            ],
        };

        const tokenIds = ['1'];
        const priceOfHeroInUSDP = web3.utils.toWei('1', 'ether');
        const tokenPrices = [priceOfHeroInUSDP];
        const heroMintConditions = { minter: testAccountsData[1].address, tokenIds, tokenPrices };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: heroUpgradeableInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, heroMintConditions);

        const initialUSDPAmountMintedToOwner = web3.utils.toWei('1000000000', 'ether');

        // Add controller for USDP
        let data = USDPUpgradeableContract.methods.addController(multiSigWalletInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Mint USDP
        data = USDPUpgradeableContract.methods.mint(account1, initialUSDPAmountMintedToOwner).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        const USDPAmountToApprove = tokenPrices.reduce((acc, tokenPrice) => bigInt(acc).add(tokenPrice).toString());
        await USDPUpgradeableInstance.approve(heroUpgradeableInstance.address, USDPAmountToApprove, { from: account1 });
        await heroUpgradeableInstance.safeMintTokens(signature, tokenIds, tokenPrices, { from: account1 });

        // Expect this to fail, as only the owner can change the base URI
        await localExpect(heroUpgradeableInstance.setTokenRoyalty('0', 300, { from: account1 })).to.eventually.be.rejected;

        const updatedRoyaltyFeeBips = 100;
        data = heroUpgradeableContract.methods.setTokenRoyalty('0', updatedRoyaltyFeeBips).encodeABI();
        await multiSigWalletInstance.submitTransaction(heroUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        // Assert expected royalty parameters
        let defaultRoyaltyInfo = await heroUpgradeableInstance.royaltyInfo('0', priceOfHeroInUSDP);
        const royaltyRecipient = defaultRoyaltyInfo[0];
        const royaltyFee = defaultRoyaltyInfo[1];
        expect(royaltyRecipient).to.equal(account9);
        expect(royaltyFee.toString()).to.equal(bigInt(priceOfHeroInUSDP).multiply(updatedRoyaltyFeeBips).divide(10000).toString());
    });

    it('allows only the owner to reset the custom royalty fee', async () => {
        const types = {
            HeroMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenIds', type: 'uint256[]' },
                { name: 'tokenPrices', type: 'uint256[]' },
            ],
        };

        const tokenIds = ['1'];
        const priceOfHeroInUSDP = web3.utils.toWei('1', 'ether');
        const tokenPrices = [priceOfHeroInUSDP];
        const heroMintConditions = { minter: testAccountsData[1].address, tokenIds, tokenPrices };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: heroUpgradeableInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, heroMintConditions);

        const initialUSDPAmountMintedToOwner = web3.utils.toWei('1000000000', 'ether');

        // Add controller for USDP
        let data = USDPUpgradeableContract.methods.addController(multiSigWalletInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Mint USDP
        data = USDPUpgradeableContract.methods.mint(account1, initialUSDPAmountMintedToOwner).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        const USDPAmountToApprove = tokenPrices.reduce((acc, tokenPrice) => bigInt(acc).add(tokenPrice).toString());
        await USDPUpgradeableInstance.approve(heroUpgradeableInstance.address, USDPAmountToApprove, { from: account1 });
        await heroUpgradeableInstance.safeMintTokens(signature, tokenIds, tokenPrices, { from: account1 });

        const updatedRoyaltyFeeBips = 100;
        data = heroUpgradeableContract.methods.setTokenRoyalty('0', updatedRoyaltyFeeBips).encodeABI();
        await multiSigWalletInstance.submitTransaction(heroUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        // Expect this to fail, as only the owner can change the base URI
        await localExpect(heroUpgradeableInstance.resetTokenRoyalty('0', { from: account1 })).to.eventually.be.rejected;

        data = heroUpgradeableContract.methods.resetTokenRoyalty('0').encodeABI();
        await multiSigWalletInstance.submitTransaction(heroUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        // Assert expected royalty parameters
        let defaultRoyaltyInfo = await heroUpgradeableInstance.royaltyInfo('0', priceOfHeroInUSDP);
        const royaltyRecipient = defaultRoyaltyInfo[0];
        const royaltyFee = defaultRoyaltyInfo[1];
        const expectedRoyalFeeNumeratorBips = 400;
        expect(royaltyRecipient).to.equal(account9);
        expect(royaltyFee.toString()).to.equal(bigInt(priceOfHeroInUSDP).multiply(expectedRoyalFeeNumeratorBips).divide(10000).toString());
    });

    it('reverts if the same signature is used multiple times', async () => {
        const types = {
            HeroMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenIds', type: 'uint256[]' },
                { name: 'tokenPrices', type: 'uint256[]' },
            ],
        };

        const tokenIds = ['1'];
        const priceOfHeroInUSDP = web3.utils.toWei('1', 'ether');
        const tokenPrices = [priceOfHeroInUSDP];
        const heroMintConditions = { minter: testAccountsData[1].address, tokenIds, tokenPrices };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: heroUpgradeableInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, heroMintConditions);

        // Add controller for USDP
        let data = USDPUpgradeableContract.methods.addController(multiSigWalletInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Mint enough USDP to potentially buy two heroes
        data = USDPUpgradeableContract.methods.mint(account1, bigInt(priceOfHeroInUSDP).multiply(2).toString()).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        const USDPAmountToApprove = tokenPrices.reduce((acc, tokenPrice) => bigInt(acc).add(tokenPrice).toString());
        await USDPUpgradeableInstance.approve(heroUpgradeableInstance.address, USDPAmountToApprove, { from: account1 });

        // The tokenId and tx sender must match those that have been signed for
        await localExpect(heroUpgradeableInstance.safeMintTokens(signature, tokenIds, tokenPrices, { from: testAccountsData[1].address })).to.eventually.be.fulfilled;

        await localExpect(heroUpgradeableInstance.safeMintTokens(signature, tokenIds, tokenPrices, { from: testAccountsData[1].address })).to.eventually.be.rejected;
    });

    it("prevents a hero token from being minted if the 'HeroMintConditions' key doesn't match the name of the object hard-coded in the contract", async () => {
        const types = {
            HeroMintConditionsWrong: [
                { name: 'minter', type: 'address' },
                { name: 'tokenIds', type: 'uint256[]' },
                { name: 'tokenPrices', type: 'uint256[]' },
            ],
        };

        const tokenIds = ['2'];
        const priceOfHeroInUSDP = web3.utils.toWei('1', 'ether');
        const tokenPrices = [priceOfHeroInUSDP];
        const heroMintConditions = { minter: testAccountsData[1].address, tokenIds, tokenPrices };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: heroUpgradeableInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, heroMintConditions);

        // Add controller for USDP
        let data = USDPUpgradeableContract.methods.addController(multiSigWalletInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Mint enough USDP to buy a hero
        data = USDPUpgradeableContract.methods.mint(account1, priceOfHeroInUSDP).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        const USDPAmountToApprove = tokenPrices.reduce((acc, tokenPrice) => bigInt(acc).add(tokenPrice).toString());
        await USDPUpgradeableInstance.approve(heroUpgradeableInstance.address, USDPAmountToApprove, { from: account1 });

        // The tokenId and tx sender must match those that have been signed for
        await localExpect(heroUpgradeableInstance.safeMintTokens(signature, tokenIds, tokenPrices, { from: testAccountsData[1].address })).to.eventually.be.rejected;
    });

    it("prevents a hero token from being minted if the domain name doesn't match the string passed into the contract's constructor", async () => {
        const types = {
            HeroMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenIds', type: 'uint256[]' },
                { name: 'tokenPrices', type: 'uint256[]' },
            ],
        };

        const tokenIds = ['2'];
        const priceOfHeroInUSDP = web3.utils.toWei('1', 'ether');
        const tokenPrices = [priceOfHeroInUSDP];
        const heroMintConditions = { minter: testAccountsData[1].address, tokenIds, tokenPrices };

        const domain = {
            name: 'PortalFantasyWrong',
            version: '1',
            chainId: 43214,
            verifyingContract: heroUpgradeableInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, heroMintConditions);

        // Add controller for USDP
        let data = USDPUpgradeableContract.methods.addController(multiSigWalletInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Mint enough USDP to buy a hero
        data = USDPUpgradeableContract.methods.mint(account1, priceOfHeroInUSDP).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        const USDPAmountToApprove = tokenPrices.reduce((acc, tokenPrice) => bigInt(acc).add(tokenPrice).toString());
        await USDPUpgradeableInstance.approve(heroUpgradeableInstance.address, USDPAmountToApprove, { from: account1 });

        // The tokenId and tx sender must match those that have been signed for
        await localExpect(heroUpgradeableInstance.safeMintTokens(signature, tokenIds, tokenPrices, { from: testAccountsData[1].address })).to.eventually.be.rejected;
    });

    it("prevents a hero token from being minted if the domain version doesn't match the string passed into the contract's constructor", async () => {
        const types = {
            HeroMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenIds', type: 'uint256[]' },
                { name: 'tokenPrices', type: 'uint256[]' },
            ],
        };

        const tokenIds = ['2'];
        const priceOfHeroInUSDP = web3.utils.toWei('1', 'ether');
        const tokenPrices = [priceOfHeroInUSDP];
        const heroMintConditions = { minter: testAccountsData[1].address, tokenIds, tokenPrices };

        const domain = {
            name: 'PortalFantasy',
            version: '9',
            chainId: 43214,
            verifyingContract: heroUpgradeableInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, heroMintConditions);

        // Add controller for USDP
        let data = USDPUpgradeableContract.methods.addController(multiSigWalletInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Mint enough USDP to buy a hero
        data = USDPUpgradeableContract.methods.mint(account1, priceOfHeroInUSDP).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        const USDPAmountToApprove = tokenPrices.reduce((acc, tokenPrice) => bigInt(acc).add(tokenPrice).toString());
        await USDPUpgradeableInstance.approve(heroUpgradeableInstance.address, USDPAmountToApprove, { from: account1 });

        // The tokenId and tx sender must match those that have been signed for
        await localExpect(heroUpgradeableInstance.safeMintTokens(signature, tokenIds, tokenPrices, { from: testAccountsData[1].address })).to.eventually.be.rejected;
    });

    it("prevents a hero token from being minted if the domain chainId doesn't match the chainId of the chain the contract is deployed to", async () => {
        const types = {
            HeroMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenIds', type: 'uint256[]' },
                { name: 'tokenPrices', type: 'uint256[]' },
            ],
        };

        const tokenIds = ['2'];
        const priceOfHeroInUSDP = web3.utils.toWei('1', 'ether');
        const tokenPrices = [priceOfHeroInUSDP];
        const heroMintConditions = { minter: testAccountsData[1].address, tokenIds, tokenPrices };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 99999,
            verifyingContract: heroUpgradeableInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, heroMintConditions);

        // Add controller for USDP
        let data = USDPUpgradeableContract.methods.addController(multiSigWalletInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Mint enough USDP to buy a hero
        data = USDPUpgradeableContract.methods.mint(account1, priceOfHeroInUSDP).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        const USDPAmountToApprove = tokenPrices.reduce((acc, tokenPrice) => bigInt(acc).add(tokenPrice).toString());
        await USDPUpgradeableInstance.approve(heroUpgradeableInstance.address, USDPAmountToApprove, { from: account1 });

        // The tokenId and tx sender must match those that have been signed for
        await localExpect(heroUpgradeableInstance.safeMintTokens(signature, tokenIds, tokenPrices, { from: testAccountsData[1].address })).to.eventually.be.rejected;
    });

    it("prevents a hero token from being minted if the domain verifyingContract doesn't match the address the contract is deployed to", async () => {
        const types = {
            HeroMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenIds', type: 'uint256[]' },
                { name: 'tokenPrices', type: 'uint256[]' },
            ],
        };

        const tokenIds = ['2'];
        const priceOfHeroInUSDP = web3.utils.toWei('1', 'ether');
        const tokenPrices = [priceOfHeroInUSDP];
        const heroMintConditions = { minter: testAccountsData[1].address, tokenIds, tokenPrices };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: '0xcccccccccccccccccccccccccccccccccccccccc',
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, heroMintConditions);

        // Add controller for USDP
        let data = USDPUpgradeableContract.methods.addController(multiSigWalletInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Mint enough USDP to buy a hero
        data = USDPUpgradeableContract.methods.mint(account1, priceOfHeroInUSDP).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        const USDPAmountToApprove = tokenPrices.reduce((acc, tokenPrice) => bigInt(acc).add(tokenPrice).toString());
        await USDPUpgradeableInstance.approve(heroUpgradeableInstance.address, USDPAmountToApprove, { from: account1 });

        // The tokenId and tx sender must match those that have been signed for
        await localExpect(heroUpgradeableInstance.safeMintTokens(signature, tokenIds, tokenPrices, { from: testAccountsData[1].address })).to.eventually.be.rejected;
    });

    it("prevents a hero token from being minted if the signed 'minter' address doesn't match the sender address of the tx", async () => {
        const types = {
            HeroMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenIds', type: 'uint256[]' },
                { name: 'tokenPrices', type: 'uint256[]' },
            ],
        };

        const tokenIds = ['2'];
        const priceOfHeroInUSDP = web3.utils.toWei('1', 'ether');
        const tokenPrices = [priceOfHeroInUSDP];
        const heroMintConditions = { minter: testAccountsData[1].address, tokenIds, tokenPrices };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: heroUpgradeableInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, heroMintConditions);

        // Add controller for USDP
        let data = USDPUpgradeableContract.methods.addController(multiSigWalletInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Mint enough USDP to buy a hero
        data = USDPUpgradeableContract.methods.mint(account1, priceOfHeroInUSDP).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        const USDPAmountToApprove = tokenPrices.reduce((acc, tokenPrice) => bigInt(acc).add(tokenPrice).toString());
        await USDPUpgradeableInstance.approve(heroUpgradeableInstance.address, USDPAmountToApprove, { from: account1 });

        // The tokenId and tx sender must match those that have been signed for
        await localExpect(heroUpgradeableInstance.safeMintTokens(signature, tokenIds, tokenPrices, { from: testAccountsData[2].address })).to.eventually.be.rejected;
    });

    it("prevents a hero token from being minted if the signed tokenId doesn't match the tokenId specified by the caller", async () => {
        const types = {
            HeroMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenIds', type: 'uint256[]' },
                { name: 'tokenPrices', type: 'uint256[]' },
            ],
        };

        const tokenIds = ['99999'];
        const priceOfHeroInUSDP = web3.utils.toWei('1', 'ether');
        const tokenPrices = [priceOfHeroInUSDP];
        const heroMintConditions = { minter: testAccountsData[1].address, tokenIds, tokenPrices };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: heroUpgradeableInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, heroMintConditions);

        // Add controller for USDP
        let data = USDPUpgradeableContract.methods.addController(multiSigWalletInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Mint enough USDP to buy a hero
        data = USDPUpgradeableContract.methods.mint(account1, priceOfHeroInUSDP).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        const USDPAmountToApprove = tokenPrices.reduce((acc, tokenPrice) => bigInt(acc).add(tokenPrice).toString());
        await USDPUpgradeableInstance.approve(heroUpgradeableInstance.address, USDPAmountToApprove, { from: account1 });

        // The tokenId and tx sender must match those that have been signed for
        await localExpect(heroUpgradeableInstance.safeMintTokens(signature, ['1'], tokenPrices, { from: testAccountsData[1].address })).to.eventually.be.rejected;
    });

    it('prevents a hero token from being minted if the signature is tampered with', async () => {
        const types = {
            HeroMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenIds', type: 'uint256[]' },
                { name: 'tokenPrices', type: 'uint256[]' },
            ],
        };

        const tokenIds = ['2'];
        const priceOfHeroInUSDP = web3.utils.toWei('1', 'ether');
        const tokenPrices = [priceOfHeroInUSDP];
        const heroMintConditions = { minter: testAccountsData[1].address, tokenIds, tokenPrices };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: heroUpgradeableInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature: string = await signer._signTypedData(domain, types, heroMintConditions);

        // Add controller for USDP
        let data = USDPUpgradeableContract.methods.addController(multiSigWalletInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Mint enough USDP to buy a hero
        data = USDPUpgradeableContract.methods.mint(account1, priceOfHeroInUSDP).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        const USDPAmountToApprove = tokenPrices.reduce((acc, tokenPrice) => bigInt(acc).add(tokenPrice).toString());
        await USDPUpgradeableInstance.approve(heroUpgradeableInstance.address, USDPAmountToApprove, { from: account1 });

        const signatureArr = signature.split('');
        signatureArr[10] = '7';
        const tamperedSignature = signatureArr.join('');

        // The tokenId and tx sender must match those that have been signed for
        await localExpect(heroUpgradeableInstance.safeMintTokens(tamperedSignature, tokenIds, tokenPrices, { from: testAccountsData[1].address })).to.eventually.be.rejected;
    });

    it('only allows the owner to change the _mintSigner', async () => {
        // Should fail since caller is not the owner
        await localExpect(heroUpgradeableInstance.setMintSigner(account3, { from: account1 })).to.eventually.be.rejected;

        const data = heroUpgradeableContract.methods.setMintSigner(account3).encodeABI();
        await multiSigWalletInstance.submitTransaction(heroUpgradeableInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;
    });

    it("only allows a token to be minted if the signer is updated to match the contract's changed _mintSigner", async () => {
        // Change the mint signer
        let data = heroUpgradeableContract.methods.setMintSigner(account2).encodeABI();
        await multiSigWalletInstance.submitTransaction(heroUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        const types = {
            HeroMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenIds', type: 'uint256[]' },
                { name: 'tokenPrices', type: 'uint256[]' },
            ],
        };

        const tokenIds = ['2'];
        const priceOfHeroInUSDP = web3.utils.toWei('1', 'ether');
        const tokenPrices = [priceOfHeroInUSDP];
        const heroMintConditions = { minter: testAccountsData[1].address, tokenIds, tokenPrices };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: heroUpgradeableInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, heroMintConditions);

        // Add controller for USDP
        data = USDPUpgradeableContract.methods.addController(multiSigWalletInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Mint enough USDP to buy a hero
        data = USDPUpgradeableContract.methods.mint(account1, priceOfHeroInUSDP).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        const USDPAmountToApprove = tokenPrices.reduce((acc, tokenPrice) => bigInt(acc).add(tokenPrice).toString());
        await USDPUpgradeableInstance.approve(heroUpgradeableInstance.address, USDPAmountToApprove, { from: account1 });

        // This should fail because the _mintSigner has changed and no longer matches the signer
        await localExpect(heroUpgradeableInstance.safeMintTokens(signature, tokenIds, tokenPrices, { from: testAccountsData[1].address })).to.eventually.be.rejected;

        const newSigner = new ethers.Wallet(testAccountsData[2].privateKey, provider);
        const newsignature = await newSigner._signTypedData(domain, types, heroMintConditions);

        await localExpect(heroUpgradeableInstance.safeMintTokens(newsignature, tokenIds, tokenPrices, { from: testAccountsData[1].address })).to.eventually.be.fulfilled;
    });

    // @TODO: Update this test when we have the final base URI implemented in the contract
    it('generates a valid token URI', async () => {
        const types = {
            HeroMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenIds', type: 'uint256[]' },
                { name: 'tokenPrices', type: 'uint256[]' },
            ],
        };

        const tokenIds = ['1'];
        const priceOfHeroInUSDP = web3.utils.toWei('1', 'ether');
        const tokenPrices = [priceOfHeroInUSDP];
        const heroMintConditions = { minter: testAccountsData[1].address, tokenIds, tokenPrices };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: heroUpgradeableInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature: string = await signer._signTypedData(domain, types, heroMintConditions);

        // Add controller for USDP
        let data = USDPUpgradeableContract.methods.addController(multiSigWalletInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Mint enough USDP to buy a hero
        data = USDPUpgradeableContract.methods.mint(account1, priceOfHeroInUSDP).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        const USDPAmountToApprove = tokenPrices.reduce((acc, tokenPrice) => bigInt(acc).add(tokenPrice).toString());
        await USDPUpgradeableInstance.approve(heroUpgradeableInstance.address, USDPAmountToApprove, { from: account1 });

        await heroUpgradeableInstance.safeMintTokens(signature, tokenIds, tokenPrices, { from: testAccountsData[1].address });

        const tokenURI = await heroUpgradeableInstance.tokenURI('1');
        expect(tokenURI).to.equal('https://www.portalfantasy.io/1');
    });

    it('allows only the owner to change the base URI', async () => {
        const types = {
            HeroMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenIds', type: 'uint256[]' },
                { name: 'tokenPrices', type: 'uint256[]' },
            ],
        };

        const tokenIds = ['1'];
        const priceOfHeroInUSDP = web3.utils.toWei('1', 'ether');
        const tokenPrices = [priceOfHeroInUSDP];
        const heroMintConditions = { minter: testAccountsData[1].address, tokenIds, tokenPrices };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: heroUpgradeableInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature: string = await signer._signTypedData(domain, types, heroMintConditions);

        // Add controller for USDP
        let data = USDPUpgradeableContract.methods.addController(multiSigWalletInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Mint enough USDP to buy a hero
        data = USDPUpgradeableContract.methods.mint(account1, priceOfHeroInUSDP).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        const USDPAmountToApprove = tokenPrices.reduce((acc, tokenPrice) => bigInt(acc).add(tokenPrice).toString());
        await USDPUpgradeableInstance.approve(heroUpgradeableInstance.address, USDPAmountToApprove, { from: account1 });

        await heroUpgradeableInstance.safeMintTokens(signature, tokenIds, tokenPrices, { from: testAccountsData[1].address });

        let tokenURI = await heroUpgradeableInstance.tokenURI('1');
        expect(tokenURI).to.equal('https://www.portalfantasy.io/1');

        // Expect this to fail, as only the owner can change the base URI
        await localExpect(heroUpgradeableInstance.setBaseURIString('https://www.foo.com/', { from: account1 })).to.eventually.be.rejected;

        data = heroUpgradeableContract.methods.setBaseURIString('https://www.bar.com/').encodeABI();
        await multiSigWalletInstance.submitTransaction(heroUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        tokenURI = await heroUpgradeableInstance.tokenURI('1');
        expect(tokenURI).to.equal('https://www.bar.com/1');
    });

    it('can be upgraded and store new state variables from the new contract', async () => {
        const tokenSymbol = await heroUpgradeableInstance.symbol();
        expect(tokenSymbol).to.equal('PHRO');

        const types = {
            HeroMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenIds', type: 'uint256[]' },
                { name: 'tokenPrices', type: 'uint256[]' },
            ],
        };

        let tokenIds = ['1'];
        const priceOfHeroInUSDP = web3.utils.toWei('1', 'ether');
        const tokenPrices = [priceOfHeroInUSDP];
        let heroMintConditions = { minter: testAccountsData[1].address, tokenIds, tokenPrices };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: heroUpgradeableInstance.address,
        };

        // Sign according to the EIP-712 standard
        let signature = await signer._signTypedData(domain, types, heroMintConditions);

        const initialUSDPAmountMintedToOwner = web3.utils.toWei('1000000000', 'ether');

        // Add controller for USDP
        let data = USDPUpgradeableContract.methods.addController(multiSigWalletInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Mint USDP
        data = USDPUpgradeableContract.methods.mint(account1, initialUSDPAmountMintedToOwner).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        let USDPAmountToApprove = tokenPrices.reduce((acc, tokenPrice) => bigInt(acc).add(tokenPrice).toString());
        await USDPUpgradeableInstance.approve(heroUpgradeableInstance.address, USDPAmountToApprove, { from: account1 });
        await heroUpgradeableInstance.safeMintTokens(signature, tokenIds, tokenPrices, { from: account1 });

        heroUpgradeableTestInstance = (await upgradeProxy(heroUpgradeableInstance.address, heroUpgradeableTest as any)) as HeroUpgradeableTestInstance;

        // Original state variables remain unchanged
        const newTokenSymbol = await heroUpgradeableTestInstance.symbol();
        expect(newTokenSymbol).to.equal('PHRO');
        const ownerOfMintedHero1 = await heroUpgradeableTestInstance.ownerOf('1');
        expect(ownerOfMintedHero1).to.equal(account1);

        tokenIds = ['2'];
        heroMintConditions = { minter: testAccountsData[2].address, tokenIds, tokenPrices };

        // Sign according to the EIP-712 standard
        signature = await signer._signTypedData(domain, types, heroMintConditions);

        // Mint USDP
        data = USDPUpgradeableContract.methods.mint(account2, initialUSDPAmountMintedToOwner).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        USDPAmountToApprove = tokenPrices.reduce((acc, tokenPrice) => bigInt(acc).add(tokenPrice).toString());
        await USDPUpgradeableInstance.approve(heroUpgradeableInstance.address, USDPAmountToApprove, { from: account2 });
        await heroUpgradeableInstance.safeMintTokens(signature, tokenIds, tokenPrices, { from: account2 });

        // Can still mint new tokens
        const ownerOfMintedHero2 = await heroUpgradeableTestInstance.ownerOf('2');
        expect(ownerOfMintedHero2).to.equal(account2);

        // Can still only be paused/unpaused by the owner of the previous contract (multiSigWalleet)
        data = heroUpgradeableContract.methods.setPaused(true).encodeABI();
        await multiSigWalletInstance.submitTransaction(heroUpgradeableTestInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        // Non-existing method cannot be used to set state variable
        data = heroUpgradeableContract.methods.setBaseURIString('https://www.foo.com/').encodeABI();
        await multiSigWalletInstance.submitTransaction(heroUpgradeableTestInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;
        const baseURIString = await heroUpgradeableTestInstance.baseURIString();
        expect(baseURIString).to.not.equal('https://www.foo.com/');
    });
});
