export async function fetchLiveAIData() {
  try {
    const res = await fetch('http://localhost:3001/api/data');
    if (!res.ok) throw new Error("Network response was not ok");
    return await res.json();
  } catch (error) {
    console.error("Error fetching live AI data:", error);
    return null;
  }
}
