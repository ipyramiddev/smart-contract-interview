// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./lib/Counters.sol";
import "./lib/ERC721Enumerable.sol";
import "./lib/IERC20.sol";
import "./lib/Ownable.sol";
import "./lib/Pausable.sol";

contract Architect is ERC721Enumerable, Ownable, Pausable {
    using Counters for Counters.Counter;

    Counters.Counter private _tokenIdCounter;

    string public baseURIString;

    // @TODO: Set the actual initial price in AVAX to mint an Architect
    // @TODO: We likely don't need to allow minting via AVAX. Find out and remove if necessary
    // 2 AVAX initial price
    uint256 public mintPriceInAVAX = 2000000000000000000;

    // @TODO: Set the actual initial price in PORB to mint a Architect
    // 2 PORB initial price
    uint256 public mintPriceInPORB = 2000000000000000000;

    // The address of the PORB contract
    IERC20 public PORB;

    // The vault contract to deposit earned PORB/AVAX
    address public vault;

    constructor(address _PORB, address _vault)
        ERC721("Portal Fantasy Architect", "PHAR")
    {
        // @TODO: Have added a placeholder baseURIString. Need to replace with actual when it's implemented.
        baseURIString = "https://www.portalfantasy.io/";
        PORB = IERC20(_PORB);
        vault = _vault;
    }

    // @TODO: Have added a placeholder baseURI. Need to replace with actual when it's implemented.
    /**
     * Overriding the parent _baseURI() with required baseURI
     */
    function _baseURI() internal view virtual override returns (string memory) {
        return baseURIString;
    }

    /**
     * Allows the caller to mint a token with a payment in AVAX
     */
    function mintWithAVAX() external payable whenNotPaused {
        require(msg.value == mintPriceInAVAX, "Invalid payment amount");
        payable(vault).transfer(msg.value);
        _safeMint(_msgSender(), _tokenIdCounter.current());
        _tokenIdCounter.increment();
    }

    /**
     * Allows the caller to mint a token with a payment in PORB
     */
    function mintWithPORB() external whenNotPaused {
        PORB.transferFrom(_msgSender(), vault, mintPriceInPORB);
        _safeMint(_msgSender(), _tokenIdCounter.current());
        _tokenIdCounter.increment();
    }

    /**
     * Allows the owner to set a new base URI
     * @param _baseURIString the new base URI to point to
     */
    function setBaseURIString(string calldata _baseURIString)
        external
        onlyOwner
    {
        baseURIString = _baseURIString;
    }

    /**
     * Allows the owner to set a new mint price in AVAX
     * @param _mintPriceInAVAX the new mint price
     */
    function setMintPriceInAVAX(uint256 _mintPriceInAVAX) external onlyOwner {
        mintPriceInAVAX = _mintPriceInAVAX;
    }

    /**
     * Allows the owner to set a new mint price in PORB
     * @param _mintPriceInPORB the new mint price
     */
    function setMintPriceInPORB(uint256 _mintPriceInPORB) external onlyOwner {
        mintPriceInPORB = _mintPriceInPORB;
    }

    /**
     * Enable the owner to pause / unpause minting
     * @param _paused paused when set to `true`, unpause when set to `false`
     */
    function setPaused(bool _paused) external onlyOwner {
        if (_paused) _pause();
        else _unpause();
    }

    /**
     * Allows the owner to set a new PORB contract address to point to
     * @param _PORB the new PORB address
     */
    function setPORB(address _PORB) external onlyOwner {
        PORB = IERC20(_PORB);
    }

    /**
     * Allows the owner to set a new vault to deposit earned PORB/AVAX
     * @param _vault the new address for the vault
     */
    function setVault(address _vault) external onlyOwner {
        vault = _vault;
    }
}
