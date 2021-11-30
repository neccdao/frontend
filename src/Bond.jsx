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
  trim,
} from "./Helpers";

import { getContract } from "./Addresses";
import {
  getTokens,
  getWhitelistedTokens,
  getTokenBySymbol,
  getBondTokens,
} from "./data/Tokens";

import ReaderFacet from "./abis/ReaderFacet.json";
import BondDepositoryFacet from "./abis/BondDepositoryFacet.json";
import sNecc from "./abis/sNeccFacet.json";
import Staking from "./abis/StakingFacet.json";
import TreasuryFacet from "./abis/TreasuryFacet.json";
import BondingCalculatorFacet from "./abis/BondingCalculatorFacet.json";
import ExchangeWalletTokens from "./components/Exchange/ExchangeWalletTokens";
import Footer from "./Footer";

import "./css/Exchange.css";
import { BondBox } from "./components/Bond/BondBox";

const NATIVE_TOKEN_ADDRESS = getContract(CHAIN_ID, "NATIVE_TOKEN");

function getInfoTokens(
  tokens,
  tokenBalances,
  whitelistedTokens,
  vaultTokenInfo,
  fundingRateInfo,
  bondsInfo
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
    let token = JSON.parse(JSON.stringify(whitelistedTokens[i]));
    // if (vaultTokenInfo) {
    //   token.poolAmount = vaultTokenInfo[i * vaultPropsLength];
    //   token.reservedAmount = vaultTokenInfo[i * vaultPropsLength + 1];
    //   // TODO hack for testnet, remove it
    //   token.availableAmount = (token.poolAmount || bigNumberify(0)).sub(
    //     token.reservedAmount || 0
    //   );
    //   token.ndolAmount = vaultTokenInfo[i * vaultPropsLength + 2];
    //   token.redemptionAmount = vaultTokenInfo[i * vaultPropsLength + 3];
    //   if (token.address === NDOL_ADDRESS) {
    //     token.minPrice = expandDecimals(1, USD_DECIMALS);
    //     token.maxPrice = expandDecimals(1, USD_DECIMALS);
    //   } else {
    //     token.minPrice = vaultTokenInfo[i * vaultPropsLength + 4];
    //     token.maxPrice = vaultTokenInfo[i * vaultPropsLength + 5];
    //   }
    //   token.guaranteedUsd = vaultTokenInfo[i * vaultPropsLength + 6];
    // }

    const tokenBondsInfo = bondsInfo[token.symbol + "Bond"];
    if (tokenBondsInfo) {
      token = { ...token, ...tokenBondsInfo, isBond: true };
    } else {
      const tokenBondsInfo = bondsInfo[token.symbol + "Bond"];
      token = { ...token, ...tokenBondsInfo, isBond: true };
    }

    if (infoTokens[token.address]) {
      token.balance = infoTokens[token.address].balance;
    }

    infoTokens[token.address] = token;
  }

  return infoTokens;
}

export default function Bond() {
  const tokens = getTokens(CHAIN_ID);
  const bondTokens = getBondTokens(CHAIN_ID);
  const [pendingTxns, setPendingTxns] = useState([]);

  const [tokenSelection, setTokenSelection] = useLocalStorageSerializeKey(
    [CHAIN_ID, "Bond-token-selection"],
    {
      ["Bond"]: {
        from: getTokenBySymbol(CHAIN_ID, "NDOL").address,
        to: getTokenBySymbol(CHAIN_ID, "Necc").address,
      },
      ["Redeem"]: {
        from: getTokenBySymbol(CHAIN_ID, "NDOL").address,
        to: getTokenBySymbol(CHAIN_ID, "Necc").address,
      },
      ["Stake"]: {
        from: getTokenBySymbol(CHAIN_ID, "Necc").address,
        to: getTokenBySymbol(CHAIN_ID, "NDOL").address,
      },
    }
  );

  const [swapOption, setSwapOption] = useLocalStorageSerializeKey(
    [CHAIN_ID, "Bond-option"],
    "Bond"
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
  const ndolBondAddress = getContract(CHAIN_ID, "NDOLBond");
  const treasuryAddress = getContract(CHAIN_ID, "Treasury");
  const neccAddress = getContract(CHAIN_ID, "Necc");
  const sNeccAddress = getContract(CHAIN_ID, "sNecc");
  const stakingAddress = getContract(CHAIN_ID, "NeccStaking");
  const ndolAddress = getContract(CHAIN_ID, "NDOL");

  const prevAccount = usePrevious(account);
  useEffect(() => {
    if (prevAccount !== account) {
      setPendingTxns([]);
    }
  }, [prevAccount, account]);

  const bondTokenAddresses = bondTokens.map((token) => token.address);

  const tokenAddresses = tokens.map((token) => token.address);
  const { data: tokenBalances, mutate: updateTokenBalances } = useSWR(
    [active, readerAddress, "getTokenBalances", account],
    {
      fetcher: fetcher(library, ReaderFacet, [tokenAddresses]),
    }
  );

  const { data: ndolBondPrice, mutate: updateNDOLBondPrice } = useSWR(
    [
      active,
      ndolBondAddress,
      "bondPriceInUSD",
      fromTokenAddress == neccAddress ? ndolAddress : fromTokenAddress,
    ],
    {
      fetcher: fetcher(library, BondDepositoryFacet),
    }
  );

  const {
    data: ndolBondStandardizedDebtRatio,
    mutate: updateNDOLBondStandardizedDebtRatio,
  } = useSWR(
    [active, ndolBondAddress, "standardizedDebtRatio", fromTokenAddress],
    {
      fetcher: fetcher(library, BondDepositoryFacet),
    }
  );

  const { data: currentDebt, mutate: updateCurrentDebt } = useSWR(
    [active, ndolBondAddress, "currentDebt", fromTokenAddress],
    {
      fetcher: fetcher(library, BondDepositoryFacet),
    }
  );

  const { data: ndolBondMaxPayout, mutate: updateNDOLBondMaxPayout } = useSWR(
    [active, ndolBondAddress, "maxPayout", fromTokenAddress],
    {
      fetcher: fetcher(library, BondDepositoryFacet),
    }
  );

  const {
    data: ndolBondPendingPayoutFor,
    mutate: updateNDOLBondPendingPayoutFor,
  } = useSWR(
    [active, ndolBondAddress, "pendingPayoutFor", account, fromTokenAddress],
    {
      fetcher: fetcher(library, BondDepositoryFacet),
    }
  );

  const { data: ndolBondInfo, mutate: updateNDOLBondInfo } = useSWR(
    [active, ndolBondAddress, "bondInfo", account, fromTokenAddress],
    {
      fetcher: fetcher(library, BondDepositoryFacet),
    }
  );

  const { data: ndolBondTerms, mutate: updateNDOLBondTerms } = useSWR(
    [active, ndolBondAddress, "terms", fromTokenAddress],
    {
      fetcher: fetcher(library, BondDepositoryFacet),
    }
  );

  const { data: stakingEpoch, mutate: updateStakingEpoch } = useSWR(
    [active, stakingAddress, "epoch"],
    {
      fetcher: fetcher(library, Staking, []),
    }
  );

  const { data: stakingWarmupInfo, mutate: updateStakingWarmupInfo } = useSWR(
    [active, stakingAddress, "warmupInfo", account],
    {
      fetcher: fetcher(library, Staking),
    }
  );

  const { data: stakingCurrentIndex, mutate: updateStakingCurrentIndex } =
    useSWR([active, sNeccAddress, "index"], {
      fetcher: fetcher(library, sNecc, []),
    });

  const { data: stakingContractBalance, mutate: updateStakingContractBalance } =
    useSWR([active, stakingAddress, "contractBalance"], {
      fetcher: fetcher(library, Staking, []),
    });

  const { data: sNeccCirculatingSupply, mutate: updatesNeccCirculatingSupply } =
    useSWR([active, sNeccAddress, "circulatingSupply"], {
      fetcher: fetcher(library, sNecc, []),
    });

  // const { data: sNeccTotalSupply, mutate: updatesNeccTotalSupply } = useSWR(
  //   [active, sNeccAddress, "totalSupply"],
  //   {
  //     fetcher: fetcher(library, sNecc, []),
  //   }
  // );

  const { data: sNeccBalance, mutate: updatesNeccBalance } = useSWR(
    [active, sNeccAddress, "balanceOf"],
    {
      fetcher: fetcher(library, sNecc, [account]),
    }
  );
  // console.log("sNeccbalanceOf?.toString()");
  // console.log(sNeccbalanceOf?.toString());

  const stakingRebase =
    stakingEpoch?.distribute?.toNumber() / sNeccCirculatingSupply?.toNumber();
  const fiveDayRate = Math.pow(1 + stakingRebase, 5 * 24) - 1;
  const apy = Math.pow(1 + stakingRebase, 365 * 24) - 1;
  const interestDue = ndolBondInfo?.payout;
  const stakingRebasePercentage = stakingRebase && trim(stakingRebase * 100, 4);
  const nextRewardValue =
    stakingRebasePercentage && sNeccBalance?.toNumber()
      ? trim(
          (Number(stakingRebasePercentage) / 100) * sNeccBalance?.toNumber(),
          0
        )
      : 0;

  // console.log(nextRewardValue);
  // console.log(apy?.toString());
  // console.log(ndolBondInfo?.vesting?.toNumber());
  // console.log(ndolBondInfo?.lastTime?.toNumber());
  // console.log(ndolBondInfo?.toString());

  // console.log(stakingEpoch?.toString());
  // console.log(fiveDayRate?.toString());
  // console.log(apy?.toString());

  // const { data: principleValuation, mutate: updatePrincipleValuation } = useSWR(
  //   [
  //     active,
  //     treasuryAddress,
  //     "valueOfToken",
  //     fromTokenAddress,
  //     // tokenBalances?.[tokenAddresses.indexOf(fromTokenAddress)],
  //   ],
  //   {
  //     fetcher: fetcher(library, TreasuryFacet),
  //   }
  // );
  // const { data: ndolBondPayoutFor, mutate: updateNDOLBondPayoutFor } = useSWR(
  //   [
  //     active,
  //     ndolBondAddress,
  //     "payoutFor",
  //     principleValuation,
  //     fromTokenAddress,
  //   ],
  //   {
  //     fetcher: fetcher(library, BondDepositoryFacet),
  //   }
  // );
  // console.log(principleValuation?.toString());
  // console.log(ndolBondMaxPayout?.toString());
  // console.log(ndolBondPayoutFor?.toString());
  // console.log(bondCalculatorValuation?.toString());
  // console.log(ndolBondPendingPayoutFor?.toString());
  // console.log(ndolBondInfo?.vesting.toString());
  // console.log(ndolBondInfo?.payout.toString());
  // console.log(ndolBondTerms?.toString());
  // console.log(ndolBondStandardizedDebtRatio?.toString());
  // console.log(stakingEpoch?.endTime?.toString());
  // console.log(sNeccCirculatingSupply?.toString());
  // console.log(ndolBondInfo?.vesting?.toString());
  // console.log(ndolBondInfo?.lastTime?.toString());

  const bondsInfo = {
    NDOLBond: {
      price: ndolBondPrice,
      maxPayout: ndolBondMaxPayout,
      standardizedDebtRatio: ndolBondStandardizedDebtRatio,
      pendingPayoutFor: ndolBondPendingPayoutFor,
      interestDue: ndolBondInfo?.payout,
      fullyVestingTime: ndolBondInfo?.vesting?.add(ndolBondInfo?.lastTime),
      vestingTerm: ndolBondTerms?.vestingTerm,
      apy,
      fiveDayRate,
      nextRebase: stakingEpoch?.endTime,
      currentIndex: stakingCurrentIndex,
      staked: stakingCurrentIndex,
      stakingContractBalance,
      warmupInfo: stakingWarmupInfo,
    },

    NDOLNeccLPBond: {
      price: ndolBondPrice,
      maxPayout: ndolBondMaxPayout,
      standardizedDebtRatio: ndolBondStandardizedDebtRatio,
      pendingPayoutFor: ndolBondPendingPayoutFor,
      interestDue: ndolBondInfo?.payout,
      fullyVestingTime: ndolBondInfo?.vesting?.add(ndolBondInfo?.lastTime),
      vestingTerm: ndolBondTerms?.vestingTerm,
      apy,
      fiveDayRate,
      nextRebase: stakingEpoch?.endTime,
      currentIndex: stakingCurrentIndex,
      staked: stakingCurrentIndex,
      stakingContractBalance,
      warmupInfo: stakingWarmupInfo,
    },
    // WETHBond: {
    //   price: ndolBondPrice,
    //   maxPayout: ndolBondMaxPayout,
    //   standardizedDebtRatio: ndolBondStandardizedDebtRatio,
    //   pendingPayoutFor: ndolBondPendingPayoutFor,
    //   interestDue: ndolBondInfo?.payout,
    //   fullyVestingTime: ndolBondInfo?.vesting?.add(ndolBondInfo?.lastTime),
    //   vestingTerm: ndolBondTerms?.vestingTerm,
    //   apy,
    //   fiveDayRate,
    //   nextRebase: stakingEpoch?.endTime,
    //   currentIndex: stakingCurrentIndex,
    //   staked: stakingCurrentIndex,
    //   stakingContractBalance,
    //   warmupInfo: stakingWarmupInfo,
    // },
  };

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
      library.on("block", async (blockNumber) => {
        // updateVaultTokenInfo(undefined, true);
        updateTokenBalances(undefined, true);
        updateNDOLBondPrice(undefined, true);
        updateNDOLBondMaxPayout(undefined, true);
        updateNDOLBondStandardizedDebtRatio(undefined, true);
        updateNDOLBondPendingPayoutFor(undefined, true);
        updateNDOLBondInfo(undefined, true);
        updateNDOLBondTerms(undefined, true);
        updateStakingEpoch(undefined, true);
        updateStakingWarmupInfo(undefined, true);
        updateStakingCurrentIndex(undefined, true);
        updateStakingContractBalance(undefined, true);
        updatesNeccCirculatingSupply(undefined, true);
        updateCurrentDebt(undefined, true);
      });
      return () => {
        library.removeAllListeners("block");
      };
    }
  }, [
    active,
    library,
    // updateVaultTokenInfo,
    updateTokenBalances,
    updateNDOLBondPrice,
    updateNDOLBondMaxPayout,
    updateNDOLBondStandardizedDebtRatio,
    updateNDOLBondPendingPayoutFor,
    updateNDOLBondInfo,
    updateNDOLBondTerms,
    updateStakingEpoch,
    updateStakingWarmupInfo,
    updateStakingCurrentIndex,
    updateStakingContractBalance,
    updatesNeccCirculatingSupply,
    updateCurrentDebt,
  ]);

  const infoTokens = getInfoTokens(
    tokens,
    tokenBalances,
    bondTokens,
    undefined,
    undefined,
    bondsInfo
  );

  const [flagOrdersEnabled] = useLocalStorageSerializeKey(
    [CHAIN_ID, "Flag-orders-enabled"],
    document.location.hostname === "localhost"
  );
  const LIST_SECTIONS = [
    "Positions",
    flagOrdersEnabled ? "Open Orders" : undefined,
    "Trade History",
  ].filter(Boolean);
  let [listSection, setListSection] = useLocalStorageSerializeKey(
    [CHAIN_ID, "List-section"],
    LIST_SECTIONS[0]
  );
  if (!LIST_SECTIONS.includes(listSection)) {
    listSection = LIST_SECTIONS[0];
  }

  const onSelectWalletToken = (token) => {
    setFromTokenAddress(token.address);
  };

  return (
    <div className="Exchange">
      <div className="flex items-center justify-center h-screen">
        <BondBox
          flagOrdersEnabled={flagOrdersEnabled}
          chainId={chainId}
          infoTokens={infoTokens}
          active={active}
          connectWallet={connectWallet}
          library={library}
          account={account}
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
          bondsInfo={bondsInfo}
          //
          interestDue={interestDue}
          fiveDayRate={fiveDayRate}
          apy={apy}
          nextRewardValue={nextRewardValue}
          stakingRebasePercentage={stakingRebasePercentage}
          warmupInfo={stakingWarmupInfo}
          stakingContractBalance={stakingContractBalance}
          stakingCurrentIndex={stakingCurrentIndex}
          standardizedDebtRatio={ndolBondStandardizedDebtRatio}
          currentDebt={currentDebt}
          nextRebase={stakingEpoch?.endTime}
          bondPrice={ndolBondPrice}
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
