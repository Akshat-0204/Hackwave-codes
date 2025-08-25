

// interface SupplierInterface {

//   cost: number;
//   rating: number; // Out of 10
//   reviews: number; // Out of 5
//   location: string;
// }

// app.post("/suppliers/risk-analysis", async (req: Request, res: Response) => {
//   try {
//     const { locationA, locationB } = req.body as {
      
//       locationA: string;
//       locationB: string;
//     };

//     if (!locationA || !locationB) {
//       return res.status(400).json({ error: "Both locationA and locationB are required." });
//     }

//     const results = await Promise.all(
//       suppliers.map(async (supplier) => {
//         // Fetch weather data for the supplier's location
//         const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(
//           supplier.location
//         )}&appid=${OPENWEATHER_API_KEY}`;
//         const weatherResp = await fetch(weatherUrl);

//         if (!weatherResp.ok) throw new Error(`Error fetching weather data for ${supplier.location}`);
//         const weatherData = await weatherResp.json();

//         // Send weather data to Gemini for risk assessment
//         const geminiPayload = {
//           contents: [
//             {
//               parts: [
//                 {
//                   text: `Analyze the following supplier's details and weather data to calculate the risk percentage for transporting goods from ${locationA} to ${locationB}. Supplier details: ${JSON.stringify(
//                     supplier
//                   )}, Weather data: ${JSON.stringify(weatherData)}`,
//                 },
//               ],
//             },
//           ],
//         };

//         const geminiResp = await fetch(
//           `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
//           {
//             method: "POST",
//             headers: { "Content-Type": "application/json" },
//             body: JSON.stringify(geminiPayload),
//           }
//         );

//         if (!geminiResp.ok) {
//           throw new Error(`Error fetching analysis from Gemini for ${supplier.name}`);
//         }

//         const geminiData = await geminiResp.json();
//         const riskPercentage = geminiData?.candidates?.[0]?.content?.parts?.[0]?.riskPercentage || 100; // Default to 100% if not provided

//         return {
//           ...supplier,
//           riskPercentage,
//         };
//       })
//     );

//     // Find the supplier with the least risk percentage
//     const bestSupplier = results.reduce((best, current) => {
//       return current.riskPercentage < (best as any).riskPercentage ? current : best;
//     }, results[0]);

//     res.json({
//       suppliers: results,
//       bestSupplier,
//     });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: (err as Error).message || "Internal server error" });
//   }
// });

app.post("/insurance/recommendations", async (req: Request, res: Response) => {
  try {
    const { location1 } = req.body as { location1: string };

    if (!location1 || typeof location1 !== "string") {
      return res.status(400).json({ error: "Starting location (location1) is required and must be a string." });
    }

    // Prepare the payload for Gemini API
    const geminiPayload = {
      contents: [
        {
          parts: [
            {
              text: `For the location '${location1}', provide an array of 3 insurance recommendations. Each recommendation should include:
              - Type of insurances that can minimize risks,
              - Risks covered,
              - Uniqueness of the insurance,
              - Facilities provided,
              - Why it is an asset,
              - A brief and precise description.
              Ensure that each recommendation is specific, precise, and not vague.`,
            },
          ],
        },
      ],
    };

    // Call the Gemini API
    const geminiResp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(geminiPayload),
      }
    );

    if (!geminiResp.ok) {
      throw new Error("Error fetching insurance recommendations from Gemini API");
    }

    const geminiData = await geminiResp.json();
    console.log("Gemini Response:", geminiData);

    // Extract the recommendations from the Gemini API response
    const recommendations = geminiData?.candidates?.[0]?.content?.parts?.[0]?.recommendations || [];

    if (!Array.isArray(recommendations) || recommendations.length === 0) {
      return res.status(500).json({ error: "No recommendations received from Gemini API." });
    }

    // Return the recommendations in the response
    res.json({
      location: location1,
      recommendations,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: (err as Error).message || "Internal server error" });
  }
});

export default router;

