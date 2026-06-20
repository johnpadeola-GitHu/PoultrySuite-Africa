// ─────────────────────────────────────────────────────────────────────────
// <Money> — render an amount in the active display currency.
//
// Replaces direct `ngn(x)` calls throughout the codebase.
//
// Props:
//   amount        — number to display
//   from          — original currency the amount was recorded in (if any).
//                   When provided and different from active currency, the
//                   amount is converted before display.
//   compact       — use compact notation (e.g. ₦2.5M)
//   decimals      — override default decimal places
//   symbol        — false to omit the currency symbol
//   showOriginal  — when converted, also show the original amount in parens
//   className     — passthrough for styling
//   as            — element type (defaults to <span>)
// ─────────────────────────────────────────────────────────────────────────

import React from 'react';
import { useCurrency } from '../CurrencyContext.jsx';
import { formatMoney } from '../format.js';

export function Money({
  amount,
  from,
  compact = false,
  decimals,
  symbol = true,
  showOriginal = false,
  className,
  as: Tag = 'span',
  style,
  title,
}) {
  const { currencyCode, format, convert } = useCurrency();

  const displayed =
    from && from !== currencyCode ? convert(amount, from, currencyCode) : amount;

  const primary = format(displayed, { compact, decimals, symbol });

  if (showOriginal && from && from !== currencyCode) {
    return (
      <Tag className={className} style={style} title={title}>
        {primary}{' '}
        <span style={{ opacity: 0.55, fontSize: '0.85em' }}>
          ({formatMoney(amount, from, { compact, decimals })})
        </span>
      </Tag>
    );
  }

  return (
    <Tag className={className} style={style} title={title}>
      {primary}
    </Tag>
  );
}

export default Money;
