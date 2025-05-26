import nodemailer from "nodemailer";

const sendEmail = async (email, subject, message, username) => {
  const transporter = nodemailer.createTransport({
    service: "Gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject,
    html: `
      <!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Email Template</title>
</head>
<body style="font-family: Arial, sans-serif; margin: 0; padding: 20px;">
  <table style="max-width: 600px; margin: 0 auto; background-color: #fff; border: 1px solid #ddd; border-radius: 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); padding: 20px; text-align: center;">
    <tr>
      <td>
        <h1 style="font-size: 20px; ; margin-bottom: 20px;">Email Verification</h1>
        <p style="width:270px; font-size: 16px; ;">Hello ${username}! Enter the 6-digit verification code that was sent to verify your account.</p>
        <div style="margin: 20px 0;">
          <span style="font-size: 24px; font-weight: bold; display: inline-block; padding: 10px 20px; border: 1px solid #ddd; border-radius: 8px; ;">${message}</span>
        </div>
        
      </td>
    </tr>
  </table>
</body>
</html>



    `,
  };

  await transporter.sendMail(mailOptions);
};

export default sendEmail;
