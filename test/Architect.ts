import { localExpect } from "./lib/test-libraries";
import { ArchitectInstance, PORBInstance } from "../types/truffle-contracts";

const Architect = artifacts.require("Architect");
const PORB = artifacts.require("PORB");

contract.skip("Architect.sol", ([owner, account1, account2, account3, account4, account5, account6, account7, account8, account9]) => {
    let ArchitectInstance: ArchitectInstance;
    let PORBInstance: PORBInstance;

    beforeEach(async () => {
        PORBInstance = await PORB.new(account1, owner);
        ArchitectInstance = await Architect.new(PORBInstance.address, account9);
    });

    it("has token name set to 'Portal Fantasy Architect'", async () => {
        const tokenName = await ArchitectInstance.name();
        expect(tokenName).to.equal("Portal Fantasy Architect");
    });

    it("has token symbol set to 'PHAR'", async () => {
        const tokenSymbol = await ArchitectInstance.symbol();
        expect(tokenSymbol).to.equal("PHAR");
    });

    it("can only be paused/unpaused by the owner", async () => {
        let isPaused = await ArchitectInstance.paused();
        expect(isPaused).to.be.false;

        // Non-owner account attempting to pause should fail
        await localExpect(ArchitectInstance.setPaused(true, { from: account1 })).to.be.rejected;

        await ArchitectInstance.setPaused(true);

        isPaused = await ArchitectInstance.paused();
        expect(isPaused).to.be.true;

        // Non-owner account attempting to unpause should fail
        await localExpect(ArchitectInstance.setPaused(false, { from: account1 })).to.be.rejected;

        await ArchitectInstance.setPaused(false);

        isPaused = await ArchitectInstance.paused();
        expect(isPaused).to.be.false;
    });

    it("allows an Architect NFT to be minted with payment in PORB", async () => {
        const initialPORBAmountMintedToOwner = web3.utils.toWei("1000000000", "ether");
        const priceOfArchitectInPORB = web3.utils.toWei("2", "ether");
        await PORBInstance.mint(owner, initialPORBAmountMintedToOwner);
        await PORBInstance.approve(ArchitectInstance.address, priceOfArchitectInPORB);
        await ArchitectInstance.mintWithPORB();
        const ownerOfMintedArchitect = await ArchitectInstance.ownerOf("0");
        const balanceOfPORBVault = (await PORBInstance.balanceOf(account9)).toString();

        expect(ownerOfMintedArchitect).to.equal(owner);
        expect(balanceOfPORBVault).to.equal(priceOfArchitectInPORB);
    });

    it("only allows the owner to change mintPriceInPORB", async () => {
        const newMintPriceInPORB = web3.utils.toWei("5", "ether");

        // Should fail since caller is not the owner
        await localExpect(ArchitectInstance.setMintPriceInPORB(newMintPriceInPORB, { from: account1 })).to.eventually.be.rejected;

        await localExpect(ArchitectInstance.setMintPriceInPORB(newMintPriceInPORB, { from: owner })).to.eventually.be.fulfilled;

        const contractMintPriceInPORB = (await ArchitectInstance.mintPriceInPORB()).toString();
        expect(contractMintPriceInPORB).to.equal(newMintPriceInPORB);
    });

    it("only allows the owner to change the PORB contract address", async () => {
        const newPORBInstance = await PORB.new(account1, owner);

        // Should fail since caller is not the owner
        await localExpect(ArchitectInstance.setPORB(newPORBInstance.address, { from: account1 })).to.eventually.be.rejected;

        await localExpect(ArchitectInstance.setPORB(newPORBInstance.address, { from: owner })).to.eventually.be.fulfilled;

        const contractPORBAddress = (await ArchitectInstance.PORB()).toString();
        expect(contractPORBAddress).to.equal(newPORBInstance.address);
    });

    it("only allows the owner to change the PORB vault", async () => {
        // Should fail since caller is not the owner
        await localExpect(ArchitectInstance.setPORBVault(account2, { from: account1 })).to.eventually.be.rejected;

        await localExpect(ArchitectInstance.setPORBVault(account2, { from: owner })).to.eventually.be.fulfilled;

        const contractPORBVault = (await ArchitectInstance.PORBVault()).toString();
        expect(contractPORBVault).to.equal(account2);
    });

    // @TODO: Update this test when we have the final base URI implemented in the contract
    it("generates a valid token URI", async () => {
        const initialPORBAmountMintedToOwner = web3.utils.toWei("1000000000", "ether");
        const priceOfArchitectInPORB = web3.utils.toWei("2", "ether");
        await PORBInstance.mint(owner, initialPORBAmountMintedToOwner);
        await PORBInstance.approve(ArchitectInstance.address, priceOfArchitectInPORB);
        await ArchitectInstance.mintWithPORB();

        const tokenURI = await ArchitectInstance.tokenURI("0");
        expect(tokenURI).to.equal("https://www.portalfantasy.io/0");
    });

    it("allows only the owner to change the base URI", async () => {
        const initialPORBAmountMintedToOwner = web3.utils.toWei("1000000000", "ether");
        const priceOfArchitectInPORB = web3.utils.toWei("2", "ether");
        await PORBInstance.mint(owner, initialPORBAmountMintedToOwner);
        await PORBInstance.approve(ArchitectInstance.address, priceOfArchitectInPORB);
        await ArchitectInstance.mintWithPORB();

        let tokenURI = await ArchitectInstance.tokenURI("0");
        expect(tokenURI).to.equal("https://www.portalfantasy.io/0");

        // Expect this to fail, as only the owner can change the base URI
        await localExpect(ArchitectInstance.setBaseURIString("https://www.foo.com/", { from: account1 })).to.eventually.be.rejected;

        await localExpect(ArchitectInstance.setBaseURIString("https://www.bar.com/", { from: owner })).to.eventually.be.fulfilled;

        tokenURI = await ArchitectInstance.tokenURI("0");
        expect(tokenURI).to.equal("https://www.bar.com/0");
    });
});
