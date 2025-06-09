import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { db } from "../db";
import { Prisma } from "@prisma/client";

interface Token {
  userId: string;
}
type User = Prisma.UserGetPayload<{}>
export type Role =  "ADMIN" | "VENDOR" | "SUPER_USER";

export const addUser = async (req: Request, res: Response) => {
  const { fullName, email, password, vendorId, role } = req.body;

  if (!fullName) return res.status(400).json({ message: "Full name is required" });
  if (!email) return res.status(400).json({ message: "Email is required" });
  if (!password) return res.status(400).json({ message: "Password is required" });
  // if (!vendorId) return res.status(400).json({ message: "VendorId is required" });
  //const role: Role = req.body.role
  if (!role) return res.status(400).json({ message: "Role is required" });

  if (role === "VENDOR" && !vendorId) {
    return res.status(400).json({
      message: "VENDOR role must be associated with a vendor. Please provide vendorId",
    });
  }

  try {
    const existingUser = await db.user.findFirst({ where: { email } });
    if (existingUser) return res.status(403).json({ message: "Email already in use" });

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await db.user.create({
      data: {
        fullName,
        email,
        password: hashedPassword,
        role,
        vendorId
      },
    });

    const accessToken = jwt.sign(
      { userId: user.id },
      process.env.ACCESS_TOKEN_SECRET as string,
      { expiresIn: "24h" }
    );

    const refreshToken = jwt.sign(
      { userId: user.id },
      process.env.REFRESH_TOKEN_SECRET as string,
      { expiresIn: "7d" }
    );

    await db.user.update({
      where: { id: user.id },
      data: { refresh_token: refreshToken },
    });

    res.cookie("jwt", refreshToken, {
      httpOnly: true,
      sameSite: "none",
      secure: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(201).json({
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      accessToken,
    });
    
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to register user" });
  }
};

export const loginUser = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ message: "Email and password are required" });

  try {
    const user = await db.user.findFirst({ 
      where: { email }, 
      include: {
      vendor: {
        select: { id: true, name: true,}
      },
    }, 
  });
    if (!user) return res.status(404).json({ message: "User not found" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Incorrect password" });

    const accessToken = jwt.sign(
      { userId: user.id },
      process.env.ACCESS_TOKEN_SECRET as string,
      { expiresIn: "24h" } // 15m
    );

    const refreshToken = jwt.sign(
      { userId: user.id },
      process.env.REFRESH_TOKEN_SECRET as string,
      { expiresIn: "7d" }
    );

    await db.user.update({
      where: { id: user.id },
      data: { refresh_token: refreshToken },
    });

    res.cookie("jwt", refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(200).json({
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      isProfileComplete: user.profile_complete,
      vendor: user.vendor?.name ?? null,
      vendorId: user.vendor?.id ?? null,
      accessToken,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Login failed" });
  }
};

export const handleRefreshToken = async (req: Request, res: Response) => {
  const cookies = req.cookies;
  if (!cookies?.jwt) return res.status(401).json({ message: "Unauthorized" });

  const refreshToken = cookies.jwt;
  try {
    const user = await db.user.findFirst({ where: { refresh_token: refreshToken } });
    if (!user) return res.status(403).json({ message: "Forbidden" });

    jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET as string, (err: jwt.VerifyErrors | null, decoded: string | jwt.JwtPayload | undefined) => {
      if (err || (decoded as Token).userId !== user.id)
        return res.status(403).json({ message: "Invalid token" });

      const accessToken = jwt.sign(
        { userId: user.id },
        process.env.ACCESS_TOKEN_SECRET as string,
        { expiresIn: "15m" }
      );
      res.status(200).json({ accessToken });
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Token refresh failed" });
  }
};

export const handlePersistentLogin = async (req: Request, res: Response) => {
  const cookies = req.cookies;
  if (!cookies?.jwt) return res.status(401).json({ message: "Unauthorized" });

  const refreshToken = cookies.jwt;
  try {
    const user = await db.user.findFirst({ where: { refresh_token: refreshToken } });
    if (!user) return res.status(403).json({ message: "Forbidden" });

    jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET as string, (err: jwt.VerifyErrors | null, decoded: string | jwt.JwtPayload | undefined) => {
      if (err || (decoded as Token).userId !== user.id)
        return res.status(403).json({ message: "Invalid token" });

      const accessToken = jwt.sign(
        { userId: user.id },
        process.env.ACCESS_TOKEN_SECRET as string,
        { expiresIn: "15m" }
      );

      res.status(200).json({
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        accessToken,
      });
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Persistent login failed" });
  }
};

export const handleLogout = async (req: Request, res: Response) => {
  const cookies = req.cookies;
  if (!cookies?.jwt) return res.sendStatus(204); // No content

  const refreshToken = cookies.jwt;
  try {
    const user = await db.user.findFirst({ where: { refresh_token: refreshToken } });
    if (user) {
      await db.user.update({
        where: { id: user.id },
        data: { refresh_token: "" },
      });
    }

    res.clearCookie("jwt", {
      httpOnly: true,
      secure: true,
      sameSite: "none",
    });

    res.sendStatus(204);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Logout failed" });
  }
};

export const resetPassword = async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const userId = req.userId;

  let user: User;

  if (!email || !password)
    return res.status(400).json({ message: "Email and new password are required" });

  try {
    user = await db.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await db.user.update({
      where: { id: user.id },
      data: { password: hashedPassword, profile_complete: true },
    });

    res.status(200).json({ message: "Password reset successful" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Password reset failed" });
  }
};

export const adminResetPassword = async (req: Request, res: Response) => {
  const { userId, newPassword, confirmPassword } = req.body;

  if (!userId || !newPassword || !confirmPassword) {
    return res.status(400).json({ message: "All fields are required" });
  }

  if (newPassword !== confirmPassword) {
    return res.status(400).json({ message: "Passwords do not match" });
  }

  try {
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await db.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        profile_complete: false,
      },
    });

    res.status(200).json({ message: "Password reset successfully by admin" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Admin password reset failed" });
  }
};
