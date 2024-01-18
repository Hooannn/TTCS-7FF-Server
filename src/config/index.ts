import { config } from 'dotenv';
config({ path: `.env.${process.env.NODE_ENV || 'development'}.local` });
export { errorStatus } from './error.status';
export { successStatus } from './success.status';
export const CREDENTIALS = process.env.CREDENTIALS === 'true';
export const {
  DB_URI,
  NODE_ENV,
  ORIGIN,
  PORT,
  LOG_FORMAT,
  LOG_DIR,
  ACCESS_TOKEN_SECRET,
  ACCESS_TOKEN_LIFE,
  REFRESH_TOKEN_SECRET,
  REFRESH_TOKEN_LIFE,
  SALTED_PASSWORD,
  GMAIL_PASSWORD,
  GMAIL_USER,
  RESETPASSWORD_TOKEN_SECRET,
  RESETPASSWORD_TOKEN_LIFE,
  CLIENT_URL,
  CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET,
  GG_CLIENT_ID,
} = process.env;
