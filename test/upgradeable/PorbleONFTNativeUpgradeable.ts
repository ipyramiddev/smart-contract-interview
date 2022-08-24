import { deployProxy, upgradeProxy } from '@openzeppelin/truffle-upgrades';
import bigInt from 'big-integer';
import { localExpect } from '../lib/test-libraries';
import { PorbleONFTNativeUpgradeableInstance, MultiSigWalletInstance, PorbleONFTNativeUpgradeableTestInstance } from '../../types/truffle-contracts';
import PORBLE_ONFT_NATIVE_UPGRADEABLE_JSON from '../../build/contracts/PorbleONFTNativeUpgradeable.json';
import Web3 from 'web3';
import { AbiItem } from 'web3-utils';
import { getTxIdFromMultiSigWallet } from '../lib/test-helpers';

const ethers = require('ethers');
const testAccountsData = require('../../test/data/test-accounts-data').testAccountsData;
const config = require('../../config').config;

const porbleUpgradeable = artifacts.require('PorbleONFTNativeUpgradeable');
const multiSigWallet = artifacts.require('MultiSigWallet');
const porbleUpgradeableTest = artifacts.require('PorbleONFTNativeUpgradeableTest');

const rpcEndpoint = config.AVAX.localSubnetHTTP;
const provider = new ethers.providers.JsonRpcProvider(rpcEndpoint);
const signer = new ethers.Wallet(testAccountsData[1].privateKey, provider);
const PORBLE_ONFT_NATIVE_UPGRADEABLE_ABI = PORBLE_ONFT_NATIVE_UPGRADEABLE_JSON.abi as AbiItem[];
const web3 = new Web3(new Web3.providers.HttpProvider(config.AVAX.localSubnetHTTP));

const MOCK_LZ_ENDPOINT_PF_CHAIN = testAccountsData[5].address;

contract.skip('PorbleONFTNativeUpgradeable.sol', ([owner, account1, account2, account3, account4, account5, account6, account7, account8, account9]) => {
    let PorbleONFTNativeUpgradeableInstance: PorbleONFTNativeUpgradeableInstance;
    let multiSigWalletInstance: MultiSigWalletInstance;
    let PorbleONFTNativeUpgradeableTestInstance: PorbleONFTNativeUpgradeableTestInstance;
    let porbleUpgradeableContract: any;

    beforeEach(async () => {
        // Require 2 signatures for multiSig
        multiSigWalletInstance = await multiSigWallet.new([owner, account1, account2], 2);
        PorbleONFTNativeUpgradeableInstance = (await deployProxy(porbleUpgradeable as any, [account1, multiSigWalletInstance.address, MOCK_LZ_ENDPOINT_PF_CHAIN], {
            initializer: 'initialize',
        })) as PorbleONFTNativeUpgradeableInstance;
        await PorbleONFTNativeUpgradeableInstance.transferOwnership(multiSigWalletInstance.address);

        porbleUpgradeableContract = new web3.eth.Contract(PORBLE_ONFT_NATIVE_UPGRADEABLE_ABI, PorbleONFTNativeUpgradeableInstance.address, MOCK_LZ_ENDPOINT_PF_CHAIN);
    });

    it("has token name set to 'Portal Fantasy Porble'", async () => {
        const tokenName = await PorbleONFTNativeUpgradeableInstance.name();
        expect(tokenName).to.equal('Portal Fantasy Porble');
    });

    it("has token symbol set to 'PRBL'", async () => {
        const tokenSymbol = await PorbleONFTNativeUpgradeableInstance.symbol();
        expect(tokenSymbol).to.equal('PRBL');
    });

    it('has the contract owner set to the multiSigWallet address', async () => {
        const contractOwner = await PorbleONFTNativeUpgradeableInstance.owner();
        expect(contractOwner).to.equal(multiSigWalletInstance.address);
    });

    it('only allows the owner to change the mintSigner', async () => {
        // Should fail since caller is not the owner
        await localExpect(PorbleONFTNativeUpgradeableInstance.setMintSigner(account3, { from: account1 })).to.eventually.be.rejected;

        const data = porbleUpgradeableContract.methods.setMintSigner(account3).encodeABI();
        await multiSigWalletInstance.submitTransaction(PorbleONFTNativeUpgradeableInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        const mintSigner = await PorbleONFTNativeUpgradeableInstance.signer();
        expect(mintSigner).to.equal(account3);
    });

    it('allows a porble token to be minted if the signature is successfully verified', async () => {
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
            verifyingContract: PorbleONFTNativeUpgradeableInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, porbleMintConditions);

        // The tokenId and tx sender must match those that have been signed for
        await localExpect(PorbleONFTNativeUpgradeableInstance.safeMintTokens(signature, ['1'], { from: testAccountsData[1].address })).to.eventually.be.fulfilled;
        expect(await PorbleONFTNativeUpgradeableInstance.ownerOf('1')).to.equal(testAccountsData[1].address);
    });

    it('allows multiple porble tokens to be minted if the signature is successfully verified', async () => {
        const types = {
            PorbleMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenIds', type: 'uint256[]' },
            ],
        };

        const porbleMintConditions = { minter: testAccountsData[1].address, tokenIds: ['1', '23', '454'] };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: PorbleONFTNativeUpgradeableInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, porbleMintConditions);

        // The tokenId and tx sender must match those that have been signed for
        await localExpect(PorbleONFTNativeUpgradeableInstance.safeMintTokens(signature, ['1', '23', '454'], { from: testAccountsData[1].address })).to.eventually.be.fulfilled;
        expect(await PorbleONFTNativeUpgradeableInstance.ownerOf('1')).to.equal(testAccountsData[1].address);
        expect(await PorbleONFTNativeUpgradeableInstance.ownerOf('23')).to.equal(testAccountsData[1].address);
        expect(await PorbleONFTNativeUpgradeableInstance.ownerOf('454')).to.equal(testAccountsData[1].address);
    });

    it('reverts if the same signature is used multiple times', async () => {
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
            verifyingContract: PorbleONFTNativeUpgradeableInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, porbleMintConditions);

        // The tokenId and tx sender must match those that have been signed for
        await localExpect(PorbleONFTNativeUpgradeableInstance.safeMintTokens(signature, ['1'], { from: testAccountsData[1].address })).to.eventually.be.fulfilled;

        await localExpect(PorbleONFTNativeUpgradeableInstance.safeMintTokens(signature, ['1'], { from: testAccountsData[1].address })).to.eventually.be.rejected;
    });

    it("prevents a porble token from being minted if the 'PorbleMintConditions' key doesn't match the name of the object hard-coded in the contract", async () => {
        const types = {
            PorbleMintConditionsWrong: [
                { name: 'minter', type: 'address' },
                { name: 'tokenIds', type: 'uint256[]' },
            ],
        };

        const porbleMintConditions = { minter: testAccountsData[1].address, tokenIds: ['2'] };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: PorbleONFTNativeUpgradeableInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, porbleMintConditions);

        // The tokenId and tx sender must match those that have been signed for
        await localExpect(PorbleONFTNativeUpgradeableInstance.safeMintTokens(signature, ['2'], { from: testAccountsData[1].address })).to.eventually.be.rejected;
    });

    it("prevents a porble token from being minted if the domain name doesn't match the string passed into the contract's constructor", async () => {
        const types = {
            PorbleMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenIds', type: 'uint256[]' },
            ],
        };

        const porbleMintConditions = { minter: testAccountsData[1].address, tokenIds: ['2'] };

        const domain = {
            name: 'PortalFantasyWrong',
            version: '1',
            chainId: 43214,
            verifyingContract: PorbleONFTNativeUpgradeableInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, porbleMintConditions);

        // The tokenId and tx sender must match those that have been signed for
        await localExpect(PorbleONFTNativeUpgradeableInstance.safeMintTokens(signature, ['2'], { from: testAccountsData[1].address })).to.eventually.be.rejected;
    });

    it("prevents a porble token from being minted if the domain version doesn't match the string passed into the contract's constructor", async () => {
        const types = {
            PorbleMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenIds', type: 'uint256[]' },
            ],
        };

        const porbleMintConditions = { minter: testAccountsData[1].address, tokenIds: ['2'] };

        const domain = {
            name: 'PortalFantasy',
            version: '9',
            chainId: 43214,
            verifyingContract: PorbleONFTNativeUpgradeableInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, porbleMintConditions);

        // The tokenId and tx sender must match those that have been signed for
        await localExpect(PorbleONFTNativeUpgradeableInstance.safeMintTokens(signature, ['2'], { from: testAccountsData[1].address })).to.eventually.be.rejected;
    });

    it("prevents a porble token from being minted if the domain chainId doesn't match the chainId of the chain the contract is deployed to", async () => {
        const types = {
            PorbleMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenIds', type: 'uint256[]' },
            ],
        };

        const porbleMintConditions = { minter: testAccountsData[1].address, tokenIds: ['2'] };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 99999,
            verifyingContract: PorbleONFTNativeUpgradeableInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, porbleMintConditions);

        // The tokenId and tx sender must match those that have been signed for
        await localExpect(PorbleONFTNativeUpgradeableInstance.safeMintTokens(signature, ['2'], { from: testAccountsData[1].address })).to.eventually.be.rejected;
    });

    it("prevents a porble token from being minted if the domain verifyingContract doesn't match the address the contract is deployed to", async () => {
        const types = {
            PorbleMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenIds', type: 'uint256[]' },
            ],
        };

        const porbleMintConditions = { minter: testAccountsData[1].address, tokenIds: ['2'] };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: '0xcccccccccccccccccccccccccccccccccccccccc',
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, porbleMintConditions);

        // The tokenId and tx sender must match those that have been signed for
        await localExpect(PorbleONFTNativeUpgradeableInstance.safeMintTokens(signature, ['2'], { from: testAccountsData[1].address })).to.eventually.be.rejected;
    });

    it("prevents a porble token from being minted if the signed 'minter' address doesn't match the sender address of the tx", async () => {
        const types = {
            PorbleMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenIds', type: 'uint256[]' },
            ],
        };

        const porbleMintConditions = { minter: testAccountsData[1].address, tokenIds: ['2'] };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: PorbleONFTNativeUpgradeableInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, porbleMintConditions);

        // The tokenId and tx sender must match those that have been signed for
        await localExpect(PorbleONFTNativeUpgradeableInstance.safeMintTokens(signature, ['2'], { from: testAccountsData[2].address })).to.eventually.be.rejected;
    });

    it("prevents a porble token from being minted if the signed tokenId doesn't match the tokenId specified by the caller", async () => {
        const types = {
            PorbleMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenIds', type: 'uint256[]' },
            ],
        };

        const porbleMintConditions = { minter: testAccountsData[1].address, tokenIds: ['2'] };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: PorbleONFTNativeUpgradeableInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, porbleMintConditions);

        // The tokenId and tx sender must match those that have been signed for
        await localExpect(PorbleONFTNativeUpgradeableInstance.safeMintTokens(signature, ['99999'], { from: testAccountsData[1].address })).to.eventually.be.rejected;
    });

    it('prevents a porble token from being minted if the signature is tampered with', async () => {
        const types = {
            PorbleMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenIds', type: 'uint256[]' },
            ],
        };

        const porbleMintConditions = { minter: testAccountsData[1].address, tokenIds: ['2'] };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: PorbleONFTNativeUpgradeableInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature: string = await signer._signTypedData(domain, types, porbleMintConditions);

        const signatureArr = signature.split('');
        signatureArr[10] = '7';
        const tamperedSignature = signatureArr.join('');

        // The tokenId and tx sender must match those that have been signed for
        await localExpect(PorbleONFTNativeUpgradeableInstance.safeMintTokens(tamperedSignature, ['2'], { from: testAccountsData[1].address })).to.eventually.be.rejected;
    });

    it('only allows the owner to change the _mintSigner', async () => {
        // Should fail since caller is not the owner
        await localExpect(PorbleONFTNativeUpgradeableInstance.setMintSigner(account3, { from: account1 })).to.eventually.be.rejected;

        const data = porbleUpgradeableContract.methods.setMintSigner(account3).encodeABI();
        await multiSigWalletInstance.submitTransaction(PorbleONFTNativeUpgradeableInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;
    });

    it("only allows a token to be minted if the signer is updated to match the contract's changed _mintSigner", async () => {
        // Change the mint signer
        const data = porbleUpgradeableContract.methods.setMintSigner(account2).encodeABI();
        await multiSigWalletInstance.submitTransaction(PorbleONFTNativeUpgradeableInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        const types = {
            PorbleMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenIds', type: 'uint256[]' },
            ],
        };

        const porbleMintConditions = { minter: testAccountsData[1].address, tokenIds: ['2'] };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: PorbleONFTNativeUpgradeableInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, porbleMintConditions);

        // This should fail because the _mintSigner has changed and no longer matches the signer
        await localExpect(PorbleONFTNativeUpgradeableInstance.safeMintTokens(signature, ['2'], { from: testAccountsData[1].address })).to.eventually.be.rejected;

        const newSigner = new ethers.Wallet(testAccountsData[2].privateKey, provider);
        const newsignature = await newSigner._signTypedData(domain, types, porbleMintConditions);

        await localExpect(PorbleONFTNativeUpgradeableInstance.safeMintTokens(newsignature, ['2'], { from: testAccountsData[1].address })).to.eventually.be.fulfilled;
    });

    // @TODO: Update this test when we have the final base URI implemented in the contract
    it('generates a valid token URI', async () => {
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
            verifyingContract: PorbleONFTNativeUpgradeableInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature: string = await signer._signTypedData(domain, types, porbleMintConditions);

        await PorbleONFTNativeUpgradeableInstance.safeMintTokens(signature, ['1'], { from: testAccountsData[1].address });

        const tokenURI = await PorbleONFTNativeUpgradeableInstance.tokenURI('1');
        expect(tokenURI).to.equal('https://www.portalfantasy.io/1');
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
            verifyingContract: PorbleONFTNativeUpgradeableInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature: string = await signer._signTypedData(domain, types, porbleMintConditions);

        await PorbleONFTNativeUpgradeableInstance.safeMintTokens(signature, ['1'], { from: testAccountsData[1].address });

        let tokenURI = await PorbleONFTNativeUpgradeableInstance.tokenURI('1');
        expect(tokenURI).to.equal('https://www.portalfantasy.io/1');

        // Expect this to fail, as only the owner can change the base URI
        await localExpect(PorbleONFTNativeUpgradeableInstance.setBaseURIString('https://www.foo.com/', { from: account1 })).to.eventually.be.rejected;

        const data = porbleUpgradeableContract.methods.setBaseURIString('https://www.bar.com/').encodeABI();
        await multiSigWalletInstance.submitTransaction(PorbleONFTNativeUpgradeableInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        tokenURI = await PorbleONFTNativeUpgradeableInstance.tokenURI('1');
        expect(tokenURI).to.equal('https://www.bar.com/1');
    });

    it('allows only the owner (multiSigWallet) to change the contract URI', async () => {
        let contractURI = await PorbleONFTNativeUpgradeableInstance.contractURI();
        expect(contractURI).to.equal('https://www.portalfantasy.io/porble/');

        // Expect this to fail, as only the owner can change the base URI
        await localExpect(PorbleONFTNativeUpgradeableInstance.setContractURIString('https://www.foo.com/porble/', { from: account1 })).to.eventually.be.rejected;

        const data = porbleUpgradeableContract.methods.setContractURIString('https://www.bar.com/porble/').encodeABI();
        await multiSigWalletInstance.submitTransaction(PorbleONFTNativeUpgradeableInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        contractURI = await PorbleONFTNativeUpgradeableInstance.contractURI();
        expect(contractURI).to.equal('https://www.bar.com/porble/');
    });

    it('applies the default royalty correctly', async () => {
        const priceOfPorbleInUSDP = web3.utils.toWei('2', 'ether');

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
            verifyingContract: PorbleONFTNativeUpgradeableInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, porbleMintConditions);

        // The tokenId and tx sender must match those that have been signed for
        await localExpect(PorbleONFTNativeUpgradeableInstance.safeMintTokens(signature, ['1'], { from: testAccountsData[1].address })).to.eventually.be.fulfilled;

        // Assert expected royalty parameters
        let defaultRoyaltyInfo = await PorbleONFTNativeUpgradeableInstance.royaltyInfo('1', priceOfPorbleInUSDP);
        const royaltyRecipient = defaultRoyaltyInfo[0];
        const royaltyFee = defaultRoyaltyInfo[1];
        const expectedRoyalFeeNumeratorBips = 400;
        expect(royaltyRecipient).to.equal(multiSigWalletInstance.address);
        expect(royaltyFee.toString()).to.equal(bigInt(priceOfPorbleInUSDP).multiply(expectedRoyalFeeNumeratorBips).divide(10000).toString());
    });

    it('allows only the owner to change the default royalty fee', async () => {
        const priceOfPorbleInUSDP = web3.utils.toWei('2', 'ether');

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
            verifyingContract: PorbleONFTNativeUpgradeableInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, porbleMintConditions);

        // The tokenId and tx sender must match those that have been signed for
        await localExpect(PorbleONFTNativeUpgradeableInstance.safeMintTokens(signature, ['1'], { from: testAccountsData[1].address })).to.eventually.be.fulfilled;

        await localExpect(PorbleONFTNativeUpgradeableInstance.setDefaultRoyalty(300, { from: account1 })).to.eventually.be.rejected;

        const updatedRoyaltyFeeBips = 100;
        const data = porbleUpgradeableContract.methods.setDefaultRoyalty(updatedRoyaltyFeeBips).encodeABI();
        await multiSigWalletInstance.submitTransaction(PorbleONFTNativeUpgradeableInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        // Assert expected royalty parameters
        let defaultRoyaltyInfo = await PorbleONFTNativeUpgradeableInstance.royaltyInfo('0', priceOfPorbleInUSDP);
        const royaltyRecipient = defaultRoyaltyInfo[0];
        const royaltyFee = defaultRoyaltyInfo[1];
        expect(royaltyRecipient).to.equal(multiSigWalletInstance.address);
        expect(royaltyFee.toString()).to.equal(bigInt(priceOfPorbleInUSDP).multiply(updatedRoyaltyFeeBips).divide(10000).toString());
    });

    it('can be upgraded and store new state variables from the new contract', async () => {
        const tokenSymbol = await PorbleONFTNativeUpgradeableInstance.symbol();
        expect(tokenSymbol).to.equal('PRBL');

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
            verifyingContract: PorbleONFTNativeUpgradeableInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, porbleMintConditions);

        // The tokenId and tx sender must match those that have been signed for
        await localExpect(PorbleONFTNativeUpgradeableInstance.safeMintTokens(signature, ['1'], { from: testAccountsData[1].address })).to.eventually.be.fulfilled;

        PorbleONFTNativeUpgradeableTestInstance = (await upgradeProxy(
            PorbleONFTNativeUpgradeableInstance.address,
            porbleUpgradeableTest as any
        )) as PorbleONFTNativeUpgradeableTestInstance;

        // Original state variables remain unchanged
        const newTokenSymbol = await PorbleONFTNativeUpgradeableTestInstance.symbol();
        expect(newTokenSymbol).to.equal('PRBL');
        const ownerOfMintedPorble1 = await PorbleONFTNativeUpgradeableTestInstance.ownerOf('1');
        expect(ownerOfMintedPorble1).to.equal(account1);

        // Contract URI can still only be set by the owner of the previous contract (multiSigWallet)
        let data = porbleUpgradeableContract.methods.setContractURIString('testingContractURIString').encodeABI();
        await multiSigWalletInstance.submitTransaction(PorbleONFTNativeUpgradeableTestInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });
        expect((await PorbleONFTNativeUpgradeableInstance.contractURI()).toString()).to.equal('testingContractURIString');

        // Non-existing method cannot be used to set state variable
        data = porbleUpgradeableContract.methods.setBaseURIString('https://www.foo.com/').encodeABI();
        await multiSigWalletInstance.submitTransaction(PorbleONFTNativeUpgradeableTestInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;
        const baseURIString = await PorbleONFTNativeUpgradeableTestInstance.baseURIString();
        expect(baseURIString).to.not.equal('https://www.foo.com/');
    });

    it('facilitates the porble fusion process', async () => {
        const mintTypes = {
            PorbleMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenIds', type: 'uint256[]' },
            ],
        };

        const tokenIds = ['1', '344', '4562', '48', '898770', '34343235'];

        const porbleMintConditions = { minter: testAccountsData[1].address, tokenIds };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: PorbleONFTNativeUpgradeableInstance.address,
        };

        // Sign according to the EIP-712 standard
        const mintSignature = await signer._signTypedData(domain, mintTypes, porbleMintConditions);

        // The tokenId and tx sender must match those that have been signed for
        await PorbleONFTNativeUpgradeableInstance.safeMintTokens(mintSignature, tokenIds, { from: testAccountsData[1].address });

        // Now we want to sacrifice some of the tokens for the fusion
        const fusionTypes = {
            PorbleFusionConditions: [
                { name: 'owner', type: 'address' },
                { name: 'fusionId', type: 'uint256' },
                { name: 'sacrificialTokenIds', type: 'uint256[]' },
            ],
        };

        const fusionId = '7756';
        const sacrificialTokenIds = ['48', '344', '898770'];
        const porbleFusionConditions = { owner: testAccountsData[1].address, fusionId, sacrificialTokenIds };

        // Sign according to the EIP-712 standard
        const fusionSignature = await signer._signTypedData(domain, fusionTypes, porbleFusionConditions);

        // Fusion has not been triggered so this should return false
        expect(await PorbleONFTNativeUpgradeableInstance.hasFusionCompleted(account1, fusionId)).to.be.false;

        // Trigger the fusion
        await localExpect(PorbleONFTNativeUpgradeableInstance.fuse(fusionSignature, fusionId, sacrificialTokenIds, { from: testAccountsData[1].address })).to.eventually.be
            .fulfilled;

        expect(await PorbleONFTNativeUpgradeableInstance.ownerOf('1')).to.equal(testAccountsData[1].address);
        expect(await PorbleONFTNativeUpgradeableInstance.ownerOf('4562')).to.equal(testAccountsData[1].address);
        expect(await PorbleONFTNativeUpgradeableInstance.ownerOf('34343235')).to.equal(testAccountsData[1].address);

        // Sacrificed tokens
        await localExpect(PorbleONFTNativeUpgradeableInstance.ownerOf('48')).to.eventually.be.rejected;
        await localExpect(PorbleONFTNativeUpgradeableInstance.ownerOf('344')).to.eventually.be.rejected;
        await localExpect(PorbleONFTNativeUpgradeableInstance.ownerOf('898770')).to.eventually.be.rejected;

        // Fusion has completed
        expect(await PorbleONFTNativeUpgradeableInstance.hasFusionCompleted(account1, fusionId)).to.be.true;
    });

    it('allows fusion for X amount of sacrifical tokens without hitting block gas limits', async () => {
        const mintTypes = {
            PorbleMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenIds', type: 'uint256[]' },
            ],
        };

        const tokenIds = Array.from({ length: 250 }, (_, i) => i + 1);
        console.log(tokenIds);

        const porbleMintConditions = { minter: testAccountsData[1].address, tokenIds };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: PorbleONFTNativeUpgradeableInstance.address,
        };

        // Sign according to the EIP-712 standard
        const mintSignature = await signer._signTypedData(domain, mintTypes, porbleMintConditions);

        // The tokenId and tx sender must match those that have been signed for
        await PorbleONFTNativeUpgradeableInstance.safeMintTokens(mintSignature, tokenIds, { from: testAccountsData[1].address });

        // Now we want to sacrifice some of the tokens for the fusion
        const fusionTypes = {
            PorbleFusionConditions: [
                { name: 'owner', type: 'address' },
                { name: 'fusionId', type: 'uint256' },
                { name: 'sacrificialTokenIds', type: 'uint256[]' },
            ],
        };

        const fusionId = '7756';
        const sacrificialTokenIds = tokenIds;
        const porbleFusionConditions = { owner: testAccountsData[1].address, fusionId, sacrificialTokenIds };

        // Sign according to the EIP-712 standard
        const fusionSignature = await signer._signTypedData(domain, fusionTypes, porbleFusionConditions);

        // Trigger the fusion
        await localExpect(PorbleONFTNativeUpgradeableInstance.fuse(fusionSignature, fusionId, sacrificialTokenIds, { from: testAccountsData[1].address })).to.eventually.be
            .fulfilled;

        // Fusion has completed
        expect(await PorbleONFTNativeUpgradeableInstance.hasFusionCompleted(account1, fusionId)).to.be.true;
    });

    it('allows multiple porble tokens to be burnt by the owner or approved operator', async () => {
        const types = {
            PorbleMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenIds', type: 'uint256[]' },
            ],
        };

        const porbleMintConditions = { minter: testAccountsData[1].address, tokenIds: ['1', '23', '454'] };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: PorbleONFTNativeUpgradeableInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, porbleMintConditions);

        // The tokenId and tx sender must match those that have been signed for
        await PorbleONFTNativeUpgradeableInstance.safeMintTokens(signature, ['1', '23', '454'], { from: testAccountsData[1].address });

        await localExpect(PorbleONFTNativeUpgradeableInstance.burnTokens(['1', '23'], { from: testAccountsData[2].address })).to.eventually.be.rejected;
        await localExpect(PorbleONFTNativeUpgradeableInstance.burnTokens(['1', '23'], { from: testAccountsData[1].address })).to.eventually.be.fulfilled;

        await PorbleONFTNativeUpgradeableInstance.setApprovalForAll(testAccountsData[2].address, true, { from: testAccountsData[1].address });
        await localExpect(PorbleONFTNativeUpgradeableInstance.burnTokens(['454'], { from: testAccountsData[2].address })).to.eventually.be.fulfilled;

        await localExpect(PorbleONFTNativeUpgradeableInstance.ownerOf('1')).to.eventually.be.rejected;
        await localExpect(PorbleONFTNativeUpgradeableInstance.ownerOf('23')).to.eventually.be.rejected;
        await localExpect(PorbleONFTNativeUpgradeableInstance.ownerOf('454')).to.eventually.be.rejected;
    });
});
