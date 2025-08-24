import { v2 as cloudinary } from "cloudinary";
import multer from "multer";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME as string,
  api_key: process.env.CLOUDINARY_API_KEY as string,
  api_secret: process.env.CLOUDINARY_API_SECRET as string,
});


const storage = multer.diskStorage({
    destination: function (req, file, cb){
        return cb(null, "./public/temp")
    } ,
    filename : function(req, file, cb){
        return cb (null, `${Date.now()} - ${file.originalname}`)
    } ,
});

const upload = multer({storage});




