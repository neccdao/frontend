import { getContractAddress } from "@ethersproject/address";

// RINKEBY
// 0x2DE2403fab78f9B12ADB283c90e9e7B3EE51be5e // exc
// 0xd0680fF5F8A46eACCc65eBBE990f2644E9b81ac0 // trea
// 0x90Be9324A900E595503cd4b5e27209Eb28eDb751 / bond
// 0x50907bcc85830b361d0bc249abd7e97c739d71b6 // Necc
// 0xFa3d99A53f73c5A57F4B9693e4c9D6226aFB5a24 // nNecc
// "0xCf25929f293a198cB18dd1A0A67e0A50A6e9469A" // NDOL
// "RINKEBY_TESTNET_ETH_NECC_PAIR": "0x9fd5eb5253cf9096208277951547ecde1d41abd4",

const BTC = "0xF61cD5A3f617a27BBC08021B667B8945b826BBC4";
const NATIVE_TOKEN = "0x538BD1737F5C3d5d4E9021410fF71DC969a80fF4";
const NDOL = "0x20849E2b7c161a83aA777844D95C78919f94ed3D";
const Necc = "0x5C75A63d3Ccd6c24B1D5C011077a149596D6f567";
const nNecc = "0x44Fe7e9481476a1708700335D915EF7923eB238B";
const ExchangeDiamond = "0xCf0DBdF0532E5690Df7b2d422122Ad18ccECCEF6";
const TreasuryDiamond = "0x1eB06f535e10007501733c4aa6B44E753EE84A95";
const BondDiamond = "0xc8e1DC911A2bef27c5D5bFfff3c4D52Cc58aD844";
const MintFarm = "0x25dc670f0Ca16354041da5e1daf6583EC8308428";
const MintDistributor = "0x1E9182b72583D6F5EF218b8EcD90A2455caa2551";
//
const BTC_RINKEBY = "0x577D296678535e4903D59A4C929B718e1D575e0A";
const NATIVE_TOKEN_RINKEBY = "0xc778417e063141139fce010982780140aa0cd5ab";
const NDOL_RINKEBY = "0x805ab70884F359cA2BB96917F1bF0808CcB9BeBC";
const ExchangeDiamond_RINKEBY = "0x2DE2403fab78f9B12ADB283c90e9e7B3EE51be5e";
const TreasuryDiamond_RINKEBY = "0xd0680fF5F8A46eACCc65eBBE990f2644E9b81ac0";
const BondDiamond_RINKEBY = "0x90be9324a900e595503cd4b5e27209eb28edb751";
const Necc_RINKEBY = "0x50907BCc85830B361D0bC249aBd7E97c739D71b6";
const nNecc_RINKEBY = "0xFa3d99A53f73c5A57F4B9693e4c9D6226aFB5a24";
const MintFarm_RINKEBY = "0xc0C8Ce4c05a1e01428E207208cB11A78757Ce208";
const MintDistributor_RINKEBY = "0x8484740e36A7637d951a2A1a80b2a074b07914ce";
//

const CONTRACTS = {
  56: {
    // bsc contracts
    Treasury: "0xa44E7252a0C137748F523F112644042E5987FfC7",
    BUSD: "0xe9e7cea3dedca5984780bafc599bd69add087d56",
    GMT: "0x99e92123eB77Bc8f999316f622e5222498438784",
    Vault: "0xc73A8DcAc88498FD4b4B1b2AaA37b0a2614Ff67B",
    Router: "0xD46B23D042E976F8666F554E928e0Dc7478a8E1f",
    Reader: "0x087A618fD25c92B61254DBe37b09E5E8065FeaE7",
    AmmFactory: "0xBCfCcbde45cE874adCB698cC183deBcF17952812",
    AmmFactoryV2: "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73",
    OrderBook: "0x1111111111111111111111111111111111111111",
    OrderBookReader: "0x1111111111111111111111111111111111111111",
    NDOL: "0x85E76cbf4893c1fbcB34dCF1239A91CE2A4CF5a7",
    NATIVE_TOKEN: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
    XGMT: "0xe304ff0983922787Fd84BC9170CD21bF78B16B10",
    GMT_NDOL_PAIR: "0xa41e57459f09a126F358E118b693789d088eA8A0",
    XGMT_NDOL_PAIR: "0x0b622208fc0691C2486A3AE6B7C875b4A174b317",
    GMT_NDOL_FARM: "0x3E8B08876c791dC880ADC8f965A02e53Bb9C0422",
    XGMT_NDOL_FARM: "0x68D7ee2A16AB7c0Ee1D670BECd144166d2Ae0759",
    NDOL_YIELD_TRACKER: "0x0EF0Cf825B8e9F89A43FfD392664131cFB4cfA89",
    XGMT_YIELD_TRACKER: "0x82A012A9b3003b18B6bCd6052cbbef7Fa4892e80",
    GMT_NDOL_FARM_TRACKER_XGMT: "0x08FAb024BEfcb6068847726b2eccEAd18b6c23Cd",
    GMT_NDOL_FARM_TRACKER_NATIVE: "0xd8E26637B34B2487Cad1f91808878a391134C5c2",
    XGMT_NDOL_FARM_TRACKER_XGMT: "0x026A02F7F26C1AFccb9Cba7C4df3Dc810F4e92e8",
    XGMT_NDOL_FARM_TRACKER_NATIVE: "0x22458CEbD14a9679b2880147d08CA1ce5aa40E84",
    AUTO: "0xa184088a740c695E156F91f5cC086a06bb78b827",
    AUTO_NDOL_PAIR: "0x0523FD5C53ea5419B4DAF656BC1b157dDFE3ce50",
    AUTO_NDOL_FARM: "0xE6958298328D02051769282628a3b4178D0F3A47",
    AUTO_NDOL_FARM_TRACKER_XGMT: "0x093b8be41c1A30704De84a9521632f9a139c08bd",
    AUTO_NDOL_FARM_TRACKER_NATIVE: "0x23ed48E5dce3acC7704d0ce275B7b9a0e346b63A",
  },
  97: {
    Vault: "0x1B183979a5cd95FAF392c8002dbF0D5A1C687D9a",
    Router: "0x10800f683aa564534497a5b67F45bE3556a955AB",
    Reader: "0x98D4742F1B6a821bae672Cd8721283b91996E454",
    AmmFactory: "0x6725f303b657a9451d8ba641348b6761a6cc7a17",
    AmmFactoryV2: "0x1111111111111111111111111111111111111111",
    OrderBook: "0x0fd969942505B87B2Bf2Bd1bfA24924603d22CcC",
    OrderBookReader: "0x02564489a99cbf15a04AE069A529157b9EDC5D34",
    NDOL: "0x2D549bdBf810523fe9cd660cC35fE05f0FcAa028",
    GMT: "0xedba0360a44f885ed390fad01aa34d00d2532817",
    NATIVE_TOKEN: "0x612777Eea37a44F7a95E3B101C39e1E2695fa6C2",
    XGMT: "0x28cba798eca1a3128ffd1b734afb93870f22e613",
    GMT_NDOL_PAIR: "0xe0b0a315746f51932de033ab27223d85114c6b85",
    XGMT_NDOL_PAIR: "0x0108de1eea192ce8448080c3d90a1560cf643fa0",
    GMT_NDOL_FARM: "0xbe3cB06CE03cA692b77902040479572Ba8D01b0B",
    XGMT_NDOL_FARM: "0x138E92195D4B99CE3618092D3F9FA830d9A69B4b",
    NDOL_YIELD_TRACKER: "0x62B49Bc3bF252a5DB26D88ccc7E61119e3179B4f",
    XGMT_YIELD_TRACKER: "0x5F235A582e0993eE9466FeEb8F7B4682993a57d0",
    GMT_NDOL_FARM_TRACKER_XGMT: "0x4f8EE3aE1152422cbCaFACd4e3041ba2D859913C",
    GMT_NDOL_FARM_TRACKER_NATIVE: "0xd691B26E544Fe370f39A776964c991363aF72e56",
    XGMT_NDOL_FARM_TRACKER_XGMT: "0xfd5617CFB082Ba9bcD62d654603972AE312bC695",
    XGMT_NDOL_FARM_TRACKER_NATIVE: "0x0354387DD85b7D8aaD1611B3D167A384d6AE0c28",
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
    nNecc: nNecc_RINKEBY,
    NDOL: NDOL_RINKEBY,

    // Diamond: "0x834B5962BE225732dDc73320C7b7D14dD7d61da4",
    // Reader: "0x122cBF79F133FC02325E74EE7c0f7C97F44a721A", //
    // VaultPriceFeed: "0x633458Cc0B4bb4483A22E5f9DFeD6142D9816039",
    // Vault: "0x1D7a7a5E7BFeB7D85D3e49C040F723c9ff40D9A3", //
    // NDOL: "0xCf25929f293a198cB18dd1A0A67e0A50A6e9469A",
    // Router: "0xEeD32727Ae773eb771535Ed0D48355BB873ED583",
    // // TODO: Uncomment if keeping linear shorts
    // // Vault: "0xAd94DA6e21D71eC04a30880703611A642B7DD814", //
    // // NDOL: "0x754C833F571996b554F6cBe8810430D4aaBd2426", // NDOL
    // // Router: "0x4Aba0e8481A0Df183e8cF86FC9294BdF1cDe6d78", //
    // // Necc: "0x863e7D4C899C34332fFC814556853603bFe85B58", // Necc
    // // nNDOL: "0x5a54fBd9c14e57F0d9C58Cfff21B916BFaD7A30c",

    // // TODO: Uncomment if going back to Necc emissions per mint&delta
    // // TimeDistributor: "0xAaaFdCD6659770330819310DC436454b2d3CF702", //
    // // DeltaYieldTracker: "0x5e3Af3E5948351f0ED808101D79ffcf212AD9AB0", //
    // // UtilisationRebalancer: "0x3D1b1D9e0612560bBa6aeEE9b672e4A6cef58c3b",
    // // ZapSP: "0xe558d4261AFbE149f6382921893FAC4C96901907",

    // Necc: "0x24223b750b19db48090007103d3c4a2479d5dbac",
    // Treasury: "0x4cf7ae070ffb2db874cb9f6b731cb30488a8585e",
    // BondingCalculator: "0x963c898bd6a53fc939c3edaed730088fb471b13e",
    // Distributor: "0x026e31efc227bf35e73750fb904bd467f2c5c480",
    // nNecc: "0xee9ef42cc521a349268a29c0b53719dce7e00d2e",
    // NeccStaking: "0xeef4de0b6615beb1942cade658cfce3cabf7bca1",
    // StakingWarmup: "0xda4053d795d3421d5ecd11740b08f15f8c0bea18",
    // NDOLBond: "0x17eaf444a7217afc70347a1157ae500a576ed899",

    VM: "0x6A633b16E042e15961D9FDA0d12BA2e3A1355B49",
    TestableVM: "0xF2bB0eE9E23459f5098A77e2Ad26d22F475871e6",
    AmmFactoryV2: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D", // Uniswap V2
    AmmFactory: "0x6725f303b657a9451d8ba641348b6761a6cc7a17",
    OrderBook: "0x0fd969942505B87B2Bf2Bd1bfA24924603d22CcC",
    OrderBookReader: "0x02564489a99cbf15a04AE069A529157b9EDC5D34",
    GMT: "0xedba0360a44f885ed390fad01aa34d00d2532817",
    XGMT: "0x28cba798eca1a3128ffd1b734afb93870f22e613",
    GMT_NDOL_PAIR: "0xe0b0a315746f51932de033ab27223d85114c6b85",
    XGMT_NDOL_PAIR: "0x0108de1eea192ce8448080c3d90a1560cf643fa0",
    GMT_NDOL_FARM: "0xbe3cB06CE03cA692b77902040479572Ba8D01b0B",
    XGMT_NDOL_FARM: "0x138E92195D4B99CE3618092D3F9FA830d9A69B4b",
    NDOL_YIELD_TRACKER: "0x62B49Bc3bF252a5DB26D88ccc7E61119e3179B4f",
    XGMT_YIELD_TRACKER: "0x5F235A582e0993eE9466FeEb8F7B4682993a57d0",
    GMT_NDOL_FARM_TRACKER_XGMT: "0x4f8EE3aE1152422cbCaFACd4e3041ba2D859913C",
    GMT_NDOL_FARM_TRACKER_NATIVE: "0xd691B26E544Fe370f39A776964c991363aF72e56",
    XGMT_NDOL_FARM_TRACKER_XGMT: "0xfd5617CFB082Ba9bcD62d654603972AE312bC695",
    XGMT_NDOL_FARM_TRACKER_NATIVE: "0x0354387DD85b7D8aaD1611B3D167A384d6AE0c28",
  },
  1337: {
    ExchangeDiamond,
    Reader: ExchangeDiamond, // "0x122cBF79F133FC02325E74EE7c0f7C97F44a721A", //
    VaultPriceFeed: ExchangeDiamond, // "0x633458Cc0B4bb4483A22E5f9DFeD6142D9816039",
    Vault: ExchangeDiamond, //"0x1D7a7a5E7BFeB7D85D3e49C040F723c9ff40D9A3", //
    Router: ExchangeDiamond, //"0xEeD32727Ae773eb771535Ed0D48355BB873ED583",

    Treasury: TreasuryDiamond, //"0x4cf7ae070ffb2db874cb9f6b731cb30488a8585e",
    BondingCalculator: BondDiamond, //"0x963c898bd6a53fc939c3edaed730088fb471b13e",
    Distributor: BondDiamond, //"0x026e31efc227bf35e73750fb904bd467f2c5c480",
    NeccStaking: BondDiamond, //"0xeef4de0b6615beb1942cade658cfce3cabf7bca1",
    StakingWarmup: BondDiamond, //"0xda4053d795d3421d5ecd11740b08f15f8c0bea18",
    NDOLBond: BondDiamond, //"0x17eaf444a7217afc70347a1157ae500a576ed899",

    NATIVE_TOKEN,
    BTC,
    NEAR: "0xc42c30ac6cc15fac9bd938618bcaa1a1fae8501d",
    NDOL,
    Necc,
    nNecc,
    MintFarm,
    MintDistributor,

    VM: "0x6A633b16E042e15961D9FDA0d12BA2e3A1355B49",
    TestableVM: "0xF2bB0eE9E23459f5098A77e2Ad26d22F475871e6",
    AmmFactoryV2: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D", // Uniswap V2
    AmmFactory: "0x6725f303b657a9451d8ba641348b6761a6cc7a17",
    OrderBook: "0x0fd969942505B87B2Bf2Bd1bfA24924603d22CcC",
    OrderBookReader: "0x02564489a99cbf15a04AE069A529157b9EDC5D34",
    GMT: "0xedba0360a44f885ed390fad01aa34d00d2532817",
    XGMT: "0x28cba798eca1a3128ffd1b734afb93870f22e613",
    GMT_NDOL_PAIR: "0xe0b0a315746f51932de033ab27223d85114c6b85",
    XGMT_NDOL_PAIR: "0x0108de1eea192ce8448080c3d90a1560cf643fa0",
    GMT_NDOL_FARM: "0xbe3cB06CE03cA692b77902040479572Ba8D01b0B",
    XGMT_NDOL_FARM: "0x138E92195D4B99CE3618092D3F9FA830d9A69B4b",
    NDOL_YIELD_TRACKER: "0x62B49Bc3bF252a5DB26D88ccc7E61119e3179B4f",
    XGMT_YIELD_TRACKER: "0x5F235A582e0993eE9466FeEb8F7B4682993a57d0",
    GMT_NDOL_FARM_TRACKER_XGMT: "0x4f8EE3aE1152422cbCaFACd4e3041ba2D859913C",
    GMT_NDOL_FARM_TRACKER_NATIVE: "0xd691B26E544Fe370f39A776964c991363aF72e56",
    XGMT_NDOL_FARM_TRACKER_XGMT: "0xfd5617CFB082Ba9bcD62d654603972AE312bC695",
    XGMT_NDOL_FARM_TRACKER_NATIVE: "0x0354387DD85b7D8aaD1611B3D167A384d6AE0c28",
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

export const XGMT_EXCLUDED_ACCOUNTS = [
  "0x330eef6b9b1ea6edd620c825c9919dc8b611d5d5",
  "0xd9b1c23411adbb984b1c4be515fafc47a12898b2",
  "0xa633158288520807f91ccc98aa58e0ea43acb400",
  "0xffd0a93b4362052a336a7b22494f1b77018dd34b",
];
