import React, { useEffect } from "react";
import useSWR from "swr";
import { ethers } from "ethers";
import cx from "classnames";
import { useParams } from "react-router-dom";

import "./css/Actions.css";

import { getContract } from "./Addresses";
import {
  getExplorerUrl,
  formatDateTime,
  formatAmount,
  bigNumberify,
  expandDecimals,
  fetcher,
} from "./Helpers";
import { getToken, getTokens, getWhitelistedTokens } from "./data/Tokens";

import Reader from "./abis/Reader.json";

const CHAIN_ID = 4;
const USD_DECIMALS = 30;

const BASIS_POINTS_DIVISOR = 10000;
const MARGIN_FEE_BASIS_POINTS = 10;
const FUNDING_RATE_PRECISION = 1000000;
const LIQUIDATION_FEE = expandDecimals(5, USD_DECIMALS);
const MAX_LEVERAGE = 50 * 10000;

const NATIVE_TOKEN_ADDRESS = getContract(CHAIN_ID, "NATIVE_TOKEN");
const NDOL_ADDRESS = getContract(CHAIN_ID, "NDOL");

const { AddressZero } = ethers.constants;

const getTokenInfo = (infoTokens, tokenAddress, replaceNative) => {
  if (replaceNative && tokenAddress === NATIVE_TOKEN_ADDRESS) {
    return infoTokens[AddressZero];
  }
  return infoTokens[tokenAddress];
};

function getPositionKey(collateralTokenAddress, indexTokenAddress, isLong) {
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

const getLeverage = ({
  size,
  sizeDelta,
  increaseSize,
  collateral,
  collateralDelta,
  increaseCollateral,
  entryFundingRate,
  cumulativeFundingRate,
}) => {
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

  if (remainingCollateral.eq(0)) {
    return;
  }

  remainingCollateral = sizeDelta
    ? remainingCollateral
        .mul(BASIS_POINTS_DIVISOR - MARGIN_FEE_BASIS_POINTS)
        ?.div(BASIS_POINTS_DIVISOR)
    : remainingCollateral;
  if (entryFundingRate && cumulativeFundingRate) {
    const fundingFee = size
      .mul(cumulativeFundingRate.sub(entryFundingRate))
      ?.div(FUNDING_RATE_PRECISION);
    remainingCollateral = remainingCollateral.sub(fundingFee);
  }

  return nextSize.mul(BASIS_POINTS_DIVISOR)?.div(remainingCollateral);
};

function getPositions(positionQuery, positionData, infoTokens) {
  const propsLength = 9;
  const positions = [];
  const positionsMap = {};
  if (!positionData) {
    return { positions, positionsMap };
  }
  const { collateralTokens, indexTokens, isLong } = positionQuery;
  for (let i = 0; i < collateralTokens.length; i++) {
    const collateralToken = getTokenInfo(infoTokens, collateralTokens[i], true);
    const indexToken = getTokenInfo(infoTokens, indexTokens[i], true);
    const key = getPositionKey(collateralTokens[i], indexTokens[i], isLong[i]);

    const position = {
      key,
      collateralToken,
      indexToken,
      isLong: isLong[i],
      size: positionData[i * propsLength],
      collateral: positionData[i * propsLength + 1],
      averagePrice: positionData[i * propsLength + 2],
      entryFundingRate: positionData[i * propsLength + 3],
      cumulativeFundingRate: collateralToken.cumulativeFundingRate,
      hasRealisedProfit: positionData[i * propsLength + 4].eq(1),
      realisedPnl: positionData[i * propsLength + 5],
      lastIncreasedTime: positionData[i * propsLength + 6],
      hasProfit: positionData[i * propsLength + 7].eq(1),
      delta: positionData[i * propsLength + 8],
      markPrice: isLong[i] ? indexToken.minPrice : indexToken.maxPrice,
    };

    if (position.collateral.gt(0)) {
      position.deltaPercentage = position.delta
        .mul(BASIS_POINTS_DIVISOR)
        ?.div(position.collateral);

      if (position.delta.gt(0)) {
        position.deltaStr = position.hasProfit ? "+" : "-";
        position.deltaPercentageStr = position.hasProfit ? "+" : "-";
      }
      position.deltaStr += `$${formatAmount(position.delta, USD_DECIMALS, 2)}`;
      position.deltaPercentageStr += `${formatAmount(
        position.deltaPercentage,
        2,
        2
      )}%`;
    }

    position.leverage = getLeverage({
      size: position.size,
      collateral: position.collateral,
      entryFundingRate: position.entryFundingRate,
      cumulativeFundingRate: position.cumulativeFundingRate,
      hasProfit: position.hasProfit,
      delta: position.delta,
    });

    positionsMap[key] = position;

    if (position.size.gt(0)) {
      positions.push(position);
    }
  }

  return { positions, positionsMap };
}

function getInfoTokens(
  tokens,
  tokenBalances,
  whitelistedTokens,
  vaultTokenInfo,
  fundingRateInfo
) {
  const vaultPropsLength = 9;
  const fundingRatePropsLength = 2;
  const infoTokens = {};

  for (let i = 0; i < tokens.length; i++) {
    const token = JSON.parse(JSON.stringify(tokens[i]));
    if (tokenBalances) {
      token.balance = tokenBalances[i];
    }
    if (token.address === NDOL_ADDRESS) {
      token.minPrice = expandDecimals(1, USD_DECIMALS);
      token.maxPrice = expandDecimals(1, USD_DECIMALS);
    }
    infoTokens[token.address] = token;
  }

  for (let i = 0; i < whitelistedTokens.length; i++) {
    const token = JSON.parse(JSON.stringify(whitelistedTokens[i]));
    if (vaultTokenInfo) {
      token.poolAmount = vaultTokenInfo[i * vaultPropsLength];
      token.reservedAmount = vaultTokenInfo[i * vaultPropsLength + 1];
      token.availableAmount = token.poolAmount.sub(token.reservedAmount);
      token.ndolAmount = vaultTokenInfo[i * vaultPropsLength + 2];
      token.redemptionAmount = vaultTokenInfo[i * vaultPropsLength + 3];
      token.minPrice = vaultTokenInfo[i * vaultPropsLength + 4];
      token.maxPrice = vaultTokenInfo[i * vaultPropsLength + 5];
      token.guaranteedUsd = vaultTokenInfo[i * vaultPropsLength + 6];
    }

    if (fundingRateInfo) {
      token.fundingRate = fundingRateInfo[i * fundingRatePropsLength];
      token.cumulativeFundingRate =
        fundingRateInfo[i * fundingRatePropsLength + 1];
    }

    if (infoTokens[token.address]) {
      token.balance = infoTokens[token.address].balance;
    }

    infoTokens[token.address] = token;
  }

  return infoTokens;
}

function getPositionFee(size) {
  const afterFeeUsd = size
    .mul(BASIS_POINTS_DIVISOR - MARGIN_FEE_BASIS_POINTS)
    ?.div(BASIS_POINTS_DIVISOR);
  return size.sub(afterFeeUsd);
}

const getTokenAddress = (token) => {
  if (token.address === AddressZero) {
    return NATIVE_TOKEN_ADDRESS;
  }
  return token.address;
};

function getPositionQuery(tokens) {
  const collateralTokens = [];
  const indexTokens = [];
  const isLong = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.isStable) {
      continue;
    }
    if (token.isWrapped) {
      continue;
    }
    collateralTokens.push(getTokenAddress(token));
    indexTokens.push(getTokenAddress(token));
    isLong.push(true);
  }

  for (let i = 0; i < tokens.length; i++) {
    const stableToken = tokens[i];
    if (!stableToken.isStable) {
      continue;
    }

    for (let j = 0; j < tokens.length; j++) {
      const token = tokens[j];
      if (token.isStable) {
        continue;
      }
      if (token.isWrapped) {
        continue;
      }
      collateralTokens.push(stableToken.address);
      indexTokens.push(getTokenAddress(token));
      isLong.push(false);
    }
  }

  return { collateralTokens, indexTokens, isLong };
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
  const priceDelta = liquidationDelta.mul(averagePrice)?.div(size);

  if (isLong) {
    return averagePrice.sub(priceDelta);
  }

  return averagePrice.add(priceDelta);
}

function getLiquidationPrice(data) {
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

  let remainingCollateral = collateral;
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

  let marginFee = getPositionFee(size).add(LIQUIDATION_FEE);
  if (entryFundingRate && cumulativeFundingRate) {
    const fundingFee = size
      .mul(cumulativeFundingRate.sub(entryFundingRate))
      ?.div(FUNDING_RATE_PRECISION);
    marginFee.add(fundingFee);
  }

  const liquidationPriceForFees = getLiquidationPriceFromDelta({
    liquidationAmount: marginFee,
    size: nextSize,
    collateral: remainingCollateral,
    averagePrice,
    isLong,
  });

  const liquidationPriceForMaxLeverage = getLiquidationPriceFromDelta({
    liquidationAmount: nextSize.mul(BASIS_POINTS_DIVISOR)?.div(MAX_LEVERAGE),
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

export default function Actions() {
  const { account } = useParams();
  let checkSummedAccount = "";
  if (ethers.utils.isAddress(account)) {
    checkSummedAccount = ethers.utils.getAddress(account);
  }
  const tradesUrl = `https://gambit-server-staging.uc.r.appspot.com/actions?account=${checkSummedAccount}`;
  const { data: trades, mutate: updateTrades } = useSWR([tradesUrl], {
    fetcher: (...args) => fetch(...args).then((res) => res.json()),
  });
  const pnlUrl = `https://gambit-server-staging.uc.r.appspot.com/pnl?account=${checkSummedAccount}`;
  const { data: pnlData, mutate: updatePnlData } = useSWR([pnlUrl], {
    fetcher: (...args) => fetch(...args).then((res) => res.json()),
  });
  const tokens = getTokens(CHAIN_ID);
  const whitelistedTokens = getWhitelistedTokens(CHAIN_ID);
  const whitelistedTokenAddresses = whitelistedTokens.map(
    (token) => token.address
  );
  const positionQuery = getPositionQuery(whitelistedTokens);
  const readerAddress = getContract(CHAIN_ID, "Reader");
  const vaultAddress = getContract(CHAIN_ID, "Vault");

  const { data: vaultTokenInfo, mutate: updateVaultTokenInfo } = useSWR(
    [true, readerAddress, "getVaultTokenInfo"],
    {
      fetcher: fetcher(undefined, Reader, [
        vaultAddress,
        NATIVE_TOKEN_ADDRESS,
        expandDecimals(1, 18),
        whitelistedTokenAddresses,
      ]),
    }
  );
  const tokenAddresses = tokens.map((token) => token.address);
  const { data: tokenBalances, mutate: updateTokenBalances } = useSWR(
    [true, readerAddress, "getTokenBalances", checkSummedAccount],
    {
      fetcher: fetcher(undefined, Reader, [tokenAddresses]),
    }
  );
  const { data: positionData, mutate: updatePositionData } = useSWR(
    [true, readerAddress, "getPositions", vaultAddress, checkSummedAccount],
    {
      fetcher: fetcher(undefined, Reader, [
        positionQuery.collateralTokens,
        positionQuery.indexTokens,
        positionQuery.isLong,
      ]),
    }
  );
  const { data: fundingRateInfo, mutate: updateFundingRateInfo } = useSWR(
    [true, readerAddress, "getFundingRates"],
    {
      fetcher: fetcher(undefined, Reader, [
        vaultAddress,
        NATIVE_TOKEN_ADDRESS,
        whitelistedTokenAddresses,
      ]),
    }
  );

  useEffect(() => {
    const interval = setInterval(() => {
      updateTrades(undefined, true);
      updateVaultTokenInfo(undefined, true);
      updateTokenBalances(undefined, true);
      updatePositionData(undefined, true);
      updateFundingRateInfo(undefined, true);
      updatePnlData(undefined, true);
    }, 10 * 1000);
    return () => clearInterval(interval);
  }, [
    updateTrades,
    updateVaultTokenInfo,
    updateTokenBalances,
    updatePositionData,
    updateFundingRateInfo,
    updatePnlData,
  ]);

  const infoTokens = getInfoTokens(
    tokens,
    tokenBalances,
    whitelistedTokens,
    vaultTokenInfo,
    fundingRateInfo
  );
  const { positions } = getPositions(positionQuery, positionData, infoTokens);

  const getMsg = (trade) => {
    const tradeData = trade.data;
    const params = JSON.parse(tradeData.params);
    let defaultMsg = "";

    if (tradeData.action === "BuyNDOL") {
      const token = getToken(CHAIN_ID, params.token);
      if (!token) {
        return defaultMsg;
      }
      return `Swap ${formatAmount(
        params.tokenAmount,
        token.decimals,
        4,
        true
      )} ${token.symbol} for ${formatAmount(
        params.ndolAmount,
        18,
        4,
        true
      )} NDOL`;
    }

    if (tradeData.action === "SellNDOL") {
      const token = getToken(CHAIN_ID, params.token);
      if (!token) {
        return defaultMsg;
      }
      return `Swap ${formatAmount(
        params.ndolAmount,
        18,
        4,
        true
      )} NDOL for ${formatAmount(
        params.tokenAmount,
        token.decimals,
        4,
        true
      )} ${token.symbol}`;
    }

    if (tradeData.action === "Swap") {
      const tokenIn = getToken(CHAIN_ID, params.tokenIn);
      const tokenOut = getToken(CHAIN_ID, params.tokenOut);
      if (!tokenIn || !tokenOut) {
        return defaultMsg;
      }
      return `Swap ${formatAmount(
        params.amountIn,
        tokenIn.decimals,
        4,
        true
      )} ${tokenIn.symbol} for ${formatAmount(
        params.amountOut,
        tokenOut.decimals,
        4,
        true
      )} ${tokenOut.symbol}`;
    }

    if (
      tradeData.action === "IncreasePosition-Long" ||
      tradeData.action === "IncreasePosition-Short"
    ) {
      const indexToken = getToken(CHAIN_ID, params.indexToken);
      if (!indexToken) {
        return defaultMsg;
      }
      if (bigNumberify(params.sizeDelta).eq(0)) {
        return `Deposit ${formatAmount(
          params.collateralDelta,
          USD_DECIMALS,
          2,
          true
        )} USD into ${indexToken.symbol} ${params.isLong ? "Long" : "Short"}`;
      }
      return `Increase ${indexToken.symbol} ${
        params.isLong ? "Long" : "Short"
      }, +${formatAmount(params.sizeDelta, USD_DECIMALS, 2, true)} USD, ${
        indexToken.symbol
      } Price: ${formatAmount(params.price, USD_DECIMALS, 2, true)} USD`;
    }

    if (
      tradeData.action === "DecreasePosition-Long" ||
      tradeData.action === "DecreasePosition-Short"
    ) {
      const indexToken = getToken(CHAIN_ID, params.indexToken);
      if (!indexToken) {
        return defaultMsg;
      }
      if (bigNumberify(params.sizeDelta).eq(0)) {
        return `Withdraw ${formatAmount(
          params.collateralDelta,
          USD_DECIMALS,
          2,
          true
        )} USD from ${indexToken.symbol} ${params.isLong ? "Long" : "Short"}`;
      }
      return `Decrease ${indexToken.symbol} ${
        params.isLong ? "Long" : "Short"
      }, -${formatAmount(params.sizeDelta, USD_DECIMALS, 2, true)} USD, ${
        indexToken.symbol
      } Price: ${formatAmount(params.price, USD_DECIMALS, 2, true)} USD`;
    }

    if (
      tradeData.action === "LiquidatePosition-Long" ||
      tradeData.action === "LiquidatePosition-Short"
    ) {
      const indexToken = getToken(CHAIN_ID, params.indexToken);
      if (!indexToken) {
        return defaultMsg;
      }
      return `Liquidated ${indexToken.symbol} ${
        params.isLong ? "Long" : "Short"
      }, ${formatAmount(params.size, USD_DECIMALS, 2, true)} USD, ${
        indexToken.symbol
      } Price: ${formatAmount(params.markPrice, USD_DECIMALS, 2, true)} USD`;
    }

    return tradeData.action;
  };

  return (
    <div className="Actions">
      <div className="Actions-section">Account: {account}</div>
      <div className="Actions-section">
        <div className="Actions-title">PnL</div>
        {(!pnlData || pnlData.length === 0) && <div>No PnLs found</div>}
        {pnlData &&
          pnlData.length > 0 &&
          pnlData.map((pnlRow, index) => {
            const token = getToken(CHAIN_ID, pnlRow.data.indexToken);
            return (
              <div className="TradeHistory-row border" key={index}>
                <div>
                  {token.symbol} {pnlRow.data.isLong ? "Long" : "Short"} Profit:{" "}
                  {formatAmount(pnlRow.data.profit, USD_DECIMALS, 2, true)} USD
                </div>
                <div>
                  {token.symbol} {pnlRow.data.isLong ? "Long" : "Short"} Loss:{" "}
                  {formatAmount(pnlRow.data.loss, USD_DECIMALS, 2, true)} USD
                </div>
              </div>
            );
          })}
      </div>
      <div className="Actions-section">
        <div className="Actions-title">Positions</div>
        {(!positions || positions.length === 0) && (
          <div>No positions found</div>
        )}
        {positions && positions.length > 0 && (
          <PositionsList positions={positions} />
        )}
      </div>
      <div className="Actions-section">
        <div className="Actions-title">Actions</div>
        {(!trades || trades.length === 0) && <div> No trades found </div>}
        {trades &&
          trades.length > 0 &&
          trades.map((trade, index) => {
            const tradeData = trade.data;
            const txUrl = getExplorerUrl(CHAIN_ID) + "tx/" + tradeData.txhash;
            let msg = getMsg(trade);
            return (
              <div className="TradeHistory-row border" key={index}>
                <div>
                  <div className="muted TradeHistory-time">
                    {formatDateTime(tradeData.timestamp)}
                  </div>
                  <a
                    className="plain"
                    href={txUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {msg}
                  </a>
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}

function PositionsList(props) {
  const { positions } = props;

  return (
    <div>
      {positions && (
        <table className="Exchange-positions small border">
          <tbody>
            <tr className="Exchange-positions-header">
              <th>
                <div>Position</div>
                <div className="muted">Side</div>
              </th>
              <th>
                <div>Size</div>
                <div className="muted">PnL</div>
              </th>
              <th>
                <div>Entry Price</div>
                <div className="muted">Leverage</div>
              </th>
              <th>
                <div>Mark Price</div>
                <div className="muted">Liq. Price</div>
              </th>
            </tr>
            {positions.length === 0 && (
              <tr>
                <td colSpan="4">No open positions</td>
              </tr>
            )}
            {positions.map((position) => {
              const liquidationPrice = getLiquidationPrice(position);
              return (
                <tr key={position.key}>
                  <td>
                    <div className="Exchange-positions-title">
                      {position.indexToken.symbol}
                    </div>
                    <div
                      className={cx("Exchange-positions-side", {
                        positive: position.isLong,
                        negative: !position.isLong,
                      })}
                    >
                      {position.isLong ? "Long" : "Short"}
                    </div>
                  </td>
                  <td>
                    <div>
                      ${formatAmount(position.size, USD_DECIMALS, 2, true)}
                    </div>
                    <div
                      className={cx({
                        positive: position.hasProfit && position.delta.gt(0),
                        negative: !position.hasProfit && position.delta.gt(0),
                      })}
                    >
                      {position.deltaStr} ({position.deltaPercentageStr})
                    </div>
                  </td>
                  <td>
                    <div>
                      $
                      {formatAmount(
                        position.averagePrice,
                        USD_DECIMALS,
                        2,
                        true
                      )}
                    </div>
                    <div className="muted">
                      {formatAmount(position.leverage, 4, 2, true)}x
                    </div>
                  </td>
                  <td>
                    <div>
                      ${formatAmount(position.markPrice, USD_DECIMALS, 2, true)}
                    </div>
                    <div className="muted">
                      ${formatAmount(liquidationPrice, USD_DECIMALS, 2, true)}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <table className="Exchange-positions large">
        <tbody>
          <tr className="Exchange-positions-header">
            <th>Position</th>
            <th>Side</th>
            <th>Size</th>
            <th>Collateral</th>
            <th className="Exchange-positions-extra-info">Entry Price</th>
            <th className="Exchange-positions-extra-info">Mark Price</th>
            <th className="Exchange-positions-extra-info">Liq. Price</th>
            <th>PnL</th>
          </tr>
          {positions.length === 0 && (
            <tr>
              <td>No open positions</td>
              <td></td>
              <td></td>
              <td></td>
              <td></td>
              <td className="Exchange-positions-extra-info">-</td>
              <td className="Exchange-positions-extra-info">-</td>
              <td className="Exchange-positions-extra-info">-</td>
              <td>-</td>
              <td></td>
              <td></td>
            </tr>
          )}
          {positions.map((position) => {
            const liquidationPrice = getLiquidationPrice(position);
            return (
              <tr key={position.key}>
                <td>
                  <div className="Exchange-positions-title">
                    {position.indexToken.symbol}
                  </div>
                  <div className="Exchange-positions-leverage-container">
                    <div className="Exchange-positions-leverage">
                      {formatAmount(position.leverage, 4, 2, true)}x
                    </div>
                  </div>
                </td>
                <td
                  className={cx({
                    positive: position.isLong,
                    negative: !position.isLong,
                  })}
                >
                  {position.isLong ? "Long" : "Short"}
                </td>
                <td>${formatAmount(position.size, USD_DECIMALS, 2, true)}</td>
                <td>
                  ${formatAmount(position.collateral, USD_DECIMALS, 2, true)}
                </td>
                <td className="Exchange-positions-extra-info">
                  ${formatAmount(position.averagePrice, USD_DECIMALS, 2, true)}
                </td>
                <td className="Exchange-positions-extra-info">
                  ${formatAmount(position.markPrice, USD_DECIMALS, 2, true)}
                </td>
                <td className="Exchange-positions-extra-info">
                  ${formatAmount(liquidationPrice, USD_DECIMALS, 2, true)}
                </td>
                <td
                  className={cx({
                    positive: position.hasProfit && position.delta.gt(0),
                    negative: !position.hasProfit && position.delta.gt(0),
                  })}
                >
                  {position.deltaStr} ({position.deltaPercentageStr})
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
