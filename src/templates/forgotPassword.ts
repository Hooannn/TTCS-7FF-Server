export const forgotPasswordTemplate = (firstName: string, url: string, locale: string) => `
<html>
    <head>
        <meta charset="UTF-8" />
        <meta http-equiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>
            7FF | ${locale === 'vi' ? 'Đặt lại mật khẩu' : 'Reset password'}
        </title>
        <style>
            body {
                position: relative;
                height: 100vh;
                margin: 0;
                text-align: center;
            }
            
            .container {
                width: 100%;
                max-width: 700px;
                height: 100%;
                padding: 35px;
                border-radius: 5px;
                background-color: #222831;
                color: #fff;
            }

            .card {
                position: absolute;
                top: 50%;
                left: 50%;
                width: 100%;
                transform: translate(-50%, -50%);
            }

            span {
                color: #ffbe33;
            }

            button {
                padding: 1em 6em;
                border: 0;
                border-radius: 5px;
                background-color: #ffbe33;
                transition: all 0.3s ease-in;
            }

            button:hover {
                background-color: #e69c00;
            }

            .spacing {
                margin-top: 3rem;
            }
        </style>
    </head>

    <body>
        <div class="container">
            <div class="card">
                <h1 style="margin-top: 0"><span>${locale === 'vi' ? 'Xin chào' : 'Hello'}</span> ${firstName}!</h1>
                <p>
                    ${
                      locale === 'vi'
                        ? 'Chúng tôi đã nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn'
                        : 'We received a request to reset the password for your account'
                    }
                </p>
                <p>
                    ${locale === 'vi' ? 'Bạn đã quên mật khẩu?' : 'Forgot your password?'}
                </p>

                <div class="spacing">
                    <p>${locale === 'vi' ? 'Để đặt lại mật khẩu, hãy ấn vào nút bên dưới' : 'To reset your password, click the below button'} 👇🏻</p>
                    <p>${
                      locale === 'vi'
                        ? 'Liên kết này sẽ hết hiệu lực trong 10 phút và chỉ dùng được 1 lần'
                        : 'This URL will be expired in 10 minutes and can be used only once'
                    }</p>
                    <a href="${url}" target="_blank">
                        <button style="cursor: pointer">
                            ${locale === 'vi' ? 'Đặt lại mật khẩu' : 'Reset my password'}
                        </button>
                    </a>
                </div>

                <p class="spacing" style="margin-bottom: 0">
                    ${
                      locale === 'vi'
                        ? 'Cảm ơn bạn đã ủng hộ 7FF, chúc bạn có 1 ngày tốt lành'
                        : 'Thank you for choosing 7FF, we wish you a great day'
                    }!
                </p>
            </div>
        </div>
    </body>
</html>
`;
