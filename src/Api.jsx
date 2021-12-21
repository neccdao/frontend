import { ethers } from "ethers";
import { toast } from "react-toastify";
import { ApolloClient, InMemoryCache, gql } from "@apollo/client";
import useSWR from "swr";

import OrderBook from "./abis/OrderBook.json";
import Router from "./abis/Router.json";
import { getContract } from "./Addresses";
import { CHAIN_ID, getExplorerUrl } from "./Helpers";

const orderBookAddress = getContract(CHAIN_ID, "OrderBook");
const routerAddress = getContract(CHAIN_ID, "Router");

const NECC_SUBGRAPH_URL =
  "https://api.thegraph.com/subgraphs/name/rej156/necc-aurora";
export function getNeccSubgraphClient(version = "v0.0.50") {
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    uri: NECC_SUBGRAPH_URL, //  + version
  });
  return client;
}

const CHAINLINK_GRAPH_API_URL =
  "https://api.thegraph.com/subgraphs/name/deividask/chainlink";
const chainlinkClient = new ApolloClient({
  uri: CHAINLINK_GRAPH_API_URL,
  cache: new InMemoryCache(),
});

export function cancelOrder(library, index, opts) {
  const params = [index];
  const method = "cancelSwapOrder";
  const contract = new ethers.Contract(
    orderBookAddress,
    OrderBook.abi,
    library.getSigner()
  );

  return callContract(contract, method, params, opts);
}

export function updateOrder(
  library,
  index,
  minOut,
  triggerRatio,
  triggerAboveThreshold,
  opts
) {
  const params = [index, minOut, triggerRatio, triggerAboveThreshold];
  const method = "updateSwapOrder";
  const contract = new ethers.Contract(
    orderBookAddress,
    OrderBook.abi,
    library.getSigner()
  );

  return callContract(contract, method, params, opts);
}

export function executeOrder(library, account, index, feeReceiver, opts) {
  const params = [account, index, feeReceiver];
  const method = "executeSwapOrder";
  const contract = new ethers.Contract(
    orderBookAddress,
    OrderBook.abi,
    library.getSigner()
  );
  return callContract(contract, method, params, opts);
}

function callContract(contract, method, params, opts = {}) {
  return contract[method](...params)
    .then(async (res) => {
      const txUrl = getExplorerUrl(CHAIN_ID) + "tx/" + res.hash;
      const sentMsg = opts.sentMsg || "Transaction sent.";
      toast.success(
        <div>
          {sentMsg}.{" "}
          <a href={txUrl} target="_blank" rel="noopener noreferrer">
            View status.
          </a>
          <br />
        </div>
      );
      if (opts.pendingTxns && opts.setPendingTxns) {
        const pendingTxn = {
          hash: res.hash,
          message: opts.successMsg || "Transaction sent",
        };
        opts.setPendingTxns([...opts.pendingTxns, pendingTxn]);
      }
      return res;
    })
    .catch((e) => {
      console.error(e);
      toast.error(opts.failMsg || "Transaction failed");
    });
}
