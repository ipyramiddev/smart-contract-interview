import { deployProxy, upgradeProxy } from '@openzeppelin/truffle-upgrades';
import bigInt from 'big-integer';
import { localExpect } from '../lib/test-libraries';
import { ArchitectUpgradeableInstance, PORBUpgradeableInstance, MultiSigWalletInstance, ArchitectUpgradeableTestInstance } from '../../types/truffle-contracts';
import ARCHITECT_UPGRADEABLE_JSON from '../../build/contracts/ArchitectUpgradeable.json';
import PORB_UPGRADEABLE_JSON from '../../build/contracts/PORBUpgradeable.json';
import Web3 from 'web3';
import { AbiItem } from 'web3-utils';
import { getTxIdFromMultiSigWallet } from '../lib/test-helpers';

const config = require('../../config').config;

const architectUpgradeable = artifacts.require('ArchitectUpgradeable');
const PORBUpgradeable = artifacts.require('PORBUpgradeable');
const multiSigWallet = artifacts.require('MultiSigWallet');
const architectUpgradeableTest = artifacts.require('ArchitectUpgradeableTest');

const web3 = new Web3(new Web3.providers.HttpProvider(config.AVAX.localSubnetHTTP));
const ARCHITECT_UPGRADEABLE_ABI = ARCHITECT_UPGRADEABLE_JSON.abi as AbiItem[];
const PORB_UPGRADEABLE_ABI = PORB_UPGRADEABLE_JSON.abi as AbiItem[];

contract.skip('ArchitectUpgradeable.sol', ([owner, account1, account2, account3, account4, account5, account6, account7, account8, account9]) => {
    let architectUpgradeableInstance: ArchitectUpgradeableInstance;
    let PORBUpgradeableInstance: PORBUpgradeableInstance;
    let multiSigWalletInstance: MultiSigWalletInstance;
    let architectUpgradeableTestInstance: ArchitectUpgradeableTestInstance;
    let architectUpgradeableContract: any;
    let PORBUpgradeableContract: any;

    beforeEach(async () => {
        // Require 2 signatures for multiSig
        multiSigWalletInstance = await multiSigWallet.new([owner, account1, account2], 2);
        PORBUpgradeableInstance = (await deployProxy(PORBUpgradeable as any, [account1, owner], {
            initializer: 'initialize',
        })) as PORBUpgradeableInstance;
        architectUpgradeableInstance = (await deployProxy(architectUpgradeable as any, [PORBUpgradeableInstance.address, account9], {
            initializer: 'initialize',
        })) as ArchitectUpgradeableInstance;
        await PORBUpgradeableInstance.transferOwnership(multiSigWalletInstance.address);
        await architectUpgradeableInstance.transferOwnership(multiSigWalletInstance.address);

        architectUpgradeableContract = new web3.eth.Contract(ARCHITECT_UPGRADEABLE_ABI, architectUpgradeableInstance.address);
        PORBUpgradeableContract = new web3.eth.Contract(PORB_UPGRADEABLE_ABI, PORBUpgradeableInstance.address);
    });

    it("has token name set to 'Portal Fantasy Architect'", async () => {
        const tokenName = await architectUpgradeableInstance.name();
        expect(tokenName).to.equal('Portal Fantasy Architect');
    });

    it("has token symbol set to 'PHAR'", async () => {
        const tokenSymbol = await architectUpgradeableInstance.symbol();
        expect(tokenSymbol).to.equal('PHAR');
    });

    it('can only be paused/unpaused by the owner (multiSigWallet)', async () => {
        let isPaused = await architectUpgradeableInstance.paused();
        expect(isPaused).to.be.false;

        // Non-owner account attempting to pause should fail
        await localExpect(architectUpgradeableInstance.setPaused(true, { from: account1 })).to.be.rejected;

        let data = architectUpgradeableContract.methods.setPaused(true).encodeABI();
        await multiSigWalletInstance.submitTransaction(architectUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        isPaused = await architectUpgradeableInstance.paused();
        expect(isPaused).to.be.true;

        // Non-owner account attempting to unpause should fail
        await localExpect(architectUpgradeableInstance.setPaused(false, { from: account1 })).to.be.rejected;

        data = architectUpgradeableContract.methods.setPaused(false).encodeABI();
        await multiSigWalletInstance.submitTransaction(architectUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        isPaused = await architectUpgradeableInstance.paused();
        expect(isPaused).to.be.false;
    });

    it('allows a Architect NFT to be minted with payment in PORB', async () => {
        const initialPORBAmountMintedToOwner = web3.utils.toWei('1000000000', 'ether');
        const priceOfArchitectInPORB = web3.utils.toWei('2', 'ether');

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

        await PORBUpgradeableInstance.approve(architectUpgradeableInstance.address, priceOfArchitectInPORB, { from: account1 });
        await architectUpgradeableInstance.mintWithPORB({ from: account1 });

        const ownerOfMintedArchitect = await architectUpgradeableInstance.ownerOf('0');
        const balanceOfPORBVault = (await PORBUpgradeableInstance.balanceOf(account9)).toString();

        expect(ownerOfMintedArchitect).to.equal(account1);
        expect(balanceOfPORBVault).to.equal(priceOfArchitectInPORB);
    });

    it('only allows the owner (multiSigWallet) to change mintPriceInPORB', async () => {
        const newMintPriceInPORB = web3.utils.toWei('5', 'ether');

        // Should fail since caller is not the owner
        await localExpect(architectUpgradeableInstance.setMintPriceInPORB(newMintPriceInPORB, { from: account1 })).to.eventually.be.rejected;

        const data = architectUpgradeableContract.methods.setMintPriceInPORB(newMintPriceInPORB).encodeABI();
        await multiSigWalletInstance.submitTransaction(architectUpgradeableInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        const contractMintPriceInPORB = (await architectUpgradeableInstance.mintPriceInPORB()).toString();
        expect(contractMintPriceInPORB).to.equal(newMintPriceInPORB);
    });

    it('only allows the owner (multiSigWallet) to change the PORB contract address', async () => {
        const newPORBUpgradeableInstance = (await deployProxy(PORBUpgradeable as any, [account1, owner], {
            initializer: 'initialize',
        })) as PORBUpgradeableInstance;

        // Should fail since caller is not the owner
        await localExpect(architectUpgradeableInstance.setPORB(newPORBUpgradeableInstance.address, { from: account1 })).to.eventually.be.rejected;

        const data = architectUpgradeableContract.methods.setPORB(newPORBUpgradeableInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(architectUpgradeableInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        const contractPORBAddress = (await architectUpgradeableInstance.PORB()).toString();
        expect(contractPORBAddress).to.equal(newPORBUpgradeableInstance.address);
    });

    it('only allows the owner (multiSigWallet) to change the PORB vault', async () => {
        // Should fail since caller is not the owner
        await localExpect(architectUpgradeableInstance.setVault(account2, { from: account1 })).to.eventually.be.rejected;

        const data = architectUpgradeableContract.methods.setVault(account2).encodeABI();
        await multiSigWalletInstance.submitTransaction(architectUpgradeableInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        const contractPORBVault = (await architectUpgradeableInstance.vault()).toString();
        expect(contractPORBVault).to.equal(account2);
    });

    // @TODO: Update this test when we have the final base URI implemented in the contract
    it('generates a valid token URI', async () => {
        const initialPORBAmountMintedToOwner = web3.utils.toWei('1000000000', 'ether');
        const priceOfArchitectInPORB = web3.utils.toWei('2', 'ether');

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

        await PORBUpgradeableInstance.approve(architectUpgradeableInstance.address, priceOfArchitectInPORB, { from: account1 });
        await architectUpgradeableInstance.mintWithPORB({ from: account1 });

        const tokenURI = await architectUpgradeableInstance.tokenURI('0');
        expect(tokenURI).to.equal('https://www.portalfantasy.io/0');
    });

    it('allows only the owner (multiSigWallet) to change the base URI', async () => {
        const initialPORBAmountMintedToOwner = web3.utils.toWei('1000000000', 'ether');
        const priceOfArchitectInPORB = web3.utils.toWei('2', 'ether');

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

        await PORBUpgradeableInstance.approve(architectUpgradeableInstance.address, priceOfArchitectInPORB, { from: account1 });
        await architectUpgradeableInstance.mintWithPORB({ from: account1 });

        let tokenURI = await architectUpgradeableInstance.tokenURI('0');
        expect(tokenURI).to.equal('https://www.portalfantasy.io/0');

        // Expect this to fail, as only the owner can change the base URI
        await localExpect(architectUpgradeableInstance.setBaseURIString('https://www.foo.com/', { from: account1 })).to.eventually.be.rejected;

        data = architectUpgradeableContract.methods.setBaseURIString('https://www.bar.com/').encodeABI();
        await multiSigWalletInstance.submitTransaction(architectUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        tokenURI = await architectUpgradeableInstance.tokenURI('0');
        expect(tokenURI).to.equal('https://www.bar.com/0');
    });

    it('allows only the owner (multiSigWallet) to change the contract URI', async () => {
        let contractURI = await architectUpgradeableInstance.contractURI();
        expect(contractURI).to.equal('https://www.portalfantasy.io/architect/');

        // Expect this to fail, as only the owner can change the base URI
        await localExpect(architectUpgradeableInstance.setContractURIString('https://www.foo.com/architect/', { from: account1 })).to.eventually.be.rejected;

        const data = architectUpgradeableContract.methods.setContractURIString('https://www.bar.com/architect/').encodeABI();
        await multiSigWalletInstance.submitTransaction(architectUpgradeableInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        contractURI = await architectUpgradeableInstance.contractURI();
        expect(contractURI).to.equal('https://www.bar.com/architect/');
    });

    it('applies the default royalty correctly', async () => {
        const initialPORBAmountMintedToOwner = web3.utils.toWei('1000000000', 'ether');
        const priceOfArchitectInPORB = web3.utils.toWei('2', 'ether');

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

        await PORBUpgradeableInstance.approve(architectUpgradeableInstance.address, priceOfArchitectInPORB, { from: account1 });
        await architectUpgradeableInstance.mintWithPORB({ from: account1 });

        // Assert expected royalty parameters
        let defaultRoyaltyInfo = await architectUpgradeableInstance.royaltyInfo('0', priceOfArchitectInPORB);
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
        let data = PORBUpgradeableContract.methods.addController(multiSigWalletInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(PORBUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Mint PORB
        data = PORBUpgradeableContract.methods.mint(account1, initialPORBAmountMintedToOwner).encodeABI();
        await multiSigWalletInstance.submitTransaction(PORBUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        await PORBUpgradeableInstance.approve(architectUpgradeableInstance.address, priceOfArchitectInPORB, { from: account1 });
        await architectUpgradeableInstance.mintWithPORB({ from: account1 });

        // Expect this to fail, as only the owner can change the base URI
        await localExpect(architectUpgradeableInstance.setDefaultRoyalty(300, { from: account1 })).to.eventually.be.rejected;

        const updatedRoyaltyFeeBips = 100;
        data = architectUpgradeableContract.methods.setDefaultRoyalty(updatedRoyaltyFeeBips).encodeABI();
        await multiSigWalletInstance.submitTransaction(architectUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        // Assert expected royalty parameters
        let defaultRoyaltyInfo = await architectUpgradeableInstance.royaltyInfo('0', priceOfArchitectInPORB);
        const royaltyRecipient = defaultRoyaltyInfo[0];
        const royaltyFee = defaultRoyaltyInfo[1];
        expect(royaltyRecipient).to.equal(account9);
        expect(royaltyFee.toString()).to.equal(bigInt(priceOfArchitectInPORB).multiply(updatedRoyaltyFeeBips).divide(10000).toString());
    });

    it('allows only the owner to change the token custom royalty fee', async () => {
        const initialPORBAmountMintedToOwner = web3.utils.toWei('1000000000', 'ether');
        const priceOfArchitectInPORB = web3.utils.toWei('2', 'ether');

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

        await PORBUpgradeableInstance.approve(architectUpgradeableInstance.address, priceOfArchitectInPORB, { from: account1 });
        await architectUpgradeableInstance.mintWithPORB({ from: account1 });

        // Expect this to fail, as only the owner can change the base URI
        await localExpect(architectUpgradeableInstance.setTokenRoyalty('0', 300, { from: account1 })).to.eventually.be.rejected;

        const updatedRoyaltyFeeBips = 100;
        data = architectUpgradeableContract.methods.setTokenRoyalty('0', updatedRoyaltyFeeBips).encodeABI();
        await multiSigWalletInstance.submitTransaction(architectUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        // Assert expected royalty parameters
        let defaultRoyaltyInfo = await architectUpgradeableInstance.royaltyInfo('0', priceOfArchitectInPORB);
        const royaltyRecipient = defaultRoyaltyInfo[0];
        const royaltyFee = defaultRoyaltyInfo[1];
        expect(royaltyRecipient).to.equal(account9);
        expect(royaltyFee.toString()).to.equal(bigInt(priceOfArchitectInPORB).multiply(updatedRoyaltyFeeBips).divide(10000).toString());
    });

    it('allows only the owner to reset the custom royalty fee', async () => {
        const initialPORBAmountMintedToOwner = web3.utils.toWei('1000000000', 'ether');
        const priceOfArchitectInPORB = web3.utils.toWei('2', 'ether');

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

        await PORBUpgradeableInstance.approve(architectUpgradeableInstance.address, priceOfArchitectInPORB, { from: account1 });
        await architectUpgradeableInstance.mintWithPORB({ from: account1 });

        const updatedRoyaltyFeeBips = 100;
        data = architectUpgradeableContract.methods.setTokenRoyalty('0', updatedRoyaltyFeeBips).encodeABI();
        await multiSigWalletInstance.submitTransaction(architectUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        // Expect this to fail, as only the owner can change the base URI
        await localExpect(architectUpgradeableInstance.resetTokenRoyalty('0', { from: account1 })).to.eventually.be.rejected;

        data = architectUpgradeableContract.methods.resetTokenRoyalty('0').encodeABI();
        await multiSigWalletInstance.submitTransaction(architectUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        // Assert expected royalty parameters
        let defaultRoyaltyInfo = await architectUpgradeableInstance.royaltyInfo('0', priceOfArchitectInPORB);
        const royaltyRecipient = defaultRoyaltyInfo[0];
        const royaltyFee = defaultRoyaltyInfo[1];
        const expectedRoyalFeeNumeratorBips = 400;
        expect(royaltyRecipient).to.equal(account9);
        expect(royaltyFee.toString()).to.equal(bigInt(priceOfArchitectInPORB).multiply(expectedRoyalFeeNumeratorBips).divide(10000).toString());
    });

    it.skip('can be upgraded and store new state variables from the new contract', async () => {
        const tokenSymbol = await architectUpgradeableInstance.symbol();
        expect(tokenSymbol).to.equal('PHAR');

        const initialPORBAmountMintedToOwner = web3.utils.toWei('1000000000', 'ether');
        const priceOfArchitectInPORB = web3.utils.toWei('2', 'ether');

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

        await PORBUpgradeableInstance.approve(architectUpgradeableInstance.address, priceOfArchitectInPORB, { from: account1 });
        await architectUpgradeableInstance.mintWithPORB({ from: account1 });

        architectUpgradeableTestInstance = (await upgradeProxy(architectUpgradeableInstance.address, architectUpgradeableTest as any)) as ArchitectUpgradeableTestInstance;

        // Original state variables remain unchanged
        const newTokenSymbol = await architectUpgradeableTestInstance.symbol();
        expect(newTokenSymbol).to.equal('PHAR');
        const ownerOfMintedArchitect1 = await architectUpgradeableTestInstance.ownerOf('0');
        expect(ownerOfMintedArchitect1).to.equal(account1);

        // Mint PORB
        data = PORBUpgradeableContract.methods.mint(account2, initialPORBAmountMintedToOwner).encodeABI();
        await multiSigWalletInstance.submitTransaction(PORBUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        await PORBUpgradeableInstance.approve(architectUpgradeableTestInstance.address, priceOfArchitectInPORB, { from: account2 });
        await architectUpgradeableInstance.mintWithPORB({ from: account2 });

        // Can still mint new tokens
        const ownerOfMintedArchitect2 = await architectUpgradeableTestInstance.ownerOf('1');
        expect(ownerOfMintedArchitect2).to.equal(account2);

        // Can still only be paused/unpaused by the owner of the previous contract (multiSigWalleet)
        data = architectUpgradeableContract.methods.setPaused(true).encodeABI();
        await multiSigWalletInstance.submitTransaction(architectUpgradeableTestInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        // Non-existing method cannot be used to set state variable
        data = architectUpgradeableContract.methods.setBaseURIString('https://www.foo.com/').encodeABI();
        await multiSigWalletInstance.submitTransaction(architectUpgradeableTestInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;
        const baseURIString = await architectUpgradeableTestInstance.baseURIString();
        expect(baseURIString).to.not.equal('https://www.foo.com/');
    });
});
