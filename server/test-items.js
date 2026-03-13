const { exec } = require('child_process');
const jwt = require('jsonwebtoken');

// For testing: create a simple JWT token
// The server expects Firebase JWT tokens with userId in the payload

const testUserId = 'test-user-' + Date.now();

// Create a token similar to what Firebase would generate
const token = jwt.sign(
  { 
    userId: testUserId,
    email: 'test@example.com',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600 
  },
  'test-secret-key',
  { algorithm: 'HS256' }
);

console.log('Test user ID:', testUserId);
console.log('Test token:', token);

// Test creating an item
const item = {
  title: 'Test Item',
  description: 'This is a test item',
  metadata: { category: 'test' }
};

const curlCmd = `curl -s -X POST http://localhost:3000/api/items \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${token}" \\
  -d '${JSON.stringify(item)}'`;

console.log('\nCreating item...');
exec(curlCmd, (error, stdout, stderr) => {
  if (error) {
    console.error('Error:', error);
    return;
  }
  console.log('Create response:', stdout);
  
  // List items
  const listCmd = `curl -s http://localhost:3000/api/items -H "Authorization: Bearer ${token}"`;
  console.log('\nListing items...');
  exec(listCmd, (err, out) => {
    if (err) {
      console.error('Error:', err);
      return;
    }
    console.log('List response:', out);
  });
});