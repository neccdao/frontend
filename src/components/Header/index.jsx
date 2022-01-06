import React, { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { useWeb3React } from "@web3-react/core";
import useSWR from "swr";
import { toast } from "react-toastify";
import { ethers } from "ethers";
import Vault from "../../abis/Vault.json";
import Necc from "../../abis/Necc.json";
import Token from "../../abis/Token.json";
import { getContract } from "../../Addresses";
import metamaskImg from "./metamask.png";
import etherscanImg from "./etherscan.png";
import gitbookImg from "./gitbook.png";
import coingeckoImg from "./coingecko.png";
import {
  addToken,
  bigNumberify,
  CHAIN_ID,
  expandDecimals,
  fetcher,
  formatAmount,
  formatAmountFree,
  getExplorerUrl,
  getGasLimit,
  useEagerConnect,
  useInactiveListener,
  usePrevious,
} from "../../Helpers";
import Modal from "../Modal/Modal";
import { getWhitelistedTokens } from "../../data/Tokens";

const Header = () => {
  const [isConfirming, setIsConfirming] = useState(false);
  const [isPendingConfirmation, setIsPendingConfirmation] = useState(false);
  const [isRedeemNeccModalVisible, setIsRedeemNeccModalVisible] =
    useState(false);
  const [isClaimNeccModalVisible, setIsClaimNeccModalVisible] = useState(false);
  const [pendingTxns, setPendingTxns] = useState([]);
  const [redemptionAmount, setRedemptionAmount] = useState("");
  const [claimAddress, setClaimAddress] = useState("");

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

  const prevAccount = usePrevious(account);
  useEffect(() => {
    if (prevAccount !== account) {
      setPendingTxns([]);
    }
  }, [prevAccount, account]);

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

  const handleFulfilled = (res, toastSuccessMessage, txMessage) => {
    if (toastSuccessMessage) {
      toast.success(toastSuccessMessage);
    }
    setIsConfirming(false);
    const pendingTxn = {
      hash: res.hash,
      message: txMessage,
    };
    setPendingTxns([...pendingTxns, pendingTxn]);
  };

  return (
    <header className="App-header flex flex-wrap">
      <div className="App-header-link-container mr-auto">
        <NavLink
          exact
          activeClassName="active"
          className="App-header-link-main !text-[36px] font-bold text-white"
          to="/"
        >
          <svg
            className="h-[70px] w-[90px] md:h-[85px] md:w-[120px]"
            viewBox="0 0 463 113"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M16.9193 110V45.7044C16.9193 29.5019 27.721 16.9 45.7238 16.9C63.2122 16.9 73.2423 25.387 73.2423 44.9329V110H89.4448V40.8179C89.4448 15.0997 72.7279 0.697501 49.0671 0.697501C32.8646 0.697501 23.0917 8.41297 16.9193 17.6715V3.26932H0.716854V110H16.9193ZM163.497 95.855C144.723 95.855 128.006 82.7387 127.234 59.5923H215.448C215.448 27.7016 194.102 0.697501 162.726 0.697501C134.436 0.697501 111.546 25.9014 111.546 57.792C111.546 89.9398 134.436 112.572 163.497 112.572C186.386 112.572 204.646 97.3981 212.105 77.595H195.388C189.215 88.1395 177.899 95.855 163.497 95.855ZM163.497 17.4144C179.957 17.4144 192.302 29.5019 196.931 44.9329H130.063C134.693 28.4732 147.552 17.4144 163.497 17.4144ZM321.827 72.7086C315.655 88.911 302.281 95.855 286.85 95.855C266.79 95.855 250.073 80.424 250.073 56.7633C250.073 34.3884 266.79 17.4144 286.85 17.4144C301.767 17.4144 315.14 24.1011 321.827 40.8179H338.801C331.086 14.8425 310.254 0.697501 286.85 0.697501C258.303 0.697501 233.356 25.1298 233.356 56.7633C233.356 89.6826 257.789 112.572 286.85 112.572C308.968 112.572 330.828 99.7127 338.801 72.7086H321.827ZM445.395 72.7086C439.223 88.911 425.849 95.855 410.418 95.855C390.358 95.855 373.641 80.424 373.641 56.7633C373.641 34.3884 390.358 17.4144 410.418 17.4144C425.335 17.4144 438.708 24.1011 445.395 40.8179H462.369C454.654 14.8425 433.822 0.697501 410.418 0.697501C381.871 0.697501 356.924 25.1298 356.924 56.7633C356.924 89.6826 381.357 112.572 410.418 112.572C432.536 112.572 454.397 99.7127 462.369 72.7086H445.395Z"
              fill="#ECEFF4"
            />
          </svg>
        </NavLink>
      </div>
      <div className="flex flex-wrap">
        <div className="App-header-link-container  flex items-center">
          <NavLink activeClassName="active" to="/trade">
            TRADE
          </NavLink>
        </div>
        <div className="App-header-link-container  flex items-center">
          <NavLink activeClassName="active" to="/bond">
            BOND - (REDEEM)
          </NavLink>
        </div>
        <div className="App-header-link-container  flex items-center">
          <NavLink activeClassName="active" to="/mint">
            NDOL - (UNSTAKE)
          </NavLink>
        </div>

        {/* <div className="App-header-link-container  flex items-center">
        <NavLink activeClassName="active" to="/zap">
          ZAP
        </NavLink>
      </div> */}
        <div className="App-header-link-container  flex items-center">
          <NavLink activeClassName="active" to="/data">
            DATA
          </NavLink>
        </div>
        <div className="App-header-link-container  flex items-center">
          <a
            href="https://docs.necc.io"
            target="_blank"
            rel="noopener noreferrer"
          >
            ABOUT
          </a>
        </div>
        <div className="App-header-link-container flex items-center ">
          <a
            target="_blank"
            href="https://assets.necc.io/sunset.txt"
            className="text-yellow-500"
          >
            Sunset.txt
          </a>
        </div>
      </div>
    </header>
  );
};

export { Header };
