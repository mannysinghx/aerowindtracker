async function checkLimits() {
  try {
    const res1 = await fetch('https://aviationweather.gov/api/data/metar?format=json&bbox=24,-125,50,-66');
    const d1 = await res1.json();
    console.log("Default BBOX count:", d1.length);
    
    // Attempting some query parameters that might increase limits or bypass them
    const res2 = await fetch('https://aviationweather.gov/api/data/metar?format=json&bbox=24,-125,50,-66&limit=10000');
    let d2 = [];
    if (res2.ok) d2 = await res2.json();
    console.log("With limit=10000 count:", d2.length);
    
    const res3 = await fetch('https://aviationweather.gov/api/data/metar?format=json&bbox=24,-125,50,-66&hours=1');
    const d3 = await res3.json();
    console.log("With hours=1 count:", d3.length);

    // Try a smaller box (e.g. just Texas) to see if density is high
    const res4 = await fetch('https://aviationweather.gov/api/data/metar?format=json&bbox=25.8,-106.6,36.5,-93.5');
    const d4 = await res4.json();
    console.log("Texas only count:", d4.length);
    
  } catch(e) { console.error(e) }
}
checkLimits();
