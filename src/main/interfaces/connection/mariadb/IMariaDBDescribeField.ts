import { EMariaDBFieldTypes } from '..';

export interface IMariaDBDescribeField {
  Field: string;
  Type: `${EMariaDBFieldTypes}(${number})${' unsigned' | ''}`;
  Null: 'YES' | 'NO';
  Key: 'PRI' | 'UNI' | 'MUL' | '';
  Default: unknown | null;
  Extra: 'auto_increment' | '';
}
