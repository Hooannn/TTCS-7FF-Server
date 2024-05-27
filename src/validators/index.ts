import { body } from 'express-validator';

export const emailValidator = () => body('email').isEmail();
export const passwordValidator = () => body('password').isLength({ min: 6, max: 25 });
