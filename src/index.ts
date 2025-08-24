import express, { Request, Response } from "express";
import mongoose, { trusted } from "mongoose";
import jwt from "jsonwebtoken";
import { UserDataModel, UserModel, VisitModel } from "./db";
import middleware from "./middleware";
import { v2 as cloudinary } from "cloudinary";
import { upload } from "./multermiddleware";
import fs from "fs";
const app = express();

app.use(express.json());

require("dotenv").config();

mongoose.connect(process.env.MONGO_URL as string);

//Sign up a new User
app.post("/signup", async (req: Request, res: Response) => {
  const { username, password, name } = req.body;
  try {
    await UserModel.create({
      name,
      username,
      password,
    });
  } catch (error) {
    console.log("User already Exists");
    res.status(409).json({
      message: "User already exists ",
    });
  }
});

//Login an existing User
app.post("/login", async (req: Request, res: Response) => {
  const { username, password } = req.body;

  const existingUser = await UserModel.findOne({ username, password }); //Ye true ya false dega ki yeh user exist karta hai ki nahi

  if (existingUser) {
    const token = jwt.sign(
      {
        id: existingUser._id,
      },
      process.env.JWT_SECRET as string
    );
  } else {
    res.status(403).json({
      message: "incorrect credentials",
    });
  }
});

//authenticated request , endpoint to get access to all the visits
interface AuthenticatedRequest extends Request {
  user?: { userId: string };
}

app.get(
  "/getVisits",
  middleware,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const visits = await VisitModel.find({
        userId: req.user?.userId,
      }).sort({
        dateOfvisit: -1,
      });

      res.status(200).json({
        message: "Visits retrieved successfully",
        visits,
      });
    } catch (error) {
      console.log("Error fetching visits: ", error);
      res.status(500).json({
        message: "Server error while fetching visits",
      });
    }
  }
);

//To delete a visit
app.delete("/visits/:id", middleware, async (req: Request, res: Response) => {
  try {
    const id = req.params.id;

    const deletedVisit = await VisitModel.findByIdAndDelete(id);

    if (!deletedVisit) {
      res.status(404).json({
        message: "Visit not found",
      });
    }

    return res.json({
      message: "Visit deleted successfully !",
    });
  } catch (error: any) {
    console.log("Some issue in Server ", error);

    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
});

//Route to edit details of a visit
app.patch("/visits/:id", middleware, async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const updates = req.body;
    const updatedVisit = await VisitModel.findByIdAndUpdate(id, updates, {
      new: true,
    });

    if (!updatedVisit) {
      return res.status(404).json({
        message: "Visit not found !",
      });
    }

    res.json(updatedVisit);
  } catch (error) {
    console.log("Server Error !");

    return res.status(500).json({
      message: "Server issue ",
    });
  }

  //route for user to input his/her information
  app.post("/profile", middleware, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId.id;
      const user = await UserModel.findById(userId);

      if (!user) {
        return res.status(404).json({
          message: "User not found",
        });
      }

      const { email, phone, address, age, gender } = req.body;

      const userData = await UserDataModel.create({
        name: user.name,
        username: user.username,
        phone,
        email,
        address,
        age,
        gender,
      });

      res.status(201).json(userData);
    } catch (error: any) {
      res.status(500).json({
        error: error.message,
      });
    }
  });
});

//
app.get("/profile", middleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId.id;
    const user = await UserModel.findById(userId);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const foundUserData = await UserModel.findOne({
      username: user.username,
    });

    if (!foundUserData) {
      return res.status(404).json({
        message: "Profile not found",
      });
    }

    res.json(foundUserData);
  } catch (error: any) {
    console.log("Error is : ", error);
    res.status(500).json({
      error: error.message,
    });
  }
});

//Route to upload prescription photo
app.post(
  "/addContent",
  middleware,
  upload.single("prescription"),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          message: "No file uploaded",
        });
      }

      //upload to cloudinary
      const result = await cloudinary.uploader.upload(req.file.path, {
        resource_type: "image",
        folder: "temp",
      });

      //ab locally ho gya, delete local temp file path after upload to save disk
      fs.unlinkSync(req.file.path);

      //Now get content from the user and also find the user from the JWT
      const user = (req as any).userId.id;
      const {
        patientName,
        dateOfvisit,
        doctorName,
        symptoms,
        prescription_url,
      } = req.body;

      if (!user) {
        return res.status(404).json({
          message: "User not found",
        });
      }

      const newVisit = await VisitModel.create({
        patientName: user.name,
        dateOfvisit: dateOfvisit || new Date().toISOString,
        doctorName: doctorName || "Unknown",
        symptoms: [],
        prescription_url: result.secure_url,
      });

      return res.status(201).json({
        message: "Visit saved with prescription",
        newVisit,
      });
    } catch (error: any) {
      console.log("Server has an error :", error);
      return res.status(500).json({
        message: "server error ",
        error: error,
      });
    }
  }
);

app.listen(3000, () => {
  console.log("Server is running on the port 3000");
});
