import { deployProxy, upgradeProxy } from '@openzeppelin/truffle-upgrades';
import bigInt from 'big-integer';
import { localExpect } from '../lib/test-libraries';
import { CosmeticsUpgradeableInstance, PORBUpgradeableInstance, MultiSigWalletInstance, CosmeticsUpgradeableTestInstance } from '../../types/truffle-contracts';
import COSMETICS_UPGRADEABLE_JSON from '../../build/contracts/CosmeticsUpgradeable.json';
import PORB_UPGRADEABLE_JSON from '../../build/contracts/PORBUpgradeable.json';
import Web3 from 'web3';
import { AbiItem } from 'web3-utils';
import { getTxIdFromMultiSigWallet } from '../lib/test-helpers';

const config = require('../../config').config;

const cosmeticsUpgradeable = artifacts.require('CosmeticsUpgradeable');
const PORBUpgradeable = artifacts.require('PORBUpgradeable');
const multiSigWallet = artifacts.require('MultiSigWallet');
const cosmeticsUpgradeableTest = artifacts.require('CosmeticsUpgradeableTest');

const web3 = new Web3(new Web3.providers.HttpProvider(config.AVAX.localSubnetHTTP));
const COSMETICS_UPGRADEABLE_ABI = COSMETICS_UPGRADEABLE_JSON.abi as AbiItem[];
const PORB_UPGRADEABLE_ABI = PORB_UPGRADEABLE_JSON.abi as AbiItem[];

contract.skip('CosmeticsUpgradeable.sol', ([owner, account1, account2, account3, account4, account5, account6, account7, account8, account9]) => {
    let cosmeticsUpgradeableInstance: CosmeticsUpgradeableInstance;
    let PORBUpgradeableInstance: PORBUpgradeableInstance;
    let multiSigWalletInstance: MultiSigWalletInstance;
    let cosmeticsUpgradeableTestInstance: CosmeticsUpgradeableTestInstance;
    let cosmeticsUpgradeableContract: any;
    let PORBUpgradeableContract: any;

    beforeEach(async () => {
        // Require 2 signatures for multiSig
        multiSigWalletInstance = await multiSigWallet.new([owner, account1, account2], 2);
        PORBUpgradeableInstance = (await deployProxy(PORBUpgradeable as any, [account1, owner], {
            initializer: 'initialize',
        })) as PORBUpgradeableInstance;
        cosmeticsUpgradeableInstance = (await deployProxy(cosmeticsUpgradeable as any, [PORBUpgradeableInstance.address, account9], {
            initializer: 'initialize',
        })) as CosmeticsUpgradeableInstance;
        await PORBUpgradeableInstance.transferOwnership(multiSigWalletInstance.address);
        await cosmeticsUpgradeableInstance.transferOwnership(multiSigWalletInstance.address);

        cosmeticsUpgradeableContract = new web3.eth.Contract(COSMETICS_UPGRADEABLE_ABI, cosmeticsUpgradeableInstance.address);
        PORBUpgradeableContract = new web3.eth.Contract(PORB_UPGRADEABLE_ABI, PORBUpgradeableInstance.address);
    });

    it("has token name set to 'Portal Fantasy Cosmetics'", async () => {
        const tokenName = await cosmeticsUpgradeableInstance.name();
        expect(tokenName).to.equal('Portal Fantasy Cosmetics');
    });

    it("has token symbol set to 'PCOS'", async () => {
        const tokenSymbol = await cosmeticsUpgradeableInstance.symbol();
        expect(tokenSymbol).to.equal('PCOS');
    });

    it('can only be paused/unpaused by the owner (multiSigWallet)', async () => {
        let isPaused = await cosmeticsUpgradeableInstance.paused();
        expect(isPaused).to.be.false;

        // Non-owner account attempting to pause should fail
        await localExpect(cosmeticsUpgradeableInstance.setPaused(true, { from: account1 })).to.be.rejected;

        let data = cosmeticsUpgradeableContract.methods.setPaused(true).encodeABI();
        await multiSigWalletInstance.submitTransaction(cosmeticsUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        isPaused = await cosmeticsUpgradeableInstance.paused();
        expect(isPaused).to.be.true;

        // Non-owner account attempting to unpause should fail
        await localExpect(cosmeticsUpgradeableInstance.setPaused(false, { from: account1 })).to.be.rejected;

        data = cosmeticsUpgradeableContract.methods.setPaused(false).encodeABI();
        await multiSigWalletInstance.submitTransaction(cosmeticsUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        isPaused = await cosmeticsUpgradeableInstance.paused();
        expect(isPaused).to.be.false;
    });

    it('allows a Cosmetics NFT to be minted with payment in PORB', async () => {
        const initialPORBAmountMintedToOwner = web3.utils.toWei('1000000000', 'ether');
        const priceOfCosmeticInPORB = web3.utils.toWei('2', 'ether');

        // Add controller for PORB
        let data = PORBUpgradeableContract.methods.addController(multiSigWalletInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(PORBUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Mint PORB
        data = PORBUpgradeableContract.methods.mint(account1, initialPORBAmountMintedToOwner).encodeABI();
        await multiSigWalletInstance.submitTransaction(PORBUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        await PORBUpgradeableInstance.approve(cosmeticsUpgradeableInstance.address, priceOfCosmeticInPORB, { from: account1 });
        await cosmeticsUpgradeableInstance.mintWithPORB({ from: account1 });

        const ownerOfMintedCosmetics = await cosmeticsUpgradeableInstance.ownerOf('0');
        const balanceOfPORBVault = (await PORBUpgradeableInstance.balanceOf(account9)).toString();

        expect(ownerOfMintedCosmetics).to.equal(account1);
        expect(balanceOfPORBVault).to.equal(priceOfCosmeticInPORB);
    });

    it('only allows the owner (multiSigWallet) to change mintPriceInPORB', async () => {
        const newMintPriceInPORB = web3.utils.toWei('5', 'ether');

        // Should fail since caller is not the owner
        await localExpect(cosmeticsUpgradeableInstance.setMintPriceInPORB(newMintPriceInPORB, { from: account1 })).to.eventually.be.rejected;

        const data = cosmeticsUpgradeableContract.methods.setMintPriceInPORB(newMintPriceInPORB).encodeABI();
        await multiSigWalletInstance.submitTransaction(cosmeticsUpgradeableInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        const contractMintPriceInPORB = (await cosmeticsUpgradeableInstance.mintPriceInPORB()).toString();
        expect(contractMintPriceInPORB).to.equal(newMintPriceInPORB);
    });

    it('only allows the owner (multiSigWallet) to change the PORB contract address', async () => {
        const newPORBUpgradeableInstance = (await deployProxy(PORBUpgradeable as any, [account1, owner], {
            initializer: 'initialize',
        })) as PORBUpgradeableInstance;

        // Should fail since caller is not the owner
        await localExpect(cosmeticsUpgradeableInstance.setPORB(newPORBUpgradeableInstance.address, { from: account1 })).to.eventually.be.rejected;

        const data = cosmeticsUpgradeableContract.methods.setPORB(newPORBUpgradeableInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(cosmeticsUpgradeableInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        const contractPORBAddress = (await cosmeticsUpgradeableInstance.PORB()).toString();
        expect(contractPORBAddress).to.equal(newPORBUpgradeableInstance.address);
    });

    it('only allows the owner (multiSigWallet) to change the PORB vault', async () => {
        // Should fail since caller is not the owner
        await localExpect(cosmeticsUpgradeableInstance.setVault(account2, { from: account1 })).to.eventually.be.rejected;

        const data = cosmeticsUpgradeableContract.methods.setVault(account2).encodeABI();
        await multiSigWalletInstance.submitTransaction(cosmeticsUpgradeableInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        const contractPORBVault = (await cosmeticsUpgradeableInstance.vault()).toString();
        expect(contractPORBVault).to.equal(account2);
    });

    // @TODO: Update this test when we have the final base URI implemented in the contract
    it('generates a valid token URI', async () => {
        const initialPORBAmountMintedToOwner = web3.utils.toWei('1000000000', 'ether');
        const priceOfCosmeticInPORB = web3.utils.toWei('2', 'ether');

        // Add controller for PORB
        let data = PORBUpgradeableContract.methods.addController(multiSigWalletInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(PORBUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Mint PORB
        data = PORBUpgradeableContract.methods.mint(account1, initialPORBAmountMintedToOwner).encodeABI();
        await multiSigWalletInstance.submitTransaction(PORBUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        await PORBUpgradeableInstance.approve(cosmeticsUpgradeableInstance.address, priceOfCosmeticInPORB, { from: account1 });
        await cosmeticsUpgradeableInstance.mintWithPORB({ from: account1 });

        const tokenURI = await cosmeticsUpgradeableInstance.tokenURI('0');
        expect(tokenURI).to.equal('https://www.portalfantasy.io/0');
    });

    it('allows only the owner (multiSigWallet) to change the base URI', async () => {
        const initialPORBAmountMintedToOwner = web3.utils.toWei('1000000000', 'ether');
        const priceOfCosmeticInPORB = web3.utils.toWei('2', 'ether');

        // Add controller for PORB
        let data = PORBUpgradeableContract.methods.addController(multiSigWalletInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(PORBUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Mint PORB
        data = PORBUpgradeableContract.methods.mint(account1, initialPORBAmountMintedToOwner).encodeABI();
        await multiSigWalletInstance.submitTransaction(PORBUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        await PORBUpgradeableInstance.approve(cosmeticsUpgradeableInstance.address, priceOfCosmeticInPORB, { from: account1 });
        await cosmeticsUpgradeableInstance.mintWithPORB({ from: account1 });

        let tokenURI = await cosmeticsUpgradeableInstance.tokenURI('0');
        expect(tokenURI).to.equal('https://www.portalfantasy.io/0');

        // Expect this to fail, as only the owner can change the base URI
        await localExpect(cosmeticsUpgradeableInstance.setBaseURIString('https://www.foo.com/', { from: account1 })).to.eventually.be.rejected;

        data = cosmeticsUpgradeableContract.methods.setBaseURIString('https://www.bar.com/').encodeABI();
        await multiSigWalletInstance.submitTransaction(cosmeticsUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        tokenURI = await cosmeticsUpgradeableInstance.tokenURI('0');
        expect(tokenURI).to.equal('https://www.bar.com/0');
    });

    it('allows only the owner (multiSigWallet) to change the contract URI', async () => {
        let contractURI = await cosmeticsUpgradeableInstance.contractURI();
        expect(contractURI).to.equal('https://www.portalfantasy.io/cosmetics/');

        // Expect this to fail, as only the owner can change the base URI
        await localExpect(cosmeticsUpgradeableInstance.setContractURIString('https://www.foo.com/cosmetics/', { from: account1 })).to.eventually.be.rejected;

        const data = cosmeticsUpgradeableContract.methods.setContractURIString('https://www.bar.com/cosmetics/').encodeABI();
        await multiSigWalletInstance.submitTransaction(cosmeticsUpgradeableInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        contractURI = await cosmeticsUpgradeableInstance.contractURI();
        expect(contractURI).to.equal('https://www.bar.com/cosmetics/');
    });

    it('applies the default royalty correctly', async () => {
        const initialPORBAmountMintedToOwner = web3.utils.toWei('1000000000', 'ether');
        const priceOfCosmeticInPORB = web3.utils.toWei('2', 'ether');

        // Add controller for PORB
        let data = PORBUpgradeableContract.methods.addController(multiSigWalletInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(PORBUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Mint PORB
        data = PORBUpgradeableContract.methods.mint(account1, initialPORBAmountMintedToOwner).encodeABI();
        await multiSigWalletInstance.submitTransaction(PORBUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        await PORBUpgradeableInstance.approve(cosmeticsUpgradeableInstance.address, priceOfCosmeticInPORB, { from: account1 });
        await cosmeticsUpgradeableInstance.mintWithPORB({ from: account1 });

        // Assert expected royalty parameters
        let defaultRoyaltyInfo = await cosmeticsUpgradeableInstance.royaltyInfo('0', priceOfCosmeticInPORB);
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
        let data = PORBUpgradeableContract.methods.addController(multiSigWalletInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(PORBUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Mint PORB
        data = PORBUpgradeableContract.methods.mint(account1, initialPORBAmountMintedToOwner).encodeABI();
        await multiSigWalletInstance.submitTransaction(PORBUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        await PORBUpgradeableInstance.approve(cosmeticsUpgradeableInstance.address, priceOfCosmeticInPORB, { from: account1 });
        await cosmeticsUpgradeableInstance.mintWithPORB({ from: account1 });

        // Expect this to fail, as only the owner can change the base URI
        await localExpect(cosmeticsUpgradeableInstance.setDefaultRoyalty(300, { from: account1 })).to.eventually.be.rejected;

        const updatedRoyaltyFeeBips = 100;
        data = cosmeticsUpgradeableContract.methods.setDefaultRoyalty(updatedRoyaltyFeeBips).encodeABI();
        await multiSigWalletInstance.submitTransaction(cosmeticsUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        // Assert expected royalty parameters
        let defaultRoyaltyInfo = await cosmeticsUpgradeableInstance.royaltyInfo('0', priceOfCosmeticInPORB);
        const royaltyRecipient = defaultRoyaltyInfo[0];
        const royaltyFee = defaultRoyaltyInfo[1];
        expect(royaltyRecipient).to.equal(account9);
        expect(royaltyFee.toString()).to.equal(bigInt(priceOfCosmeticInPORB).multiply(updatedRoyaltyFeeBips).divide(10000).toString());
    });

    it('allows only the owner to change the token custom royalty fee', async () => {
        const initialPORBAmountMintedToOwner = web3.utils.toWei('1000000000', 'ether');
        const priceOfCosmeticInPORB = web3.utils.toWei('2', 'ether');

        // Add controller for PORB
        let data = PORBUpgradeableContract.methods.addController(multiSigWalletInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(PORBUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Mint PORB
        data = PORBUpgradeableContract.methods.mint(account1, initialPORBAmountMintedToOwner).encodeABI();
        await multiSigWalletInstance.submitTransaction(PORBUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        await PORBUpgradeableInstance.approve(cosmeticsUpgradeableInstance.address, priceOfCosmeticInPORB, { from: account1 });
        await cosmeticsUpgradeableInstance.mintWithPORB({ from: account1 });

        // Expect this to fail, as only the owner can change the base URI
        await localExpect(cosmeticsUpgradeableInstance.setTokenRoyalty('0', 300, { from: account1 })).to.eventually.be.rejected;

        const updatedRoyaltyFeeBips = 100;
        data = cosmeticsUpgradeableContract.methods.setTokenRoyalty('0', updatedRoyaltyFeeBips).encodeABI();
        await multiSigWalletInstance.submitTransaction(cosmeticsUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        // Assert expected royalty parameters
        let defaultRoyaltyInfo = await cosmeticsUpgradeableInstance.royaltyInfo('0', priceOfCosmeticInPORB);
        const royaltyRecipient = defaultRoyaltyInfo[0];
        const royaltyFee = defaultRoyaltyInfo[1];
        expect(royaltyRecipient).to.equal(account9);
        expect(royaltyFee.toString()).to.equal(bigInt(priceOfCosmeticInPORB).multiply(updatedRoyaltyFeeBips).divide(10000).toString());
    });

    it('allows only the owner to reset the custom royalty fee', async () => {
        const initialPORBAmountMintedToOwner = web3.utils.toWei('1000000000', 'ether');
        const priceOfCosmeticInPORB = web3.utils.toWei('2', 'ether');

        // Add controller for PORB
        let data = PORBUpgradeableContract.methods.addController(multiSigWalletInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(PORBUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Mint PORB
        data = PORBUpgradeableContract.methods.mint(account1, initialPORBAmountMintedToOwner).encodeABI();
        await multiSigWalletInstance.submitTransaction(PORBUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        await PORBUpgradeableInstance.approve(cosmeticsUpgradeableInstance.address, priceOfCosmeticInPORB, { from: account1 });
        await cosmeticsUpgradeableInstance.mintWithPORB({ from: account1 });

        const updatedRoyaltyFeeBips = 100;
        data = cosmeticsUpgradeableContract.methods.setTokenRoyalty('0', updatedRoyaltyFeeBips).encodeABI();
        await multiSigWalletInstance.submitTransaction(cosmeticsUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        // Expect this to fail, as only the owner can change the base URI
        await localExpect(cosmeticsUpgradeableInstance.resetTokenRoyalty('0', { from: account1 })).to.eventually.be.rejected;

        data = cosmeticsUpgradeableContract.methods.resetTokenRoyalty('0').encodeABI();
        await multiSigWalletInstance.submitTransaction(cosmeticsUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        // Assert expected royalty parameters
        let defaultRoyaltyInfo = await cosmeticsUpgradeableInstance.royaltyInfo('0', priceOfCosmeticInPORB);
        const royaltyRecipient = defaultRoyaltyInfo[0];
        const royaltyFee = defaultRoyaltyInfo[1];
        const expectedRoyalFeeNumeratorBips = 400;
        expect(royaltyRecipient).to.equal(account9);
        expect(royaltyFee.toString()).to.equal(bigInt(priceOfCosmeticInPORB).multiply(expectedRoyalFeeNumeratorBips).divide(10000).toString());
    });

    it.skip('can be upgraded and store new state variables from the new contract', async () => {
        const tokenSymbol = await cosmeticsUpgradeableInstance.symbol();
        expect(tokenSymbol).to.equal('PCOS');

        const initialPORBAmountMintedToOwner = web3.utils.toWei('1000000000', 'ether');
        const priceOfCosmeticInPORB = web3.utils.toWei('2', 'ether');

        // Add controller for PORB
        let data = PORBUpgradeableContract.methods.addController(multiSigWalletInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(PORBUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Mint PORB
        data = PORBUpgradeableContract.methods.mint(account1, initialPORBAmountMintedToOwner).encodeABI();
        await multiSigWalletInstance.submitTransaction(PORBUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        await PORBUpgradeableInstance.approve(cosmeticsUpgradeableInstance.address, priceOfCosmeticInPORB, { from: account1 });
        await cosmeticsUpgradeableInstance.mintWithPORB({ from: account1 });

        cosmeticsUpgradeableTestInstance = (await upgradeProxy(cosmeticsUpgradeableInstance.address, cosmeticsUpgradeableTest as any)) as CosmeticsUpgradeableTestInstance;

        // Original state variables remain unchanged
        const newTokenSymbol = await cosmeticsUpgradeableTestInstance.symbol();
        expect(newTokenSymbol).to.equal('PCOS');
        const ownerOfMintedCosmetic1 = await cosmeticsUpgradeableTestInstance.ownerOf('0');
        expect(ownerOfMintedCosmetic1).to.equal(account1);

        // Mint PORB
        data = PORBUpgradeableContract.methods.mint(account2, initialPORBAmountMintedToOwner).encodeABI();
        await multiSigWalletInstance.submitTransaction(PORBUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        await PORBUpgradeableInstance.approve(cosmeticsUpgradeableTestInstance.address, priceOfCosmeticInPORB, { from: account2 });
        await cosmeticsUpgradeableInstance.mintWithPORB({ from: account2 });

        // Can still mint new tokens
        const ownerOfMintedCosmetic2 = await cosmeticsUpgradeableTestInstance.ownerOf('1');
        expect(ownerOfMintedCosmetic2).to.equal(account2);

        // Can still only be paused/unpaused by the owner of the previous contract (multiSigWalleet)
        data = cosmeticsUpgradeableContract.methods.setPaused(true).encodeABI();
        await multiSigWalletInstance.submitTransaction(cosmeticsUpgradeableTestInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        // Non-existing method cannot be used to set state variable
        data = cosmeticsUpgradeableContract.methods.setBaseURIString('https://www.foo.com/').encodeABI();
        await multiSigWalletInstance.submitTransaction(cosmeticsUpgradeableTestInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;
        const baseURIString = await cosmeticsUpgradeableTestInstance.baseURIString();
        expect(baseURIString).to.not.equal('https://www.foo.com/');
    });
});
