import React, { useState, useEffect } from "react";

import "rc-slider/assets/index.css";

import { toast } from "react-toastify";
import useSWR from "swr";
import { ethers } from "ethers";

import Modal from "../Modal/Modal";
import { AiFillSetting } from "react-icons/ai";

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
  formatDateTime,
  formatDate,
  trim,
} from "../../Helpers";
import { getContract } from "../../Addresses";

import Tab from "../Tab/Tab";
import TokenSelector from "../Exchange/TokenSelector";
import ExchangeInfoRow from "../Exchange/ExchangeInfoRow";
import ConfirmationBox from "../Exchange/ConfirmationBox";

import {
  getTokens,
  getWhitelistedTokens,
  getToken,
  getTokenBySymbol,
  getBondTokens,
} from "../../data/Tokens";
import Token from "../../abis/Token.json";
import WETH from "../../abis/WETH.json";
import BondDepositoryFacet from "../../abis/BondDepositoryFacet.json";
import UniswapV2Pair from "../../abis/IUniswapV2Pair.json";
import Staking from "../../abis/StakingFacet.json";
import TreasuryFacet from "../../abis/TreasuryFacet.json";

const { AddressZero } = ethers.constants;

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

    const expectedAmount = toAmount.mul(toToken.maxPrice).div(PRECISION);
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

export const BondBox = (props) => {
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
    bondsInfo,
    //
    fiveDayRate,
    apy,
    nextRewardValue,
    stakingRebasePercentage,
    interestDue,
    warmupInfo,
    stakingContractBalance,
    stakingCurrentIndex,
    standardizedDebtRatio,
    currentDebt,
    nextRebase,
    bondPrice,
    nNeccCirculatingSupply,
  } = props;

  const accountUrl = getAccountUrl(chainId, account);

  const [fromValue, setFromValue] = useState("");
  const [toValue, setToValue] = useState("");
  const [anchorOnFromAmount, setAnchorOnFromAmount] = useState(true);
  const [isApproving, setIsApproving] = useState(false);
  const [isWaitingForApproval, setIsWaitingForApproval] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isClaim, setIsClaim] = useState(false);
  const [isStake, setIsStake] = useState(false);
  const [isUnstake, setIsUnstake] = useState(false);
  const isBond = swapOption === "Bond";
  const isRedeem = swapOption === "Redeem";
  const isInfo = swapOption === "Info";

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

  const isMarketOrder = orderType === MARKET;

  const [triggerPriceValue, setTriggerPriceValue] = useState("");
  const triggerPriceUsd = isMarketOrder
    ? 0
    : parseValue(triggerPriceValue, USD_DECIMALS);

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
    const slippage = parseFloat(slippageAmount?.toString());
    if (isNaN(slippage)) {
      toast.error("Invalid slippage value");
      return;
    }
    if (slippage > 5) {
      toast.error("Slippage should be less than 5%");
      return;
    }

    const basisPoints = (slippage * BASIS_POINTS_DIVISOR) / 100;
    if (
      parseInt(basisPoints?.toString()) !== parseFloat(basisPoints?.toString())
    ) {
      toast.error("Max slippage precision is 0.01%");
      return;
    }

    setSavedSlippageAmount(basisPoints);
    setIsSettingsVisible(false);
  };

  const NDOLBond = getContract(CHAIN_ID, "NDOLBond");
  const NeccStaking = getContract(CHAIN_ID, "NeccStaking");
  const sNeccAddress = getContract(CHAIN_ID, "sNecc");
  const nNeccAddress = getContract(CHAIN_ID, "nNecc");
  const NeccAddress = getContract(CHAIN_ID, "Necc");
  const treasuryAddress = getContract(CHAIN_ID, "Treasury");
  const ndolNNECCPairAddress = getContract(CHAIN_ID, "NDOL_NNECC_PAIR");

  const bondTokens = getBondTokens(CHAIN_ID);
  const fromTokens = bondTokens;
  const toTokens = [getTokenBySymbol(CHAIN_ID, "Necc")];

  let fromToken = getToken(CHAIN_ID, fromTokenAddress);
  const toToken = getToken(CHAIN_ID, toTokenAddress);

  const fromTokenInfo = getTokenInfo(infoTokens, fromTokenAddress);
  const toTokenInfo = toTokens[0];
  const [isRedeemSecondary, setIsRedeemSecondary] = useState(false);
  const [isRebase, setIsRebase] = useState(false);
  //
  if (!fromToken?.isBond) {
    fromToken = {
      ...infoTokens[fromTokenAddress],
      ...fromToken,
    };
  }

  const fromBalance = fromTokenInfo ? fromTokenInfo.balance : bigNumberify(0);
  const toBalance = toTokenInfo ? toTokenInfo.balance : bigNumberify(0);
  const fromAmount = parseValue(fromValue, fromToken.decimals);
  const toAmount = parseValue(toValue, toToken.decimals);

  const { data: tokenAllowance, mutate: updateTokenAllowance } = useSWR(
    [active, fromTokenAddress, "allowance", account, NDOLBond],
    {
      fetcher: fetcher(library, Token),
    }
  );
  const { data: stakingTokenAllowance, mutate: updateStakingTokenAllowance } =
    useSWR([active, NeccAddress, "allowance", account, NeccStaking], {
      fetcher: fetcher(library, Token),
    });
  const { data: nNeccTokenAllowance, mutate: updatenNeccTokenAllowance } =
    useSWR([active, nNeccAddress, "allowance", account, NeccStaking], {
      fetcher: fetcher(library, Token),
    });
  const { data: NeccTokenBalance, mutate: updateNeccTokenBalance } = useSWR(
    [active, NeccAddress, "balanceOf", account],
    {
      fetcher: fetcher(library, Token),
    }
  );
  const { data: nNeccTokenBalance, mutate: updatenNeccTokenBalance } = useSWR(
    [active, nNeccAddress, "balanceOf", account],
    {
      fetcher: fetcher(library, Token),
    }
  );

  const needApproval =
    tokenAllowance && fromAmount && fromAmount.gt(tokenAllowance);
  const needStakingApproval =
    stakingTokenAllowance && NeccTokenBalance?.gt(stakingTokenAllowance);
  const needUnstakingApproval =
    nNeccTokenAllowance && nNeccTokenBalance?.gt(nNeccTokenAllowance);

  const prevFromTokenAddress = usePrevious(fromTokenAddress);
  const prevNeedApproval = usePrevious(needApproval);

  const fromUsdMin = getUsd(fromAmount, fromTokenAddress, false, infoTokens);
  const toUsdMax = getUsd(
    toAmount,
    toTokenAddress,
    true,
    infoTokens,
    orderType,
    triggerPriceUsd
  );

  const isToAmountGreaterThanAvailableBonds = toAmount?.gt(
    fromToken?.maxPayout || 0
  );

  const ndolBondAddress = getContract(CHAIN_ID, "NDOLBond");
  const { data: ndolnNECCPairReserves, mutate: updatendolnNECCPairReserves } =
    useSWR([active, ndolNNECCPairAddress, "getReserves"], {
      fetcher: fetcher(library, UniswapV2Pair),
    });

  const ndolnNECCPairMarketPrice =
    ndolnNECCPairReserves &&
    Number(ndolnNECCPairReserves?.[1].toString()) /
      Number(ndolnNECCPairReserves?.[0].toString());

  const nNeccMarketPrice = ndolnNECCPairMarketPrice
    ? bigNumberify(ndolnNECCPairMarketPrice)?.mul(expandDecimals(1, 18))
    : bigNumberify(0);

  const nNeccBondPrice =
    bondPrice && stakingCurrentIndex
      ? bigNumberify(bondPrice)
          ?.mul(stakingCurrentIndex)
          ?.div(expandDecimals(1, 9))
      : bigNumberify(0);

  // console.log(nNeccBondPrice?.toString());
  // const debtRatio = standardizedDebtRatio || bigNumberify(0);
  // const calculatedBondPrice = bigNumberify(500)
  //   ?.mul(debtRatio)
  //   ?.add(1000000000)
  //   ?.div(1e7);
  // console.log("bondPrice", bondPrice?.toString());
  // console.log("debtRatio", debtRatio?.toString());
  // console.log("calculatedBondPrice", calculatedBondPrice?.toString());

  const bondDiscount =
    nNeccBondPrice &&
    nNeccMarketPrice &&
    (nNeccBondPrice < nNeccMarketPrice
      ? Number(nNeccMarketPrice?.sub(nNeccBondPrice)?.toString()) /
        Number(nNeccBondPrice?.toString() || 1)
      : bigNumberify(0));

  const { data: principleValuation, mutate: updatePrincipleValuation } = useSWR(
    [
      active,
      treasuryAddress,
      "valueOfToken",
      fromTokenAddress,
      fromAmount?.toString(),
    ],
    {
      fetcher: fetcher(library, TreasuryFacet),
    }
  );

  const { data: bondPayoutFor, mutate: updateBondPayoutFor } = useSWR(
    [
      active,
      ndolBondAddress,
      "payoutFor",
      principleValuation,
      fromTokenAddress,
    ],
    {
      fetcher: fetcher(library, BondDepositoryFacet),
    }
  );

  const bondPayoutForUsd = bondPayoutFor
    ?.mul(expandDecimals(1, 3))
    ?.mul(fromToken.price);

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

  const updateDataFunctions = [
    updateTokenAllowance,
    updateStakingTokenAllowance,
    updatenNeccTokenAllowance,
    updateNeccTokenBalance,
    updatenNeccTokenBalance,
    updatePrincipleValuation,
    updateBondPayoutFor,
    updatendolnNECCPairReserves,
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
      if (anchorOnFromAmount) {
        if (!fromAmount) {
          setToValue("");
          return;
        }
        if (isInfo) {
          setToValue(fromValue);
          return;
        }
        if (toToken) {
          const nextToValue = formatAmountFree(bondPayoutFor, 9, 8);
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

    if (isRedeem) {
      updateSwapAmounts();
    }
    if (isBond) {
      updateSwapAmounts();
    }
    if (isInfo) {
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
    isRedeem,
    isBond,
    fromUsdMin,
    toUsdMax,
    isMarketOrder,
    triggerPriceUsd,
    triggerRatio,
  ]);

  const getSwapError = (isSecondary) => {
    if (isBond) {
      if (fromTokenAddress === toTokenAddress) {
        return "Select different tokens";
      }
    }
    if (isRedeem && fromToken?.pendingPayoutFor?.eq(0)) {
      return "Nothing to claim";
    }
    if (isInfo) {
      if (isSecondary) {
        return false;
      }
    }
    if (isBond) {
      if (!fromAmount || fromAmount.eq(0)) {
        return "Enter amount";
      }
      if (!toAmount || toAmount.eq(0)) {
        return "Enter amount";
      }
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

    return false;
  };

  const getToLabel = () => {
    if (isRedeem) {
      return "Pending";
    }
    if (isInfo) {
      if (fromToken?.vestingTerm?.toNumber()) {
        const untilDateTime =
          Date.now() / 1000 + fromToken?.vestingTerm?.toNumber();
        return "Next rebase in " + formatDateTime(untilDateTime);
      }
    }
    if (isBond) {
      if (fromToken?.vestingTerm?.toNumber()) {
        const untilDateTime =
          Date.now() / 1000 + fromToken?.vestingTerm?.toNumber();
        return "Vesting till " + formatDateTime(untilDateTime);
      }
    }
  };

  const getError = (isSecondary = false) => {
    if (isRedeem) {
      return getSwapError();
    }
    if (isBond) {
      return getSwapError();
    }
    if (isInfo) {
      return getSwapError(isSecondary);
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
    if ((needApproval && isWaitingForApproval) || isApproving) {
      return false;
    }
    if ((needStakingApproval && isWaitingForApproval) || isApproving) {
      return false;
    }

    if (isApproving) {
      return false;
    }
    if (isSubmitting) {
      return false;
    }
    if (isBond) {
      if (isToAmountGreaterThanAvailableBonds) {
        return false;
      }
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

    if (
      (needApproval && isWaitingForApproval) ||
      (needStakingApproval && isWaitingForApproval)
    ) {
      return "Waiting for Approval";
    }

    if (isApproving) {
      if (needUnstakingApproval) {
        return `Approving nNecc ...`;
      }
      if (needStakingApproval) {
        return `Approving Necc ...`;
      }
      return `Approving ${fromToken.symbol}...`;
    }
    if (isInfo) {
      if (needUnstakingApproval) {
        return `Approve nNecc for Unstaking`;
      }
      if (needStakingApproval) {
        return `Approve Necc for Staking`;
      }
    }
    if (needApproval) {
      return `Approve ${fromToken.symbol}`;
    }

    if (isSubmitting) {
      if (!isMarketOrder) {
        return "Creating order...";
      }
      if (isRedeemSecondary) {
        return "Redeem and Staking ...";
      }
      if (isRedeem) {
        return "Redeem and Staking...";
      }
      if (isBond) {
        return "Bond...";
      }

      if (isInfo) {
        return nNeccTokenBalance?.gt(0) ? "Unstake..." : "Stake...";
      }
    }

    if (!isMarketOrder) return `Create ${orderType.toLowerCase()} order`;

    if (isBond) {
      if (isToAmountGreaterThanAvailableBonds) {
        return "Insufficient Bonds";
      }
      return "Bond";
    }
    if (isRedeem) {
      return "Redeem and Stake";
    }

    if (isInfo) {
      return nNeccTokenBalance?.gt(0) ? "Unstake nNecc" : "Stake Necc";
    }
  };

  const getSecondaryText = () => {
    const error = getError(true);
    if (error) {
      return error;
    }

    if (isInfo) {
      return "Rebase";
    }
    return "Redeem and Stake";
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

  const rebase = async () => {
    setIsSubmitting(true);

    let method;
    let contract;
    let value;
    let params;

    method = "rebase";
    value = bigNumberify(0);
    params = [];

    contract = new ethers.Contract(
      NeccStaking,
      Staking.abi,
      library.getSigner()
    );

    try {
      const gasLimit = await getGasLimit(contract, method, params, value);
      const res = await contract[method](...params, { value, gasLimit });
      const txUrl = getExplorerUrl(CHAIN_ID) + "tx/" + res.hash;
      const toastSuccessMessage = (
        <div>
          Rebase submitted!{" "}
          <a href={txUrl} target="_blank" rel="noopener noreferrer">
            View status.
          </a>
          <br />
        </div>
      );

      const stakeMessage = `Rebased ${toToken.symbol}`;
      const txMessage = stakeMessage;

      handleFulfilled(res, toastSuccessMessage, txMessage);
    } catch (err) {
      console.error(err);
      toast.error("Rebase failed");
    } finally {
      setIsSubmitting(false);
      setIsConfirming(false);
      setIsPendingConfirmation(false);
      setIsRebase(false);
    }
  };

  const claim = async () => {
    setIsSubmitting(true);

    let method;
    let contract;
    let value;
    let params;

    method = "claim";
    value = bigNumberify(0);
    params = [account];

    contract = new ethers.Contract(
      NeccStaking,
      Staking.abi,
      library.getSigner()
    );

    try {
      const gasLimit = await getGasLimit(contract, method, params, value);
      const res = await contract[method](...params, { value, gasLimit });
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

      const stakeMessage = `Claimed ${toToken.symbol}`;
      const txMessage = stakeMessage;

      handleFulfilled(res, toastSuccessMessage, txMessage);
    } catch (err) {
      console.error(err);
      toast.error("Claim failed");
    } finally {
      setIsSubmitting(false);
      setIsConfirming(false);
      setIsPendingConfirmation(false);
      setIsClaim(false);
    }
  };

  const stake = async () => {
    setIsSubmitting(true);

    let method;
    let contract;
    let value;
    let params;

    method = "stake";
    value = bigNumberify(0);
    params = [NeccTokenBalance, account];

    contract = new ethers.Contract(
      NeccStaking,
      Staking.abi,
      library.getSigner()
    );

    try {
      const gasLimit = await getGasLimit(contract, method, params, value);
      const res = await contract[method](...params, { value, gasLimit });
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

      const stakeMessage = `Staked ${toToken.symbol}`;
      const txMessage = stakeMessage;

      handleFulfilled(res, toastSuccessMessage, txMessage);
    } catch (err) {
      console.error(err);
      toast.error("Stake failed");
    } finally {
      setIsSubmitting(false);
      setIsConfirming(false);
      setIsPendingConfirmation(false);
      setIsStake(false);
    }
  };

  const unstake = async () => {
    setIsSubmitting(true);

    let method;
    let contract;
    let value;
    let params;

    method = "unstake";
    value = bigNumberify(0);
    params = [nNeccTokenBalance, account];

    contract = new ethers.Contract(
      NeccStaking,
      Staking.abi,
      library.getSigner()
    );

    try {
      const gasLimit = await getGasLimit(contract, method, params, value);
      const res = await contract[method](...params, { value, gasLimit });
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

      const unstakeMessage = `Unstaked nNecc`;
      const txMessage = unstakeMessage;

      handleFulfilled(res, toastSuccessMessage, txMessage);
    } catch (err) {
      console.error(err);
      toast.error("Unstake failed");
    } finally {
      setIsSubmitting(false);
      setIsConfirming(false);
      setIsPendingConfirmation(false);
      setIsUnstake(false);
    }
  };

  const redeem = async () => {
    setIsSubmitting(true);

    let method;
    let contract;
    let value;
    let params;

    method = "redeem";
    value = bigNumberify(0);
    params = [account, fromTokenAddress];

    contract = new ethers.Contract(
      NDOLBond,
      BondDepositoryFacet.abi,
      library.getSigner()
    );

    try {
      const gasLimit = await getGasLimit(contract, method, params, value);
      const res = await contract[method](...params, { value, gasLimit });
      const txUrl = getExplorerUrl(CHAIN_ID) + "tx/" + res.hash;
      const toastSuccessMessage = (
        <div>
          {"Redeem and Stake"} submitted!{" "}
          <a href={txUrl} target="_blank" rel="noopener noreferrer">
            View status.
          </a>
          <br />
        </div>
      );

      const marketOrderRedeemAndStakeMessage = `Redeem and Staked ${toToken.symbol}`;
      const txMessage = marketOrderRedeemAndStakeMessage;
      handleFulfilled(res, toastSuccessMessage, txMessage);
    } catch (err) {
      console.error(err);
      toast.error("Redeem and Stake failed.");
    } finally {
      setIsSubmitting(false);
      setIsConfirming(false);
      setIsPendingConfirmation(false);
      setIsRedeemSecondary(false);
    }
  };

  const bond = async () => {
    setIsSubmitting(true);

    let method;
    let contract;
    let value;
    let params;
    let maxPrice;

    if (isBond) {
      method = "deposit";
      value = bigNumberify(0);
      maxPrice = fromTokenInfo?.price
        .mul(BASIS_POINTS_DIVISOR + savedSlippageAmount)
        .div(BASIS_POINTS_DIVISOR);
      params = [fromAmount, maxPrice, account, fromTokenAddress];

      contract = new ethers.Contract(
        NDOLBond,
        BondDepositoryFacet.abi,
        library.getSigner()
      );
    }

    try {
      const gasLimit = await getGasLimit(contract, method, params, value);
      const res = await contract[method](...params, { value, gasLimit });
      const txUrl = getExplorerUrl(CHAIN_ID) + "tx/" + res.hash;
      const toastSuccessMessage = (
        <div>
          {isRedeem ? "Redeem" : "Bond"} {!isMarketOrder ? " order " : ""}{" "}
          submitted!{" "}
          <a href={txUrl} target="_blank" rel="noopener noreferrer">
            View status.
          </a>
          <br />
        </div>
      );
      const marketOrderBondMessage = `Bonded ${formatAmount(
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
      const marketOrderRedeemMessage = `Redeemed ${formatAmount(
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
        ? isRedeem
          ? marketOrderRedeemMessage
          : marketOrderBondMessage
        : `Bond order submitted`;
      handleFulfilled(res, toastSuccessMessage, txMessage);
    } catch (err) {
      console.error(err);
      toast.error("Bond failed.");
    } finally {
      setIsSubmitting(false);
      setIsConfirming(false);
      setIsPendingConfirmation(false);
    }
  };

  const onSwapOptionChange = (opt) => {
    const neccTokenSelection = getTokenBySymbol(CHAIN_ID, "Necc").address;

    if (opt === "Bond") {
      const updatedTokenSelection = JSON.parse(JSON.stringify(tokenSelection));

      updatedTokenSelection["Bond"] = {
        from: tokenSelection["Bond"].from,
        to: neccTokenSelection,
      };
      setTokenSelection(updatedTokenSelection);
      setFromTokenAddress(tokenSelection["Bond"].from);
      setToTokenAddress(neccTokenSelection);
      setSwapOption("Bond");
      setAnchorOnFromAmount(true);
      setFromValue("");
      setToValue("");
    } else if (opt === "Info") {
      const updatedTokenSelection = JSON.parse(JSON.stringify(tokenSelection));

      updatedTokenSelection["Info"] = {
        from: neccTokenSelection,
        to: neccTokenSelection,
      };
      setTokenSelection(updatedTokenSelection);
      setFromTokenAddress(neccTokenSelection);
      setToTokenAddress(neccTokenSelection);
      setSwapOption("Info");
      setAnchorOnFromAmount(true);
      setFromValue("");
      setToValue("");
    } // Redeem
    else {
      const updatedTokenSelection = JSON.parse(JSON.stringify(tokenSelection));
      updatedTokenSelection["Redeem"] = {
        from: neccTokenSelection,
        to: tokenSelection["Redeem"].to,
      };
      setTokenSelection(updatedTokenSelection);
      setFromTokenAddress(tokenSelection["Bond"].from);
      setToTokenAddress(tokenSelection["Redeem"].to);
      setSwapOption("Redeem");
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
    if (isRebase) {
      rebase();
      return;
    }
    if (isClaim) {
      claim();
      return;
    }
    if (isInfo) {
      if (nNeccTokenBalance?.gt(0)) {
        unstake();
        return;
      }
      if (NeccTokenBalance?.gt(0)) {
        stake();
        return;
      }
      return;
    }
    if (isRedeem) {
      redeem();
      return;
    }
    if (isBond) {
      bond();
      return;
    }
  };

  function approveFromToken() {
    if (isInfo && needUnstakingApproval) {
      approveTokens({
        setIsApproving,
        library,
        tokenAddress: nNeccAddress,
        spender: NeccStaking,
        chainId: CHAIN_ID,
        onApproveSubmitted: () => {
          setIsWaitingForApproval(true);
        },
        infoTokens,
        getTokenInfo,
        pendingTxns,
        setPendingTxns,
      });
      return;
    }
    if (isInfo && needStakingApproval) {
      approveTokens({
        setIsApproving,
        library,
        tokenAddress: NeccAddress,
        spender: NeccStaking,
        chainId: CHAIN_ID,
        onApproveSubmitted: () => {
          setIsWaitingForApproval(true);
        },
        infoTokens,
        getTokenInfo,
        pendingTxns,
        setPendingTxns,
      });
      return;
    } else {
      approveTokens({
        setIsApproving,
        library,
        tokenAddress: fromToken.address,
        spender: NDOLBond,
        chainId: CHAIN_ID,
        onApproveSubmitted: () => {
          setIsWaitingForApproval(true);
        },
        infoTokens,
        getTokenInfo,
        pendingTxns,
        setPendingTxns,
      });
      return;
    }
  }

  const onClickPrimary = () => {
    if (!active) {
      props.connectWallet();
      return;
    }

    if (isInfo) {
      if (needUnstakingApproval) {
        approveFromToken();
        return;
      }
      if (needStakingApproval) {
        approveFromToken();
        return;
      }
    }

    if (needApproval) {
      approveFromToken();
      return;
    }

    setIsConfirming(true);
  };

  let fees;
  let feesUsd;
  if (isRedeem || isBond) {
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
            onChange={(e) => setSlippageAmount(Number(e.target.value))}
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
              <div className="Exchange-swap-txns-status">
                {pendingTxns.length} {pendingTxns.length === 1 ? "Tx" : "Txs"}
              </div>
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
            options={["Bond", "Redeem", "Info"]}
            option={swapOption}
            onChange={onSwapOptionChange}
          />
        </div>

        {isRedeem && (
          <React.Fragment>
            <div className="Exchange-swap-section">
              <div className="Exchange-swap-section-top">
                <div className="muted">{!fromUsdMin && "Redeemable"}</div>
              </div>

              <div className="Exchange-swap-section-bottom">
                <div className="Exchange-swap-input-container">
                  <input
                    disabled={true}
                    type="number"
                    placeholder="0.0"
                    className="Exchange-swap-input"
                    value={formatAmount(
                      fromToken?.pendingPayoutFor,
                      9,
                      9,
                      false
                    )}
                  />
                </div>
                <div>
                  <div className="TokenSelector-box">{toToken.symbol}</div>
                </div>
              </div>
            </div>

            {fromToken?.fullyVestingTime?.gt(0) && (
              <div className="Exchange-swap-section">
                <div className="Exchange-swap-section-top">
                  <div className="muted">{!toUsdMax && getToLabel()}</div>
                  <div className="muted align-right clickable">
                    Fully vesting at{" "}
                    {formatDateTime(fromToken?.fullyVestingTime)}
                  </div>
                </div>

                <div className="Exchange-swap-section-bottom">
                  <div className="Exchange-swap-input-container">
                    <input
                      disabled={true}
                      type="number"
                      placeholder="0.0"
                      className="Exchange-swap-input"
                      value={formatAmount(interestDue, 9, 9, false)}
                    />
                  </div>
                  <div>
                    <div className="TokenSelector-box">{toToken.symbol}</div>
                  </div>
                </div>
              </div>
            )}
          </React.Fragment>
        )}

        {isBond && (
          <React.Fragment>
            <div className="Exchange-swap-section">
              <div className="Exchange-swap-section-top">
                <div className="muted">
                  {bondPayoutFor && (
                    // TODO for swap limits price can be different at moment of execution
                    <div className="Exchange-swap-usd">
                      Bond:{" "}
                      {formatAmount(bondPayoutForUsd, USD_DECIMALS, 2, true)}{" "}
                      USD
                    </div>
                  )}
                  {!fromUsdMin && "Bond"}
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
                    {formatAmount(fromBalance, fromToken.decimals, 6, true)}
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
                  {swapOption === "Bond" ? (
                    <TokenSelector
                      label="From"
                      chainId={CHAIN_ID}
                      tokenAddress={fromTokenAddress}
                      onSelectToken={onSelectFromToken}
                      tokens={fromTokens}
                      infoTokens={infoTokens}
                      mintingCap={maxNdol}
                      showBondingCap={isRedeem || isBond}
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
                    <div className="Exchange-swap-usd">{getToLabel()}</div>
                  )}
                  {!toUsdMax && getToLabel()}
                </div>
                {toBalance && (
                  <div
                    className="muted align-right clickable"
                    onClick={() => {
                      setFromValue(
                        formatAmountFree(
                          toBalance,
                          toToken.decimals,
                          toToken.decimals
                        )
                      );
                      setAnchorOnFromAmount(true);
                    }}
                  >
                    Balance:{" "}
                    {formatAmount(toBalance, toToken.decimals, 6, true)}
                  </div>
                )}
              </div>

              <div className="Exchange-swap-section-bottom">
                <div>
                  <input
                    type="number"
                    placeholder="0.0"
                    className="Exchange-swap-input"
                    disabled={true}
                    defaultValue={toValue}
                  />
                </div>
                <div>
                  {swapOption === "Redeem" ? (
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

        {isInfo && (
          <React.Fragment>
            <div className="Exchange-swap-box-info px-1 mt-6">
              <ExchangeInfoRow
                labelClassName="opacity-100 text-white"
                label="Necc Price * Current Index = nNecc Price "
              >
                <div>{"ⓘ"}</div>
              </ExchangeInfoRow>

              <hr className="mt-2 mb-4" />

              <ExchangeInfoRow label="Necc Balance">
                <div>{formatAmount(NeccTokenBalance, 9, 4, true)}</div>
              </ExchangeInfoRow>
              <ExchangeInfoRow label="nNecc Balance">
                <div>{formatAmount(nNeccTokenBalance, 18, 2, true)}</div>
              </ExchangeInfoRow>
              <div className="Exchange-info-row">
                <div className="Exchange-info-label">nNecc Bond Price </div>
                <div className="align-right">
                  {nNeccBondPrice && formatAmount(nNeccBondPrice, 18, 2, true)}{" "}
                  USD
                </div>
              </div>

              <ExchangeInfoRow label="nNecc Market Price">
                {nNeccMarketPrice &&
                  formatAmount(nNeccMarketPrice, 18, 2, true)}{" "}
              </ExchangeInfoRow>

              <hr className="my-2" />

              <div className="Exchange-info-row">
                <div className="Exchange-info-label">APY</div>
                <div className="align-right">
                  {new Intl.NumberFormat("en-US").format(
                    Number(trim(Number(apy) * 100, 1))
                  )}{" "}
                  %
                </div>
              </div>
              <div className="Exchange-info-row">
                <div className="Exchange-info-label">5 Day Rate</div>
                <div className="align-right">
                  {trim(Number(fiveDayRate) * 100, 4)} %
                </div>
              </div>

              <div className="Exchange-info-row">
                <div className="Exchange-info-label">
                  Next Reward Percentage
                </div>
                <div className="align-right">
                  {stakingRebasePercentage}
                  {" %"}
                </div>
              </div>

              <hr className="my-2" />

              <div className="Exchange-info-row">
                <div className="Exchange-info-label">Circulating Supply</div>
                <div className="align-right">
                  {nNeccCirculatingSupply &&
                    formatAmount(nNeccCirculatingSupply, 18, 2, true)}{" "}
                  {"nNecc"}
                </div>
              </div>

              <div className="Exchange-info-row">
                <div className="Exchange-info-label">Total Staked</div>
                <div className="align-right">
                  {fromToken &&
                    formatAmount(stakingContractBalance, 9, 4, true)}{" "}
                  {"Necc"}
                </div>
              </div>

              <div className="Exchange-info-row">
                <div className="Exchange-info-label">Current Index</div>
                <div className="align-right">
                  {fromToken && formatAmount(stakingCurrentIndex, 9, 4, true)}
                </div>
              </div>

              <div className="Exchange-info-row">
                <div className="Exchange-info-label">Next Rebase</div>
                <div className="align-right">
                  {fromToken && formatDateTime(nextRebase || Date.now() / 1000)}
                </div>
              </div>
            </div>
          </React.Fragment>
        )}

        <div className="Exchange-swap-button-container">
          {!isInfo && (
            <button
              className="App-cta Exchange-swap-button"
              onClick={onClickPrimary}
              disabled={!isPrimaryEnabled()}
            >
              {getPrimaryText()}
            </button>
          )}

          {isBond && (
            <div className="mt-4">
              <div className="">
                <button className="App-cta  !bg-nord10 min-w-full">
                  <a
                    target="_blank"
                    href="https://www.trisolaris.io/#/add/0xC86Ca2BB9C9c9c9F140d832dE00BfA9e153FA1e3/0x449f661c53aE0611a24c2883a910A563A7e42489"
                  >
                    Add Liquidity for NDOL/nNECC LP tokens
                  </a>
                </button>
              </div>
            </div>
          )}

          {isInfo && (
            <button
              className="App-cta Exchange-swap-button"
              onClick={() => {
                if (nNeccTokenBalance?.gt(0)) {
                  setIsStake(false);
                  setIsUnstake(true);
                } else {
                  setIsUnstake(false);
                  setIsStake(true);
                }
                onClickPrimary();
              }}
              disabled={!isPrimaryEnabled()}
            >
              {getPrimaryText()}
            </button>
          )}

          {isInfo && warmupInfo?.deposit?.gt(0) && (
            <button
              className="App-cta Exchange-swap-button mt-4"
              onClick={() => {
                setIsClaim(true);
                onClickPrimary();
              }}
            >
              Claim sNecc
            </button>
          )}
        </div>
      </div>

      {isBond && (
        <div className="Exchange-swap-market-box border App-box">
          <div className="Exchange-swap-market-box-title">{swapOption}</div>

          <div className="Exchange-info-row">
            <div className="Exchange-info-label">nNecc Market Price </div>
            <div className="align-right">
              {nNeccMarketPrice && formatAmount(nNeccMarketPrice, 18, 2, true)}{" "}
              USD
            </div>
          </div>

          <div className="Exchange-info-row">
            <div className="Exchange-info-label">nNecc Bond Price </div>
            <div className="align-right">
              {nNeccBondPrice && formatAmount(nNeccBondPrice, 18, 2, true)} USD
            </div>
          </div>

          <div className="Exchange-info-row">
            <div className="Exchange-info-label">Bond Price</div>
            <div className="align-right">
              {bondPrice && formatAmount(bondPrice, 18, 2, true)} USD
            </div>
          </div>

          <div className="Exchange-info-row">
            <div className="Exchange-info-label">Discount</div>
            <div className="align-right">
              {/* TODO: Change second param (tokenDecimal) once LP is deployed with Necc market price derivable */}
              {bondDiscount && trim(Number(bondDiscount) * 100, 2)} %
            </div>
          </div>

          <div className="Exchange-info-row">
            <div className="Exchange-info-label">Available Bonds</div>
            <div className="align-right">
              {fromToken &&
                formatAmount(fromToken.maxPayout, toToken.decimals, 4, true)}
            </div>
          </div>

          <div className="Exchange-info-row">
            <div className="Exchange-info-label">Current Debt</div>
            <div className="align-right">
              {formatAmount(currentDebt, 9, 2, true)} %
            </div>
          </div>
        </div>
      )}

      {isConfirming && (
        <ConfirmationBox
          isRedeem={isRedeem}
          isBond={isBond}
          isInfo={isInfo}
          isRebase={isRebase}
          isClaim={isClaim}
          isStake={isStake}
          isUnstake={isUnstake}
          isRedeemSecondary={isRedeemSecondary}
          isMarketOrder={isMarketOrder}
          setIsRedeemSecondary={setIsRedeemSecondary}
          setIsRebase={setIsRebase}
          setIsClaim={setIsClaim}
          setIsStake={setIsStake}
          setIsUnstake={setIsUnstake}
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
          fromUsdMin={bondPayoutForUsd}
          toUsdMax={toUsdMax}
        />
      )}
    </div>
  );
};
