import React from 'react'

import cx from "classnames";

import '../../css/components/Tab/Tab.css';

export default function Tab(props) {
  const { options, option, setOption, onChange, type = 'block', className } = props

  const onClick = (opt) => {
    if (setOption) {
      setOption(opt)
    }
    if (onChange) {
      onChange(opt)
    }
  }

  const _className = ['Tab', type, className].filter(Boolean).join(' ');
  return (
    <div className={_className}>
      {options.map(opt =>
        <div className={cx("Tab-option", "muted", { active: opt === option})} onClick={() => onClick(opt)} key={opt}>
          {opt}
        </div>)
      }
    </div>
  )
}
