import { deployProxy, upgradeProxy } from '@openzeppelin/truffle-upgrades';
import bigInt from 'big-integer';
import { localExpect } from '../lib/test-libraries';
import { ArchitectONFTNativeUpgradeableInstance, USDPUpgradeableInstance, MultiSigWalletInstance, ArchitectONFTNativeUpgradeableTestInstance } from '../../types/truffle-contracts';
import ARCHITECT_UPGRADEABLE_JSON from '../../build/contracts/ArchitectONFTNativeUpgradeable.json';
import USDP_UPGRADEABLE_JSON from '../../build/contracts/USDPUpgradeable.json';
import Web3 from 'web3';
import { AbiItem } from 'web3-utils';
import { getTxIdFromMultiSigWallet } from '../lib/test-helpers';

const ethers = require('ethers');
const config = require('../../config').config;
const testAccountsData = require('../../test/data/test-accounts-data').testAccountsData;

const ArchitectONFTNativeUpgradeable = artifacts.require('ArchitectONFTNativeUpgradeable');
const USDPUpgradeable = artifacts.require('USDPUpgradeable');
const multiSigWallet = artifacts.require('MultiSigWallet');
const ArchitectONFTNativeUpgradeableTest = artifacts.require('ArchitectONFTNativeUpgradeableTest');

const web3 = new Web3(new Web3.providers.HttpProvider(config.AVAX.localSubnetHTTP));
const ARCHITECT_UPGRADEABLE_ABI = ARCHITECT_UPGRADEABLE_JSON.abi as AbiItem[];
const USDP_UPGRADEABLE_ABI = USDP_UPGRADEABLE_JSON.abi as AbiItem[];

const rpcEndpoint = config.AVAX.localSubnetHTTP;
const provider = new ethers.providers.JsonRpcProvider(rpcEndpoint);
const signer = new ethers.Wallet(testAccountsData[1].privateKey, provider);

const MOCK_LZ_ENDPOINT_PF_CHAIN = testAccountsData[5].address;

contract.skip('ArchitectONFTNativeUpgradeable.sol', ([owner, account1, account2, account3, account4, account5, account6, account7, account8, account9]) => {
    let ArchitectONFTNativeUpgradeableInstance: ArchitectONFTNativeUpgradeableInstance;
    let USDPUpgradeableInstance: USDPUpgradeableInstance;
    let multiSigWalletInstance: MultiSigWalletInstance;
    let ArchitectONFTNativeUpgradeableTestInstance: ArchitectONFTNativeUpgradeableTestInstance;
    let ArchitectONFTNativeUpgradeableContract: any;
    let USDPUpgradeableContract: any;

    beforeEach(async () => {
        // Require 2 signatures for multiSig
        multiSigWalletInstance = await multiSigWallet.new([owner, account1, account2], 2);
        USDPUpgradeableInstance = (await deployProxy(USDPUpgradeable as any, [], {
            initializer: 'initialize',
        })) as USDPUpgradeableInstance;
        ArchitectONFTNativeUpgradeableInstance = (await deployProxy(
            ArchitectONFTNativeUpgradeable as any,
            [account1, USDPUpgradeableInstance.address, account9, MOCK_LZ_ENDPOINT_PF_CHAIN],
            {
                initializer: 'initialize',
            }
        )) as ArchitectONFTNativeUpgradeableInstance;
        await USDPUpgradeableInstance.transferOwnership(multiSigWalletInstance.address);
        await ArchitectONFTNativeUpgradeableInstance.transferOwnership(multiSigWalletInstance.address);

        ArchitectONFTNativeUpgradeableContract = new web3.eth.Contract(ARCHITECT_UPGRADEABLE_ABI, ArchitectONFTNativeUpgradeableInstance.address);
        USDPUpgradeableContract = new web3.eth.Contract(USDP_UPGRADEABLE_ABI, USDPUpgradeableInstance.address);
    });

    it("has token name set to 'Portal Fantasy Architect'", async () => {
        const tokenName = await ArchitectONFTNativeUpgradeableInstance.name();
        expect(tokenName).to.equal('Portal Fantasy Architect');
    });

    it("has token symbol set to 'PHAR'", async () => {
        const tokenSymbol = await ArchitectONFTNativeUpgradeableInstance.symbol();
        expect(tokenSymbol).to.equal('PHAR');
    });

    it('allows an architect token to be minted if the signature is successfully verified. With payment in USDP', async () => {
        const types = {
            ArchitectMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenIds', type: 'uint256[]' },
                { name: 'tokenPrices', type: 'uint256[]' },
            ],
        };

        const tokenIds = ['1'];
        const tokenPrices = [web3.utils.toWei('1', 'ether')];
        const architectMintConditions = { minter: testAccountsData[1].address, tokenIds, tokenPrices };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: ArchitectONFTNativeUpgradeableInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, architectMintConditions);

        const initialUSDPAmountMintedToBuyer = web3.utils.toWei('1000000000', 'ether');

        // Add controller for USDP
        let data = USDPUpgradeableContract.methods.addController(multiSigWalletInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Mint USDP
        data = USDPUpgradeableContract.methods.mint(account1, initialUSDPAmountMintedToBuyer).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        const USDPAmountToApprove = tokenPrices.reduce((acc, tokenPrice) => bigInt(acc).add(tokenPrice).toString());
        await USDPUpgradeableInstance.approve(ArchitectONFTNativeUpgradeableInstance.address, USDPAmountToApprove, { from: account1 });

        // The tokenId and tx sender must match those that have been signed for
        await localExpect(ArchitectONFTNativeUpgradeableInstance.safeMintTokens(signature, ['1'], tokenPrices, { from: testAccountsData[1].address })).to.eventually.be.fulfilled;
        expect(await ArchitectONFTNativeUpgradeableInstance.ownerOf('1')).to.equal(testAccountsData[1].address);

        const balanceOfUSDPVault = (await USDPUpgradeableInstance.balanceOf(account9)).toString();
        expect(balanceOfUSDPVault).to.equal(USDPAmountToApprove);
    });

    it('allows multiple architect tokens to be minted at different prices, if the signature is successfully verified. With payment in USDP', async () => {
        const types = {
            ArchitectMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenIds', type: 'uint256[]' },
                { name: 'tokenPrices', type: 'uint256[]' },
            ],
        };

        const tokenIds = ['1', '100', '1234'];
        const tokenPrices = [web3.utils.toWei('1', 'ether'), web3.utils.toWei('2', 'ether'), web3.utils.toWei('3', 'ether')];
        const architectMintConditions = { minter: testAccountsData[1].address, tokenIds, tokenPrices };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: ArchitectONFTNativeUpgradeableInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, architectMintConditions);

        const initialUSDPAmountMintedToBuyer = web3.utils.toWei('1000000000', 'ether');

        // Add controller for USDP
        let data = USDPUpgradeableContract.methods.addController(multiSigWalletInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Mint USDP
        data = USDPUpgradeableContract.methods.mint(account1, initialUSDPAmountMintedToBuyer).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        const USDPAmountToApprove = tokenPrices.reduce((acc, tokenPrice) => bigInt(acc).add(tokenPrice).toString());
        await USDPUpgradeableInstance.approve(ArchitectONFTNativeUpgradeableInstance.address, USDPAmountToApprove, { from: account1 });

        // The tokenId and tx sender must match those that have been signed for
        await localExpect(ArchitectONFTNativeUpgradeableInstance.safeMintTokens(signature, tokenIds, tokenPrices, { from: testAccountsData[1].address })).to.eventually.be
            .fulfilled;
        expect(await ArchitectONFTNativeUpgradeableInstance.ownerOf('1')).to.equal(testAccountsData[1].address);
        expect(await ArchitectONFTNativeUpgradeableInstance.ownerOf('100')).to.equal(testAccountsData[1].address);
        expect(await ArchitectONFTNativeUpgradeableInstance.ownerOf('1234')).to.equal(testAccountsData[1].address);

        const balanceOfUSDPVault = (await USDPUpgradeableInstance.balanceOf(account9)).toString();
        expect(balanceOfUSDPVault).to.equal(USDPAmountToApprove);
    });

    it('only allows the owner (multiSigWallet) to change the USDP contract address', async () => {
        const newUSDPUpgradeableInstance = (await deployProxy(USDPUpgradeable as any, [], {
            initializer: 'initialize',
        })) as USDPUpgradeableInstance;

        // Should fail since caller is not the owner
        await localExpect(ArchitectONFTNativeUpgradeableInstance.setTokenToPay(newUSDPUpgradeableInstance.address, { from: account1 })).to.eventually.be.rejected;

        const data = ArchitectONFTNativeUpgradeableContract.methods.setTokenToPay(newUSDPUpgradeableInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(ArchitectONFTNativeUpgradeableInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        const contractUSDPAddress = (await ArchitectONFTNativeUpgradeableInstance.tokenToPay()).toString();
        expect(contractUSDPAddress).to.equal(newUSDPUpgradeableInstance.address);
    });

    // @TODO: Update this test when we have the final base URI implemented in the contract
    it('generates a valid token URI', async () => {
        const types = {
            ArchitectMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenIds', type: 'uint256[]' },
                { name: 'tokenPrices', type: 'uint256[]' },
            ],
        };

        const tokenIds = ['1'];
        const priceOfArchitectInUSDP = web3.utils.toWei('1', 'ether');
        const tokenPrices = [priceOfArchitectInUSDP];
        const architectMintConditions = { minter: testAccountsData[1].address, tokenIds, tokenPrices };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: ArchitectONFTNativeUpgradeableInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, architectMintConditions);

        const initialUSDPAmountMintedToOwner = web3.utils.toWei('1000000000', 'ether');

        // Add controller for USDP
        let data = USDPUpgradeableContract.methods.addController(multiSigWalletInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Mint USDP
        data = USDPUpgradeableContract.methods.mint(account1, initialUSDPAmountMintedToOwner).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        await USDPUpgradeableInstance.approve(ArchitectONFTNativeUpgradeableInstance.address, priceOfArchitectInUSDP, { from: account1 });
        await ArchitectONFTNativeUpgradeableInstance.safeMintTokens(signature, tokenIds, tokenPrices, { from: account1 });

        const tokenURI = await ArchitectONFTNativeUpgradeableInstance.tokenURI('1');
        expect(tokenURI).to.equal('https://www.portalfantasy.io/1');
    });

    it('allows only the owner (multiSigWallet) to change the base URI', async () => {
        const types = {
            ArchitectMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenIds', type: 'uint256[]' },
                { name: 'tokenPrices', type: 'uint256[]' },
            ],
        };

        const tokenIds = ['1'];
        const tokenPrices = [web3.utils.toWei('1', 'ether')];
        const architectMintConditions = { minter: testAccountsData[1].address, tokenIds, tokenPrices };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: ArchitectONFTNativeUpgradeableInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, architectMintConditions);

        const initialUSDPAmountMintedToOwner = web3.utils.toWei('1000000000', 'ether');

        // Add controller for USDP
        let data = USDPUpgradeableContract.methods.addController(multiSigWalletInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Mint USDP
        data = USDPUpgradeableContract.methods.mint(account1, initialUSDPAmountMintedToOwner).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        const USDPAmountToApprove = tokenPrices.reduce((acc, tokenPrice) => bigInt(acc).add(tokenPrice).toString());
        await USDPUpgradeableInstance.approve(ArchitectONFTNativeUpgradeableInstance.address, USDPAmountToApprove, { from: account1 });
        await ArchitectONFTNativeUpgradeableInstance.safeMintTokens(signature, tokenIds, tokenPrices, { from: account1 });

        let tokenURI = await ArchitectONFTNativeUpgradeableInstance.tokenURI('1');
        expect(tokenURI).to.equal('https://www.portalfantasy.io/1');

        // Expect this to fail, as only the owner can change the base URI
        await localExpect(ArchitectONFTNativeUpgradeableInstance.setBaseURIString('https://www.foo.com/', { from: account1 })).to.eventually.be.rejected;

        data = ArchitectONFTNativeUpgradeableContract.methods.setBaseURIString('https://www.bar.com/').encodeABI();
        await multiSigWalletInstance.submitTransaction(ArchitectONFTNativeUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        tokenURI = await ArchitectONFTNativeUpgradeableInstance.tokenURI('1');
        expect(tokenURI).to.equal('https://www.bar.com/1');
    });

    it('allows only the owner (multiSigWallet) to change the contract URI', async () => {
        let contractURI = await ArchitectONFTNativeUpgradeableInstance.contractURI();
        expect(contractURI).to.equal('https://www.portalfantasy.io/architect/');

        // Expect this to fail, as only the owner can change the base URI
        await localExpect(ArchitectONFTNativeUpgradeableInstance.setContractURIString('https://www.foo.com/architect/', { from: account1 })).to.eventually.be.rejected;

        const data = ArchitectONFTNativeUpgradeableContract.methods.setContractURIString('https://www.bar.com/architect/').encodeABI();
        await multiSigWalletInstance.submitTransaction(ArchitectONFTNativeUpgradeableInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        contractURI = await ArchitectONFTNativeUpgradeableInstance.contractURI();
        expect(contractURI).to.equal('https://www.bar.com/architect/');
    });

    it('applies the default royalty correctly', async () => {
        const types = {
            ArchitectMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenIds', type: 'uint256[]' },
                { name: 'tokenPrices', type: 'uint256[]' },
            ],
        };

        const tokenIds = ['1'];
        const priceOfArchitectInUSDP = web3.utils.toWei('1', 'ether');
        const tokenPrices = [priceOfArchitectInUSDP];
        const architectMintConditions = { minter: testAccountsData[1].address, tokenIds, tokenPrices };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: ArchitectONFTNativeUpgradeableInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, architectMintConditions);

        const initialUSDPAmountMintedToOwner = web3.utils.toWei('1000000000', 'ether');

        // Add controller for USDP
        let data = USDPUpgradeableContract.methods.addController(multiSigWalletInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Mint USDP
        data = USDPUpgradeableContract.methods.mint(account1, initialUSDPAmountMintedToOwner).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        const USDPAmountToApprove = tokenPrices.reduce((acc, tokenPrice) => bigInt(acc).add(tokenPrice).toString());
        await USDPUpgradeableInstance.approve(ArchitectONFTNativeUpgradeableInstance.address, USDPAmountToApprove, { from: account1 });
        await ArchitectONFTNativeUpgradeableInstance.safeMintTokens(signature, tokenIds, tokenPrices, { from: account1 });

        // Assert expected royalty parameters
        let defaultRoyaltyInfo = await ArchitectONFTNativeUpgradeableInstance.royaltyInfo('0', priceOfArchitectInUSDP);
        const royaltyRecipient = defaultRoyaltyInfo[0];
        const royaltyFee = defaultRoyaltyInfo[1];
        const expectedRoyalFeeNumeratorBips = 400;
        expect(royaltyRecipient).to.equal(account9);
        expect(royaltyFee.toString()).to.equal(bigInt(priceOfArchitectInUSDP).multiply(expectedRoyalFeeNumeratorBips).divide(10000).toString());
    });

    it('allows only the owner to change the default royalty fee', async () => {
        const types = {
            ArchitectMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenIds', type: 'uint256[]' },
                { name: 'tokenPrices', type: 'uint256[]' },
            ],
        };

        const tokenIds = ['1'];
        const priceOfArchitectInUSDP = web3.utils.toWei('1', 'ether');
        const tokenPrices = [priceOfArchitectInUSDP];
        const architectMintConditions = { minter: testAccountsData[1].address, tokenIds, tokenPrices };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: ArchitectONFTNativeUpgradeableInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, architectMintConditions);

        const initialUSDPAmountMintedToOwner = web3.utils.toWei('1000000000', 'ether');

        // Add controller for USDP
        let data = USDPUpgradeableContract.methods.addController(multiSigWalletInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Mint USDP
        data = USDPUpgradeableContract.methods.mint(account1, initialUSDPAmountMintedToOwner).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        const USDPAmountToApprove = tokenPrices.reduce((acc, tokenPrice) => bigInt(acc).add(tokenPrice).toString());
        await USDPUpgradeableInstance.approve(ArchitectONFTNativeUpgradeableInstance.address, USDPAmountToApprove, { from: account1 });
        await ArchitectONFTNativeUpgradeableInstance.safeMintTokens(signature, tokenIds, tokenPrices, { from: account1 });

        // Expect this to fail, as only the owner can change the base URI
        await localExpect(ArchitectONFTNativeUpgradeableInstance.setDefaultRoyalty(300, { from: account1 })).to.eventually.be.rejected;

        const updatedRoyaltyFeeBips = 100;
        data = ArchitectONFTNativeUpgradeableContract.methods.setDefaultRoyalty(updatedRoyaltyFeeBips).encodeABI();
        await multiSigWalletInstance.submitTransaction(ArchitectONFTNativeUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        // Assert expected royalty parameters
        let defaultRoyaltyInfo = await ArchitectONFTNativeUpgradeableInstance.royaltyInfo('0', priceOfArchitectInUSDP);
        const royaltyRecipient = defaultRoyaltyInfo[0];
        const royaltyFee = defaultRoyaltyInfo[1];
        expect(royaltyRecipient).to.equal(account9);
        expect(royaltyFee.toString()).to.equal(bigInt(priceOfArchitectInUSDP).multiply(updatedRoyaltyFeeBips).divide(10000).toString());
    });

    it('reverts if the same signature is used multiple times', async () => {
        const types = {
            ArchitectMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenIds', type: 'uint256[]' },
                { name: 'tokenPrices', type: 'uint256[]' },
            ],
        };

        const tokenIds = ['1'];
        const priceOfArchitectInUSDP = web3.utils.toWei('1', 'ether');
        const tokenPrices = [priceOfArchitectInUSDP];
        const architectMintConditions = { minter: testAccountsData[1].address, tokenIds, tokenPrices };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: ArchitectONFTNativeUpgradeableInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, architectMintConditions);

        // Add controller for USDP
        let data = USDPUpgradeableContract.methods.addController(multiSigWalletInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Mint enough USDP to potentially buy two architects
        data = USDPUpgradeableContract.methods.mint(account1, bigInt(priceOfArchitectInUSDP).multiply(2).toString()).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        const USDPAmountToApprove = tokenPrices.reduce((acc, tokenPrice) => bigInt(acc).add(tokenPrice).toString());
        await USDPUpgradeableInstance.approve(ArchitectONFTNativeUpgradeableInstance.address, USDPAmountToApprove, { from: account1 });

        // The tokenId and tx sender must match those that have been signed for
        await localExpect(ArchitectONFTNativeUpgradeableInstance.safeMintTokens(signature, tokenIds, tokenPrices, { from: testAccountsData[1].address })).to.eventually.be
            .fulfilled;

        await localExpect(ArchitectONFTNativeUpgradeableInstance.safeMintTokens(signature, tokenIds, tokenPrices, { from: testAccountsData[1].address })).to.eventually.be.rejected;
    });

    it("prevents an architect token from being minted if the 'ArchitectMintConditions' key doesn't match the name of the object hard-coded in the contract", async () => {
        const types = {
            ArchitectMintConditionsWrong: [
                { name: 'minter', type: 'address' },
                { name: 'tokenIds', type: 'uint256[]' },
                { name: 'tokenPrices', type: 'uint256[]' },
            ],
        };

        const tokenIds = ['2'];
        const priceOfArchitectInUSDP = web3.utils.toWei('1', 'ether');
        const tokenPrices = [priceOfArchitectInUSDP];
        const architectMintConditions = { minter: testAccountsData[1].address, tokenIds, tokenPrices };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: ArchitectONFTNativeUpgradeableInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, architectMintConditions);

        // Add controller for USDP
        let data = USDPUpgradeableContract.methods.addController(multiSigWalletInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Mint enough USDP to buy an architect
        data = USDPUpgradeableContract.methods.mint(account1, priceOfArchitectInUSDP).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        const USDPAmountToApprove = tokenPrices.reduce((acc, tokenPrice) => bigInt(acc).add(tokenPrice).toString());
        await USDPUpgradeableInstance.approve(ArchitectONFTNativeUpgradeableInstance.address, USDPAmountToApprove, { from: account1 });

        // The tokenId and tx sender must match those that have been signed for
        await localExpect(ArchitectONFTNativeUpgradeableInstance.safeMintTokens(signature, tokenIds, tokenPrices, { from: testAccountsData[1].address })).to.eventually.be.rejected;
    });

    it("prevents an architect token from being minted if the domain name doesn't match the string passed into the contract's constructor", async () => {
        const types = {
            ArchitectMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenIds', type: 'uint256[]' },
                { name: 'tokenPrices', type: 'uint256[]' },
            ],
        };

        const tokenIds = ['2'];
        const priceOfArchitectInUSDP = web3.utils.toWei('1', 'ether');
        const tokenPrices = [priceOfArchitectInUSDP];
        const architectMintConditions = { minter: testAccountsData[1].address, tokenIds, tokenPrices };

        const domain = {
            name: 'PortalFantasyWrong',
            version: '1',
            chainId: 43214,
            verifyingContract: ArchitectONFTNativeUpgradeableInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, architectMintConditions);

        // Add controller for USDP
        let data = USDPUpgradeableContract.methods.addController(multiSigWalletInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Mint enough USDP to buy an architect
        data = USDPUpgradeableContract.methods.mint(account1, priceOfArchitectInUSDP).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        const USDPAmountToApprove = tokenPrices.reduce((acc, tokenPrice) => bigInt(acc).add(tokenPrice).toString());
        await USDPUpgradeableInstance.approve(ArchitectONFTNativeUpgradeableInstance.address, USDPAmountToApprove, { from: account1 });

        // The tokenId and tx sender must match those that have been signed for
        await localExpect(ArchitectONFTNativeUpgradeableInstance.safeMintTokens(signature, tokenIds, tokenPrices, { from: testAccountsData[1].address })).to.eventually.be.rejected;
    });

    it("prevents an architect token from being minted if the domain version doesn't match the string passed into the contract's constructor", async () => {
        const types = {
            ArchitectMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenIds', type: 'uint256[]' },
                { name: 'tokenPrices', type: 'uint256[]' },
            ],
        };

        const tokenIds = ['2'];
        const priceOfArchitectInUSDP = web3.utils.toWei('1', 'ether');
        const tokenPrices = [priceOfArchitectInUSDP];
        const architectMintConditions = { minter: testAccountsData[1].address, tokenIds, tokenPrices };

        const domain = {
            name: 'PortalFantasy',
            version: '9',
            chainId: 43214,
            verifyingContract: ArchitectONFTNativeUpgradeableInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, architectMintConditions);

        // Add controller for USDP
        let data = USDPUpgradeableContract.methods.addController(multiSigWalletInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Mint enough USDP to buy an architect
        data = USDPUpgradeableContract.methods.mint(account1, priceOfArchitectInUSDP).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        const USDPAmountToApprove = tokenPrices.reduce((acc, tokenPrice) => bigInt(acc).add(tokenPrice).toString());
        await USDPUpgradeableInstance.approve(ArchitectONFTNativeUpgradeableInstance.address, USDPAmountToApprove, { from: account1 });

        // The tokenId and tx sender must match those that have been signed for
        await localExpect(ArchitectONFTNativeUpgradeableInstance.safeMintTokens(signature, tokenIds, tokenPrices, { from: testAccountsData[1].address })).to.eventually.be.rejected;
    });

    it("prevents an architect token from being minted if the domain chainId doesn't match the chainId of the chain the contract is deployed to", async () => {
        const types = {
            ArchitectMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenIds', type: 'uint256[]' },
                { name: 'tokenPrices', type: 'uint256[]' },
            ],
        };

        const tokenIds = ['2'];
        const priceOfArchitectInUSDP = web3.utils.toWei('1', 'ether');
        const tokenPrices = [priceOfArchitectInUSDP];
        const architectMintConditions = { minter: testAccountsData[1].address, tokenIds, tokenPrices };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 99999,
            verifyingContract: ArchitectONFTNativeUpgradeableInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, architectMintConditions);

        // Add controller for USDP
        let data = USDPUpgradeableContract.methods.addController(multiSigWalletInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Mint enough USDP to buy an architect
        data = USDPUpgradeableContract.methods.mint(account1, priceOfArchitectInUSDP).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        const USDPAmountToApprove = tokenPrices.reduce((acc, tokenPrice) => bigInt(acc).add(tokenPrice).toString());
        await USDPUpgradeableInstance.approve(ArchitectONFTNativeUpgradeableInstance.address, USDPAmountToApprove, { from: account1 });

        // The tokenId and tx sender must match those that have been signed for
        await localExpect(ArchitectONFTNativeUpgradeableInstance.safeMintTokens(signature, tokenIds, tokenPrices, { from: testAccountsData[1].address })).to.eventually.be.rejected;
    });

    it("prevents an architect token from being minted if the domain verifyingContract doesn't match the address the contract is deployed to", async () => {
        const types = {
            ArchitectMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenIds', type: 'uint256[]' },
                { name: 'tokenPrices', type: 'uint256[]' },
            ],
        };

        const tokenIds = ['2'];
        const priceOfArchitectInUSDP = web3.utils.toWei('1', 'ether');
        const tokenPrices = [priceOfArchitectInUSDP];
        const architectMintConditions = { minter: testAccountsData[1].address, tokenIds, tokenPrices };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: '0xcccccccccccccccccccccccccccccccccccccccc',
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, architectMintConditions);

        // Add controller for USDP
        let data = USDPUpgradeableContract.methods.addController(multiSigWalletInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Mint enough USDP to buy an architect
        data = USDPUpgradeableContract.methods.mint(account1, priceOfArchitectInUSDP).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        const USDPAmountToApprove = tokenPrices.reduce((acc, tokenPrice) => bigInt(acc).add(tokenPrice).toString());
        await USDPUpgradeableInstance.approve(ArchitectONFTNativeUpgradeableInstance.address, USDPAmountToApprove, { from: account1 });

        // The tokenId and tx sender must match those that have been signed for
        await localExpect(ArchitectONFTNativeUpgradeableInstance.safeMintTokens(signature, tokenIds, tokenPrices, { from: testAccountsData[1].address })).to.eventually.be.rejected;
    });

    it("prevents an architect token from being minted if the signed 'minter' address doesn't match the sender address of the tx", async () => {
        const types = {
            ArchitectMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenIds', type: 'uint256[]' },
                { name: 'tokenPrices', type: 'uint256[]' },
            ],
        };

        const tokenIds = ['2'];
        const priceOfArchitectInUSDP = web3.utils.toWei('1', 'ether');
        const tokenPrices = [priceOfArchitectInUSDP];
        const architectMintConditions = { minter: testAccountsData[1].address, tokenIds, tokenPrices };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: ArchitectONFTNativeUpgradeableInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, architectMintConditions);

        // Add controller for USDP
        let data = USDPUpgradeableContract.methods.addController(multiSigWalletInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Mint enough USDP to buy an architect
        data = USDPUpgradeableContract.methods.mint(account1, priceOfArchitectInUSDP).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        const USDPAmountToApprove = tokenPrices.reduce((acc, tokenPrice) => bigInt(acc).add(tokenPrice).toString());
        await USDPUpgradeableInstance.approve(ArchitectONFTNativeUpgradeableInstance.address, USDPAmountToApprove, { from: account1 });

        // The tokenId and tx sender must match those that have been signed for
        await localExpect(ArchitectONFTNativeUpgradeableInstance.safeMintTokens(signature, tokenIds, tokenPrices, { from: testAccountsData[2].address })).to.eventually.be.rejected;
    });

    it("prevents an architect token from being minted if the signed tokenId doesn't match the tokenId specified by the caller", async () => {
        const types = {
            ArchitectMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenIds', type: 'uint256[]' },
                { name: 'tokenPrices', type: 'uint256[]' },
            ],
        };

        const tokenIds = ['99999'];
        const priceOfArchitectInUSDP = web3.utils.toWei('1', 'ether');
        const tokenPrices = [priceOfArchitectInUSDP];
        const architectMintConditions = { minter: testAccountsData[1].address, tokenIds, tokenPrices };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: ArchitectONFTNativeUpgradeableInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, architectMintConditions);

        // Add controller for USDP
        let data = USDPUpgradeableContract.methods.addController(multiSigWalletInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Mint enough USDP to buy an architect
        data = USDPUpgradeableContract.methods.mint(account1, priceOfArchitectInUSDP).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        const USDPAmountToApprove = tokenPrices.reduce((acc, tokenPrice) => bigInt(acc).add(tokenPrice).toString());
        await USDPUpgradeableInstance.approve(ArchitectONFTNativeUpgradeableInstance.address, USDPAmountToApprove, { from: account1 });

        // The tokenId and tx sender must match those that have been signed for
        await localExpect(ArchitectONFTNativeUpgradeableInstance.safeMintTokens(signature, ['1'], tokenPrices, { from: testAccountsData[1].address })).to.eventually.be.rejected;
    });

    it('prevents an architect token from being minted if the signature is tampered with', async () => {
        const types = {
            ArchitectMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenIds', type: 'uint256[]' },
                { name: 'tokenPrices', type: 'uint256[]' },
            ],
        };

        const tokenIds = ['2'];
        const priceOfArchitectInUSDP = web3.utils.toWei('1', 'ether');
        const tokenPrices = [priceOfArchitectInUSDP];
        const architectMintConditions = { minter: testAccountsData[1].address, tokenIds, tokenPrices };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: ArchitectONFTNativeUpgradeableInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature: string = await signer._signTypedData(domain, types, architectMintConditions);

        // Add controller for USDP
        let data = USDPUpgradeableContract.methods.addController(multiSigWalletInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Mint enough USDP to buy an architect
        data = USDPUpgradeableContract.methods.mint(account1, priceOfArchitectInUSDP).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        const USDPAmountToApprove = tokenPrices.reduce((acc, tokenPrice) => bigInt(acc).add(tokenPrice).toString());
        await USDPUpgradeableInstance.approve(ArchitectONFTNativeUpgradeableInstance.address, USDPAmountToApprove, { from: account1 });

        const signatureArr = signature.split('');
        signatureArr[10] = '7';
        const tamperedSignature = signatureArr.join('');

        // The tokenId and tx sender must match those that have been signed for
        await localExpect(ArchitectONFTNativeUpgradeableInstance.safeMintTokens(tamperedSignature, tokenIds, tokenPrices, { from: testAccountsData[1].address })).to.eventually.be
            .rejected;
    });

    it('only allows the owner (multiSigWallet) to change the USDP vault', async () => {
        // Should fail since caller is not the owner
        await localExpect(ArchitectONFTNativeUpgradeableInstance.setVault(account2, { from: account1 })).to.eventually.be.rejected;

        const data = ArchitectONFTNativeUpgradeableContract.methods.setVault(account2).encodeABI();
        await multiSigWalletInstance.submitTransaction(ArchitectONFTNativeUpgradeableInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        const contractUSDPVault = (await ArchitectONFTNativeUpgradeableInstance.vault()).toString();
        expect(contractUSDPVault).to.equal(account2);
    });

    it('can be upgraded and store new state variables from the new contract', async () => {
        const tokenSymbol = await ArchitectONFTNativeUpgradeableInstance.symbol();
        expect(tokenSymbol).to.equal('PHAR');

        const types = {
            ArchitectMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenIds', type: 'uint256[]' },
                { name: 'tokenPrices', type: 'uint256[]' },
            ],
        };

        let tokenIds = ['1'];
        const priceOfArchitectInUSDP = web3.utils.toWei('1', 'ether');
        const tokenPrices = [priceOfArchitectInUSDP];
        let architectMintConditions = { minter: testAccountsData[1].address, tokenIds, tokenPrices };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: ArchitectONFTNativeUpgradeableInstance.address,
        };

        // Sign according to the EIP-712 standard
        let signature = await signer._signTypedData(domain, types, architectMintConditions);

        const initialUSDPAmountMintedToOwner = web3.utils.toWei('1000000000', 'ether');

        // Add controller for USDP
        let data = USDPUpgradeableContract.methods.addController(multiSigWalletInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Mint USDP
        data = USDPUpgradeableContract.methods.mint(account1, initialUSDPAmountMintedToOwner).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        let USDPAmountToApprove = tokenPrices.reduce((acc, tokenPrice) => bigInt(acc).add(tokenPrice).toString());
        await USDPUpgradeableInstance.approve(ArchitectONFTNativeUpgradeableInstance.address, USDPAmountToApprove, { from: account1 });
        await ArchitectONFTNativeUpgradeableInstance.safeMintTokens(signature, tokenIds, tokenPrices, { from: account1 });

        ArchitectONFTNativeUpgradeableTestInstance = (await upgradeProxy(
            ArchitectONFTNativeUpgradeableInstance.address,
            ArchitectONFTNativeUpgradeableTest as any
        )) as ArchitectONFTNativeUpgradeableTestInstance;

        // Original state variables remain unchanged
        const newTokenSymbol = await ArchitectONFTNativeUpgradeableTestInstance.symbol();
        expect(newTokenSymbol).to.equal('PHAR');
        const ownerOfMintedArchitect1 = await ArchitectONFTNativeUpgradeableTestInstance.ownerOf('1');
        expect(ownerOfMintedArchitect1).to.equal(account1);

        tokenIds = ['2'];
        architectMintConditions = { minter: testAccountsData[2].address, tokenIds, tokenPrices };

        // Sign according to the EIP-712 standard
        signature = await signer._signTypedData(domain, types, architectMintConditions);

        // Mint USDP
        data = USDPUpgradeableContract.methods.mint(account2, initialUSDPAmountMintedToOwner).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        USDPAmountToApprove = tokenPrices.reduce((acc, tokenPrice) => bigInt(acc).add(tokenPrice).toString());
        await USDPUpgradeableInstance.approve(ArchitectONFTNativeUpgradeableInstance.address, USDPAmountToApprove, { from: account2 });
        await ArchitectONFTNativeUpgradeableInstance.safeMintTokens(signature, tokenIds, tokenPrices, { from: account2 });

        // Can still mint new tokens
        const ownerOfMintedArchitect2 = await ArchitectONFTNativeUpgradeableTestInstance.ownerOf('2');
        expect(ownerOfMintedArchitect2).to.equal(account2);

        // Contract URI can still only be set by the owner of the previous contract (multiSigWallet)
        data = ArchitectONFTNativeUpgradeableContract.methods.setContractURIString('testingContractURIString').encodeABI();
        await multiSigWalletInstance.submitTransaction(ArchitectONFTNativeUpgradeableTestInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });
        expect((await ArchitectONFTNativeUpgradeableTestInstance.contractURI()).toString()).to.equal('testingContractURIString');

        // Non-existing method cannot be used to set state variable
        data = ArchitectONFTNativeUpgradeableContract.methods.setBaseURIString('https://www.foo.com/').encodeABI();
        await multiSigWalletInstance.submitTransaction(ArchitectONFTNativeUpgradeableTestInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;
        const baseURIString = await ArchitectONFTNativeUpgradeableTestInstance.baseURIString();
        expect(baseURIString).to.not.equal('https://www.foo.com/');
    });
});
