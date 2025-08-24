import express, { Request, Response } from "express";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { UserDataModel, UserModel, VisitModel } from "./db";
import middleware from "./middleware";
import { v2 as cloudinary } from "cloudinary";
import { upload } from "./multermiddleware";
import fs from "fs";
import axios from "axios";
import Sentiment from "sentiment";

const app = express();
const PORT = process.env.PORT || 3000;


app.use(express.json());

require("dotenv").config();

// Validate environment variables
if (!process.env.MONGO_URL || !process.env.JWT_SECRET) {
  console.error(
    "Missing required environment variables: MONGO_URL or JWT_SECRET"
  );
  process.exit(1);
}

mongoose.connect(process.env.MONGO_URL as string);

interface SupplierInterface {
  name: string;
  cost: number;
  ratings: number;
  reviews: number;
}

interface SupplierAnalysisResult {
  supplier: string;
  cost: string;
  ratings: number;
  reviews: number;
  riskPercentage: number;
  score: number;
  analysis: string;
}

interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

const Suppliers: SupplierInterface[] = [
  {
    name: "Reliable Transports",
    cost: 50000,
    ratings: 1.0,
    reviews: 5,
  },
  {
    name: "Speedy Logistics",
    cost: 55000,
    ratings: 3.0,
    reviews: 1,
  },
  {
    name: "Quick Haulers",
    cost: 48000,
    ratings: 7.0,
    reviews: 3,
  },
  {
    name: "Safe cargo Movers",
    cost: 52000,
    ratings: 9.0,
    reviews: 2,
  },
];

// Calculate risk percentage based on cost, ratings, and reviews
function calculateRiskPercentage(
  supplier: SupplierInterface
): SupplierAnalysisResult {
  const costValue = supplier.cost; // Directly use the cost as a number
  const ratings = supplier.ratings;
  const reviews = supplier.reviews;

  if (ratings < 0 || ratings > 10) {
    throw new Error(
      `Invalid rating value: ${ratings}. Must be between 0 and 10`
    );
  }

  if (reviews < 0) {
    throw new Error(`Invalid review count: ${reviews}. Must be non-negative`);
  }

  const costWeight = 0.5;
  const ratingWeight = 0.3;
  const reviewWeight = 0.2;

  const minCost = 40000;
  const maxCost = 60000;
  const normalizedCost = Math.max(
    0,
    Math.min(100, ((costValue - minCost) / (maxCost - minCost)) * 100)
  );
  const normalizedRating = (10 - ratings) * 10;
  const normalizedReviews =
    reviews === 0 ? 100 : Math.max(0, Math.min(100, (1 / (reviews + 1)) * 100));

  const weightedRiskScore =
    costWeight * normalizedCost +
    ratingWeight * normalizedRating +
    reviewWeight * normalizedReviews;

  const overallScore = 100 - weightedRiskScore;
  const riskPercentage = weightedRiskScore;

  let analysis: string;
  if (riskPercentage < 30) {
    analysis =
      "Low risk - Excellent choice with good balance of cost and quality";
  } else if (riskPercentage < 60) {
    analysis = "Medium risk - Reasonable option with some trade-offs";
  } else {
    analysis = "High risk - Consider alternatives or negotiate better terms";
  }  

  analysis += `. Cost: ₹${costValue.toLocaleString()}, Rating: ${ratings}/10, Reviews: ${reviews}`;

  return {
    supplier: supplier.name,
    cost: costValue.toLocaleString(), // Convert number to string for display
    ratings: supplier.ratings,
    reviews: supplier.reviews,
    riskPercentage: Math.round(riskPercentage * 100) / 100,
    score: Math.round(overallScore * 100) / 100,
    analysis: analysis,
  };
}

// Route to analyze suppliers using basic maths and logic
app.post(
  "/analyze-suppliers",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const analysisResults: SupplierAnalysisResult[] = Suppliers.map(
        (supplier) => calculateRiskPercentage(supplier)
      );

      // Sort by risk percentage (ascending - lower risk is better)
      analysisResults.sort((a, b) => a.riskPercentage - b.riskPercentage);

      // Find the best supplier (lowest risk percentage)
      const bestSupplier = analysisResults[0];

      const response: ApiResponse = {
        success: true,
        data: {
          allSuppliers: analysisResults,
          bestSupplier: bestSupplier,
          analysisDate: new Date().toISOString(),
          analysisMethod:
            "Basic mathematical risk assessment using cost, ratings, and reviews",
        },
      };

      res.json(response);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      console.error("Error in supplier analysis:", errorMessage);

      const response: ApiResponse = {
        success: false,
        message: "Failed to analyze suppliers",
        error: errorMessage,
      };

      res.status(500).json(response);
    }
  }
);

// Get supplier analysis with detailed breakdown
app.get(
  "/supplier-analysis",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const analysisResults: SupplierAnalysisResult[] = Suppliers.map(
        (supplier) => calculateRiskPercentage(supplier)
      );

      // Sort by risk percentage (ascending - lower risk is better)
      analysisResults.sort((a, b) => a.riskPercentage - b.riskPercentage);

      // Fetch risk factor from OpenWeatherAPI
      const weatherApiKey = process.env.OPENWEATHER_API_KEY;
      if (!weatherApiKey) {
        throw new Error("Missing OpenWeatherAPI key in environment variables");
      }

      const weatherResponse = await axios.get(
        `https://api.openweathermap.org/data/2.5/weather?q=London&appid=${weatherApiKey}`
      );

      const weatherRiskFactor = weatherResponse.data.main.temp / 100; // Example calculation based on temperature

      // Fetch news data from News API
      const newsApiKey = process.env.NEWS_API_KEY;
      if (!newsApiKey) {
        throw new Error("Missing News API key in environment variables");
      }

      const newsResponse = await axios.get(
        `https://newsapi.org/v2/everything?q=logistics&apiKey=${newsApiKey}`
      );

      const articles = newsResponse.data.articles;
      const sentiment = new Sentiment();

      // Calculate average sentiment score for the articles
      const sentimentScores = articles.map((article: any) => {
        const analysis = sentiment.analyze(
          article.title + " " + article.description
        );
        return analysis.score;
      });

      const averageSentimentScore =
        sentimentScores.length > 0
          ? sentimentScores.reduce(
              (sum: number, score: number) => sum + score,
              0
            ) / sentimentScores.length
          : 0;

      const sentimentRiskFactor = 1 + averageSentimentScore / 10; // Adjust risk factor based on sentiment

      // Adjust risk scores based on weather and sentiment risk factors
      const adjustedResults = analysisResults.map((result) => {
        const adjustedRiskPercentage =
          result.riskPercentage * weatherRiskFactor * sentimentRiskFactor;
        return {
          ...result,
          riskPercentage: Math.round(adjustedRiskPercentage * 100) / 100,
          analysis: `${
            result.analysis
          } Adjusted for weather risk factor: ${weatherRiskFactor.toFixed(
            2
          )}, sentiment risk factor: ${sentimentRiskFactor.toFixed(2)}`,
        };
      });

      // Ensure adjustedResults is not empty before finding the best supplier
      if (adjustedResults.length === 0) {
        throw new Error("No suppliers available for analysis");
      }

      // Find the best supplier (lowest risk percentage)
      const bestSupplier = adjustedResults.reduce((best, current) => {
        return current.riskPercentage < best.riskPercentage ? current : best;
      }, adjustedResults[0] as SupplierAnalysisResult);

      const response: ApiResponse = {
        success: true,
        data: {
          suppliers: adjustedResults,
          totalSuppliers: adjustedResults.length,
          bestSupplier: bestSupplier,
          weatherRiskFactor: weatherRiskFactor.toFixed(2),
          sentimentRiskFactor: sentimentRiskFactor.toFixed(2),
          analysisDate: new Date().toISOString(),
        },
      };

      res.json(response);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      console.error("Error getting supplier analysis:", errorMessage);

      const response: ApiResponse = {
        success: false,
        message: "Failed to get supplier analysis",
        error: errorMessage,
      };

      res.status(500).json(response);
    }
  }
);

// Get analysis for a specific supplier
app.get(
  "/analyze-supplier/:name",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const supplierName = req.params.name || "";
      const supplier = Suppliers.find(
        (s) => s.name.toLowerCase() === supplierName.toLowerCase()
      );

      if (!supplier) {
        const response: ApiResponse = {
          success: false,
          message: "Supplier not found",
        };
        res.status(404).json(response);
        return;
      }

      const analysis = calculateRiskPercentage(supplier);

      const response: ApiResponse = {
        success: true,
        data: analysis,
      };

      res.json(response);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      console.error("Error analyzing specific supplier:", errorMessage);

      const response: ApiResponse = {
        success: false,
        message: "Failed to analyze supplier",
        error: errorMessage,
      };

      res.status(500).json(response);
    }
  }
);

// Get all suppliers (for reference)
app.get("/suppliers", async (req: Request, res: Response): Promise<void> => {
  try {
    const response: ApiResponse = {
      success: true,
      data: Suppliers,
    };

    res.json(response);
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error("Error getting suppliers:", errorMessage);

    const response: ApiResponse = {
      success: false,
      message: "Failed to get suppliers",
      error: errorMessage,
    };

    res.status(500).json(response);
  }
});

// Sign up a new User
app.post("/signup", async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, username, password } = req.body;
    // Implement signup logic here

    const response: ApiResponse = {
      success: true,
      message: "Signup endpoint - implementation pending",
    };

    res.json(response);
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error("Error in signup:", errorMessage);

    const response: ApiResponse = {
      success: false,
      message: "Failed to process signup",
      error: errorMessage,
    };

    res.status(500).json(response);
  }
});

// Login an existing User
app.post("/login", async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, password } = req.body;
    const existingUser = await UserModel.findOne({ username, password });

    if (existingUser) {
      const token = jwt.sign(
        {
          id: existingUser._id,
        },
        process.env.JWT_SECRET as string
      );

      const response: ApiResponse = {
        success: true,
        data: { token },
      };

      res.json(response);
    } else {
      const response: ApiResponse = {
        success: false,
        message: "Incorrect credentials",
      };

      res.status(403).json(response);
    }
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error("Error in login:", errorMessage);

    const response: ApiResponse = {
      success: false,
      message: "Failed to process login",
      error: errorMessage,
    };

    res.status(500).json(response);
  }
});

// Handle 404 errors
app.use((req: Request, res: Response): void => {
  const response: ApiResponse = {
    success: false,
    message: "Endpoint not found",
  };

  res.status(404).json(response);
});

// Global error handler
app.use((error: Error, req: Request, res: Response, next: any): void => {
  console.error("Global error handler:", error);

  const response: ApiResponse = {
    success: false,
    message: "Internal server error",
    error:
      process.env.NODE_ENV === "development"
        ? error.message
        : "Something went wrong",
  };

  res.status(500).json(response);
});


app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);

});


