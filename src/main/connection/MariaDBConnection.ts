import { EDatabaseTypes, EMariaDBFieldTypes, IDatabaseField, IDatabaseQueryFilter, IDatabaseQueryFilterExpression, IMariaDBDescribeField, IMariaDBField } from '../interfaces';
import { DatabaseConnection } from './DatabaseConnection';
import mariaDB from 'mariadb';
import { DatabaseException } from '../errors';

export class MariaDBConnection extends DatabaseConnection {
  private hostname: string;
  private username: string;
  private password: string;
  private database: string;
  private port: number;

  private pool?: mariaDB.Pool;
  private isConnecting: boolean;

  constructor(hostname: string, port: number, username: string, password: string, database: string) {
    super();

    this.hostname = hostname;
    this.username = username;
    this.password = password;
    this.database = database;
    this.port = port;

    this.isConnecting = false;
  }

  override async connect(): Promise<void> {
    if (this.isConnected || this.isConnecting) return Promise.resolve();
    this.pool = mariaDB.createPool({
      host: this.hostname,
      user: this.username,
      password: this.password,
      port: this.port,
      database: this.database,
      connectionLimit: 10,
    });
    this.isConnecting = true;
    const tmpConn = await this.pool.getConnection();
    await tmpConn.release();
    this.isConnecting = false;
    this.isConnected = true;
  }

  override async disconnect(): Promise<void> {
    if (!this.isConnected) return;
    await this.pool?.end();
    this.isConnected = false;
  }

  /**
   * @private
   */
  private filterBuilder(conn: mariaDB.PoolConnection, filter: IDatabaseQueryFilter | IDatabaseQueryFilterExpression): string {
    if (filter.hasOwnProperty('tableKey')) {
      const { tableKey, operator, value } = filter as IDatabaseQueryFilter;
      return `${conn.escapeId(tableKey)} ${operator} ${conn.escape(value)}`;
    }
    return `(${(filter as IDatabaseQueryFilterExpression).filters.map((filter) => this.filterBuilder(conn, filter)).join(` ${(filter as IDatabaseQueryFilterExpression).type} `)})`;
  }

  /**
   * @private
   */
  override async create(database: string, keys: string[], values: any[]): Promise<void> {
    if (!this.isConnected) throw new DatabaseException('Database is not connected!');
    const conn = await this.pool!.getConnection();
    await conn.execute(`INSERT INTO ${conn.escapeId(database)} (${keys.map((key) => conn.escapeId(key)).join(', ')}) VALUES (${values.map((value) => conn.escape(value)).join(', ')})`);
    await conn.release();
  }

  /**
   * @private
   */
  override async read(keys: ('*' | string[]), database: string, filter?: IDatabaseQueryFilterExpression): Promise<Record<string, any>[]> {
    if (!this.isConnected) throw new DatabaseException('Database is not connected!');
    const conn = await this.pool!.getConnection();
    const result = await conn.query<Record<string, any>[]>(`SELECT ${typeof keys === 'string' ? '*' : keys.map(key => conn.escapeId(key)).join(', ')} FROM ${conn.escapeId(database)} ${filter ? `WHERE ${this.filterBuilder(conn, filter)}` : ''}`);
    await conn.release();
    return result;
  }

  /**
   * @private
   */
  override async update(database: string, fields: string[], newData: any[], filter: IDatabaseQueryFilterExpression): Promise<void> {
    if (!this.isConnected) throw new DatabaseException('Database is not connected!');
    const conn = await this.pool!.getConnection();
    await conn.query(`UPDATE ${conn.escapeId(database)} SET ${fields.map((field, index) => `${conn.escapeId(field)} = ${conn.escape(newData[index])}`).join(', ')} WHERE ${this.filterBuilder(conn, filter)}`);
    await conn.release();
  }

  /**
   * @private
   */
  override async delete(database: string, filter: IDatabaseQueryFilterExpression): Promise<void> {
    if (!this.isConnected) throw new DatabaseException('Database is not connected!');
    const conn = await this.pool!.getConnection();
    await conn.query(`DELETE FROM ${conn.escapeId(database)} WHERE ${this.filterBuilder(conn, filter)}`);
    await conn.release();
  }

  /**
   * @private
   */
  private convertTypes(field: IDatabaseField): IMariaDBField {
    if (!field.maxSize && field.type !== EDatabaseTypes.BOOLEAN) throw new DatabaseException('Any field must have a maxSize!');
    const finalObject: IMariaDBField = {
      type: EMariaDBFieldTypes.string,
      attributes: '',
      typeSize: field.maxSize ?? 1,
      nullable: field.nullable,
      primaryKey: (field.primaryKey && (field.type === EDatabaseTypes.UINT || field.type === EDatabaseTypes.SINT)) ?? false,
      autoIncrement: field.autoIncrement ?? false,
      unique: field.unique ?? false,
      default: field.default,
    };
    switch (field.type) {
      case EDatabaseTypes.DECIMAL:
        finalObject.type = EMariaDBFieldTypes.decimal;
        break;
      case EDatabaseTypes.TIMESTAMP:
        finalObject.type = EMariaDBFieldTypes.timestamp;
        break;
      case EDatabaseTypes.STRING:
        finalObject.type = EMariaDBFieldTypes.string;
        break;
      case EDatabaseTypes.BOOLEAN:
        finalObject.type = EMariaDBFieldTypes.boolean;
        break;
      case EDatabaseTypes.SINT:
      case EDatabaseTypes.UINT:
        if (field.type === EDatabaseTypes.UINT) finalObject.attributes = 'UNSIGNED';
        finalObject.typeSize = Math.ceil(Math.log10(field.maxSize!));
        var amountOfBytes = Math.ceil(Math.log2(field.type === EDatabaseTypes.SINT ? field.maxSize! * 2 : field.maxSize!) / 8);
        if (amountOfBytes === 0 || amountOfBytes === 1) finalObject.type = EMariaDBFieldTypes.tinyint;
        else if (amountOfBytes === 2) finalObject.type = EMariaDBFieldTypes.smallint;
        else if (amountOfBytes === 3) finalObject.type = EMariaDBFieldTypes.mediumint;
        else if (amountOfBytes === 4) finalObject.type = EMariaDBFieldTypes.int;
        else if (amountOfBytes >= 5 && amountOfBytes <= 8) finalObject.type = EMariaDBFieldTypes.bigint;
        else throw new DatabaseException('Invalid size for INT');
        break;
      default:
        throw new DatabaseException('Invalid field type!');
    }
    if (field.foreignKey) finalObject.foreignKey = { ...field.foreignKey, table: field.foreignKey.table.getName() };
    return finalObject;
  }

  /**
   * @private
   */
  private createSQLField(conn: mariaDB.PoolConnection, name: string, data: IDatabaseField): string {
    const convertedTypes = this.convertTypes(data);
    let field = conn.escapeId(name) + ' ';
    field += convertedTypes.type;
    if (convertedTypes.type !== EMariaDBFieldTypes.boolean) field += '(' + convertedTypes.typeSize.toString() + ')';
    field += ' ' + convertedTypes.attributes;
    if (!convertedTypes.nullable) field += ' NOT NULL';
    if (convertedTypes.default) field += ' DEFAULT ' + conn.escape(convertedTypes.default);
    if (convertedTypes.autoIncrement) field += ' AUTO_INCREMENT';
    return field;
  }

  override async createTable(tableName: string, fields: Record<string, IDatabaseField>): Promise<void> {
    if (!this.isConnected) throw new DatabaseException('Database is not connected!');
    const conn = await this.pool!.getConnection();

    const fieldsKeys = Object.keys(fields);
    const tableFields = fieldsKeys.map((fieldKey) => this.createSQLField(conn, fieldKey, fields[fieldKey]));
    const primaryKeys: string[] = [];
    const uniqueKeys: string[] = [];
    fieldsKeys.forEach((fieldKey) => {
      if (fields[fieldKey].primaryKey) primaryKeys.push(conn.escapeId(fieldKey));
      if (fields[fieldKey].unique) uniqueKeys.push(conn.escapeId(fieldKey));
    });

    // Add the constraints
    if (primaryKeys.length > 0) tableFields.push(`PRIMARY KEY (${primaryKeys.join(', ')})`);
    uniqueKeys.filter((key) => !primaryKeys.includes(key)).forEach((key) => tableFields.push(`UNIQUE INDEX ${key} (${key})`));
    fieldsKeys.filter(key => fields[key].foreignKey).forEach((key) => {
      let query = `FOREIGN KEY (${conn.escapeId(key)}) REFERENCES ${conn.escapeId(fields[key].foreignKey!.table.getName())}(${conn.escapeId(fields[key].foreignKey!.field)})`;
      if (fields[key].foreignKey!.onDelete) query += ` ON DELETE ${conn.escapeId(fields[key].foreignKey!.onDelete!)}`;
      if (fields[key].foreignKey!.onUpdate) query += ` ON UPDATE ${conn.escapeId(fields[key].foreignKey!.onUpdate!)}`;
      tableFields.push(query);
    });

    await conn.query(`CREATE TABLE ${conn.escapeId(tableName)} (${tableFields.join(', ')})`);
    await conn.release();
  }

  override async createOrUpdateTable(tableName: string, fields: Record<string, IDatabaseField>): Promise<void> {
    if (!this.isConnected) throw new DatabaseException('Database is not connected!');
    const conn = await this.pool!.getConnection();

    const tableExists = await conn.query(`SHOW TABLES LIKE '${tableName}'`);
    if (tableExists.length === 0) return this.createTable(tableName, fields);

    const currentFields: IMariaDBDescribeField[] = await conn.query(`DESCRIBE ${tableName}`);
    const fieldsKeys = Object.keys(fields);

    const fieldsToAdd = fieldsKeys.filter((key) => !currentFields.find((field) => field.Field === key));
    const fieldsToRemove = currentFields.filter((field) => !fields[field.Field]);
    const fieldsToUpdate: string[] = [];
    const existingPrimaryKeys = currentFields.filter((field) => field.Key === 'PRI');
    const newPrimaryKeys = fieldsKeys.filter((key) => fields[key].primaryKey);
    const didPrimaryKeysChange = existingPrimaryKeys.length !== newPrimaryKeys.length ||
      existingPrimaryKeys.some((key) => !newPrimaryKeys.includes(key.Field)) ||
      newPrimaryKeys.some((key) => !existingPrimaryKeys.find((field) => field.Field === key));
    const existingUniqueKeys = currentFields.filter((field) => field.Key === 'UNI');
    const newUniqueKeys = fieldsKeys.filter((key) => fields[key].unique && !fields[key].primaryKey);
    const uniqueKeysToRemove = existingUniqueKeys.filter((key) => !newUniqueKeys.includes(key.Field));
    const uniqueKeysToAdd = newUniqueKeys.filter((key) => !existingUniqueKeys.find((field) => field.Field === key));
    const existingForeignKeys = currentFields.filter((field) => field.Key === 'MUL');
    const newForeignKeys = fieldsKeys.filter((key) => fields[key].foreignKey);
    const foreignKeysToRemove = existingForeignKeys.filter((key) => !newForeignKeys.includes(key.Field)).map((item) => item.Field);
    const foreignKeysToAdd = newForeignKeys.filter((key) => !existingForeignKeys.find((field) => field.Field === key));
    const foreignKeysToUpdate = newForeignKeys.filter((key) => existingForeignKeys.find((field) => field.Field === key));

    // Find all fields that should be updated
    for (const field of currentFields) {
      if (fieldsToRemove.find((rField) => field.Field === rField.Field)) continue;
      let changed = false;
      const newField = fields[field.Field];
      const newData = this.convertTypes(newField);
      if (`${newData.type}(${newData.typeSize}) ${newData.attributes}`.toLowerCase().trim() !== field.Type.toLowerCase()) changed = true;
      if (newData.nullable !== (field.Null === 'YES')) changed = true;
      if ((newData.autoIncrement ? 'auto_increment' : '') !== field.Extra) changed = true;
      if ((newData.default ?? null) !== field.Default) changed = true;
      if (changed) fieldsToUpdate.push(field.Field);
    }

    const operations: string[] = [];
    if (didPrimaryKeysChange) {
      operations.push('DROP PRIMARY KEY');
      operations.push(`ADD PRIMARY KEY (${fieldsKeys.filter((fieldKey) => fields[fieldKey].primaryKey).map((key) => conn.escapeId(key)).join(', ')})`);
    }
    fieldsToRemove.forEach((field) => operations.push(`DROP ${field.Field}`));
    fieldsToAdd.forEach((field) => operations.push(`ADD ${this.createSQLField(conn, field, fields[field])}`));
    fieldsToUpdate.forEach((field) => operations.push(`CHANGE ${conn.escapeId(field)} ${this.createSQLField(conn, field, fields[field])}`));
    uniqueKeysToRemove.forEach((field) => operations.push(`DROP INDEX ${field.Field}`));
    uniqueKeysToAdd.forEach((field) => operations.push(`ADD UNIQUE INDEX ${field} (${field})`));
    [...foreignKeysToRemove, ...foreignKeysToUpdate].forEach((key) => operations.push(`DROP FOREIGN KEY ${conn.escapeId(key)}`));
    [...foreignKeysToAdd, ...foreignKeysToUpdate].forEach((key) => {
      let query = `ADD FOREIGN KEY (${conn.escapeId(key)}) REFERENCES ${conn.escapeId(fields[key].foreignKey!.table.getName())}(${conn.escapeId(fields[key].foreignKey!.field)})`;
      if (fields[key].foreignKey!.onDelete) query += ` ON DELETE ${conn.escapeId(fields[key].foreignKey!.onDelete!)}`;
      if (fields[key].foreignKey!.onUpdate) query += ` ON UPDATE ${conn.escapeId(fields[key].foreignKey!.onUpdate!)}`;
      operations.push(query);
    });
    if (operations.length > 0) await conn.query(`ALTER TABLE ${conn.escapeId(tableName)} ${operations.join(', ')}`);
    await conn.release();
  }
}