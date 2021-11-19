import React, { useEffect, useState } from "react";

import { toast } from "react-toastify";
import { useWeb3React } from "@web3-react/core";
import cx from "classnames";
import useSWR from "swr";
import { ethers } from "ethers";

import {
  BASIS_POINTS_DIVISOR,
  USD_DECIMALS,
  CHAIN_ID,
  getTokenInfo,
  SWAP,
  LONG,
  SHORT,
  NDOL_ADDRESS,
  getConnectWalletHandler,
  useEagerConnect,
  useInactiveListener,
  fetcher,
  formatAmount,
  expandDecimals,
  bigNumberify,
  usePrevious,
  getExplorerUrl,
  getPositionKey,
  getUsd,
  getLiquidationPrice,
  getLeverage,
  useLocalStorageSerializeKey,
  getGasLimit,
  parseValue,
  formatAmountFree,
} from "./Helpers";

import { getContract } from "./Addresses";
import {
  getTokens,
  getWhitelistedTokens,
  getTokenBySymbol,
} from "./data/Tokens";

import Reader from "./abis/Reader.json";
import Vault from "./abis/Vault.json";
// import Necc from "./abis/Necc.json";
// import TimeDistributor from "./abis/TimeDistributor.json";
// import DeltaYieldTracker from "./abis/DeltaYieldTracker.json";

import SwapBox from "./components/Exchange/SwapBox";
import ExchangeTVChart from "./components/Exchange/ExchangeTVChart";
import PositionSeller from "./components/Exchange/PositionSeller";
import OrdersList from "./components/Exchange/OrdersList";
import History from "./components/Exchange/History";
import PositionEditor from "./components/Exchange/PositionEditor";
import ExchangeWalletTokens from "./components/Exchange/ExchangeWalletTokens";
import Tab from "./components/Tab/Tab";
import Footer from "./Footer";

import "./css/Exchange.css";
import LPs from "./components/Exchange/LPs";

const NATIVE_TOKEN_ADDRESS = getContract(CHAIN_ID, "NATIVE_TOKEN");

const { AddressZero } = ethers.constants;

const getTokenAddress = (token) => {
  if (token.address === AddressZero) {
    return NATIVE_TOKEN_ADDRESS;
  }
  return token.address;
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
      hasRealisedProfit: positionData[i * propsLength + 4]?.eq(1),
      realisedPnl: positionData[i * propsLength + 5],
      hasProfit: positionData[i * propsLength + 7]?.eq(1),
      delta: positionData[i * propsLength + 8],
      markPrice: isLong[i] ? indexToken.minPrice : indexToken.maxPrice,
    };

    if (position.collateral?.gt(0)) {
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

    if (position.size?.gt(0)) {
      positions.push(position);
    }
  }

  return { positions, positionsMap };
}

function getPositionQuery(tokens) {
  const collateralTokens = [];
  const indexTokens = [];
  const isLong = [];

  for (let i = 0; i < tokens.length; i++) {
    const collateralToken = tokens[i];

    for (let j = 0; j < tokens.length; j++) {
      const indexToken = tokens[j];

      collateralTokens.push(collateralToken.address);
      indexTokens.push(indexToken?.address);
      isLong.push(true);

      collateralTokens.push(collateralToken.address);
      indexTokens.push(indexToken?.address);
      isLong.push(false);
    }
  }

  return { collateralTokens, indexTokens, isLong };
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
      // TODO hack for testnet, remove it
      token.availableAmount = (token.poolAmount || bigNumberify(0)).sub(
        token.reservedAmount || 0
      );
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
      token.balance = infoTokens[token.address]?.balance;
    }

    infoTokens[token.address] = token;
  }

  return infoTokens;
}

function PositionsList(props) {
  const {
    positions,
    positionsMap,
    infoTokens,
    active,
    account,
    library,
    pendingTxns,
    setPendingTxns,
    flagOrdersEnabled,
  } = props;
  const [positionToEditKey, setPositionToEditKey] = useState(undefined);
  const [positionToSellKey, setPositionToSellKey] = useState(undefined);
  const [isPositionEditorVisible, setIsPositionEditorVisible] =
    useState(undefined);
  const [isPositionSellerVisible, setIsPositionSellerVisible] =
    useState(undefined);
  const [collateralTokenAddress, setCollateralTokenAddress] =
    useState(undefined);

  const editPosition = (position) => {
    setCollateralTokenAddress(position.collateralToken.address);
    setPositionToEditKey(position.key);
    setIsPositionEditorVisible(true);
  };

  const sellPosition = (position) => {
    setPositionToSellKey(position.key);
    setIsPositionSellerVisible(true);
  };

  return (
    <div>
      <PositionEditor
        positionsMap={positionsMap}
        positionKey={positionToEditKey}
        isVisible={isPositionEditorVisible}
        setIsVisible={setIsPositionEditorVisible}
        infoTokens={infoTokens}
        active={active}
        account={account}
        library={library}
        collateralTokenAddress={collateralTokenAddress}
        pendingTxns={pendingTxns}
        setPendingTxns={setPendingTxns}
        getLiquidationPrice={getLiquidationPrice}
        getUsd={getUsd}
        getLeverage={getLeverage}
      />
      <PositionSeller
        positionsMap={positionsMap}
        positionKey={positionToSellKey}
        isVisible={isPositionSellerVisible}
        setIsVisible={setIsPositionSellerVisible}
        infoTokens={infoTokens}
        active={active}
        account={account}
        library={library}
        pendingTxns={pendingTxns}
        setPendingTxns={setPendingTxns}
        flagOrdersEnabled={flagOrdersEnabled}
      />

      <table className="Exchange-positions">
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
            <th></th>
            <th></th>
          </tr>
          {positions.length === 0 && (
            <tr>
              <td>No open positions</td>
              <td></td>
              <td></td>
              <td></td>
              <td className="Exchange-positions-extra-info"></td>
              <td className="Exchange-positions-extra-info"></td>
              <td className="Exchange-positions-extra-info"></td>
              <td></td>
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
                <td>
                  <button
                    className="Exchange-positions-action--edit"
                    onClick={() => editPosition(position)}
                  >
                    Edit
                  </button>
                </td>
                <td>
                  <button
                    className="Exchange-positions-action--close"
                    onClick={() => sellPosition(position)}
                  >
                    Close
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function Exchange() {
  const tokens = getTokens(CHAIN_ID);
  const whitelistedTokens = getWhitelistedTokens(CHAIN_ID);
  const positionQuery = getPositionQuery(whitelistedTokens);
  const [pendingTxns, setPendingTxns] = useState([]);

  const CHART_TV = "TradingView";
  const [chartType] = useLocalStorageSerializeKey(
    [CHAIN_ID, "chartType"],
    CHART_TV
  );

  const [tokenSelection, setTokenSelection] = useLocalStorageSerializeKey(
    [CHAIN_ID, "Exchange-token-selection"],
    {
      [LONG]: {
        from: getTokenBySymbol(CHAIN_ID, "ETH").address,
        to: getTokenBySymbol(CHAIN_ID, "ETH").address,
      },
      [SHORT]: {
        from: getTokenBySymbol(CHAIN_ID, "ETH").address,
        to: getTokenBySymbol(CHAIN_ID, "ETH").address,
      },
    }
  );

  const [swapOption, setSwapOption] = useLocalStorageSerializeKey(
    [CHAIN_ID, "Swap-option"],
    LONG
  );

  const [fromTokenAddress, setFromTokenAddress] = useState(
    tokenSelection[swapOption].from
  );
  const [toTokenAddress, setToTokenAddress] = useState(
    tokenSelection[swapOption].to
  );

  const [isConfirming, setIsConfirming] = useState(false);
  const [isPendingConfirmation, setIsPendingConfirmation] = useState(false);

  const { connector, activate, active, account, library, chainId } =
    useWeb3React();
  const [activatingConnector, setActivatingConnector] = useState();
  useEffect(() => {
    if (activatingConnector && activatingConnector === connector) {
      setActivatingConnector(undefined);
    }
  }, [activatingConnector, connector]);
  const triedEager = useEagerConnect();
  useInactiveListener(!triedEager || !!activatingConnector);
  const connectWallet = getConnectWalletHandler(activate);

  const vaultAddress = getContract(CHAIN_ID, "Vault");
  const readerAddress = getContract(CHAIN_ID, "Reader");
  // const neccAddress = getContract(CHAIN_ID, "Necc");

  const prevAccount = usePrevious(account);
  useEffect(() => {
    if (prevAccount !== account) {
      setPendingTxns([]);
    }
  }, [prevAccount, account]);

  const whitelistedTokenAddresses = whitelistedTokens.map(
    (token) => token.address
  );
  const { data: vaultTokenInfo, mutate: updateVaultTokenInfo } = useSWR(
    [active, readerAddress, "getVaultTokenInfo"],
    {
      fetcher: fetcher(library, Reader, [
        vaultAddress,
        NATIVE_TOKEN_ADDRESS,
        expandDecimals(1, 18),
        whitelistedTokenAddresses,
      ]),
    }
  );

  const tokenAddresses = tokens.map((token) => token.address);
  const { data: tokenBalances, mutate: updateTokenBalances } = useSWR(
    [active, readerAddress, "getTokenBalances", account],
    {
      fetcher: fetcher(library, Reader, [tokenAddresses]),
    }
  );
  const { data: positionData, mutate: updatePositionData } = useSWR(
    [active, readerAddress, "getPositions", vaultAddress, account],
    {
      fetcher: fetcher(library, Reader, [
        positionQuery.collateralTokens,
        positionQuery.indexTokens,
        positionQuery.isLong,
      ]),
    }
  );

  const { data: fundingRateInfo, mutate: updateFundingRateInfo } = useSWR(
    [active, readerAddress, "getFundingRates"],
    {
      fetcher: fetcher(library, Reader, [
        vaultAddress,
        NATIVE_TOKEN_ADDRESS,
        whitelistedTokenAddresses,
      ]),
    }
  );

  useEffect(() => {
    const checkPendingTxns = async () => {
      const updatedPendingTxns = [];
      for (let i = 0; i < pendingTxns.length; i++) {
        const pendingTxn = pendingTxns[i];
        const receipt = await library.getTransactionReceipt(pendingTxn.hash);
        if (receipt) {
          if (receipt.status === 0) {
            const txUrl = getExplorerUrl(CHAIN_ID) + "tx/" + pendingTxn.hash;
            toast.error(
              <div>
                Txn failed.{" "}
                <a href={txUrl} target="_blank" rel="noopener noreferrer">
                  View
                </a>
                <br />
              </div>
            );
          }
          if (receipt.status === 1 && pendingTxn.message) {
            const txUrl = getExplorerUrl(CHAIN_ID) + "tx/" + pendingTxn.hash;
            toast.success(
              <div>
                {pendingTxn.message}.{" "}
                <a href={txUrl} target="_blank" rel="noopener noreferrer">
                  View
                </a>
                <br />
              </div>
            );
          }
          continue;
        }
        updatedPendingTxns.push(pendingTxn);
      }

      if (updatedPendingTxns.length !== pendingTxns.length) {
        setPendingTxns(updatedPendingTxns);
      }
    };

    const interval = setInterval(() => {
      checkPendingTxns();
    }, 2 * 1000);
    return () => clearInterval(interval);
  }, [library, pendingTxns]);

  useEffect(() => {
    if (active) {
      library.on("block", () => {
        updateVaultTokenInfo(undefined, true);
        updateTokenBalances(undefined, true);
        updatePositionData(undefined, true);
        updateFundingRateInfo(undefined, true);
      });
      return () => {
        library.removeAllListeners("block");
      };
    }
  }, [
    active,
    library,
    updateVaultTokenInfo,
    updateTokenBalances,
    updatePositionData,
    updateFundingRateInfo,
  ]);

  const infoTokens = getInfoTokens(
    tokens,
    tokenBalances,
    whitelistedTokens,
    vaultTokenInfo,
    fundingRateInfo
  );
  const { positions, positionsMap } = getPositions(
    positionQuery,
    positionData,
    infoTokens
  );

  const [flagOrdersEnabled] = useLocalStorageSerializeKey(
    [CHAIN_ID, "Flag-orders-enabled"],
    document.location.hostname === "localhost"
  );
  const LIST_SECTIONS = [
    "Positions",
    "LPs",
    "History",
    // TODO: Uncomment when limit orders are deployed
    // flagOrdersEnabled ? "Open Orders" : undefined,
  ].filter(Boolean);
  let [listSection, setListSection] = useLocalStorageSerializeKey(
    [CHAIN_ID, "List-section"],
    LIST_SECTIONS[0]
  );
  if (!LIST_SECTIONS.includes(listSection)) {
    listSection = LIST_SECTIONS[0];
  }

  const getListSection = () => {
    if (!account) return null;
    return (
      <div>
        <Tab
          options={LIST_SECTIONS}
          option={listSection}
          onChange={(section) => setListSection(section)}
          type="inline"
          className="Exchange-list-tabs"
        />
        {listSection === "Positions" && (
          <PositionsList
            positions={positions}
            positionsMap={positionsMap}
            infoTokens={infoTokens}
            active={active}
            account={account}
            library={library}
            pendingTxns={pendingTxns}
            setPendingTxns={setPendingTxns}
          />
        )}
        {listSection === "LPs" && (
          <LPs
            account={account}
            infoTokens={infoTokens}
            getTokenInfo={getTokenInfo}
          />
        )}
        {listSection === "Open Orders" && (
          <OrdersList
            active={active}
            library={library}
            account={account}
            pendingTxns={pendingTxns}
            setPendingTxns={setPendingTxns}
            infoTokens={infoTokens}
          />
        )}
        {listSection === "History" && (
          <History
            account={account}
            infoTokens={infoTokens}
            getTokenInfo={getTokenInfo}
          />
        )}
      </div>
    );
  };

  const onSelectWalletToken = (token) => {
    setFromTokenAddress(token.address);
  };

  const renderChart = () => {
    if (chartType === CHART_TV) {
      return (
        <ExchangeTVChart
          fromTokenAddress={fromTokenAddress}
          toTokenAddress={toTokenAddress}
          infoTokens={infoTokens}
          swapOption={swapOption}
        />
      );
    }
  };

  return (
    <div className="Exchange px-4">
      <div className="">
        <div className="flex items-center justify-center ">
          <SwapBox
            flagOrdersEnabled={flagOrdersEnabled}
            chainId={chainId}
            infoTokens={infoTokens}
            active={active}
            connectWallet={connectWallet}
            library={library}
            account={account}
            positionsMap={positionsMap}
            fromTokenAddress={fromTokenAddress}
            setFromTokenAddress={setFromTokenAddress}
            toTokenAddress={toTokenAddress}
            setToTokenAddress={setToTokenAddress}
            swapOption={swapOption}
            setSwapOption={setSwapOption}
            pendingTxns={pendingTxns}
            setPendingTxns={setPendingTxns}
            tokenSelection={tokenSelection}
            setTokenSelection={setTokenSelection}
            isConfirming={isConfirming}
            setIsConfirming={setIsConfirming}
            isPendingConfirmation={isPendingConfirmation}
            setIsPendingConfirmation={setIsPendingConfirmation}
          />
          <div className="Exchange-wallet-tokens">
            <div className="Exchange-wallet-tokens-content border">
              <ExchangeWalletTokens
                tokens={tokens}
                infoTokens={infoTokens}
                onSelectToken={onSelectWalletToken}
              />
            </div>
          </div>
        </div>
      </div>
      <div className="mt-6 overflow-auto  md:flex md:justify-center">
        {/* {renderChart()} */}
        <div className="Exchange-lists">{getListSection()}</div>
      </div>

      <Footer />
    </div>
  );
}
