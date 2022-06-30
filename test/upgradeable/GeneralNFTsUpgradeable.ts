import { deployProxy, upgradeProxy } from '@openzeppelin/truffle-upgrades';
import bigInt from 'big-integer';
import { localExpect } from '../lib/test-libraries';
import { GeneralNFTsUpgradeableInstance, PORBUpgradeableInstance, MultiSigWalletInstance, GeneralNFTsUpgradeableTestInstance } from '../../types/truffle-contracts';
import GENERAL_NFTS_UPGRADEABLE_JSON from '../../build/contracts/GeneralNFTsUpgradeable.json';
import PORB_UPGRADEABLE_JSON from '../../build/contracts/PORBUpgradeable.json';
import Web3 from 'web3';
import { AbiItem } from 'web3-utils';
import { getTxIdFromMultiSigWallet } from '../lib/test-helpers';

const config = require('../../config').config;

const generalNFTsUpgradeable = artifacts.require('GeneralNFTsUpgradeable');
const PORBUpgradeable = artifacts.require('PORBUpgradeable');
const multiSigWallet = artifacts.require('MultiSigWallet');
const generalNFTsUpgradeableTest = artifacts.require('GeneralNFTsUpgradeableTest');

const web3 = new Web3(new Web3.providers.HttpProvider(config.AVAX.localSubnetHTTP));
const GENERAL_NFTS_UPGRADEABLE_ABI = GENERAL_NFTS_UPGRADEABLE_JSON.abi as AbiItem[];
const PORB_UPGRADEABLE_ABI = PORB_UPGRADEABLE_JSON.abi as AbiItem[];

contract.skip('GeneralNFTsUpgradeable.sol', ([owner, account1, account2, account3, account4, account5, account6, account7, account8, account9]) => {
    let generalNFTsUpgradeableInstance: GeneralNFTsUpgradeableInstance;
    let PORBUpgradeableInstance: PORBUpgradeableInstance;
    let multiSigWalletInstance: MultiSigWalletInstance;
    let generalNFTsUpgradeableTestInstance: GeneralNFTsUpgradeableTestInstance;
    let generalNFTsUpgradeableContract: any;
    let PORBUpgradeableContract: any;

    beforeEach(async () => {
        // Require 2 signatures for multiSig
        multiSigWalletInstance = await multiSigWallet.new([owner, account1, account2], 2);
        PORBUpgradeableInstance = (await deployProxy(PORBUpgradeable as any, [account1, owner], {
            initializer: 'initialize',
        })) as PORBUpgradeableInstance;
        generalNFTsUpgradeableInstance = (await deployProxy(generalNFTsUpgradeable as any, [PORBUpgradeableInstance.address, account9], {
            initializer: 'initialize',
        })) as GeneralNFTsUpgradeableInstance;
        await PORBUpgradeableInstance.transferOwnership(multiSigWalletInstance.address);
        await generalNFTsUpgradeableInstance.transferOwnership(multiSigWalletInstance.address);

        generalNFTsUpgradeableContract = new web3.eth.Contract(GENERAL_NFTS_UPGRADEABLE_ABI, generalNFTsUpgradeableInstance.address);
        PORBUpgradeableContract = new web3.eth.Contract(PORB_UPGRADEABLE_ABI, PORBUpgradeableInstance.address);
    });

    it("has token name set to 'Portal Fantasy General NFTs'", async () => {
        const tokenName = await generalNFTsUpgradeableInstance.name();
        expect(tokenName).to.equal('Portal Fantasy General NFTs');
    });

    it("has token symbol set to 'PFGN'", async () => {
        const tokenSymbol = await generalNFTsUpgradeableInstance.symbol();
        expect(tokenSymbol).to.equal('PFGN');
    });

    it('can only be paused/unpaused by the owner (multiSigWallet)', async () => {
        let isPaused = await generalNFTsUpgradeableInstance.paused();
        expect(isPaused).to.be.false;

        // Non-owner account attempting to pause should fail
        await localExpect(generalNFTsUpgradeableInstance.setPaused(true, { from: account1 })).to.be.rejected;

        let data = generalNFTsUpgradeableContract.methods.setPaused(true).encodeABI();
        await multiSigWalletInstance.submitTransaction(generalNFTsUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        isPaused = await generalNFTsUpgradeableInstance.paused();
        expect(isPaused).to.be.true;

        // Non-owner account attempting to unpause should fail
        await localExpect(generalNFTsUpgradeableInstance.setPaused(false, { from: account1 })).to.be.rejected;

        data = generalNFTsUpgradeableContract.methods.setPaused(false).encodeABI();
        await multiSigWalletInstance.submitTransaction(generalNFTsUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        isPaused = await generalNFTsUpgradeableInstance.paused();
        expect(isPaused).to.be.false;
    });

    it('allows a general NFT to be minted with payment in PORB', async () => {
        const initialPORBAmountMintedToOwner = web3.utils.toWei('1000000000', 'ether');
        const priceOfGeneralNFTInPORB = web3.utils.toWei('2', 'ether');

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

        await PORBUpgradeableInstance.approve(generalNFTsUpgradeableInstance.address, priceOfGeneralNFTInPORB, { from: account1 });
        await generalNFTsUpgradeableInstance.mintWithPORB({ from: account1 });

        const ownerOfMintedGeneralNFTs = await generalNFTsUpgradeableInstance.ownerOf('0');
        const balanceOfPORBVault = (await PORBUpgradeableInstance.balanceOf(account9)).toString();

        expect(ownerOfMintedGeneralNFTs).to.equal(account1);
        expect(balanceOfPORBVault).to.equal(priceOfGeneralNFTInPORB);
    });

    it('only allows the owner (multiSigWallet) to change mintPriceInPORB', async () => {
        const newMintPriceInPORB = web3.utils.toWei('5', 'ether');

        // Should fail since caller is not the owner
        await localExpect(generalNFTsUpgradeableInstance.setMintPriceInPORB(newMintPriceInPORB, { from: account1 })).to.eventually.be.rejected;

        const data = generalNFTsUpgradeableContract.methods.setMintPriceInPORB(newMintPriceInPORB).encodeABI();
        await multiSigWalletInstance.submitTransaction(generalNFTsUpgradeableInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        const contractMintPriceInPORB = (await generalNFTsUpgradeableInstance.mintPriceInPORB()).toString();
        expect(contractMintPriceInPORB).to.equal(newMintPriceInPORB);
    });

    it('only allows the owner (multiSigWallet) to change the PORB contract address', async () => {
        const newPORBUpgradeableInstance = (await deployProxy(PORBUpgradeable as any, [account1, owner], {
            initializer: 'initialize',
        })) as PORBUpgradeableInstance;

        // Should fail since caller is not the owner
        await localExpect(generalNFTsUpgradeableInstance.setPORB(newPORBUpgradeableInstance.address, { from: account1 })).to.eventually.be.rejected;

        const data = generalNFTsUpgradeableContract.methods.setPORB(newPORBUpgradeableInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(generalNFTsUpgradeableInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        const contractPORBAddress = (await generalNFTsUpgradeableInstance.PORB()).toString();
        expect(contractPORBAddress).to.equal(newPORBUpgradeableInstance.address);
    });

    it('only allows the owner (multiSigWallet) to change the PORB vault', async () => {
        // Should fail since caller is not the owner
        await localExpect(generalNFTsUpgradeableInstance.setVault(account2, { from: account1 })).to.eventually.be.rejected;

        const data = generalNFTsUpgradeableContract.methods.setVault(account2).encodeABI();
        await multiSigWalletInstance.submitTransaction(generalNFTsUpgradeableInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        const contractPORBVault = (await generalNFTsUpgradeableInstance.vault()).toString();
        expect(contractPORBVault).to.equal(account2);
    });

    // @TODO: Update this test when we have the final base URI implemented in the contract
    it('generates a valid token URI', async () => {
        const initialPORBAmountMintedToOwner = web3.utils.toWei('1000000000', 'ether');
        const priceOfGeneralNFTInPORB = web3.utils.toWei('2', 'ether');

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

        await PORBUpgradeableInstance.approve(generalNFTsUpgradeableInstance.address, priceOfGeneralNFTInPORB, { from: account1 });
        await generalNFTsUpgradeableInstance.mintWithPORB({ from: account1 });

        const tokenURI = await generalNFTsUpgradeableInstance.tokenURI('0');
        expect(tokenURI).to.equal('https://www.portalfantasy.io/0');
    });

    it('allows only the owner (multiSigWallet) to change the base URI', async () => {
        const initialPORBAmountMintedToOwner = web3.utils.toWei('1000000000', 'ether');
        const priceOfGeneralNFTInPORB = web3.utils.toWei('2', 'ether');

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

        await PORBUpgradeableInstance.approve(generalNFTsUpgradeableInstance.address, priceOfGeneralNFTInPORB, { from: account1 });
        await generalNFTsUpgradeableInstance.mintWithPORB({ from: account1 });

        let tokenURI = await generalNFTsUpgradeableInstance.tokenURI('0');
        expect(tokenURI).to.equal('https://www.portalfantasy.io/0');

        // Expect this to fail, as only the owner can change the base URI
        await localExpect(generalNFTsUpgradeableInstance.setBaseURIString('https://www.foo.com/', { from: account1 })).to.eventually.be.rejected;

        data = generalNFTsUpgradeableContract.methods.setBaseURIString('https://www.bar.com/').encodeABI();
        await multiSigWalletInstance.submitTransaction(generalNFTsUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        tokenURI = await generalNFTsUpgradeableInstance.tokenURI('0');
        expect(tokenURI).to.equal('https://www.bar.com/0');
    });

    it('allows only the owner (multiSigWallet) to change the contract URI', async () => {
        let contractURI = await generalNFTsUpgradeableInstance.contractURI();
        expect(contractURI).to.equal('https://www.portalfantasy.io/generalNFTs/');

        // Expect this to fail, as only the owner can change the base URI
        await localExpect(generalNFTsUpgradeableInstance.setContractURIString('https://www.foo.com/generalNFTs/', { from: account1 })).to.eventually.be.rejected;

        const data = generalNFTsUpgradeableContract.methods.setContractURIString('https://www.bar.com/generalNFTs/').encodeABI();
        await multiSigWalletInstance.submitTransaction(generalNFTsUpgradeableInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        contractURI = await generalNFTsUpgradeableInstance.contractURI();
        expect(contractURI).to.equal('https://www.bar.com/generalNFTs/');
    });

    it('applies the default royalty correctly', async () => {
        const initialPORBAmountMintedToOwner = web3.utils.toWei('1000000000', 'ether');
        const priceOfGeneralNFTInPORB = web3.utils.toWei('2', 'ether');

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

        await PORBUpgradeableInstance.approve(generalNFTsUpgradeableInstance.address, priceOfGeneralNFTInPORB, { from: account1 });
        await generalNFTsUpgradeableInstance.mintWithPORB({ from: account1 });

        // Assert expected royalty parameters
        let defaultRoyaltyInfo = await generalNFTsUpgradeableInstance.royaltyInfo('0', priceOfGeneralNFTInPORB);
        const royaltyRecipient = defaultRoyaltyInfo[0];
        const royaltyFee = defaultRoyaltyInfo[1];
        const expectedRoyalFeeNumeratorBips = 400;
        expect(royaltyRecipient).to.equal(account9);
        expect(royaltyFee.toString()).to.equal(bigInt(priceOfGeneralNFTInPORB).multiply(expectedRoyalFeeNumeratorBips).divide(10000).toString());
    });

    it('allows only the owner to change the default royalty fee', async () => {
        const initialPORBAmountMintedToOwner = web3.utils.toWei('1000000000', 'ether');
        const priceOfGeneralNFTInPORB = web3.utils.toWei('2', 'ether');

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

        await PORBUpgradeableInstance.approve(generalNFTsUpgradeableInstance.address, priceOfGeneralNFTInPORB, { from: account1 });
        await generalNFTsUpgradeableInstance.mintWithPORB({ from: account1 });

        // Expect this to fail, as only the owner can change the base URI
        await localExpect(generalNFTsUpgradeableInstance.setDefaultRoyalty(300, { from: account1 })).to.eventually.be.rejected;

        const updatedRoyaltyFeeBips = 100;
        data = generalNFTsUpgradeableContract.methods.setDefaultRoyalty(updatedRoyaltyFeeBips).encodeABI();
        await multiSigWalletInstance.submitTransaction(generalNFTsUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        // Assert expected royalty parameters
        let defaultRoyaltyInfo = await generalNFTsUpgradeableInstance.royaltyInfo('0', priceOfGeneralNFTInPORB);
        const royaltyRecipient = defaultRoyaltyInfo[0];
        const royaltyFee = defaultRoyaltyInfo[1];
        expect(royaltyRecipient).to.equal(account9);
        expect(royaltyFee.toString()).to.equal(bigInt(priceOfGeneralNFTInPORB).multiply(updatedRoyaltyFeeBips).divide(10000).toString());
    });

    it('allows only the owner to change the token custom royalty fee', async () => {
        const initialPORBAmountMintedToOwner = web3.utils.toWei('1000000000', 'ether');
        const priceOfGeneralNFTInPORB = web3.utils.toWei('2', 'ether');

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

        await PORBUpgradeableInstance.approve(generalNFTsUpgradeableInstance.address, priceOfGeneralNFTInPORB, { from: account1 });
        await generalNFTsUpgradeableInstance.mintWithPORB({ from: account1 });

        // Expect this to fail, as only the owner can change the base URI
        await localExpect(generalNFTsUpgradeableInstance.setTokenRoyalty('0', 300, { from: account1 })).to.eventually.be.rejected;

        const updatedRoyaltyFeeBips = 100;
        data = generalNFTsUpgradeableContract.methods.setTokenRoyalty('0', updatedRoyaltyFeeBips).encodeABI();
        await multiSigWalletInstance.submitTransaction(generalNFTsUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        // Assert expected royalty parameters
        let defaultRoyaltyInfo = await generalNFTsUpgradeableInstance.royaltyInfo('0', priceOfGeneralNFTInPORB);
        const royaltyRecipient = defaultRoyaltyInfo[0];
        const royaltyFee = defaultRoyaltyInfo[1];
        expect(royaltyRecipient).to.equal(account9);
        expect(royaltyFee.toString()).to.equal(bigInt(priceOfGeneralNFTInPORB).multiply(updatedRoyaltyFeeBips).divide(10000).toString());
    });

    it('allows only the owner to reset the custom royalty fee', async () => {
        const initialPORBAmountMintedToOwner = web3.utils.toWei('1000000000', 'ether');
        const priceOfGeneralNFTInPORB = web3.utils.toWei('2', 'ether');

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

        await PORBUpgradeableInstance.approve(generalNFTsUpgradeableInstance.address, priceOfGeneralNFTInPORB, { from: account1 });
        await generalNFTsUpgradeableInstance.mintWithPORB({ from: account1 });

        const updatedRoyaltyFeeBips = 100;
        data = generalNFTsUpgradeableContract.methods.setTokenRoyalty('0', updatedRoyaltyFeeBips).encodeABI();
        await multiSigWalletInstance.submitTransaction(generalNFTsUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        // Expect this to fail, as only the owner can change the base URI
        await localExpect(generalNFTsUpgradeableInstance.resetTokenRoyalty('0', { from: account1 })).to.eventually.be.rejected;

        data = generalNFTsUpgradeableContract.methods.resetTokenRoyalty('0').encodeABI();
        await multiSigWalletInstance.submitTransaction(generalNFTsUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        // Assert expected royalty parameters
        let defaultRoyaltyInfo = await generalNFTsUpgradeableInstance.royaltyInfo('0', priceOfGeneralNFTInPORB);
        const royaltyRecipient = defaultRoyaltyInfo[0];
        const royaltyFee = defaultRoyaltyInfo[1];
        const expectedRoyalFeeNumeratorBips = 400;
        expect(royaltyRecipient).to.equal(account9);
        expect(royaltyFee.toString()).to.equal(bigInt(priceOfGeneralNFTInPORB).multiply(expectedRoyalFeeNumeratorBips).divide(10000).toString());
    });

    it('can be upgraded and store new state variables from the new contract', async () => {
        const tokenSymbol = await generalNFTsUpgradeableInstance.symbol();
        expect(tokenSymbol).to.equal('PFGN');

        const initialPORBAmountMintedToOwner = web3.utils.toWei('1000000000', 'ether');
        const priceOfGeneralNFTInPORB = web3.utils.toWei('2', 'ether');

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

        await PORBUpgradeableInstance.approve(generalNFTsUpgradeableInstance.address, priceOfGeneralNFTInPORB, { from: account1 });
        await generalNFTsUpgradeableInstance.mintWithPORB({ from: account1 });

        generalNFTsUpgradeableTestInstance = (await upgradeProxy(generalNFTsUpgradeableInstance.address, generalNFTsUpgradeableTest as any)) as GeneralNFTsUpgradeableTestInstance;

        // Original state variables remain unchanged
        const newTokenSymbol = await generalNFTsUpgradeableTestInstance.symbol();
        expect(newTokenSymbol).to.equal('PFGN');
        const ownerOfMintedGeneralNFT1 = await generalNFTsUpgradeableTestInstance.ownerOf('0');
        expect(ownerOfMintedGeneralNFT1).to.equal(account1);

        // Mint PORB
        data = PORBUpgradeableContract.methods.mint(account2, initialPORBAmountMintedToOwner).encodeABI();
        await multiSigWalletInstance.submitTransaction(PORBUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        await PORBUpgradeableInstance.approve(generalNFTsUpgradeableTestInstance.address, priceOfGeneralNFTInPORB, { from: account2 });
        await generalNFTsUpgradeableInstance.mintWithPORB({ from: account2 });

        // Can still mint new tokens
        const ownerOfMintedGeneralNFT2 = await generalNFTsUpgradeableTestInstance.ownerOf('1');
        expect(ownerOfMintedGeneralNFT2).to.equal(account2);

        // Can still only be paused/unpaused by the owner of the previous contract (multiSigWalleet)
        data = generalNFTsUpgradeableContract.methods.setPaused(true).encodeABI();
        await multiSigWalletInstance.submitTransaction(generalNFTsUpgradeableTestInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        // Non-existing method cannot be used to set state variable
        data = generalNFTsUpgradeableContract.methods.setBaseURIString('https://www.foo.com/').encodeABI();
        await multiSigWalletInstance.submitTransaction(generalNFTsUpgradeableTestInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;
        const baseURIString = await generalNFTsUpgradeableTestInstance.baseURIString();
        expect(baseURIString).to.not.equal('https://www.foo.com/');
    });
});
