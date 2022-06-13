import bigInt from 'big-integer';
import { localExpect } from './lib/test-libraries';
import { HeroInstance, PORBInstance, MultiSigWalletInstance, NFTMarketplaceInstance } from '../types/truffle-contracts';
import NFT_MARKETPLACE_JSON from '../build/contracts/NFTMarketplace.json';
import HERO_JSON from '../build/contracts/Hero.json';
import PORB_JSON from '../build/contracts/PORB.json';
import Web3 from 'web3';
import { AbiItem } from 'web3-utils';
import { getTxIdFromMultiSigWallet } from './lib/test-helpers';

const config = require('../config').config;

const NFTMarketplace = artifacts.require('NFTMarketplace');
const hero = artifacts.require('Hero');
const PORB = artifacts.require('PORB');
const multiSigWallet = artifacts.require('MultiSigWallet');

const web3 = new Web3(new Web3.providers.HttpProvider(config.AVAX.localSubnetHTTP));
const NFT_MARKETPLACE_ABI = NFT_MARKETPLACE_JSON.abi as AbiItem[];
const HERO_ABI = HERO_JSON.abi as AbiItem[];
const PORB_ABI = PORB_JSON.abi as AbiItem[];

contract('NFTMarketplace.sol', ([owner, account1, account2, account3, account4, account5, account6, account7, account8, account9]) => {
    let NFTMarketplaceInstance: NFTMarketplaceInstance;
    let heroInstance: HeroInstance;
    let PORBInstance: PORBInstance;
    let multiSigWalletInstance: MultiSigWalletInstance;
    let NFTMarketplaceContract: any;
    let heroContract: any;
    let PORBContract: any;

    beforeEach(async () => {
        // Require 2 signatures for multiSig
        multiSigWalletInstance = await multiSigWallet.new([owner, account1, account2], 2);
        NFTMarketplaceInstance = await NFTMarketplace.new();
        PORBInstance = await PORB.new(account1, owner);
        heroInstance = await hero.new(PORBInstance.address, account9);
        await NFTMarketplaceInstance.transferOwnership(multiSigWalletInstance.address);
        await PORBInstance.transferOwnership(multiSigWalletInstance.address);
        await heroInstance.transferOwnership(multiSigWalletInstance.address);

        NFTMarketplaceContract = new web3.eth.Contract(NFT_MARKETPLACE_ABI, NFTMarketplaceInstance.address);
        heroContract = new web3.eth.Contract(HERO_ABI, heroInstance.address);
        PORBContract = new web3.eth.Contract(PORB_ABI, PORBInstance.address);
    });

    it('only allows the contract owner to whitelist an NFT collection', async () => {
        const exampleNFTContractAddress = '0xb794f5ea0ba39494ce839613fffba74279579268';

        await localExpect(NFTMarketplaceInstance.updateCollectionsWhitelist(exampleNFTContractAddress, true)).to.eventually.be.rejected;

        let data = NFTMarketplaceContract.methods.updateCollectionsWhitelist(exampleNFTContractAddress, true).encodeABI();
        await multiSigWalletInstance.submitTransaction(NFTMarketplaceInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;
    });

    it('only allows an NFT to be listed for sale if its contract has been whitelisted', async () => {
        const initialPORBAmountMintedToOwner = web3.utils.toWei('1000000000', 'ether');
        const priceOfHeroInPORB = web3.utils.toWei('2', 'ether');

        // Add controller for PORB
        let data = PORBContract.methods.addController(multiSigWalletInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(PORBInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Mint PORB
        data = PORBContract.methods.mint(account1, initialPORBAmountMintedToOwner).encodeABI();
        await multiSigWalletInstance.submitTransaction(PORBInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Approve marketplace to handle hero token
        await PORBInstance.approve(heroInstance.address, priceOfHeroInPORB, { from: account1 });
        await heroInstance.mintWithPORB({ from: account1 });
        const heroTokenId = '0';

        // Attempt to list the hero token without whitelisting hero contract
        const listPriceOfHero = bigInt(priceOfHeroInPORB).multiply(2).toString();
        await heroInstance.approve(NFTMarketplaceInstance.address, heroTokenId, { from: account1 });
        await localExpect(NFTMarketplaceInstance.listItem(heroInstance.address, heroTokenId, listPriceOfHero, { from: account1 })).to.eventually.be.rejected;

        // Whitelist hero contract and then list the hero token
        data = NFTMarketplaceContract.methods.updateCollectionsWhitelist(heroInstance.address, true).encodeABI();
        await multiSigWalletInstance.submitTransaction(NFTMarketplaceInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });
        await localExpect(NFTMarketplaceInstance.listItem(heroInstance.address, heroTokenId, listPriceOfHero, { from: account1 })).to.eventually.be.fulfilled;
    });

    it("prevents a token from being listed by an account that doesn't own it", async () => {
        const initialPORBAmountMintedToOwner = web3.utils.toWei('1000000000', 'ether');
        const priceOfHeroInPORB = web3.utils.toWei('2', 'ether');

        // Add controller for PORB
        let data = PORBContract.methods.addController(multiSigWalletInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(PORBInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Mint PORB
        data = PORBContract.methods.mint(account1, initialPORBAmountMintedToOwner).encodeABI();
        await multiSigWalletInstance.submitTransaction(PORBInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Approve marketplace to handle hero token
        await PORBInstance.approve(heroInstance.address, priceOfHeroInPORB, { from: account1 });
        await heroInstance.mintWithPORB({ from: account1 });
        const heroTokenId = '0';
        await heroInstance.approve(NFTMarketplaceInstance.address, heroTokenId, { from: account1 });

        // Whitelist hero contract and then list the hero token
        data = NFTMarketplaceContract.methods.updateCollectionsWhitelist(heroInstance.address, true).encodeABI();
        await multiSigWalletInstance.submitTransaction(NFTMarketplaceInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Attempt to list the token by an address that doesn't own it
        const listPriceOfHero = bigInt(priceOfHeroInPORB).multiply(2).toString();
        await localExpect(NFTMarketplaceInstance.listItem(heroInstance.address, heroTokenId, listPriceOfHero, { from: account2 })).to.eventually.be.rejected;
    });

    it('prevents a token from being listed if the price is not greater than zero', async () => {
        const initialPORBAmountMintedToOwner = web3.utils.toWei('1000000000', 'ether');
        const priceOfHeroInPORB = web3.utils.toWei('2', 'ether');

        // Add controller for PORB
        let data = PORBContract.methods.addController(multiSigWalletInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(PORBInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Mint PORB
        data = PORBContract.methods.mint(account1, initialPORBAmountMintedToOwner).encodeABI();
        await multiSigWalletInstance.submitTransaction(PORBInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Approve marketplace to handle hero token
        await PORBInstance.approve(heroInstance.address, priceOfHeroInPORB, { from: account1 });
        await heroInstance.mintWithPORB({ from: account1 });
        const heroTokenId = '0';

        // Whitelist hero contract and then list the hero token
        data = NFTMarketplaceContract.methods.updateCollectionsWhitelist(heroInstance.address, true).encodeABI();
        await multiSigWalletInstance.submitTransaction(NFTMarketplaceInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Try to list the item at various prices
        await heroInstance.approve(NFTMarketplaceInstance.address, heroTokenId, { from: account1 });
        await localExpect(NFTMarketplaceInstance.listItem(heroInstance.address, heroTokenId, '0', { from: account1 })).to.eventually.be.rejected;
        await localExpect(NFTMarketplaceInstance.listItem(heroInstance.address, heroTokenId, '-1', { from: account1 })).to.eventually.be.rejected;
        await localExpect(NFTMarketplaceInstance.listItem(heroInstance.address, heroTokenId, '1', { from: account1 })).to.eventually.be.fulfilled;
    });

    it("prevents a token from being re-listed if it's already listed", async () => {
        const initialPORBAmountMintedToOwner = web3.utils.toWei('1000000000', 'ether');
        const priceOfHeroInPORB = web3.utils.toWei('2', 'ether');

        // Add controller for PORB
        let data = PORBContract.methods.addController(multiSigWalletInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(PORBInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Mint PORB
        data = PORBContract.methods.mint(account1, initialPORBAmountMintedToOwner).encodeABI();
        await multiSigWalletInstance.submitTransaction(PORBInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Approve marketplace to handle hero token
        await PORBInstance.approve(heroInstance.address, priceOfHeroInPORB, { from: account1 });
        await heroInstance.mintWithPORB({ from: account1 });
        const heroTokenId = '0';

        // Whitelist hero contract and then list the hero token
        data = NFTMarketplaceContract.methods.updateCollectionsWhitelist(heroInstance.address, true).encodeABI();
        await multiSigWalletInstance.submitTransaction(NFTMarketplaceInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Attempt to relist an already listen item
        await heroInstance.approve(NFTMarketplaceInstance.address, heroTokenId, { from: account1 });
        await localExpect(NFTMarketplaceInstance.listItem(heroInstance.address, heroTokenId, '1', { from: account1 })).to.eventually.be.fulfilled;
        await localExpect(NFTMarketplaceInstance.listItem(heroInstance.address, heroTokenId, '2', { from: account1 })).to.eventually.be.rejected;
    });

    it('only allows the NFT owner is allowed to update the listing', async () => {
        const initialPORBAmountMintedToOwner = web3.utils.toWei('1000000000', 'ether');
        const priceOfHeroInPORB = web3.utils.toWei('2', 'ether');

        // Add controller for PORB
        let data = PORBContract.methods.addController(multiSigWalletInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(PORBInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Mint PORB
        data = PORBContract.methods.mint(account1, initialPORBAmountMintedToOwner).encodeABI();
        await multiSigWalletInstance.submitTransaction(PORBInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Approve marketplace to handle hero token
        await PORBInstance.approve(heroInstance.address, priceOfHeroInPORB, { from: account1 });
        await heroInstance.mintWithPORB({ from: account1 });
        const heroTokenId = '0';

        // Whitelist hero contract and then list the hero token
        data = NFTMarketplaceContract.methods.updateCollectionsWhitelist(heroInstance.address, true).encodeABI();
        await multiSigWalletInstance.submitTransaction(NFTMarketplaceInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Attempt to update the listing of a token by an address that doesn't own it, as well as the owner
        await heroInstance.approve(NFTMarketplaceInstance.address, heroTokenId, { from: account1 });
        await localExpect(NFTMarketplaceInstance.listItem(heroInstance.address, heroTokenId, '1', { from: account1 })).to.eventually.be.fulfilled;
        await localExpect(NFTMarketplaceInstance.updateListing(heroInstance.address, heroTokenId, '2', { from: account2 })).to.eventually.be.rejected;
        await localExpect(NFTMarketplaceInstance.updateListing(heroInstance.address, heroTokenId, '3', { from: account1 })).to.eventually.be.fulfilled;

        const { price, seller } = await NFTMarketplaceInstance.getListing(heroInstance.address, heroTokenId);
        expect(seller).to.equal(account1);
        expect(price).to.equal('3');
    });

    it('only allows the NFT owner to cancel the listing', async () => {
        const initialPORBAmountMintedToOwner = web3.utils.toWei('1000000000', 'ether');
        const priceOfHeroInPORB = web3.utils.toWei('2', 'ether');

        // Add controller for PORB
        let data = PORBContract.methods.addController(multiSigWalletInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(PORBInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Mint PORB
        data = PORBContract.methods.mint(account1, initialPORBAmountMintedToOwner).encodeABI();
        await multiSigWalletInstance.submitTransaction(PORBInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Approve marketplace to handle hero token
        await PORBInstance.approve(heroInstance.address, priceOfHeroInPORB, { from: account1 });
        await heroInstance.mintWithPORB({ from: account1 });
        const heroTokenId = '0';

        // Whitelist hero contract and then list the hero token
        data = NFTMarketplaceContract.methods.updateCollectionsWhitelist(heroInstance.address, true).encodeABI();
        await multiSigWalletInstance.submitTransaction(NFTMarketplaceInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Attempt to update the listing of a token by an address that doesn't own it, as well as the owner
        await heroInstance.approve(NFTMarketplaceInstance.address, heroTokenId, { from: account1 });
        await localExpect(NFTMarketplaceInstance.listItem(heroInstance.address, heroTokenId, '1', { from: account1 })).to.eventually.be.fulfilled;

        await localExpect(NFTMarketplaceInstance.cancelListing(heroInstance.address, heroTokenId, { from: account2 })).to.eventually.be.rejected;
        const { price: prevPrice, seller: prevSeller } = await NFTMarketplaceInstance.getListing(heroInstance.address, heroTokenId);
        expect(prevSeller).to.equal(account1);
        expect(prevPrice).to.equal('1');

        await localExpect(NFTMarketplaceInstance.cancelListing(heroInstance.address, heroTokenId, { from: account1 })).to.eventually.be.fulfilled;
        const { price, seller } = await NFTMarketplaceInstance.getListing(heroInstance.address, heroTokenId);
        expect(seller).to.equal('0x0000000000000000000000000000000000000000');
        expect(price).to.equal('0');
    });

    it('only allows the marketplace contract owner to force-cancel a listing', async () => {
        const initialPORBAmountMintedToOwner = web3.utils.toWei('1000000000', 'ether');
        const priceOfHeroInPORB = web3.utils.toWei('2', 'ether');

        // Add controller for PORB
        let data = PORBContract.methods.addController(multiSigWalletInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(PORBInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Mint PORB
        data = PORBContract.methods.mint(account1, initialPORBAmountMintedToOwner).encodeABI();
        await multiSigWalletInstance.submitTransaction(PORBInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Approve marketplace to handle hero token
        await PORBInstance.approve(heroInstance.address, priceOfHeroInPORB, { from: account1 });
        await heroInstance.mintWithPORB({ from: account1 });
        const heroTokenId = '0';

        // Whitelist hero contract and then list the hero token
        data = NFTMarketplaceContract.methods.updateCollectionsWhitelist(heroInstance.address, true).encodeABI();
        await multiSigWalletInstance.submitTransaction(NFTMarketplaceInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Attempt to update the listing of a token by an address that doesn't own it, as well as the owner
        await heroInstance.approve(NFTMarketplaceInstance.address, heroTokenId, { from: account1 });
        await localExpect(NFTMarketplaceInstance.listItem(heroInstance.address, heroTokenId, '1', { from: account1 })).to.eventually.be.fulfilled;

        await localExpect(NFTMarketplaceInstance.forceCancelListing(heroInstance.address, heroTokenId, { from: account2 })).to.eventually.be.rejected;
        const { price: prevPrice, seller: prevSeller } = await NFTMarketplaceInstance.getListing(heroInstance.address, heroTokenId);
        expect(prevSeller).to.equal(account1);
        expect(prevPrice).to.equal('1');

        data = NFTMarketplaceContract.methods.forceCancelListing(heroInstance.address, heroTokenId).encodeABI();
        await multiSigWalletInstance.submitTransaction(NFTMarketplaceInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });
        const { price, seller } = await NFTMarketplaceInstance.getListing(heroInstance.address, heroTokenId);
        expect(seller).to.equal('0x0000000000000000000000000000000000000000');
        expect(price).to.equal('0');
    });

    it('allows an NFT to be purchased only if the buyer sends the exact amount on the listing', async () => {
        const initialPORBAmountMintedToOwner = web3.utils.toWei('1000000000', 'ether');
        const priceOfHeroInPORB = web3.utils.toWei('2', 'ether');

        // Add controller for PORB
        let data = PORBContract.methods.addController(multiSigWalletInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(PORBInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Mint PORB for owner
        data = PORBContract.methods.mint(account1, initialPORBAmountMintedToOwner).encodeABI();
        await multiSigWalletInstance.submitTransaction(PORBInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Approve marketplace to handle hero token
        await PORBInstance.approve(heroInstance.address, priceOfHeroInPORB, { from: account1 });
        await heroInstance.mintWithPORB({ from: account1 });
        const heroTokenId = '0';

        // Whitelist hero contract and then list the hero token
        data = NFTMarketplaceContract.methods.updateCollectionsWhitelist(heroInstance.address, true).encodeABI();
        await multiSigWalletInstance.submitTransaction(NFTMarketplaceInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // List item
        const heroTokenListPrice = '10';
        await heroInstance.approve(NFTMarketplaceInstance.address, heroTokenId, { from: account1 });
        await localExpect(NFTMarketplaceInstance.listItem(heroInstance.address, heroTokenId, heroTokenListPrice, { from: account1 })).to.eventually.be.fulfilled;

        // Attempt to buy the item at incorrect prices followed by the correct price
        await localExpect(NFTMarketplaceInstance.buyItem(heroInstance.address, heroTokenId, { from: account2, value: (Number(heroTokenListPrice) - 1).toString() })).to.eventually
            .be.rejected;
        await localExpect(NFTMarketplaceInstance.buyItem(heroInstance.address, heroTokenId, { from: account2, value: (Number(heroTokenListPrice) + 1).toString() })).to.eventually
            .be.rejected;
        await localExpect(NFTMarketplaceInstance.buyItem(heroInstance.address, heroTokenId, { from: account2, value: heroTokenListPrice })).to.eventually.be.fulfilled;

        const { price, seller } = await NFTMarketplaceInstance.getListing(heroInstance.address, heroTokenId);
        expect(seller).to.equal('0x0000000000000000000000000000000000000000');
        expect(price).to.equal('0');
    });

    it('records the correct proceeds and royalties when a token is purchased', async () => {
        const initialPORBAmountMintedToOwner = web3.utils.toWei('1000000000', 'ether');
        const priceOfHeroInPORB = web3.utils.toWei('2', 'ether');

        // Add controller for PORB
        let data = PORBContract.methods.addController(multiSigWalletInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(PORBInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Mint PORB for owner
        data = PORBContract.methods.mint(account1, initialPORBAmountMintedToOwner).encodeABI();
        await multiSigWalletInstance.submitTransaction(PORBInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Approve marketplace to handle hero token
        await PORBInstance.approve(heroInstance.address, priceOfHeroInPORB, { from: account1 });
        await heroInstance.mintWithPORB({ from: account1 });
        const heroTokenId = '0';

        // Whitelist hero contract and then list the hero token
        data = NFTMarketplaceContract.methods.updateCollectionsWhitelist(heroInstance.address, true).encodeABI();
        await multiSigWalletInstance.submitTransaction(NFTMarketplaceInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Buy item
        const heroTokenListPrice = '100';
        await heroInstance.approve(NFTMarketplaceInstance.address, heroTokenId, { from: account1 });
        await NFTMarketplaceInstance.listItem(heroInstance.address, heroTokenId, heroTokenListPrice, { from: account1 });
        await NFTMarketplaceInstance.buyItem(heroInstance.address, heroTokenId, { from: account2, value: heroTokenListPrice });

        const expectedRoyalties = '4';
        const expectedSellerProceeds = (Number(heroTokenListPrice) - Number(expectedRoyalties)).toString();
        const sellerProceeds = await NFTMarketplaceInstance.getProceeds(account1);
        const royalties = await NFTMarketplaceInstance.getProceeds(account9);
        expect(sellerProceeds.toString()).to.equal(expectedSellerProceeds);
        expect(royalties.toString()).to.equal(expectedRoyalties);
    });

    it('only the seller to withdraw their proceeds', async () => {
        const initialPORBAmountMintedToOwner = web3.utils.toWei('1000000000', 'ether');
        const priceOfHeroInPORB = web3.utils.toWei('2', 'ether');

        // Add controller for PORB
        let data = PORBContract.methods.addController(multiSigWalletInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(PORBInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Mint PORB for owner
        data = PORBContract.methods.mint(account1, initialPORBAmountMintedToOwner).encodeABI();
        await multiSigWalletInstance.submitTransaction(PORBInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Approve marketplace to handle hero token
        await PORBInstance.approve(heroInstance.address, priceOfHeroInPORB, { from: account1 });
        await heroInstance.mintWithPORB({ from: account1 });
        const heroTokenId = '0';

        // Whitelist hero contract and then list the hero token
        data = NFTMarketplaceContract.methods.updateCollectionsWhitelist(heroInstance.address, true).encodeABI();
        await multiSigWalletInstance.submitTransaction(NFTMarketplaceInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Buy item
        const heroTokenListPrice = '1000000000000000000';
        await heroInstance.approve(NFTMarketplaceInstance.address, heroTokenId, { from: account1 });
        await NFTMarketplaceInstance.listItem(heroInstance.address, heroTokenId, heroTokenListPrice, { from: account1 });
        await NFTMarketplaceInstance.buyItem(heroInstance.address, heroTokenId, { from: account2, value: heroTokenListPrice });

        // Seller withdraws their proceeds
        const sellerAVAXBalanceBefore = await web3.eth.getBalance(account1);
        await localExpect(NFTMarketplaceInstance.withdrawProceeds({ from: account1 })).to.eventually.be.fulfilled;
        const sellerAVAXBalanceAfter = await web3.eth.getBalance(account1);
        expect(bigInt(sellerAVAXBalanceAfter).greater(sellerAVAXBalanceBefore)).to.be.true;
    });

    it('allows royalties to be withdrawn by NFT vault contract', async () => {
        const initialPORBAmountMintedToOwner = web3.utils.toWei('1000000000', 'ether');
        const priceOfHeroInPORB = web3.utils.toWei('2', 'ether');

        // Add controller for PORB
        let data = PORBContract.methods.addController(multiSigWalletInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(PORBInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Mint PORB for owner
        data = PORBContract.methods.mint(account1, initialPORBAmountMintedToOwner).encodeABI();
        await multiSigWalletInstance.submitTransaction(PORBInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Approve marketplace to handle hero token
        await PORBInstance.approve(heroInstance.address, priceOfHeroInPORB, { from: account1 });
        await heroInstance.mintWithPORB({ from: account1 });
        const heroTokenId = '0';

        // Whitelist hero contract and then list the hero token
        data = NFTMarketplaceContract.methods.updateCollectionsWhitelist(heroInstance.address, true).encodeABI();
        await multiSigWalletInstance.submitTransaction(NFTMarketplaceInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Buy item
        const heroTokenListPrice = '100000000000000000000';
        await heroInstance.approve(NFTMarketplaceInstance.address, heroTokenId, { from: account1 });
        await NFTMarketplaceInstance.listItem(heroInstance.address, heroTokenId, heroTokenListPrice, { from: account1 });
        await NFTMarketplaceInstance.buyItem(heroInstance.address, heroTokenId, { from: account2, value: heroTokenListPrice });

        // Vault withdraws its royalties
        await localExpect(NFTMarketplaceInstance.withdrawProceeds({ from: account9 })).to.eventually.be.fulfilled;
    });

    it('reverts if the account attempts to withdraw zero proceeds', async () => {
        await localExpect(NFTMarketplaceInstance.withdrawProceeds({ from: account8 })).to.eventually.be.rejected;
    });

    it("doesn't allow a token to be purchased if the collection has been removed from the whitelist since it was listed", async () => {
        const initialPORBAmountMintedToOwner = web3.utils.toWei('1000000000', 'ether');
        const priceOfHeroInPORB = web3.utils.toWei('2', 'ether');

        // Add controller for PORB
        let data = PORBContract.methods.addController(multiSigWalletInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(PORBInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Mint PORB for owner
        data = PORBContract.methods.mint(account1, initialPORBAmountMintedToOwner).encodeABI();
        await multiSigWalletInstance.submitTransaction(PORBInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Approve marketplace to handle hero token
        await PORBInstance.approve(heroInstance.address, priceOfHeroInPORB, { from: account1 });
        await heroInstance.mintWithPORB({ from: account1 });
        const heroTokenId = '0';

        // Whitelist hero contract and then list the hero token
        data = NFTMarketplaceContract.methods.updateCollectionsWhitelist(heroInstance.address, true).encodeABI();
        await multiSigWalletInstance.submitTransaction(NFTMarketplaceInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // List item
        const heroTokenListPrice = '10';
        await heroInstance.approve(NFTMarketplaceInstance.address, heroTokenId, { from: account1 });
        await localExpect(NFTMarketplaceInstance.listItem(heroInstance.address, heroTokenId, heroTokenListPrice, { from: account1 })).to.eventually.be.fulfilled;

        // Remove the hero contract from the whitelist
        data = NFTMarketplaceContract.methods.updateCollectionsWhitelist(heroInstance.address, false).encodeABI();
        await multiSigWalletInstance.submitTransaction(NFTMarketplaceInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Attempt to buy the item
        await localExpect(NFTMarketplaceInstance.buyItem(heroInstance.address, heroTokenId, { from: account2, value: heroTokenListPrice })).to.eventually.be.rejected;

        const { price, seller } = await NFTMarketplaceInstance.getListing(heroInstance.address, heroTokenId);
        expect(seller).to.equal(account1);
        expect(price).to.equal(heroTokenListPrice);
    });

    it("doesn't allow a listen to be updated if the collection has been removed from the whitelist since it was listed", async () => {
        const initialPORBAmountMintedToOwner = web3.utils.toWei('1000000000', 'ether');
        const priceOfHeroInPORB = web3.utils.toWei('2', 'ether');

        // Add controller for PORB
        let data = PORBContract.methods.addController(multiSigWalletInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(PORBInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Mint PORB for owner
        data = PORBContract.methods.mint(account1, initialPORBAmountMintedToOwner).encodeABI();
        await multiSigWalletInstance.submitTransaction(PORBInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Approve marketplace to handle hero token
        await PORBInstance.approve(heroInstance.address, priceOfHeroInPORB, { from: account1 });
        await heroInstance.mintWithPORB({ from: account1 });
        const heroTokenId = '0';

        // Whitelist hero contract and then list the hero token
        data = NFTMarketplaceContract.methods.updateCollectionsWhitelist(heroInstance.address, true).encodeABI();
        await multiSigWalletInstance.submitTransaction(NFTMarketplaceInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // List item
        const heroTokenListPrice = '10';
        await heroInstance.approve(NFTMarketplaceInstance.address, heroTokenId, { from: account1 });
        await localExpect(NFTMarketplaceInstance.listItem(heroInstance.address, heroTokenId, heroTokenListPrice, { from: account1 })).to.eventually.be.fulfilled;

        // Remove the hero contract from the whitelist
        data = NFTMarketplaceContract.methods.updateCollectionsWhitelist(heroInstance.address, false).encodeABI();
        await multiSigWalletInstance.submitTransaction(NFTMarketplaceInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Attempt to buy the item
        await localExpect(NFTMarketplaceInstance.updateListing(heroInstance.address, heroTokenId, '20', { from: account2, value: heroTokenListPrice })).to.eventually.be.rejected;

        const { price, seller } = await NFTMarketplaceInstance.getListing(heroInstance.address, heroTokenId);
        expect(seller).to.equal(account1);
        expect(price).to.equal(heroTokenListPrice);
    });
});
