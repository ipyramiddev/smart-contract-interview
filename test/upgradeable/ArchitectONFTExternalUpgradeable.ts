import { deployProxy, upgradeProxy } from '@openzeppelin/truffle-upgrades';
import bigInt from 'big-integer';
import { localExpect } from '../lib/test-libraries';
import { ArchitectONFTExternalUpgradeableInstance, MultiSigWalletInstance, ArchitectONFTExternalUpgradeableTestInstance } from '../../types/truffle-contracts';
import ARCHITECT_UPGRADEABLE_JSON from '../../build/contracts/ArchitectONFTExternalUpgradeable.json';
import Web3 from 'web3';
import { AbiItem } from 'web3-utils';
import { getTxIdFromMultiSigWallet } from '../lib/test-helpers';

const config = require('../../config').config;
const testAccountsData = require('../../test/data/test-accounts-data').testAccountsData;

const ArchitectONFTExternalUpgradeable = artifacts.require('ArchitectONFTExternalUpgradeable');
const multiSigWallet = artifacts.require('MultiSigWallet');
const ArchitectONFTExternalUpgradeableTest = artifacts.require('ArchitectONFTExternalUpgradeableTest');

const web3 = new Web3(new Web3.providers.HttpProvider(config.AVAX.localSubnetHTTP));
const ARCHITECT_UPGRADEABLE_ABI = ARCHITECT_UPGRADEABLE_JSON.abi as AbiItem[];

const MOCK_LZ_ENDPOINT_PF_CHAIN = testAccountsData[5].address;

contract.skip('ArchitectONFTExternalUpgradeable.sol', ([owner, account1, account2, account3, account4, account5, account6, account7, account8, account9]) => {
    let ArchitectONFTExternalUpgradeableInstance: ArchitectONFTExternalUpgradeableInstance;
    let multiSigWalletInstance: MultiSigWalletInstance;
    let ArchitectONFTExternalUpgradeableTestInstance: ArchitectONFTExternalUpgradeableTestInstance;
    let ArchitectONFTExternalUpgradeableContract: any;
    let USDPUpgradeableContract: any;

    beforeEach(async () => {
        // Require 2 signatures for multiSig
        multiSigWalletInstance = await multiSigWallet.new([owner, account1, account2], 2);
        ArchitectONFTExternalUpgradeableInstance = (await deployProxy(ArchitectONFTExternalUpgradeable as any, [account9, MOCK_LZ_ENDPOINT_PF_CHAIN], {
            initializer: 'initialize',
        })) as ArchitectONFTExternalUpgradeableInstance;
        await ArchitectONFTExternalUpgradeableInstance.transferOwnership(multiSigWalletInstance.address);

        ArchitectONFTExternalUpgradeableContract = new web3.eth.Contract(ARCHITECT_UPGRADEABLE_ABI, ArchitectONFTExternalUpgradeableInstance.address);
    });

    it("has token name set to 'Portal Fantasy Architect'", async () => {
        const tokenName = await ArchitectONFTExternalUpgradeableInstance.name();
        expect(tokenName).to.equal('Portal Fantasy Architect');
    });

    it("has token symbol set to 'PHAR'", async () => {
        const tokenSymbol = await ArchitectONFTExternalUpgradeableInstance.symbol();
        expect(tokenSymbol).to.equal('PHAR');
    });

    it('allows only the owner to change the base URI', async () => {
        let baseURIString = await ArchitectONFTExternalUpgradeableInstance.baseURIString();
        expect(baseURIString).to.equal('https://www.portalfantasy.io/');

        // Expect this to fail, as only the owner can change the base URI
        await localExpect(ArchitectONFTExternalUpgradeableInstance.setBaseURIString('https://www.foo.com/', { from: account1 })).to.eventually.be.rejected;

        const data = ArchitectONFTExternalUpgradeableContract.methods.setBaseURIString('https://www.bar.com/').encodeABI();
        await multiSigWalletInstance.submitTransaction(ArchitectONFTExternalUpgradeableInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        baseURIString = await ArchitectONFTExternalUpgradeableInstance.baseURIString();
        expect(baseURIString).to.equal('https://www.bar.com/');
    });

    it('allows only the owner (multiSigWallet) to change the contract URI', async () => {
        let contractURI = await ArchitectONFTExternalUpgradeableInstance.contractURI();
        expect(contractURI).to.equal('https://www.portalfantasy.io/architect/');

        // Expect this to fail, as only the owner can change the base URI
        await localExpect(ArchitectONFTExternalUpgradeableInstance.setContractURIString('https://www.foo.com/architect/', { from: account1 })).to.eventually.be.rejected;

        const data = ArchitectONFTExternalUpgradeableContract.methods.setContractURIString('https://www.bar.com/architect/').encodeABI();
        await multiSigWalletInstance.submitTransaction(ArchitectONFTExternalUpgradeableInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        contractURI = await ArchitectONFTExternalUpgradeableInstance.contractURI();
        expect(contractURI).to.equal('https://www.bar.com/architect/');
    });

    it('applies the default royalty correctly', async () => {
        const priceOfArchitectInUSDP = web3.utils.toWei('2', 'ether');

        // Assert expected royalty parameters
        // Using a dummy tokenId of 1 just to get the info. The token doesn't actually exist but it doesn't matter
        let defaultRoyaltyInfo = await ArchitectONFTExternalUpgradeableInstance.royaltyInfo('1', priceOfArchitectInUSDP);
        const royaltyRecipient = defaultRoyaltyInfo[0];
        const royaltyFee = defaultRoyaltyInfo[1];
        const expectedRoyalFeeNumeratorBips = 400;
        expect(royaltyRecipient).to.equal(account9);
        expect(royaltyFee.toString()).to.equal(bigInt(priceOfArchitectInUSDP).multiply(expectedRoyalFeeNumeratorBips).divide(10000).toString());
    });

    it('allows only the owner to change the default royalty fee', async () => {
        const priceOfArchitectInUSDP = web3.utils.toWei('2', 'ether');

        await localExpect(ArchitectONFTExternalUpgradeableInstance.setDefaultRoyalty(300, { from: account1 })).to.eventually.be.rejected;

        const updatedRoyaltyFeeBips = 100;
        const data = ArchitectONFTExternalUpgradeableContract.methods.setDefaultRoyalty(updatedRoyaltyFeeBips).encodeABI();
        await multiSigWalletInstance.submitTransaction(ArchitectONFTExternalUpgradeableInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        // Assert expected royalty parameters
        // Using a dummy tokenId of 1 just to get the info. The token doesn't actually exist but it doesn't matter
        let defaultRoyaltyInfo = await ArchitectONFTExternalUpgradeableInstance.royaltyInfo('1', priceOfArchitectInUSDP);
        const royaltyRecipient = defaultRoyaltyInfo[0];
        const royaltyFee = defaultRoyaltyInfo[1];
        expect(royaltyRecipient).to.equal(account9);
        expect(royaltyFee.toString()).to.equal(bigInt(priceOfArchitectInUSDP).multiply(updatedRoyaltyFeeBips).divide(10000).toString());
    });

    it('only allows the owner (multiSigWallet) to change the USDP vault', async () => {
        // Should fail since caller is not the owner
        await localExpect(ArchitectONFTExternalUpgradeableInstance.setVault(account2, { from: account1 })).to.eventually.be.rejected;

        const data = ArchitectONFTExternalUpgradeableContract.methods.setVault(account2).encodeABI();
        await multiSigWalletInstance.submitTransaction(ArchitectONFTExternalUpgradeableInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        const contractUSDPVault = (await ArchitectONFTExternalUpgradeableInstance.vault()).toString();
        expect(contractUSDPVault).to.equal(account2);
    });

    it('can be upgraded and store new state variables from the new contract', async () => {
        const tokenSymbol = await ArchitectONFTExternalUpgradeableInstance.symbol();
        expect(tokenSymbol).to.equal('PHAR');

        ArchitectONFTExternalUpgradeableTestInstance = (await upgradeProxy(
            ArchitectONFTExternalUpgradeableInstance.address,
            ArchitectONFTExternalUpgradeableTest as any
        )) as ArchitectONFTExternalUpgradeableTestInstance;

        // Original state variables remain unchanged
        const newTokenSymbol = await ArchitectONFTExternalUpgradeableTestInstance.symbol();
        expect(newTokenSymbol).to.equal('PHAR');

        // Contract URI can still only be set by the owner of the previous contract (multiSigWallet)
        let data = ArchitectONFTExternalUpgradeableContract.methods.setContractURIString('testingContractURIString').encodeABI();
        await multiSigWalletInstance.submitTransaction(ArchitectONFTExternalUpgradeableTestInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });
        expect((await ArchitectONFTExternalUpgradeableTestInstance.contractURI()).toString()).to.equal('testingContractURIString');

        // Non-existing method cannot be used to set state variable
        data = ArchitectONFTExternalUpgradeableContract.methods.setBaseURIString('https://www.foo.com/').encodeABI();
        await multiSigWalletInstance.submitTransaction(ArchitectONFTExternalUpgradeableTestInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;
        const baseURIString = await ArchitectONFTExternalUpgradeableTestInstance.baseURIString();
        expect(baseURIString).to.not.equal('https://www.foo.com/');
    });
});
