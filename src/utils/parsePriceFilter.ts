import { Raw } from 'typeorm';

export const parsePriceFilter = (parseFilter: any) => {
  if (parseFilter.currentPrice) {
    if (parseFilter.currentPrice.start && parseFilter.currentPrice.end)
      parseFilter.currentPrice = Raw(alias => `${alias} >= :start AND ${alias} <= :end`, {
        start: parseFilter.currentPrice.start,
        end: parseFilter.currentPrice.end,
      });
    else if (parseFilter.currentPrice.start) parseFilter.currentPrice = Raw(alias => `${alias} >= :start`, { start: parseFilter.currentPrice.start });
    else if (parseFilter.currentPrice.end) parseFilter.currentPrice = Raw(alias => `${alias} <= :end`, { end: parseFilter.currentPrice.end });
    else delete parseFilter.currentPrice;
  }
};
