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

const NATIVE_TOKEN_AURORA = "0xC9BdeEd33CD01541e1eeD10f90519d2C06Fe3feB";
const BTC_AURORA = "0xF4eB217Ba2454613b15dBdea6e5f22276410e89e";
const NEAR_AURORA = "0xc42c30ac6cc15fac9bd938618bcaa1a1fae8501d";
const NDOL_AURORA = "0xC86Ca2BB9C9c9c9F140d832dE00BfA9e153FA1e3";
const ExchangeDiamond_AURORA = "0xc14D994fe7C5858c93936cc3bD42bb9467d6fB2C";
const TreasuryDiamond_AURORA = "0x226Bf5293692610692E2C996C9875C914d2A7f73";
const BondDiamond_AURORA = "0xFBe0421c53706746151ACa2Cf22F81Dc41262519";
const Necc_AURORA = "0x6EBA841F1201fFDDe7DDC2ba995D3308f6C4aEa0";
const sNecc_AURORA = "0xA642375Cc15249A81da9c435fB4eDD8A9343ce7F";
const nNecc_AURORA = "0x449f661c53aE0611a24c2883a910A563A7e42489";
const MintFarm_AURORA = "0x9341378cce1877CEBc651df5aE0986D02edE0714";
const MintDistributor_AURORA = "0xCfbE1FbBEbe1530fFB44c01AD2497280f60C67f9";
const VM_AURORA = "0x4F69f0Ce4d1431f407218758Bc6eD765CCb5aEb2";
const TestableVM_AURORA = "0x8F110B92B427eA47fB0B336f1b682cF454e247bF";
const NDOL_NNECC_PAIR_AURORA = "0xad5779da21408E70973Ac56ab91Dbf201B45b652";
const Redemption_AURORA = "0xDeFB45F660166B3FE43Ec110AcaFEBcFC5185b33";

/*
{ Diamantaire: '0xB812f503607Ee2259E9607Cb5E5836B550ac6492' }
{ ExchangeDiamond: '0xc14D994fe7C5858c93936cc3bD42bb9467d6fB2C' }
{
  ExchangeDiamond_DiamondProxy: '0xc14D994fe7C5858c93936cc3bD42bb9467d6fB2C'
}
{ NdolDiamond: '0xC86Ca2BB9C9c9c9F140d832dE00BfA9e153FA1e3' }
{
  NdolDiamond_DiamondProxy: '0xC86Ca2BB9C9c9c9F140d832dE00BfA9e153FA1e3'
}
{ NdolFacet: '0xe613307c3E73A68FA86E294b9DCb9A5163F61051' }
{ ReaderFacet: '0x24c3DE803EE262b6b2C20CC254A09F21D47E7A11' }
{ RouterFacet: '0xC04411e18Ca620C2F9851a0f2C9C2013d9c16FB3' }
{ RouterLib: '0x351124A838349E06bEF0581ff6BD0E87FE2fD63f' }
{ TestableVM: '0x8F110B92B427eA47fB0B336f1b682cF454e247bF' }
{ VM: '0x4F69f0Ce4d1431f407218758Bc6eD765CCb5aEb2' }
{ VaultConfigFacet: '0x188B6C95FC30a6c27e6A47bd1e1a3139C57521c2' }
{ VaultFacet: '0xE56ccA4FFf4a45860581d3d253979968CE64C056' }
{ VaultLib: '0xb2A2fEcF20ccf8D7E9FcCbAc9F9AAbF63A35Adf2' }
{ VaultNdolFacet: '0x69Ec60E800F7dAED4dC7e23CFDaFe4B35Dd179cF' }
{ VaultPriceFeedFacet: '0xf7F123AB9EA29b42e1A60ea89692Db0CF1C7222C' }
{ TreasuryFacet: '0x1315b76E03EF293B6F9a4fE1B8779652abe9A5Dd' }
{
  BondingCalculatorFacet: '0x14E4091DA00c58Ce1E9480cb586Ec2561cd51241'
}
{
  TreasuryDiamond_DiamondProxy: '0x226Bf5293692610692E2C996C9875C914d2A7f73'
}
{ TreasuryDiamond: '0x226Bf5293692610692E2C996C9875C914d2A7f73' }
{ NeccFacet: '0xdF4960BDB3E099B965037EA7247e1B9B456c7A17' }
{
  NeccDiamond_DiamondProxy: '0x6EBA841F1201fFDDe7DDC2ba995D3308f6C4aEa0'
}
{ NeccDiamond: '0x6EBA841F1201fFDDe7DDC2ba995D3308f6C4aEa0' }
{ sNeccFacet: '0x4DB814c8E570AfaCe6332fCBE87FD5e680f7cB45' }
{
  sNeccDiamond_DiamondProxy: '0xA642375Cc15249A81da9c435fB4eDD8A9343ce7F'
}
{ sNeccDiamond: '0xA642375Cc15249A81da9c435fB4eDD8A9343ce7F' }
{ nNeccFacet: '0x500641d0174FEaa12D4AA486e20c577CA3d322A2' }
{
  nNeccDiamond_DiamondProxy: '0x449f661c53aE0611a24c2883a910A563A7e42489'
}
{ nNeccDiamond: '0x449f661c53aE0611a24c2883a910A563A7e42489' }
{ BondConfigFacet: '0x0Fe25C11203DB28F1Ecec15bDeF97687aD5DaB7f' }
{ BondDepositoryLib: '0x30d97232Ddbc31884f609187ec975063B26428df' }
{ BondDepositoryFacet: '0x58F5c9399e01ddb659775a69319a5FC5F3f00F0D' }
{ DistributorFacet: '0xcB843465F14014f9867f1248CE30B7bf4643b611' }
{ StakingFacet: '0x02025678234156913e8254050Ff63b312095d95B' }
{
  BondDepositoryDiamond_DiamondProxy: '0xFBe0421c53706746151ACa2Cf22F81Dc41262519'
}
{ BondDepositoryDiamond: '0xFBe0421c53706746151ACa2Cf22F81Dc41262519' }
{ MintFarm: '0x9341378cce1877CEBc651df5aE0986D02edE0714' }
{ MintDistributor: '0xCfbE1FbBEbe1530fFB44c01AD2497280f60C67f9' }
ndolnNeccLPPair: 0xad5779da21408E70973Ac56ab91Dbf201B45b652
*/

const CONTRACTS = {
  // AURORA MAINNET
  1313161554: {
    ExchangeDiamond: ExchangeDiamond_AURORA,
    Reader: ExchangeDiamond_AURORA,
    VaultPriceFeed: ExchangeDiamond_AURORA,
    Vault: ExchangeDiamond_AURORA,
    Router: ExchangeDiamond_AURORA,

    Treasury: TreasuryDiamond_AURORA,
    BondingCalculator: BondDiamond_AURORA,
    Distributor: BondDiamond_AURORA,
    NeccStaking: BondDiamond_AURORA,
    StakingWarmup: BondDiamond_AURORA,
    NDOLBond: BondDiamond_AURORA,
    MintFarm: MintFarm_AURORA,
    MintDistributor: MintDistributor_AURORA,
    Redemption: Redemption_AURORA,

    NATIVE_TOKEN: NATIVE_TOKEN_AURORA, // WETH
    BTC: BTC_AURORA,
    NEAR: NEAR_AURORA,
    Necc: Necc_AURORA,
    sNecc: sNecc_AURORA,
    nNecc: nNecc_AURORA,
    NDOL: NDOL_AURORA,
    NDOL_NNECC_PAIR: NDOL_NNECC_PAIR_AURORA,

    VM: VM_AURORA,
    TestableVM: TestableVM_AURORA,
    OrderBook: "0x4F69f0Ce4d1431f407218758Bc6eD765CCb5aEb2",
    OrderBookReader: "0x8F110B92B427eA47fB0B336f1b682cF454e247bF",
  },
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
    Redemption: Redemption_AURORA,

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
