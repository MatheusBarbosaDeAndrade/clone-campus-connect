import nodemailer from "nodemailer";
import { ServiceError } from "./errors.js";

function createTransport() {
  const auth = process.env.EMAIL_SMTP_USER
    ? {
        user: process.env.EMAIL_SMTP_USER,
        pass: process.env.EMAIL_SMTP_PASSWORD,
      }
    : undefined;

  return nodemailer.createTransport({
    host: process.env.EMAIL_SMTP_HOST,
    port: Number(process.env.EMAIL_SMTP_PORT),
    secure: process.env.EMAIL_SMTP_SECURE === "true",
    auth,
  });
}

async function send({ to, subject, text }) {
  try {
    await createTransport().sendMail({
      from: process.env.EMAIL_FROM,
      to,
      subject,
      text,
    });
  } catch (error) {
    throw new ServiceError({
      message: "Não foi possível enviar o e-mail.",
      cause: error,
    });
  }
}

const email = { send };

export default email;
