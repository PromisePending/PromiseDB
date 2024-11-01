import { IDatabaseQueryFilter } from '.';

export interface IDatabaseQueryFilterExpression {
  type: 'AND' | 'OR';
  filters: (IDatabaseQueryFilter | IDatabaseQueryFilterExpression)[];
}
