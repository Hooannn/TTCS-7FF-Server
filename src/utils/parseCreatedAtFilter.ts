import { Raw } from 'typeorm';

export const parseCreatedAtFilter = (parseFilter: any) => {
  if (parseFilter.createdAt) {
    if (parseFilter.createdAt.start && parseFilter.createdAt.end)
      parseFilter.createdAt = Raw(alias => `Date(${alias}) >= Date(:start) AND Date(${alias}) <= Date(:end)`, {
        start: parseFilter.createdAt.start,
        end: parseFilter.createdAt.end,
      });
    else if (parseFilter.createdAt.start)
      parseFilter.createdAt = Raw(alias => `Date(${alias}) >= Date(:start)`, { start: parseFilter.createdAt.start });
    else if (parseFilter.createdAt.end) parseFilter.createdAt = Raw(alias => `Date(${alias}) <= Date(:end)`, { end: parseFilter.createdAt.end });
    else delete parseFilter.createdAt;
  }
};
