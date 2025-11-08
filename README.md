# ResKonnect

## 🌍 Overview
**ResKonnect** is a digital platform for South African university students, helping them connect with accommodation, campus news, marketplace listings, jobs, and student services.

Built with **Lovable (Vite + React)** and **Supabase**, and deployed on **Vercel**, ResKonnect provides a unified student experience through a fast and modern web app.

---

## 🧩 Features
- 🏠 **Find Accommodation** — Browse and apply for TUT-accredited residences.
- 🗞️ **Campus News** — Stay informed with real-time campus updates.
- 🛒 **Student Marketplace** — Buy, sell, or exchange goods securely.
- 💼 **Student Jobs** — Apply for verified student job opportunities.
- 👤 **Profile Creation** — Build and manage your verified student profile.
- 🔔 **Notifications** — Get important updates from admins instantly.

---

## ⚙️ Setup & Installation

### Prerequisites
- Node.js v18+
- npm or yarn
- Supabase project (for production use)

### Installation Steps
1. Clone this repository
   ```bash
   git clone https://github.com/yourusername/reskonnect.git
   ```
2. Install dependencies
   ```bash
   npm install
   ```
3. Configure environment variables in a `.env` file:
   ```env
   VITE_SUPABASE_URL=<your_supabase_project_url>
   VITE_SUPABASE_ANON_KEY=<your_supabase_anon_key>
   ```
4. Start the development server
   ```bash
   npm run dev
   ```

### 🧠 Environment Modes
| Mode                   | Platform        | Description                                                              |
| ---------------------- | --------------- | ------------------------------------------------------------------------ |
| 🧪 **Development (Local)** | Lovable Studio  | Uses Lovable’s built-in Supabase environment. No manual setup required.  |
| 🚀 **Production (Live)** | Vercel          | Connects to your permanent Supabase instance via .env variables.          |

⚠️ Even though Lovable manages the local Supabase automatically, you must configure your own Supabase credentials in Vercel for production.

---

## 🚀 Deployment (Vercel)
1. Push your code to GitHub.
2. Import your repo into Vercel.
3. In the Environment Variables section, add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy the project — Vercel will automatically build your Vite app.

---

## 📘 Documentation
All components, hooks, and functions include JSDoc-based documentation. See `docs/summary.md` for a breakdown of documented files and coverage details.

---

## 🧑‍💻 Contributing
1. Fork the repository
2. Create a new branch (`feature/your-feature-name`)
3. Commit and test your changes
4. Submit a pull request

---

## 🧾 License
Open-source under the MIT License.
