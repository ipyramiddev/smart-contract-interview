import bigInt from 'big-integer';
import { localExpect } from './lib/test-libraries';
import { PorbleInstance, MultiSigWalletInstance } from '../types/truffle-contracts';
import PORBLE_JSON from '../build/contracts/Porble.json';
import Web3 from 'web3';
import { AbiItem } from 'web3-utils';
import { getTxIdFromMultiSigWallet } from './lib/test-helpers';

const ethers = require('ethers');
const testAccountsData = require('../test/data/test-accounts-data').testAccountsData;
const config = require('../config').config;

const porble = artifacts.require('Porble');
const multiSigWallet = artifacts.require('MultiSigWallet');

const rpcEndpoint = config.AVAX.localSubnetHTTP;
const provider = new ethers.providers.JsonRpcProvider(rpcEndpoint);
const signer = new ethers.Wallet(testAccountsData[1].privateKey, provider);
const PORBLE_ABI = PORBLE_JSON.abi as AbiItem[];
const web3 = new Web3(new Web3.providers.HttpProvider(config.AVAX.localSubnetHTTP));

contract('Porble.sol', ([owner, account1, account2, account3, account4, account5, account6, account7, account8, account9]) => {
    let porbleInstance: PorbleInstance;
    let multiSigWalletInstance: MultiSigWalletInstance;
    let porbleContract: any;

    beforeEach(async () => {
        // Require 2 signatures for multiSig
        multiSigWalletInstance = await multiSigWallet.new([owner, account1, account2], 2);
        porbleInstance = await porble.new(account1, multiSigWalletInstance.address);
        await porbleInstance.transferOwnership(multiSigWalletInstance.address);

        porbleContract = new web3.eth.Contract(PORBLE_ABI, porbleInstance.address);
    });

    it("has token name set to 'Portal Fantasy Porble'", async () => {
        const tokenName = await porbleInstance.name();
        expect(tokenName).to.equal('Portal Fantasy Porble');
    });

    it("has token symbol set to 'PRBL'", async () => {
        const tokenSymbol = await porbleInstance.symbol();
        expect(tokenSymbol).to.equal('PRBL');
    });

    it('has the contract owner set to the multiSigWallet address', async () => {
        const contractOwner = await porbleInstance.owner();
        expect(contractOwner).to.equal(multiSigWalletInstance.address);
    });

    it('can only be paused/unpaused by the owner (multiSigWallet)', async () => {
        let isPaused = await porbleInstance.paused();
        expect(isPaused).to.be.false;

        // Non-owner account attempting to pause should fail
        await localExpect(porbleInstance.setPaused(true, { from: account1 })).to.be.rejected;

        let data = porbleContract.methods.setPaused(true).encodeABI();
        await multiSigWalletInstance.submitTransaction(porbleInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        isPaused = await porbleInstance.paused();
        expect(isPaused).to.be.true;

        // Non-owner account attempting to unpause should fail
        await localExpect(porbleInstance.setPaused(false, { from: account1 })).to.be.rejected;

        data = porbleContract.methods.setPaused(false).encodeABI();
        await multiSigWalletInstance.submitTransaction(porbleInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        isPaused = await porbleInstance.paused();
        expect(isPaused).to.be.false;
    });

    it('allows a porble token to be minted if the signature is successfully verified', async () => {
        const types = {
            PorbleMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenId', type: 'uint256' },
            ],
        };

        const porbleMintConditions = { minter: testAccountsData[1].address, tokenId: 1 };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: porbleInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, porbleMintConditions);

        // The tokenId and tx sender must match those that have been signed for
        await localExpect(porbleInstance.safeMint(signature, 1, { from: testAccountsData[1].address })).to.eventually.be.fulfilled;
    });

    it('reverts if the same signature is used multiple times', async () => {
        const types = {
            PorbleMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenId', type: 'uint256' },
            ],
        };

        const porbleMintConditions = { minter: testAccountsData[1].address, tokenId: 1 };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: porbleInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, porbleMintConditions);

        // The tokenId and tx sender must match those that have been signed for
        await localExpect(porbleInstance.safeMint(signature, 1, { from: testAccountsData[1].address })).to.eventually.be.fulfilled;

        await localExpect(porbleInstance.safeMint(signature, 1, { from: testAccountsData[1].address })).to.eventually.be.rejected;
    });

    it("prevents a porble token from being minted if the 'PorbleMintConditions' key doesn't match the name of the object hard-coded in the contract", async () => {
        const types = {
            PorbleMintConditionsWrong: [
                { name: 'minter', type: 'address' },
                { name: 'tokenId', type: 'uint256' },
            ],
        };

        const porbleMintConditions = { minter: testAccountsData[1].address, tokenId: 2 };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: porbleInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, porbleMintConditions);

        // The tokenId and tx sender must match those that have been signed for
        await localExpect(porbleInstance.safeMint(signature, 2, { from: testAccountsData[1].address })).to.eventually.be.rejected;
    });

    it("prevents a porble token from being minted if the domain name doesn't match the string passed into the contract's constructor", async () => {
        const types = {
            PorbleMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenId', type: 'uint256' },
            ],
        };

        const porbleMintConditions = { minter: testAccountsData[1].address, tokenId: 2 };

        const domain = {
            name: 'PortalFantasyWrong',
            version: '1',
            chainId: 43214,
            verifyingContract: porbleInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, porbleMintConditions);

        // The tokenId and tx sender must match those that have been signed for
        await localExpect(porbleInstance.safeMint(signature, 2, { from: testAccountsData[1].address })).to.eventually.be.rejected;
    });

    it("prevents a porble token from being minted if the domain version doesn't match the string passed into the contract's constructor", async () => {
        const types = {
            PorbleMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenId', type: 'uint256' },
            ],
        };

        const porbleMintConditions = { minter: testAccountsData[1].address, tokenId: 2 };

        const domain = {
            name: 'PortalFantasy',
            version: '9',
            chainId: 43214,
            verifyingContract: porbleInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, porbleMintConditions);

        // The tokenId and tx sender must match those that have been signed for
        await localExpect(porbleInstance.safeMint(signature, 2, { from: testAccountsData[1].address })).to.eventually.be.rejected;
    });

    it("prevents a porble token from being minted if the domain chainId doesn't match the chainId of the chain the contract is deployed to", async () => {
        const types = {
            PorbleMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenId', type: 'uint256' },
            ],
        };

        const porbleMintConditions = { minter: testAccountsData[1].address, tokenId: 2 };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 99999,
            verifyingContract: porbleInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, porbleMintConditions);

        // The tokenId and tx sender must match those that have been signed for
        await localExpect(porbleInstance.safeMint(signature, 2, { from: testAccountsData[1].address })).to.eventually.be.rejected;
    });

    it("prevents a porble token from being minted if the domain verifyingContract doesn't match the address the contract is deployed to", async () => {
        const types = {
            PorbleMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenId', type: 'uint256' },
            ],
        };

        const porbleMintConditions = { minter: testAccountsData[1].address, tokenId: 2 };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: '0xcccccccccccccccccccccccccccccccccccccccc',
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, porbleMintConditions);

        // The tokenId and tx sender must match those that have been signed for
        await localExpect(porbleInstance.safeMint(signature, 2, { from: testAccountsData[1].address })).to.eventually.be.rejected;
    });

    it("prevents a porble token from being minted if the signed 'minter' address doesn't match the sender address of the tx", async () => {
        const types = {
            PorbleMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenId', type: 'uint256' },
            ],
        };

        const porbleMintConditions = { minter: testAccountsData[1].address, tokenId: 2 };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: porbleInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, porbleMintConditions);

        // The tokenId and tx sender must match those that have been signed for
        await localExpect(porbleInstance.safeMint(signature, 2, { from: testAccountsData[2].address })).to.eventually.be.rejected;
    });

    it("prevents a porble token from being minted if the signed tokenId doesn't match the tokenId specified by the caller", async () => {
        const types = {
            PorbleMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenId', type: 'uint256' },
            ],
        };

        const porbleMintConditions = { minter: testAccountsData[1].address, tokenId: 2 };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: porbleInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, porbleMintConditions);

        // The tokenId and tx sender must match those that have been signed for
        await localExpect(porbleInstance.safeMint(signature, 99999, { from: testAccountsData[1].address })).to.eventually.be.rejected;
    });

    it('prevents a porble token from being minted if the signature is tampered with', async () => {
        const types = {
            PorbleMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenId', type: 'uint256' },
            ],
        };

        const porbleMintConditions = { minter: testAccountsData[1].address, tokenId: 2 };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: porbleInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature: string = await signer._signTypedData(domain, types, porbleMintConditions);

        const signatureArr = signature.split('');
        signatureArr[10] = '7';
        const tamperedSignature = signatureArr.join('');

        // The tokenId and tx sender must match those that have been signed for
        await localExpect(porbleInstance.safeMint(tamperedSignature, 2, { from: testAccountsData[1].address })).to.eventually.be.rejected;
    });

    it('only allows the owner to change the _mintSigner', async () => {
        // Should fail since caller is not the owner
        await localExpect(porbleInstance.setMintSigner(account3, { from: account1 })).to.eventually.be.rejected;

        const data = porbleContract.methods.setMintSigner(account3).encodeABI();
        await multiSigWalletInstance.submitTransaction(porbleInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;
    });

    it("only allows a token to be minted if the signer is updated to match the contract's changed _mintSigner", async () => {
        // Change the mint signer
        const data = porbleContract.methods.setMintSigner(account2).encodeABI();
        await multiSigWalletInstance.submitTransaction(porbleInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        const types = {
            PorbleMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenId', type: 'uint256' },
            ],
        };

        const porbleMintConditions = { minter: testAccountsData[1].address, tokenId: 2 };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: porbleInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, porbleMintConditions);

        // This should fail because the _mintSigner has changed and no longer matches the signer
        await localExpect(porbleInstance.safeMint(signature, 2, { from: testAccountsData[1].address })).to.eventually.be.rejected;

        const newSigner = new ethers.Wallet(testAccountsData[2].privateKey, provider);
        const newsignature = await newSigner._signTypedData(domain, types, porbleMintConditions);

        await localExpect(porbleInstance.safeMint(newsignature, 2, { from: testAccountsData[1].address })).to.eventually.be.fulfilled;
    });

    // @TODO: Update this test when we have the final base URI implemented in the contract
    it('generates a valid token URI', async () => {
        const types = {
            PorbleMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenId', type: 'uint256' },
            ],
        };

        const porbleMintConditions = { minter: testAccountsData[1].address, tokenId: 1 };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: porbleInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature: string = await signer._signTypedData(domain, types, porbleMintConditions);

        await porbleInstance.safeMint(signature, 1, { from: testAccountsData[1].address });

        const tokenURI = await porbleInstance.tokenURI('1');
        expect(tokenURI).to.equal('https://www.portalfantasy.io/1');
    });

    it('allows only the owner to change the base URI', async () => {
        const types = {
            PorbleMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenId', type: 'uint256' },
            ],
        };

        const porbleMintConditions = { minter: testAccountsData[1].address, tokenId: 1 };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: porbleInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature: string = await signer._signTypedData(domain, types, porbleMintConditions);

        await porbleInstance.safeMint(signature, 1, { from: testAccountsData[1].address });

        let tokenURI = await porbleInstance.tokenURI('1');
        expect(tokenURI).to.equal('https://www.portalfantasy.io/1');

        // Expect this to fail, as only the owner can change the base URI
        await localExpect(porbleInstance.setBaseURIString('https://www.foo.com/', { from: account1 })).to.eventually.be.rejected;

        const data = porbleContract.methods.setBaseURIString('https://www.bar.com/').encodeABI();
        await multiSigWalletInstance.submitTransaction(porbleInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        tokenURI = await porbleInstance.tokenURI('1');
        expect(tokenURI).to.equal('https://www.bar.com/1');
    });

    it('allows only the owner (multiSigWallet) to change the contract URI', async () => {
        let contractURI = await porbleInstance.contractURI();
        expect(contractURI).to.equal('https://www.portalfantasy.io/porble/');

        // Expect this to fail, as only the owner can change the base URI
        await localExpect(porbleInstance.setContractURIString('https://www.foo.com/porble/', { from: account1 })).to.eventually.be.rejected;

        const data = porbleContract.methods.setContractURIString('https://www.bar.com/porble/').encodeABI();
        await multiSigWalletInstance.submitTransaction(porbleInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        contractURI = await porbleInstance.contractURI();
        expect(contractURI).to.equal('https://www.bar.com/porble/');
    });

    it('applies the default royalty correctly', async () => {
        const priceOfPorbleInPORB = web3.utils.toWei('2', 'ether');

        const types = {
            PorbleMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenId', type: 'uint256' },
            ],
        };

        const porbleMintConditions = { minter: testAccountsData[1].address, tokenId: 1 };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: porbleInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, porbleMintConditions);

        // The tokenId and tx sender must match those that have been signed for
        await localExpect(porbleInstance.safeMint(signature, 1, { from: testAccountsData[1].address })).to.eventually.be.fulfilled;

        // Assert expected royalty parameters
        let defaultRoyaltyInfo = await porbleInstance.royaltyInfo('1', priceOfPorbleInPORB);
        const royaltyRecipient = defaultRoyaltyInfo[0];
        const royaltyFee = defaultRoyaltyInfo[1];
        const expectedRoyalFeeNumeratorBips = 400;
        expect(royaltyRecipient).to.equal(multiSigWalletInstance.address);
        expect(royaltyFee.toString()).to.equal(bigInt(priceOfPorbleInPORB).multiply(expectedRoyalFeeNumeratorBips).divide(10000).toString());
    });

    it('allows only the owner to change the default royalty fee', async () => {
        const priceOfPorbleInPORB = web3.utils.toWei('2', 'ether');

        const types = {
            PorbleMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenId', type: 'uint256' },
            ],
        };

        const porbleMintConditions = { minter: testAccountsData[1].address, tokenId: 1 };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: porbleInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, porbleMintConditions);

        // The tokenId and tx sender must match those that have been signed for
        await localExpect(porbleInstance.safeMint(signature, 1, { from: testAccountsData[1].address })).to.eventually.be.fulfilled;

        await localExpect(porbleInstance.setDefaultRoyalty(300, { from: account1 })).to.eventually.be.rejected;

        const updatedRoyaltyFeeBips = 100;
        const data = porbleContract.methods.setDefaultRoyalty(updatedRoyaltyFeeBips).encodeABI();
        await multiSigWalletInstance.submitTransaction(porbleInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        // Assert expected royalty parameters
        let defaultRoyaltyInfo = await porbleInstance.royaltyInfo('0', priceOfPorbleInPORB);
        const royaltyRecipient = defaultRoyaltyInfo[0];
        const royaltyFee = defaultRoyaltyInfo[1];
        expect(royaltyRecipient).to.equal(multiSigWalletInstance.address);
        expect(royaltyFee.toString()).to.equal(bigInt(priceOfPorbleInPORB).multiply(updatedRoyaltyFeeBips).divide(10000).toString());
    });

    it('allows only the owner to change the token custom royalty fee', async () => {
        const priceOfPorbleInPORB = web3.utils.toWei('2', 'ether');

        const types = {
            PorbleMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenId', type: 'uint256' },
            ],
        };

        const porbleMintConditions = { minter: testAccountsData[1].address, tokenId: 1 };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: porbleInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, porbleMintConditions);

        // The tokenId and tx sender must match those that have been signed for
        await localExpect(porbleInstance.safeMint(signature, 1, { from: testAccountsData[1].address })).to.eventually.be.fulfilled;

        // Expect this to fail, as only the owner can change the base URI
        await localExpect(porbleInstance.setTokenRoyalty('0', 300, { from: account1 })).to.eventually.be.rejected;

        const updatedRoyaltyFeeBips = 100;
        const data = porbleContract.methods.setTokenRoyalty('0', updatedRoyaltyFeeBips).encodeABI();
        await multiSigWalletInstance.submitTransaction(porbleInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        // Assert expected royalty parameters
        let defaultRoyaltyInfo = await porbleInstance.royaltyInfo('0', priceOfPorbleInPORB);
        const royaltyRecipient = defaultRoyaltyInfo[0];
        const royaltyFee = defaultRoyaltyInfo[1];
        expect(royaltyRecipient).to.equal(multiSigWalletInstance.address);
        expect(royaltyFee.toString()).to.equal(bigInt(priceOfPorbleInPORB).multiply(updatedRoyaltyFeeBips).divide(10000).toString());
    });

    it('allows only the owner to reset the custom royalty fee', async () => {
        const priceOfPorbleInPORB = web3.utils.toWei('2', 'ether');

        const types = {
            PorbleMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenId', type: 'uint256' },
            ],
        };

        const porbleMintConditions = { minter: testAccountsData[1].address, tokenId: 1 };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: porbleInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, porbleMintConditions);

        // The tokenId and tx sender must match those that have been signed for
        await localExpect(porbleInstance.safeMint(signature, 1, { from: testAccountsData[1].address })).to.eventually.be.fulfilled;
        // Expect this to fail, as only the owner can change the base URI
        await localExpect(porbleInstance.resetTokenRoyalty('0', { from: account1 })).to.eventually.be.rejected;

        const data = porbleContract.methods.resetTokenRoyalty('0').encodeABI();
        await multiSigWalletInstance.submitTransaction(porbleInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        // Assert expected royalty parameters
        let defaultRoyaltyInfo = await porbleInstance.royaltyInfo('0', priceOfPorbleInPORB);
        const royaltyRecipient = defaultRoyaltyInfo[0];
        const royaltyFee = defaultRoyaltyInfo[1];
        const expectedRoyalFeeNumeratorBips = 400;
        expect(royaltyRecipient).to.equal(multiSigWalletInstance.address);
        expect(royaltyFee.toString()).to.equal(bigInt(priceOfPorbleInPORB).multiply(expectedRoyalFeeNumeratorBips).divide(10000).toString());
    });
});
