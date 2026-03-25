import fs from 'fs';

async function buildRunways() {
  console.log('Loading US Airports...');
  const airportsRaw = fs.readFileSync('public/us_airports.json', 'utf-8');
  const airports = JSON.parse(airportsRaw);
  const usIds = new Set(airports.map(a => a.id));

  console.log('Downloading OurAirports Runways CSV...');
  const res = await fetch('https://davidmegginson.github.io/ourairports-data/runways.csv');
  const text = await res.text();
  console.log('Parsing CSV...');
  
  const lines = text.split('\n');
  const results = {}; // Map of airport_id to array of runways
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    
    // Split on commas not inside quotes
    const cols = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
    
    const airport_ident = cols[2]?.replace(/"/g, '');
    const closed = cols[7]?.replace(/"/g, '');
    
    if (closed === '1') continue;
    
    if (airport_ident && usIds.has(airport_ident)) {
      if (!results[airport_ident]) {
        results[airport_ident] = [];
      }
      results[airport_ident].push({
        length: parseInt(cols[3]?.replace(/"/g, '')) || null,
        width: parseInt(cols[4]?.replace(/"/g, '')) || null,
        le_ident: cols[8]?.replace(/"/g, ''),
        le_heading: parseFloat(cols[12]?.replace(/"/g, '')) || null,
        he_ident: cols[14]?.replace(/"/g, ''),
        he_heading: parseFloat(cols[18]?.replace(/"/g, '')) || null
      });
    }
  }

  console.log(`Found runways for ${Object.keys(results).length} US airports. Saving to public/us_runways.json`);
  fs.writeFileSync('public/us_runways.json', JSON.stringify(results));
  console.log('Done.');
}
buildRunways().catch(console.error);
