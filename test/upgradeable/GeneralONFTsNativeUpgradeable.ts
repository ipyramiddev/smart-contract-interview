import { deployProxy, upgradeProxy } from '@openzeppelin/truffle-upgrades';
import bigInt from 'big-integer';
import { localExpect } from '../lib/test-libraries';
import { GeneralONFTsNativeUpgradeableInstance, USDPUpgradeableInstance, MultiSigWalletInstance, GeneralONFTsNativeUpgradeableTestInstance } from '../../types/truffle-contracts';
import GENERAL_ONFTS_UPGRADEABLE_JSON from '../../build/contracts/GeneralONFTsNativeUpgradeable.json';
import USDP_UPGRADEABLE_JSON from '../../build/contracts/USDPUpgradeable.json';
import Web3 from 'web3';
import { AbiItem } from 'web3-utils';
import { getTxIdFromMultiSigWallet } from '../lib/test-helpers';

const ethers = require('ethers');
const config = require('../../config').config;
const testAccountsData = require('../../test/data/test-accounts-data').testAccountsData;

const GeneralONFTsNativeUpgradeable = artifacts.require('GeneralONFTsNativeUpgradeable');
const USDPUpgradeable = artifacts.require('USDPUpgradeable');
const multiSigWallet = artifacts.require('MultiSigWallet');
const GeneralONFTsNativeUpgradeableTest = artifacts.require('GeneralONFTsNativeUpgradeableTest');

const web3 = new Web3(new Web3.providers.HttpProvider(config.AVAX.localSubnetHTTP));
const GENERAL_ONFTS_UPGRADEABLE_ABI = GENERAL_ONFTS_UPGRADEABLE_JSON.abi as AbiItem[];
const USDP_UPGRADEABLE_ABI = USDP_UPGRADEABLE_JSON.abi as AbiItem[];

const rpcEndpoint = config.AVAX.localSubnetHTTP;
const provider = new ethers.providers.JsonRpcProvider(rpcEndpoint);
const signer = new ethers.Wallet(testAccountsData[1].privateKey, provider);

const MOCK_LZ_ENDPOINT_PF_CHAIN = testAccountsData[5].address;

contract.skip('GeneralONFTsNativeUpgradeable.sol', ([owner, account1, account2, account3, account4, account5, account6, account7, account8, account9]) => {
    let GeneralONFTsNativeUpgradeableInstance: GeneralONFTsNativeUpgradeableInstance;
    let USDPUpgradeableInstance: USDPUpgradeableInstance;
    let multiSigWalletInstance: MultiSigWalletInstance;
    let GeneralONFTsNativeUpgradeableTestInstance: GeneralONFTsNativeUpgradeableTestInstance;
    let GeneralONFTsNativeUpgradeableContract: any;
    let USDPUpgradeableContract: any;

    beforeEach(async () => {
        // Require 2 signatures for multiSig
        multiSigWalletInstance = await multiSigWallet.new([owner, account1, account2], 2);
        USDPUpgradeableInstance = (await deployProxy(USDPUpgradeable as any, [], {
            initializer: 'initialize',
        })) as USDPUpgradeableInstance;
        GeneralONFTsNativeUpgradeableInstance = (await deployProxy(
            GeneralONFTsNativeUpgradeable as any,
            [account1, USDPUpgradeableInstance.address, account9, MOCK_LZ_ENDPOINT_PF_CHAIN],
            {
                initializer: 'initialize',
            }
        )) as GeneralONFTsNativeUpgradeableInstance;
        await USDPUpgradeableInstance.transferOwnership(multiSigWalletInstance.address);
        await GeneralONFTsNativeUpgradeableInstance.transferOwnership(multiSigWalletInstance.address);

        GeneralONFTsNativeUpgradeableContract = new web3.eth.Contract(GENERAL_ONFTS_UPGRADEABLE_ABI, GeneralONFTsNativeUpgradeableInstance.address);
        USDPUpgradeableContract = new web3.eth.Contract(USDP_UPGRADEABLE_ABI, USDPUpgradeableInstance.address);
    });

    it('only allows the owner to change the mintSigner', async () => {
        // Should fail since caller is not the owner
        await localExpect(GeneralONFTsNativeUpgradeableInstance.setMintSigner(account3, { from: account1 })).to.eventually.be.rejected;

        const data = GeneralONFTsNativeUpgradeableContract.methods.setMintSigner(account3).encodeABI();
        await multiSigWalletInstance.submitTransaction(GeneralONFTsNativeUpgradeableInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        const mintSigner = await GeneralONFTsNativeUpgradeableInstance.mintSigner();
        expect(mintSigner).to.equal(account3);
    });

    it('only allows the owner to change the isPFTPaymentEnabled flag', async () => {
        let isPFTPaymentEnabled = await GeneralONFTsNativeUpgradeableInstance.isPFTPaymentEnabled();
        expect(isPFTPaymentEnabled).to.equal(true);
        // Should fail since caller is not the owner
        await localExpect(GeneralONFTsNativeUpgradeableInstance.setIsPFTPaymentEnabled(false, { from: account1 })).to.eventually.be.rejected;

        const data = GeneralONFTsNativeUpgradeableContract.methods.setIsPFTPaymentEnabled(false).encodeABI();
        await multiSigWalletInstance.submitTransaction(GeneralONFTsNativeUpgradeableInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        isPFTPaymentEnabled = await GeneralONFTsNativeUpgradeableInstance.isPFTPaymentEnabled();
        expect(isPFTPaymentEnabled).to.equal(false);
    });

    it('only allows the owner to change the isERC20PaymentEnabled flag', async () => {
        let isERC20PaymentEnabled = await GeneralONFTsNativeUpgradeableInstance.isERC20PaymentEnabled();
        expect(isERC20PaymentEnabled).to.equal(false);
        // Should fail since caller is not the owner
        await localExpect(GeneralONFTsNativeUpgradeableInstance.setIsERC20PaymentEnabled(true, { from: account1 })).to.eventually.be.rejected;

        const data = GeneralONFTsNativeUpgradeableContract.methods.setIsERC20PaymentEnabled(true).encodeABI();
        await multiSigWalletInstance.submitTransaction(GeneralONFTsNativeUpgradeableInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        isERC20PaymentEnabled = await GeneralONFTsNativeUpgradeableInstance.isERC20PaymentEnabled();
        expect(isERC20PaymentEnabled).to.equal(true);
    });

    it("has token name set to 'Portal Fantasy General NFT'", async () => {
        const tokenName = await GeneralONFTsNativeUpgradeableInstance.name();
        expect(tokenName).to.equal('Portal Fantasy General NFTs');
    });

    it("has token symbol set to 'PFGN'", async () => {
        const tokenSymbol = await GeneralONFTsNativeUpgradeableInstance.symbol();
        expect(tokenSymbol).to.equal('PFGN');
    });

    it('allows a general ONFT token to be minted if the signature is successfully verified. With payment in USDP', async () => {
        const types = {
            GeneralNFTMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenIds', type: 'uint256[]' },
                { name: 'tokenPrices', type: 'uint256[]' },
                { name: 'isPaymentInPFT', type: 'bool' },
            ],
        };

        const tokenIds = ['1'];
        const tokenPrices = [web3.utils.toWei('1', 'ether')];
        const generalNFTMintConditions = { minter: testAccountsData[1].address, tokenIds, tokenPrices, isPaymentInPFT: false };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: GeneralONFTsNativeUpgradeableInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, generalNFTMintConditions);

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
        await USDPUpgradeableInstance.approve(GeneralONFTsNativeUpgradeableInstance.address, USDPAmountToApprove, { from: account1 });

        data = GeneralONFTsNativeUpgradeableContract.methods.setIsERC20PaymentEnabled(true).encodeABI();
        await multiSigWalletInstance.submitTransaction(GeneralONFTsNativeUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        data = GeneralONFTsNativeUpgradeableContract.methods.setIsERC20PaymentEnabled(true).encodeABI();
        await multiSigWalletInstance.submitTransaction(GeneralONFTsNativeUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        data = GeneralONFTsNativeUpgradeableContract.methods.setIsERC20PaymentEnabled(true).encodeABI();
        await multiSigWalletInstance.submitTransaction(GeneralONFTsNativeUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // The tokenId and tx sender must match those that have been signed for
        await localExpect(GeneralONFTsNativeUpgradeableInstance.safeMintTokens(signature, ['1'], tokenPrices, false, { from: testAccountsData[1].address })).to.eventually.be
            .fulfilled;
        expect(await GeneralONFTsNativeUpgradeableInstance.ownerOf('1')).to.equal(testAccountsData[1].address);

        const balanceOfUSDPVault = (await USDPUpgradeableInstance.balanceOf(account9)).toString();
        expect(balanceOfUSDPVault).to.equal(USDPAmountToApprove);
    });

    it('allows multiple general ONFT tokens to be minted at different prices, if the signature is successfully verified. With payment in USDP', async () => {
        const types = {
            GeneralNFTMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenIds', type: 'uint256[]' },
                { name: 'tokenPrices', type: 'uint256[]' },
                { name: 'isPaymentInPFT', type: 'bool' },
            ],
        };

        const tokenIds = ['1', '100', '1234'];
        const tokenPrices = [web3.utils.toWei('1', 'ether'), web3.utils.toWei('2', 'ether'), web3.utils.toWei('3', 'ether')];
        const generalNFTMintConditions = { minter: testAccountsData[1].address, tokenIds, tokenPrices, isPaymentInPFT: false };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: GeneralONFTsNativeUpgradeableInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, generalNFTMintConditions);

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
        await USDPUpgradeableInstance.approve(GeneralONFTsNativeUpgradeableInstance.address, USDPAmountToApprove, { from: account1 });

        data = GeneralONFTsNativeUpgradeableContract.methods.setIsERC20PaymentEnabled(true).encodeABI();
        await multiSigWalletInstance.submitTransaction(GeneralONFTsNativeUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // The tokenId and tx sender must match those that have been signed for
        await localExpect(GeneralONFTsNativeUpgradeableInstance.safeMintTokens(signature, tokenIds, tokenPrices, false, { from: testAccountsData[1].address })).to.eventually.be
            .fulfilled;
        expect(await GeneralONFTsNativeUpgradeableInstance.ownerOf('1')).to.equal(testAccountsData[1].address);
        expect(await GeneralONFTsNativeUpgradeableInstance.ownerOf('100')).to.equal(testAccountsData[1].address);
        expect(await GeneralONFTsNativeUpgradeableInstance.ownerOf('1234')).to.equal(testAccountsData[1].address);

        const balanceOfUSDPVault = (await USDPUpgradeableInstance.balanceOf(account9)).toString();
        expect(balanceOfUSDPVault).to.equal(USDPAmountToApprove);
    });

    it('only allows the owner (multiSigWallet) to change the USDP contract address', async () => {
        const newUSDPUpgradeableInstance = (await deployProxy(USDPUpgradeable as any, [], {
            initializer: 'initialize',
        })) as USDPUpgradeableInstance;

        // Should fail since caller is not the owner
        await localExpect(GeneralONFTsNativeUpgradeableInstance.setTokenToPay(newUSDPUpgradeableInstance.address, { from: account1 })).to.eventually.be.rejected;

        const data = GeneralONFTsNativeUpgradeableContract.methods.setTokenToPay(newUSDPUpgradeableInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(GeneralONFTsNativeUpgradeableInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        const contractUSDPAddress = (await GeneralONFTsNativeUpgradeableInstance.tokenToPay()).toString();
        expect(contractUSDPAddress).to.equal(newUSDPUpgradeableInstance.address);
    });

    it('allows multiple general ONFT tokens to be minted at different prices, if the signature is successfully verified. With payment in PFT. The payment flag must be enabled', async () => {
        const types = {
            GeneralNFTMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenIds', type: 'uint256[]' },
                { name: 'tokenPrices', type: 'uint256[]' },
                { name: 'isPaymentInPFT', type: 'bool' },
            ],
        };

        const tokenIds = ['1', '100', '1234'];
        const tokenPrices = [web3.utils.toWei('1', 'ether'), web3.utils.toWei('2', 'ether'), web3.utils.toWei('3', 'ether')];
        const generalNFTMintConditions = { minter: testAccountsData[1].address, tokenIds, tokenPrices, isPaymentInPFT: true };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: GeneralONFTsNativeUpgradeableInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, generalNFTMintConditions);

        const PFTPaymentAmount = tokenPrices.reduce((acc, tokenPrice) => bigInt(acc).add(tokenPrice).toString());

        let data = GeneralONFTsNativeUpgradeableContract.methods.setIsERC20PaymentEnabled(false).encodeABI();
        await multiSigWalletInstance.submitTransaction(GeneralONFTsNativeUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        const balanceOfPFTVaultBefore = (await web3.eth.getBalance(account9)).toString();

        // The tokenId and tx sender must match those that have been signed for
        await localExpect(
            GeneralONFTsNativeUpgradeableInstance.safeMintTokens(signature, tokenIds, tokenPrices, true, { from: testAccountsData[1].address, value: PFTPaymentAmount })
        ).to.eventually.be.rejected;

        data = GeneralONFTsNativeUpgradeableContract.methods.setIsERC20PaymentEnabled(true).encodeABI();
        await multiSigWalletInstance.submitTransaction(GeneralONFTsNativeUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        await localExpect(
            GeneralONFTsNativeUpgradeableInstance.safeMintTokens(signature, tokenIds, tokenPrices, true, { from: testAccountsData[1].address, value: PFTPaymentAmount })
        ).to.eventually.be.fulfilled;

        expect(await GeneralONFTsNativeUpgradeableInstance.ownerOf('1')).to.equal(testAccountsData[1].address);
        expect(await GeneralONFTsNativeUpgradeableInstance.ownerOf('100')).to.equal(testAccountsData[1].address);
        expect(await GeneralONFTsNativeUpgradeableInstance.ownerOf('1234')).to.equal(testAccountsData[1].address);

        const balanceOfPFTVaultAfter = (await web3.eth.getBalance(account9)).toString();
        expect(bigInt(balanceOfPFTVaultAfter).minus(balanceOfPFTVaultBefore).toString()).to.equal(PFTPaymentAmount);
    });

    it('only allows the owner (multiSigWallet) to change the USDP contract address', async () => {
        const newUSDPUpgradeableInstance = (await deployProxy(USDPUpgradeable as any, [], {
            initializer: 'initialize',
        })) as USDPUpgradeableInstance;

        // Should fail since caller is not the owner
        await localExpect(GeneralONFTsNativeUpgradeableInstance.setTokenToPay(newUSDPUpgradeableInstance.address, { from: account1 })).to.eventually.be.rejected;

        const data = GeneralONFTsNativeUpgradeableContract.methods.setTokenToPay(newUSDPUpgradeableInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(GeneralONFTsNativeUpgradeableInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        const contractUSDPAddress = (await GeneralONFTsNativeUpgradeableInstance.tokenToPay()).toString();
        expect(contractUSDPAddress).to.equal(newUSDPUpgradeableInstance.address);
    });

    // @TODO: Update this test when we have the final base URI implemented in the contract
    it('generates a valid token URI', async () => {
        const types = {
            GeneralNFTMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenIds', type: 'uint256[]' },
                { name: 'tokenPrices', type: 'uint256[]' },
                { name: 'isPaymentInPFT', type: 'bool' },
            ],
        };

        const tokenIds = ['1'];
        const priceOfGeneralNFTsInUSDP = web3.utils.toWei('1', 'ether');
        const tokenPrices = [priceOfGeneralNFTsInUSDP];
        const generalNFTMintConditions = { minter: testAccountsData[1].address, tokenIds, tokenPrices, isPaymentInPFT: false };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: GeneralONFTsNativeUpgradeableInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, generalNFTMintConditions);

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

        await USDPUpgradeableInstance.approve(GeneralONFTsNativeUpgradeableInstance.address, priceOfGeneralNFTsInUSDP, { from: account1 });

        data = GeneralONFTsNativeUpgradeableContract.methods.setIsERC20PaymentEnabled(true).encodeABI();
        await multiSigWalletInstance.submitTransaction(GeneralONFTsNativeUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        await GeneralONFTsNativeUpgradeableInstance.safeMintTokens(signature, tokenIds, tokenPrices, false, { from: account1 });

        const tokenURI = await GeneralONFTsNativeUpgradeableInstance.tokenURI('1');
        expect(tokenURI).to.equal('https://www.portalfantasy.io/1');
    });

    it('allows only the owner (multiSigWallet) to change the base URI', async () => {
        const types = {
            GeneralNFTMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenIds', type: 'uint256[]' },
                { name: 'tokenPrices', type: 'uint256[]' },
                { name: 'isPaymentInPFT', type: 'bool' },
            ],
        };

        const tokenIds = ['1'];
        const tokenPrices = [web3.utils.toWei('1', 'ether')];
        const generalNFTMintConditions = { minter: testAccountsData[1].address, tokenIds, tokenPrices, isPaymentInPFT: false };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: GeneralONFTsNativeUpgradeableInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, generalNFTMintConditions);

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
        await USDPUpgradeableInstance.approve(GeneralONFTsNativeUpgradeableInstance.address, USDPAmountToApprove, { from: account1 });

        data = GeneralONFTsNativeUpgradeableContract.methods.setIsERC20PaymentEnabled(true).encodeABI();
        await multiSigWalletInstance.submitTransaction(GeneralONFTsNativeUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        await GeneralONFTsNativeUpgradeableInstance.safeMintTokens(signature, tokenIds, tokenPrices, false, { from: account1 });

        let tokenURI = await GeneralONFTsNativeUpgradeableInstance.tokenURI('1');
        expect(tokenURI).to.equal('https://www.portalfantasy.io/1');

        // Expect this to fail, as only the owner can change the base URI
        await localExpect(GeneralONFTsNativeUpgradeableInstance.setBaseURIString('https://www.foo.com/', { from: account1 })).to.eventually.be.rejected;

        data = GeneralONFTsNativeUpgradeableContract.methods.setBaseURIString('https://www.bar.com/').encodeABI();
        await multiSigWalletInstance.submitTransaction(GeneralONFTsNativeUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        tokenURI = await GeneralONFTsNativeUpgradeableInstance.tokenURI('1');
        expect(tokenURI).to.equal('https://www.bar.com/1');
    });

    it('allows only the owner (multiSigWallet) to change the contract URI', async () => {
        let contractURI = await GeneralONFTsNativeUpgradeableInstance.contractURI();
        expect(contractURI).to.equal('https://www.portalfantasy.io/generalNFTs/');

        // Expect this to fail, as only the owner can change the base URI
        await localExpect(GeneralONFTsNativeUpgradeableInstance.setContractURIString('https://www.foo.com/generalNFTs/', { from: account1 })).to.eventually.be.rejected;

        const data = GeneralONFTsNativeUpgradeableContract.methods.setContractURIString('https://www.bar.com/generalNFTs/').encodeABI();
        await multiSigWalletInstance.submitTransaction(GeneralONFTsNativeUpgradeableInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        contractURI = await GeneralONFTsNativeUpgradeableInstance.contractURI();
        expect(contractURI).to.equal('https://www.bar.com/generalNFTs/');
    });

    it('applies the default royalty correctly', async () => {
        const types = {
            GeneralNFTMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenIds', type: 'uint256[]' },
                { name: 'tokenPrices', type: 'uint256[]' },
                { name: 'isPaymentInPFT', type: 'bool' },
            ],
        };

        const tokenIds = ['1'];
        const priceOfGeneralNFTsInUSDP = web3.utils.toWei('1', 'ether');
        const tokenPrices = [priceOfGeneralNFTsInUSDP];
        const generalNFTMintConditions = { minter: testAccountsData[1].address, tokenIds, tokenPrices, isPaymentInPFT: false };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: GeneralONFTsNativeUpgradeableInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, generalNFTMintConditions);

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
        await USDPUpgradeableInstance.approve(GeneralONFTsNativeUpgradeableInstance.address, USDPAmountToApprove, { from: account1 });

        data = GeneralONFTsNativeUpgradeableContract.methods.setIsERC20PaymentEnabled(true).encodeABI();
        await multiSigWalletInstance.submitTransaction(GeneralONFTsNativeUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        await GeneralONFTsNativeUpgradeableInstance.safeMintTokens(signature, tokenIds, tokenPrices, false, { from: account1 });

        // Assert expected royalty parameters
        let defaultRoyaltyInfo = await GeneralONFTsNativeUpgradeableInstance.royaltyInfo('0', priceOfGeneralNFTsInUSDP);
        const royaltyRecipient = defaultRoyaltyInfo[0];
        const royaltyFee = defaultRoyaltyInfo[1];
        const expectedRoyalFeeNumeratorBips = 400;
        expect(royaltyRecipient).to.equal(account9);
        expect(royaltyFee.toString()).to.equal(bigInt(priceOfGeneralNFTsInUSDP).multiply(expectedRoyalFeeNumeratorBips).divide(10000).toString());
    });

    it('allows only the owner to change the default royalty fee', async () => {
        const types = {
            GeneralNFTMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenIds', type: 'uint256[]' },
                { name: 'tokenPrices', type: 'uint256[]' },
                { name: 'isPaymentInPFT', type: 'bool' },
            ],
        };

        const tokenIds = ['1'];
        const priceOfGeneralNFTsInUSDP = web3.utils.toWei('1', 'ether');
        const tokenPrices = [priceOfGeneralNFTsInUSDP];
        const generalNFTMintConditions = { minter: testAccountsData[1].address, tokenIds, tokenPrices, isPaymentInPFT: false };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: GeneralONFTsNativeUpgradeableInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, generalNFTMintConditions);

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
        await USDPUpgradeableInstance.approve(GeneralONFTsNativeUpgradeableInstance.address, USDPAmountToApprove, { from: account1 });

        data = GeneralONFTsNativeUpgradeableContract.methods.setIsERC20PaymentEnabled(true).encodeABI();
        await multiSigWalletInstance.submitTransaction(GeneralONFTsNativeUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        await GeneralONFTsNativeUpgradeableInstance.safeMintTokens(signature, tokenIds, tokenPrices, false, { from: account1 });

        // Expect this to fail, as only the owner can change the base URI
        await localExpect(GeneralONFTsNativeUpgradeableInstance.setDefaultRoyalty(300, { from: account1 })).to.eventually.be.rejected;

        const updatedRoyaltyFeeBips = 100;
        data = GeneralONFTsNativeUpgradeableContract.methods.setDefaultRoyalty(updatedRoyaltyFeeBips).encodeABI();
        await multiSigWalletInstance.submitTransaction(GeneralONFTsNativeUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        // Assert expected royalty parameters
        let defaultRoyaltyInfo = await GeneralONFTsNativeUpgradeableInstance.royaltyInfo('0', priceOfGeneralNFTsInUSDP);
        const royaltyRecipient = defaultRoyaltyInfo[0];
        const royaltyFee = defaultRoyaltyInfo[1];
        expect(royaltyRecipient).to.equal(account9);
        expect(royaltyFee.toString()).to.equal(bigInt(priceOfGeneralNFTsInUSDP).multiply(updatedRoyaltyFeeBips).divide(10000).toString());
    });

    it('reverts if the same signature is used multiple times', async () => {
        const types = {
            GeneralNFTMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenIds', type: 'uint256[]' },
                { name: 'tokenPrices', type: 'uint256[]' },
                { name: 'isPaymentInPFT', type: 'bool' },
            ],
        };

        const tokenIds = ['1'];
        const priceOfGeneralNFTsInUSDP = web3.utils.toWei('1', 'ether');
        const tokenPrices = [priceOfGeneralNFTsInUSDP];
        const generalNFTMintConditions = { minter: testAccountsData[1].address, tokenIds, tokenPrices, isPaymentInPFT: false };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: GeneralONFTsNativeUpgradeableInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, generalNFTMintConditions);

        // Add controller for USDP
        let data = USDPUpgradeableContract.methods.addController(multiSigWalletInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Mint enough USDP to potentially buy two general NFTs
        data = USDPUpgradeableContract.methods.mint(account1, bigInt(priceOfGeneralNFTsInUSDP).multiply(2).toString()).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        const USDPAmountToApprove = tokenPrices.reduce((acc, tokenPrice) => bigInt(acc).add(tokenPrice).toString());
        await USDPUpgradeableInstance.approve(GeneralONFTsNativeUpgradeableInstance.address, USDPAmountToApprove, { from: account1 });

        data = GeneralONFTsNativeUpgradeableContract.methods.setIsERC20PaymentEnabled(true).encodeABI();
        await multiSigWalletInstance.submitTransaction(GeneralONFTsNativeUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // The tokenId and tx sender must match those that have been signed for
        await localExpect(GeneralONFTsNativeUpgradeableInstance.safeMintTokens(signature, tokenIds, tokenPrices, false, { from: testAccountsData[1].address })).to.eventually.be
            .fulfilled;

        await localExpect(GeneralONFTsNativeUpgradeableInstance.safeMintTokens(signature, tokenIds, tokenPrices, false, { from: testAccountsData[1].address })).to.eventually.be
            .rejected;
    });

    it("prevents a general ONFT token from being minted if the 'GeneralNFTMintConditions' key doesn't match the name of the object hard-coded in the contract", async () => {
        const types = {
            GeneralNFTMintConditionsWrong: [
                { name: 'minter', type: 'address' },
                { name: 'tokenIds', type: 'uint256[]' },
                { name: 'tokenPrices', type: 'uint256[]' },
                { name: 'isPaymentInPFT', type: 'bool' },
            ],
        };

        const tokenIds = ['2'];
        const priceOfGeneralNFTsInUSDP = web3.utils.toWei('1', 'ether');
        const tokenPrices = [priceOfGeneralNFTsInUSDP];
        const generalNFTMintConditions = { minter: testAccountsData[1].address, tokenIds, tokenPrices, isPaymentInPFT: false };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: GeneralONFTsNativeUpgradeableInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, generalNFTMintConditions);

        // Add controller for USDP
        let data = USDPUpgradeableContract.methods.addController(multiSigWalletInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Mint enough USDP to buy a general ONFT
        data = USDPUpgradeableContract.methods.mint(account1, priceOfGeneralNFTsInUSDP).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        const USDPAmountToApprove = tokenPrices.reduce((acc, tokenPrice) => bigInt(acc).add(tokenPrice).toString());
        await USDPUpgradeableInstance.approve(GeneralONFTsNativeUpgradeableInstance.address, USDPAmountToApprove, { from: account1 });

        data = GeneralONFTsNativeUpgradeableContract.methods.setIsERC20PaymentEnabled(true).encodeABI();
        await multiSigWalletInstance.submitTransaction(GeneralONFTsNativeUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // The tokenId and tx sender must match those that have been signed for
        await localExpect(GeneralONFTsNativeUpgradeableInstance.safeMintTokens(signature, tokenIds, tokenPrices, false, { from: testAccountsData[1].address })).to.eventually.be
            .rejected;
    });

    it("prevents a general ONFT token from being minted if the domain name doesn't match the string passed into the contract's constructor", async () => {
        const types = {
            GeneralNFTMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenIds', type: 'uint256[]' },
                { name: 'tokenPrices', type: 'uint256[]' },
                { name: 'isPaymentInPFT', type: 'bool' },
            ],
        };

        const tokenIds = ['2'];
        const priceOfGeneralNFTsInUSDP = web3.utils.toWei('1', 'ether');
        const tokenPrices = [priceOfGeneralNFTsInUSDP];
        const generalNFTMintConditions = { minter: testAccountsData[1].address, tokenIds, tokenPrices, isPaymentInPFT: false };

        const domain = {
            name: 'PortalFantasyWrong',
            version: '1',
            chainId: 43214,
            verifyingContract: GeneralONFTsNativeUpgradeableInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, generalNFTMintConditions);

        // Add controller for USDP
        let data = USDPUpgradeableContract.methods.addController(multiSigWalletInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Mint enough USDP to buy a general ONFT
        data = USDPUpgradeableContract.methods.mint(account1, priceOfGeneralNFTsInUSDP).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        const USDPAmountToApprove = tokenPrices.reduce((acc, tokenPrice) => bigInt(acc).add(tokenPrice).toString());
        await USDPUpgradeableInstance.approve(GeneralONFTsNativeUpgradeableInstance.address, USDPAmountToApprove, { from: account1 });

        data = GeneralONFTsNativeUpgradeableContract.methods.setIsERC20PaymentEnabled(true).encodeABI();
        await multiSigWalletInstance.submitTransaction(GeneralONFTsNativeUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // The tokenId and tx sender must match those that have been signed for
        await localExpect(GeneralONFTsNativeUpgradeableInstance.safeMintTokens(signature, tokenIds, tokenPrices, false, { from: testAccountsData[1].address })).to.eventually.be
            .rejected;
    });

    it("prevents a general ONFT token from being minted if the domain version doesn't match the string passed into the contract's constructor", async () => {
        const types = {
            GeneralNFTMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenIds', type: 'uint256[]' },
                { name: 'tokenPrices', type: 'uint256[]' },
                { name: 'isPaymentInPFT', type: 'bool' },
            ],
        };

        const tokenIds = ['2'];
        const priceOfGeneralNFTsInUSDP = web3.utils.toWei('1', 'ether');
        const tokenPrices = [priceOfGeneralNFTsInUSDP];
        const generalNFTMintConditions = { minter: testAccountsData[1].address, tokenIds, tokenPrices, isPaymentInPFT: false };

        const domain = {
            name: 'PortalFantasy',
            version: '9',
            chainId: 43214,
            verifyingContract: GeneralONFTsNativeUpgradeableInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, generalNFTMintConditions);

        // Add controller for USDP
        let data = USDPUpgradeableContract.methods.addController(multiSigWalletInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Mint enough USDP to buy a general ONFT
        data = USDPUpgradeableContract.methods.mint(account1, priceOfGeneralNFTsInUSDP).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        const USDPAmountToApprove = tokenPrices.reduce((acc, tokenPrice) => bigInt(acc).add(tokenPrice).toString());
        await USDPUpgradeableInstance.approve(GeneralONFTsNativeUpgradeableInstance.address, USDPAmountToApprove, { from: account1 });

        data = GeneralONFTsNativeUpgradeableContract.methods.setIsERC20PaymentEnabled(true).encodeABI();
        await multiSigWalletInstance.submitTransaction(GeneralONFTsNativeUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // The tokenId and tx sender must match those that have been signed for
        await localExpect(GeneralONFTsNativeUpgradeableInstance.safeMintTokens(signature, tokenIds, tokenPrices, false, { from: testAccountsData[1].address })).to.eventually.be
            .rejected;
    });

    it("prevents a general ONFT token from being minted if the domain chainId doesn't match the chainId of the chain the contract is deployed to", async () => {
        const types = {
            GeneralNFTMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenIds', type: 'uint256[]' },
                { name: 'tokenPrices', type: 'uint256[]' },
                { name: 'isPaymentInPFT', type: 'bool' },
            ],
        };

        const tokenIds = ['2'];
        const priceOfGeneralNFTsInUSDP = web3.utils.toWei('1', 'ether');
        const tokenPrices = [priceOfGeneralNFTsInUSDP];
        const generalNFTMintConditions = { minter: testAccountsData[1].address, tokenIds, tokenPrices, isPaymentInPFT: false };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 99999,
            verifyingContract: GeneralONFTsNativeUpgradeableInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, generalNFTMintConditions);

        // Add controller for USDP
        let data = USDPUpgradeableContract.methods.addController(multiSigWalletInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Mint enough USDP to buy a general ONFT
        data = USDPUpgradeableContract.methods.mint(account1, priceOfGeneralNFTsInUSDP).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        const USDPAmountToApprove = tokenPrices.reduce((acc, tokenPrice) => bigInt(acc).add(tokenPrice).toString());
        await USDPUpgradeableInstance.approve(GeneralONFTsNativeUpgradeableInstance.address, USDPAmountToApprove, { from: account1 });

        data = GeneralONFTsNativeUpgradeableContract.methods.setIsERC20PaymentEnabled(true).encodeABI();
        await multiSigWalletInstance.submitTransaction(GeneralONFTsNativeUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // The tokenId and tx sender must match those that have been signed for
        await localExpect(GeneralONFTsNativeUpgradeableInstance.safeMintTokens(signature, tokenIds, tokenPrices, false, { from: testAccountsData[1].address })).to.eventually.be
            .rejected;
    });

    it("prevents a general ONFT token from being minted if the domain verifyingContract doesn't match the address the contract is deployed to", async () => {
        const types = {
            GeneralNFTMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenIds', type: 'uint256[]' },
                { name: 'tokenPrices', type: 'uint256[]' },
                { name: 'isPaymentInPFT', type: 'bool' },
            ],
        };

        const tokenIds = ['2'];
        const priceOfGeneralNFTsInUSDP = web3.utils.toWei('1', 'ether');
        const tokenPrices = [priceOfGeneralNFTsInUSDP];
        const generalNFTMintConditions = { minter: testAccountsData[1].address, tokenIds, tokenPrices, isPaymentInPFT: false };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: '0xcccccccccccccccccccccccccccccccccccccccc',
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, generalNFTMintConditions);

        // Add controller for USDP
        let data = USDPUpgradeableContract.methods.addController(multiSigWalletInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Mint enough USDP to buy a general ONFT
        data = USDPUpgradeableContract.methods.mint(account1, priceOfGeneralNFTsInUSDP).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        const USDPAmountToApprove = tokenPrices.reduce((acc, tokenPrice) => bigInt(acc).add(tokenPrice).toString());
        await USDPUpgradeableInstance.approve(GeneralONFTsNativeUpgradeableInstance.address, USDPAmountToApprove, { from: account1 });

        data = GeneralONFTsNativeUpgradeableContract.methods.setIsERC20PaymentEnabled(true).encodeABI();
        await multiSigWalletInstance.submitTransaction(GeneralONFTsNativeUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // The tokenId and tx sender must match those that have been signed for
        await localExpect(GeneralONFTsNativeUpgradeableInstance.safeMintTokens(signature, tokenIds, tokenPrices, false, { from: testAccountsData[1].address })).to.eventually.be
            .rejected;
    });

    it("prevents a general ONFT token from being minted if the signed 'minter' address doesn't match the sender address of the tx", async () => {
        const types = {
            GeneralNFTMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenIds', type: 'uint256[]' },
                { name: 'tokenPrices', type: 'uint256[]' },
                { name: 'isPaymentInPFT', type: 'bool' },
            ],
        };

        const tokenIds = ['2'];
        const priceOfGeneralNFTsInUSDP = web3.utils.toWei('1', 'ether');
        const tokenPrices = [priceOfGeneralNFTsInUSDP];
        const generalNFTMintConditions = { minter: testAccountsData[1].address, tokenIds, tokenPrices, isPaymentInPFT: false };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: GeneralONFTsNativeUpgradeableInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, generalNFTMintConditions);

        // Add controller for USDP
        let data = USDPUpgradeableContract.methods.addController(multiSigWalletInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Mint enough USDP to buy a general ONFT
        data = USDPUpgradeableContract.methods.mint(account1, priceOfGeneralNFTsInUSDP).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        const USDPAmountToApprove = tokenPrices.reduce((acc, tokenPrice) => bigInt(acc).add(tokenPrice).toString());
        await USDPUpgradeableInstance.approve(GeneralONFTsNativeUpgradeableInstance.address, USDPAmountToApprove, { from: account1 });

        data = GeneralONFTsNativeUpgradeableContract.methods.setIsERC20PaymentEnabled(true).encodeABI();
        await multiSigWalletInstance.submitTransaction(GeneralONFTsNativeUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // The tokenId and tx sender must match those that have been signed for
        await localExpect(GeneralONFTsNativeUpgradeableInstance.safeMintTokens(signature, tokenIds, tokenPrices, false, { from: testAccountsData[2].address })).to.eventually.be
            .rejected;
    });

    it("prevents a general ONFT token from being minted if the signed tokenId doesn't match the tokenId specified by the caller", async () => {
        const types = {
            GeneralNFTMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenIds', type: 'uint256[]' },
                { name: 'tokenPrices', type: 'uint256[]' },
                { name: 'isPaymentInPFT', type: 'bool' },
            ],
        };

        const tokenIds = ['99999'];
        const priceOfGeneralNFTsInUSDP = web3.utils.toWei('1', 'ether');
        const tokenPrices = [priceOfGeneralNFTsInUSDP];
        const generalNFTMintConditions = { minter: testAccountsData[1].address, tokenIds, tokenPrices, isPaymentInPFT: false };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: GeneralONFTsNativeUpgradeableInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, generalNFTMintConditions);

        // Add controller for USDP
        let data = USDPUpgradeableContract.methods.addController(multiSigWalletInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Mint enough USDP to buy a general ONFT
        data = USDPUpgradeableContract.methods.mint(account1, priceOfGeneralNFTsInUSDP).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        const USDPAmountToApprove = tokenPrices.reduce((acc, tokenPrice) => bigInt(acc).add(tokenPrice).toString());
        await USDPUpgradeableInstance.approve(GeneralONFTsNativeUpgradeableInstance.address, USDPAmountToApprove, { from: account1 });

        data = GeneralONFTsNativeUpgradeableContract.methods.setIsERC20PaymentEnabled(true).encodeABI();
        await multiSigWalletInstance.submitTransaction(GeneralONFTsNativeUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // The tokenId and tx sender must match those that have been signed for
        await localExpect(GeneralONFTsNativeUpgradeableInstance.safeMintTokens(signature, ['1'], tokenPrices, false, { from: testAccountsData[1].address })).to.eventually.be
            .rejected;
    });

    it('only allows a general ONFT token to be minted if payment is in ERC20 and the flag is enabled', async () => {
        const types = {
            GeneralNFTMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenIds', type: 'uint256[]' },
                { name: 'tokenPrices', type: 'uint256[]' },
                { name: 'isPaymentInPFT', type: 'bool' },
            ],
        };

        const tokenIds = ['1'];
        const priceOfGeneralNFTsInUSDP = web3.utils.toWei('1', 'ether');
        const tokenPrices = [priceOfGeneralNFTsInUSDP];
        const generalNFTMintConditions = { minter: testAccountsData[1].address, tokenIds, tokenPrices, isPaymentInPFT: false };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: GeneralONFTsNativeUpgradeableInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, generalNFTMintConditions);

        // Add controller for USDP
        let data = USDPUpgradeableContract.methods.addController(multiSigWalletInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Mint enough USDP to buy a general ONFT
        data = USDPUpgradeableContract.methods.mint(account1, priceOfGeneralNFTsInUSDP).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        const USDPAmountToApprove = tokenPrices.reduce((acc, tokenPrice) => bigInt(acc).add(tokenPrice).toString());
        await USDPUpgradeableInstance.approve(GeneralONFTsNativeUpgradeableInstance.address, USDPAmountToApprove, { from: account1 });

        await localExpect(GeneralONFTsNativeUpgradeableInstance.safeMintTokens(signature, tokenIds, tokenPrices, false, { from: testAccountsData[1].address })).to.eventually.be
            .rejected;

        data = GeneralONFTsNativeUpgradeableContract.methods.setIsERC20PaymentEnabled(true).encodeABI();
        await multiSigWalletInstance.submitTransaction(GeneralONFTsNativeUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        await localExpect(GeneralONFTsNativeUpgradeableInstance.safeMintTokens(signature, tokenIds, tokenPrices, false, { from: testAccountsData[1].address })).to.eventually.be
            .fulfilled;
    });

    it('prevents a general ONFT token from being minted if the signature is tampered with', async () => {
        const types = {
            GeneralNFTMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenIds', type: 'uint256[]' },
                { name: 'tokenPrices', type: 'uint256[]' },
                { name: 'isPaymentInPFT', type: 'bool' },
            ],
        };

        const tokenIds = ['2'];
        const priceOfGeneralNFTsInUSDP = web3.utils.toWei('1', 'ether');
        const tokenPrices = [priceOfGeneralNFTsInUSDP];
        const generalNFTMintConditions = { minter: testAccountsData[1].address, tokenIds, tokenPrices, isPaymentInPFT: false };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: GeneralONFTsNativeUpgradeableInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature: string = await signer._signTypedData(domain, types, generalNFTMintConditions);

        // Add controller for USDP
        let data = USDPUpgradeableContract.methods.addController(multiSigWalletInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // Mint enough USDP to buy a general ONFT
        data = USDPUpgradeableContract.methods.mint(account1, priceOfGeneralNFTsInUSDP).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        const USDPAmountToApprove = tokenPrices.reduce((acc, tokenPrice) => bigInt(acc).add(tokenPrice).toString());
        await USDPUpgradeableInstance.approve(GeneralONFTsNativeUpgradeableInstance.address, USDPAmountToApprove, { from: account1 });

        const signatureArr = signature.split('');
        signatureArr[10] = '7';
        const tamperedSignature = signatureArr.join('');

        data = GeneralONFTsNativeUpgradeableContract.methods.setIsERC20PaymentEnabled(true).encodeABI();
        await multiSigWalletInstance.submitTransaction(GeneralONFTsNativeUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // The tokenId and tx sender must match those that have been signed for
        await localExpect(GeneralONFTsNativeUpgradeableInstance.safeMintTokens(tamperedSignature, tokenIds, tokenPrices, false, { from: testAccountsData[1].address })).to
            .eventually.be.rejected;
    });

    it('only allows the owner (multiSigWallet) to change the USDP vault', async () => {
        // Should fail since caller is not the owner
        await localExpect(GeneralONFTsNativeUpgradeableInstance.setVault(account2, { from: account1 })).to.eventually.be.rejected;

        const data = GeneralONFTsNativeUpgradeableContract.methods.setVault(account2).encodeABI();
        await multiSigWalletInstance.submitTransaction(GeneralONFTsNativeUpgradeableInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;

        const contractUSDPVault = (await GeneralONFTsNativeUpgradeableInstance.vault()).toString();
        expect(contractUSDPVault).to.equal(account2);
    });

    it('can be upgraded and store new state variables from the new contract', async () => {
        const tokenSymbol = await GeneralONFTsNativeUpgradeableInstance.symbol();
        expect(tokenSymbol).to.equal('PFGN');

        const types = {
            GeneralNFTMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenIds', type: 'uint256[]' },
                { name: 'tokenPrices', type: 'uint256[]' },
                { name: 'isPaymentInPFT', type: 'bool' },
            ],
        };

        let tokenIds = ['1'];
        const priceOfGeneralNFTsInUSDP = web3.utils.toWei('1', 'ether');
        const tokenPrices = [priceOfGeneralNFTsInUSDP];
        let generalNFTMintConditions = { minter: testAccountsData[1].address, tokenIds, tokenPrices, isPaymentInPFT: false };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: GeneralONFTsNativeUpgradeableInstance.address,
        };

        // Sign according to the EIP-712 standard
        let signature = await signer._signTypedData(domain, types, generalNFTMintConditions);

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
        await USDPUpgradeableInstance.approve(GeneralONFTsNativeUpgradeableInstance.address, USDPAmountToApprove, { from: account1 });

        data = GeneralONFTsNativeUpgradeableContract.methods.setIsERC20PaymentEnabled(true).encodeABI();
        await multiSigWalletInstance.submitTransaction(GeneralONFTsNativeUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        await GeneralONFTsNativeUpgradeableInstance.safeMintTokens(signature, tokenIds, tokenPrices, false, { from: account1 });

        GeneralONFTsNativeUpgradeableTestInstance = (await upgradeProxy(
            GeneralONFTsNativeUpgradeableInstance.address,
            GeneralONFTsNativeUpgradeableTest as any
        )) as GeneralONFTsNativeUpgradeableTestInstance;

        // Original state variables remain unchanged
        const newTokenSymbol = await GeneralONFTsNativeUpgradeableTestInstance.symbol();
        expect(newTokenSymbol).to.equal('PFGN');
        const ownerOfMintedArchitect1 = await GeneralONFTsNativeUpgradeableTestInstance.ownerOf('1');
        expect(ownerOfMintedArchitect1).to.equal(account1);

        tokenIds = ['2'];
        generalNFTMintConditions = { minter: testAccountsData[2].address, tokenIds, tokenPrices, isPaymentInPFT: false };

        // Sign according to the EIP-712 standard
        signature = await signer._signTypedData(domain, types, generalNFTMintConditions);

        // Mint USDP
        data = USDPUpgradeableContract.methods.mint(account2, initialUSDPAmountMintedToOwner).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDPUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        USDPAmountToApprove = tokenPrices.reduce((acc, tokenPrice) => bigInt(acc).add(tokenPrice).toString());
        await USDPUpgradeableInstance.approve(GeneralONFTsNativeUpgradeableInstance.address, USDPAmountToApprove, { from: account2 });

        data = GeneralONFTsNativeUpgradeableContract.methods.setIsERC20PaymentEnabled(true).encodeABI();
        await multiSigWalletInstance.submitTransaction(GeneralONFTsNativeUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        await GeneralONFTsNativeUpgradeableInstance.safeMintTokens(signature, tokenIds, tokenPrices, false, { from: account2 });

        // Can still mint new tokens
        const ownerOfMintedArchitect2 = await GeneralONFTsNativeUpgradeableTestInstance.ownerOf('2');
        expect(ownerOfMintedArchitect2).to.equal(account2);

        // Contract URI can still only be set by the owner of the previous contract (multiSigWallet)
        data = GeneralONFTsNativeUpgradeableContract.methods.setContractURIString('testingContractURIString').encodeABI();
        await multiSigWalletInstance.submitTransaction(GeneralONFTsNativeUpgradeableTestInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });
        expect((await GeneralONFTsNativeUpgradeableTestInstance.contractURI()).toString()).to.equal('testingContractURIString');

        // Non-existing method cannot be used to set state variable
        data = GeneralONFTsNativeUpgradeableContract.methods.setBaseURIString('https://www.foo.com/').encodeABI();
        await multiSigWalletInstance.submitTransaction(GeneralONFTsNativeUpgradeableTestInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await localExpect(multiSigWalletInstance.confirmTransaction(txId, { from: account1 })).to.eventually.be.fulfilled;
        const baseURIString = await GeneralONFTsNativeUpgradeableTestInstance.baseURIString();
        expect(baseURIString).to.not.equal('https://www.foo.com/');
    });

    it('allows multiple tokens to be burnt only by the owner or approved operator', async () => {
        const types = {
            GeneralNFTMintConditions: [
                { name: 'minter', type: 'address' },
                { name: 'tokenIds', type: 'uint256[]' },
                { name: 'tokenPrices', type: 'uint256[]' },
                { name: 'isPaymentInPFT', type: 'bool' },
            ],
        };

        const tokenIds = ['1', '100', '1234'];
        const tokenPrices = [web3.utils.toWei('1', 'ether'), web3.utils.toWei('2', 'ether'), web3.utils.toWei('3', 'ether')];
        const generalNFTsMintConditions = { minter: testAccountsData[1].address, tokenIds, tokenPrices, isPaymentInPFT: false };

        const domain = {
            name: 'PortalFantasy',
            version: '1',
            chainId: 43214,
            verifyingContract: GeneralONFTsNativeUpgradeableInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, generalNFTsMintConditions);

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
        await USDPUpgradeableInstance.approve(GeneralONFTsNativeUpgradeableInstance.address, USDPAmountToApprove, { from: account1 });

        data = GeneralONFTsNativeUpgradeableContract.methods.setIsERC20PaymentEnabled(true).encodeABI();
        await multiSigWalletInstance.submitTransaction(GeneralONFTsNativeUpgradeableInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });

        // The tokenId and tx sender must match those that have been signed for
        await GeneralONFTsNativeUpgradeableInstance.safeMintTokens(signature, tokenIds, tokenPrices, false, { from: testAccountsData[1].address });

        await localExpect(GeneralONFTsNativeUpgradeableInstance.burnTokens(['1', '100'], { from: testAccountsData[2].address })).to.eventually.be.rejected;
        await localExpect(GeneralONFTsNativeUpgradeableInstance.burnTokens(['1', '100'], { from: testAccountsData[1].address })).to.eventually.be.fulfilled;

        await GeneralONFTsNativeUpgradeableInstance.setApprovalForAll(testAccountsData[2].address, true, { from: testAccountsData[1].address });
        await localExpect(GeneralONFTsNativeUpgradeableInstance.burnTokens(['1234'], { from: testAccountsData[2].address })).to.eventually.be.fulfilled;

        await localExpect(GeneralONFTsNativeUpgradeableInstance.ownerOf('1')).to.eventually.be.rejected;
        await localExpect(GeneralONFTsNativeUpgradeableInstance.ownerOf('100')).to.eventually.be.rejected;
        await localExpect(GeneralONFTsNativeUpgradeableInstance.ownerOf('1234')).to.eventually.be.rejected;
    });
});
