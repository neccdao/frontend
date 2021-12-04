import React, { useState, useEffect } from "react";

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
  formatDateTime,
  formatDate,
  trim,
} from "../../Helpers";
import { approvePlugin } from "../../Api";
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
import NNecc from "../../abis/sNeccFacet.json";
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
    maxUsdg,
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
  } = props;

  const accountUrl = getAccountUrl(chainId, account);

  const [fromValue, setFromValue] = useState("");
  const [toValue, setToValue] = useState("");
  const [anchorOnFromAmount, setAnchorOnFromAmount] = useState(true);
  const [isApproving, setIsApproving] = useState(false);
  const [isWaitingForApproval, setIsWaitingForApproval] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isClaim, setIsClaim] = useState(false);
  const isBond = swapOption === "Bond";
  const isRedeem = swapOption === "Redeem";
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
    stakingTokenAllowance && fromAmount && fromAmount.gt(stakingTokenAllowance);

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
  const bondDiscount =
    toToken.minPrice
      ?.mul(expandDecimals(10, 18))
      .sub(fromToken?.Price)
      .div(fromToken?.Price)
      .mul(100) || bigNumberify(0);

  const debtRatio = standardizedDebtRatio || bigNumberify(0);

  const ndolBondAddress = getContract(CHAIN_ID, "NDOLBond");

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

  const { data: ndolBondPayoutFor, mutate: updateNDOLBondPayoutFor } = useSWR(
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
        updateStakingTokenAllowance(undefined, true);
        updatenNeccTokenBalance(undefined, true);
        updatePrincipleValuation(undefined, true);
        updateNDOLBondPayoutFor(undefined, true);
      });
      return () => {
        library.removeListener("block");
      };
    }
  }, [
    active,
    library,
    updateTokenAllowance,
    updateStakingTokenAllowance,
    updatenNeccTokenBalance,
    updatePrincipleValuation,
    updateNDOLBondPayoutFor,
  ]);

  useEffect(() => {
    const updateSwapAmounts = () => {
      if (anchorOnFromAmount) {
        if (!fromAmount) {
          setToValue("");
          return;
        }
        if (isStake) {
          setToValue(fromValue);
          return;
        }
        if (toToken) {
          const nextToValue = formatAmountFree(ndolBondPayoutFor, 9, 8);
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
    isRedeem,
    isBond,
    fromUsdMin,
    toUsdMax,
    isMarketOrder,
    triggerPriceUsd,
    triggerRatio,
  ]);

  const [isPluginApproving, setIsPluginApproving] = useState(false);

  const getSwapError = (isSecondary) => {
    if (isBond) {
      if (fromTokenAddress === toTokenAddress) {
        return "Select different tokens";
      }
    }
    if (isRedeem && fromToken?.pendingPayoutFor?.eq(0)) {
      return "Nothing to claim";
    }
    if (isStake) {
      if (isSecondary) {
        return false;
      }
      if (isStake && (!NeccTokenBalance || NeccTokenBalance?.eq(0))) {
        return "Nothing to stake";
      }
      if (!fromAmount || fromAmount.eq(0)) {
        return "Enter amount";
      }
      if (!toAmount || toAmount.eq(0)) {
        return "Enter amount";
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
    if (isStake) {
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
    if (isStake) {
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
      return `Approving ${fromToken.symbol}...`;
    }
    if (isStake) {
      if (needStakingApproval) {
        return `Approve ${toToken.symbol}`;
      }
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
      if (isRedeemSecondary) {
        return "Redeem and Staking ...";
      }
      if (isRedeem) {
        return "Redeem...";
      }
      if (isBond) {
        return "Bond...";
      }
    }

    if (!isMarketOrder) return `Create ${orderType.toLowerCase()} order`;

    if (isRedeem) {
      return "Redeem";
    }

    if (isBond) {
      if (isToAmountGreaterThanAvailableBonds) {
        return "Insufficient Bonds";
      }
      return "Bond";
    }
    if (isStake) {
      return "Stake";
    }
  };

  const getSecondaryText = () => {
    const error = getError(true);
    if (error) {
      return error;
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
    setIsRedeemSecondary(false);
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
            Bond submitted!{" "}
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
          message: `Bonded ${formatAmount(
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
            Bond submitted!{" "}
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
          message: `Bonded ${formatAmount(
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
        toast.error("Bond failed.");
      })
      .finally(() => {
        setIsSubmitting(false);
      });
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
      setIsPendingConfirmation(false);
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
      setIsPendingConfirmation(false);
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
    params = [fromAmount, account];

    contract = new ethers.Contract(
      NeccStaking,
      Staking.abi,
      library.getSigner()
    );

    if (shouldRaiseGasError(toTokens[0], fromAmount)) {
      setIsSubmitting(false);
      toast.error(
        `Leave at least ${formatAmount(DUST_BNB, 18, 3)} ETH for gas`
      );
      return;
    }

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
      setIsPendingConfirmation(false);
    }
  };

  const redeem = async (stakeAfterClaim = false) => {
    setIsSubmitting(true);

    let method;
    let contract;
    let value;
    let params;

    method = "redeem";
    value = bigNumberify(0);
    params = [account, fromTokenAddress, stakeAfterClaim];

    contract = new ethers.Contract(
      NDOLBond,
      BondDepositoryFacet.abi,
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

    try {
      const gasLimit = await getGasLimit(contract, method, params, value);
      const res = await contract[method](...params, { value, gasLimit });
      const txUrl = getExplorerUrl(CHAIN_ID) + "tx/" + res.hash;
      const toastSuccessMessage = (
        <div>
          {stakeAfterClaim ? "Redeem and Stake" : "Redeem"} submitted!{" "}
          <a href={txUrl} target="_blank" rel="noopener noreferrer">
            View status.
          </a>
          <br />
        </div>
      );

      const marketOrderRedeemMessage = `Redeemed ${toToken.symbol}`;
      const marketOrderRedeemAndStakeMessage = `Redeem and Staked ${toToken.symbol}`;
      const txMessage = stakeAfterClaim
        ? marketOrderRedeemAndStakeMessage
        : marketOrderRedeemMessage;

      handleFulfilled(res, toastSuccessMessage, txMessage);
    } catch (err) {
      console.error(err);
      if (stakeAfterClaim) {
        toast.error("Redeem and Stake failed.");
      } else {
        toast.error("Redeem failed.");
      }
    } finally {
      setIsSubmitting(false);
      setIsPendingConfirmation(false);
    }
  };

  const bond = async () => {
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
    } else if (opt === "Stake") {
      const updatedTokenSelection = JSON.parse(JSON.stringify(tokenSelection));

      updatedTokenSelection["Stake"] = {
        from: neccTokenSelection,
        to: neccTokenSelection,
      };
      setTokenSelection(updatedTokenSelection);
      setFromTokenAddress(neccTokenSelection);
      setToTokenAddress(neccTokenSelection);
      setSwapOption("Stake");
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
    if (isStake) {
      stake();
      return;
    }
    if (isRedeemSecondary) {
      redeem(true);
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
    if (isStake && needStakingApproval) {
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
    }
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

    if (isStake) {
      if (needStakingApproval) {
        approveFromToken();
        return;
      }
    }

    if (isRedeem || isBond) {
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
      <div className="Exchange-swap-wallet-box border">
        {active && (
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
            options={["Bond", "Redeem", "Stake"]}
            option={swapOption}
            onChange={onSwapOptionChange}
          />
        </div>

        {isRedeem && (
          <React.Fragment>
            <div className="Exchange-swap-section">
              <div className="Exchange-swap-section-top">
                <div className="muted">{!fromUsdMin && "Redeemable"}</div>
                {fromBalance && (
                  <div className="muted align-right clickable">
                    Balance: {formatAmount(NeccTokenBalance, 9, 6, true)}
                  </div>
                )}
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
                  {ndolBondPayoutFor && (
                    // TODO for swap limits price can be different at moment of execution
                    <div className="Exchange-swap-usd">
                      Bond:{" "}
                      {formatAmount(
                        ndolBondPayoutFor
                          ?.mul(expandDecimals(1, 3))
                          ?.mul(fromToken.price),
                        USD_DECIMALS,
                        2,
                        true
                      )}{" "}
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
                      mintingCap={maxUsdg}
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

        {isStake && (
          <React.Fragment>
            <div className="Exchange-swap-section">
              <div className="Exchange-swap-section-top">
                <div className="muted">{"Stake"}</div>
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
                    Balance: {formatAmount(NeccTokenBalance, 9, 6, true)}
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
                  {NeccTokenBalance?.gt(0) && (
                    <div
                      className="Exchange-swap-max"
                      onClick={() => {
                        setFromValue(
                          formatAmountFree(
                            NeccTokenBalance,
                            toToken.decimals,
                            toToken.decimals
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
                  <div className="TokenSelector-box">{toToken.symbol}</div>
                </div>
              </div>
            </div>

            <div className="Exchange-swap-box-info">
              <ExchangeInfoRow label="nNecc Balance">
                <div>{formatAmount(nNeccTokenBalance, 18, 4, true)}</div>
              </ExchangeInfoRow>
            </div>
          </React.Fragment>
        )}

        <div className="Exchange-swap-button-container">
          <button
            className="App-cta Exchange-swap-button"
            onClick={onClickPrimary}
            disabled={!isPrimaryEnabled()}
          >
            {getPrimaryText()}
          </button>
          {active && isRedeem && isPrimaryEnabled() && (
            <button
              className="App-cta Exchange-swap-button mt-4"
              onClick={() => {
                setIsRedeemSecondary(true);
                onClickPrimary();
              }}
              disabled={!isPrimaryEnabled()}
            >
              {getSecondaryText()}
            </button>
          )}

          {isStake && (
            <button
              className="App-cta Exchange-swap-button mt-4"
              onClick={() => {
                setIsRebase(true);
                onClickPrimary();
              }}
            >
              Rebase
            </button>
          )}

          {isStake && warmupInfo?.deposit?.gt(0) && (
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
            <div className="Exchange-info-label">{toToken.symbol} Price</div>
            <div className="align-right">
              {toTokenInfo &&
                formatAmount(toTokenInfo.minPrice, USD_DECIMALS, 2, true)}{" "}
              USD
            </div>
          </div>

          <div className="Exchange-info-row">
            <div className="Exchange-info-label">Bond Price</div>
            <div className="align-right">
              {fromToken && formatAmount(bondPrice, 18, 2, true)} USD
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
            <div className="Exchange-info-label">Discount</div>
            <div className="align-right">
              {/* TODO: Change second param (tokenDecimal) once LP is deployed with Necc market price derivable */}
              {formatAmount(bondDiscount, 2, 2, true)} %
            </div>
          </div>

          <div className="Exchange-info-row">
            <div className="Exchange-info-label">Current Debt</div>
            <div className="align-right">
              {formatAmount(currentDebt, 9, 2, true)} %
            </div>
          </div>

          <div className="Exchange-info-row">
            <div className="Exchange-info-label">Debt Ratio</div>
            <div className="align-right">
              {formatAmount(debtRatio, 9, 2, true)} %
            </div>
          </div>
        </div>
      )}

      {isStake && (
        <div className="Exchange-swap-market-box border App-box">
          <div className="Exchange-swap-market-box-title">{swapOption}</div>

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
            <div className="Exchange-info-label">Next Reward Percentage</div>
            <div className="align-right">
              {stakingRebasePercentage}
              {" %"}
            </div>
          </div>

          <div className="Exchange-info-row">
            <div className="Exchange-info-label">Total Staked</div>
            <div className="align-right">
              {fromToken && formatAmount(stakingContractBalance, 9, 8, true)}{" "}
              {"Necc"}
            </div>
          </div>

          <div className="Exchange-info-row">
            <div className="Exchange-info-label">Current Index</div>
            <div className="align-right">
              {fromToken && formatAmount(stakingCurrentIndex, 9, 8, true)}
            </div>
          </div>

          <div className="Exchange-info-row">
            <div className="Exchange-info-label">Next Rebase</div>
            <div className="align-right">
              {fromToken && formatDateTime(nextRebase || Date.now() / 1000)}
            </div>
          </div>
        </div>
      )}

      {isConfirming && (
        <ConfirmationBox
          isRedeem={isRedeem}
          isBond={isBond}
          isStake={isStake}
          isRebase={isRebase}
          isClaim={isClaim}
          isRedeemSecondary={isRedeemSecondary}
          isMarketOrder={isMarketOrder}
          setIsRedeemSecondary={setIsRedeemSecondary}
          setIsRebase={setIsRebase}
          setIsClaim={setIsClaim}
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
