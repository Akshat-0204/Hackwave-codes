import express, { Request, Response } from "express";
import fetch from "node-fetch"; // Use node18+ built-in fetch if available

const router = express.Router();

const OPENWEATHER_API_KEY = "your_openweather_api_key";
const GEMINI_API_KEY = "your_gemini_api_key";

interface SeaAssessRequest {
  country: string; // country name from frontend
}

// Function to get coordinates from country name
async function getCoordinatesByCountry(countryName: string): Promise<{ lat: number; lon: number }> {
  const url = `https://nominatim.openstreetmap.org/search?country=${encodeURIComponent(countryName)}&format=json&limit=1`;
  const response = await fetch(url, {
    headers: {
      "User-Agent": "YourAppName/1.0 (your.email@example.com)" // Required by Nominatim usage policy
    }
  });
  if (!response.ok) throw new Error("Failed to fetch geocoding data");
  const data = await response.json();
  if (data.length === 0) throw new Error("Country not found");
  return {
    lat: parseFloat(data[0].lat),
    lon: parseFloat(data[0].lon),
  };
}

router.post("/sea/assess", async (req: Request, res: Response) => {
  try {
    const { country } = req.body as SeaAssessRequest;

    if (!country || typeof country !== "string") {
      return res.status(400).json({ error: "Country name is required and must be a string" });
    }

    // 1. Get coordinates for the selected country
    const { lat, lon } = await getCoordinatesByCountry(country);

    // 2. Fetch weather data from OpenWeatherAPI
    const weatherUrl = `https://api.openweathermap.org/data/2.5/onecall?lat=${lat}&lon=${lon}&exclude=minutely,alerts&appid=${OPENWEATHER_API_KEY}`;
    const weatherResp = await fetch(weatherUrl);
    if (!weatherResp.ok) throw new Error("Error fetching weather data");
    const weatherData = await weatherResp.json();

    // 3. Send weather data to Gemini for risk assessment
    const geminiPayload = {
      contents: [
        {
          parts: [
            {
              text: `Analyze this forecast for risks and disruptions and give us the recommendations what can we do : ${JSON.stringify(weatherData)}`,
            },
          ],
        },
      ],
    };

    const geminiResp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(geminiPayload),
      }
    );
    if (!geminiResp.ok) throw new Error("Error fetching analysis from Gemini");
    const geminiData = await geminiResp.json();

    // 4. Extract Gemini AI analysis text
    const geminiAssessment =
      geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || "No assessment received";

    // 5. Return the Gemini assessment as JSON string for frontend display
    res.json({
      country,
      coordinates: { lat, lon },
      geminiAssessment: JSON.stringify(geminiAssessment),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: (err as Error).message || "Internal server error" });
  }
});

export default router;
