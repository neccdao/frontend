import { ethers } from "ethers";
import { getContract } from "../Addresses";

export const TOKENS = {
  56: [
    {
      name: "Bitcoin (BTCB)",
      symbol: "BTC",
      decimals: 18,
      address: "0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c",
      coingeckoUrl: "https://www.coingecko.com/en/coins/binance-bitcoin",
      imageUrl:
        "https://assets.coingecko.com/coins/images/14108/small/Binance-bitcoin.png",
    },
    {
      name: "Ethereum",
      symbol: "ETH",
      decimals: 18,
      address: "0x2170Ed0880ac9A755fd29B2688956BD959F933F8",
      coingeckoUrl: "https://www.coingecko.com/en/coins/ethereum",
      imageUrl:
        "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
    },
    {
      name: "Binance Coin",
      symbol: "BNB",
      decimals: 18,
      address: ethers.constants.AddressZero,
      coingeckoUrl: "https://www.coingecko.com/en/coins/binance-coin",
      imageUrl:
        "https://assets.coingecko.com/coins/images/825/small/binance-coin-logo.png",
    },
    {
      name: "Wrapped Binance Coin",
      symbol: "WBNB",
      decimals: 18,
      address: getContract(56, "NATIVE_TOKEN"),
      isWrapped: true,
      coingeckoUrl: "https://www.coingecko.com/en/coins/binance-coin",
      imageUrl:
        "https://assets.coingecko.com/coins/images/825/small/binance-coin-logo.png",
    },
    {
      name: "USD Gambit",
      symbol: "NDOL",
      decimals: 18,
      address: getContract(56, "NDOL"),
      isUsdg: true,
      coingeckoUrl: "https://www.coingecko.com/en/coins/usd-gambit",
      imageUrl:
        "https://assets.coingecko.com/coins/images/15886/small/ndol-02.png",
    },
    {
      name: "Binance USD",
      symbol: "BUSD",
      decimals: 18,
      address: "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56",
      isStable: true,
      coingeckoUrl: "https://www.coingecko.com/en/coins/binance-usd",
      imageUrl: "https://assets.coingecko.com/coins/images/9576/small/BUSD.png",
    },
    {
      name: "USD Coin",
      symbol: "USDC",
      decimals: 18,
      address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
      isStable: true,
      coingeckoUrl: "https://www.coingecko.com/en/coins/usd-coin",
      imageUrl:
        "https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png",
    },
    {
      name: "Tether",
      symbol: "USDT",
      decimals: 18,
      address: "0x55d398326f99059fF775485246999027B3197955",
      isStable: true,
      coingeckoUrl: "https://www.coingecko.com/en/coins/tether",
      imageUrl:
        "https://assets.coingecko.com/coins/images/325/small/Tether-logo.png",
    },
  ],
  97: [
    {
      name: "Bitcoin (BTCB)",
      symbol: "BTC",
      decimals: 8,
      address: "0xb19C12715134bee7c4b1Ca593ee9E430dABe7b56",
    },
    {
      name: "Ethereum",
      symbol: "ETH",
      decimals: 18,
      address: "0x1958f7C067226c7C8Ac310Dc994D0cebAbfb2B02",
    },
    {
      name: "Binance Coin",
      symbol: "BNB",
      decimals: 18,
      address: ethers.constants.AddressZero,
    },
    {
      name: "Wrapped Binance Coin",
      symbol: "WBNB",
      decimals: 18,
      address: "0x612777Eea37a44F7a95E3B101C39e1E2695fa6C2",
      isWrapped: true,
    },
    {
      name: "USD Gambit",
      symbol: "NDOL",
      decimals: 18,
      address: getContract(97, "NDOL"),
      isUsdg: true,
    },
    {
      name: "Binance USD",
      symbol: "BUSD",
      decimals: 18,
      address: "0x3F223C4E5ac67099CB695834b20cCd5E5D5AA9Ef",
      isStable: true,
    },
  ],
  // RINKEBY
  4: [
    {
      name: "Bitcoin (WBTC)",
      symbol: "BTC",
      decimals: 8,
      address: getContract(4, "BTC"),
    },
    {
      name: "ETH",
      symbol: "ETH",
      decimals: 18,
      address: ethers.constants.AddressZero,
    },
    {
      name: "Wrapped Ethereum",
      symbol: "WETH",
      decimals: 18,
      address: getContract(4, "NATIVE_TOKEN"),
      isWrapped: true, // NOTE - Seems required even though shown in from token selector list
    },
    {
      name: "Necc Dollars",
      symbol: "NDOL",
      decimals: 18,
      address: getContract(4, "NDOL"),
      isUsdg: true,
    },
    {
      name: "Necc",
      symbol: "Necc",
      decimals: 9,
      address: getContract(4, "Necc"),
    },
    {
      name: "nNecc",
      symbol: "nNecc",
      decimals: 9,
      address: getContract(4, "nNecc"),
    },
    {
      name: "NDOL-Necc LP",
      symbol: "NDOLNeccLP",
      decimals: 18,
      address: "0x6dc80e8920feac022b341334f87db819fc1199c9",
      isLP: true,
    },
  ],
  1337: [
    // {
    //   name: "NEAR (wNEAR)",
    //   symbol: "NEAR",
    //   decimals: 24,
    //   address: getContract(1337, "NEAR"),
    // },
    {
      name: "Bitcoin (WBTC)",
      symbol: "BTC",
      decimals: 8,
      address: getContract(1337, "BTC"),
    },
    {
      name: "ETH",
      symbol: "ETH",
      decimals: 18,
      address: ethers.constants.AddressZero,
    },
    {
      name: "Wrapped Ethereum",
      symbol: "WETH",
      decimals: 18,
      address: getContract(1337, "NATIVE_TOKEN"),
      isWrapped: true, // NOTE - Seems required even though shown in from token selector list
    },
    {
      name: "Necc Dollars",
      symbol: "NDOL",
      decimals: 18,
      address: getContract(1337, "NDOL"),
      isUsdg: true,
    },
    {
      name: "Necc",
      symbol: "Necc",
      decimals: 9,
      address: getContract(1337, "Necc"),
    },
    {
      name: "nNecc",
      symbol: "nNecc",
      decimals: 9,
      address: getContract(1337, "nNecc"),
    },
    // {
    //   name: "ETH-NDOL LP",
    //   symbol: "ETHNDOLLP",
    //   decimals: 18,
    //   address: "0x9fd5eb5253cf9096208277951547ecde1d41abd4",
    //   isLP: true,
    // },
    // {
    //   name: "NDOL-Necc LP",
    //   symbol: "NDOLNeccLP",
    //   decimals: 18,
    //   address: "0x6dc80e8920feac022b341334f87db819fc1199c9",
    //   isLP: true,
    // },
  ],
};

const CHAIN_IDS = [56, 97, 4, 1337];

const TOKENS_MAP = {};
const TOKENS_BY_SYMBOL_MAP = {};

for (let j = 0; j < CHAIN_IDS.length; j++) {
  const chainId = CHAIN_IDS[j];
  TOKENS_MAP[chainId] = {};
  TOKENS_BY_SYMBOL_MAP[chainId] = {};
  for (let i = 0; i < TOKENS[chainId].length; i++) {
    const token = TOKENS[chainId][i];
    TOKENS_MAP[chainId][token.address] = token;
    TOKENS_BY_SYMBOL_MAP[chainId][token.symbol] = token;
  }
}

export function getTokens(chainId) {
  return TOKENS[chainId].filter((token) => {
    if (token.symbol === "Necc") {
      return false;
    }
    if (token.symbol === "nNecc") {
      return false;
    }
    if (token.symbol?.toLowerCase().includes("lp")) {
      return false;
    }
    return token;
  });
}

export function getToken(chainId, address) {
  if (!TOKENS_MAP[chainId]) {
    throw new Error(`Incorrect chainId ${chainId}`);
  }
  if (!TOKENS_MAP[chainId][address]) {
    throw new Error(`Incorrect address "${address}" for chainId ${chainId}`);
  }
  return TOKENS_MAP[chainId][address];
}

export function getTokenBySymbol(chainId, symbol) {
  const token = TOKENS_BY_SYMBOL_MAP[chainId][symbol];
  if (!token) {
    throw new Error(`Incorrect symbol "${symbol}" for chainId ${chainId}`);
  }
  return token;
}

export function getWhitelistedTokens(chainId) {
  return TOKENS[chainId].filter((token) => {
    if (token.symbol === "Necc") {
      return false;
    }
    if (token.symbol === "nNecc") {
      return false;
    }
    if (token.symbol === "NDOL") {
      return false;
    }
    if (token.symbol?.toLowerCase().includes("lp")) {
      return false;
    }
    return token;
  });
}

export function getBondTokens(chainId) {
  return TOKENS[chainId].filter((token) => {
    if (token.symbol === "NDOL") {
      return token;
    }
    if (token.symbol?.toLowerCase().includes("lp")) {
      return token;
    }
    return false;
  });
}

/*
[
    "0xc42c30ac6cc15fac9bd938618bcaa1a1fae8501d", // NEAR
    "0xF4eB217Ba2454613b15dBdea6e5f22276410e89e", // WBTC
    "0x0000000000000000000000000000000000000000", // ETH
    "0xC9BdeEd33CD01541e1eeD10f90519d2C06Fe3feB", // WETH
    "0x0580cEd4F4d45591682223D655FEBE5A967C18a8", // NDOL
    "0x9a56acEda450b564CB5EB15C14d172FE2b32A12d", // Necc
    "0x59cc64B3510fBcc9D4A93C7A0380495EE0dd356b" // nNecc
]
*/
