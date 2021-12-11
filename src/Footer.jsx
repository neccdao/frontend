import React from "react";
import {
  FaTwitter,
  FaTelegramPlane,
  FaMediumM,
  FaGithub,
  FaDiscord,
  FaDiscourse,
  FaGithubAlt,
} from "react-icons/fa";

import "./css/Footer.css";

export default function Footer() {
  // TODO: Footer social links
  return (
    <div className="Footer flex justify-center">
      <a
        className="App-social-link"
        href="https://twitter.com/neccdao"
        target="_blank"
        rel="noopener noreferrer"
      >
        <FaTwitter />
      </a>
      <a
        className="App-social-link"
        href="http://neccdao.medium.com"
        target="_blank"
        rel="noopener noreferrer"
      >
        <FaMediumM />
      </a>
      <a
        className="App-social-link"
        href="https://github.com/neccdao"
        target="_blank"
        rel="noopener noreferrer"
      >
        <FaGithub />
      </a>
      {/* <a
        className="App-social-link"
        href="https://t.me/neccdao"
        target="_blank"
        rel="noopener noreferrer"
      >
        <FaTelegramPlane />
      </a> */}
      <a
        className="App-social-link"
        href="https://discord.gg/PwaesU6MVx"
        target="_blank"
        rel="noopener noreferrer"
      >
        <FaDiscord />
      </a>
      <a
        className="App-social-link"
        href="https://github.com/orgs/neccdao/projects/1"
        target="_blank"
        rel="noopener noreferrer"
      >
        <FaGithubAlt />
      </a>
    </div>
  );
}
