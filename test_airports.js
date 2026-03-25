async function check() {
  try {
    const res = await fetch('https://aviationweather.gov/api/data/stationinfo?format=json');
    const txt = await res.text();
    console.log("Response starts with:");
    console.log(txt.substring(0, 500));
    
    // Also try fetching specific ID
    const res2 = await fetch('https://aviationweather.gov/api/data/stationinfo?id=S43,KLCM&format=json');
    console.log("\nSpecific ID response:");
    console.log(await res2.text());
  } catch(e) {
    console.error(e);
  }
}
check();
