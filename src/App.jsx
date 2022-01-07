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
import Footer from "./Footer";
import Exit from "./Exit";

import { cssTransition } from "react-toastify";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import "./css/tailwind-index.css";
import "./css/Shared.css";
import "./css/App.css";
import Bond from "./Bond";
import { ErrorBoundary } from "@sentry/react";

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
            <div className="App-background fixed z-0 w-full h-full"></div>
            <div className="App-highlight"></div>
            <ErrorBoundary
              showDialog={true}
              fallback={
                <div className="min-h-screen min-w-full flex items-center justify-center absolute z-50">
                  <a
                    className="text-nord11"
                    href="https://discord.gg/EfVdTcx45K"
                  >
                    Can dev do something???
                  </a>
                </div>
              }
            >
              <Header />
              <div className="App-content">
                <Switch>
                  <Route exact path="/">
                    <Exit />
                  </Route>
                  {/* <Route exact path="/trade">
                    <Exchange />
                  </Route> */}
                  {/* <Route exact path="/data">
                    <Data />
                  </Route> */}
                  <Route exact path="/mint">
                    <Mint />
                  </Route>
                  <Route exact path="/bond">
                    <Bond />
                  </Route>
                  <Route exact path="/exit">
                    <Exit />
                  </Route>
                </Switch>
              </div>
              <Footer />
            </ErrorBoundary>
          </div>
          <ToastContainer
            limit={3}
            position="bottom-right"
            hideProgressBar={true}
          />
        </ApolloProvider>
      </Web3ReactProvider>
    </Router>
  );
}

export default App;
