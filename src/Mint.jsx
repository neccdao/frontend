import React, { useEffect, useState } from "react";

import { toast } from "react-toastify";
import { useWeb3React } from "@web3-react/core";
import cx from "classnames";
import useSWR from "swr";
import { ethers } from "ethers";

import {
  USD_DECIMALS,
  CHAIN_ID,
  NDOL_ADDRESS,
  getConnectWalletHandler,
  useEagerConnect,
  useInactiveListener,
  fetcher,
  expandDecimals,
  bigNumberify,
  usePrevious,
  getExplorerUrl,
  useLocalStorageSerializeKey,
} from "./Helpers";

import { getContract } from "./Addresses";
import {
  getTokens,
  getWhitelistedTokens,
  getTokenBySymbol,
} from "./data/Tokens";

import ReaderFacet from "./abis/ReaderFacet.json";
import VaultNDOLFacet from "./abis/VaultNDOLFacet.json";

import ExchangeWalletTokens from "./components/Exchange/ExchangeWalletTokens";
import Footer from "./Footer";

import "./css/Exchange.css";
import { MintBox } from "./components/Exchange/MintBox";

const NATIVE_TOKEN_ADDRESS = getContract(CHAIN_ID, "NATIVE_TOKEN");

const { AddressZero } = ethers.constants;

function getInfoTokens(
  tokens,
  tokenBalances,
  whitelistedTokens,
  vaultTokenInfo
) {
  const vaultPropsLength = 9;
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

    if (infoTokens[token.address]) {
      token.balance = infoTokens[token.address].balance;
    }

    infoTokens[token.address] = token;
  }

  return infoTokens;
}

export default function Mint() {
  const tokens = getTokens(CHAIN_ID);
  const whitelistedTokens = getWhitelistedTokens(CHAIN_ID);
  const [pendingTxns, setPendingTxns] = useState([]);

  const [tokenSelection, setTokenSelection] = useLocalStorageSerializeKey(
    [CHAIN_ID, "Mint-token-selection"],
    {
      ["Mint"]: {
        from: getTokenBySymbol(CHAIN_ID, "ETH").address,
        to: getTokenBySymbol(CHAIN_ID, "NDOL").address,
      },
      ["Burn"]: {
        from: getTokenBySymbol(CHAIN_ID, "NDOL").address,
        to: getTokenBySymbol(CHAIN_ID, "ETH").address,
      },
      ["Stake"]: {
        from: getTokenBySymbol(CHAIN_ID, "NDOL").address,
        to: getTokenBySymbol(CHAIN_ID, "NDOL").address,
      },
    }
  );

  const [swapOption, setSwapOption] = useLocalStorageSerializeKey(
    [CHAIN_ID, "Mint-option"],
    "Mint"
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
  const ndolAddress = getContract(CHAIN_ID, "NDOL");
  const mintFarmAddress = getContract(CHAIN_ID, "MintFarm");

  const prevAccount = usePrevious(account);
  useEffect(() => {
    if (prevAccount !== account) {
      setPendingTxns([]);
    }
  }, [prevAccount, account]);

  const whitelistedTokenAddresses = whitelistedTokens.map(({ address }) => {
    return address;
  });

  const { data: vaultTokenInfo, mutate: updateVaultTokenInfo } = useSWR(
    [active, readerAddress, "getVaultTokenInfo"],
    {
      fetcher: fetcher(library, ReaderFacet, [
        readerAddress,
        NATIVE_TOKEN_ADDRESS,
        expandDecimals(1, 18),
        whitelistedTokenAddresses,
      ]),
    }
  );

  const tokenAddresses = tokens.map((token) => token.address);
  const { data: tokenBalances, mutate: updateTokenBalances } = useSWR(
    [active, readerAddress, "getTokenBalances"],
    {
      fetcher: fetcher(library, ReaderFacet, [account, tokenAddresses]),
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
      });
      return () => {
        library.removeAllListeners("block");
      };
    }
  }, [active, library, updateVaultTokenInfo, updateTokenBalances]);

  const infoTokens = getInfoTokens(
    tokens,
    tokenBalances,
    whitelistedTokens,
    vaultTokenInfo
  );

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
        <MintBox
          flagOrdersEnabled={flagOrdersEnabled}
          chainId={chainId}
          infoTokens={infoTokens}
          active={active}
          connectWallet={connectWallet}
          library={library}
          account={account}
          positionsMap={{}}
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

      <Footer />
    </div>
  );
}
