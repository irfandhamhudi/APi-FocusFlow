// config/nodemailer.js
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "Gmail", // atau layanan email lain
  auth: {
    user: process.env.EMAIL_USER, // Email pengirim
    pass: process.env.EMAIL_PASS, // Password atau App Password
  },
});

export const sendInvitationEmail = async (to, taskTitle, invitationLink) => {
  try {
    await transporter.sendMail({
      from: `"Task Manager" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_USER,
      subject: `Invitation to Join Task: ${taskTitle}`,
      html: `
        <h3>You have been invited to join a task!</h3>
        <p>Task: <strong>${taskTitle}</strong></p>
        <p>Click the link below to join the task:</p>
        <a href="${invitationLink}">Join Task</a>
        <p>If you did not expect this invitation, please ignore this email.</p>
      `,
    });
    console.log(`Invitation email sent to ${to}`);
  } catch (error) {
    console.error("Error sending email:", error.message);
    throw new Error("Failed to send invitation email");
  }
};
