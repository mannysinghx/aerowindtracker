import fs from 'fs';

async function buildAll() {
  console.log('Downloading OurAirports CSV...');
  const res1 = await fetch('https://davidmegginson.github.io/ourairports-data/airports.csv');
  const text1 = await res1.text();
  
  const airports = [];
  const lines1 = text1.split('\n');
  const usIdsList = [];
  
  for (let i = 1; i < lines1.length; i++) {
    const line = lines1[i];
    if (!line) continue;
    const cols = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
    
    const ident = cols[1]?.replace(/"/g, '');
    const type = cols[2]?.replace(/"/g, '');
    const name = cols[3]?.replace(/"/g, '');
    const lat = parseFloat(cols[4]?.replace(/"/g, ''));
    const lon = parseFloat(cols[5]?.replace(/"/g, ''));
    const country = cols[8]?.replace(/"/g, '');

    if (country === 'US' && type !== 'closed' && type !== 'heliport' && type !== 'seaplane_base' && type !== 'balloonport') {
      airports.push({ id: ident, name, lat, lon });
      usIdsList.push(ident);
    }
  }

  fs.writeFileSync('public/us_airports.json', JSON.stringify(airports));
  console.log('Saved', airports.length, 'airports.');

  const usIds = new Set(usIdsList);

  console.log('Downloading Runways CSV...');
  const res2 = await fetch('https://davidmegginson.github.io/ourairports-data/runways.csv');
  const text2 = await res2.text();
  
  const runways = {};
  const lines2 = text2.split('\n');
  
  for (let i = 1; i < lines2.length; i++) {
    const line = lines2[i];
    if (!line) continue;
    const cols = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
    
    const airport_ident = cols[2]?.replace(/"/g, '');
    const closed = cols[7]?.replace(/"/g, '');
    
    if (closed === '1') continue;
    
    if (airport_ident && usIds.has(airport_ident)) {
      if (!runways[airport_ident]) runways[airport_ident] = [];
      runways[airport_ident].push({
        length: parseInt(cols[3]?.replace(/"/g, '')) || null,
        width: parseInt(cols[4]?.replace(/"/g, '')) || null,
        le_ident: cols[8]?.replace(/"/g, ''),
        le_heading: parseFloat(cols[12]?.replace(/"/g, '')) || null,
        he_ident: cols[14]?.replace(/"/g, ''),
        he_heading: parseFloat(cols[18]?.replace(/"/g, '')) || null
      });
    }
  }

  fs.writeFileSync('public/us_runways.json', JSON.stringify(runways));
  console.log('Saved runways for', Object.keys(runways).length, 'airports.');
}
buildAll().catch(console.error);
