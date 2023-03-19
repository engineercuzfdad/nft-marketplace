// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

// custom  Error

error NftMarketPlace__AlreadyListed(address nftAddress, uint256 tokenId);
error NftMarketPlace__PriceNotMet(
    address nftAddress,
    uint256 tokenId,
    uint256 price
);
error NftMarketPlace__PriceMustBeAboveZero();
error NftMarketPlace__NotApprovedForMarketPlace();
error NftMarketPlace__NotOwner();
error NftMarketPlace__NotListed(address nftAddress, uint256 tokenId);
error NftMarketPlace__NoProceeds();
error NftMarketPlace__TransactionFailed();

contract NftMarketPlace is ReentrancyGuard {
    // Type  Declaration

    struct Listing {
        address seller;
        uint256 price;
    }

    // state variables

    // nftAddress => tokenId=> seller&price
    mapping(address => mapping(uint256 => Listing)) private s_listing;

    // address => amount
    mapping(address => uint256) private s_proceeds;

    //////////////
    //modifiers///
    //////////////

    modifier Owner(
        address nftAddress,
        uint256 tokenId,
        address spender
    ) {
        IERC721 nft = IERC721(nftAddress);
        address owner = nft.ownerOf(tokenId);
        if (owner != spender) {
            revert NftMarketPlace__NotOwner();
        }
        _;
    }

    modifier NotListed(address nftAddress, uint256 tokenId) {
        Listing memory listing = s_listing[nftAddress][tokenId];
        if (listing.price > 0) {
            revert NftMarketPlace__AlreadyListed(nftAddress, tokenId);
        }
        _;
    }

    modifier IsListed(address nftAddress, uint256 tokenId) {
        Listing memory listed = s_listing[nftAddress][tokenId];
        if (listed.price <= 0) {
            revert NftMarketPlace__NotListed(nftAddress, tokenId);
        }
        _;
    }

    //events

    event ItemListed(
        address indexed nftAddress,
        address indexed seller,
        uint256 indexed tokenId,
        uint256 price
    );

    event ItemBought(
        address indexed buyer,
        address indexed nftAddress,
        uint256 indexed tokenId,
        uint256 price
    );

    event ItemCanceled(
        address indexed owner,
        address indexed nftAddress,
        uint256 indexedtokenId
    );

    /////////////////////
    // Main Functions///
    ////////////////////

    function listItem(
        address nftAddress,
        uint256 tokenId,
        uint256 price
    )
        external
        Owner(nftAddress, tokenId, msg.sender)
        NotListed(nftAddress, tokenId)
    {
        if (price <= 0) {
            revert NftMarketPlace__PriceMustBeAboveZero();
        }
        IERC721 nft = IERC721(nftAddress);
        if (nft.getApproved(tokenId) != address(this)) {
            revert NftMarketPlace__NotApprovedForMarketPlace();
        }

        s_listing[nftAddress][tokenId] = Listing(msg.sender, price);

        emit ItemListed(nftAddress, msg.sender, tokenId, price);
    }

    function buyItem(
        address nftAddress,
        uint256 tokenId
    ) external payable IsListed(nftAddress, tokenId) nonReentrant {
        Listing memory listedItem = s_listing[nftAddress][tokenId];
        if (msg.value < listedItem.price) {
            revert NftMarketPlace__PriceNotMet(
                nftAddress,
                tokenId,
                listedItem.price
            );
        }

        s_proceeds[msg.sender] += msg.value;
        delete (s_listing[nftAddress][tokenId]);
        IERC721(nftAddress).safeTransferFrom(
            listedItem.seller,
            msg.sender,
            tokenId
        );
        emit ItemBought(msg.sender, nftAddress, tokenId, listedItem.price);
    }

    function cancelItem(
        address nftAddress,
        uint256 tokenId
    )
        external
        IsListed(nftAddress, tokenId)
        Owner(nftAddress, tokenId, msg.sender)
    {
        delete (s_listing[nftAddress][tokenId]);
        emit ItemCanceled(msg.sender, nftAddress, tokenId);
    }

    function updateItem(
        address nftAddress,
        uint256 tokenId,
        uint256 newPrice
    )
        external
        IsListed(nftAddress, tokenId)
        Owner(nftAddress, tokenId, msg.sender)
    {
        if (newPrice <= 0) {
            revert NftMarketPlace__PriceMustBeAboveZero();
        }
        s_listing[nftAddress][tokenId].price = newPrice;
        emit ItemListed(nftAddress, msg.sender, tokenId, newPrice);
    }

    function withdrawProceeds() external nonReentrant {
        uint256 proceeds = s_proceeds[msg.sender];
        if (proceeds <= 0) {
            revert NftMarketPlace__NoProceeds();
        }
        s_proceeds[msg.sender] = 0;
        (bool success, ) = payable(msg.sender).call{value: proceeds}("");
        if (!success) {
            revert NftMarketPlace__TransactionFailed();
        }
    }

    /////////////////////
    // Getter Functions//
    /////////////////////

    function getListing(
        address nftAddress,
        uint256 tokenId
    ) external view returns (Listing memory) {
        return s_listing[nftAddress][tokenId];
    }

    function getProceeds(address seller) external view returns (uint256) {
        return s_proceeds[seller];
    }
}
