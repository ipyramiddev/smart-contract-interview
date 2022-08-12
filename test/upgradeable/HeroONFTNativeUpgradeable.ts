import { deployProxy, upgradeProxy } from '@openzeppelin/truffle-upgrades';
import bigInt from 'big-integer';
import { localExpect } from '../lib/test-libraries';
import { HeroONFTNativeUpgradeableInstance, USDPUpgradeableInstance, MultiSigWalletInstance, HeroONFTNativeUpgradeableTestInstance } from '../../types/truffle-contracts';
import HERO_UPGRADEABLE_JSON from '../../build/contracts/HeroONFTNativeUpgradeable.json';
import USDP_UPGRADEABLE_JSON from '../../build/contracts/USDPUpgradeable.json';
import Web3 from 'web3';
import { AbiItem } from 'web3-utils';
import { getTxIdFromMultiSigWallet } from '../lib/test-helpers';

const ethers = require('ethers');
const config = require('../../config').config;
const testAccountsData = require('../../test/data/test-accounts-data').testAccountsData;

const HeroONFTNativeUpgradeable = artifacts.require('HeroONFTNativeUpgradeable');
const USDPUpgradeable = artifacts.require('USDPUpgradeable');
const multiSigWallet = artifacts.require('MultiSigWallet');
const HeroONFTNativeUpgradeableTest = artifacts.require('HeroONFTNativeUpgradeableTest');

const web3 = new Web3(new Web3.providers.HttpProvider(config.AVAX.localSubnetHTTP));
const HERO_UPGRADEABLE_ABI = HERO_UPGRADEABLE_JSON.abi as AbiItem[];
const USDP_UPGRADEABLE_ABI = USDP_UPGRADEABLE_JSON.abi as AbiItem[];

const rpcEndpoint = config.AVAX.localSubnetHTTP;
const provider = new ethers.providers.JsonRpcProvider(rpcEndpoint);
const signer = new ethers.Wallet(testAccountsData[1].privateKey, provider);

const MOCK_LZ_ENDPOINT_PF_CHAIN = testAccountsData[5].address;

contract.skip('HeroONFTNativeUpgradeable.sol', ([owner, account1, account2, account3, account4, account5, account6, account7, account8, account9]) => {
    let HeroONFTNativeUpgradeableInstance: HeroONFTNativeUpgradeableInstance;
    let USDPUpgradeableInstance: USDPUpgradeableInstance;
    let multiSigWalletInstance: MultiSigWalletInstance;
    let HeroONFTNativeUpgradeableTestInstance: HeroONFTNativeUpgradeableTestInstance;
    let HeroONFTNativeUpgradeableContract: any;
    let USDPUpgradeableContract: any;

    beforeEach(async () => {
        // Require 2 signatures for multiSig
        multiSigWalletInstance = await multiSigWallet.new([owner, account1, account2], 2);
        USDPUpgradeableInstance = (await deployProxy(USDPUpgradeable as any, [], {
            initializer: 'initialize',
        })) as USDPUpgradeableInstance;
        HeroONFTNativeUpgradeableInstance = (await deployProxy(HeroONFTNativeUpgradeable as any, [account1, USDPUpgradeableInstance.address, account9, MOCK_LZ_ENDPOINT_PF_CHAIN], {
            initializer: 'initialize',
        })) as HeroONFTNativeUpgradeableInstance;
        await USDPUpgradeableInstance.transferOwnership(multiSigWalletInstance.address);
        await HeroONFTNativeUpgradeableInstance.transferOwnership(multiSigWalletInstance.address);

        HeroONFTNativeUpgradeableContract = new web3.eth.Contract(HERO_UPGRADEABLE_ABI, HeroONFTNativeUpgradeableInstance.address);
        USDPUpgradeableContract = new web3.eth.Contract(USDP_UPGRADEABLE_ABI, USDPUpgradeableInstance.address);
    });

    it("has token name set to 'Portal Fantasy Hero'", async () => {
        const tokenName = await HeroONFTNativeUpgradeableInstance.name();
        expect(tokenName).to.equal('Portal Fantasy Hero');
    });

    it("has token symbol set to 'PHRO'", async () => {
        const tokenSymbol = await HeroONFTNativeUpgradeableInstance.symbol();
        expect(tokenSymbol).to.equal('PHRO');
    });

    it('allows an hero token to be minted if the signature is successfully verified. With payment in USDP', async () => {
        const types = {
            HeroMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenIds', type: 'uint256[]' },
                { name: 'tokenPrices', type: 'uint256[]' },
            ],
        };

        const tokenIds = ['1'];
        const tokenPrices = [web3.utils.toWei('1', 'ether')];
        const heroMintConditions = { minter: testAccountsData[1].address, tokenIds, tokenPrices };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: HeroONFTNativeUpgradeableInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, heroMintConditions);

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
        await USDPUpgradeableInstance.approve(HeroONFTNativeUpgradeableInstance.address, USDPAmountToApprove, { from: account1 });

        // The tokenId and tx sender must match those that have been signed for
        await localExpect(HeroONFTNativeUpgradeableInstance.safeMintTokens(signature, ['1'], tokenPrices, { from: testAccountsData[1].address })).to.eventually.be.fulfilled;
        expect(await HeroONFTNativeUpgradeableInstance.ownerOf('1')).to.equal(testAccountsData[1].address);

        const balanceOfUSDPVault = (await USDPUpgradeableInstance.balanceOf(account9)).toString();
        expect(balanceOfUSDPVault).to.equal(USDPAmountToApprove);
    });

    it('allows multiple hero tokens to be minted at different prices, if the signature is successfully verified. With payment in USDP', async () => {
        const types = {
            HeroMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenIds', type: 'uint256[]' },
                { name: 'tokenPrices', type: 'uint256[]' },
            ],
        };

        const tokenIds = ['1', '100', '1234'];
        const tokenPrices = [web3.utils.toWei('1', 'ether'), web3.utils.toWei('2', 'ether'), web3.utils.toWei('3', 'ether')];
        const heroMintConditions = { minter: testAccountsData[1].address, tokenIds, tokenPrices };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: HeroONFTNativeUpgradeableInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, heroMintConditions);

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
        await USDPUpgradeableInstance.approve(HeroONFTNativeUpgradeableInstance.address, USDPAmountToApprove, { from: account1 });

        // The tokenId and tx sender must match those that have been signed for
        await localExpect(HeroONFTNativeUpgradeableInstance.safeMintTokens(signature, tokenIds, tokenPrices, { from: testAccountsData[1].address })).to.eventually.be.fulfilled;
        expect(await HeroONFTNativeUpgradeableInstance.ownerOf('1')).to.equal(testAccountsData[1].address);
        expect(await HeroONFTNativeUpgradeableInstance.ownerOf('100')).to.equal(testAccountsData[1].address);
        expect(await HeroONFTNativeUpgradeableInstance.ownerOf('1234')).to.equal(testAccountsData[1].address);

        const balanceOfUSDPVault = (await USDPUpgradeableInstance.balanceOf(account9)).toString();
        expect(balanceOfUSDPVault).to.equal(USDPAmountToApprove);
    });

    it('only allows the owner (multiSigWallet) to change the USDP contract address', async () => {
        const newUSDPUpgradeableInstance = (await deployProxy(USDPUpgradeable as any, [], {
            initializer: 'initialize',
        })) as USDPUpgradeableInstance;

        // Should fail since caller is not the owner
        await localExpect(HeroONFTNativeUpgradeableInstance.setUSDP(newUSDPUpgradeableInstance.address, { from: account1 })).to.eventually.be.rejected;

        const data = HeroONFTNativeUpgradeableContract.methods.setUSDP(newUSDPUpgradeableInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(HeroONFTNativeUpgradeableInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        const contractUSDPAddress = (await HeroONFTNativeUpgradeableInstance.USDP()).toString();
        expect(contractUSDPAddress).to.equal(newUSDPUpgradeableInstance.address);
    });

    // @TODO: Update this test when we have the final base URI implemented in the contract
    it('generates a valid token URI', async () => {
        const types = {
            HeroMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenIds', type: 'uint256[]' },
                { name: 'tokenPrices', type: 'uint256[]' },
            ],
        };

        const tokenIds = ['1'];
        const priceOfHeroInUSDP = web3.utils.toWei('1', 'ether');
        const tokenPrices = [priceOfHeroInUSDP];
        const heroMintConditions = { minter: testAccountsData[1].address, tokenIds, tokenPrices };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: HeroONFTNativeUpgradeableInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, heroMintConditions);

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

        await USDPUpgradeableInstance.approve(HeroONFTNativeUpgradeableInstance.address, priceOfHeroInUSDP, { from: account1 });
        await HeroONFTNativeUpgradeableInstance.safeMintTokens(signature, tokenIds, tokenPrices, { from: account1 });

        const tokenURI = await HeroONFTNativeUpgradeableInstance.tokenURI('1');
        expect(tokenURI).to.equal('https://www.portalfantasy.io/1');
    });

    it('allows only the owner (multiSigWallet) to change the base URI', async () => {
        const types = {
            HeroMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenIds', type: 'uint256[]' },
                { name: 'tokenPrices', type: 'uint256[]' },
            ],
        };

        const tokenIds = ['1'];
        const tokenPrices = [web3.utils.toWei('1', 'ether')];
        const heroMintConditions = { minter: testAccountsData[1].address, tokenIds, tokenPrices };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: HeroONFTNativeUpgradeableInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, heroMintConditions);

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
        await USDPUpgradeableInstance.approve(HeroONFTNativeUpgradeableInstance.address, USDPAmountToApprove, { from: account1 });
        await HeroONFTNativeUpgradeableInstance.safeMintTokens(signature, tokenIds, tokenPrices, { from: account1 });

        let tokenURI = await HeroONFTNativeUpgradeableInstance.tokenURI('1');
        expect(tokenURI).to.equal('https://www.portalfantasy.io/1');

        // Expect this to fail, as only the owner can change the base URI
        await localExpect(HeroONFTNativeUpgradeableInstance.setBaseURIString('https://www.foo.com/', { from: account1 })).to.eventually.be.rejected;

        data = HeroONFTNativeUpgradeableContract.methods.setBaseURIString('https://www.bar.com/').encodeABI();
        await multiSigWalletInstance.submitTransaction(HeroONFTNativeUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        tokenURI = await HeroONFTNativeUpgradeableInstance.tokenURI('1');
        expect(tokenURI).to.equal('https://www.bar.com/1');
    });

    it('allows only the owner (multiSigWallet) to change the contract URI', async () => {
        let contractURI = await HeroONFTNativeUpgradeableInstance.contractURI();
        expect(contractURI).to.equal('https://www.portalfantasy.io/hero/');

        // Expect this to fail, as only the owner can change the base URI
        await localExpect(HeroONFTNativeUpgradeableInstance.setContractURIString('https://www.foo.com/hero/', { from: account1 })).to.eventually.be.rejected;

        const data = HeroONFTNativeUpgradeableContract.methods.setContractURIString('https://www.bar.com/hero/').encodeABI();
        await multiSigWalletInstance.submitTransaction(HeroONFTNativeUpgradeableInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        contractURI = await HeroONFTNativeUpgradeableInstance.contractURI();
        expect(contractURI).to.equal('https://www.bar.com/hero/');
    });

    it('applies the default royalty correctly', async () => {
        const types = {
            HeroMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenIds', type: 'uint256[]' },
                { name: 'tokenPrices', type: 'uint256[]' },
            ],
        };

        const tokenIds = ['1'];
        const priceOfHeroInUSDP = web3.utils.toWei('1', 'ether');
        const tokenPrices = [priceOfHeroInUSDP];
        const heroMintConditions = { minter: testAccountsData[1].address, tokenIds, tokenPrices };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: HeroONFTNativeUpgradeableInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, heroMintConditions);

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
        await USDPUpgradeableInstance.approve(HeroONFTNativeUpgradeableInstance.address, USDPAmountToApprove, { from: account1 });
        await HeroONFTNativeUpgradeableInstance.safeMintTokens(signature, tokenIds, tokenPrices, { from: account1 });

        // Assert expected royalty parameters
        let defaultRoyaltyInfo = await HeroONFTNativeUpgradeableInstance.royaltyInfo('0', priceOfHeroInUSDP);
        const royaltyRecipient = defaultRoyaltyInfo[0];
        const royaltyFee = defaultRoyaltyInfo[1];
        const expectedRoyalFeeNumeratorBips = 400;
        expect(royaltyRecipient).to.equal(account9);
        expect(royaltyFee.toString()).to.equal(bigInt(priceOfHeroInUSDP).multiply(expectedRoyalFeeNumeratorBips).divide(10000).toString());
    });

    it('allows only the owner to change the default royalty fee', async () => {
        const types = {
            HeroMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenIds', type: 'uint256[]' },
                { name: 'tokenPrices', type: 'uint256[]' },
            ],
        };

        const tokenIds = ['1'];
        const priceOfHeroInUSDP = web3.utils.toWei('1', 'ether');
        const tokenPrices = [priceOfHeroInUSDP];
        const heroMintConditions = { minter: testAccountsData[1].address, tokenIds, tokenPrices };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: HeroONFTNativeUpgradeableInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, heroMintConditions);

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
        await USDPUpgradeableInstance.approve(HeroONFTNativeUpgradeableInstance.address, USDPAmountToApprove, { from: account1 });
        await HeroONFTNativeUpgradeableInstance.safeMintTokens(signature, tokenIds, tokenPrices, { from: account1 });

        // Expect this to fail, as only the owner can change the base URI
        await localExpect(HeroONFTNativeUpgradeableInstance.setDefaultRoyalty(300, { from: account1 })).to.eventually.be.rejected;

        const updatedRoyaltyFeeBips = 100;
        data = HeroONFTNativeUpgradeableContract.methods.setDefaultRoyalty(updatedRoyaltyFeeBips).encodeABI();
        await multiSigWalletInstance.submitTransaction(HeroONFTNativeUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        // Assert expected royalty parameters
        let defaultRoyaltyInfo = await HeroONFTNativeUpgradeableInstance.royaltyInfo('0', priceOfHeroInUSDP);
        const royaltyRecipient = defaultRoyaltyInfo[0];
        const royaltyFee = defaultRoyaltyInfo[1];
        expect(royaltyRecipient).to.equal(account9);
        expect(royaltyFee.toString()).to.equal(bigInt(priceOfHeroInUSDP).multiply(updatedRoyaltyFeeBips).divide(10000).toString());
    });

    it('reverts if the same signature is used multiple times', async () => {
        const types = {
            HeroMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenIds', type: 'uint256[]' },
                { name: 'tokenPrices', type: 'uint256[]' },
            ],
        };

        const tokenIds = ['1'];
        const priceOfHeroInUSDP = web3.utils.toWei('1', 'ether');
        const tokenPrices = [priceOfHeroInUSDP];
        const heroMintConditions = { minter: testAccountsData[1].address, tokenIds, tokenPrices };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: HeroONFTNativeUpgradeableInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, heroMintConditions);

        // Add controller for USDP
        let data = USDPUpgradeableContract.methods.addController(multiSigWalletInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Mint enough USDP to potentially buy two heros
        data = USDPUpgradeableContract.methods.mint(account1, bigInt(priceOfHeroInUSDP).multiply(2).toString()).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        const USDPAmountToApprove = tokenPrices.reduce((acc, tokenPrice) => bigInt(acc).add(tokenPrice).toString());
        await USDPUpgradeableInstance.approve(HeroONFTNativeUpgradeableInstance.address, USDPAmountToApprove, { from: account1 });

        // The tokenId and tx sender must match those that have been signed for
        await localExpect(HeroONFTNativeUpgradeableInstance.safeMintTokens(signature, tokenIds, tokenPrices, { from: testAccountsData[1].address })).to.eventually.be.fulfilled;

        await localExpect(HeroONFTNativeUpgradeableInstance.safeMintTokens(signature, tokenIds, tokenPrices, { from: testAccountsData[1].address })).to.eventually.be.rejected;
    });

    it("prevents an hero token from being minted if the 'HeroMintConditions' key doesn't match the name of the object hard-coded in the contract", async () => {
        const types = {
            HeroMintConditionsWrong: [
                { name: 'minter', type: 'address' },
                { name: 'tokenIds', type: 'uint256[]' },
                { name: 'tokenPrices', type: 'uint256[]' },
            ],
        };

        const tokenIds = ['2'];
        const priceOfHeroInUSDP = web3.utils.toWei('1', 'ether');
        const tokenPrices = [priceOfHeroInUSDP];
        const heroMintConditions = { minter: testAccountsData[1].address, tokenIds, tokenPrices };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: HeroONFTNativeUpgradeableInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, heroMintConditions);

        // Add controller for USDP
        let data = USDPUpgradeableContract.methods.addController(multiSigWalletInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Mint enough USDP to buy an hero
        data = USDPUpgradeableContract.methods.mint(account1, priceOfHeroInUSDP).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        const USDPAmountToApprove = tokenPrices.reduce((acc, tokenPrice) => bigInt(acc).add(tokenPrice).toString());
        await USDPUpgradeableInstance.approve(HeroONFTNativeUpgradeableInstance.address, USDPAmountToApprove, { from: account1 });

        // The tokenId and tx sender must match those that have been signed for
        await localExpect(HeroONFTNativeUpgradeableInstance.safeMintTokens(signature, tokenIds, tokenPrices, { from: testAccountsData[1].address })).to.eventually.be.rejected;
    });

    it("prevents an hero token from being minted if the domain name doesn't match the string passed into the contract's constructor", async () => {
        const types = {
            HeroMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenIds', type: 'uint256[]' },
                { name: 'tokenPrices', type: 'uint256[]' },
            ],
        };

        const tokenIds = ['2'];
        const priceOfHeroInUSDP = web3.utils.toWei('1', 'ether');
        const tokenPrices = [priceOfHeroInUSDP];
        const heroMintConditions = { minter: testAccountsData[1].address, tokenIds, tokenPrices };

        const domain = {
            name: 'PortalFantasyWrong',
            version: '1',
            chainId: 43214,
            verifyingContract: HeroONFTNativeUpgradeableInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, heroMintConditions);

        // Add controller for USDP
        let data = USDPUpgradeableContract.methods.addController(multiSigWalletInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Mint enough USDP to buy an hero
        data = USDPUpgradeableContract.methods.mint(account1, priceOfHeroInUSDP).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        const USDPAmountToApprove = tokenPrices.reduce((acc, tokenPrice) => bigInt(acc).add(tokenPrice).toString());
        await USDPUpgradeableInstance.approve(HeroONFTNativeUpgradeableInstance.address, USDPAmountToApprove, { from: account1 });

        // The tokenId and tx sender must match those that have been signed for
        await localExpect(HeroONFTNativeUpgradeableInstance.safeMintTokens(signature, tokenIds, tokenPrices, { from: testAccountsData[1].address })).to.eventually.be.rejected;
    });

    it("prevents an hero token from being minted if the domain version doesn't match the string passed into the contract's constructor", async () => {
        const types = {
            HeroMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenIds', type: 'uint256[]' },
                { name: 'tokenPrices', type: 'uint256[]' },
            ],
        };

        const tokenIds = ['2'];
        const priceOfHeroInUSDP = web3.utils.toWei('1', 'ether');
        const tokenPrices = [priceOfHeroInUSDP];
        const heroMintConditions = { minter: testAccountsData[1].address, tokenIds, tokenPrices };

        const domain = {
            name: 'PortalFantasy',
            version: '9',
            chainId: 43214,
            verifyingContract: HeroONFTNativeUpgradeableInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, heroMintConditions);

        // Add controller for USDP
        let data = USDPUpgradeableContract.methods.addController(multiSigWalletInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Mint enough USDP to buy an hero
        data = USDPUpgradeableContract.methods.mint(account1, priceOfHeroInUSDP).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        const USDPAmountToApprove = tokenPrices.reduce((acc, tokenPrice) => bigInt(acc).add(tokenPrice).toString());
        await USDPUpgradeableInstance.approve(HeroONFTNativeUpgradeableInstance.address, USDPAmountToApprove, { from: account1 });

        // The tokenId and tx sender must match those that have been signed for
        await localExpect(HeroONFTNativeUpgradeableInstance.safeMintTokens(signature, tokenIds, tokenPrices, { from: testAccountsData[1].address })).to.eventually.be.rejected;
    });

    it("prevents an hero token from being minted if the domain chainId doesn't match the chainId of the chain the contract is deployed to", async () => {
        const types = {
            HeroMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenIds', type: 'uint256[]' },
                { name: 'tokenPrices', type: 'uint256[]' },
            ],
        };

        const tokenIds = ['2'];
        const priceOfHeroInUSDP = web3.utils.toWei('1', 'ether');
        const tokenPrices = [priceOfHeroInUSDP];
        const heroMintConditions = { minter: testAccountsData[1].address, tokenIds, tokenPrices };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 99999,
            verifyingContract: HeroONFTNativeUpgradeableInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, heroMintConditions);

        // Add controller for USDP
        let data = USDPUpgradeableContract.methods.addController(multiSigWalletInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Mint enough USDP to buy an hero
        data = USDPUpgradeableContract.methods.mint(account1, priceOfHeroInUSDP).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        const USDPAmountToApprove = tokenPrices.reduce((acc, tokenPrice) => bigInt(acc).add(tokenPrice).toString());
        await USDPUpgradeableInstance.approve(HeroONFTNativeUpgradeableInstance.address, USDPAmountToApprove, { from: account1 });

        // The tokenId and tx sender must match those that have been signed for
        await localExpect(HeroONFTNativeUpgradeableInstance.safeMintTokens(signature, tokenIds, tokenPrices, { from: testAccountsData[1].address })).to.eventually.be.rejected;
    });

    it("prevents an hero token from being minted if the domain verifyingContract doesn't match the address the contract is deployed to", async () => {
        const types = {
            HeroMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenIds', type: 'uint256[]' },
                { name: 'tokenPrices', type: 'uint256[]' },
            ],
        };

        const tokenIds = ['2'];
        const priceOfHeroInUSDP = web3.utils.toWei('1', 'ether');
        const tokenPrices = [priceOfHeroInUSDP];
        const heroMintConditions = { minter: testAccountsData[1].address, tokenIds, tokenPrices };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: '0xcccccccccccccccccccccccccccccccccccccccc',
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, heroMintConditions);

        // Add controller for USDP
        let data = USDPUpgradeableContract.methods.addController(multiSigWalletInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Mint enough USDP to buy an hero
        data = USDPUpgradeableContract.methods.mint(account1, priceOfHeroInUSDP).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        const USDPAmountToApprove = tokenPrices.reduce((acc, tokenPrice) => bigInt(acc).add(tokenPrice).toString());
        await USDPUpgradeableInstance.approve(HeroONFTNativeUpgradeableInstance.address, USDPAmountToApprove, { from: account1 });

        // The tokenId and tx sender must match those that have been signed for
        await localExpect(HeroONFTNativeUpgradeableInstance.safeMintTokens(signature, tokenIds, tokenPrices, { from: testAccountsData[1].address })).to.eventually.be.rejected;
    });

    it("prevents an hero token from being minted if the signed 'minter' address doesn't match the sender address of the tx", async () => {
        const types = {
            HeroMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenIds', type: 'uint256[]' },
                { name: 'tokenPrices', type: 'uint256[]' },
            ],
        };

        const tokenIds = ['2'];
        const priceOfHeroInUSDP = web3.utils.toWei('1', 'ether');
        const tokenPrices = [priceOfHeroInUSDP];
        const heroMintConditions = { minter: testAccountsData[1].address, tokenIds, tokenPrices };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: HeroONFTNativeUpgradeableInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, heroMintConditions);

        // Add controller for USDP
        let data = USDPUpgradeableContract.methods.addController(multiSigWalletInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Mint enough USDP to buy an hero
        data = USDPUpgradeableContract.methods.mint(account1, priceOfHeroInUSDP).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        const USDPAmountToApprove = tokenPrices.reduce((acc, tokenPrice) => bigInt(acc).add(tokenPrice).toString());
        await USDPUpgradeableInstance.approve(HeroONFTNativeUpgradeableInstance.address, USDPAmountToApprove, { from: account1 });

        // The tokenId and tx sender must match those that have been signed for
        await localExpect(HeroONFTNativeUpgradeableInstance.safeMintTokens(signature, tokenIds, tokenPrices, { from: testAccountsData[2].address })).to.eventually.be.rejected;
    });

    it("prevents an hero token from being minted if the signed tokenId doesn't match the tokenId specified by the caller", async () => {
        const types = {
            HeroMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenIds', type: 'uint256[]' },
                { name: 'tokenPrices', type: 'uint256[]' },
            ],
        };

        const tokenIds = ['99999'];
        const priceOfHeroInUSDP = web3.utils.toWei('1', 'ether');
        const tokenPrices = [priceOfHeroInUSDP];
        const heroMintConditions = { minter: testAccountsData[1].address, tokenIds, tokenPrices };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: HeroONFTNativeUpgradeableInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, heroMintConditions);

        // Add controller for USDP
        let data = USDPUpgradeableContract.methods.addController(multiSigWalletInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Mint enough USDP to buy an hero
        data = USDPUpgradeableContract.methods.mint(account1, priceOfHeroInUSDP).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        const USDPAmountToApprove = tokenPrices.reduce((acc, tokenPrice) => bigInt(acc).add(tokenPrice).toString());
        await USDPUpgradeableInstance.approve(HeroONFTNativeUpgradeableInstance.address, USDPAmountToApprove, { from: account1 });

        // The tokenId and tx sender must match those that have been signed for
        await localExpect(HeroONFTNativeUpgradeableInstance.safeMintTokens(signature, ['1'], tokenPrices, { from: testAccountsData[1].address })).to.eventually.be.rejected;
    });

    it('prevents an hero token from being minted if the signature is tampered with', async () => {
        const types = {
            HeroMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenIds', type: 'uint256[]' },
                { name: 'tokenPrices', type: 'uint256[]' },
            ],
        };

        const tokenIds = ['2'];
        const priceOfHeroInUSDP = web3.utils.toWei('1', 'ether');
        const tokenPrices = [priceOfHeroInUSDP];
        const heroMintConditions = { minter: testAccountsData[1].address, tokenIds, tokenPrices };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: HeroONFTNativeUpgradeableInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature: string = await signer._signTypedData(domain, types, heroMintConditions);

        // Add controller for USDP
        let data = USDPUpgradeableContract.methods.addController(multiSigWalletInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Mint enough USDP to buy an hero
        data = USDPUpgradeableContract.methods.mint(account1, priceOfHeroInUSDP).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        const USDPAmountToApprove = tokenPrices.reduce((acc, tokenPrice) => bigInt(acc).add(tokenPrice).toString());
        await USDPUpgradeableInstance.approve(HeroONFTNativeUpgradeableInstance.address, USDPAmountToApprove, { from: account1 });

        const signatureArr = signature.split('');
        signatureArr[10] = '7';
        const tamperedSignature = signatureArr.join('');

        // The tokenId and tx sender must match those that have been signed for
        await localExpect(HeroONFTNativeUpgradeableInstance.safeMintTokens(tamperedSignature, tokenIds, tokenPrices, { from: testAccountsData[1].address })).to.eventually.be
            .rejected;
    });

    it('only allows the owner (multiSigWallet) to change the USDP vault', async () => {
        // Should fail since caller is not the owner
        await localExpect(HeroONFTNativeUpgradeableInstance.setVault(account2, { from: account1 })).to.eventually.be.rejected;

        const data = HeroONFTNativeUpgradeableContract.methods.setVault(account2).encodeABI();
        await multiSigWalletInstance.submitTransaction(HeroONFTNativeUpgradeableInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        const contractUSDPVault = (await HeroONFTNativeUpgradeableInstance.vault()).toString();
        expect(contractUSDPVault).to.equal(account2);
    });

    it('can be upgraded and store new state variables from the new contract', async () => {
        const tokenSymbol = await HeroONFTNativeUpgradeableInstance.symbol();
        expect(tokenSymbol).to.equal('PHRO');

        const types = {
            HeroMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenIds', type: 'uint256[]' },
                { name: 'tokenPrices', type: 'uint256[]' },
            ],
        };

        let tokenIds = ['1'];
        const priceOfHeroInUSDP = web3.utils.toWei('1', 'ether');
        const tokenPrices = [priceOfHeroInUSDP];
        let heroMintConditions = { minter: testAccountsData[1].address, tokenIds, tokenPrices };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: HeroONFTNativeUpgradeableInstance.address,
        };

        // Sign according to the EIP-712 standard
        let signature = await signer._signTypedData(domain, types, heroMintConditions);

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
        await USDPUpgradeableInstance.approve(HeroONFTNativeUpgradeableInstance.address, USDPAmountToApprove, { from: account1 });
        await HeroONFTNativeUpgradeableInstance.safeMintTokens(signature, tokenIds, tokenPrices, { from: account1 });

        HeroONFTNativeUpgradeableTestInstance = (await upgradeProxy(
            HeroONFTNativeUpgradeableInstance.address,
            HeroONFTNativeUpgradeableTest as any
        )) as HeroONFTNativeUpgradeableTestInstance;

        // Original state variables remain unchanged
        const newTokenSymbol = await HeroONFTNativeUpgradeableTestInstance.symbol();
        expect(newTokenSymbol).to.equal('PHRO');
        const ownerOfMintedHero1 = await HeroONFTNativeUpgradeableTestInstance.ownerOf('1');
        expect(ownerOfMintedHero1).to.equal(account1);

        tokenIds = ['2'];
        heroMintConditions = { minter: testAccountsData[2].address, tokenIds, tokenPrices };

        // Sign according to the EIP-712 standard
        signature = await signer._signTypedData(domain, types, heroMintConditions);

        // Mint USDP
        data = USDPUpgradeableContract.methods.mint(account2, initialUSDPAmountMintedToOwner).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        USDPAmountToApprove = tokenPrices.reduce((acc, tokenPrice) => bigInt(acc).add(tokenPrice).toString());
        await USDPUpgradeableInstance.approve(HeroONFTNativeUpgradeableInstance.address, USDPAmountToApprove, { from: account2 });
        await HeroONFTNativeUpgradeableInstance.safeMintTokens(signature, tokenIds, tokenPrices, { from: account2 });

        // Can still mint new tokens
        const ownerOfMintedHero2 = await HeroONFTNativeUpgradeableTestInstance.ownerOf('2');
        expect(ownerOfMintedHero2).to.equal(account2);

        // Contract URI can still only be set by the owner of the previous contract (multiSigWallet)
        data = HeroONFTNativeUpgradeableContract.methods.setContractURIString('testingContractURIString').encodeABI();
        await multiSigWalletInstance.submitTransaction(HeroONFTNativeUpgradeableTestInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });
        expect((await HeroONFTNativeUpgradeableTestInstance.contractURI()).toString()).to.equal('testingContractURIString');

        // Non-existing method cannot be used to set state variable
        data = HeroONFTNativeUpgradeableContract.methods.setBaseURIString('https://www.foo.com/').encodeABI();
        await multiSigWalletInstance.submitTransaction(HeroONFTNativeUpgradeableTestInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;
        const baseURIString = await HeroONFTNativeUpgradeableTestInstance.baseURIString();
        expect(baseURIString).to.not.equal('https://www.foo.com/');
    });
});
