async function test() {
  const regRes = await fetch('http://localhost:3000/api/v1/auth/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `test${Date.now()}@test.com`, password: 'Password1!', firstName: 'A', lastName: 'B' })
  });
  const regData = await regRes.json();
  const token = regData.data.accessToken;

  console.log("Empty object patch");
  let res = await fetch('http://localhost:3000/api/v1/profile/personal', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({})
  });
  console.log(res.status, await res.json());

  console.log("Explicit null for bio patch");
  res = await fetch('http://localhost:3000/api/v1/profile/personal', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ bio: null })
  });
  console.log(res.status, await res.json());
}
test();
