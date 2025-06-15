import { IDatabaseField, IDatabaseQueryFilterExpression } from '../interfaces';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { DatabaseException } from '../errors';
import { BaseModel } from '../models';

export abstract class DatabaseConnection {
  protected registeredModels: Map<string, BaseModel> = new Map();
  protected isConnected: boolean = false;

  /**
   * Register a model in the database
   * @param name The name of the model
   * @param model The model to register
   * @returns The model that was registered
   * @throws An error if a model with the given name already exists
   */
  public async registerModel(name: string, model: BaseModel): Promise<BaseModel> {
    if (this.registeredModels.has(name)) throw new Error(`Model with the name '${name}' is already registered in this database connection!`);
    await model.register(name, this);
    this.registeredModels.set(name, model);
    return Promise.resolve(model);
  }

  /**
   * Get a model by name
   * @param name The name of the model
   * @returns The model with the given name or null if it does not exist
   */
  public getModel(name: string): BaseModel | null {
    return this.registeredModels.get(name) || null;
  }

  /**
   * Connect to the database
   * @returns A promise that resolves when the connection is established
   * @abstract
   */
  public abstract connect(): Promise<void>

  /**
   * Disconnect from the database
   * @returns A promise that resolves when the connection is closed
   * @abstract
   */
  public abstract disconnect(): Promise<void>

  /**
   * Create a new record in the database
   * @param database The name of the database
   * @param keys The keys of the record
   * @param values The values of the record
   * @returns A promise that resolves when the record is created
   * @throws [{@link DatabaseException}]
   * @abstract
   */
  public abstract create(database: string, keys: string[], values: any[]): Promise<Record<string, any>>

  /**
   * Read records from the database
   * @param keys The keys of the records to read
   * @param database The name of the database
   * @param filter The filter to apply to the records
   * @returns A promise that resolves with the records that match the filter
   * @throws [{@link DatabaseException}]
   * @abstract
   */
  public abstract read(keys: ('*' | string[]), database: string, filter?: IDatabaseQueryFilterExpression, limit?: number): Promise<Record<string, any>[]>

  /**
   * Inserts data on database, if it already exists, updates the selected fields
   */
  public abstract upsert(database: string, keys: string[], values: any[], updateFields: string[]): Promise<Record<string, any>>

  /**
   * Update records in the database
   * @param database The name of the database
   * @param fields The fields to update
   * @param newData The new data to set
   * @param filter The filter to apply to the records
   * @returns A promise that resolves when the records are updated
   * @throws [{@link DatabaseException}]
   * @abstract
   */
  public abstract update(database: string, fields: string[], newData: any[], filter: IDatabaseQueryFilterExpression): Promise<Record<string, any>>

  /**
   * Delete records from the database
   * @param database The name of the database
   * @param filter The filter to apply to the records
   * @returns A promise that resolves when the records are deleted
   * @throws [{@link DatabaseException}]
   * @abstract
   */
  public abstract delete(database: string, filter: IDatabaseQueryFilterExpression): Promise<number>

  /**
   * Create a table in the database
   * @param tableName The name of the table
   * @param fields The fields of the table
   * @returns A promise that resolves when the table is created
   * @throws [{@link DatabaseException}]
   * @abstract
   */
  public abstract createTable(tableName: string, fields: Record<string, IDatabaseField>): Promise<void>

  /**
   * Create or update a table in the database
   * @param tableName The name of the table
   * @param fields The fields of the table
   * @returns A promise that resolves when the table is created or updated
   * @throws [{@link DatabaseException}]
   * @abstract
   */
  public abstract createOrUpdateTable(tableName: string, fields: Record<string, IDatabaseField>): Promise<void>
}
