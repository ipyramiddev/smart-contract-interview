import bigInt from 'big-integer';
import { localExpect } from './lib/test-libraries';
import { ArchitectInstance, PORBInstance, MultiSigWalletInstance } from '../types/truffle-contracts';
import ARCHITECT_JSON from '../build/contracts/Architect.json';
import PORB_JSON from '../build/contracts/PORB.json';
import Web3 from 'web3';
import { AbiItem } from 'web3-utils';
import { getTxIdFromMultiSigWallet } from './lib/test-helpers';

const config = require('../config').config;

const architect = artifacts.require('Architect');
const PORB = artifacts.require('PORB');
const multiSigWallet = artifacts.require('MultiSigWallet');

const web3 = new Web3(new Web3.providers.HttpProvider(config.AVAX.localHTTP));
const ARCHITECT_ABI = ARCHITECT_JSON.abi as AbiItem[];
const PORB_ABI = PORB_JSON.abi as AbiItem[];

contract('Architect.sol', ([owner, account1, account2, account3, account4, account5, account6, account7, account8, account9]) => {
    let architectInstance: ArchitectInstance;
    let PORBInstance: PORBInstance;
    let multiSigWalletInstance: MultiSigWalletInstance;
    let architectContract: any;
    let PORBContract: any;

    beforeEach(async () => {
        // Require 2 signatures for multiSig
        multiSigWalletInstance = await multiSigWallet.new([owner, account1, account2], 2);
        PORBInstance = await PORB.new(account1, owner);
        architectInstance = await architect.new(PORBInstance.address, account9);
        await PORBInstance.transferOwnership(multiSigWalletInstance.address);
        await architectInstance.transferOwnership(multiSigWalletInstance.address);

        architectContract = new web3.eth.Contract(ARCHITECT_ABI, architectInstance.address);
        PORBContract = new web3.eth.Contract(PORB_ABI, PORBInstance.address);
    });

    it("has token name set to 'Portal Fantasy Architect'", async () => {
        const tokenName = await architectInstance.name();
        expect(tokenName).to.equal('Portal Fantasy Architect');
    });

    it("has token symbol set to 'PHAR'", async () => {
        const tokenSymbol = await architectInstance.symbol();
        expect(tokenSymbol).to.equal('PHAR');
    });

    it('can only be paused/unpaused by the owner (multiSigWallet)', async () => {
        let isPaused = await architectInstance.paused();
        expect(isPaused).to.be.false;

        // Non-owner account attempting to pause should fail
        await localExpect(architectInstance.setPaused(true, { from: account1 })).to.be.rejected;

        let data = architectContract.methods.setPaused(true).encodeABI();
        await multiSigWalletInstance.submitTransaction(architectInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        isPaused = await architectInstance.paused();
        expect(isPaused).to.be.true;

        // Non-owner account attempting to unpause should fail
        await localExpect(architectInstance.setPaused(false, { from: account1 })).to.be.rejected;

        data = architectContract.methods.setPaused(false).encodeABI();
        await multiSigWalletInstance.submitTransaction(architectInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        isPaused = await architectInstance.paused();
        expect(isPaused).to.be.false;
    });

    it('allows an Architect NFT to be minted with payment in PORB', async () => {
        const initialPORBAmountMintedToOwner = web3.utils.toWei('1000000000', 'ether');
        const priceOfArchitectInPORB = web3.utils.toWei('2', 'ether');

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

        await PORBInstance.approve(architectInstance.address, priceOfArchitectInPORB, { from: account1 });
        await architectInstance.mintWithPORB({ from: account1 });

        const ownerOfMintedArchitect = await architectInstance.ownerOf('0');
        const balanceOfPORBVault = (await PORBInstance.balanceOf(account9)).toString();

        expect(ownerOfMintedArchitect).to.equal(account1);
        expect(balanceOfPORBVault).to.equal(priceOfArchitectInPORB);
    });

    it('only allows the owner (multiSigWallet) to change mintPriceInPORB', async () => {
        const newMintPriceInPORB = web3.utils.toWei('5', 'ether');

        // Should fail since caller is not the owner
        await localExpect(architectInstance.setMintPriceInPORB(newMintPriceInPORB, { from: account1 })).to.eventually.be.rejected;

        const data = architectContract.methods.setMintPriceInPORB(newMintPriceInPORB).encodeABI();
        await multiSigWalletInstance.submitTransaction(architectInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        const contractMintPriceInPORB = (await architectInstance.mintPriceInPORB()).toString();
        expect(contractMintPriceInPORB).to.equal(newMintPriceInPORB);
    });

    it('only allows the owner (multiSigWallet) to change the PORB contract address', async () => {
        const newPORBInstance = await PORB.new(account1, owner);

        // Should fail since caller is not the owner
        await localExpect(architectInstance.setPORB(newPORBInstance.address, { from: account1 })).to.eventually.be.rejected;

        const data = architectContract.methods.setPORB(newPORBInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(architectInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        const contractPORBAddress = (await architectInstance.PORB()).toString();
        expect(contractPORBAddress).to.equal(newPORBInstance.address);
    });

    it('only allows the owner (multiSigWallet) to change the PORB vault', async () => {
        // Should fail since caller is not the owner
        await localExpect(architectInstance.setVault(account2, { from: account1 })).to.eventually.be.rejected;

        const data = architectContract.methods.setVault(account2).encodeABI();
        await multiSigWalletInstance.submitTransaction(architectInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        const contractPORBVault = (await architectInstance.vault()).toString();
        expect(contractPORBVault).to.equal(account2);
    });

    // @TODO: Update this test when we have the final base URI implemented in the contract
    it('generates a valid token URI', async () => {
        const initialPORBAmountMintedToOwner = web3.utils.toWei('1000000000', 'ether');
        const priceOfArchitectInPORB = web3.utils.toWei('2', 'ether');

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

        await PORBInstance.approve(architectInstance.address, priceOfArchitectInPORB, { from: account1 });
        await architectInstance.mintWithPORB({ from: account1 });

        const tokenURI = await architectInstance.tokenURI('0');
        expect(tokenURI).to.equal('https://www.portalfantasy.io/0');
    });

    it('allows only the owner (multiSigWallet) to change the base URI', async () => {
        const initialPORBAmountMintedToOwner = web3.utils.toWei('1000000000', 'ether');
        const priceOfArchitectInPORB = web3.utils.toWei('2', 'ether');

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

        await PORBInstance.approve(architectInstance.address, priceOfArchitectInPORB, { from: account1 });
        await architectInstance.mintWithPORB({ from: account1 });

        let tokenURI = await architectInstance.tokenURI('0');
        expect(tokenURI).to.equal('https://www.portalfantasy.io/0');

        // Expect this to fail, as only the owner can change the base URI
        await localExpect(architectInstance.setBaseURIString('https://www.foo.com/', { from: account1 })).to.eventually.be.rejected;

        data = architectContract.methods.setBaseURIString('https://www.bar.com/').encodeABI();
        await multiSigWalletInstance.submitTransaction(architectInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        tokenURI = await architectInstance.tokenURI('0');
        expect(tokenURI).to.equal('https://www.bar.com/0');
    });

    it('allows only the owner (multiSigWallet) to change the contract URI', async () => {
        let contractURI = await architectInstance.contractURI();
        expect(contractURI).to.equal('https://www.portalfantasy.io/architect/');

        // Expect this to fail, as only the owner can change the base URI
        await localExpect(architectInstance.setContractURIString('https://www.foo.com/architect/', { from: account1 })).to.eventually.be.rejected;

        const data = architectContract.methods.setContractURIString('https://www.bar.com/architect/').encodeABI();
        await multiSigWalletInstance.submitTransaction(architectInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        contractURI = await architectInstance.contractURI();
        expect(contractURI).to.equal('https://www.bar.com/architect/');
    });

    it('allows only the owner (multiSigWallet) to change the contract URI', async () => {
        let contractURI = await architectInstance.contractURI();
        expect(contractURI).to.equal('https://www.portalfantasy.io/architect/');

        // Expect this to fail, as only the owner can change the base URI
        await localExpect(architectInstance.setContractURIString('https://www.foo.com/architect/', { from: account1 })).to.eventually.be.rejected;

        const data = architectContract.methods.setContractURIString('https://www.bar.com/architect/').encodeABI();
        await multiSigWalletInstance.submitTransaction(architectInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        contractURI = await architectInstance.contractURI();
        expect(contractURI).to.equal('https://www.bar.com/architect/');
    });

    it('applies the default royalty correctly', async () => {
        const initialPORBAmountMintedToOwner = web3.utils.toWei('1000000000', 'ether');
        const priceOfArchitectInPORB = web3.utils.toWei('2', 'ether');

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

        await PORBInstance.approve(architectInstance.address, priceOfArchitectInPORB, { from: account1 });
        await architectInstance.mintWithPORB({ from: account1 });

        // Assert expected royalty parameters
        let defaultRoyaltyInfo = await architectInstance.royaltyInfo('0', priceOfArchitectInPORB);
        const royaltyRecipient = defaultRoyaltyInfo[0];
        const royaltyFee = defaultRoyaltyInfo[1];
        const expectedRoyalFeeNumeratorBips = 400;
        expect(royaltyRecipient).to.equal(account9);
        expect(royaltyFee.toString()).to.equal(bigInt(priceOfArchitectInPORB).multiply(expectedRoyalFeeNumeratorBips).divide(10000).toString());
    });

    it('allows only the owner to change the default royalty fee', async () => {
        const initialPORBAmountMintedToOwner = web3.utils.toWei('1000000000', 'ether');
        const priceOfArchitectInPORB = web3.utils.toWei('2', 'ether');

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

        await PORBInstance.approve(architectInstance.address, priceOfArchitectInPORB, { from: account1 });
        await architectInstance.mintWithPORB({ from: account1 });

        // Expect this to fail, as only the owner can change the base URI
        await localExpect(architectInstance.setDefaultRoyalty(300, { from: account1 })).to.eventually.be.rejected;

        const updatedRoyaltyFeeBips = 100;
        data = architectContract.methods.setDefaultRoyalty(updatedRoyaltyFeeBips).encodeABI();
        await multiSigWalletInstance.submitTransaction(architectInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        // Assert expected royalty parameters
        let defaultRoyaltyInfo = await architectInstance.royaltyInfo('0', priceOfArchitectInPORB);
        const royaltyRecipient = defaultRoyaltyInfo[0];
        const royaltyFee = defaultRoyaltyInfo[1];
        expect(royaltyRecipient).to.equal(account9);
        expect(royaltyFee.toString()).to.equal(bigInt(priceOfArchitectInPORB).multiply(updatedRoyaltyFeeBips).divide(10000).toString());
    });

    it('allows only the owner to change the token custom royalty fee', async () => {
        const initialPORBAmountMintedToOwner = web3.utils.toWei('1000000000', 'ether');
        const priceOfArchitectInPORB = web3.utils.toWei('2', 'ether');

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

        await PORBInstance.approve(architectInstance.address, priceOfArchitectInPORB, { from: account1 });
        await architectInstance.mintWithPORB({ from: account1 });

        // Expect this to fail, as only the owner can change the base URI
        await localExpect(architectInstance.setTokenRoyalty('0', 300, { from: account1 })).to.eventually.be.rejected;

        const updatedRoyaltyFeeBips = 100;
        data = architectContract.methods.setTokenRoyalty('0', updatedRoyaltyFeeBips).encodeABI();
        await multiSigWalletInstance.submitTransaction(architectInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        // Assert expected royalty parameters
        let defaultRoyaltyInfo = await architectInstance.royaltyInfo('0', priceOfArchitectInPORB);
        const royaltyRecipient = defaultRoyaltyInfo[0];
        const royaltyFee = defaultRoyaltyInfo[1];
        expect(royaltyRecipient).to.equal(account9);
        expect(royaltyFee.toString()).to.equal(bigInt(priceOfArchitectInPORB).multiply(updatedRoyaltyFeeBips).divide(10000).toString());
    });

    it('allows only the owner to reset the custom royalty fee', async () => {
        const initialPORBAmountMintedToOwner = web3.utils.toWei('1000000000', 'ether');
        const priceOfArchitectInPORB = web3.utils.toWei('2', 'ether');

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

        await PORBInstance.approve(architectInstance.address, priceOfArchitectInPORB, { from: account1 });
        await architectInstance.mintWithPORB({ from: account1 });

        const updatedRoyaltyFeeBips = 100;
        data = architectContract.methods.setTokenRoyalty('0', updatedRoyaltyFeeBips).encodeABI();
        await multiSigWalletInstance.submitTransaction(architectInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        // Expect this to fail, as only the owner can change the base URI
        await localExpect(architectInstance.resetTokenRoyalty('0', { from: account1 })).to.eventually.be.rejected;

        data = architectContract.methods.resetTokenRoyalty('0').encodeABI();
        await multiSigWalletInstance.submitTransaction(architectInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        // Assert expected royalty parameters
        let defaultRoyaltyInfo = await architectInstance.royaltyInfo('0', priceOfArchitectInPORB);
        const royaltyRecipient = defaultRoyaltyInfo[0];
        const royaltyFee = defaultRoyaltyInfo[1];
        const expectedRoyalFeeNumeratorBips = 400;
        expect(royaltyRecipient).to.equal(account9);
        expect(royaltyFee.toString()).to.equal(bigInt(priceOfArchitectInPORB).multiply(expectedRoyalFeeNumeratorBips).divide(10000).toString());
    });
});
