import { DatabaseConnection } from './connection';
import { BaseModel } from './models';
import { NotImplementedException } from './errors';

/**
 * The DatabaseManager class is a singleton class that manages all database connections and migrations between them.
 * @class
 */
export class DatabaseManager {
  public static instance = new DatabaseManager();
  private connections: Map<string, DatabaseConnection> = new Map();

  /**
   * Create a new instance of the DatabaseManager or return the existing instance if it already exists
   * @param connection The connection to register in the DatabaseManager (optional)
   * @returns A new instance of the DatabaseManager or the existing instance if it already exists
   * @constructor
   */
  constructor(connection?: DatabaseConnection) {
    if (DatabaseManager.instance) {
      if (connection && !DatabaseManager.instance.hasConnection('default')) {
        DatabaseManager.instance.registerConnection('default', connection);
      }
      return DatabaseManager.instance;
    }
    if (connection) this.registerConnection('default', connection);
  }

  /**
   * Check if a connection with the given name exists
   * @param name The name of the connection
   * @returns True if a connection with the given name exists, false otherwise
   */
  public hasConnection(name: string): boolean {
    return this.connections.has(name);
  }

  /**
   * Register a new connection in the DatabaseManager
   * @param name The name of the connection
   * @param connection The connection to be registered
   * @returns The connection that was registered
   * @throws An error if a connection with the given name already exists
   */
  public async registerConnection(name: string, connection: DatabaseConnection): Promise<DatabaseConnection> {
    if (this.hasConnection(name)) throw new Error(`Connection with the name '${name}' is already registered in the DatabaseManager!`);
    await connection.connect();
    this.connections.set(name, connection);
    return Promise.resolve(connection);
  }

  /**
   * Get connection by name
   * @param name The name of the connection to retrieve
   * @returns The connection with the given name or null if it does not exist
   */
  public getConnection(name: string): DatabaseConnection | null {
    return this.connections.get(name) || null;
  }

  /**
   * Unregister a connection from the DatabaseManager
   * Warning: This will disconnect the connection
   * @param name The name of the connection to unregister
   */
  public async unregisterConnection(name: string): Promise<boolean> {
    const connection = this.connections.get(name);
    if (!connection) return false;
    await connection.disconnect();
    return this.connections.delete(name);
  }

  /**
   * Disconnect from all registered connections
   */
  public async disconnectAll(): Promise<void> {
    for await (const connection of this.connections.values()) {
      await connection.disconnect();
    }
  }

  /**
   * Migration method to move a model from one connection to another. Allows other databases types to migrate data between them.
   * @param model The populated model to be migrated
   * @param originalConnection The connection the model is currently on
   * @param targetConnection The connection the model should be migrated to
   * @todo This method is currently not implemented
   * @throws [{@link NotImplementedException}]
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async migrateModel(model: BaseModel, originalConnection: DatabaseConnection, targetConnection: DatabaseConnection): Promise<boolean> {
    throw new NotImplementedException();
  }
}
