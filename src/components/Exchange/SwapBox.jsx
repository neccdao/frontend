import React, { useState, useEffect } from "react";

import Slider, { SliderTooltip } from "rc-slider";
import "rc-slider/assets/index.css";

import { toast } from "react-toastify";
import useSWR from "swr";
import { ethers } from "ethers";

import Modal from "../Modal/Modal";
import { IoMdSwap } from "react-icons/io";
import { AiFillSetting } from "react-icons/ai";
import { BsArrowRight } from "react-icons/bs";

import {
  getAccountUrl,
  formatAmount,
  bigNumberify,
  USD_DECIMALS,
  CHAIN_ID,
  LONG,
  SHORT,
  SWAP,
  MARKET,
  SWAP_ORDER_OPTIONS,
  DEFAULT_SLIPPAGE_AMOUNT,
  LEVERAGE_ORDER_OPTIONS,
  getPositionKey,
  getUsd,
  BASIS_POINTS_DIVISOR,
  MARGIN_FEE_BASIS_POINTS,
  PRECISION,
  NDOL_ADDRESS,
  STOP,
  LIMIT,
  THRESHOLD_REDEMPTION_VALUE,
  DUST_BNB,
  getExplorerUrl,
  getSwapFeeBasisPoints,
  usePrevious,
  formatAmountFree,
  fetcher,
  parseValue,
  expandDecimals,
  shouldRaiseGasError,
  getTokenInfo,
  getLiquidationPrice,
  NATIVE_TOKEN_ADDRESS,
  getLeverage,
  approveTokens,
  shortenAddress,
  isSupportedChain,
  getExchangeRate,
  getExchangeRateDisplay,
  DEFAULT_ORDER_EXECUTION_GAS_AMOUNT,
  getNextToAmount,
  getGasLimit,
  useLocalStorageSerializeKey,
} from "../../Helpers";
import { approvePlugin } from "../../Api";
import { getContract } from "../../Addresses";

import Checkbox from "../Checkbox/Checkbox";
import Tab from "../Tab/Tab";
import TokenSelector from "./TokenSelector";
import ExchangeInfoRow from "./ExchangeInfoRow";
import ConfirmationBox from "./ConfirmationBox";

import {
  getTokens,
  getWhitelistedTokens,
  getToken,
  getTokenBySymbol,
} from "../../data/Tokens";
import Token from "../../abis/Token.json";
import Router from "../../abis/Router.json";
import WETH from "../../abis/WETH.json";

const { AddressZero } = ethers.constants;

const replaceNativeTokenAddress = (path) => {
  if (!path) {
    return;
  }

  let updatedPath = [];
  for (let i = 0; i < path.length; i++) {
    let address = path[i];
    if (address === AddressZero) {
      address = NATIVE_TOKEN_ADDRESS;
    }
    updatedPath.push(address);
  }

  return updatedPath;
};

const leverageSliderHandle = (props) => {
  const { value, dragging, index, ...restProps } = props;
  return (
    <SliderTooltip
      prefixCls="rc-slider-tooltip"
      overlay={`${parseFloat(value).toFixed(2)}x`}
      visible={dragging}
      placement="top"
      key={index}
    >
      <Slider.Handle value={value} {...restProps} />
    </SliderTooltip>
  );
};

function getNextAveragePrice({
  size,
  sizeDelta,
  hasProfit,
  delta,
  nextPrice,
  isLong,
}) {
  if (!size || !sizeDelta || !delta || !nextPrice) {
    return;
  }
  const nextSize = size.add(sizeDelta);
  let divisor;
  if (isLong) {
    divisor = hasProfit ? nextSize.add(delta) : nextSize.sub(delta);
  } else {
    divisor = hasProfit ? nextSize.sub(delta) : nextSize.add(delta);
  }
  const nextAveragePrice = nextPrice.mul(nextSize).div(divisor);
  return nextAveragePrice;
}

function getNextFromAmount(
  toAmount,
  fromTokenAddress,
  toTokenAddress,
  infoTokens,
  toTokenPriceUsd,
  ratio
) {
  const defaultValue = { amount: bigNumberify(0) };

  if (!toAmount || !fromTokenAddress || !toTokenAddress || !infoTokens) {
    return defaultValue;
  }

  if (fromTokenAddress === toTokenAddress) {
    return { amount: toAmount };
  }

  const fromToken = getTokenInfo(infoTokens, fromTokenAddress);
  const toToken = getTokenInfo(infoTokens, toTokenAddress);

  if (!fromToken || !toToken) {
    return defaultValue;
  }

  const fromAmountBasedOnRatio =
    ratio &&
    !ratio.isZero() &&
    toAmount
      .mul(ratio)
      .div(PRECISION)
      .mul(toToken.decimals)
      .div(fromToken.decimals);

  if (toTokenAddress === NDOL_ADDRESS) {
    const feeBasisPoints = getSwapFeeBasisPoints(fromToken.isStable);

    if (ratio && !ratio.isZero()) {
      return {
        amount: fromAmountBasedOnRatio
          .mul(BASIS_POINTS_DIVISOR - feeBasisPoints)
          .div(BASIS_POINTS_DIVISOR),
      };
    }
    const fromAmount = toAmount.mul(PRECISION).div(fromToken.maxPrice);
    return {
      amount: fromAmount
        .mul(BASIS_POINTS_DIVISOR + feeBasisPoints)
        .div(BASIS_POINTS_DIVISOR),
    };
  }

  if (fromTokenAddress === NDOL_ADDRESS) {
    const redemptionValue = toToken.redemptionAmount
      .mul(toToken.maxPrice)
      .div(expandDecimals(1, toToken.decimals));
    if (redemptionValue.gt(THRESHOLD_REDEMPTION_VALUE)) {
      const feeBasisPoints = getSwapFeeBasisPoints(toToken.isStable);

      const fromAmount =
        ratio && !ratio.isZero()
          ? fromAmountBasedOnRatio
          : toAmount
              .mul(expandDecimals(1, toToken.decimals))
              .div(toToken.redemptionAmount);

      return {
        amount: fromAmount
          .mul(BASIS_POINTS_DIVISOR + feeBasisPoints)
          .div(BASIS_POINTS_DIVISOR),
      };
    }
  }

  const feeBasisPoints = getSwapFeeBasisPoints(
    fromToken.isStable && toToken.isStable
  );
  const fromAmount =
    ratio && !ratio.isZero()
      ? fromAmountBasedOnRatio
      : toAmount.mul(toToken.maxPrice).div(fromToken.minPrice);
  return {
    amount: fromAmount
      .mul(BASIS_POINTS_DIVISOR + feeBasisPoints)
      .div(BASIS_POINTS_DIVISOR),
  };
}

export default function SwapBox(props) {
  const {
    infoTokens,
    active,
    library,
    account,
    chainId,
    fromTokenAddress,
    setFromTokenAddress,
    toTokenAddress,
    setToTokenAddress,
    swapOption,
    setSwapOption,
    positionsMap,
    maxNdol,
    pendingTxns,
    setPendingTxns,
    tokenSelection,
    setTokenSelection,
    setIsConfirming,
    isConfirming,
    isPendingConfirmation,
    setIsPendingConfirmation,
  } = props;

  const accountUrl = getAccountUrl(chainId, account);

  const [fromValue, setFromValue] = useState("");
  const [toValue, setToValue] = useState("");
  const [anchorOnFromAmount, setAnchorOnFromAmount] = useState(true);
  const [isApproving, setIsApproving] = useState(false);
  const [isWaitingForApproval, setIsWaitingForApproval] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [shortCollateralAddress, setShortCollateralAddress] = useState(
    getTokenBySymbol(CHAIN_ID, "ETH").address
  );
  const isLong = swapOption === LONG;
  const isShort = swapOption === SHORT;
  const isSwap = swapOption === SWAP;
  const [leverageOption, setLeverageOption] = useLocalStorageSerializeKey(
    [CHAIN_ID, "Exchange-swap-leverage-option"],
    "2"
  );
  const [isLeverageSliderEnabled, setIsLeverageSliderEnabled] =
    useLocalStorageSerializeKey(
      [CHAIN_ID, "Exchange-swap-leverage-slider-enabled"],
      true
    );

  const hasLeverageOption =
    isLeverageSliderEnabled && !isNaN(parseFloat(leverageOption));

  const [isSettingsVisible, setIsSettingsVisible] = useState(false);
  const [savedSlippageAmount, setSavedSlippageAmount] =
    useLocalStorageSerializeKey(
      [CHAIN_ID, "Exchange-swap-slippage-basis-points"],
      DEFAULT_SLIPPAGE_AMOUNT
    );
  const [slippageAmount, setSlippageAmount] = useState(0);

  let [orderType, setOrderType] = useLocalStorageSerializeKey(
    [CHAIN_ID, "Order-option"],
    MARKET
  );

  const onOrderOptionChange = (option) => {
    setOrderType(option);
  };

  const [sellValue, setSellValue] = useState("");

  const onSellChange = (evt) => {
    setSellValue(evt.target.value || "");
  };

  const isMarketOrder = orderType === MARKET;
  const orderTypes = isSwap ? SWAP_ORDER_OPTIONS : LEVERAGE_ORDER_OPTIONS;

  const [triggerPriceValue, setTriggerPriceValue] = useState("");
  const triggerPriceUsd = isMarketOrder
    ? 0
    : parseValue(triggerPriceValue, USD_DECIMALS);

  const onTriggerPriceChange = (evt) => {
    setTriggerPriceValue(evt.target.value || "");
  };

  const [triggerRatioValue, setTriggerRatioValue] = useState("");
  const triggerRatio = triggerRatioValue
    ? parseValue(triggerRatioValue, USD_DECIMALS)
    : 0;
  const onTriggerRatioChange = (evt) => {
    setTriggerRatioValue(evt.target.value || "");
  };

  const openSettings = () => {
    const slippage = parseInt(savedSlippageAmount);
    setSlippageAmount((slippage / BASIS_POINTS_DIVISOR) * 100);
    setIsSettingsVisible(true);
  };

  const saveAndCloseSettings = () => {
    const slippage = parseFloat(slippageAmount);
    if (isNaN(slippage)) {
      toast.error("Invalid slippage value");
      return;
    }
    if (slippage > 5) {
      toast.error("Slippage should be less than 5%");
      return;
    }

    const basisPoints = (slippage * BASIS_POINTS_DIVISOR) / 100;
    if (parseInt(basisPoints) !== parseFloat(basisPoints)) {
      toast.error("Max slippage precision is 0.01%");
      return;
    }

    setSavedSlippageAmount(basisPoints);
    setIsSettingsVisible(false);
  };

  let positionKey;
  if (isLong) {
    positionKey = getPositionKey(toTokenAddress, toTokenAddress, true);
  }
  if (isShort) {
    positionKey = getPositionKey(shortCollateralAddress, toTokenAddress, false);
  }

  const existingPosition = positionKey ? positionsMap[positionKey] : undefined;
  const hasExistingPosition =
    existingPosition && existingPosition.size && existingPosition.size.gt(0);

  const whitelistedTokens = getWhitelistedTokens(CHAIN_ID);
  const tokens = getTokens(CHAIN_ID);
  const fromTokens = tokens?.filter((token) => !token.isLP);
  const indexTokens = whitelistedTokens.filter(
    (token) => !token.isStable && !token.isWrapped && !token.isLP
  );
  const toTokens = isSwap ? tokens : indexTokens;

  const routerAddress = getContract(CHAIN_ID, "Router");
  const { data: tokenAllowance, mutate: updateTokenAllowance } = useSWR(
    [active, fromTokenAddress, "allowance", account, routerAddress],
    {
      fetcher: fetcher(library, Token),
    }
  );

  const fromToken = getToken(CHAIN_ID, fromTokenAddress);
  const toToken = getToken(CHAIN_ID, toTokenAddress);
  const shortCollateralToken = getTokenInfo(infoTokens, shortCollateralAddress);

  const fromTokenInfo = getTokenInfo(infoTokens, fromTokenAddress);
  const toTokenInfo = getTokenInfo(infoTokens, toTokenAddress);

  const fromBalance = fromTokenInfo ? fromTokenInfo.balance : bigNumberify(0);
  const toBalance = toTokenInfo ? toTokenInfo.balance : bigNumberify(0);

  const fromAmount = parseValue(fromValue, fromToken.decimals);
  const toAmount = parseValue(toValue, toToken.decimals);

  const needApproval =
    tokenAllowance && fromAmount && fromAmount.gt(tokenAllowance);
  const prevFromTokenAddress = usePrevious(fromTokenAddress);
  const prevNeedApproval = usePrevious(needApproval);
  const prevToTokenAddress = usePrevious(toTokenAddress);

  const fromUsdMin = getUsd(fromAmount, fromTokenAddress, false, infoTokens);
  const toUsdMax = getUsd(
    toAmount,
    toTokenAddress,
    true,
    infoTokens,
    orderType,
    triggerPriceUsd
  );

  useEffect(() => {
    if (
      fromTokenAddress === prevFromTokenAddress &&
      !needApproval &&
      prevNeedApproval &&
      isWaitingForApproval
    ) {
      setIsWaitingForApproval(false);
      toast.success(<div>{fromToken.symbol} approved!</div>);
    }
  }, [
    fromTokenAddress,
    prevFromTokenAddress,
    needApproval,
    prevNeedApproval,
    setIsWaitingForApproval,
    fromToken.symbol,
    isWaitingForApproval,
  ]);

  useEffect(() => {
    if (!toTokens.find((token) => token.address === toTokenAddress)) {
      setToTokenAddress(toTokens[0].address);
    }
  }, [toTokens, toTokenAddress, setToTokenAddress]);

  useEffect(() => {
    if (active) {
      library.on("block", () => {
        updateTokenAllowance(undefined, true);
      });
      return () => {
        library.removeListener("block");
      };
    }
  }, [active, library, updateTokenAllowance]);

  useEffect(() => {
    function onBlock() {}
    if (active) {
      library.on("block", onBlock);
      return () => {
        library.removeListener("block", onBlock);
      };
    }
  }, [active, library]);

  useEffect(() => {
    const updateSwapAmounts = () => {
      if (anchorOnFromAmount) {
        if (!fromAmount) {
          setToValue("");
          return;
        }
        if (toToken) {
          const { amount: nextToAmount } = getNextToAmount(
            fromAmount,
            fromTokenAddress,
            toTokenAddress,
            infoTokens,
            undefined,
            !isMarketOrder && triggerRatio
          );
          const nextToValue = formatAmountFree(
            nextToAmount,
            fromToken.decimals,
            8
          );
          setToValue(nextToValue);
        }
        return;
      }

      if (!toAmount) {
        setFromValue("");
        return;
      }
      if (fromToken) {
        const { amount: nextFromAmount } = getNextFromAmount(
          toAmount,
          fromTokenAddress,
          toTokenAddress,
          infoTokens,
          undefined,
          !isMarketOrder && triggerRatio
        );
        const nextFromValue = formatAmountFree(
          nextFromAmount,
          fromToken.decimals,
          8
        );
        setFromValue(nextFromValue);
      }
    };

    const updateLeverageAmounts = () => {
      if (!hasLeverageOption) {
        return;
      }
      if (anchorOnFromAmount) {
        if (!fromAmount) {
          setToValue("");
          return;
        }

        const toTokenInfo = getTokenInfo(infoTokens, toTokenAddress);
        if (
          toTokenInfo &&
          toTokenInfo.maxPrice &&
          fromUsdMin &&
          fromUsdMin.gt(0)
        ) {
          const leverageMultiplier = parseInt(
            leverageOption * BASIS_POINTS_DIVISOR
          );
          // TODO triggerPrice
          const toTokenPriceUsd =
            !isMarketOrder && triggerPriceUsd && triggerPriceUsd.gt(0)
              ? triggerPriceUsd
              : toTokenInfo.maxPrice;

          const nextToUsd = fromUsdMin
            .mul(leverageMultiplier)
            .div(
              parseInt(
                BASIS_POINTS_DIVISOR + leverageOption * MARGIN_FEE_BASIS_POINTS
              )
            );
          const nextToAmount = nextToUsd
            .mul(expandDecimals(1, toToken.decimals))
            .div(toTokenPriceUsd);
          const nextToValue = formatAmountFree(
            nextToAmount,
            toToken.decimals,
            8
          );
          setToValue(nextToValue);
        }
        return;
      }

      if (!toAmount) {
        setFromValue("");
        return;
      }

      const fromTokenInfo = getTokenInfo(infoTokens, fromTokenAddress);
      if (
        fromTokenInfo &&
        fromTokenInfo.minPrice &&
        toUsdMax &&
        toUsdMax.gt(0)
      ) {
        const leverageMultiplier = parseInt(
          leverageOption * BASIS_POINTS_DIVISOR
        );
        const fees = toUsdMax
          .mul(MARGIN_FEE_BASIS_POINTS)
          .div(BASIS_POINTS_DIVISOR);
        const nextFromUsd = toUsdMax
          .mul(BASIS_POINTS_DIVISOR)
          .div(leverageMultiplier)
          .add(fees);
        const nextFromAmount = nextFromUsd
          .mul(expandDecimals(1, toToken.decimals))
          .div(fromTokenInfo.minPrice);
        const nextFromValue = formatAmountFree(
          nextFromAmount,
          fromToken.decimals,
          8
        );
        setFromValue(nextFromValue);
      }
    };

    if (isSwap) {
      updateSwapAmounts();
    }

    if (isLong || isShort) {
      updateLeverageAmounts();
    }
  }, [
    anchorOnFromAmount,
    fromAmount,
    toAmount,
    fromToken,
    toToken,
    fromTokenAddress,
    toTokenAddress,
    infoTokens,
    isSwap,
    isLong,
    isShort,
    leverageOption,
    fromUsdMin,
    toUsdMax,
    isMarketOrder,
    triggerPriceUsd,
    triggerRatio,
    hasLeverageOption,
  ]);

  useEffect(() => {
    if (swapOption !== SHORT) {
      return;
    }
    if (toTokenAddress === prevToTokenAddress) {
      return;
    }
  }, [toTokenAddress, prevToTokenAddress, swapOption, positionsMap]);

  const [isWaitingForPluginApproval, setIsWaitingForPluginApproval] =
    useState(false);
  const [isPluginApproving, setIsPluginApproving] = useState(false);

  let entryMarkPrice;
  let exitMarkPrice;
  if (toTokenInfo) {
    entryMarkPrice =
      swapOption === LONG ? toTokenInfo.maxPrice : toTokenInfo.minPrice;
    exitMarkPrice =
      swapOption === LONG ? toTokenInfo.minPrice : toTokenInfo.maxPrice;
  }

  let leverage = bigNumberify(0);
  if (fromUsdMin && toUsdMax && fromUsdMin.gt(0)) {
    const fees = toUsdMax
      .mul(MARGIN_FEE_BASIS_POINTS)
      .div(BASIS_POINTS_DIVISOR);
    leverage = toUsdMax.mul(BASIS_POINTS_DIVISOR).div(fromUsdMin.sub(fees));
  }

  let nextAveragePrice = entryMarkPrice;
  if (hasExistingPosition) {
    nextAveragePrice = getNextAveragePrice({
      size: existingPosition.size,
      sizeDelta: toUsdMax,
      hasProfit: existingPosition.hasProfit,
      delta: existingPosition.delta,
      nextPrice: entryMarkPrice,
      isLong,
    });
  }

  const liquidationPrice = getLiquidationPrice({
    isLong,
    size: hasExistingPosition ? existingPosition.size : bigNumberify(0),
    collateral: hasExistingPosition
      ? existingPosition.collateral
      : bigNumberify(0),
    averagePrice: nextAveragePrice,
    entryFundingRate: hasExistingPosition
      ? existingPosition.entryFundingRate
      : bigNumberify(0),
    cumulativeFundingRate: hasExistingPosition
      ? existingPosition.cumulativeFundingRate
      : bigNumberify(0),
    sizeDelta: toUsdMax,
    collateralDelta: fromUsdMin,
    increaseCollateral: true,
    increaseSize: true,
  });

  const existingLiquidationPrice = existingPosition
    ? getLiquidationPrice(existingPosition)
    : undefined;
  let displayLiquidationPrice = liquidationPrice
    ? liquidationPrice
    : existingLiquidationPrice;

  if (hasExistingPosition) {
    const collateralDelta = fromUsdMin ? fromUsdMin : bigNumberify(0);
    const sizeDelta = toUsdMax ? toUsdMax : bigNumberify(0);
    leverage = getLeverage({
      size: existingPosition.size,
      sizeDelta,
      collateral: existingPosition.collateral,
      collateralDelta,
      increaseCollateral: true,
      entryFundingRate: existingPosition.entryFundingRate,
      cumulativeFundingRate: existingPosition.cumulativeFundingRate,
      increaseSize: true,
      hasProfit: existingPosition.hasProfit,
      delta: existingPosition.delta,
    });
  } else if (hasLeverageOption) {
    leverage = bigNumberify(parseInt(leverageOption * BASIS_POINTS_DIVISOR));
  }

  const getSwapError = () => {
    if (fromTokenAddress === toTokenAddress) {
      return "Select different tokens";
    }
    if (!fromAmount || fromAmount.eq(0)) {
      return "Enter amount";
    }
    if (!toAmount || toAmount.eq(0)) {
      return "Enter amount";
    }
    if (!isMarketOrder && !triggerRatioValue) {
      return "Enter a trigger price";
    }

    const fromTokenInfo = getTokenInfo(infoTokens, fromTokenAddress);
    if (
      fromTokenInfo &&
      fromTokenInfo.balance &&
      fromAmount &&
      fromAmount.gt(fromTokenInfo.balance)
    ) {
      return `Insufficient ${fromTokenInfo.symbol} balance`;
    }

    const toTokenInfo = getTokenInfo(infoTokens, toTokenAddress);
    if (
      toToken &&
      toTokenAddress !== NDOL_ADDRESS &&
      toTokenInfo &&
      toTokenInfo.availableAmount &&
      toAmount.gt(toTokenInfo.availableAmount)
    ) {
      // TODO probably need just some warning for limit orders
      // what if a user know what he wants?
      if (isMarketOrder) return "Insufficient liquidity";
    }

    return false;
  };

  const getLeverageError = () => {
    if (!toAmount) {
      return "Enter amount";
    }
    const fromTokenInfo = getTokenInfo(infoTokens, fromTokenAddress);
    if (
      fromTokenInfo &&
      fromTokenInfo.balance &&
      fromAmount &&
      fromAmount.gt(fromTokenInfo.balance)
    ) {
      return `Insufficient ${fromTokenInfo.symbol} balance`;
    }

    if (leverage && leverage.eq(0)) {
      return "Enter amount";
    }
    if (!isMarketOrder && !triggerPriceValue) {
      return "Enter a trigger price";
    }

    if (
      !hasExistingPosition &&
      fromUsdMin &&
      fromUsdMin.lt(expandDecimals(10, USD_DECIMALS))
    ) {
      return "Min order: 10 USD";
    }

    if (leverage && leverage.lt(1.1 * BASIS_POINTS_DIVISOR)) {
      return "Min leverage: 1.1x";
    }

    if (leverage && leverage.gt(30.5 * BASIS_POINTS_DIVISOR)) {
      return "Max leverage: 30.5x";
    }

    let toTokenInfo = getTokenInfo(infoTokens, toTokenAddress);

    if (isLong) {
      let requiredAmount = toAmount;

      if (
        toToken &&
        toTokenAddress !== NDOL_ADDRESS &&
        toTokenInfo.availableAmount &&
        requiredAmount.gt(toTokenInfo.availableAmount)
      ) {
        return "Insufficient liquidity";
      }
    }

    if (isShort) {
      let requiredAmount = toAmount;

      if (
        !shortCollateralToken ||
        !fromTokenInfo ||
        !toTokenInfo ||
        !toTokenInfo.maxPrice ||
        !shortCollateralToken.availableAmount
      ) {
        return "Fetching token info...";
      }
      if (
        toToken &&
        toTokenAddress !== NDOL_ADDRESS &&
        toTokenInfo.availableAmount &&
        requiredAmount.gt(toTokenInfo.availableAmount)
      ) {
        return "Insufficient liquidity";
      }
    }

    return false;
  };

  const getToLabel = () => {
    if (isSwap) {
      return "Receive";
    }
    if (isLong) {
      return "Long";
    }
    return "Short";
  };

  const getError = () => {
    if (isSwap) {
      return getSwapError();
    }
    return getLeverageError();
  };

  const isPrimaryEnabled = () => {
    if (!active) {
      return true;
    }
    const error = getError();
    if (error) {
      return false;
    }
    if ((needApproval && isWaitingForApproval) || isApproving) {
      return false;
    }
    if (isApproving) {
      return false;
    }
    if (isSubmitting) {
      return false;
    }

    return true;
  };

  const getPrimaryText = () => {
    if (!active) {
      return "Connect Wallet";
    }
    if (!isSupportedChain(chainId)) {
      return "Incorrect Network";
    }
    const error = getError();
    if (error) {
      return error;
    }

    if (needApproval && isWaitingForApproval) {
      return "Waiting for Approval";
    }
    if (isApproving) {
      return `Approving ${fromToken.symbol}...`;
    }
    if (needApproval) {
      return `Approve ${fromToken.symbol}`;
    }

    if (isPluginApproving) {
      return "Approving Order Book...";
    }

    if (isSubmitting) {
      if (!isMarketOrder) {
        return "Creating order...";
      }
      if (isSwap) {
        return "Swap...";
      }
      if (isLong) {
        return "Longing...";
      }
      return "Shorting...";
    }

    if (!isMarketOrder) return `Create ${orderType.toLowerCase()} order`;

    if (isSwap) {
      if (toUsdMax.lt(fromUsdMin.mul(95).div(100))) {
        return "High Slippage, Swap Anyway";
      }
      return "Swap";
    }

    // TODO: Make long and short the same
    if (isLong) {
      const indexTokenAddress =
        toTokenAddress === AddressZero ? NATIVE_TOKEN_ADDRESS : toTokenAddress;
      const indexTokenInfo = getTokenInfo(infoTokens, toTokenAddress);
      if (indexTokenInfo && indexTokenInfo.minPrice) {
        const { amount: nextToAmount } = getNextToAmount(
          fromAmount,
          fromTokenAddress,
          indexTokenAddress,
          infoTokens
        );
        const nextToAmountUsd = nextToAmount
          .mul(indexTokenInfo.minPrice)
          .div(expandDecimals(1, indexTokenInfo.decimals));
        if (
          fromTokenAddress === NDOL_ADDRESS &&
          nextToAmountUsd.lt(fromUsdMin.mul(98).div(100))
        ) {
          return "High NDOL Slippage, Long Anyway";
        }
      }
      return `Long ${toToken.symbol}`;
    }
    if (isShort) {
      const indexTokenAddress =
        toTokenAddress === AddressZero ? NATIVE_TOKEN_ADDRESS : toTokenAddress;
      const indexTokenInfo = getTokenInfo(infoTokens, toTokenAddress);
      if (indexTokenInfo && indexTokenInfo.minPrice) {
        const { amount: nextToAmount } = getNextToAmount(
          fromAmount,
          fromTokenAddress,
          indexTokenAddress,
          infoTokens
        );
        const nextToAmountUsd = nextToAmount
          .mul(indexTokenInfo.minPrice)
          .div(expandDecimals(1, indexTokenInfo.decimals));
        if (
          fromTokenAddress === NDOL_ADDRESS &&
          nextToAmountUsd.lt(fromUsdMin.mul(98).div(100))
        ) {
          return "High NDOL Slippage, Short Anyway";
        }
      }
      return `Short ${toToken.symbol}`;
    }

    return `Short ${toToken.symbol}`;
  };

  const onSelectFromToken = (token) => {
    setFromTokenAddress(token.address);
    setIsWaitingForApproval(false);

    const updatedTokenSelection = JSON.parse(JSON.stringify(tokenSelection));
    updatedTokenSelection[swapOption] = {
      from: token.address,
      to: toTokenAddress,
    };
    setTokenSelection(updatedTokenSelection);
  };

  const onSelectShortCollateralAddress = (token) => {
    setShortCollateralAddress(token.address);
  };

  const onSelectToToken = (token) => {
    setToTokenAddress(token.address);
    const updatedTokenSelection = JSON.parse(JSON.stringify(tokenSelection));
    updatedTokenSelection[swapOption] = {
      from: fromTokenAddress,
      to: token.address,
    };
    setTokenSelection(updatedTokenSelection);
  };

  const onFromValueChange = (e) => {
    setAnchorOnFromAmount(true);
    setFromValue(e.target.value);
  };

  const onToValueChange = (e) => {
    setAnchorOnFromAmount(false);
    setToValue(e.target.value);
  };

  const switchTokens = () => {
    if (fromAmount && toAmount) {
      if (anchorOnFromAmount) {
        setToValue(formatAmountFree(fromAmount, fromToken.decimals, 8));
      } else {
        setFromValue(formatAmountFree(toAmount, toToken.decimals, 8));
      }
      setAnchorOnFromAmount(!anchorOnFromAmount);
    }
    setFromTokenAddress(toTokenAddress);
    setToTokenAddress(fromTokenAddress);
    setIsWaitingForApproval(false);

    const updatedTokenSelection = JSON.parse(JSON.stringify(tokenSelection));
    updatedTokenSelection[swapOption] = {
      from: toTokenAddress,
      to: fromTokenAddress,
    };
    setTokenSelection(updatedTokenSelection);
  };

  const handleFulfilled = (res, toastSuccessMessage, txMessage) => {
    if (toastSuccessMessage) {
      toast.success(toastSuccessMessage);
    }
    setIsConfirming(false);
    setAnchorOnFromAmount(true);
    setFromValue("");
    setToValue("");
    const pendingTxn = {
      hash: res.hash,
      message: txMessage,
    };
    setPendingTxns([...pendingTxns, pendingTxn]);
  };

  const wrap = async () => {
    setIsSubmitting(true);

    const contract = new ethers.Contract(
      NATIVE_TOKEN_ADDRESS,
      WETH.abi,
      library.getSigner()
    );
    const gasLimit = await getGasLimit(contract, "deposit", [], fromAmount);
    contract
      .deposit({ value: fromAmount, gasLimit })
      .then(async (res) => {
        const txUrl = getExplorerUrl(CHAIN_ID) + "tx/" + res.hash;
        toast.success(
          <div>
            Swap submitted!{" "}
            <a href={txUrl} target="_blank" rel="noopener noreferrer">
              View status.
            </a>
            <br />
          </div>
        );
        setAnchorOnFromAmount(true);
        setFromValue("");
        setToValue("");
        const pendingTxn = {
          hash: res.hash,
          message: `Swapped ${formatAmount(
            fromAmount,
            fromToken.decimals,
            4,
            true
          )} ${fromToken.symbol} for ${formatAmount(
            toAmount,
            toToken.decimals,
            4,
            true
          )} ${toToken.symbol}`,
        };
        setPendingTxns([...pendingTxns, pendingTxn]);
      })
      .catch((e) => {
        console.error(e);
        toast.error("Swap failed.");
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  };

  const unwrap = async () => {
    setIsSubmitting(true);

    const contract = new ethers.Contract(
      NATIVE_TOKEN_ADDRESS,
      WETH.abi,
      library.getSigner()
    );
    const gasLimit = await getGasLimit(contract, "withdraw", [fromAmount]);
    contract
      .withdraw(fromAmount, { gasLimit })
      .then(async (res) => {
        const txUrl = getExplorerUrl(CHAIN_ID) + "tx/" + res.hash;
        toast.success(
          <div>
            Swap submitted!{" "}
            <a href={txUrl} target="_blank" rel="noopener noreferrer">
              View status.
            </a>
            <br />
          </div>
        );
        setAnchorOnFromAmount(true);
        setFromValue("");
        setToValue("");
        const pendingTxn = {
          hash: res.hash,
          message: `Swapped ${formatAmount(
            fromAmount,
            fromToken.decimals,
            4,
            true
          )} ${fromToken.symbol} for ${formatAmount(
            toAmount,
            toToken.decimals,
            4,
            true
          )} ${toToken.symbol}`,
        };
        setPendingTxns([...pendingTxns, pendingTxn]);
      })
      .catch((e) => {
        console.error(e);
        toast.error("Swap failed.");
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  };

  const swap = async () => {
    if (
      fromTokenAddress === AddressZero &&
      toTokenAddress === NATIVE_TOKEN_ADDRESS
    ) {
      wrap();
      return;
    }

    if (
      fromTokenAddress === NATIVE_TOKEN_ADDRESS &&
      toTokenAddress === AddressZero
    ) {
      unwrap();
      return;
    }

    setIsSubmitting(true);
    let path = [fromTokenAddress, toTokenAddress];
    if (anchorOnFromAmount) {
      const { path: multiPath } = getNextToAmount(
        fromAmount,
        fromTokenAddress,
        toTokenAddress,
        infoTokens
      );
      if (multiPath) {
        path = multiPath;
      }
    } else {
      const { path: multiPath } = getNextFromAmount(
        toAmount,
        fromTokenAddress,
        toTokenAddress,
        infoTokens
      );
      if (multiPath) {
        path = multiPath;
      }
    }
    path = replaceNativeTokenAddress(path);

    let method;
    let contract;
    let value;
    let params;
    let minOut;

    if (isMarketOrder) {
      method = "swap";
      value = bigNumberify(0);
      if (toTokenAddress === AddressZero) {
        method = "swapTokensToETH";
      }

      minOut = toAmount
        .mul(BASIS_POINTS_DIVISOR - savedSlippageAmount)
        .div(BASIS_POINTS_DIVISOR);
      params = [path, fromAmount, minOut, account];
      if (fromTokenAddress === AddressZero) {
        method = "swapETHToTokens";
        value = fromAmount;
        params = [path, minOut, account];
      }
      contract = new ethers.Contract(
        routerAddress,
        Router.abi,
        library.getSigner()
      );
    }

    if (
      shouldRaiseGasError(
        getTokenInfo(infoTokens, fromTokenAddress),
        fromAmount
      )
    ) {
      setIsSubmitting(false);
      toast.error(
        `Leave at least ${formatAmount(DUST_BNB, 18, 3)} BNB for gas`
      );
      return;
    }

    const gasLimit = await getGasLimit(contract, method, params, value);
    contract[method](...params, { value, gasLimit })
      .then(async (res) => {
        const txUrl = getExplorerUrl(CHAIN_ID) + "tx/" + res.hash;
        const toastSuccessMessage = (
          <div>
            Swap {!isMarketOrder ? " order " : ""} submitted!{" "}
            <a href={txUrl} target="_blank" rel="noopener noreferrer">
              View status.
            </a>
            <br />
          </div>
        );
        const txMessage = isMarketOrder
          ? `Swapped ${formatAmount(fromAmount, fromToken.decimals, 4, true)} ${
              fromToken.symbol
            } for ${formatAmount(toAmount, toToken.decimals, 4, true)} ${
              toToken.symbol
            }`
          : `Swap order submitted`;
        handleFulfilled(res, toastSuccessMessage, txMessage);
      })
      .catch((e) => {
        console.error(e);
        toast.error("Swap failed.");
      })
      .finally(() => {
        setIsSubmitting(false);
        setIsPendingConfirmation(false);
      });
  };

  const increasePosition = async () => {
    setIsSubmitting(true);
    const tokenAddress0 =
      fromTokenAddress === AddressZero
        ? NATIVE_TOKEN_ADDRESS
        : fromTokenAddress;
    const indexTokenAddress =
      toTokenAddress === AddressZero ? NATIVE_TOKEN_ADDRESS : toTokenAddress;
    let path = [indexTokenAddress]; // assume long
    if (toTokenAddress !== fromTokenAddress) {
      path = [tokenAddress0, indexTokenAddress];
    }

    if (
      fromTokenAddress === AddressZero &&
      toTokenAddress === NATIVE_TOKEN_ADDRESS
    ) {
      path = [NATIVE_TOKEN_ADDRESS];
    }

    if (
      fromTokenAddress === NATIVE_TOKEN_ADDRESS &&
      toTokenAddress === AddressZero
    ) {
      path = [NATIVE_TOKEN_ADDRESS];
    }

    const refPrice = isLong ? toTokenInfo.maxPrice : toTokenInfo.minPrice;
    const priceBasisPoints = isLong
      ? BASIS_POINTS_DIVISOR + 50
      : BASIS_POINTS_DIVISOR - 50;
    const priceLimit = refPrice.mul(priceBasisPoints).div(BASIS_POINTS_DIVISOR);

    const boundedFromAmount = fromAmount ? fromAmount : bigNumberify(0);

    if (
      fromAmount &&
      fromAmount.gt(0) &&
      fromTokenAddress === NDOL_ADDRESS &&
      isLong
    ) {
      const { amount: nextToAmount, path: multiPath } = getNextToAmount(
        fromAmount,
        fromTokenAddress,
        indexTokenAddress,
        infoTokens
      );
      if (nextToAmount.eq(0)) {
        toast.error("Insufficient liquidity");
        return;
      }
      if (multiPath) {
        path = replaceNativeTokenAddress(multiPath);
      }
    }

    let params = [
      path,
      indexTokenAddress,
      boundedFromAmount,
      0,
      toUsdMax,
      isLong,
      priceLimit,
    ];

    let method = "increasePosition";
    let value = bigNumberify(0);
    // TODO: Check if toTokenAddress is native? WETH collateral -> ETH index worked
    if (fromTokenAddress === AddressZero) {
      method = "increasePositionETH";
      value = boundedFromAmount;
      params = [path, indexTokenAddress, 0, toUsdMax, isLong, priceLimit];
    }

    if (
      shouldRaiseGasError(
        getTokenInfo(infoTokens, fromTokenAddress),
        fromAmount
      )
    ) {
      setIsSubmitting(false);
      toast.error(
        `Leave at least ${formatAmount(DUST_BNB, 18, 3)} BNB for gas`
      );
      return;
    }

    const contract = new ethers.Contract(
      routerAddress,
      Router.abi,
      library.getSigner()
    );

    const gasLimit = await getGasLimit(contract, method, params, value);
    contract[method](...params, { value, gasLimit })
      .then(async (res) => {
        const txUrl = getExplorerUrl(CHAIN_ID) + "tx/" + res.hash;
        const indexToken = getTokenInfo(infoTokens, indexTokenAddress);
        const toastSuccessMessage = (
          <div>
            {isLong ? "Long" : "Short"} submitted!{" "}
            <a href={txUrl} target="_blank" rel="noopener noreferrer">
              View status.
            </a>
            <br />
          </div>
        );
        const txMessage = `Increased ${indexToken.symbol} ${
          isLong ? "Long" : "Short"
        } by ${formatAmount(toUsdMax, USD_DECIMALS, 2)} USD`;
        handleFulfilled(res, toastSuccessMessage, txMessage);
      })
      .catch((e) => {
        console.error(e);
        toast.error(`${isLong ? "Long" : "Short"} failed.`);
      })
      .finally(() => {
        setIsSubmitting(false);
        setIsPendingConfirmation(false);
      });
  };

  const onSwapOptionChange = (opt) => {
    const updatedTokenSelection = JSON.parse(JSON.stringify(tokenSelection));
    updatedTokenSelection[swapOption] = {
      from: fromTokenAddress,
      to: toTokenAddress,
    };
    setTokenSelection(updatedTokenSelection);
    setFromTokenAddress(tokenSelection[opt].from);
    setToTokenAddress(tokenSelection[opt].to);
    setSwapOption(opt);
    setAnchorOnFromAmount(true);
    setFromValue("");
    setToValue("");
  };

  const onConfirmationClick = () => {
    if (!active) {
      props.connectWallet();
      return;
    }

    setIsPendingConfirmation(true);

    if (isSwap) {
      swap();
      return;
    }

    increasePosition();
  };

  function approveFromToken() {
    approveTokens({
      setIsApproving,
      library,
      tokenAddress: fromToken.address,
      spender: routerAddress,
      chainId: CHAIN_ID,
      onApproveSubmitted: () => {
        setIsWaitingForApproval(true);
      },
      infoTokens,
      getTokenInfo,
      pendingTxns,
      setPendingTxns,
    });
  }

  const onClickPrimary = () => {
    if (!active) {
      props.connectWallet();
      return;
    }

    if (needApproval) {
      approveFromToken();
      return;
    }

    if (isSwap) {
      if (
        fromTokenAddress === AddressZero &&
        toTokenAddress === NATIVE_TOKEN_ADDRESS
      ) {
        wrap();
        return;
      }

      if (
        fromTokenAddress === NATIVE_TOKEN_ADDRESS &&
        toTokenAddress === AddressZero
      ) {
        unwrap();
        return;
      }
    }

    setIsConfirming(true);
  };

  const showFromAndToSection = orderType !== STOP;
  const showSizeSection = orderType === STOP;
  const showTriggerPriceSection = !isSwap && !isMarketOrder;
  const showTriggerRatioSection = isSwap && !isMarketOrder;

  let fees;
  let feesUsd;
  if (isSwap) {
    if (fromAmount) {
      const { feeBasisPoints } = getNextToAmount(
        fromAmount,
        fromTokenAddress,
        toTokenAddress,
        infoTokens
      );
      if (feeBasisPoints) {
        fees = fromAmount.mul(feeBasisPoints).div(BASIS_POINTS_DIVISOR);
        const feeTokenPrice =
          fromTokenInfo.address === NDOL_ADDRESS
            ? expandDecimals(1, USD_DECIMALS)
            : fromTokenInfo.maxPrice;
        feesUsd = fees
          .mul(feeTokenPrice)
          .div(expandDecimals(1, fromTokenInfo.decimals));
      }
    }
  } else if (toUsdMax) {
    feesUsd = toUsdMax.mul(MARGIN_FEE_BASIS_POINTS).div(BASIS_POINTS_DIVISOR);
  }

  const leverageMarks = {
    2: "2x",
    5: "5x",
    10: "10x",
    15: "15x",
    20: "20x",
    25: "25x",
    30: "30x",
  };

  return (
    <div className="w-screen lg:max-w-screen-md">
      <Modal
        isVisible={isSettingsVisible}
        setIsVisible={setIsSettingsVisible}
        label="Settings"
      >
        <div>Slippage Tolerance</div>
        <div className="Swap-slippage-tolerance-input-container">
          <input
            type="number"
            className="Swap-slippage-tolerance-input"
            value={slippageAmount}
            onChange={(e) => setSlippageAmount(e.target.value)}
          />
          <div className="Swap-slippage-tolerance-input-percent">%</div>
        </div>
        <button
          className="App-cta Exchange-swap-button"
          onClick={saveAndCloseSettings}
        >
          Save
        </button>
      </Modal>
      {active && (
        <div className="Exchange-swap-wallet-box border">
          <div className="Exchange-swap-account">
            <a href={accountUrl} target="_blank" rel="noopener noreferrer">
              <div className="Exchange-swap-address">
                {shortenAddress(account)}
              </div>
            </a>
            <a href={accountUrl} target="_blank" rel="noopener noreferrer">
              <a
                href={accountUrl}
                className="Exchange-swap-txns-status"
                target="_blank"
                rel="noopener noreferrer"
              >
                {pendingTxns.length} {pendingTxns.length === 1 ? "Tx" : "Txs"}
              </a>
            </a>
            <AiFillSetting
              className="Exchange-swap-settings"
              onClick={openSettings}
            />
          </div>
        </div>
      )}
      <div className="Exchange-swap-box-inner border">
        <div>
          <Tab
            options={["Long", "Short"]}
            option={swapOption}
            onChange={onSwapOptionChange}
          />
        </div>
        {showFromAndToSection && (
          <React.Fragment>
            <div className="Exchange-swap-section mt-4">
              <div className="Exchange-swap-section-top">
                <div className="muted">
                  {fromUsdMin && (
                    // TODO for swap limits price can be different at moment of execution
                    <div className="Exchange-swap-usd">
                      Pay: {formatAmount(fromUsdMin, USD_DECIMALS, 2, true)} USD
                    </div>
                  )}
                  {!fromUsdMin && "Pay"}
                </div>
                {fromBalance && (
                  <div
                    className="muted align-right clickable"
                    onClick={() => {
                      setFromValue(
                        formatAmountFree(
                          fromBalance,
                          fromToken.decimals,
                          fromToken.decimals
                        )
                      );
                      setAnchorOnFromAmount(true);
                    }}
                  >
                    Balance:{" "}
                    {formatAmount(fromBalance, fromToken.decimals, 4, true)}
                  </div>
                )}
              </div>
              <div className="Exchange-swap-section-bottom">
                <div className="Exchange-swap-input-container">
                  <input
                    type="number"
                    placeholder="0.0"
                    className="Exchange-swap-input"
                    value={fromValue}
                    onChange={onFromValueChange}
                  />
                  {fromValue !==
                    formatAmountFree(
                      fromBalance,
                      fromToken.decimals,
                      fromToken.decimals
                    ) && (
                    <div
                      className="Exchange-swap-max"
                      onClick={() => {
                        setFromValue(
                          formatAmountFree(
                            fromBalance,
                            fromToken.decimals,
                            fromToken.decimals
                          )
                        );
                        setAnchorOnFromAmount(true);
                      }}
                    >
                      MAX
                    </div>
                  )}
                </div>
                <div>
                  <TokenSelector
                    label="From"
                    chainId={CHAIN_ID}
                    tokenAddress={fromTokenAddress}
                    onSelectToken={onSelectFromToken}
                    tokens={fromTokens}
                    infoTokens={infoTokens}
                    mintingCap={maxNdol}
                    showMintingCap={isSwap}
                  />
                </div>
              </div>
            </div>
            <div className="Exchange-swap-ball-container">
              <div
                className="Exchange-swap-ball flex justify-center items-center"
                onClick={switchTokens}
              >
                <IoMdSwap className="Exchange-swap-ball-icon" />
              </div>
            </div>
            <div className="Exchange-swap-section">
              <div className="Exchange-swap-section-top">
                <div className="muted">
                  {toUsdMax && (
                    // TODO for swap limits price can be different at moment of execution
                    <div className="Exchange-swap-usd">
                      {getToLabel()}:{" "}
                      {formatAmount(toUsdMax, USD_DECIMALS, 2, true)} USD
                    </div>
                  )}
                  {!toUsdMax && getToLabel()}
                </div>
                {toBalance && isSwap && (
                  <div className="muted align-right">
                    Balance:{" "}
                    {formatAmount(toBalance, toToken.decimals, 4, true)}
                  </div>
                )}
                {(isLong || isShort) && hasLeverageOption && (
                  <div className="muted align-right">
                    Leverage: {parseFloat(leverageOption).toFixed(2)}x
                  </div>
                )}
              </div>
              <div className="Exchange-swap-section-bottom">
                <div>
                  <input
                    type="number"
                    placeholder="0.0"
                    className="Exchange-swap-input"
                    value={toValue}
                    disabled={true}
                    // onChange={onToValueChange}
                  />
                </div>
                <div>
                  <TokenSelector
                    label="To"
                    chainId={CHAIN_ID}
                    tokenAddress={toTokenAddress}
                    onSelectToken={onSelectToToken}
                    tokens={toTokens}
                    infoTokens={infoTokens}
                  />
                </div>
              </div>
            </div>
          </React.Fragment>
        )}
        {showSizeSection && (
          <div className="Exchange-swap-section">
            <div className="Exchange-swap-section-top">
              <div className="muted">Sell, USD</div>
              {existingPosition && (
                <div
                  className="muted align-right clickable"
                  onClick={() => {
                    setSellValue(
                      formatAmountFree(existingPosition.size, USD_DECIMALS, 2)
                    );
                  }}
                >
                  Position:{" "}
                  {formatAmount(existingPosition.size, USD_DECIMALS, 2, true)}
                </div>
              )}
            </div>
            <div className="Exchange-swap-section-bottom">
              <div className="Exchange-swap-input-container">
                <input
                  type="number"
                  placeholder="0.0"
                  className="Exchange-swap-input"
                  value={sellValue}
                  onChange={onSellChange}
                />
                {existingPosition &&
                  sellValue !==
                    formatAmountFree(
                      existingPosition.size,
                      USD_DECIMALS,
                      2
                    ) && (
                    <div
                      className="Exchange-swap-max"
                      onClick={() => {
                        setSellValue(
                          formatAmountFree(
                            existingPosition.size,
                            USD_DECIMALS,
                            2
                          )
                        );
                      }}
                    >
                      MAX
                    </div>
                  )}
              </div>
              <div>
                <TokenSelector
                  label="To"
                  chainId={CHAIN_ID}
                  tokenAddress={toTokenAddress}
                  onSelectToken={onSelectToToken}
                  tokens={toTokens}
                  infoTokens={infoTokens}
                />
              </div>
            </div>
          </div>
        )}
        {showTriggerRatioSection && (
          <div className="Exchange-swap-section">
            <div className="Exchange-swap-section-top">
              <div className="muted">Trigger Price</div>
              {fromTokenInfo && toTokenInfo && (
                <div
                  className="muted align-right clickable"
                  onClick={() => {
                    setTriggerRatioValue(
                      formatAmountFree(
                        getExchangeRate(fromTokenInfo, toTokenInfo),
                        USD_DECIMALS,
                        6
                      )
                    );
                  }}
                >
                  {formatAmount(
                    getExchangeRate(fromTokenInfo, toTokenInfo),
                    USD_DECIMALS,
                    6
                  )}
                </div>
              )}
            </div>
            <div className="Exchange-swap-section-bottom">
              <div className="Exchange-swap-input-container">
                <input
                  type="number"
                  placeholder="0.0"
                  className="Exchange-swap-input"
                  value={triggerRatioValue}
                  onChange={onTriggerRatioChange}
                />
              </div>
              {(() => {
                if (!toTokenInfo) return;
                if (!fromTokenInfo) return;
                return (
                  <div className="PositionEditor-token-symbol">
                    {fromTokenInfo.symbol}&nbsp;per&nbsp;{toTokenInfo.symbol}
                  </div>
                );
              })()}
            </div>
          </div>
        )}
        {showTriggerPriceSection && (
          <div className="Exchange-swap-section">
            <div className="Exchange-swap-section-top">
              <div className="muted">Trigger Price</div>
              <div
                className="muted align-right clickable"
                onClick={() => {
                  setTriggerPriceValue(
                    formatAmountFree(entryMarkPrice, USD_DECIMALS, 2)
                  );
                }}
              >
                Mark: {formatAmount(entryMarkPrice, USD_DECIMALS, 2, true)}
              </div>
            </div>
            <div className="Exchange-swap-section-bottom">
              <div className="Exchange-swap-input-container">
                <input
                  type="number"
                  placeholder="0.0"
                  className="Exchange-swap-input"
                  value={triggerPriceValue}
                  onChange={onTriggerPriceChange}
                />
              </div>
              <div className="PositionEditor-token-symbol">USD</div>
            </div>
          </div>
        )}
        {isSwap && (
          <div className="Exchange-swap-box-info">
            <ExchangeInfoRow label="Fees">
              <div>
                {!fees && "-"}
                {fees && (
                  <div>
                    {formatAmount(fees, fromToken.decimals, 4, true)}{" "}
                    {fromToken.symbol}
                    &nbsp; (${formatAmount(feesUsd, USD_DECIMALS, 2, true)})
                  </div>
                )}
              </div>
            </ExchangeInfoRow>
          </div>
        )}
        {(isLong || isShort) && (
          <div className="Exchange-leverage-box">
            <div className="Exchange-leverage-slider-settings mt-2 mb-4">
              <span className="muted">Leverage slider</span>
            </div>
            <div className="Exchange-leverage-slider App-slider ">
              <Slider
                min={1.1}
                max={30.5}
                step={0.1}
                marks={leverageMarks}
                handle={leverageSliderHandle}
                onChange={(value) => setLeverageOption(value)}
                defaultValue={leverageOption}
              />
            </div>
            {(isLong || isShort) && (
              <div className="Exchange-info-row mt-2">
                <div className="Exchange-info-label">Profits In</div>
                <div className="align-right strong">{toToken.symbol}</div>
              </div>
            )}
            <div className="Exchange-info-row">
              <div className="Exchange-info-label">Leverage</div>
              <div className="align-right">
                {hasExistingPosition && toAmount && toAmount.gt(0) && (
                  <React.Fragment>
                    <div className="inline-block muted">
                      <div className="flex items-center">
                        {formatAmount(existingPosition.leverage, 4, 2)}x
                        <BsArrowRight className="transition-arrow" />
                      </div>
                    </div>
                  </React.Fragment>
                )}
                {toAmount &&
                  leverage &&
                  leverage.gt(0) &&
                  `${formatAmount(leverage, 4, 2)}x`}
                {!toAmount && leverage && leverage.gt(0) && `-`}
                {leverage && leverage.eq(0) && `-`}
              </div>
            </div>
            <div className="Exchange-info-row">
              <div className="Exchange-info-label">Entry Price</div>
              <div className="align-right">
                {hasExistingPosition && toAmount && toAmount.gt(0) && (
                  <div className="inline-block muted">
                    <div className="flex items-center">
                      $
                      {formatAmount(
                        existingPosition.averagePrice,
                        USD_DECIMALS,
                        2,
                        true
                      )}
                      <BsArrowRight className="transition-arrow" />
                    </div>
                  </div>
                )}
                {nextAveragePrice &&
                  `$${formatAmount(nextAveragePrice, USD_DECIMALS, 2, true)}`}
                {!nextAveragePrice && `-`}
              </div>
            </div>
            <div className="Exchange-info-row">
              <div className="Exchange-info-label">Liq. Price</div>
              <div className="align-right">
                {hasExistingPosition && toAmount && toAmount.gt(0) && (
                  <div className="inline-block muted">
                    <div className="flex items-center">
                      $
                      {formatAmount(
                        existingLiquidationPrice,
                        USD_DECIMALS,
                        2,
                        true
                      )}
                      <BsArrowRight className="transition-arrow" />
                    </div>
                  </div>
                )}
                {toAmount &&
                  displayLiquidationPrice &&
                  `$${formatAmount(
                    displayLiquidationPrice,
                    USD_DECIMALS,
                    2,
                    true
                  )}`}
                {!toAmount && displayLiquidationPrice && `-`}
                {!displayLiquidationPrice && `-`}
              </div>
            </div>
            <ExchangeInfoRow label="Fees">
              <div>
                {!feesUsd && "-"}
                {feesUsd &&
                  `${formatAmount(feesUsd, USD_DECIMALS, 2, true)} USD`}
              </div>
            </ExchangeInfoRow>
          </div>
        )}
        <div className="Exchange-swap-button-container">
          <button
            className="App-cta Exchange-swap-button"
            onClick={onClickPrimary}
            disabled={!isPrimaryEnabled()}
          >
            {getPrimaryText()}
          </button>
        </div>
      </div>
      {isSwap && (
        <div className="Exchange-swap-market-box border App-box">
          <div className="Exchange-swap-market-box-title">Swap</div>
          <div className="Exchange-info-row">
            <div className="Exchange-info-label">{fromToken.symbol} Price</div>
            <div className="align-right">
              {fromTokenInfo &&
                formatAmount(
                  fromTokenInfo.minPrice,
                  USD_DECIMALS,
                  2,
                  true
                )}{" "}
              USD
            </div>
          </div>
          <div className="Exchange-info-row">
            <div className="Exchange-info-label">{toToken.symbol} Price</div>
            <div className="align-right">
              {toTokenInfo &&
                formatAmount(toTokenInfo.maxPrice, USD_DECIMALS, 2, true)}{" "}
              USD
            </div>
          </div>
          {!isMarketOrder && (
            <ExchangeInfoRow label="Price">
              {getExchangeRateDisplay(
                getExchangeRate(fromTokenInfo, toTokenInfo),
                fromToken,
                toToken
              )}
            </ExchangeInfoRow>
          )}
        </div>
      )}
      {(isLong || isShort) && (
        <div className="Exchange-swap-market-box border App-box">
          <div className="Exchange-swap-market-box-title">
            {isLong ? "Long" : "Short"}&nbsp;{toToken.symbol}
          </div>
          <div className="Exchange-info-row">
            <div className="Exchange-info-label">Available Amount</div>
            <div className="align-right">
              {toTokenInfo &&
                formatAmount(
                  toTokenInfo?.availableAmount,
                  toTokenInfo?.decimals,
                  4
                )}{" "}
              {toTokenInfo?.symbol}
            </div>
          </div>

          <div className="Exchange-info-row">
            <div className="Exchange-info-label">Borrow Rate</div>
            <div className="align-right">
              {(isLong || isShort) &&
                toTokenInfo &&
                formatAmount(toTokenInfo.fundingRate, 4, 4)}
              {(isLong || isShort) &&
                toTokenInfo &&
                toTokenInfo.fundingRate &&
                "% / 8h"}
            </div>
          </div>
        </div>
      )}
      {isConfirming && (
        <ConfirmationBox
          isSwap={isSwap}
          isLong={isLong}
          isMarketOrder={isMarketOrder}
          orderType={orderType}
          isShort={isShort}
          fromToken={fromToken}
          fromTokenInfo={fromTokenInfo}
          toToken={toToken}
          toTokenInfo={toTokenInfo}
          toAmount={toAmount}
          fromAmount={fromAmount}
          onConfirmationClick={onConfirmationClick}
          setIsConfirming={setIsConfirming}
          hasExistingPosition={hasExistingPosition}
          shortCollateralAddress={shortCollateralAddress}
          shortCollateralToken={shortCollateralToken}
          leverage={leverage}
          existingPosition={existingPosition}
          existingLiquidationPrice={existingLiquidationPrice}
          displayLiquidationPrice={displayLiquidationPrice}
          entryMarkPrice={entryMarkPrice}
          exitMarkPrice={exitMarkPrice}
          triggerPriceUsd={triggerPriceUsd}
          triggerRatio={triggerRatio}
          fees={fees}
          feesUsd={feesUsd}
          isSubmitting={isSubmitting}
          isPendingConfirmation={isPendingConfirmation}
          fromUsdMin={fromUsdMin}
          toUsdMax={toUsdMax}
        />
      )}
    </div>
  );
}
