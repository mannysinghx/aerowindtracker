import fs from 'fs';

async function buildDb() {
  console.log('Downloading OurAirports CSV...');
  const res = await fetch('https://davidmegginson.github.io/ourairports-data/airports.csv');
  const text = await res.text();
  console.log('Parsing CSV...');
  
  const lines = text.split('\n');
  const results = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const cols = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
    
    // idx 1:ident, 2:type, 3:name, 4:lat, 5:lon, 8:iso_country, 13:local_code
    const ident = cols[1]?.replace(/"/g, '');
    const type = cols[2]?.replace(/"/g, '');
    const name = cols[3]?.replace(/"/g, '');
    const lat = parseFloat(cols[4]?.replace(/"/g, ''));
    const lon = parseFloat(cols[5]?.replace(/"/g, ''));
    const country = cols[8]?.replace(/"/g, '');
    const local_code = cols[13]?.replace(/"/g, '');

    if (country === 'US' && type !== 'closed' && type !== 'heliport' && type !== 'seaplane_base' && type !== 'balloonport') {
      const id = local_code && local_code.length > 0 ? local_code : ident;
      results.push({ id, name, lat, lon });
    }
  }

  console.log(`Found ${results.length} US airports. Saving to public/us_airports.json`);
  fs.writeFileSync('public/us_airports.json', JSON.stringify(results));
  console.log('Done.');
}
buildDb().catch(console.error);
