import express, { Request, Response } from "express";
import Sentiment from "sentiment";

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
      return res.status(400).json({ error: "Place name is required and must be a string" });
    }

    // 1. Fetch weather data from OpenWeatherAPI
    const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(
      placeName
    )}&appid=${OPENWEATHER_API_KEY}`;
    const weatherResp = await fetch(weatherUrl);

    if (!weatherResp.ok) throw new Error("Error fetching weather data");
    const weatherData = await weatherResp.json();

    console.log("Weather Data:", weatherData);

    // 2. Send weather data to Gemini for risk assessment
    const geminiPayload = {
      contents: [
        {
          parts: [
            {
              text: `Analyze this forecast for risks and disruptions and give us 4-5 crisp points summarising the result of the prompt. Do not be vague, be very specific. Also at the end recommend whether we should send our package or not: ${JSON.stringify(
                weatherData
              )}`,
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
      throw new Error(`Gemini API Error: ${geminiData.error?.message || "Unknown error"}`);
    }

    // 3. Extract Gemini AI analysis text
    const geminiAssessment =
      geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || "No assessment received";

    // 4. Perform sentiment analysis on the Gemini assessment
    const sentiment = new Sentiment();
    const sentimentResult = sentiment.analyze(geminiAssessment);

    // Fix: Adjust the normalization logic for riskScore
    const maxSentimentScore = 20; // Define a maximum sentiment score for scaling
    const normalizedScore = Math.abs(sentimentResult.score); // Use absolute value to handle negative scores
    const riskScore = Math.min((normalizedScore / maxSentimentScore) * 100, 100); // Scale to 0-100%

    // 5. Determine risk level and color code
    let riskLevel = "No Risk";
    let colorCode = "green";

    if (riskScore > 80) {
      riskLevel = "Critical Risk";
      colorCode = "darkred";
    } else if (riskScore > 60) {
      riskLevel = "High Risk";
      colorCode = "red";
    } else if (riskScore > 40) {
      riskLevel = "Moderate Risk";
      colorCode = "orange";
    } else if (riskScore > 20) {
      riskLevel = "Low Risk";
      colorCode = "yellow";
    } else {
      riskLevel = "No Risk";
      colorCode = "green";
    }

    // 6. Return the response with risk level and color code
    res.json({
      placeName,
      weatherData,
      geminiAssessment: JSON.stringify(geminiAssessment),
      riskScore: Math.round(riskScore * 100) / 100, // Round to 2 decimal places
      riskLevel,
      colorCode,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: (err as Error).message || "Internal server error" });
  }
});

export default router;

