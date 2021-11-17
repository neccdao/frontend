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
        href={`https://rinkeby.etherscan.io/token/${neccAddress}`}
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
          necc.
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
            href="https://necc.gitbook.io/necc/"
            // href="https://necc-docs.surge.sh/docs/tocs/"
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
