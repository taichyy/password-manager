# Taidy Pass

A simple, user-friendly password manager built with Next.js and MongoDB.

## 🚀 Features

- Secure credential storage with encryption.
- JWT-based authentication and session management.
- Modern UI built with Tailwind CSS and Radix UI.

## 🛠️ Technologies Used

- Next.js
- MongoDB / Mongoose
- JWT
- Tailwind CSS
- React

## 📦 Requirements

- Node.js 18+ or later
- MongoDB database / Atlas cluster

## 🔧 Environment Variables

Create a `.env` file in the project root and set the following variables:

```env
# PROD | DEV
NEXT_PUBLIC_ENV=PROD

# API URL, do not append a trailing slash
NEXT_PUBLIC_API_URL=http://localhost:3000

# MongoDB connection string
MONGODB_URI=

# Secret for encrypting user login credentials
USER_SECRET=

# Secret for signing JWT tokens
JWT_SECRET=
```

### Notes

- `NEXT_PUBLIC_ENV` should be either `PROD` or `DEV`.
- `NEXT_PUBLIC_API_URL` is used to build internal API callback URLs. Do not include a trailing `/`.
- `USER_SECRET` is used to encrypt/decrypt stored user credentials.
- `JWT_SECRET` is used to sign and verify JWT tokens.

## 🚀 Run Locally

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Open `http://localhost:3000` in your browser.

## 🧪 Build for Production

```bash
npm run build
npm start
```

## 📁 Project Structure

- `app/` - Next.js app routes and pages
- `components/` - Shared UI components
- `lib/` - Application utilities and database connection
- `models/` - Mongoose schema definitions
- `app/api/` - API routes

## 📌 Important

- Keep `.env` values private and do not commit them to source control.
- Restart the Next.js server after changing environment variables.

## 📜 License

This project is available under the MIT License.
