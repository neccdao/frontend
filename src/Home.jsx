import React from 'react'
import { Link } from 'react-router-dom'
import Footer from "./Footer"

import './css/Home.css';

export default function Home() {
  return(
    <div className="Home">
      <div className="Home-wave"></div>
      <div className="App-title">GAMBIT</div>
      <div className="App-subtitle">Interest-generating stablecoins backed by leverage</div>
      <a href="https://gambit.gitbook.io/gambit/" className="App-cta Home-learn-more" target="_blank" rel="noopener noreferrer">
        Learn More
      </a>
      <Link className="App-cta Home-buy" to="/trade">Launch App</Link>
      <div className="App-footer">
        <Footer />
      </div>
    </div>
  )
}
