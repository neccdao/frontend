import React, { useEffect, useState } from "react";

import { toast } from "react-toastify";
import { useWeb3React } from "@web3-react/core";
import useSWR from "swr";
import { ethers } from "ethers";

import {
  CHAIN_ID,
  getConnectWalletHandler,
  useEagerConnect,
  useInactiveListener,
  fetcher,
  expandDecimals,
  usePrevious,
  getExplorerUrl,
  useLocalStorageSerializeKey,
  NDOL_ADDRESS,
  USD_DECIMALS,
  bigNumberify,
} from "./Helpers";

import { getContract } from "./Addresses";
import {
  getTokens,
  getWhitelistedTokens,
  getTokenBySymbol,
} from "./data/Tokens";

import Reader from "./abis/Reader.json";
import Vault from "./abis/Vault.json";
import Footer from "./Footer";
import { ZapBox } from "./components/Exchange/ZapBox";

import "./css/Exchange.css";

const NATIVE_TOKEN_ADDRESS = getContract(CHAIN_ID, "NATIVE_TOKEN");

const { AddressZero } = ethers.constants;

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
    if (
      token.address === NDOL_ADDRESS ||
      token.address === getTokenBySymbol(CHAIN_ID, "nNDOL").address
    ) {
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
      token.balance = infoTokens[token.address].balance;
    }

    infoTokens[token.address] = token;
  }

  return infoTokens;
}

export default function Zap() {
  const tokens = getTokens(CHAIN_ID);
  const whitelistedTokens = getWhitelistedTokens(CHAIN_ID);
  const [pendingTxns, setPendingTxns] = useState([]);

  const [tokenSelection, setTokenSelection] = useLocalStorageSerializeKey(
    [CHAIN_ID, "Zap-token-selection"],
    {
      ["Deposit"]: {
        from: getTokenBySymbol(CHAIN_ID, "USDC").address,
        to: getTokenBySymbol(CHAIN_ID, "nNDOL").address,
      },
      ["Withdraw"]: {
        from: getTokenBySymbol(CHAIN_ID, "nNDOL").address,
        to: getTokenBySymbol(CHAIN_ID, "NDOL").address,
      },
    }
  );
  const tokenAddresses = tokens.map((token) => token.address);
  const whitelistedTokenAddresses = whitelistedTokens.map(
    (token) => token.address
  );
  const [swapOption, setSwapOption] = useLocalStorageSerializeKey(
    [CHAIN_ID, "Zap-option"],
    "Deposit"
  );

  const [fromTokenAddress, setFromTokenAddress] = useState(
    tokenSelection[swapOption]?.from
  );
  const [toTokenAddress, setToTokenAddress] = useState(
    tokenSelection[swapOption]?.to
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

  const prevAccount = usePrevious(account);
  useEffect(() => {
    if (prevAccount !== account) {
      setPendingTxns([]);
    }
  }, [prevAccount, account]);

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
  const { data: tokenBalances, mutate: updateTokenBalances } = useSWR(
    [active, readerAddress, "getTokenBalances", account],
    {
      fetcher: fetcher(library, Reader, [tokenAddresses]),
    }
  );

  const infoTokens = getInfoTokens(
    tokens,
    tokenBalances,
    whitelistedTokens,
    vaultTokenInfo,
    fundingRateInfo
  );

  const { data: maxNdol, mutate: updateMaxNdol } = useSWR(
    [active, vaultAddress, "getMaxNDOLAmount"],
    {
      fetcher: fetcher(library, Vault),
    }
  );

  let reducedMaxNdol;
  if (maxNdol) {
    reducedMaxNdol = maxNdol; // maxNdol.mul(99).div(100)
  }

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
        updateMaxNdol(undefined, true);
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
    updateMaxNdol,
  ]);

  const [flagOrdersEnabled] = useLocalStorageSerializeKey(
    [CHAIN_ID, "Flag-orders-enabled"],
    document.location.hostname === "localhost"
  );

  const onSelectWalletToken = (token) => {
    setFromTokenAddress(token.address);
  };

  return (
    <div className="Exchange">
      <div className="flex items-center justify-center h-screen">
        <ZapBox
          flagOrdersEnabled={flagOrdersEnabled}
          chainId={chainId}
          active={active}
          connectWallet={connectWallet}
          library={library}
          account={account}
          infoTokens={infoTokens}
          fromTokenAddress={fromTokenAddress}
          setFromTokenAddress={setFromTokenAddress}
          toTokenAddress={toTokenAddress}
          setToTokenAddress={setToTokenAddress}
          swapOption={swapOption}
          setSwapOption={setSwapOption}
          maxNdol={reducedMaxNdol}
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
            {/* <ExchangeWalletTokens
              tokens={tokens}
              mintingCap={maxNdol}
              infoTokens={infoTokens}
              onSelectToken={onSelectWalletToken}
            /> */}
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
