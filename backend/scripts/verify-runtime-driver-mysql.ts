import assert = require('node:assert/strict');
import { createConnection, type ConnectionConfig } from 'mariadb';

/** Called by the inventory suite after checking that the database is local and empty. */
export async function verifyRuntimeDriver(config: ConnectionConfig) {
  const connection = await createConnection(config);
  try {
    const [{ mode }] = await connection.query('SELECT @@SESSION.sql_mode AS mode');
    const sqlModes = new Set(String(mode).split(',').filter(Boolean));
    sqlModes.add('NO_BACKSLASH_ESCAPES');
    await connection.execute('SET SESSION sql_mode = ?', [[...sqlModes].join(',')]);

    const name = "O'Connor · 库存";
    const location = String.raw`Warehouse\Shelf A`;
    const sql = 'SELECT ? AS name, ? AS location';
    const [textRow] = await connection.query(sql, [name, location]);
    const [preparedRow] = await connection.execute(sql, [name, location]);
    assert.deepEqual([textRow.name, textRow.location], [name, location]);
    assert.deepEqual([preparedRow.name, preparedRow.location], [name, location]);
    console.log('PASS MySQL driver: text and prepared parameters preserve ordinary inventory labels.');
  } finally {
    await connection.end();
  }
}
