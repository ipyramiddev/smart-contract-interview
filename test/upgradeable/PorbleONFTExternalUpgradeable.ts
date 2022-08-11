import { deployProxy, upgradeProxy } from '@openzeppelin/truffle-upgrades';
import bigInt from 'big-integer';
import { localExpect } from '../lib/test-libraries';
import { PorbleONFTExternalUpgradeableInstance, MultiSigWalletInstance, PorbleONFTExternalUpgradeableTestInstance } from '../../types/truffle-contracts';
import PORBLE_ONFT_EXTERNAL_UPGRADEABLE_JSON from '../../build/contracts/PorbleONFTExternalUpgradeable.json';
import Web3 from 'web3';
import { AbiItem } from 'web3-utils';
import { getTxIdFromMultiSigWallet } from '../lib/test-helpers';

const ethers = require('ethers');
const testAccountsData = require('../../test/data/test-accounts-data').testAccountsData;
const config = require('../../config').config;

const porbleUpgradeable = artifacts.require('PorbleONFTExternalUpgradeable');
const multiSigWallet = artifacts.require('MultiSigWallet');
const porbleUpgradeableTest = artifacts.require('PorbleONFTExternalUpgradeableTest');

const rpcEndpoint = config.AVAX.localSubnetHTTP;
const provider = new ethers.providers.JsonRpcProvider(rpcEndpoint);
const signer = new ethers.Wallet(testAccountsData[1].privateKey, provider);
const PORBLE_ONFT_EXTERNAL_UPGRADEABLE_ABI = PORBLE_ONFT_EXTERNAL_UPGRADEABLE_JSON.abi as AbiItem[];
const web3 = new Web3(new Web3.providers.HttpProvider(config.AVAX.localSubnetHTTP));

const MOCK_LZ_ENDPOINT_PF_CHAIN = testAccountsData[5].address;

contract('PorbleONFTExternalUpgradeable.sol', ([owner, account1, account2, account3, account4, account5, account6, account7, account8, account9]) => {
    let PorbleONFTExternalUpgradeableInstance: PorbleONFTExternalUpgradeableInstance;
    let multiSigWalletInstance: MultiSigWalletInstance;
    let PorbleONFTExternalUpgradeableTestInstance: PorbleONFTExternalUpgradeableTestInstance;
    let porbleUpgradeableContract: any;

    beforeEach(async () => {
        // Require 2 signatures for multiSig
        multiSigWalletInstance = await multiSigWallet.new([owner, account1, account2], 2);
        PorbleONFTExternalUpgradeableInstance = (await deployProxy(porbleUpgradeable as any, [multiSigWalletInstance.address, MOCK_LZ_ENDPOINT_PF_CHAIN], {
            initializer: 'initialize',
        })) as PorbleONFTExternalUpgradeableInstance;
        await PorbleONFTExternalUpgradeableInstance.transferOwnership(multiSigWalletInstance.address);

        porbleUpgradeableContract = new web3.eth.Contract(PORBLE_ONFT_EXTERNAL_UPGRADEABLE_ABI, PorbleONFTExternalUpgradeableInstance.address, MOCK_LZ_ENDPOINT_PF_CHAIN);
    });

    it("has token name set to 'Portal Fantasy Porble'", async () => {
        const tokenName = await PorbleONFTExternalUpgradeableInstance.name();
        expect(tokenName).to.equal('Portal Fantasy Porble');
    });

    it("has token symbol set to 'PRBL'", async () => {
        const tokenSymbol = await PorbleONFTExternalUpgradeableInstance.symbol();
        expect(tokenSymbol).to.equal('PRBL');
    });

    it('has the contract owner set to the multiSigWallet address', async () => {
        const contractOwner = await PorbleONFTExternalUpgradeableInstance.owner();
        expect(contractOwner).to.equal(multiSigWalletInstance.address);
    });

    it('allows only the owner to change the base URI', async () => {
        const types = {
            PorbleMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenIds', type: 'uint256[]' },
            ],
        };

        const porbleMintConditions = { minter: testAccountsData[1].address, tokenIds: ['1'] };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: PorbleONFTExternalUpgradeableInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature: string = await signer._signTypedData(domain, types, porbleMintConditions);

        let baseURIString = await PorbleONFTExternalUpgradeableInstance.baseURIString();
        expect(baseURIString).to.equal('https://www.portalfantasy.io/');

        // Expect this to fail, as only the owner can change the base URI
        await localExpect(PorbleONFTExternalUpgradeableInstance.setBaseURIString('https://www.foo.com/', { from: account1 })).to.eventually.be.rejected;

        const data = porbleUpgradeableContract.methods.setBaseURIString('https://www.bar.com/').encodeABI();
        await multiSigWalletInstance.submitTransaction(PorbleONFTExternalUpgradeableInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        baseURIString = await PorbleONFTExternalUpgradeableInstance.baseURIString();
        expect(baseURIString).to.equal('https://www.bar.com/');
    });

    it('allows only the owner (multiSigWallet) to change the contract URI', async () => {
        let contractURI = await PorbleONFTExternalUpgradeableInstance.contractURI();
        expect(contractURI).to.equal('https://www.portalfantasy.io/porble/');

        // Expect this to fail, as only the owner can change the base URI
        await localExpect(PorbleONFTExternalUpgradeableInstance.setContractURIString('https://www.foo.com/porble/', { from: account1 })).to.eventually.be.rejected;

        const data = porbleUpgradeableContract.methods.setContractURIString('https://www.bar.com/porble/').encodeABI();
        await multiSigWalletInstance.submitTransaction(PorbleONFTExternalUpgradeableInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        contractURI = await PorbleONFTExternalUpgradeableInstance.contractURI();
        expect(contractURI).to.equal('https://www.bar.com/porble/');
    });

    it('applies the default royalty correctly', async () => {
        const priceOfPorbleInUSDP = web3.utils.toWei('2', 'ether');

        // Assert expected royalty parameters
        // Using a dummy tokenId of 1 just to get the info. The token doesn't actually exist but it doesn't matter
        let defaultRoyaltyInfo = await PorbleONFTExternalUpgradeableInstance.royaltyInfo('1', priceOfPorbleInUSDP);
        const royaltyRecipient = defaultRoyaltyInfo[0];
        const royaltyFee = defaultRoyaltyInfo[1];
        const expectedRoyalFeeNumeratorBips = 400;
        expect(royaltyRecipient).to.equal(multiSigWalletInstance.address);
        expect(royaltyFee.toString()).to.equal(bigInt(priceOfPorbleInUSDP).multiply(expectedRoyalFeeNumeratorBips).divide(10000).toString());
    });

    it('allows only the owner to change the default royalty fee', async () => {
        const priceOfPorbleInUSDP = web3.utils.toWei('2', 'ether');

        await localExpect(PorbleONFTExternalUpgradeableInstance.setDefaultRoyalty(300, { from: account1 })).to.eventually.be.rejected;

        const updatedRoyaltyFeeBips = 100;
        const data = porbleUpgradeableContract.methods.setDefaultRoyalty(updatedRoyaltyFeeBips).encodeABI();
        await multiSigWalletInstance.submitTransaction(PorbleONFTExternalUpgradeableInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        // Assert expected royalty parameters
        // Using a dummy tokenId of 1 just to get the info. The token doesn't actually exist but it doesn't matter
        let defaultRoyaltyInfo = await PorbleONFTExternalUpgradeableInstance.royaltyInfo('1', priceOfPorbleInUSDP);
        const royaltyRecipient = defaultRoyaltyInfo[0];
        const royaltyFee = defaultRoyaltyInfo[1];
        expect(royaltyRecipient).to.equal(multiSigWalletInstance.address);
        expect(royaltyFee.toString()).to.equal(bigInt(priceOfPorbleInUSDP).multiply(updatedRoyaltyFeeBips).divide(10000).toString());
    });

    it('can be upgraded and store new state variables from the new contract', async () => {
        const tokenSymbol = await PorbleONFTExternalUpgradeableInstance.symbol();
        expect(tokenSymbol).to.equal('PRBL');

        PorbleONFTExternalUpgradeableTestInstance = (await upgradeProxy(
            PorbleONFTExternalUpgradeableInstance.address,
            porbleUpgradeableTest as any
        )) as PorbleONFTExternalUpgradeableTestInstance;

        // Original state variables remain unchanged
        const newTokenSymbol = await PorbleONFTExternalUpgradeableTestInstance.symbol();
        expect(newTokenSymbol).to.equal('PRBL');

        // Contract URI can still only be set by the owner of the previous contract (multiSigWallet)
        let data = porbleUpgradeableContract.methods.setContractURIString('testingContractURIString').encodeABI();
        await multiSigWalletInstance.submitTransaction(PorbleONFTExternalUpgradeableTestInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });
        expect((await PorbleONFTExternalUpgradeableInstance.contractURI()).toString()).to.equal('testingContractURIString');

        // Non-existing method cannot be used to set state variable
        data = porbleUpgradeableContract.methods.setBaseURIString('https://www.foo.com/').encodeABI();
        await multiSigWalletInstance.submitTransaction(PorbleONFTExternalUpgradeableTestInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;
        const baseURIString = await PorbleONFTExternalUpgradeableTestInstance.baseURIString();
        expect(baseURIString).to.not.equal('https://www.foo.com/');
    });
});
