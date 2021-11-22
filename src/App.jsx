import React from "react";
import { Web3ReactProvider } from "@web3-react/core";
import { Web3Provider } from "@ethersproject/providers";
import { BrowserRouter as Router, Switch, Route } from "react-router-dom";
import { Header } from "./components/Header";
import { ApolloProvider } from "@apollo/client";
import { getNeccSubgraphClient } from "./Api";

import Exchange from "./Exchange";
import Mint from "./Mint";
import Zap from "./Zap";
import Data from "./Data";

// import Home from "./Home";
// import Presale from "./Presale";
// import Stake from "./Stake";
// import Actions from "./Actions";
// import Debug from "./Debug";

import { cssTransition } from "react-toastify";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import "./css/tailwind-index.css";
import "./css/Shared.css";
import "./css/App.css";
import Bond from "./Bond";

if ("ethereum" in window) {
  window.ethereum.autoRefreshOnNetworkChange = false;
}

function getLibrary(provider) {
  const library = new Web3Provider(provider);
  library.pollingInterval = 8000;
  return library;
}

const Zoom = cssTransition({
  enter: "zoomIn",
  exit: "zoomOut",
  collapseDuration: 300,
});

function App() {
  return (
    <Router>
      <Web3ReactProvider getLibrary={getLibrary}>
        <ApolloProvider client={getNeccSubgraphClient()}>
          <div className="App">
            <div className="bg-[#242933] fixed z-0 w-full h-full"></div>
            <div className="App-highlight"></div>
            <div className="App-content">
              <Header />
              <Switch>
                <Route exact path="/">
                  <Exchange />
                </Route>
                <Route exact path="/trade">
                  <Exchange />
                </Route>
                <Route exact path="/mint">
                  <Mint />
                </Route>
                <Route exact path="/zap">
                  <Zap />
                </Route>
                <Route exact path="/data">
                  <Data />
                </Route>
                <Route exact path="/bond">
                  <Bond />
                </Route>
                {/* <Route exact path="/presale">
                  <Presale />
                </Route>
                <Route exact path="/earn">
                  <Stake />
                </Route>
                <Route exact path="/about">
                  <Home />
                </Route>
                <Route exact path="/debug">
                  <Debug />
                </Route>
                <Route exact path="/actions/:account">
                  <Actions />
                </Route> */}
              </Switch>
            </div>
          </div>
          <ToastContainer
            limit={3}
            transition={Zoom}
            position="bottom-right"
            autoClose={6000}
            hideProgressBar={true}
            newestOnTop={true}
            closeOnClick={false}
            draggable={false}
            pauseOnHover
          />
        </ApolloProvider>
      </Web3ReactProvider>
    </Router>
  );
}

export default App;
