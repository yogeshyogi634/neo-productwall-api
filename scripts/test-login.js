
import fetch from 'node-fetch';

async function testLogin() {
    const email = 'hello@neokred.tech'; // Valid verified user from DB check
    const password = 'password123'; // Assumption/Placeholder. 
    // If I don't know the password, I can't login.
    // However, I can try 'password' or look for seed data.
    // Or I can update the user's password to something known via script if needed.
    // Let's try to create a NEW user and approve them via script to be sure?
    // No, let's just use the user credentials if I can.
    
    // Alternative: I can use the 'devLogin' endpoint if it exists? 
    // I saw 'devLogin' in auth.controller.js logs earlier?
    // No, I saw 'Login successful (Admin Bypass)' which is inside 'signin' if password matches? 
    // No, there is a bypass.
    
    // Let's assume the user just created 'hello@neokred.tech' and knows the password.
    // But I don't.
    // I will try to use a known test user if possible.
    // Or I can create a new user flow in this script.
    
    const API_URL = 'http://localhost:3001/api/auth/signin';
    
    console.log(`Testing Login for ${email}...`);
    
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        console.log('Status:', response.status);
        console.log('Response Body:', JSON.stringify(data, null, 2));
        
    } catch (error) {
        console.error('Error:', error);
    }
}

testLogin();
