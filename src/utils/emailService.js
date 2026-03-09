import nodemailer from "nodemailer";

// SMTP mail credentials
const smtpConfig = {
  host: process.env.SMTP_HOST || "smtp.office365.com",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USERNAME || "no-reply@neokred.tech",
    pass: process.env.SMTP_PASSWORD || "n$Ku3}_3Q0U!",
  },
  tls: {
    rejectUnauthorized: false, // do not fail on invalid certs
  },
};

const transporter = nodemailer.createTransport(smtpConfig);

function sendEmail(to, subject, text, html) {
  const mailOptions = {
    from: smtpConfig.auth.user, // sender address from SMTP configuration
    to,
    subject,
    text,
    html: html || text, // html body (fallback to text if not provided)
  };

  return new Promise((resolve, reject) => {
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        reject(error);
      } else {
        resolve(info);
      }
    });
  });
}

// Welcome email function for signup
function sendWelcomeEmail(to, userName, department) {
  const subject = "Welcome to Neo Product Hub!";
  const text = `Hello ${userName}, welcome to Nekred Product Hub! Your account has been created for the ${department} department.`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to Neo Product Hub</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
            .welcome-message { background: #e8f5e8; border: 1px solid #4caf50; padding: 15px; border-radius: 4px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
            .btn { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 10px 0; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>🎉 Welcome to Neo Product Hub</h1>
            <p>Your journey starts here!</p>
        </div>
        <div class="content">
            <h2>Hello ${userName}!</h2>
            <div class="welcome-message">
                <strong>🎊 Congratulations!</strong> Your account has been successfully created.
            </div>
            
            <p>We're excited to have you join our team in the <strong>${department}</strong> department. Neo Product Hub is your central platform for collaboration, updates, and innovation.</p>
            
            <h3>What's next?</h3>
            <ul>
                <li>✅ Your account is set up and ready to use</li>
                <li>🔍 Explore the product features and updates</li>
                <li>💬 Connect with your team members</li>
                <li>📝 Share feedback and suggestions</li>
            </ul>
            
            <p>If you need any assistance or have questions, don't hesitate to reach out to your team lead or system administrator.</p>
            
            <p>Welcome aboard!<br>Product Wall Team</p>
        </div>
       
    </body>
    </html>
  `;

  return sendEmail(to, subject, text, html);
}

// Generate a 6-digit OTP code
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Send OTP email
async function sendOTPEmail(email, name, otpCode) {
  const subject = "Your Login OTP - Neo Product Hub";
  const text = `Hello ${name}, your OTP code is: ${otpCode}. This code is valid for 10 minutes.`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Your Login OTP</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
            .otp-code { background: #667eea; color: white; font-size: 32px; font-weight: bold; text-align: center; padding: 20px; margin: 20px 0; border-radius: 8px; letter-spacing: 8px; }
            .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 4px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>🔐 Neo Product Hub</h1>
            <p>Your One-Time Password</p>
        </div>
        <div class="content">
            <h2>Hello ${name || "there"}!</h2>
            <p>You've requested to sign in to your Neo Product Hub account. Please use the following OTP code to complete your login:</p>
            
            <div class="otp-code">${otpCode}</div>
            
            <div class="warning">
                <strong>⚠️ Important:</strong>
                <ul>
                    <li>This code is valid for <strong>10 minutes</strong> only</li>
                    <li>Do not share this code with anyone</li>
                    <li>If you didn't request this code, please ignore this email</li>
                </ul>
            </div>
            
            <p>If you're having trouble accessing your account, please contact your system administrator.</p>
            
            <p>Best regards,<br>Product Wall Team</p>
        </div>
        <div class="footer">
            <p>This is an automated message. Please do not reply to this email.</p>
            <p>&copy; ${new Date().getFullYear()} Neokred Technologies. All rights reserved.</p>
        </div>
    </body>
    </html>
  `;

  try {
    // Always try to send email first
    await sendEmail(email, subject, text, html);
    console.log("✅ OTP Email sent successfully to:", email);
    return { success: true, messageId: "sent" };
  } catch (error) {
    console.error("❌ Email sending failed:", error);
    // Log the OTP as fallback
    console.log("🔐 OTP Email (Fallback - Logging OTP due to email failure)");
    console.log(`To: ${email}`);
    console.log(`Name: ${name}`);
    console.log(`OTP Code: ${otpCode}`);
    console.log("---");
    return { success: false, error: error.message };
  }
}

// Validate email domain
function validateEmailDomain(email) {
  const allowedDomains = (
    process.env.ALLOWED_EMAIL_DOMAINS || "neokred.tech"
  ).split(",");
  const emailDomain = email.split("@")[1]?.toLowerCase();

  return allowedDomains.some(
    (domain) => emailDomain === domain.trim().toLowerCase(),
  );
}

// Account approval email function
function sendApprovalEmail(to, userName) {
  const subject = "Account Approved - Neo Product Hub";
  const text = `Hello ${userName}, your account has been approved! You can now access Neo Product Hub with full privileges.`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Account Approved</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #4caf50 0%, #2e7d32 100%); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
            .approval-message { background: #e8f5e8; border: 1px solid #4caf50; padding: 15px; border-radius: 4px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
            .btn { display: inline-block; background: #4caf50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 10px 0; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>✅ Account Approved!</h1>
            <p>Welcome to the Neo Product Hub family</p>
        </div>
        <div class="content">
            <h2>Hello ${userName}!</h2>
            <div class="approval-message">
                <strong>🎉 Great news!</strong> Your account has been approved by the administrator.
            </div>
            
            <p>You now have full access to Neo Product Hub and can:</p>
            
            <ul>
                <li>✅ Sign in to your account</li>
                <li>🔍 Explore all product features</li>
                <li>💬 Collaborate with your team</li>
                <li>📝 Share feedback and suggestions</li>
                <li>📊 Access your dashboard and tools</li>
            </ul>
            
            <p>You can now sign in using your email and password to start using the platform.</p>
            
            <p>If you have any questions or need assistance, don't hesitate to reach out to your team lead or system administrator.</p>
            
            <p>Welcome aboard!<br>Product Wall Team</p>
        </div>
        <div class="footer">
            <p>This is an automated notification message.</p>
            <p>&copy; ${new Date().getFullYear()} Neokred Technologies. All rights reserved.</p>
        </div>
    </body>
    </html>
  `;

  return sendEmail(to, subject, text, html);
}

// Account rejection email function
function sendRejectionEmail(to, userName, reason = null) {
  const subject = "Account Application Update - Neo Product Hub";
  const text = `Hello ${userName}, we regret to inform you that your account application has been declined. Please contact the administrator for more information.`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Account Application Update</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #f44336 0%, #d32f2f 100%); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
            .rejection-message { background: #ffebee; border: 1px solid #f44336; padding: 15px; border-radius: 4px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
            .contact-info { background: #fff3cd; border: 1px solid #ffc107; padding: 15px; border-radius: 4px; margin: 20px 0; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>Account Application Update</h1>
            <p>Neo Product Hub</p>
        </div>
        <div class="content">
            <h2>Hello ${userName},</h2>
            <div class="rejection-message">
                <strong>📋 Application Status:</strong> We regret to inform you that your account application has been declined.
            </div>
            
            ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ""}
            
            <div class="contact-info">
                <strong>📞 What's Next?</strong>
                <p>If you believe this is an error or would like to discuss your application, please contact our administrator:</p>
                <ul>
                    <li>Email your team lead or system administrator</li>
                    <li>Provide any additional information that may be relevant</li>
                    <li>Ask about the application process or requirements</li>
                </ul>
            </div>
            
            <p>We appreciate your interest in Neo Product Hub. If you have any questions about this decision or the application process, please don't hesitate to reach out to the administrator.</p>
            
            <p>Thank you for your understanding.<br>Product Wall Team/p>
        </div>
       
    </body>
    </html>
  `;

  return sendEmail(to, subject, text, html);
}

export {
  sendEmail,
  sendWelcomeEmail,
  generateOTP,
  sendOTPEmail,
  validateEmailDomain,
  sendApprovalEmail,
  sendRejectionEmail,
};
