// A temporary test to ensure we can get station info
async function testStation() {
  try {
    const res = await fetch('https://aviationweather.gov/api/data/stationinfo?format=json');
    const stations = await res.json();
    console.log("Total stations:", stations.length);
    const bos = stations.find(s => s.icaoId === 'KBOS');
    const bos_short = stations.find(s => s.icaoId === 'BOS');
    console.log("BOS:", bos || bos_short || "Not found");
  } catch (e) {
    console.error(e);
  }
}
testStation();
