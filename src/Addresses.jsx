import { getContractAddress } from "@ethersproject/address";

const NATIVE_TOKEN = "0xC9BdeEd33CD01541e1eeD10f90519d2C06Fe3feB";
const BTC = "0xF4eB217Ba2454613b15dBdea6e5f22276410e89e";
const NEAR = "0xc42c30ac6cc15fac9bd938618bcaa1a1fae8501d";
const NDOL = "0xC86Ca2BB9C9c9c9F140d832dE00BfA9e153FA1e3";
const Necc = "0x6EBA841F1201fFDDe7DDC2ba995D3308f6C4aEa0";
const sNecc = "0xA642375Cc15249A81da9c435fB4eDD8A9343ce7F";
const nNecc = "0x449f661c53aE0611a24c2883a910A563A7e42489";
const ExchangeDiamond = "0xc14D994fe7C5858c93936cc3bD42bb9467d6fB2C";
const TreasuryDiamond = "0x226Bf5293692610692E2C996C9875C914d2A7f73";
const BondDiamond = "0xFBe0421c53706746151ACa2Cf22F81Dc41262519";
const MintFarm = "0x042a7086e63A6d4e4544097053a04Fca4f658645";
const MintDistributor = "0x046D6b2178D0AFDa6cb01e8Ba4f5744487069B91";
const NDOL_NNECC_PAIR = "0xad5779da21408E70973Ac56ab91Dbf201B45b652";

const BTC_RINKEBY = "0x577D296678535e4903D59A4C929B718e1D575e0A";
const NATIVE_TOKEN_RINKEBY = "0xc778417e063141139fce010982780140aa0cd5ab";
const NDOL_RINKEBY = "0x1D468dd42600Bf94dA66615352D777e174C07099";
const ExchangeDiamond_RINKEBY = "0xc7BB14F83a41B80E8183E7a098777987730dAf67";
const TreasuryDiamond_RINKEBY = "0x8e1755992daAdD5Bbb5A672FcEd5e7A0509e35f6";
const BondDiamond_RINKEBY = "0x77c1E71787426FC66DFb593Ac1Bde667297CA324";
const Necc_RINKEBY = "0x655e4ceB40B213320B6a7474Cc57815f445a380C";
const sNecc_RINKEBY = "0x8D37C97a525F8B16715C14128D53AD63aF857c62";
const nNecc_RINKEBY = "0xB10A645bc828023198baD304A4e4FC1D4a5EEc4f";
const MintFarm_RINKEBY = "0x35Ad91085EdcA183526028273e494a7Dc90e556A";
const MintDistributor_RINKEBY = "0x7666aed6604a264396Ff58C023Db1abb20a0a10A";
/*
{ VM: '0xf2480259A5204F20CAd350B3B0F0EAe456FEFB02' }
{ TestableVM: '0x67B6BdDd33A5A174289F47bDD1c49d9F3434669e' }
{ VaultFacet: '0xA7C35002a1f5271D12b5A0Bf2F570F16A4a15EA4' }
{ VaultNdolFacet: '0xCe75133c244ac04a8BAF11e462112E4623c8fBD1' }
{ VaultConfigFacet: '0xE10a1a549248d9580EAE4a6C5879Ac5357836d8a' }
{ VaultLib: '0x26d43BFdC817492AE2CDBF4f2dd3a0390E7303a5' }
{ RouterFacet: '0x5EcBC326a791443dDB9Ddf94aA3E7458A6A959cF' }
{ RouterLib: '0xb2520C75460240501Ab1ad314f6A4059884bF93b' }
{ ReaderFacet: '0x0580cEd4F4d45591682223D655FEBE5A967C18a8' }
{ VaultPriceFeedFacet: '0x48160Df9E51a98950A46908CeB6BcDf9f349E352' }
{ Diamantaire: '0xB812f503607Ee2259E9607Cb5E5836B550ac6492' }
{
  ExchangeDiamond_DiamondProxy: '0xc14D994fe7C5858c93936cc3bD42bb9467d6fB2C'
}
{ ExchangeDiamond: '0xc14D994fe7C5858c93936cc3bD42bb9467d6fB2C' }
{ NdolFacet: '0xC63157ad776a7830C7CAa638681C31fDbCf50f78' }
{
  NdolDiamond_DiamondProxy: '0xC86Ca2BB9C9c9c9F140d832dE00BfA9e153FA1e3'
}
{ NdolDiamond: '0xC86Ca2BB9C9c9c9F140d832dE00BfA9e153FA1e3' }
{ TreasuryFacet: '0x248Fb82741C87FF38177B1DcF88599BeE9cc1f0B' }
{
  BondingCalculatorFacet: '0xB6689F19E76B6ce12dD6De881c3f3758307bC2DE'
}
{
  TreasuryDiamond_DiamondProxy: '0x226Bf5293692610692E2C996C9875C914d2A7f73'
}
{ TreasuryDiamond: '0x226Bf5293692610692E2C996C9875C914d2A7f73' }
{ NeccFacet: '0xeb39EEc833c34f264e75b8fE18328e2Ef992099D' }
{
  NeccDiamond_DiamondProxy: '0x6EBA841F1201fFDDe7DDC2ba995D3308f6C4aEa0'
}
{ NeccDiamond: '0x6EBA841F1201fFDDe7DDC2ba995D3308f6C4aEa0' }
{ sNeccFacet: '0xDB0D8991482A0a58c0C8e2e6d25b6c9923688B07' }
{
  sNeccDiamond_DiamondProxy: '0xA642375Cc15249A81da9c435fB4eDD8A9343ce7F'
}
{ sNeccDiamond: '0xA642375Cc15249A81da9c435fB4eDD8A9343ce7F' }
{ nNeccFacet: '0x0f7E1FF02ee74F512ACAAADFDD22e4C173e7d67d' }
{
  nNeccDiamond_DiamondProxy: '0x449f661c53aE0611a24c2883a910A563A7e42489'
}
{ nNeccDiamond: '0x449f661c53aE0611a24c2883a910A563A7e42489' }
{ BondConfigFacet: '0x0440E856119f9e48bcd073B1cef2bB5d2Fd92506' }
{ BondDepositoryLib: '0x8a5e3c462CDD1C1b7a292Cda6B19faa7920bB228' }
{ BondDepositoryFacet: '0x18350648AE02721F0F002417C6f9D4251584D431' }
{ DistributorFacet: '0x43605122684587648d69c50216448CCd3A950b4A' }
{ StakingFacet: '0x46f6286bCedbb698c5D180fab5D1E5D359944a10' }
{
  BondDepositoryDiamond_DiamondProxy: '0xFBe0421c53706746151ACa2Cf22F81Dc41262519'
}
{ BondDepositoryDiamond: '0xFBe0421c53706746151ACa2Cf22F81Dc41262519' }
{ MintFarm: '0x042a7086e63A6d4e4544097053a04Fca4f658645' }
{ MintDistributor: '0x046D6b2178D0AFDa6cb01e8Ba4f5744487069B91' }

*/

const CONTRACTS = {
  // RINKEBY
  4: {
    ExchangeDiamond: ExchangeDiamond_RINKEBY,
    Reader: ExchangeDiamond_RINKEBY, // "0x122cBF79F133FC02325E74EE7c0f7C97F44a721A", //
    VaultPriceFeed: ExchangeDiamond_RINKEBY, // "0x633458Cc0B4bb4483A22E5f9DFeD6142D9816039",
    Vault: ExchangeDiamond_RINKEBY, //"0x1D7a7a5E7BFeB7D85D3e49C040F723c9ff40D9A3", //
    Router: ExchangeDiamond_RINKEBY, //"0xEeD32727Ae773eb771535Ed0D48355BB873ED583",

    Treasury: TreasuryDiamond_RINKEBY, //"0x4cf7ae070ffb2db874cb9f6b731cb30488a8585e",
    BondingCalculator: BondDiamond_RINKEBY, //"0x963c898bd6a53fc939c3edaed730088fb471b13e",
    Distributor: BondDiamond_RINKEBY, //"0x026e31efc227bf35e73750fb904bd467f2c5c480",
    NeccStaking: BondDiamond_RINKEBY, //"0xeef4de0b6615beb1942cade658cfce3cabf7bca1",
    StakingWarmup: BondDiamond_RINKEBY, //"0xda4053d795d3421d5ecd11740b08f15f8c0bea18",
    NDOLBond: BondDiamond_RINKEBY, //"0x17eaf444a7217afc70347a1157ae500a576ed899",
    MintFarm: MintFarm_RINKEBY,
    MintDistributor: MintDistributor_RINKEBY,

    NATIVE_TOKEN: NATIVE_TOKEN_RINKEBY, // WETH
    BTC: BTC_RINKEBY, // WETH
    Necc: Necc_RINKEBY,
    sNecc: sNecc_RINKEBY,
    nNecc: nNecc_RINKEBY,
    NDOL: NDOL_RINKEBY,
    NDOL_NNECC_PAIR: NDOL_NNECC_PAIR,

    VM: "0x6A633b16E042e15961D9FDA0d12BA2e3A1355B49",
    TestableVM: "0xF2bB0eE9E23459f5098A77e2Ad26d22F475871e6",
    AmmFactoryV2: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D", // Uniswap V2
    AmmFactory: "0x6725f303b657a9451d8ba641348b6761a6cc7a17",
    OrderBook: "0x0000000000000000000000000000000000000000",
    OrderBookReader: "0x0000000000000000000000000000000000000000",
  },
  1337: {
    ExchangeDiamond,
    Reader: ExchangeDiamond,
    VaultPriceFeed: ExchangeDiamond,
    Vault: ExchangeDiamond,
    Router: ExchangeDiamond,

    Treasury: TreasuryDiamond,
    BondingCalculator: BondDiamond,
    Distributor: BondDiamond,
    NeccStaking: BondDiamond,
    StakingWarmup: BondDiamond,
    NDOLBond: BondDiamond,

    NATIVE_TOKEN,
    BTC,
    NEAR,
    NDOL,
    Necc,
    sNecc,
    nNecc: nNecc,
    NDOL_NNECC_PAIR: NDOL_NNECC_PAIR,
    MintFarm,
    MintDistributor,

    VM: "0x6A633b16E042e15961D9FDA0d12BA2e3A1355B49",
    TestableVM: "0xF2bB0eE9E23459f5098A77e2Ad26d22F475871e6",
    AmmFactoryV2: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D", // Uniswap V2
    AmmFactory: "0x6725f303b657a9451d8ba641348b6761a6cc7a17",
    OrderBook: "0x0000000000000000000000000000000000000000",
    OrderBookReader: "0x0000000000000000000000000000000000000000",
  },
};

export function getContract(chainId, label) {
  if (!CONTRACTS) {
    return;
  }
  if (!CONTRACTS[chainId]) {
    throw new Error(`Incorrect chainId ${chainId}`);
  }
  if (!CONTRACTS[chainId][label]) {
    throw new Error(`Incorrect label "${label}" for chainId ${chainId}`);
  }
  return CONTRACTS[chainId][label];
}
