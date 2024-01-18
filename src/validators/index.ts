import { body } from 'express-validator';

export const emailValidator = () => body('email').isEmail();
export const passwordValidator = () => body('password').isLength({ min: 6, max: 25 });

export const checkoutValidator = () => [
  body('isDelivery').isBoolean(),
  body('items').isArray({ min: 1 }),
  body('items.*.product').isString().not().isEmpty(),
  body('items.*.quantity').isInt().not().isEmpty(),
  body('deliveryPhone').optional().isMobilePhone(['vi-VN']),
  body('deliveryAddress').optional().isString(),
  body('voucher').optional().isString(),
  body('note').optional().isString(),
];
