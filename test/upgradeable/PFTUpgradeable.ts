import { deployProxy, upgradeProxy } from '@openzeppelin/truffle-upgrades';
import { localExpect, bigInt } from '../lib/test-libraries';
import { PFTUpgradeableInstance, MultiSigWalletInstance, PFTUpgradeableTestInstance } from '../../types/truffle-contracts';
import PFT_UPGRADEABLE_JSON from '../../build/contracts/PFTUpgradeable.json';
import Web3 from 'web3';
import { AbiItem } from 'web3-utils';
import { getTxIdFromMultiSigWallet } from '../lib/test-helpers';

const config = require('../../config').config;

const PFTUpgradeable = artifacts.require('PFTUpgradeable');
const multiSigWallet = artifacts.require('MultiSigWallet');
const PFTUpgradeableTest = artifacts.require('PFTUpgradeableTest');

const web3 = new Web3(new Web3.providers.HttpProvider(config.AVAX.localSubnetHTTP));
const PFT_UPGRADEABLE_ABI = PFT_UPGRADEABLE_JSON.abi as AbiItem[];

contract.skip('PFTUpgradeable.sol', ([owner, account1, account2, account3, account4, account5, account6, account7, account8, account9]) => {
    let PFTUpgradeableInstance: PFTUpgradeableInstance;
    let multiSigWalletInstance: MultiSigWalletInstance;
    let PFTUpgradeableTestInstance: PFTUpgradeableTestInstance;
    let PFTUpgradeableContract: any;

    beforeEach(async () => {
        // Require 2 signatures for multiSig
        multiSigWalletInstance = await multiSigWallet.new([owner, account1, account2], 2);
        PFTUpgradeableInstance = (await deployProxy(PFTUpgradeable as any, [], { initializer: 'initialize' })) as PFTUpgradeableInstance;
        await PFTUpgradeableInstance.transferOwnership(multiSigWalletInstance.address);

        // multiSig for adding MultiSigWallet contract as a controller
        PFTUpgradeableContract = new web3.eth.Contract(PFT_UPGRADEABLE_ABI, PFTUpgradeableInstance.address);
        const data = PFTUpgradeableContract.methods.addController(multiSigWalletInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(PFTUpgradeableInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });
    });

    it("has token name set to 'Portal Fantasy Token'", async () => {
        const tokenName = await PFTUpgradeableInstance.name();
        expect(tokenName).to.equal('Portal Fantasy Token');
    });

    it("has token symbol set to 'PFT'", async () => {
        const tokenSymbol = await PFTUpgradeableInstance.symbol();
        expect(tokenSymbol).to.equal('PFT');
    });

    it('has 18 token decimals', async () => {
        const decimals = (await PFTUpgradeableInstance.decimals()).toString();
        expect(decimals).to.equal('18');
    });

    it('has the contract owner set to the multiSigWallet address', async () => {
        const contractOwner = await PFTUpgradeableInstance.owner();
        expect(contractOwner).to.equal(multiSigWalletInstance.address);
    });

    it('allows the contract owner (multiSigWallet) to add another controller', async () => {
        const data = PFTUpgradeableContract.methods.addController(account2).encodeABI();
        await multiSigWalletInstance.submitTransaction(PFTUpgradeableInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        const isController = await (PFTUpgradeableInstance as any).controllers.call(account2);
        expect(isController).to.be.true;
    });

    it('allows the contract owner (multiSigWallet) to remove a controller', async () => {
        const data = PFTUpgradeableContract.methods.removeController(account2).encodeABI();
        await multiSigWalletInstance.submitTransaction(PFTUpgradeableInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        const isController = await (PFTUpgradeableInstance as any).controllers.call(account2);
        expect(isController).to.be.false;
    });

    it("doesn't allow a non-PFT-contract-owner account to add a controller", async () => {
        await localExpect(PFTUpgradeableInstance.addController(account2, { from: account1 })).to.eventually.be.rejected;
    });

    it("doesn't allow a non-PFT-contract-owner account to remove a controller", async () => {
        await localExpect(PFTUpgradeableInstance.removeController(account2, { from: account1 })).to.eventually.be.rejected;
    });

    it('allows a controller account (multiSigWallet) to mint tokens after sufficient multiSig confirmations', async () => {
        const amountToMint = web3.utils.toWei('1', 'ether');
        const totalSupplyBefore = (await PFTUpgradeableInstance.totalSupply()).toString();
        const expectedTotalSupplyAfter = bigInt(amountToMint).add(bigInt(totalSupplyBefore)).toString();
        const balanceOfAccountBefore = (await PFTUpgradeableInstance.balanceOf(account2)).toString();

        const data = PFTUpgradeableContract.methods.mint(account2, amountToMint).encodeABI();
        await multiSigWalletInstance.submitTransaction(PFTUpgradeableInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        const totalSupplyAfter = (await PFTUpgradeableInstance.totalSupply()).toString();

        expect(totalSupplyAfter).to.equal(expectedTotalSupplyAfter);

        const balanceOfAccountAfter = (await PFTUpgradeableInstance.balanceOf(account2)).toString();

        expect(balanceOfAccountAfter).to.equal(bigInt(amountToMint).plus(balanceOfAccountBefore).toString());
    });

    it('allows a controller account (multiSigWallet) to burn tokens', async () => {
        const amountToMint = web3.utils.toWei('1', 'ether');
        const amountToBurn = web3.utils.toWei('0.1', 'ether');
        const expectedChangeInTotalSupply = bigInt(amountToMint).subtract(amountToBurn).toString();
        const totalSupplyBefore = await (await PFTUpgradeableInstance.totalSupply()).toString();
        const expectedTotalSupplyAfter = bigInt(totalSupplyBefore).add(bigInt(expectedChangeInTotalSupply)).toString();
        const balanceOfAccountBefore = (await PFTUpgradeableInstance.balanceOf(multiSigWalletInstance.address)).toString();

        let data = PFTUpgradeableContract.methods.mint(multiSigWalletInstance.address, amountToMint).encodeABI();
        await multiSigWalletInstance.submitTransaction(PFTUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        data = PFTUpgradeableContract.methods.burn(multiSigWalletInstance.address, amountToBurn).encodeABI();
        await multiSigWalletInstance.submitTransaction(PFTUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        const totalSupplyAfter = (await PFTUpgradeableInstance.totalSupply()).toString();

        expect(totalSupplyAfter).to.equal(expectedTotalSupplyAfter);

        const balanceOfAccountAfter = (await PFTUpgradeableInstance.balanceOf(multiSigWalletInstance.address)).toString();

        expect(balanceOfAccountAfter).to.equal(bigInt(expectedChangeInTotalSupply).plus(balanceOfAccountBefore).toString());
    });

    it("doesn't allow a non-PFT-contract-controller account to mint tokens", async () => {
        const amountToMint = web3.utils.toWei('1', 'ether');

        await localExpect(PFTUpgradeableInstance.mint(account4, amountToMint, { from: account4 })).to.eventually.be.rejected;

        const balanceOfAccount = (await PFTUpgradeableInstance.balanceOf(account4)).toString();

        expect(balanceOfAccount).to.equal('0');
    });

    it("doesn't allow a non-PFT-contract-controller account to burn tokens", async () => {
        const amountToMint = web3.utils.toWei('1', 'ether');
        const amountToBurn = web3.utils.toWei('0.1', 'ether');

        let data = PFTUpgradeableContract.methods.mint(account5, amountToMint).encodeABI();
        await multiSigWalletInstance.submitTransaction(PFTUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        await localExpect(PFTUpgradeableInstance.burn(account5, amountToBurn, { from: account5 })).to.eventually.be.rejected;

        const balanceOfAccount = (await PFTUpgradeableInstance.balanceOf(account5)).toString();

        expect(balanceOfAccount).to.equal(amountToMint);
    });

    it('can be upgraded and store new state variables from the new contract', async () => {
        let tokenSymbol = await PFTUpgradeableInstance.symbol();
        expect(tokenSymbol).to.equal('PFT');

        const amountToMint = web3.utils.toWei('1', 'ether');
        const totalSupplyBefore = (await PFTUpgradeableInstance.totalSupply()).toString();
        const expectedTotalSupplyAfter = bigInt(amountToMint).add(bigInt(totalSupplyBefore)).toString();

        let data = PFTUpgradeableContract.methods.mint(account2, amountToMint).encodeABI();
        await multiSigWalletInstance.submitTransaction(PFTUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        PFTUpgradeableTestInstance = (await upgradeProxy(PFTUpgradeableInstance.address, PFTUpgradeableTest as any)) as PFTUpgradeableTestInstance;

        // State variables should be unchanged after upgrading contract
        tokenSymbol = await PFTUpgradeableInstance.symbol();
        expect(tokenSymbol).to.equal('PFT');

        // The mint function is missing in the test contract so shouldn't be able to mint any more tokens
        data = PFTUpgradeableContract.methods.mint(account2, amountToMint).encodeABI();
        await multiSigWalletInstance.submitTransaction(PFTUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        const totalSupplyAfter = (await PFTUpgradeableInstance.totalSupply()).toString();

        // No new tokens minted, even though we tried to mint amountToMintToVault a second time
        expect(totalSupplyAfter).to.equal(expectedTotalSupplyAfter);
    });
});
