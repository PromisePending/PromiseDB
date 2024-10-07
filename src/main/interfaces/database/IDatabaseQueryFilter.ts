import { EDatabaseQueryFilterOperator } from '.';

export interface IDatabaseQueryFilter {
  tableKey: string;
  operator: EDatabaseQueryFilterOperator;
  value: (string | number | boolean | string[] | number[] | boolean[] | null);
}
