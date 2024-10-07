import { EDatabaseTypes } from './EDatabaseTypes';
import { BaseModel } from '../../models';

export interface IDatabaseField {
  type: EDatabaseTypes;
  maxSize?: number;
  nullable: boolean;
  minSize?: number;
  unique?: boolean;
  default?: any;
  autoIncrement?: boolean;
  primaryKey?: boolean;
  foreignKey?: {
    table: BaseModel,
    field: string,
    onDelete?: 'CASCADE' | 'RESTRICT' | 'NO ACTION' | 'SET NULL',
    onUpdate?: 'CASCADE' | 'RESTRICT' | 'NO ACTION' | 'SET NULL',
  };
}
