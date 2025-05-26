import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "../config/cloudinary.js";

// Konfigurasi penyimpanan di Cloudinary
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "FocusFlow/attachments", // Folder di Cloudinary
    allowed_formats: ["jpg", "jpeg", "png", "pdf", "doc", "docx"], // Format yang diperbolehkan
    resource_type: "auto", // Deteksi otomatis tipe file
    public_id: (req, file) => {
      // Membuat public_id unik berdasarkan timestamp dan nama asli file
      const timestamp = Date.now();
      const filename = file.originalname.split(".")[0];
      return `${filename}-${timestamp}`;
    },
  },
});

// Middleware untuk menangani upload
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // Batas 5MB per file
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf|doc|docx/;
    const extname = allowedTypes.test(
      file.originalname.toLowerCase().split(".").pop()
    );
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(
        new Error("Tipe file tidak didukung! Hanya JPEG, PNG, PDF, DOC, DOCX.")
      );
    }
  },
}).array("attachment", 10);

// Middleware untuk menangani error multer
const uploadMiddleware = (req, res, next) => {
  upload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      console.error("Multer error:", err.message);
      return res
        .status(400)
        .json({ message: "Upload error", error: err.message });
    } else if (err) {
      console.error("Upload error:", err.message);
      return res
        .status(400)
        .json({ message: "Upload error", error: err.message });
    }
    next();
  });
};

export default uploadMiddleware;
