import express, { Request, Response } from "express";

const router = express.Router();

const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

interface SeaAssessRequest {
  placeName: string; // Place name from frontend
}

router.post("/sea/assess", async (req: Request, res: Response) => {
  try {
    const { placeName } = req.body as SeaAssessRequest;

    if (!placeName || typeof placeName !== "string") {
      return res
        .status(400)
        .json({ error: "Place name is required and must be a string" });
    }

    // 1. Fetch weather data
    const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(
      placeName
    )}&appid=${OPENWEATHER_API_KEY}`;
    const weatherResp = await fetch(weatherUrl);

    if (!weatherResp.ok) throw new Error("Error fetching weather data");
    const weatherData = await weatherResp.json();

    console.log("Weather Data:", weatherData);

    // 2. Ask Gemini for structured risk analysis
    const geminiPayload = {
      contents: [
        {
          parts: [
            {
              text: `
Analyze this weather forecast data and return ONLY a JSON object with the following fields:
- assessment: 4-5 crisp, very specific points (array of strings).
- riskScore: a number between -10 (very risky) to +10 (very safe).
- riskLevel: one of ["Very Risky", "Risky", "Moderate", "Safe", "Very Safe"].
- recommendation: "Send the package" or "Do not send the package".

Weather data: ${JSON.stringify(weatherData)}
              `,
            },
          ],
        },
      ],
    };

    const geminiResp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(geminiPayload),
      }
    );

    const geminiData = await geminiResp.json();
    console.log("Gemini Response:", geminiData);

    if (!geminiResp.ok) {
      throw new Error(
        `Gemini API Error: ${geminiData.error?.message || "Unknown error"}`
      );
    }

    // 3. Extract Gemini AI analysis
    const rawText =
      geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

    let structuredResponse;
    try {
      structuredResponse = JSON.parse(rawText);
    } catch (e) {
      throw new Error("Failed to parse Gemini response as JSON");
    }

    const { assessment, riskScore, recommendation } = structuredResponse;

    // 4. Apply your custom riskLevel + colorCode mapping
    let riskLevel = "Neutral";
    let colorCode = "gray";

    if (riskScore > 5) {
      riskLevel = "Positive Sentiment";
      colorCode = "green";
    } else if (riskScore > 0) {
      riskLevel = "Slightly Positive";
      colorCode = "lightgreen";
    } else if (riskScore < -5) {
      riskLevel = "Negative Sentiment";
      colorCode = "red";
    } else if (riskScore < 0) {
      riskLevel = "Slightly Negative";
      colorCode = "orange";
    }

    // 5. Send clean response back
    res.json({
      placeName,
      weatherData,
      assessment,
      riskScore,
      recommendation,
      riskLevel,
      colorCode,
    });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ error: (err as Error).message || "Internal server error" });
  }
});

export default router;
