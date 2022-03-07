import { localExpect } from "./lib/test-libraries";
import { HeroInstance, PORBInstance } from "../types/truffle-contracts";

const Hero = artifacts.require("Hero");
const PORB = artifacts.require("PORB");

contract.skip("Hero.sol", ([owner, account1, account2, account3, account4, account5, account6, account7, account8, account9]) => {
    let HeroInstance: HeroInstance;
    let PORBInstance: PORBInstance;

    beforeEach(async () => {
        PORBInstance = await PORB.new(account1, owner);
        HeroInstance = await Hero.new(PORBInstance.address, account9);
    });

    it("has token name set to 'Portal Fantasy Hero'", async () => {
        const tokenName = await HeroInstance.name();
        expect(tokenName).to.equal("Portal Fantasy Hero");
    });

    it("has token symbol set to 'PHRO'", async () => {
        const tokenSymbol = await HeroInstance.symbol();
        expect(tokenSymbol).to.equal("PHRO");
    });

    it("can only be paused/unpaused by the owner", async () => {
        let isPaused = await HeroInstance.paused();
        expect(isPaused).to.be.false;

        // Non-owner account attempting to pause should fail
        await localExpect(HeroInstance.setPaused(true, { from: account1 })).to.be.rejected;

        await HeroInstance.setPaused(true);

        isPaused = await HeroInstance.paused();
        expect(isPaused).to.be.true;

        // Non-owner account attempting to unpause should fail
        await localExpect(HeroInstance.setPaused(false, { from: account1 })).to.be.rejected;

        await HeroInstance.setPaused(false);

        isPaused = await HeroInstance.paused();
        expect(isPaused).to.be.false;
    });

    it("allows a Hero NFT to be minted with payment in PORB", async () => {
        const initialPORBAmountMintedToOwner = web3.utils.toWei("1000000000", "ether");
        const priceOfHeroInPORB = web3.utils.toWei("2", "ether");
        await PORBInstance.mint(owner, initialPORBAmountMintedToOwner);
        await PORBInstance.approve(HeroInstance.address, priceOfHeroInPORB);
        await HeroInstance.mintWithPORB();
        const ownerOfMintedHero = await HeroInstance.ownerOf("0");
        const balanceOfPORBVault = (await PORBInstance.balanceOf(account9)).toString();

        expect(ownerOfMintedHero).to.equal(owner);
        expect(balanceOfPORBVault).to.equal(priceOfHeroInPORB);
    });

    it("only allows the owner to change mintPriceInPORB", async () => {
        const newMintPriceInPORB = web3.utils.toWei("5", "ether");

        // Should fail since caller is not the owner
        await localExpect(HeroInstance.setMintPriceInPORB(newMintPriceInPORB, { from: account1 })).to.eventually.be.rejected;

        await localExpect(HeroInstance.setMintPriceInPORB(newMintPriceInPORB, { from: owner })).to.eventually.be.fulfilled;

        const contractMintPriceInPORB = (await HeroInstance.mintPriceInPORB()).toString();
        expect(contractMintPriceInPORB).to.equal(newMintPriceInPORB);
    });

    it("only allows the owner to change the PORB contract address", async () => {
        const newPORBInstance = await PORB.new(account1, owner);

        // Should fail since caller is not the owner
        await localExpect(HeroInstance.setPORB(newPORBInstance.address, { from: account1 })).to.eventually.be.rejected;

        await localExpect(HeroInstance.setPORB(newPORBInstance.address, { from: owner })).to.eventually.be.fulfilled;

        const contractPORBAddress = (await HeroInstance.PORB()).toString();
        expect(contractPORBAddress).to.equal(newPORBInstance.address);
    });

    it("only allows the owner to change the PORB vault", async () => {
        // Should fail since caller is not the owner
        await localExpect(HeroInstance.setPORBVault(account2, { from: account1 })).to.eventually.be.rejected;

        await localExpect(HeroInstance.setPORBVault(account2, { from: owner })).to.eventually.be.fulfilled;

        const contractPORBVault = (await HeroInstance.PORBVault()).toString();
        expect(contractPORBVault).to.equal(account2);
    });

    // @TODO: Update this test when we have the final base URI implemented in the contract
    it("generates a valid token URI", async () => {
        const initialPORBAmountMintedToOwner = web3.utils.toWei("1000000000", "ether");
        const priceOfHeroInPORB = web3.utils.toWei("2", "ether");
        await PORBInstance.mint(owner, initialPORBAmountMintedToOwner);
        await PORBInstance.approve(HeroInstance.address, priceOfHeroInPORB);
        await HeroInstance.mintWithPORB();

        const tokenURI = await HeroInstance.tokenURI("0");
        expect(tokenURI).to.equal("https://www.portalfantasy.io/0");
    });

    it("allows only the owner to change the base URI", async () => {
        const initialPORBAmountMintedToOwner = web3.utils.toWei("1000000000", "ether");
        const priceOfHeroInPORB = web3.utils.toWei("2", "ether");
        await PORBInstance.mint(owner, initialPORBAmountMintedToOwner);
        await PORBInstance.approve(HeroInstance.address, priceOfHeroInPORB);
        await HeroInstance.mintWithPORB();

        let tokenURI = await HeroInstance.tokenURI("0");
        expect(tokenURI).to.equal("https://www.portalfantasy.io/0");

        // Expect this to fail, as only the owner can change the base URI
        await localExpect(HeroInstance.setBaseURIString("https://www.foo.com/", { from: account1 })).to.eventually.be.rejected;

        await localExpect(HeroInstance.setBaseURIString("https://www.bar.com/", { from: owner })).to.eventually.be.fulfilled;

        tokenURI = await HeroInstance.tokenURI("0");
        expect(tokenURI).to.equal("https://www.bar.com/0");
    });
});
