import { deployProxy, upgradeProxy } from '@openzeppelin/truffle-upgrades';
import bigInt from 'big-integer';
import { localExpect } from '../lib/test-libraries';
import { HeroONFTExternalUpgradeableInstance, MultiSigWalletInstance, HeroONFTExternalUpgradeableTestInstance } from '../../types/truffle-contracts';
import HERO_UPGRADEABLE_JSON from '../../build/contracts/HeroONFTExternalUpgradeable.json';
import Web3 from 'web3';
import { AbiItem } from 'web3-utils';
import { getTxIdFromMultiSigWallet } from '../lib/test-helpers';

const config = require('../../config').config;
const testAccountsData = require('../../test/data/test-accounts-data').testAccountsData;

const HeroONFTExternalUpgradeable = artifacts.require('HeroONFTExternalUpgradeable');
const multiSigWallet = artifacts.require('MultiSigWallet');
const HeroONFTExternalUpgradeableTest = artifacts.require('HeroONFTExternalUpgradeableTest');

const web3 = new Web3(new Web3.providers.HttpProvider(config.AVAX.localSubnetHTTP));
const HERO_UPGRADEABLE_ABI = HERO_UPGRADEABLE_JSON.abi as AbiItem[];

const MOCK_LZ_ENDPOINT_PF_CHAIN = testAccountsData[5].address;

contract.skip('HeroONFTExternalUpgradeable.sol', ([owner, account1, account2, account3, account4, account5, account6, account7, account8, account9]) => {
    let HeroONFTExternalUpgradeableInstance: HeroONFTExternalUpgradeableInstance;
    let multiSigWalletInstance: MultiSigWalletInstance;
    let HeroONFTExternalUpgradeableTestInstance: HeroONFTExternalUpgradeableTestInstance;
    let HeroONFTExternalUpgradeableContract: any;
    let USDPUpgradeableContract: any;

    beforeEach(async () => {
        // Require 2 signatures for multiSig
        multiSigWalletInstance = await multiSigWallet.new([owner, account1, account2], 2);
        HeroONFTExternalUpgradeableInstance = (await deployProxy(HeroONFTExternalUpgradeable as any, [account9, MOCK_LZ_ENDPOINT_PF_CHAIN], {
            initializer: 'initialize',
        })) as HeroONFTExternalUpgradeableInstance;
        await HeroONFTExternalUpgradeableInstance.transferOwnership(multiSigWalletInstance.address);

        HeroONFTExternalUpgradeableContract = new web3.eth.Contract(HERO_UPGRADEABLE_ABI, HeroONFTExternalUpgradeableInstance.address);
    });

    it("has token name set to 'Portal Fantasy Hero'", async () => {
        const tokenName = await HeroONFTExternalUpgradeableInstance.name();
        expect(tokenName).to.equal('Portal Fantasy Hero');
    });

    it("has token symbol set to 'PHRO'", async () => {
        const tokenSymbol = await HeroONFTExternalUpgradeableInstance.symbol();
        expect(tokenSymbol).to.equal('PHRO');
    });

    it('allows only the owner to change the base URI', async () => {
        let baseURIString = await HeroONFTExternalUpgradeableInstance.baseURIString();
        expect(baseURIString).to.equal('https://www.portalfantasy.io/');

        // Expect this to fail, as only the owner can change the base URI
        await localExpect(HeroONFTExternalUpgradeableInstance.setBaseURIString('https://www.foo.com/', { from: account1 })).to.eventually.be.rejected;

        const data = HeroONFTExternalUpgradeableContract.methods.setBaseURIString('https://www.bar.com/').encodeABI();
        await multiSigWalletInstance.submitTransaction(HeroONFTExternalUpgradeableInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        baseURIString = await HeroONFTExternalUpgradeableInstance.baseURIString();
        expect(baseURIString).to.equal('https://www.bar.com/');
    });

    it('allows only the owner (multiSigWallet) to change the contract URI', async () => {
        let contractURI = await HeroONFTExternalUpgradeableInstance.contractURI();
        expect(contractURI).to.equal('https://www.portalfantasy.io/hero/');

        // Expect this to fail, as only the owner can change the base URI
        await localExpect(HeroONFTExternalUpgradeableInstance.setContractURIString('https://www.foo.com/hero/', { from: account1 })).to.eventually.be.rejected;

        const data = HeroONFTExternalUpgradeableContract.methods.setContractURIString('https://www.bar.com/hero/').encodeABI();
        await multiSigWalletInstance.submitTransaction(HeroONFTExternalUpgradeableInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        contractURI = await HeroONFTExternalUpgradeableInstance.contractURI();
        expect(contractURI).to.equal('https://www.bar.com/hero/');
    });

    it('applies the default royalty correctly', async () => {
        const priceOfHeroInUSDP = web3.utils.toWei('2', 'ether');

        // Assert expected royalty parameters
        // Using a dummy tokenId of 1 just to get the info. The token doesn't actually exist but it doesn't matter
        let defaultRoyaltyInfo = await HeroONFTExternalUpgradeableInstance.royaltyInfo('1', priceOfHeroInUSDP);
        const royaltyRecipient = defaultRoyaltyInfo[0];
        const royaltyFee = defaultRoyaltyInfo[1];
        const expectedRoyalFeeNumeratorBips = 400;
        expect(royaltyRecipient).to.equal(account9);
        expect(royaltyFee.toString()).to.equal(bigInt(priceOfHeroInUSDP).multiply(expectedRoyalFeeNumeratorBips).divide(10000).toString());
    });

    it('allows only the owner to change the default royalty fee', async () => {
        const priceOfHeroInUSDP = web3.utils.toWei('2', 'ether');

        await localExpect(HeroONFTExternalUpgradeableInstance.setDefaultRoyalty(300, { from: account1 })).to.eventually.be.rejected;

        const updatedRoyaltyFeeBips = 100;
        const data = HeroONFTExternalUpgradeableContract.methods.setDefaultRoyalty(updatedRoyaltyFeeBips).encodeABI();
        await multiSigWalletInstance.submitTransaction(HeroONFTExternalUpgradeableInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        // Assert expected royalty parameters
        // Using a dummy tokenId of 1 just to get the info. The token doesn't actually exist but it doesn't matter
        let defaultRoyaltyInfo = await HeroONFTExternalUpgradeableInstance.royaltyInfo('1', priceOfHeroInUSDP);
        const royaltyRecipient = defaultRoyaltyInfo[0];
        const royaltyFee = defaultRoyaltyInfo[1];
        expect(royaltyRecipient).to.equal(account9);
        expect(royaltyFee.toString()).to.equal(bigInt(priceOfHeroInUSDP).multiply(updatedRoyaltyFeeBips).divide(10000).toString());
    });

    it('only allows the owner (multiSigWallet) to change the USDP vault', async () => {
        // Should fail since caller is not the owner
        await localExpect(HeroONFTExternalUpgradeableInstance.setVault(account2, { from: account1 })).to.eventually.be.rejected;

        const data = HeroONFTExternalUpgradeableContract.methods.setVault(account2).encodeABI();
        await multiSigWalletInstance.submitTransaction(HeroONFTExternalUpgradeableInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        const contractUSDPVault = (await HeroONFTExternalUpgradeableInstance.vault()).toString();
        expect(contractUSDPVault).to.equal(account2);
    });

    it('can be upgraded and store new state variables from the new contract', async () => {
        const tokenSymbol = await HeroONFTExternalUpgradeableInstance.symbol();
        expect(tokenSymbol).to.equal('PHRO');

        HeroONFTExternalUpgradeableTestInstance = (await upgradeProxy(
            HeroONFTExternalUpgradeableInstance.address,
            HeroONFTExternalUpgradeableTest as any
        )) as HeroONFTExternalUpgradeableTestInstance;

        // Original state variables remain unchanged
        const newTokenSymbol = await HeroONFTExternalUpgradeableTestInstance.symbol();
        expect(newTokenSymbol).to.equal('PHRO');

        // Contract URI can still only be set by the owner of the previous contract (multiSigWallet)
        let data = HeroONFTExternalUpgradeableContract.methods.setContractURIString('testingContractURIString').encodeABI();
        await multiSigWalletInstance.submitTransaction(HeroONFTExternalUpgradeableTestInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });
        expect((await HeroONFTExternalUpgradeableTestInstance.contractURI()).toString()).to.equal('testingContractURIString');

        // Non-existing method cannot be used to set state variable
        data = HeroONFTExternalUpgradeableContract.methods.setBaseURIString('https://www.foo.com/').encodeABI();
        await multiSigWalletInstance.submitTransaction(HeroONFTExternalUpgradeableTestInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;
        const baseURIString = await HeroONFTExternalUpgradeableTestInstance.baseURIString();
        expect(baseURIString).to.not.equal('https://www.foo.com/');
    });
});
