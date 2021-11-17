import React from "react";
import {
  FaTwitter,
  FaTelegramPlane,
  FaMediumM,
  FaGithub,
  FaDiscord,
  FaDiscourse,
} from "react-icons/fa";

import "./css/Footer.css";

export default function Footer() {
  // TODO: Footer social links
  return null;
  return (
    <div className="Footer flex justify-center">
      <a
        className="App-social-link"
        href="https://twitter.com/GambitProtocol"
        target="_blank"
        rel="noopener noreferrer"
      >
        <FaTwitter />
      </a>
      <a
        className="App-social-link"
        href="http://gambitprotocol.medium.com"
        target="_blank"
        rel="noopener noreferrer"
      >
        <FaMediumM />
      </a>
      <a
        className="App-social-link"
        href="https://github.com/xvi10"
        target="_blank"
        rel="noopener noreferrer"
      >
        <FaGithub />
      </a>
      <a
        className="App-social-link"
        href="https://t.me/GambitProtocol"
        target="_blank"
        rel="noopener noreferrer"
      >
        <FaTelegramPlane />
      </a>
      <a
        className="App-social-link"
        href="https://discord.gg/cxjZYR4gQK"
        target="_blank"
        rel="noopener noreferrer"
      >
        <FaDiscord />
      </a>
      <a
        className="App-social-link"
        href="https://gov.gambit.financial/"
        target="_blank"
        rel="noopener noreferrer"
      >
        <FaDiscourse />
      </a>
    </div>
  );
}
