import { EDatabaseQueryFilterOperator, EDatabaseTypes, IDatabaseField, IDatabaseQueryFilterExpression } from '../interfaces';
import { DatabaseConnection } from '../connection';
import { DatabaseException } from '../errors';

/**
 * The BaseModel class is a class that represents a model in the database
 * @class
 */
export class BaseModel {
  protected connection?: DatabaseConnection;
  protected fields: Record<string, IDatabaseField> = {};
  protected nonNullableFields: string[] = [];
  protected name?: string;
  private isReady = false;

  /**
   * Create a new instance of the BaseModel
   * @param fields The fields of the model
   * @throws [{@link DatabaseException}]
   * @constructor
   */
  constructor(fields: Record<string, IDatabaseField>) {
    this.fields = fields;
    this.nonNullableFields = Object.keys(fields).filter((fieldKey) => !fields[fieldKey].nullable && !fields[fieldKey].autoIncrement && !fields[fieldKey].default);

    Object.keys(fields).forEach((fieldKey) => {
      if (fields[fieldKey].foreignKey) {
        if (fields[fieldKey].foreignKey!.table === this) throw new DatabaseException(`${fieldKey} foreign key's table references the model itself (Circular Model dependence).`);
        if (!fields[fieldKey].foreignKey!.table.fields[fields[fieldKey].foreignKey!.field]) throw new DatabaseException(`Field ${fieldKey} has a foreign key with a field that doesn't exists on the table.`);
        if (fields[fieldKey].foreignKey!.table.fields[fields[fieldKey].foreignKey!.field].type !== fields[fieldKey].type) throw new DatabaseException(`Foreign key field ${fieldKey} has a different type than the one referenced.`);
        if (fields[fieldKey].foreignKey!.table.fields[fields[fieldKey].foreignKey!.field].maxSize !== fields[fieldKey].maxSize) throw new DatabaseException(`Foreign key field ${fieldKey} has a different maxSize than the one referenced.`);
        if (fields[fieldKey].foreignKey!.table.fields[fields[fieldKey].foreignKey!.field].minSize !== fields[fieldKey].minSize) throw new DatabaseException(`Foreign key field ${fieldKey} has a different minSize than the one referenced.`);
      }
    });
  }

  /**
   * Register the model in the database
   * @param tableName The name of the table
   * @param connection The connection to the database
   * @throws [{@link DatabaseException}]
   */
  public async register(tableName: string, connection: DatabaseConnection): Promise<void> {
    this.name = tableName;
    this.connection = connection;

    await connection.createOrUpdateTable(this.name, this.fields);
    this.isReady = true;
  }

  /**
   * @private
   * @throws [{@link DatabaseException}]
   */
  private checkIsReady(): void {
    if (!this.isReady) throw new DatabaseException('Attemped to use model before registering on DataBaseManager!');
  }

  /**
   * Get the name of the model
   * @returns The name of the model
   * @throws [{@link DatabaseException}]
   */
  public getName(): string {
    this.checkIsReady();
    return this.name!;
  }

  /**
   * @private
   * @throws [{@link DatabaseException}]
   */
  private validFieldsCheck(data: Record<string, any>): void {
    if (Object.keys(data).length === 0) throw new DatabaseException(`No data has been provided!`);
    if (this.nonNullableFields.find((key) => data[key] == null)) throw new DatabaseException(`A non nullable field has not been provided! ${this.nonNullableFields.join(', ')}`);
    if (Object.keys(data).find((key) => this.nonNullableFields.includes(key) && (data[key] == null || data[key] === ''))) throw new DatabaseException(`An null param has given to a non nullable field!`);
    Object.keys(data).find((key) => {
      if (!this.fields[key]) throw new DatabaseException(`Field ${key} doesn't exists in ${this.name} table!`);
      if (this.fields[key].type === EDatabaseTypes.SINT || this.fields[key].type === EDatabaseTypes.UINT) {
        if (typeof data[key] !== 'number') throw new DatabaseException(`Field ${key} has to be a number!`);
        if (Math.floor(data[key]) !== data[key]) throw new DatabaseException(`Field ${key} has to be an integer!`);
        if (this.fields[key].type === EDatabaseTypes.UINT && (data[key] < 0)) throw new DatabaseException(`Field ${key} cannot be negative as is unsigned!`);
        if (this.fields[key].minSize && data[key] < this.fields[key].minSize!) throw new DatabaseException(`Field ${key} has a minimum size of ${this.fields[key].minSize}!`);
        if (this.fields[key].maxSize && data[key] > this.fields[key].maxSize!) throw new DatabaseException(`Field ${key} has a maximum size of ${this.fields[key].maxSize}!`);
      }
      if (this.fields[key].type === EDatabaseTypes.BOOLEAN && typeof data[key] !== 'boolean') throw new DatabaseException(`Field ${key} has to be a boolean!`);
      if (this.fields[key].type === EDatabaseTypes.STRING && typeof data[key] !== 'string') throw new DatabaseException(`Field ${key} has to be a string!`);
      if (this.fields[key].type === EDatabaseTypes.DECIMAL) {
        if (typeof data[key] !== 'number') throw new DatabaseException(`Field ${key} has to be a number!`);
        if (this.fields[key].minSize && data[key] < this.fields[key].minSize!) throw new DatabaseException(`Field ${key} has a minimum size of ${this.fields[key].minSize}!`);
        if (this.fields[key].maxSize && data[key] > this.fields[key].maxSize!) throw new DatabaseException(`Field ${key} has a maximum size of ${this.fields[key].maxSize}!`);
      }
      return true;
    });
  }

  /**
   * Find data in the model
   * @param query The query to be used to find the data
   * @returns The data found
   * @throws [{@link DatabaseException}]
   */
  public async find(query?: Record<string, any>, limit?: number): Promise<Record<string, unknown>[]> {
    this.checkIsReady();
    return this.connection!.read('*', this.name!,
      query
        ? {
          type: 'AND',
          filters: Object.keys(query).map((fieldKey) => ({
            tableKey: fieldKey,
            operator: EDatabaseQueryFilterOperator.EQUALS,
            value: query[fieldKey],
          })),
        }
        : undefined,
      limit,
    );
  }

  /**
   * Find one data in the model
   * @param query The query to be used to find the data
   * @returns The data found
   * @throws [{@link DatabaseException}]
   */
  public async findOne(query?: Record<string, any>): Promise<Record<string, unknown> | undefined> {
    return Promise.resolve((await this.find(query, 1))[0]);
  }

  /**
   * Create data in the model
   * @param data The data to be created
   * @throws [{@link DatabaseException}]
   */
  public async create(data: Record<string, any>): Promise<Record<string, unknown>> {
    this.checkIsReady();
    this.validFieldsCheck(data);
    const values = Object.keys(this.fields).filter((field) => !this.fields[field].autoIncrement).map((fieldKey) => data[fieldKey] ?? null);
    return this.connection!.create(this.name!, Object.keys(this.fields).filter((field) => !this.fields[field].autoIncrement), values);
  }

  /**
   * Update data in the model
   * @param find The query to be used to find the data
   * @param update The data to be updated
   * @throws [{@link DatabaseException}]
   */
  public async update(find: Record<string, any>, update: Record<string, any>): Promise<boolean> {
    this.checkIsReady();
    this.validFieldsCheck(update);
    const filter: IDatabaseQueryFilterExpression = {
      type: 'AND',
      filters: Object.keys(find).map((fieldKey) => ({
        tableKey: fieldKey,
        operator: EDatabaseQueryFilterOperator.EQUALS,
        value: find[fieldKey],
      })),
    };
    const values = Object.keys(this.fields).filter((field) => !this.fields[field].autoIncrement).map((fieldKey) => update[fieldKey] ?? null);
    return this.connection!.update(this.name!, Object.keys(this.fields).filter((field) => !this.fields[field].autoIncrement), values, filter);
  }

  /**
   * Delete data in the model
   * @param find The query to be used to find the data
   * @throws [{@link DatabaseException}]
   */
  public async delete(find: Record<string, any>): Promise<boolean> {
    this.checkIsReady();
    const filter: IDatabaseQueryFilterExpression = {
      type: 'AND',
      filters: Object.keys(find).map((fieldKey) => ({
        tableKey: fieldKey,
        operator: EDatabaseQueryFilterOperator.EQUALS,
        value: find[fieldKey],
      })),
    };
    return this.connection!.delete(this.name!, filter);
  }
}
