declare module 'oracledb' {
  interface Connection {
    close(): Promise<void>;
    execute(sql: string, params?: any): Promise<any>;
    commit(): Promise<void>;
    rollback(): Promise<void>;
  }
  
  interface Pool {
    getConnection(): Promise<Connection>;
    close(): Promise<void>;
  }
  
  interface Oracledb {
    createPool(config: any): Promise<Pool>;
    getPool(poolAlias?: string): Pool;
  }
  
  const oracledb: Oracledb;
  export = oracledb;
}
