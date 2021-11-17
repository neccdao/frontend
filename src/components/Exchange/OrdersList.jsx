import React, { useState, useEffect } from 'react'

import { BsArrowRight } from 'react-icons/bs'

import Modal from '../Modal/Modal'
import {
  CHAIN_ID, 
  SWAP,
  LIMIT,
  USD_DECIMALS,
  BASIS_POINTS_DIVISOR,
  getExchangeRateDisplay,
  formatAmount,
  useOrders,
  formatAmountFree,
  parseValue,
  getTokenInfo,
  getExchangeRate,
  getNextToAmount
} from '../../Helpers';
import { getToken } from '../../data/Tokens'
import ExchangeInfoRow from './ExchangeInfoRow'
import {
  cancelOrder,
  updateOrder,
  executeOrder
} from '../../Api'

import '../../css/components/Exchange/OrdersList.css';

export default function OrdersList(props) {
  const { 
    active, 
    library, 
    account,
    setPendingTxns,
    pendingTxns,
    infoTokens
  } = props;

  const [orders, mutateOrders] = useOrders(account, library, account);
  const [editingOrder, setEditingOrder] = useState(null);

  useEffect(() => {
    function onBlock() {
      mutateOrders(undefined, undefined, true)
    }
    if (active) {
      library.on('block', onBlock)
      return () => {
        library.removeListener('block', onBlock)
      }
    }
  }, [active, library, mutateOrders])

  const onUpdateClick = (orderIndex, minOut, triggerRatio, triggerAboveThreshold) => {
    return updateOrder(library, orderIndex, minOut, triggerRatio, triggerAboveThreshold, {
      successMsg: "Order updated",
      failMsg: "Order update failed",
      sentMsg: "Update order",
      pendingTxns,
      setPendingTxns
    }).then(() => {
      setEditingOrder(null);
      mutateOrders(undefined, undefined, true);
    });
  }

  const onExecuteClick = (order) => {
    executeOrder(library, order.account, order.index, account, {
      successMsg: "Order executed",
      toastError: "Execution failed",
      setPendingTxns,
      pendingTxns
    });
  }

  const onCancelClick = (order) => {
    cancelOrder(library, order.index, {
      successMsg: "Order cancelled",
      failMsg: "Order cancel failed",
      sentMsg: "Cancel order",
      pendingTxns,
      setPendingTxns
    }).then(() => {
      mutateOrders(undefined, undefined, true);
    });
  }

  const onEditClick = (order) => {
    setEditingOrder(order);
  }

	function renderHead() {
		return (
      <thead>
        <tr className="Exchange-positions-header">
          <th>
            <div>Order</div>
          </th>
          <th>
            <div>Price</div>
          </th>
          <th>
            <div>Type</div>
          </th>
          <th></th>
          <th></th>
        </tr>
			</thead>
		);
	}

  function renderEmptyRow() {
    if (orders && orders.length) {
      return null;
    }

    return <tr><td colSpan="5">No open orders</td></tr>;
  }

  function renderList() {
    if (!orders || !orders.length) {
      return null;
    }

    return orders.map(order => {
      const fromToken = getToken(CHAIN_ID, order.fromTokenAddress);
      const toToken = getToken(CHAIN_ID, order.toTokenAddress);

      return (
        <tr className="Orders-list-item" key={`${order.orderType}-${order.index}`}>
          <td>
            Swap {formatAmount(order.amountIn, fromToken.decimals, 4, true)} {fromToken.symbol}
            &nbsp;
            <BsArrowRight className="transition-arrow" />
            &nbsp;
            {formatAmount(order.minOut, toToken.decimals, 4, true)} {toToken.symbol}
          </td>
          <td>{getExchangeRateDisplay(order.triggerRatio, fromToken, toToken)}</td>
          <td>{order.orderType}</td>
          <td>
            <button className="Orders-list-action" onClick={() => onEditClick(order)}>
              Edit
            </button>
          </td>
          <td>
            <button className="Orders-list-action" onClick={() => onCancelClick(order)}>
              Cancel
            </button>
          </td>
          <td>
            <button className="Orders-list-action" onClick={() => onExecuteClick(order)}>
              Execute
            </button>
          </td>
        </tr>
      );
    })
  }

	return (
    <React.Fragment>
  		<table className="Orders-list">
        {renderHead()}
        <tbody>
          {renderEmptyRow()}
          {renderList()}
        </tbody>
      </table>
      {editingOrder && 
        <OrderEditor
          order={editingOrder}
          setEditingOrder={setEditingOrder} 
          infoTokens={infoTokens} 
          onUpdateClick={onUpdateClick}
        />
      }
    </React.Fragment>
	);
}

function OrderEditor(props) {
  const {
    order, 
    setEditingOrder,
    infoTokens,
    onUpdateClick
  } = props;

  const {
    fromTokenAddress,
    toTokenAddress,
    orderType,
    swapOption
  } = order;

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [triggerRatioValue, setTriggerRatioValue] = useState(formatAmountFree(order.triggerRatio, USD_DECIMALS, 6));
  const triggerRatio = triggerRatioValue ? parseValue(triggerRatioValue, USD_DECIMALS) : 0;

  const fromTokenInfo = getTokenInfo(infoTokens, fromTokenAddress)
  const toTokenInfo = getTokenInfo(infoTokens, toTokenAddress)

  const { amount: toAmount } = getNextToAmount(
    order.amountIn,
    order.fromTokenAddress,
    order.toTokenAddress,
    infoTokens,
    undefined,
    triggerRatio
  )
  const newMinOut = toAmount.mul(BASIS_POINTS_DIVISOR - 50).div(BASIS_POINTS_DIVISOR)

  const onClickPrimary = () => {
    setIsSubmitting(true);
    onUpdateClick(order.index, newMinOut, triggerRatio, order.triggerAboveThreshold).finally(() => {
      setIsSubmitting(false);
    });
  }

  const isPrimaryEnabled = () => {
    return !!triggerRatio && !triggerRatio.eq(order.triggerRatio) && !isSubmitting;
  }

  const onTriggerRatioChange = (evt) => {
    setTriggerRatioValue(evt.target.value || '')
  }

  const getPrimaryText = () => {
    if (isSubmitting) {
      return "Updating order...";
    }
    if (!triggerRatio) {
      return "Enter a trigger price";
    }
    if (triggerRatio.eq(order.triggerRatio)) {
      return "Enter a new trigger price";
    }
    return "Update Order";
  }

  function renderTriggerRatioWarning() {
    if (swapOption !== SWAP) {
      return null;
    }
    const currentRate = getExchangeRate(fromTokenInfo, toTokenInfo);
    if (orderType === LIMIT && !currentRate.gt(triggerRatio)) {
      return (
        <div className="Orders-list-modal-warning ">
          WARNING: Trigger Price is higher then current price and order will be executed immediatelly
        </div>
      );
    }
  }

  return (
    <Modal isVisible={true} className="Orders-list-modal" setIsVisible={() => setEditingOrder(null)} label="Edit order">
      <div className="Exchange-swap-section">
        <div className="Exchange-swap-section-top">
          <div className="muted">
            Trigger Price
          </div>
          {fromTokenInfo && toTokenInfo &&
            <div 
              className="muted align-right clickable" 
              onClick={() => {setTriggerRatioValue(formatAmountFree(getExchangeRate(fromTokenInfo, toTokenInfo), USD_DECIMALS, 6))}}
            >
              {formatAmount(getExchangeRate(fromTokenInfo, toTokenInfo), USD_DECIMALS, 6)}
            </div>
          }
        </div>
        <div className="Exchange-swap-section-bottom">
          <div className="Exchange-swap-input-container">
            <input type="number" placeholder="0.0" className="Exchange-swap-input" value={triggerRatioValue} onChange={onTriggerRatioChange} />
          </div>
          {toTokenInfo &&
            <div className="PositionEditor-token-symbol">
              {fromTokenInfo.symbol}&nbsp;per&nbsp;{toTokenInfo.symbol}
            </div>
          }
        </div>
      </div>
      {renderTriggerRatioWarning()}
      <ExchangeInfoRow label="Minimum received" isTop={true}>
        {formatAmount(order.minOut, toTokenInfo.decimals, 4, true)}
        {triggerRatio && !triggerRatio.eq(order.triggerRatio) &&
          <React.Fragment>
            &nbsp;
            <BsArrowRight />
            &nbsp;
            {formatAmount(newMinOut, toTokenInfo.decimals, 4, true)}
          </React.Fragment>
        }
        &nbsp;{toTokenInfo.symbol}
      </ExchangeInfoRow>
      <ExchangeInfoRow label="Trigger price">
        {formatAmount(order.triggerRatio, USD_DECIMALS, 4, true)}
        {triggerRatio && !triggerRatio.eq(order.triggerRatio) &&
          <React.Fragment>
            &nbsp;
            <BsArrowRight />
            &nbsp;
            {formatAmount(triggerRatio, USD_DECIMALS, 4, true)}
          </React.Fragment>
        }
      </ExchangeInfoRow>
      {fromTokenInfo &&
        <div className="Exchange-info-row">
          <div className="Exchange-info-label">{fromTokenInfo.symbol} price</div>
          <div className="align-right">{formatAmount(fromTokenInfo.minPrice, USD_DECIMALS, 4, true)} USD</div>
        </div>
      }
      {toTokenInfo &&
        <div className="Exchange-info-row">
          <div className="Exchange-info-label">{toTokenInfo.symbol} price</div>
          <div className="align-right">{formatAmount(toTokenInfo.maxPrice, USD_DECIMALS, 4, true)} USD</div>
        </div>
      }
      <div className="Exchange-swap-button-container">
        <button className="App-cta Exchange-swap-button Orders-list-modal-button" onClick={ onClickPrimary } disabled={!isPrimaryEnabled()}>
          {getPrimaryText()}
        </button>
      </div>
    </Modal>
  );
}