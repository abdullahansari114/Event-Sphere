import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';

import { CloudinaryStorage } from 'multer-storage-cloudinary-v2';

console.log('Cloudinary file loading')
cloudinary.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.CLOUDINARY_KEY,
    api_secret: process.env.CLOUDINARY_SECRET_KEY
});

console.log('Cloudinary Auth done.....')

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'hello',
        allowed_format: ['png', 'jpg', 'jpeg', 'gif', 'jfif','webp', 'avif']
    },
});

export const parser = multer({ storage: storage });

