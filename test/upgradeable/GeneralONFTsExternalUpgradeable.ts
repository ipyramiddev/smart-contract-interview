import { deployProxy, upgradeProxy } from '@openzeppelin/truffle-upgrades';
import bigInt from 'big-integer';
import { localExpect } from '../lib/test-libraries';
import { GeneralONFTsExternalUpgradeableInstance, MultiSigWalletInstance, GeneralONFTsExternalUpgradeableTestInstance } from '../../types/truffle-contracts';
import GENERAL_ONFTS_UPGRADEABLE_JSON from '../../build/contracts/GeneralONFTsExternalUpgradeable.json';
import Web3 from 'web3';
import { AbiItem } from 'web3-utils';
import { getTxIdFromMultiSigWallet } from '../lib/test-helpers';

const config = require('../../config').config;
const testAccountsData = require('../../test/data/test-accounts-data').testAccountsData;

const GeneralONFTsExternalUpgradeable = artifacts.require('GeneralONFTsExternalUpgradeable');
const multiSigWallet = artifacts.require('MultiSigWallet');
const GeneralONFTsExternalUpgradeableTest = artifacts.require('GeneralONFTsExternalUpgradeableTest');

const web3 = new Web3(new Web3.providers.HttpProvider(config.AVAX.localSubnetHTTP));
const GENERAL_ONFTS_UPGRADEABLE_ABI = GENERAL_ONFTS_UPGRADEABLE_JSON.abi as AbiItem[];

const MOCK_LZ_ENDPOINT_PF_CHAIN = testAccountsData[5].address;

contract.skip('GeneralONFTsExternalUpgradeable.sol', ([owner, account1, account2, account3, account4, account5, account6, account7, account8, account9]) => {
    let GeneralONFTsExternalUpgradeableInstance: GeneralONFTsExternalUpgradeableInstance;
    let multiSigWalletInstance: MultiSigWalletInstance;
    let GeneralONFTsExternalUpgradeableTestInstance: GeneralONFTsExternalUpgradeableTestInstance;
    let GeneralONFTsExternalUpgradeableContract: any;
    let USDPUpgradeableContract: any;

    beforeEach(async () => {
        // Require 2 signatures for multiSig
        multiSigWalletInstance = await multiSigWallet.new([owner, account1, account2], 2);
        GeneralONFTsExternalUpgradeableInstance = (await deployProxy(GeneralONFTsExternalUpgradeable as any, [account9, MOCK_LZ_ENDPOINT_PF_CHAIN], {
            initializer: 'initialize',
        })) as GeneralONFTsExternalUpgradeableInstance;
        await GeneralONFTsExternalUpgradeableInstance.transferOwnership(multiSigWalletInstance.address);

        GeneralONFTsExternalUpgradeableContract = new web3.eth.Contract(GENERAL_ONFTS_UPGRADEABLE_ABI, GeneralONFTsExternalUpgradeableInstance.address);
    });

    it("has token name set to 'Portal Fantasy General NFTs'", async () => {
        const tokenName = await GeneralONFTsExternalUpgradeableInstance.name();
        expect(tokenName).to.equal('Portal Fantasy General NFTs');
    });

    it("has token symbol set to 'PFGN'", async () => {
        const tokenSymbol = await GeneralONFTsExternalUpgradeableInstance.symbol();
        expect(tokenSymbol).to.equal('PFGN');
    });

    it('allows only the owner to change the base URI', async () => {
        let baseURIString = await GeneralONFTsExternalUpgradeableInstance.baseURIString();
        expect(baseURIString).to.equal('https://www.portalfantasy.io/');

        // Expect this to fail, as only the owner can change the base URI
        await localExpect(GeneralONFTsExternalUpgradeableInstance.setBaseURIString('https://www.foo.com/', { from: account1 })).to.eventually.be.rejected;

        const data = GeneralONFTsExternalUpgradeableContract.methods.setBaseURIString('https://www.bar.com/').encodeABI();
        await multiSigWalletInstance.submitTransaction(GeneralONFTsExternalUpgradeableInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        baseURIString = await GeneralONFTsExternalUpgradeableInstance.baseURIString();
        expect(baseURIString).to.equal('https://www.bar.com/');
    });

    it('allows only the owner (multiSigWallet) to change the contract URI', async () => {
        let contractURI = await GeneralONFTsExternalUpgradeableInstance.contractURI();
        expect(contractURI).to.equal('https://www.portalfantasy.io/generalNFTs/');

        // Expect this to fail, as only the owner can change the base URI
        await localExpect(GeneralONFTsExternalUpgradeableInstance.setContractURIString('https://www.foo.com/generalNFTs/', { from: account1 })).to.eventually.be.rejected;

        const data = GeneralONFTsExternalUpgradeableContract.methods.setContractURIString('https://www.bar.com/generalNFTs/').encodeABI();
        await multiSigWalletInstance.submitTransaction(GeneralONFTsExternalUpgradeableInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        contractURI = await GeneralONFTsExternalUpgradeableInstance.contractURI();
        expect(contractURI).to.equal('https://www.bar.com/generalNFTs/');
    });

    it('applies the default royalty correctly', async () => {
        const priceOfGeneralNFTsInUSDP = web3.utils.toWei('2', 'ether');

        // Assert expected royalty parameters
        // Using a dummy tokenId of 1 just to get the info. The token doesn't actually exist but it doesn't matter
        let defaultRoyaltyInfo = await GeneralONFTsExternalUpgradeableInstance.royaltyInfo('1', priceOfGeneralNFTsInUSDP);
        const royaltyRecipient = defaultRoyaltyInfo[0];
        const royaltyFee = defaultRoyaltyInfo[1];
        const expectedRoyalFeeNumeratorBips = 400;
        expect(royaltyRecipient).to.equal(account9);
        expect(royaltyFee.toString()).to.equal(bigInt(priceOfGeneralNFTsInUSDP).multiply(expectedRoyalFeeNumeratorBips).divide(10000).toString());
    });

    it('allows only the owner to change the default royalty fee', async () => {
        const priceOfGeneralNFTsInUSDP = web3.utils.toWei('2', 'ether');

        await localExpect(GeneralONFTsExternalUpgradeableInstance.setDefaultRoyalty(300, { from: account1 })).to.eventually.be.rejected;

        const updatedRoyaltyFeeBips = 100;
        const data = GeneralONFTsExternalUpgradeableContract.methods.setDefaultRoyalty(updatedRoyaltyFeeBips).encodeABI();
        await multiSigWalletInstance.submitTransaction(GeneralONFTsExternalUpgradeableInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        // Assert expected royalty parameters
        // Using a dummy tokenId of 1 just to get the info. The token doesn't actually exist but it doesn't matter
        let defaultRoyaltyInfo = await GeneralONFTsExternalUpgradeableInstance.royaltyInfo('1', priceOfGeneralNFTsInUSDP);
        const royaltyRecipient = defaultRoyaltyInfo[0];
        const royaltyFee = defaultRoyaltyInfo[1];
        expect(royaltyRecipient).to.equal(account9);
        expect(royaltyFee.toString()).to.equal(bigInt(priceOfGeneralNFTsInUSDP).multiply(updatedRoyaltyFeeBips).divide(10000).toString());
    });

    it('only allows the owner (multiSigWallet) to change the USDP vault', async () => {
        // Should fail since caller is not the owner
        await localExpect(GeneralONFTsExternalUpgradeableInstance.setVault(account2, { from: account1 })).to.eventually.be.rejected;

        const data = GeneralONFTsExternalUpgradeableContract.methods.setVault(account2).encodeABI();
        await multiSigWalletInstance.submitTransaction(GeneralONFTsExternalUpgradeableInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        const contractUSDPVault = (await GeneralONFTsExternalUpgradeableInstance.vault()).toString();
        expect(contractUSDPVault).to.equal(account2);
    });

    it('can be upgraded and store new state variables from the new contract', async () => {
        const tokenSymbol = await GeneralONFTsExternalUpgradeableInstance.symbol();
        expect(tokenSymbol).to.equal('PFGN');

        GeneralONFTsExternalUpgradeableTestInstance = (await upgradeProxy(
            GeneralONFTsExternalUpgradeableInstance.address,
            GeneralONFTsExternalUpgradeableTest as any
        )) as GeneralONFTsExternalUpgradeableTestInstance;

        // Original state variables remain unchanged
        const newTokenSymbol = await GeneralONFTsExternalUpgradeableTestInstance.symbol();
        expect(newTokenSymbol).to.equal('PFGN');

        // Contract URI can still only be set by the owner of the previous contract (multiSigWallet)
        let data = GeneralONFTsExternalUpgradeableContract.methods.setContractURIString('testingContractURIString').encodeABI();
        await multiSigWalletInstance.submitTransaction(GeneralONFTsExternalUpgradeableTestInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });
        expect((await GeneralONFTsExternalUpgradeableTestInstance.contractURI()).toString()).to.equal('testingContractURIString');

        // Non-existing method cannot be used to set state variable
        data = GeneralONFTsExternalUpgradeableContract.methods.setBaseURIString('https://www.foo.com/').encodeABI();
        await multiSigWalletInstance.submitTransaction(GeneralONFTsExternalUpgradeableTestInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;
        const baseURIString = await GeneralONFTsExternalUpgradeableTestInstance.baseURIString();
        expect(baseURIString).to.not.equal('https://www.foo.com/');
    });
});
