/**
 * Simple authorization test to verify multi-user safety
 * Run with: node test-auth.js
 */

const BASE_URL = 'http://localhost:4000';

async function testMultiUserSafety() {
  console.log('🔒 Testing Multi-User Authorization...\n');

  try {
    // Register two users
    console.log('1. Registering two test users...');
    const user1Res = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        email: `test1-${Date.now()}@example.com`, 
        password: 'password123' 
      })
    });
    const user1 = await user1Res.json();
    console.log('✓ User 1 registered');

    const user2Res = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        email: `test2-${Date.now()}@example.com`, 
        password: 'password123' 
      })
    });
    const user2 = await user2Res.json();
    console.log('✓ User 2 registered\n');

    // User 1 creates a task
    console.log('2. User 1 creates a task...');
    const createRes = await fetch(`${BASE_URL}/api/tasks`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${user1.token}`,
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify({ 
        text: 'User 1 secret task',
        priority: 'high'
      })
    });
    const task1 = await createRes.json();
    console.log(`✓ User 1 created task ID ${task1.id}\n`);

    // User 2 tries to read User 1's tasks
    console.log('3. Testing User 2 cannot see User 1 tasks...');
    const user2TasksRes = await fetch(`${BASE_URL}/api/tasks`, {
      headers: { 'Authorization': `Bearer ${user2.token}` }
    });
    const user2Tasks = await user2TasksRes.json();
    
    if (user2Tasks.length === 0) {
      console.log('✓ PASS: User 2 cannot see User 1 tasks\n');
    } else {
      console.log('✗ FAIL: User 2 can see other users tasks!\n');
      return false;
    }

    // User 2 tries to update User 1's task
    console.log('4. Testing User 2 cannot update User 1 task...');
    const updateRes = await fetch(`${BASE_URL}/api/tasks/${task1.id}`, {
      method: 'PUT',
      headers: { 
        'Authorization': `Bearer ${user2.token}`,
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify({ text: 'Hacked!' })
    });
    
    if (updateRes.status === 404) {
      console.log('✓ PASS: User 2 cannot update User 1 task (404)\n');
    } else {
      console.log(`✗ FAIL: User 2 got status ${updateRes.status} instead of 404\n`);
      return false;
    }

    // User 2 tries to delete User 1's task
    console.log('5. Testing User 2 cannot delete User 1 task...');
    const deleteRes = await fetch(`${BASE_URL}/api/tasks/${task1.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${user2.token}` }
    });
    
    if (deleteRes.status === 404) {
      console.log('✓ PASS: User 2 cannot delete User 1 task (404)\n');
    } else {
      console.log(`✗ FAIL: User 2 got status ${deleteRes.status} instead of 404\n`);
      return false;
    }

    // Verify User 1 task still exists
    console.log('6. Verifying User 1 task still exists...');
    const user1TasksRes = await fetch(`${BASE_URL}/api/tasks`, {
      headers: { 'Authorization': `Bearer ${user1.token}` }
    });
    const user1Tasks = await user1TasksRes.json();
    
    if (user1Tasks.length === 1 && user1Tasks[0].id === task1.id) {
      console.log('✓ PASS: User 1 task still exists unchanged\n');
    } else {
      console.log('✗ FAIL: User 1 task was modified or deleted!\n');
      return false;
    }

    console.log('✅ All authorization tests passed!');
    return true;

  } catch (err) {
    console.error('❌ Test failed with error:', err.message);
    return false;
  }
}

// Run tests
testMultiUserSafety().then(success => {
  process.exit(success ? 0 : 1);
});
