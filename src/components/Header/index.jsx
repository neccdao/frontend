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

const NeccTokenInfo = ({ neccAddress }) => {
  return (
    <div className="flex space-x-2 items-center">
      <a className="h-8 w-8" href="#">
        <img
          src={metamaskImg}
          alt="MetaMask"
          onClick={() =>
            addToken({
              address: neccAddress,
              symbol: "Necc",
              info: {
                decimals: 18,
                imageUrl:
                  "https://assets.coingecko.com/coins/images/15888/small/necc-transparent-yellow.png",
              },
            })
          }
        />
      </a>
      <a
        className="h-8 w-8"
        href="https://www.coingecko.com/en/coins/necc"
        target="_blank"
        rel="noopener noreferrer"
      >
        <img src={coingeckoImg} alt="CoinGecko" />
      </a>
      <a
        href={`https://explorer.mainnet.aurora.dev/token/${neccAddress}`}
        className="h-8 w-8"
        target="_blank"
        rel="noopener noreferrer"
      >
        <img src={etherscanImg} alt="EtherScan" />
      </a>
      <a
        href="https://necc.gitbook.io/necc/necc"
        className="h-8 w-8"
        target="_blank"
        rel="noopener noreferrer"
      >
        <img src={gitbookImg} alt="Gitbook" />
      </a>
    </div>
  );
};

const RedemptionAssets = ({
  btcFeeReserves,
  wethFeeReserves,
  usdcFeeReserves,
  usdtFeeReserves,
  rewardRedemptionBasisPoints,
  redemptionAmount,
  neccCirculatingSupply,
}) => {
  const formattedRedemptionAmount = expandDecimals(redemptionAmount, 18);

  const reserveShare = (reserves) =>
    reserves
      .mul(rewardRedemptionBasisPoints)
      .div(10000)
      .mul(
        neccCirculatingSupply?.gt(formattedRedemptionAmount)
          ? formattedRedemptionAmount
          : neccCirculatingSupply
      )
      .div(neccCirculatingSupply)
      .toString();

  return (
    <div className="flex flex-col space-y-2">
      <p>Rewards</p>
      <hr />
      {btcFeeReserves.gt(0) && (
        <div className="flex flex-row space-x-2">
          <p>WBTC - </p>
          <p>{formatAmount(reserveShare(btcFeeReserves), 8, 10)?.toString()}</p>
        </div>
      )}
      {wethFeeReserves.gt(0) && (
        <div className="flex flex-row space-x-2">
          <p>WETH - </p>
          <p>
            {formatAmount(reserveShare(wethFeeReserves), 18, 10)?.toString()}
          </p>
        </div>
      )}
      {usdcFeeReserves.gt(0) && (
        <div className="flex flex-row space-x-2">
          <p>USDC - </p>
          <p>
            {formatAmount(reserveShare(usdcFeeReserves), 6, 10)?.toString()}
          </p>
        </div>
      )}
      {usdtFeeReserves.gt(0) && (
        <div className="flex flex-row space-x-2">
          <p>USDT - </p>
          <p>
            {formatAmount(reserveShare(usdtFeeReserves), 18, 10)?.toString()}
          </p>
        </div>
      )}
    </div>
  );
};

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

  const whitelistedTokens = getWhitelistedTokens(CHAIN_ID);
  const wbtcAddress = whitelistedTokens.find(
    ({ symbol }) => symbol === "BTC"
  )?.address;
  const wethAddress = whitelistedTokens.find(
    ({ symbol }) => symbol === "WETH"
  )?.address;
  // const usdcAddress = whitelistedTokens.find(
  //   ({ symbol }) => symbol === "USDC"
  // )?.address;
  // const usdtAddress = whitelistedTokens.find(
  //   ({ symbol }) => symbol === "USDT"
  // )?.address;
  const vaultAddress = getContract(CHAIN_ID, "Vault");
  // const neccAddress = getContract(CHAIN_ID, "Necc");

  // const { data: neccBalance, mutate: updateNeccBalance } = useSWR(
  //   [active, neccAddress, "balanceOf", account],
  //   {
  //     fetcher: fetcher(library, Necc),
  //   }
  // );

  // const { data: rewardRedemptionBasisPoints } = useSWR(
  //   [active, vaultAddress, "rewardRedemptionBasisPoints"],
  //   {
  //     fetcher: fetcher(library, Vault),
  //   }
  // );

  // const { data: neccCirculatingSupply, mutate: updateNeccCirculatingSupply } =
  //   useSWR([active, neccAddress, "circulatingSupply"], {
  //     fetcher: fetcher(library, Necc),
  //   });

  // const { data: btcFeeReserves, mutate: updateBTCFeeReserves } = useSWR(
  //   [active, vaultAddress, "feeReserves", wbtcAddress],
  //   {
  //     fetcher: fetcher(library, Vault),
  //   }
  // );

  // const { data: wethFeeReserves, mutate: updatewethFeeReserves } = useSWR(
  //   [active, vaultAddress, "feeReserves", wethAddress],
  //   {
  //     fetcher: fetcher(library, Vault),
  //   }
  // );
  // console.log({ btcFeeReserves, wethFeeReserves });

  // const { data: usdcFeeReserves, mutate: updateusdcFeeReserves } = useSWR(
  //   [active, vaultAddress, "feeReserves", usdcAddress],
  //   {
  //     fetcher: fetcher(library, Vault),
  //   }
  // );

  // const { data: usdtFeeReserves, mutate: updateusdtFeeReserves } = useSWR(
  //   [active, vaultAddress, "feeReserves", usdtAddress],
  //   {
  //     fetcher: fetcher(library, Vault),
  //   }
  // );

  // const { data: neccTokenAllowance, mutate: updateNeccTokenAllowance } = useSWR(
  //   [active, neccAddress, "allowance", account, vaultAddress],
  //   {
  //     fetcher: fetcher(library, Token),
  //   }
  // );

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

  // const redeemNecc = async () => {
  //   let contract = new ethers.Contract(
  //     vaultAddress,
  //     Vault.abi,
  //     library.getSigner()
  //   );
  //   let action = "Redeem";
  //   let method = "redeemReward";
  //   let params = [
  //     neccCirculatingSupply?.gt(expandDecimals(redemptionAmount, 18))
  //       ? expandDecimals(redemptionAmount, 18)
  //       : neccCirculatingSupply,
  //     account,
  //   ];

  //   if (expandDecimals(redemptionAmount, 18)?.gte(neccTokenAllowance)) {
  //     contract = new ethers.Contract(
  //       neccAddress,
  //       Necc.abi,
  //       library.getSigner()
  //     );
  //     action = "Approve";
  //     method = "approve";
  //     params = [vaultAddress, ethers.constants.MaxUint256];
  //   }

  //   const gasLimit = await getGasLimit(contract, method, params);
  //   contract[method](...params, {
  //     gasLimit,
  //   })
  //     .then(async (res) => {
  //       const txUrl = getExplorerUrl(CHAIN_ID) + "tx/" + res.hash;
  //       const toastSuccessMessage = (
  //         <div>
  //           {action} submitted!
  //           <a href={txUrl} target="_blank" rel="noopener noreferrer">
  //             View status.
  //           </a>
  //           <br />
  //         </div>
  //       );
  //       const txMessage = `${action} success.`;
  //       handleFulfilled(res, toastSuccessMessage, txMessage);
  //     })
  //     .catch((e) => {
  //       console.error(e);
  //       toast.error(`${action} failed.`);
  //     })
  //     .finally(() => {
  //       setIsPendingConfirmation(false);
  //     });
  // };

  useEffect(() => {
    if (active) {
      library.on("block", () => {
        // updateBTCFeeReserves(undefined, true);
        // updatewethFeeReserves(undefined, true);
        // updateusdcFeeReserves(undefined, true);
        // updateusdtFeeReserves(undefined, true);
        // updateNeccCirculatingSupply(undefined, true);
        // updateNeccTokenAllowance(undefined, true);
        // updateNeccBalance(undefined, true);
      });
      return () => {
        library.removeAllListeners("block");
      };
    }
  }, [active, library]);

  // const submitButtonText = () => {
  //   if (neccTokenAllowance?.gt(0)) {
  //     if (neccBalance?.lt(expandDecimals(redemptionAmount, 18))) {
  //       return `Insufficient Balance`;
  //     }
  //     return `Redeem Necc`;
  //   }
  //   return `Approve Necc`;
  // };

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
          <NavLink activeClassName="active" to="/mint">
            MINT
          </NavLink>
        </div>
        <div className="App-header-link-container  flex items-center">
          <NavLink activeClassName="active" to="/bond">
            BOND
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
      </div>
      {/* {deltaYieldTrackerClaimable?.gt(0) && (
        <div className="App-header-link-container  flex items-center">
          <button
            className="
            bg-nord10
            focus:bg-nord9 
            outline-none z-10 rounded-xl flex relative justify-center items-center py-2 px-4 mx-0 mt-2 mb-0 w-full font-sans font-medium text-center text-white no-underline appearance-none cursor-pointer select-none box-border flex-no-wrap focus:shadow-xs"
            onClick={() => setIsClaimNeccModalVisible(true)}
          >
            Claim Necc
          </button>
        </div>
      )}

      {neccBalance?.gt(0) && (
        <div className="App-header-link-container  flex items-center">
          <button
            className="bg-nord10
            focus:bg-nord9 
            outline-none z-10 rounded-xl flex relative justify-center items-center py-2 px-4 mx-0 mt-2 mb-0 w-full font-sans font-medium text-center text-white no-underline appearance-none cursor-pointer select-none box-border flex-no-wrap focus:shadow-xs"
            onClick={() => setIsRedeemNeccModalVisible(true)}
          >
            Redeem Necc
          </button>
        </div>
      )} */}

      {/* <Modal
        isVisible={isRedeemNeccModalVisible}
        setIsVisible={setIsRedeemNeccModalVisible}
        label="Redeem"
      >
        <div className="flex flex-col space-y-2">
          <NeccTokenInfo neccAddress={neccAddress}></NeccTokenInfo>
          <div className="flex flex-col space-y-2 relative">
            <div className="mb-4">
              <input
                type="number"
                placeholder="0.0"
                value={redemptionAmount}
                onChange={(event) => setRedemptionAmount(event.target.value)}
              />
              <div
                className="z-10 absolute py-1 px-2 tracking-wide leading-6 text-left text-white bg-nord10 rounded-sm cursor-pointer hover:text-white right-4 top-3 active:bg-nord9"
                onClick={() => {
                  setRedemptionAmount(formatAmountFree(neccBalance, 18, 4));
                }}
              >
                MAX
              </div>
              <button
                className="
            bg-nord10
            focus:bg-nord9 
            outline-none z-10 rounded-xl flex relative justify-center items-center py-2 px-4 mx-0 mt-2 mb-0 w-full font-sans font-medium text-center text-white no-underline appearance-none cursor-pointer select-none box-border flex-no-wrap focus:shadow-xs"
                onClick={() => redeemNecc()}
                disabled={
                  isConfirming ||
                  isPendingConfirmation ||
                  !redemptionAmount ||
                  submitButtonText() === `Insufficient Balance`
                }
              >
                {submitButtonText()}
              </button>
            </div>
            <RedemptionAssets
              btcFeeReserves={btcFeeReserves}
              wethFeeReserves={wethFeeReserves}
              usdcFeeReserves={usdcFeeReserves}
              usdtFeeReserves={usdtFeeReserves}
              rewardRedemptionBasisPoints={rewardRedemptionBasisPoints}
              redemptionAmount={redemptionAmount}
              neccCirculatingSupply={neccCirculatingSupply}
            />
          </div>
        </div>
      </Modal>

      <Modal
        isVisible={isClaimNeccModalVisible}
        setIsVisible={setIsClaimNeccModalVisible}
        label="Claim"
      >
        <div className="flex flex-col space-y-2">
          <NeccTokenInfo neccAddress={neccAddress}></NeccTokenInfo>
          <div className="">
            <p className="font-body text-lg">
              Enter an address to trigger a Necc claim.
            </p>
            <p className="font-body text-lg">
              If the address has any claimable Necc, it will be sent to them on
              submission.
            </p>
          </div>
          <div className="flex justify-center items-center font-sans text-white bg-nord2 border border-nord9 border-solid box-border">
            <div className="flex-1 p-4 font-body text-white box-border">
              <div className="grid text-white box-border grid-flow-row gap-6">
                <div className="flex justify-between items-center p-0 m-0 w-full box-border relative">
                  <div className="m-0 text-md font-medium text-nord4 box-border">
                    Recipient
                  </div>
                  <div
                    className="z-10 absolute py-1 px-2 tracking-wide leading-6 text-left text-white bg-nord10 rounded-sm cursor-pointer hover:text-white right-1 top-[-5px] active:bg-nord9"
                    onClick={() => {
                      setClaimAddress(account);
                    }}
                  >
                    Me
                  </div>
                </div>
                <input
                  className="overflow-hidden flex-auto p-0 w-full text-xl font-medium color-nord4 cursor-text box-border"
                  type="text"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck="false"
                  placeholder="0x Wallet Address"
                  pattern="^(0x[a-fA-F0-9]{40})$"
                  value={claimAddress}
                  onChange={(event) => setClaimAddress(event.target.value)}
                />
              </div>
            </div>
          </div>
          <button
            onClick={() => claim()}
            disabled={bigNumberify(claimableAmount || "0")?.toString() === "0"}
            className="text-lg flex relative justify-center items-center p-4 mx-0 mt-4 mb-0 w-full text-center 
            font-display
            color-nord4 no-underline bg-nord9 border border-transparent border-solid shadow-none box-border flex-no-wrap focus:bg-nord8 focus:shadow-xs hover:bg-nord8 disabled:hover:bg-nord9"
            // style="min-width: 0px; border-radius: 12px; outline: none; z-index: 1; will-change: transform; transition: transform 450ms ease 0s; transform: perspective(1px) translateZ(0px);"
          >
            {/* TODO: Fix claimable kek :( ${formatAmountFree(claimableAmount, 18, 4)}  */}
      {/* {`Claim Necc`} */}
      {/* </button> */}
      {/* </div> */}
      {/* </Modal> */}
    </header>
  );
};

export { Header };
