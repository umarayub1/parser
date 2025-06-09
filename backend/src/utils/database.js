import pg from 'pg';

const { Client } = pg;

// Singleton connection instance
let dbClient = null;

// Create and maintain a single connection
export const getDbConnection = async () => {
  if (!dbClient) {
    dbClient = new Client({ 
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false
      }
    });
    await dbClient.connect();
    
    // Handle connection errors and reconnection
    dbClient.on('error', (err) => {
      console.error('Database connection error:', err);
      dbClient = null; // Reset client to force reconnection
    });
  }
  
  return dbClient;
};

// Execute a query using the shared connection
export const executeQuery = async (text, params = []) => {
  try {
    const client = await getDbConnection();
    const result = await client.query(text, params);
    return result;
  } catch (error) {
    console.error('Database query error:', error);
    // Reset connection on error to allow reconnection
    if (dbClient) {
      try {
        await dbClient.end();
      } catch (endError) {
        console.error('Error closing connection:', endError);
      }
      dbClient = null;
    }
    throw error;
  }
};

// Graceful shutdown function to close the connection
export const closeDbConnection = async () => {
  if (dbClient) {
    try {
      await dbClient.end();
      dbClient = null;
    } catch (error) {
      console.error('Error closing database connection:', error);
    }
  }
};