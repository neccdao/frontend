import React from 'react';

export default function ExchangeInfoRow(props) {
  const {label, children, value, isTop, isWarning} = props;
  const className = ['Exchange-info-row'];
  if (isTop) {
    className.push('top-line');
  }
  return (
    <div className={className.join(' ')}>
      <div className="Exchange-info-label">{label}</div>
      <div className={`align-right ${isWarning ? 'Exchange-info-value-warning' : ''}`}>{children || value}</div>
    </div>
  );
}
