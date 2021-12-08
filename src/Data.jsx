import React, { useEffect } from "react";
import useSWR from "swr";
import { toast } from "react-toastify";

import cx from "classnames";
import {
  bigNumberify,
  expandDecimals,
  formatAmount,
  fetcher,
  getProvider,
  formatDate,
  numberWithCommas,
  getTokenUrl,
  CHAIN_ID,
  addToken,
  FUNDING_RATE_PRECISION,
  formatDateTime,
} from "./Helpers";
import { getContract, XGMT_EXCLUDED_ACCOUNTS } from "./Addresses";
import { getTokenBySymbol, getWhitelistedTokens, TOKENS } from "./data/Tokens";
import { getFeeHistory } from "./data/Fees";
import { useQuery, gql } from "@apollo/client";

import Footer from "./Footer";

import Reader from "./abis/Reader.json";
import NDOL from "./abis/NDOL.json";

import "./css/Dashboard.css";

import metamaskImg from "./img/metamask.png";
import coingeckoImg from "./img/coingecko.png";
import { useWeb3React } from "@web3-react/core";

const USD_DECIMALS = 30;
const PRECISION = expandDecimals(1, 30);

const TOKEN_SYMBOLS = ["BTC", "WETH"];

function getToken(chainId, address) {
  const CHAIN_IDS = [56, 97, 4];

  const TOKENS_MAP = {};
  const TOKENS_BY_SYMBOL_MAP = {};

  for (let j = 0; j < CHAIN_IDS.length; j++) {
    const chainId = CHAIN_IDS[j];
    TOKENS_MAP[chainId] = {};
    TOKENS_BY_SYMBOL_MAP[chainId] = {};
    for (let i = 0; i < TOKENS[chainId].length; i++) {
      const token = TOKENS[chainId][i];
      TOKENS_MAP[chainId][token.address] = token;
      TOKENS_BY_SYMBOL_MAP[chainId][token.symbol] = token;
    }
  }

  if (!TOKENS_MAP[chainId]) {
    throw new Error(`Incorrect chainId ${chainId}`);
  }
  const tokensMap = Object.keys(TOKENS_MAP[chainId]).reduce(
    (destination, key) => {
      destination[key.toLowerCase()] = TOKENS_MAP[chainId][key];
      return destination;
    },
    {}
  );

  if (!tokensMap[address]) {
    throw new Error(`Incorrect tokenId "${address}" for chainId ${chainId}`);
  }

  return tokensMap[address];
}

function getInfoTokens(tokens, vaultTokenInfo) {
  if (!tokens) {
    return;
  }

  const tokenMap = {};
  for (let i = 0; i < tokens.length; i++) {
    let token = JSON.parse(JSON.stringify(tokens[i]));
    const tokenInfo = getToken(CHAIN_ID, token.id);
    token = { ...token, ...tokenInfo };
    if (vaultTokenInfo) {
      const vaultPropsLength = 9;
      token.poolAmount = vaultTokenInfo[i * vaultPropsLength];
      token.minPrice = vaultTokenInfo[i * vaultPropsLength + 4];
      token.maxPrice = vaultTokenInfo[i * vaultPropsLength + 5];
    }

    token.availableAmount = bigNumberify(
      token.poolAmounts || bigNumberify(0)
    )?.sub(bigNumberify(token.reservedAmounts || 0));
    const availableUsd = token.minPrice
      ? bigNumberify(token.availableAmount || 0)
          ?.mul(token.minPrice)
          ?.div(expandDecimals(1, token.decimals))
      : bigNumberify(0);
    token.availableUsd = availableUsd;
    token.managedUsd = availableUsd?.add(token.guaranteedUsd);
    token.managedAmount = token.minPrice
      ? token.managedUsd
          .mul(expandDecimals(1, token.decimals))
          .div(token.minPrice)
      : bigNumberify(0);
    token.utilization = bigNumberify(token.poolAmounts).eq(0)
      ? bigNumberify(0)
      : bigNumberify(token.reservedAmounts)
          .mul(FUNDING_RATE_PRECISION)
          .div(token.poolAmounts);
    token.utilizationUsd = bigNumberify(token.guaranteedUsd);
    token.info = tokenInfo;
    tokenMap[token.symbol] = token;
  }
  const info = [];
  for (let i = 0; i < TOKEN_SYMBOLS.length; i++) {
    const symbol = TOKEN_SYMBOLS[i];
    info.push(tokenMap[symbol]);
  }

  return { infoTokens: info.filter(Boolean), tokenMap };
}

function getTokenStats(tokens) {
  if (!tokens) {
    return {};
  }

  const stats = {
    aum: bigNumberify(0),
    ndol: bigNumberify(0),
    longUtilizationUsd: bigNumberify(0),
    shortUtilizationUsd: bigNumberify(0),
  };

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    stats.aum = stats.aum.add(token.managedUsd);
    stats.ndol = stats.ndol.add(token.ndolAmounts);
    stats.longUtilizationUsd = stats.longUtilizationUsd.add(
      token.utilizationUsd
    );
  }

  return stats;
}

function getVolumeInfo(dailyVolume) {
  if (!dailyVolume || dailyVolume.length === 0) {
    return {};
  }

  const timestamp = dailyVolume[0].data.timestamp;

  const info = {};
  let totalVolume = bigNumberify(0);
  for (let i = 0; i < dailyVolume.length; i++) {
    const item = dailyVolume[i].data;
    if (item.timestamp !== timestamp) {
      break;
    }

    if (!info[item.token]) {
      info[item.token] = bigNumberify(0);
    }

    info[item.token] = info[item.token].add(item.volume);
    totalVolume = totalVolume.add(item.volume);
  }

  info.totalVolume = totalVolume;

  return info;
}

function getDailyVolumes(dailyVolume) {
  if (!dailyVolume || dailyVolume.length === 0) {
    return {};
  }

  let volumes = [];

  let info;
  for (let i = 0; i < dailyVolume.length; i++) {
    const item = dailyVolume[i].data;
    if (!info || item.timestamp !== info.timestamp) {
      if (info) {
        volumes.push(info);
      }

      info = {
        timestamp: item.timestamp,
        volume: bigNumberify(0),
      };
    }

    info.volume = info.volume.add(item.volume);
  }

  if (info.volume.gt(0)) {
    volumes.push(info);
  }

  let weeklyTotalVolume = bigNumberify(0);
  for (let i = 0; i < volumes.length; i++) {
    weeklyTotalVolume = weeklyTotalVolume.add(volumes[i].volume);
  }

  volumes = volumes.slice(0, 7);

  return { volumes, weeklyTotalVolume };
}

function getTotalVolume(volumes) {
  if (!volumes || volumes.length === 0) {
    return;
  }

  let volume = bigNumberify(0);
  for (let i = 0; i < volumes.length; i++) {
    volume = volume.add(volumes[i].data.volume);
  }

  return volume;
}

function getVolumeSummary(volumes) {
  if (!volumes || volumes.length === 0) {
    return {};
  }

  const info = {};
  for (let i = 0; i < volumes.length; i++) {
    const { action, token, volume } = volumes[i].data;
    const tokenInfo = getToken(CHAIN_ID, token);
    if (!tokenInfo) {
      continue;
    }
    if (!info[action]) {
      info[action] = {};
    }
    if (!info[action][token]) {
      info[action][token] = {
        symbol: tokenInfo.symbol,
        action: action,
        volume: bigNumberify(0),
      };
    }
    info[action][token].volume = info[action][token].volume.add(volume);
  }

  return info;
}

function printVolumeSummary(summary) {
  const lines = [];
  for (const [action, item0] of Object.entries(summary)) {
    lines.push("\n" + action);
    // eslint-disable-next-line
    for (const [address, item1] of Object.entries(item0)) {
      if (item1.volume.eq(0)) {
        continue;
      }
      lines.push(
        `${item1.symbol}: ${formatAmount(
          item1.volume,
          USD_DECIMALS,
          0,
          true
        )} USD`
      );
    }
  }
  console.info(lines.join("\n"));
}

function getFeeData(fees) {
  if (!fees) {
    return;
  }

  const data = [];
  for (let i = 0; i < TOKEN_SYMBOLS.length; i++) {
    const symbol = TOKEN_SYMBOLS[i];
    const fee = fees[i];
    data.push({ symbol, fee });
  }

  return data;
}

const GET_COLLATERALS = gql`
  query getCollaterals {
    collaterals {
      id
      feeReserves
      guaranteedUsd
      ndolAmounts
      reservedAmounts
      poolAmounts
      cumulativeFundingRate
      lastFundingTime
      utilisationRate
      longLiquidations
      shortLiquidations
      longs
      shorts
      longOpenInterest
      shortOpenInterest
    }
  }
`;

export default function Data() {
  // const tokensUrl = "https://gambit-server-staging.uc.r.appspot.com/tokens";
  // const { data: tokens, mutate: updateTokens } = useSWR([tokensUrl], {
  //   fetcher: (...args) => fetch(...args).then((res) => res.json()),
  // });
  const { connector, activate, active, account, library, chainId } =
    useWeb3React();

  const readerAddress = getContract(CHAIN_ID, "Reader");
  const vaultAddress = getContract(CHAIN_ID, "Vault");
  const ndolAddress = getContract(CHAIN_ID, "NDOL");
  const NATIVE_TOKEN_ADDRESS = getContract(CHAIN_ID, "NATIVE_TOKEN");
  const { data: ndolSupply, mutate: updateUsdgSupply } = useSWR(
    [false, ndolAddress, "totalSupply"],
    {
      fetcher: fetcher(library, NDOL),
    }
  );
  const whitelistedTokens = TOKEN_SYMBOLS.map((symbol) =>
    symbol === "ETH"
      ? getContract(CHAIN_ID, "NATIVE_TOKEN")
      : getTokenBySymbol(CHAIN_ID, symbol).address
  );

  const { data: vaultTokenInfo, mutate: updateVaultTokenInfo } = useSWR(
    [active, readerAddress, "getVaultTokenInfo"],
    {
      fetcher: fetcher(library, Reader, [
        vaultAddress,
        NATIVE_TOKEN_ADDRESS,
        expandDecimals(1, 18),
        whitelistedTokens,
      ]),
    }
  );
  const {
    loading,
    error,
    data: collateralsData,
    refetch,
    fetchMore,
  } = useQuery(GET_COLLATERALS, {
    variables: {},
  });

  if (loading)
    return (
      <div className="flex w-full justify-center">
        <p>Loading...</p>
      </div>
    );
  if (error) return <p>{JSON.stringify(error)}</p>;
  const tokens = collateralsData.collaterals;
  const infoTokensData = getInfoTokens(tokens, vaultTokenInfo);
  let infoTokens;
  let tokenMap;
  if (infoTokensData) {
    infoTokens = infoTokensData.infoTokens;
    tokenMap = infoTokensData.tokenMap;
  }
  const tokenStats = getTokenStats(infoTokens);
  // const volumeInfo = getVolumeInfo(dailyVolume);
  // const { volumes: dailyVolumes } = getDailyVolumes(dailyVolume);
  // const totalVolumeSum = getTotalVolume(totalVolume);

  // const dailyVolumeUrl =
  //   "https://gambit-server-staging.uc.r.appspot.com/daily_volume";
  // const { data: dailyVolume, mutate: updateDailyVolume } = useSWR(
  //   [dailyVolumeUrl],
  //   {
  //     fetcher: (...args) => fetch(...args).then((res) => res.json()),
  //   }
  // );

  // const totalVolumeUrl =
  //   "https://gambit-server-staging.uc.r.appspot.com/total_volume";
  // const { data: totalVolume, mutate: updateTotalVolume } = useSWR(
  //   [totalVolumeUrl],
  //   {
  //     fetcher: (...args) => fetch(...args).then((res) => res.json()),
  //   }
  // );

  const showNDOLAmount = true;

  // useEffect(() => {
  //   const interval = setInterval(() => {
  //     updatePositionStats(undefined, true);
  //     updateDailyVolume(undefined, true);
  //     updateTotalVolume(undefined, true);
  //     updateUsdgSupply(undefined, true);
  //     updateFees(undefined, true);
  //   }, 60 * 1000);
  //   return () => clearInterval(interval);
  // }, [
  //   updatePositionStats,
  //   updateDailyVolume,
  //   updateTotalVolume,
  //   updateUsdgSupply,
  //   updateFees,
  // ]);

  let feeText;
  let totalFeesUsd = bigNumberify(0);
  let totalLongPositionSizes = bigNumberify(0);
  let totalShortPositionSizes = bigNumberify(0);
  if (infoTokens && infoTokens.length > 0) {
    feeText = infoTokens
      .map(
        (token) =>
          `${formatAmount(token.feeReserves, token.decimals, 8, true)} ${
            token.symbol
          }`
      )
      .join(", ");

    for (let i = 0; i < infoTokens.length; i++) {
      const token = infoTokens[i];
      const info = tokenMap ? tokenMap[token.symbol] : undefined;
      if (!info) {
        continue;
      }
      const feeUsd = info.minPrice
        ? bigNumberify(token.feeReserves)
            .mul(info.minPrice)
            ?.mul(expandDecimals(1, 30 - token.decimals))
            ?.div(expandDecimals(1, 30))
        : bigNumberify(0);
      totalFeesUsd = totalFeesUsd.add(feeUsd);

      totalLongPositionSizes = totalLongPositionSizes.add(
        token.longOpenInterest
      );
      totalShortPositionSizes = totalShortPositionSizes.add(
        token.shortOpenInterest
      );
    }
  }

  const hourValue = parseInt(
    (new Date() - new Date().setUTCHours(0, 0, 0, 0)) / (60 * 60 * 1000)
  );
  const minuteValue = parseInt(
    (new Date() - new Date().setUTCHours(0, 0, 0, 0)) / (60 * 1000)
  );
  let volumeLabel = hourValue > 0 ? `${hourValue}h` : `${minuteValue}m`;

  const shouldPrintExtraInfo = false;
  // if (shouldPrintExtraInfo) {
  //   const volumeSummary = getVolumeSummary(totalVolume);
  //   printVolumeSummary(volumeSummary);
  // }

  return (
    <div className="Data Page">
      <div className="Dashboard-title App-hero">
        <div className="Dashboard-title-primary App-hero-primary">
          ${formatAmount(tokenStats.aum, USD_DECIMALS, 0, true)}
        </div>
        <div className="Dashboard-title-secondary">Assets Under Management</div>
      </div>
      {feeText && (
        <div className="Dashboard-fee-info">
          {"Total fees earned: "}
          {formatAmount(totalFeesUsd, USD_DECIMALS, 2, true)} USD
          <br />
          Fee assets: {feeText}
        </div>
      )}
      <div className="Dashboard-note">
        Long positions:{" "}
        {formatAmount(totalLongPositionSizes, USD_DECIMALS, 2, true)} USD, Short
        positions:{" "}
        {formatAmount(totalShortPositionSizes, USD_DECIMALS, 2, true)} USD
        {/* {volumeLabel} volume:{" "}
        {formatAmount(volumeInfo.totalVolume, USD_DECIMALS, 2, true)} USD */}
      </div>
      <div className="Dashboard-token-list-container">
        <div className="Dashboard-token-list Dashboard-list">
          <div className="border Dashboard-token-card ndol App-card primary">
            <div className="Dashboard-token-title App-card-title">
              <div className="Dashboard-token-title-text">NDOL</div>
              <div className="Dashboard-token-title-options flex items-center">
                <img
                  src={metamaskImg}
                  alt="MetaMask"
                  onClick={() =>
                    addToken({
                      address: "0x85E76cbf4893c1fbcB34dCF1239A91CE2A4CF5a7",
                      symbol: "NDOL",
                      info: {
                        decimals: 18,
                        imageUrl: "https://assets.necc.io/ndol token.svg",
                      },
                    })
                  }
                />
                <a
                  href="https://www.coingecko.com/en/coins/ndol"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <img src={coingeckoImg} alt="CoinGecko" />
                </a>
                <a
                  href="https://explorer.mainnet.aurora.dev/token/0xNDOL"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <img
                    src="https://doc.aurora.dev/_img/favicon.svg"
                    alt="AuroraScan"
                  />
                </a>
              </div>
              <div className="label">Supply</div>
              <div>{formatAmount(ndolSupply, 18, 0, true)} NDOL</div>
            </div>
          </div>
          {infoTokens &&
            infoTokens.map((token) => (
              <div
                className="border Dashboard-token-card App-card"
                key={token.address}
              >
                <div className="Dashboard-token-title App-card-title">
                  <div className="Dashboard-token-title-text">
                    {token.symbol}
                  </div>
                  <div className="Dashboard-token-title-options flex items-center">
                    <img
                      src={metamaskImg}
                      alt="MetaMask"
                      onClick={() => addToken(token)}
                    />
                    <a
                      href={token.info.coingeckoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <img src={coingeckoImg} alt="CoinGecko" />
                    </a>
                    <a
                      href={getTokenUrl(CHAIN_ID, token.address)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <img
                        src={"https://doc.aurora.dev/_img/favicon.svg"}
                        alt="AuroraScan"
                      />
                    </a>
                  </div>
                </div>
                <div className="Dashboard-token-card-bottom App-card-content">
                  <div className="Dashboard-token-info App-card-row">
                    <div className="label">Pool</div>
                    <div>
                      {formatAmount(
                        token.managedAmount,
                        token.decimals,
                        8,
                        true
                      )}{" "}
                      {token.symbol} ($
                      {formatAmount(token.managedUsd, USD_DECIMALS, 0, true)})
                    </div>
                  </div>
                  <div className="Dashboard-token-info App-card-row">
                    <div className="label">Reserved</div>
                    <div>
                      {formatAmount(
                        token.reservedAmounts,
                        token.decimals,
                        4,
                        true
                      )}
                    </div>
                  </div>
                  {showNDOLAmount && (
                    <div className="Dashboard-token-info App-card-row">
                      <div className="label">NDOL Minted</div>
                      <div>
                        {formatAmount(token.ndolAmounts, 18, 0, true)} USD
                      </div>
                    </div>
                  )}
                  <div className="App-card-row">
                    <div className="label">Utilization</div>
                    <div>{formatAmount(token.utilization, 4, 2, true)}%</div>
                  </div>
                  <hr />
                  {/* <div className="App-card-row">
                        <div className="label">{volumeLabel} Volume</div>
                        <div>
                          {formatAmount(
                            volumeInfo[token.address] || bigNumberify(0),
                            USD_DECIMALS,
                            2,
                            true
                          )}{" "}
                          USD
                        </div>
                      </div> */}

                  <div className="App-card-row">
                    <div className="label">Cumulative Funding Rate</div>
                    <div>
                      {formatAmount(token.cumulativeFundingRate, 4, 4, true)}%
                    </div>
                  </div>
                  <div className="App-card-row">
                    <div className="label">Last Funding</div>
                    <div>{formatDateTime(token.lastFundingTime)}</div>
                  </div>
                  <hr />
                  <div className="App-card-row">
                    <div className="label">Long Open Interest</div>
                    <div>
                      {formatAmount(
                        token.longOpenInterest,
                        USD_DECIMALS,
                        2,
                        true
                      )}{" "}
                      USD
                    </div>
                  </div>
                  <div className="App-card-row">
                    <div className="label">Short Open Interest</div>
                    <div>
                      {formatAmount(
                        token.shortOpenInterest,
                        USD_DECIMALS,
                        2,
                        true
                      )}{" "}
                      USD
                    </div>
                  </div>
                  <div className="App-card-row">
                    <div className="label">Long Liquidations</div>
                    <div>
                      {formatAmount(
                        token.longLiquidations,
                        token.decimals,
                        0,
                        true
                      )}
                    </div>
                  </div>
                  <div className="App-card-row">
                    <div className="label">Short Liquidations</div>
                    <div>
                      {formatAmount(
                        token.shortLiquidations,
                        token.decimals,
                        0,
                        true
                      )}
                    </div>
                  </div>
                  <div className="App-card-row">
                    <div className="label">Longs</div>
                    <div>{token.longs}</div>
                  </div>
                  <div className="App-card-row">
                    <div className="label">Shorts</div>
                    <div>{token.shorts}</div>
                  </div>
                </div>
              </div>
            ))}
          {/* {dailyVolumes && dailyVolumes.length > 0 && (
            <div>
              <div className="App-hero">
                <div className="Dashboard-volumes-header App-hero-primary">
                  ${formatAmount(totalVolumeSum, USD_DECIMALS, 0, true)}
                </div>
                <div className="Dashboard-title-secondary">
                  Total Volume Since 28 April 2021
                </div>
              </div>
              <div className="Dashboard-volume-list Dashboard-list">
                {dailyVolumes.map((volume, index) => (
                  <div
                    className={cx("App-card", { primary: index === 0 })}
                    key={volume.timestamp}
                  >
                    <div
                      className={cx("Dashboard-token-title", "App-card-title")}
                    >
                      {formatDate(volume.timestamp)}
                    </div>
                    <div className="Dashboard-token-card-bottom App-card-content">
                      <div className="Dashboard-token-info App-card-row">
                        <div className="label">Volume</div>
                        <div>
                          {formatAmount(volume.volume, USD_DECIMALS, 2, true)}{" "}
                          USD
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )} */}
        </div>
        <Footer />
      </div>
    </div>
  );
}
