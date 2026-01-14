// AsyncStorage is mocked via moduleNameMapper in package.json


// Mock Supabase
const mockSupabaseQuery = {
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  gte: jest.fn().mockReturnThis(),
  lte: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  then: jest.fn(function(onFulfilled) {
    return Promise.resolve({ data: [], error: null }).then(onFulfilled);
  }),
};

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => mockSupabaseQuery),
  })),
}));


// Mock process.env
process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://fake-url.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_KEY = 'fake-key';
