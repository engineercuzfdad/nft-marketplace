const { expect, assert } = require("chai");
const { network, ethers, deployments } = require("hardhat");
const { developmentChains } = require("../../helper-hardhat-config");

!developmentChains.includes(network.name)
  ? describe.skip
  : describe("NftMarketPlace Unit Test", function () {
      let deployer,
        user,
        basicNft,
        basicNftContract,
        nftMarketPlace,
        nftMarketPlaceContract;
      const TOKEN_ID = 0;
      const PRICE = ethers.utils.parseEther("0.1");
      beforeEach(async () => {
        const accounts = await ethers.getSigners();
        deployer = accounts[0];
        user = accounts[1];
        await deployments.fixture(["all"]);
        nftMarketPlace = await ethers.getContract("NftMarketPlace");
        nftMarketPlaceContract = nftMarketPlace.connect(deployer);
        basicNft = await ethers.getContract("BasicNft");
        basicNftContract = basicNft.connect(deployer);
        await basicNft.mintNft();
        await basicNft.approve(nftMarketPlaceContract.address, TOKEN_ID);
      });

      describe("ListItem", function () {
        it("emits an event after listing an item", async () => {
          expect(
            await nftMarketPlace.listItem(basicNft.address, TOKEN_ID, PRICE)
          ).to.emit(nftMarketPlace, "ItemListed");
        });

        it("only allows items that haven't been listed", async () => {
          await nftMarketPlace.listItem(basicNft.address, TOKEN_ID, PRICE);
          await expect(
            nftMarketPlace.listItem(basicNft.address, TOKEN_ID, PRICE)
          ).to.be.revertedWithCustomError(
            nftMarketPlace,
            "NftMarketPlace__AlreadyListed"
          );
        });

        it("only allows owners to list items", async () => {
          nftMarketPlace = nftMarketPlaceContract.connect(user); // ?? doubt
          await basicNft.approve(user.address, TOKEN_ID);
          await expect(
            nftMarketPlace.listItem(basicNft.address, TOKEN_ID, PRICE)
          ).to.be.revertedWithCustomError(
            nftMarketPlace,
            "NftMarketPlace__NotOwner"
          );
        });
        it("needs approval to list item", async () => {
          await basicNft.approve(ethers.constants.AddressZero, TOKEN_ID);
          await expect(
            nftMarketPlace.listItem(basicNft.address, TOKEN_ID, PRICE)
          ).to.be.revertedWithCustomError(
            nftMarketPlace,
            "NftMarketPlace__NotApprovedForMarketPlace"
          );
        });
        it("updates Listing with seller and price", async () => {
          await nftMarketPlace.listItem(basicNft.address, TOKEN_ID, PRICE);
          const listing = await nftMarketPlace.getListing(
            basicNft.address,
            TOKEN_ID
          );
          assert.equal(listing.price.toString(), PRICE.toString());
          assert.equal(listing.seller.toString(), deployer.address);
        });
      });

      describe("cancelItem", function () {
        it("reverts if there item is not listed", async () => {
          await expect(
            nftMarketPlace.cancelItem(basicNft.address, TOKEN_ID)
          ).to.be.revertedWithCustomError(
            nftMarketPlace,
            "NftMarketPlace__NotListed"
          );
        });
        it("reverts if anyone but the owner tries to call", async () => {
          await nftMarketPlace.listItem(basicNft.address, TOKEN_ID, PRICE);
          nftMarketPlace = nftMarketPlaceContract.connect(user);
          await basicNft.approve(user.address, TOKEN_ID);
          await expect(
            nftMarketPlace.cancelItem(basicNft.address, TOKEN_ID)
          ).to.be.revertedWithCustomError(
            nftMarketPlace,
            "NftMarketPlace__NotOwner"
          );
        });
        it("emits event and removes listing", async () => {
          await nftMarketPlace.listItem(basicNft.address, TOKEN_ID, PRICE);
          expect(
            await nftMarketPlace.cancelItem(basicNft.address, TOKEN_ID)
          ).to.emit("ItemCanceled");
          const listing = await nftMarketPlace.getListing(
            basicNft.address,
            TOKEN_ID
          );
          assert.equal(listing.price.toString(), "0");
        });
      });
      describe("buyItem", function () {
        it("reverts if item is not listed", async () => {
          await expect(
            nftMarketPlace.buyItem(basicNft.address, TOKEN_ID)
          ).to.be.revertedWithCustomError(
            nftMarketPlace,
            "NftMarketPlace__NotListed"
          );
        });
        it("reverts if price is not met", async () => {
          await nftMarketPlace.listItem(basicNft.address, TOKEN_ID, PRICE);
          await expect(
            nftMarketPlace.buyItem(basicNft.address, TOKEN_ID)
          ).to.be.revertedWithCustomError(
            nftMarketPlace,
            "NftMarketPlace__PriceNotMet"
          );
        });
        it("transfers the nft to the buyer and updates internal proceeds record", async function () {
          await nftMarketPlace.listItem(basicNft.address, TOKEN_ID, PRICE);
          nftMarketPlace = nftMarketPlaceContract.connect(user);
          expect(
            await nftMarketPlace.buyItem(basicNft.address, TOKEN_ID, {
              value: PRICE,
            })
          ).to.emit("ItemBought");
          const newOwner = await basicNft.ownerOf(TOKEN_ID);
          const deployerProceeds = await nftMarketPlace.getProceeds(
            deployer.address
          );
          assert.equal(newOwner.toString(), user.address);
          assert.equal(deployerProceeds.toString(), PRICE.toString());
        });
      });
      describe("updateListing", function () {
        it("must be owner and listed", async () => {
          await expect(
            nftMarketPlace.updateItem(basicNft.address, TOKEN_ID, PRICE)
          ).to.be.revertedWithCustomError(
            nftMarketPlace,
            "NftMarketPlace__NotListed"
          );
          await nftMarketPlace.listItem(basicNft.address, TOKEN_ID, PRICE);
          nftMarketPlace = nftMarketPlaceContract.connect(user);
          await expect(
            nftMarketPlace.updateItem(basicNft.address, TOKEN_ID, PRICE)
          ).to.be.revertedWithCustomError(
            nftMarketPlace,
            "NftMarketPlace__NotOwner"
          );
        });
        it("updates the price of the item", async () => {
          const updatePrice = ethers.utils.parseEther("0.2");
          await nftMarketPlace.listItem(basicNft.address, TOKEN_ID, PRICE);
          expect(
            await nftMarketPlace.updateItem(
              basicNft.address,
              TOKEN_ID,
              updatePrice
            )
          ).to.emit("ItemListed");
          const listing = await nftMarketPlace.getListing(
            basicNft.address,
            TOKEN_ID
          );
          assert.equal(listing.price.toString(), updatePrice.toString());
        });
      });
      describe("WithdrawProceeds", function () {
        it("dosen't allow 0 proceeds withdrawl", async () => {
          await expect(
            nftMarketPlace.withdrawProceeds()
          ).to.be.revertedWithCustomError(
            nftMarketPlace,
            "NftMarketPlace__NoProceeds"
          );
          it("withdraw proceeds", async () => {
            await nftMarketPlace.listItem(basicNft.address, TOKEN_ID, PRICE);
            nftMarketPlace = nftMarketPlaceContract.connect(user);
            await nftMarketPlace.buyItem(basicNft.address, TOKEN_ID, {
              value: PRICE,
            });
            nftMarketPlace = nftMarketPlaceContract.connect(deployer);

            const desployerProceedsBefore = await nftMarketPlace.getProceeds(
              deployer.address
            );
            const deployerBalanceBefore = await deployer.getBalance();
            const txResponse = await nftMarketPlace.withdrawProceeds();
            const txReceipt = await txResponse(1);
            const { gasUsed, effectiveGasPrice } = txReceipt;
            const gasCost = gasUsed.mul(effectiveGasPrice);
            const deployerBalanceAfter = await deployer.getBalance();
            assert.equal(
              deployerBalanceAfter.add(gasCost).toString(),
              deployerBalanceBefore.add(deployerBalanceBefore).toString()
            );
          });
        });
      });
    });
