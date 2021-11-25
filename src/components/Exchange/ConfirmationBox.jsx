import React from "react";
import {
  USD_DECIMALS,
  CHAIN_ID,
  PRECISION,
  BASIS_POINTS_DIVISOR,
  MARKET,
  LIMIT,
  DEFAULT_ORDER_EXECUTION_GAS_AMOUNT,
  expandDecimals,
  getExchangeRate,
  formatAmount,
  useLocalStorageSerializeKey,
  getExchangeRateDisplay,
  formatDateTime,
} from "../../Helpers";

import { BsArrowRight } from "react-icons/bs";
import Modal from "../Modal/Modal";
import ExchangeInfoRow from "./ExchangeInfoRow";
import { getToken } from "../../data/Tokens";

const HIGH_SPREAD_THRESHOLD = expandDecimals(1, USD_DECIMALS).div(100); // 1%;

function getSpread(fromTokenInfo, toTokenInfo) {
  if (
    fromTokenInfo &&
    fromTokenInfo.maxPrice &&
    toTokenInfo &&
    toTokenInfo.minPrice
  ) {
    const fromDiff = fromTokenInfo.maxPrice.sub(fromTokenInfo.minPrice);
    const fromSpread = fromDiff.mul(PRECISION).div(fromTokenInfo.maxPrice);
    const toDiff = toTokenInfo.maxPrice.sub(toTokenInfo.minPrice);
    const toSpread = toDiff.mul(PRECISION).div(toTokenInfo.maxPrice);
    const value = fromSpread.add(toSpread);
    return {
      value,
      isHigh: value.gt(HIGH_SPREAD_THRESHOLD),
    };
  }
}

export default function ConfirmationBox(props) {
  const {
    DEFAULT_SLIPPAGE_AMOUNT,
    fromToken,
    fromTokenInfo,
    toToken,
    toTokenInfo,
    isSwap,
    isBurn,
    isMint,
    isHarvest,
    isDeposit,
    isWithdraw,
    isLong,
    isBond,
    isRedeem,
    isRebase,
    isClaim,
    isStake,
    isUnstake,
    isRedeemSecondary,
    setIsRedeemSecondary,
    setIsRebase,
    setIsClaim,
    setIsUnstake,
    isMarketOrder,
    orderType,
    isShort,
    toAmount,
    fromAmount,
    onConfirmationClick,
    setIsConfirming,
    shortCollateralAddress,
    hasExistingPosition,
    leverage,
    existingPosition,
    existingLiquidationPrice,
    displayLiquidationPrice,
    entryMarkPrice,
    exitMarkPrice,
    shortCollateralToken,
    isPendingConfirmation,
    triggerPriceUsd,
    triggerRatio,
    fees,
    feesUsd,
    isSubmitting,
    fromUsdMin,
    toUsdMax,
  } = props;

  const [savedSlippageAmount] = useLocalStorageSerializeKey(
    [CHAIN_ID, "Exchange-swap-slippage-basis-points"],
    DEFAULT_SLIPPAGE_AMOUNT
  );

  let minOut;
  let fromTokenUsd;
  let toTokenUsd;
  let exchangeRate;
  if (isSwap || isBurn || isMint || isWithdraw || isDeposit) {
    if (toAmount && fromAmount) {
      minOut = toAmount
        .mul(BASIS_POINTS_DIVISOR - savedSlippageAmount)
        .div(BASIS_POINTS_DIVISOR);

      fromTokenUsd = fromTokenInfo
        ? formatAmount(fromTokenInfo.minPrice, USD_DECIMALS, 2, true)
        : 0;
      toTokenUsd = toTokenInfo
        ? formatAmount(toTokenInfo.maxPrice, USD_DECIMALS, 2, true)
        : 0;

      if (orderType === MARKET) {
        exchangeRate = formatAmount(
          fromAmount
            .mul(PRECISION)
            .mul(expandDecimals(1, fromToken.decimals))
            .div(toAmount.mul(expandDecimals(1, toToken.decimals))),
          USD_DECIMALS,
          4,
          true
        );
      } else {
        exchangeRate = formatAmount(triggerRatio, USD_DECIMALS, 4, true);
      }
    }
  }

  const getTitle = () => {
    if (!isMarketOrder) {
      return "Confirm Limit Order";
    }
    if (isRebase) {
      return "Confirm Rebase";
    }
    if (isClaim) {
      return "Confirm Claim";
    }
    if (isUnstake) {
      return "Confirm Unstake";
    }
    if (isStake) {
      return "Confirm Stake";
    }
    if (isBurn) {
      return "Confirm Burn";
    }
    if (isMint) {
      return "Confirm Mint";
    }
    if (isHarvest) {
      return "Confirm Harvest";
    }
    if (isDeposit) {
      return "Confirm Deposit";
    }
    if (isWithdraw) {
      return "Confirm Withdraw";
    }
    if (isBond) {
      return "Confirm Bond";
    }
    if (isRedeemSecondary) {
      return "Confirm Redeem And Stake";
    }
    if (isRedeem) {
      return "Confirm Redeem";
    }
    return isLong ? "Confirm Long" : "Confirm Short";
  };
  const title = getTitle();

  const getPrimaryText = () => {
    if (!isPendingConfirmation) {
      return title;
    }

    if (!isMarketOrder) {
      return "Creating Order...";
    }
    if (isRebase) {
      return "Rebasing...";
    }
    if (isClaim) {
      return "Claiming...";
    }
    if (isUnstake) {
      return "Unstaking...";
    }
    if (isStake) {
      return "Staking...";
    }
    if (isSwap) {
      return "Swapping...";
    }
    if (isMint) {
      return "Minting...";
    }
    if (isBurn) {
      return "Burning...";
    }
    if (isDeposit) {
      return "Depositing...";
    }
    if (isWithdraw) {
      return "Withdrawing...";
    }
    if (isLong) {
      return "Longing...";
    }
    if (isBond) {
      return "Bonding...";
    }
    if (isRedeemSecondary) {
      return "Redeem and Staking ...";
    }
    if (isRedeem) {
      return "Redeeming...";
    }
    if (isHarvest) {
      return "Harvesting...";
    }
    return "Shorting...";
  };

  const isPrimaryEnabled = () => {
    return !isPendingConfirmation && !isSubmitting;
  };

  const spread = getSpread(fromTokenInfo, toTokenInfo);
  // it's meaningless for limit/stop orders to show spread based on current prices
  const showSpread = isMarketOrder && !!spread;

  function renderSpreadWarning() {
    if (!isMarketOrder) {
      return null;
    }

    if (spread && spread.isHigh) {
      return (
        <div className="Confirmation-box-warning">
          {`WARNING: the spread is > 1%, please ensure the trade details are
          acceptable before comfirming`}
        </div>
      );
    }
  }

  function renderTriggerRatioWarning() {
    if (!isSwap || !isBurn || !isMint || !isWithdraw || !isDeposit) {
      return null;
    }
    const currentRate = getExchangeRate(fromTokenInfo, toTokenInfo);
    if (orderType === LIMIT && !currentRate.gt(triggerRatio)) {
      return (
        <div className="Confirmation-box-warning">
          WARNING: Trigger Price is higher then current price and order will be
          executed immediatelly
        </div>
      );
    }
  }

  // TODO support triggerRatio
  function renderTriggerPriceWarning() {
    if (!isSwap && orderType === LIMIT && entryMarkPrice < triggerPriceUsd) {
      return (
        <div className="Confirmation-box-warning">
          WARNING: Trigger Price is higher then Mark Price and order will be
          executed immediatelly
        </div>
      );
    }
    if (!isMint && orderType === LIMIT && entryMarkPrice < triggerPriceUsd) {
      return (
        <div className="Confirmation-box-warning">
          WARNING: Trigger Price is higher then Mark Price and order will be
          executed immediatelly
        </div>
      );
    }
    if (!isBurn && orderType === LIMIT && entryMarkPrice < triggerPriceUsd) {
      return (
        <div className="Confirmation-box-warning">
          WARNING: Trigger Price is higher then Mark Price and order will be
          executed immediatelly
        </div>
      );
    }
  }

  // TODO handle unaprproved order plugin
  const renderMain = () => {
    if (isRedeem) {
      const untilDateTime =
        Date.now() / 1000 + fromToken?.vestingTerm?.toNumber();
      return (
        <div className="Confirmation-box-main">
          <div>
            Reedem {isRedeemSecondary && "and Stake"}&nbsp;
            {formatAmount(
              fromToken?.pendingPayoutFor,
              toTokenInfo.decimals,
              9,
              true
            )}{" "}
            {toToken.symbol}
          </div>
          <div className="Confirmation-box-main-icon"></div>
          <div>
            {formatAmount(
              fromToken?.interestDue?.sub(fromToken?.pendingPayoutFor),
              toTokenInfo.decimals,
              2,
              true
            )}{" "}
            {toToken.symbol}{" "}
          </div>
          <div>Remaining vesting till {formatDateTime(untilDateTime)}</div>
        </div>
      );
    }

    if (isBond) {
      return (
        <div className="Confirmation-box-main">
          <div>
            Bond&nbsp;{formatAmount(fromAmount, fromToken.decimals, 4, true)}{" "}
            {fromToken.symbol} ($
            {formatAmount(fromUsdMin, USD_DECIMALS, 2, true)})
          </div>
          <div className="Confirmation-box-main-icon"></div>
          <div>
            Vest over 5 days&nbsp;
            {formatAmount(toAmount, toToken.decimals, 4, true)} {toToken.symbol}{" "}
            (${formatAmount(toUsdMax, USD_DECIMALS, 2, true)})
          </div>
        </div>
      );
    }

    if (isSwap || isBurn || isMint || isDeposit || isWithdraw) {
      // TODO usd price is irrelevant for limit orders
      return (
        <div className="Confirmation-box-main">
          <div>
            Pay&nbsp;{formatAmount(fromAmount, fromToken.decimals, 4, true)}{" "}
            {fromToken.symbol} ($
            {formatAmount(fromUsdMin, USD_DECIMALS, 2, true)})
          </div>
          <div className="Confirmation-box-main-icon"></div>
          <div>
            Receive&nbsp;{formatAmount(toAmount, toToken.decimals, 4, true)}{" "}
            {toToken.symbol} (${formatAmount(toUsdMax, USD_DECIMALS, 2, true)})
          </div>
        </div>
      );
    }

    return (
      <div className="Confirmation-box-main">
        <span>
          Pay&nbsp;{formatAmount(fromAmount, fromToken.decimals, 4, true)}{" "}
          {fromToken.symbol}{" "}
        </span>
        <div className="Confirmation-box-main-icon"></div>
        <div>
          {isLong ? "Long" : "Short"}&nbsp;
          {formatAmount(toAmount, toToken.decimals, 4, true)} {toToken.symbol}
        </div>
      </div>
    );
  };

  function renderExecutionFee() {
    if (isMarketOrder) {
      return null;
    }
    return (
      <ExchangeInfoRow label="Execution Fees">
        {formatAmount(DEFAULT_ORDER_EXECUTION_GAS_AMOUNT, 18, 4)} BNB
      </ExchangeInfoRow>
    );
  }

  return (
    <div className="Confirmation-box">
      <Modal
        isVisible={true}
        setIsVisible={() => {
          setIsConfirming && setIsConfirming(false);
          setIsRedeemSecondary && setIsRedeemSecondary(false);
          setIsClaim && setIsClaim(false);
          setIsUnstake && setIsUnstake(false);
          setIsRebase && setIsRebase(false);
        }}
        label={title}
      >
        {(isSwap ||
          isBurn ||
          isMint ||
          isDeposit ||
          isWithdraw ||
          isBond ||
          isRedeem) && (
          <div className="Confirmation-box-info">
            {renderMain()}
            {renderTriggerRatioWarning()}
            {renderSpreadWarning()}
            {(isSwap || isBurn || isMint) && (
              <React.Fragment>
                <ExchangeInfoRow label="Minimum received">
                  {formatAmount(minOut, toToken.decimals, 4, true)}{" "}
                  {toToken.symbol}
                </ExchangeInfoRow>
                <ExchangeInfoRow label="Price">
                  {getExchangeRateDisplay(
                    getExchangeRate(fromTokenInfo, toTokenInfo),
                    fromToken,
                    toToken
                  )}
                </ExchangeInfoRow>
              </React.Fragment>
            )}
            {!isMarketOrder && (
              <div className="Exchange-info-row">
                <div className="Exchange-info-label">Trigger Price</div>
                <div className="align-right">
                  {exchangeRate} {fromToken.symbol} / {toToken.symbol}
                </div>
              </div>
            )}
            {showSpread && (
              <ExchangeInfoRow label="Spread" isWarning={spread.isHigh}>
                {formatAmount(spread.value.mul(100), USD_DECIMALS, 2, true)}%
              </ExchangeInfoRow>
            )}
            {(isSwap || isBurn || isMint) && (
              <div className="Exchange-info-row">
                <div className="Exchange-info-label">Fees</div>
                <div className="align-right">
                  {formatAmount(fees, fromToken.decimals, 4, true)}{" "}
                  {fromToken.symbol} ($
                  {formatAmount(feesUsd, USD_DECIMALS, 2, true)})
                </div>
              </div>
            )}
            {(isSwap || isBurn || isMint || isLong || isShort) &&
              renderExecutionFee()}
            {fromTokenUsd && (
              <div className="Exchange-info-row">
                <div className="Exchange-info-label">
                  {fromToken.symbol} price
                </div>
                <div className="align-right">{fromTokenUsd} USD</div>
              </div>
            )}
            {toTokenUsd && (
              <div className="Exchange-info-row">
                <div className="Exchange-info-label">
                  {toToken.symbol} price
                </div>
                <div className="align-right">{toTokenUsd} USD</div>
              </div>
            )}
          </div>
        )}
        {(isLong || isShort) && (
          <div className="Confirmation-box-info">
            {renderMain()}
            {renderTriggerPriceWarning()}
            <ExchangeInfoRow label="Fees">
              {formatAmount(feesUsd, USD_DECIMALS, 2, true)} USD
            </ExchangeInfoRow>
            {renderExecutionFee()}
            {isLong && (
              <ExchangeInfoRow label="Profits In" value={toToken.symbol} />
            )}
            {/*
            TODO probably need to show some tip/warming that leverage and liq.price could be different at the time of execution
            TODO probably need to recalculate leverage and liq price with triggerPriceValue
          */}
            <ExchangeInfoRow label="Leverage">
              {hasExistingPosition && toAmount && toAmount.gt(0) && (
                <div className="inline-block muted">
                  {formatAmount(existingPosition.leverage, 4, 2)}x
                  <BsArrowRight className="transition-arrow" />
                </div>
              )}
              {toAmount &&
                leverage &&
                leverage.gt(0) &&
                `${formatAmount(leverage, 4, 2)}x`}
              {!toAmount && leverage && leverage.gt(0) && `-`}
              {leverage && leverage.eq(0) && `-`}
            </ExchangeInfoRow>
            <ExchangeInfoRow label="Liq. Price">
              {hasExistingPosition && toAmount && toAmount.gt(0) && (
                <div className="inline-block muted">
                  $
                  {formatAmount(
                    existingLiquidationPrice,
                    USD_DECIMALS,
                    2,
                    true
                  )}
                  <BsArrowRight className="transition-arrow" />
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
            </ExchangeInfoRow>
            {showSpread && (
              <ExchangeInfoRow
                label="Spread"
                isWarning={spread.isHigh}
                isTop={true}
              >
                {formatAmount(spread.value.mul(100), USD_DECIMALS, 2, true)}%
              </ExchangeInfoRow>
            )}
            {isMarketOrder && (
              <React.Fragment>
                <ExchangeInfoRow label="Entry Price">
                  {formatAmount(entryMarkPrice, USD_DECIMALS, 2, true)} USD
                </ExchangeInfoRow>
                <ExchangeInfoRow label="Exit Price">
                  {formatAmount(exitMarkPrice, USD_DECIMALS, 2, true)} USD
                </ExchangeInfoRow>
              </React.Fragment>
            )}
            {!isMarketOrder && (
              <ExchangeInfoRow label="Trigger Price">
                {formatAmount(triggerPriceUsd, USD_DECIMALS, 2, true)} USD
              </ExchangeInfoRow>
            )}
            <ExchangeInfoRow label="Borrow Fee">
              {(isLong || isShort) &&
                toTokenInfo &&
                formatAmount(toTokenInfo.fundingRate, 4, 4)}
              {(isLong || isShort) &&
                toTokenInfo &&
                toTokenInfo.fundingRate &&
                "% / 8h"}
            </ExchangeInfoRow>
          </div>
        )}
        <div className="Confirmation-box-row">
          <button
            onClick={onConfirmationClick}
            className="App-cta Confirmation-box-button"
            disabled={!isPrimaryEnabled()}
          >
            {getPrimaryText()}
          </button>
        </div>
      </Modal>
    </div>
  );
}
