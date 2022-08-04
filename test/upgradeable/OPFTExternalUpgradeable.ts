import { deployProxy, upgradeProxy } from '@openzeppelin/truffle-upgrades';
import { localExpect, bigInt } from '../lib/test-libraries';
import { OPFTExternalUpgradeableInstance, MultiSigWalletInstance, OPFTExternalUpgradeableTestInstance } from '../../types/truffle-contracts';
import OPFT_EXTERNAL_UPGRADEABLE_JSON from '../../build/contracts/OPFTExternalUpgradeable.json';
import Web3 from 'web3';
import { AbiItem } from 'web3-utils';
import { getTxIdFromMultiSigWallet } from '../lib/test-helpers';
import { testAccountsData } from '../data/test-accounts-data';

const config = require('../../config').config;

const OPFTNativeUpgradeable = artifacts.require('OPFTNativeUpgradeable');
const multiSigWallet = artifacts.require('MultiSigWallet');
const OPFTNativeUpgradeableTest = artifacts.require('OPFTNativeUpgradeableTest');

const web3 = new Web3(new Web3.providers.HttpProvider(config.AVAX.localSubnetHTTP));
const OPFT_EXTERNAL_UPGRADEABLE_ABI = OPFT_EXTERNAL_UPGRADEABLE_JSON.abi as AbiItem[];
const MOCK_LZ_ENDPOINT_PF_CHAIN = testAccountsData[5].address;
const PFT_TO_BRIDGE_AMOUNT = web3.utils.toWei('0.001', 'ether');
const DESTINATION_CHAIN_ID = '10028';
const MOCK_DESTINATION_ADDRESS = testAccountsData[6].address;
const MOCK_DESTINATION_ADDRESS_BYTES = web3.utils.hexToBytes(MOCK_DESTINATION_ADDRESS);

contract.skip('OPFTExternalUpgradeable.sol', ([owner, account1, account2, account3, account4, account5, account6, account7, account8, account9]) => {
    let OPFTExternalUpgradeableInstance: OPFTExternalUpgradeableInstance;
    let multiSigWalletInstance: MultiSigWalletInstance;
    let OPFTExternalUpgradeableTestInstance: OPFTExternalUpgradeableTestInstance;
    let OPFTExternalUpgradeableContract: any;

    beforeEach(async () => {
        // Require 2 signatures for multiSig
        multiSigWalletInstance = await multiSigWallet.new([owner, account1, account2], 2);
        OPFTExternalUpgradeableInstance = (await deployProxy(OPFTNativeUpgradeable as any, [MOCK_LZ_ENDPOINT_PF_CHAIN], {
            initializer: 'initialize',
        })) as OPFTExternalUpgradeableInstance;
        await OPFTExternalUpgradeableInstance.transferOwnership(multiSigWalletInstance.address);

        // multiSig for adding MultiSigWallet contract as a controller
        OPFTExternalUpgradeableContract = new web3.eth.Contract(OPFT_EXTERNAL_UPGRADEABLE_ABI, OPFTExternalUpgradeableInstance.address);
        const data = OPFTExternalUpgradeableContract.methods.addController(multiSigWalletInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(OPFTExternalUpgradeableInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });
    });

    it.skip("has token name set to 'Portal Fantasy Token'", async () => {
        const tokenName = await OPFTExternalUpgradeableInstance.name();
        expect(tokenName).to.equal('Portal Fantasy Token');
    });

    it.skip("has token symbol set to 'PFT'", async () => {
        const tokenSymbol = await OPFTExternalUpgradeableInstance.symbol();
        expect(tokenSymbol).to.equal('PFT');
    });

    it.skip('has 18 token decimals', async () => {
        const decimals = (await OPFTExternalUpgradeableInstance.decimals()).toString();
        expect(decimals).to.equal('18');
    });

    it.skip('has the contract owner set to the multiSigWallet address', async () => {
        const contractOwner = await OPFTExternalUpgradeableInstance.owner();
        expect(contractOwner).to.equal(multiSigWalletInstance.address);
    });

    it.skip('allows the contract owner (multiSigWallet) to add another controller', async () => {
        const data = OPFTExternalUpgradeableContract.methods.addController(account2).encodeABI();
        await multiSigWalletInstance.submitTransaction(OPFTExternalUpgradeableInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        const isController = await (OPFTExternalUpgradeableInstance as any).controllers.call(account2);
        expect(isController).to.be.true;
    });

    it.skip('allows the contract owner (multiSigWallet) to remove a controller', async () => {
        const data = OPFTExternalUpgradeableContract.methods.removeController(account2).encodeABI();
        await multiSigWalletInstance.submitTransaction(OPFTExternalUpgradeableInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        const isController = await (OPFTExternalUpgradeableInstance as any).controllers.call(account2);
        expect(isController).to.be.false;
    });

    it.skip("doesn't allow a non-PFT-contract-owner account to add a controller", async () => {
        await localExpect(OPFTExternalUpgradeableInstance.addController(account2, { from: account1 })).to.eventually.be.rejected;
    });

    it.skip("doesn't allow a non-PFT-contract-owner account to remove a controller", async () => {
        await localExpect(OPFTExternalUpgradeableInstance.removeController(account2, { from: account1 })).to.eventually.be.rejected;
    });

    it.skip('allows a controller account (multiSigWallet) to mint tokens after sufficient multiSig confirmations', async () => {
        const amountToMint = web3.utils.toWei('1', 'ether');
        const totalSupplyBefore = (await OPFTExternalUpgradeableInstance.totalSupply()).toString();
        const expectedTotalSupplyAfter = bigInt(amountToMint).add(bigInt(totalSupplyBefore)).toString();
        const balanceOfAccountBefore = (await OPFTExternalUpgradeableInstance.balanceOf(account2)).toString();

        const data = OPFTExternalUpgradeableContract.methods.mint(account2, amountToMint).encodeABI();
        await multiSigWalletInstance.submitTransaction(OPFTExternalUpgradeableInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        const totalSupplyAfter = (await OPFTExternalUpgradeableInstance.totalSupply()).toString();

        expect(totalSupplyAfter).to.equal(expectedTotalSupplyAfter);

        const balanceOfAccountAfter = (await OPFTExternalUpgradeableInstance.balanceOf(account2)).toString();

        expect(balanceOfAccountAfter).to.equal(bigInt(amountToMint).plus(balanceOfAccountBefore).toString());
    });

    it.skip('allows a controller account (multiSigWallet) to burn tokens', async () => {
        const amountToMint = web3.utils.toWei('1', 'ether');
        const amountToBurn = web3.utils.toWei('0.1', 'ether');
        const expectedChangeInTotalSupply = bigInt(amountToMint).subtract(amountToBurn).toString();
        const totalSupplyBefore = await (await OPFTExternalUpgradeableInstance.totalSupply()).toString();
        const expectedTotalSupplyAfter = bigInt(totalSupplyBefore).add(bigInt(expectedChangeInTotalSupply)).toString();
        const balanceOfAccountBefore = (await OPFTExternalUpgradeableInstance.balanceOf(multiSigWalletInstance.address)).toString();

        let data = OPFTExternalUpgradeableContract.methods.mint(multiSigWalletInstance.address, amountToMint).encodeABI();
        await multiSigWalletInstance.submitTransaction(OPFTExternalUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        data = OPFTExternalUpgradeableContract.methods.burn(multiSigWalletInstance.address, amountToBurn).encodeABI();
        await multiSigWalletInstance.submitTransaction(OPFTExternalUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        const totalSupplyAfter = (await OPFTExternalUpgradeableInstance.totalSupply()).toString();

        expect(totalSupplyAfter).to.equal(expectedTotalSupplyAfter);

        const balanceOfAccountAfter = (await OPFTExternalUpgradeableInstance.balanceOf(multiSigWalletInstance.address)).toString();

        expect(balanceOfAccountAfter).to.equal(bigInt(expectedChangeInTotalSupply).plus(balanceOfAccountBefore).toString());
    });

    it.skip("doesn't allow a non-PFT-contract-controller account to mint tokens", async () => {
        const amountToMint = web3.utils.toWei('1', 'ether');

        await localExpect(OPFTExternalUpgradeableInstance.mint(account4, amountToMint, { from: account4 })).to.eventually.be.rejected;

        const balanceOfAccount = (await OPFTExternalUpgradeableInstance.balanceOf(account4)).toString();

        expect(balanceOfAccount).to.equal('0');
    });

    it.skip("doesn't allow a non-PFT-contract-controller account to burn tokens", async () => {
        const amountToMint = web3.utils.toWei('1', 'ether');
        const amountToBurn = web3.utils.toWei('0.1', 'ether');

        let data = OPFTExternalUpgradeableContract.methods.mint(account5, amountToMint).encodeABI();
        await multiSigWalletInstance.submitTransaction(OPFTExternalUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        await localExpect(OPFTExternalUpgradeableInstance.burn(account5, amountToBurn, { from: account5 })).to.eventually.be.rejected;

        const balanceOfAccount = (await OPFTExternalUpgradeableInstance.balanceOf(account5)).toString();

        expect(balanceOfAccount).to.equal(amountToMint);
    });

    it.skip('can be upgraded and store new state variables from the new contract', async () => {
        let tokenSymbol = await OPFTExternalUpgradeableInstance.symbol();
        expect(tokenSymbol).to.equal('PFT');

        const amountToMint = web3.utils.toWei('1', 'ether');
        const totalSupplyBefore = (await OPFTExternalUpgradeableInstance.totalSupply()).toString();
        const expectedTotalSupplyAfter = bigInt(amountToMint).add(bigInt(totalSupplyBefore)).toString();

        let data = OPFTExternalUpgradeableContract.methods.mint(account2, amountToMint).encodeABI();
        await multiSigWalletInstance.submitTransaction(OPFTExternalUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        OPFTExternalUpgradeableTestInstance = (await upgradeProxy(
            OPFTExternalUpgradeableInstance.address,
            OPFTNativeUpgradeableTest as any
        )) as OPFTExternalUpgradeableTestInstance;

        // State variables should be unchanged after upgrading contract
        tokenSymbol = await OPFTExternalUpgradeableInstance.symbol();
        expect(tokenSymbol).to.equal('PFT');

        // The mint function is missing in the test contract so shouldn't be able to mint any more tokens
        data = OPFTExternalUpgradeableContract.methods.mint(account2, amountToMint).encodeABI();
        await multiSigWalletInstance.submitTransaction(OPFTExternalUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        const totalSupplyAfter = (await OPFTExternalUpgradeableInstance.totalSupply()).toString();

        // No new tokens minted, even though we tried to mint amountToMintToVault a second time
        expect(totalSupplyAfter).to.equal(expectedTotalSupplyAfter);
    });

    it('allows a user to set the trusted remotes', async () => {
        // Mocking the PFT address as one of the accounts because the destination address won't be called as part of this tx anyway
        const MOCK_DESTINATION_PFT_TRANSPARENT_PROXY_ADDRESS_BYTES = web3.utils.hexToBytes(OPFTExternalUpgradeableInstance.address);

        await localExpect(
            OPFTExternalUpgradeableInstance.sendFrom(account2, DESTINATION_CHAIN_ID, MOCK_DESTINATION_ADDRESS_BYTES as any, PFT_TO_BRIDGE_AMOUNT, account2, account2, '0x', {
                from: account2,
                value: web3.utils.toWei('1', 'ether'), // Large fee to ensure the tx passes
            })
        ).to.eventually.be.rejected;

        let data = OPFTExternalUpgradeableContract.methods.setTrustedRemote(DESTINATION_CHAIN_ID, MOCK_DESTINATION_PFT_TRANSPARENT_PROXY_ADDRESS_BYTES).encodeABI();
        await multiSigWalletInstance.submitTransaction(OPFTExternalUpgradeableInstance.address, 0, data, { from: testAccountsData[0].address });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: testAccountsData[1].address });

        expect(await OPFTExternalUpgradeableInstance.isTrustedRemote(DESTINATION_CHAIN_ID, MOCK_DESTINATION_PFT_TRANSPARENT_PROXY_ADDRESS_BYTES as any)).to.be.true;
    });
});
