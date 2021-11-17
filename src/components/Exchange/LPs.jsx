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

const GET_LPs = gql`
  query getLPs($account: String!) {
    account(id: $account) {
      id
      lps {
        id
        token
        tokenAmount
        nusdAmount
      }
    }
  }
`;

export default function LPs(props) {
  const { account, infoTokens, getTokenInfo } = props;
  const lowercasedInfoTokensKeys = Object.keys(infoTokens).reduce(
    (destination, key) => {
      destination[key.toLowerCase()] = infoTokens[key];
      return destination;
    },
    {}
  );
  const { loading, error, data, refetch, fetchMore } = useQuery(GET_LPs, {
    variables: {
      account: account?.toLowerCase(),
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
    const lps = data?.account?.lps;

    return (
      <div className="TradeHistory mt-4">
        {(!lps || lps.length === 0) && (
          <div className="TradeHistory-row border bg-nord2">No lps yet</div>
        )}
        {lps &&
          lps.length > 0 &&
          lps.map((lp, index) => {
            const collateralToken = getTokenInfo(
              lowercasedInfoTokensKeys,
              lp.token,
              true
            );
            return (
              <div
                className="TradeHistory-row border bg-[#2c2c2c] hover:bg-nord1"
                key={lp.id}
              >
                <div>
                  {`${formatAmount(
                    lp.tokenAmount,
                    collateralToken.decimals,
                    4,
                    true
                  )} ${collateralToken.symbol} ${
                    lp.nusdAmount >= 1 ? "minted" : "burned"
                  } ${formatAmount(lp.nusdAmount, 18, 4, true)} NDOL`}
                </div>
                {/* TODO: X% contributed of total collateral pool amount */}
              </div>
            );
          })}
      </div>
    );
  }
}
