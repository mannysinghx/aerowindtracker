export async function fetchLiveAIData() {
  try {
    const res = await fetch('/api/data');
    if (!res.ok) throw new Error("Network response was not ok");
    return await res.json();
  } catch (error) {
    console.error("Error fetching live AI data:", error);
    return null;
  }
}
