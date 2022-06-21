import { deployProxy, upgradeProxy } from '@openzeppelin/truffle-upgrades';
import bigInt from 'big-integer';
import { localExpect } from '../lib/test-libraries';
import { PorbleUpgradeableInstance, MultiSigWalletInstance, PorbleUpgradeableTestInstance } from '../../types/truffle-contracts';
import PORBLE_UPGRADEABLE_JSON from '../../build/contracts/PorbleUpgradeable.json';
import Web3 from 'web3';
import { AbiItem } from 'web3-utils';
import { getTxIdFromMultiSigWallet } from '../lib/test-helpers';

const ethers = require('ethers');
const testAccountsData = require('../../test/data/test-accounts-data').testAccountsData;
const config = require('../../config').config;

const porbleUpgradeable = artifacts.require('PorbleUpgradeable');
const multiSigWallet = artifacts.require('MultiSigWallet');
const porbleUpgradeableTest = artifacts.require('PorbleUpgradeableTest');

const rpcEndpoint = config.AVAX.localSubnetHTTP;
const provider = new ethers.providers.JsonRpcProvider(rpcEndpoint);
const signer = new ethers.Wallet(testAccountsData[1].privateKey, provider);
const PORBLE_UPGRADEABLE_ABI = PORBLE_UPGRADEABLE_JSON.abi as AbiItem[];
const web3 = new Web3(new Web3.providers.HttpProvider(config.AVAX.localSubnetHTTP));

contract.skip('PorbleUpgradeable.sol', ([owner, account1, account2, account3, account4, account5, account6, account7, account8, account9]) => {
    let porbleUpgradeableInstance: PorbleUpgradeableInstance;
    let multiSigWalletInstance: MultiSigWalletInstance;
    let porbleUpgradeableTestInstance: PorbleUpgradeableTestInstance;
    let porbleUpgradeableContract: any;

    beforeEach(async () => {
        // Require 2 signatures for multiSig
        multiSigWalletInstance = await multiSigWallet.new([owner, account1, account2], 2);
        porbleUpgradeableInstance = (await deployProxy(porbleUpgradeable as any, [account1, multiSigWalletInstance.address], {
            initializer: 'initialize',
        })) as PorbleUpgradeableInstance;
        await porbleUpgradeableInstance.transferOwnership(multiSigWalletInstance.address);

        porbleUpgradeableContract = new web3.eth.Contract(PORBLE_UPGRADEABLE_ABI, porbleUpgradeableInstance.address);
    });

    it("has token name set to 'Portal Fantasy Porble'", async () => {
        const tokenName = await porbleUpgradeableInstance.name();
        expect(tokenName).to.equal('Portal Fantasy Porble');
    });

    it("has token symbol set to 'PRBL'", async () => {
        const tokenSymbol = await porbleUpgradeableInstance.symbol();
        expect(tokenSymbol).to.equal('PRBL');
    });

    it('has the contract owner set to the multiSigWallet address', async () => {
        const contractOwner = await porbleUpgradeableInstance.owner();
        expect(contractOwner).to.equal(multiSigWalletInstance.address);
    });

    it('can only be paused/unpaused by the owner (multiSigWallet)', async () => {
        let isPaused = await porbleUpgradeableInstance.paused();
        expect(isPaused).to.be.false;

        // Non-owner account attempting to pause should fail
        await localExpect(porbleUpgradeableInstance.setPaused(true, { from: account1 })).to.be.rejected;

        let data = porbleUpgradeableContract.methods.setPaused(true).encodeABI();
        await multiSigWalletInstance.submitTransaction(porbleUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        isPaused = await porbleUpgradeableInstance.paused();
        expect(isPaused).to.be.true;

        // Non-owner account attempting to unpause should fail
        await localExpect(porbleUpgradeableInstance.setPaused(false, { from: account1 })).to.be.rejected;

        data = porbleUpgradeableContract.methods.setPaused(false).encodeABI();
        await multiSigWalletInstance.submitTransaction(porbleUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        isPaused = await porbleUpgradeableInstance.paused();
        expect(isPaused).to.be.false;
    });

    it('allows a porbleUpgradeable token to be minted if the signature is successfully verified', async () => {
        const types = {
            PorbleMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenId', type: 'uint256' },
            ],
        };

        const porbleUpgradeableMintConditions = { minter: testAccountsData[1].address, tokenId: 1 };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: porbleUpgradeableInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, porbleUpgradeableMintConditions);

        // The tokenId and tx sender must match those that have been signed for
        await localExpect(porbleUpgradeableInstance.safeMint(signature, 1, { from: testAccountsData[1].address })).to.eventually.be.fulfilled;
    });

    it('reverts if the same signature is used multiple times', async () => {
        const types = {
            PorbleMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenId', type: 'uint256' },
            ],
        };

        const porbleUpgradeableMintConditions = { minter: testAccountsData[1].address, tokenId: 1 };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: porbleUpgradeableInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, porbleUpgradeableMintConditions);

        // The tokenId and tx sender must match those that have been signed for
        await localExpect(porbleUpgradeableInstance.safeMint(signature, 1, { from: testAccountsData[1].address })).to.eventually.be.fulfilled;

        await localExpect(porbleUpgradeableInstance.safeMint(signature, 1, { from: testAccountsData[1].address })).to.eventually.be.rejected;
    });

    it("prevents a porbleUpgradeable token from being minted if the 'PorbleMintConditions' key doesn't match the name of the object hard-coded in the contract", async () => {
        const types = {
            PorbleMintConditionsWrong: [
                { name: 'minter', type: 'address' },
                { name: 'tokenId', type: 'uint256' },
            ],
        };

        const porbleUpgradeableMintConditions = { minter: testAccountsData[1].address, tokenId: 2 };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: porbleUpgradeableInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, porbleUpgradeableMintConditions);

        // The tokenId and tx sender must match those that have been signed for
        await localExpect(porbleUpgradeableInstance.safeMint(signature, 2, { from: testAccountsData[1].address })).to.eventually.be.rejected;
    });

    it("prevents a porbleUpgradeable token from being minted if the domain name doesn't match the string passed into the contract's constructor", async () => {
        const types = {
            PorbleMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenId', type: 'uint256' },
            ],
        };

        const porbleUpgradeableMintConditions = { minter: testAccountsData[1].address, tokenId: 2 };

        const domain = {
            name: 'PortalFantasyWrong',
            version: '1',
            chainId: 43214,
            verifyingContract: porbleUpgradeableInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, porbleUpgradeableMintConditions);

        // The tokenId and tx sender must match those that have been signed for
        await localExpect(porbleUpgradeableInstance.safeMint(signature, 2, { from: testAccountsData[1].address })).to.eventually.be.rejected;
    });

    it("prevents a porbleUpgradeable token from being minted if the domain version doesn't match the string passed into the contract's constructor", async () => {
        const types = {
            PorbleMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenId', type: 'uint256' },
            ],
        };

        const porbleUpgradeableMintConditions = { minter: testAccountsData[1].address, tokenId: 2 };

        const domain = {
            name: 'PortalFantasy',
            version: '9',
            chainId: 43214,
            verifyingContract: porbleUpgradeableInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, porbleUpgradeableMintConditions);

        // The tokenId and tx sender must match those that have been signed for
        await localExpect(porbleUpgradeableInstance.safeMint(signature, 2, { from: testAccountsData[1].address })).to.eventually.be.rejected;
    });

    it("prevents a porbleUpgradeable token from being minted if the domain chainId doesn't match the chainId of the chain the contract is deployed to", async () => {
        const types = {
            PorbleMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenId', type: 'uint256' },
            ],
        };

        const porbleUpgradeableMintConditions = { minter: testAccountsData[1].address, tokenId: 2 };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 99999,
            verifyingContract: porbleUpgradeableInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, porbleUpgradeableMintConditions);

        // The tokenId and tx sender must match those that have been signed for
        await localExpect(porbleUpgradeableInstance.safeMint(signature, 2, { from: testAccountsData[1].address })).to.eventually.be.rejected;
    });

    it("prevents a porbleUpgradeable token from being minted if the domain verifyingContract doesn't match the address the contract is deployed to", async () => {
        const types = {
            PorbleMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenId', type: 'uint256' },
            ],
        };

        const porbleUpgradeableMintConditions = { minter: testAccountsData[1].address, tokenId: 2 };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: '0xcccccccccccccccccccccccccccccccccccccccc',
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, porbleUpgradeableMintConditions);

        // The tokenId and tx sender must match those that have been signed for
        await localExpect(porbleUpgradeableInstance.safeMint(signature, 2, { from: testAccountsData[1].address })).to.eventually.be.rejected;
    });

    it("prevents a porbleUpgradeable token from being minted if the signed 'minter' address doesn't match the sender address of the tx", async () => {
        const types = {
            PorbleMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenId', type: 'uint256' },
            ],
        };

        const porbleUpgradeableMintConditions = { minter: testAccountsData[1].address, tokenId: 2 };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: porbleUpgradeableInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, porbleUpgradeableMintConditions);

        // The tokenId and tx sender must match those that have been signed for
        await localExpect(porbleUpgradeableInstance.safeMint(signature, 2, { from: testAccountsData[2].address })).to.eventually.be.rejected;
    });

    it("prevents a porbleUpgradeable token from being minted if the signed tokenId doesn't match the tokenId specified by the caller", async () => {
        const types = {
            PorbleMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenId', type: 'uint256' },
            ],
        };

        const porbleUpgradeableMintConditions = { minter: testAccountsData[1].address, tokenId: 2 };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: porbleUpgradeableInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, porbleUpgradeableMintConditions);

        // The tokenId and tx sender must match those that have been signed for
        await localExpect(porbleUpgradeableInstance.safeMint(signature, 99999, { from: testAccountsData[1].address })).to.eventually.be.rejected;
    });

    it('prevents a porbleUpgradeable token from being minted if the signature is tampered with', async () => {
        const types = {
            PorbleMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenId', type: 'uint256' },
            ],
        };

        const porbleUpgradeableMintConditions = { minter: testAccountsData[1].address, tokenId: 2 };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: porbleUpgradeableInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature: string = await signer._signTypedData(domain, types, porbleUpgradeableMintConditions);

        const signatureArr = signature.split('');
        signatureArr[10] = '7';
        const tamperedSignature = signatureArr.join('');

        // The tokenId and tx sender must match those that have been signed for
        await localExpect(porbleUpgradeableInstance.safeMint(tamperedSignature, 2, { from: testAccountsData[1].address })).to.eventually.be.rejected;
    });

    it('only allows the owner to change the _mintSigner', async () => {
        // Should fail since caller is not the owner
        await localExpect(porbleUpgradeableInstance.setMintSigner(account3, { from: account1 })).to.eventually.be.rejected;

        const data = porbleUpgradeableContract.methods.setMintSigner(account3).encodeABI();
        await multiSigWalletInstance.submitTransaction(porbleUpgradeableInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;
    });

    it("only allows a token to be minted if the signer is updated to match the contract's changed _mintSigner", async () => {
        // Change the mint signer
        const data = porbleUpgradeableContract.methods.setMintSigner(account2).encodeABI();
        await multiSigWalletInstance.submitTransaction(porbleUpgradeableInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        const types = {
            PorbleMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenId', type: 'uint256' },
            ],
        };

        const porbleUpgradeableMintConditions = { minter: testAccountsData[1].address, tokenId: 2 };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: porbleUpgradeableInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, porbleUpgradeableMintConditions);

        // This should fail because the _mintSigner has changed and no longer matches the signer
        await localExpect(porbleUpgradeableInstance.safeMint(signature, 2, { from: testAccountsData[1].address })).to.eventually.be.rejected;

        const newSigner = new ethers.Wallet(testAccountsData[2].privateKey, provider);
        const newsignature = await newSigner._signTypedData(domain, types, porbleUpgradeableMintConditions);

        await localExpect(porbleUpgradeableInstance.safeMint(newsignature, 2, { from: testAccountsData[1].address })).to.eventually.be.fulfilled;
    });

    // @TODO: Update this test when we have the final base URI implemented in the contract
    it('generates a valid token URI', async () => {
        const types = {
            PorbleMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenId', type: 'uint256' },
            ],
        };

        const porbleUpgradeableMintConditions = { minter: testAccountsData[1].address, tokenId: 1 };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: porbleUpgradeableInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature: string = await signer._signTypedData(domain, types, porbleUpgradeableMintConditions);

        await porbleUpgradeableInstance.safeMint(signature, 1, { from: testAccountsData[1].address });

        const tokenURI = await porbleUpgradeableInstance.tokenURI('1');
        expect(tokenURI).to.equal('https://www.portalfantasy.io/1');
    });

    it('allows only the owner to change the base URI', async () => {
        const types = {
            PorbleMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenId', type: 'uint256' },
            ],
        };

        const porbleUpgradeableMintConditions = { minter: testAccountsData[1].address, tokenId: 1 };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: porbleUpgradeableInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature: string = await signer._signTypedData(domain, types, porbleUpgradeableMintConditions);

        await porbleUpgradeableInstance.safeMint(signature, 1, { from: testAccountsData[1].address });

        let tokenURI = await porbleUpgradeableInstance.tokenURI('1');
        expect(tokenURI).to.equal('https://www.portalfantasy.io/1');

        // Expect this to fail, as only the owner can change the base URI
        await localExpect(porbleUpgradeableInstance.setBaseURIString('https://www.foo.com/', { from: account1 })).to.eventually.be.rejected;

        const data = porbleUpgradeableContract.methods.setBaseURIString('https://www.bar.com/').encodeABI();
        await multiSigWalletInstance.submitTransaction(porbleUpgradeableInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        tokenURI = await porbleUpgradeableInstance.tokenURI('1');
        expect(tokenURI).to.equal('https://www.bar.com/1');
    });

    it('allows only the owner (multiSigWallet) to change the contract URI', async () => {
        let contractURI = await porbleUpgradeableInstance.contractURI();
        expect(contractURI).to.equal('https://www.portalfantasy.io/porble/');

        // Expect this to fail, as only the owner can change the base URI
        await localExpect(porbleUpgradeableInstance.setContractURIString('https://www.foo.com/porble/', { from: account1 })).to.eventually.be.rejected;

        const data = porbleUpgradeableContract.methods.setContractURIString('https://www.bar.com/porble/').encodeABI();
        await multiSigWalletInstance.submitTransaction(porbleUpgradeableInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        contractURI = await porbleUpgradeableInstance.contractURI();
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

        const porbleUpgradeableMintConditions = { minter: testAccountsData[1].address, tokenId: 1 };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: porbleUpgradeableInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, porbleUpgradeableMintConditions);

        // The tokenId and tx sender must match those that have been signed for
        await localExpect(porbleUpgradeableInstance.safeMint(signature, 1, { from: testAccountsData[1].address })).to.eventually.be.fulfilled;

        // Assert expected royalty parameters
        let defaultRoyaltyInfo = await porbleUpgradeableInstance.royaltyInfo('1', priceOfPorbleInPORB);
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

        const porbleUpgradeableMintConditions = { minter: testAccountsData[1].address, tokenId: 1 };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: porbleUpgradeableInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, porbleUpgradeableMintConditions);

        // The tokenId and tx sender must match those that have been signed for
        await localExpect(porbleUpgradeableInstance.safeMint(signature, 1, { from: testAccountsData[1].address })).to.eventually.be.fulfilled;

        await localExpect(porbleUpgradeableInstance.setDefaultRoyalty(300, { from: account1 })).to.eventually.be.rejected;

        const updatedRoyaltyFeeBips = 100;
        const data = porbleUpgradeableContract.methods.setDefaultRoyalty(updatedRoyaltyFeeBips).encodeABI();
        await multiSigWalletInstance.submitTransaction(porbleUpgradeableInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        // Assert expected royalty parameters
        let defaultRoyaltyInfo = await porbleUpgradeableInstance.royaltyInfo('0', priceOfPorbleInPORB);
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

        const porbleUpgradeableMintConditions = { minter: testAccountsData[1].address, tokenId: 1 };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: porbleUpgradeableInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, porbleUpgradeableMintConditions);

        // The tokenId and tx sender must match those that have been signed for
        await localExpect(porbleUpgradeableInstance.safeMint(signature, 1, { from: testAccountsData[1].address })).to.eventually.be.fulfilled;

        // Expect this to fail, as only the owner can change the base URI
        await localExpect(porbleUpgradeableInstance.setTokenRoyalty('0', 300, { from: account1 })).to.eventually.be.rejected;

        const updatedRoyaltyFeeBips = 100;
        const data = porbleUpgradeableContract.methods.setTokenRoyalty('0', updatedRoyaltyFeeBips).encodeABI();
        await multiSigWalletInstance.submitTransaction(porbleUpgradeableInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        // Assert expected royalty parameters
        let defaultRoyaltyInfo = await porbleUpgradeableInstance.royaltyInfo('0', priceOfPorbleInPORB);
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

        const porbleUpgradeableMintConditions = { minter: testAccountsData[1].address, tokenId: 1 };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: porbleUpgradeableInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, porbleUpgradeableMintConditions);

        // The tokenId and tx sender must match those that have been signed for
        await localExpect(porbleUpgradeableInstance.safeMint(signature, 1, { from: testAccountsData[1].address })).to.eventually.be.fulfilled;
        // Expect this to fail, as only the owner can change the base URI
        await localExpect(porbleUpgradeableInstance.resetTokenRoyalty('0', { from: account1 })).to.eventually.be.rejected;

        const data = porbleUpgradeableContract.methods.resetTokenRoyalty('0').encodeABI();
        await multiSigWalletInstance.submitTransaction(porbleUpgradeableInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        // Assert expected royalty parameters
        let defaultRoyaltyInfo = await porbleUpgradeableInstance.royaltyInfo('0', priceOfPorbleInPORB);
        const royaltyRecipient = defaultRoyaltyInfo[0];
        const royaltyFee = defaultRoyaltyInfo[1];
        const expectedRoyalFeeNumeratorBips = 400;
        expect(royaltyRecipient).to.equal(multiSigWalletInstance.address);
        expect(royaltyFee.toString()).to.equal(bigInt(priceOfPorbleInPORB).multiply(expectedRoyalFeeNumeratorBips).divide(10000).toString());
    });

    it('can be upgraded and store new state variables from the new contract', async () => {
        const tokenSymbol = await porbleUpgradeableInstance.symbol();
        expect(tokenSymbol).to.equal('PRBL');

        const types = {
            PorbleMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenId', type: 'uint256' },
            ],
        };

        const porbleUpgradeableMintConditions = { minter: testAccountsData[1].address, tokenId: 1 };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: porbleUpgradeableInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, porbleUpgradeableMintConditions);

        // The tokenId and tx sender must match those that have been signed for
        await localExpect(porbleUpgradeableInstance.safeMint(signature, 1, { from: testAccountsData[1].address })).to.eventually.be.fulfilled;

        porbleUpgradeableTestInstance = (await upgradeProxy(porbleUpgradeableInstance.address, porbleUpgradeableTest as any)) as PorbleUpgradeableTestInstance;

        // Original state variables remain unchanged
        const newTokenSymbol = await porbleUpgradeableTestInstance.symbol();
        expect(newTokenSymbol).to.equal('PRBL');
        const ownerOfMintedPorble1 = await porbleUpgradeableTestInstance.ownerOf('1');
        expect(ownerOfMintedPorble1).to.equal(account1);

        // Can still only be paused/unpaused by the owner of the previous contract (multiSigWalleet)
        let data = porbleUpgradeableContract.methods.setPaused(true).encodeABI();
        await multiSigWalletInstance.submitTransaction(porbleUpgradeableTestInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        // Non-existing method cannot be used to set state variable
        data = porbleUpgradeableContract.methods.setBaseURIString('https://www.foo.com/').encodeABI();
        await multiSigWalletInstance.submitTransaction(porbleUpgradeableTestInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;
        const baseURIString = await porbleUpgradeableTestInstance.baseURIString();
        expect(baseURIString).to.not.equal('https://www.foo.com/');
    });
});
