import { deployProxy, upgradeProxy } from '@openzeppelin/truffle-upgrades';
import { localExpect, bigInt } from '../lib/test-libraries';
import { OPFTNativeUpgradeableInstance, MultiSigWalletInstance, OPFTNativeUpgradeableTestInstance } from '../../types/truffle-contracts';
import OPFT_UPGRADEABLE_JSON from '../../build/contracts/OPFTNativeUpgradeable.json';
import NATIVE_MINTER_UPGRADEABLE_JSON from '../../build/contracts/INativeMinter.json';
import Web3 from 'web3';
import { AbiItem } from 'web3-utils';
import { getTxIdFromMultiSigWallet } from '../lib/test-helpers';
import { testAccountsData } from '../data/test-accounts-data';
import { TransactionConfig } from 'web3-core';

const config = require('../../config').config;

const OPFTNativeUpgradeable = artifacts.require('OPFTNativeUpgradeable');
const multiSigWallet = artifacts.require('MultiSigWallet');
const OPFTNativeUpgradeableTest = artifacts.require('OPFTNativeUpgradeableTest');

const web3 = new Web3(new Web3.providers.HttpProvider(config.AVAX.localSubnetHTTP));
const OPFT_UPGRADEABLE_ABI = OPFT_UPGRADEABLE_JSON.abi as AbiItem[];
const NATIVE_MINTER_UPGRADEABLE_ABI = NATIVE_MINTER_UPGRADEABLE_JSON.abi as AbiItem[];

contract('OPFTNativeUpgradeable.sol', ([owner, account1, account2, account3, account4, account5, account6, account7, account8, account9]) => {
    let OPFTNativeUpgradeableInstance: OPFTNativeUpgradeableInstance;
    let multiSigWalletInstance: MultiSigWalletInstance;
    let OPFTNativeUpgradeableTestInstance: OPFTNativeUpgradeableTestInstance;
    let OPFTNativeUpgradeableContract: any;

    beforeEach(async () => {
        // Require 2 signatures for multiSig
        multiSigWalletInstance = await multiSigWallet.new([owner, account1, account2], 2);
        OPFTNativeUpgradeableInstance = (await deployProxy(OPFTNativeUpgradeable as any, [], { initializer: 'initialize' })) as OPFTNativeUpgradeableInstance;
        await OPFTNativeUpgradeableInstance.transferOwnership(multiSigWalletInstance.address);

        // multiSig for adding MultiSigWallet contract as a controller
        OPFTNativeUpgradeableContract = new web3.eth.Contract(OPFT_UPGRADEABLE_ABI, OPFTNativeUpgradeableInstance.address);
        const data = OPFTNativeUpgradeableContract.methods.addController(multiSigWalletInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(OPFTNativeUpgradeableInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });
    });

    it.skip("has token name set to 'Portal Fantasy Token'", async () => {
        const tokenName = await OPFTNativeUpgradeableInstance.name();
        expect(tokenName).to.equal('Portal Fantasy Token');
    });

    it.skip("has token symbol set to 'PFT'", async () => {
        const tokenSymbol = await OPFTNativeUpgradeableInstance.symbol();
        expect(tokenSymbol).to.equal('PFT');
    });

    it.skip('has 18 token decimals', async () => {
        const decimals = (await OPFTNativeUpgradeableInstance.decimals()).toString();
        expect(decimals).to.equal('18');
    });

    it.skip('has the contract owner set to the multiSigWallet address', async () => {
        const contractOwner = await OPFTNativeUpgradeableInstance.owner();
        expect(contractOwner).to.equal(multiSigWalletInstance.address);
    });

    it.skip('allows the contract owner (multiSigWallet) to add another controller', async () => {
        const data = OPFTNativeUpgradeableContract.methods.addController(account2).encodeABI();
        await multiSigWalletInstance.submitTransaction(OPFTNativeUpgradeableInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        const isController = await (OPFTNativeUpgradeableInstance as any).controllers.call(account2);
        expect(isController).to.be.true;
    });

    it.skip('allows the contract owner (multiSigWallet) to remove a controller', async () => {
        const data = OPFTNativeUpgradeableContract.methods.removeController(account2).encodeABI();
        await multiSigWalletInstance.submitTransaction(OPFTNativeUpgradeableInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        const isController = await (OPFTNativeUpgradeableInstance as any).controllers.call(account2);
        expect(isController).to.be.false;
    });

    it.skip("doesn't allow a non-PFT-contract-owner account to add a controller", async () => {
        await localExpect(OPFTNativeUpgradeableInstance.addController(account2, { from: account1 })).to.eventually.be.rejected;
    });

    it.skip("doesn't allow a non-PFT-contract-owner account to remove a controller", async () => {
        await localExpect(OPFTNativeUpgradeableInstance.removeController(account2, { from: account1 })).to.eventually.be.rejected;
    });

    it.skip('allows a controller account (multiSigWallet) to mint tokens after sufficient multiSig confirmations', async () => {
        const amountToMint = web3.utils.toWei('1', 'ether');
        const totalSupplyBefore = (await OPFTNativeUpgradeableInstance.totalSupply()).toString();
        const expectedTotalSupplyAfter = bigInt(amountToMint).add(bigInt(totalSupplyBefore)).toString();
        const balanceOfAccountBefore = (await OPFTNativeUpgradeableInstance.balanceOf(account2)).toString();

        const data = OPFTNativeUpgradeableContract.methods.mint(account2, amountToMint).encodeABI();
        await multiSigWalletInstance.submitTransaction(OPFTNativeUpgradeableInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        const totalSupplyAfter = (await OPFTNativeUpgradeableInstance.totalSupply()).toString();

        expect(totalSupplyAfter).to.equal(expectedTotalSupplyAfter);

        const balanceOfAccountAfter = (await OPFTNativeUpgradeableInstance.balanceOf(account2)).toString();

        expect(balanceOfAccountAfter).to.equal(bigInt(amountToMint).plus(balanceOfAccountBefore).toString());
    });

    it.skip('allows a controller account (multiSigWallet) to burn tokens', async () => {
        const amountToMint = web3.utils.toWei('1', 'ether');
        const amountToBurn = web3.utils.toWei('0.1', 'ether');
        const expectedChangeInTotalSupply = bigInt(amountToMint).subtract(amountToBurn).toString();
        const totalSupplyBefore = await (await OPFTNativeUpgradeableInstance.totalSupply()).toString();
        const expectedTotalSupplyAfter = bigInt(totalSupplyBefore).add(bigInt(expectedChangeInTotalSupply)).toString();
        const balanceOfAccountBefore = (await OPFTNativeUpgradeableInstance.balanceOf(multiSigWalletInstance.address)).toString();

        let data = OPFTNativeUpgradeableContract.methods.mint(multiSigWalletInstance.address, amountToMint).encodeABI();
        await multiSigWalletInstance.submitTransaction(OPFTNativeUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        data = OPFTNativeUpgradeableContract.methods.burn(multiSigWalletInstance.address, amountToBurn).encodeABI();
        await multiSigWalletInstance.submitTransaction(OPFTNativeUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        const totalSupplyAfter = (await OPFTNativeUpgradeableInstance.totalSupply()).toString();

        expect(totalSupplyAfter).to.equal(expectedTotalSupplyAfter);

        const balanceOfAccountAfter = (await OPFTNativeUpgradeableInstance.balanceOf(multiSigWalletInstance.address)).toString();

        expect(balanceOfAccountAfter).to.equal(bigInt(expectedChangeInTotalSupply).plus(balanceOfAccountBefore).toString());
    });

    it.skip("doesn't allow a non-PFT-contract-controller account to mint tokens", async () => {
        const amountToMint = web3.utils.toWei('1', 'ether');

        await localExpect(OPFTNativeUpgradeableInstance.mint(account4, amountToMint, { from: account4 })).to.eventually.be.rejected;

        const balanceOfAccount = (await OPFTNativeUpgradeableInstance.balanceOf(account4)).toString();

        expect(balanceOfAccount).to.equal('0');
    });

    it.skip("doesn't allow a non-PFT-contract-controller account to burn tokens", async () => {
        const amountToMint = web3.utils.toWei('1', 'ether');
        const amountToBurn = web3.utils.toWei('0.1', 'ether');

        let data = OPFTNativeUpgradeableContract.methods.mint(account5, amountToMint).encodeABI();
        await multiSigWalletInstance.submitTransaction(OPFTNativeUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        await localExpect(OPFTNativeUpgradeableInstance.burn(account5, amountToBurn, { from: account5 })).to.eventually.be.rejected;

        const balanceOfAccount = (await OPFTNativeUpgradeableInstance.balanceOf(account5)).toString();

        expect(balanceOfAccount).to.equal(amountToMint);
    });

    it.skip('can be upgraded and store new state variables from the new contract', async () => {
        let tokenSymbol = await OPFTNativeUpgradeableInstance.symbol();
        expect(tokenSymbol).to.equal('PFT');

        const amountToMint = web3.utils.toWei('1', 'ether');
        const totalSupplyBefore = (await OPFTNativeUpgradeableInstance.totalSupply()).toString();
        const expectedTotalSupplyAfter = bigInt(amountToMint).add(bigInt(totalSupplyBefore)).toString();

        let data = OPFTNativeUpgradeableContract.methods.mint(account2, amountToMint).encodeABI();
        await multiSigWalletInstance.submitTransaction(OPFTNativeUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        OPFTNativeUpgradeableTestInstance = (await upgradeProxy(OPFTNativeUpgradeableInstance.address, OPFTNativeUpgradeableTest as any)) as OPFTNativeUpgradeableTestInstance;

        // State variables should be unchanged after upgrading contract
        tokenSymbol = await OPFTNativeUpgradeableInstance.symbol();
        expect(tokenSymbol).to.equal('PFT');

        // The mint function is missing in the test contract so shouldn't be able to mint any more tokens
        data = OPFTNativeUpgradeableContract.methods.mint(account2, amountToMint).encodeABI();
        await multiSigWalletInstance.submitTransaction(OPFTNativeUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        const totalSupplyAfter = (await OPFTNativeUpgradeableInstance.totalSupply()).toString();

        // No new tokens minted, even though we tried to mint amountToMintToVault a second time
        expect(totalSupplyAfter).to.equal(expectedTotalSupplyAfter);
    });

    it('allows the user to switch between native PFT to WPFT and vice versa', async () => {
        const amountToWrap = web3.utils.toWei('1', 'ether');
        const amountToUnwrap = web3.utils.toWei('0.8', 'ether');
        const MINTER_STATEFUL_PRECOMPILE_ADDRESS = '0x0200000000000000000000000000000000000001';
        const minterStatefulPrecompileContract = new web3.eth.Contract(NATIVE_MINTER_UPGRADEABLE_ABI, MINTER_STATEFUL_PRECOMPILE_ADDRESS);

        let data = minterStatefulPrecompileContract.methods.setEnabled(OPFTNativeUpgradeableInstance.address).encodeABI();

        const txData: TransactionConfig = {
            from: testAccountsData[0].address,
            to: MINTER_STATEFUL_PRECOMPILE_ADDRESS,
            gas: '1000000',
            gasPrice: web3.utils.toWei('80', 'gwei'),
            data,
        };

        const signedTxData = await web3.eth.accounts.signTransaction(txData, testAccountsData[0].privateKey);
        const result = await web3.eth.sendSignedTransaction(signedTxData.rawTransaction!);
        console.log(`${JSON.stringify(result)}\n`);

        const balanceOfWPFTBefore = (await OPFTNativeUpgradeableInstance.balanceOf(account2)).toString();
        await localExpect(OPFTNativeUpgradeableInstance.deposit({ from: account2, value: amountToWrap })).to.be.fulfilled;
        const balanceOfWPFTAfter = (await OPFTNativeUpgradeableInstance.balanceOf(account2)).toString();
        const balanceOfPFTAfterWrap = (await web3.eth.getBalance(account2)).toString();

        expect(bigInt(balanceOfWPFTAfter).minus(balanceOfWPFTBefore).toString()).to.equal(amountToWrap);

        // await localExpect(OPFTNativeUpgradeableInstance.mintdraw(amountToUnwrap, { from: account2 })).to.be.fulfilled;
        // const balanceOfWPFTAfterUnwrap = (await OPFTNativeUpgradeableInstance.balanceOf(account2)).toString();
        // const balanceOfPFTAfterUnwrap = (await web3.eth.getBalance(account2)).toString();

        // expect(balanceOfWPFTAfterUnwrap).to.equal(bigInt(amountToWrap).minus(amountToUnwrap).toString());
        // expect(bigInt(balanceOfPFTAfterUnwrap).minus(balanceOfPFTAfterWrap).toString()).to.be.greaterThan(0);
    });
});
