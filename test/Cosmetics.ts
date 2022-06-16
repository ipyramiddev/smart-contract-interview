import bigInt from 'big-integer';
import { localExpect } from './lib/test-libraries';
import { CosmeticsInstance, PORBInstance, MultiSigWalletInstance } from '../types/truffle-contracts';
import COSMETICS_JSON from '../build/contracts/Cosmetics.json';
import PORB_JSON from '../build/contracts/PORB.json';
import Web3 from 'web3';
import { AbiItem } from 'web3-utils';
import { getTxIdFromMultiSigWallet } from './lib/test-helpers';

const config = require('../config').config;

const cosmetics = artifacts.require('Cosmetics');
const PORB = artifacts.require('PORB');
const multiSigWallet = artifacts.require('MultiSigWallet');

const web3 = new Web3(new Web3.providers.HttpProvider(config.AVAX.localSubnetHTTP));
const COSMETICS_ABI = COSMETICS_JSON.abi as AbiItem[];
const PORB_ABI = PORB_JSON.abi as AbiItem[];

contract.skip('Cosmetics.sol', ([owner, account1, account2, account3, account4, account5, account6, account7, account8, account9]) => {
    let cosmeticsInstance: CosmeticsInstance;
    let PORBInstance: PORBInstance;
    let multiSigWalletInstance: MultiSigWalletInstance;
    let cosmeticsContract: any;
    let PORBContract: any;

    beforeEach(async () => {
        // Require 2 signatures for multiSig
        multiSigWalletInstance = await multiSigWallet.new([owner, account1, account2], 2);
        PORBInstance = await PORB.new(account1, owner);
        cosmeticsInstance = await cosmetics.new(PORBInstance.address, account9);
        await PORBInstance.transferOwnership(multiSigWalletInstance.address);
        await cosmeticsInstance.transferOwnership(multiSigWalletInstance.address);

        cosmeticsContract = new web3.eth.Contract(COSMETICS_ABI, cosmeticsInstance.address);
        PORBContract = new web3.eth.Contract(PORB_ABI, PORBInstance.address);
    });

    it("has token name set to 'Portal Fantasy Cosmetics'", async () => {
        const tokenName = await cosmeticsInstance.name();
        expect(tokenName).to.equal('Portal Fantasy Cosmetics');
    });

    it("has token symbol set to 'PCOS'", async () => {
        const tokenSymbol = await cosmeticsInstance.symbol();
        expect(tokenSymbol).to.equal('PCOS');
    });

    it('can only be paused/unpaused by the owner (multiSigWallet)', async () => {
        let isPaused = await cosmeticsInstance.paused();
        expect(isPaused).to.be.false;

        // Non-owner account attempting to pause should fail
        await localExpect(cosmeticsInstance.setPaused(true, { from: account1 })).to.be.rejected;

        let data = cosmeticsContract.methods.setPaused(true).encodeABI();
        await multiSigWalletInstance.submitTransaction(cosmeticsInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        isPaused = await cosmeticsInstance.paused();
        expect(isPaused).to.be.true;

        // Non-owner account attempting to unpause should fail
        await localExpect(cosmeticsInstance.setPaused(false, { from: account1 })).to.be.rejected;

        data = cosmeticsContract.methods.setPaused(false).encodeABI();
        await multiSigWalletInstance.submitTransaction(cosmeticsInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        isPaused = await cosmeticsInstance.paused();
        expect(isPaused).to.be.false;
    });

    it('allows an Cosmetics NFT to be minted with payment in PORB', async () => {
        const initialPORBAmountMintedToOwner = web3.utils.toWei('1000000000', 'ether');
        const priceOfCosmeticInPORB = web3.utils.toWei('2', 'ether');

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

        await PORBInstance.approve(cosmeticsInstance.address, priceOfCosmeticInPORB, { from: account1 });
        await cosmeticsInstance.mintWithPORB({ from: account1 });

        const ownerOfMintedCosmetic = await cosmeticsInstance.ownerOf('0');
        const balanceOfPORBVault = (await PORBInstance.balanceOf(account9)).toString();

        expect(ownerOfMintedCosmetic).to.equal(account1);
        expect(balanceOfPORBVault).to.equal(priceOfCosmeticInPORB);
    });

    it('only allows the owner (multiSigWallet) to change mintPriceInPORB', async () => {
        const newMintPriceInPORB = web3.utils.toWei('5', 'ether');

        // Should fail since caller is not the owner
        await localExpect(cosmeticsInstance.setMintPriceInPORB(newMintPriceInPORB, { from: account1 })).to.eventually.be.rejected;

        const data = cosmeticsContract.methods.setMintPriceInPORB(newMintPriceInPORB).encodeABI();
        await multiSigWalletInstance.submitTransaction(cosmeticsInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        const contractMintPriceInPORB = (await cosmeticsInstance.mintPriceInPORB()).toString();
        expect(contractMintPriceInPORB).to.equal(newMintPriceInPORB);
    });

    it('only allows the owner (multiSigWallet) to change the PORB contract address', async () => {
        const newPORBInstance = await PORB.new(account1, owner);

        // Should fail since caller is not the owner
        await localExpect(cosmeticsInstance.setPORB(newPORBInstance.address, { from: account1 })).to.eventually.be.rejected;

        const data = cosmeticsContract.methods.setPORB(newPORBInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(cosmeticsInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        const contractPORBAddress = (await cosmeticsInstance.PORB()).toString();
        expect(contractPORBAddress).to.equal(newPORBInstance.address);
    });

    it('only allows the owner (multiSigWallet) to change the PORB vault', async () => {
        // Should fail since caller is not the owner
        await localExpect(cosmeticsInstance.setVault(account2, { from: account1 })).to.eventually.be.rejected;

        const data = cosmeticsContract.methods.setVault(account2).encodeABI();
        await multiSigWalletInstance.submitTransaction(cosmeticsInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        const contractPORBVault = (await cosmeticsInstance.vault()).toString();
        expect(contractPORBVault).to.equal(account2);
    });

    // @TODO: Update this test when we have the final base URI implemented in the contract
    it('generates a valid token URI', async () => {
        const initialPORBAmountMintedToOwner = web3.utils.toWei('1000000000', 'ether');
        const priceOfCosmeticInPORB = web3.utils.toWei('2', 'ether');

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

        await PORBInstance.approve(cosmeticsInstance.address, priceOfCosmeticInPORB, { from: account1 });
        await cosmeticsInstance.mintWithPORB({ from: account1 });

        const tokenURI = await cosmeticsInstance.tokenURI('0');
        expect(tokenURI).to.equal('https://www.portalfantasy.io/0');
    });

    it('allows only the owner (multiSigWallet) to change the base URI', async () => {
        const initialPORBAmountMintedToOwner = web3.utils.toWei('1000000000', 'ether');
        const priceOfCosmeticInPORB = web3.utils.toWei('2', 'ether');

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

        await PORBInstance.approve(cosmeticsInstance.address, priceOfCosmeticInPORB, { from: account1 });
        await cosmeticsInstance.mintWithPORB({ from: account1 });

        let tokenURI = await cosmeticsInstance.tokenURI('0');
        expect(tokenURI).to.equal('https://www.portalfantasy.io/0');

        // Expect this to fail, as only the owner can change the base URI
        await localExpect(cosmeticsInstance.setBaseURIString('https://www.foo.com/', { from: account1 })).to.eventually.be.rejected;

        data = cosmeticsContract.methods.setBaseURIString('https://www.bar.com/').encodeABI();
        await multiSigWalletInstance.submitTransaction(cosmeticsInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        tokenURI = await cosmeticsInstance.tokenURI('0');
        expect(tokenURI).to.equal('https://www.bar.com/0');
    });

    it('allows only the owner (multiSigWallet) to change the contract URI', async () => {
        let contractURI = await cosmeticsInstance.contractURI();
        expect(contractURI).to.equal('https://www.portalfantasy.io/cosmetics/');

        // Expect this to fail, as only the owner can change the base URI
        await localExpect(cosmeticsInstance.setContractURIString('https://www.foo.com/cosmetics/', { from: account1 })).to.eventually.be.rejected;

        const data = cosmeticsContract.methods.setContractURIString('https://www.bar.com/cosmetics/').encodeABI();
        await multiSigWalletInstance.submitTransaction(cosmeticsInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        contractURI = await cosmeticsInstance.contractURI();
        expect(contractURI).to.equal('https://www.bar.com/cosmetics/');
    });

    it('allows only the owner (multiSigWallet) to change the contract URI', async () => {
        let contractURI = await cosmeticsInstance.contractURI();
        expect(contractURI).to.equal('https://www.portalfantasy.io/cosmetics/');

        // Expect this to fail, as only the owner can change the base URI
        await localExpect(cosmeticsInstance.setContractURIString('https://www.foo.com/cosmetics/', { from: account1 })).to.eventually.be.rejected;

        const data = cosmeticsContract.methods.setContractURIString('https://www.bar.com/cosmetics/').encodeABI();
        await multiSigWalletInstance.submitTransaction(cosmeticsInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        contractURI = await cosmeticsInstance.contractURI();
        expect(contractURI).to.equal('https://www.bar.com/cosmetics/');
    });

    it('applies the default royalty correctly', async () => {
        const initialPORBAmountMintedToOwner = web3.utils.toWei('1000000000', 'ether');
        const priceOfCosmeticInPORB = web3.utils.toWei('2', 'ether');

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

        await PORBInstance.approve(cosmeticsInstance.address, priceOfCosmeticInPORB, { from: account1 });
        await cosmeticsInstance.mintWithPORB({ from: account1 });

        // Assert expected royalty parameters
        let defaultRoyaltyInfo = await cosmeticsInstance.royaltyInfo('0', priceOfCosmeticInPORB);
        const royaltyRecipient = defaultRoyaltyInfo[0];
        const royaltyFee = defaultRoyaltyInfo[1];
        const expectedRoyalFeeNumeratorBips = 400;
        expect(royaltyRecipient).to.equal(account9);
        expect(royaltyFee.toString()).to.equal(bigInt(priceOfCosmeticInPORB).multiply(expectedRoyalFeeNumeratorBips).divide(10000).toString());
    });

    it('allows only the owner to change the default royalty fee', async () => {
        const initialPORBAmountMintedToOwner = web3.utils.toWei('1000000000', 'ether');
        const priceOfCosmeticInPORB = web3.utils.toWei('2', 'ether');

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

        await PORBInstance.approve(cosmeticsInstance.address, priceOfCosmeticInPORB, { from: account1 });
        await cosmeticsInstance.mintWithPORB({ from: account1 });

        // Expect this to fail, as only the owner can change the base URI
        await localExpect(cosmeticsInstance.setDefaultRoyalty(300, { from: account1 })).to.eventually.be.rejected;

        const updatedRoyaltyFeeBips = 100;
        data = cosmeticsContract.methods.setDefaultRoyalty(updatedRoyaltyFeeBips).encodeABI();
        await multiSigWalletInstance.submitTransaction(cosmeticsInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        // Assert expected royalty parameters
        let defaultRoyaltyInfo = await cosmeticsInstance.royaltyInfo('0', priceOfCosmeticInPORB);
        const royaltyRecipient = defaultRoyaltyInfo[0];
        const royaltyFee = defaultRoyaltyInfo[1];
        expect(royaltyRecipient).to.equal(account9);
        expect(royaltyFee.toString()).to.equal(bigInt(priceOfCosmeticInPORB).multiply(updatedRoyaltyFeeBips).divide(10000).toString());
    });

    it('allows only the owner to change the token custom royalty fee', async () => {
        const initialPORBAmountMintedToOwner = web3.utils.toWei('1000000000', 'ether');
        const priceOfCosmeticInPORB = web3.utils.toWei('2', 'ether');

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

        await PORBInstance.approve(cosmeticsInstance.address, priceOfCosmeticInPORB, { from: account1 });
        await cosmeticsInstance.mintWithPORB({ from: account1 });

        // Expect this to fail, as only the owner can change the base URI
        await localExpect(cosmeticsInstance.setTokenRoyalty('0', 300, { from: account1 })).to.eventually.be.rejected;

        const updatedRoyaltyFeeBips = 100;
        data = cosmeticsContract.methods.setTokenRoyalty('0', updatedRoyaltyFeeBips).encodeABI();
        await multiSigWalletInstance.submitTransaction(cosmeticsInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        // Assert expected royalty parameters
        let defaultRoyaltyInfo = await cosmeticsInstance.royaltyInfo('0', priceOfCosmeticInPORB);
        const royaltyRecipient = defaultRoyaltyInfo[0];
        const royaltyFee = defaultRoyaltyInfo[1];
        expect(royaltyRecipient).to.equal(account9);
        expect(royaltyFee.toString()).to.equal(bigInt(priceOfCosmeticInPORB).multiply(updatedRoyaltyFeeBips).divide(10000).toString());
    });

    it('allows only the owner to reset the custom royalty fee', async () => {
        const initialPORBAmountMintedToOwner = web3.utils.toWei('1000000000', 'ether');
        const priceOfCosmeticInPORB = web3.utils.toWei('2', 'ether');

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

        await PORBInstance.approve(cosmeticsInstance.address, priceOfCosmeticInPORB, { from: account1 });
        await cosmeticsInstance.mintWithPORB({ from: account1 });

        const updatedRoyaltyFeeBips = 100;
        data = cosmeticsContract.methods.setTokenRoyalty('0', updatedRoyaltyFeeBips).encodeABI();
        await multiSigWalletInstance.submitTransaction(cosmeticsInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        // Expect this to fail, as only the owner can change the base URI
        await localExpect(cosmeticsInstance.resetTokenRoyalty('0', { from: account1 })).to.eventually.be.rejected;

        data = cosmeticsContract.methods.resetTokenRoyalty('0').encodeABI();
        await multiSigWalletInstance.submitTransaction(cosmeticsInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        // Assert expected royalty parameters
        let defaultRoyaltyInfo = await cosmeticsInstance.royaltyInfo('0', priceOfCosmeticInPORB);
        const royaltyRecipient = defaultRoyaltyInfo[0];
        const royaltyFee = defaultRoyaltyInfo[1];
        const expectedRoyalFeeNumeratorBips = 400;
        expect(royaltyRecipient).to.equal(account9);
        expect(royaltyFee.toString()).to.equal(bigInt(priceOfCosmeticInPORB).multiply(expectedRoyalFeeNumeratorBips).divide(10000).toString());
    });
});
