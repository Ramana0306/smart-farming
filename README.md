# 🌾 Smart Farming Assistant

**A multilingual farming support platform that helps farmers find verified agricultural information and connect with a farming community.**

[🌐 Live Application](https://smart-farming-lilac.vercel.app/) · [⚙️ API Documentation](https://smart-farming-api-70uh.onrender.com/docs) · [📂 GitHub Repository](https://github.com/Ramana0306/smart-farming)

---

## 📌 Overview

Smart Farming Assistant is a full-stack web application designed to make agricultural knowledge more accessible to farmers.

Users can ask farming-related questions in English or Tamil. The application searches a knowledge base of reviewed agricultural information and returns a relevant answer with its source when a suitable match is found. If no sufficiently relevant answer is available, the application allows the question to be shared with the farming community so other farmers can contribute answers.

The project focuses on multilingual accessibility, verified knowledge retrieval, and community-driven knowledge sharing.

## ✨ Features

- 🌱 **Farming Knowledge Assistant** — Searches a database of agricultural questions and answers.
- 🌐 **English and Tamil Support** — Accepts questions in English and Tamil and returns an answer in the available language where possible.
- 📚 **Source-Aware Answers** — Displays the source associated with a matched knowledge-base entry.
- 👥 **Community Question Sharing** — Unanswered questions can be added to the community for other farmers to answer.
- 🔐 **User Authentication** — Supports farmer registration and login.
- 🗄️ **Database Integration** — Uses PostgreSQL to store application data.
- 🚀 **Cloud Deployment** — Frontend and backend are deployed separately for public access.
- 📖 **REST API Documentation** — Provides interactive API documentation through FastAPI Swagger UI.

## 🛠️ Technology Stack

| Component | Technology |
|---|---|
| Frontend | React, Vite |
| Backend | Python, FastAPI |
| API | REST |
| Database | PostgreSQL |
| ORM / Database Access | SQLAlchemy |
| Authentication | JWT-based authentication |
| Password Security | Password hashing |
| Deployment | Vercel, Render |
| Database Hosting | Neon PostgreSQL |

## 🏗️ Application Architecture

```text
                 Farmer
                    |
                    v
          React + Vite Frontend
                    |
               REST API
                    |
                    v
             FastAPI Backend
                    |
          +---------+----------+
          |                    |
          v                    v
   Knowledge Search      Community Questions
          |                    |
          v                    v
  Verified Knowledge     Farmer Contributions
          |                    |
          +---------+----------+
                    |
                    v
             PostgreSQL
```

### How it works

1. A farmer registers or logs in.
2. The farmer submits a question in English or Tamil.
3. The backend searches the verified knowledge-base entries.
4. If a sufficiently relevant entry with an answer is found, the API returns the answer and its source.
5. If no suitable answer is found, the application creates or reuses a community question.
6. Other farmers can view community questions and submit answers.

**Important:** The current assistant uses knowledge-base keyword matching. It is not a generative AI model, and its matching results should be validated before agricultural advice is relied upon.

## 🌐 Live Demo

| Resource | Link |
|---|---|
| Web Application | https://smart-farming-lilac.vercel.app/ |
| Backend API | https://smart-farming-api-70uh.onrender.com |
| Interactive API Docs | https://smart-farming-api-70uh.onrender.com/docs |
| Source Code | https://github.com/Ramana0306/smart-farming |

The application is publicly hosted. Backend services on free hosting plans may take some time to wake up after periods of inactivity.

## 🚀 Run Locally

### Prerequisites

Install the following tools:

- Python 3.10 or a compatible version required by the project dependencies
- Node.js and npm
- Git
- PostgreSQL, or access to a compatible hosted PostgreSQL database

### 1. Clone the repository

```bash
git clone https://github.com/Ramana0306/smart-farming.git
cd smart-farming
```

### 2. Set up the backend

Create and activate a virtual environment.

**Windows PowerShell:**

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

Install the Python dependencies:

```bash
pip install -r requirements.txt
```

### 3. Configure environment variables

Create a `.env` file in the backend project directory if your application uses it. Configure the database connection string and any other environment variables required by your code.

Example:

```env
DATABASE_URL=your_postgresql_connection_string
SECRET_KEY=your_long_random_secret
```

These are examples of configuration values. Use the actual variable names expected by your application, and never commit real passwords, tokens, or secret keys.

### 4. Start the backend

```bash
python -m fastapi dev main.py
```

Open the interactive API documentation:

http://127.0.0.1:8000/docs

### 5. Start the frontend

Open another terminal:

```bash
cd frontend
npm install
npm run dev
```

Open the local URL displayed by Vite in your terminal.

Ensure the frontend API configuration points to your local backend when developing locally.

## 🔌 API Overview

The backend exposes REST endpoints for authentication, assistant questions, and community interactions.

| Endpoint | Purpose |
|---|---|
| `POST /assistant/ask` | Search for a farming answer or create a community question |
| `GET /community/questions` | Retrieve community questions and their answers |
| `POST /community/questions/{question_id}/answers` | Submit an answer to a community question |
| `GET /docs` | Explore the API interactively |

Authentication endpoints are also available in the backend.

For request schemas, authentication requirements, and response formats, refer to the live [Swagger API documentation](https://smart-farming-api-70uh.onrender.com/docs).

## 🔒 Security and Limitations

- Keep database credentials and authentication secrets in environment variables.
- Do not commit `.env` files containing real credentials.
- Only entries marked as verified by the application are considered by the assistant.
- A verified database status does not, by itself, guarantee that the underlying agricultural information has been independently fact-checked.
- Keyword-based matching may return an imperfect match or fail to recognize a valid question.
- Community contributions should be reviewed before being treated as verified agricultural guidance.
- Do not rely on this student project as a replacement for qualified agricultural advice.

## 🔮 Future Enhancements

- Semantic search for questions with different wording.
- AI-assisted answers grounded in trusted agricultural documents.
- Voice-based question input and spoken answers.
- Improved Tamil-language understanding.
- Expert review and moderation of community contributions.
- Automated tests, API monitoring, and improved error reporting.
- Better accessibility and mobile usability.

## 🤝 Contributing

Contributions and suggestions are welcome.

1. Fork this repository.
2. Create a feature branch.
3. Make your changes and test them.
4. Commit and push your changes.
5. Open a pull request describing your contribution.

Please avoid including credentials or private user data in issues and pull requests.

## 👨‍💻 Author

**Ramana M.**

B.Tech Information Technology

[GitHub Profile](https://github.com/Ramana0306)

---

If you find this project useful, consider giving the repository a ⭐ on GitHub.

*Built as a student project to explore full-stack development, multilingual farming information, and community-based knowledge sharing.*
