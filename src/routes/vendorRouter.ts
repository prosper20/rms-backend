import { Router } from "express";
import {
  createVendor,
  getVendors,
  getVendorById,
  getVendorByName,
  updateVendorController,
  VendorSoftDelete,
  VendorHardDelete,
  addUserToVendor,
} from "../controllers/vendorController";

const vendorRouter = Router();

// Vendor CRUD
vendorRouter.post("/vendors", createVendor);
vendorRouter.get("/vendors", getVendors);
vendorRouter.get("/vendors/:vendorId", getVendorById);
vendorRouter.get("/vendors/name/:name", getVendorByName);
vendorRouter.put("/vendors/:vendorId", updateVendorController); // <- updated controller
vendorRouter.delete("/vendors/:vendorId", VendorSoftDelete); // <- soft delete
vendorRouter.delete("/vendors/hard/:vendorId", VendorHardDelete); // <- hard delete

// Relations
vendorRouter.post("/vendors/add-user", addUserToVendor);

export default vendorRouter;
