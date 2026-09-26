async function run() {
  try {
    const login = await fetch('http://localhost:3000/api/v1/auth/login', { 
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'smoke-test@levora.com', password: 'TestPass123!' })
    }).then(r => r.json());
    if(!login.data) {
      console.log("Login failed", login); return;
    }
    const token = login.data.accessToken;
    
    const countries = await fetch('http://localhost:3000/api/v1/reference/countries').then(r => r.json());
    const countryId = countries.data[0].id;
    console.log("Country ID:", countryId);
    
    const res = await fetch('http://localhost:3000/api/v1/profile/personal', { 
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ nationalityId: countryId })
    });
    console.log("Status:", res.status);
    const body = await res.json();
    console.log("Body:", body);
  } catch(e) {
    console.log("Error:", e);
  }
}
run();
