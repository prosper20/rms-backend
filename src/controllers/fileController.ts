import { Request, Response } from "express";
import path from "path";
import { db } from "../db";
import { Prisma } from "@prisma/client";

type User = Prisma.UserGetPayload<{}>

// Upload (Create) a new file entry
export const uploadFile = async (req: Request, res: Response) => {
  const { name, type, size, url, path, vendorId } = req.body;
  const sharedById = req.userId;

  if (!name || !type || !size || !url || !vendorId) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  try {
    const file = await db.file.create({
      data: {
        name,
        type,
        size: Number(size),
        url,
        path: path || "",
        vendorId,
        sharedById,
      },
      include: {
        sharedBy: { select: { id: true, fullName: true } },
        vendor: { select: { id: true, name: true } },
      },
    });

    res.status(201).json(file);
  } catch (error) {
    console.error("File Upload Error:", error);
    res.status(500).json({ message: "Failed to upload file", error });
  }
};


export const getFiles = async (req: Request, res: Response) => {
  const vendorSlug = req.query.vendor as string;
  const search = (req.query.search as string) || "";
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;

  if (!vendorSlug) {
    return res.status(400).json({ message: "Missing vendor parameter." });
  }

  try {
    const vendor = await db.vendor.findUnique({
      where: { name: vendorSlug },
    });

    if (!vendor) {
      return res.status(404).json({ message: "Vendor not found." });
    }

    const whereClause = {
      vendorId: vendor.id,
      ...(search && {
        name: {
          contains: search,
          mode: Prisma.QueryMode.insensitive,
        },
      }),
    };

    // Get total count of files matching the criteria
    const totalFiles = await db.file.count({
      where: whereClause,
    });

    // Get the files for current page
    const files = await db.file.findMany({
      where: whereClause,
      orderBy: { sharedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        sharedBy: { select: { id: true, fullName: true } },
        vendor: { select: { id: true, name: true } },
      },
    });

    // Calculate pagination values
    const totalPages = Math.ceil(totalFiles / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;
    const nextPage = hasNextPage ? page + 1 : null;
    const prevPage = hasPrevPage ? page - 1 : null;

    return res.status(200).json({
      files,
      currentPage: page,
      totalFiles,
      totalPages,
      hasNextPage,
      hasPrevPage,
      nextPage,
      prevPage,
    });
  } catch (error) {
    console.error("Get Files Error:", error);
    return res.status(500).json({ message: "Failed to fetch files", error });
  }
};

// export const getFiles = async (req: Request, res: Response) => {
//   const vendorSlug = req.query.vendor as string | undefined;

//   const vendor = await db.vendor.findUnique({
//     where: { name: vendorSlug },
//   });

//   try {
//     const files = await db.file.findMany({
//       where: {
//        vendorId: vendor.id 
//       },
//       orderBy: { sharedAt: "desc" },
//       include: {
//         sharedBy: { select: { id: true, fullName: true } },
//         vendor: { select: { id: true, name: true } },
//       },
//     });

//     res.status(200).json(files);
//   } catch (error) {
//     console.error("Get Files Error:", error);
//     res.status(500).json({ message: "Failed to fetch files", error });
//   }
// };

// Get a specific file by ID
export const getFileById = async (req: Request, res: Response) => {
  const { fileId } = req.params;

  try {
    const file = await db.file.findUnique({
      where: { id: fileId },
      include: {
        sharedBy: { select: { id: true, fullName: true } },
        vendor: { select: { id: true, name: true } },
      },
    });

    if (!file) return res.status(404).json({ message: "File not found" });

    res.status(200).json(file);
  } catch (error) {
    console.error("Get File By ID Error:", error);
    res.status(500).json({ message: "Failed to fetch file", error });
  }
};

// Delete a file by ID
export const deleteFile = async (req: Request, res: Response) => {
  const { fileId } = req.params;

  try {
    await db.file.delete({
      where: { id: fileId },
    });

    res.status(200).json({ message: "File deleted successfully" });
  } catch (error) {
    console.error("Delete File Error:", error);
    res.status(500).json({ message: "Failed to delete file", error });
  }
};

export const getWeeklyReports = async (req: Request, res: Response) => {

  try {

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const files = await db.file.findMany({
      where: {
        sharedAt: {
          gte: oneWeekAgo,
        },
      },
      orderBy: {
        sharedAt: "desc",
      },
      include: {
        sharedBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        vendor: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    res.status(200).json(files);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch weekly reports", error: err });
  }
};

export const getReportFileTypeGraphData = async (req: Request, res: Response) => {

  try {
    // Fetch all files for the vendor
    const files = await db.file.findMany({
      select: {
        name: true,
      },
    });

    const getCategory = (filename: string): string => {
      const ext = path.extname(filename).toLowerCase().replace(".", ""); // e.g. 'pdf'

      switch (ext) {
        case "pdf":
          return "PDF";
        case "doc":
        case "docx":
          return "Word";
        case "xls":
        case "xlsx":
          return "Excel";
        case "ppt":
        case "pptx":
          return "PowerPoint";
        case "csv":
          return "CSV";
        default:
          return "Other";
      }
    };

    // Count by category
    const categoryCounts: Record<string, number> = {};

    for (const file of files) {
      const category = getCategory(file.name);
      categoryCounts[category] = (categoryCounts[category] || 0) + 1;
    }

    const total = Object.values(categoryCounts).reduce((acc, val) => acc + val, 0) || 1;

    const result: Record<string, number> = {};
    for (const [category, count] of Object.entries(categoryCounts)) {
      result[category] = Math.round((count / total) * 100);
    }

    return res.status(200).json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to fetch report file type graph data", error: err });
  }
};

export const getDailyReports = async (req: Request, res: Response) => {
  try {
    // Get today's date at midnight
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // Fetch total count of today's reports
    const totalCount = await db.file.count({
      where: {
        sharedAt: {
          gte: todayStart,
        },
      },
    });

    // Fetch the latest 4 reports shared today
    const latestReports = await db.file.findMany({
      where: {
        sharedAt: {
          gte: todayStart,
        },
      },
      orderBy: {
        sharedAt: "desc",
      },
      take: 4,
      include: {
        sharedBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        vendor: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    res.status(200).json({
      totalCount,
      latestReportsToday: latestReports,
    });
  } catch (err) {
    console.error("Get Daily Reports Error:", err);
    res.status(500).json({
      message: "Failed to fetch daily reports",
      error: err,
    });
  }
};

