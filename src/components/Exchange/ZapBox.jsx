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
import ZapSP from "../../abis/ZapSP.json";
import OrderBook from "../../abis/OrderBook.json";
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
      .mul(toToken?.decimals)
      .div(fromToken?.decimals);

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
      .div(expandDecimals(1, toToken?.decimals));
    if (redemptionValue.gt(THRESHOLD_REDEMPTION_VALUE)) {
      const feeBasisPoints = getSwapFeeBasisPoints(toToken.isStable);

      const fromAmount =
        ratio && !ratio.isZero()
          ? fromAmountBasedOnRatio
          : toAmount
              .mul(expandDecimals(1, toToken?.decimals))
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

const ZapBox = (props) => {
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
  } = props;

  const accountUrl = getAccountUrl(chainId, account);

  const [fromValue, setFromValue] = useState("");
  const [toValue, setToValue] = useState("");
  const [anchorOnFromAmount, setAnchorOnFromAmount] = useState(true);
  const [isApproving, setIsApproving] = useState(false);
  const [isWaitingForApproval, setIsWaitingForApproval] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isDeposit = swapOption === "Deposit";
  const isWithdraw = swapOption === "Withdraw";
  const isHarvest = swapOption === "Harvest";

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

    const basisPoints = String((slippage * BASIS_POINTS_DIVISOR) / 100);
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
    swapOption === "Deposit"
      ? tokens.filter((token) => token.isStable === true)
      : tokens;
  const toTokens =
    swapOption === "Withdraw"
      ? tokens.filter((token) => token.symbol === "NDOL")
      : tokens;

  const zapSPAddress = getContract(CHAIN_ID, "ZapSP");
  const { data: tokenAllowance, mutate: updateTokenAllowance } = useSWR(
    [active, fromTokenAddress, "allowance", account, zapSPAddress],
    {
      fetcher: fetcher(library, Token),
    }
  );

  const fromToken = fromTokenAddress
    ? getToken(CHAIN_ID, fromTokenAddress)
    : null;
  const toToken = toTokenAddress ? getToken(CHAIN_ID, toTokenAddress) : null;

  const fromTokenInfo = getTokenInfo(infoTokens, fromTokenAddress);
  const toTokenInfo = getTokenInfo(infoTokens, toTokenAddress);

  const fromBalance = fromTokenInfo ? fromTokenInfo.balance : bigNumberify(0);
  const toBalance = toTokenInfo ? toTokenInfo.balance : bigNumberify(0);

  const fromAmount = parseValue(fromValue, fromToken?.decimals);
  const toAmount = parseValue(toValue, toToken?.decimals);

  const needApproval =
    tokenAllowance && fromAmount && fromAmount.gt(tokenAllowance);
  const prevFromTokenAddress = usePrevious(fromTokenAddress);
  const prevNeedApproval = usePrevious(needApproval);

  const fromUsdMin = getUsd(fromAmount, fromTokenAddress, false, infoTokens);
  const toUsdMax = getUsd(toAmount, toTokenAddress, true, infoTokens);

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
    fromToken?.symbol,
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
    const updateSwapAmounts = () => {
      if (anchorOnFromAmount) {
        if (!fromAmount) {
          setToValue("");
          return;
        }
        if (toToken) {
          // TODO: Calculate USDC -> Whitelisted collaterals -> NDOL fees
          // TODO: Separate out to amount from received amount in usd
          const { amount: nextToAmount } = getNextToAmount(
            fromAmount,
            fromTokenAddress,
            toTokenAddress,
            infoTokens,
            undefined,
            !isMarketOrder && null
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
          !isMarketOrder && null
        );
        const nextFromValue = formatAmountFree(
          nextFromAmount,
          fromToken.decimals,
          8
        );
        setFromValue(nextFromValue);
      }
    };

    if (isWithdraw) {
      updateSwapAmounts();
    }
    if (isDeposit) {
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
    isWithdraw,
    isDeposit,
    fromUsdMin,
    toUsdMax,
    isMarketOrder,
  ]);

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
    if (isWithdraw) {
      return "Receive";
    }
    if (isDeposit) {
      return "Receive";
    }
  };

  const getError = () => {
    if (isWithdraw) {
      return getSwapError();
    }
    if (isDeposit) {
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

    if (isSubmitting) {
      if (!isMarketOrder) {
        return "Creating order...";
      }
      if (isWithdraw) {
        return "Withdrawing...";
      }
      if (isDeposit) {
        return "Depositing...";
      }
    }

    if (isWithdraw) {
      if (toUsdMax.lt(fromUsdMin.mul(95).div(100))) {
        return "High Slippage, Swap Anyway";
      }
      return "Withdraw";
    }

    if (isDeposit) {
      if (toUsdMax.lt(fromUsdMin.mul(95).div(100))) {
        return "High Slippage, Mint Anyway";
      }
      return "Deposit";
    }

    if (isHarvest) {
      return "Harvest";
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

  const swap = async () => {
    setIsSubmitting(true);

    let method;
    let contract;
    let value;
    let params;

    if (isMarketOrder) {
      method = "deposit";
      value = bigNumberify(0);

      params = [fromTokenAddress, fromAmount];
      if (fromTokenAddress === getTokenBySymbol(CHAIN_ID, "nNDOL")?.address) {
        method = "withdraw";
        params = [account, fromAmount];
      }
      contract = new ethers.Contract(
        zapSPAddress,
        ZapSP.abi,
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

    const gasLimit = await getGasLimit(contract, method, params, value);
    contract[method](...params, { value, gasLimit })
      .then(async (res) => {
        const txUrl = getExplorerUrl(CHAIN_ID) + "tx/" + res.hash;
        const toastSuccessMessage = (
          <div>
            Zap {!isMarketOrder ? " order " : ""} submitted!{" "}
            <a href={txUrl} target="_blank" rel="noopener noreferrer">
              View status.
            </a>
            <br />
          </div>
        );
        const txMessage = isMarketOrder
          ? `Zapped ${formatAmount(fromAmount, fromToken.decimals, 4, true)} ${
              fromToken.symbol
            } for ${formatAmount(toAmount, toToken.decimals, 4, true)} ${
              toToken.symbol
            }`
          : `Zap order submitted`;
        handleFulfilled(res, toastSuccessMessage, txMessage);
      })
      .catch((e) => {
        console.error(e);
        toast.error("Zap failed.");
      })
      .finally(() => {
        setIsSubmitting(false);
        setIsPendingConfirmation(false);
      });
  };

  const harvest = async () => {
    setIsSubmitting(true);

    let method;
    let contract;
    let value;
    let params;

    if (isMarketOrder) {
      method = "harvest";
      params = [];

      contract = new ethers.Contract(
        zapSPAddress,
        ZapSP.abi,
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

    const gasLimit = await getGasLimit(contract, method, params, value);
    contract[method](...params, { value, gasLimit })
      .then(async (res) => {
        const txUrl = getExplorerUrl(CHAIN_ID) + "tx/" + res.hash;
        const toastSuccessMessage = (
          <div>
            Harvest submitted!{" "}
            <a href={txUrl} target="_blank" rel="noopener noreferrer">
              View status.
            </a>
            <br />
          </div>
        );
        const txMessage = isMarketOrder
          ? `Harvested`
          : `Harvest order submitted`;
        handleFulfilled(res, toastSuccessMessage, txMessage);
      })
      .catch((e) => {
        console.error(e);
        toast.error("Harvest failed.");
      })
      .finally(() => {
        setIsSubmitting(false);
        setIsPendingConfirmation(false);
      });
  };

  const onSwapOptionChange = (opt) => {
    const nNDOLTokenSelection = getTokenBySymbol(CHAIN_ID, "nNDOL").address;

    if (opt === "Deposit") {
      const updatedTokenSelection = JSON.parse(JSON.stringify(tokenSelection));

      updatedTokenSelection["Deposit"] = {
        from: tokenSelection["Deposit"].from,
        to: nNDOLTokenSelection,
      };
      setTokenSelection(updatedTokenSelection);
      setFromTokenAddress(tokenSelection["Deposit"].from);
      setToTokenAddress(nNDOLTokenSelection);
      setSwapOption("Deposit");
      setAnchorOnFromAmount(true);
      setFromValue("");
      setToValue("");
    }
    // Burn
    else if (opt === "Withdraw") {
      const updatedTokenSelection = JSON.parse(JSON.stringify(tokenSelection));
      updatedTokenSelection["Withdraw"] = {
        from: nNDOLTokenSelection,
        to: tokenSelection["Withdraw"].to,
      };
      setTokenSelection(updatedTokenSelection);
      setFromTokenAddress(nNDOLTokenSelection);
      setToTokenAddress(tokenSelection["Withdraw"].to);
      setSwapOption("Withdraw");
      setAnchorOnFromAmount(false);
      setFromValue("");
      setToValue("");
    }
    // Harvest
    else if (opt === "Harvest") {
      const updatedTokenSelection = JSON.parse(JSON.stringify(tokenSelection));
      setTokenSelection(updatedTokenSelection);
      setFromTokenAddress(null);
      setToTokenAddress(null);
      setSwapOption("Harvest");
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

    // TODO: harvest button
    if (swapOption === "Harvest") {
      harvest();
      return;
    }

    if (isWithdraw) {
      swap();
      return;
    }
    if (isDeposit) {
      swap();
      return;
    }
  };

  function approveFromToken() {
    approveTokens({
      setIsApproving,
      library,
      tokenAddress: fromToken.address,
      spender: zapSPAddress,
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

    setIsConfirming(true);
  };

  const showFromAndToSection = orderType !== STOP;
  const showSizeSection = orderType === STOP;

  let fees;
  let feesUsd;
  if (isWithdraw || isDeposit) {
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
            options={["Deposit", "Withdraw", "Harvest"]}
            option={swapOption}
            onChange={onSwapOptionChange}
          />
        </div>
        {showFromAndToSection && swapOption !== "Harvest" && (
          <React.Fragment>
            <div className="Exchange-swap-section">
              <div className="Exchange-swap-section-top">
                <div className="muted">
                  {fromUsdMin && (
                    // TODO for swap limits price can be different at moment of execution
                    <div className="Exchange-swap-usd">
                      Pay: {formatAmount(fromUsdMin, USD_DECIMALS, 2, true)} USD
                    </div>
                  )}
                  {!fromUsdMin && swapOption}
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
                    {formatAmount(fromBalance, fromToken?.decimals, 4, true)}
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
                      fromToken?.decimals,
                      fromToken?.decimals
                    ) && (
                    <div
                      className="Exchange-swap-max"
                      onClick={() => {
                        setFromValue(
                          formatAmountFree(
                            fromBalance,
                            fromToken?.decimals,
                            fromToken?.decimals
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
                  {swapOption === "Deposit" ? (
                    <TokenSelector
                      label="From"
                      chainId={CHAIN_ID}
                      tokenAddress={fromTokenAddress}
                      onSelectToken={onSelectFromToken}
                      tokens={fromTokens}
                      infoTokens={infoTokens}
                      mintingCap={maxUsdg}
                      showMintingCap={isWithdraw || isDeposit}
                    />
                  ) : (
                    <div className="TokenSelector-box">{fromToken?.symbol}</div>
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
                {toBalance && (isWithdraw || isDeposit) && (
                  <div className="muted align-right">
                    Balance:{" "}
                    {formatAmount(toBalance, toToken?.decimals, 4, true)}
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
                    onChange={onToValueChange}
                  />
                </div>
                <div>
                  <div className="TokenSelector-box disabled">
                    {toTokenInfo?.symbol}
                  </div>
                </div>
              </div>
            </div>
          </React.Fragment>
        )}
        {showSizeSection && (
          <div className="Exchange-swap-section">
            <div className="Exchange-swap-section-top">
              <div className="muted">Sell, USD</div>
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
        {(isWithdraw || isDeposit) && (
          <div className="Exchange-swap-box-info">
            <ExchangeInfoRow label="Fees">
              <div>
                {!fees && "-"}
                {fees && (
                  <div>
                    {formatAmount(fees, fromToken?.decimals, 4, true)}{" "}
                    {fromToken.symbol}
                    &nbsp; (${formatAmount(feesUsd, USD_DECIMALS, 2, true)})
                  </div>
                )}
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
      {(isWithdraw || isDeposit) && (
        <div className="Exchange-swap-market-box border App-box">
          <div className="Exchange-swap-market-box-title">{swapOption}</div>
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
        </div>
      )}

      {isConfirming && (
        <ConfirmationBox
          // isSwap={isWithdraw}
          isHarvest={isHarvest}
          isWithdraw={isWithdraw}
          isDeposit={isDeposit}
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

export { ZapBox };
