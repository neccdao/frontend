import React from "react";

export default function ExchangeInfoRow(props) {
  const { label, children, value, isTop, isWarning, labelClassName } = props;
  const className = ["Exchange-info-row"];
  if (isTop) {
    className.push("top-line");
  }
  return (
    <div className={className.join(" ")}>
      <div className={["Exchange-info-label"].concat(labelClassName).join(" ")}>
        {label}
      </div>
      <div
        className={`ml-auto ${isWarning ? "Exchange-info-value-warning" : ""}`}
      >
        {children || value}
      </div>
    </div>
  );
}
