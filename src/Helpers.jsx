import React, { useState, useRef, useEffect } from "react";
import { InjectedConnector } from "@web3-react/injected-connector";
import { toast } from "react-toastify";
import { useWeb3React, UnsupportedChainIdError } from "@web3-react/core";
import { useLocalStorage } from "react-use";
import { ethers, BigNumber } from "ethers";
import { format as formatDateFn } from "date-fns";
import Token from "./abis/Token.json";
import _ from "lodash";
import { getContract } from "./Addresses";
import useSWR from "swr";
import { parseFixed } from "@ethersproject/bignumber";

import OrderBookReader from "./abis/OrderBookReader.json";
import OrderBook from "./abis/OrderBook.json";

import { getTokenBySymbol, getWhitelistedTokens } from "./data/Tokens";
import fp from "evm-fp";

const { AddressZero } = ethers.constants;

// AURORA MAINNET
export const MAINNET = 1313161554;
// NOTE - RINKEBY CHAIN ID
export const TESTNET = 4;
export const LOCAL = 1337;
// TODO take it from web3
export const CHAIN_ID =
  process.env.NODE_ENV === "development" ? LOCAL : MAINNET;
export const NATIVE_TOKEN_ADDRESS = getContract(CHAIN_ID, "NATIVE_TOKEN");
export const NDOL_ADDRESS = getContract(CHAIN_ID, "NDOL");
const MAX_LEVERAGE = 50 * 10000;

export const USD_DECIMALS = 30;
export const BASIS_POINTS_DIVISOR = 10000;
export const DUST_BNB = "2000000000000000";
export const DUST_USD = expandDecimals(1, USD_DECIMALS);
export const PRECISION = expandDecimals(1, 30);
export const MARGIN_FEE_BASIS_POINTS = 10;
export const THRESHOLD_REDEMPTION_VALUE = expandDecimals(993, 27); // 0.993
export const SWAP_FEE_BASIS_POINTS = 30;
const STABLE_SWAP_FEE_BASIS_POINTS = 10;

export const FUNDING_RATE_PRECISION = 1000000;
const LIQUIDATION_FEE = expandDecimals(5, USD_DECIMALS);

export const MINT = "Mint";
export const BURN = "Burn";
export const SWAP = "Swap";
export const LONG = "Long";
export const SHORT = "Short";

export const MARKET = "Market";
export const LIMIT = "Limit";
export const STOP = "Stop";
export const LEVERAGE_ORDER_OPTIONS = [MARKET, LIMIT];
export const SWAP_ORDER_OPTIONS = [MARKET, LIMIT];

export const DEFAULT_SLIPPAGE_AMOUNT = 50;

export const DEFAULT_ORDER_EXECUTION_GAS_AMOUNT = expandDecimals(1000000, 9); // 1mil gwei

const orderBookReaderAddress = getContract(CHAIN_ID, "OrderBookReader");
const orderBookAddress = getContract(CHAIN_ID, "OrderBook");

const supportedChainIds = [MAINNET, TESTNET, LOCAL];
const injected = new InjectedConnector({
  supportedChainIds,
});

export function isSupportedChain(chainId) {
  return supportedChainIds.includes(chainId);
}

export function useLocalStorageSerializeKey(key, value, opts) {
  key = JSON.stringify(key);
  return useLocalStorage(key, value, opts);
}

function getTriggerPrice(tokenAddress, max, info, orderType, triggerPriceUsd) {
  // Limit/stop orders are executed with price specified by user
  if (orderType && orderType !== MARKET && triggerPriceUsd) {
    return triggerPriceUsd;
  }

  if (info?.principleValuation) {
    return info.principleValuation;
  }

  // Market orders are executed with current market price
  if (!info) {
    return;
  }
  if (max && !info.maxPrice) {
    return;
  }
  if (!max && !info.minPrice) {
    return;
  }
  return max ? info.maxPrice : info.minPrice;
}

function getLiquidationPriceFromDelta({
  liquidationAmount,
  size,
  collateral,
  averagePrice,
  isLong,
}) {
  if (!size || size.eq(0)) {
    return;
  }
  if (liquidationAmount.gt(collateral)) {
    return;
  }

  const liquidationDelta = collateral.sub(liquidationAmount);
  const priceDelta = liquidationDelta.mul(averagePrice).div(size);

  if (isLong) {
    return averagePrice.sub(priceDelta);
  }

  return averagePrice.add(priceDelta);
}

export function getPositionFee(size) {
  if (!size) {
    return bigNumberify(0);
  }
  const afterFeeUsd = size
    .mul(BASIS_POINTS_DIVISOR - MARGIN_FEE_BASIS_POINTS)
    .div(BASIS_POINTS_DIVISOR);
  return size.sub(afterFeeUsd);
}

export function getMarginFee(sizeDelta) {
  if (!sizeDelta) {
    return bigNumberify(0);
  }
  const afterFeeUsd = sizeDelta
    .mul(BASIS_POINTS_DIVISOR - MARGIN_FEE_BASIS_POINTS)
    .div(BASIS_POINTS_DIVISOR);
  return sizeDelta.sub(afterFeeUsd);
}

export function getExchangeRate(tokenAInfo, tokenBInfo) {
  if (
    !tokenAInfo ||
    !tokenAInfo.minPrice ||
    !tokenBInfo ||
    !tokenBInfo.maxPrice
  ) {
    return;
  }
  return tokenBInfo.maxPrice.mul(PRECISION).div(tokenAInfo.minPrice);
}

export function getExchangeRateDisplay(rate, tokenA, tokenB) {
  if (!rate) return;
  const rateValue = formatAmount(rate, USD_DECIMALS, 4, true);
  return `${rateValue} ${tokenA.symbol} / ${tokenB.symbol}`;
}

export function getNextToAmount(
  fromAmount,
  fromTokenAddress,
  toTokenAddress,
  infoTokens,
  toTokenPriceUsd,
  ratio,
  targetAdjustedSwapFee
) {
  const defaultValue = { amount: bigNumberify(0) };
  if (!fromAmount || !fromTokenAddress || !toTokenAddress || !infoTokens) {
    return defaultValue;
  }

  if (fromTokenAddress === toTokenAddress) {
    return { amount: fromAmount };
  }

  if (
    fromTokenAddress === AddressZero &&
    toTokenAddress === NATIVE_TOKEN_ADDRESS
  ) {
    return { amount: fromAmount };
  }

  if (
    fromTokenAddress === NATIVE_TOKEN_ADDRESS &&
    toTokenAddress === AddressZero
  ) {
    return { amount: fromAmount };
  }

  const fromToken = getTokenInfo(infoTokens, fromTokenAddress);
  const toToken = getTokenInfo(infoTokens, toTokenAddress);

  if (fromToken.price) {
    const toAmount = fromAmount
      .mul(PRECISION)
      .div(fromToken.price)
      .div(expandDecimals(1, USD_DECIMALS - fromToken.decimals));

    return {
      amount: toAmount,
    };
  }

  if (!fromToken || !fromToken.minPrice || !toToken || !toToken.maxPrice) {
    return defaultValue;
  }

  const toAmountBasedOnRatio =
    ratio &&
    !ratio.isZero() &&
    fromAmount
      .mul(PRECISION)
      .div(ratio)
      .mul(fromToken.decimals)
      .div(toToken.decimals);

  if (toTokenAddress === NDOL_ADDRESS) {
    const feeBasisPoints =
      targetAdjustedSwapFee || getSwapFeeBasisPoints(fromToken.isStable);

    if (ratio && !ratio.isZero()) {
      const toAmount = toAmountBasedOnRatio;
      return {
        amount: toAmount
          .mul(BASIS_POINTS_DIVISOR - feeBasisPoints)
          .div(BASIS_POINTS_DIVISOR),
        feeBasisPoints,
      };
    }

    const toAmount = fromAmount.mul(fromToken.minPrice).div(PRECISION);
    return {
      amount: toAmount
        .mul(BASIS_POINTS_DIVISOR - feeBasisPoints)
        .div(BASIS_POINTS_DIVISOR),
      feeBasisPoints,
    };
  }

  if (fromTokenAddress === NDOL_ADDRESS) {
    const redemptionValue = toToken.redemptionAmount
      .mul(toTokenPriceUsd || toToken.maxPrice)
      .div(expandDecimals(1, toToken.decimals));

    // TODO trigger price/ratio
    if (redemptionValue.gt(THRESHOLD_REDEMPTION_VALUE)) {
      const feeBasisPoints = getSwapFeeBasisPoints(toToken.isStable);

      const toAmount =
        ratio && !ratio.isZero()
          ? toAmountBasedOnRatio
          : fromAmount
              .mul(toToken.redemptionAmount)
              .div(expandDecimals(1, toToken.decimals));

      return {
        amount: toAmount
          .mul(BASIS_POINTS_DIVISOR - feeBasisPoints)
          .div(BASIS_POINTS_DIVISOR),
        feeBasisPoints,
      };
    }
  }

  const feeBasisPoints = getSwapFeeBasisPoints(
    fromToken.isStable && toToken.isStable
  );
  const toAmount =
    ratio && !ratio.isZero()
      ? toAmountBasedOnRatio
      : fromAmount
          .mul(fromToken.minPrice)
          .div(toTokenPriceUsd || toToken.maxPrice || toToken.price);
  return {
    amount: toAmount
      .mul(BASIS_POINTS_DIVISOR - feeBasisPoints)
      .div(BASIS_POINTS_DIVISOR),
    feeBasisPoints,
  };
}

export function getLeverage({
  size,
  sizeDelta,
  increaseSize,
  collateral,
  collateralDelta,
  increaseCollateral,
  entryFundingRate,
  cumulativeFundingRate,
  hasProfit,
  delta,
}) {
  // TODO for limit/stop should pass different collateralDelta and sizeDelta
  if (!size && !sizeDelta) {
    return;
  }
  if (!collateral && !collateralDelta) {
    return;
  }

  let nextSize = size ? size : bigNumberify(0);
  if (sizeDelta) {
    if (increaseSize) {
      nextSize = size.add(sizeDelta);
    } else {
      if (sizeDelta.gte(size)) {
        return;
      }
      nextSize = size.sub(sizeDelta);
    }
  }

  let remainingCollateral = collateral ? collateral : bigNumberify(0);
  if (collateralDelta) {
    if (increaseCollateral) {
      remainingCollateral = collateral.add(collateralDelta);
    } else {
      if (collateralDelta.gte(collateral)) {
        return;
      }
      remainingCollateral = collateral.sub(collateralDelta);
    }
  }

  if (delta) {
    if (hasProfit) {
      remainingCollateral = remainingCollateral.add(delta);
    } else {
      if (delta.gt(remainingCollateral)) {
        return;
      }

      remainingCollateral = remainingCollateral.sub(delta);
    }
  }

  if (remainingCollateral.eq(0)) {
    return;
  }

  remainingCollateral = sizeDelta
    ? remainingCollateral
        .mul(BASIS_POINTS_DIVISOR - MARGIN_FEE_BASIS_POINTS)
        .div(BASIS_POINTS_DIVISOR)
    : remainingCollateral;
  if (entryFundingRate && cumulativeFundingRate) {
    const fundingFee = size
      .mul(cumulativeFundingRate.sub(entryFundingRate))
      .div(FUNDING_RATE_PRECISION);
    remainingCollateral = remainingCollateral.sub(fundingFee);
  }

  return nextSize.mul(BASIS_POINTS_DIVISOR).div(remainingCollateral);
}

export function getLiquidationPrice(data) {
  let {
    isLong,
    size,
    collateral,
    averagePrice,
    entryFundingRate,
    cumulativeFundingRate,
    sizeDelta,
    collateralDelta,
    increaseCollateral,
    increaseSize,
  } = data;
  if (!size || !collateral || !averagePrice) {
    return;
  }

  let nextSize = size ? size : bigNumberify(0);
  let remainingCollateral = collateral;

  if (sizeDelta) {
    if (increaseSize) {
      nextSize = size.add(sizeDelta);
    } else {
      if (sizeDelta.gte(size)) {
        return;
      }
      nextSize = size.sub(sizeDelta);
    }

    const marginFee = getMarginFee(sizeDelta);
    remainingCollateral = remainingCollateral.sub(marginFee);
  }

  if (collateralDelta) {
    if (increaseCollateral) {
      remainingCollateral = remainingCollateral.add(collateralDelta);
    } else {
      if (collateralDelta.gte(remainingCollateral)) {
        return;
      }
      remainingCollateral = remainingCollateral.sub(collateralDelta);
    }
  }

  let positionFee = getPositionFee(size).add(LIQUIDATION_FEE);
  if (entryFundingRate && cumulativeFundingRate) {
    const fundingFee = size
      .mul(cumulativeFundingRate.sub(entryFundingRate))
      .div(FUNDING_RATE_PRECISION);
    positionFee.add(fundingFee);
  }

  const liquidationPriceForFees = getLiquidationPriceFromDelta({
    liquidationAmount: positionFee,
    size: nextSize,
    collateral: remainingCollateral,
    averagePrice,
    isLong,
  });

  const liquidationPriceForMaxLeverage = getLiquidationPriceFromDelta({
    liquidationAmount: nextSize.mul(BASIS_POINTS_DIVISOR).div(MAX_LEVERAGE),
    size: nextSize,
    collateral: remainingCollateral,
    averagePrice,
    isLong,
  });

  if (!liquidationPriceForFees) {
    return liquidationPriceForMaxLeverage;
  }
  if (!liquidationPriceForMaxLeverage) {
    return liquidationPriceForFees;
  }

  if (isLong) {
    // return the higher price
    return liquidationPriceForFees.gt(liquidationPriceForMaxLeverage)
      ? liquidationPriceForFees
      : liquidationPriceForMaxLeverage;
  }

  // return the lower price
  return liquidationPriceForFees.lt(liquidationPriceForMaxLeverage)
    ? liquidationPriceForFees
    : liquidationPriceForMaxLeverage;
}

export function getUsd(
  amount,
  tokenAddress,
  max,
  infoTokens,
  orderType,
  triggerPriceUsd
) {
  if (!amount) {
    return;
  }
  if (tokenAddress === NDOL_ADDRESS) {
    return amount.mul(PRECISION).div(expandDecimals(1, 18));
  }
  // if (tokenAddress === getTokenBySymbol(CHAIN_ID, "nNDOL")?.address) {
  //   return amount.mul(PRECISION).div(expandDecimals(1, 18));
  // }
  const info = getTokenInfo(infoTokens, tokenAddress);
  const price = getTriggerPrice(
    tokenAddress,
    max,
    info,
    orderType,
    triggerPriceUsd
  );
  if (!price) {
    return bigNumberify(0);
  }

  return amount.mul(price).div(expandDecimals(1, info.decimals));
}

export function getPositionKey(
  collateralTokenAddress,
  indexTokenAddress,
  isLong
) {
  const tokenAddress0 =
    collateralTokenAddress === AddressZero
      ? NATIVE_TOKEN_ADDRESS
      : collateralTokenAddress;
  const tokenAddress1 =
    indexTokenAddress === AddressZero
      ? NATIVE_TOKEN_ADDRESS
      : indexTokenAddress;
  return tokenAddress0 + ":" + tokenAddress1 + ":" + isLong;
}

export function getSwapFeeBasisPoints(isStable) {
  return SWAP_FEE_BASIS_POINTS;
}

// AURORA MAINNET
const RPC_PROVIDERS = ["https://mainnet.aurora.dev"];

export function shortenAddress(address) {
  if (!address) {
    return address;
  }
  if (address.length < 10) {
    return address;
  }
  return (
    address.substring(0, 6) +
    "..." +
    address.substring(address.length - 4, address.length)
  );
}

export function formatDateTime(time) {
  return formatDateFn(time * 1000, "dd MMM yyyy, h:mm a");
}

export function formatDate(time) {
  return formatDateFn(time * 1000, "dd MMM yyyy");
}

export function getInjectedConnector() {
  return injected;
}

export function useEagerConnect() {
  const injected = getInjectedConnector();
  const { activate, active } = useWeb3React();

  const [tried, setTried] = useState(false);

  useEffect(() => {
    injected.isAuthorized().then((isAuthorized) => {
      if (isAuthorized) {
        activate(injected, undefined, true).catch(() => {
          setTried(true);
        });
      } else {
        setTried(true);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally only running on mount (make sure it's only mounted once :))

  // if the connection worked, wait until we get confirmation of that to flip the flag
  useEffect(() => {
    if (!tried && active) {
      setTried(true);
    }
  }, [tried, active]);

  return tried;
}

export function useInactiveListener(suppress = false) {
  const injected = getInjectedConnector();
  const { active, error, activate } = useWeb3React();

  useEffect(() => {
    const { ethereum } = window;
    if (ethereum && ethereum.on && !active && !error && !suppress) {
      const handleConnect = () => {
        activate(injected);
      };
      const handleChainChanged = (chainId) => {
        activate(injected);
      };
      const handleAccountsChanged = (accounts) => {
        if (accounts.length > 0) {
          activate(injected);
        }
      };
      const handleNetworkChanged = (networkId) => {
        activate(injected);
      };

      ethereum.on("connect", handleConnect);
      ethereum.on("chainChanged", handleChainChanged);
      ethereum.on("accountsChanged", handleAccountsChanged);
      ethereum.on("networkChanged", handleNetworkChanged);

      return () => {
        if (ethereum.removeListener) {
          ethereum.removeListener("connect", handleConnect);
          ethereum.removeListener("chainChanged", handleChainChanged);
          ethereum.removeListener("accountsChanged", handleAccountsChanged);
          ethereum.removeListener("networkChanged", handleNetworkChanged);
        }
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, error, suppress, activate]);
}

// TODO: Change alchemy API :))
export function getProvider() {
  // getDefaultProvider("rinkeby");
  return new ethers.providers.JsonRpcBatchProvider(
    "https://mainnet.aurora.dev"
  );
}

export const fetcher =
  (library, contractInfo, additionalArgs) =>
  (...args) => {
    let provider;
    if (library) {
      provider = library.getSigner();
    }

    if (!provider) {
      provider = getProvider();
    }

    // eslint-disable-next-line
    const [active, arg0, arg1, ...params] = args;

    if (ethers.utils.isAddress(arg0)) {
      const address = arg0;
      const method = arg1;
      const contract = new ethers.Contract(address, contractInfo.abi, provider);
      if (additionalArgs) {
        return contract[method](...params.concat(additionalArgs));
      }
      return contract[method](...params);
    }

    const method = arg0;
    if (!library) {
      return;
    }
    return library[method](arg1, ...params);
  };

export const parseValue = (value, tokenDecimals) => {
  const pValue = parseFloat(value);
  if (isNaN(pValue)) {
    return undefined;
  }
  const amount = ethers.utils.parseUnits(value, tokenDecimals);
  return bigNumberify(amount);
};

export function bigNumberify(n) {
  if (n === "") return fp("0");
  return fp(n?.toString()).div(fp(1?.toString()));
}

export function expandDecimals(n, decimals) {
  if (n === "") return fp("0");
  return fp(n?.toString(), decimals);
}

export const trimZeroDecimals = (amount) => {
  if (parseFloat(amount) === parseInt(amount)) {
    return parseInt(amount).toString();
  }
  return amount;
};

export const limitDecimals = (amount, maxDecimals) => {
  let amountStr = amount.toString();
  if (maxDecimals === undefined) {
    return amountStr;
  }
  if (maxDecimals === 0) {
    return amountStr.split(".")[0];
  }
  const dotIndex = amountStr.indexOf(".");
  if (dotIndex !== -1) {
    let decimals = amountStr.length - dotIndex - 1;
    if (decimals > maxDecimals) {
      amountStr = amountStr.substr(
        0,
        amountStr.length - (decimals - maxDecimals)
      );
    }
  }
  return amountStr;
};

export const padDecimals = (amount, minDecimals) => {
  let amountStr = amount.toString();
  const dotIndex = amountStr.indexOf(".");
  if (dotIndex !== -1) {
    const decimals = amountStr.length - dotIndex - 1;
    if (decimals < minDecimals) {
      amountStr = amountStr.padEnd(
        amountStr.length + (minDecimals - decimals),
        "0"
      );
    }
  } else {
    amountStr = amountStr + ".0000";
  }
  return amountStr;
};

export const formatKeyAmount = (
  map,
  key,
  tokenDecimals,
  displayDecimals,
  useCommas
) => {
  if (!map || !map[key]) {
    return "*";
  }

  return formatAmount(map[key], tokenDecimals, displayDecimals, useCommas);
};

function parseSwapOrdersData(swapOrdersData, account) {
  if (!swapOrdersData) {
    return null;
  }

  const [uintProps, addressProps] = swapOrdersData;
  const uintPropsLength = 5;
  const addressPropsLength = 3;
  const count = uintProps.length / uintPropsLength;

  const swapOrders = [];
  for (let i = 0; i < count; i++) {
    const sliced = addressProps
      .slice(addressPropsLength * i, addressPropsLength * (i + 1))
      .concat(uintProps.slice(uintPropsLength * i, uintPropsLength * (i + 1)));
    if (sliced[0] === AddressZero) {
      continue;
    }

    const triggerAboveThreshold = sliced[6].toString() === "1";

    swapOrders.push({
      fromTokenAddress: sliced[0],
      toTokenAddress: sliced[2] === AddressZero ? sliced[1] : sliced[2],
      amountIn: sliced[3],
      minOut: sliced[4],
      triggerRatio: sliced[5],
      triggerAboveThreshold,
      swapOption: SWAP,
      orderType: triggerAboveThreshold ? STOP : LIMIT,
      index: Number(sliced[7]),
      account,
    });
  }

  return swapOrders;
}

export function useOrders(active, library, account) {
  const LIMIT = 10;

  const {
    data: swapOrderIndex = bigNumberify(0),
    mutate: updateSwapOrderIndex,
  } = useSWR([active, orderBookAddress, "swapOrdersIndex"], {
    fetcher: fetcher(library, OrderBook, account),
  });

  // TODO currently retreiving LIMIT + 1 bug
  const fromIndex = swapOrderIndex.gt(LIMIT)
    ? swapOrderIndex.sub(LIMIT).toHexString()
    : 0;
  const toIndex = swapOrderIndex.add(1).toHexString();
  const { data: swapOrdersData, mutate: updateSwapOrders } = useSWR(
    [
      active,
      orderBookReaderAddress,
      "getSwapOrders",
      orderBookAddress,
      account,
      fromIndex,
      toIndex,
    ],
    {
      fetcher: fetcher(library, OrderBookReader),
    }
  );
  const swapOrders = parseSwapOrdersData(swapOrdersData, account);

  return [
    swapOrders,
    (swapOrderIndex, swapOrders, shouldRevalidate) => {
      if (swapOrderIndex || shouldRevalidate) {
        updateSwapOrderIndex(swapOrderIndex, shouldRevalidate);
      }
      if (swapOrders || shouldRevalidate) {
        updateSwapOrders(swapOrders, shouldRevalidate);
      }
    },
  ];
}

export const formatAmount = (
  amount,
  tokenDecimals,
  displayDecimals,
  useCommas
) => {
  if (!amount) {
    return "*";
  }
  if (displayDecimals === undefined) {
    displayDecimals = 4;
  }
  let amountStr = ethers.utils.formatUnits(amount, tokenDecimals);
  amountStr = limitDecimals(amountStr, displayDecimals);
  if (displayDecimals !== 0) {
    amountStr = padDecimals(amountStr, displayDecimals);
  }
  if (useCommas) {
    return numberWithCommas(amountStr);
  }
  return amountStr;
};

export const formatAmountFree = (amount, tokenDecimals, displayDecimals) => {
  if (!amount) {
    return "*";
  }
  let amountStr = ethers.utils.formatUnits(amount, tokenDecimals);
  amountStr = limitDecimals(amountStr, displayDecimals);
  return trimZeroDecimals(amountStr);
};

export function numberWithCommas(x) {
  if (!x) {
    return "*";
  }
  var parts = x.toString().split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return parts.join(".");
}

export function getExplorerUrl(chainId) {
  if (chainId === MAINNET) {
    return "https://explorer.mainnet.aurora.dev/";
  }
  if (chainId === TESTNET) {
    return "https://rinkeby.etherscan.io/";
  }
  if (chainId === 3) {
    return "https://ropsten.etherscan.io/";
  }
  if (chainId === 42) {
    return "https://kovan.etherscan.io/";
  }
  if (chainId === 56) {
    return "https://bscscan.com/";
  }
  if (chainId === MAINNET) {
    return "https://testnet.bscscan.com/";
  }
  if (chainId === LOCAL) {
    return "https://local.etherscan.io/";
  }
  return "https://etherscan.io/";
}

export function getAccountUrl(chainId, account) {
  if (!account) {
    return getExplorerUrl(chainId);
  }
  return getExplorerUrl(chainId) + "address/" + account;
}

export function getTokenUrl(chainId, address) {
  if (!address) {
    return getExplorerUrl(chainId);
  }
  return getExplorerUrl(chainId) + "token/" + address;
}

export function usePrevious(value) {
  const ref = useRef();
  useEffect(() => {
    ref.current = value;
  });
  return ref.current;
}

export async function getGasLimit(contract, method, params, value, gasBuffer) {
  const defaultGasBuffer = 50000;
  const defaultValue = bigNumberify(0);

  if (!value) {
    value = defaultValue;
  }

  let gasLimit = await contract.estimateGas[method](...params, { value });

  if (!gasBuffer) {
    gasBuffer = defaultGasBuffer;
  }

  return gasLimit.add(gasBuffer);
}

export function approveTokens({
  setIsApproving,
  library,
  tokenAddress,
  spender,
  chainId,
  onApproveSubmitted,
  getTokenInfo,
  infoTokens,
  pendingTxns,
  setPendingTxns,
  includeMessage,
}) {
  setIsApproving(true);
  const contract = new ethers.Contract(
    tokenAddress,
    Token.abi,
    library.getSigner()
  );
  contract
    .approve(spender, ethers.constants.MaxUint256)
    .then(async (res) => {
      const txUrl = getExplorerUrl(chainId) + "tx/" + res.hash;
      toast.success(
        <div>
          Approval submitted!{" "}
          <a href={txUrl} target="_blank" rel="noopener noreferrer">
            View status.
          </a>
          <br />
        </div>
      );
      if (onApproveSubmitted) {
        onApproveSubmitted();
      }
      if (getTokenInfo && infoTokens && pendingTxns && setPendingTxns) {
        const token = getTokenInfo(infoTokens, tokenAddress);
        const pendingTxn = {
          hash: res.hash,
          message: includeMessage ? `${token.symbol} Approved!` : false,
        };
        setPendingTxns([...pendingTxns, pendingTxn]);
      }
    })
    .catch((e) => {
      console.error(e);
      toast.error("Approval failed.");
    })
    .finally(() => {
      setIsApproving(false);
    });
}

export const shouldRaiseGasError = (token, amount) => {
  if (!amount) {
    return false;
  }
  if (token.address !== AddressZero) {
    return false;
  }
  if (!token.balance) {
    return false;
  }
  if (amount.gte(token.balance)) {
    return true;
  }
  if (token.balance.sub(amount).lt(DUST_BNB)) {
    return true;
  }
  return false;
};

export const getTokenInfo = (infoTokens, tokenAddress, replaceNative) => {
  if (replaceNative && tokenAddress === NATIVE_TOKEN_ADDRESS) {
    return infoTokens[AddressZero];
  }
  return infoTokens[tokenAddress];
};

export const addAuroraNetwork = async () => {
  const data = [
    {
      chainId: "0x" + MAINNET.toString(16),
      chainName: "Rinkeby",
      nativeCurrency: {
        name: "ETH",
        symbol: "ETH",
        decimals: 18,
      },
      rpcUrls: RPC_PROVIDERS,
      blockExplorerUrls: ["https://explorer.mainnet.aurora.dev"],
    },
  ];

  try {
    await ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: "0x" + TESTNET.toString(16) }],
    });
  } catch (err) {
    toast.error("Failed to switch to Aurora network.");
    // This error code indicates that the chain has not been added to MetaMask.
    if (err.code === 4902) {
      try {
        toast.error("Failed to add the Aurora network.");
        await window.ethereum
          .request({ method: "wallet_addEthereumChain", params: data })
          .catch((err) => {
            toast.error("Failed to add the Aurora network.");
            console.error(err);
          });
      } catch (addError) {
        console.error(addError);
        toast.error("Failed to add the Aurora network.");
      }
    }
  }
};

export const getConnectWalletHandler = (activate) => {
  const fn = async () => {
    activate(getInjectedConnector(), (e) => {
      if (e.message.includes("No Ethereum provider")) {
        toast.error(
          <div>
            Could not find a wallet to connect to.
            <br />
            <a
              href="https://metamask.io"
              target="_blank"
              rel="noopener noreferrer"
            >
              Add a wallet
            </a>{" "}
            to start using the app.
          </div>
        );
        return;
      }
      if (e instanceof UnsupportedChainIdError) {
        toast.error(
          <div>
            <div>
              Your wallet is not connected to the Aurora Supported Network.
            </div>
            <br />
            <div
              className="clickable underline margin-bottom"
              onClick={addAuroraNetwork}
            >
              Switch to Aurora Network
            </div>
          </div>
        );
        return;
      }
      toast.error(e.toString());
    });
  };
  return fn;
};

export const addToken = async (token) => {
  if (!window.ethereum) {
    toast.error("Could not add token to MetaMask");
    return;
  }

  try {
    // wasAdded is a boolean. Like any RPC method, an error may be thrown.
    await window.ethereum.request({
      method: "wallet_watchAsset",
      params: {
        type: "ERC20", // Initially only supports ERC20, but eventually more!
        options: {
          address: token.address, // The address that the token is at.
          symbol: token.symbol, // A ticker symbol or shorthand, up to 5 chars.
          decimals: token?.info?.decimals || token?.decimals, // The number of decimals in the token
          image: token?.info?.imageUrl || token?.imageUrl, // A string url of the token logo
        },
      },
    });
  } catch (error) {
    console.error(error);
    toast.error("Could not add token to MetaMask");
  }
};

export const trim = (number = 0, precision) => {
  const array = number.toString().split(".");
  if (array.length === 1) return number.toString();
  if (precision === 0) {
    array.push(array.pop().substring(0, precision));
    const trimmedNumber = array.join("");
    return trimmedNumber;
  }
  array.push(array.pop().substring(0, precision));
  const trimmedNumber = array.join(".");
  return trimmedNumber;
};
