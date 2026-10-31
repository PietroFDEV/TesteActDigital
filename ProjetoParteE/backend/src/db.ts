import mysql, { type Pool, type PoolConnection } from 'mysql2/promise';

/** Qualquer coisa que execute SQL: o pool (cada chamada pega uma conexão) ou uma conexão já em transação. */
export type Db = Pool | PoolConnection;

export function createPool(databaseUrl: string): Pool {
  return mysql.createPool({
    uri: databaseUrl,
    connectionLimit: 10,
    // DATETIME é gravado e lido como UTC, para o ISO devolvido pela API não depender do fuso do servidor.
    timezone: 'Z',
  });
}
