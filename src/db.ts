import mongoose from "mongoose";
import { Schema, model } from "mongoose";

//User Schema
const UserSchema = new Schema({
  name: {
    type: String,
    required: true,
  },
  username: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
  },
});

export const UserModel = model("User", UserSchema);

//Visit Schema
const VisitSchema = new Schema({
  patientName: {
    type: String,
    required : true
  },
  //as of now , putting it as a string
  dateOfvisit: {
    type: String,
    required : true

  },
  doctorName: {
    type: String,
    required : true

  },
  symptoms: [
    {
      type: String,
    required : true

    },
  ],
  prescription_url: {
    type: String,
    required : true

  },
});

export const VisitModel = model("Visit", VisitSchema);

//User Data Model 

const userDataSchema = new mongoose.Schema({
    name: { type: String, default: null },
    username: { type: String, required: true, unique: true },
    phone: { type: String, default: null },
    email: { type: String, default: null },
    address: { type: String, default: null },
    age: { type: Number, default: null },
    gender: { type: String, default: null },
    createdAt: { type: Date, default: Date.now }
});

export const UserDataModel = mongoose.model("UserData", userDataSchema);
