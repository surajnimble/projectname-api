const { PGlite } = require('@electric-sql/pglite');
const { PGLiteSocketServer } = require('@electric-sql/pglite-socket');

(async () => {
  try {
    const db = await PGlite.create({ dataDir: 'pglite-data' });
    console.log('[proxy] PGlite created');
    const server = new PGLiteSocketServer({ db, port: 5433, host: '127.0.0.1' });
    await server.start();
    console.log('[proxy] PGlite socket server listening on 127.0.0.1:5433');
  } catch (e) {
    console.error('[proxy] FATAL:', e.message);
    process.exit(1);
  }
})();
