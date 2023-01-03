const { assert, expect } = require("chai");
const { network, deployments, ethers, getNamedAccounts } = require("hardhat");
const { developmentChains } = require("../../helper-hardhat-config");

!developmentChains.includes(network.name)
  ? describe.skip
  : describe("Nft Marketplace Tests", function () {
      let nftMarketplace, basicNft, deployer, player;
      const PRICE = ethers.utils.parseEther("0.1");
      const TOKEN_ID = 0;
      beforeEach(async function () {
        deployer = (await getNamedAccounts()).deployer;
        const accounts = await ethers.getSigners();
        // const provider = await ethers.getDefaultProvider();
        player = accounts[1];
        await deployments.fixture(["all"]);
        nftMarketplace = await ethers.getContract("NftMarketplace");
        basicNft = await ethers.getContract("BasicNft");
        await basicNft.mintNft();
        await basicNft.approve(nftMarketplace.address, TOKEN_ID);
      });
      it("lists and can be bought", async function () {
        await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE);
        const playerConnectedNftMarketplace = nftMarketplace.connect(player);
        await playerConnectedNftMarketplace.buyItem(
          basicNft.address,
          TOKEN_ID,
          {
            value: PRICE,
          }
        );
        const newOwner = await basicNft.ownerOf(TOKEN_ID);
        const deployerProceeds = await nftMarketplace.getProceeds(deployer);
        assert(newOwner.toString() === player.address);
        assert(deployerProceeds.toString() === PRICE.toString());
      });
      it("cancels listings", async function () {
        await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE);
        await expect(
          nftMarketplace.cancelListing(basicNft.address, TOKEN_ID)
        ).to.emit(nftMarketplace, "ItemCancelled");
      });
      it("updates listings", async function () {
        const NEW_PRICE = await ethers.utils.parseEther("0.2");
        await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE);
        await expect(
          nftMarketplace.updateListing(basicNft.address, TOKEN_ID, NEW_PRICE)
        )
          .to.emit(nftMarketplace, "ItemListed")
          .withArgs(deployer, basicNft.address, TOKEN_ID, NEW_PRICE);
      });
      it("allows deployer to withdraw proceeds", async function () {
        await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE);
        const playerConnectedNftMarketplace = nftMarketplace.connect(player);
        await playerConnectedNftMarketplace.buyItem(
          basicNft.address,
          TOKEN_ID,
          {
            value: PRICE,
          }
        );
        const INITIAL_BALANCE = await ethers.provider.getBalance(deployer);
        const PROCEEDS = await nftMarketplace.getProceeds(deployer);
        const txResponse = await nftMarketplace.withdrawProceeds();
        const txReceipt = await txResponse.wait(1);
        const { gasUsed, effectiveGasPrice } = txReceipt;
        const gasCost = gasUsed.mul(effectiveGasPrice);
        const FINAL_BALANCE = await ethers.provider.getBalance(deployer);
        assert.equal(
          INITIAL_BALANCE.add(PROCEEDS).toString(),
          FINAL_BALANCE.add(gasCost).toString()
        );
      });
    });
