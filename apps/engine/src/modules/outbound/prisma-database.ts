import type { PrismaClient, Prisma } from '@leadloom/database';
import type { SqlConnection, TransactionalDatabase } from './atomic-dispatch.repository';
const connection = (client:Prisma.TransactionClient|PrismaClient):SqlConnection => ({
  query: <T extends Record<string,unknown>>(sql:string,parameters:unknown[]=[]) => client.$queryRawUnsafe<T[]>(sql,...parameters),
});
/** SQL strings are fixed source constants; all user values use bound parameters. */
export class PrismaDispatchDatabase implements TransactionalDatabase {
  constructor(private readonly client:PrismaClient) {}
  query<T extends Record<string,unknown>>(sql:string,parameters:unknown[]=[]):Promise<T[]> {
    return connection(this.client).query<T>(sql,parameters);
  }
  transaction<T>(operation:(client:SqlConnection)=>Promise<T>):Promise<T> {
    return this.client.$transaction(tx=>operation(connection(tx)),{isolationLevel:'ReadCommitted',maxWait:5000,timeout:10000});
  }
}
