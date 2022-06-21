import { deployProxy, upgradeProxy } from '@openzeppelin/truffle-upgrades';
import bigInt from 'big-integer';
import { localExpect } from '../lib/test-libraries';
import {
    HeroUpgradeableInstance,
    PORBUpgradeableInstance,
    MultiSigWalletInstance,
    NFTMarketplaceUpgradeableInstance,
    WAVAXInstance,
    NFTMarketplaceUpgradeableTestInstance,
} from '../../types/truffle-contracts';
import NFT_MARKETPLACE_UPGRADEABLE_JSON from '../../build/contracts/NFTMarketplaceUpgradeable.json';
import HERO_UPGRADEABLE_JSON from '../../build/contracts/HeroUpgradeable.json';
import PORB_UPGRADEABLE_JSON from '../../build/contracts/PORBUpgradeable.json';
import Web3 from 'web3';
import { AbiItem } from 'web3-utils';
import { getTxIdFromMultiSigWallet } from '../lib/test-helpers';

const config = require('../../config').config;

const NFTMarketplaceUpgradeable = artifacts.require('NFTMarketplaceUpgradeable');
const heroUpgradeable = artifacts.require('HeroUpgradeable');
const PORBUpgradeable = artifacts.require('PORBUpgradeable');
const WAVAX = artifacts.require('WAVAX');
const multiSigWallet = artifacts.require('MultiSigWallet');
const NFTMarketplaceUpgradeableTest = artifacts.require('NFTMarketplaceUpgradeableTest');

const web3 = new Web3(new Web3.providers.HttpProvider(config.AVAX.localSubnetHTTP));
const NFT_MARKETPLACE_ABI = NFT_MARKETPLACE_UPGRADEABLE_JSON.abi as AbiItem[];
const HERO_UPGRADEABLE_ABI = HERO_UPGRADEABLE_JSON.abi as AbiItem[];
const PORB_UPGRADEABLE_ABI = PORB_UPGRADEABLE_JSON.abi as AbiItem[];

contract('NFTMarketplaceUpgradeable.sol', ([owner, account1, account2, account3, account4, account5, account6, account7, account8, account9]) => {
    let NFTMarketplaceUpgradeableInstance: NFTMarketplaceUpgradeableInstance;
    let heroUpgradeableInstance: HeroUpgradeableInstance;
    let PORBUpgradeableInstance: PORBUpgradeableInstance;
    let WAVAXInstance: WAVAXInstance;
    let multiSigWalletInstance: MultiSigWalletInstance;
    let NFTMarketplaceUpgradeableTestInstance: NFTMarketplaceUpgradeableTestInstance;
    let NFTMarketplaceUpgradeableContract: any;
    let heroUpgradeableContract: any;
    let PORBContract: any;

    beforeEach(async () => {
        // Require 2 signatures for multiSig
        multiSigWalletInstance = await multiSigWallet.new([owner, account1, account2], 2);
        PORBUpgradeableInstance = (await deployProxy(PORBUpgradeable as any, [account1, owner], {
            initializer: 'initialize',
        })) as PORBUpgradeableInstance;
        WAVAXInstance = await WAVAX.new();
        NFTMarketplaceUpgradeableInstance = (await deployProxy(NFTMarketplaceUpgradeable as any, [WAVAXInstance.address], {
            initializer: 'initialize',
        })) as NFTMarketplaceUpgradeableInstance;
        heroUpgradeableInstance = (await deployProxy(heroUpgradeable as any, [PORBUpgradeableInstance.address, account9], {
            initializer: 'initialize',
        })) as HeroUpgradeableInstance;
        await NFTMarketplaceUpgradeableInstance.transferOwnership(multiSigWalletInstance.address);
        await PORBUpgradeableInstance.transferOwnership(multiSigWalletInstance.address);
        await heroUpgradeableInstance.transferOwnership(multiSigWalletInstance.address);

        NFTMarketplaceUpgradeableContract = new web3.eth.Contract(NFT_MARKETPLACE_ABI, NFTMarketplaceUpgradeableInstance.address);
        heroUpgradeableContract = new web3.eth.Contract(HERO_UPGRADEABLE_ABI, heroUpgradeableInstance.address);
        PORBContract = new web3.eth.Contract(PORB_UPGRADEABLE_ABI, PORBUpgradeableInstance.address);
    });

    it.skip('only allows the contract owner to whitelist an NFT collection', async () => {
        const exampleNFTContractAddress = '0xb794f5ea0ba39494ce839613fffba74279579268';

        await localExpect(NFTMarketplaceUpgradeableInstance.updateCollectionsWhitelist(exampleNFTContractAddress, true)).to.eventually.be.rejected;

        let data = NFTMarketplaceUpgradeableContract.methods.updateCollectionsWhitelist(exampleNFTContractAddress, true).encodeABI();
        await multiSigWalletInstance.submitTransaction(NFTMarketplaceUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;
    });

    it.skip('only allows an NFT to be listed for sale if its contract has been whitelisted', async () => {
        const initialPORBAmountMintedToOwner = web3.utils.toWei('1000000000', 'ether');
        const priceOfHeroInPORB = web3.utils.toWei('2', 'ether');

        // Add controller for PORB
        let data = PORBContract.methods.addController(multiSigWalletInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(PORBUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Mint PORB
        data = PORBContract.methods.mint(account1, initialPORBAmountMintedToOwner).encodeABI();
        await multiSigWalletInstance.submitTransaction(PORBUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Approve marketplace to handle hero token
        await PORBUpgradeableInstance.approve(heroUpgradeableInstance.address, priceOfHeroInPORB, { from: account1 });
        await heroUpgradeableInstance.mintWithPORB({ from: account1 });
        const heroTokenId = '0';

        // Attempt to list the hero token without whitelisting hero contract
        const listPriceOfHero = bigInt(priceOfHeroInPORB).multiply(2).toString();
        await heroUpgradeableInstance.approve(NFTMarketplaceUpgradeableInstance.address, heroTokenId, { from: account1 });
        await localExpect(NFTMarketplaceUpgradeableInstance.listItem(heroUpgradeableInstance.address, heroTokenId, listPriceOfHero, { from: account1 })).to.eventually.be.rejected;

        // Whitelist hero contract and then list the hero token
        data = NFTMarketplaceUpgradeableContract.methods.updateCollectionsWhitelist(heroUpgradeableInstance.address, true).encodeABI();
        await multiSigWalletInstance.submitTransaction(NFTMarketplaceUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });
        await localExpect(NFTMarketplaceUpgradeableInstance.listItem(heroUpgradeableInstance.address, heroTokenId, listPriceOfHero, { from: account1 })).to.eventually.be.fulfilled;
    });

    it.skip("prevents a token from being listed by an account that doesn't own it", async () => {
        const initialPORBAmountMintedToOwner = web3.utils.toWei('1000000000', 'ether');
        const priceOfHeroInPORB = web3.utils.toWei('2', 'ether');

        // Add controller for PORB
        let data = PORBContract.methods.addController(multiSigWalletInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(PORBUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Mint PORB
        data = PORBContract.methods.mint(account1, initialPORBAmountMintedToOwner).encodeABI();
        await multiSigWalletInstance.submitTransaction(PORBUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Approve marketplace to handle hero token
        await PORBUpgradeableInstance.approve(heroUpgradeableInstance.address, priceOfHeroInPORB, { from: account1 });
        await heroUpgradeableInstance.mintWithPORB({ from: account1 });
        const heroTokenId = '0';
        await heroUpgradeableInstance.approve(NFTMarketplaceUpgradeableInstance.address, heroTokenId, { from: account1 });

        // Whitelist hero contract and then list the hero token
        data = NFTMarketplaceUpgradeableContract.methods.updateCollectionsWhitelist(heroUpgradeableInstance.address, true).encodeABI();
        await multiSigWalletInstance.submitTransaction(NFTMarketplaceUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Attempt to list the token by an address that doesn't own it
        const listPriceOfHero = bigInt(priceOfHeroInPORB).multiply(2).toString();
        await localExpect(NFTMarketplaceUpgradeableInstance.listItem(heroUpgradeableInstance.address, heroTokenId, listPriceOfHero, { from: account2 })).to.eventually.be.rejected;
    });

    it.skip('prevents a token from being listed if the price is not greater than zero', async () => {
        const initialPORBAmountMintedToOwner = web3.utils.toWei('1000000000', 'ether');
        const priceOfHeroInPORB = web3.utils.toWei('2', 'ether');

        // Add controller for PORB
        let data = PORBContract.methods.addController(multiSigWalletInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(PORBUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Mint PORB
        data = PORBContract.methods.mint(account1, initialPORBAmountMintedToOwner).encodeABI();
        await multiSigWalletInstance.submitTransaction(PORBUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Approve marketplace to handle hero token
        await PORBUpgradeableInstance.approve(heroUpgradeableInstance.address, priceOfHeroInPORB, { from: account1 });
        await heroUpgradeableInstance.mintWithPORB({ from: account1 });
        const heroTokenId = '0';

        // Whitelist hero contract and then list the hero token
        data = NFTMarketplaceUpgradeableContract.methods.updateCollectionsWhitelist(heroUpgradeableInstance.address, true).encodeABI();
        await multiSigWalletInstance.submitTransaction(NFTMarketplaceUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Try to list the item at various prices
        await heroUpgradeableInstance.approve(NFTMarketplaceUpgradeableInstance.address, heroTokenId, { from: account1 });
        await localExpect(NFTMarketplaceUpgradeableInstance.listItem(heroUpgradeableInstance.address, heroTokenId, '0', { from: account1 })).to.eventually.be.rejected;
        await localExpect(NFTMarketplaceUpgradeableInstance.listItem(heroUpgradeableInstance.address, heroTokenId, '-1', { from: account1 })).to.eventually.be.rejected;
        await localExpect(NFTMarketplaceUpgradeableInstance.listItem(heroUpgradeableInstance.address, heroTokenId, '1', { from: account1 })).to.eventually.be.fulfilled;
    });

    it.skip("prevents a token from being re-listed if it's already listed", async () => {
        const initialPORBAmountMintedToOwner = web3.utils.toWei('1000000000', 'ether');
        const priceOfHeroInPORB = web3.utils.toWei('2', 'ether');

        // Add controller for PORB
        let data = PORBContract.methods.addController(multiSigWalletInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(PORBUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Mint PORB
        data = PORBContract.methods.mint(account1, initialPORBAmountMintedToOwner).encodeABI();
        await multiSigWalletInstance.submitTransaction(PORBUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Approve marketplace to handle hero token
        await PORBUpgradeableInstance.approve(heroUpgradeableInstance.address, priceOfHeroInPORB, { from: account1 });
        await heroUpgradeableInstance.mintWithPORB({ from: account1 });
        const heroTokenId = '0';

        // Whitelist hero contract and then list the hero token
        data = NFTMarketplaceUpgradeableContract.methods.updateCollectionsWhitelist(heroUpgradeableInstance.address, true).encodeABI();
        await multiSigWalletInstance.submitTransaction(NFTMarketplaceUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Attempt to relist an already listen item
        await heroUpgradeableInstance.approve(NFTMarketplaceUpgradeableInstance.address, heroTokenId, { from: account1 });
        await localExpect(NFTMarketplaceUpgradeableInstance.listItem(heroUpgradeableInstance.address, heroTokenId, '1', { from: account1 })).to.eventually.be.fulfilled;
        await localExpect(NFTMarketplaceUpgradeableInstance.listItem(heroUpgradeableInstance.address, heroTokenId, '2', { from: account1 })).to.eventually.be.rejected;
    });

    it.skip('only allows the NFT owner to update the listing', async () => {
        const initialPORBAmountMintedToOwner = web3.utils.toWei('1000000000', 'ether');
        const priceOfHeroInPORB = web3.utils.toWei('2', 'ether');

        // Add controller for PORB
        let data = PORBContract.methods.addController(multiSigWalletInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(PORBUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Mint PORB
        data = PORBContract.methods.mint(account1, initialPORBAmountMintedToOwner).encodeABI();
        await multiSigWalletInstance.submitTransaction(PORBUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Approve marketplace to handle hero token
        await PORBUpgradeableInstance.approve(heroUpgradeableInstance.address, priceOfHeroInPORB, { from: account1 });
        await heroUpgradeableInstance.mintWithPORB({ from: account1 });
        const heroTokenId = '0';

        // Whitelist hero contract and then list the hero token
        data = NFTMarketplaceUpgradeableContract.methods.updateCollectionsWhitelist(heroUpgradeableInstance.address, true).encodeABI();
        await multiSigWalletInstance.submitTransaction(NFTMarketplaceUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Attempt to update the listing of a token by an address that doesn't own it, as well as the owner
        await heroUpgradeableInstance.approve(NFTMarketplaceUpgradeableInstance.address, heroTokenId, { from: account1 });
        await localExpect(NFTMarketplaceUpgradeableInstance.listItem(heroUpgradeableInstance.address, heroTokenId, '1', { from: account1 })).to.eventually.be.fulfilled;
        await localExpect(NFTMarketplaceUpgradeableInstance.updateListing(heroUpgradeableInstance.address, heroTokenId, '2', { from: account2 })).to.eventually.be.rejected;
        await localExpect(NFTMarketplaceUpgradeableInstance.updateListing(heroUpgradeableInstance.address, heroTokenId, '3', { from: account1 })).to.eventually.be.fulfilled;

        const { price, seller } = await NFTMarketplaceUpgradeableInstance.getListing(heroUpgradeableInstance.address, heroTokenId);
        expect(seller).to.equal(account1);
        expect(price).to.equal('3');
    });

    it.skip('only allows the NFT owner to cancel the listing', async () => {
        const initialPORBAmountMintedToOwner = web3.utils.toWei('1000000000', 'ether');
        const priceOfHeroInPORB = web3.utils.toWei('2', 'ether');

        // Add controller for PORB
        let data = PORBContract.methods.addController(multiSigWalletInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(PORBUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Mint PORB
        data = PORBContract.methods.mint(account1, initialPORBAmountMintedToOwner).encodeABI();
        await multiSigWalletInstance.submitTransaction(PORBUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Approve marketplace to handle hero token
        await PORBUpgradeableInstance.approve(heroUpgradeableInstance.address, priceOfHeroInPORB, { from: account1 });
        await heroUpgradeableInstance.mintWithPORB({ from: account1 });
        const heroTokenId = '0';

        // Whitelist hero contract and then list the hero token
        data = NFTMarketplaceUpgradeableContract.methods.updateCollectionsWhitelist(heroUpgradeableInstance.address, true).encodeABI();
        await multiSigWalletInstance.submitTransaction(NFTMarketplaceUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Attempt to update the listing of a token by an address that doesn't own it, as well as the owner
        await heroUpgradeableInstance.approve(NFTMarketplaceUpgradeableInstance.address, heroTokenId, { from: account1 });
        await localExpect(NFTMarketplaceUpgradeableInstance.listItem(heroUpgradeableInstance.address, heroTokenId, '1', { from: account1 })).to.eventually.be.fulfilled;

        await localExpect(NFTMarketplaceUpgradeableInstance.cancelListing(heroUpgradeableInstance.address, heroTokenId, { from: account2 })).to.eventually.be.rejected;
        const { price: prevPrice, seller: prevSeller } = await NFTMarketplaceUpgradeableInstance.getListing(heroUpgradeableInstance.address, heroTokenId);
        expect(prevSeller).to.equal(account1);
        expect(prevPrice).to.equal('1');

        await localExpect(NFTMarketplaceUpgradeableInstance.cancelListing(heroUpgradeableInstance.address, heroTokenId, { from: account1 })).to.eventually.be.fulfilled;
        const { price, seller } = await NFTMarketplaceUpgradeableInstance.getListing(heroUpgradeableInstance.address, heroTokenId);
        expect(seller).to.equal('0x0000000000000000000000000000000000000000');
        expect(price).to.equal('0');
    });

    it.skip('only allows the marketplace contract owner to force-cancel a listing', async () => {
        const initialPORBAmountMintedToOwner = web3.utils.toWei('1000000000', 'ether');
        const priceOfHeroInPORB = web3.utils.toWei('2', 'ether');

        // Add controller for PORB
        let data = PORBContract.methods.addController(multiSigWalletInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(PORBUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Mint PORB
        data = PORBContract.methods.mint(account1, initialPORBAmountMintedToOwner).encodeABI();
        await multiSigWalletInstance.submitTransaction(PORBUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Approve marketplace to handle hero token
        await PORBUpgradeableInstance.approve(heroUpgradeableInstance.address, priceOfHeroInPORB, { from: account1 });
        await heroUpgradeableInstance.mintWithPORB({ from: account1 });
        const heroTokenId = '0';

        // Whitelist hero contract and then list the hero token
        data = NFTMarketplaceUpgradeableContract.methods.updateCollectionsWhitelist(heroUpgradeableInstance.address, true).encodeABI();
        await multiSigWalletInstance.submitTransaction(NFTMarketplaceUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Attempt to update the listing of a token by an address that doesn't own it, as well as the owner
        await heroUpgradeableInstance.approve(NFTMarketplaceUpgradeableInstance.address, heroTokenId, { from: account1 });
        await localExpect(NFTMarketplaceUpgradeableInstance.listItem(heroUpgradeableInstance.address, heroTokenId, '1', { from: account1 })).to.eventually.be.fulfilled;

        await localExpect(NFTMarketplaceUpgradeableInstance.forceCancelListing(heroUpgradeableInstance.address, heroTokenId, { from: account2 })).to.eventually.be.rejected;
        const { price: prevPrice, seller: prevSeller } = await NFTMarketplaceUpgradeableInstance.getListing(heroUpgradeableInstance.address, heroTokenId);
        expect(prevSeller).to.equal(account1);
        expect(prevPrice).to.equal('1');

        data = NFTMarketplaceUpgradeableContract.methods.forceCancelListing(heroUpgradeableInstance.address, heroTokenId).encodeABI();
        await multiSigWalletInstance.submitTransaction(NFTMarketplaceUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });
        const { price, seller } = await NFTMarketplaceUpgradeableInstance.getListing(heroUpgradeableInstance.address, heroTokenId);
        expect(seller).to.equal('0x0000000000000000000000000000000000000000');
        expect(price).to.equal('0');
    });

    it.skip('allows an NFT to be purchased only if the buyer has sufficient WAVAX', async () => {
        const initialPORBAmountMintedToOwner = web3.utils.toWei('1000000000', 'ether');
        const priceOfHeroInPORB = web3.utils.toWei('2', 'ether');
        const heroTokenListPrice = '10';
        const initialWAVAXAmountMintedToBuyer = heroTokenListPrice;

        // Add controller for PORB
        let data = PORBContract.methods.addController(multiSigWalletInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(PORBUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Mint PORB for owner
        data = PORBContract.methods.mint(account1, initialPORBAmountMintedToOwner).encodeABI();
        await multiSigWalletInstance.submitTransaction(PORBUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Deposit WAVAX for buyer
        await WAVAXInstance.deposit({ from: account2, value: initialWAVAXAmountMintedToBuyer });

        // Approve marketplace to handle hero token
        await PORBUpgradeableInstance.approve(heroUpgradeableInstance.address, priceOfHeroInPORB, { from: account1 });
        await heroUpgradeableInstance.mintWithPORB({ from: account1 });
        const heroTokenId = '0';

        // Whitelist hero contract and then list the hero token
        data = NFTMarketplaceUpgradeableContract.methods.updateCollectionsWhitelist(heroUpgradeableInstance.address, true).encodeABI();
        await multiSigWalletInstance.submitTransaction(NFTMarketplaceUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // List item
        await heroUpgradeableInstance.approve(NFTMarketplaceUpgradeableInstance.address, heroTokenId, { from: account1 });
        await localExpect(NFTMarketplaceUpgradeableInstance.listItem(heroUpgradeableInstance.address, heroTokenId, heroTokenListPrice, { from: account1 })).to.eventually.be
            .fulfilled;

        // Attempt to buy the item with two different accounts (only one has sufficient WAVAX)
        await WAVAXInstance.approve(NFTMarketplaceUpgradeableInstance.address, heroTokenListPrice, { from: account3 });
        await localExpect(NFTMarketplaceUpgradeableInstance.buyItem(heroUpgradeableInstance.address, heroTokenId, { from: account3 })).to.eventually.be.rejected;

        await WAVAXInstance.approve(NFTMarketplaceUpgradeableInstance.address, heroTokenListPrice, { from: account2 });
        await localExpect(NFTMarketplaceUpgradeableInstance.buyItem(heroUpgradeableInstance.address, heroTokenId, { from: account2 })).to.eventually.be.fulfilled;

        const { price, seller } = await NFTMarketplaceUpgradeableInstance.getListing(heroUpgradeableInstance.address, heroTokenId);
        expect(seller).to.equal('0x0000000000000000000000000000000000000000');
        expect(price).to.equal('0');
    });

    it.skip('records the correct proceeds and royalties when a token is purchased', async () => {
        const initialPORBAmountMintedToOwner = web3.utils.toWei('1000000000', 'ether');
        const priceOfHeroInPORB = web3.utils.toWei('2', 'ether');
        const heroTokenListPrice = '100';
        const initialWAVAXAmountMintedToBuyer = heroTokenListPrice;

        // Add controller for PORB
        let data = PORBContract.methods.addController(multiSigWalletInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(PORBUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Mint PORB for owner
        data = PORBContract.methods.mint(account1, initialPORBAmountMintedToOwner).encodeABI();
        await multiSigWalletInstance.submitTransaction(PORBUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Approve marketplace to handle hero token
        await PORBUpgradeableInstance.approve(heroUpgradeableInstance.address, priceOfHeroInPORB, { from: account1 });
        await heroUpgradeableInstance.mintWithPORB({ from: account1 });
        const heroTokenId = '0';

        // Whitelist hero contract and then list the hero token
        data = NFTMarketplaceUpgradeableContract.methods.updateCollectionsWhitelist(heroUpgradeableInstance.address, true).encodeABI();
        await multiSigWalletInstance.submitTransaction(NFTMarketplaceUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Deposit WAVAX for buyer
        await WAVAXInstance.deposit({ from: account2, value: initialWAVAXAmountMintedToBuyer });

        // Buy item
        await heroUpgradeableInstance.approve(NFTMarketplaceUpgradeableInstance.address, heroTokenId, { from: account1 });
        await NFTMarketplaceUpgradeableInstance.listItem(heroUpgradeableInstance.address, heroTokenId, heroTokenListPrice, { from: account1 });
        await WAVAXInstance.approve(NFTMarketplaceUpgradeableInstance.address, heroTokenListPrice, { from: account2 });
        await NFTMarketplaceUpgradeableInstance.buyItem(heroUpgradeableInstance.address, heroTokenId, { from: account2 });

        const expectedRoyalties = '4';
        const expectedSellerProceeds = (Number(heroTokenListPrice) - Number(expectedRoyalties)).toString();
        const sellerProceeds = await WAVAXInstance.balanceOf(account1);
        const royalties = await WAVAXInstance.balanceOf(account9);
        expect(sellerProceeds.toString()).to.equal(expectedSellerProceeds);
        expect(royalties.toString()).to.equal(expectedRoyalties);
    });

    it.skip("doesn't allow a token to be purchased if the collection has been removed from the whitelist since it was listed", async () => {
        const initialPORBAmountMintedToOwner = web3.utils.toWei('1000000000', 'ether');
        const priceOfHeroInPORB = web3.utils.toWei('2', 'ether');
        const heroTokenListPrice = '10';
        const initialWAVAXAmountMintedToBuyer = heroTokenListPrice;

        // Add controller for PORB
        let data = PORBContract.methods.addController(multiSigWalletInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(PORBUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Mint PORB for owner
        data = PORBContract.methods.mint(account1, initialPORBAmountMintedToOwner).encodeABI();
        await multiSigWalletInstance.submitTransaction(PORBUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Approve marketplace to handle hero token
        await PORBUpgradeableInstance.approve(heroUpgradeableInstance.address, priceOfHeroInPORB, { from: account1 });
        await heroUpgradeableInstance.mintWithPORB({ from: account1 });
        const heroTokenId = '0';

        // Whitelist hero contract and then list the hero token
        data = NFTMarketplaceUpgradeableContract.methods.updateCollectionsWhitelist(heroUpgradeableInstance.address, true).encodeABI();
        await multiSigWalletInstance.submitTransaction(NFTMarketplaceUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // List item
        await heroUpgradeableInstance.approve(NFTMarketplaceUpgradeableInstance.address, heroTokenId, { from: account1 });
        await localExpect(NFTMarketplaceUpgradeableInstance.listItem(heroUpgradeableInstance.address, heroTokenId, heroTokenListPrice, { from: account1 })).to.eventually.be
            .fulfilled;

        // Remove the hero contract from the whitelist
        data = NFTMarketplaceUpgradeableContract.methods.updateCollectionsWhitelist(heroUpgradeableInstance.address, false).encodeABI();
        await multiSigWalletInstance.submitTransaction(NFTMarketplaceUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Deposit WAVAX for buyer
        await WAVAXInstance.deposit({ from: account2, value: initialWAVAXAmountMintedToBuyer });

        // Attempt to buy the item
        await localExpect(NFTMarketplaceUpgradeableInstance.buyItem(heroUpgradeableInstance.address, heroTokenId, { from: account2 })).to.eventually.be.rejected;

        const { price, seller } = await NFTMarketplaceUpgradeableInstance.getListing(heroUpgradeableInstance.address, heroTokenId);
        expect(seller).to.equal(account1);
        expect(price).to.equal(heroTokenListPrice);
    });

    it.skip("doesn't allow a list to be updated if the collection has been removed from the whitelist since it was listed", async () => {
        const initialPORBAmountMintedToOwner = web3.utils.toWei('1000000000', 'ether');
        const priceOfHeroInPORB = web3.utils.toWei('2', 'ether');

        // Add controller for PORB
        let data = PORBContract.methods.addController(multiSigWalletInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(PORBUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Mint PORB for owner
        data = PORBContract.methods.mint(account1, initialPORBAmountMintedToOwner).encodeABI();
        await multiSigWalletInstance.submitTransaction(PORBUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Approve marketplace to handle hero token
        await PORBUpgradeableInstance.approve(heroUpgradeableInstance.address, priceOfHeroInPORB, { from: account1 });
        await heroUpgradeableInstance.mintWithPORB({ from: account1 });
        const heroTokenId = '0';

        // Whitelist hero contract and then list the hero token
        data = NFTMarketplaceUpgradeableContract.methods.updateCollectionsWhitelist(heroUpgradeableInstance.address, true).encodeABI();
        await multiSigWalletInstance.submitTransaction(NFTMarketplaceUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // List item
        const heroTokenListPrice = '10';
        await heroUpgradeableInstance.approve(NFTMarketplaceUpgradeableInstance.address, heroTokenId, { from: account1 });
        await localExpect(NFTMarketplaceUpgradeableInstance.listItem(heroUpgradeableInstance.address, heroTokenId, heroTokenListPrice, { from: account1 })).to.eventually.be
            .fulfilled;

        // Remove the hero contract from the whitelist
        data = NFTMarketplaceUpgradeableContract.methods.updateCollectionsWhitelist(heroUpgradeableInstance.address, false).encodeABI();
        await multiSigWalletInstance.submitTransaction(NFTMarketplaceUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Attempt to buy the item
        await localExpect(NFTMarketplaceUpgradeableInstance.updateListing(heroUpgradeableInstance.address, heroTokenId, '20', { from: account2, value: heroTokenListPrice })).to
            .eventually.be.rejected;

        const { price, seller } = await NFTMarketplaceUpgradeableInstance.getListing(heroUpgradeableInstance.address, heroTokenId);
        expect(seller).to.equal(account1);
        expect(price).to.equal(heroTokenListPrice);
    });

    it.skip('can be upgraded and store new state variables from the new contract', async () => {
        const initialPORBAmountMintedToOwner = web3.utils.toWei('1000000000', 'ether');
        const priceOfHeroInPORB = web3.utils.toWei('2', 'ether');
        const heroTokenListPrice = '10';

        // Add controller for PORB
        let data = PORBContract.methods.addController(multiSigWalletInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(PORBUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Mint PORB for owner
        data = PORBContract.methods.mint(account1, initialPORBAmountMintedToOwner).encodeABI();
        await multiSigWalletInstance.submitTransaction(PORBUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Approve marketplace to handle hero token
        await PORBUpgradeableInstance.approve(heroUpgradeableInstance.address, priceOfHeroInPORB, { from: account1 });
        await heroUpgradeableInstance.mintWithPORB({ from: account1 });
        const heroTokenId = '0';

        // Whitelist hero contract and then list the hero token
        data = NFTMarketplaceUpgradeableContract.methods.updateCollectionsWhitelist(heroUpgradeableInstance.address, true).encodeABI();
        await multiSigWalletInstance.submitTransaction(NFTMarketplaceUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // List item
        await heroUpgradeableInstance.approve(NFTMarketplaceUpgradeableInstance.address, heroTokenId, { from: account1 });
        await NFTMarketplaceUpgradeableInstance.listItem(heroUpgradeableInstance.address, heroTokenId, heroTokenListPrice, { from: account1 });

        const { price, seller } = await NFTMarketplaceUpgradeableInstance.getListing(heroUpgradeableInstance.address, heroTokenId);
        expect(seller).to.equal(account1);
        expect(price).to.equal(heroTokenListPrice);

        // Now upgrade the contract
        NFTMarketplaceUpgradeableTestInstance = (await upgradeProxy(
            NFTMarketplaceUpgradeableInstance.address,
            NFTMarketplaceUpgradeableTest as any,
            {}
        )) as NFTMarketplaceUpgradeableInstance;

        // The test contract doesn't have the getListing method, so any calls to it should be rejected
        await localExpect(NFTMarketplaceUpgradeableInstance.getListing(heroUpgradeableInstance.address, heroTokenId)).to.eventually.be.rejected;
    });
});
