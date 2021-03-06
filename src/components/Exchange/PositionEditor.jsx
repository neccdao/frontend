import React, { useEffect, useState } from "react";
import useSWR from "swr";
import { ethers } from "ethers";
import { toast } from "react-toastify";
import { BsArrowRight } from "react-icons/bs";

import {
  USD_DECIMALS,
  CHAIN_ID,
  BASIS_POINTS_DIVISOR,
  formatAmount,
  bigNumberify,
  getExplorerUrl,
  usePrevious,
  formatAmountFree,
  fetcher,
  parseValue,
  expandDecimals,
  shouldRaiseGasError,
  getTokenInfo,
  approveTokens,
  getGasLimit,
} from "../../Helpers";
import { getContract } from "../../Addresses";
import Tab from "../Tab/Tab";
import Modal from "../Modal/Modal";

import Router from "../../abis/Router.json";
import Token from "../../abis/Token.json";

const NATIVE_TOKEN_ADDRESS = getContract(CHAIN_ID, "NATIVE_TOKEN");
const DEPOSIT = "Deposit";
const WITHDRAW = "Withdraw";
const EDIT_OPTIONS = [DEPOSIT, WITHDRAW];
const { AddressZero } = ethers.constants;

export default function PositionEditor(props) {
  const {
    positionsMap,
    positionKey,
    isVisible,
    setIsVisible,
    infoTokens,
    active,
    account,
    library,
    collateralTokenAddress,
    pendingTxns,
    setPendingTxns,
    getLiquidationPrice,
    getUsd,
    getLeverage,
  } = props;
  const position =
    positionsMap && positionKey ? positionsMap[positionKey] : undefined;
  const [option, setOption] = useState(DEPOSIT);
  const [fromValue, setFromValue] = useState("");
  const [isApproving, setIsApproving] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  const prevIsVisible = usePrevious(isVisible);

  const routerAddress = getContract(CHAIN_ID, "Router");

  const { data: tokenAllowance, mutate: updateTokenAllowance } = useSWR(
    [active, collateralTokenAddress, "allowance", account, routerAddress],
    {
      fetcher: fetcher(library, Token),
    }
  );

  const isDeposit = option === DEPOSIT;
  const isWithdrawal = option === WITHDRAW;

  let collateralToken;
  let maxAmount;
  let maxAmountFormatted;
  let maxAmountFormattedFree;
  let fromAmount;
  let needApproval;

  let convertedAmount;
  let convertedAmountFormatted;

  let nextLeverage;
  let liquidationPrice;
  let nextLiquidationPrice;

  let title;
  if (position) {
    title = `Edit ${position.isLong ? "Long" : "Short"} ${
      position.indexToken.symbol
    }`;
    collateralToken = position.collateralToken;
    liquidationPrice = getLiquidationPrice(position);

    if (isDeposit) {
      fromAmount = parseValue(fromValue, collateralToken.decimals);
      maxAmount = collateralToken ? collateralToken.balance : bigNumberify(0);
      maxAmountFormatted = formatAmount(
        maxAmount,
        collateralToken.decimals,
        4,
        true
      );
      maxAmountFormattedFree = formatAmountFree(
        maxAmount,
        collateralToken.decimals,
        8
      );
      if (fromAmount) {
        convertedAmount = getUsd(
          fromAmount,
          position.collateralToken.address,
          false,
          infoTokens
        );
        convertedAmountFormatted = formatAmount(
          convertedAmount,
          USD_DECIMALS,
          2
        );
      }
    } else {
      fromAmount = parseValue(fromValue, USD_DECIMALS);
      maxAmount = position.collateral;
      maxAmountFormatted = formatAmount(maxAmount, USD_DECIMALS, 2, true);
      maxAmountFormattedFree = formatAmountFree(maxAmount, USD_DECIMALS, 2);
      if (fromAmount) {
        convertedAmount = fromAmount
          .mul(expandDecimals(1, collateralToken.decimals))
          .div(collateralToken.maxPrice);
        convertedAmountFormatted = formatAmount(
          convertedAmount,
          collateralToken.decimals,
          4,
          true
        );
      }
    }
    needApproval =
      isDeposit &&
      tokenAllowance &&
      fromAmount &&
      fromAmount.gt(tokenAllowance);

    if (fromAmount) {
      nextLeverage = getLeverage({
        size: position.size,
        collateral: position.collateral,
        collateralDelta: isDeposit ? convertedAmount : fromAmount,
        increaseCollateral: isDeposit,
        entryFundingRate: position.entryFundingRate,
        cumulativeFundingRate: position.cumulativeFundingRate,
        hasProfit: position.hasProfit,
        delta: position.delta,
      });

      nextLiquidationPrice = getLiquidationPrice({
        isLong: position.isLong,
        size: position.size,
        collateral: position.collateral,
        averagePrice: position.averagePrice,
        entryFundingRate: position.entryFundingRate,
        cumulativeFundingRate: position.cumulativeFundingRate,
        collateralDelta: isDeposit ? convertedAmount : fromAmount,
        increaseCollateral: isDeposit,
      });
    }
  }

  const getError = () => {
    if (!fromAmount) {
      return "Enter amount";
    }
    if (nextLeverage && nextLeverage.eq(0)) {
      return "Enter amount";
    }

    if (!isDeposit && fromAmount) {
      if (fromAmount.gte(position.collateral)) {
        return "Min order: 10 USD";
      }
      if (
        position.collateral.sub(fromAmount).lt(expandDecimals(10, USD_DECIMALS))
      ) {
        return "Min order: 10 USD";
      }
    }

    if (nextLeverage && nextLeverage.lt(1.1 * BASIS_POINTS_DIVISOR)) {
      return "Min leverage: 1.1x";
    }

    if (nextLeverage && nextLeverage.gt(30.5 * BASIS_POINTS_DIVISOR)) {
      return "Max leverage: 30x";
    }
  };

  const isPrimaryEnabled = () => {
    const error = getError();
    if (error) {
      return false;
    }
    if (isSwapping) {
      return false;
    }

    return true;
  };

  const getPrimaryText = () => {
    const error = getError();
    if (error) {
      return error;
    }
    if (isApproving) {
      return `Approving ${position.collateralToken.symbol}...`;
    }
    if (needApproval) {
      return `Approve ${position.collateralToken.symbol}`;
    }
    if (isSwapping) {
      if (isDeposit) {
        return "Depositing...";
      }
      return "Withdrawing...";
    }

    if (isDeposit) {
      return "Deposit";
    }

    return "Withdraw";
  };

  const resetForm = () => {
    setFromValue("");
  };

  useEffect(() => {
    if (prevIsVisible !== isVisible) {
      resetForm();
    }
  }, [prevIsVisible, isVisible]);

  useEffect(() => {
    if (active) {
      library.on("block", () => {
        updateTokenAllowance(undefined, true);
      });
      return () => {
        library.removeAllListeners("block");
      };
    }
  }, [active, library, updateTokenAllowance]);

  const depositCollateral = async () => {
    setIsSwapping(true);
    const tokenAddress0 =
      collateralTokenAddress === AddressZero
        ? NATIVE_TOKEN_ADDRESS
        : collateralTokenAddress;
    const path = [tokenAddress0];
    const indexTokenAddress =
      position.indexToken.address === AddressZero
        ? NATIVE_TOKEN_ADDRESS
        : position.indexToken.address;

    const priceBasisPoints = position.isLong ? 11000 : 9000;
    const priceLimit = position.indexToken.maxPrice
      .mul(priceBasisPoints)
      .div(10000);

    let params = [
      path,
      indexTokenAddress,
      fromAmount,
      0,
      0,
      position.isLong,
      priceLimit,
    ];

    let method = "increasePosition";
    let value = bigNumberify(0);
    if (collateralTokenAddress === AddressZero) {
      method = "increasePositionETH";
      value = fromAmount;
      params = [path, indexTokenAddress, 0, 0, position.isLong, priceLimit];
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
        toast.success(
          <div>
            Deposit submitted!{" "}
            <a href={txUrl} target="_blank" rel="noopener noreferrer">
              View status.
            </a>
            <br />
          </div>
        );
        setFromValue("");
        setIsVisible(false);
        const pendingTxn = {
          hash: res.hash,
          message: `Deposited ${formatAmount(
            fromAmount,
            position.collateralToken.decimals,
            4
          )} ${position.collateralToken.symbol} into ${
            position.indexToken.symbol
          } ${position.isLong ? "Long" : "Short"}`,
        };
        setPendingTxns([...pendingTxns, pendingTxn]);
      })
      .catch((e) => {
        console.error(e);
        toast.error(`Deposit failed.`);
      })
      .finally(() => {
        setIsSwapping(false);
      });
  };

  const withdrawCollateral = async () => {
    setIsSwapping(true);
    const tokenAddress0 =
      collateralTokenAddress === AddressZero
        ? NATIVE_TOKEN_ADDRESS
        : collateralTokenAddress;
    const indexTokenAddress =
      position.indexToken.address === AddressZero
        ? NATIVE_TOKEN_ADDRESS
        : position.indexToken.address;
    const priceBasisPoints = position.isLong ? 9000 : 11000;
    const priceLimit = position.indexToken.maxPrice
      .mul(priceBasisPoints)
      .div(10000);

    let params = [
      tokenAddress0,
      indexTokenAddress,
      fromAmount,
      0,
      position.isLong,
      account,
      priceLimit,
    ];
    let method =
      collateralTokenAddress === AddressZero
        ? "decreasePositionETH"
        : "decreasePosition";

    const contract = new ethers.Contract(
      routerAddress,
      Router.abi,
      library.getSigner()
    );
    const gasLimit = await getGasLimit(contract, method, params);
    contract[method](...params, { gasLimit })
      .then(async (res) => {
        const txUrl = getExplorerUrl(CHAIN_ID) + "tx/" + res.hash;
        toast.success(
          <div>
            Withdrawal submitted!{" "}
            <a href={txUrl} target="_blank" rel="noopener noreferrer">
              View status.
            </a>
            <br />
          </div>
        );
        setFromValue("");
        setIsVisible(false);
        const pendingTxn = {
          hash: res.hash,
          message: `Withdrew ${formatAmount(
            fromAmount,
            USD_DECIMALS,
            2
          )} USD from ${position.indexToken.symbol} ${
            position.isLong ? "Long" : "Short"
          }`,
        };
        setPendingTxns([...pendingTxns, pendingTxn]);
      })
      .catch((e) => {
        console.error(e);
        toast.error(`Withdraw failed.`);
      })
      .finally(() => {
        setIsSwapping(false);
      });
  };

  const onClickPrimary = () => {
    if (needApproval) {
      approveTokens({
        setIsApproving,
        library,
        tokenAddress: collateralTokenAddress,
        spender: routerAddress,
        chainId: CHAIN_ID,
        infoTokens,
        getTokenInfo,
        pendingTxns,
        setPendingTxns,
      });
      return;
    }

    if (isDeposit) {
      depositCollateral();
      return;
    }

    withdrawCollateral();
  };

  return (
    <div className="PositionEditor">
      {position && (
        <Modal isVisible={isVisible} setIsVisible={setIsVisible} label={title}>
          <div>
            <Tab
              options={EDIT_OPTIONS}
              option={option}
              setOption={setOption}
              onChange={resetForm}
            />
            {(isDeposit || isWithdrawal) && (
              <div className="mt-4">
                <div className="Exchange-swap-section">
                  <div className="Exchange-swap-section-top">
                    <div className="muted">
                      {convertedAmountFormatted && (
                        <div className="Exchange-swap-usd">
                          {isDeposit ? "Deposit" : "Withdraw"}:{" "}
                          {convertedAmountFormatted}{" "}
                          {isDeposit ? "USD" : position.collateralToken.symbol}
                        </div>
                      )}
                      {!convertedAmountFormatted &&
                        `${isDeposit ? "Deposit" : "Withdraw"}`}
                    </div>
                    {maxAmount && (
                      <div
                        className="muted align-right clickable"
                        onClick={() => setFromValue(maxAmountFormattedFree)}
                      >
                        Max: {maxAmountFormatted}
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
                        onChange={(e) => setFromValue(e.target.value)}
                      />
                      {fromValue !== maxAmountFormattedFree && (
                        <div
                          className="Exchange-swap-max"
                          onClick={() => {
                            setFromValue(maxAmountFormattedFree);
                          }}
                        >
                          MAX
                        </div>
                      )}
                    </div>
                    <div className="PositionEditor-token-symbol">
                      {isDeposit ? position.collateralToken.symbol : "USD"}
                    </div>
                  </div>
                </div>
                <div className="PositionEditor-info-box mt-4">
                  <div className="Exchange-info-row">
                    <div className="Exchange-info-label">Size</div>
                    <div className="align-right">
                      {formatAmount(position.size, USD_DECIMALS, 2, true)} USD
                    </div>
                  </div>
                  <div className="Exchange-info-row">
                    <div className="Exchange-info-label">Collateral</div>
                    <div className="align-right">
                      {formatAmount(position.collateral, USD_DECIMALS, 2, true)}{" "}
                      USD
                    </div>
                  </div>
                  <div className="Exchange-info-row">
                    <div className="Exchange-info-label">Leverage</div>
                    <div className="align-right">
                      {!nextLeverage && (
                        <div>
                          {formatAmount(position.leverage, 4, 2, true)}x
                        </div>
                      )}
                      {nextLeverage && (
                        <div className="flex items-center">
                          <div className="ml-auto flex items-center">
                            <span className="muted">
                              {formatAmount(position.leverage, 4, 2, true)}x
                            </span>
                            <BsArrowRight className="transition-arrow" />
                            <span>
                              {formatAmount(nextLeverage, 4, 2, true)}x
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="Exchange-info-row">
                    <div className="Exchange-info-label">Liq. Price</div>
                    <div className="align-right">
                      {!nextLiquidationPrice && (
                        <div>
                          {!fromAmount &&
                            `$${formatAmount(
                              liquidationPrice,
                              USD_DECIMALS,
                              2,
                              true
                            )}`}
                          {fromAmount && "-"}
                        </div>
                      )}
                      {nextLiquidationPrice && (
                        <div className="flex items-center">
                          <div className="ml-auto flex items-center">
                            <span className="muted">
                              $
                              {formatAmount(
                                liquidationPrice,
                                USD_DECIMALS,
                                2,
                                true
                              )}
                            </span>
                            <BsArrowRight className="transition-arrow" />
                            <span>
                              $
                              {formatAmount(
                                nextLiquidationPrice,
                                USD_DECIMALS,
                                2,
                                true
                              )}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="Exchange-info-row">
                    <div className="Exchange-info-label">Mark Price</div>
                    <div className="align-right">
                      ${formatAmount(position.markPrice, USD_DECIMALS, 2, true)}
                    </div>
                  </div>
                </div>

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
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
