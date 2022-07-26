import { deployProxy, upgradeProxy } from '@openzeppelin/truffle-upgrades';
import { localExpect, bigInt } from '../lib/test-libraries';
import { OPFTUpgradeableInstance, MultiSigWalletInstance, OPFTUpgradeableTestInstance } from '../../types/truffle-contracts';
import OPFT_UPGRADEABLE_JSON from '../../build/contracts/OPFTUpgradeable.json';
import ALLOW_LIST_UPGRADEABLE_JSON from '../../build/contracts/AllowListUpgradeable.json';
import Web3 from 'web3';
import { AbiItem } from 'web3-utils';
import { getTxIdFromMultiSigWallet } from '../lib/test-helpers';

const config = require('../../config').config;

const OPFTUpgradeable = artifacts.require('OPFTUpgradeable');
const multiSigWallet = artifacts.require('MultiSigWallet');
const OPFTUpgradeableTest = artifacts.require('OPFTUpgradeableTest');

const web3 = new Web3(new Web3.providers.HttpProvider(config.AVAX.localSubnetHTTP));
const OPFT_UPGRADEABLE_ABI = OPFT_UPGRADEABLE_JSON.abi as AbiItem[];
const ALLOW_LIST_UPGRADEABLE_ABI = ALLOW_LIST_UPGRADEABLE_JSON.abi as AbiItem[];

contract('OPFTUpgradeable.sol', ([owner, account1, account2, account3, account4, account5, account6, account7, account8, account9]) => {
    let OPFTUpgradeableInstance: OPFTUpgradeableInstance;
    let multiSigWalletInstance: MultiSigWalletInstance;
    let OPFTUpgradeableTestInstance: OPFTUpgradeableTestInstance;
    let OPFTUpgradeableContract: any;

    beforeEach(async () => {
        // Require 2 signatures for multiSig
        multiSigWalletInstance = await multiSigWallet.new([owner, account1, account2], 2);
        OPFTUpgradeableInstance = (await deployProxy(OPFTUpgradeable as any, [], { initializer: 'initialize' })) as OPFTUpgradeableInstance;
        await OPFTUpgradeableInstance.transferOwnership(multiSigWalletInstance.address);

        // multiSig for adding MultiSigWallet contract as a controller
        OPFTUpgradeableContract = new web3.eth.Contract(OPFT_UPGRADEABLE_ABI, OPFTUpgradeableInstance.address);
        const data = OPFTUpgradeableContract.methods.addController(multiSigWalletInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(OPFTUpgradeableInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });
    });

    it.skip("has token name set to 'Portal Fantasy Token'", async () => {
        const tokenName = await OPFTUpgradeableInstance.name();
        expect(tokenName).to.equal('Portal Fantasy Token');
    });

    it.skip("has token symbol set to 'PFT'", async () => {
        const tokenSymbol = await OPFTUpgradeableInstance.symbol();
        expect(tokenSymbol).to.equal('PFT');
    });

    it.skip('has 18 token decimals', async () => {
        const decimals = (await OPFTUpgradeableInstance.decimals()).toString();
        expect(decimals).to.equal('18');
    });

    it.skip('has the contract owner set to the multiSigWallet address', async () => {
        const contractOwner = await OPFTUpgradeableInstance.owner();
        expect(contractOwner).to.equal(multiSigWalletInstance.address);
    });

    it.skip('allows the contract owner (multiSigWallet) to add another controller', async () => {
        const data = OPFTUpgradeableContract.methods.addController(account2).encodeABI();
        await multiSigWalletInstance.submitTransaction(OPFTUpgradeableInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        const isController = await (OPFTUpgradeableInstance as any).controllers.call(account2);
        expect(isController).to.be.true;
    });

    it.skip('allows the contract owner (multiSigWallet) to remove a controller', async () => {
        const data = OPFTUpgradeableContract.methods.removeController(account2).encodeABI();
        await multiSigWalletInstance.submitTransaction(OPFTUpgradeableInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        const isController = await (OPFTUpgradeableInstance as any).controllers.call(account2);
        expect(isController).to.be.false;
    });

    it.skip("doesn't allow a non-PFT-contract-owner account to add a controller", async () => {
        await localExpect(OPFTUpgradeableInstance.addController(account2, { from: account1 })).to.eventually.be.rejected;
    });

    it.skip("doesn't allow a non-PFT-contract-owner account to remove a controller", async () => {
        await localExpect(OPFTUpgradeableInstance.removeController(account2, { from: account1 })).to.eventually.be.rejected;
    });

    it.skip('allows a controller account (multiSigWallet) to mint tokens after sufficient multiSig confirmations', async () => {
        const amountToMint = web3.utils.toWei('1', 'ether');
        const totalSupplyBefore = (await OPFTUpgradeableInstance.totalSupply()).toString();
        const expectedTotalSupplyAfter = bigInt(amountToMint).add(bigInt(totalSupplyBefore)).toString();
        const balanceOfAccountBefore = (await OPFTUpgradeableInstance.balanceOf(account2)).toString();

        const data = OPFTUpgradeableContract.methods.mint(account2, amountToMint).encodeABI();
        await multiSigWalletInstance.submitTransaction(OPFTUpgradeableInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        const totalSupplyAfter = (await OPFTUpgradeableInstance.totalSupply()).toString();

        expect(totalSupplyAfter).to.equal(expectedTotalSupplyAfter);

        const balanceOfAccountAfter = (await OPFTUpgradeableInstance.balanceOf(account2)).toString();

        expect(balanceOfAccountAfter).to.equal(bigInt(amountToMint).plus(balanceOfAccountBefore).toString());
    });

    it.skip('allows a controller account (multiSigWallet) to burn tokens', async () => {
        const amountToMint = web3.utils.toWei('1', 'ether');
        const amountToBurn = web3.utils.toWei('0.1', 'ether');
        const expectedChangeInTotalSupply = bigInt(amountToMint).subtract(amountToBurn).toString();
        const totalSupplyBefore = await (await OPFTUpgradeableInstance.totalSupply()).toString();
        const expectedTotalSupplyAfter = bigInt(totalSupplyBefore).add(bigInt(expectedChangeInTotalSupply)).toString();
        const balanceOfAccountBefore = (await OPFTUpgradeableInstance.balanceOf(multiSigWalletInstance.address)).toString();

        let data = OPFTUpgradeableContract.methods.mint(multiSigWalletInstance.address, amountToMint).encodeABI();
        await multiSigWalletInstance.submitTransaction(OPFTUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        data = OPFTUpgradeableContract.methods.burn(multiSigWalletInstance.address, amountToBurn).encodeABI();
        await multiSigWalletInstance.submitTransaction(OPFTUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        const totalSupplyAfter = (await OPFTUpgradeableInstance.totalSupply()).toString();

        expect(totalSupplyAfter).to.equal(expectedTotalSupplyAfter);

        const balanceOfAccountAfter = (await OPFTUpgradeableInstance.balanceOf(multiSigWalletInstance.address)).toString();

        expect(balanceOfAccountAfter).to.equal(bigInt(expectedChangeInTotalSupply).plus(balanceOfAccountBefore).toString());
    });

    it.skip("doesn't allow a non-PFT-contract-controller account to mint tokens", async () => {
        const amountToMint = web3.utils.toWei('1', 'ether');

        await localExpect(OPFTUpgradeableInstance.mint(account4, amountToMint, { from: account4 })).to.eventually.be.rejected;

        const balanceOfAccount = (await OPFTUpgradeableInstance.balanceOf(account4)).toString();

        expect(balanceOfAccount).to.equal('0');
    });

    it.skip("doesn't allow a non-PFT-contract-controller account to burn tokens", async () => {
        const amountToMint = web3.utils.toWei('1', 'ether');
        const amountToBurn = web3.utils.toWei('0.1', 'ether');

        let data = OPFTUpgradeableContract.methods.mint(account5, amountToMint).encodeABI();
        await multiSigWalletInstance.submitTransaction(OPFTUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        await localExpect(OPFTUpgradeableInstance.burn(account5, amountToBurn, { from: account5 })).to.eventually.be.rejected;

        const balanceOfAccount = (await OPFTUpgradeableInstance.balanceOf(account5)).toString();

        expect(balanceOfAccount).to.equal(amountToMint);
    });

    it.skip('can be upgraded and store new state variables from the new contract', async () => {
        let tokenSymbol = await OPFTUpgradeableInstance.symbol();
        expect(tokenSymbol).to.equal('PFT');

        const amountToMint = web3.utils.toWei('1', 'ether');
        const totalSupplyBefore = (await OPFTUpgradeableInstance.totalSupply()).toString();
        const expectedTotalSupplyAfter = bigInt(amountToMint).add(bigInt(totalSupplyBefore)).toString();

        let data = OPFTUpgradeableContract.methods.mint(account2, amountToMint).encodeABI();
        await multiSigWalletInstance.submitTransaction(OPFTUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        OPFTUpgradeableTestInstance = (await upgradeProxy(OPFTUpgradeableInstance.address, OPFTUpgradeableTest as any)) as OPFTUpgradeableTestInstance;

        // State variables should be unchanged after upgrading contract
        tokenSymbol = await OPFTUpgradeableInstance.symbol();
        expect(tokenSymbol).to.equal('PFT');

        // The mint function is missing in the test contract so shouldn't be able to mint any more tokens
        data = OPFTUpgradeableContract.methods.mint(account2, amountToMint).encodeABI();
        await multiSigWalletInstance.submitTransaction(OPFTUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        const totalSupplyAfter = (await OPFTUpgradeableInstance.totalSupply()).toString();

        // No new tokens minted, even though we tried to mint amountToMintToVault a second time
        expect(totalSupplyAfter).to.equal(expectedTotalSupplyAfter);
    });

    it('allows the user to switch between native PFT to WPFT and vice versa', async () => {
        const amountToWrap = web3.utils.toWei('1', 'ether');
        const amountToUnwrap = web3.utils.toWei('0.8', 'ether');
        const MINTER_STATEFUL_PRECOMILE_ADDRESS = '0x0200000000000000000000000000000000000001';
        const minterStatefulPrecompileContract = new web3.eth.Contract(ALLOW_LIST_UPGRADEABLE_ABI, MINTER_STATEFUL_PRECOMILE_ADDRESS);

        let data = minterStatefulPrecompileContract.methods.setEnabled(account2).encodeABI();
        await multiSigWalletInstance.submitTransaction(OPFTUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        // const isEnabled = await minterStatefulPrecompileContract.methods.readAllowList(account2).call();
        // console.log(`XXX isEnabled=${isEnabled.toString()}`);

        const balanceOfWPFTBefore = (await OPFTUpgradeableInstance.balanceOf(account2)).toString();
        await localExpect(OPFTUpgradeableInstance.deposit({ from: account2, value: amountToWrap })).to.be.fulfilled;
        const balanceOfWPFTAfter = (await OPFTUpgradeableInstance.balanceOf(account2)).toString();
        const balanceOfPFTAfterWrap = (await web3.eth.getBalance(account2)).toString();

        expect(bigInt(balanceOfWPFTAfter).minus(balanceOfWPFTBefore).toString()).to.equal(amountToWrap);

        // await localExpect(OPFTUpgradeableInstance.mintdraw(amountToUnwrap, { from: account2 })).to.be.fulfilled;
        // const balanceOfWPFTAfterUnwrap = (await OPFTUpgradeableInstance.balanceOf(account2)).toString();
        // const balanceOfPFTAfterUnwrap = (await web3.eth.getBalance(account2)).toString();

        // expect(balanceOfWPFTAfterUnwrap).to.equal(bigInt(amountToWrap).minus(amountToUnwrap).toString());
        // expect(bigInt(balanceOfPFTAfterUnwrap).minus(balanceOfPFTAfterWrap).toString()).to.be.greaterThan(0);
    });
});
