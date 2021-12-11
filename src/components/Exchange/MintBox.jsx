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
  SWAP_FEE_BASIS_POINTS,
  trim,
} from "../../Helpers";
import { approvePlugin } from "../../Api";
import { getContract } from "../../Addresses";

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
import OrderBook from "../../abis/OrderBook.json";
import MintFarm from "../../abis/MintFarm.json";
import WETH from "../../abis/WETH.json";
import VaultPriceFeed from "../../abis/VaultPriceFeedFacet.json";
import VaultNDOL from "../../abis/VaultNDOLFacet.json";
import Staking from "../../abis/StakingFacet.json";
import nNecc from "../../abis/nNeccFacet.json";

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

const MintBox = (props) => {
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
    flagOrdersEnabled,
  } = props;

  const accountUrl = getAccountUrl(chainId, account);

  const [fromValue, setFromValue] = useState("");
  const [toValue, setToValue] = useState("");
  const [anchorOnFromAmount, setAnchorOnFromAmount] = useState(true);
  const [isApproving, setIsApproving] = useState(false);
  const [isWaitingForApproval, setIsWaitingForApproval] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isClaim, setIsClaim] = useState(false);
  const [isUnstake, setIsUnstake] = useState(false);
  const options = ["Mint", "Burn", "Stake"];
  const isMint = swapOption === "Mint";
  const isBurn = swapOption === "Burn";
  const isStake = swapOption === "Stake";

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
  if (!flagOrdersEnabled) {
    orderType = MARKET;
  }

  const onOrderOptionChange = (option) => {
    setOrderType(option);
  };

  const [sellValue, setSellValue] = useState("");

  const onSellChange = (evt) => {
    setSellValue(evt.target.value || "");
  };

  const isMarketOrder = orderType === MARKET;
  const orderTypes = isBurn ? SWAP_ORDER_OPTIONS : LEVERAGE_ORDER_OPTIONS;

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

  const whitelistedTokens = getWhitelistedTokens(CHAIN_ID);
  const tokens = getTokens(CHAIN_ID);
  const fromTokens =
    swapOption === "Mint"
      ? tokens.filter((token) => token.symbol !== "NDOL")
      : tokens;
  const toTokens =
    swapOption === "Burn"
      ? tokens.filter((token) => token.symbol !== "NDOL")
      : tokens;

  const orderBookAddress = getContract(CHAIN_ID, "OrderBook");
  const nativeTokenAddress = getContract(CHAIN_ID, "NATIVE_TOKEN");

  const routerAddress = getContract(CHAIN_ID, "Router");
  const mintFarmAddress = getContract(CHAIN_ID, "MintFarm");
  const stakingAddress = getContract(CHAIN_ID, "NeccStaking");
  const nNeccAddress = getContract(CHAIN_ID, "nNecc");
  const mintDistributorAddress = getContract(CHAIN_ID, "MintDistributor");

  const fromToken = getToken(CHAIN_ID, fromTokenAddress);
  const toToken = getToken(CHAIN_ID, toTokenAddress);

  const fromTokenInfo = getTokenInfo(infoTokens, fromTokenAddress);
  const toTokenInfo = getTokenInfo(infoTokens, toTokenAddress);

  const fromBalance = fromTokenInfo ? fromTokenInfo.balance : bigNumberify(0);
  const toBalance = toTokenInfo ? toTokenInfo.balance : bigNumberify(0);

  const fromAmount = parseValue(fromValue, fromToken.decimals);
  const toAmount = parseValue(toValue, toToken.decimals);

  const { data: nNeccTokenBalance, mutate: updatenNeccTokenBalance } = useSWR(
    [active, nNeccAddress, "balanceOf", account],
    {
      fetcher: fetcher(library, Token),
    }
  );

  const { data: tokenAllowance, mutate: updateTokenAllowance } = useSWR(
    [active, fromTokenAddress, "allowance", account, routerAddress],
    {
      fetcher: fetcher(library, Token),
    }
  );

  const { data: mintFarmTokenAllowance, mutate: updateMintFarmTokenAllowance } =
    useSWR([active, fromTokenAddress, "allowance", account, mintFarmAddress], {
      fetcher: fetcher(library, Token),
    });

  const {
    data: mintDistributornNeccTokenBalance,
    mutate: updateMintDistributornNeccTokenBalance,
  } = useSWR([active, nNeccAddress, "balanceOf", mintDistributorAddress], {
    fetcher: fetcher(library, Token),
  });

  const { data: stakedBalance, mutate: updateStakedBalance } = useSWR(
    [active, mintFarmAddress, "staked", account],
    {
      fetcher: fetcher(library, MintFarm),
    }
  );
  const formatStakedBalance = formatAmount(
    stakedBalance,
    fromToken?.decimals,
    2,
    false
  );

  const { data: totalStaked, mutate: updateTotalStaked } = useSWR(
    [active, mintFarmAddress, "totalStaked"],
    {
      fetcher: fetcher(library, MintFarm),
    }
  );

  const { data: claimablenNecc, mutate: updateClaimablenNecc } = useSWR(
    [active, mintFarmAddress, "claimable", account],
    {
      fetcher: fetcher(library, MintFarm),
    }
  );
  const { data: stakingEpoch, mutate: updateStakingEpoch } = useSWR(
    [active, stakingAddress, "epoch"],
    {
      fetcher: fetcher(library, Staking, []),
    }
  );

  const { data: nNeccCirculatingSupply, mutate: npdatesNeccCirculatingSupply } =
    useSWR([active, nNeccAddress, "circulatingSupply"], {
      fetcher: fetcher(library, nNecc, []),
    });

  const { data: targetAdjustedFee, mutate: updateTargetAdjustedFee } = useSWR(
    [
      active,
      routerAddress,
      "getTargetAdjustedFee",
      fromTokenAddress?.includes("0x0") ? nativeTokenAddress : fromTokenAddress,
      SWAP_FEE_BASIS_POINTS,
    ],
    {
      fetcher: fetcher(library, VaultNDOL),
    }
  );

  // const { data: ndolAmounts, mutate: updateX } = useSWR(
  //   [
  //     active,
  //     routerAddress,
  //     "ndolAmounts",
  //     fromTokenAddress?.includes("0x0") ? nativeTokenAddress : fromTokenAddress,
  //   ],
  //   {
  //     fetcher: fetcher(library, VaultNDOL),
  //   }
  // );

  // console.log(ndolAmounts?.toString());

  const { data: mintFarmnNeccBalance, mutate: updateMintFarmnNeccBalance } =
    useSWR([active, nNeccAddress, "balanceOf", mintFarmAddress], {
      fetcher: fetcher(library, Token),
    });

  const needMintFarmApproval =
    mintFarmTokenAllowance &&
    fromAmount &&
    fromAmount.gt(mintFarmTokenAllowance);
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
      !needMintFarmApproval &&
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
    needMintFarmApproval,
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

  const updateDataFunctions = [
    updateMintFarmTokenAllowance,
    updateTokenAllowance,
    updateTargetAdjustedFee,
    updatenNeccTokenBalance,
    updateClaimablenNecc,
    updateStakedBalance,
    updateTotalStaked,
    updateStakingEpoch,
    npdatesNeccCirculatingSupply,
    updateMintFarmnNeccBalance,
  ];

  useEffect(() => {
    if (active) {
      library.on("block", () => {
        updateDataFunctions.forEach((updateDataFunction) => {
          updateDataFunction(undefined, true);
        });
      });
      return () => {
        library.removeListener("block");
      };
    }
  }, [active, library, ...updateDataFunctions]);

  useEffect(() => {
    const updateSwapAmounts = () => {
      if (isStake) {
        return;
      }
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
            !isMarketOrder && triggerRatio,
            targetAdjustedFee
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

    if (isBurn) {
      updateSwapAmounts();
    }
    if (isMint) {
      updateSwapAmounts();
    }
    if (isStake) {
      updateSwapAmounts();
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
    isBurn,
    isMint,
    isStake,
    fromUsdMin,
    toUsdMax,
    isMarketOrder,
    triggerPriceUsd,
    triggerRatio,
  ]);

  const getSwapError = () => {
    if (isStake) {
      if (!fromAmount || fromAmount.eq(0)) {
        return "Enter amount";
      }
      return false;
    }
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

  const getToLabel = () => {
    if (isBurn) {
      return "Receive";
    }
    if (isMint) {
      return "Receive";
    }
    if (isStake) {
      return "Staked";
    }
  };

  const getError = () => {
    if (isBurn) {
      return getSwapError();
    }
    if (isMint) {
      return getSwapError();
    }
    if (isStake) {
      return getSwapError();
    }
  };

  const isPrimaryEnabled = () => {
    if (!active) {
      return true;
    }
    const error = getError();
    if (error) {
      return false;
    }
    if ((needMintFarmApproval && isWaitingForApproval) || isApproving) {
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
    if (needMintFarmApproval) {
      return `Approve ${fromToken.symbol}`;
    }
    if (needApproval) {
      return `Approve ${fromToken.symbol}`;
    }

    if (isBurn) {
      if (toUsdMax.lt(fromUsdMin.mul(95).div(100))) {
        return "High Slippage, Swap Anyway";
      }
      return "Burn";
    }

    if (isMint) {
      if (toUsdMax.lt(fromUsdMin.mul(95).div(100))) {
        return "High Slippage, Mint Anyway";
      }
      return "Mint";
    }

    if (isStake) {
      return "Stake";
    }
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
            Mint submitted!{" "}
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
          message: `Minted ${formatAmount(
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
            Mint submitted!{" "}
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
          message: `Minted ${formatAmount(
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
        toast.error("Mint failed.");
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
    } else {
      method = "createSwapOrder";
      const executionFee = DEFAULT_ORDER_EXECUTION_GAS_AMOUNT;
      const triggerAboveThreshold = false;
      let shouldWrap = false;
      // TODO use triggerPrice
      minOut = toAmount
        .mul(BASIS_POINTS_DIVISOR - savedSlippageAmount)
        .div(BASIS_POINTS_DIVISOR);

      value = executionFee;
      if (fromTokenAddress === AddressZero) {
        path[0] = NATIVE_TOKEN_ADDRESS;
        shouldWrap = true;
        value = value.add(fromAmount);
      }
      params = [
        path,
        fromAmount,
        minOut,
        triggerRatio,
        triggerAboveThreshold,
        executionFee,
        shouldWrap,
      ];
      contract = new ethers.Contract(
        orderBookAddress,
        OrderBook.abi,
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

    const isBurn = path[0] === getTokenBySymbol(CHAIN_ID, "NDOL")?.address;
    const gasLimit = await getGasLimit(contract, method, params, value);
    contract[method](...params, { value, gasLimit })
      .then(async (res) => {
        const txUrl = getExplorerUrl(CHAIN_ID) + "tx/" + res.hash;
        const toastSuccessMessage = (
          <div>
            {isBurn ? "Burn" : "Mint"} {!isMarketOrder ? " order " : ""}{" "}
            submitted!{" "}
            <a href={txUrl} target="_blank" rel="noopener noreferrer">
              View status.
            </a>
            <br />
          </div>
        );
        const marketOrderMintMessage = `Minted ${formatAmount(
          fromAmount,
          fromToken.decimals,
          4,
          true
        )} ${fromToken.symbol} for ${formatAmount(
          toAmount,
          toToken.decimals,
          4,
          true
        )} ${toToken.symbol}`;
        const marketOrderBurnMessage = `Burned ${formatAmount(
          fromAmount,
          fromToken.decimals,
          4,
          true
        )} ${fromToken.symbol} for ${formatAmount(
          toAmount,
          toToken.decimals,
          4,
          true
        )} ${toToken.symbol}`;

        const txMessage = isMarketOrder
          ? isBurn
            ? marketOrderBurnMessage
            : marketOrderMintMessage
          : `Mint order submitted`;
        handleFulfilled(res, toastSuccessMessage, txMessage);
      })
      .catch((e) => {
        console.error(e);
        toast.error("Mint failed.");
      })
      .finally(() => {
        setIsSubmitting(false);
        setIsPendingConfirmation(false);
      });
  };

  const unstake = async () => {
    setIsSubmitting(true);
    let method;
    let contract;
    let value;
    let params;
    let minOut;

    method = "unstake";
    value = bigNumberify(0);
    params = [stakedBalance];
    contract = new ethers.Contract(
      mintFarmAddress,
      MintFarm.abi,
      library.getSigner()
    );

    if (
      shouldRaiseGasError(
        getTokenInfo(infoTokens, fromTokenAddress),
        fromAmount
      )
    ) {
      setIsSubmitting(false);
      toast.error(
        `Leave at least ${formatAmount(DUST_BNB, 18, 3)} ETH for gas`
      );
      return;
    }

    const gasLimit = await getGasLimit(contract, method, params, value);
    contract[method](...params, { value, gasLimit })
      .then(async (res) => {
        const txUrl = getExplorerUrl(CHAIN_ID) + "tx/" + res.hash;
        const toastSuccessMessage = (
          <div>
            Unstake submitted!{" "}
            <a href={txUrl} target="_blank" rel="noopener noreferrer">
              View status.
            </a>
            <br />
          </div>
        );
        const unstakeMessage = `Unstaked ${formatAmount(
          fromAmount,
          fromToken.decimals,
          4,
          true
        )} ${fromToken.symbol}`;

        const txMessage = unstakeMessage;
        handleFulfilled(res, toastSuccessMessage, txMessage);
      })
      .catch((e) => {
        console.error(e);
        toast.error("Unstake failed.");
      })
      .finally(() => {
        setIsSubmitting(false);
        setIsPendingConfirmation(false);
      });
  };

  const stake = async () => {
    setIsSubmitting(true);
    let method;
    let contract;
    let value;
    let params;
    let minOut;

    method = "stake";
    value = bigNumberify(0);
    params = [fromAmount];
    contract = new ethers.Contract(
      mintFarmAddress,
      MintFarm.abi,
      library.getSigner()
    );

    if (
      shouldRaiseGasError(
        getTokenInfo(infoTokens, fromTokenAddress),
        fromAmount
      )
    ) {
      setIsSubmitting(false);
      toast.error(
        `Leave at least ${formatAmount(DUST_BNB, 18, 3)} ETH for gas`
      );
      return;
    }

    const gasLimit = await getGasLimit(contract, method, params, value);
    contract[method](...params, { value, gasLimit })
      .then(async (res) => {
        const txUrl = getExplorerUrl(CHAIN_ID) + "tx/" + res.hash;
        const toastSuccessMessage = (
          <div>
            Stake submitted!{" "}
            <a href={txUrl} target="_blank" rel="noopener noreferrer">
              View status.
            </a>
            <br />
          </div>
        );
        const stakeMessage = `Staked ${formatAmount(
          fromAmount,
          fromToken.decimals,
          4,
          true
        )} ${fromToken.symbol}`;

        const txMessage = stakeMessage;
        handleFulfilled(res, toastSuccessMessage, txMessage);
      })
      .catch((e) => {
        console.error(e);
        toast.error("Stake failed.");
      })
      .finally(() => {
        setIsSubmitting(false);
        setIsPendingConfirmation(false);
      });
  };

  const claim = async () => {
    setIsSubmitting(true);
    let method;
    let contract;
    let value;
    let params;
    let minOut;

    method = "claim";
    value = bigNumberify(0);
    params = [];
    contract = new ethers.Contract(
      mintFarmAddress,
      MintFarm.abi,
      library.getSigner()
    );

    if (
      shouldRaiseGasError(
        getTokenInfo(infoTokens, fromTokenAddress),
        fromAmount
      )
    ) {
      setIsSubmitting(false);
      toast.error(
        `Leave at least ${formatAmount(DUST_BNB, 18, 3)} ETH for gas`
      );
      return;
    }

    const gasLimit = await getGasLimit(contract, method, params, value);
    contract[method](...params, { value, gasLimit })
      .then(async (res) => {
        const txUrl = getExplorerUrl(CHAIN_ID) + "tx/" + res.hash;
        const toastSuccessMessage = (
          <div>
            Claim submitted!{" "}
            <a href={txUrl} target="_blank" rel="noopener noreferrer">
              View status.
            </a>
            <br />
          </div>
        );
        const claimMessage = `Claimed Necc`;

        const txMessage = claimMessage;
        handleFulfilled(res, toastSuccessMessage, txMessage);
      })
      .catch((e) => {
        console.error(e);
        toast.error("Claim failed.");
      })
      .finally(() => {
        setIsSubmitting(false);
        setIsPendingConfirmation(false);
      });
  };

  const onSwapOptionChange = (opt) => {
    const ndolTokenSelection = getTokenBySymbol(CHAIN_ID, "NDOL").address;

    if (opt === "Mint") {
      const updatedTokenSelection = JSON.parse(JSON.stringify(tokenSelection));

      updatedTokenSelection["Mint"] = {
        from: tokenSelection["Mint"].from,
        to: ndolTokenSelection,
      };
      setTokenSelection(updatedTokenSelection);
      setFromTokenAddress(tokenSelection["Mint"].from);
      setToTokenAddress(ndolTokenSelection);
      setSwapOption("Mint");
      setAnchorOnFromAmount(true);
      setFromValue("");
      setToValue("");
    } else if (opt === "Stake") {
      const updatedTokenSelection = JSON.parse(JSON.stringify(tokenSelection));
      updatedTokenSelection["Stake"] = {
        from: tokenSelection["Stake"].from,
        to: ndolTokenSelection,
      };
      setTokenSelection(updatedTokenSelection);
      setFromTokenAddress(tokenSelection["Stake"].from);
      setToTokenAddress(ndolTokenSelection);
      setSwapOption("Stake");
      setAnchorOnFromAmount(true);
      setFromValue("");
      setToValue("");
    }
    // Burn
    else {
      const updatedTokenSelection = JSON.parse(JSON.stringify(tokenSelection));
      updatedTokenSelection["Burn"] = {
        from: ndolTokenSelection,
        to: tokenSelection["Burn"].to,
      };
      setTokenSelection(updatedTokenSelection);
      setFromTokenAddress(ndolTokenSelection);
      setToTokenAddress(tokenSelection["Burn"].to);
      setSwapOption("Burn");
      setAnchorOnFromAmount(false);
      setFromValue("");
      setToValue("");
    }
  };

  const onConfirmationClick = () => {
    if (!active) {
      props.connectWallet();
      return;
    }

    setIsPendingConfirmation(true);

    if (isBurn) {
      swap();
      return;
    }
    if (isMint) {
      swap();
      return;
    }

    if (isStake) {
      if (isUnstake) {
        unstake();
        return;
      }
      if (isClaim) {
        claim();
        return;
      }

      stake();
      return;
    }
  };

  function approveFromToken(isMintFarm = false) {
    approveTokens({
      setIsApproving,
      library,
      tokenAddress: fromToken.address,
      spender: isMintFarm ? mintFarmAddress : routerAddress,
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

    if (needMintFarmApproval) {
      approveFromToken(true);
      return;
    }

    if (needApproval) {
      approveFromToken();
      return;
    }

    if (isBurn || isMint) {
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

  const onClickSecondary = (unstake = false) => {
    if (!active) {
      props.connectWallet();
      return;
    }

    if (unstake) {
      setIsClaim(false);
      setIsUnstake(true);
    } else {
      setIsUnstake(false);
      setIsClaim(true);
    }
    setIsConfirming(true);
  };

  const showFromAndToSection = orderType !== STOP;
  const showSizeSection = orderType === STOP;
  const showTriggerPriceSection =
    (!isBurn && !isMarketOrder) || (!isMint && !isMarketOrder);
  const showTriggerRatioSection =
    (isBurn && !isMarketOrder) || (isMint && !isMarketOrder);

  let fees;
  let feesUsd;
  if (isBurn || isMint) {
    if (fromAmount) {
      if (targetAdjustedFee) {
        fees = fromAmount.mul(targetAdjustedFee).div(BASIS_POINTS_DIVISOR);

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

  return (
    <div className="Exchange-swap-box">
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
      <div className="Exchange-swap-wallet-box border">
        {active && (
          <div className="Exchange-swap-account">
            <a href={accountUrl} target="_blank" rel="noopener noreferrer">
              <div className="Exchange-swap-address">
                {shortenAddress(account)}
              </div>
            </a>
            <a href={accountUrl} target="_blank" rel="noopener noreferrer">
              <div
                href={accountUrl}
                className="Exchange-swap-txns-status"
                target="_blank"
                rel="noopener noreferrer"
              >
                {pendingTxns.length} {pendingTxns.length === 1 ? "Tx" : "Txs"}
              </div>
            </a>
            <AiFillSetting
              className="Exchange-swap-settings"
              onClick={openSettings}
            />
          </div>
        )}
        {!active && (
          <div
            className="Exchange-swap-connect-wallet"
            onClick={props.connectWallet}
          >
            Connect Wallet
          </div>
        )}
      </div>
      <div className="Exchange-swap-box-inner border">
        <div>
          <Tab
            options={options}
            option={swapOption}
            onChange={onSwapOptionChange}
          />
        </div>
        {showFromAndToSection && (
          <React.Fragment>
            <div className="Exchange-swap-section">
              <div className="Exchange-swap-section-top">
                {(isBurn || isMint) && (
                  <div className="muted">
                    {fromUsdMin && (
                      // TODO for swap limits price can be different at moment of execution
                      <div className="Exchange-swap-usd">
                        Pay: {formatAmount(fromUsdMin, USD_DECIMALS, 2, true)}{" "}
                        USD
                      </div>
                    )}
                    {!fromUsdMin && "Pay"}
                  </div>
                )}

                {isStake && (
                  <div className="muted">
                    {fromUsdMin && (
                      // TODO for swap limits price can be different at moment of execution
                      <div className="Exchange-swap-usd">
                        Stake: {formatAmount(fromUsdMin, USD_DECIMALS, 2, true)}{" "}
                        USD
                      </div>
                    )}
                    {!fromUsdMin && "Stake"}
                  </div>
                )}
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
                  {swapOption === "Mint" ? (
                    <TokenSelector
                      label="From"
                      chainId={CHAIN_ID}
                      tokenAddress={fromTokenAddress}
                      onSelectToken={onSelectFromToken}
                      tokens={fromTokens}
                      infoTokens={infoTokens}
                      mintingCap={maxNdol}
                      showMintingCap={isBurn || isMint}
                    />
                  ) : (
                    <div className="TokenSelector-box">{fromToken.symbol}</div>
                  )}
                </div>
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
                {toBalance && (isBurn || isMint) && (
                  <div className="muted align-right">
                    Balance:{" "}
                    {formatAmount(toBalance, toToken.decimals, 4, true)}
                  </div>
                )}
              </div>
              <div className="Exchange-swap-section-bottom">
                {isStake && (
                  <div>
                    <input
                      type="number"
                      placeholder="0.0"
                      className="Exchange-swap-input"
                      value={formatStakedBalance}
                      disabled={true}
                    />
                  </div>
                )}

                {(isBurn || isMint) && (
                  <div>
                    <input
                      type="number"
                      placeholder="0.0"
                      className="Exchange-swap-input"
                      value={toValue}
                      onChange={onToValueChange}
                    />
                  </div>
                )}

                <div>
                  {swapOption === "Burn" ? (
                    <TokenSelector
                      label="To"
                      chainId={CHAIN_ID}
                      tokenAddress={toTokenAddress}
                      onSelectToken={onSelectToToken}
                      tokens={toTokens}
                      infoTokens={infoTokens}
                    />
                  ) : (
                    <div className="TokenSelector-box disabled">
                      {toTokenInfo.symbol}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </React.Fragment>
        )}

        {(isBurn || isMint) && (
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

            {isMint && (
              <ExchangeInfoRow label="Target Adjusted Fee">
                <div>
                  {formatAmount(targetAdjustedFee, 2, 3, true)} {" %"}
                </div>
              </ExchangeInfoRow>
            )}
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

        {isStake && (
          <React.Fragment>
            {claimablenNecc?.gt(0) && (
              <div className="Exchange-swap-button-container">
                <button
                  className="App-cta Exchange-swap-button"
                  onClick={() => onClickSecondary(false)}
                >
                  Claim
                </button>
              </div>
            )}

            {stakedBalance?.gt(0) && (
              <div className="Exchange-swap-button-container">
                <button
                  className="App-cta Exchange-swap-button"
                  onClick={() => onClickSecondary(true)}
                >
                  Unstake
                </button>
              </div>
            )}
          </React.Fragment>
        )}
      </div>

      {(isBurn || isMint) && (
        <div className="Exchange-swap-market-box border App-box">
          <div className="Exchange-swap-market-box-title">{swapOption}</div>
          <div className="Exchange-info-row">
            <div className="Exchange-info-label">{fromToken.symbol} Price</div>
            <div className="align-right">
              {fromTokenInfo &&
                formatAmount(
                  fromTokenInfo.minPrice,
                  USD_DECIMALS,
                  5,
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

      {isStake && (
        <div className="Exchange-swap-market-box border App-box">
          <div className="Exchange-swap-market-box-title">{swapOption}</div>
          <ExchangeInfoRow label="nNecc Balance">
            <div>{formatAmount(nNeccTokenBalance, 18, 4, true)}</div>
          </ExchangeInfoRow>
          <ExchangeInfoRow label="Claimable nNecc">
            <div>{formatAmount(claimablenNecc, 18, 4, true)}</div>
          </ExchangeInfoRow>
          <ExchangeInfoRow label="Distributable nNecc">
            <div>{formatAmount(mintFarmnNeccBalance, 18, 2, true)}</div>
          </ExchangeInfoRow>
          <ExchangeInfoRow label="Total Staked NDOL">
            <div>{formatAmount(totalStaked, fromToken?.decimals, 2, true)}</div>
          </ExchangeInfoRow>

          <hr className="my-2 opacity-70" />

          <ExchangeInfoRow
            labelClassName="opacity-100 text-white"
            label="1% of Bond purchases are distributed here"
          >
            <div>{"ⓘ"}</div>
          </ExchangeInfoRow>
        </div>
      )}

      {isConfirming && (
        <ConfirmationBox
          setIsClaim={setIsClaim}
          setIsUnstake={setIsUnstake}
          isSwap={isBurn}
          isBurn={isBurn}
          isMint={isMint}
          isStake={isStake}
          isClaim={isClaim}
          isUnstake={isUnstake}
          isMarketOrder={isMarketOrder}
          orderType={orderType}
          fromToken={fromToken}
          fromTokenInfo={fromTokenInfo}
          toToken={toToken}
          toTokenInfo={toTokenInfo}
          toAmount={toAmount}
          fromAmount={fromAmount}
          onConfirmationClick={onConfirmationClick}
          setIsConfirming={setIsConfirming}
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
};

export { MintBox };
