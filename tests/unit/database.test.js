const mockInitialize = jest.fn();
const mockGetAllReports = jest.fn().mockResolvedValue([]);

jest.mock('../../src/models/postgresql-database', () => {
  return {
    PostgreSQLDatabaseService: jest.fn().mockImplementation(() => ({
      initialize: mockInitialize,
      getAllReports: mockGetAllReports,
      isConnected: jest.fn().mockReturnValue(true),
      getPoolStats: jest.fn().mockReturnValue({ totalCount: 1 })
    }))
  };
});

const Database = require('../../src/models/database');

describe('Database facade', () => {
  beforeEach(() => {
    mockInitialize.mockClear();
    mockGetAllReports.mockClear();
  });

  test('initializes the PostgreSQL service once', async () => {
    const db = new Database();
    await db.initialize();
    await db.initialize();

    expect(mockInitialize).toHaveBeenCalledTimes(1);
  });

  test('delegates methods to the PostgreSQL service', async () => {
    const db = new Database();
    await db.initialize();

    const reports = await db.getAllReports();
    expect(mockGetAllReports).toHaveBeenCalledTimes(1);
    expect(reports).toEqual([]);
  });
});
