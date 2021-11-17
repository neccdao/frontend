import React, { useEffect, useState, useRef, useCallback } from "react";
import cx from "classnames";

import { createChart } from "lightweight-charts";

import {
  USD_DECIMALS,
  SWAP,
  CHAIN_ID,
  getTokenInfo,
  formatAmount,
  formatDateTime,
  usePrevious,
} from "../../Helpers";
import { useChartPrices } from "../../Api";

import { getTokens } from "../../data/Tokens";

function getChartToken(swapOption, fromToken, toToken) {
  if (!fromToken || !toToken) {
    return;
  }

  if (swapOption !== SWAP) {
    return toToken;
  }

  if (fromToken.isUsdg && toToken.isUsdg) {
    return getTokens(CHAIN_ID).find((t) => t.isStable);
  }
  if (fromToken.isUsdg) {
    return toToken;
  }
  if (toToken.isUsdg) {
    return fromToken;
  }

  if (fromToken.isStable && toToken.isStable) {
    return toToken;
  }
  if (fromToken.isStable) {
    return toToken;
  }
  if (toToken.isStable) {
    return fromToken;
  }

  return toToken;
}

function getPriceData(prices, chartToken) {
  let priceData = [];
  const now = parseInt(Date.now() / 1000);
  let lastPrice;

  if (chartToken.isStable) {
    const now = Date.now() / 1000;
    const HOURS_IN_MONTH = 30 * 24;
    const SECONDS_IN_HOUR = 60 * 60;
    for (let i = HOURS_IN_MONTH; i > 0; i--) {
      priceData.push({
        time: now - i * SECONDS_IN_HOUR,
        value: 1,
      });
    }
    return {
      lastPrice: 1,
      priceData,
    };
  }

  if (prices && prices.length) {
    const result = [...prices];
    if (chartToken && chartToken.maxPrice && chartToken.minPrice) {
      const currentAveragePrice = chartToken.maxPrice
        .add(chartToken.minPrice)
        .div(2);
      result.push([now, formatAmount(currentAveragePrice, USD_DECIMALS, 2)]);
    }
    let minValue = result.length === 0 ? 1000000 : parseFloat(result[0][1]);
    let maxValue = 0;
    for (let i = 0; i < result.length; i++) {
      const item = result[i];
      const chartValue = parseFloat(item[1]);
      if (!isNaN(chartValue)) {
        if (chartValue > maxValue) {
          maxValue = chartValue;
        }
        if (chartValue < minValue) {
          minValue = chartValue;
        }
      }

      if (parseInt(item[0]) <= now) {
        priceData.push({
          time: item[0],
          value: chartValue,
        });
      }
    }

    lastPrice = priceData[priceData.length - 1].value;
  }
  return { lastPrice, priceData };
}

const getSeriesOptions = () => ({
  // https://github.com/tradingview/lightweight-charts/blob/master/docs/area-series.md
  lineColor: "rgb(1, 227, 217)",
  topColor: "rgba(0, 0, 0, 0.0)",
  bottomColor: "rgba(0, 0, 0, 0.0)",
  lineWidth: 2,
  priceLineWidth: 3,
});

const getChartOptions = (width, height) => ({
  width,
  height,
  layout: {
    backgroundColor: "rgba(255, 255, 255, 0)",
    textColor: "#ccc",
    fontFamily: "RelativeMono",
  },
  localization: {
    // https://github.com/tradingview/lightweight-charts/blob/master/docs/customization.md#time-format
    timeFormatter: (businessDayOrTimestamp) => {
      return formatDateTime(businessDayOrTimestamp);
    },
  },
  grid: {
    vertLines: {
      visible: true,
      color: "rgba(43, 12, 110, 0.4)",
      style: 2,
    },
    horzLines: {
      visible: true,
      color: "rgba(43, 12, 110, 0.4)",
      style: 2,
    },
  },
  // https://github.com/tradingview/lightweight-charts/blob/master/docs/time-scale.md#time-scale
  timeScale: {
    rightOffset: 5,
    borderVisible: false,
    barSpacing: 5,
    timeVisible: true,
    fixLeftEdge: true,
  },
  // https://github.com/tradingview/lightweight-charts/blob/master/docs/customization.md#price-axis
  priceScale: {
    borderVisible: false,
  },
  crosshair: {
    horzLine: {
      color: "#aaa",
    },
    vertLine: {
      color: "#aaa",
    },
  },
});

export default function ExchangeTVChart(props) {
  const { swapOption, fromTokenAddress, toTokenAddress, infoTokens } = props;
  const [currentChart, setCurrentChart] = useState();
  const [currentSeries, setCurrentSeries] = useState();

  const fromToken = getTokenInfo(infoTokens, fromTokenAddress);
  const toToken = getTokenInfo(infoTokens, toTokenAddress);
  const chartToken = getChartToken(swapOption, fromToken, toToken);
  const symbol =
    chartToken && chartToken.symbol === "WETH" ? "ETH" : chartToken.symbol;
  const marketName = chartToken ? symbol + "_USD" : undefined;
  const previousMarketName = usePrevious(marketName);

  const days = 7;
  const previousDays = usePrevious(days);

  const [prices, updatePrices] = useChartPrices(marketName, days > 7);
  const ref = useRef(null);
  const chartRef = useRef(null);

  const { priceData } = getPriceData(prices, chartToken);

  const [chartInited, setChartInited] = useState(false);
  useEffect(() => {
    if (marketName !== previousMarketName) {
      setChartInited(false);
    }
  }, [marketName, previousMarketName]);

  const scaleChart = useCallback(() => {
    const from = Date.now() / 1000 - days * 86400;
    const to = Date.now() / 1000;
    currentChart.timeScale().setVisibleRange({ from, to });
  }, [currentChart, days]);

  useEffect(() => {
    if (!ref.current || !priceData || !priceData.length || currentChart) {
      return;
    }

    const chart = createChart(
      chartRef.current,
      getChartOptions(
        chartRef.current.offsetWidth,
        chartRef.current.offsetHeight
      )
    );
    const series = chart.addAreaSeries(getSeriesOptions());

    setCurrentChart(chart);
    setCurrentSeries(series);
  }, [ref, priceData, currentChart]);

  // on chart range option change
  useEffect(() => {
    if (currentChart && previousDays && days !== previousDays) {
      setTimeout(() => scaleChart());
    }
  }, [currentChart, days, previousDays, scaleChart]);

  useEffect(() => {
    const interval = setInterval(() => {
      updatePrices(undefined, true);
    }, 60 * 1000);
    return () => clearInterval(interval);
  }, [updatePrices]);

  useEffect(() => {
    if (!currentChart) {
      return;
    }
    const resizeChart = () => {
      currentChart.resize(
        chartRef.current.offsetWidth,
        chartRef.current.offsetHeight
      );
    };
    window.addEventListener("resize", resizeChart);
    return () => window.removeEventListener("resize", resizeChart);
  }, [currentChart]);

  useEffect(() => {
    if (currentSeries && priceData && priceData.length) {
      currentSeries.setData(priceData);

      if (!chartInited) {
        scaleChart();
        setChartInited(true);
      }
    }
  }, [priceData, currentSeries, chartInited, scaleChart]);

  let high;
  let low;
  let deltaPrice;
  let currentAveragePrice;
  let delta;
  let deltaPercentage;
  let deltaPercentageStr;

  const now = parseInt(Date.now() / 1000);
  const timeThreshold = now - 24 * 60 * 60;

  if (priceData) {
    for (let i = priceData.length - 1; i > 0; i--) {
      const { time, value } = priceData[i];
      if (time < timeThreshold) {
        break;
      }
      if (!low) {
        low = value;
      }
      if (!high) {
        high = value;
      }

      if (value > high) {
        high = value;
      }
      if (value < low) {
        low = value;
      }

      deltaPrice = value;
    }
  }

  if (chartToken.minPrice && chartToken.maxPrice) {
    currentAveragePrice = chartToken.maxPrice.add(chartToken.minPrice).div(2);
  }

  if (deltaPrice && currentAveragePrice) {
    const average = parseFloat(
      formatAmount(currentAveragePrice, USD_DECIMALS, 2)
    );
    delta = average - deltaPrice;
    deltaPercentage = (delta * 100) / average;
    if (deltaPercentage > 0) {
      deltaPercentageStr = `+${deltaPercentage.toFixed(2)}%`;
    } else {
      deltaPercentageStr = `${deltaPercentage.toFixed(2)}%`;
    }
    if (deltaPercentage === 0) {
      deltaPercentageStr = "0.00";
    }
  }

  return (
    <div className="ExchangeChart tv" ref={ref}>
      <div className="ExchangeChart-top border App-box">
        <div className="ExchangeChart-top-inner">
          <div>
            <div className="ExchangeChart-title">
              {chartToken && `${chartToken.symbol} / USD`}
            </div>
          </div>
          <div>
            <div className="ExchangeChart-main-price">
              {formatAmount(chartToken.maxPrice, USD_DECIMALS, 2)}
            </div>
            <div className="ExchangeChart-info-label">
              ${formatAmount(chartToken.minPrice, USD_DECIMALS, 2)}
            </div>
          </div>
          <div>
            <div className="ExchangeChart-info-label">24h Change</div>
            <div
              className={cx({
                positive: deltaPercentage > 0,
                negative: deltaPercentage < 0,
              })}
            >
              {!deltaPercentageStr && "-"}
              {deltaPercentageStr && deltaPercentageStr}
            </div>
          </div>
          <div className="ExchangeChart-additional-info">
            <div className="ExchangeChart-info-label">24h High</div>
            <div>
              {!high && "-"}
              {high && high.toFixed(2)}
            </div>
          </div>
          <div className="ExchangeChart-additional-info">
            <div className="ExchangeChart-info-label">24h Low</div>
            <div>
              {!low && "-"}
              {low && low.toFixed(2)}
            </div>
          </div>
        </div>
      </div>
      <div className="ExchangeChart-bottom border" ref={chartRef}></div>
    </div>
  );
}
