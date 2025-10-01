import { type Request, type Response, type NextFunction } from "express";
import bcrypt from "bcrypt";
import { storage } from "./storage";

declare module "express-session" {
  interface SessionData {
    adminId: string;
  }
}

export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

export const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  if (req.session.adminId) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
};
