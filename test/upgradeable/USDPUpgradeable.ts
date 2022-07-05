import { deployProxy, upgradeProxy } from '@openzeppelin/truffle-upgrades';
import { localExpect, bigInt } from '../lib/test-libraries';
import { MultiSigWalletInstance, USDPUpgradeableInstance, USDPUpgradeableTestInstance } from '../../types/truffle-contracts';
import USDP_UPGRADEABLE_JSON from '../../build/contracts/USDPUpgradeable.json';
import Web3 from 'web3';
import { AbiItem } from 'web3-utils';
import { getTxIdFromMultiSigWallet } from '../lib/test-helpers';

const config = require('../../config').config;

const USDPUpgradeable = artifacts.require('USDPUpgradeable');
const multiSigWallet = artifacts.require('MultiSigWallet');
const USDPUpgradeableTest = artifacts.require('USDPUpgradeableTest');

const USDP_UPGRADEABLE_ABI = USDP_UPGRADEABLE_JSON.abi as AbiItem[];
const web3 = new Web3(new Web3.providers.HttpProvider(config.AVAX.localSubnetHTTP));

contract.skip('USDPUpgradeable.sol', ([owner, account1, account2, account3, account4, account5, account6, account7, account8, account9]) => {
    let USDPUpgradeableInstance: USDPUpgradeableInstance;
    let multiSigWalletInstance: MultiSigWalletInstance;
    let USDPUpgradeableTestInstance: USDPUpgradeableTestInstance;
    let USDPUpgradeableContract: any;

    beforeEach(async () => {
        // Require 2 signatures for multiSig
        multiSigWalletInstance = await multiSigWallet.new([owner, account1, account2], 2);
        USDPUpgradeableInstance = (await deployProxy(USDPUpgradeable as any, [], {
            initializer: 'initialize',
        })) as USDPUpgradeableInstance;
        await USDPUpgradeableInstance.transferOwnership(multiSigWalletInstance.address);

        // multiSig for adding MultiSigWallet contract as a controller
        USDPUpgradeableContract = new web3.eth.Contract(USDP_UPGRADEABLE_ABI, USDPUpgradeableInstance.address);
        const data = USDPUpgradeableContract.methods.addController(multiSigWalletInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });
    });

    it("has token name set to 'Portal Fantasy USD'", async () => {
        const tokenName = await USDPUpgradeableInstance.name();
        expect(tokenName).to.equal('Portal Fantasy USD');
    });

    it("has token symbol set to 'USDP'", async () => {
        const tokenSymbol = await USDPUpgradeableInstance.symbol();
        expect(tokenSymbol).to.equal('USDP');
    });

    it('has 18 token decimals', async () => {
        const decimals = (await USDPUpgradeableInstance.decimals()).toString();
        expect(decimals).to.equal('18');
    });

    it('has the contract owner set to the multiSigWallet address', async () => {
        const contractOwner = await USDPUpgradeableInstance.owner();
        expect(contractOwner).to.equal(multiSigWalletInstance.address);
    });

    it('allows the contract owner (multiSigWallet) to add another controller', async () => {
        const data = USDPUpgradeableContract.methods.addController(account3).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        const isController = await (USDPUpgradeableInstance as any).controllers.call(account3);
        expect(isController).to.be.true;
    });

    it('allows the contract owner (multiSigWallet) to remove a controller', async () => {
        const data = USDPUpgradeableContract.methods.removeController(account2).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        const isController = await (USDPUpgradeableInstance as any).controllers.call(account2);
        expect(isController).to.be.false;
    });

    it("doesn't allow a non-USDP-contract-owner account to add a controller", async () => {
        await localExpect(USDPUpgradeableInstance.addController(account2, { from: account1 })).to.eventually.be.rejected;
    });

    it("doesn't allow a non-USDP-contract-owner account to remove a controller", async () => {
        await localExpect(USDPUpgradeableInstance.removeController(account2, { from: account1 })).to.eventually.be.rejected;
    });

    it('allows a controller account (multiSigWallet) to mint tokens after sufficient multiSig confirmations', async () => {
        const amountToMint = web3.utils.toWei('1', 'ether');
        const totalSupplyBefore = (await USDPUpgradeableInstance.totalSupply()).toString();
        const expectedTotalSupplyAfter = bigInt(amountToMint).add(bigInt(totalSupplyBefore)).toString();
        const balanceOfAccountBefore = (await USDPUpgradeableInstance.balanceOf(account2)).toString();

        const data = USDPUpgradeableContract.methods.mint(account2, amountToMint).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        const totalSupplyAfter = (await USDPUpgradeableInstance.totalSupply()).toString();

        expect(totalSupplyAfter).to.equal(expectedTotalSupplyAfter);

        const balanceOfAccountAfter = (await USDPUpgradeableInstance.balanceOf(account2)).toString();

        expect(balanceOfAccountAfter).to.equal(bigInt(amountToMint).plus(balanceOfAccountBefore).toString());
    });

    it('allows a controller account (multiSigWallet) to burn tokens', async () => {
        const amountToMint = web3.utils.toWei('1', 'ether');
        const amountToBurn = web3.utils.toWei('0.1', 'ether');
        const expectedChangeInTotalSupply = bigInt(amountToMint).subtract(amountToBurn).toString();
        const totalSupplyBefore = await (await USDPUpgradeableInstance.totalSupply()).toString();
        const expectedTotalSupplyAfter = bigInt(totalSupplyBefore).add(bigInt(expectedChangeInTotalSupply)).toString();
        const balanceOfAccountBefore = (await USDPUpgradeableInstance.balanceOf(multiSigWalletInstance.address)).toString();

        let data = USDPUpgradeableContract.methods.mint(multiSigWalletInstance.address, amountToMint).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        data = USDPUpgradeableContract.methods.burn(multiSigWalletInstance.address, amountToBurn).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        const totalSupplyAfter = (await USDPUpgradeableInstance.totalSupply()).toString();

        expect(totalSupplyAfter).to.equal(expectedTotalSupplyAfter);

        const balanceOfAccountAfter = (await USDPUpgradeableInstance.balanceOf(multiSigWalletInstance.address)).toString();

        expect(balanceOfAccountAfter).to.equal(bigInt(expectedChangeInTotalSupply).plus(balanceOfAccountBefore).toString());
    });

    it("doesn't allow a non-USDP-contract-controller account to mint tokens", async () => {
        const amountToMint = web3.utils.toWei('1', 'ether');

        await localExpect(USDPUpgradeableInstance.mint(account4, amountToMint, { from: account4 })).to.eventually.be.rejected;

        const balanceOfAccount = (await USDPUpgradeableInstance.balanceOf(account4)).toString();

        expect(balanceOfAccount).to.equal('0');
    });

    it("doesn't allow a non-USDP-contract-controller account to burn tokens", async () => {
        const amountToMint = web3.utils.toWei('1', 'ether');
        const amountToBurn = web3.utils.toWei('0.1', 'ether');

        let data = USDPUpgradeableContract.methods.mint(account5, amountToMint).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        await localExpect(USDPUpgradeableInstance.burn(account5, amountToBurn, { from: account5 })).to.eventually.be.rejected;

        const balanceOfAccount = (await USDPUpgradeableInstance.balanceOf(account5)).toString();

        expect(balanceOfAccount).to.equal(amountToMint);
    });

    it('can be upgraded and store new state variables from the new contract', async () => {
        let tokenSymbol = await USDPUpgradeableInstance.symbol();
        expect(tokenSymbol).to.equal('USDP');

        const amountToMintToVault = '1000';

        let data = USDPUpgradeableContract.methods.mint(account2, amountToMintToVault).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        USDPUpgradeableTestInstance = (await upgradeProxy(USDPUpgradeableInstance.address, USDPUpgradeableTest as any)) as USDPUpgradeableTestInstance;

        // State variables should be unchanged after upgrading contract
        tokenSymbol = await USDPUpgradeableInstance.symbol();
        expect(tokenSymbol).to.equal('USDP');

        // The mint function is missing in the test contract so shouldn't be able to mint any more tokens
        data = USDPUpgradeableContract.methods.mint(account2, amountToMintToVault).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        const totalSupplyAfter = (await USDPUpgradeableInstance.totalSupply()).toString();

        // No new tokens minted, even though we tried to mint amountToMintToVault a second time
        expect(totalSupplyAfter).to.equal(amountToMintToVault);
    });
});
