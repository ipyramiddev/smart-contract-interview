// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

/**
 * @dev Some marketplaces support a collection URI and corresponding metadata
 */
abstract contract ContractURIStorage {
    string private contractURIString;

    /**
     * @dev Marketplaces like OpenSea enforce royalties via the following metadata structure
     *
     * {
     *   "name": "OpenSea Creatures",
     *   "description": "OpenSea Creatures are adorable aquatic beings primarily for demonstrating what can be done using the OpenSea platform. Adopt one today to try out all the OpenSea buying, selling, and bidding feature set.",
     *   "image": "external-link-url/image.png",
     *   "external_link": "external-link-url",
     *   "seller_fee_basis_points": 100, # Indicates a 1% seller fee.
     *   "fee_recipient": "0xA97F337c39cccE66adfeCB2BF99C1DdC54C2D721" # Where seller fees will be paid to.
     * }
     */
    function contractURI() public view virtual returns (string memory) {
        return contractURIString;
    }

    /**
     * @dev Sets `_tokenURI` as the tokenURI of `tokenId`.
     *
     * Requirements:
     *
     * - `tokenId` must exist.
     */
    function _setContractURIString(string memory _contractURIString)
        internal
        virtual
    {
        contractURIString = _contractURIString;
    }
}
