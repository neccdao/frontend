import React, { useEffect } from "react";
import useSWR from "swr";
import {
  formatAmount,
  bigNumberify,
  USD_DECIMALS,
  CHAIN_ID,
  getExplorerUrl,
  formatDateTime,
} from "../../Helpers";

import "../../css/components/Exchange/TradeHistory.css";
import { useQuery, gql } from "@apollo/client";

const GET_HISTORY = gql`
  query getHistory($account: String!, $first: Int!) {
    account(id: $account) {
      id
      # (first: 100)
      actions(first: $first, orderBy: timestamp, orderDirection: desc) {
        id
        type
        account
        timestamp

        # IncreasePosition | DecreasePosition
        collateralToken
        indexToken
        collateralDelta
        sizeDelta
        isLong
        price
        fee

        # UpdatePosition | ClosePosition | LiquidatePosition
        realisedPnl

        # LiquidatePosition
        key
        size
        collateral
        reserveAmount
        markPrice
        liquidatedStatus

        # UpdatePosition
        averagePrice
        entryFundingRate

        # Swap
        tokenIn
        tokenOut
        amountIn
        amountOut

        # BuyNDOL | SellNDOL
        token
        tokenAmount
        ndolAmount
      }
    }
  }
`;

export default function History(props) {
  const { account, infoTokens, getTokenInfo } = props;
  const { loading, error, data, refetch, fetchMore } = useQuery(GET_HISTORY, {
    variables: {
      account: account?.toLowerCase(),
      first: 10,
    },
  });

  // useEffect(() => {
  //   const interval = setInterval(() => {
  //     refetch();
  //   }, 10 * 1000);
  //   return () => clearInterval(interval);
  // }, [account]);

  if (error) return <p>{JSON.stringify(error)}</p>;
  if (loading) return <p>Loading ...</p>;
  if (data) {
    const trades = data?.account?.actions;

    const getMsg = (trade) => {
      const tradeData = trade;
      const params = tradeData;
      let defaultMsg = "";

      const lowercasedInfoTokensKeys = Object.keys(infoTokens).reduce(
        (destination, key) => {
          destination[key.toLowerCase()] = infoTokens[key];
          return destination;
        },
        {}
      );

      switch (tradeData.type) {
        case "SellNDOL": {
          const token = getTokenInfo(
            lowercasedInfoTokensKeys,
            params.token,
            true
          );
          if (!token) {
            return defaultMsg;
          }
          return `Sell ${formatAmount(
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
        case "BuyNDOL": {
          const token = getTokenInfo(
            lowercasedInfoTokensKeys,
            params.token,
            true
          );
          if (!token) {
            return defaultMsg;
          }
          return `Buy ${formatAmount(
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
        // TODO: Update Actions.account to be the account that sent the transaction via Router.swap -> Router.swapTokensToETH

        case "Swap": {
          const tokenIn = getTokenInfo(
            lowercasedInfoTokensKeys,
            params.tokenIn,
            true
          );
          const tokenOut = getTokenInfo(
            lowercasedInfoTokensKeys,
            params.tokenOut,
            true
          );
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
        // TODO: Create Action.type for "UpdatePosition" and reconcile with IncreasePosition for open vs increase/deposit
        // case "UpdatePosition": {
        //   console.log(params);
        //   const indexToken = getTokenInfo(
        //     lowercasedInfoTokensKeys,
        //     params.indexToken,
        //     true
        //   );
        //   if (!indexToken) {
        //     return defaultMsg;
        //   }
        //   if (bigNumberify(params.sizeDelta).eq(0)) {
        //     return `Deposit ${formatAmount(
        //       params.collateralDelta,
        //       USD_DECIMALS,
        //       2,
        //       true
        //     )} USD into ${indexToken.symbol} ${
        //       params.isLong ? "Long" : "Short"
        //     }`;
        //   }
        // }
        case "IncreasePosition": {
          const indexToken = getTokenInfo(
            lowercasedInfoTokensKeys,
            params.indexToken,
            true
          );
          const collateralToken = getTokenInfo(
            lowercasedInfoTokensKeys,
            params.collateralToken,
            true
          );
          if (!indexToken) {
            return defaultMsg;
          }
          return `Increase ${indexToken.symbol} ${
            params.isLong ? "Long" : "Short"
          } using ${collateralToken.symbol}, +${formatAmount(
            params.sizeDelta,
            USD_DECIMALS,
            2,
            true
          )} USD, ${indexToken.symbol} Price: ${formatAmount(
            params.price,
            USD_DECIMALS,
            2,
            true
          )} USD`;
        }

        case "DecreasePosition": {
          const closePositionAction = trades.find((trade) => {
            return (
              trade.id.split("-")[0] === params.id.split("-")[0] &&
              trade.type === "ClosePosition"
            );
          });
          const indexToken = getTokenInfo(
            lowercasedInfoTokensKeys,
            params.indexToken,
            true
          );
          if (!indexToken) {
            return defaultMsg;
          }
          if (closePositionAction) {
            return `Close ${indexToken.symbol} ${
              params.isLong ? "Long" : "Short"
            }, ${formatAmount(
              closePositionAction.realisedPnl,
              USD_DECIMALS,
              2,
              true
            )} USD, ${indexToken.symbol} Price: ${formatAmount(
              params.price,
              USD_DECIMALS,
              2,
              true
            )} USD`;
          } else {
            return `Withdraw ${indexToken.symbol} ${
              params.isLong ? "Long" : "Short"
            } -${formatAmount(
              params.collateralDelta,
              USD_DECIMALS,
              2,
              true
            )} USD, ${indexToken.symbol} Price: ${formatAmount(
              params.price,
              USD_DECIMALS,
              2,
              true
            )} USD`;
          }
        }
        case "LiquidatePosition": {
          const indexToken = getTokenInfo(
            lowercasedInfoTokensKeys,
            params.indexToken,
            true
          );
          if (!indexToken) {
            return defaultMsg;
          }
          return `Liquidated ${indexToken.symbol} ${
            params.isLong ? "Long" : "Short"
          } Status: ${params.liquidatedStatus}, ${formatAmount(
            params.size,
            USD_DECIMALS,
            2,
            true
          )} USD, ${indexToken.symbol} Price: ${formatAmount(
            params.markPrice,
            USD_DECIMALS,
            2,
            true
          )} USD`;
        }
        default: {
          if (params.type === "ClosePosition") {
            return null;
          }
          console.log({ params });
          return "N/A";
        }
      }
    };

    return (
      <div className="TradeHistory mt-4">
        {(!trades || trades.length === 0) && (
          <div className="TradeHistory-row border bg-nord2">No trades yet</div>
        )}
        {trades &&
          trades.length > 0 &&
          trades.map((trade, index) => {
            const tradeData = trade;
            const txUrl =
              getExplorerUrl(CHAIN_ID) + "tx/" + tradeData.id.split("-")[0];
            let msg = getMsg(trade);
            if (!msg) return null;
            return (
              <div
                className="TradeHistory-row border bg-[#2c2c2c] hover:bg-nord1"
                key={tradeData.id}
              >
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
        {trades && trades.length > 0 && (
          <button
            className="App-cta mt-2"
            onClick={() =>
              refetch({
                first: trades.length + 20,
                account: account.toLowerCase(),
              })
            }
          >
            Load more
          </button>
        )}
      </div>
    );
  }
}
