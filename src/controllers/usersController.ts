import { Request, Response } from "express";
import { Role } from "@prisma/client";
import { db } from "../db";

const updateUser = async (
  userId: string,
  data: Partial<{
    fullName: string;
    email: string;
    isActive: boolean;
    role: Role;
  }>
) => {
  return await db.user.update({
    where: { id: userId },
    data,
  });
};


export const getAllUsers = async (req: Request, res: Response) => {
  const search = (req.query.search as string) || "";
  let roleParam = (req.query.role as string) || "";
  const { page = 1, limit = 10 } = req.query;
  const parsedPage = parseInt(page as string);
  const parsedLimit = parseInt(limit as string);

  roleParam = roleParam.toUpperCase();

  try {
    const users = await db.user.findMany({
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
      },
      where: {
        isActive: true,
        AND: [
          {
            OR: [
              { fullName: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
            ],
          },
          roleParam && (roleParam === "STUDENT" || roleParam === "SUPERVISOR")
            ? { role: roleParam as Role }
            : {},
        ],
      },
      skip: (parsedPage - 1) * parsedLimit,
      take: parsedLimit,
    });

    res.status(200).json({ users, numFound: users.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to retrieve users", error: err });
  }
};

// Update a user's profile
export const editUser = async (req: Request, res: Response) => {
  const { fullName, email, role } = req.body;
  const { userId } = req.params;
  
  try {
    const user = await updateUser(userId, {
      fullName: fullName?.trim(),
      email: email?.trim(),
      role: role as Role,
    });

    res.json({
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
    });
  } catch (err: any) {
    console.error(err);
    if (err.code === "P2002") {
      return res.status(403).json({ message: "Email already in use" });
    }
    res.status(500).json({ message: "Failed to update user", error: err });
  }
};


export const disableUser = async (req: Request, res: Response) => {
  const { userId } = req.params;

  try {
    const user = await db.user.findUnique({ where: { id: userId } });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const disabledEmail = `disabled-${timestamp}-${user.email}`;

    await updateUser(userId, {
      email: disabledEmail,
      isActive: false,
    });

    res.status(200).json({
      message: "User disabled (soft-deleted) and email updated successfully",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Failed to disable user",
      error: err,
    });
  }
};
