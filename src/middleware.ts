import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";


async function middleware(req: Request, res: Response, next: NextFunction) {
  const header = req.headers["authorization"];
  const decoded = jwt.verify(header as string, process.env.JWT_SECRET as any);

  if (decoded && typeof decoded === 'object' && 'id' in decoded) {
    (req as any).userId = decoded.id ;
    next();
  } else {
    res.status(401).json({
      message: "Unauthorized access",
    });
  }
}

export default middleware;