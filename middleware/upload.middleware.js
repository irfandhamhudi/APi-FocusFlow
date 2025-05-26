import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "../config/cloudinary.js";

// Konfigurasi penyimpanan di Cloudinary
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "FocusFlow/avatar", // Folder di Cloudinary untuk avatar
    allowed_formats: ["jpg", "jpeg", "png", "gif"], // Format yang diperbolehkan
    public_id: (req, file) => {
      // Membuat public_id unik berdasarkan timestamp dan nama asli file (tanpa ekstensi)
      const timestamp = Date.now();
      const fileName = file.originalname.split(".")[0]; // Ambil nama file tanpa ekstensi
      return `${timestamp}_${fileName}`;
    },
  },
});

// Middleware untuk menangani single upload
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // Batas ukuran file: 5MB
  },
  fileFilter: (req, file, cb) => {
    // Validasi tipe file
    const allowedTypes = ["image/jpeg", "image/png", "image/gif"];
    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error("Only JPEG, PNG, and GIF files are allowed!"));
    }
    cb(null, true);
  },
}).single("images"); // Nama field untuk file tunggal adalah "avatar"

export default upload;
