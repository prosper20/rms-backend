import { Request, Response } from "express";
import { db } from "../db";

const updateVendor = async (
  vendorId: string,
  data: Partial<{ name: string; isActive: boolean }>
) => {
  return await db.vendor.update({
    where: { id: vendorId },
    data,
  });
};


// Create Vendor
export const createVendor = async (req: Request, res: Response) => {
  const { name } = req.body;

  try {
    const vendor = await db.vendor.create({
      data: { name },
      include: {
        users: {
          select: { id: true, fullName: true, email: true }
        },
        files: true,
      },
    });
    res.status(201).json(vendor);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to create vendor", error: err });
  }
};

// Get All Vendors
export const getVendors = async (_req: Request, res: Response) => {
  try {
    const vendors = await db.vendor.findMany({ 
      where: { isActive: true },
      include: {
        users: {
          select: { id: true, fullName: true, email: true }
        },
        files: true,
      },
    });
    res.status(200).json(vendors);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch vendors", error: err });
  }
};

// Get Vendor by ID
export const getVendorById = async (req: Request, res: Response) => {
  const { vendorId } = req.params;

  try {
    const vendor = await db.vendor.findUnique({
      where: { id: vendorId },
      include: {
        users: {
          select: { id: true, fullName: true, email: true }
        },
        files: true,
      },
    });

    if (!vendor) {
      return res.status(404).json({ message: "Vendor not found" });
    }

    res.status(200).json(vendor);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch vendor", error: err });
  }
};

// Get Vendor by name
export const getVendorByName = async (req: Request, res: Response) => {
  const { name } = req.params;

  try {
    const vendor = await db.vendor.findUnique({
      where: { id: name },
      include: {
        users: {
          select: { id: true, fullName: true, email: true }
        },
        files: true,
      },
    });

    if (!vendor) {
      return res.status(404).json({ message: "Vendor not found" });
    }

    res.status(200).json(vendor);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch vendor", error: err });
  }
};


export const updateVendorController = async (req: Request, res: Response) => {
  const { vendorId } = req.params;
  const { name } = req.body;

  if (!name || typeof name !== "string") {
    return res.status(400).json({ message: "Vendor name is required and must be a string." });
  }

  try {
    // Check if vendor exists
    const existingVendor = await db.vendor.findUnique({ where: { id: vendorId } });

    if (!existingVendor) {
      return res.status(404).json({ message: "Vendor not found." });
    }

    // Check for name conflict (exclude the current vendor)
    const nameConflict = await db.vendor.findFirst({
      where: {
        name: { equals: name.trim(), mode: "insensitive" },
        id: { not: vendorId },
      },
    });

    if (nameConflict) {
      return res.status(409).json({ message: "Vendor name already in use." });
    }

    // Update the vendor
    const updatedVendor = await updateVendor(vendorId, { name: name.trim() });

    res.status(200).json({
      message: "Vendor name updated successfully.",
      vendor: updatedVendor,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Failed to update vendor name.",
      error: err,
    });
  }
};


export const VendorSoftDelete = async (req: Request, res: Response) => {
  const { vendorId } = req.params;

  try {
    const vendor = await db.vendor.findUnique({ where: { id: vendorId } });

    if (!vendor) {
      return res.status(404).json({ message: "Vendor not found" });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const disabledName = `disabled-${timestamp}-${vendor.name}`;

    const updatedVendor = await updateVendor(vendorId, {
      name: disabledName,
      isActive: false,
    });

    res.status(200).json({
      message: "Vendor soft-deleted and name updated successfully",
      vendor: updatedVendor,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Failed to soft-delete vendor",
      error: err,
    });
  }
};


export const VendorHardDelete = async (req: Request, res: Response) => {
  const { vendorId } = req.params;

  try {
    await db.vendor.delete({
      where: { id: vendorId },
    });

    res.status(200).json({ message: "Vendor deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to delete vendor", error: err });
  }
};

// Add User to Vendor
export const addUserToVendor = async (req: Request, res: Response) => {
  const { vendorId, userId } = req.body;

  try {
    const updatedUser = await db.user.update({
      where: { id: userId },
      data: {
        vendorId: vendorId,
      },
    });

    res.status(200).json({ message: "User added to vendor successfully", user: updatedUser });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to add user to vendor", error: err });
  }
};
