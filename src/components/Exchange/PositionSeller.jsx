import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { ethers } from "ethers";

import { BsArrowRight } from "react-icons/bs";

import {
  formatAmount,
  bigNumberify,
  DEFAULT_SLIPPAGE_AMOUNT,
  USD_DECIMALS,
  CHAIN_ID,
  BASIS_POINTS_DIVISOR,
  NDOL_ADDRESS,
  getExplorerUrl,
  usePrevious,
  formatAmountFree,
  parseValue,
  expandDecimals,
  getTokenInfo,
  getLiquidationPrice,
  NATIVE_TOKEN_ADDRESS,
  getLeverage,
  getPositionFee,
  FUNDING_RATE_PRECISION,
  PRECISION,
  MARKET,
  STOP,
  getGasLimit,
  useLocalStorageSerializeKey,
  DUST_USD,
} from "../../Helpers";
import { getContract } from "../../Addresses";
import Router from "../../abis/Router.json";
import OrderBook from "../../abis/OrderBook.json";
import Checkbox from "../Checkbox/Checkbox";
import Tab from "../Tab/Tab";
import Modal from "../Modal/Modal";

const { AddressZero } = ethers.constants;
const OrderBookAddress = getContract(CHAIN_ID, "OrderBook");

function getFundingFee(data) {
  let { entryFundingRate, cumulativeFundingRate, size } = data;
  if (entryFundingRate && cumulativeFundingRate) {
    return size
      .mul(cumulativeFundingRate.sub(entryFundingRate))
      .div(FUNDING_RATE_PRECISION);
  }
  return;
}

function getTokenAmount(usdAmount, tokenAddress, max, infoTokens) {
  if (!usdAmount) {
    return;
  }
  if (tokenAddress === NDOL_ADDRESS) {
    return usdAmount.mul(expandDecimals(1, 18)).div(PRECISION);
  }
  const info = getTokenInfo(infoTokens, tokenAddress);
  if (!info) {
    return;
  }
  if (max && !info.maxPrice) {
    return;
  }
  if (!max && !info.minPrice) {
    return;
  }

  return usdAmount
    .mul(expandDecimals(1, info.decimals))
    .div(max ? info.minPrice : info.maxPrice);
}

export default function PositionSeller(props) {
  const {
    positionsMap,
    positionKey,
    isVisible,
    setIsVisible,
    account,
    library,
    infoTokens,
    pendingTxns,
    setPendingTxns,
    flagOrdersEnabled,
  } = props;
  const [savedSlippageAmount] = useLocalStorageSerializeKey(
    [CHAIN_ID, "Exchange-swap-slippage-basis-points"],
    DEFAULT_SLIPPAGE_AMOUNT
  );
  const [keepLeverage, setKeepLeverage] = useLocalStorageSerializeKey(
    [CHAIN_ID, "Exchange-keep-leverage"],
    true
  );
  const position =
    positionsMap && positionKey ? positionsMap[positionKey] : undefined;
  const [fromValue, setFromValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const prevIsVisible = usePrevious(isVisible);

  const routerAddress = getContract(CHAIN_ID, "Router");

  const orderTypes = [MARKET, STOP];
  let [orderType, setOrderType] = useState(MARKET);
  if (!flagOrdersEnabled) {
    orderType = MARKET;
  }
  const onOrderOptionChange = (option) => {
    setOrderType(option);
  };

  const onTriggerPriceChange = (evt) => {
    setTriggerPriceValue(evt.target.value || "");
  };
  const [triggerPriceValue, setTriggerPriceValue] = useState("");
  const triggerPriceUsd =
    orderType === MARKET ? 0 : parseValue(triggerPriceValue, USD_DECIMALS);
  const isTakeProfit =
    orderType === STOP &&
    triggerPriceUsd &&
    triggerPriceUsd.gt(position.markPrice);

  let collateralToken;
  let maxAmount;
  let maxAmountFormatted;
  let maxAmountFormattedFree;
  let fromAmount;

  let convertedAmount;
  let convertedAmountFormatted;

  let nextLeverage;
  let liquidationPrice;
  let nextLiquidationPrice;
  let isClosing;
  let sizeDelta;

  let nextCollateral;
  let collateralDelta = bigNumberify(0);
  let receiveAmount = bigNumberify(0);
  let convertedReceiveAmount = bigNumberify(0);
  let adjustedDelta = bigNumberify(0);

  let title;
  let fundingFee;
  let positionFee;
  let totalFees;
  if (position) {
    fundingFee = getFundingFee(position);
    fromAmount = parseValue(fromValue, USD_DECIMALS);
    sizeDelta = fromAmount;

    title = `Close ${position.isLong ? "Long" : "Short"} ${
      position.indexToken.symbol
    }`;
    collateralToken = position.collateralToken;
    liquidationPrice = getLiquidationPrice(position);

    if (fromAmount) {
      isClosing = position.size.sub(fromAmount).lt(DUST_USD);
      positionFee = getPositionFee(fromAmount);
    }

    if (isClosing) {
      sizeDelta = position.size;
      receiveAmount = position.collateral;
    }

    if (sizeDelta && position.delta && position.size) {
      adjustedDelta = position?.delta?.mul(sizeDelta)?.div(position.size);
    }

    if (position.hasProfit) {
      receiveAmount = receiveAmount.add(adjustedDelta);
    } else {
      if (receiveAmount.gt(adjustedDelta)) {
        receiveAmount = receiveAmount.sub(adjustedDelta);
      } else {
        receiveAmount = bigNumberify(0);
      }
    }

    if (keepLeverage && sizeDelta && !isClosing) {
      collateralDelta = sizeDelta.mul(position.collateral).div(position.size);
    }

    receiveAmount = receiveAmount.add(collateralDelta);

    if (sizeDelta) {
      totalFees = positionFee.add(fundingFee);
      if (receiveAmount.gt(totalFees)) {
        receiveAmount = receiveAmount.sub(totalFees);
      } else {
        receiveAmount = bigNumberify(0);
      }
    }

    if (collateralDelta && totalFees && collateralDelta.gt(totalFees)) {
      collateralDelta = collateralDelta.sub(totalFees);
    }

    convertedReceiveAmount = getTokenAmount(
      receiveAmount,
      collateralToken.address,
      false,
      infoTokens
    );

    if (isClosing) {
      nextCollateral = bigNumberify(0);
    } else {
      if (position.collateral && collateralDelta) {
        nextCollateral = position.collateral.sub(collateralDelta);
      }
    }

    maxAmount = position.size;
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

    if (fromAmount) {
      if (!isClosing && !keepLeverage) {
        nextLeverage = getLeverage({
          size: position.size,
          sizeDelta,
          collateral: position.collateral,
          entryFundingRate: position.entryFundingRate,
          cumulativeFundingRate: position.cumulativeFundingRate,
          hasProfit: position.hasProfit,
          delta: position.delta,
        });
        nextLiquidationPrice = getLiquidationPrice({
          isLong: position.isLong,
          size: position.size,
          sizeDelta,
          collateral: position.collateral,
          averagePrice: position.averagePrice,
          entryFundingRate: position.entryFundingRate,
          cumulativeFundingRate: position.cumulativeFundingRate,
        });
      }
    }
  }

  const getError = () => {
    if (!fromAmount) {
      return "Enter amount";
    }
    if (nextLeverage && nextLeverage.eq(0)) {
      return "Enter amount";
    }
    if (orderType === STOP && !triggerPriceUsd) {
      return "Enter a trigger price";
    }

    if (!isClosing && position && position.size && fromAmount) {
      if (position.size.sub(fromAmount).lt(expandDecimals(10, USD_DECIMALS))) {
        return "Min order: 10 USD";
      }
    }

    if (position && position.size && position.size.lt(fromAmount)) {
      return "Max close amount exceeded";
    }

    if (nextLeverage && nextLeverage.lt(1.1 * BASIS_POINTS_DIVISOR)) {
      return "Min leverage: 1.1x";
    }

    if (nextLeverage && nextLeverage.gt(30.5 * BASIS_POINTS_DIVISOR)) {
      return "Max leverage: 30.5x";
    }
  };

  const isPrimaryEnabled = () => {
    const error = getError();
    if (error) {
      return false;
    }
    if (isSubmitting) {
      return false;
    }

    return true;
  };

  const getPrimaryText = () => {
    const error = getError();
    if (error) {
      return error;
    }
    if (orderType === STOP) {
      if (isSubmitting) return "Creating order...";
      return isTakeProfit
        ? "Create take-profit order"
        : "Create stop-loss order";
    }
    return isSubmitting ? "Closing..." : "Close";
  };

  const resetForm = () => {
    setFromValue("");
  };

  useEffect(() => {
    if (prevIsVisible !== isVisible) {
      resetForm();
    }
  }, [prevIsVisible, isVisible]);

  const onClickPrimary = async () => {
    setIsSubmitting(true);

    const collateralTokenAddress = position.collateralToken.address;
    const indexTokenAddress =
      position.indexToken.address === AddressZero
        ? NATIVE_TOKEN_ADDRESS
        : position.indexToken.address;

    let params;
    let method;
    let contractAddress;
    let message;
    let abi;

    if (orderType === STOP) {
      const executionFee = expandDecimals(500000, 9); // TODO 500k gwei
      params = [
        indexTokenAddress,
        sizeDelta,
        collateralTokenAddress,
        collateralDelta,
        position.isLong,
        triggerPriceUsd,
        isTakeProfit,
        executionFee,
        { value: executionFee },
      ];
      method = "createDecreaseOrder";
      contractAddress = OrderBookAddress;
      message = `${isTakeProfit ? "Take-profit" : "Stop-loss"} ${
        position.isLong ? "Long" : "Short"
      }`;
      abi = OrderBook.abi;
    } else {
      const tokenAddress0 =
        collateralTokenAddress === AddressZero
          ? NATIVE_TOKEN_ADDRESS
          : collateralTokenAddress;
      const priceBasisPoints = position.isLong
        ? BASIS_POINTS_DIVISOR - savedSlippageAmount
        : BASIS_POINTS_DIVISOR + savedSlippageAmount;
      const refPrice = position.isLong
        ? position.indexToken.minPrice
        : position.indexToken.maxPrice;
      const priceLimit = refPrice.mul(priceBasisPoints).div(10000);

      params = [
        tokenAddress0,
        indexTokenAddress,
        collateralDelta,
        sizeDelta,
        position.isLong,
        account,
        priceLimit,
      ];
      method =
        collateralTokenAddress === AddressZero
          ? "decreasePositionETH"
          : "decreasePosition";
      contractAddress = routerAddress;
      message = `Decreased ${position.indexToken.symbol} ${
        position.isLong ? "Long" : "Short"
      } by ${formatAmount(sizeDelta, USD_DECIMALS, 2)} USD`;
      abi = Router.abi;
    }

    const contract = new ethers.Contract(
      contractAddress,
      abi,
      library.getSigner()
    );
    const gasLimit = await getGasLimit(contract, method, params);
    contract[method](...params, { gasLimit })
      .then(async (res) => {
        const txUrl = getExplorerUrl(CHAIN_ID) + "tx/" + res.hash;
        toast.success(
          <div>
            Close submitted!{" "}
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
          message,
        };
        setPendingTxns([...pendingTxns, pendingTxn]);
      })
      .catch((e) => {
        console.error(e);
        toast.error(`Transaction failed.`);
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  };

  return (
    <div className="PositionEditor">
      {position && (
        <Modal isVisible={isVisible} setIsVisible={setIsVisible} label={title}>
          {flagOrdersEnabled && (
            <Tab
              options={orderTypes}
              option={orderType}
              onChange={onOrderOptionChange}
              type="inline"
            />
          )}
          <div className="Exchange-swap-section">
            <div className="Exchange-swap-section-top">
              <div className="muted">
                {convertedAmountFormatted && (
                  <div className="Exchange-swap-usd">
                    Close: {convertedAmountFormatted}{" "}
                    {position.collateralToken.symbol}
                  </div>
                )}
                {!convertedAmountFormatted && "Close"}
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
              <div className="PositionEditor-token-symbol">USD</div>
            </div>
          </div>
          {orderType === STOP && (
            <div className="Exchange-swap-section">
              <div className="Exchange-swap-section-top">
                <div className="muted">Trigger Price</div>
                <div
                  className="muted align-right clickable"
                  onClick={() => {
                    setTriggerPriceValue(
                      formatAmountFree(position.markPrice, USD_DECIMALS, 2)
                    );
                  }}
                >
                  Mark:{" "}
                  {formatAmount(position.markPrice, USD_DECIMALS, 2, true)}
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
          <div className="PositionEditor-info-box">
            <div className="PositionEditor-keep-leverage-settings">
              <Checkbox isChecked={keepLeverage} setIsChecked={setKeepLeverage}>
                <span className="muted">
                  Keep leverage at {formatAmount(position.leverage, 4, 2)}x
                </span>
              </Checkbox>
            </div>
            <div className="Exchange-info-row">
              <div className="Exchange-info-label">Size</div>
              <div className="align-right">
                {position && position.size && fromAmount && (
                  <div className="flex items-center">
                    <div className="ml-auto flex items-center">
                      <span className="muted">
                        ${formatAmount(position.size, USD_DECIMALS, 2, true)}
                      </span>
                      <BsArrowRight className="transition-arrow" />
                      <span>
                        $
                        {formatAmount(
                          position.size.sub(fromAmount),
                          USD_DECIMALS,
                          2,
                          true
                        )}
                      </span>
                    </div>
                  </div>
                )}
                {position && position.size && !fromAmount && (
                  <div>
                    ${formatAmount(position.size, USD_DECIMALS, 2, true)}
                  </div>
                )}
              </div>
            </div>
            <div className="Exchange-info-row">
              <div className="Exchange-info-label">Collateral</div>
              <div className="align-right">
                {nextCollateral && (
                  <div className="flex items-center">
                    <span className="muted ml-auto">
                      $
                      {formatAmount(position.collateral, USD_DECIMALS, 2, true)}
                    </span>
                    <BsArrowRight className="transition-arrow" />
                    <span>
                      ${formatAmount(nextCollateral, USD_DECIMALS, 2, true)}
                    </span>
                  </div>
                )}
                {!nextCollateral &&
                  `$${formatAmount(
                    position.collateral,
                    USD_DECIMALS,
                    4,
                    true
                  )}`}
              </div>
            </div>
            {!keepLeverage && (
              <div className="Exchange-info-row">
                <div className="Exchange-info-label">Leverage</div>
                <div className="align-right">
                  {isClosing && "-"}
                  {!isClosing && (
                    <div>
                      {!nextLeverage && (
                        <div>{formatAmount(position.leverage, 4, 2)}x</div>
                      )}
                      {nextLeverage && (
                        <div className="flex items-center">
                          <div className="ml-auto flex items-center">
                            <span className="muted">
                              {formatAmount(position.leverage, 4, 2)}x
                            </span>
                            <BsArrowRight className="transition-arrow" />
                          </div>
                          <span>{formatAmount(nextLeverage, 4, 2)}x</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
            <div className="Exchange-info-row">
              <div className="Exchange-info-label">Liq. Price</div>
              <div className="align-right">
                {isClosing && "-"}
                {!isClosing && (
                  <div>
                    {!nextLiquidationPrice && (
                      <div>
                        {`$${formatAmount(
                          liquidationPrice,
                          USD_DECIMALS,
                          2,
                          true
                        )}`}
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
                )}
              </div>
            </div>
            <div className="Exchange-info-row">
              <div className="Exchange-info-label">Mark Price</div>
              <div className="align-right">
                ${formatAmount(position.markPrice, USD_DECIMALS, 2, true)}
              </div>
            </div>
            <div className="Exchange-info-row">
              <div className="Exchange-info-label">PnL</div>
              <div className="align-right">{position.deltaStr}</div>
            </div>
            <div className="Exchange-info-row">
              <div className="Exchange-info-label">Borrow Fee</div>
              <div className="align-right">
                ${formatAmount(fundingFee, USD_DECIMALS, 2, true)}
              </div>
            </div>
            <div className="Exchange-info-row">
              <div className="Exchange-info-label">Closing Fee</div>
              <div className="align-right">
                {positionFee &&
                  `$${formatAmount(positionFee, USD_DECIMALS, 2, true)}`}
                {!positionFee && "-"}
              </div>
            </div>
            <div className="Exchange-info-row">
              <div className="Exchange-info-label">Receive</div>
              <div className="align-right">
                {formatAmount(
                  convertedReceiveAmount,
                  position.collateralToken.decimals,
                  4,
                  true
                )}{" "}
                {position.collateralToken.symbol} ($
                {formatAmount(receiveAmount, USD_DECIMALS, 2, true)})
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
        </Modal>
      )}
    </div>
  );
}
