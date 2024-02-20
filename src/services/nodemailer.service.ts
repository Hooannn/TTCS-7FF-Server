import nodemailer, { SendMailOptions, SentMessageInfo } from 'nodemailer';
import { GMAIL_PASSWORD, GMAIL_USER } from '@/config';
import { forgotPasswordTemplate, orderConfirmationTemplate } from '@/templates';
class NodemailerService {
  private transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: GMAIL_USER,
      pass: GMAIL_PASSWORD,
    },
  });

  public sendMail(mailOptions: SendMailOptions) {
    return new Promise<SentMessageInfo>((resolve, reject) => {
      this.transporter.sendMail(mailOptions, function (err, info) {
        if (err) {
          reject(err);
        } else {
          resolve(info);
        }
      });
    });
  }

  public async sendResetPasswordMail(email: string, firstName: string, href: string, locale: string) {
    const mailOptions: SendMailOptions = {
      from: GMAIL_USER,
      to: email,
      subject: locale === 'vi' ? 'Đặt lại mật khẩu - 7FF' : 'Reset password - 7FF',
      html: forgotPasswordTemplate(firstName, href, locale),
    };
    return await this.sendMail(mailOptions);
  }

  public async sendOrderConfirmationEmail(email: string, firstName: string, orderId: string, href: string, locale: string) {
    const mailOptions: SendMailOptions = {
      from: GMAIL_USER,
      to: email,
      subject: locale === 'vi' ? 'Xác nhận đơn hàng - 7FF' : 'Order confirmation - 7FF',
      html: orderConfirmationTemplate(orderId, firstName, href, locale),
    };
    return await this.sendMail(mailOptions);
  }
}
export default NodemailerService;
