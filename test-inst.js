fetch('https://raw.githubusercontent.com/Hipo/university-domains-list/master/world_universities_and_domains.json')
  .then(res => res.json())
  .then(data => {
    console.log(data.filter(d => d['state-province']).slice(0, 5));
  });
