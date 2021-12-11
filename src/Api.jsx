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

const BTC_USD_FEED_ID = "0xae74faa92cb67a95ebcab07358bc222e33a34da7";
const BNB_USD_FEED_ID = "0xc45ebd0f901ba6b2b8c7e70b717778f055ef5e6d";
const ETH_USD_FEED_ID = "0x37bc7498f4ff12c19678ee8fe19d713b87f6a9e6";

const FEED_ID_MAP = {
  BTC_USD: BTC_USD_FEED_ID,
  ETH_USD: ETH_USD_FEED_ID,
  BNB_USD: BNB_USD_FEED_ID,
};

// TODO: Change when indexed on Arbitrum
// TODO: Update per tagged version
const NECC_SUBGRAPH_URL =
  "https://api.thegraph.com/subgraphs/name/rej156/necc-rinkeby";
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

function getChartPrices(marketName) {
  const feedId = FEED_ID_MAP[marketName];
  const PER_CHUNK = 1000;
  const CHUNKS_TOTAL = 6;

  const requests = [];
  for (let i = 0; i < CHUNKS_TOTAL; i++) {
    const query = gql(`{
      rounds(
        first: ${PER_CHUNK},
        skip: ${i * PER_CHUNK},
        orderBy: unixTimestamp,
        orderDirection: desc,
        where: {feed: "${feedId}"}
      ) {
        unixTimestamp,
        value
      }
    }`);
    requests.push(chainlinkClient.query({ query }));
  }

  return Promise.all(requests)
    .then((chunks) => {
      const prices = [];
      const uniqTs = new Set();
      chunks.forEach((chunk) => {
        chunk.data.rounds.forEach((item) => {
          if (uniqTs.has(item.unixTimestamp)) {
            return;
          }

          uniqTs.add(item.unixTimestamp);
          prices.push([item.unixTimestamp, Number(item.value) / 1e8]);
        });
      });

      return prices.sort(([timeA], [timeB]) => timeA - timeB);
    })
    .catch((err) => {
      console.error(err);
      toast.error("Failed to fetch chart prices");
    });
}

export function useChartPrices(marketName, sample) {
  const { data = [], mutate: updatePrices } = useSWR(
    ["getChartPrices", marketName],
    {
      fetcher: () => getChartPrices(marketName),
    }
  );

  let prices;
  if (sample && data && data.length) {
    const SAMPLE_INTERVAL = 60 * 60 * 1;
    prices = [];
    let lastAddedTimestamp = data[0][0];
    data.forEach((item, i) => {
      if (
        item[0] - lastAddedTimestamp < SAMPLE_INTERVAL &&
        i !== data.length - 1
      ) {
        return;
      }
      prices.push(item);
      lastAddedTimestamp = item[0];
    });
  } else {
    prices = data;
  }

  return [prices, updatePrices];
}

export function approvePlugin(
  pluginAddress,
  { setIsApproving, library, onApproveSubmitted, pendingTxns, setPendingTxns }
) {
  setIsApproving(true);

  const contract = new ethers.Contract(
    routerAddress,
    Router.abi,
    library.getSigner()
  );
  return callContract(contract, "approvePlugin", [pluginAddress], {
    sentMsg: "Approval Sent",
    successMsg: "Plugin Approved",
    failMsg: "Approval failed",
    pendingTxns,
    setPendingTxns,
  })
    .then(() => {
      if (onApproveSubmitted) {
        onApproveSubmitted();
      }
    })
    .finally(() => {
      setIsApproving(false);
    });
}

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
