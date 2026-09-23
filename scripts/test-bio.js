async function test() {
  const regRes = await fetch('http://localhost:3000/api/v1/auth/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `test${Date.now()}@test.com`, password: 'Password1!', firstName: 'A', lastName: 'B' })
  });
  const regData = await regRes.json();
  const token = regData.data.accessToken;

  console.log("Very long bio");
  let res = await fetch('http://localhost:3000/api/v1/profile/personal', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ bio: "a".repeat(10000) })
  });
  console.log(res.status, await res.json());
}
test();
