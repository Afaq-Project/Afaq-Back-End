async function test() {
  const regRes = await fetch('http://localhost:3000/api/v1/auth/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `test${Date.now()}@test.com`, password: 'Password1!', firstName: 'A', lastName: 'B' })
  });
  const regData = await regRes.json();
  const token = regData.data.accessToken;

  const countries = await (await fetch('http://localhost:3000/api/v1/reference/countries')).json();
  const cities = await (await fetch('http://localhost:3000/api/v1/reference/cities')).json();
  
  const city1 = cities.data[0];
  const country2 = countries.data.find(c => c.id !== city1.countryId);
  
  console.log("Testing with Country:", country2.id, "City:", city1.id, "(belongs to", city1.countryId, ")");
  
  const res = await fetch('http://localhost:3000/api/v1/profile/personal', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ countryOfResidenceId: country2.id, currentCityId: city1.id })
  });
  console.log("Status:", res.status);
  console.log("Data:", await res.json());
}
test();
